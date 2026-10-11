import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProvider, mockResult } from '../server/providers.mjs';
import { createProject, runWorkflow, approveProject, recordCorrection, recordObservation } from '../server/workflow.mjs';
import { createChallenge, verifyChallenge } from '../server/presence.mjs';
import { schemas, validateSchema, validateBrief } from '../server/contracts.mjs';
import { legacySeeds as seeds } from '../server/data.mjs';
import { createApp } from '../server/index.mjs';
import { createStore } from '../server/storage.mjs';

const brief = seeds[0];
const mock = createProvider({ AI_PROVIDER: 'mock' });
const config = { AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'https://example.test/v1', AI_MODEL: 'configured-model', AI_API_KEY: 'test-only-not-a-real-key' };

test('brief accepts stories without ownership details and rejects invalid budgets', () => {
  const { owner, ...withoutOwner } = brief;
  assert.equal(validateBrief(withoutOwner).owner, '共创者');
  assert.equal(validateBrief({ ...brief, owner: '' }).owner, '共创者');
  assert.throws(() => validateBrief({ ...brief, owner: 123 }), /署名/);
  assert.throws(() => validateBrief({ ...brief, budget: '129' }), /售價/);
  assert.throws(() => validateBrief({ ...brief, budget: NaN }), /售價/);
  assert.throws(() => validateBrief({ ...brief, story: ' ' }), /story/);
});

test('workflow records sequential real timestamps and exposes paced progress', async () => {
  const p = createProject(brief, 'mock');
  const progress = [];
  await runWorkflow(p, mock, { delayMs: 40, onProgress: () => progress.push(structuredClone(p.trace)) });
  assert.equal(progress.length, 10);
  for (const [i, step] of p.trace.entries()) {
    assert.equal(progress[i * 2][i].status, 'running');
    assert.equal(progress[i * 2][i].completedAt, undefined);
    assert.equal(progress[i * 2 + 1][i].status, 'completed');
    assert.ok(step.durationMs >= 39, `step ${step.id} skipped its reading interval`);
    assert.ok(Date.parse(step.completedAt) >= Date.parse(step.startedAt));
    assert.ok(Math.abs(Date.parse(step.completedAt) - Date.parse(step.startedAt) - step.durationMs) <= 2);
    assert.ok(step.processingMs <= step.durationMs);
    if (i) assert.ok(Date.parse(step.startedAt) >= Date.parse(p.trace[i - 1].completedAt));
  }
});

test('workflow gates demonstration until a person acknowledges the version', async () => {
  const p = createProject(brief, 'mock');
  assert.throws(() => approveProject(p, { acknowledged: true }), /先完成/);
  await runWorkflow(p, mock, { delayMs: 0 });
  assert.equal(p.status, 'awaiting_review');
  assert.equal(p.trace.filter(s => s.status === 'completed').length, 5);
  assert.throws(() => approveProject(p, {}), /確認/);
  approveProject(p, { acknowledged: true });
  assert.equal(p.status, 'demo_ready');
  assert.equal(p.approval.owner, brief.owner);
  assert.equal(p.outputs.supply.label, '規則估算示例，非供應商報價');
});

test('corrections create a new version, preserve rationale, and revoke approval', async () => {
  const p = createProject(brief, 'mock'); await runWorkflow(p, mock, { delayMs: 0 }); approveProject(p, { acknowledged: true });
  recordCorrection(p, { target: 'tagline', replacement: '一封寫給日常的家書', reason: '使用個人表達' });
  assert.equal(p.revision, 2); assert.equal(p.status, 'awaiting_review'); assert.equal(p.approval, null);
  assert.equal(p.outputs.design.tagline, '一封寫給日常的家書'); assert.equal(p.feedback[0].reason, '使用個人表達');
  assert.throws(() => recordObservation(p, { channel: 'live', decision: 'interested', note: '想了解材料' }), /先確認/);
  assert.throws(() => recordCorrection(p, { target: '__proto__' }), /請選擇/);
});

test('provider failures stop later steps and never become silent mock success', async () => {
  const p = createProject(brief, 'openai-compatible');
  await runWorkflow(p, { mode: 'openai-compatible', generate: async () => { throw new Error('secret upstream error'); } }, { delayMs: 0 });
  assert.equal(p.status, 'failed'); assert.equal(p.trace[1].status, 'pending');
  assert.ok(p.trace[0].startedAt && p.trace[0].failedAt);
  assert.equal(p.trace[0].completedAt, undefined);
  assert.equal(p.trace[1].startedAt, undefined);
  assert.ok(!JSON.stringify(p).includes('secret upstream'));
});

test('model contract rejects unsafe palette and excess fields', () => {
  const data = mockResult('design', brief);
  assert.throws(() => validateSchema({ ...data, palette: ['red', '#ffffff', '#123456'] }, schemas.design), /格式/);
  assert.throws(() => validateSchema({ ...data, certification: 'official' }, schemas.design), /未定義|不是已定義/);
});

test('compatible adapter builds a server-side structured request and parses output', async () => {
  let request;
  const provider = createProvider(config, async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(mockResult('culture', brief)) } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }) };
  });
  const result = await provider.generate('culture', brief, {});
  assert.equal(request.url, 'https://example.test/v1/chat/completions'); assert.equal(request.body.response_format.json_schema.strict, true);
  assert.equal(request.options.redirect, 'error'); assert.equal(result.usage.completionTokens, 20);
});

test('compatible adapter detects refusals, malformed outputs and HTTP errors', async () => {
  for (const payload of [
    { choices: [{ finish_reason: 'length', message: { content: '{}' } }] },
    { choices: [{ finish_reason: 'stop', message: { refusal: 'refused' } }] },
    { choices: [{ finish_reason: 'stop', message: { content: 'not json' } }] },
    { choices: [{ finish_reason: 'stop', message: { content: '{}' } }] }
  ]) await assert.rejects(createProvider(config, async () => ({ ok: true, json: async () => payload })).generate('culture', brief, {}));
  await assert.rejects(createProvider(config, async () => ({ ok: false, status: 429 })).generate('culture', brief, {}), /429/);
  assert.throws(() => createProvider({ ...config, AI_API_KEY: '' }), /API Key/);
  assert.throws(() => createProvider({ ...config, AI_BASE_URL: 'http://example.test' }), /HTTPS/);
});

test('challenges are scoped, expiring and single-use, without claiming identity proof', () => {
  const c = createChallenge('project', 1000);
  assert.throws(() => verifyChallenge(c, 'other', c.phrase, 1001), /領取/);
  assert.throws(() => verifyChallenge(c, 'project', c.phrase, 61000), /過期/);
  const result = verifyChallenge(c, 'project', c.phrase, 1001);
  assert.equal(result.assurance, 'demo-only'); assert.match(result.message, /不能證明/);
  assert.throws(() => verifyChallenge(c, 'project', c.phrase, 1002), /已使用/);
});

test('local storage retains feedback after reopening and marks interrupted runs', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'laiwu-test-'));
  try {
    const path = join(folder, 'projects.json'); const store = createStore(path);
    const p = createProject(brief, 'mock'); await runWorkflow(p, mock, { delayMs: 0 });
    recordCorrection(p, { target: 'tagline', replacement: '保留這次修改', reason: '復盤可追溯' });
    store.projects.set(p.id, p); store.save();
    assert.equal(createStore(path).projects.get(p.id).feedback.length, 1);
    assert.deepEqual(createStore(path).projects.get(p.id).trace, p.trace);
    p.status = 'running';
    p.trace[0] = { id: 'culture', status: 'running', startedAt: new Date().toISOString() };
    store.save();
    const interrupted = createStore(path).projects.get(p.id);
    assert.equal(interrupted.error.code, 'INTERRUPTED');
    assert.equal(interrupted.trace[0].status, 'failed');
    assert.ok(interrupted.trace[0].interruptedAt);
    assert.equal(interrupted.trace[0].completedAt, undefined);
    assert.equal(interrupted.trace[0].durationMs, undefined);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('HTTP flow: generate, approve, observe, edit, invalidate challenge, export and protect config', async () => {
  const server = createApp({ provider: mock, delayMs: 0 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(`${base}/.env`)).status, 404);
    assert.equal((await post('/api/projects', null)).status, 400);
    const rejected = await fetch(`${base}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' }, body: JSON.stringify(brief) });
    assert.equal(rejected.status, 403);
    let response = await post('/api/projects', brief); assert.equal(response.status, 202); const p = await response.json();
    for (let i = 0; i < 30; i++) { const value = await (await fetch(`${base}/api/projects/${p.id}`)).json(); if (value.status === 'awaiting_review') break; await new Promise(resolve => setTimeout(resolve, 10)); }
    assert.equal((await post(`/api/projects/${p.id}/challenge`, {})).status, 409);
    assert.equal((await post(`/api/projects/${p.id}/approve`, { acknowledged: true })).status, 409);
    async function business(action, role, fields = {}) {
      const current = await (await fetch(`${base}/api/projects/${p.id}`)).json();
      const response = await post(`/api/projects/${p.id}/business`, { ...fields, action, role, expectedVersion: current.business.version, contentRevision: current.revision, requestId: crypto.randomUUID() });
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    }
    await business('rights', 'culture', { state: 'limited', display: true, sample: false, credit: '示例创作者', evidence: '原创演示故事', expiresAt: '2099-01-01T00:00:00Z' });
    async function signoffs() {
      for (const [scope, role] of [['culture', 'culture'], ['brand', 'brand'], ['script', 'host']]) {
        const current = await (await fetch(`${base}/api/projects/${p.id}`)).json();
        await business('confirm', role, { scope, acknowledged: true, ...(scope === 'script' ? { openingEn: current.outputs.host.openingEn } : {}) });
      }
      return business('session', 'host');
    }
    const ready = await signoffs();
    const sessionId = ready.business.sessions[0].id;
    const challenge = await (await post(`/api/projects/${p.id}/challenge`, {})).json();
    response = await post(`/api/projects/${p.id}/observations`, { sessionId, requestId: crypto.randomUUID(), channel: 'campus', decision: 'price_high', note: '售價需要解釋材料成本' });
    assert.equal((await response.json()).observations.length, 1);
    await post(`/api/projects/${p.id}/feedback`, { expectedVersion: ready.business.version, contentRevision: ready.revision, target: 'tagline', replacement: '<script>alert(1)</script>', reason: 'test escaping' });
    await signoffs();
    assert.equal((await post(`/api/projects/${p.id}/verify`, { challengeId: challenge.id, answer: challenge.phrase })).status, 404);
    const exported = await (await fetch(`${base}/api/projects/${p.id}/export`)).text(); assert.match(exported, /test escaping/); assert.match(exported, /售價需要解釋/);
    const health = await (await fetch(`${base}/api/health`)).text(); assert.ok(!health.includes('AI_API_KEY'));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

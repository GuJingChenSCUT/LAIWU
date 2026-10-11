import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createProject, runWorkflow, recordCorrection } from '../server/workflow.mjs';
import { createProvider } from '../server/providers.mjs';
import { seeds } from '../server/data.mjs';
import { ensureBusiness, mutateBusiness, releaseIssues, hasConfirmation, quoteReadiness, recordSessionObservation, businessView } from '../server/business.mjs';

async function fixture() {
  const p = createProject(seeds[1], 'mock');
  await runWorkflow(p, createProvider({ AI_PROVIDER: 'mock' }), { delayMs: 0 });
  ensureBusiness(p); return p;
}
function input(p, role, data = {}) { return { role, requestId: randomUUID(), expectedVersion: p.business.version, contentRevision: p.revision, ...data }; }
function act(p, action, role, data) { return mutateBusiness(p, action, input(p, role, data)); }
function rights(p, sample = false) { act(p, 'rights', 'culture', { state: 'limited', display: true, sample, credit: '演示创作者', evidence: '仅用于测试的虚构来源', expiresAt: '2099-01-01T00:00:00Z' }); }
function signoffs(p) {
  act(p, 'confirm', 'culture', { scope: 'culture', acknowledged: true });
  act(p, 'confirm', 'brand', { scope: 'brand', acknowledged: true });
  act(p, 'confirm', 'host', { scope: 'script', acknowledged: true, openingEn: p.outputs.host.openingEn });
}
function spec(p) { act(p, 'spec', 'brand', { name: '成人帆布袋', dimensions: '35 × 40 cm ± 1 cm', material: '棉帆布 280 g/m²', process: '单面印花', packaging: '纸套', destination: '深圳指定地点', acceptance: '核对尺寸、材料、工艺、包装', quantity: 100 }); }
function quote(p, overrides = {}) { act(p, 'quote', 'supplier', { specRevision: p.business.spec.revision, unitCents: 2800, sampleCents: 12000, plateCents: 6000, packagingCents: 5000, freightCents: 8000, moq: 50, sampleDays: 7, productionDays: 20, tax: 'included', trigger: '书面确认样品后', acceptance: '按品牌冻结规格验收', payment: '另签合同确认', validUntil: '2099-01-01T00:00:00Z', ...overrides }); return p.business.quotes.at(-1); }

test('demo roles cannot sign another scope; stale business/content versions reject writes', async () => {
  const p = await fixture(); rights(p);
  assert.throws(() => act(p, 'confirm', 'brand', { scope: 'culture', acknowledged: true }), e => e.status === 403);
  const stale = input(p, 'brand', { scope: 'brand', acknowledged: true });
  act(p, 'confirm', 'culture', { scope: 'culture', acknowledged: true });
  assert.throws(() => mutateBusiness(p, 'confirm', stale), e => e.code === 'VERSION_CONFLICT');
  assert.equal(hasConfirmation(p, 'brand'), false);
  assert.ok(!('receipts' in businessView(p)));
});
test('scoped approvals gate session; edits invalidate all signoffs and translation', async () => {
  const p = await fixture();
  assert.throws(() => act(p, 'session', 'host'), e => e.code === 'REVIEW_REQUIRED');
  rights(p); signoffs(p); assert.deepEqual(releaseIssues(p), []);
  act(p, 'session', 'host'); const old = p.business.sessions[0];
  recordCorrection(p, { target: 'openingZh', replacement: '新的中文讲述', reason: '补充文化来源' });
  assert.equal(p.business.translation, 'pending'); assert.equal(hasConfirmation(p, 'brand'), false);
  assert.notEqual(old.snapshot.host.openingZh, p.outputs.host.openingZh);
  assert.throws(() => act(p, 'session', 'host'), e => e.code === 'REVIEW_REQUIRED');
});
test('old session accepts feedback during a new draft and preserves old revision, with idempotency', async () => {
  const p = await fixture(); rights(p); signoffs(p); act(p, 'session', 'host');
  const s = p.business.sessions[0];
  recordCorrection(p, { target: 'tagline', replacement: '修改后的标语', reason: '复盘' });
  const observation = { requestId: randomUUID(), sessionId: s.id, note: '更关心材料', decision: 'interested', channel: 'campus', useCase: '日常' };
  recordSessionObservation(p, observation); recordSessionObservation(p, observation);
  assert.equal(p.observations.length, 1); assert.equal(p.observations[0].contentRevision, s.contentRevision); assert.notEqual(s.contentRevision, p.revision);
  assert.throws(() => recordSessionObservation(p, { ...observation, note: '不同内容' }), e => e.code === 'IDEMPOTENCY_CONFLICT');
  act(p, 'closeSession', 'host', { sessionId: s.id });
  assert.throws(() => recordSessionObservation(p, { ...observation, requestId: randomUUID() }), e => e.code === 'WINDOW_CLOSED');
});
test('unknown freight, excluded tax, trigger or expired quote blocks totals; spec change invalidates quote', async () => {
  const p = await fixture(); spec(p);
  for (const missing of [{ freightCents: null }, { tax: 'excluded' }, { trigger: '' }, { validUntil: '2000-01-01T00:00:00Z' }]) {
    const q = quote(p, missing); assert.equal(quoteReadiness(p.business, q).totalCents, null);
  }
  const complete = quote(p);
  assert.equal(quoteReadiness(p.business, complete).totalCents, 311000);
  assert.throws(() => quote(p, { freightCents: -100 }), /整数/);
  spec(p); assert.equal(quoteReadiness(p.business, complete).ready, false);
  p.business.route = 'R2';
  assert.throws(() => quote(p), e => e.code === 'ROUTE_SCOPE');
});
test('display scope never authorizes sample; sample defects require rework and fresh submission', async () => {
  const p = await fixture(); rights(p); spec(p); const q = quote(p);
  assert.throws(() => act(p, 'sample', 'brand', { quoteId: q.id, state: 'pending_acceptance', evidence: '送验演示' }), e => e.code === 'SAMPLE_RIGHTS');
  rights(p, true);
  assert.throws(() => act(p, 'sample', 'brand', { quoteId: q.id, state: 'accepted', checked: true, evidence: '检查' }), e => e.code === 'SAMPLE_SEQUENCE');
  act(p, 'sample', 'brand', { quoteId: q.id, state: 'pending_acceptance', evidence: '送验演示' });
  act(p, 'sample', 'brand', { quoteId: q.id, state: 'rework', evidence: '印花偏移超过公差' });
  assert.equal(p.business.sample.state, 'rework');
  act(p, 'sample', 'brand', { quoteId: q.id, state: 'pending_acceptance', evidence: '重新送验' });
  act(p, 'sample', 'brand', { quoteId: q.id, state: 'accepted', checked: true, evidence: '逐项演练检查符合规格' });
  assert.equal(p.business.sample.history.length, 4);
});
test('withdrawal and expiry prevent new use and redact audience snapshots', async () => {
  const p = await fixture(); rights(p); signoffs(p); act(p, 'session', 'host');
  act(p, 'rights', 'culture', { state: 'withdrawn', credit: '原作者', evidence: '演示撤回', expiresAt: '2099-01-01T00:00:00Z' });
  assert.equal(businessView(p).sessions[0].snapshot, null);
  assert.throws(() => act(p, 'session', 'host'), e => e.code === 'REVIEW_REQUIRED');
  rights(p);
  assert.equal(businessView(p).sessions[0].snapshot, null, 'regrant cannot revive withdrawn session');
  assert.equal(p.business.sessions[0].state, 'closed');
  p.business.rights.expiresAt = '2000-01-01T00:00:00Z';
  assert.equal(businessView(p).rightsValid, false);
});
test('duplicate mutations are idempotent, English edits revoke prior content signoffs', async () => {
  const p = await fixture(); rights(p);
  const body = input(p, 'brand', { scope: 'brand', acknowledged: true });
  mutateBusiness(p, 'confirm', body); const version = p.business.version;
  mutateBusiness(p, 'confirm', body); assert.equal(p.business.version, version);
  assert.throws(() => mutateBusiness(p, 'confirm', { ...body, scope: 'culture' }), e => e.code === 'IDEMPOTENCY_CONFLICT');
  act(p, 'confirm', 'host', { scope: 'script', acknowledged: true, openingEn: 'An edited English story, checked by a human.' });
  assert.equal(hasConfirmation(p, 'brand'), false); assert.equal(hasConfirmation(p, 'script'), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { seeds } from '../server/data.mjs';
import { dossierFields } from '../server/italia-data.mjs';
import { createProject, runWorkflow, recordCorrection, exportProject } from '../server/workflow.mjs';
import { createProvider } from '../server/providers.mjs';
import { ensureBusiness, mutateBusiness, businessView, recordSessionObservation } from '../server/business.mjs';
import { publicationValid } from '../server/italia.mjs';

const provider = createProvider({ AI_PROVIDER: 'mock' });
async function fixture(seed = seeds[0]) { const p = createProject(seed, 'mock'); ensureBusiness(p); await runWorkflow(p, provider, { delayMs: 0 }); return p; }
const act = (p, action, role, values = {}) => mutateBusiness(p, action, { ...values, role, expectedVersion: p.business.version, contentRevision: p.revision, requestId: randomUUID() });
const review = { decision: 'approve', channel: 'local-preview', expiresAt: '2098-01-01T00:00:00Z', note: '仅用于自动测试的演示确认', rightsChecked: true, factsChecked: true, peopleChecked: true, aiChecked: true };
function sign(p) {
  act(p, 'confirm', 'culture', { scope: 'culture', acknowledged: true });
  act(p, 'confirm', 'brand', { scope: 'brand', acknowledged: true });
  act(p, 'confirm', 'host', { scope: 'script', acknowledged: true, openingEn: p.outputs.host.openingEn });
  act(p, 'translationReview', 'culture', { capable: true, acknowledged: true, note: '仅用于测试的原文核对' });
}
async function ready() {
  const p = await fixture();
  act(p, 'dossier', 'brand', Object.fromEntries(Object.keys(dossierFields).map(k => [k, `演示资料 ${k}，不是实际商品证明`])));
  act(p, 'rights', 'culture', { state: 'limited', display: true, sample: false, credit: '测试素材作者', evidence: '测试范围，非真实授权', expiresAt: '2099-01-01T00:00:00Z' });
  sign(p); act(p, 'releaseReview', 'reviewer', review); return p;
}

test('four Italian categories preserve original goods and do not invent production costs', async () => {
  assert.equal(seeds.length, 4);
  for (const seed of seeds) {
    const p = await fixture(seed);
    assert.equal(p.status, 'awaiting_review'); assert.equal(p.business.route, 'IT');
    assert.equal(p.outputs.supply.kind, 'product-facts'); assert.equal(p.outputs.supply.costMin, null); assert.equal(p.outputs.supply.moq, null);
    assert.match(p.outputs.design.title, new RegExp(seed.productType));
    assert.equal(p.business.italia.acquisitionCity, 'Milano'); assert.equal(p.business.italia.dossier.origin, '');
  }
  assert.throws(() => createProject({ ...seeds[0], productId: 'coffee' }, 'mock'), /四类/);
});

test('Italian pilot cannot switch into licensed production, RFQ or sampling', async () => {
  const p = await fixture();
  for (const [action, role] of [['profile', 'brand'], ['spec', 'brand'], ['quote', 'supplier'], ['sample', 'brand']]) assert.throws(() => act(p, action, role, { route: 'R1' }), e => e.code === 'ITALIA_SCOPE');
  assert.throws(() => act(p, 'rights', 'culture', { sample: true }), e => e.code === 'ITALIA_SCOPE');
});

test('publication requires product sources, language review and all scoped human confirmations', async () => {
  const p = await fixture();
  assert.throws(() => act(p, 'releaseReview', 'reviewer', review), e => e.code === 'REVIEW_INCOMPLETE');
  assert.throws(() => act(p, 'translationReview', 'culture', { capable: true, acknowledged: true, note: 'test' }), e => e.code === 'DOSSIER_INCOMPLETE');
  assert.throws(() => act(p, 'session', 'host'), e => e.code === 'REVIEW_REQUIRED');
  const complete = await ready();
  assert.equal(publicationValid(complete), true);
  assert.equal(complete.business.italia.publication.snapshot.dossier.origin, complete.business.italia.dossier.origin);
  assert.equal(complete.business.italia.publication.snapshot.confirmations.length, 3);
  assert.throws(() => act(complete, 'releaseReview', 'host', review), e => e.code === 'DEMO_ROLE');
  assert.throws(() => act(complete, 'releaseReview', 'reviewer', { ...review, aiChecked: false }), e => e.code === 'REVIEW_CHECKS');
  assert.throws(() => act(complete, 'releaseReview', 'reviewer', { ...review, channel: 'public-live' }), e => e.code === 'REVIEW_CHANNEL');
  assert.throws(() => act(complete, 'releaseReview', 'reviewer', { ...review, expiresAt: '2100-01-01T00:00:00Z' }), e => e.code === 'REVIEW_EXPIRY');
  act(complete, 'session', 'host');
  assert.equal(complete.business.sessions[0].snapshot.italia.publication.revision, complete.revision);
});

test('feedback retains dimension, experience and frozen version; edits require a fresh release', async () => {
  const p = await ready(); act(p, 'session', 'host'); const session = p.business.sessions[0];
  const values = { sessionId: session.id, requestId: randomUUID(), dimension: 'sensory', experience: 'visual-only', channel: 'campus', decision: 'interested', note: '尚未品尝，想知道口味信息', useCase: '日常使用' };
  recordSessionObservation(p, values); recordSessionObservation(p, values); assert.equal(p.observations.length, 1);
  assert.throws(() => recordSessionObservation(p, { ...values, dimension: 'price' }), e => e.code === 'IDEMPOTENCY_CONFLICT');
  recordCorrection(p, { target: 'tagline', replacement: '测试新版标题', reason: '来源文字更清楚' });
  const priorApproval = p.business.italia.history.find(x => x.action === 'releaseReview').record;
  assert.notEqual(priorApproval.snapshot.outputs.design.tagline, p.outputs.design.tagline);
  assert.equal(publicationValid(p), false); assert.equal(p.business.italia.translationReview, null);
  assert.throws(() => act(p, 'session', 'host'), e => e.code === 'REVIEW_REQUIRED');
  recordSessionObservation(p, { ...values, requestId: randomUUID(), note: '补记旧版看图期待' });
  assert.equal(p.observations.at(-1).contentRevision, session.contentRevision);
  assert.notEqual(p.observations.at(-1).contentRevision, p.revision);
  assert.equal(businessView(p).italia.report.find(r => r.key === 'sensory').count, 2);
  assert.match(exportProject(p), /visual-only/); assert.doesNotMatch(exportProject(p), /¥null|單件成本/);
});

test('reported issues suspend snapshots and feedback; resolving cannot silently revive old sessions', async () => {
  const p = await ready(); act(p, 'session', 'host'); const first = p.business.sessions[0];
  act(p, 'incident', 'host', { sessionId: first.id, note: '讲述中的规格有待进一步核对' });
  assert.equal(businessView(p).sessions[0].snapshot, null); assert.equal(first.state, 'closed');
  assert.equal(p.status, 'awaiting_review');
  assert.throws(() => recordSessionObservation(p, { sessionId: first.id }), e => e.code === 'WINDOW_CLOSED');
  assert.throws(() => act(p, 'releaseReview', 'reviewer', review), e => e.code === 'REVIEW_INCOMPLETE');
  act(p, 'resolveIncident', 'reviewer', { incidentId: p.business.italia.incidents[0].id, note: '已核对原文并说明更正结果（测试）' });
  assert.equal(publicationValid(p), false); sign(p); act(p, 'releaseReview', 'reviewer', review); act(p, 'session', 'host');
  assert.equal(businessView(p).sessions[0].snapshot, null); assert.ok(businessView(p).sessions[1].snapshot);
});

test('return, expired release and unsupported claims block display without treating AI as approval', async () => {
  const p = await ready(); act(p, 'session', 'host');
  act(p, 'releaseReview', 'reviewer', { decision: 'return', note: '请补充具体规格的原始资料' });
  assert.equal(publicationValid(p), false); assert.equal(businessView(p).sessions[0].snapshot, null);
  const q = await ready(); act(q, 'session', 'host');
  q.business.italia.publication.expiresAt = '2000-01-01T00:00:00Z';
  q.business.sessions[0].snapshot.italia.publication.expiresAt = '2000-01-01T00:00:00Z';
  assert.equal(businessView(q).italia.canPresent, false); assert.equal(businessView(q).sessions[0].snapshot, null);
  const r = await ready();
  act(r, 'dossier', 'brand', { ...r.business.italia.dossier, chineseStory: '绝对安全，零过敏' });
  assert.ok(businessView(r).italia.issues.some(x => x.includes('规则提示')));
});

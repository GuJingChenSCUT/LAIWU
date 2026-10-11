import { randomUUID } from 'node:crypto';
import { AppError } from './contracts.mjs';
import { isItalia, italianProducts, dossierFields, feedbackDimensions } from './italia-data.mjs';

const now = () => new Date().toISOString();
const fail = (code, message) => { throw new AppError(code, message, 422); };
const required = (value, label, max = 1500) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail('PILOT_FIELD', `请填写 ${label}（最多 ${max} 字）`);
  return value.trim();
};
export function ensureItalia(p) {
  if (!isItalia(p)) return null;
  const b = p.business;
  if (!b.italia) {
    const product = italianProducts.find(x => x.id === p.brief.productId);
    b.route = 'IT';
    b.italia = { acquisitionCity: 'Milano', testCity: '深圳', dossier: Object.fromEntries(Object.keys(dossierFields).map(k => [k, k === 'italianOriginal' ? product.original : ''])), translationReview: null, publication: null, history: [], incidents: [] };
  }
  return b.italia;
}
export function invalidateItalia(p) {
  const i = ensureItalia(p);
  if (i) { i.translationReview = null; i.publication = null; }
}
export function dossierIssues(p) {
  const i = ensureItalia(p);
  if (!i) return [];
  const issues = Object.entries(dossierFields).filter(([key]) => !i.dossier[key]?.trim() || /^(待确认|待核对|未知|unknown|tbd)$/i.test(i.dossier[key].trim())).map(([key, [label]]) => ({ field: key, message: `补充 ${label}` }));
  const claims = [i.dossier.chineseStory, i.dossier.englishSummary, p.outputs.host?.openingZh, p.outputs.host?.openingEn, p.outputs.design?.tagline].join(' ');
  if (/官方非遗|官方非遺|治愈|治癒|治疗|療效|绝对安全|絕對安全|零过敏|cures?\b|allergy.free/i.test(claims)) issues.push({ field: 'chineseStory', message: '展示文字含需核查的认证、功效或绝对安全表述，请先修改；此为规则提示，并非事实鉴定。' });
  return issues;
}
export function pilotPreflight(p) {
  const i = ensureItalia(p);
  if (!i) return [];
  const issues = dossierIssues(p).map(x => x.message);
  if (!i.translationReview || i.translationReview.revision !== p.revision) issues.push('核对意大利语原文、英文说明与中文展示');
  if (i.incidents.some(x => x.state === 'open')) issues.push('处理尚未解决的展示问题');
  return issues;
}
export function publicationValid(p) {
  const i = ensureItalia(p);
  return !!i?.publication && i.publication.revision === p.revision && i.publication.decision === 'approve' && Date.parse(i.publication.expiresAt) > Date.now() && !pilotPreflight(p).length;
}
export function pilotReleaseIssues(p) {
  if (!isItalia(p)) return [];
  const issues = pilotPreflight(p);
  if (!publicationValid(p)) issues.push('完成当前版本、用途、渠道与有效期的展示确认');
  return issues;
}
export function mutateItalia(p, action, input, invalidate) {
  const i = ensureItalia(p);
  if (!i) fail('PILOT_ONLY', '此动作仅用于 Italia 原产商品试点');
  const at = now();
  let message;
  if (action === 'dossier') {
    const dossier = {};
    for (const [key, [label, max]] of Object.entries(dossierFields)) {
      const value = input[key] ?? '';
      if (typeof value !== 'string' || value.length > max) fail('PILOT_FIELD', `${label}文字过长或格式不符`);
      dossier[key] = value.trim();
    }
    i.dossier = dossier; p.revision++; invalidate(p, '商品资料更新，请核对新版本');
    message = '保存商品档案；未填写的事实继续保留为待核对';
  } else if (action === 'translationReview') {
    if (input.capable !== true || input.acknowledged !== true) fail('TRANSLATION_REVIEW', '请确认可核对意大利语原文，并已核对三种语言的关键表述');
    if (dossierIssues(p).length) fail('DOSSIER_INCOMPLETE', '请先补齐商品档案，并处理展示文字提示');
    i.translationReview = { revision: p.revision, at, role: input.role, note: required(input.note, '译审依据') };
    message = '原文、英文与中文展示已由人工核对';
  } else if (action === 'releaseReview') {
    if (!['approve', 'return'].includes(input.decision)) fail('REVIEW_DECISION', '请选择确认展示或退回修改');
    const note = required(input.note, '确认依据或退回原因');
    if (input.decision === 'approve') {
      const b = p.business;
      const issues = pilotPreflight(p);
      if (!(b.rights.state === 'limited' && b.rights.display && Date.parse(b.rights.expiresAt) > Date.now())) issues.push('登记有效的素材展示范围');
      for (const scope of ['brand', 'culture', 'script']) if (!b.confirmations.some(c => c.scope === scope && c.contentRevision === p.revision && !c.invalidatedAt)) issues.push(`完成 ${scope} 内容确认`);
      if (b.translation !== 'reviewed') issues.push('核对主播双语稿');
      if (issues.length) fail('REVIEW_INCOMPLETE', issues.join('；'));
      if (!['rightsChecked', 'factsChecked', 'peopleChecked', 'aiChecked'].every(k => input[k] === true)) fail('REVIEW_CHECKS', '请逐项核对素材、商品事实、参与者表述和 AI 标识');
      if (!['local-preview', 'shenzhen-interview'].includes(input.channel)) fail('REVIEW_CHANNEL', '请选择本地预览或深圳现场访谈记录');
      if (!Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= Date.now() || Date.parse(input.expiresAt) > Date.parse(b.rights.expiresAt)) fail('REVIEW_EXPIRY', '展示有效期须在未来，且不得晚于素材使用范围有效期');
    }
    i.publication = { id: randomUUID(), revision: p.revision, decision: input.decision, purpose: '中国市场展示与反馈测试', channel: input.decision === 'approve' ? input.channel : null, expiresAt: input.decision === 'approve' ? input.expiresAt : null, note, role: input.role, at };
    if (input.decision === 'approve') i.publication.snapshot = {
      productId: p.brief.productId, dossier: structuredClone(i.dossier), outputs: structuredClone(p.outputs),
      rights: structuredClone(p.business.rights), translationReview: structuredClone(i.translationReview),
      confirmations: structuredClone(p.business.confirmations.filter(c => c.contentRevision === p.revision && !c.invalidatedAt)),
      testPrice: p.brief.targetRetailPrice, aiDisclosure: p.mode === 'mock' ? '本地示例模板，未调用大模型' : '模型辅助整理，人工核对后展示'
    };
    if (input.decision === 'return') {
      for (const s of p.business.sessions.filter(s => s.contentRevision === p.revision)) { s.scopeWithdrawn = true; s.state = 'closed'; s.closedAt = at; }
      p.status = 'awaiting_review'; p.approval = null;
    }
    message = input.decision === 'approve' ? '此版本已确认，可开始指定范围内的展示测试' : '退回修改，原因已记录；当前版本的旧场次已关闭';
  } else if (action === 'incident') {
    const session = p.business.sessions.find(s => s.id === input.sessionId);
    if (!session) fail('SESSION_REQUIRED', '请选择出现问题的场次');
    const note = required(input.note, '问题内容与现场情况');
    i.incidents.push({ id: randomUUID(), sessionId: session.id, revision: session.contentRevision, state: 'open', note, at, role: input.role });
    for (const s of p.business.sessions) { s.scopeWithdrawn = true; s.state = 'closed'; s.closedAt = at; }
    p.revision++; invalidate(p, '展示问题待处理，需重新确认');
    message = '问题已记录，展示与反馈暂停；更正后需要重新确认并建立新场次';
  } else if (action === 'resolveIncident') {
    const issue = i.incidents.find(x => x.id === input.incidentId && x.state === 'open');
    if (!issue) fail('INCIDENT_NOT_FOUND', '问题不存在或已处理');
    issue.resolution = required(input.note, '更正内容与依据'); issue.state = 'resolved'; issue.resolvedAt = at;
    message = '处理结果已保存；请完成新版确认，旧场次不会自动恢复';
  }
  i.history.push({ id: randomUUID(), action, role: input.role, revision: p.revision, at, message, ...(action === 'releaseReview' ? { record: structuredClone(i.publication) } : action === 'translationReview' ? { record: structuredClone(i.translationReview) } : {}) });
  return message;
}
export function pilotTasks(p) {
  const i = ensureItalia(p);
  return [
    { id: 'dossier', owner: 'brand', name: '补齐商品档案 / Complete product facts', output: '意大利原文 · 来源 · 制造地', done: !dossierIssues(p).length, next: '文化与译审', tab: 'overview' },
    { id: 'translation', owner: 'culture', name: '核对原文与展示范围', output: '原文 / English / 中文', done: !!i.translationReview && i.translationReview.revision === p.revision, next: '品牌与主播', tab: 'rights' },
    { id: 'script', owner: 'host', name: '准备真人双语讲述', output: '当前版本讲稿', done: p.business.confirmations.some(c => c.scope === 'script' && c.contentRevision === p.revision && !c.invalidatedAt), next: '展示确认', tab: 'script' },
    { id: 'review', owner: 'reviewer', name: '确认这一版如何展示', output: '版本 · 用途 · 渠道 · 期限', done: publicationValid(p), next: '深圳体验', tab: 'review' },
    { id: 'feedback', owner: 'audience', name: '留下具体感受', output: '包装 / 故事 / 体验 / 价格', done: p.observations.length > 0, next: '品牌复盘', tab: 'audience' }
  ];
}
export function pilotReport(p) {
  return Object.entries(feedbackDimensions).map(([key, label]) => ({ key, label, count: p.observations.filter(o => o.dimension === key).length, notes: p.observations.filter(o => o.dimension === key).map(o => ({ sessionId: o.sessionId, revision: o.contentRevision, note: o.note, experience: o.experience, at: o.at })) }));
}

import { randomUUID } from 'node:crypto';
import { AppError } from './contracts.mjs';
import { isItalia, italianProducts, feedbackDimensions } from './italia-data.mjs';
import { ensureItalia, invalidateItalia, pilotReleaseIssues, pilotPreflight, publicationValid, mutateItalia, pilotTasks, pilotReport } from './italia.mjs';

export const businessRoutes = [
  { id: 'IT', name: '意大利原产商品展示测试', en: 'Italian original-product market test', phase: 'Italia 首轮', description: '米兰作为品牌接洽地，深圳作为测试地；商品实际制造地单独核对。', fields: ['商品档案', '原文与译审', '展示确认', '四维反馈'], todo: '仅做原商品的展示与反馈测试；暂停纺织配饰共创，不开展中国授权生产或进口办理。' },
  { id: 'R0', name: '文化概念测款', en: 'Concept test', phase: '本轮主线', description: '先验证故事与概念是否被理解，再决定是否打样。', fields: ['文化来源', '展示范围', '观众反馈'], todo: '明确谁提供素材、谁确认讲述、谁决定下一轮。' },
  { id: 'R1', name: '国内共创', en: 'Co-create in China', phase: '询价演练', description: '海外文化与设计参与，中国供应链打样；品牌来源与生产地分别记录。', fields: ['生产地', '销售主体', '规格与样品'], todo: '先冻结尺寸、材料、工艺与验收标准，再询价；采购需另签合同。' },
  { id: 'R2', name: '一般贸易进口', en: 'General import', phase: '资料清单', description: '海外成品进入中国，先确定商品类别与进口责任方。', fields: ['原产地', '发货地', '进口主体'], todo: '由专业人员核对商品归类、标签、检验要求与落地费用，当前仅整理需求。' },
  { id: 'R3', name: '跨境零售进口', en: 'Retail import', phase: '资料清单', description: '面向符合条件的个人消费者，不能当作餐厅批量进货通道。', fields: ['零售渠道', '消费者场景', '商品清单核查'], todo: '个人自用商品不得再次销售；模式与商品范围交由进口服务商核查。' },
  { id: 'R4', name: '来华开店', en: 'Set up a store', phase: '服务线索', description: '把开店诉求转为主体、场地、经营许可与人员事项。', fields: ['城市与场地', '经营项目', '人员安排'], todo: '公司设立、食品经营许可及人员工作资格分别办理，不能用概念确认替代。' },
  { id: 'R5', name: '中国供应链出海', en: 'Export from China', phase: '独立业务', description: '将中国面料、原料等销往海外，另立出口项目与合同。', fields: ['目的国', '海外买方', '贸易术语与地点'], todo: '明确出口主体、目的国要求、付款与交付边界；不与来华项目混用订单。' }
];

export const knowledgeCards = [
  { id: 'rights', title: '文化有来源，使用有范围', body: '文化讲述确认与素材授权分别记录。展示、改编、AI 处理、打样及量产是不同用途；支持撤回并保留交接记录。', action: '先完成「文化与权利」卡片，再交给品牌与主播。', source: 'UNESCO · 非遗保护伦理原则', url: 'https://ich.unesco.org/en/ethics-and-ich-00866', routes: ['R0', 'R1'] },
  { id: 'quote', title: '询价先统一口径', body: '同一规格、数量、币种、含税口径和交付地点才能比较。未知费用留空待确认，不按零元处理；报价不等于采购承诺。', action: '补齐运费、包装、有效期与交期起算条件。', source: '来物 · 业务流程 v1.1（产品规则）', routes: ['R0', 'R1', 'R2', 'R5'] },
  { id: 'incoterms', title: '贸易术语不替代合同', body: '记录 Incoterms® 版本、术语和指定地点。付款、所有权转移、质量与争议条款仍须另行约定。', action: '跨境询价交给服务商确认责任边界，不自动推算税率。', source: 'ICC Academy · Incoterms® 2020', url: 'https://academy.iccwbo.org/incoterms/article/incoterms-2020-new-rules-old-problems/', routes: ['R2', 'R5'] },
  { id: 'retail', title: '零售进口不是批发进货', body: '跨境电商零售进口按个人自用管理，消费者购买后不得再次销售。餐厅经营采购需另核适用进口路径。', action: '先选择 R2 或专业进口服务咨询，再整理餐饮原料需求。', source: '商务部等六部门 · 商财发〔2018〕486号', url: 'https://www.mofcom.gov.cn/zfxxgk/gkml/art/2018/art_1e2248ade45e4652a12c25d6a45e4f28.html', routes: ['R3', 'R4'] },
  { id: 'food', title: '开店事项逐项交接', body: '食品经营许可与备案取决于具体经营项目。把主体、场地、品类和申报状态交给属地办理人员核对。', action: '用待补资料、已提交、需补正等状态管理，不生成“已获许可”。', source: '市场监管总局 · 食品经营许可和备案管理办法', url: 'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2023/art_91a91c26ae464a2f898952d5b84f62c6.html', routes: ['R4'] },
  { id: 'live', title: '真人表达，责任清晰', body: '身份核验、信息公示和营销内容管理各有责任。AI 生成合成内容按适用规则标识；本地文字挑战不能证明真人身份。', action: '主持人核对讲稿与 AI 素材标识，准备独立的本机停止按钮。', source: '市场监管总局 · 直播电商监督管理办法', url: 'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2026/art_ce66ea61fcec4583b5dbd677f470088b.html', routes: ['R0', 'R1', 'R3'] }
];
export const demoRoles = [
  { id: 'brand', name: '品牌方', en: 'Brand', org: '海外品牌 · 演示身份', job: '确认方案，决定下一轮' },
  { id: 'culture', name: '文化创作者', en: 'Creator', org: '素材提供方 · 演示身份', job: '核对来源与使用范围' },
  { id: 'supplier', name: '供应商', en: 'Supplier', org: '共创工坊 · 演示身份', job: '核对规格，提交询价回复' },
  { id: 'host', name: '真人主播', en: 'Host', org: '来物演示舞台 · 演示身份', job: '确认双语讲稿，主持试讲' },
  { id: 'audience', name: '体验观众', en: 'Audience', org: '本机观众预览', job: '了解故事，表达看法' },
  { id: 'reviewer', name: '展示确认', en: 'Review', org: '展示确认 · 演示视角', job: '核对版本与用途，处理展示问题' }
];
const now = () => new Date().toISOString();
function fail(code, message, status = 422) { throw new AppError(code, message, status); }
function text(value, label, max = 500, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail('FIELD_REQUIRED', `请填写${label}（最多 ${max} 字）`);
  return value.trim();
}
function integer(value, label, max = 100000000, optional = false) {
  if (optional && (value === null || value === undefined || value === '')) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > max) fail('INVALID_NUMBER', `${label}须为有效非负整数`);
  return value;
}
export function ensureBusiness(p) {
  if (!p.business) p.business = {
    version: 1, route: 'R0', profile: { brandOrigin: p.brief.country, productionPlace: '待确认', shippingPlace: '待确认', seller: '待确认', importer: '待确认', objective: '通过文化故事与真人试讲，验证概念吸引力', assets: '个人故事与概念插画', routeDetails: '', confirmer: p.brief.owner },
    rights: { state: 'pending', display: false, sample: false, credit: '', evidence: '', expiresAt: null, scope: '本地演示；非真实授权' },
    confirmations: [], translation: 'pending', spec: null, quotes: [], sample: null, sessions: [], decisions: [], audit: [], receipts: []
  };
  ensureItalia(p);
  return p.business;
}
export function invalidateBusiness(p, reason) {
  const b = ensureBusiness(p);
  b.confirmations.forEach(c => { if (!c.invalidatedAt) { c.invalidatedAt = now(); c.reason = reason; } });
  b.translation = 'pending';
  invalidateItalia(p);
  p.status = 'awaiting_review'; p.approval = null;
}
export function rightsValid(b, purpose = 'display') {
  return b.rights.state === 'limited' && b.rights[purpose] === true && Date.parse(b.rights.expiresAt) > Date.now();
}
export function hasConfirmation(p, scope) {
  return ensureBusiness(p).confirmations.some(c => c.scope === scope && c.contentRevision === p.revision && !c.invalidatedAt);
}
export function releaseIssues(p) {
  const b = ensureBusiness(p);
  const issues = [];
  if (!rightsValid(b)) issues.push('文化方确认本地展示范围及有效期');
  if (!hasConfirmation(p, 'culture')) issues.push('文化方确认故事表述');
  if (!hasConfirmation(p, 'brand')) issues.push('品牌方确认此版展示内容');
  if (!hasConfirmation(p, 'script') || b.translation !== 'reviewed') issues.push('主播核对中文与英文讲稿');
  if (!['awaiting_review', 'demo_ready'].includes(p.status)) issues.push('等待共创生成完成');
  issues.push(...pilotReleaseIssues(p));
  return issues;
}
export function quoteReadiness(b, quote) {
  const missing = [];
  if (!['R0', 'R1'].includes(b.route)) missing.push('此业务路径未开放询价演练');
  if (!b.spec || quote.specRevision !== b.spec.revision) missing.push('规格已变更');
  if (quote.declined) return { ready: false, missing: ['供应商无法承接'], totalCents: null };
  for (const [key, name] of Object.entries({ unitCents: '单价', sampleCents: '打样费', plateCents: '版费', packagingCents: '包装费', freightCents: '运费', sampleDays: '打样天数', productionDays: '量产天数' })) if (quote[key] === null) missing.push(name);
  if (quote.tax !== 'included') missing.push('含税总额待统一');
  if (!quote.trigger) missing.push('交期起算条件');
  if (!quote.acceptance) missing.push('验收标准');
  if (!quote.payment) missing.push('付款约定');
  if (!quote.validUntil || Date.parse(quote.validUntil) <= Date.now()) missing.push('有效期缺失或已过期');
  if (quote.moq > (b.spec?.quantity || 0)) missing.push('数量未达起订量');
  return { ready: missing.length === 0, missing, totalCents: missing.length ? null : quote.unitCents * b.spec.quantity + quote.sampleCents + quote.plateCents + quote.packagingCents + quote.freightCents };
}
export function businessTasks(p) {
  const b = ensureBusiness(p);
  if (isItalia(p)) return pilotTasks(p);
  return [
    { id: 'brief', owner: 'brand', name: '补齐项目边界', output: '来源 / 生产地 / 卖方责任', done: !Object.entries(b.profile).some(([key, value]) => key !== 'confirmer' && value === '待确认'), next: '文化创作者', tab: 'overview' },
    { id: 'rights', owner: 'culture', name: '确认文化与素材范围', output: '本地展示记录 + 署名', done: rightsValid(b) && hasConfirmation(p, 'culture'), next: '品牌方与主播', tab: 'rights' },
    { id: 'concept', owner: 'brand', name: '签收当前概念', output: `内容 v${p.revision} 展示确认`, done: hasConfirmation(p, 'brand'), next: '供应商 / 主播', tab: 'overview' },
    { id: 'rfq', owner: 'supplier', name: '回复同一规格询价', output: '报价草稿或无法承接原因', done: b.quotes.some(q => quoteReadiness(b, q).ready), next: '品牌方', tab: 'sourcing' },
    { id: 'script', owner: 'host', name: '核对双语讲稿', output: '中文 / English 同版确认', done: hasConfirmation(p, 'script'), next: '试讲场次', tab: 'script' },
    { id: 'session', owner: 'host', name: '建立本机试讲场次', output: '冻结内容快照 + 场次编号', done: b.sessions.length > 0, next: '体验观众', tab: 'script' },
    { id: 'feedback', owner: 'audience', name: '留下体验反馈', output: '场次 + 内容版本 + 原话', done: p.observations.some(o => o.sessionId), next: '品牌复盘', tab: 'audience' },
    { id: 'decision', owner: 'brand', name: '决定下一轮', output: '继续 / 修改 / 暂停及原因', done: b.decisions.some(d => d.contentRevision === p.revision), next: '下一轮任务', tab: 'delivery' }
  ];
}

// These are demo workflow roles, not authenticated identities. The whole app is localhost-only.
const permissions = { profile: ['brand'], rights: ['culture'], confirm: ['culture', 'brand', 'host'], spec: ['brand'], quote: ['supplier'], sample: ['brand'], session: ['host'], closeSession: ['host'], decision: ['brand'], dossier: ['brand'], translationReview: ['culture'], releaseReview: ['reviewer'], incident: ['host', 'reviewer'], resolveIncident: ['reviewer'] };
export function mutateBusiness(p, action, input) {
  const b = ensureBusiness(p);
  if (!Object.hasOwn(permissions, action)) fail('NOT_FOUND', '未知业务动作', 404);
  if (!permissions[action].includes(input.role)) fail('DEMO_ROLE', '此演示动作需切换至相应角色', 403);
  const key = text(input.requestId, '请求编号', 80);
  const signature = JSON.stringify({ action, ...input });
  const prior = b.receipts.find(r => r.key === key);
  if (prior) { if (prior.signature !== signature) fail('IDEMPOTENCY_CONFLICT', '同一请求编号不能提交不同内容', 409); return p; }
  if (input.expectedVersion !== b.version || input.contentRevision !== p.revision) fail('VERSION_CONFLICT', '页面版本已变化，请刷新后重新确认', 409);
  if (!['awaiting_review', 'demo_ready'].includes(p.status)) fail('NOT_READY', '请先完成共创生成', 409);
  if (b.receipts.length >= 500) fail('LIMIT', '此演示项目已达到操作上限', 409);
  let message;
  if (isItalia(p) && ['profile', 'spec', 'quote', 'sample'].includes(action)) fail('ITALIA_SCOPE', '本轮只做原产商品展示与反馈测试，生产询价与打样已暂停');
  if (['dossier', 'translationReview', 'releaseReview', 'incident', 'resolveIncident'].includes(action)) message = mutateItalia(p, action, input, invalidateBusiness);
  if (action === 'profile') {
    if (!businessRoutes.some(r => r.id === input.route)) fail('INVALID_ROUTE', '请选择业务路径');
    const profile = {};
    for (const field of ['brandOrigin', 'productionPlace', 'shippingPlace', 'seller', 'importer', 'objective', 'assets', 'confirmer', 'routeDetails']) profile[field] = text(input[field], field, 500, true) || '待确认';
    b.route = input.route; b.profile = profile;
    p.revision++; invalidateBusiness(p, '业务边界更新');
    message = '品牌更新项目边界；展示确认需重新签收';
  }
  if (action === 'rights') {
    if (isItalia(p) && input.sample === true) fail('ITALIA_SCOPE', '本轮不开放打样或生产用途');
    if (!['limited', 'withdrawn'].includes(input.state)) fail('INVALID_RIGHTS', '请选择演示展示范围或撤回');
    const rights = { state: input.state, display: input.display === true, sample: input.sample === true, credit: text(input.credit, '署名', 120), evidence: text(input.evidence, '来源与依据'), expiresAt: text(input.expiresAt, '有效期', 40), scope: '本地演示；非真实授权' };
    if (!Number.isFinite(Date.parse(rights.expiresAt)) || (rights.state === 'limited' && Date.parse(rights.expiresAt) <= Date.now())) fail('EXPIRY', '有效期应晚于现在');
    if (rights.state === 'withdrawn') { rights.display = false; rights.sample = false; }
    b.rights = rights; p.revision++; invalidateBusiness(p, '素材使用范围更新');
    if (rights.state === 'withdrawn') for (const session of b.sessions) { session.scopeWithdrawn = true; session.state = 'closed'; session.closedAt = now(); }
    message = rights.state === 'withdrawn' ? '文化方撤回；已关闭素材预览与新场次入口' : '文化方登记本地展示范围；量产用途未开放';
  }
  if (action === 'confirm') {
    const scopeRoles = { culture: 'culture', brand: 'brand', script: 'host' };
    if (!Object.hasOwn(scopeRoles, input.scope) || scopeRoles[input.scope] !== input.role) fail('SCOPE_ROLE', '该角色不能代替其他角色签收', 403);
    if (!rightsValid(b)) fail('RIGHTS_REQUIRED', '先请文化方登记有效展示范围');
    if (input.acknowledged !== true) fail('ACK_REQUIRED', '请阅读并勾选当前确认范围');
    if (input.scope === 'script') {
      const openingEn = text(input.openingEn, '核对后的英文讲稿', 1800);
      // An English edit changes the content too; other signoffs must not silently carry over.
      if (openingEn !== p.outputs.host.openingEn) { p.outputs.host.openingEn = openingEn; p.revision++; invalidateBusiness(p, '英文讲稿更新'); }
      b.translation = 'reviewed';
    }
    if (!hasConfirmation(p, input.scope)) b.confirmations.push({ id: randomUUID(), scope: input.scope, actor: demoRoles.find(r => r.id === input.role).org, contentRevision: p.revision, at: now(), purpose: 'local-demo-only' });
    message = `${demoRoles.find(r => r.id === input.role).name}签收 v${p.revision} 的${input.scope === 'culture' ? '文化表述' : input.scope === 'brand' ? '展示概念' : '双语讲稿'}`;
  }
  if (action === 'spec') {
    if (!['R0', 'R1'].includes(b.route)) fail('ROUTE_SCOPE', '当前路径仅整理需求；询价演练支持 R0 / R1');
    const spec = { revision: (b.spec?.revision || 0) + 1, name: text(input.name, '品类', 80), dimensions: text(input.dimensions, '尺寸与公差'), material: text(input.material, '材料'), process: text(input.process, '工艺与色彩'), packaging: text(input.packaging, '包装要求'), destination: text(input.destination, '交付地点'), acceptance: text(input.acceptance, '验收要求'), quantity: integer(input.quantity, '数量', 100000), at: now() };
    if (spec.quantity < 1) fail('QUANTITY', '数量至少 1 件');
    b.spec = spec; b.sample = null;
    message = `品牌冻结询价规格 s${spec.revision}；旧报价不再参与比较`;
  }
  if (action === 'quote') {
    if (!['R0', 'R1'].includes(b.route)) fail('ROUTE_SCOPE', '此业务路径未开放询价演练');
    if (!b.spec || input.specRevision !== b.spec.revision) fail('SPEC_CHANGED', '请先获取品牌冻结的当前规格', 409);
    const q = { id: randomUUID(), supplier: '演示共创工坊', specRevision: b.spec.revision, currency: 'CNY', at: now(), declined: input.declined === true };
    if (q.declined) q.reason = text(input.reason, '无法承接原因');
    else {
      for (const field of ['unitCents', 'sampleCents', 'plateCents', 'packagingCents', 'freightCents']) q[field] = integer(input[field], field, 100000000, true);
      for (const field of ['sampleDays', 'productionDays']) q[field] = integer(input[field], field, 365, true);
      q.moq = integer(input.moq, '起订量', 100000); if (q.moq < 1) fail('MOQ', '起订量至少 1 件');
      if (!['included', 'excluded', 'unknown'].includes(input.tax)) fail('TAX', '请选择含税口径');
      q.tax = input.tax;
      for (const field of ['trigger', 'acceptance', 'payment']) q[field] = text(input[field], field, 500, true);
      q.validUntil = text(input.validUntil, '有效期', 40, true);
      if (q.validUntil && !Number.isFinite(Date.parse(q.validUntil))) fail('EXPIRY', '有效期格式错误');
    }
    b.quotes.push(q); message = q.declined ? '供应商记录无法承接原因' : '供应商提交示例询价回复；未形成订单';
  }
  if (action === 'sample') {
    if (!rightsValid(b, 'sample')) fail('SAMPLE_RIGHTS', '仅展示范围不能用于打样；请文化方明确打样演练范围');
    const q = b.quotes.find(q => q.id === input.quoteId);
    if (!q || !quoteReadiness(b, q).ready) fail('QUOTE_INCOMPLETE', '先补齐一份当前规格、未过期的同口径报价');
    if (!['pending_acceptance', 'rework', 'accepted'].includes(input.state)) fail('SAMPLE_STATE', '未知样品状态');
    if (input.state !== 'pending_acceptance' && (!b.sample || b.sample.quoteId !== q.id || b.sample.state !== 'pending_acceptance')) fail('SAMPLE_SEQUENCE', '请先登记送验样品', 409);
    if (input.state === 'accepted' && input.checked !== true) fail('ACCEPTANCE', '请逐项核对冻结规格后确认');
    b.sample = { id: b.sample?.id || randomUUID(), quoteId: q.id, specRevision: b.spec.revision, state: input.state, evidence: text(input.evidence, '送验或验收记录'), at: now(), source: 'manual-demo-only', history: [...(b.sample?.history || []), { state: input.state, evidence: input.evidence.trim(), at: now() }] };
    message = `品牌登记样品${{ pending_acceptance: '待验收', rework: '需返工', accepted: '演练验收通过' }[input.state]}；未产生采购或付款`;
  }
  if (action === 'session') {
    const issues = releaseIssues(p); if (issues.length) fail('REVIEW_REQUIRED', issues.join('；'), 409);
    if (!['R0', 'R1', 'IT'].includes(b.route)) fail('ROUTE_SCOPE', '当前路径尚未开放试讲，请先完成专业业务核查');
    if (b.sessions.some(s => s.state === 'open' && s.contentRevision === p.revision)) fail('SESSION_OPEN', '此版本已有反馈窗口开放的场次', 409);
    const session = { id: randomUUID(), number: b.sessions.length + 1, contentRevision: p.revision, state: 'open', createdAt: now(), feedbackUntil: new Date(Date.now() + 86400000).toISOString(), snapshot: { title: p.outputs.design.title, tagline: p.outputs.design.tagline, concept: p.outputs.design.concept, story: p.brief.story, country: p.brief.country, productType: p.brief.productType, palette: p.outputs.design.palette, materials: p.outputs.design.materials, host: structuredClone(p.outputs.host), profile: structuredClone(b.profile), credit: b.rights.credit, targetRetailPrice: p.brief.targetRetailPrice ?? p.brief.budget } };
    if (isItalia(p)) {
      session.snapshot.italia = { dossier: structuredClone(b.italia.dossier), publication: structuredClone(b.italia.publication), productId: p.brief.productId, photo: italianProducts.find(x => x.id === p.brief.productId).photo };
      session.snapshot.story = b.italia.dossier.chineseStory;
      session.feedbackUntil = new Date(Math.min(Date.parse(session.feedbackUntil), Date.parse(b.italia.publication.expiresAt), Date.parse(b.rights.expiresAt))).toISOString();
    }
    b.sessions.push(session); p.status = 'demo_ready'; p.approval = { owner: '品牌 / 文化 / 主播演示角色', revision: p.revision, at: now(), scope: 'local-demo-only' };
    message = `主播建立场次 ${session.number}，冻结内容 v${p.revision}；反馈窗口 24 小时`;
  }
  if (action === 'closeSession') {
    const session = b.sessions.find(s => s.id === input.sessionId); if (!session) fail('SESSION_NOT_FOUND', '找不到此场次', 404);
    session.state = 'closed'; session.closedAt = now(); message = `主播关闭场次 ${session.number} 的反馈窗口`;
  }
  if (action === 'decision') {
    if (!['continue', 'revise', 'stop'].includes(input.decision)) fail('DECISION', '请选择下一轮决定');
    if (!b.sessions.some(s => s.id === input.sessionId)) fail('SESSION_NOT_FOUND', '请选择复盘场次');
    b.decisions.push({ id: randomUUID(), decision: input.decision, reason: text(input.reason, '判断依据'), sessionId: input.sessionId, contentRevision: p.revision, owner: '品牌方演示角色', at: now() });
    message = `品牌记录下一轮决定：${{ continue: '继续验证', revise: '修改概念', stop: '暂停' }[input.decision]}`;
  }
  b.version++; p.updatedAt = now(); b.audit.push({ id: randomUUID(), role: input.role, action, message, contentRevision: p.revision, version: b.version, at: now() });
  b.receipts.push({ key, signature });
  return p;
}

export function recordSessionObservation(p, input) {
  const b = ensureBusiness(p);
  const session = b.sessions.find(s => s.id === input.sessionId);
  if (!session) fail('SESSION_NOT_FOUND', '请选择已建立的试讲场次', 404);
  if (session.state !== 'open' || Date.parse(session.feedbackUntil) <= Date.now()) fail('WINDOW_CLOSED', '此场次反馈窗口已关闭', 409);
  if (!rightsValid(b)) fail('RIGHTS_REQUIRED', '素材范围已撤回或到期，暂不接受新的体验反馈', 409);
  if (isItalia(p) && (!session.snapshot.italia?.publication || Date.parse(session.snapshot.italia.publication.expiresAt) <= Date.now() || session.scopeWithdrawn || b.italia.incidents.some(x => x.state === 'open'))) fail('PUBLICATION_CLOSED', '此版本展示已暂停或到期');
  const key = text(input.requestId, '反馈编号', 80);
  const note = text(input.note, '反馈内容', 500);
  if (!['interested', 'price_high', 'unclear'].includes(input.decision) || !['campus', 'live'].includes(input.channel)) fail('INVALID_INPUT', '未知反馈类型');
  const useCase = text(input.useCase, '使用场景', 80, true);
  const dimension = isItalia(p) ? input.dimension : undefined;
  const experience = isItalia(p) ? input.experience : undefined;
  if (isItalia(p) && (!Object.hasOwn(feedbackDimensions, dimension) || !['visual-only', 'sample-experienced'].includes(experience))) fail('FEEDBACK_DIMENSION', '请选择反馈维度，以及是否实际体验过商品');
  const previous = p.observations.find(o => o.requestId === key);
  if (previous) {
    if (previous.sessionId !== session.id || previous.note !== note || previous.decision !== input.decision || previous.channel !== input.channel || previous.useCase !== useCase || previous.dimension !== dimension || previous.experience !== experience) fail('IDEMPOTENCY_CONFLICT', '反馈编号已用于其他内容', 409);
    return p;
  }
  if (p.observations.length >= 200) fail('LIMIT', '此项目最多保留 200 条体验反馈', 409);
  p.observations.push({ id: randomUUID(), requestId: key, sessionId: session.id, revision: session.contentRevision, contentRevision: session.contentRevision, channel: input.channel, decision: input.decision, note, useCase, ...(isItalia(p) ? { dimension, experience } : {}), source: 'local-audience-demo', at: now() });
  p.updatedAt = now(); return p;
}

export function businessView(p) {
  const b = ensureBusiness(p);
  const { receipts, ...visible } = b;
  const allowed = rightsValid(b) && (!isItalia(p) || !b.italia.incidents.some(x => x.state === 'open'));
  return { ...visible, ...(isItalia(p) ? { italia: { ...b.italia, issues: pilotPreflight(p), canPresent: allowed && publicationValid(p), report: pilotReport(p) } } : {}), sessions: b.sessions.map(s => ({ ...s, snapshot: allowed && !s.scopeWithdrawn && (!isItalia(p) || Date.parse(s.snapshot.italia?.publication.expiresAt) > Date.now()) ? s.snapshot : null })), tasks: businessTasks(p), releaseIssues: releaseIssues(p), rightsValid: allowed, quotes: b.quotes.map(q => ({ ...q, comparison: quoteReadiness(b, q) })), demoNotice: '角色切换仅为本机流程演示；未实现登录或账号数据隔离' };
}

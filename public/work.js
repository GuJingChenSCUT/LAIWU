import { createItalianWorkspace, isItalianProject } from './italia.js';
export function createWorkspace({ api, getProject, setProject, e, productArt, toast }) {
  let catalog;
  let role = 'brand';
  let tab = 'overview';
  let saving = false;
  const root = document.querySelector('#work-root');
  const italian = createItalianWorkspace({ root, api, getProject, setProject, e, toast });
  const tabs = { overview: '项目与待办', rights: '文化与权利', sourcing: '询价与样品', script: '讲稿与场次', delivery: '交付与复盘', audience: '观众体验' };
  const allowed = { brand: ['overview', 'rights', 'sourcing', 'script', 'delivery'], culture: ['rights', 'overview'], supplier: ['sourcing'], host: ['script', 'overview'], audience: ['audience'] };
  try {
    const saved = JSON.parse(sessionStorage.getItem('laiwu-work-view') || 'null');
    if (saved && Object.hasOwn(allowed, saved.role) && allowed[saved.role].includes(saved.tab)) { role = saved.role; tab = saved.tab; }
  } catch { /* View preferences are optional. */ }
  function rememberView() {
    try { sessionStorage.setItem('laiwu-work-view', JSON.stringify({ role, tab })); } catch { /* Optional. */ }
    if (location.hash.startsWith('#work')) history.replaceState(null, '', `#work/${tab}`);
  }
  const date = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const money = cents => cents === null || cents === undefined ? '待确认' : new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100);
  const when = value => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const tag = (label, done = false) => `<span class="work-tag ${done ? 'done' : ''}">${e(label)}</span>`;
  const field = (name, label, value = '', attrs = '') => `<label>${label}<input name="${name}" value="${e(value)}" ${attrs}></label>`;
  const area = (name, label, value = '', attrs = '') => `<label>${label}<textarea name="${name}" rows="3" maxlength="500" ${attrs}>${e(value)}</textarea></label>`;
  const submit = label => `<button class="btn primary" type="submit">${label} →</button>`;
  const confirmName = { brand: '品牌展示内容', culture: '文化讲述', script: '双语讲稿' };
  function confirmed(p, scope) { return p.business.confirmations.some(c => c.scope === scope && c.contentRevision === p.revision && !c.invalidatedAt); }
  function confirmCard(p, scope) {
    const done = confirmed(p, scope);
    return `<div class="handoff ${done ? 'complete' : ''}"><div>${tag(done ? '已签收' : '待本人确认', done)}<h3>${confirmName[scope]} · v${p.revision}</h3><p>${scope === 'brand' ? '确认这一版用于本机展示。费用、采购与量产另行确认。' : '确认这是创作者的个人讲述，来源与署名已核对。此动作不授予商业使用权。'}</p></div>${done ? '' : `<form data-business="confirm"><input type="hidden" name="scope" value="${scope}"><label class="check"><input name="acknowledged" type="checkbox" required><span>我以${role === 'brand' ? '品牌方' : '文化创作者'}演示身份核对了此版内容</span></label>${submit('确认本版本范围')}</form>`}</div>`;
  }
  function profile(p) {
    const b = p.business;
    const route = catalog.routes.find(r => r.id === b.route);
    return `<div class="work-section-title"><div><span class="eyebrow">PROJECT BRIEF</span><h2>先把一件事说清楚</h2></div>${tag(`${b.route} · ${route.name}`)}</div>
      <div class="route-summary"><b>${e(route.description)}</b><p>${e(route.todo)}</p></div>
      <div class="project-facts"><div><small>品牌 / 文化来源</small><b>${e(b.profile.brandOrigin)}</b></div><div><small>生产地</small><b>${e(b.profile.productionPlace)}</b></div><div><small>销售与售后服务</small><b>${e(b.profile.seller)}</b></div></div>
      ${role === 'brand' ? `${confirmCard(p, 'brand')}<details class="work-details"><summary>完善品牌与商品信息</summary><form data-business="profile"><label>本轮业务路径<select name="route">${catalog.routes.map(r => `<option value="${r.id}" ${b.route === r.id ? 'selected' : ''}>${r.id} · ${e(r.name)} / ${r.phase}</option>`).join('')}</select></label><div id="route-helper" class="field-help">${e(route.todo)}</div><div class="work-fields">${field('brandOrigin', '品牌来源', b.profile.brandOrigin, 'maxlength="500"')}${field('productionPlace', '生产地（可待确认）', b.profile.productionPlace)}${field('shippingPlace', '发货地', b.profile.shippingPlace)}${field('seller', '销售 / 开票 / 售后服务主体', b.profile.seller)}${field('importer', '进口主体（如适用）', b.profile.importer)}</div>${area('objective', '这轮要完成什么？', b.profile.objective)}${area('assets', '已有什么素材或样品？', b.profile.assets)}${area('routeDetails', '本路径补充资料：城市、进口品类或目的国等', b.profile.routeDetails === '待确认' ? '' : b.profile.routeDetails)}${submit('保存信息并核对新版')}<p class="fine">空白项保留为待确认；保存后内容版本更新。R2–R5 当前只整理资料，未接入实际业务办理。</p></form></details>` : ''}
      <div class="work-section-title"><h3>一起完成这份作品</h3><small>当前项目 · 实时状态</small></div><div class="task-list">${b.tasks.map(t => `<button class="task-item" data-wrole="${t.owner}" data-wtab="${t.tab}"><span class="task-check ${t.done ? 'done' : ''}">${t.done ? '✓' : '○'}</span><span><b>${e(t.name)}</b><small>${e(t.output)}</small></span><span class="task-owner">${e(catalog.roles.find(r => r.id === t.owner).name)}<small>交给 ${e(t.next)}</small></span></button>`).join('')}</div>`;
  }
  function rights(p) {
    const r = p.business.rights;
    return `<div class="work-section-title"><div><span class="eyebrow">CULTURE & PERMISSION</span><h2>文化有来处，使用有边界</h2></div>${tag(p.business.rightsValid ? '演示范围有效' : r.state === 'withdrawn' ? '已撤回' : '待确认 / 已到期', p.business.rightsValid)}</div><div class="story-letter"><span class="eyebrow">${e(p.brief.country)} · 个人故事</span><p>“${e(p.brief.story)}”</p><small>来源由创作者提供；不代表国家文化全貌或非遗认证。</small></div>
    ${role === 'culture' ? `<form data-business="rights" class="work-form"><div class="work-fields">${field('credit', '展示署名 / Credit', r.credit, 'required maxlength="120" placeholder="例如：Lucia · 虚构故事"')}${field('expiresAt', '演示范围有效至（北京时间）', r.expiresAt ? r.expiresAt.slice(0, 10) : date(30), 'type="date" required')}</div>${area('evidence', '素材来源与依据（演示文本）', r.evidence, 'required placeholder="例如：自述故事与原创示意图；仅为现场演示登记，无真实授权合同"')}<label>范围状态<select name="state"><option value="limited" ${r.state !== 'withdrawn' ? 'selected' : ''}>登记有限演示范围</option><option value="withdrawn" ${r.state === 'withdrawn' ? 'selected' : ''}>撤回演示范围</option></select></label><label class="check"><input type="checkbox" name="display" ${r.display ? 'checked' : ''}><span>允许本机概念与讲稿展示演练</span></label><label class="check"><input type="checkbox" name="sample" ${r.sample ? 'checked' : ''}><span>允许样品送验流程演练（不委托真实制造）</span></label><p class="field-help">量产、转授权、真实 AI 素材处理及对外传播需另行确认。登记本表不会形成真实授权合同。</p>${submit('登记范围并交接')}</form>${confirmCard(p, 'culture')}` : `<div class="work-panel"><h3>${e(r.credit || '署名待文化方提供')}</h3><p>${e(r.evidence || '等待文化方提交来源依据')}</p><p>本机展示：${r.display ? '允许演练' : '未开放'} · 样品流程：${r.sample ? '允许演练' : '未开放'} · 量产：未开放</p><p>有效期：${r.expiresAt ? when(r.expiresAt) : '待确认'}（北京时间）</p><button class="btn" data-wrole="culture" data-wtab="rights">切换文化创作者演示视角 →</button></div>`}
    <div class="work-section-title"><h3>每一份确认，独立留档</h3></div>${confirmationHistory(p)}`;
  }
  function confirmationHistory(p) {
    return p.business.confirmations.length ? `<div class="audit-list">${p.business.confirmations.slice(-9).reverse().map(c => `<div><i class="audit-dot ${c.invalidatedAt ? '' : 'done'}"></i><b>${confirmName[c.scope]} · v${c.contentRevision}</b><small>${e(c.actor)} · ${when(c.at)}</small><p>${c.invalidatedAt ? `已失效：${e(c.reason)}` : '本地演示签收 · 不触发采购或付款'}</p></div>`).join('')}</div>` : '<p class="quiet-empty">还没有确认记录。来源、展示和讲稿将分别签收。</p>';
  }
  function defaultSpec(p) {
    return p.brief.productType === '帆布袋' ? { name: '成人帆布袋', dimensions: '35 × 40 cm；尺寸公差 ± 1 cm', material: '棉帆布 280 g/m²（演示规格）', process: '单面蓝色印花；色样另确认', packaging: '单件纸套，外箱另列', quantity: 100, destination: '深圳指定地点（演示）', acceptance: '核对尺寸、印花位置、色样、车缝与包装；缺陷样返工' } : { name: p.brief.productType, dimensions: '待品牌填写尺寸、容量及公差', material: '待品牌确认材料与安全要求', process: '待提供生产图稿、色样与工艺', packaging: '待确认单件与外箱包装', quantity: 100, destination: '深圳指定地点（演示）', acceptance: '待品牌填写可检查的样品标准' };
  }
  function sourcing(p) {
    const b = p.business;
    const s = b.spec;
    const d = s || defaultSpec(p);
    const routeEnabled = ['R0', 'R1'].includes(b.route);
    if (!routeEnabled) return `<div class="work-panel"><h2>${e(catalog.routes.find(r => r.id === b.route).name)} · 资料准备</h2><p>${e(catalog.routes.find(r => r.id === b.route).todo)}</p><p>这一业务路径还没有接入询价、办理或合同服务。</p><button class="btn" data-wtab="overview">返回项目边界</button></div>`;
    return `<div class="work-section-title"><div><span class="eyebrow">RFQ / REQUEST FOR QUOTATION</span><h2>${role === 'supplier' ? '一份能回答的询价单' : '从规格，到询价与样品'}</h2></div>${tag(s ? `规格 s${s.revision}` : '规格待冻结', !!s)}</div><p>所有回复为本机演示录入。当前统一人民币、同一批次数量与交付地点；不发送给真实工厂。</p>
      ${role === 'brand' ? `<details class="work-details" ${s ? '' : 'open'}><summary>${s ? '修订询价规格（旧报价将失效）' : '准备并冻结询价规格'}</summary><form data-business="spec"><div class="work-fields">${field('name', '品类', d.name, 'required maxlength="80"')}${field('quantity', '询价数量 / 件', d.quantity, 'type="number" min="1" max="100000" required')}${field('dimensions', '尺寸 / 公差', d.dimensions, 'required')}${field('material', '材料 / 克重 / 成分', d.material, 'required')}${field('process', '工艺 / 色样 / 图稿', d.process, 'required')}${field('packaging', '包装范围', d.packaging, 'required')}</div>${field('destination', '交付地点', d.destination, 'required')}${area('acceptance', '验收标准', d.acceptance, 'required')}${submit('冻结这一版询价规格')}</form></details>` : ''}
      ${s ? `<div class="spec-card"><div>${tag(`RFQ · ${p.id.slice(0, 6).toUpperCase()}`)}<h3>${e(s.name)} / ${s.quantity} 件</h3></div><dl>${[['规格', s.dimensions], ['材料', s.material], ['工艺', s.process], ['包装', s.packaging], ['交付', s.destination], ['验收', s.acceptance]].map(([label, value]) => `<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join('')}</dl></div>` : '<div class="quiet-empty">等待品牌方冻结规格，再填写询价回复。</div>'}
      ${role === 'supplier' && s ? `<div class="work-section-title"><h3>填写询价回复</h3><button class="btn small" id="fill-quote-example">填入明确标记的示例</button></div><form data-business="quote" id="quote-form"><input name="specRevision" type="hidden" value="${s.revision}"><div class="work-fields">${['unitCents|单价 / CNY 每件', 'sampleCents|打样费 / 整笔', 'plateCents|版费 / 整笔', 'packagingCents|包装费 / 整批', 'freightCents|运费 / 整批'].map(pair => { const [key, label] = pair.split('|'); return field(key, label, '', 'type="number" min="0" max="1000000" step="0.01" placeholder="未知请留空" data-money'); }).join('')}<label>税费口径<select name="tax"><option value="unknown">待确认</option><option value="included">上述所有金额均含税</option><option value="excluded">未含税（待补齐总额）</option></select></label>${field('moq', '最低起订量 / 件', s.quantity, 'type="number" min="1" max="100000" required')}${field('validUntil', '有效期至（北京时间）', '', 'type="date"')}${field('sampleDays', '打样 / 天', '', 'type="number" min="0" max="365" placeholder="待确认"')}${field('productionDays', '量产 / 天', '', 'type="number" min="0" max="365" placeholder="待确认"')}</div>${field('trigger', '交期从什么条件满足时起算？', '', 'placeholder="如：双方书面确认样品与材料后；不是提交报价时"')}${area('acceptance', '验收与缺陷处理约定', s.acceptance)}${field('payment', '付款里程碑（演练条款）', '', 'placeholder="待双方另签合同确认"')}${submit('保存示例询价回复')}<p class="fine">未知费用留空；明确不收费才填 0。提交后不会形成订单或付款。</p></form><details class="work-details"><summary>无法承接这份询价</summary><form data-business="quote"><input type="hidden" name="declined" value="true"><input type="hidden" name="specRevision" value="${s.revision}">${area('reason', '数量、交期或能力不匹配的原因', '', 'required')}${submit('记录无法承接')}</form></details>` : ''}
      <div class="work-section-title"><h3>${role === 'supplier' ? '本工坊的回复记录' : '同口径报价检查'}</h3>${tag('演示报价 · 非订单')}</div><div class="quote-grid">${b.quotes.length ? b.quotes.slice(-4).reverse().map(q => `<article class="quote-card"><div class="panel-heading"><b>${e(q.supplier)}</b>${tag(q.declined ? '无法承接' : q.comparison.ready ? '口径已齐' : '待补齐', q.comparison.ready)}</div><small>规格 s${q.specRevision} · ${when(q.at)}</small><strong class="quote-total">${q.declined ? '本轮不承接' : money(q.comparison.totalCents)}</strong><p>${q.declined ? e(q.reason) : q.comparison.ready ? `货款 + 打样 + 版费 + 包装 + 运费，均为含税演示金额。${b.spec.quantity} 件；不包含未列明的商业服务。` : `不能比较总价：${q.comparison.missing.map(e).join('、')}`}</p>${q.declined ? '' : `<small>单价 ${money(q.unitCents)} · 打样 ${money(q.sampleCents)} · 运费 ${money(q.freightCents)}</small><p class="fine">起算：${e(q.trigger || '待确认')}<br>有效至：${q.validUntil ? when(q.validUntil) : '待确认'}</p>`}</article>`).join('') : '<p class="quiet-empty">尚无询价回复。切换供应商视角可填写。</p>'}</div>
      ${role === 'brand' ? samplePanel(p) : ''}`;
  }
  function samplePanel(p) {
    const b = p.business;
    const quotes = b.quotes.filter(q => q.comparison.ready);
    return `<div class="work-section-title"><div><span class="eyebrow">SAMPLE CHECK</span><h3>样品验收演练</h3></div>${tag(b.sample ? { pending_acceptance: '待验收', rework: '需返工', accepted: '演练验收通过' }[b.sample.state] : '尚未送验', b.sample?.state === 'accepted')}</div><p class="fine">需文化方开放打样演练范围、当前有效完整报价。验收通过不触发量产；真实实物、检测与合同待试点接入。</p>${b.sample ? `<div class="sample-record"><b>规格 s${b.sample.specRevision}</b><p>${e(b.sample.evidence)}</p><small>${when(b.sample.at)}</small></div>` : ''}${quotes.length ? `<form data-business="sample"><label>关联示例报价<select name="quoteId">${quotes.map(q => `<option value="${q.id}" ${q.id === b.sample?.quoteId ? 'selected' : ''}>工坊回复 · ${money(q.comparison.totalCents)} · s${q.specRevision}</option>`).join('')}</select></label><label>本次动作<select name="state"><option value="pending_acceptance">登记送验 / 返工后重新送验</option>${b.sample?.state === 'pending_acceptance' ? '<option value="rework">记录缺陷，退回修改</option><option value="accepted">确认演练样品符合规格</option>' : ''}</select></label>${area('evidence', '送验说明或具体检查结果（演示）', '', 'required placeholder="例如：演示样品印花偏移 2 cm，超过规格公差，需重新送验"')}<label class="check"><input name="checked" type="checkbox"><span>接受样品时，我已逐项核对尺寸、材料、工艺与包装</span></label>${submit('保存样品交接')}</form>` : '<p class="quiet-empty">报价补齐前，保留在询价环节。</p>'}`;
  }
  function scripts(p) {
    const b = p.business;
    const done = confirmed(p, 'script');
    return `<div class="work-section-title"><div><span class="eyebrow">HUMAN FIRST / SCRIPT</span><h2>把讲稿交到真人手里</h2></div>${tag(done ? '双语已核对' : '双语待核对', done)}</div><div class="script-pair"><article><small>中文 · v${p.revision}</small><p>${e(p.outputs.host.openingZh)}</p><a class="text-link" href="#studio">修改中文与记录原因 ↗</a></article><article><small>ENGLISH · ${b.translation === 'reviewed' ? 'REVIEWED' : 'NEEDS REVIEW'}</small><p lang="en">${e(p.outputs.host.openingEn)}</p></article></div>${role === 'host' && !done ? `<form data-business="confirm"><input name="scope" type="hidden" value="script"><label>核对后的英文稿<textarea name="openingEn" rows="4" maxlength="1800" required lang="en">${e(p.outputs.host.openingEn)}</textarea></label><label class="check"><input name="acknowledged" type="checkbox" required><span>已对照中文核对人物、来源、商品阶段与承诺范围</span></label>${submit('签收双语讲稿')}<p class="fine">修改英文将产生新内容版本，品牌与文化方需要重新签收。此确认由真人完成。</p></form>` : ''}
      <div class="handoff ${b.releaseIssues.length ? '' : 'complete'}"><div><span class="eyebrow">READY TO REHEARSE?</span><h3>${b.releaseIssues.length ? '开场前，还有这些准备' : '内容已齐，可以建立试讲场次'}</h3>${b.releaseIssues.length ? `<ul>${b.releaseIssues.map(x => `<li>${e(x)}</li>`).join('')}</ul>` : '<p>建立场次会冻结当前内容快照，反馈在 24 小时内归入此版本。</p>'}</div>${role === 'host' ? `<button class="btn primary" data-business-action="session" ${b.releaseIssues.length ? 'disabled' : ''}>建立本机试讲场次 →</button>` : '<button class="btn" data-wrole="host" data-wtab="script">交给主播 →</button>'}</div>${sessionList(p)}`;
  }
  function sessionList(p) {
    return `<div class="work-section-title"><h3>场次记录</h3><small>时间均为北京时间</small></div><div class="session-list">${p.business.sessions.length ? p.business.sessions.slice().reverse().map(s => `<article><div><b>试讲 ${String(s.number).padStart(2, '0')}</b><small>内容 v${s.contentRevision} · ${e(s.id.slice(0, 8))}</small></div><div>${tag(s.state === 'open' && Date.parse(s.feedbackUntil) > Date.now() ? '反馈窗口开放' : '反馈已关闭', s.state === 'open' && Date.parse(s.feedbackUntil) > Date.now())}<small>截止 ${when(s.feedbackUntil)}</small></div><div class="actions">${s.contentRevision === p.revision && p.status === 'demo_ready' && p.business.rightsValid ? '<a href="#live" class="btn small">进入本机舞台 ↗</a>' : ''}<button class="btn small" data-wrole="audience" data-wtab="audience" data-session="${s.id}">观众视角</button>${role === 'host' && s.state === 'open' ? `<button class="text-button" data-business-action="closeSession" data-session="${s.id}">关闭反馈</button>` : ''}</div></article>`).join('') : '<p class="quiet-empty">还未建立场次。完成三方确认后再试讲。</p>'}</div>`;
  }
  let selectedSession = '';
  function audience(p) {
    const b = p.business;
    if (!b.rightsValid) return '<div class="quiet-empty"><h2>作品尚未开放体验</h2><p>等待文化方确认展示范围；撤回或到期的素材暂停预览。</p></div>';
    if (!b.sessions.length) return '<div class="quiet-empty"><h2>故事正在准备中</h2><p>品牌、文化方与主播完成确认后，这里会出现可体验的作品。</p></div>';
    const s = b.sessions.find(s => s.id === selectedSession) || b.sessions.at(-1);
    selectedSession = s.id;
    const snap = s.snapshot;
    if (!snap) return '<div class="quiet-empty"><h2>本场作品的展示范围已撤回</h2><p>此场次保留交接记录，重新授权后需另建场次，不会自动恢复旧作品展示。</p></div>';
    const open = s.state === 'open' && Date.parse(s.feedbackUntil) > Date.now();
    return `<div class="work-section-title"><div><span class="eyebrow">ONE OBJECT, MANY VOICES</span><h2>先听一个故事，再说你的感受。</h2></div>${tag('概念提案 · 暂未销售')}</div><label class="session-picker">体验场次<select id="audience-session">${b.sessions.map(session => `<option value="${session.id}" ${session.id === s.id ? 'selected' : ''}>试讲 ${session.number} · 内容 v${session.contentRevision}</option>`).join('')}</select></label><div class="audience-layout"><article class="audience-object"><div class="audience-art">${productArt(snap.productType, snap.palette[0])}<span>原创程序插画 · 非商品实拍</span></div><div class="audience-story"><span class="eyebrow">${e(snap.country)} / PERSONAL STORY</span><h2>${e(snap.title)}</h2><p>${e(snap.tagline)}</p><blockquote>“${e(snap.story)}”</blockquote><small>故事与素材署名：${e(snap.credit)}</small></div></article><div><div class="work-panel"><h3>你看到的，是什么阶段？</h3><dl class="product-details">${[['作品阶段', '概念提案，尚无可售库存'], ['拟用材料', snap.materials.join('、')], ['品牌来源', snap.profile.brandOrigin], ['生产地', snap.profile.productionPlace], ['销售 / 售后', snap.profile.seller], ['实拍 / 检测', '待真实样品与专业核查'], ['价格', `目标价 ¥${snap.targetRetailPrice}，用于测试，不是销售报价`]].map(([k, v]) => `<div><dt>${k}</dt><dd>${e(v)}</dd></div>`).join('')}</dl></div><form id="audience-feedback" class="work-panel"><h3>留下你的看法</h3><input name="sessionId" type="hidden" value="${s.id}"><input name="channel" type="hidden" value="campus"><label>你会在什么场景使用？<select name="useCase"><option>日常使用</option><option>送给朋友</option><option>文化收藏</option><option>暂时不需要</option></select></label><label>目前的感受<select name="decision"><option value="interested">我有兴趣，想继续了解</option><option value="price_high">目标价格需要再考虑</option><option value="unclear">文化故事还没讲明白</option></select></label>${area('note', '最想问或最想改的一点', '', 'required placeholder="说一句具体的感受；无需提供姓名或联系方式"')}<button class="btn primary wide" type="submit" ${open ? '' : 'disabled'}>${open ? '提交反馈，不产生订单' : '本场反馈窗口已关闭'}</button><p class="fine">本机演示反馈 · 绑定试讲 ${s.number} / v${s.contentRevision}。不下单、不收款，也不自动订阅通知。</p></form></div></div>`;
  }
  function delivery(p) {
    const b = p.business;
    return `<div class="work-section-title"><div><span class="eyebrow">HANDOFF & NEXT DECISION</span><h2>交付的不只是一个点子</h2></div><button class="btn" id="work-export">下载共创资料包 ↗</button></div><div class="delivery-grid">${[['01', '故事与概念', `内容 v${p.revision}，保留修订原因`], ['02', '分范围签收', `${b.confirmations.filter(c => !c.invalidatedAt).length} 份当前签收；无采购承诺`], ['03', '询价与样品', `${b.quotes.length} 份示例回复；样品${b.sample ? '已有演练记录' : '尚未送验'}`], ['04', '场次与反馈', `${b.sessions.length} 场试讲 / ${p.observations.filter(o => o.sessionId).length} 次本机反馈`]].map(([n, title, info]) => `<div><span>${n}</span><h3>${title}</h3><p>${info}</p></div>`).join('')}</div><div class="budget-note"><b>目标售价 ¥${p.brief.targetRetailPrice ?? p.brief.budget}</b><span>项目预算：未登记</span><span>采购承诺：未开放</span><span>实际付款：未接入</span></div>
    <div class="work-section-title"><h3>下一轮由品牌来决定</h3><a class="text-link" href="#insights">查看逐条反馈 ↗</a></div>${b.sessions.length ? `<form data-business="decision" class="work-form"><div class="work-fields"><label>依据场次<select name="sessionId">${b.sessions.map(s => `<option value="${s.id}">试讲 ${s.number} / v${s.contentRevision}</option>`).join('')}</select></label><label>本轮决定<select name="decision"><option value="continue">继续验证，准备下一轮访谈或样品</option><option value="revise">修改概念，再次验证</option><option value="stop">暂停此概念，保留学习记录</option></select></label></div>${area('reason', '这次学到了什么？下一步想尝试什么？', '', 'required placeholder="例如：两条演示反馈提到材料，希望先请工坊核对材质再开展访谈"')}${submit('保存品牌决定')}</form>` : '<p class="quiet-empty">先建立试讲场次，再记录复盘决定。</p>'}
    ${b.decisions.map(d => `<div class="sample-record"><b>${{ continue: '继续验证', revise: '修改概念', stop: '暂停概念' }[d.decision]}</b><p>${e(d.reason)}</p><small>${when(d.at)} · 依据场次 ${e(d.sessionId.slice(0, 8))}</small></div>`).join('')}<div class="work-section-title"><h3>共创记录</h3><small>新记录在上 · 北京时间</small></div><div class="audit-list">${b.audit.slice(-12).reverse().map(a => `<div><i class="audit-dot done"></i><b>${e(a.message)}</b><small>${when(a.at)} · 内容 v${a.contentRevision}</small></div>`).join('') || '<p class="quiet-empty">完成第一步确认后，会留下可追溯的记录。</p>'}</div>`;
  }
  function render() {
    if (!catalog) return;
    if (italian.render()) return;
    const p = getProject();
    const roles = catalog.roles.filter(r => Object.hasOwn(allowed, r.id));
    const chosen = roles.find(r => r.id === role);
    if (!allowed[role].includes(tab)) tab = allowed[role][0];
    if (!p || !['awaiting_review', 'demo_ready'].includes(p.status)) {
      root.innerHTML = `<div class="work-intro"><div><span class="eyebrow">PARTNER WORKSPACE</span><h1>一张创作桌，<br>每个人都接得上。</h1><p>品牌、文化创作者、供应商与主播，围绕同一个项目接力。<br>先生成概念，再带着明确的任务回到这里。</p><a class="btn primary" href="#studio">准备第一份共创提案 →</a></div><div class="entry-grid">${roles.slice(0, 4).map((r, i) => `<article><span>0${i + 1}</span><h3>${r.name}</h3><p>${r.job}</p><small>${r.en}</small></article>`).join('')}</div></div>`;
      return;
    }
    const b = p.business;
    const mine = b.tasks.filter(t => t.owner === role && !t.done);
    const next = mine[0];
    const knowledge = catalog.knowledge.filter(k => k.routes.includes(b.route));
    const showCards = tab === 'rights' ? knowledge.filter(k => k.id === 'rights') : tab === 'sourcing' ? catalog.knowledge.filter(k => ['quote', 'incoterms'].includes(k.id)) : tab === 'script' ? catalog.knowledge.filter(k => k.id === 'live') : knowledge.slice(0, 3);
    root.innerHTML = `<div class="work-heading"><div><div class="eyebrow">PARTNER WORKSPACE / 合作工作台</div><h1>${e(p.outputs.design.title)}</h1><p>${b.route} · ${e(catalog.routes.find(r => r.id === b.route).name)} <span>内容 v${p.revision}</span></p></div><a href="#studio" class="btn">查看共创提案 ↗</a></div><div class="role-switch" aria-label="演示角色切换">${roles.map(r => `<button data-wrole="${r.id}" aria-pressed="${r.id === role}" class="${r.id === role ? 'selected' : ''}"><span>${r.name}</span><small>${r.en}</small></button>`).join('')}</div><div class="demo-context"><span><b>${chosen.org}</b> · ${chosen.job}</span><small>体验预览 · 可切换不同参与视角（未启用账号登录）</small></div><div class="workspace-layout"><aside class="work-sidebar"><span class="eyebrow">${chosen.en.toUpperCase()} DESK</span><nav aria-label="工作台功能">${allowed[role].map(id => `<button class="${tab === id ? 'active' : ''}" data-wtab="${id}" aria-current="${tab === id ? 'page' : 'false'}">${tabs[id]}<span>↗</span></button>`).join('')}</nav><div class="sidebar-note"><b>${mine.length}</b><span>项待完成</span><p>每一次确认，都留下范围与版本。</p></div><button class="text-button" id="refresh-work">刷新项目状态 ↻</button></aside><div class="work-main">${next && tab !== 'audience' ? `<div class="next-action"><span>下一步</span><b>${e(next.name)}</b><small>完成后交给 ${e(next.next)}</small><button data-wtab="${next.tab}" class="text-button">查看 →</button></div>` : ''}<div class="work-surface">${({ overview: profile, rights, sourcing, script: scripts, delivery, audience })[tab](p)}</div></div>${role === 'audience' ? '' : `<aside class="knowledge-rail"><div class="eyebrow">ALONG THE WAY</div><h3>做到这一步，<br>刚好用得上。</h3>${showCards.map(k => `<article><span>${k.id === 'quote' ? '业务约定' : '业务知识'}</span><h4>${k.title}</h4><p>${k.body}</p><b>${k.action}</b>${k.url ? `<a href="${k.url}" target="_blank" rel="noopener noreferrer">${k.source} ↗</a>` : `<small>${k.source}</small>`}</article>`).join('')}<p class="fine">法规内容用于提示需补齐的业务事项；适用范围交由办理人员核对。来源核对：2026-10-11。</p></aside>`}</div>`;
    root.classList.toggle('audience-mode', role === 'audience');
  }
  async function save(action, values) {
    const p = getProject();
    const updated = await api(`/api/projects/${p.id}/business`, { ...values, action, role, expectedVersion: p.business.version, contentRevision: p.revision, requestId: crypto.randomUUID() });
    setProject(updated);
    toast(updated.business.audit.at(-1)?.message || '已保存');
  }
  async function guarded(fn) {
    if (saving) return;
    saving = true;
    root.setAttribute('aria-busy', 'true');
    root.querySelectorAll('button').forEach(b => { b.disabled = true; });
    let failed = false;
    const draft = [...root.querySelectorAll('input,textarea,select')].map(input => ({ name: input.name, value: input.value, checked: input.checked, form: input.form?.dataset.business || input.form?.id }));
    try { await fn(); } catch (error) {
      failed = true;
      // Keep entered fields when validation fails; a version conflict needs a fresh snapshot.
      toast(error.message);
      if (error.message.includes('版本已变化')) {
        try { setProject(await api(`/api/projects/${getProject().id}`)); } catch { toast('最新版本读取失败，请恢复连接后刷新项目状态'); }
      }
    } finally {
      saving = false; root.removeAttribute('aria-busy'); render();
      if (failed) for (const item of draft) {
        const input = [...root.querySelectorAll('input,textarea,select')].find(input => input.name === item.name && (input.form?.dataset.business || input.form?.id) === item.form);
        if (input) { input.value = item.value; if (input.type === 'checkbox') input.checked = item.checked; }
      }
    }
  }
  root.addEventListener('click', event => {
    if (isItalianProject(getProject())) return;
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.wrole || button.dataset.wtab) {
      if (button.dataset.wrole) role = button.dataset.wrole;
      tab = button.dataset.wtab || allowed[role][0];
      if (button.dataset.session) selectedSession = button.dataset.session;
      rememberView();
      render(); return;
    }
    if (button.dataset.businessAction) guarded(async () => { await save(button.dataset.businessAction, { sessionId: button.dataset.session }); });
    if (button.id === 'refresh-work') guarded(async () => { setProject(await api(`/api/projects/${getProject().id}`)); toast('已读取最新项目状态'); });
    if (button.id === 'work-export') document.querySelector('#export-button').click();
    if (button.id === 'fill-quote-example') {
      const form = root.querySelector('#quote-form');
      const values = { unitCents: 28, sampleCents: 120, plateCents: 60, packagingCents: 50, freightCents: 80, tax: 'included', moq: 50, validUntil: date(14), sampleDays: 7, productionDays: 20, trigger: '演练：双方书面确认规格与样品后起算', payment: '演练：付款里程碑待实际合同约定，不发生付款' };
      for (const [key, value] of Object.entries(values)) form.elements[key].value = value;
      toast('已填入虚构示例，可修改后提交');
    }
  });
  root.addEventListener('change', event => {
    if (isItalianProject(getProject())) return;
    if (event.target.id === 'audience-session') { selectedSession = event.target.value; render(); }
    if (event.target.name === 'route') root.querySelector('#route-helper').textContent = catalog.routes.find(r => r.id === event.target.value).todo;
  });
  root.addEventListener('submit', event => {
    if (isItalianProject(getProject())) return;
    event.preventDefault();
    const form = event.target;
    if (!form.dataset.business && form.id !== 'audience-feedback') return;
    const data = Object.fromEntries(new FormData(form));
    form.querySelectorAll('input[type=checkbox]').forEach(input => { data[input.name] = input.checked; });
    form.querySelectorAll('input[type=number],input[type=hidden][name=specRevision]').forEach(input => { data[input.name] = input.value === '' ? null : input.hasAttribute('data-money') ? Math.round(Number(input.value) * 100) : Number(input.value); });
    if (data.declined === 'true') data.declined = true;
    for (const key of ['expiresAt', 'validUntil']) if (data[key]) data[key] = new Date(`${data[key]}T23:59:59+08:00`).toISOString();
    guarded(async () => {
      if (form.id === 'audience-feedback') {
        setProject(await api(`/api/projects/${getProject().id}/observations`, { ...data, requestId: crypto.randomUUID() }));
        toast('反馈已记到此场次。没有产生订单或订阅。');
      } else await save(form.dataset.business, data);
    });
  });
  return { init(data) { catalog = data; italian.init(data); render(); }, render, open(section) { if (Object.hasOwn(tabs, section)) { tab = section; if (!allowed[role].includes(section)) role = section === 'audience' ? 'audience' : section === 'rights' ? 'culture' : 'brand'; } render(); } };
}

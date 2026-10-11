import { createWorkspace } from './work.js';
import { italianProposal, isItalianProject } from './italia.js';
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const e = escapeHtml;
let catalog;
let project = null;
let busy = false;
let camera = null;
let challenge = null;
let toastTimer;
let effectTimer;
let stageStopped = false;
const workspace = createWorkspace({ api, getProject: () => project, setProject: value => { project = value; renderProject(); }, e, productArt, toast });
const statusNames = { queued: '準備中', running: '正在共創', awaiting_review: '等待創作者確認', demo_ready: '已確認 · 可演示', failed: '生成未完成' };
const decisions = { interested: '表示有興趣', price_high: '覺得價格偏高', unclear: '没理解文化故事' };

function productArt(type = '陶瓷杯', color = '#315C9B') {
  const shape = type === '帆布袋'
    ? `<path d="M130 138 Q126 65 194 65 Q261 65 258 138" fill="none" stroke="#c5aa7d" stroke-width="17"/><path d="M105 130 L280 130 L299 300 Q201 335 86 300 Z" fill="#dbc49d"/><path d="M118 136 L135 291 M267 136 L270 291" fill="none" stroke="#ad936a" stroke-width="2"/><path d="M189 155 L246 217 L189 279 L137 217 Z" fill="${color}"/><path d="M190 173 L226 216 L190 259 L156 216 Z" fill="#eddcae"/><path d="M190 190 L212 216 L190 242 L170 216 Z" fill="${color}"/>`
    : type === '裝飾燈'
      ? `<path d="M147 267 L230 267 L242 305 L134 305 Z" fill="#b4986e"/><path d="M103 113 Q190 71 277 113 L257 261 Q191 284 120 260 Z" fill="#edd7a0"/><ellipse cx="190" cy="111" rx="87" ry="18" fill="#dec99a"/><path d="M140 232 Q205 210 205 132 M185 191 Q146 178 145 158 Q177 156 185 191 M197 163 Q226 139 245 149 Q238 178 197 183 M169 219 Q139 211 132 190 Q160 190 177 210" fill="${color}" stroke="${color}" stroke-width="3"/><path d="M120 254 Q186 271 257 254" stroke="#c1a779" stroke-width="3" fill="none"/>`
      : `<ellipse cx="198" cy="294" rx="111" ry="18" fill="#46553a15"/><path d="M260 137 C346 113 346 247 268 247" fill="none" stroke="#bdb5a0" stroke-width="23"/><path d="M260 135 C332 115 337 232 267 236" fill="none" stroke="#f7f0de" stroke-width="17"/><path d="M102 114 L114 255 Q186 312 265 254 L278 114 Z" fill="#f2e8d0"/><path d="M237 133 L222 275 Q249 270 265 254 L278 114 Z" fill="#cdbd963a"/><ellipse cx="190" cy="114" rx="88" ry="24" fill="#d3c5a5"/><ellipse cx="190" cy="116" rx="77" ry="16" fill="#8c9671"/><ellipse cx="190" cy="120" rx="71" ry="12" fill="#abb087"/><path d="M107 161 Q144 139 180 166 T273 162 M110 181 Q145 160 180 188 T271 183 M112 220 Q148 199 183 225 T267 222 M114 240 Q145 219 183 247 T265 242" stroke="${color}" stroke-width="8" fill="none"/><path d="M129 127 Q149 133 160 131" stroke="#fffdf5" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  return `<svg class="product-svg" viewBox="0 0 380 360" role="img" aria-label="${e(type)}原創概念插畫"><ellipse cx="193" cy="316" rx="126" ry="13" fill="#33452f0c"/>${shape}</svg>`;
}

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}

async function api(path, body) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || '請求失敗');
  return result;
}

function route() {
  const [part, section] = location.hash.slice(1).split('/');
  const page = ['discover', 'work', 'studio', 'live', 'insights', 'architecture'].includes(part) ? part : 'discover';
  document.querySelectorAll('.page').forEach(node => { node.hidden = node.id !== `page-${page}`; });
  document.querySelectorAll('[data-page]').forEach(node => { node.classList.toggle('active', node.dataset.page === page); if (node.dataset.page === page) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
  if (page !== 'live') stopCamera();
  if (page === 'work') workspace.open(section);
  window.scrollTo({ top: 0 });
}

function fillSeed(id) {
  const seed = catalog.seeds.find(s => s.id === id) || catalog.seeds[0];
  for (const field of ['country', 'story', 'craft', 'audience', 'productType', 'budget']) $('#brief-form').elements[field].value = seed[field];
  $('#brief-form').elements.edition.value = seed.edition;
  $('#brief-form').elements.productId.value = seed.productId;
  $('#seed-select').value = seed.id;
}

function renderSteps() {
  const steps = project?.trace || catalog.agents.map(a => ({ ...a, status: 'pending' }));
  const clock = value => new Date(value).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const time = value => `<time datetime="${e(value)}">${e(clock(value))}</time>`;
  const hints = { culture: '保留原文、来源与具体地区，区分事实与待核对事项', design: '保持原商品，准备面向深圳消费者的展示与问题', supply: '整理标签、制造地、规格和成分的待补资料', host: '准备双语开场，把真实表达留给真人', review: '检查资料缺项，交由人工确认版本与展示范围' };
  const labels = { pending: '等待開始', running: '進行中', completed: '已完成', failed: '未完成' };
  $('#agent-steps').innerHTML = steps.map((s, i) => {
    const name = catalog.agents.find(a => a.id === s.id)?.name || s.name;
    const elapsed = s.durationMs ?? (s.status === 'running' && s.startedAt ? Math.max(0, Date.now() - Date.parse(s.startedAt)) : null);
    const timing = s.startedAt ? `開始 ${time(s.startedAt)}${s.completedAt ? ` <span>→</span> 完成 ${time(s.completedAt)}` : s.failedAt ? ` · 中止 ${time(s.failedAt)}` : s.interruptedAt ? ' · 執行中斷，結束時間未記錄' : s.status === 'completed' ? ' · 舊提案未記錄完成時間' : ''}` : '輪到這一步時，會記下開始時間';
    return `<li class="agent-step ${s.status}" data-step="${e(s.id)}" ${s.status === 'running' ? 'aria-current="step"' : ''}><span class="step-dot" aria-hidden="true">${s.status === 'completed' ? '✓' : s.status === 'failed' ? '!' : String(i + 1).padStart(2, '0')}</span><div class="step-content"><div class="step-heading"><strong>${e(name)}</strong><span class="step-status">${labels[s.status]}</span></div><p class="step-description">${hints[s.id] || ''}</p><div class="step-timing">${timing}${elapsed === null ? '' : `<span class="step-duration">${s.status === 'running' ? '已進行' : '耗時'} ${(elapsed / 1000).toFixed(1)} 秒</span>`}</div></div></li>`;
  }).join('');
  $('#workflow-state').textContent = project ? statusNames[project.status] : '等待靈感';
  const current = steps.find(s => s.status === 'running');
  $('#workflow-timing').textContent = project ? `${new Date(project.createdAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })} · 北京時間 · 已完成 ${steps.filter(s => s.status === 'completed').length} / 5` : '每一段靈感，都有自己的節奏。';
  $('#workflow-message').textContent = current ? `正在${catalog.agents.find(a => a.id === current.id)?.name || current.name}，你可以在這裡查看進度。` : project ? project.status === 'failed' ? '這次共創暫停了。已完成的步驟會保留，你可以調整故事後重新生成。' : `提案 v${project.revision} · 接下來，看看哪些細節最像你的故事。` : '從故事開始，經過 5 個步驟，再交給你確認。';
  $('#workflow-pace').textContent = (project?.mode || catalog.mode) === 'mock' ? '演示節奏每步至少 2 秒，耗時包含閱讀停留；使用示例模板，未調用大模型。' : '時間按實際執行記錄；文化內容與使用範圍仍需你確認。';
}

function renderProject() {
  renderSteps();
  $('#export-button').disabled = !project || ['queued', 'running'].includes(project.status);
  if (!project) return;
  const o = project.outputs;
  if (project.status === 'failed') {
    $('#proposal').innerHTML = `<div class="error-box" role="alert"><h3>這次共創還未完成</h3><p>${e(project.error.message)}</p><small>${e(project.error.code)} · 可調整左側需求後重新生成</small></div>`;
  } else if (['queued', 'running'].includes(project.status)) {
    $('#proposal').innerHTML = '<div class="empty-state"><div class="empty-art">✳</div><h2>让商品与故事，<br>准备好第一次相遇。</h2><p>完成後會交給你確認，過程可在上方查看。</p></div>';
  } else if (isItalianProject(project)) {
    $('#proposal').innerHTML = italianProposal(project, catalog, e);
  } else {
    $('#proposal').innerHTML = `<div class="panel"><div class="proposal-hero"><div class="art-wrap">${productArt(project.brief.productType, o.design.palette[0])}<small>程式繪製概念示意 · 非商品實拍</small></div><div><div class="eyebrow">${e(project.brief.country)} × ${e(project.brief.craft)}</div><h2>${e(o.design.title)}</h2><p>${e(o.design.tagline)}</p><div class="swatches">${o.design.palette.map(c => `<i style="background:${c}" title="${c}"></i>`).join('')}</div></div></div><div class="proposal-section"><h3>把故事變成產品</h3><p>${e(o.design.concept)}</p><p>材料提案：${o.design.materials.map(e).join('、')}</p></div><div class="proposal-section"><h3>文化有來處</h3><p>${e(o.culture.interpretation)}</p><ul>${o.culture.cautions.map(x => `<li>${e(x)}</li>`).join('')}</ul></div><div class="proposal-section"><h3>先算一筆小帳 <span class="tag">非實際報價</span></h3><div class="cost-grid"><div><span>單件示例成本</span><strong>¥${o.supply.costMin}–${o.supply.costMax}</strong></div><div><span>目標售價</span><strong>¥${o.supply.targetPrice}</strong></div><div><span>示例起訂量</span><strong>${o.supply.moq} 件</strong></div></div><p>示例交期 ${e(o.supply.leadDays)} 天。未扣除${o.supply.excluded.map(e).join('、')}；需向真實供應商確認。</p></div><div class="review-box"><p class="fine">和文化创作者、品牌及主播一起确认这份提案，再带着它开始询价或试讲。修改内容后，记得一起核对新版。</p><a href="#work" class="btn primary wide">一起完善这份提案 →</a></div><details class="edit-details"><summary>讓這份提案，更像你的故事</summary><form id="correction-form"><label>修改位置<select name="target"><option value="tagline">商品標語</option><option value="openingZh">中文主播開場</option></select></label><label>修改後內容<textarea name="replacement" maxlength="1500" rows="3" required></textarea></label><label>為什麼這樣改？<input name="reason" maxlength="500" required placeholder="例如：保留個人故事，避免代言整個國家的文化"></label><button class="btn" type="submit">保存修訂並重新確認</button></form></details></div>`;
  }
  renderLive();
  renderInsights();
  workspace.render();
}

function renderLive() {
  const ready = project?.status === 'demo_ready' && project?.business?.rightsValid && (!isItalianProject(project) || project.business.italia.canPresent) && project.business.sessions.some(s => s.contentRevision === project.revision && s.snapshot);
  $('#live-locked').hidden = ready;
  $('#live-content').hidden = !ready;
  if (!ready) { stopCamera(); return; }
  $('#stage-product-title').textContent = project.outputs.design.title;
  const host = project.business.sessions.findLast(s => s.contentRevision === project.revision).snapshot.host;
  $('#stage-session').textContent = `内容 v${project.revision} · 本机场次 ${project.business.sessions.at(-1).number}`;
  $('#stage').classList.toggle('stopped', stageStopped);
  $('#host-script').innerHTML = `<h4>中文開場 · 交給你自由發揮</h4><p>${e(host.openingZh)}</p><h4>ENGLISH OPENING</h4><p lang="en">${e(host.openingEn)}</p><h4>邀請觀眾加入</h4><ul>${host.questions.map(q => `<li>${e(q)}</li>`).join('')}</ul><h4>你的互動點子</h4><p>${e(host.interaction)}</p>`;
}

function renderInsights() {
  const available = project && ['awaiting_review', 'demo_ready'].includes(project.status);
  $('#insights-empty').hidden = !!available;
  $('#insights-content').hidden = !available;
  if (!available) return;
  const obs = project.observations;
  $('#insight-metrics').innerHTML = `<div class="metric"><span>觀察記錄</span><strong>${obs.length}</strong><small>次手動錄入，非受訪人數</small></div><div class="metric"><span>人工修訂</span><strong>${project.feedback.length}</strong><small>次修改，保留前後版本</small></div><div class="metric"><span>當前版本</span><strong>v${project.revision}</strong><small>${project.status === 'demo_ready' ? '已確認，可演示' : '修改後待重新確認'}</small></div>`;
  $('#insight-version').textContent = `內容 v${project.revision}`;
  const sessions = project.business?.sessions || [];
  $('#observation-session').innerHTML = sessions.length ? sessions.map(s => `<option value="${s.id}">试讲 ${s.number} / v${s.contentRevision}${s.state === 'closed' ? '（已关闭）' : ''}</option>`).join('') : '<option value="">先建立试讲场次</option>';
  $('#observation-form button').disabled = !sessions.some(s => s.state === 'open' && Date.parse(s.feedbackUntil) > Date.now()) || !project.business?.rightsValid;
  $('#observation-list').innerHTML = obs.length ? obs.slice(-6).reverse().map(x => `<div class="observation"><small>${x.channel === 'campus' ? '现场访谈' : '直播试讲'} · ${x.sessionId ? '场次 ' + e(x.sessionId.slice(0, 8)) : '旧版手动记录'} · v${x.revision} · ${decisions[x.decision]}${x.dimension ? ' · ' + e(catalog.feedbackDimensions[x.dimension]) + ' · ' + (x.experience === 'sample-experienced' ? '自述实物体验' : '仅图文讲述') : ''}</small><p>${e(x.note)}</p></div>`).join('') : '<p>還沒有觀察記錄。先邀請觀眾聽一段故事，再記下他們的原話。</p><p class="fine">先建立试讲场次；记录始终属于该场次版本。</p>';
  $('#revision-list').innerHTML = project.feedback.length ? project.feedback.slice(-6).reverse().map(x => `<div class="observation"><small>v${x.revision} · ${x.target === 'tagline' ? '商品標語' : '中文開場'}</small><p><del>${e(x.before)}</del></p><p>${e(x.after)}</p><p>修改原因：${e(x.reason)}</p></div>`).join('') : '<p class="fine">尚無修訂。在共創提案下方可修改標語或中文開場，保存後會重新進入確認環節。</p>';
}

async function pollProject(id) {
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    project = await api(`/api/projects/${id}`);
    renderProject();
    if (!['queued', 'running'].includes(project.status)) return;
    await new Promise(resolve => setTimeout(resolve, 450));
  }
  throw new Error('等待逾時，可刷新頁面重新讀取工作流狀態');
}

async function withButton(button, fn) {
  const previous = button.disabled;
  button.disabled = true;
  try { await fn(); } finally { if (button.isConnected) button.disabled = previous; }
}

function stopCamera() {
  if (camera) camera.getTracks().forEach(track => track.stop());
  camera = null;
  $('#camera-video').srcObject = null;
  $('#camera-video').hidden = true;
  $('#camera-button').textContent = '開啟本機鏡頭';
}

async function toggleCamera() {
  if (camera) return stopCamera();
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('目前瀏覽器不支援鏡頭，可使用無鏡頭舞台演示');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    if (location.hash !== '#live' || project?.status !== 'demo_ready' || stageStopped) { stream.getTracks().forEach(track => track.stop()); return; }
    camera = stream;
    $('#camera-video').srcObject = camera;
    $('#camera-video').hidden = false;
    $('#camera-button').textContent = '關閉本機鏡頭';
  } catch { throw new Error('未取得鏡頭權限或裝置不可用；仍可演示角色互動'); }
}

document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  try {
    if (button.dataset.start) { fillSeed(button.dataset.start); location.hash = 'studio'; }
    if (button.id === 'export-button' && project) {
      const response = await fetch(`/api/projects/${project.id}/export`);
      if (!response.ok) throw new Error('匯出失敗，請重新讀取提案');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = 'laiwu-concept.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (button.id === 'approve-button') await withButton(button, async () => { project = await api(`/api/projects/${project.id}/approve`, { acknowledged: $('#review-ack').checked }); renderProject(); toast('這一版已確認，可以上場了'); });
    if (button.id === 'camera-button') await withButton(button, toggleCamera);
    if (button.id === 'stop-stage') {
      stageStopped = true; stopCamera(); clearTimeout(effectTimer);
      $('#mascot').className = 'mascot'; $('#stage').className = 'stage stopped';
      document.querySelectorAll('[data-effect],#camera-button').forEach(b => { b.disabled = true; });
      $('#resume-stage').hidden = false;
      $('#stage-stop-note').hidden = false;
    }
    if (button.id === 'resume-stage') {
      stageStopped = false; $('#stage').className = 'stage';
      document.querySelectorAll('[data-effect],#camera-button').forEach(b => { b.disabled = false; });
      $('#resume-stage').hidden = true; $('#stage-stop-note').hidden = true;
    }
    if (button.dataset.effect) {
      const effect = button.dataset.effect;
      clearTimeout(effectTimer);
      $('#mascot').className = `mascot ${effect}`; $('#stage').className = `stage ${effect}`;
      $('#mascot-speech').textContent = ({ hello: '嗨！今天由你講故事，我來捧場。', story: '文化交流的第一步？先交流一下誰洗杯子。', spark: '一顆靈感星送給你！下一個家鄉故事是什麼？' })[effect];
      effectTimer = setTimeout(() => { $('#mascot').className = 'mascot'; $('#stage').className = 'stage'; }, 1900);
    }
    if (button.id === 'policy-button') await withButton(button, async () => { const result = await api('/api/presence/policy', { mode: $('#host-mode').value }); $('#policy-result').textContent = `${result.label}。${result.nextAction}。${result.evidence}。`; });
    if (button.id === 'challenge-button') await withButton(button, async () => {
      challenge = await api(`/api/projects/${project.id}/challenge`, {});
      $('#challenge-phrase').textContent = `${challenge.phrase}（60 秒內）`;
      $('#challenge-form').hidden = false; $('#challenge-answer').value = '';
      $('#challenge-result').textContent = '此互動只演示挑戰流程，不能用作真人認證。';
    });
    if (button.dataset.agent) {
      document.querySelectorAll('[data-agent]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
      const agent = catalog.agents.find(a => a.id === button.dataset.agent);
      $('#agent-detail').textContent = `${agent.description} ${agent.usesModel ? '演示時使用本地模板；可替換為模型 API。' : '由服務端規則執行，不需要大模型。'}`;
    }
  } catch (error) { toast(error.message); }
});

document.addEventListener('change', event => {
    if (event.target.id === 'seed-select') fillSeed(event.target.value);
  if (event.target.id === 'review-ack') $('#approve-button').disabled = !event.target.checked;
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  const button = form.querySelector('button[type="submit"]');
  try {
    if (form.id === 'brief-form') {
      if (busy) return;
      busy = true;
      stopCamera(); challenge = null; $('#challenge-form').hidden = true; $('#challenge-phrase').textContent = '';
      $('#policy-result').textContent = '規則依主持方式聲明運作，不分析音影片。';
      await withButton(button, async () => {
        project = await api('/api/projects', { ...values, targetRetailPrice: Number(values.budget) });
        try { localStorage.setItem('laiwu-project-id', project.id); } catch { /* Storage can be disabled by browser policy. */ }
        renderProject(); await pollProject(project.id);
      });
    }
    if (form.id === 'correction-form') await withButton(button, async () => { project = await api(`/api/projects/${project.id}/feedback`, { ...values, expectedVersion: project.business.version, contentRevision: project.revision }); renderProject(); toast('修订已保存，三方需重新签收；旧场次反馈仍归旧版'); });
    if (form.id === 'observation-form') await withButton(button, async () => { project = await api(`/api/projects/${project.id}/observations`, { ...values, requestId: crypto.randomUUID() }); renderInsights(); workspace.render(); form.reset(); toast('观察已保存到所选场次'); });
    if (form.id === 'challenge-form') await withButton(button, async () => { const result = await api(`/api/projects/${project.id}/verify`, { challengeId: challenge?.id, answer: $('#challenge-answer').value }); $('#challenge-result').textContent = result.message; $('#challenge-form').hidden = true; });
  } catch (error) { toast(error.message); } finally { if (form.id === 'brief-form') busy = false; }
});

window.addEventListener('hashchange', route);
window.addEventListener('pagehide', stopCamera);

// Refresh access while a presentation is visible so expiry or a withdrawal in another
// tab cannot leave a previously approved image or script on screen indefinitely.
let checkingPresentation = false;
const accessKey = p => JSON.stringify([p.status, p.revision, p.business.version, p.business.rightsValid, p.business.italia?.canPresent, p.business.sessions.map(s => [s.id, s.state, !!s.snapshot])]);
async function refreshPresentationAccess() {
  if (checkingPresentation || busy || !isItalianProject(project) || document.hidden || !['#live', '#work/audience'].includes(location.hash)) return;
  checkingPresentation = true;
  const id = project.id;
  try {
    const latest = await api(`/api/projects/${id}`);
    if (project?.id === id && accessKey(latest) !== accessKey(project)) { project = latest; renderProject(); }
  } catch {
    if (project?.id === id) {
      stopCamera(); project.business.italia.canPresent = false;
      project.business.sessions.forEach(s => { s.snapshot = null; });
      renderProject();
    }
  } finally { checkingPresentation = false; }
}
setInterval(refreshPresentationAccess, 3000);
window.addEventListener('focus', refreshPresentationAccess);

async function boot() {
  route();
  try {
    const [data, health] = await Promise.all([api('/api/catalog'), api('/api/health')]);
    catalog = { ...data, mode: health.mode };
    workspace.init(data);
    $('#mode-pill').textContent = health.mode === 'mock' ? '免密鑰演示' : '模型已配置';
    $('#provider-note').textContent = health.mode === 'mock' ? '演示模式使用本地模板，不發送模型請求。資料保存在本機。' : '真實模型模式：故事與創作需求會傳送至服務端配置的模型服務商。';
    $('#seed-select').innerHTML = data.seeds.map(seed => `<option value="${seed.id}">${e(seed.country)} · ${e(seed.productType)}</option>`).join('');
    $('#seed-grid').innerHTML = data.seeds.map(seed => `<article class="seed-card"><div class="seed-art seed-photo-${e(seed.id)}"><img class="seed-photo" src="${e(seed.photo)}" alt="${e(seed.photoAlt)}" loading="lazy" decoding="async"><span class="tag">${e(seed.en)}</span><small class="photo-caption">团队提供 · 商品参考实拍</small></div><div class="seed-body"><div class="eyebrow">${e(seed.original)} / ITALIA</div><h3>${e(seed.title)}</h3><p>${e(seed.subtitle)}</p><div class="seed-meta"><span>资料待核对 · 展示测试</span><button class="btn" data-start="${seed.id}">用这件商品开始 ↗</button></div></div></article>`).join('');
    $('#arch-agents').innerHTML = data.agents.map((agent, i) => `<button data-agent="${agent.id}" class="${i === 0 ? 'selected' : ''}" aria-pressed="${i === 0}">${e(agent.name)}<small>${e(agent.role)}</small></button>`).join('');
    $('#agent-detail').textContent = data.agents[0].description;
    fillSeed('pistachio'); renderSteps();
    let lastId;
    try { lastId = localStorage.getItem('laiwu-project-id'); } catch { /* Optional convenience. */ }
    if (lastId && /^[a-f0-9-]{36}$/.test(lastId)) {
      try {
        project = await api(`/api/projects/${lastId}`);
        if (!isItalianProject(project)) { project = null; toast('旧提案仍保存在本机。这一轮从 Italia 原商品开始。'); return; }
        for (const [key, value] of Object.entries(project.brief)) if ($('#brief-form').elements[key]) $('#brief-form').elements[key].value = value;
        renderProject();
        if (['queued', 'running'].includes(project.status)) { busy = true; $('#generate-button').disabled = true; try { await pollProject(lastId); } finally { busy = false; $('#generate-button').disabled = false; } }
      } catch (error) { toast(error.message); }
    }
  } catch { $('#mode-pill').textContent = '服務未連接'; toast('無法連接本機服務。請啟動 Node 服務後重新整理。'); }
}
boot();

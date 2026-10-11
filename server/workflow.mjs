import { randomUUID } from 'node:crypto';
import { agentDefinitions, pricing } from './data.mjs';
import { AppError, validateBrief } from './contracts.mjs';
import { ensureBusiness, invalidateBusiness, recordSessionObservation } from './business.mjs';

export const DEFAULT_STEP_DELAY_MS = 2000;

export function createProject(input, mode) {
  return { id: randomUUID(), brief: validateBrief(input), mode, status: 'queued', revision: 1, feedback: [], observations: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), outputs: {}, trace: agentDefinitions.map(a => ({ id: a.id, name: a.name, status: 'pending', source: a.usesModel ? mode : 'rules' })), approval: null, error: null };
}

export function estimateSupply(brief) {
  const p = pricing[brief.productType];
  return { costMin: p.min, costMax: p.max, moq: p.moq, leadDays: p.days, targetPrice: brief.targetRetailPrice ?? brief.budget, label: '規則估算示例，非供應商報價', excluded: ['物流', '稅費', '退貨', '渠道抽成', '文化授權費', '打樣與檢測費'], nextSteps: ['準備尺寸、材料與工藝圖稿', '向實際供應商詢價並索取樣品', '確認品質、必要檢測與授權後再定價'] };
}

export async function runWorkflow(project, provider, { delayMs = DEFAULT_STEP_DELAY_MS, onProgress = () => {} } = {}) {
  project.status = 'running';
  for (const definition of agentDefinitions) {
    const step = project.trace.find(s => s.id === definition.id);
    step.status = 'running';
    step.startedAt = new Date().toISOString();
    const started = performance.now();
    project.updatedAt = step.startedAt;
    onProgress();
    try {
      if (definition.usesModel) {
        // Each step sees only the dependencies it actually needs.
        const context = definition.id === 'design' ? { culture: project.outputs.culture } : definition.id === 'host' ? { culture: project.outputs.culture, design: project.outputs.design } : {};
        const result = await provider.generate(definition.id, project.brief, context);
        project.outputs[definition.id] = result.data;
        step.usage = result.usage;
      } else if (definition.id === 'supply') project.outputs.supply = estimateSupply(project.brief);
      else project.outputs.review = { requiresHuman: true, provenance: '使用者故事／未完成外部事實核查', rights: '待確認圖稿、故事與文化元素的使用權', cost: '示例估算，尚未詢價', checks: ['故事不等於非遺認證', '創作者確認來源與使用權', '真人主持；AI 特效明示', '此版本不支援交易與公開發布'] };
      step.processingMs = Math.round(performance.now() - started);
      // Mock content is immediate; leave time to read each step without claiming model work.
      if (provider.mode === 'mock') {
        const remaining = delayMs - (performance.now() - started);
        if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.ceil(remaining)));
      }
      step.status = 'completed';
      step.completedAt = new Date().toISOString();
      step.durationMs = Math.round(performance.now() - started);
      project.updatedAt = step.completedAt;
    } catch (error) {
      step.status = 'failed';
      step.failedAt = new Date().toISOString();
      step.durationMs = Math.round(performance.now() - started);
      project.status = 'failed';
      project.error = { code: error instanceof AppError ? error.code : 'WORKFLOW_FAILED', message: error instanceof AppError ? error.message : '工作流失敗，請重試' };
      project.updatedAt = step.failedAt;
      onProgress();
      return;
    }
    onProgress();
  }
  project.status = 'awaiting_review';
  project.updatedAt = new Date().toISOString();
}

export function approveProject(project, input) {
  if (project.business) throw new AppError('SCOPED_REVIEW_REQUIRED', '请在合作工作台分别确认文化、品牌与双语讲稿，再建立场次', 409);
  if (project.status === 'demo_ready') return project;
  if (project.status !== 'awaiting_review') throw new AppError('REVIEW_NOT_READY', '請先完成共創工作流', 409);
  if (input?.acknowledged !== true) throw new AppError('REVIEW_REQUIRED', '請閱讀並確認演示稿的來源與權利狀態', 422);
  project.approval = { acknowledged: true, owner: project.brief.owner, revision: project.revision, at: new Date().toISOString(), scope: 'local-demo-only' };
  project.status = 'demo_ready';
  project.updatedAt = project.approval.at;
  return project;
}

export function exportProject(project) {
  const o = project.outputs;
  const b = ensureBusiness(project);
  return [
    `# ${o.design?.title || '來物共創草稿'}`,
    `狀態：${project.status}；內容模式：${project.mode}；版本：${project.revision}。此文件是概念草稿，不是商品認證或商業承諾。`,
    '## 原始需求', project.brief.story, `文化來源：${project.brief.country}；在地工藝：${project.brief.craft}；目標人群：${project.brief.audience}`,
    '## 文化整理', o.culture?.interpretation || '尚未完成', ...(o.culture?.cautions || []).map(x => `- ${x}`),
    '## 商品概念', o.design?.tagline || '', o.design?.concept || '', `材料：${o.design?.materials?.join('、') || '待確認'}`,
    '## 供應鏈估算（示例）', o.supply ? `單件成本 ¥${o.supply.costMin}–${o.supply.costMax}；目標售價 ¥${o.supply.targetPrice}；示例起訂量 ${o.supply.moq}；不含${o.supply.excluded.join('、')}。需真實詢價。` : '尚未完成',
    '## 真人主播腳本', o.host?.openingZh || '', o.host?.openingEn || '', ...(o.host?.questions || []).map(x => `- ${x}`),
    '## 待確認', ...(o.review?.checks || []).map(x => `- ${x}`),
    '## 修改記錄', ...project.feedback.map(x => `- v${x.revision} ${x.target}：${x.before} → ${x.after}；原因：${x.reason}；時間：${x.at}`),
    '## 測款觀察（手動錄入，不代表獨立受訪人數或真實訂單）', ...project.observations.map(x => `- ${x.channel} / ${x.decision} / ${x.note}`),
    '## 业务交付记录（本地流程演示）',
    `路径：${b.route}；品牌来源：${b.profile.brandOrigin}；生产地：${b.profile.productionPlace}；发货地：${b.profile.shippingPlace}；销售主体：${b.profile.seller}；进口主体：${b.profile.importer}`,
    `素材范围：${b.rights.state}；本地展示：${b.rights.display}；打样演练：${b.rights.sample}；量产与销售授权：未开放；署名：${b.rights.credit || '待确认'}；依据：${b.rights.evidence || '待提交'}`,
    ...b.confirmations.map(c => `- ${c.actor} / ${c.scope} / v${c.contentRevision} / ${c.invalidatedAt ? '已失效' : '本地演示签收'} / ${c.at}`),
    '## 询价规格与示例回复', b.spec ? JSON.stringify(b.spec, null, 2) : '尚未冻结询价规格', ...b.quotes.map(q => JSON.stringify(q)),
    '## 样品演练', b.sample ? JSON.stringify(b.sample, null, 2) : '尚无样品送验记录',
    '## 场次与反馈版本', ...b.sessions.map(s => `- 场次 ${s.number} / ${s.id} / v${s.contentRevision} / ${s.state} / 反馈截止 ${s.feedbackUntil}`),
    ...project.observations.filter(o => o.sessionId).map(o => `- ${o.sessionId} / v${o.contentRevision} / ${o.useCase} / ${o.note}`),
    '## 品牌下一轮决定', ...b.decisions.map(d => `- ${d.decision} / ${d.reason} / 依据场次 ${d.sessionId}`),
    '## 交接日志', ...b.audit.map(a => `- ${a.at} / ${a.message}`),
    '## 共創時間記錄', '時間為服務端實際記錄（ISO 8601 / UTC）；演示模式耗時包含閱讀停留，不代表模型推理耗時。', ...project.trace.map(x => `- ${x.name}: ${x.status}; 開始=${x.startedAt || '未開始'}; 完成=${x.completedAt || '未記錄'}; 中止=${x.failedAt || '無'}; 耗時=${x.durationMs ?? '-'}ms; source=${x.source}`)
  ].join('\n\n');
}

export function recordCorrection(project, input) {
  if (!['awaiting_review', 'demo_ready'].includes(project.status)) throw new AppError('REVIEW_NOT_READY', '工作流完成後才能修改', 409);
  const targets = { tagline: ['design', 'tagline'], openingZh: ['host', 'openingZh'] };
  const target = Object.hasOwn(targets, input?.target) ? targets[input.target] : null;
  if (!target) throw new AppError('INVALID_INPUT', '請選擇商品標語或中文開場');
  for (const key of ['replacement', 'reason']) if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 1500) throw new AppError('INVALID_INPUT', '修改內容與原因需填寫，且不超過 1500 字');
  if (project.feedback.length >= 100) throw new AppError('LIMIT', '本項目最多保留 100 次修改', 409);
  const [section, key] = target;
  const before = project.outputs[section][key];
  project.outputs[section][key] = input.replacement.trim();
  project.revision++;
  project.feedback.push({ id: randomUUID(), target: input.target, before, after: input.replacement.trim(), reason: input.reason.trim(), owner: project.brief.owner, revision: project.revision, at: new Date().toISOString() });
  project.approval = null;
  project.status = 'awaiting_review';
  project.updatedAt = new Date().toISOString();
  if (project.business) invalidateBusiness(project, '提案内容修改，需重新核对');
  return project;
}

export function recordObservation(project, input) {
  if (input.sessionId) return recordSessionObservation(project, input);
  if (project.business) throw new AppError('SESSION_REQUIRED', '请先选择试讲场次，反馈会绑定该场次版本', 422);
  if (project.status !== 'demo_ready') throw new AppError('REVIEW_REQUIRED', '請先確認目前版本', 409);
  if (!['campus', 'live'].includes(input?.channel) || !['interested', 'price_high', 'unclear'].includes(input?.decision)) throw new AppError('INVALID_INPUT', '未知測款渠道或反饋類型');
  if (typeof input.note !== 'string' || !input.note.trim() || input.note.length > 500) throw new AppError('INVALID_INPUT', '請填寫不超過 500 字的觀察記錄');
  if (project.observations.length >= 200) throw new AppError('LIMIT', '演示項目最多保留 200 條觀察', 409);
  project.observations.push({ id: randomUUID(), channel: input.channel, decision: input.decision, note: input.note.trim(), revision: project.revision, at: new Date().toISOString(), source: 'manual-demo-entry' });
  project.updatedAt = new Date().toISOString();
  return project;
}

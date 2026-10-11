const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], actions = [];
  page.on('pageerror', e => errors.push(e.message)); mkdirSync('artifacts', { recursive: true });
  const shot = name => page.screenshot({ path: `artifacts/italia-${name}.png`, fullPage: true });
  const role = id => page.locator(`[data-it-role=${id}]`).click();
  const view = id => page.locator(`[data-it-tab=${id}]`).click();
  async function go(hash) { await page.evaluate(hash => { location.hash = hash; }, hash); await page.locator(`#page-${hash.split('/')[0]}`).waitFor({ state: 'visible' }); }
  async function mutate(click, endpoint = 'business', status = 200) {
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/' + endpoint) && r.request().method() === 'POST');
    await click(); const response = await responsePromise; const json = await response.json();
    assert.equal(response.status(), status, JSON.stringify(json));
    await page.waitForFunction(() => !document.querySelector('#work-root').hasAttribute('aria-busy'));
    if (status === 200) actions.push({ endpoint, revision: json.revision, version: json.business.version, action: json.business.audit.at(-1)?.action });
    return json;
  }
  const submit = (action, status) => mutate(() => page.locator(`[data-it-action=${action}] button[type=submit]`).click(), 'business', status);
  const sign = async id => { await role(id); await page.locator('[data-it-action=confirm] [name=acknowledged]').check(); return submit('confirm'); };
  async function languageReview() {
    await role('culture'); const form = page.locator('[data-it-action=translationReview]');
    await form.locator('[name=capable]').check(); await form.locator('[name=acknowledged]').check(); await form.locator('[name=note]').fill('测试记录：依据演示原文核对，未代表真实品牌译审。'); await submit('translationReview');
  }
  async function approval() {
    await role('reviewer'); const form = page.locator('[data-it-action=releaseReview]');
    for (const key of ['rightsChecked', 'factsChecked', 'peopleChecked', 'aiChecked']) await form.locator(`[name=${key}]`).check();
    await form.locator('[name=note]').fill('测试用确认：限定当前版本、本地预览、测试用途与有效期。'); return submit('releaseReview');
  }
  try {
    await page.goto('http://127.0.0.1:3100/#discover'); await page.getByText('免密鑰演示', { exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.seed-photo')].length === 4 && [...document.querySelectorAll('.seed-photo')].every(x => x.complete && x.naturalWidth));
    assert.deepEqual(await page.locator('.seed-photo').evaluateAll(xs => xs.map(x => x.getAttribute('src'))), ['/images/italia-pistachio.jpg', '/images/italia-chocolate.jpg', '/images/italia-perfume.jpg', '/images/italia-coffee.jpg']);
    await shot('home'); await go('work'); await page.getByText('Your product.', { exact: false }).waitFor(); await shot('brand-intro');
    await go('studio'); await page.locator('#seed-select').selectOption('pistachio'); await page.locator('#generate-button').click();
    for (const id of ['culture', 'design', 'supply', 'host', 'review']) { await page.locator(`[data-step=${id}].running`).waitFor(); }
    await page.getByText('等待創作者確認', { exact: true }).waitFor();
    const id = await page.evaluate(() => localStorage.getItem('laiwu-project-id'));
    let state = await (await page.request.get(`http://127.0.0.1:3100/api/projects/${id}`)).json();
    assert.ok(state.trace.every(s => s.durationMs >= 1999)); assert.equal(state.outputs.supply.moq, null);
    await shot('proposal'); await go('work'); await role('reviewer');
    await page.locator('[data-it-action=releaseReview] [name=note]').fill('测试：资料未齐时尝试确认');
    const blocked = await submit('releaseReview', 422); assert.equal(blocked.error.code, 'REVIEW_INCOMPLETE');
    await role('brand'); await page.locator('[data-it-language]').click(); await page.getByText('Save product dossier →', { exact: true }).waitFor();
    const fields = { brand: 'Demo Italian brand · not a partner endorsement', region: 'Specific Italian region to verify in a real pilot', origin: 'Italy · demo record, not a certificate', specification: 'Demo reference jar; actual specification requires source label', ingredients: 'Demo ingredient information; actual ingredients and allergens require source labels', evidence: 'Automated UI test only. No real authorization, import or sales evidence.', assetAuthor: 'Team-supplied reference photograph', italianOriginal: 'Pesto con Pistacchio del Mediterraneo · testo di esempio', englishSummary: 'Reference presentation for an original product. This is a research demo.', chineseStory: '从包装与日常餐桌场景开始，了解深圳消费者的看法。此条为测试用展示资料，不代表真实商品核验。' };
    for (const [key, value] of Object.entries(fields)) await page.locator(`[data-it-action=dossier] [name=${key}]`).fill(value);
    await submit('dossier'); await shot('brand-en');
    await role('culture'); await page.locator('[data-it-action=rights]').first().locator('[name=credit]').fill('团队参考图片 · 测试用登记');
    await page.locator('[data-it-action=rights]').first().locator('[name=evidence]').fill('仅用于本地流程自动测试，不构成品牌授权。');
    await page.locator('[data-it-action=rights]').first().locator('[name=display]').check();
    await mutate(() => page.locator('[data-it-action=rights]').first().locator('button[type=submit]').click());
    await sign('culture'); await languageReview(); await shot('source-review'); await sign('brand'); await sign('host');
    await approval(); await shot('approval'); await role('host'); state = await mutate(() => page.locator('button[data-it-action=session]').click());
    const firstSession = state.business.sessions.at(-1); await shot('host'); await go('live'); await page.locator('#live-content').waitFor({ state: 'visible' });
    await page.locator('[data-effect=story]').click(); await page.locator('#stop-stage').click(); assert.equal(await page.locator('#camera-button').isDisabled(), true); await page.locator('#resume-stage').click(); await shot('stage');
    await go('work/audience');
    for (const dimension of ['packaging', 'story', 'sensory', 'price']) {
      await page.locator('#italian-feedback [name=dimension]').selectOption(dimension);
      await page.locator('#italian-feedback [name=note]').fill(`测试反馈 ${dimension}：仅看过图片，希望进一步了解。`);
      state = await mutate(() => page.locator('#italian-feedback button[type=submit]').click(), 'observations');
    }
    assert.equal(state.observations.length, 4); await shot('audience');
    await role('brand'); await view('delivery'); await shot('report');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#it-export').click()]); await download.saveAs('artifacts/italia-test-pack.md');
    await page.reload(); await page.getByText('免密鑰演示', { exact: true }).waitFor(); await page.locator('.pilot-report').waitFor();
    await go('studio'); await page.locator('.edit-details summary').click(); await page.locator('#correction-form [name=replacement]').fill('开心果酱的第一轮深圳展示'); await page.locator('#correction-form [name=reason]').fill('测试：更新展示文案后须重新确认。');
    state = await mutate(() => page.locator('#correction-form button[type=submit]').click(), 'feedback');
    assert.equal(state.business.italia.canPresent, false); await go('live'); await page.locator('#live-locked').waitFor({ state: 'visible' });
    await go('work/audience'); await page.locator('#italian-feedback [name=note]').fill('旧场次的补充看图反馈'); state = await mutate(() => page.locator('#italian-feedback button[type=submit]').click(), 'observations');
    assert.equal(state.observations.at(-1).contentRevision, firstSession.contentRevision);
    await sign('culture'); await languageReview(); await sign('brand'); await sign('host'); await approval(); await role('host'); state = await mutate(() => page.locator('button[data-it-action=session]').click());
    const secondSession = state.business.sessions.at(-1);
    const watcher = await browser.newPage();
    watcher.on('pageerror', e => errors.push(e.message));
    await watcher.addInitScript(id => localStorage.setItem('laiwu-project-id', id), state.id);
    await watcher.goto('http://127.0.0.1:3100/#live');
    await watcher.locator('#live-content').waitFor({ state: 'visible' });
    await page.locator('details:has([data-it-action=incident]) summary').click(); await page.locator('[data-it-action=incident] [name=sessionId]').selectOption(secondSession.id); await page.locator('[data-it-action=incident] [name=note]').fill('测试：讲稿中的规格需再次核对，暂停展示。'); state = await submit('incident');
    assert.ok(state.business.sessions.every(s => s.snapshot === null)); await go('live'); await page.locator('#live-locked').waitFor({ state: 'visible' }); await go('work/audience'); await page.getByText('这个故事还在准备中。', { exact: true }).waitFor();
    await watcher.locator('#live-locked').waitFor({ state: 'visible', timeout: 12000 }); await watcher.close();
    await role('reviewer'); await page.locator('[data-it-action=resolveIncident] [name=note]').fill('测试：原始规格已重新核对；旧场次不恢复。'); await submit('resolveIncident');
    await sign('culture'); await languageReview(); await sign('brand'); await sign('host'); await approval(); await role('host'); state = await mutate(() => page.locator('button[data-it-action=session]').click());
    assert.equal(state.business.sessions[0].snapshot, null); assert.ok(state.business.sessions.at(-1).snapshot);
    await go('work/audience');
    await page.locator('#it-session').selectOption(state.business.sessions.at(-1).id);
    await page.locator('#italian-feedback').waitFor();
    await page.locator('#it-session').selectOption(firstSession.id);
    await page.getByText('这个故事还在准备中。', { exact: true }).waitFor();
    await page.locator('#it-session').selectOption(state.business.sessions.at(-1).id);
    await page.locator('#italian-feedback').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const hash of ['discover', 'studio', 'live', 'insights', 'architecture']) { await go(hash); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, hash); assert.doesNotMatch(await page.locator('body').innerText(), /负责人|負責人|责任人|責任人/); await shot(`mobile-${hash}`); }
    await go('work'); for (const r of ['brand', 'culture', 'host', 'reviewer', 'audience']) { await role(r); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, r); await shot(`mobile-${r}`); }
    assert.deepEqual(errors, []);
    writeFileSync('artifacts/italia-validation.json', JSON.stringify({ checkedAt: new Date().toISOString(), projectId: state.id, actions, result: 'PASS', pageErrors: errors, viewports: [1440, 390] }, null, 2));
    console.log('PASS: four photos, paced workflow, EN dossier, source review, blocked release, versioned approvals, stage, 4D feedback, export, reload, revision, old-session feedback, pause/correct/reapprove, mobile.');
  } catch (error) { await shot('failure'); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

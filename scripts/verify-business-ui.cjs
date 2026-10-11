const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], evidence = [];
  page.on('pageerror', error => errors.push(error.message));
  mkdirSync('artifacts', { recursive: true });
  const shot = name => page.screenshot({ path: resolve('artifacts', name), fullPage: true });
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${page.url()}`);
  async function go(route) { await page.evaluate(hash => { location.hash = hash; }, route); await page.locator(`#page-${route.split('/')[0]}`).waitFor({ state: 'visible' }); }
  const role = id => page.locator(`.role-switch [data-wrole="${id}"]`).click();
  const tab = id => page.locator(`.work-sidebar [data-wtab="${id}"]`).click();
  async function action(click, endpoint = 'business') {
    const pending = page.waitForResponse(r => r.url().endsWith('/' + endpoint) && r.request().method() === 'POST');
    await click(); const response = await pending;
    const result = await response.json(); assert.equal(response.status(), 200, JSON.stringify(result));
    await page.waitForFunction(() => !document.querySelector('#work-root').hasAttribute('aria-busy'));
    evidence.push({ endpoint, action: result.business.audit.at(-1)?.action, revision: result.revision, version: result.business.version });
    return result;
  }
  const submit = (form, endpoint) => action(() => page.locator(`${form} button[type=submit]`).click(), endpoint);
  async function sign(id) { await role(id); await page.locator('[data-business=confirm] input[type=checkbox]').check(); return submit('[data-business=confirm]'); }
  try {
    await page.goto('http://127.0.0.1:3100');
    await page.getByText('免密鑰演示', { exact: true }).waitFor();
    await page.locator('#seed-grid').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.seed-photo')].length === 3 && [...document.querySelectorAll('.seed-photo')].every(img => img.complete && img.naturalWidth > 0));
    assert.deepEqual(await page.locator('.seed-photo').evaluateAll(images => images.map(img => img.getAttribute('src'))), ['/images/mediterranean.jpg', '/images/north-africa.jpg', '/images/latin-america.jpg']);
    await page.locator('#seed-grid').screenshot({ path: resolve('artifacts', 'homepage-reference-photos.png') });
    await shot('desktop-home.png');
    await go('studio'); await page.locator('#seed-select').selectOption('morocco'); await page.locator('#generate-button').click();
    await page.getByText('等待創作者確認', { exact: true }).waitFor();
    await go('work'); await role('culture');
    await page.locator('[name=credit]').fill('Amina · 虚构文化故事与原创示意图');
    await page.locator('[name=evidence]').fill('牛客松演示素材，仅用于本机展示与样品流程演练，无真实商业授权。');
    await page.locator('[name=display]').check(); await page.locator('[name=sample]').check(); await submit('[data-business=rights]');
    await sign('culture'); await shot('desktop-rights.png'); await sign('brand'); await shot('desktop-brand-workspace.png');
    await tab('sourcing'); await submit('[data-business=spec]'); await role('supplier');
    await page.locator('[name=unitCents]').fill('28'); let state = await submit('#quote-form');
    assert.equal(state.business.quotes.at(-1).comparison.totalCents, null);
    await page.getByText(/不能比较总价/).waitFor(); await page.locator('#fill-quote-example').click(); state = await submit('#quote-form');
    assert.equal(state.business.quotes.at(-1).comparison.totalCents, 311000); await shot('desktop-supplier.png');
    await role('brand'); await tab('sourcing');
    for (const [stateName, note] of [['pending_acceptance', '演示样品送验'], ['rework', '印花偏移超出公差，需要返工'], ['pending_acceptance', '返工后重新送验'], ['accepted', '演练中逐项核对尺寸、材料、印花与包装']]) {
      const form = page.locator('[data-business=sample]');
      await form.locator('[name=state]').selectOption(stateName); await form.locator('[name=evidence]').fill(note);
      if (stateName === 'accepted') await form.locator('[name=checked]').check(); await submit('[data-business=sample]');
    }
    await sign('host'); state = await action(() => page.locator('[data-business-action=session]').click());
    const firstSession = state.business.sessions.at(-1); await shot('desktop-host-workspace.png');
    await go('live'); await page.locator('[data-effect=story]').click();
    assert.match(await page.locator('#mascot-speech').textContent(), /誰洗杯子/);
    await page.locator('#camera-button').click(); await page.getByText('未取得鏡頭權限或裝置不可用；仍可演示角色互動').waitFor();
    await page.route('**/api/**', route => route.abort()); await page.locator('#stop-stage').click();
    assert.equal(await page.locator('#stage').evaluate(node => node.classList.contains('stopped')), true);
    assert.equal(await page.locator('#camera-button').isDisabled(), true);
    await page.unroute('**/api/**'); await page.locator('#resume-stage').click(); await shot('desktop-live-v02.png');
    await go('work/audience'); await page.locator('#audience-feedback [name=note]').fill('演示反馈：希望知道图案来源，也想摸一摸帆布的质感。');
    await submit('#audience-feedback', 'observations'); await shot('desktop-audience.png');
    await go('studio'); await page.locator('.edit-details summary').click();
    await page.locator('#correction-form [name=target]').selectOption('openingZh');
    await page.locator('#correction-form [name=replacement]').fill('这是我的个人故事，图案来自原创蓝色线条；目前是概念演示，还没有生产商品。');
    await page.locator('#correction-form [name=reason]').fill('回应观众关于来源和材质的问题。');
    state = await submit('#correction-form', 'feedback'); assert.equal(state.business.translation, 'pending');
    await go('live'); await page.locator('#live-locked').waitFor({ state: 'visible' }); await go('work/audience');
    await page.locator('#audience-feedback [name=note]').fill('旧场次后补意见：适合送给朋友。');
    state = await submit('#audience-feedback', 'observations');
    assert.equal(state.observations.at(-1).contentRevision, firstSession.contentRevision);
    assert.notEqual(state.observations.at(-1).contentRevision, state.revision);
    await sign('culture'); await sign('brand'); await sign('host'); await action(() => page.locator('[data-business-action=session]').click());
    await role('brand'); await tab('delivery');
    await page.locator('[data-business=decision] [name=decision]').selectOption('revise');
    await page.locator('[data-business=decision] [name=reason]').fill('先补充面料实物与图案来源展示，再邀请下一批体验者。'); await submit('[data-business=decision]');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#work-export').click()]);
    await download.saveAs(resolve('artifacts', 'exported-business-demo.md')); await shot('desktop-delivery.png');
    await page.reload(); await page.getByText('免密鑰演示', { exact: true }).waitFor();
    await tab('delivery'); await page.getByText('先补充面料实物与图案来源展示，再邀请下一批体验者。', { exact: true }).waitFor();
    await go('insights'); await page.locator('#observation-list').getByText('旧场次后补意见：适合送给朋友。', { exact: true }).waitFor(); await shot('desktop-insights-v02.png');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const hash of ['discover', 'studio', 'live', 'insights', 'architecture']) { await go(hash); await noOverflow(); await shot(`mobile-${hash}-v02.png`); }
    await go('work');
    for (const id of ['brand', 'culture', 'supplier', 'host', 'audience']) { await role(id); await noOverflow(); await shot(`mobile-work-${id}.png`); }
    await role('brand'); for (const id of ['rights', 'sourcing', 'script', 'delivery']) { await tab(id); await noOverflow(); }
    assert.deepEqual(errors, []);
    writeFileSync(resolve('artifacts', 'business-browser-validation.json'), JSON.stringify({ checkedAt: new Date().toISOString(), projectId: state.id, actions: evidence, pageErrors: errors, result: 'PASS', viewports: [1440, 390] }, null, 2));
    console.log('PASS: role handoffs, incomplete/complete quote, sample rework, bilingual review, camera failure, offline local stop, old-version feedback, decisions, reload, export, mobile without overflow or JS errors.');
  } catch (error) { await shot('browser-failure.png'); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

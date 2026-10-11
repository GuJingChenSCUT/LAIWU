const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { resolve } = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto('http://127.0.0.1:3100');
    await page.getByText('免密鑰演示', { exact: true }).waitFor();
    await page.screenshot({ path: resolve('artifacts/desktop-home.png'), fullPage: true });
    await page.locator('.hero-art').screenshot({ path: resolve('artifacts/hero-detail.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: resolve('artifacts/mobile-discover.png'), fullPage: true });
    await page.locator('.hero-art').screenshot({ path: resolve('artifacts/mobile-hero-detail.png') });
    console.log('Preview captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

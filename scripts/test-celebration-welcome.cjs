// Run against a local production server. Holiday settings and analytics are mocked.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.CELEBRATION_TEST_URL || 'http://localhost:3100';
const titles = {
  kz: 'Республика күні құтты болсын!', ru: 'С Днём Республики Казахстан!',
  tr: 'Kazakistan Cumhuriyet Günü kutlu olsun!', en: 'Happy Republic Day, Kazakhstan!',
};

(async () => {
  const browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {})});
  try {
    for (const [language, title] of Object.entries(titles)) {
      for (const width of [360, 1280]) {
        const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: width === 360 ? 'reduce' : 'no-preference'});
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let activeId = 'republic-day';
        await page.route('**/api/celebrations', route => route.fulfill({json: {activeId, revision: 1}}));
        await page.route('**/api/analytics/**', route => route.fulfill({json: {ok: true}}));
        await page.addInitScript(lang => localStorage.setItem('hl_lang', lang), language);
        await page.goto(base);
        const dialog = page.getByRole('dialog', {name: title});
        await dialog.waitFor();
        await page.locator('dialog img').evaluate(image => image.decode());
        await page.waitForFunction(() => getComputedStyle(document.querySelector('dialog')).opacity === '1');
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        assert.ok(await dialog.evaluate(element => element.scrollWidth <= innerWidth));
        if (width === 360) assert.equal(await dialog.evaluate(element => getComputedStyle(element).animationName), 'none');
        await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(() => document.activeElement.closest('dialog') !== null));
        if (language === 'kz') await page.screenshot({path: path.join(__dirname, `../tmp/celebration-welcome-${width}.png`)});
        // Different closing controls, including the entire backdrop.
        if (language === 'kz') await dialog.getByRole('button', {name: 'Сайтқа өту'}).click();
        else if (language === 'ru') await page.keyboard.press('Escape');
        else if (language === 'tr') await dialog.getByRole('button', {name: 'Kapat', exact: true}).click();
        else await dialog.click({position: {x: 8, y: 100}});
        await dialog.waitFor({state: 'hidden'});
        await page.waitForFunction(() => document.body.style.overflow !== 'hidden');
        // Existing strip and hero card survive the fullscreen dismissal.
        assert.equal(await page.getByText(title, {exact: true}).filter({visible: true}).count(), 2);
        await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/celebrations')), page.reload()]);
        assert.equal(await page.getByRole('dialog').count(), 0);
        activeId = null;
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await page.getByText(title, {exact: true}).first().waitFor({state: 'hidden'});
        assert.deepEqual(errors, []);
        await context.close();
      }
    }
    // Disabled holidays and internal/non-home pages never open the greeting.
    for (const routePath of ['/', '/contact', '/login']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.route('**/api/celebrations', route => route.fulfill({json: {activeId: routePath === '/' ? null : 'republic-day', revision: 0}}));
      await page.route('**/api/analytics/**', route => route.fulfill({json: {ok: true}}));
      await page.goto(base + routePath);
      await page.getByRole('banner').waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0);
      await context.close();
    }
    console.log('PASS: desktop/mobile in four languages; image loads; focus containment; reduced motion; button/X/Escape/backdrop dismissal; scroll restored; session once; passive/internal/non-home exclusions.');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});

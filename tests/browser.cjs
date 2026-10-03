// Optional browser integration checks: install playwright, then set MORROW_BROWSER
// to a Chrome/Edge executable. Run with the preview server running on port 4317.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const results = path.join(root, '.test-results');
fs.mkdirSync(results, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MORROW_BROWSER || undefined });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4317/options.html');
    const colors = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext('2d'); const results = [];
      for (const color of ['#dd5511', '#1155dd']) {
        ctx.fillStyle = color; ctx.fillRect(0, 0, 32, 32);
        results.push(await MorrowWallpaper.colorForImage(canvas.toDataURL()));
      }
      return results;
    });
    assert.notEqual(colors[0], colors[1], 'Different wallpaper hues must produce different navigation colors');
    await page.getByRole('button', { name: 'Forest theme', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('morrow-preview')).theme === 'forest');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-theme="forest"]').getAttribute('aria-pressed') === 'true');
    await page.locator('[data-setting="hideMembers"]').check();
    assert.equal(await page.locator('.preview-members').isVisible(), false);
    await page.locator('[data-setting="compact"]').check();
    await page.locator('#wallpaper-file').setInputFiles(path.join(root, 'icons/icon-128.png'));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('morrow-preview')).wallpaper?.startsWith('data:image/webp;base64,'));
    await page.waitForFunction(() => !document.getElementById('upload-wallpaper').disabled);
    await page.locator('#wallpaper-dim').fill('35');
    await page.locator('#wallpaper-dim').dispatchEvent('change');
    await page.locator('#wallpaper-blur').fill('4');
    await page.locator('#wallpaper-blur').dispatchEvent('change');
    assert.equal(await page.locator('#wallpaperDim-value').textContent(), '35%');
    assert.equal(await page.locator('#wallpaperBlur-value').textContent(), '4 px');
    assert.ok(await page.locator('#discord-preview').evaluate(el => getComputedStyle(el, '::before').backgroundImage.includes('data:image/webp')));
    for (const selector of ['.preview-servers', '.preview-channels', '.preview-members', '.chat-header']) {
      assert.notEqual(await page.locator(selector).evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    }
    await page.locator('#appearance').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(results, 'wallpaper-studio.png'), fullPage: true });
    await page.locator('[data-setting="wallpaperEnabled"]').uncheck();
    assert.equal(await page.locator('#discord-preview').evaluate(el => el.classList.contains('has-wallpaper')), false);
    await page.locator('[data-setting="wallpaperEnabled"]').check();
    await page.locator('#wallpaper-file').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not a real image') });
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('could not be opened'));
    assert.equal(await page.locator('#discord-preview').evaluate(el => el.classList.contains('has-wallpaper')), true);
    await page.locator('#custom-css').fill('body { letter-spacing: 1px; }');
    await page.locator('#save-css').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('morrow-preview')).customCss === 'body { letter-spacing: 1px; }');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-settings').click();
    const download = await downloadPromise;
    const exportPath = path.join(results, 'settings.json');
    await download.saveAs(exportPath);
    const exported = JSON.parse(fs.readFileSync(exportPath));
    assert.equal(exported.settings.theme, 'forest');
    assert.equal(exported.settings.hideMembers, true);
    assert.ok(exported.settings.wallpaper.startsWith('data:image/webp;base64,'));
    await page.locator('#reset-settings').click();
    await page.locator('#cancel-reset').click();
    assert.equal(await page.locator('[data-theme="forest"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#reset-settings').click();
    await page.locator('#confirm-reset').click();
    await page.waitForFunction(() => document.querySelector('[data-theme="midnight"]').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('#discord-preview').evaluate(el => el.classList.contains('has-wallpaper')), false);
    await page.locator('#import-file').setInputFiles(exportPath);
    await page.waitForFunction(() => document.querySelector('[data-theme="forest"]').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('[data-setting="customCssEnabled"]').isChecked(), false);
    assert.equal(await page.locator('#discord-preview').evaluate(el => el.classList.contains('has-wallpaper')), true);
    await page.locator('#remove-wallpaper').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('morrow-preview')).wallpaper === '');
    await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
    await page.waitForFunction(() => document.getElementById('toast').textContent === 'That file is not valid JSON.');
    await page.getByRole('button', { name: 'Midnight theme', exact: true }).click();
    await page.locator('[data-setting="hideMembers"]').uncheck();
    await page.locator('[data-setting="compact"]').uncheck();
    await page.locator('#custom-css').fill('');
    await page.locator('#save-css').click();
    await page.locator('#appearance').scrollIntoViewIfNeeded();
    await page.evaluate(() => { document.getElementById('toast').hidden = true; window.scrollTo(0, 0); });
    await page.screenshot({ path: path.join(results, 'studio.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(results, 'mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 380, height: 630 });
    await page.goto('http://127.0.0.1:4317/popup.html');
    await page.getByRole('button', { name: 'Dusk theme', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('morrow-preview')).theme === 'dusk');
    await page.screenshot({ path: path.join(results, 'popup.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    // A deterministic Discord-shaped DOM tests actual generated style behavior.
    const fixture = await context.newPage();
    fixture.on('pageerror', error => errors.push(error.message));
    await fixture.setContent('<html class="theme-dark"><body><div data-list-id="chat-messages"><div class="message_test"><div class="messageContent_test">hello</div></div></div><div class="membersWrap_test">Members</div><a href="/shop">Shop</a><div class="channelTextArea_test">Composer</div></body></html>');
    await fixture.evaluate(() => {
      window.__stored = {};
      window.__listeners = [];
      window.chrome = { storage: { local: { get: async () => window.__stored }, onChanged: { addListener: fn => window.__listeners.push(fn) } } };
      window.__change = patch => {
        const changes = {};
        for (const [key, value] of Object.entries(patch)) { window.__stored['morrow.' + key] = value; changes['morrow.' + key] = { newValue: value }; }
        window.__listeners.forEach(fn => fn(changes, 'local'));
      };
    });
    await fixture.addScriptTag({ path: path.join(root, 'src/engine.js') });
    await fixture.addScriptTag({ path: path.join(root, 'src/video.js') });
    await fixture.addScriptTag({ path: path.join(root, 'src/content.js') });
    await fixture.waitForSelector('#morrow-theme', { state: 'attached' });
    await fixture.evaluate(() => window.__change({ theme: 'forest', hideMembers: true, hideShop: true, fontSize: 20, radius: 7, customCssEnabled: true, customCss: 'body { color: rgb(1, 2, 3); }' }));
    assert.equal(await fixture.locator('.membersWrap_test').isVisible(), false);
    assert.equal(await fixture.locator('a[href="/shop"]').isVisible(), false);
    assert.equal(await fixture.locator('.messageContent_test').evaluate(el => getComputedStyle(el).fontSize), '20px');
    assert.equal(await fixture.locator('.channelTextArea_test').evaluate(el => getComputedStyle(el).borderRadius), '7px');
    assert.equal(await fixture.locator('body').evaluate(el => getComputedStyle(el).color), 'rgb(1, 2, 3)');
    await fixture.evaluate(() => window.__change({ enabled: false }));
    assert.equal(await fixture.locator('.membersWrap_test').isVisible(), true);
    assert.equal(await fixture.locator('a[href="/shop"]').isVisible(), true);
    assert.equal(await fixture.locator('#morrow-theme').textContent(), '');
    assert.equal(await fixture.locator('#morrow-custom').textContent(), '');
    assert.deepEqual(errors, []);
    console.log('PASS: studio, persistence, toggles, CSS save, export/import, reset/cancel, responsive layouts, popup, content script updates and full disable; no JS errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });


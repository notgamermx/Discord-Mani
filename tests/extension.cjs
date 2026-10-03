// Real unpacked-extension check in an isolated Edge profile. No Discord login needed.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.test-profile');
const launchOptions = {
  headless: true,
  executablePath: process.env.MORROW_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  args: ['--disable-extensions-except=' + root, '--load-extension=' + root],
  ignoreDefaultArgs: ['--disable-extensions']
};
function extensionId() {
  const prefsFile = path.join(profile, 'Default', 'Secure Preferences');
  if (!fs.existsSync(prefsFile)) return null;
  const prefs = JSON.parse(fs.readFileSync(prefsFile));
  return Object.entries(prefs.extensions?.settings || {}).find(([, entry]) => entry.path?.toLowerCase() === root.toLowerCase())?.[0];
}
(async () => {
  if (!extensionId()) {
    const bootstrap = await chromium.launchPersistentContext(profile, launchOptions);
    await bootstrap.newPage();
    await bootstrap.close();
  }
  const id = extensionId();
  assert.ok(id, 'Browser must support loading an unpacked extension via command line');
  const context = await chromium.launchPersistentContext(profile, launchOptions);
  try {
    const errors = [];
    const studio = await context.newPage();
    studio.on('pageerror', error => errors.push(error.message));
    await studio.goto(`chrome-extension://${id}/options.html`);
    await studio.waitForFunction(() => document.querySelectorAll('[data-theme]').length === 6);
    assert.equal(await studio.locator('#demo-banner').isVisible(), false);
    await studio.evaluate(async () => { await chrome.storage.local.clear(); });
    await studio.reload();
    await studio.waitForFunction(() => document.querySelectorAll('[data-theme]').length === 6);
    await context.route('https://discord.com/**', route => {
      const isServer = /^\/channels\/\d+\/\d+/.test(new URL(route.request().url()).pathname);
      return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(root, 'tests/fixtures', isServer ? 'server.html' : 'discord.html'), 'utf8') });
    });
    const discord = await context.newPage();
    await discord.goto('https://discord.com/channels/@me');
    await discord.waitForSelector('#morrow-theme', { state: 'attached' });
    await studio.locator('#wallpaper-file').setInputFiles(path.join(root, 'icons/icon-128.png'));
    await discord.waitForFunction(() => getComputedStyle(document.body, '::before').backgroundImage.includes('data:image/webp'));
    for (const selector of ['#app-mount', '.app_test', '.base_test', '.chat_test', '.chatContent_test', '.messagesWrapper_test', '.outer_test', '.inner_test', '.members_test']) {
      assert.equal(await discord.locator(selector).evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', selector);
    }
    for (const selector of ['.bar_test', '.guilds_test', '.sidebar_test', '.sidebarList_test', '.privateChannels_test', '.userPanel_test', '.membersWrap_test']) {
      assert.notEqual(await discord.locator(selector).evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', selector);
    }
    await studio.locator('#panel-opacity').fill('0');
    await studio.locator('#panel-opacity').dispatchEvent('change');
    await discord.waitForFunction(() => getComputedStyle(document.querySelector('.guilds_test')).backgroundColor.endsWith('/ 0)'));
    await studio.locator('#panel-opacity').fill('75');
    await studio.locator('#panel-opacity').dispatchEvent('change');
    assert.equal(await discord.locator('body').evaluate(el => getComputedStyle(el, '::before').position), 'fixed');
    assert.equal(await discord.locator('body').evaluate(el => getComputedStyle(el, '::before').pointerEvents), 'none');
    await discord.setViewportSize({ width: 1440, height: 900 });
    assert.equal(await discord.locator('body').evaluate(el => getComputedStyle(el, '::before').width), '1440px');
    assert.equal(await discord.locator('body').evaluate(el => getComputedStyle(el, '::before').height), '900px');
    await discord.locator('#send-test').click();
    await discord.locator('#nav-test').click();
    assert.ok(discord.url().endsWith('#friends'));
    const sampledColor = await studio.evaluate(async () => (await chrome.storage.local.get('morrow.imageNavColor'))['morrow.imageNavColor']);
    assert.equal(await discord.locator('.sidebar_test').evaluate(el => getComputedStyle(el).getPropertyValue('--channels-default').trim()), sampledColor);
    await studio.locator('[data-setting="autoNavColors"]').uncheck();
    await discord.waitForFunction(() => getComputedStyle(document.querySelector('.sidebar_test')).getPropertyValue('--channels-default').trim() === '#eeeef2');
    await studio.locator('[data-setting="autoNavColors"]').check();
    assert.notEqual(await discord.locator('.channelTextArea_test').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    await discord.locator('#overlay').evaluate(el => { el.hidden = false; });
    assert.notEqual(await discord.locator('#overlay').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    assert.notEqual(await discord.locator('#overlay').evaluate(el => getComputedStyle(el).getPropertyValue('--background-primary').trim()), 'transparent');
    await discord.locator('#overlay').evaluate(el => { el.hidden = true; });
    fs.mkdirSync(path.join(root, '.test-results'), { recursive: true });
    await discord.screenshot({ path: path.join(root, '.test-results/full-window-wallpaper.png') });
    async function checkDirectServer(videoMode) {
      const directServer = await context.newPage();
      await directServer.goto('https://discord.com/channels/777/888');
      await directServer.waitForFunction(() => document.querySelector('._a12-serverShell')?.hasAttribute('data-morrow-surface'));
      assert.equal(await directServer.locator('._a12-serverShell').evaluate(el => getComputedStyle(el).backgroundImage), 'none');
      if (videoMode) await directServer.waitForFunction(() => document.getElementById('morrow-wallpaper-video')?.readyState >= 2);
      else assert.ok(await directServer.locator('body').evaluate(el => getComputedStyle(el, '::before').backgroundImage.includes('data:image/webp')));
      await directServer.close(); await discord.bringToFront();
    }
    async function checkServerSwitches(videoMode = false) {
      const serverHtml = fs.readFileSync(path.join(root, 'tests/fixtures/server.html'), 'utf8');
      const dmHtml = fs.readFileSync(path.join(root, 'tests/fixtures/discord.html'), 'utf8');
      const originalSource = videoMode ? await discord.locator('#morrow-wallpaper-video').getAttribute('src') : null;
      for (const route of ['/channels/111/222', '/channels/333/444', '/channels/333/555']) {
        await discord.evaluate(({ html, route }) => {
          history.pushState({}, '', route);
          const next = new DOMParser().parseFromString(html, 'text/html').getElementById('app-mount');
          document.getElementById('app-mount').replaceWith(next);
        }, { html: serverHtml, route });
        await discord.waitForFunction(() => document.querySelector('._a12-serverShell')?.hasAttribute('data-morrow-surface'));
        for (const selector of ['._a12-bg', '._a12-page', '._a12-serverShell', '._a12-chat', '._a12-chatContent', '._a12-chatGradient', '._a12-newMessagesWrapper']) {
          assert.equal(await discord.locator(selector).evaluate(el => getComputedStyle(el).backgroundImage), 'none', selector);
          assert.equal(await discord.locator(selector).evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', selector);
        }
        assert.notEqual(await discord.locator('._a12-embedFull').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
        assert.notEqual(await discord.locator('#server-dialog').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
        await discord.locator('#server-send').click();
        if (videoMode) assert.equal(await discord.locator('#morrow-wallpaper-video').getAttribute('src'), originalSource, 'Server navigation must not restart the video');
        else assert.ok(await discord.locator('body').evaluate(el => getComputedStyle(el, '::before').backgroundImage.includes('data:image/webp')));
      }
      if (videoMode) {
        await discord.locator('#morrow-wallpaper-video').evaluate(el => el.remove());
        await discord.waitForFunction(() => document.getElementById('morrow-wallpaper-video')?.readyState >= 2);
        assert.equal(await discord.locator('#morrow-wallpaper-video').count(), 1);
      }
      await discord.locator('#morrow-theme').evaluate(el => el.remove());
      await discord.waitForFunction(() => document.getElementById('morrow-theme')?.textContent.includes('background-primary'));
      await discord.screenshot({ path: path.join(root, '.test-results', videoMode ? 'server-video.png' : 'server-image.png') });
      await discord.evaluate(html => {
        history.pushState({}, '', '/channels/@me');
        document.getElementById('app-mount').replaceWith(new DOMParser().parseFromString(html, 'text/html').getElementById('app-mount'));
      }, dmHtml);
      await discord.waitForFunction(() => document.querySelector('.chat_test')?.hasAttribute('data-morrow-surface'));
    }
    await checkServerSwitches();
    // Generate a small local test video; no external media or services involved.
    const recordingPage = await context.newPage();
    const videoData = await recordingPage.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
      const ctx = canvas.getContext('2d'); const stream = canvas.captureStream(15);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      const chunks = [];
      recorder.ondataavailable = event => chunks.push(event.data);
      const finished = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start();
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = '#bd5d19'; ctx.fillRect(0, 0, 160, 90);
        ctx.fillStyle = '#ffeec3'; ctx.fillRect(i * 10, 20, 20, 50);
        await new Promise(resolve => setTimeout(resolve, 70));
      }
      recorder.stop(); await finished; stream.getTracks().forEach(track => track.stop());
      return await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' })); });
    });
    await recordingPage.close();
    const videoFile = path.join(root, '.test-results/sample.webm');
    fs.writeFileSync(videoFile, Buffer.from(videoData.split(',')[1], 'base64'));
    await studio.bringToFront();
    await studio.locator('#video-file').setInputFiles(videoFile);
    await studio.waitForFunction(() => !document.getElementById('upload-video').disabled && document.getElementById('wallpaper-mode').value === 'video');
    await discord.bringToFront();
    await discord.waitForFunction(() => document.getElementById('morrow-wallpaper-video')?.readyState >= 2);
    await discord.waitForFunction(() => document.getElementById('morrow-wallpaper-video').currentTime > 0);
    await checkServerSwitches(true);
    const downloadEvent = studio.waitForEvent('download');
    await studio.locator('#export-settings').click();
    const download = await downloadEvent;
    const exportFile = path.join(root, '.test-results/video-settings.json');
    await download.saveAs(exportFile);
    assert.ok(JSON.parse(fs.readFileSync(exportFile)).settings.wallpaperVideo.startsWith('data:video/webm;base64,'));
    const video = discord.locator('#morrow-wallpaper-video');
    assert.equal(await video.evaluate(el => el.muted && el.loop && el.tabIndex === -1), true);
    assert.equal(await video.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    await discord.locator('#send-test').click();
    const savedVideoSource = await video.getAttribute('src');
    await studio.locator('#wallpaper-blur').fill('3'); await studio.locator('#wallpaper-blur').dispatchEvent('change');
    await discord.waitForFunction(() => getComputedStyle(document.getElementById('morrow-wallpaper-video')).filter === 'blur(3px)');
    assert.equal(await video.getAttribute('src'), savedVideoSource, 'Changing blur must not restart video');
    await studio.locator('[data-setting="wallpaperVideoPaused"]').check();
    await discord.waitForFunction(() => document.getElementById('morrow-wallpaper-video').paused);
    await studio.locator('[data-setting="wallpaperVideoPaused"]').uncheck();
    await studio.locator('[data-setting="reduceMotion"]').check();
    await discord.waitForFunction(() => document.getElementById('morrow-wallpaper-video').paused);
    await studio.locator('[data-setting="reduceMotion"]').uncheck();
    await studio.reload();
    await studio.waitForFunction(() => document.getElementById('wallpaper-mode').value === 'video');
    await discord.reload(); await discord.bringToFront();
    await discord.waitForFunction(() => document.getElementById('morrow-wallpaper-video')?.currentTime > 0);
    assert.equal(await discord.locator('#morrow-wallpaper-video').count(), 1);
    await studio.locator('[data-setting="enabled"]').uncheck();
    await discord.locator('#morrow-wallpaper-video').waitFor({ state: 'detached' });
    await studio.locator('[data-setting="enabled"]').check();
    await discord.locator('#morrow-wallpaper-video').waitFor({ state: 'attached' });
    await studio.locator('#video-file').setInputFiles({ name: 'bad.webm', mimeType: 'video/webm', buffer: Buffer.from('not a video') });
    await studio.waitForFunction(() => document.getElementById('toast').textContent.includes('cannot play'));
    assert.equal(await studio.locator('#wallpaper-mode').inputValue(), 'video');
    await studio.locator('#remove-wallpaper').click();
    await discord.locator('#morrow-wallpaper-video').waitFor({ state: 'detached' });
    await discord.waitForFunction(() => getComputedStyle(document.body, '::before').backgroundImage.includes('data:image/webp'));
    await studio.locator('#import-file').setInputFiles(exportFile);
    await discord.locator('#morrow-wallpaper-video').waitFor({ state: 'attached' });
    await checkDirectServer(true);
    await studio.locator('#remove-wallpaper').click();
    await discord.locator('#morrow-wallpaper-video').waitFor({ state: 'detached' });
    await checkDirectServer(false);
    await studio.locator('[data-setting="wallpaperEnabled"]').uncheck();
    await discord.waitForFunction(() => getComputedStyle(document.body, '::before').backgroundImage === 'none');
    assert.notEqual(await discord.locator('.sidebar_test').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    await studio.locator('[data-setting="wallpaperEnabled"]').check();
    await studio.getByRole('button', { name: 'Ocean theme', exact: true }).click();
    await discord.waitForFunction(() => document.getElementById('morrow-theme')?.textContent.includes('#1e2b37'));
    await studio.locator('[data-setting="hideMembers"]').check();
    await discord.locator('.membersWrap_test').waitFor({ state: 'hidden' });
    await studio.locator('#custom-css').fill('body { color: rgb(4, 5, 6); }');
    await studio.locator('#save-css').click();
    await studio.locator('[data-setting="customCssEnabled"]').check();
    await discord.waitForFunction(() => getComputedStyle(document.body).color === 'rgb(4, 5, 6)');
    const popup = await context.newPage();
    popup.on('pageerror', error => errors.push(error.message));
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForFunction(() => document.querySelector('[data-theme="ocean"]')?.getAttribute('aria-pressed') === 'true');
    await popup.locator('[data-setting="enabled"]').uncheck();
    await discord.waitForFunction(() => document.getElementById('morrow-theme').textContent === '' && document.getElementById('morrow-custom').textContent === '');
    assert.equal(await discord.locator('[data-morrow-surface]').count(), 0);
    await studio.waitForFunction(() => document.querySelector('[data-setting="enabled"]').checked === false);
    await discord.reload();
    await discord.waitForSelector('#morrow-theme', { state: 'attached' });
    assert.equal(await discord.locator('#morrow-theme').textContent(), '');
    await popup.locator('[data-setting="enabled"]').check();
    await discord.waitForFunction(() => document.getElementById('morrow-theme').textContent.includes('#1e2b37'));
    assert.ok(await discord.locator('body').evaluate(el => getComputedStyle(el, '::before').backgroundImage.includes('data:image/webp')));
    assert.equal(await discord.locator('.membersWrap_test').isVisible(), false);
    assert.equal(await discord.locator('body').evaluate(el => getComputedStyle(el).color), 'rgb(4, 5, 6)');
    assert.deepEqual(errors, []);
    await studio.locator('#remove-wallpaper').click();
    await discord.waitForFunction(() => getComputedStyle(document.body, '::before').backgroundImage === 'none');
    await studio.evaluate(async () => { await chrome.storage.local.clear(); });
    console.log('PASS: Edge loads the unpacked MV3 extension; real content script injection, storage changes across studio/popup/Discord, reload persistence, custom CSS, pause and resume.');
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../src/engine.js');
const M = globalThis.Morrow;

test('malformed stored settings cannot inject values into generated CSS', () => {
  const result = M.normalize({ theme: '__proto__', accent: 'red; } body { display:none', fontSize: Infinity, radius: -90, enabled: 'false', customCss: 9 });
  assert.equal(result.theme, 'midnight');
  assert.equal(result.accent, M.defaults.accent);
  assert.equal(result.enabled, true);
  assert.equal(result.fontSize, 16);
  assert.equal(result.radius, 0);
  assert.equal(result.customCss, '');
  assert.equal(M.normalize({ fontSize: 1000, radius: 99 }).fontSize, 22);
  assert.equal(M.normalize({ radius: 99 }).radius, 24);
});
test('turning the extension off removes every built-in override', () => {
  assert.equal(M.buildCss({ enabled: false, hideMembers: true, reduceMotion: true }), '');
});
test('each theme emits its palette and optional layout rules are reversible', () => {
  for (const [theme, palette] of Object.entries(M.themes)) assert.ok(M.buildCss({ theme }).includes(palette.base));
  const defaults = M.buildCss({});
  assert.ok(!defaults.includes('display: none'));
  const modified = M.buildCss({ hideMembers: true, hideShop: true, compact: true, reduceMotion: true, fontSize: 19 });
  for (const expected of ['membersWrap_', 'a[href="/shop"]', 'margin-top: 3px', 'animation-duration', 'font-size: 19px']) assert.ok(modified.includes(expected));
});
test('per-field storage patches preserve other settings and ignore unknown keys', () => {
  const stored = { ...M.encode({ theme: 'forest' }), ...M.encode({ compact: true }), ...M.encode({ surprise: 'x' }) };
  assert.equal(M.decode(stored).theme, 'forest');
  assert.equal(M.decode(stored).compact, true);
  assert.ok(!('morrow.surprise' in stored));
});
test('settings exports round trip, invalid formats fail, and CSS is bounded', () => {
  const settings = M.normalize({ theme: 'ocean', customCss: 'body { color: red; }' });
  assert.deepEqual(M.parseImport(JSON.stringify({ format: 'morrow-settings', version: 1, settings })), settings);
  for (const bad of ['{}', '{', '{"format":"morrow-settings","version":1,"settings":[]}', '{"format":"morrow-settings","version":1,"settings":{"enabled":"yes"}}']) assert.throws(() => M.parseImport(bad));
  assert.equal(M.normalize({ customCss: 'a'.repeat(60000) }).customCss.length, 50000);
});
test('manifest only requests local settings and targets Discord hosts', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://discord.com/*', 'https://ptb.discord.com/*', 'https://canary.discord.com/*']);
  for (const file of [...manifest.content_scripts[0].js, ...Object.values(manifest.icons), manifest.action.default_popup, manifest.options_ui.page]) assert.ok(fs.existsSync(path.join(root, file)), file);
});

test('wallpapers accept only bounded raster data URLs and settings exports preserve them', () => {
  const wallpaper = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '../icons/icon-128.png')).toString('base64');
  const settings = M.normalize({ wallpaper, wallpaperDim: 150, wallpaperBlur: -2 });
  assert.equal(settings.wallpaperDim, 90);
  assert.equal(settings.wallpaperBlur, 0);
  assert.ok(M.buildCss(settings).includes(wallpaper));
  assert.ok(M.buildCss(settings).includes('body::before'));
  assert.ok(M.buildCss(settings).includes('position: fixed; inset: 0'));
  assert.ok(!M.buildCss(settings).includes('[class*="chatContent_"]::before'));
  assert.ok(!M.buildCss({ ...settings, wallpaperEnabled: false }).includes(wallpaper));
  assert.equal(M.buildCss({ ...settings, enabled: false }), '');
  assert.equal(M.parseImport(JSON.stringify({ format: 'morrow-settings', version: 1, settings })).wallpaper, wallpaper);
  for (const invalid of ['https://example.com/picture.png', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,AAA");body{display:none}', 'data:image/png;base64,' + 'a'.repeat(M.maxWallpaperLength)]) {
    assert.equal(M.normalize({ wallpaper: invalid }).wallpaper, '');
    assert.throws(() => M.parseImport(JSON.stringify({ format: 'morrow-settings', version: 1, settings: { wallpaper: invalid } })));
  }
  assert.equal(M.parseImport(JSON.stringify({ format: 'morrow-settings', version: 1, settings: { theme: 'forest' } })).wallpaper, '');
});

test('video settings are bounded and survive import; invalid payloads cannot enter CSS', () => {
  const video = 'data:video/webm;base64,YWJjZA==';
  const settings = M.normalize({ wallpaperVideo: video, wallpaperMode: 'video', panelOpacity: 900, imageNavColor: 'red;}', videoNavColor: '#bbddff' });
  assert.equal(settings.panelOpacity, 95);
  assert.equal(settings.imageNavColor, M.defaults.imageNavColor);
  assert.equal(M.hasWallpaper(settings), true);
  assert.ok(M.buildCss(settings).includes('#bbddff'));
  assert.ok(!M.buildCss(settings).includes(video), 'Video bytes are not embedded into CSS');
  assert.equal(M.parseImport(JSON.stringify({ format: 'morrow-settings', version: 1, settings })).wallpaperVideo, video);
  for (const bad of ['https://example.com/video.mp4', 'data:video/webm;base64,AAA"', 'data:video/webm;base64,' + 'a'.repeat(M.maxVideoLength)]) {
    assert.equal(M.normalize({ wallpaperVideo: bad }).wallpaperVideo, '');
    assert.throws(() => M.parseImport(JSON.stringify({ format: 'morrow-settings', version: 1, settings: { wallpaperVideo: bad } })));
  }
  assert.equal(M.buildCss({ ...settings, enabled: false }), '');
});

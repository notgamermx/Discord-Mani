# Morrow

**Your Discord, your way.** A standalone Chrome / Edge extension for customizing Discord on the web. Built with Manifest V3 and plain HTML, CSS, and JavaScript. No build step or third-party runtime dependencies.

## Install locally

1. Keep this folder somewhere permanent, or extract `release/morrow-0.4.1.zip` first.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**, then choose **Load unpacked**.
4. Select the folder containing `manifest.json` (this project folder, or the extracted ZIP folder).
5. Open or reload [Discord web](https://discord.com/channels/@me). Pin Morrow using the browser’s Extensions menu.
6. Click Morrow’s toolbar icon for quick themes, or **Open customization studio** for all controls.

Settings changes apply to already open Discord tabs after initial installation/reload. Turn off Morrow in its popup to remove all its styling, including custom CSS. The extension only changes Discord in the browser, not the desktop app.

## Features

- Six dark palettes: Midnight, Dusk, Forest, Ocean, Ember, Graphite.
- Accent picker, message font size, avatar / composer / embed roundness.
- Full-window wallpapers with image upload, dimming, blur, show/hide, and removal.
- Muted MP4/WebM video wallpapers with looping playback and pause controls.
- Bright navigation colors sampled from your wallpaper, plus adjustable panel opacity.
- Compact messages, hidden member list, reduced CSS motion, hidden shop / discovery navigation links.
- Separate custom CSS editor with an explicit save button and enable switch.
- Local settings persistence, JSON export/import, reset, and global pause.
- A settings studio with an illustrative live preview and a compact toolbar popup.

Choosing a theme also selects its suggested accent. Theme preview represents colors and supported layout controls; discovery links and custom CSS are applied only on Discord. Reduced motion affects CSS animations/transitions and pauses Morrow video wallpapers; it does not pause Discord's own videos or GIFs. Import disables custom CSS until you review and enable it. Export includes saved settings, not unsaved editor text.

## Add a wallpaper

Open **Customization studio → Wallpaper → Choose image**. Pick a JPG, PNG, or WebP up to 8 MB. Morrow resizes it locally to at most 2560 pixels on the longest edge and saves a compressed still image in browser storage. It never uploads your picture. Use **Dimming** (0–90%) and **Blur** (0–20 px) for readability. One continuous wallpaper covers the entire Discord web page, including the server bar, channel sidebar, chat, top bar, and member/profile sidebar. Menus, dialogs, message embeds, and the composer retain solid backgrounds for readability. The picture uses centered cover sizing, so edges may crop to fit your window. Existing saved wallpapers automatically use the full-window layout after updating. **Show wallpaper** pauses it without deleting the image; **Remove** deletes it from saved settings. Pausing Morrow disables the wallpaper too. Settings exports include the image, so keep those files private if your wallpaper is personal.

To update an existing unpacked installation, replace its files with this release, click **Reload** on Morrow in the browser’s Extensions page, and reload Discord and any open studio tabs. Keep the same extension folder to retain settings.

The selected wallpaper is global across DMs, servers, and channels; no separate server setup is needed. Version 0.4.1 clears server-page gradients and extra message-list ancestor backgrounds, supports both CSS module class-name formats, and repairs its styles/video element if Discord replaces them during navigation. Only layout ancestors are cleared; message embeds, menus, and dialogs keep their surfaces. Native Discord background gradients are temporarily suppressed while a Morrow wallpaper is enabled. Disabling it restores Discord's styles.

## Video wallpapers and readable controls

Use **Wallpaper → Choose video** for a local MP4 or WebM up to **4 MB**. Short H.264 MP4 or VP8/VP9 WebM loops work well; actual codec support depends on the browser. Morrow checks that the browser can decode the video before saving it. Playback is muted, loops automatically, pauses in hidden tabs, and stops when you enable **Pause video**, **Reduce motion**, or disable Morrow. The video sits behind the page, ignores clicks, and stays out of keyboard navigation. Dimming and blur work for videos too.

**Background type** switches between your saved image and video without deleting either. Removing the video switches back to your saved image. Both files are included in settings exports. Videos are kept locally without requesting additional browser permissions. The standalone web preview uses localStorage with a smaller quota; large clips should be used in the installed extension.

**Match navigation colors to wallpaper** samples the image (or a video's first frame) and chooses a bright complementary color for navigation labels, buttons, and icons. The color stays stable during video playback. **Navigation panel opacity** defaults to 75% so controls stand out over a busy background; lower it for more visible wallpaper. Reopen the studio after upgrading to sample your existing image automatically. Menu and dialog backgrounds remain solid. Discord selector changes can affect which controls receive the colors.

## Development

Use Node.js 18 or later:

```sh
node --test tests/engine.test.cjs
node scripts/preview.cjs
```

Visit `http://127.0.0.1:4317/options.html`. Outside the installed extension, settings use isolated demo localStorage and do not modify Discord. `popup.html` can also be previewed.

Optional browser tests use Playwright (`npm install --no-save playwright`). With the preview server running, use `node tests/browser.cjs`. Set `MORROW_BROWSER` to your installed Chrome/Edge executable if Playwright's bundled browser is unavailable. `node tests/extension.cjs` loads the real extension in a separate `.test-profile` using Edge by default, then serves a local test fixture at a Discord URL to verify content script injection and storage across extension pages. It never signs into Discord. Package the runtime files with `powershell -File scripts/package.ps1`.

`src/engine.js` owns palettes, settings normalization, CSS generation, and import validation. `src/content.js` loads that engine in Discord’s isolated content-script environment and updates two owned style elements when local extension settings change. A filtered DOM observer handles replacement message-list layouts and repairs removed wallpaper layers without restarting a connected video on each channel switch. `src/store.js` provides per-field storage patches to avoid overwriting unrelated changes in another settings window. `src/ui.js` drives both settings surfaces.

## Scope and compatibility

This is an initial appearance-focused release, not a Vencord plugin loader. It does not provide Nitro features, message recovery, account automation, or desktop integration. Discord can change its CSS tokens and class names; layout selectors may need updates. Tests cover eight engine/manifest checks, Chrome browser UI interactions, and real unpacked-extension integration in Edge using a representative Discord DOM fixture, including generated WebM playback, pause/resume, reload persistence, import/export, and adaptive navigation colors. Live signed-in Discord compatibility still needs a manual check in your account.

Manual release check: switch themes on Discord, change message size, open a server member list and hide/show it, test compact mode, navigate between channels, reload, and pause Morrow. In the CSS editor try `:root { --font-primary: Georgia, serif; }`, enable it, then pause Morrow and confirm Discord’s original styling returns. Inspect the Extensions page for errors.

## Privacy

Only the `storage` permission is requested; content scripts run on `discord.com`, `ptb.discord.com`, and `canary.discord.com`. Morrow stores preferences and custom CSS locally. It contains no analytics, telemetry, backend, remote scripts, or message/token collection. User-entered CSS containing `url()` or `@import` can request external resources, subject to Discord/browser restrictions. Uninstalling removes local extension settings, so export first if needed.

Independent project; not affiliated with Discord or Vencord. “Morrow” is a working name and has not been checked for trademark availability.

Implementation references: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).



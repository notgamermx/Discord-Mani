/* Shared by the isolated Discord content script and extension settings pages. */
(() => {
  'use strict';
  const themes = {
    midnight: { name: 'Midnight', description: 'The familiar, refined.', base: '#202127', side: '#191a20', deep: '#131419', raised: '#2b2d35', text: '#eeeef2', muted: '#a5a6b4', accent: '#aaa0fa' },
    dusk: { name: 'Dusk', description: 'A softer after-hours.', base: '#292330', side: '#211d28', deep: '#19161f', raised: '#382f41', text: '#f3eaf7', muted: '#b4a4c0', accent: '#c6a1ee' },
    forest: { name: 'Forest', description: 'A breath of fresh air.', base: '#202c28', side: '#192420', deep: '#121d19', raised: '#2d3d35', text: '#e5f1e9', muted: '#a0b6a7', accent: '#a4c9a1' },
    ocean: { name: 'Ocean', description: 'Find your flow.', base: '#1e2b37', side: '#17222d', deep: '#111b24', raised: '#2a3b4a', text: '#e4eef7', muted: '#9eb3c6', accent: '#8dc9e7' },
    ember: { name: 'Ember', description: 'Keep it cozy.', base: '#302521', side: '#271e1a', deep: '#1d1714', raised: '#41312a', text: '#f8ede6', muted: '#c3aa9b', accent: '#eca383' },
    graphite: { name: 'Graphite', description: 'Less, but better.', base: '#111113', side: '#0b0b0d', deep: '#050506', raised: '#222225', text: '#f2f2f3', muted: '#a3a3ab', accent: '#c4c4cf' }
  };
  const defaults = Object.freeze({ enabled: true, theme: 'midnight', accent: '#aaa0fa', fontSize: 16, radius: 12, compact: false, hideMembers: false, hideShop: false, reduceMotion: false, customCssEnabled: false, customCss: '', wallpaper: '', wallpaperVideo: '', wallpaperMode: 'image', wallpaperVideoPaused: false, wallpaperEnabled: true, wallpaperDim: 55, wallpaperBlur: 0, panelOpacity: 75, autoNavColors: true, imageNavColor: '#ddcaff', videoNavColor: '#ddcaff' });
  const maxWallpaperLength = 2800000;
  function validWallpaper(value) {
    return typeof value === 'string' && value.length <= maxWallpaperLength && /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+={0,2}$/i.test(value);
  }
  const maxVideoBytes = 4 * 1024 * 1024;
  const maxVideoLength = Math.ceil(maxVideoBytes / 3) * 4 + 40;
  function validVideo(value) {
    return typeof value === 'string' && value.length <= maxVideoLength && /^data:video\/(?:mp4|webm);base64,[a-z0-9+/]+={0,2}$/i.test(value);
  }
  function hasWallpaper(s) { return s.wallpaperEnabled && Boolean(s.wallpaperMode === 'video' ? s.wallpaperVideo : s.wallpaper); }
  const prefix = 'morrow.';
  function normalize(raw = {}) {
    const out = { ...defaults };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const key of Object.keys(defaults)) {
      if (typeof defaults[key] === 'boolean' && typeof raw[key] === 'boolean') out[key] = raw[key];
    }
    for (const key of ['imageNavColor', 'videoNavColor']) if (typeof raw[key] === 'string' && /^#[0-9a-f]{6}$/i.test(raw[key])) out[key] = raw[key].toLowerCase();
    if (Object.hasOwn(themes, raw.theme)) out.theme = raw.theme;
    if (typeof raw.accent === 'string' && /^#[0-9a-f]{6}$/i.test(raw.accent)) out.accent = raw.accent.toLowerCase();
    for (const [key, min, max] of [['fontSize', 12, 22], ['radius', 0, 24], ['wallpaperDim', 0, 90], ['wallpaperBlur', 0, 20], ['panelOpacity', 0, 95]]) {
      if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) out[key] = Math.round(Math.max(min, Math.min(max, raw[key])));
    }
    if (typeof raw.customCss === 'string') out.customCss = raw.customCss.slice(0, 50000);
    if (validWallpaper(raw.wallpaper)) out.wallpaper = raw.wallpaper;
    if (validVideo(raw.wallpaperVideo)) out.wallpaperVideo = raw.wallpaperVideo;
    if (['image', 'video'].includes(raw.wallpaperMode)) out.wallpaperMode = raw.wallpaperMode;
    return out;
  }
  function decode(stored) {
    return normalize(Object.fromEntries(Object.keys(defaults).map(k => [k, stored[prefix + k]])));
  }
  function encode(patch) {
    const normalized = normalize(patch);
    return Object.fromEntries(Object.keys(patch).filter(k => Object.hasOwn(defaults, k)).map(k => [prefix + k, normalized[k]]));
  }
  function buildCss(raw) {
    const s = normalize(raw);
    if (!s.enabled) return '';
    const t = themes[s.theme];
    const navColor = s.autoNavColors ? (s.wallpaperMode === 'video' ? s.videoNavColor : s.imageNavColor) : t.text;
    // Discord uses both legacy tokens and newer surface tokens across its views.
    let css = `:root, .theme-dark, .theme-light, .theme-darker, .theme-midnight {
      --background-primary: ${t.base} !important; --background-secondary: ${t.side} !important;
      --background-secondary-alt: ${t.deep} !important; --background-tertiary: ${t.deep} !important;
      --background-base-lowest: ${t.deep} !important; --background-base-lower: ${t.side} !important;
      --background-base-low: ${t.base} !important; --background-surface-high: ${t.raised} !important;
      --background-surface-higher: ${t.raised} !important; --background-surface-highest: ${t.raised} !important;
      --bg-base-primary: ${t.base} !important; --bg-base-secondary: ${t.side} !important;
      --bg-base-tertiary: ${t.deep} !important; --background-floating: ${t.deep} !important;
      --chat-background-default: ${t.base} !important; --channeltextarea-background: ${t.raised} !important;
      --input-background: ${t.raised} !important; --modal-background: ${t.base} !important;
      --modal-footer-background: ${t.side} !important; --text-normal: ${t.text} !important;
      --text-primary: ${t.text} !important; --header-primary: ${t.text} !important;
      --text-muted: ${t.muted} !important; --text-secondary: ${t.muted} !important;
      --header-secondary: ${t.muted} !important; --channels-default: ${t.muted} !important;
      --interactive-normal: ${t.muted} !important; --interactive-hover: ${t.text} !important;
      --interactive-active: ${t.text} !important; --brand-500: ${s.accent} !important;
      --brand-560: color-mix(in srgb, ${s.accent} 80%, black) !important;
      --blurple-50: ${s.accent} !important; --text-link: ${s.accent} !important;
      --background-modifier-selected: ${s.accent}25 !important;
      --background-modifier-hover: ${s.accent}12 !important;
      --background-mentioned: ${s.accent}18 !important; --background-mentioned-hover: ${s.accent}25 !important;
      --info-warning-foreground: ${s.accent} !important;
    }
    [data-list-id="chat-messages"] [class*="messageContent_"] { font-size: ${s.fontSize}px !important; line-height: 1.5 !important; }
    [class*="channelTextArea_"] { border-radius: ${s.radius}px !important; }
    [data-list-item-id^="chat-messages"] [class*="embedFull_"] { border-radius: ${s.radius}px !important; }
    [data-list-id="chat-messages"] [class*="avatar_"] { border-radius: ${Math.min(s.radius, 20)}px !important; }
    `;
    if (s.compact) css += '[data-list-id="chat-messages"] [class*="message_"] { min-height: 0 !important; padding-top: 2px !important; padding-bottom: 2px !important; margin-top: 3px !important; }\n';
    if (s.hideMembers) css += '[class*="membersWrap_"] { display: none !important; }\n';
    if (s.hideShop) css += 'a[href="/store"], a[href="/shop"], a[href^="/shop/"], a[href="/activities"] { display: none !important; }\n';
    if (s.reduceMotion) css += '*, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }\n';
    if (hasWallpaper(s)) {
      // Clear the app's stacked layout surfaces, not every element. Floating UI
      // restores opaque tokens so dialogs and context menus remain readable.
      const layoutTokens = {
        'background-primary': t.base, 'background-secondary': t.side,
        'background-secondary-alt': t.deep, 'background-tertiary': t.deep,
        'background-base-lowest': t.deep, 'background-base-lower': t.side,
        'background-base-low': t.base, 'bg-base-primary': t.base,
        'bg-base-secondary': t.side, 'bg-base-tertiary': t.deep,
        'chat-background-default': t.base, 'home-background': t.base,
        'background-gradient-highest': t.base, 'background-gradient-high': t.base,
        'background-gradient-low': t.base, 'background-gradient-lower': t.side,
        'background-gradient-lowest': t.deep
      };
      css += `
      html { background: ${t.deep} !important; }
      body { isolation: isolate; background: transparent !important; }
      body::before {
        content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
        background-image: linear-gradient(rgb(0 0 0 / ${s.wallpaperDim / 100}), rgb(0 0 0 / ${s.wallpaperDim / 100}))${s.wallpaperMode === 'image' ? `, url("${s.wallpaper}")` : ''};
        background-size: cover; background-position: center; background-repeat: no-repeat;
        filter: blur(${s.wallpaperBlur}px);
      }
      #morrow-wallpaper-video { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; object-fit: cover !important; z-index: -2 !important; pointer-events: none !important; user-select: none !important; filter: blur(${s.wallpaperBlur}px); }
      #app-mount, #app-mount :is(.theme-dark, .theme-light, .theme-darker, .theme-midnight) {
        ${Object.keys(layoutTokens).map(token => `--${token}: transparent !important;`).join('\n')}
      }
      #app-mount,
      #app-mount :is(
        [class*="appAsidePanelWrapper_"], [class*="notAppAsidePanel_"],
        [class*="app_"], [class*="bg_"], [class*="layers_"], [class*="baseLayer_"],
        [class*="base_"], [class*="content_"], [class*="workspace_"], [class*="page_"], [class*="chatLayerWrapper_"],
        [class*="guilds_"], [class*="sidebar_"], [class*="sidebarList_"],
        [class*="sidebarListRounded_"], [class*="privateChannels_"],
        [class*="chat_"], [class*="chatContent_"], [class*="messagesWrapper_"],
        [class*="membersWrap_"], [class*="members_"], [class*="member_"],
        [class*="userPanel_"], [class*="panels_"], [class*="title_"],
        [class*="titleBar_"], [class*="subtitleContainer_"], [class*="bar_"],
        [class*="standardSidebarView_"], [class*="sidebarRegionScroller_"],
        [class*="contentRegion_"], [class*="contentRegionScroller_"]
      ) { background-color: transparent !important; }
      /* Server pages may introduce extra opaque/gradient wrappers. The content
         script marks only ancestors of the actual message list, never messages. */
      #app-mount[data-morrow-surface], #app-mount [data-morrow-surface],
      #app-mount :is([class*="bg_"], [class*="page_"], [class*="chatLayerWrapper_"], [class*="chatGradient_"]) {
        background-color: transparent !important; background-image: none !important;
      }
      #app-mount [class*="chatGradient_"]::before,
      #app-mount [class*="chatGradient_"]::after { background: transparent !important; }
      #app-mount :is([class*="guilds_"], [class*="sidebar_"], [class*="chatContent_"], [class*="membersWrap_"]) [class*="scroller_"],
      #app-mount [data-list-id="chat-messages"],
      #app-mount [class*="sidebar_"]::after { background: transparent !important; }
      #app-mount [class*="userPanel_"] {
        --profile-gradient-primary-color: transparent !important;
        --profile-gradient-secondary-color: transparent !important;
        --profile-gradient-overlay-color: transparent !important;
        --profile-body-background-color: transparent !important;
        --background-surface-high: transparent !important;
      }
      #app-mount [class*="userPanel_"] :is([class*="outer_"], [class*="inner_"], [class*="overlay_"], [class*="userProfileOuter_"], [class*="userProfileInner_"]) { background: transparent !important; }
      #app-mount :is([role="dialog"], [role="menu"], [role="tooltip"], [class*="messagesPopoutWrap_"]) {
        ${Object.entries(layoutTokens).map(([token, color]) => `--${token}: ${color} !important;`).join('\n')}
        background-color: ${t.raised} !important;
      }
      #app-mount :is([class*="embedFull_"], [class*="channelTextArea_"]) { background-color: ${t.raised} !important; }
      #app-mount :is([class*="guilds_"], [class*="sidebar_"], [class*="sidebarList_"], [class*="privateChannels_"], [class*="membersWrap_"], [class*="userPanel_"], [class*="panels_"], [class*="titleBar_"], [class*="subtitleContainer_"], [class*="bar_"]) {
        background-color: color-mix(in srgb, ${t.deep} ${s.panelOpacity}%, transparent) !important;
      }
      #app-mount :is([class*="sidebar_"], [class*="guilds_"], [class*="membersWrap_"], [class*="userPanel_"], [class*="toolbar_"], [class*="channelTextArea_"], [class*="subtitleContainer_"]) {
        --channels-default: ${navColor} !important; --interactive-normal: ${navColor} !important;
        --interactive-hover: ${navColor} !important; --interactive-active: ${navColor} !important;
        --text-normal: ${navColor} !important; --header-primary: ${navColor} !important;
        --text-muted: ${t.muted} !important;
        --background-modifier-hover: ${s.accent}35 !important;
        --background-modifier-selected: ${s.accent}55 !important;
      }
      #app-mount :is([class*="sidebar_"], [class*="guilds_"], [class*="bar_"], [class*="panels_"], [class*="subtitleContainer_"], [class*="toolbar_"], [class*="channelTextArea_"]) :is(a, button, [role="button"], [role="link"]) { color: ${navColor} !important; }
      #app-mount :is([class*="sidebar_"], [class*="guilds_"]) :is(a, button, [role="button"]):focus-visible { outline: 2px solid ${s.accent} !important; outline-offset: -2px; }
      `;
    }
    // Support both name_hash and hash-name CSS modules. Match whole class-name
    // prefixes/suffixes so a "bar" rule does not also select "sidebar".
    return css.replace(/\[class\*="([a-zA-Z][a-zA-Z0-9]*)_"\]/g, (_, name) =>
      `:is([class^="${name}_"], [class*=" ${name}_"], [class$="-${name}"], [class*="-${name} "])`);
  }
  function parseImport(text) {
    const data = JSON.parse(text);
    if (data?.format !== 'morrow-settings' || data.version !== 1 || !data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) throw new Error('Choose a Morrow settings export (version 1).');
    if (Object.entries(defaults).some(([key, value]) => key in data.settings && typeof data.settings[key] !== typeof value)) throw new Error('This settings file contains invalid values.');
    if (data.settings.wallpaper && !validWallpaper(data.settings.wallpaper)) throw new Error('This export contains an invalid or oversized wallpaper.');
    if (data.settings.wallpaperVideo && !validVideo(data.settings.wallpaperVideo)) throw new Error('This export contains an invalid or oversized video.');
    return normalize(data.settings);
  }
  globalThis.Morrow = Object.freeze({ themes, defaults, prefix, normalize, decode, encode, buildCss, parseImport, validWallpaper, maxWallpaperLength, validVideo, maxVideoBytes, maxVideoLength, hasWallpaper });
})();

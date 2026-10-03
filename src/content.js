(() => {
  'use strict';
  let settings = Morrow.normalize();
  let baseStyle;
  let customStyle;
  let changedDuringLoad = false;
  let wallpaperVideo;
  let videoParent;
  const surfaceAttribute = 'data-morrow-surface';
  const surfaces = new Set();
  const messageSelector = '[data-list-id="chat-messages"]';
  function reconcileSurfaces() {
    const next = new Set();
    if (settings.enabled && Morrow.hasWallpaper(settings)) {
      document.querySelectorAll('#app-mount ' + messageSelector).forEach(list => {
        // Search/message dialogs keep their own backgrounds.
        if (list.closest('[role="dialog"], [role="menu"]')) return;
        let element = list;
        while (element && element !== document.body) {
          next.add(element);
          if (element.id === 'app-mount') break;
          element = element.parentElement;
        }
      });
    }
    for (const element of surfaces) if (!next.has(element)) { element.removeAttribute(surfaceAttribute); surfaces.delete(element); }
    for (const element of next) if (!surfaces.has(element)) { element.setAttribute(surfaceAttribute, ''); surfaces.add(element); }
  }
  function reconcileVideo() {
    if (!document.body) return;
    if (videoParent !== document.body) {
      wallpaperVideo?.destroy();
      videoParent = document.body;
      wallpaperVideo = MorrowVideo.create(videoParent, 'morrow-wallpaper-video');
    }
    wallpaperVideo.update(settings);
  }
  function render() {
    if (!document.documentElement) return;
    // Separate sheets keep an incomplete custom rule from breaking built-in rules.
    if (!baseStyle?.isConnected) {
      baseStyle = document.createElement('style');
      baseStyle.id = 'morrow-theme';
      document.documentElement.append(baseStyle);
    }
    if (!customStyle?.isConnected) {
      customStyle = document.createElement('style');
      customStyle.id = 'morrow-custom';
      document.documentElement.append(customStyle);
    }
    baseStyle.textContent = Morrow.buildCss(settings);
    customStyle.textContent = settings.enabled && settings.customCssEnabled ? settings.customCss : '';
    reconcileSurfaces();
    reconcileVideo();
  }
  // Discord navigates without a page reload. Repair owned layers and discover
  // replacement chat wrappers, without rescanning on each message/text update.
  let refreshQueued = false;
  const observer = new MutationObserver(records => {
    const missingLayer = !baseStyle?.isConnected || !customStyle?.isConnected ||
      (settings.enabled && Morrow.hasWallpaper(settings) && settings.wallpaperMode === 'video' && !document.getElementById('morrow-wallpaper-video'));
    const changedLayout = [...surfaces].some(element => !element.isConnected) || records.some(record =>
      [...record.addedNodes].some(node => node.nodeType === 1 &&
        (node.matches(messageSelector + ', #app-mount, body') || node.querySelector(messageSelector))));
    if ((!missingLayer && !changedLayout) || refreshQueued) return;
    refreshQueued = true;
    setTimeout(() => {
      refreshQueued = false;
      if (!baseStyle?.isConnected || !customStyle?.isConnected) render();
      else { reconcileSurfaces(); reconcileVideo(); }
    }, 50);
  });
  observer.observe(document, { childList: true, subtree: true });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const patch = {};
    for (const key of Object.keys(Morrow.defaults)) {
      if (changes[Morrow.prefix + key]) patch[key] = changes[Morrow.prefix + key].newValue ?? Morrow.defaults[key];
    }
    if (!Object.keys(patch).length) return;
    changedDuringLoad = true;
    settings = Morrow.normalize({ ...settings, ...patch });
    render();
  });
  chrome.storage.local.get(null).then(async stored => {
    if (changedDuringLoad) stored = await chrome.storage.local.get(null);
    settings = Morrow.decode(stored);
    render();
  }).catch(error => console.warn('Morrow could not load settings.', error));
  document.addEventListener('DOMContentLoaded', render, { once: true });
})();

(() => {
  // One owned video per surface; never attach handlers to Discord's media.
  function create(parent, id) {
    let video = null;
    let source = '';
    let blobUrl = '';
    let stopped = false;
    function playback() {
      if (!video) return;
      if (stopped || document.hidden) video.pause();
      else video.play().catch(() => { /* A blocked autoplay leaves the first frame visible. */ });
    }
    function clear() {
      if (video) { video.pause(); video.removeAttribute('src'); video.load(); video.remove(); }
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      video = null; blobUrl = ''; source = '';
    }
    document.addEventListener('visibilitychange', playback);
    return {
      update(settings, active = settings.enabled && Morrow.hasWallpaper(settings)) {
        if (!active || settings.wallpaperMode !== 'video') { clear(); return; }
        stopped = settings.reduceMotion || settings.wallpaperVideoPaused;
        if (source !== settings.wallpaperVideo || !video?.isConnected) {
          clear();
          source = settings.wallpaperVideo;
          const [header, data] = source.split(',');
          const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
          blobUrl = URL.createObjectURL(new Blob([bytes], { type: header.slice(5, header.indexOf(';')) }));
          video = document.createElement('video');
          video.id = id;
          video.muted = true; video.defaultMuted = true; video.loop = true;
          video.playsInline = true; video.preload = 'auto'; video.tabIndex = -1;
          video.setAttribute('aria-hidden', 'true'); video.disablePictureInPicture = true;
          video.setAttribute('disableRemotePlayback', '');
          video.addEventListener('loadeddata', playback);
          video.src = blobUrl;
          parent.prepend(video);
        }
        playback();
      },
      destroy() { document.removeEventListener('visibilitychange', playback); clear(); }
    };
  }
  globalThis.MorrowVideo = { create };
})();

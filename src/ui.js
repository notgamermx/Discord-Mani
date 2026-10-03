(() => {
  'use strict';
  let state = Morrow.normalize();
  let cssDirty = false;
  let toastTimer;
  let wallpaperBusy = false;
  let previewVideo;
  let queue = Promise.resolve();
  const $ = id => document.getElementById(id);
  const inputs = [...document.querySelectorAll('[data-setting]')];
  const accentColors = ['#aaa0fa', '#a4c9a1', '#8dc9e7', '#eca383', '#e4a3b7', '#d6c58e'];
  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
  }
  function setStatus(text) { if ($('save-status')) $('save-status').textContent = text; }
  function commit(patch, message) {
    state = Morrow.normalize({ ...state, ...patch });
    render();
    setStatus('Saving…');
    queue = queue.then(async () => {
      await MorrowStore.write(patch);
      setStatus(MorrowStore.extension ? '✓ All changes saved' : '✓ Saved in preview');
      if (message) toast(message);
      return true;
    }).catch(error => {
      setStatus('Could not save — try again');
      toast('Could not save settings. For videos, try a smaller file or use the installed extension.');
      console.error(error);
      return false;
    });
    return queue;
  }
  function makeThemes() {
    for (const [id, theme] of Object.entries(Morrow.themes)) {
      const button = document.createElement('button');
      button.className = 'theme-card';
      button.dataset.theme = id;
      button.title = theme.description;
      button.setAttribute('aria-label', theme.name + ' theme');
      for (const key of ['base', 'side', 'deep', 'text', 'accent']) button.style.setProperty('--t-' + key, theme[key]);
      // Markup is a fixed template; names are defined in the packaged theme table.
      button.innerHTML = '<div class="theme-art" aria-hidden="true"><span class="theme-art-rail"><i></i><i></i><i></i></span><span class="theme-art-side"><i></i><i></i><i></i><i></i></span><span class="theme-art-chat"><i></i><i></i><i></i><i></i></span></div><span class="theme-caption"><span></span><span class="theme-check">✓</span></span>';
      button.querySelector('.theme-caption>span').textContent = theme.name;
      button.addEventListener('click', () => commit({ theme: id, accent: theme.accent }));
      $('theme-grid').append(button);
    }
    if ($('accent-swatches')) for (const color of accentColors) {
      const button = document.createElement('button');
      button.className = 'swatch';
      button.dataset.color = color;
      button.style.setProperty('--swatch', color);
      button.setAttribute('aria-label', 'Accent ' + color);
      button.addEventListener('click', () => commit({ accent: color }));
      $('accent-swatches').append(button);
    }
  }
  function render() {
    for (const input of inputs) {
      const value = state[input.dataset.setting];
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
    }
    document.querySelectorAll('[data-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === state.theme)));
    document.querySelectorAll('[data-color]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === state.accent)));
    for (const key of ['radius', 'fontSize']) if ($(key + '-value')) $(key + '-value').textContent = state[key] + ' px';
    if ($('accent-value')) $('accent-value').textContent = state.accent.toUpperCase();
    if ($('enabled-word')) $('enabled-word').textContent = state.enabled ? 'on' : 'paused';
    if ($('custom-css') && !cssDirty) $('custom-css').value = state.customCss;
    if ($('wallpaper-thumbnail')) {
      const thumbnail = $('wallpaper-thumbnail');
      const isVideo = state.wallpaperMode === 'video';
      const hasMedia = Boolean(isVideo ? state.wallpaperVideo : state.wallpaper);
      thumbnail.style.backgroundImage = !isVideo && state.wallpaper ? `url("${state.wallpaper}")` : 'none';
      thumbnail.classList.toggle('has-image', !isVideo && Boolean(state.wallpaper));
      thumbnail.querySelector('span').textContent = isVideo ? '▶' : '▧';
      thumbnail.setAttribute('aria-label', hasMedia ? 'Your selected ' + (isVideo ? 'video' : 'wallpaper') : 'No wallpaper selected');
      $('wallpaper-status').textContent = hasMedia ? (state.wallpaperEnabled ? (isVideo ? 'Video wallpaper ready' : 'Your wallpaper is ready') : 'Wallpaper hidden') : 'Choose an ' + (isVideo ? 'MP4 or WebM' : 'image');
      $('remove-wallpaper').hidden = !hasMedia;
      $('wallpaperDim-value').textContent = state.wallpaperDim + '%';
      $('wallpaperBlur-value').textContent = state.wallpaperBlur + ' px';
      $('panelOpacity-value').textContent = state.panelOpacity + '%';
    }
    const preview = $('discord-preview');
    if (preview) {
      const theme = Morrow.themes[state.theme];
      for (const key of ['base', 'side', 'deep', 'raised', 'text', 'muted']) preview.style.setProperty('--p-' + key, theme[key]);
      preview.style.setProperty('--p-accent', state.accent);
      preview.style.setProperty('--p-radius', state.radius + 'px');
      preview.style.setProperty('--p-font', state.fontSize + 'px');
      preview.classList.toggle('is-compact', state.compact);
      preview.classList.toggle('hide-members', state.hideMembers);
      preview.classList.toggle('has-wallpaper', Morrow.hasWallpaper(state));
      preview.style.setProperty('--p-wallpaper', state.wallpaperMode === 'image' && state.wallpaper ? `url("${state.wallpaper}")` : 'none');
      preview.style.setProperty('--p-dim', state.wallpaperDim / 100);
      preview.style.setProperty('--p-blur', state.wallpaperBlur + 'px');
      preview.style.setProperty('--p-panel', state.panelOpacity + '%');
      preview.style.setProperty('--p-nav', state.autoNavColors ? (state.wallpaperMode === 'video' ? state.videoNavColor : state.imageNavColor) : theme.text);
      previewVideo ??= MorrowVideo.create(preview, 'morrow-preview-video');
      previewVideo.update(state, Morrow.hasWallpaper(state));
      $('preview-theme-name').textContent = theme.name + (state.enabled ? '' : ' · paused on Discord');
    }
  }
  async function init() {
    inputs.forEach(input => { input.disabled = true; });
    try { state = await MorrowStore.read(); }
    catch (error) { setStatus('Could not load settings'); toast('Could not load your saved settings. Reopen Morrow to try again.'); console.error(error); return; }
    makeThemes();
    render();
    inputs.forEach(input => { input.disabled = false; });
    setStatus(MorrowStore.extension ? '✓ All changes saved' : 'Preview mode');
    if ($('demo-banner')) $('demo-banner').hidden = MorrowStore.extension;
    MorrowStore.subscribe(next => { state = next; render(); });
    for (const input of inputs) {
      // Range dragging previews immediately; release commits once to extension storage.
      if (input.type === 'range' || input.type === 'color') input.addEventListener('input', () => {
        state[input.dataset.setting] = input.type === 'range' ? Number(input.value) : input.value;
        render();
      });
      input.addEventListener('change', () => commit({ [input.dataset.setting]: input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value }));
    }
    $('open-studio')?.addEventListener('click', () => {
      if (MorrowStore.extension) chrome.runtime.openOptionsPage();
      else window.open('options.html', '_blank');
    });
    $('upload-wallpaper')?.addEventListener('click', () => $('wallpaper-file').click());
    $('upload-video')?.addEventListener('click', () => $('video-file').click());
    $('wallpaper-file')?.addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file || wallpaperBusy) return;
      wallpaperBusy = true;
      $('upload-wallpaper').disabled = true;
      $('upload-video').disabled = true;
      $('remove-wallpaper').disabled = true;
      $('upload-wallpaper').textContent = 'Preparing image…';
      try {
        const prepared = await MorrowWallpaper.prepare(file);
        const previous = { wallpaper: state.wallpaper, wallpaperEnabled: state.wallpaperEnabled, wallpaperMode: state.wallpaperMode, imageNavColor: state.imageNavColor };
        if (!await commit({ wallpaper: prepared.data, imageNavColor: prepared.color, wallpaperMode: 'image', wallpaperEnabled: true }, 'Wallpaper saved. Navigation colors matched to your image.')) {
          Object.assign(state, previous); render();
        }
      } catch (error) { toast(error.message); }
      finally {
        wallpaperBusy = false;
        $('upload-wallpaper').disabled = false;
        $('upload-video').disabled = false;
        $('remove-wallpaper').disabled = false;
        $('upload-wallpaper').textContent = 'Choose image ↗';
        event.target.value = '';
      }
    });
    $('video-file')?.addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file || wallpaperBusy) return;
      wallpaperBusy = true;
      for (const id of ['upload-video', 'upload-wallpaper', 'remove-wallpaper']) $(id).disabled = true;
      $('upload-video').textContent = 'Preparing video…';
      try {
        const prepared = await MorrowWallpaper.prepareVideo(file);
        const previous = { wallpaperVideo: state.wallpaperVideo, wallpaperMode: state.wallpaperMode, wallpaperEnabled: state.wallpaperEnabled, videoNavColor: state.videoNavColor };
        if (!await commit({ wallpaperVideo: prepared.data, videoNavColor: prepared.color, wallpaperMode: 'video', wallpaperEnabled: true }, 'Video saved. It loops silently; hidden tabs pause automatically.')) {
          Object.assign(state, previous); render();
        }
      } catch (error) { toast(error.message); }
      finally {
        wallpaperBusy = false;
        for (const id of ['upload-video', 'upload-wallpaper', 'remove-wallpaper']) $(id).disabled = false;
        $('upload-video').textContent = 'Choose video ↗'; event.target.value = '';
      }
    });
    $('remove-wallpaper')?.addEventListener('click', () => commit(state.wallpaperMode === 'video' ? { wallpaperVideo: '', wallpaperMode: 'image' } : { wallpaper: '' }, 'Wallpaper removed.'));
    $('custom-css')?.addEventListener('input', () => { cssDirty = true; $('save-css').textContent = 'Save CSS ↗'; setStatus('Custom CSS has unsaved changes'); });
    $('save-css')?.addEventListener('click', async () => {
      const draft = $('custom-css').value;
      const saved = await commit({ customCss: draft }, 'Custom CSS saved' + (state.customCssEnabled ? '.' : '. Enable it when you’re ready.'));
      if (saved && $('custom-css').value === draft) { cssDirty = false; $('save-css').textContent = 'Saved ✓'; }
    });
    addEventListener('beforeunload', event => { if (cssDirty) { event.preventDefault(); event.returnValue = ''; } });
    $('export-settings')?.addEventListener('click', async () => {
      await queue;
      try {
        const latest = await MorrowStore.read();
        const blob = new Blob([JSON.stringify({ format: 'morrow-settings', version: 1, settings: latest }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'morrow-settings.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast(cssDirty ? 'Saved settings exported. Your unsaved CSS draft is not included.' : 'Your settings, ready to take with you.');
      } catch { toast('Could not export settings. Please try again.'); }
    });
    $('import-settings')?.addEventListener('click', () => $('import-file').click());
    $('import-file')?.addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        if (file.size > 9500000) throw new Error('That file is too large. Choose a Morrow settings export.');
        const imported = Morrow.parseImport(await file.text());
        // Imported CSS is kept for inspection, but does not become active automatically.
        imported.customCssEnabled = false;
        const saved = await commit(imported, 'Settings imported. Review custom CSS before enabling it.');
        if (saved) { cssDirty = false; render(); }
      } catch (error) { toast(error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message); }
      event.target.value = '';
    });
    $('reset-settings')?.addEventListener('click', () => $('reset-dialog').showModal());
    $('cancel-reset')?.addEventListener('click', () => $('reset-dialog').close());
    $('confirm-reset')?.addEventListener('click', async () => {
      const saved = await commit({ ...Morrow.defaults }, 'Back to a fresh canvas.');
      if (saved) { cssDirty = false; render(); $('reset-dialog').close(); }
    });
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach(item => item.classList.toggle('active', item === link));
    }));
    // Upgrade existing image wallpapers without asking the user to upload again.
    if (state.wallpaper && globalThis.MorrowWallpaper) {
      const original = state.wallpaper;
      MorrowWallpaper.colorForImage(original).then(color => {
        if (state.wallpaper === original && state.imageNavColor !== color) commit({ imageNavColor: color });
      }).catch(() => {});
    }
  }
  init();
})();

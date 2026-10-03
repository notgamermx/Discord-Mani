(() => {
  const extension = Boolean(globalThis.chrome?.storage?.local && globalThis.chrome?.runtime?.id);
  const subscribers = new Set();
  async function read() {
    if (extension) return Morrow.decode(await chrome.storage.local.get(null));
    return Morrow.normalize(JSON.parse(localStorage.getItem('morrow-preview') || '{}'));
  }
  async function write(patch) {
    if (extension) await chrome.storage.local.set(Morrow.encode(patch));
    else {
      const current = await read();
      const next = Morrow.normalize({ ...current, ...patch });
      localStorage.setItem('morrow-preview', JSON.stringify(next));
      subscribers.forEach(fn => fn(next));
    }
  }
  if (extension) chrome.storage.onChanged.addListener(async (_, area) => {
    if (area === 'local') {
      try { const settings = await read(); subscribers.forEach(fn => fn(settings)); }
      catch (error) { console.warn('Morrow settings refresh failed.', error); }
    }
  });
  else addEventListener('storage', async event => {
    if (event.key === 'morrow-preview') subscribers.forEach(fn => read().then(fn));
  });
  globalThis.MorrowStore = { extension, read, write, subscribe: fn => subscribers.add(fn) };
})();

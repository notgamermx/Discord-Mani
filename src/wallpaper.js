(() => {
  function navigationColor(source, width, height) {
    const sample = document.createElement('canvas'); sample.width = 32; sample.height = 32;
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, width, height, 0, 0, 32, 32);
    const pixels = ctx.getImageData(0, 0, 32, 32).data;
    let x = 0, y = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
      if (delta < 0.08 || pixels[i + 3] < 128) continue;
      const hue = (max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * Math.PI / 3;
      x += Math.cos(hue) * delta; y += Math.sin(hue) * delta;
    }
    const hue = Math.abs(x) + Math.abs(y) < 0.01 ? 260 : (Math.atan2(y, x) * 180 / Math.PI + 540) % 360;
    ctx.fillStyle = `hsl(${hue} 95% 83%)`; ctx.fillRect(0, 0, 1, 1);
    return '#' + [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('');
  }
  // Decode and resize locally. Images are never uploaded to a server.
  async function prepare(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
    if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      try { await image.decode(); } catch { throw new Error('That image could not be opened. Try another JPG, PNG, or WebP.'); }
      const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare this image.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/webp', 0.85);
      if (!Morrow.validWallpaper(data)) throw new Error('This image is too detailed to save. Try a smaller image.');
      return { data, color: navigationColor(canvas, canvas.width, canvas.height) };
    } finally { URL.revokeObjectURL(url); }
  }
  async function prepareVideo(file) {
    if (!['video/mp4', 'video/webm'].includes(file.type)) throw new Error('Choose an MP4 or WebM video.');
    if (file.size > Morrow.maxVideoBytes) throw new Error('Choose a short video smaller than 4 MB.');
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true; video.preload = 'auto'; video.playsInline = true;
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error('This video took too long to open. Try a smaller clip.')), 12000);
        function finish(error) {
          clearTimeout(timer); video.onloadeddata = null; video.onerror = null;
          if (error) reject(error); else resolve();
        }
        video.onloadeddata = () => finish();
        video.onerror = () => finish(new Error('This video cannot play in your browser. Try an H.264 MP4 or VP8/VP9 WebM.'));
        video.src = url;
      });
      const color = navigationColor(video, video.videoWidth, video.videoHeight);
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => Morrow.validVideo(reader.result) ? resolve(reader.result) : reject(new Error('Invalid video file.'));
        reader.onerror = () => reject(new Error('Could not read this video.'));
        reader.readAsDataURL(file);
      });
      return { data, color };
    } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
  }
  async function colorForImage(data) {
    const image = new Image(); image.src = data; await image.decode();
    return navigationColor(image, image.naturalWidth, image.naturalHeight);
  }
  globalThis.MorrowWallpaper = { prepare, prepareVideo, colorForImage };
})();

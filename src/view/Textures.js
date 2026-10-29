// Texturas generadas por código (sin recursos externos)
export function makeTextures(scene) {
  const tex = scene.textures;
  const canvas = (key, w, h, fn) => {
    if (tex.exists(key)) return;
    const c = tex.createCanvas(key, w, h);
    const ctx = c.getContext();
    fn(ctx, w, h);
    c.refresh();
  };
  canvas('dot', 64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  canvas('flare', 256, 256, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.15, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  canvas('spark', 64, 12, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0.2)');
    c.fillStyle = g; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2, h / 2.5, 0, 0, Math.PI * 2); c.fill();
  });
  canvas('star', 48, 48, (c, w, h) => {
    c.fillStyle = '#fff'; c.beginPath();
    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 5 : 22; const a = i * Math.PI / 4 - Math.PI / 2; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    c.closePath(); c.fill();
  });
  canvas('heart', 48, 44, (c, w, h) => {
    c.fillStyle = '#fff'; c.beginPath();
    c.moveTo(24, 40); c.bezierCurveTo(-8, 18, 8, -6, 24, 10); c.bezierCurveTo(40, -6, 56, 18, 24, 40); c.fill();
  });
  canvas('ring', 128, 128, (c, w, h) => {
    c.strokeStyle = '#fff'; c.lineWidth = 7; c.shadowColor = '#fff'; c.shadowBlur = 8;
    c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 10, 0, Math.PI * 2); c.stroke();
  });
  canvas('smoke', 64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  canvas('square', 10, 10, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 10, 10); });
  canvas('shard', 20, 20, (c) => { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(10, 0); c.lineTo(20, 20); c.lineTo(0, 16); c.closePath(); c.fill(); });
  canvas('note', 32, 40, (c) => {
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(10, 32, 8, 6, -0.4, 0, Math.PI * 2); c.fill();
    c.fillRect(16, 4, 3, 28); c.beginPath(); c.moveTo(16, 4); c.quadraticCurveTo(30, 10, 26, 22); c.quadraticCurveTo(26, 14, 19, 12); c.fill();
  });
  canvas('vignette', 256, 256, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  // ---- texturas suaves para auras y sombras (degradados con caída suave, sin bordes duros) ----
  canvas('softGlow', 128, 128, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2), r = Math.min(1, Math.hypot(dx, dy));
      const k = Math.pow(1 - r * r * (3 - 2 * r), 1.6); // smoothstep invertido: cae a 0 de forma continua
      const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * k);
    }
    c.putImageData(img, 0, 0);
  });
  canvas('flameSoft', 64, 128, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = y / h; // 0 punta (arriba) .. 1 base
      const half = (w / 2) * Math.pow(Math.sin(Math.min(1, v * 1.05) * Math.PI * 0.62), 1.2);
      const dx = Math.abs(x + 0.5 - w / 2) / Math.max(0.5, half);
      let k = dx >= 1 ? 0 : Math.pow(1 - dx * dx, 1.4) * Math.pow(Math.min(1, v * 1.4), 0.9) * Math.min(1, (1 - v) * 6);
      const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, k)));
    }
    c.putImageData(img, 0, 0);
  });
  canvas('shadowSoft', 128, 64, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2), r = Math.min(1, Math.hypot(dx, dy));
      const k = Math.pow(1 - r * r * (3 - 2 * r), 1.3);
      const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 0; img.data[i + 3] = Math.round(255 * k);
    }
    c.putImageData(img, 0, 0);
  });
  canvas('sparkleSoft', 64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.moveTo(w / 2, 2); c.quadraticCurveTo(w / 2, h / 2, w - 2, h / 2); c.quadraticCurveTo(w / 2, h / 2, w / 2, h - 2); c.quadraticCurveTo(w / 2, h / 2, 2, h / 2); c.quadraticCurveTo(w / 2, h / 2, w / 2, 2); c.fill();
  });
  canvas('glyph6', 48, 64, (c, w, h) => { c.font = 'bold 56px Anton, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#fff'; c.shadowBlur = 8; c.fillStyle = '#fff'; c.fillText('6', w / 2, h / 2 + 2); });
  canvas('glyph7', 48, 64, (c, w, h) => { c.font = 'bold 56px Anton, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#fff'; c.shadowBlur = 8; c.fillStyle = '#fff'; c.fillText('7', w / 2, h / 2 + 2); });
  canvas('scanlines', 4, 4, (c) => { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, 4, 1); });
}

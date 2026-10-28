// Escenarios procedurales con capas de parallax (Canvas 2D horneado) + elementos animados y público.
import { GROUND_Y, ARENA_W } from '../sim/constants.js';
import { rng } from '../sim/Battle.js';
import { hex } from './StickRenderer.js';

export const ARENAS = [
  { id: 'rooftop', name: 'Azotea Neón', music: 'fight1' },
  { id: 'dojo', name: 'Dojo del Aura', music: 'fight2' },
  { id: 'gym', name: 'Gimnasio del Insti', music: 'fight1' },
  { id: 'highway', name: 'Autopista Phonk', music: 'fight3' },
  { id: 'backrooms', name: 'Backrooms Nivel 0', music: 'fight3' },
  { id: 'mountain', name: 'Montaña Sigma', music: 'fight2' },
  { id: 'colosseum', name: 'Coliseo del Aura', music: 'boss' }
];

const X0 = -700, W = ARENA_W + 1400; // extensión horizontal de las capas
let UID = 0;

function vgrad(c, x, y, w, h, stops) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
function glowRect(c, x, y, w, h, col, blur) { c.save(); c.shadowColor = col; c.shadowBlur = blur; c.fillStyle = col; c.fillRect(x, y, w, h); c.restore(); }
function glowText(c, txt, x, y, size, col, blur, font = 'Anton, Impact, sans-serif') {
  c.save(); c.font = `${size}px ${font}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = col; c.shadowBlur = blur; c.fillStyle = col; c.fillText(txt, x, y); c.shadowBlur = blur / 2; c.fillStyle = '#ffffff'; c.globalAlpha = 0.85; c.fillText(txt, x, y); c.restore();
}
function mountains(c, r, y, h, w, col, rough = 0.5, x0 = 0) {
  c.fillStyle = col; c.beginPath(); c.moveTo(x0, y + h);
  let yy = y + h * 0.5;
  for (let x = x0; x <= x0 + w; x += 20) { yy += (r() - 0.5) * 60 * rough; yy = Math.max(y, Math.min(y + h * 0.85, yy)); c.lineTo(x, yy); }
  c.lineTo(x0 + w, y + h); c.closePath(); c.fill();
}

export class Arena {
  constructor(scene, id) {
    this.scene = scene;
    this.def = ARENAS.find(a => a.id === id) || ARENAS[0];
    this.id = this.def.id;
    this.objs = [];
    this.keys = [];
    this.t = 0;
    this.excite = 0.2;
    this.r = rng(this.id.length * 977 + 3);
    this.uid = ++UID;
    this.build();
  }

  bake(key, w, h, fn) {
    const full = 'arena_' + this.id + '_' + key + '_' + this.uid;
    const c = this.scene.textures.createCanvas(full, w, h);
    fn(c.getContext(), w, h);
    c.refresh();
    this.keys.push(full);
    return full;
  }
  layer(key, x, y, sf, scale = 1, depth = -100) {
    const im = this.scene.add.image(x, y, key).setOrigin(0, 0).setScrollFactor(sf, sf * 0.7 + 0.3).setScale(scale).setDepth(depth);
    this.objs.push(im);
    return im;
  }

  build() {
    const s = this.scene;
    this.dyn = s.add.graphics().setDepth(-40); this.objs.push(this.dyn);
    this.dynAdd = s.add.graphics().setDepth(-39).setBlendMode('ADD'); this.objs.push(this.dynAdd);
    this.front = s.add.graphics().setDepth(50); this.objs.push(this.front);
    this['build_' + this.id]();
    this.crowdG = s.add.graphics().setDepth(-45).setScrollFactor(0.92, 0.95); this.objs.push(this.crowdG);
    if (!this.crowd) this.crowd = [];
  }

  makeCrowd(n, y0, x0, x1, rows, scale, palette, seated = false) {
    const r = this.r;
    this.crowd = [];
    for (let i = 0; i < n; i++) {
      const row = i % rows;
      this.crowd.push({
        x: x0 + r() * (x1 - x0), y: y0 - row * 34 * scale, row, s: scale * (1 - row * 0.08),
        col: hex(palette[Math.floor(r() * palette.length)]), ph: r() * Math.PI * 2, sp: 0.6 + r() * 0.8, seated,
        phone: r() < 0.15, hat: r() < 0.25
      });
    }
    this.crowd.sort((a, b) => b.row - a.row);
  }

  react(mood, power = 1) {
    if (mood === 'cheer') this.excite = Math.min(1.5, this.excite + 0.5 * power);
    else if (mood === 'ooh') this.excite = Math.min(1.5, this.excite + 0.3 * power);
    else if (mood === 'flash') this.flashT = 30;
    this.mood = mood; this.moodT = 60;
  }

  update(dt) {
    this.t += dt;
    this.excite += (0.25 - this.excite) * 0.01;
    if (this.moodT > 0) this.moodT--;
    if (this.flashT > 0) this.flashT--;
    this.dyn.clear(); this.dynAdd.clear(); this.front.clear();
    const fn = this['update_' + this.id];
    if (fn) fn.call(this, this.t);
    this.drawCrowd();
  }

  drawCrowd() {
    const g = this.crowdG; g.clear();
    const t = this.t, ex = this.excite;
    for (const p of this.crowd) {
      const bounce = Math.max(0, Math.sin(t * 0.18 * p.sp + p.ph)) * 7 * ex * p.s;
      const s = p.s;
      const x = p.x, y = p.y - bounce;
      const c = p.col;
      const arms = ex > 0.55 || (this.mood === 'cheer' && this.moodT > 0);
      g.lineStyle(4 * s, c, 1);
      // cuerpo
      g.lineBetween(x, y - 34 * s, x, y - (p.seated ? 14 : 4) * s);
      if (!p.seated) { g.lineBetween(x, y - 4 * s, x - 6 * s, y + 14 * s); g.lineBetween(x, y - 4 * s, x + 6 * s, y + 14 * s); }
      const wave = Math.sin(t * 0.3 * p.sp + p.ph) * 0.5;
      if (arms) { g.lineBetween(x, y - 30 * s, x - 10 * s, y - 52 * s + wave * 6); g.lineBetween(x, y - 30 * s, x + 10 * s, y - 52 * s - wave * 6); }
      else { g.lineBetween(x, y - 30 * s, x - 8 * s, y - 14 * s); g.lineBetween(x, y - 30 * s, x + 8 * s, y - 14 * s); }
      g.fillStyle(c, 1); g.fillCircle(x, y - 42 * s, 7 * s);
      if (p.hat) { g.fillStyle(0x111111, 1); g.fillRect(x - 7 * s, y - 50 * s, 14 * s, 4 * s); }
      if (p.phone && (this.flashT > 0 || ex > 0.8) && Math.sin(t * 0.5 + p.ph) > 0.7) { g.fillStyle(0xffffff, 1); g.fillCircle(x + 10 * s, y - 52 * s, 3.5 * s); }
    }
  }

  destroy() {
    for (const o of this.objs) o.destroy();
    for (const k of this.keys) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    this.objs = []; this.keys = [];
  }

  // ======================= AZOTEA NEÓN =======================
  build_rooftop() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#07041a'], [0.55, '#241047'], [1, '#6a1b6e']]);
      for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7})`; c.fillRect(r() * w, r() * h * 0.7, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1); }
      c.save(); c.shadowColor = '#fff6d0'; c.shadowBlur = 60; c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(w * 0.62, h * 0.24, 38, 0, Math.PI * 2); c.fill(); c.restore();
      c.fillStyle = 'rgba(200,190,150,0.25)'; c.beginPath(); c.arc(w * 0.62 - 10, h * 0.24 - 8, 9, 0, 7); c.fill(); c.beginPath(); c.arc(w * 0.62 + 12, h * 0.24 + 10, 6, 0, 7); c.fill();
    });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 450, (c, w, h) => {
      for (let i = 0; i < 70; i++) {
        const bw = 20 + r() * 50, bh = 80 + r() * 260, x = r() * w;
        c.fillStyle = '#150b2c'; c.fillRect(x, h - bh, bw, bh);
        for (let wy = h - bh + 6; wy < h - 6; wy += 8) for (let wx = x + 4; wx < x + bw - 4; wx += 7) if (r() < 0.22) { c.fillStyle = r() < 0.7 ? 'rgba(255,209,102,0.7)' : 'rgba(125,249,255,0.6)'; c.fillRect(wx, wy, 3, 4); }
        if (r() < 0.15) { c.fillStyle = '#ff3355'; c.fillRect(x + bw / 2, h - bh - 14, 2, 14); }
      }
    });
    this.layer(far, X0, -10, 0.35, 2, -100);
    const mid = this.bake('mid', W / 2, 400, (c, w, h) => {
      for (let i = 0; i < 26; i++) {
        const bw = 60 + r() * 90, bh = 120 + r() * 200, x = i * (w / 26) + r() * 20;
        vgrad(c, x, h - bh, bw, bh, [[0, '#2a1650'], [1, '#120a24']]);
        for (let wy = h - bh + 10; wy < h - 10; wy += 14) for (let wx = x + 6; wx < x + bw - 6; wx += 12) if (r() < 0.3) { c.fillStyle = 'rgba(255,200,120,0.55)'; c.fillRect(wx, wy, 6, 7); }
        if (r() < 0.35) { const col = ['#ff2d95', '#00f0ff', '#ffd166', '#7cff6b'][Math.floor(r() * 4)]; glowRect(c, x + 8, h - bh + 14, bw - 16, 6, col, 18); }
      }
      glowText(c, 'AURA', w * 0.47, 120, 64, '#ff2d95', 30);
      glowText(c, '6 7', w * 0.71, 160, 40, '#00f0ff', 24);
    });
    this.layer(mid, X0, 120, 0.62, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      // pared del fondo de la azotea + barandilla
      vgrad(c, 0, 0, w, 60, [[0, '#1b1530'], [1, '#2a2340']]);
      c.strokeStyle = '#4a4266'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 6); c.lineTo(w, 6); c.stroke();
      for (let x = 0; x < w; x += 46) { c.fillStyle = '#4a4266'; c.fillRect(x, 6, 4, 34); }
      // unidades de aire acondicionado
      for (const ax of [520, 1150, 2350, 2900]) { vgrad(c, ax, -10 + 30, 140, 46, [[0, '#5b5677'], [1, '#3a3552']]); c.fillStyle = '#2a263d'; for (let k = 0; k < 6; k++) c.fillRect(ax + 10 + k * 20, 40, 12, 26); }
      // suelo
      vgrad(c, 0, 60, w, h - 60, [[0, '#3a3450'], [0.2, '#2c2740'], [1, '#14111f']]);
      c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 2;
      for (let x = -200; x < w + 200; x += 120) { c.beginPath(); c.moveTo(x, 60); c.lineTo(x + (x - w / 2) * 0.6, h); c.stroke(); }
      for (let y = 80; y < h; y += 40 + y * 0.12) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.fillStyle = 'rgba(255,45,149,0.08)'; c.fillRect(0, 60, w, 30);
    });
    this.layer(ground, X0, GROUND_Y - 60, 1, 1, -60);
    this.makeCrowd(34, GROUND_Y - 44, -200, 2200, 1, 0.9, ['#2d2a4a', '#3c3560', '#2b2050', '#3e2a5c', '#1f1d38']);
  }
  update_rooftop(t) {
    const g = this.dynAdd;
    const fl = Math.sin(t * 0.7) > -0.9 ? 1 : 0.2;
    g.fillStyle(0xff2d95, 0.05 * fl); g.fillRect(X0, GROUND_Y - 20, W, 40);
    g.fillStyle(0x00f0ff, 0.035); g.fillRect(X0, GROUND_Y + 40, W, 20);
  }

  // ======================= DOJO =======================
  build_dojo() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => { vgrad(c, 0, 0, w, h, [[0, '#120804'], [0.6, '#2c1608'], [1, '#4a260c']]); });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 420, (c, w, h) => {
      for (let x = 0; x < w; x += 110) {
        vgrad(c, x + 6, 40, 98, 300, [[0, '#f8e7c0'], [1, '#e8c98a']]);
        c.fillStyle = 'rgba(80,40,10,0.7)';
        for (let k = 1; k < 4; k++) c.fillRect(x + 6 + k * 24.5, 40, 3, 300);
        for (let k = 1; k < 6; k++) c.fillRect(x + 6, 40 + k * 50, 98, 3);
        c.fillStyle = '#2a1405'; c.fillRect(x, 30, 8, 330);
        if (r() < 0.4) { c.fillStyle = 'rgba(40,20,5,0.35)'; c.beginPath(); c.ellipse(x + 55, 200, 18, 60, 0, 0, 7); c.fill(); }
      }
      c.fillStyle = '#2a1405'; c.fillRect(0, 20, w, 24); c.fillRect(0, 340, w, 30);
    });
    this.layer(far, X0, -40, 0.4, 2, -100);
    const mid = this.bake('mid', W / 2, 420, (c, w, h) => {
      for (let x = 60; x < w; x += 300) { vgrad(c, x, 0, 34, h, [[0, '#3a1d08'], [1, '#1c0d03']]); }
      for (let x = 210; x < w; x += 600) {
        c.fillStyle = '#9b1c1c'; c.fillRect(x - 40, 30, 80, 190); c.fillStyle = '#c62828'; c.fillRect(x - 34, 30, 68, 184);
        c.save(); c.font = '70px serif'; c.textAlign = 'center'; c.fillStyle = '#1a0a02'; c.fillText('気', x, 150); c.restore();
      }
    });
    this.layer(mid, X0, -60, 0.7, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, 60, [[0, '#3a1d08'], [1, '#5c3112']]);
      vgrad(c, 0, 60, w, h, [[0, '#a9692e'], [0.25, '#8a5222'], [1, '#3d200a']]);
      c.strokeStyle = 'rgba(50,25,5,0.5)'; c.lineWidth = 2;
      for (let y = 60; y < h; y += 26 + (y - 60) * 0.15) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      for (let i = 0; i < 400; i++) { const y = 60 + r() * (h - 60); c.beginPath(); c.moveTo(r() * w, y); c.lineTo(r() * w, y); c.stroke(); }
      const rg = c.createLinearGradient(0, 60, 0, 200); rg.addColorStop(0, 'rgba(255,220,150,0.25)'); rg.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = rg; c.fillRect(0, 60, w, 140);
    });
    this.layer(ground, X0, GROUND_Y - 60, 1, 1, -60);
    this.lanterns = [];
    for (let x = -200; x < 2300; x += 380) this.lanterns.push({ x, ph: r() * 6 });
    this.makeCrowd(26, GROUND_Y - 40, -200, 2200, 1, 0.85, ['#f2f2f2', '#e0d6c8', '#2b2b2b', '#1e3a5f'], true);
  }
  update_dojo(t) {
    const g = this.dyn, ga = this.dynAdd;
    for (const l of this.lanterns) {
      const sw = Math.sin(t * 0.03 + l.ph) * 6;
      const x = l.x + sw, y = 120;
      g.lineStyle(2, 0x1a0a02, 1); g.lineBetween(l.x, -200, x, y - 30);
      g.fillStyle(0xd62828, 1); g.fillEllipse(x, y, 40, 56); g.fillStyle(0x1a0a02, 1); g.fillRect(x - 12, y - 32, 24, 6); g.fillRect(x - 12, y + 26, 24, 6);
      ga.fillStyle(0xffaa55, 0.18 + Math.sin(t * 0.2 + l.ph) * 0.03); ga.fillCircle(x, y, 70);
    }
  }

  // ======================= GIMNASIO =======================
  build_gym() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => { vgrad(c, 0, 0, w, h, [[0, '#2b3a55'], [1, '#4e6585']]); });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 460, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#3d4f6e'], [1, '#556b8e']]);
      for (let x = 30; x < w; x += 160) { vgrad(c, x, 30, 120, 70, [[0, '#cfe8ff'], [1, '#90b8e0']]); c.fillStyle = '#3d4f6e'; c.fillRect(x + 58, 30, 4, 70); c.fillRect(x, 63, 120, 4); }
      const sx = w * 0.5;
      c.fillStyle = '#111'; c.fillRect(sx - 110, 120, 220, 90); c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.strokeRect(sx - 110, 120, 220, 90);
      c.font = '28px Anton, Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ff4444'; c.fillText('LOCAL 67', sx - 52, 175); c.fillStyle = '#44ff88'; c.fillText('VISITA 41', sx + 52, 175);
      for (const [bx, col, txt] of [[w * 0.2, '#ffd166', 'GO AURA!'], [w * 0.8, '#ff4d6d', 'SIGMA FC']]) { c.fillStyle = col; c.beginPath(); c.moveTo(bx - 70, 120); c.lineTo(bx + 70, 120); c.lineTo(bx, 210); c.closePath(); c.fill(); c.fillStyle = '#111'; c.font = '20px Anton, Impact, sans-serif'; c.fillText(txt, bx, 150); }
    });
    this.layer(far, X0, -180, 0.4, 2, -100);
    const mid = this.bake('mid', W / 2, 300, (c, w, h) => {
      for (let i = 0; i < 6; i++) { const y = 40 + i * 40; vgrad(c, 0, y, w, 40, [[0, '#8a6a43'], [0.15, '#b38b58'], [1, '#6b4f2f']]); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, y + 34, w, 6); }
    });
    this.layer(mid, X0, 20, 0.8, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, 60, [[0, '#5a4127'], [1, '#6b4f2f']]);
      vgrad(c, 0, 60, w, h, [[0, '#e0a868'], [0.2, '#c98d4b'], [1, '#7a5228']]);
      c.strokeStyle = 'rgba(120,70,20,0.35)'; c.lineWidth = 1;
      for (let x = 0; x < w; x += 18) { c.beginPath(); c.moveTo(x, 60); c.lineTo(x + (x - w / 2) * 0.5, h); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(w / 2, 60); c.lineTo(w / 2, h); c.stroke();
      c.beginPath(); c.ellipse(w / 2, 150, 170, 60, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(220,40,40,0.8)'; c.beginPath(); c.moveTo(0, 90); c.lineTo(w, 90); c.stroke();
      const rg = c.createLinearGradient(0, 60, 0, 220); rg.addColorStop(0, 'rgba(255,255,255,0.22)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = rg; c.fillRect(0, 60, w, 160);
    });
    this.layer(ground, X0, GROUND_Y - 60, 1, 1, -60);
    this.makeCrowd(60, GROUND_Y - 60, -300, 2300, 4, 0.8, ['#ff4d6d', '#4cc9f0', '#ffd166', '#7bd389', '#f4f4f8', '#c084fc', '#ff9f1c'], true);
    this.crowd.forEach(p => { p.y = GROUND_Y - 70 - p.row * 40; });
  }
  update_gym(t) {
    const g = this.dynAdd;
    for (let i = 0; i < 5; i++) { const x = 200 + i * 420; g.fillStyle(0xcfe8ff, 0.04); g.fillTriangle(x, -300, x + 80, -300, x + 300, GROUND_Y + 40); }
    void t;
  }

  // ======================= AUTOPISTA PHONK =======================
  build_highway() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#0d0221'], [0.45, '#3b0a57'], [0.75, '#ff2d75'], [1, '#ff9e3d']]);
      const sx = w * 0.5, sy = h * 0.78;
      c.save(); c.shadowColor = '#ff2d75'; c.shadowBlur = 50;
      const sg = c.createLinearGradient(0, sy - 90, 0, sy + 90); sg.addColorStop(0, '#ffe66d'); sg.addColorStop(1, '#ff2d75'); c.fillStyle = sg;
      c.beginPath(); c.arc(sx, sy, 90, 0, Math.PI * 2); c.fill(); c.restore();
      c.fillStyle = '#3b0a57'; for (let k = 0; k < 7; k++) c.fillRect(sx - 100, sy + k * 13, 200, 2 + k * 1.2);
      for (let i = 0; i < 80; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.8})`; c.fillRect(r() * w, r() * h * 0.45, 1.5, 1.5); }
    });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 400, (c, w, h) => {
      mountains(c, r, 120, 280, w, '#2a0845', 0.9);
      c.strokeStyle = '#ff2d95'; c.lineWidth = 1.5; c.globalAlpha = 0.5;
      mountains(c, r, 200, 200, w, '#1a0530', 0.7);
      c.globalAlpha = 1;
      for (let i = 0; i < 120; i++) { c.fillStyle = r() < 0.5 ? '#ffd166' : '#ff6b9a'; c.fillRect(r() * w, 360 + r() * 30, 2, 2); }
    });
    this.layer(far, X0, -60, 0.3, 2, -100);
    const mid = this.bake('mid', W / 2, 300, (c, w, h) => {
      vgrad(c, 0, 170, w, 130, [[0, '#1b1b2b'], [1, '#101018']]);
      c.fillStyle = '#ffd166'; for (let x = 0; x < w; x += 60) c.fillRect(x, 232, 30, 3);
      for (let x = 30; x < w; x += 240) { c.fillStyle = '#2a2a3a'; c.fillRect(x, 40, 6, 135); c.fillRect(x, 40, 40, 6); c.save(); c.shadowColor = '#ffcf7a'; c.shadowBlur = 30; c.fillStyle = '#fff1c4'; c.fillRect(x + 30, 44, 14, 5); c.restore(); }
      c.fillStyle = '#5c5c70'; c.fillRect(0, 160, w, 8); for (let x = 0; x < w; x += 40) c.fillRect(x, 160, 4, 22);
    });
    this.layer(mid, X0, 80, 0.6, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#2b2b3a'], [0.15, '#22222e'], [1, '#0c0c12']]);
      for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.05})`; c.fillRect(r() * w, r() * h, 2, 2); }
      c.fillStyle = '#ffd166'; for (let x = 0; x < w; x += 140) c.fillRect(x, 120, 80, 6);
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 10;
      for (let k = 0; k < 6; k++) { c.beginPath(); const y = 80 + r() * 200; c.moveTo(r() * w, y); c.bezierCurveTo(r() * w, y + 60, r() * w, y - 60, r() * w, y + r() * 40); c.stroke(); }
    });
    this.layer(ground, X0, GROUND_Y - 30, 1, 1, -60);
    this.cars = [];
    this.makeCrowd(22, GROUND_Y - 34, -250, 2250, 1, 0.85, ['#ff2d95', '#00f0ff', '#ffd166', '#a0a0c0', '#7b2cbf']);
  }
  update_highway(t) {
    const g = this.dyn, ga = this.dynAdd;
    if (this.r() < 0.012) this.cars.push({ x: this.r() < 0.5 ? -800 : 2800, dir: 0, y: 330 + this.r() * 40, col: [0xff2d95, 0x00f0ff, 0xffd166, 0xffffff][Math.floor(this.r() * 4)], sp: 18 + this.r() * 12 });
    for (const c of this.cars) {
      if (!c.dir) c.dir = c.x < 0 ? 1 : -1;
      c.x += c.dir * c.sp;
      const x = c.x, y = c.y;
      g.fillStyle(0x0a0a14, 1); g.fillRoundedRect(x - 60, y - 22, 120, 26, 8); g.fillRoundedRect(x - 34, y - 38, 64, 20, 8);
      g.fillStyle(c.col, 1); g.fillRect(x - 58, y - 10, 116, 3);
      ga.fillStyle(0xff2222, 0.6); ga.fillCircle(x - c.dir * 58, y - 12, 6);
      ga.fillStyle(0xff2222, 0.12); ga.fillRect(c.dir > 0 ? x - 360 : x + 60, y - 16, 300, 8);
      ga.fillStyle(0xfff1c4, 0.25); ga.fillTriangle(x + c.dir * 60, y - 12, x + c.dir * 260, y - 40, x + c.dir * 260, y + 10);
    }
    this.cars = this.cars.filter(c => c.x > -1000 && c.x < 3000);
    void t;
  }

  // ======================= BACKROOMS =======================
  build_backrooms() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => { vgrad(c, 0, 0, w, h, [[0, '#8f7f3a'], [1, '#c9b458']]); });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 450, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#b5a24a'], [1, '#d6c264']]);
      c.strokeStyle = 'rgba(120,100,30,0.25)'; c.lineWidth = 2;
      for (let x = 0; x < w; x += 14) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let x = 80; x < w; x += 260 + r() * 120) { vgrad(c, x, 150, 90, 300, [[0, '#2a2410'], [1, '#14110a']]); c.strokeStyle = '#8f7f3a'; c.lineWidth = 6; c.strokeRect(x, 150, 90, 300); }
    });
    this.layer(far, X0, -150, 0.45, 2, -100);
    const mid = this.bake('mid', W / 2, 200, (c, w, h) => {
      c.fillStyle = '#e8dfb0'; c.fillRect(0, 0, w, 30);
      for (let x = 20; x < w; x += 170) { c.save(); c.shadowColor = '#fffbe0'; c.shadowBlur = 30; c.fillStyle = '#fffbe8'; c.fillRect(x, 8, 110, 16); c.restore(); }
      for (let x = 0; x < w; x += 85) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x, 0, 2, 30); }
    });
    this.layer(mid, X0, -460, 0.8, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, 60, [[0, '#b5a24a'], [1, '#9c8a3a']]);
      vgrad(c, 0, 60, w, h, [[0, '#9b8740'], [1, '#4a3f18']]);
      for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '60,50,20' : '200,180,100'},${r() * 0.15})`; c.fillRect(r() * w, 60 + r() * (h - 60), 2, 2); }
      c.fillStyle = 'rgba(60,50,20,0.25)'; for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(r() * w, 100 + r() * 200, 60 + r() * 80, 15 + r() * 15, 0, 0, 7); c.fill(); }
    });
    this.layer(ground, X0, GROUND_Y - 60, 1, 1, -60);
    this.entity = { x: 400 + this.r() * 1200, t: 0 };
  }
  update_backrooms(t) {
    const g = this.dynAdd;
    const flick = Math.sin(t * 0.9) > 0.97 || Math.sin(t * 0.13) > 0.995;
    g.fillStyle(0xfffbe0, flick ? 0.0 : 0.06); g.fillRect(X0, -600, W, 1300);
    if (flick) { this.dyn.fillStyle(0x000000, 0.25); this.dyn.fillRect(X0, -600, W, 1300); }
    const e = this.entity; e.t++;
    if (e.t % 900 < 120) {
      const a = Math.sin((e.t % 900) / 120 * Math.PI) * 0.6;
      const d = this.dyn; d.fillStyle(0x000000, a); d.fillRect(e.x - 8, GROUND_Y - 150, 16, 90); d.fillCircle(e.x, GROUND_Y - 165, 16);
      d.fillStyle(0xffffff, a); d.fillCircle(e.x - 5, GROUND_Y - 168, 2); d.fillCircle(e.x + 5, GROUND_Y - 168, 2);
    } else if (e.t % 900 === 121) e.x = 300 + this.r() * 1400;
  }

  // ======================= MONTAÑA SIGMA =======================
  build_mountain() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#1d1238'], [0.45, '#6b2d5c'], [0.75, '#ff7e5f'], [1, '#feb47b']]);
      c.save(); c.shadowColor = '#ffd27f'; c.shadowBlur = 80; c.fillStyle = '#ffe8b0'; c.beginPath(); c.arc(w * 0.35, h * 0.72, 48, 0, Math.PI * 2); c.fill(); c.restore();
      for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(255,200,180,0.18)'; c.beginPath(); c.ellipse(r() * w, h * 0.3 + r() * h * 0.3, 80 + r() * 90, 10 + r() * 8, 0, 0, 7); c.fill(); }
    });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 450, (c, w, h) => {
      mountains(c, r, 40, 410, w, '#4a2d63', 1.4);
      c.fillStyle = 'rgba(255,255,255,0.7)';
      mountains(c, r, 120, 330, w, '#3a2452', 1.2);
      mountains(c, r, 220, 230, w, '#2a1a3e', 1);
    });
    this.layer(far, X0, -120, 0.3, 2, -100);
    const mid = this.bake('mid', W / 2, 300, (c, w, h) => {
      for (let x = 0; x < w; x += 18 + r() * 30) { const th = 60 + r() * 110; c.fillStyle = '#16102a'; c.beginPath(); c.moveTo(x, h); c.lineTo(x + 14, h - th); c.lineTo(x + 28, h); c.closePath(); c.fill(); }
      c.fillStyle = '#1c1430'; c.fillRect(w * 0.62, h - 150, 120, 150); c.beginPath(); c.moveTo(w * 0.62 - 20, h - 150); c.lineTo(w * 0.62 + 60, h - 200); c.lineTo(w * 0.62 + 140, h - 150); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,200,120,0.7)'; c.fillRect(w * 0.62 + 50, h - 110, 20, 26);
    });
    this.layer(mid, X0, 260, 0.65, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#5a4a5e'], [0.12, '#463a4c'], [1, '#1a1420']]);
      c.fillStyle = '#3f6b3a'; c.fillRect(0, 50, w, 10); for (let x = 0; x < w; x += 6) { c.fillRect(x, 44 - r() * 10, 2, 16); }
      for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(30,20,35,${0.3 + r() * 0.4})`; c.beginPath(); c.ellipse(r() * w, 80 + r() * (h - 80), 8 + r() * 30, 4 + r() * 10, 0, 0, 7); c.fill(); }
    });
    this.layer(ground, X0, GROUND_Y - 50, 1, 1, -60);
    this.birds = Array.from({ length: 6 }, () => ({ x: this.r() * 2000, y: -100 + this.r() * 200, sp: 1 + this.r() }));
    this.makeCrowd(12, GROUND_Y - 40, -100, 2100, 1, 0.85, ['#e07a1f', '#c45e10', '#8a3b12'], false);
  }
  update_mountain(t) {
    const g = this.dyn;
    g.lineStyle(2, 0x1a0e24, 0.8);
    for (const b of this.birds) {
      b.x += b.sp; if (b.x > 2600) b.x = -600;
      const f = Math.sin(t * 0.3 + b.x) * 5;
      g.lineBetween(b.x - 8, b.y - f, b.x, b.y); g.lineBetween(b.x, b.y, b.x + 8, b.y - f);
    }
  }

  // ======================= COLISEO =======================
  build_colosseum() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#05030f'], [0.6, '#1a0b2e'], [1, '#3a1450']]);
      for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.6})`; c.fillRect(r() * w, r() * h * 0.6, 1.5, 1.5); }
    });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 460, (c, w, h) => {
      vgrad(c, 0, 80, w, h - 80, [[0, '#1d1233'], [1, '#2c1b48']]);
      for (let row = 0; row < 14; row++) for (let x = 0; x < w; x += 6) if (r() < 0.8) { c.fillStyle = ['#ff4d6d', '#4cc9f0', '#ffd166', '#f4f4f8', '#c084fc', '#7bd389'][Math.floor(r() * 6)]; c.globalAlpha = 0.35 + r() * 0.3; c.fillRect(x, 100 + row * 22 + r() * 4, 3, 5); }
      c.globalAlpha = 1;
      const sx = w * 0.5;
      c.fillStyle = '#0a0612'; c.fillRect(sx - 150, 0, 300, 140); c.strokeStyle = '#c084fc'; c.lineWidth = 4; c.strokeRect(sx - 150, 0, 300, 140);
      glowText(c, 'AURA LEGENDS', sx, 70, 40, '#c084fc', 26);
    });
    this.layer(far, X0, -200, 0.35, 2, -100);
    const mid = this.bake('mid', W / 2, 260, (c, w, h) => {
      vgrad(c, 0, 120, w, 140, [[0, '#2a1840'], [1, '#160c24']]);
      for (let x = 40; x < w; x += 220) { const col = ['#ff4d6d', '#ffd166', '#4cc9f0', '#c084fc'][Math.floor(r() * 4)]; c.fillStyle = col; c.fillRect(x, 140, 120, 60); c.fillStyle = '#0a0612'; c.font = '22px Anton, Impact, sans-serif'; c.textAlign = 'center'; c.fillText(['SIUUU', 'MEWING', '67', 'SIGMA', 'RIZZ', 'AURA+1000'][Math.floor(r() * 6)], x + 60, 180); }
    });
    this.layer(mid, X0, 230, 0.75, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#2a1d3a'], [0.15, '#1f1530'], [1, '#09060f']]);
      c.strokeStyle = 'rgba(192,132,252,0.18)'; c.lineWidth = 2;
      for (let y = 70; y < h; y += 30) for (let x = (y / 30 % 2) * 30; x < w; x += 60) { c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 13); } c.closePath(); c.stroke(); }
      c.save(); c.shadowColor = '#c084fc'; c.shadowBlur = 40; c.strokeStyle = '#c084fc'; c.lineWidth = 4; c.beginPath(); c.ellipse(w / 2, 150, 640, 70, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    });
    this.layer(ground, X0, GROUND_Y - 60, 1, 1, -60);
    this.makeCrowd(70, GROUND_Y - 70, -350, 2350, 4, 0.78, ['#ff4d6d', '#4cc9f0', '#ffd166', '#f4f4f8', '#c084fc', '#7bd389', '#ff9f1c'], false);
    this.crowd.forEach(p => { p.y = GROUND_Y - 80 - p.row * 36; });
  }
  update_colosseum(t) {
    const g = this.dynAdd;
    for (let i = 0; i < 4; i++) {
      const base = -200 + i * 800;
      const ang = Math.sin(t * 0.012 + i * 1.7) * 0.5;
      const tx = base + 400 + Math.sin(ang) * 900, ty = GROUND_Y;
      g.fillStyle([0xc084fc, 0x4cc9f0, 0xff4d6d, 0xffd166][i], 0.07 + this.excite * 0.03);
      g.fillTriangle(base + 400, -500, tx - 120, ty, tx + 120, ty);
      g.fillStyle(0xffffff, 0.05); g.fillEllipse(tx, ty + 10, 260, 40);
    }
  }
}

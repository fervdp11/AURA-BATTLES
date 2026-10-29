// Escenarios procedurales atmosféricos: capas de parallax horneadas (Canvas 2D), niebla en movimiento,
// partículas ambientales, haces de luz y suelos con reflejo. Sin público.
import { GROUND_Y, ARENA_W } from '../sim/constants.js';
import { rng } from '../sim/Battle.js';

export const ARENAS = [
  { id: 'rooftop', name: 'Azotea Neón', music: 'fight1' },
  { id: 'dojo', name: 'Dojo del Aura', music: 'fight2' },
  { id: 'gym', name: 'Gimnasio del Insti', music: 'fight1' },
  { id: 'highway', name: 'Autopista Phonk', music: 'fight3' },
  { id: 'backrooms', name: 'Backrooms Nivel 0', music: 'fight3' },
  { id: 'mountain', name: 'Montaña Sigma', music: 'fight2' },
  { id: 'colosseum', name: 'Coliseo del Aura', music: 'boss' }
];

// Ambiente de cada escenario: partículas, niebla, reflejo del suelo y luz
const ATMO = {
  rooftop: { parts: 'rain', n: 90, col: 0x9fb8ff, fog: 0x3a1d6e, fogA: 0.22, reflect: 0.2, tint: 0xff2d95 },
  dojo: { parts: 'petal', n: 26, col: 0xffb7d5, fog: 0x5a2e10, fogA: 0.16, reflect: 0.12, tint: 0xffaa55 },
  gym: { parts: 'dust', n: 50, col: 0xfff3d0, fog: 0x8aa2c8, fogA: 0.1, reflect: 0.22, tint: 0xcfe8ff },
  highway: { parts: 'streak', n: 24, col: 0xff9ecf, fog: 0x5b0f4f, fogA: 0.2, reflect: 0.16, tint: 0xff2d75 },
  backrooms: { parts: 'dust', n: 40, col: 0xfff6c0, fog: 0xc9b458, fogA: 0.16, reflect: 0.08, tint: 0xfffbe0 },
  mountain: { parts: 'snow', n: 80, col: 0xffffff, fog: 0xffc3a0, fogA: 0.14, reflect: 0, tint: 0xffb37b },
  colosseum: { parts: 'ember', n: 50, col: 0xffa040, fog: 0x2c1b48, fogA: 0.24, reflect: 0.18, tint: 0xc084fc }
};

const X0 = -700, W = ARENA_W + 1400; // extensión horizontal de las capas
let UID = 0;

function vgrad(c, x, y, w, h, stops) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
function rglow(c, x, y, r, col, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}
function glowRect(c, x, y, w, h, col, blur) { c.save(); c.shadowColor = col; c.shadowBlur = blur; c.fillStyle = col; c.fillRect(x, y, w, h); c.restore(); }
function glowText(c, txt, x, y, size, col, blur, font = 'Anton, Impact, sans-serif') {
  c.save(); c.font = `${size}px ${font}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = col; c.shadowBlur = blur; c.fillStyle = col; c.fillText(txt, x, y); c.shadowBlur = blur / 2; c.fillStyle = '#ffffff'; c.globalAlpha = 0.85; c.fillText(txt, x, y); c.restore();
}
function ridge(c, r, y, h, w, col, rough = 0.5, step = 20) {
  c.fillStyle = col; c.beginPath(); c.moveTo(0, y + h);
  let yy = y + h * 0.5;
  for (let x = 0; x <= w; x += step) { yy += (r() - 0.5) * 60 * rough; yy = Math.max(y, Math.min(y + h * 0.85, yy)); c.lineTo(x, yy); }
  c.lineTo(w, y + h); c.closePath(); c.fill();
}
// niebla horizontal suave con huecos (se repite en x)
function fogTex(c, w, h, r, col) {
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = h * 0.3 + r() * h * 0.5, rx = 120 + r() * 260;
    const g = c.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.save(); c.translate(x, y); c.scale(1, 0.32); c.translate(-x, -y); c.fillRect(x - rx, y - rx, rx * 2, rx * 2); c.restore();
    if (x + rx > w) { c.save(); c.translate(-w, 0); c.fillStyle = g; c.translate(x, y); c.scale(1, 0.32); c.translate(-x, -y); c.fillRect(x - rx, y - rx, rx * 2, rx * 2); c.restore(); }
  }
}
const rgba = (n, a) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

export class Arena {
  constructor(scene, id, o = {}) {
    this.scene = scene;
    this.def = ARENAS.find(a => a.id === id) || ARENAS[0];
    this.id = this.def.id;
    this.atmo = ATMO[this.id];
    // dirección horizontal de la luz principal (las sombras se proyectan hacia el lado contrario)
    this.lightDx = { rooftop: -0.25, dojo: 0.3, gym: 0.15, highway: -0.35, backrooms: 0, mountain: 0.45, colosseum: 0.2 }[this.id] ?? 0.2;
    this.reflect = o.quality === 'baja' ? 0 : this.atmo.reflect;
    this.q = o.quality === 'baja' ? 0.5 : 1;
    this.objs = [];
    this.keys = [];
    this.t = 0;
    this.excite = 0.2;
    this.pulse = 0;
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
    this.back = s.add.graphics().setDepth(-95).setScrollFactor(0.5, 0.65); this.objs.push(this.back);
    this.backAdd = s.add.graphics().setDepth(-94).setScrollFactor(0.5, 0.65).setBlendMode('ADD'); this.objs.push(this.backAdd);
    this.front = s.add.graphics().setDepth(50); this.objs.push(this.front);
    this.frontAdd = s.add.graphics().setDepth(51).setBlendMode('ADD'); this.objs.push(this.frontAdd);
    this['build_' + this.id]();
    // niebla en dos profundidades (detrás de los luchadores y una capa baja delante)
    const A = this.atmo;
    const fog = this.bake('fog', 1024, 256, (c, w, h) => fogTex(c, w, h, this.r, rgba(A.fog, 0.9)));
    this.fogBack = s.add.tileSprite(X0, GROUND_Y - 330, W, 256, fog).setOrigin(0, 0).setScrollFactor(0.8, 0.9).setDepth(-70).setAlpha(A.fogA).setBlendMode('ADD');
    this.fogFront = s.add.tileSprite(X0, GROUND_Y - 150, W, 256, fog).setOrigin(0, 0).setDepth(45).setAlpha(A.fogA * 0.55).setBlendMode('ADD').setTileScale(1.4, 1);
    this.objs.push(this.fogBack, this.fogFront);
    // partículas ambientales
    this.parts = [];
    const n = Math.round(A.n * this.q);
    for (let i = 0; i < n; i++) this.parts.push(this.spawn(true));
  }

  spawn(init) {
    const r = this.r, A = this.atmo;
    const x = WALL_L_VIEW + r() * (WALL_R_VIEW - WALL_L_VIEW);
    const y = init ? GROUND_Y - 900 + r() * 920 : GROUND_Y - 900 - r() * 100;
    switch (A.parts) {
      case 'rain': return { x, y, vx: -2, vy: 16 + r() * 6, s: 1, a: 0.25 + r() * 0.25 };
      case 'petal': return { x, y, vx: 0.6 + r() * 0.8, vy: 0.7 + r() * 0.8, s: 3 + r() * 3, a: 0.8, ph: r() * 6.28, rot: r() * 6 };
      case 'snow': return { x, y, vx: 0.8 + r() * 1.5, vy: 0.8 + r() * 1.4, s: 1 + r() * 2.5, a: 0.5 + r() * 0.5, ph: r() * 6.28 };
      case 'ember': return { x, y: init ? y : GROUND_Y + 20, vx: (r() - 0.5) * 0.6, vy: -(0.6 + r() * 1.4), s: 1 + r() * 2.2, a: 0.6 + r() * 0.4, ph: r() * 6.28 };
      case 'streak': return { x: init ? x : WALL_R_VIEW + 200, y: GROUND_Y - 40 - r() * 600, vx: -(30 + r() * 30), vy: 0, s: 60 + r() * 140, a: 0.08 + r() * 0.1 };
      default: return { x, y: GROUND_Y - r() * 700, vx: (r() - 0.5) * 0.3, vy: (r() - 0.5) * 0.2, s: 1 + r() * 1.8, a: 0.15 + r() * 0.3, ph: r() * 6.28 };
    }
  }

  // reacciones del entorno a la pelea (pulso de luz, ráfaga de partículas)
  react(mood, power = 1) {
    if (mood === 'cheer') { this.excite = Math.min(1.5, this.excite + 0.5 * power); this.pulse = Math.min(1, this.pulse + 0.6 * power); }
    else if (mood === 'ooh') { this.excite = Math.min(1.5, this.excite + 0.3 * power); this.pulse = Math.min(1, this.pulse + 0.3 * power); }
    else if (mood === 'flash') this.flashT = 30;
    this.mood = mood; this.moodT = 60;
  }

  update(dt) {
    this.t += dt;
    this.excite += (0.25 - this.excite) * 0.01;
    this.pulse *= 0.95;
    if (this.moodT > 0) this.moodT--;
    if (this.flashT > 0) this.flashT--;
    this.dyn.clear(); this.dynAdd.clear(); this.front.clear(); this.frontAdd.clear(); this.back.clear(); this.backAdd.clear();
    this.fogBack.tilePositionX += 0.25 * dt; this.fogFront.tilePositionX -= 0.45 * dt;
    this.fogBack.setAlpha(this.atmo.fogA * (1 + Math.sin(this.t * 0.01) * 0.2));
    const fn = this['update_' + this.id];
    if (fn) fn.call(this, this.t);
    this.updateParts(dt);
    // pulso de luz ambiental en impactos fuertes
    if (this.pulse > 0.02) { this.dynAdd.fillStyle(this.atmo.tint, 0.06 * this.pulse); this.dynAdd.fillRect(X0, -900, W, GROUND_Y + 900); }
  }

  updateParts(dt) {
    const A = this.atmo, g = A.parts === 'ember' || A.parts === 'streak' ? this.frontAdd : this.front, t = this.t;
    for (const p of this.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      switch (A.parts) {
        case 'rain':
          g.lineStyle(1.5, A.col, p.a); g.lineBetween(p.x, p.y, p.x - p.vx * 1.4, p.y - p.vy * 1.4);
          if (p.y > GROUND_Y + 30) { if (Math.random() < 0.5) { this.dynAdd.lineStyle(1, A.col, 0.35); this.dynAdd.strokeEllipse(p.x, GROUND_Y + 10 + Math.random() * 40, 14, 3); } Object.assign(p, this.spawn(false)); }
          break;
        case 'petal': {
          const sw = Math.sin(t * 0.04 + p.ph);
          g.fillStyle(A.col, p.a); g.fillEllipse(p.x + sw * 18, p.y, p.s * 2 * Math.abs(Math.cos(t * 0.05 + p.ph)) + 1, p.s);
          if (p.y > GROUND_Y + 60 || p.x > WALL_R_VIEW + 100) Object.assign(p, this.spawn(false), { x: WALL_L_VIEW + Math.random() * (WALL_R_VIEW - WALL_L_VIEW) * 0.8 });
          break;
        }
        case 'snow': {
          const sw = Math.sin(t * 0.03 + p.ph) * 0.6;
          p.x += sw;
          g.fillStyle(A.col, p.a); g.fillCircle(p.x, p.y, p.s);
          if (p.y > GROUND_Y + 60 || p.x > WALL_R_VIEW + 200) Object.assign(p, this.spawn(false), { x: WALL_L_VIEW - 200 + Math.random() * (WALL_R_VIEW - WALL_L_VIEW) });
          break;
        }
        case 'ember': {
          p.x += Math.sin(t * 0.05 + p.ph) * 0.5;
          const fl = 0.6 + Math.sin(t * 0.3 + p.ph) * 0.4;
          g.fillStyle(A.col, p.a * fl); g.fillCircle(p.x, p.y, p.s);
          g.fillStyle(A.col, 0.15 * fl); g.fillCircle(p.x, p.y, p.s * 3);
          if (p.y < GROUND_Y - 950) Object.assign(p, this.spawn(false));
          break;
        }
        case 'streak':
          g.lineStyle(2, A.col, p.a); g.lineBetween(p.x, p.y, p.x + p.s, p.y);
          if (p.x < WALL_L_VIEW - 400) Object.assign(p, this.spawn(false));
          break;
        default: {
          const fl = 0.5 + Math.sin(t * 0.04 + p.ph) * 0.5;
          this.dynAdd.fillStyle(A.col, p.a * fl); this.dynAdd.fillCircle(p.x, p.y, p.s);
          if (p.x < WALL_L_VIEW || p.x > WALL_R_VIEW) p.vx = -p.vx;
          if (p.y < GROUND_Y - 760 || p.y > GROUND_Y - 10) p.vy = -p.vy;
        }
      }
    }
  }

  destroy() {
    for (const o of this.objs) o.destroy();
    for (const k of this.keys) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    this.objs = []; this.keys = [];
  }

  // ======================= AZOTEA NEÓN (lluvia, ciudad, carteles parpadeantes) =======================
  build_rooftop() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#05031a'], [0.5, '#1d0d3f'], [0.85, '#4d1257'], [1, '#7a1e63']]);
      for (let i = 0; i < 140; i++) { c.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.6})`; c.fillRect(r() * w, r() * h * 0.6, 1, 1); }
      rglow(c, w * 0.66, h * 0.22, 120, 'rgba(255,240,200,0.35)');
      c.fillStyle = '#fff3d4'; c.beginPath(); c.arc(w * 0.66, h * 0.22, 30, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(190,170,140,0.35)'; c.beginPath(); c.arc(w * 0.66 - 9, h * 0.22 - 7, 7, 0, 7); c.fill(); c.beginPath(); c.arc(w * 0.66 + 10, h * 0.22 + 8, 5, 0, 7); c.fill();
      for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(120,60,140,0.18)'; c.beginPath(); c.ellipse(r() * w, h * 0.35 + r() * h * 0.3, 140 + r() * 120, 12 + r() * 10, 0, 0, 7); c.fill(); }
    });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 460, (c, w, h) => {
      for (let i = 0; i < 80; i++) {
        const bw = 18 + r() * 46, bh = 80 + r() * 300, x = r() * w;
        vgrad(c, x, h - bh, bw, bh, [[0, '#1c1038'], [1, '#0d0820']]);
        for (let wy = h - bh + 6; wy < h - 6; wy += 8) for (let wx = x + 3; wx < x + bw - 3; wx += 6) if (r() < 0.18) { c.fillStyle = r() < 0.7 ? 'rgba(255,209,140,0.55)' : 'rgba(125,249,255,0.45)'; c.fillRect(wx, wy, 2, 3); }
        if (r() < 0.12) { c.fillStyle = '#ff3355'; c.fillRect(x + bw / 2, h - bh - 16, 2, 16); }
      }
      const fg = c.createLinearGradient(0, h * 0.4, 0, h); fg.addColorStop(0, 'rgba(90,30,120,0)'); fg.addColorStop(1, 'rgba(90,30,120,0.55)'); c.fillStyle = fg; c.fillRect(0, h * 0.4, w, h * 0.6);
    });
    this.layer(far, X0, -20, 0.3, 2, -100);
    const mid = this.bake('mid', W / 2, 420, (c, w, h) => {
      for (let i = 0; i < 24; i++) {
        const bw = 70 + r() * 90, bh = 140 + r() * 210, x = i * (w / 24) + r() * 20;
        vgrad(c, x, h - bh, bw, bh, [[0, '#2a1650'], [1, '#100820']]);
        c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, h - bh, 3, bh);
        for (let wy = h - bh + 12; wy < h - 10; wy += 14) for (let wx = x + 6; wx < x + bw - 8; wx += 12) if (r() < 0.25) { c.fillStyle = 'rgba(255,200,130,0.5)'; c.fillRect(wx, wy, 6, 7); }
      }
      const fg = c.createLinearGradient(0, h * 0.5, 0, h); fg.addColorStop(0, 'rgba(60,20,90,0)'); fg.addColorStop(1, 'rgba(60,20,90,0.6)'); c.fillStyle = fg; c.fillRect(0, h * 0.5, w, h * 0.5);
    });
    this.layer(mid, X0, 110, 0.6, 2, -90);
    // carteles de neón animados (posiciones en la capa media)
    this.signs = [{ x: 260, y: 130, txt: 'AURA', col: 0xff2d95 }, { x: 1180, y: 170, txt: '67', col: 0x00f0ff }, { x: 1900, y: 120, txt: 'SIGMA', col: 0xffd166 }]
      .map(s0 => ({ ...s0, ph: r() * 6, img: this.signTex(s0) }));
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, 60, [[0, '#1b1530'], [1, '#2a2340']]);
      c.strokeStyle = '#4a4266'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 6); c.lineTo(w, 6); c.stroke();
      for (let x = 0; x < w; x += 46) { c.fillStyle = '#433b5e'; c.fillRect(x, 6, 4, 34); }
      for (const ax of [520, 1150, 2350, 2900]) { vgrad(c, ax, 20, 140, 46, [[0, '#5b5677'], [1, '#3a3552']]); c.fillStyle = '#2a263d'; for (let k = 0; k < 6; k++) c.fillRect(ax + 10 + k * 20, 40, 12, 26); }
      // suelo mojado: degradado oscuro con charcos brillantes
      vgrad(c, 0, 60, w, h - 60, [[0, '#2c2640'], [0.25, '#1d1830'], [1, '#0b0914']]);
      for (let i = 0; i < 26; i++) { const px = r() * w, py = 80 + r() * 260; const g2 = c.createRadialGradient(px, py, 0, px, py, 120); g2.addColorStop(0, 'rgba(255,45,149,0.12)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.save(); c.translate(px, py); c.scale(1, 0.18); c.translate(-px, -py); c.fillStyle = g2; c.fillRect(px - 120, py - 120, 240, 240); c.restore(); }
      c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 2;
      for (let x = -200; x < w + 200; x += 120) { c.beginPath(); c.moveTo(x, 60); c.lineTo(x + (x - w / 2) * 0.6, h); c.stroke(); }
    });
    this.layer(ground, X0, GROUND_Y - 60, 1, 1, -60);
  }
  signTex(s0) {
    return this.bake('sign_' + s0.txt, 360, 160, (c, w, h) => { glowText(c, s0.txt, w / 2, h / 2, s0.txt.length > 3 ? 70 : 90, rgba(s0.col, 1), 34); });
  }
  update_rooftop(t) {
    for (const s0 of this.signs) {
      if (!s0.im) { s0.im = this.scene.add.image(X0 + s0.x * 2, 110 + s0.y, s0.img).setScrollFactor(0.6, 0.72).setDepth(-89).setBlendMode('ADD'); this.objs.push(s0.im); }
      const flick = Math.sin(t * 0.9 + s0.ph) > 0.94 || (Math.sin(t * 0.07 + s0.ph) > 0.985) ? 0.25 : 1;
      s0.im.setAlpha((0.75 + Math.sin(t * 0.05 + s0.ph) * 0.1) * flick);
    }
    const g = this.dynAdd;
    g.fillStyle(0xff2d95, 0.045); g.fillRect(X0, GROUND_Y - 6, W, 22);
    g.fillStyle(0x00f0ff, 0.03); g.fillRect(X0, GROUND_Y + 40, W, 18);
    // relámpago lejano ocasional
    if (Math.sin(t * 0.011) > 0.998) { this.backAdd.fillStyle(0xd8c8ff, 0.12); this.backAdd.fillRect(-2000, -2000, 6000, 4000); }
  }

  // ======================= DOJO (pétalos, faroles, haces de luz) =======================
  build_dojo() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => { vgrad(c, 0, 0, w, h, [[0, '#120804'], [0.6, '#2c1608'], [1, '#4a260c']]); });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 420, (c, w, h) => {
      for (let x = 0; x < w; x += 110) {
        vgrad(c, x + 6, 40, 98, 300, [[0, '#f6e2b5'], [1, '#d9b676']]);
        c.fillStyle = 'rgba(80,40,10,0.6)';
        for (let k = 1; k < 4; k++) c.fillRect(x + 6 + k * 24.5, 40, 3, 300);
        for (let k = 1; k < 6; k++) c.fillRect(x + 6, 40 + k * 50, 98, 3);
        c.fillStyle = '#2a1405'; c.fillRect(x, 30, 8, 330);
        if (r() < 0.35) { c.fillStyle = 'rgba(40,20,5,0.3)'; c.beginPath(); c.ellipse(x + 55, 200, 16, 56, 0, 0, 7); c.fill(); }
        // silueta de bambú tras el papel
        if (r() < 0.5) { c.strokeStyle = 'rgba(60,30,10,0.25)'; c.lineWidth = 5; c.beginPath(); c.moveTo(x + 20 + r() * 60, 340); c.lineTo(x + 30 + r() * 50, 40); c.stroke(); }
      }
      c.fillStyle = '#2a1405'; c.fillRect(0, 20, w, 24); c.fillRect(0, 340, w, 30);
    });
    this.layer(far, X0, -40, 0.4, 2, -100);
    const mid = this.bake('mid', W / 2, 420, (c, w, h) => {
      for (let x = 60; x < w; x += 300) { vgrad(c, x, 0, 34, h, [[0, '#3a1d08'], [1, '#1c0d03']]); c.fillStyle = 'rgba(255,200,120,0.08)'; c.fillRect(x, 0, 4, h); }
      for (let x = 210; x < w; x += 600) {
        c.fillStyle = '#7a1414'; c.fillRect(x - 40, 30, 80, 190); vgrad(c, x - 34, 30, 68, 184, [[0, '#c62828'], [1, '#8e1b1b']]);
        c.save(); c.font = '70px serif'; c.textAlign = 'center'; c.fillStyle = '#1a0a02'; c.fillText('気', x, 150); c.restore();
      }
    });
    this.layer(mid, X0, -60, 0.7, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, 60, [[0, '#3a1d08'], [1, '#5c3112']]);
      vgrad(c, 0, 60, w, h, [[0, '#b0703a'], [0.25, '#8a5222'], [1, '#3a1e09']]);
      c.strokeStyle = 'rgba(50,25,5,0.45)'; c.lineWidth = 2;
      for (let y = 60; y < h; y += 26 + (y - 60) * 0.15) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      for (let i = 0; i < 300; i++) { const y = 60 + r() * (h - 60), x = r() * w; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 40 + r() * 120, y); c.stroke(); }
      const rg = c.createLinearGradient(0, 60, 0, 200); rg.addColorStop(0, 'rgba(255,220,150,0.28)'); rg.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = rg; c.fillRect(0, 60, w, 140);
    });
    this.layer(ground, X0, GROUND_Y - 60, 1, 1, -60);
    this.lanterns = [];
    for (let x = -200; x < 2300; x += 380) this.lanterns.push({ x, ph: r() * 6 });
  }
  update_dojo(t) {
    const g = this.dyn, ga = this.dynAdd;
    // haces de luz cálida a través del shoji
    for (let i = 0; i < 5; i++) {
      const x = -100 + i * 480 + Math.sin(t * 0.004 + i) * 30;
      ga.fillStyle(0xffd59a, 0.035 + Math.sin(t * 0.02 + i * 2) * 0.01);
      ga.fillTriangle(x, -300, x + 120, -300, x + 340, GROUND_Y + 30); ga.fillTriangle(x + 120, -300, x + 460, GROUND_Y + 30, x + 340, GROUND_Y + 30);
    }
    for (const l of this.lanterns) {
      const sw = Math.sin(t * 0.03 + l.ph) * 6;
      const x = l.x + sw, y = 120;
      g.lineStyle(2, 0x1a0a02, 1); g.lineBetween(l.x, -200, x, y - 30);
      g.fillStyle(0xb51f1f, 1); g.fillEllipse(x, y, 40, 56); g.fillStyle(0xe23b3b, 1); g.fillEllipse(x - 5, y - 4, 22, 44);
      g.fillStyle(0x1a0a02, 1); g.fillRect(x - 12, y - 32, 24, 6); g.fillRect(x - 12, y + 26, 24, 6);
      const fl = 0.16 + Math.sin(t * 0.2 + l.ph) * 0.03 + this.pulse * 0.1;
      ga.fillStyle(0xffaa55, fl * 0.5); ga.fillCircle(x, y, 90); ga.fillStyle(0xffaa55, fl); ga.fillCircle(x, y, 46);
    }
  }

  // ======================= GIMNASIO (gradas vacías, focos, polvo en suspensión) =======================
  build_gym() {
    const sky = this.bake('sky', 800, 500, (c, w, h) => { vgrad(c, 0, 0, w, h, [[0, '#1f2a40'], [1, '#3a4d6b']]); });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 460, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#33425e'], [1, '#4b5f80']]);
      for (let x = 30; x < w; x += 160) { vgrad(c, x, 30, 120, 70, [[0, '#d8ecff'], [1, '#90b8e0']]); c.fillStyle = '#33425e'; c.fillRect(x + 58, 30, 4, 70); c.fillRect(x, 63, 120, 4); }
      const sx = w * 0.5;
      vgrad(c, sx - 116, 114, 232, 102, [[0, '#1a1a1a'], [1, '#050505']]); c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.strokeRect(sx - 110, 120, 220, 90);
      c.font = '28px Anton, Impact, sans-serif'; c.textAlign = 'center';
      c.save(); c.shadowColor = '#ff4444'; c.shadowBlur = 12; c.fillStyle = '#ff5555'; c.fillText('LOCAL 67', sx - 52, 175); c.restore();
      c.save(); c.shadowColor = '#44ff88'; c.shadowBlur = 12; c.fillStyle = '#55ff99'; c.fillText('VISITA 41', sx + 52, 175); c.restore();
      for (const [bx, col, txt] of [[w * 0.2, '#ffd166', 'GO AURA!'], [w * 0.8, '#ff4d6d', 'SIGMA FC']]) { c.fillStyle = col; c.beginPath(); c.moveTo(bx - 70, 120); c.lineTo(bx + 70, 120); c.lineTo(bx, 210); c.closePath(); c.fill(); c.fillStyle = '#111'; c.font = '20px Anton, Impact, sans-serif'; c.fillText(txt, bx, 150); }
    });
    this.layer(far, X0, -180, 0.4, 2, -100);
    const mid = this.bake('mid', W / 2, 300, (c, w, h) => {
      // gradas vacías
      for (let i = 0; i < 6; i++) { const y = 40 + i * 40; vgrad(c, 0, y, w, 40, [[0, '#7d5f3b'], [0.15, '#a8814f'], [1, '#5e4428']]); c.fillStyle = 'rgba(0,0,0,0.32)'; c.fillRect(0, y + 34, w, 6); }
      for (let x = 0; x < w; x += 200) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, 40, 6, 240); }
    });
    this.layer(mid, X0, 20, 0.8, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, 60, [[0, '#5a4127'], [1, '#6b4f2f']]);
      vgrad(c, 0, 60, w, h, [[0, '#e6ae6c'], [0.2, '#c98d4b'], [1, '#6e4822']]);
      c.strokeStyle = 'rgba(120,70,20,0.3)'; c.lineWidth = 1;
      for (let x = 0; x < w; x += 18) { c.beginPath(); c.moveTo(x, 60); c.lineTo(x + (x - w / 2) * 0.5, h); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(w / 2, 60); c.lineTo(w / 2, h); c.stroke();
      c.beginPath(); c.ellipse(w / 2, 150, 170, 60, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(220,40,40,0.8)'; c.beginPath(); c.moveTo(0, 90); c.lineTo(w, 90); c.stroke();
      const rg = c.createLinearGradient(0, 60, 0, 220); rg.addColorStop(0, 'rgba(255,255,255,0.26)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = rg; c.fillRect(0, 60, w, 160);
    });
    this.layer(ground, X0, GROUND_Y - 60, 1, 1, -60);
  }
  update_gym(t) {
    const g = this.dynAdd;
    for (let i = 0; i < 5; i++) {
      const x = 200 + i * 420, a = 0.035 + Math.sin(t * 0.015 + i) * 0.008 + this.pulse * 0.03;
      g.fillStyle(0xdff0ff, a); g.fillTriangle(x, -300, x + 80, -300, x + 300, GROUND_Y + 40); g.fillTriangle(x + 80, -300, x + 380, GROUND_Y + 40, x + 300, GROUND_Y + 40);
      g.fillStyle(0xffffff, 0.05); g.fillEllipse(x + 340, GROUND_Y + 30, 220, 30);
    }
  }

  // ======================= AUTOPISTA PHONK (sol synthwave, coches, estelas) =======================
  build_highway() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#0d0221'], [0.45, '#3b0a57'], [0.75, '#ff2d75'], [1, '#ff9e3d']]);
      const sx = w * 0.5, sy = h * 0.78;
      rglow(c, sx, sy, 200, 'rgba(255,80,140,0.45)');
      const sg = c.createLinearGradient(0, sy - 90, 0, sy + 90); sg.addColorStop(0, '#ffe66d'); sg.addColorStop(1, '#ff2d75'); c.fillStyle = sg;
      c.beginPath(); c.arc(sx, sy, 90, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3b0a57'; for (let k = 0; k < 7; k++) c.fillRect(sx - 100, sy + k * 13, 200, 2 + k * 1.2);
      for (let i = 0; i < 80; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.8})`; c.fillRect(r() * w, r() * h * 0.45, 1.5, 1.5); }
    });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 400, (c, w, h) => {
      ridge(c, r, 120, 280, w, '#2a0845', 0.9);
      ridge(c, r, 200, 200, w, '#1a0530', 0.7);
      c.strokeStyle = 'rgba(255,45,149,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 300); c.lineTo(w, 300); c.stroke();
      for (let i = 0; i < 120; i++) { c.fillStyle = r() < 0.5 ? '#ffd166' : '#ff6b9a'; c.fillRect(r() * w, 360 + r() * 30, 2, 2); }
    });
    this.layer(far, X0, -60, 0.3, 2, -100);
    const mid = this.bake('mid', W / 2, 300, (c, w, h) => {
      vgrad(c, 0, 170, w, 130, [[0, '#1b1b2b'], [1, '#101018']]);
      c.fillStyle = '#ffd166'; for (let x = 0; x < w; x += 60) c.fillRect(x, 232, 30, 3);
      for (let x = 30; x < w; x += 240) { c.fillStyle = '#2a2a3a'; c.fillRect(x, 40, 6, 135); c.fillRect(x, 40, 40, 6); rglow(c, x + 37, 50, 40, 'rgba(255,207,122,0.5)'); c.fillStyle = '#fff1c4'; c.fillRect(x + 30, 44, 14, 5); }
      c.fillStyle = '#5c5c70'; c.fillRect(0, 160, w, 8); for (let x = 0; x < w; x += 40) c.fillRect(x, 160, 4, 22);
    });
    this.layer(mid, X0, 80, 0.6, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#2b2b3a'], [0.15, '#22222e'], [1, '#0a0a10']]);
      for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.05})`; c.fillRect(r() * w, r() * h, 2, 2); }
      c.fillStyle = '#ffd166'; for (let x = 0; x < w; x += 140) c.fillRect(x, 120, 80, 6);
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 10;
      for (let k = 0; k < 6; k++) { c.beginPath(); const y = 80 + r() * 200; c.moveTo(r() * w, y); c.bezierCurveTo(r() * w, y + 60, r() * w, y - 60, r() * w, y + r() * 40); c.stroke(); }
    });
    this.layer(ground, X0, GROUND_Y - 30, 1, 1, -60);
    this.cars = [];
  }
  update_highway(t) {
    const ga = this.dynAdd;
    // los coches se dibujan en el MISMO espacio de parallax que la carretera (capa media, escala 2):
    // así las ruedas apoyan siempre sobre el asfalto y la perspectiva coincide con la calzada.
    if (!this.carG) {
      this.carG = this.scene.add.graphics().setScrollFactor(0.6, 0.72).setDepth(-89); this.objs.push(this.carG);
      this.carGA = this.scene.add.graphics().setScrollFactor(0.6, 0.72).setDepth(-88).setBlendMode('ADD'); this.objs.push(this.carGA);
    }
    const g = this.carG, gl = this.carGA; g.clear(); gl.clear();
    const LX = X0, LY = 80, SC = 2; // origen y escala de la capa media
    const lanes = [{ y: 204, s: 0.78, dir: -1 }, { y: 226, s: 0.9, dir: 1 }];
    if (this.r() < 0.012) { const L = lanes[this.r() < 0.5 ? 0 : 1]; this.cars.push({ lane: L, x: L.dir > 0 ? -300 : W / 2 + 300, col: [0xff2d95, 0x00f0ff, 0xffd166, 0xffffff, 0x7b2cbf][Math.floor(this.r() * 5)], sp: 3 + this.r() * 2.5, spin: 0 }); }
    this.cars.sort((a, b) => a.lane.y - b.lane.y);
    for (const c of this.cars) {
      const L = c.lane, sc = L.s * SC, d = L.dir;
      c.x += d * c.sp; c.spin += c.sp * 0.25;
      const x = LX + c.x * SC, base = LY + L.y * SC; // base = línea del asfalto donde apoyan las ruedas
      const W2 = 50 * sc, wr = 7 * sc;
      // sombra en el asfalto
      g.fillStyle(0x000000, 0.45); g.fillEllipse(x, base + 1 * sc, W2 * 2.1, 5 * sc);
      // carrocería y cabina
      g.fillStyle(0x0a0a14, 1); g.fillRoundedRect(x - W2, base - wr - 15 * sc, W2 * 2, 16 * sc, 5 * sc);
      g.fillStyle(0x16162a, 1); g.fillRoundedRect(x - W2 + 2 * sc, base - wr - 13.5 * sc, W2 * 2 - 4 * sc, 13 * sc, 4 * sc);
      g.fillStyle(0x0a0a14, 1); g.beginPath(); g.moveTo(x - W2 * 0.55, base - wr - 14 * sc); g.lineTo(x - W2 * 0.3, base - wr - 26 * sc); g.lineTo(x + W2 * 0.35, base - wr - 26 * sc); g.lineTo(x + W2 * 0.62, base - wr - 14 * sc); g.closePath(); g.fillPath();
      g.fillStyle(0x2c3e66, 1); g.beginPath(); g.moveTo(x - W2 * 0.48, base - wr - 15 * sc); g.lineTo(x - W2 * 0.27, base - wr - 24 * sc); g.lineTo(x + W2 * 0.3, base - wr - 24 * sc); g.lineTo(x + W2 * 0.54, base - wr - 15 * sc); g.closePath(); g.fillPath();
      g.fillStyle(0x0a0a14, 1); g.fillRect(x + W2 * 0.02, base - wr - 25 * sc, 2 * sc, 10 * sc);
      g.fillStyle(c.col, 1); g.fillRect(x - W2 + 3 * sc, base - wr - 8 * sc, W2 * 2 - 6 * sc, 2 * sc);
      // ruedas apoyadas exactamente en la base, con llanta que gira
      for (const wx of [x - W2 * 0.62, x + W2 * 0.62]) {
        g.fillStyle(0x050505, 1); g.fillCircle(wx, base - wr, wr);
        g.fillStyle(0x8a8fa3, 1); g.fillCircle(wx, base - wr, wr * 0.5);
        g.lineStyle(1.2 * sc, 0x30323d, 1); g.lineBetween(wx + Math.cos(c.spin) * wr * 0.5, base - wr + Math.sin(c.spin) * wr * 0.5, wx - Math.cos(c.spin) * wr * 0.5, base - wr - Math.sin(c.spin) * wr * 0.5);
      }
      // faros y pilotos
      gl.fillStyle(0xfff1c4, 0.9); gl.fillRect(x + d * W2 - (d > 0 ? 3 * sc : 0), base - wr - 12 * sc, 3 * sc, 3 * sc);
      gl.fillStyle(0xfff1c4, 0.12); gl.fillTriangle(x + d * W2, base - wr - 11 * sc, x + d * (W2 + 120 * sc), base - wr - 22 * sc, x + d * (W2 + 120 * sc), base - wr + 4 * sc);
      gl.fillStyle(0xff2222, 0.8); gl.fillRect(x - d * W2 - (d > 0 ? 0 : 3 * sc), base - wr - 12 * sc, 3 * sc, 3 * sc);
      gl.fillStyle(0xff2222, 0.08); gl.fillRect(d > 0 ? x - W2 - 90 * sc : x + W2, base - wr - 12 * sc, 90 * sc, 3 * sc);
    }
    this.cars = this.cars.filter(c => c.x > -400 && c.x < W / 2 + 400);
    // calima sobre el asfalto
    ga.fillStyle(0xff6aa8, 0.025 + Math.sin(t * 0.05) * 0.01); ga.fillRect(X0, GROUND_Y - 30, W, 30);
  }

  // ======================= BACKROOMS (fluorescentes y polvo) =======================
  build_backrooms() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => { vgrad(c, 0, 0, w, h, [[0, '#8f7f3a'], [1, '#c9b458']]); });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 450, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#b5a24a'], [1, '#d6c264']]);
      c.strokeStyle = 'rgba(120,100,30,0.22)'; c.lineWidth = 2;
      for (let x = 0; x < w; x += 14) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let x = 80; x < w; x += 260 + r() * 120) { vgrad(c, x, 150, 90, 300, [[0, '#2a2410'], [1, '#14110a']]); c.strokeStyle = '#8f7f3a'; c.lineWidth = 6; c.strokeRect(x, 150, 90, 300); }
      const fg = c.createLinearGradient(0, 0, 0, h); fg.addColorStop(0, 'rgba(255,250,200,0.15)'); fg.addColorStop(1, 'rgba(60,50,10,0.25)'); c.fillStyle = fg; c.fillRect(0, 0, w, h);
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
      vgrad(c, 0, 60, w, h, [[0, '#9b8740'], [1, '#463b16']]);
      for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '60,50,20' : '200,180,100'},${r() * 0.15})`; c.fillRect(r() * w, 60 + r() * (h - 60), 2, 2); }
      c.fillStyle = 'rgba(60,50,20,0.25)'; for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(r() * w, 100 + r() * 200, 60 + r() * 80, 15 + r() * 15, 0, 0, 7); c.fill(); }
    });
    this.layer(ground, X0, GROUND_Y - 60, 1, 1, -60);
  }
  update_backrooms(t) {
    const g = this.dynAdd;
    const flick = Math.sin(t * 0.9) > 0.97 || Math.sin(t * 0.13) > 0.995;
    g.fillStyle(0xfffbe0, flick ? 0.0 : 0.05); g.fillRect(X0, -600, W, 1300);
    if (flick) { this.dyn.fillStyle(0x000000, 0.25); this.dyn.fillRect(X0, -600, W, 1300); }
  }

  // ======================= MONTAÑA SIGMA (atardecer, nieve, nubes, pájaros) =======================
  build_mountain() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#1d1238'], [0.45, '#6b2d5c'], [0.75, '#ff7e5f'], [1, '#feb47b']]);
      rglow(c, w * 0.35, h * 0.72, 180, 'rgba(255,215,140,0.55)');
      c.fillStyle = '#ffe8b0'; c.beginPath(); c.arc(w * 0.35, h * 0.72, 44, 0, Math.PI * 2); c.fill();
    });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 450, (c, w, h) => {
      ridge(c, r, 40, 410, w, '#4a2d63', 1.4);
      // nieve en las cumbres
      c.globalCompositeOperation = 'source-atop'; vgrad(c, 0, 40, w, 120, [[0, 'rgba(255,240,240,0.55)'], [1, 'rgba(255,240,240,0)']]); c.globalCompositeOperation = 'source-over';
      ridge(c, r, 120, 330, w, '#3a2452', 1.2);
      ridge(c, r, 220, 230, w, '#2a1a3e', 1);
      const fg = c.createLinearGradient(0, 200, 0, h); fg.addColorStop(0, 'rgba(255,170,140,0)'); fg.addColorStop(1, 'rgba(255,170,140,0.3)'); c.fillStyle = fg; c.fillRect(0, 200, w, h - 200);
    });
    this.layer(far, X0, -120, 0.3, 2, -100);
    const mid = this.bake('mid', W / 2, 300, (c, w, h) => {
      for (let x = 0; x < w; x += 18 + r() * 30) { const th = 60 + r() * 110; c.fillStyle = '#16102a'; c.beginPath(); c.moveTo(x, h); c.lineTo(x + 14, h - th); c.lineTo(x + 28, h); c.closePath(); c.fill(); }
      c.fillStyle = '#1c1430'; c.fillRect(w * 0.62, h - 150, 120, 150); c.beginPath(); c.moveTo(w * 0.62 - 20, h - 150); c.lineTo(w * 0.62 + 60, h - 200); c.lineTo(w * 0.62 + 140, h - 150); c.closePath(); c.fill();
      rglow(c, w * 0.62 + 60, h - 97, 50, 'rgba(255,190,110,0.5)');
      c.fillStyle = 'rgba(255,200,120,0.8)'; c.fillRect(w * 0.62 + 50, h - 110, 20, 26);
    });
    this.layer(mid, X0, 260, 0.65, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#5a4a5e'], [0.12, '#463a4c'], [1, '#1a1420']]);
      c.fillStyle = '#3f6b3a'; c.fillRect(0, 50, w, 10); for (let x = 0; x < w; x += 6) { c.fillRect(x, 44 - r() * 10, 2, 16); }
      c.fillStyle = 'rgba(255,255,255,0.35)'; for (let x = 0; x < w; x += 4) if (r() < 0.5) c.fillRect(x, 48 - r() * 4, 3, 3);
      for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(30,20,35,${0.3 + r() * 0.4})`; c.beginPath(); c.ellipse(r() * w, 80 + r() * (h - 80), 8 + r() * 30, 4 + r() * 10, 0, 0, 7); c.fill(); }
    });
    this.layer(ground, X0, GROUND_Y - 50, 1, 1, -60);
    this.birds = Array.from({ length: 6 }, () => ({ x: this.r() * 2000, y: -100 + this.r() * 200, sp: 1 + this.r() }));
    this.clouds = Array.from({ length: 7 }, () => ({ x: this.r() * 2600 - 400, y: -420 + this.r() * 260, w: 220 + this.r() * 260, sp: 0.15 + this.r() * 0.3 }));
  }
  update_mountain(t) {
    const g = this.dyn, b = this.back;
    for (const c of this.clouds) {
      c.x += c.sp; if (c.x > 2400) c.x = -600;
      b.fillStyle(0xffd3c0, 0.16); b.fillEllipse(c.x * 0.5, c.y, c.w, c.w * 0.18); b.fillEllipse(c.x * 0.5 + c.w * 0.2, c.y - c.w * 0.05, c.w * 0.6, c.w * 0.16);
    }
    g.lineStyle(2, 0x1a0e24, 0.8);
    for (const bd of this.birds) {
      bd.x += bd.sp; if (bd.x > 2600) bd.x = -600;
      const f = Math.sin(t * 0.3 + bd.x) * 5;
      g.lineBetween(bd.x - 8, bd.y - f, bd.x, bd.y); g.lineBetween(bd.x, bd.y, bd.x + 8, bd.y - f);
    }
  }

  // ======================= COLISEO DEL AURA (arcos de piedra, focos, brasas) =======================
  build_colosseum() {
    const r = this.r;
    const sky = this.bake('sky', 800, 500, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#05030f'], [0.6, '#1a0b2e'], [1, '#3a1450']]);
      for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.6})`; c.fillRect(r() * w, r() * h * 0.6, 1.5, 1.5); }
      rglow(c, w * 0.5, h * 0.9, 260, 'rgba(192,132,252,0.25)');
    });
    this.layer(sky, -900, -700, 0.05, 4.6, -110);
    const far = this.bake('far', W / 2, 460, (c, w, h) => {
      // muro del coliseo: dos pisos de arcos en penumbra
      vgrad(c, 0, 60, w, h - 60, [[0, '#24173a'], [1, '#160d26']]);
      for (let row = 0; row < 2; row++) {
        const y0 = 110 + row * 150, ah = 110;
        for (let x = 10; x < w; x += 90) {
          c.fillStyle = '#0a0612'; c.beginPath(); c.moveTo(x, y0 + ah); c.lineTo(x, y0 + 30); c.arc(x + 32, y0 + 30, 32, Math.PI, 0); c.lineTo(x + 64, y0 + ah); c.closePath(); c.fill();
          if (r() < 0.25) rglow(c, x + 32, y0 + 70, 40, 'rgba(255,150,60,0.35)');
        }
        c.fillStyle = '#2e1f48'; c.fillRect(0, y0 + ah, w, 14); c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, y0 + ah, w, 3);
      }
      const sx = w * 0.5;
      c.fillStyle = '#0a0612'; c.fillRect(sx - 150, 0, 300, 90); c.strokeStyle = '#c084fc'; c.lineWidth = 4; c.strokeRect(sx - 150, 0, 300, 90);
      glowText(c, 'AURA LEGENDS', sx, 46, 40, '#c084fc', 26);
    });
    this.layer(far, X0, -200, 0.35, 2, -100);
    const mid = this.bake('mid', W / 2, 260, (c, w, h) => {
      vgrad(c, 0, 120, w, 140, [[0, '#2a1840'], [1, '#160c24']]);
      for (let x = 40; x < w; x += 220) {
        const col = ['#ff4d6d', '#ffd166', '#4cc9f0', '#c084fc'][Math.floor(r() * 4)];
        c.fillStyle = '#1a0f2a'; c.fillRect(x + 56, 0, 8, 140);
        c.fillStyle = col; c.beginPath(); c.moveTo(x, 20); c.lineTo(x + 120, 20); c.lineTo(x + 120, 120); c.lineTo(x + 60, 100); c.lineTo(x, 120); c.closePath(); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, 20, 30, 100);
        c.fillStyle = '#0a0612'; c.font = '22px Anton, Impact, sans-serif'; c.textAlign = 'center'; c.fillText(['SIUUU', 'MEWING', '67', 'SIGMA', 'RIZZ', 'AURA+1000'][Math.floor(r() * 6)], x + 60, 70);
      }
    });
    this.layer(mid, X0, 230, 0.75, 2, -90);
    const ground = this.bake('ground', W, 420, (c, w, h) => {
      vgrad(c, 0, 0, w, h, [[0, '#2a1d3a'], [0.15, '#1f1530'], [1, '#09060f']]);
      c.strokeStyle = 'rgba(192,132,252,0.16)'; c.lineWidth = 2;
      for (let y = 70; y < h; y += 30) for (let x = (y / 30 % 2) * 30; x < w; x += 60) { c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 13); } c.closePath(); c.stroke(); }
      c.save(); c.shadowColor = '#c084fc'; c.shadowBlur = 40; c.strokeStyle = '#c084fc'; c.lineWidth = 4; c.beginPath(); c.ellipse(w / 2, 150, 640, 70, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    });
    this.layer(ground, X0, GROUND_Y - 60, 1, 1, -60);
    this.torches = [-150, 450, 1450, 2050].map(x => ({ x, ph: r() * 6 }));
  }
  update_colosseum(t) {
    const g = this.dynAdd;
    for (let i = 0; i < 4; i++) {
      const base = -200 + i * 800;
      const ang = Math.sin(t * 0.012 + i * 1.7) * 0.5;
      const tx = base + 400 + Math.sin(ang) * 900, ty = GROUND_Y;
      g.fillStyle([0xc084fc, 0x4cc9f0, 0xff4d6d, 0xffd166][i], 0.06 + this.excite * 0.03 + this.pulse * 0.04);
      g.fillTriangle(base + 400, -500, tx - 120, ty, tx + 120, ty);
      g.fillStyle(0xffffff, 0.05); g.fillEllipse(tx, ty + 10, 260, 40);
    }
    // braseros
    for (const to of this.torches) {
      const d = this.dyn;
      d.fillStyle(0x1a0f2a, 1); d.fillRect(to.x - 6, GROUND_Y - 150, 12, 150); d.fillStyle(0x2e1f48, 1); d.fillRect(to.x - 22, GROUND_Y - 162, 44, 16);
      for (let k = 0; k < 5; k++) {
        const fh = 26 + Math.sin(t * 0.3 + to.ph + k) * 10;
        g.fillStyle(k % 2 ? 0xffa040 : 0xff5a1f, 0.55); g.fillTriangle(to.x - 18 + k * 8, GROUND_Y - 162, to.x - 10 + k * 8, GROUND_Y - 162, to.x - 14 + k * 8 + Math.sin(t * 0.2 + k) * 4, GROUND_Y - 162 - fh);
      }
      g.fillStyle(0xff8a30, 0.12 + Math.sin(t * 0.25 + to.ph) * 0.03); g.fillCircle(to.x, GROUND_Y - 180, 80);
    }
  }
}

// área visible aproximada para las partículas ambientales
const WALL_L_VIEW = -300, WALL_R_VIEW = ARENA_W + 300;

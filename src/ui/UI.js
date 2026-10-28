// Componentes de interfaz reutilizables: textos, paneles, listas navegables, previsualización de stickman, transiciones.
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { drawBody, hex } from '../view/StickRenderer.js';
import { makePose, copyPose, computeJoints } from '../sim/skeleton.js';
import { POSES, MODS } from '../sim/poses.js';
import { CELEBRATIONS, DEFEATS } from '../sim/celebrations.js';
import { playCelebration } from '../sim/Fighter.js';

export const FONT = '"Anton", Impact, "Arial Black", sans-serif';
export const BODY_FONT = '"Rubik", "Segoe UI", Roboto, Arial, sans-serif';
export const COL = { bg: 0x07050f, panel: 0x120c22, line: 0x3a2a66, accent: 0x7df9ff, gold: 0xffd166, pink: 0xff4d6d, text: '#f4f4f8', dim: '#9a94b8' };

export function txt(scene, x, y, str, size = 24, color = '#ffffff', o = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: o.body ? BODY_FONT : FONT, fontSize: size + 'px', color, align: o.align || 'left',
    stroke: o.stroke ?? '#000000', strokeThickness: o.strokeThickness ?? (o.body ? 0 : Math.max(2, size / 8)),
    wordWrap: o.wrap ? { width: o.wrap } : undefined, fontStyle: o.bold ? 'bold' : undefined,
    shadow: o.shadow === false ? undefined : { offsetX: 0, offsetY: 2, color: '#000', blur: o.body ? 0 : 4, fill: true }
  });
  t.setOrigin(o.ox ?? 0, o.oy ?? 0);
  if (o.depth !== undefined) t.setDepth(o.depth);
  return t;
}

export function panel(scene, x, y, w, h, o = {}) {
  const g = scene.add.graphics();
  const r = o.r ?? 14, acc = o.line ?? COL.line;
  // sombra, cuerpo, brillo superior de cristal, borde y esquinas de acento
  g.fillStyle(0x000000, 0.35 * (o.alpha ?? 0.88)); g.fillRoundedRect(x + 4, y + 6, w, h, r);
  g.fillStyle(o.fill ?? COL.panel, o.alpha ?? 0.88); g.fillRoundedRect(x, y, w, h, r);
  g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.07, 0.07, 0, 0); g.fillRect(x + r * 0.6, y + 2, w - r * 1.2, Math.min(70, h * 0.4));
  g.lineStyle(o.lw ?? 2, acc, o.lineAlpha ?? 1); g.strokeRoundedRect(x, y, w, h, r);
  const c = o.corner ?? COL.accent, L = Math.min(22, w / 6, h / 6);
  g.lineStyle(3, c, 0.9);
  g.beginPath(); g.moveTo(x + 2, y + L); g.lineTo(x + 2, y + 2); g.lineTo(x + L, y + 2); g.strokePath();
  g.beginPath(); g.moveTo(x + w - L, y + h - 2); g.lineTo(x + w - 2, y + h - 2); g.lineTo(x + w - 2, y + h - L); g.strokePath();
  if (o.depth !== undefined) g.setDepth(o.depth);
  return g;
}

// Fondo animado para menús: degradado profundo, orbes de aura, rayos de luz, rejilla y motas
export class MenuBG {
  constructor(scene, o = {}) {
    this.s = scene;
    this.g = scene.add.graphics().setDepth(-100);
    this.ga = scene.add.graphics().setDepth(-99).setBlendMode('ADD');
    this.t = 0;
    this.hue = o.hue ?? 265;
    const pal = [0x7b2cbf, 0x4cc9f0, 0xff2d95, 0x7df9ff];
    this.orbs = Array.from({ length: 5 }, (_, i) => ({ x: Math.random() * 1280, y: 120 + Math.random() * 420, r: 160 + Math.random() * 160, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.25, c: pal[i % pal.length] }));
    this.dots = Array.from({ length: 70 }, () => ({ x: Math.random() * 1280, y: Math.random() * 720, s: 0.5 + Math.random() * 2, v: 0.2 + Math.random() * 0.8, w: Math.random() * 6.28 }));
  }
  update() {
    const g = this.g, ga = this.ga;
    this.t++;
    g.clear(); ga.clear();
    g.fillGradientStyle(0x07040f, 0x07040f, 0x1a0a33, 0x260c38, 1);
    g.fillRect(0, 0, 1280, 720);
    // orbes de aura que derivan (círculos concéntricos tenues = brillo suave)
    for (const o of this.orbs) {
      o.x += o.vx; o.y += o.vy;
      if (o.x < -200 || o.x > 1480) o.vx = -o.vx; if (o.y < 0 || o.y > 720) o.vy = -o.vy;
      for (let k = 0; k < 5; k++) { ga.fillStyle(o.c, 0.018); ga.fillCircle(o.x, o.y, o.r * (1 - k * 0.17)); }
    }
    // rayos de luz giratorios desde abajo
    const cx = 640, cy = 820;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + Math.sin(this.t * 0.004 + i * 0.7) * 0.9;
      const w = 0.035 + (i % 3) * 0.012;
      ga.fillStyle(0xb388ff, 0.025);
      ga.fillTriangle(cx, cy, cx + Math.cos(a - w) * 1300, cy + Math.sin(a - w) * 1300, cx + Math.cos(a + w) * 1300, cy + Math.sin(a + w) * 1300);
    }
    // rejilla en perspectiva
    ga.lineStyle(1, 0x7b2cbf, 0.14);
    const hz = 480, off = (this.t * 1.2) % 40;
    for (let i = 0; i < 14; i++) { const y = hz + Math.pow(i / 14, 2) * 250 + off * (i / 14); ga.lineBetween(0, y, 1280, y); }
    for (let i = -16; i <= 16; i++) ga.lineBetween(640 + i * 40, hz, 640 + i * 160, 720);
    ga.fillStyle(0xff2d95, 0.05); ga.fillRect(0, hz - 3, 1280, 6);
    for (const d of this.dots) { d.y -= d.v; d.x += Math.sin(this.t * 0.02 + d.w) * 0.3; if (d.y < -10) { d.y = 730; d.x = Math.random() * 1280; } ga.fillStyle(0x7df9ff, 0.25 * d.s / 2.5); ga.fillCircle(d.x, d.y, d.s); }
    // viñeta
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.5, 0.5, 0, 0); g.fillRect(0, 0, 1280, 90);
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.55, 0.55); g.fillRect(0, 620, 1280, 100);
  }
  destroy() { this.g.destroy(); this.ga.destroy(); }
}

// Lista de opciones navegable con teclado y ratón
export class MenuList {
  constructor(scene, x, y, items, o = {}) {
    this.s = scene; this.x = x; this.y = y; this.items = items; this.o = o;
    this.w = o.w || 380; this.h = o.h || 52; this.gap = o.gap ?? 8;
    this.visible = o.visible || items.length;
    this.idx = Math.max(0, items.findIndex(i => !i.disabled)); this.top = 0;
    this.g = scene.add.graphics().setDepth(o.depth ?? 10);
    this.labels = []; this.values = [];
    this.anim = items.map(() => 0);
    this.active = true;
    this.build();
    this.pop = o.noInput ? null : Input.push((a, code) => this.handle(a, code));
    scene.events.once('shutdown', () => this.destroy());
  }
  build() {
    for (const t of this.labels) t.destroy();
    for (const t of this.values) t.destroy();
    this.labels = []; this.values = [];
    const n = Math.min(this.visible, this.items.length);
    for (let i = 0; i < n; i++) {
      const lt = txt(this.s, 0, 0, '', this.o.size || 26, '#ffffff').setDepth((this.o.depth ?? 10) + 1);
      const vt = txt(this.s, 0, 0, '', (this.o.size || 26) - 4, '#ffd166', { ox: 1 }).setDepth((this.o.depth ?? 10) + 1);
      const zone = this.s.add.zone(0, 0, this.w, this.h).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth((this.o.depth ?? 10) + 2);
      zone.on('pointerover', () => { const k = this.top + i; if (k < this.items.length && !this.items[k].disabled && this.idx !== k) { this.idx = k; Audio.play('ui_move'); this.changed(); } });
      zone.on('pointerdown', () => { const k = this.top + i; if (k < this.items.length) { this.idx = k; this.handle('confirm'); } });
      lt.zone = zone;
      this.labels.push(lt); this.values.push(vt);
    }
  }
  setItems(items, keepIdx = true) {
    this.items = items;
    this.anim = items.map(() => 0);
    if (!keepIdx || this.idx >= items.length) this.idx = 0;
    while (this.items[this.idx] && this.items[this.idx].disabled && this.idx < items.length - 1) this.idx++;
    this.build();
    this.changed();
  }
  changed() { if (this.o.onChange) this.o.onChange(this.items[this.idx], this.idx); }
  handle(a, code) {
    if (!this.active || !this.items.length) return;
    const it = this.items[this.idx];
    if (a === 'up' || a === 'down') {
      const d = a === 'up' ? -1 : 1;
      let k = this.idx;
      for (let n = 0; n < this.items.length; n++) { k = (k + d + this.items.length) % this.items.length; if (!this.items[k].disabled) break; }
      if (k !== this.idx) { this.idx = k; Audio.play('ui_move'); this.changed(); }
    } else if (a === 'left' && it && it.onLeft) { it.onLeft(); Audio.play('ui_move', { pitch: 0.8 }); this.changed(); }
    else if (a === 'right' && it && it.onRight) { it.onRight(); Audio.play('ui_move', { pitch: 1.2 }); this.changed(); }
    else if (a === 'confirm' && it) {
      if (it.disabled || it.locked) { Audio.play('ui_deny'); if (it.onLocked) it.onLocked(); return; }
      Audio.play('ui_select');
      this.flashT = 8;
      if (it.onSelect) it.onSelect(it, this.idx);
      else if (it.onRight) { it.onRight(); this.changed(); }
    } else if (a === 'back') { if (this.o.onBack) { Audio.play('ui_back'); this.o.onBack(); } }
    else if (this.o.onKey) this.o.onKey(a, code);
  }
  update() {
    if (!this.g.active) return;
    const g = this.g; g.clear();
    if (this.idx < this.top) this.top = this.idx;
    if (this.idx >= this.top + this.visible) this.top = this.idx - this.visible + 1;
    const n = this.labels.length;
    for (let i = 0; i < n; i++) {
      const k = this.top + i;
      const it = this.items[k];
      const lt = this.labels[i], vt = this.values[i];
      if (!it) { lt.setVisible(false); vt.setVisible(false); lt.zone.setVisible(false); continue; }
      lt.setVisible(true); vt.setVisible(true); lt.zone.setVisible(true);
      const sel = k === this.idx;
      this.anim[k] = (this.anim[k] || 0) + ((sel ? 1 : 0) - (this.anim[k] || 0)) * 0.25;
      const a = this.anim[k];
      const x = this.x + a * 18, y = this.y + i * (this.h + this.gap);
      const skew = 14, H = this.h, W = this.w;
      const col = it.color ? hex(it.color) : (this.o.accent ?? 0x7df9ff);
      const quad = (x0, y0, w, h, c1, c2, al) => {
        g.fillGradientStyle(c1, c2, c1, c2, al);
        g.fillTriangle(x0 + skew, y0, x0 + w, y0, x0 + w - skew, y0 + h); g.fillTriangle(x0 + skew, y0, x0 + w - skew, y0 + h, x0, y0 + h);
      };
      // sombra + cuerpo de cristal
      g.fillStyle(0x000000, 0.35); g.fillTriangle(x + skew + 3, y + 4, x + W + 3, y + 4, x + W - skew + 3, y + H + 4); g.fillTriangle(x + skew + 3, y + 4, x + W - skew + 3, y + H + 4, x + 3, y + H + 4);
      quad(x, y, W, H, sel ? 0x24164a : 0x120b24, sel ? 0x120b24 : 0x0a0716, 0.9);
      g.fillStyle(0xffffff, 0.05); g.fillTriangle(x + skew, y, x + W, y, x + W - skew * 0.5, y + H * 0.45); g.fillTriangle(x + skew, y, x + W - skew * 0.5, y + H * 0.45, x + skew * 0.5, y + H * 0.45);
      if (a > 0.02) {
        quad(x, y, W * (0.35 + 0.65 * a), H, col, 0x120b24, 0.28 * a);
        g.fillStyle(col, a); g.fillRect(x - 8 + skew * 0.5, y + 4, 5, H - 8);
        g.lineStyle(2, col, a);
        g.beginPath(); g.moveTo(x + skew, y); g.lineTo(x + W, y); g.lineTo(x + W - skew, y + H); g.lineTo(x, y + H); g.closePath(); g.strokePath();
        // destello que recorre el botón seleccionado
        const sx = x + ((this.s.time.now * 0.6) % (W + 300)) - 150;
        if (sel && sx > x && sx < x + W - 30) { g.fillStyle(0xffffff, 0.12); g.fillTriangle(sx, y + 1, sx + 26, y + 1, sx + 10, y + H - 1); g.fillTriangle(sx + 26, y + 1, sx + 36, y + 1, sx + 20, y + H - 1); }
        // chevron animado
        const cx2 = x + 12 + Math.sin(this.s.time.now * 0.01) * 2, cy2 = y + H / 2;
        g.fillStyle(col, a); g.fillTriangle(cx2, cy2 - 6, cx2 + 7, cy2, cx2, cy2 + 6);
      } else {
        g.lineStyle(1, 0x3a2a66, 0.8);
        g.beginPath(); g.moveTo(x + skew, y); g.lineTo(x + W, y); g.lineTo(x + W - skew, y + H); g.lineTo(x, y + H); g.closePath(); g.strokePath();
      }
      if (sel && this.flashT > 0) { g.fillStyle(0xffffff, this.flashT / 16); g.fillRect(x, y, this.w, this.h); }
      lt.setText((it.locked ? '🔒 ' : '') + it.label);
      lt.setPosition(x + 26 + a * 6, y + this.h / 2 - lt.height / 2);
      lt.setColor(it.disabled || it.locked ? '#6b6585' : sel ? '#ffffff' : '#c9c3e6');
      lt.setScale(1 + a * 0.04);
      const v = it.value ? it.value() : '';
      vt.setText(it.onLeft && sel ? `◀ ${v} ▶` : v);
      vt.setPosition(x + this.w - 22, y + this.h / 2 - vt.height / 2);
      lt.zone.setPosition(x, y);
    }
    if (this.flashT > 0) this.flashT--;
    // indicadores de scroll
    if (this.items.length > this.visible) {
      const yb = this.y + this.visible * (this.h + this.gap);
      g.fillStyle(0x7df9ff, this.top > 0 ? 0.9 : 0.15); g.fillTriangle(this.x + this.w / 2 - 10, this.y - 8, this.x + this.w / 2 + 10, this.y - 8, this.x + this.w / 2, this.y - 18);
      g.fillStyle(0x7df9ff, this.top + this.visible < this.items.length ? 0.9 : 0.15); g.fillTriangle(this.x + this.w / 2 - 10, yb, this.x + this.w / 2 + 10, yb, this.x + this.w / 2, yb + 10);
    }
  }
  destroy() {
    if (this.pop) { this.pop(); this.pop = null; }
    for (const t of this.labels) { if (t.zone) t.zone.destroy(); t.destroy(); }
    for (const t of this.values) t.destroy();
    this.labels = []; this.values = [];
    if (this.g) this.g.destroy();
  }
}

// Previsualización animada de un stickman (menús, VS, resultados)
export class StickPreview {
  constructor(scene, x, y, profile, o = {}) {
    this.s = scene; this.x = x; this.y = y; this.profile = profile;
    this.scale = o.scale || 1.6; this.facing = o.facing || 1;
    this.g = scene.add.graphics().setDepth(o.depth ?? 5);
    this.glow = scene.add.graphics().setDepth((o.depth ?? 5) - 1).setBlendMode('ADD');
    this.anim = o.anim || 'idle';
    this.f = 0;
    this.pose = makePose(POSES.idle);
    this.j = {};
    this.glowAmt = o.glow ?? 0.8;
  }
  setProfile(p) { this.profile = p; }
  setAnim(a) { this.anim = a; this.f = 0; }
  look() {
    const p = this.profile;
    return { body: hex(p.color || '#f4f4f8'), accent: hex(p.accent || '#ffd166'), aura: p.aura === 'rainbow' ? 0xffffff : hex(p.aura || '#7df9ff'), accessory: p.accessory || 'none', outline: 0x0a0a14,
      auraFn: p.aura === 'rainbow' ? (t => { const h = (t * 3) % 360; return hslInt(h); }) : null };
  }
  update() {
    this.f++;
    const a = this.anim;
    if (CELEBRATIONS[a] || DEFEATS[a]) {
      const c = CELEBRATIONS[a] || DEFEATS[a];
      playCelebration(c, this.f, this.pose);
    } else if (POSES[a]) { copyPose(POSES[a], this.pose); MODS.breathe(this.pose, this.f); }
    else { copyPose(POSES.guard, this.pose); MODS.breathe(this.pose, this.f); }
    computeJoints(this.pose, this.x, this.y, this.facing, this.scale, true, this.j);
    this.g.clear(); this.glow.clear();
    this.glow.fillStyle(0x000000, 0.4); this.g.fillStyle(0x000000, 0.35); this.g.fillEllipse(this.x, this.y + 4, 90 * this.scale, 14 * this.scale);
    drawBody(this.g, this.glow, this.j, this.pose, this.scale, this.look(), 1, { glow: this.glowAmt, time: this.f });
  }
  destroy() { this.g.destroy(); this.glow.destroy(); }
}

function hslInt(h) {
  const s = 1, l = 0.6;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

// Transición cinemática entre escenas
export function go(scene, key, data) {
  if (scene._leaving) return;
  scene._leaving = true;
  // Phaser reutiliza las instancias de escena: hay que liberar la marca al cerrarla
  scene.events.once('shutdown', () => { scene._leaving = false; });
  Input.clearPressed();
  const cam = scene.cameras.main;
  const g = scene.add.graphics().setDepth(1000).setScrollFactor(0);
  let t = 0;
  const ev = scene.time.addEvent({
    delay: 16, loop: true, callback: () => {
      t++;
      g.clear(); g.fillStyle(0x000000, 1);
      const p = Math.min(1, t / 14);
      const w = 1280 / cam.zoom * 1.6;
      for (let i = 0; i < 8; i++) {
        const yy = i * 90, x0 = -200 + (1 - p) * (i % 2 ? w : -w);
        g.fillStyle(0x05030c, 1); g.fillRect(x0, yy, w, 92);
        g.fillStyle(i % 2 ? 0x7df9ff : 0xff2d95, 0.9); g.fillRect(i % 2 ? x0 - 4 : x0 + w, yy, 4, 92);
      }
      if (t >= 16) { ev.remove(); scene.scene.start(key, data); }
    }
  });
}
export function fadeIn(scene) {
  const g = scene.add.graphics().setDepth(1000).setScrollFactor(0);
  let t = 0;
  const ev = scene.time.addEvent({
    delay: 16, loop: true, callback: () => {
      t++;
      g.clear(); g.fillStyle(0x000000, 1);
      const p = Math.min(1, t / 14);
      for (let i = 0; i < 8; i++) {
        const x0 = -200 + p * (i % 2 ? 1700 : -1700);
        g.fillStyle(0x05030c, 1); g.fillRect(x0, i * 90, 1700, 92);
        g.fillStyle(i % 2 ? 0x7df9ff : 0xff2d95, 0.9 * (1 - p)); g.fillRect(i % 2 ? x0 - 4 : x0 + 1700, i * 90, 4, 92);
      }
      if (t >= 16) { ev.remove(); g.destroy(); }
    }
  });
}

export function toast(scene, text, color = '#ffd166', delay = 0) {
  scene.time.delayedCall(delay, () => {
    const c = scene.add.container(1280 + 10, 90).setDepth(500);
    const bg = scene.add.graphics();
    bg.fillStyle(0x120c22, 0.95); bg.fillRoundedRect(0, 0, 380, 64, 10); bg.lineStyle(2, hex(color), 1); bg.strokeRoundedRect(0, 0, 380, 64, 10);
    const t = txt(scene, 16, 32, text, 20, color, { oy: 0.5, wrap: 350 });
    c.add([bg, t]);
    scene.tweens.add({ targets: c, x: 1280 - 400, duration: 350, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: c, x: 1300, delay: 2600, duration: 300, onComplete: () => c.destroy() });
    Audio.play('energyFull');
  });
}

export function keyHints(scene, hints, y = 696) {
  const t = txt(scene, 640, y, hints, 15, '#c9c3e6', { ox: 0.5, body: true, oy: 0.5, bold: true }).setDepth(50);
  const g = scene.add.graphics().setDepth(49);
  g.fillStyle(0x000000, 0.55); g.fillRoundedRect(640 - t.width / 2 - 16, y - 13, t.width + 32, 26, 13);
  g.lineStyle(1, 0x3a2a66, 1); g.strokeRoundedRect(640 - t.width / 2 - 16, y - 13, t.width + 32, 26, 13);
  return t;
}

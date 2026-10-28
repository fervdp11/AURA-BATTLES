import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Audio } from '../core/Audio.js';
import { txt, StickPreview } from '../ui/UI.js';
import { hex, mix } from '../view/StickRenderer.js';
import { STATUS } from '../sim/status.js';
import { MOVES } from '../sim/moves.js';
import { keyName, Input } from '../core/Input.js';

const COMBO_LABELS = [[16, 'AURA GOD', '#ff4d6d'], [12, '+1000 AURA', '#ffd166'], [8, 'SIGMA COMBO', '#c084fc'], [5, 'AURA FARMING', '#7df9ff'], [3, 'NICE', '#7bd389']];
const SIDE_COL = [0x7df9ff, 0xff5fa2];

// HUD de combate: barras de aura/energía, retratos, temporizador, marcador, barras de técnicas por jugador,
// anuncios, combos, banners de ultimate, tutorial y datos de entrenamiento.
export class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }
  init(data) { this.fight = data.fight; }
  create() {
    // la instancia de escena se reutiliza entre combates: reinicia el estado
    this.pills0 = []; this.pills1 = []; this.lastMove = null; this.tut = null; this.sl = null;
    const b = this.fight.battle;
    this.b = b;
    this.versus = !!b.opts.versus;
    this.g = this.add.graphics();
    this.gTop = this.add.graphics().setDepth(50);
    this.p = b.player;
    this.p2 = this.versus ? b.fighters.find(f => f.isHuman && f !== this.p) : null;
    this.enemies = () => b.fighters.filter(f => f.team !== this.p.team && !f.decoyOf);
    this.ghost = new Map();
    this.texts = {};
    const T = (k, x, y, s, c, o) => (this.texts[k] = txt(this, x, y, '', s, c, o));
    T('pName', 132, 10, 24, '#ffffff');
    T('pAura', 556, 47, 15, '#ffffff', { ox: 1, oy: 0.5 });
    T('eName', 1148, 10, 24, '#ffffff', { ox: 1 });
    T('eAura', 724, 47, 15, '#ffffff', { oy: 0.5 });
    T('timer', 640, 44, 50, '#ffffff', { ox: 0.5, oy: 0.5, strokeThickness: 6 });
    T('score', 640, 104, 18, '#ffffff', { ox: 0.5, oy: 0.5 });
    T('pUlt', 136, 90, 15, '#ffd166');
    T('eUlt', 1144, 90, 15, '#ffd166', { ox: 1 });
    T('pCombo', 56, 250, 64, '#ffffff', { strokeThickness: 8 });
    T('pComboL', 60, 322, 26, '#7df9ff');
    T('pComboD', 60, 352, 18, '#c9c3e6');
    T('eCombo', 1224, 250, 64, '#ffffff', { ox: 1, strokeThickness: 8 });
    T('eComboL', 1220, 322, 26, '#ff4d6d', { ox: 1 });
    T('eComboD', 1220, 352, 18, '#c9c3e6', { ox: 1 });
    T('ann', 640, 330, 110, '#ffffff', { ox: 0.5, oy: 0.5, strokeThickness: 12 });
    T('annSub', 640, 412, 32, '#ffd166', { ox: 0.5, oy: 0.5 });
    T('wave', 640, 122, 22, '#ffd166', { ox: 0.5 });
    T('fps', 1270, 704, 14, '#7df9ff', { ox: 1, oy: 1, body: true });
    T('train', 940, 134, 15, '#c9c3e6', { body: true, wrap: 320 });
    this.texts.ann.setDepth(57); this.texts.annSub.setDepth(57);
    this.annBand = this.add.graphics().setDepth(56);
    this.annK = 0;
    this.multiTexts = [];
    // retratos
    this.portraits = [];
    this.makePortrait(this.p, 66, 56, 1, SIDE_COL[0]);
    const es = this.enemies();
    this.ePortrait = this.makePortrait(es[0], 1214, 56, -1, this.versus ? SIDE_COL[1] : 0xff4d6d);
    // barras de técnicas: jugador (izquierda) y, en multijugador, J2 (derecha)
    this.bars = [this.buildSlots(this.p, 'left')];
    if (this.p2) this.bars.push(this.buildSlots(this.p2, 'right'));
    // overlays
    this.flashRect = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 0).setDepth(60);
    this.lbTop = this.add.rectangle(640, -40, 1280, 80, 0x000000, 1).setDepth(55);
    this.lbBot = this.add.rectangle(640, 760, 1280, 80, 0x000000, 1).setDepth(55);
    this.t = 0;
    const fe = this.fight.events;
    this.handlers = {
      flash: (c, ms) => { this.flashRect.setFillStyle(c, 0.7); this.tweens.add({ targets: this.flashRect, fillAlpha: 0, duration: ms || 200 }); },
      ultBanner: d => this.ultBanner(d.f, d.def),
      letterbox: frames => this.letterbox(frames),
      ko: e => this.ko(e),
      bev: e => this.onBev(e),
      wave: n => { this.texts.wave.setText('OLEADA ' + n); this.announce('OLEADA ' + n, n % 5 === 0 ? '¡JEFE!' : '¡Vienen más!', '#ffd166'); }
    };
    for (const k in this.handlers) fe.on(k, this.handlers[k]);
    this.events.once('shutdown', () => { for (const k in this.handlers) fe.off(k, this.handlers[k]); for (const p of this.portraits) p.prev.destroy(); });
    if (b.opts.mode === 'survival') this.texts.wave.setText('OLEADA 1');
    // tutorial guiado la primera vez que se entra al entrenamiento
    if (b.training && !Save.d.tutorialDone) this.startTutorial();
  }

  buildSlots(f, side) {
    const prof = f.ctrlProfile || 'solo';
    const k = a => keyName(Input.codesFor(a, prof)[0]);
    const lo = f.loadout, sp = k('special');
    const fwd = side === 'left' ? '→' : '←';
    const slots = [
      { k: sp, id: lo.special }, { k: fwd + sp, id: lo.specialF }, { k: '↓' + sp, id: lo.specialD },
      { k: k('skill1'), id: lo.skill1 }, { k: k('skill2'), id: lo.skill2 }, { k: k('ult'), id: lo.ult }
    ];
    // en multijugador cada barra ocupa media pantalla
    const W = this.versus ? 100 : 124, gap = this.versus ? 4 : 8;
    const x0 = side === 'left' ? 20 : 1280 - 20 - slots.length * (W + gap) + gap;
    slots.forEach((s, i) => {
      s.x = x0 + i * (W + gap); s.w = W; s.y = 648; s.bump = 0; s.wasOk = true;
      s.name = txt(this, s.x + W / 2, 684, (MOVES[s.id] || {}).name || '-', this.versus ? 12 : 13, '#ffffff', { ox: 0.5, oy: 0.5, body: true, bold: true });
      s.key = txt(this, s.x + 8, 661, s.k, 14, '#ffd166', { oy: 0.5 });
      s.cost = txt(this, s.x + W - 6, 661, String((MOVES[s.id] || {}).cost || 0), 13, '#7df9ff', { ox: 1, oy: 0.5, body: true });
      if (s.name.width > W - 8) s.name.setScale((W - 8) / s.name.width);
    });
    return { f, slots, col: side === 'left' ? SIDE_COL[0] : SIDE_COL[1] };
  }

  startTutorial() {
    const k = a => keyName(Input.codesFor(a)[0]);
    const p = this.p;
    this.tut = {
      i: 0, used: new Set(),
      steps: [
        { t: `Muévete con ${k('left')} ${k('right')}`, ok: () => { if (this.b.phase !== 'fight') return false; if (this.tut.x0 === undefined) this.tut.x0 = p.x; return Math.abs(p.x - this.tut.x0) > 120; } },
        { t: `Salta con ${k('up')} (y otra vez en el aire para doble salto)`, ok: () => p.state === 'air' },
        { t: `Combo básico: ${k('light')}, ${k('light')}, ${k('light')} cerca del muñeco`, ok: () => this.tut.used.has('hook') },
        { t: `Ataque fuerte: ${k('heavy')}  ·  Lanzador: ${k('down')} + ${k('heavy')}`, ok: () => this.tut.used.has('roundhouse') || this.tut.used.has('uppercut') },
        { t: `Técnica especial: ${k('special')} (${(MOVES[p.loadout.special] || {}).name || 'Especial'})`, ok: () => this.tut.used.has(p.loadout.special) },
        { t: `Mantén ${k('block')} para bloquear (púlsalo justo antes del golpe para PARRY)`, ok: () => p.state === 'block' },
        { t: `Dash / esquiva: ${k('dash')} + dirección`, ok: () => p.state === 'dash' },
        { t: `¡ULTIMATE! Pulsa ${k('ult')} con la energía llena`, ok: () => this.tut.used.has(p.loadout.ult) }
      ]
    };
    this.tutBox = this.add.graphics().setDepth(40);
    this.tutText = txt(this, 640, 154, '', 26, '#ffffff', { ox: 0.5, oy: 0.5 }).setDepth(41);
    this.tutStep = txt(this, 640, 120, '', 16, '#7df9ff', { ox: 0.5, oy: 0.5, body: true }).setDepth(41);
  }
  tutorialTick() {
    const T = this.tut;
    if (!T) return;
    const st = T.steps[T.i];
    if (st && st.ok()) {
      T.i++;
      Audio.play('energyFull');
      this.tutText.setScale(1.3); this.tweens.add({ targets: this.tutText, scale: 1, duration: 200 });
    }
    const g = this.tutBox; g.clear();
    if (T.i >= T.steps.length) {
      if (!T.done) {
        T.done = true;
        Save.d.tutorialDone = true; Save.d.ap += 100; Save.save();
        this.tutText.setText('¡TUTORIAL COMPLETADO! +100 AP').setColor('#ffd166'); this.tutStep.setText('Ya estás listo para el Camino del Aura');
        Audio.play('victory');
        this.time.delayedCall(3500, () => { this.tutText.destroy(); this.tutStep.destroy(); g.destroy(); this.tut = null; });
      }
      if (g.active) { g.fillStyle(0x000000, 0.6); g.fillRoundedRect(340, 100, 600, 80, 12); }
      return;
    }
    g.fillStyle(0x07040f, 0.78); g.fillRoundedRect(340, 100, 600, 80, 12);
    g.lineStyle(2, 0x7df9ff, 0.8); g.strokeRoundedRect(340, 100, 600, 80, 12);
    g.fillStyle(0x7df9ff, 0.25); g.fillRect(350, 172, 580, 4);
    g.fillStyle(0x7df9ff, 1); g.fillRect(350, 172, 580 * T.i / T.steps.length, 4);
    this.tutStep.setText(`TUTORIAL ${T.i + 1}/${T.steps.length}`);
    this.tutText.setText(T.steps[T.i].t);
  }

  makePortrait(f, x, y, facing, ring) {
    const prev = new StickPreview(this, x - facing * 6, y + 300, f.profile, { scale: 2.1, facing, anim: 'guard', depth: 3, glow: 0.3 });
    const mg = this.make.graphics({ add: false }); mg.fillStyle(0xffffff); mg.fillCircle(x, y, 40);
    const mask = mg.createGeometryMask();
    prev.g.setMask(mask); prev.glow.setMask(mask);
    const pr = { f, prev, x, y, ring, hitT: 0, lastAura: f.aura };
    this.portraits.push(pr);
    return pr;
  }

  onBev(e) {
    if (e.type === 'move' && this.tut && e.f === this.p) this.tut.used.add(e.def.id);
    if (e.type === 'announce') {
      if (e.fight) { this.announce(e.text, '', '#7df9ff', 70); Audio.play('fightHit'); }
      else if (e.time) { this.announce(e.text, '', '#ffd166', 90); Audio.play('roundGong'); }
      else {
        const sub = e.sub2 || (e.sub ? (this.b.opts.mode === 'survival' ? 'SUPERVIVENCIA' : this.subtitle()) : '');
        const col = this.versus && e.text.startsWith('RONDA PARA J') ? (e.text.endsWith('1') ? '#7df9ff' : '#ff5fa2') : '#ffffff';
        this.announce(e.text, sub, col, 80);
        if (e.text.startsWith('RONDA') || e.text.startsWith('¿')) Audio.play('roundGong');
      }
    }
    if (e.type === 'roundStart' && this.b.round > 1) this.announce('RONDA ' + this.b.round, '', '#ffffff', 80);
    if (e.type === 'energyFull' || (e.type === 'move' && e.def.slot === 'ult')) for (const bar of this.bars) if (bar.f === e.f) bar.slots[5].bump = 1;
  }
  subtitle() {
    if (this.versus) return `${this.p.name}  VS  ${this.p2.name}`;
    const es = this.enemies();
    return es.length > 1 ? `1 CONTRA ${es.length}` : (es[0] && es[0].boss ? 'COMBATE DE JEFE' : '');
  }

  // anuncio grande con banda diagonal animada
  announce(text, sub = '', color = '#ffffff', frames = 80) {
    const t = this.texts.ann;
    t.setText(text).setColor(color).setScale(2.4).setAlpha(0);
    this.texts.annSub.setText(sub).setAlpha(0);
    this.tweens.killTweensOf([t, this.texts.annSub, this]);
    this.annK = 0; this.annCol = Phaser.Display.Color.HexStringToColor(color).color;
    this.tweens.add({ targets: this, annK: 1, duration: 180, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.texts.annSub, alpha: 1, delay: 150, duration: 200 });
    this.tweens.add({ targets: [t, this.texts.annSub], alpha: 0, delay: frames * 16, duration: 300 });
    this.tweens.add({ targets: this, annK: 0, delay: frames * 16, duration: 300 });
  }
  drawAnnBand() {
    const g = this.annBand; g.clear();
    const k = this.annK;
    if (k <= 0.01) return;
    const h = 150 * k, y = 368;
    g.fillStyle(0x000000, 0.55 * k);
    g.beginPath(); g.moveTo(-40, y - h / 2 + 18); g.lineTo(1320, y - h / 2 - 18); g.lineTo(1320, y + h / 2 - 18); g.lineTo(-40, y + h / 2 + 18); g.closePath(); g.fillPath();
    g.fillStyle(this.annCol || 0xffffff, 0.9 * k);
    g.fillRect(-40, y - h / 2 + 10 * k, 1360 * k, 3); g.fillRect(1320 - 1360 * k, y + h / 2 - 12 * k, 1360 * k, 3);
    for (let i = 0; i < 10; i++) { const x = ((this.t * 18 + i * 157) % 1500) - 110; g.fillStyle(0xffffff, 0.06 * k); g.fillRect(x, y - h / 2 + 20, 90, h - 40); }
  }

  ko(e) {
    const perfect = !this.versus && this.b.player.aura >= this.b.player.maxAura * 0.999 && e.attacker === this.b.player;
    const time = !!(this.b.lastKO && this.b.lastKO.time);
    const ult = e.attacker && e.attacker.move && e.attacker.move.def.slot === 'ult';
    const hum = e.attacker && e.attacker.move && e.attacker.move.def.taunt;
    this.announce(time ? 'TIEMPO' : ult ? 'ULTIMATE K.O.' : 'K.O.', perfect ? 'PERFECT AURA' : hum ? 'HUMILLADO' : ult ? e.attacker.move.def.name.toUpperCase() : 'AURA DESTRUIDA', perfect ? '#ffd166' : ult ? '#c084fc' : '#ff4d6d', 120);
    if (!time) { Audio.play('koSting'); this.speedLines(70, 0xffffff); }
  }

  speedLines(frames, color = 0xffffff) { this.sl = { t: frames, max: frames, color }; }
  drawSpeedLines() {
    const S = this.sl; const g = this.gTop; g.clear();
    if (!S) return;
    if (S.t <= 0) { this.sl = null; return; }
    S.t--;
    const k = S.t / S.max;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const r1 = 300 + Math.random() * 200, r2 = 900, w = 1 + Math.random() * 5;
      const c = Math.cos(a), s = Math.sin(a) * 0.7;
      g.fillStyle(S.color, 0.5 * k);
      g.fillTriangle(640 + c * r1, 360 + s * r1, 640 + c * r2 - s * w, 360 + s * r2 + c * w, 640 + c * r2 + s * w, 360 + s * r2 - c * w);
    }
  }

  letterbox(frames) {
    this.tweens.add({ targets: this.lbTop, y: 40, duration: 200 });
    this.tweens.add({ targets: this.lbBot, y: 680, duration: 200 });
    this.tweens.add({ targets: this.lbTop, y: -40, delay: frames * 16 + 100, duration: 300 });
    this.tweens.add({ targets: this.lbBot, y: 760, delay: frames * 16 + 100, duration: 300 });
  }

  ultBanner(f, def) {
    this.speedLines(45, hex(def.color || '#ffffff'));
    const c = this.add.container(0, 0).setDepth(58);
    const col = hex(def.color || '#ffffff');
    const left = f.team === this.p.team;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.78); g.fillRect(-200, 250, 1680, 210);
    g.fillStyle(col, 0.9); g.fillRect(-200, 250, 1680, 8); g.fillRect(-200, 452, 1680, 8);
    for (let i = 0; i < 30; i++) { g.fillStyle(col, 0.15); g.fillRect(Math.random() * 1280, 262 + Math.random() * 180, 80 + Math.random() * 200, 3); }
    const prev = new StickPreview(this, left ? 300 : 980, 690, f.profile, { scale: 3, facing: left ? 1 : -1, anim: (def.anim && def.anim[1] && typeof def.anim[1][1] === 'string') ? def.anim[1][1] : 'guard', depth: 59, glow: 1.4 });
    const m = this.make.graphics({ add: false }); m.fillStyle(0xffffff); m.fillRect(0, 258, 1280, 194);
    const mask = m.createGeometryMask(); prev.g.setMask(mask); prev.glow.setMask(mask);
    const nm = def.name.toUpperCase();
    const t1 = txt(this, left ? 540 : 740, 330, nm, Math.min(72, Math.floor(700 / (nm.length * 0.5))), def.color || '#ffffff', { ox: left ? 0 : 1, oy: 0.5, strokeThickness: 8 });
    const t2 = txt(this, left ? 566 : 714, 400, 'ULTIMATE · ' + f.name, 24, '#ffffff', { ox: left ? 0 : 1, oy: 0.5 });
    c.add([g, t1, t2]);
    c.setAngle(left ? -4 : 4);
    c.x = left ? -1300 : 1300;
    this.tweens.add({ targets: c, x: 0, duration: 160, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: c, x: left ? 1400 : -1400, delay: 620, duration: 180, ease: 'Cubic.easeIn', onComplete: () => { c.destroy(); prev.destroy(); } });
    this.time.addEvent({ delay: 16, repeat: 50, callback: () => { prev.x = (left ? 300 : 980) + c.x; prev.update(); } });
  }

  // barra inclinada con degradado, fantasma de daño, marcas cada 10% y brillo
  bar(g, x, y, w, h, pct, ghost, col, dir = 1, skew = 12) {
    const X = dir > 0 ? x : x - w;
    const poly = (xx, ww, c, a, c2) => {
      if (ww <= 0) return;
      let x1, x2, x3, x4;
      if (dir > 0) { x1 = xx + skew; x2 = xx + ww + skew; x3 = xx + ww; x4 = xx; }
      else { x1 = xx; x2 = xx + ww; x3 = xx + ww - skew; x4 = xx - skew; }
      if (c2 !== undefined) g.fillGradientStyle(c2, c2, c, c, a); else g.fillStyle(c, a);
      g.fillTriangle(x1, y, x2, y, x3, y + h); g.fillTriangle(x1, y, x3, y + h, x4, y + h);
    };
    poly(X - 5, w + 10, 0x000000, 0.8);
    poly(X, w, 0x150d28, 1);
    const gw = w * Math.max(0, Math.min(1, ghost)), pw = w * Math.max(0, Math.min(1, pct));
    poly(dir > 0 ? X : X + w - gw, gw, 0xffffff, 0.85);
    poly(dir > 0 ? X : X + w - pw, pw, mix(col, 0x000000, 0.25), 1, mix(col, 0xffffff, 0.35));
    // marcas de segmento
    g.fillStyle(0x000000, 0.35);
    for (let i = 1; i < 10; i++) { const sx = X + w * i / 10; g.fillRect(sx + skew * 0.5 - 1, y + 2, 2, h - 4); }
    // brillo que recorre la barra
    const sh = ((this.t * 4) % (w + 200)) - 100;
    if (sh > 0 && sh < pw) { const sx = dir > 0 ? X + sh : X + w - sh; g.fillStyle(0xffffff, 0.22); g.fillTriangle(sx, y, sx + 18, y, sx + 6, y + h); }
    g.fillStyle(0xffffff, 0.22); g.fillRect(dir > 0 ? X + skew : X + w - pw, y + 2, Math.max(0, pw - skew), 3);
  }

  auraColor(f, side = 0) {
    const p = f.auraPct;
    if (p > 0.6) return f.profile.aura === 'rainbow' ? 0x7df9ff : this.versus ? SIDE_COL[side] : hex(f.profile.aura || '#7df9ff');
    if (p > 0.3) return 0xffd166;
    return Math.floor(this.t / 8) % 2 ? 0xff2d55 : 0xff6b6b;
  }

  energyBar(g, f, x, y, w, dir) {
    const X = dir > 0 ? x : x - w;
    g.fillStyle(0x000000, 0.8); g.fillRoundedRect(X - 3, y - 3, w + 6, 16, 4);
    const e = f.energy / 100;
    const full = e >= 1;
    for (let i = 0; i < 4; i++) {
      const seg = Math.max(0, Math.min(1, e * 4 - i));
      const sx = X + i * (w / 4) + 1, sw = w / 4 - 3;
      g.fillStyle(0x2a1d0a, 1); g.fillRect(sx, y, sw, 10);
      if (seg > 0) {
        const fw = sw * seg, fx = dir > 0 ? sx : sx + sw - fw;
        g.fillGradientStyle(0xffe08a, 0xffe08a, 0xff9e1c, 0xff9e1c, 1); g.fillRect(fx, y, fw, 10);
        if (seg >= 1) { g.fillStyle(0xffffff, full ? 0.3 + Math.sin(this.t * 0.3 + i) * 0.25 : 0.12); g.fillRect(sx, y, sw, 3); }
      }
    }
    if (full) { g.lineStyle(2, 0xffd166, 0.5 + Math.sin(this.t * 0.25) * 0.4); g.strokeRoundedRect(X - 4, y - 4, w + 8, 18, 5); }
  }

  statusPills(g, f, x, y, dir) {
    let ox = 0;
    const key = dir > 0 ? 'pills0' : 'pills1';
    const pool = this[key];
    let i = 0;
    for (const s of f.status) {
      const d = STATUS[s.id];
      if (!d || !d.label) continue;
      let t = pool[i];
      if (!t) { t = txt(this, 0, 0, '', 12, '#ffffff', { body: true, bold: true, oy: 0.5 }); pool.push(t); }
      t.setText(d.label).setVisible(true);
      const w = t.width + 14;
      const px = dir > 0 ? x + ox : x - ox - w;
      g.fillStyle(d.color, 0.88); g.fillRoundedRect(px, y, w, 18, 6);
      g.fillStyle(0x000000, 0.45); g.fillRect(px + 3, y + 14, (w - 6) * (1 - s.t / s.max), 2);
      t.setPosition(px + 7, y + 9);
      const lum = ((d.color >> 16) & 255) * 0.3 + ((d.color >> 8) & 255) * 0.59 + (d.color & 255) * 0.11;
      t.setColor(lum > 170 ? '#111111' : '#ffffff');
      ox += w + 4; i++;
      if (i > 5) break;
    }
    for (; i < pool.length; i++) pool[i].setVisible(false);
  }

  drawSlots(g, bar) {
    const f = bar.f, b = this.b;
    for (const s of bar.slots) {
      const m = MOVES[s.id]; if (!m) continue;
      const cd = f.cool[s.id] || 0;
      const cost = f.costOf(m);
      const ok = cd <= 0 && (f.infiniteEnergy || f.energy >= cost) && !f.hasStatus('silenced') && (!m.cond || m.cond(f, b)) && !(m.once && f.usedOnce[m.id]);
      if (ok && !s.wasOk) s.bump = 1;
      s.wasOk = ok;
      s.bump *= 0.88;
      const lift = s.bump * 6, x = s.x, y = s.y - lift, W = s.w;
      const mc = hex(m.color || '#7df9ff');
      g.fillStyle(0x000000, 0.4); g.fillRoundedRect(x + 3, s.y + 4, W, 50, 9);
      g.fillGradientStyle(0x1c1236, 0x1c1236, 0x0a0614, 0x0a0614, 0.92); g.fillRect(x, y + 2, W, 46);
      g.fillStyle(0x1c1236, 0.92); g.fillRoundedRect(x, y, W, 50, 9);
      if (ok) { g.fillStyle(mc, 0.16 + s.bump * 0.3); g.fillRoundedRect(x, y, W, 50, 9); }
      if (cd > 0 && m.cd) { g.fillStyle(0x000000, 0.55); g.fillRoundedRect(x, y, W * (cd / m.cd), 50, 9); g.fillStyle(0x7df9ff, 0.5); g.fillRect(x + W * (cd / m.cd) - 2, y + 4, 2, 42); }
      else if (!ok) { g.fillStyle(0x000000, 0.35); g.fillRoundedRect(x, y, W, 50, 9); }
      g.lineStyle(2, ok ? mc : 0x3a2f55, ok ? 1 : 0.9); g.strokeRoundedRect(x, y, W, 50, 9);
      if (m.slot === 'ult' && ok) { g.lineStyle(3, 0xffd166, 0.35 + Math.sin(this.t * 0.2) * 0.3); g.strokeRoundedRect(x - 3, y - 3, W + 6, 56, 11); }
      // insignia de tecla
      g.fillStyle(0x000000, 0.7); g.fillRoundedRect(x + 3, y + 4, Math.max(18, s.key.width + 8), 18, 5);
      s.key.setPosition(x + 7, y + 13); s.cost.setPosition(x + W - 6, y + 13); s.name.setPosition(x + W / 2, y + 36);
      s.name.setAlpha(ok ? 1 : 0.45); s.key.setAlpha(ok ? 1 : 0.6);
      s.cost.setColor(f.infiniteEnergy || f.energy >= cost ? '#7df9ff' : '#ff6b6b');
    }
  }

  update() {
    this.t++;
    const g = this.g; g.clear();
    const b = this.b, p = this.p;
    const T = this.texts;
    const es = this.enemies();
    // placa superior
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0); g.fillRect(0, 0, 1280, 130);
    // jugador (izquierda)
    this.bar(g, 128, 36, 432, 24, p.auraPct, this.ghostOf(p), this.auraColor(p, 0), 1);
    this.energyBar(g, p, 134, 70, 380, 1);
    T.pName.setText(p.name + (p.profile.title ? '  ·  ' + p.profile.title : ''));
    T.pAura.setText(Math.ceil(p.aura) + ' AURA');
    const pk = keyName(Input.codesFor('ult', p.ctrlProfile)[0]);
    T.pUlt.setText(p.energy >= 100 ? `✦ ULTIMATE LISTA [${pk}]` : `ENERGÍA ${Math.floor(p.energy)}`);
    T.pUlt.setColor(p.energy >= 100 ? (Math.floor(this.t / 10) % 2 ? '#ffffff' : '#ffd166') : '#ffb703');
    this.statusPills(g, p, 134, 110, 1);
    // rivales (derecha)
    if (es.length === 1) {
      const e = es[0];
      this.bar(g, 1152, 36, 432, 24, e.auraPct, this.ghostOf(e), this.auraColor(e, 1), -1);
      this.energyBar(g, e, 1146, 70, 380, -1);
      T.eName.setText((e.profile.title ? e.profile.title + '  ·  ' : '') + e.name);
      T.eAura.setText(Math.ceil(e.aura) + ' AURA');
      const ek = this.versus ? ` [${keyName(Input.codesFor('ult', e.ctrlProfile)[0])}]` : '';
      T.eUlt.setText(e.energy >= 100 ? '✦ ULTIMATE LISTA' + ek : this.versus ? `ENERGÍA ${Math.floor(e.energy)}` : '');
      T.eUlt.setColor(e.energy >= 100 ? (Math.floor(this.t / 10) % 2 ? '#ffffff' : '#ffd166') : '#ffb703');
      this.statusPills(g, e, 1146, 110, -1);
    } else {
      T.eName.setText(''); T.eAura.setText(''); T.eUlt.setText('');
      while (this.multiTexts.length < es.length) this.multiTexts.push(txt(this, 0, 0, '', 16, '#ffffff', { ox: 1 }));
      es.forEach((e, i) => {
        const y = 20 + i * 44;
        this.bar(g, 1240, y + 18, 300, 14, e.auraPct, this.ghostOf(e), e.alive ? this.auraColor(e, 1) : 0x444444, -1, 8);
        g.fillStyle(0xffb703, 1); g.fillRect(1240 - 240 * e.energy / 100, y + 35, 240 * e.energy / 100, 3);
        this.multiTexts[i].setText(e.name + (e.alive ? '' : '  ✖')).setPosition(1240, y - 2).setColor(e.alive ? '#ffffff' : '#666666');
      });
      for (let i = es.length; i < this.multiTexts.length; i++) this.multiTexts[i].setText('');
    }
    // temporizador en insignia hexagonal
    const tm = b.timerMax > 0 && !b.training;
    const low = tm && b.timer <= 10;
    const hx = 640, hy = 46, R = 46;
    const hexPts = k2 => { const pts = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; pts.push({ x: hx + Math.cos(a) * R * k2, y: hy + Math.sin(a) * R * 0.86 * k2 }); } return pts; };
    g.fillStyle(0x000000, 0.85); g.fillPoints(hexPts(1.08), true);
    g.fillStyle(0x1c1236, 1); g.fillPoints(hexPts(0.96), true);
    g.fillStyle(0xffffff, 0.05); g.fillPoints(hexPts(0.96).slice(3).concat([{ x: hx + 41, y: hy }]), true);
    g.lineStyle(3, low ? 0xff4d6d : 0x7b5cd6, low ? 0.6 + Math.sin(this.t * 0.4) * 0.4 : 1); g.strokePoints(hexPts(1), true);
    T.timer.setText(tm ? String(b.timer) : '∞').setColor(low ? '#ff4d6d' : '#ffffff').setScale(low && b.phase === 'fight' ? 1 + Math.max(0, Math.sin(this.t * 0.4)) * 0.08 : 1);
    if (low && this._lastTick !== b.timer && b.phase === 'fight') { this._lastTick = b.timer; Audio.play('tick'); }
    if (b.roundsToWin > 1) for (let t = 0; t < 2; t++) for (let i = 0; i < b.roundsToWin; i++) {
      const x = t === 0 ? 616 - i * 18 : 664 + i * 18;
      g.fillStyle(0x000000, 0.8); g.fillCircle(x, 92, 7);
      g.fillStyle(b.wins[t] > i ? (this.versus ? SIDE_COL[t] : 0xffd166) : 0x333344, 1); g.fillCircle(x, 92, 5);
    }
    // marcador de la sesión en multijugador
    if (this.versus) {
      const sc = this.fight.spec.score || [0, 0];
      T.score.setText(`J1  ${sc[0]} – ${sc[1]}  J2`).setPosition(640, b.roundsToWin > 1 ? 112 : 100);
    } else T.score.setText('');
    // combos
    this.combo(p, T.pCombo, T.pComboL, T.pComboD);
    const best = es.reduce((a, e) => (e.combo.hits > (a ? a.combo.hits : 0) ? e : a), null);
    this.combo(best, T.eCombo, T.eComboL, this.versus ? T.eComboD : null);
    // barras de técnicas
    for (const bar of this.bars) this.drawSlots(g, bar);
    // entrenamiento
    if (b.training) { this.trainingInfo(); this.tutorialTick(); }
    if (Save.d.settings.showFps) T.fps.setText(Math.round(this.game.loop.actualFps) + ' FPS'); else T.fps.setText('');
    if (this.ePortrait) {
      const one = es.length === 1;
      this.ePortrait.prev.g.setVisible(one); this.ePortrait.prev.glow.setVisible(one);
      if (one && this.ePortrait.f !== es[0]) this.ePortrait.f = es[0];
    }
    for (const pr of this.portraits) {
      if (pr.f.aura < pr.lastAura - 1) pr.hitT = 10;
      pr.lastAura = pr.f.aura;
      if (pr === this.ePortrait && es.length !== 1) continue;
      const shake = pr.hitT > 0 ? (Math.random() - 0.5) * pr.hitT : 0;
      pr.hitT = Math.max(0, pr.hitT - 1);
      g.fillStyle(0x000000, 0.85); g.fillCircle(pr.x + shake, pr.y, 46);
      g.fillStyle(pr.f.alive ? 0x150d28 : 0x2a0a14, 1); g.fillCircle(pr.x + shake, pr.y, 41);
      g.lineStyle(3, pr.hitT > 0 ? 0xff2d55 : pr.ring, 1); g.strokeCircle(pr.x + shake, pr.y, 44);
      // anillo de energía alrededor del retrato
      const e = pr.f.energy / 100;
      if (e > 0) { g.lineStyle(4, e >= 1 ? 0xffd166 : 0xff9e1c, e >= 1 ? 0.7 + Math.sin(this.t * 0.3) * 0.3 : 0.9); g.beginPath(); g.arc(pr.x + shake, pr.y, 49, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * e); g.strokePath(); }
      pr.prev.x = pr.x - (pr === this.ePortrait ? -6 : 6) + shake;
      pr.prev.profile = pr.f.profile; pr.prev.anim = pr.f.alive ? (pr.f.auraPct < 0.3 ? 'hurt' : 'guard') : 'hurtHead'; pr.prev.update();
    }
    // borde de peligro
    if (!this.versus && p.auraPct < 0.25 && p.alive) { g.lineStyle(14, 0xff0033, 0.12 + Math.sin(this.t * 0.15) * 0.08); g.strokeRect(0, 0, 1280, 720); }
    if (b.domain) { g.lineStyle(30, 0x8a2be2, 0.25); g.strokeRect(0, 0, 1280, 720); }
    this.drawAnnBand();
    this.drawSpeedLines();
  }

  ghostOf(f) {
    let gh = this.ghost.get(f.id);
    if (gh === undefined) gh = f.auraPct;
    if (gh < f.auraPct) gh = f.auraPct;
    else if (f.comboTaken === 0 || f.state === 'idle') gh += (f.auraPct - gh) * 0.06;
    this.ghost.set(f.id, gh);
    return gh;
  }

  combo(f, tH, tL, tD) {
    if (!f || f.combo.hits < 2 || f.combo.t <= 0) { tH.setText(''); tL.setText(''); if (tD) tD.setText(''); return; }
    const n = f.combo.hits;
    if (tH._n !== n) { tH._n = n; tH.setScale(1.5).setAngle(-6); this.tweens.add({ targets: tH, scale: 1, angle: -3, duration: 140, ease: 'Back.easeOut' }); }
    tH.setText(n + ' HITS');
    const lab = COMBO_LABELS.find(c => n >= c[0]);
    tL.setText(lab ? lab[1] : '').setColor(lab ? lab[2] : '#ffffff');
    if (lab) tH.setTint(0xffffff, 0xffffff, hex(lab[2]), hex(lab[2])); else tH.clearTint();
    if (tD) tD.setText(Math.round(f.combo.dmg) + ' de aura');
    const a = Math.min(1, f.combo.t / 20);
    tH.setAlpha(a); tL.setAlpha(a); if (tD) tD.setAlpha(a);
  }

  trainingInfo() {
    const b = this.b, p = this.p;
    const d = b.fighters.find(f => !f.isHuman);
    const m = p.move ? p.move.def : (this.lastMove || null);
    if (p.move) this.lastMove = p.move.def;
    const lines = [
      'ENTRENAMIENTO  (ESC = opciones)',
      `Muñeco: ${this.fight.spec.dummyMode.toUpperCase()}${this.fight.spec.dummyMode === 'cpu' ? ' Nv.' + (this.fight.spec.cpuLevel ?? 3) : ''}`,
      m ? `${m.name}: arranque ${m.startup}f · activo ${m.active}f · recup. ${m.recovery}f` : 'Usa un movimiento para ver sus datos',
      m && m.hit ? `Daño base ${m.hit.dmg || 0} · altura ${({ low: 'BAJO', high: 'ALTO', mid: 'MEDIO' })[m.hit.height] || 'MEDIO'}${m.hit.grab ? ' · AGARRE' : ''}` : '',
      `Combo máx.: ${p.stats.maxCombo} · Último combo: ${Math.round(p.combo.dmg)} aura`,
      d ? `Estado del muñeco: ${d.state}` : ''
    ];
    this.texts.train.setText(lines.filter(Boolean).join('\n'));
    this.g.fillStyle(0x000000, 0.6); this.g.fillRoundedRect(930, 126, 340, 130, 10);
    this.g.lineStyle(1, 0x3a2a66, 1); this.g.strokeRoundedRect(930, 126, 340, 130, 10);
  }
}

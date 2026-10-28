import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Audio } from '../core/Audio.js';
import { txt, FONT, StickPreview } from '../ui/UI.js';
import { hex } from '../view/StickRenderer.js';
import { STATUS } from '../sim/status.js';
import { MOVES } from '../sim/moves.js';
import { keyName, Input } from '../core/Input.js';

const COMBO_LABELS = [[16, 'AURA GOD', '#ff4d6d'], [12, '+1000 AURA', '#ffd166'], [8, 'SIGMA COMBO', '#c084fc'], [5, 'AURA FARMING', '#7df9ff'], [3, 'NICE', '#7bd389']];

export class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }
  init(data) { this.fight = data.fight; }
  create() {
    // la instancia de escena se reutiliza entre combates: reinicia el estado
    this.pills0 = []; this.pills1 = []; this.lastMove = null; this.tut = null; this.sl = null;
    const b = this.fight.battle;
    this.b = b;
    this.g = this.add.graphics();
    this.gTop = this.add.graphics().setDepth(50);
    this.p = b.player;
    this.enemies = () => b.fighters.filter(f => f.team !== this.p.team && !f.decoyOf);
    this.ghost = new Map();
    this.texts = {};
    const T = (k, x, y, s, c, o) => (this.texts[k] = txt(this, x, y, '', s, c, o));
    T('pName', 128, 8, 24, '#ffffff');
    T('pAura', 560, 44, 16, '#ffffff', { ox: 1, oy: 0.5 });
    T('eName', 1152, 8, 24, '#ffffff', { ox: 1 });
    T('eAura', 720, 44, 16, '#ffffff', { oy: 0.5 });
    T('timer', 640, 46, 54, '#ffffff', { ox: 0.5, oy: 0.5, strokeThickness: 6 });
    T('pUlt', 128, 92, 16, '#ffd166');
    T('eUlt', 1152, 92, 16, '#ffd166', { ox: 1 });
    T('pCombo', 60, 250, 64, '#ffffff', { strokeThickness: 8 });
    T('pComboL', 64, 322, 26, '#7df9ff');
    T('pComboD', 64, 352, 18, '#c9c3e6');
    T('eCombo', 1220, 250, 64, '#ffffff', { ox: 1, strokeThickness: 8 });
    T('eComboL', 1216, 322, 26, '#ff4d6d', { ox: 1 });
    T('ann', 640, 330, 110, '#ffffff', { ox: 0.5, oy: 0.5, strokeThickness: 12 });
    T('annSub', 640, 410, 32, '#ffd166', { ox: 0.5, oy: 0.5 });
    T('wave', 640, 108, 22, '#ffd166', { ox: 0.5 });
    T('fps', 1270, 704, 14, '#7df9ff', { ox: 1, oy: 1, body: true });
    T('train', 940, 130, 15, '#c9c3e6', { body: true, wrap: 320 });
    this.multiTexts = [];
    // retratos
    this.portraits = [];
    this.makePortrait(this.p, 70, 60, 1);
    const es = this.enemies();
    this.ePortrait = this.makePortrait(es[0], 1210, 60, -1);
    // barra de habilidades
    this.slotTexts = [];
    const lo = this.p.loadout;
    this.slots = [
      { k: 'C', id: lo.special }, { k: '→C', id: lo.specialF }, { k: '↓C', id: lo.specialD },
      { k: keyName(Input.codesFor('skill1')[0]), id: lo.skill1 }, { k: keyName(Input.codesFor('skill2')[0]), id: lo.skill2 }, { k: keyName(Input.codesFor('ult')[0]), id: lo.ult }
    ];
    this.slots[0].k = keyName(Input.codesFor('special')[0]);
    this.slots[1].k = '→' + this.slots[0].k; this.slots[2].k = '↓' + this.slots[0].k;
    this.slots.forEach((s, i) => {
      const x = 24 + i * 132;
      this.slotTexts.push({ name: txt(this, x + 62, 684, (MOVES[s.id] || {}).name || '-', 13, '#ffffff', { ox: 0.5, oy: 0.5, body: true, bold: true }), key: txt(this, x + 8, 662, s.k, 14, '#ffd166', { oy: 0.5 }), cost: txt(this, x + 118, 662, String((MOVES[s.id] || {}).cost || 0), 13, '#7df9ff', { ox: 1, oy: 0.5, body: true }) });
    });
    // overlays
    this.flashRect = this.add.rectangle(640, 360, 1280, 720, 0xffffff, 0).setDepth(60);
    this.lbTop = this.add.rectangle(640, -40, 1280, 80, 0x000000, 1).setDepth(55);
    this.lbBot = this.add.rectangle(640, 760, 1280, 80, 0x000000, 1).setDepth(55);
    this.annT = 0;
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
        { t: `Técnica especial: ${k('special')} (Six Seven)`, ok: () => this.tut.used.has(p.loadout.special) },
        { t: `Mantén ${k('block')} para bloquear (púlsalo justo antes del golpe para PARRY)`, ok: () => p.state === 'block' },
        { t: `Dash / esquiva: ${k('dash')} + dirección`, ok: () => p.state === 'dash' },
        { t: `¡ULTIMATE! Pulsa ${k('ult')} con la energía llena`, ok: () => this.tut.used.has(p.loadout.ult) }
      ]
    };
    this.tutBox = this.add.graphics().setDepth(40);
    this.tutText = txt(this, 640, 150, '', 26, '#ffffff', { ox: 0.5, oy: 0.5 }).setDepth(41);
    this.tutStep = txt(this, 640, 116, '', 16, '#7df9ff', { ox: 0.5, oy: 0.5, body: true }).setDepth(41);
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
      if (g.active) { g.fillStyle(0x000000, 0.6); g.fillRoundedRect(340, 96, 600, 80, 12); }
      return;
    }
    g.fillStyle(0x000000, 0.6); g.fillRoundedRect(340, 96, 600, 80, 12);
    g.lineStyle(2, 0x7df9ff, 0.8); g.strokeRoundedRect(340, 96, 600, 80, 12);
    g.fillStyle(0x7df9ff, 1); g.fillRect(350, 168, 580 * T.i / T.steps.length, 4);
    this.tutStep.setText(`TUTORIAL ${T.i + 1}/${T.steps.length}`);
    this.tutText.setText(T.steps[T.i].t);
  }

  makePortrait(f, x, y, facing) {
    const prev = new StickPreview(this, x - facing * 6, y + 300, f.profile, { scale: 2.1, facing, anim: 'guard', depth: 3, glow: 0.3 });
    const mg = this.make.graphics({ add: false }); mg.fillStyle(0xffffff); mg.fillCircle(x, y, 40);
    const mask = mg.createGeometryMask();
    prev.g.setMask(mask); prev.glow.setMask(mask);
    const pr = { f, prev, x, y };
    this.portraits.push(pr);
    return pr;
  }

  onBev(e) {
    if (e.type === 'move' && this.tut && e.f === this.p) this.tut.used.add(e.def.id);
    if (e.type === 'announce') {
      if (e.fight) { this.announce(e.text, '', '#7df9ff', 70); Audio.announce('¡Pelea!'); Audio.play('announce'); }
      else if (e.time) { this.announce(e.text, '', '#ffd166', 90); Audio.announce('¡Tiempo!'); }
      else { this.announce(e.text, e.sub ? (this.b.opts.mode === 'survival' ? 'SUPERVIVENCIA' : this.subtitle()) : '', '#ffffff', 80); if (e.text.startsWith('RONDA')) Audio.announce('Ronda ' + this.b.round); }
    }
    if (e.type === 'roundStart' && this.b.round > 1) this.announce('RONDA ' + this.b.round, '', '#ffffff', 80);
  }
  subtitle() {
    const es = this.enemies();
    return es.length > 1 ? `1 CONTRA ${es.length}` : (es[0] && es[0].boss ? 'COMBATE DE JEFE' : '');
  }

  announce(text, sub = '', color = '#ffffff', frames = 80) {
    const t = this.texts.ann;
    t.setText(text).setColor(color).setScale(2.4).setAlpha(0);
    this.texts.annSub.setText(sub).setAlpha(0);
    this.tweens.killTweensOf([t, this.texts.annSub]);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.texts.annSub, alpha: 1, delay: 150, duration: 200 });
    this.tweens.add({ targets: [t, this.texts.annSub], alpha: 0, delay: frames * 16, duration: 300 });
  }

  ko(e) {
    const perfect = this.b.player.aura >= this.b.player.maxAura * 0.999 && e.attacker === this.b.player;
    const time = !!(this.b.lastKO && this.b.lastKO.time);
    const ult = e.attacker && e.attacker.move && e.attacker.move.def.slot === 'ult';
    const hum = e.attacker && e.attacker.move && e.attacker.move.def.taunt;
    this.announce(time ? 'TIEMPO' : ult ? 'ULTIMATE K.O.' : 'K.O.', perfect ? 'PERFECT AURA' : hum ? 'HUMILLADO' : ult ? e.attacker.move.def.name.toUpperCase() : 'AURA DESTRUIDA', perfect ? '#ffd166' : ult ? '#c084fc' : '#ff4d6d', 120);
    if (!time) { Audio.announce(perfect ? 'K.O. Perfecto' : 'K.O.'); this.speedLines(70, 0xffffff); }
  }

  speedLines(frames, color = 0xffffff) {
    this.sl = { t: frames, max: frames, color };
  }
  drawSpeedLines() {
    const S = this.sl; if (!S) return;
    const g = this.gTop; g.clear();
    if (S.t <= 0) { this.sl = null; return; }
    S.t--;
    const k = S.t / S.max;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const r1 = 300 + Math.random() * 200, r2 = 900;
      g.lineStyle(1 + Math.random() * 4, S.color, 0.5 * k);
      g.lineBetween(640 + Math.cos(a) * r1, 360 + Math.sin(a) * r1 * 0.7, 640 + Math.cos(a) * r2, 360 + Math.sin(a) * r2 * 0.7);
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
    g.fillStyle(0x000000, 0.75); g.fillRect(-200, 250, 1680, 210);
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
    let tt = 0;
    const ev = this.time.addEvent({ delay: 16, repeat: 50, callback: () => { tt++; prev.x = (left ? 300 : 980) + c.x; prev.update(); } });
    void ev;
  }

  bar(g, x, y, w, h, pct, ghost, col, dir = 1, skew = 12) {
    const X = dir > 0 ? x : x - w;
    const poly = (xx, ww, c, a) => {
      if (ww <= 0) return;
      g.fillStyle(c, a);
      g.beginPath();
      if (dir > 0) { g.moveTo(xx + skew, y); g.lineTo(xx + ww + skew, y); g.lineTo(xx + ww, y + h); g.lineTo(xx, y + h); }
      else { g.moveTo(xx, y); g.lineTo(xx + ww, y); g.lineTo(xx + ww - skew, y + h); g.lineTo(xx - skew, y + h); }
      g.closePath(); g.fillPath();
    };
    poly(X - 4, w + 8, 0x000000, 0.75);
    poly(X, w, 0x1a1030, 1);
    const gw = w * Math.max(0, Math.min(1, ghost)), pw = w * Math.max(0, Math.min(1, pct));
    poly(dir > 0 ? X : X + w - gw, gw, 0xffffff, 0.85);
    poly(dir > 0 ? X : X + w - pw, pw, col, 1);
    poly(dir > 0 ? X : X + w - pw, pw, 0xffffff, 0.12);
    g.fillStyle(0xffffff, 0.25); g.fillRect(dir > 0 ? X + skew : X + w - pw, y + 2, Math.max(0, pw - skew), 3);
  }

  auraColor(f) {
    const p = f.auraPct;
    if (p > 0.6) return f.profile.aura === 'rainbow' ? 0x7df9ff : hex(f.profile.aura || '#7df9ff');
    if (p > 0.3) return 0xffd166;
    return Math.floor(this.t / 8) % 2 ? 0xff2d55 : 0xff6b6b;
  }

  energyBar(g, f, x, y, w, dir) {
    const X = dir > 0 ? x : x - w;
    g.fillStyle(0x000000, 0.75); g.fillRect(X - 2, y - 2, w + 4, 14);
    const e = f.energy / 100;
    const full = e >= 1;
    const col = full ? (Math.floor(this.t / 6) % 2 ? 0xffffff : 0xffd166) : 0xffb703;
    const ew = w * e;
    g.fillStyle(col, 1); g.fillRect(dir > 0 ? X : X + w - ew, y, ew, 10);
    g.fillStyle(0x000000, 0.8); for (let i = 1; i < 4; i++) g.fillRect(X + w * i / 4 - 1, y, 2, 10);
  }

  statusPills(g, f, x, y, dir) {
    let ox = 0;
    const key = dir > 0 ? 'pills0' : 'pills1';
    this[key] = this[key] || [];
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
      g.fillStyle(d.color, 0.85); g.fillRoundedRect(px, y, w, 18, 6);
      g.fillStyle(0x000000, 0.45); g.fillRect(px + 3, y + 14, (w - 6) * (1 - s.t / s.max), 2);
      t.setPosition(px + 7, y + 9);
      t.setColor(d.color === 0xffffff || d.color === 0xfff2a8 || d.color === 0xffe066 || d.color === 0xffd34d || d.color === 0xdddddd || d.color === 0xaee8ff ? '#111111' : '#ffffff');
      ox += w + 4; i++;
      if (i > 5) break;
    }
    for (; i < pool.length; i++) pool[i].setVisible(false);
  }

  update(time, delta) {
    this.t++;
    const g = this.g; g.clear();
    const b = this.b, p = this.p;
    const T = this.texts;
    // jugador
    const gp = this.ghostOf(p);
    this.bar(g, 128, 34, 440, 26, p.auraPct, gp, this.auraColor(p), 1);
    this.energyBar(g, p, 132, 70, 400, 1);
    T.pName.setText(p.name + (p.profile.title ? '  ·  ' + p.profile.title : ''));
    T.pAura.setText(Math.ceil(p.aura) + ' AURA');
    T.pUlt.setText(p.energy >= 100 ? `✦ ULTIMATE LISTA [${keyName(Input.codesFor('ult')[0])}]` : `ENERGÍA ${Math.floor(p.energy)}`);
    T.pUlt.setColor(p.energy >= 100 ? (Math.floor(this.t / 10) % 2 ? '#ffffff' : '#ffd166') : '#ffb703');
    this.statusPills(g, p, 130, 112, 1);
    // rivales
    const es = this.enemies();
    if (es.length === 1) {
      const e = es[0];
      this.bar(g, 1152, 34, 440, 26, e.auraPct, this.ghostOf(e), this.auraColor(e), -1);
      this.energyBar(g, e, 1148, 70, 400, -1);
      T.eName.setText((e.profile.title ? e.profile.title + '  ·  ' : '') + e.name);
      T.eAura.setText(Math.ceil(e.aura) + ' AURA');
      T.eUlt.setText(e.energy >= 100 ? '✦ ULTIMATE LISTA' : '');
      this.statusPills(g, e, 1150, 112, -1);
    } else {
      T.eName.setText(''); T.eAura.setText(''); T.eUlt.setText('');
      while (this.multiTexts.length < es.length) this.multiTexts.push(txt(this, 0, 0, '', 16, '#ffffff', { ox: 1 }));
      es.forEach((e, i) => {
        const y = 20 + i * 44;
        this.bar(g, 1240, y + 18, 300, 14, e.auraPct, this.ghostOf(e), e.alive ? this.auraColor(e) : 0x444444, -1, 8);
        g.fillStyle(0xffb703, 1); g.fillRect(1240 - 240 * e.energy / 100, y + 35, 240 * e.energy / 100, 3);
        this.multiTexts[i].setText(e.name + (e.alive ? '' : '  ✖')).setPosition(1240, y - 2).setColor(e.alive ? '#ffffff' : '#666666');
      });
      for (let i = es.length; i < this.multiTexts.length; i++) this.multiTexts[i].setText('');
    }
    // temporizador
    const tm = b.timerMax > 0 && !b.training;
    g.fillStyle(0x000000, 0.7); g.fillRoundedRect(590, 8, 100, 76, 12);
    g.lineStyle(2, b.timer <= 10 && tm ? 0xff4d6d : 0x3a2a66, 1); g.strokeRoundedRect(590, 8, 100, 76, 12);
    T.timer.setText(tm ? String(b.timer) : '∞').setColor(tm && b.timer <= 10 ? '#ff4d6d' : '#ffffff');
    if (b.roundsToWin > 1) for (let t = 0; t < 2; t++) for (let i = 0; i < b.roundsToWin; i++) {
      const x = t === 0 ? 620 - i * 18 : 660 + i * 18;
      g.fillStyle(b.wins[t] > i ? 0xffd166 : 0x333344, 1); g.fillCircle(x, 96, 6);
    }
    // combos
    this.combo(p, T.pCombo, T.pComboL, T.pComboD);
    const best = es.reduce((a, e) => (e.combo.hits > (a ? a.combo.hits : 0) ? e : a), null);
    this.combo(best, T.eCombo, T.eComboL, null);
    // barra de habilidades
    this.slots.forEach((s, i) => {
      const m = MOVES[s.id]; if (!m) return;
      const x = 24 + i * 132, y = 650;
      const cd = p.cool[s.id] || 0;
      const cost = p.costOf(m);
      const ok = cd <= 0 && (p.infiniteEnergy || p.energy >= cost) && !p.hasStatus('silenced') && (!m.cond || m.cond(p, b)) && !(m.once && p.usedOnce[m.id]);
      g.fillStyle(0x000000, 0.65); g.fillRoundedRect(x, y, 124, 50, 8);
      g.lineStyle(2, ok ? hex(m.color || '#7df9ff') : 0x333344, ok ? 1 : 0.8); g.strokeRoundedRect(x, y, 124, 50, 8);
      if (cd > 0 && m.cd) { g.fillStyle(0x7df9ff, 0.25); g.fillRect(x + 2, y + 2, 120 * (cd / m.cd), 46); }
      if (m.slot === 'ult' && ok) { g.fillStyle(0xffd166, 0.15 + Math.sin(this.t * 0.2) * 0.1); g.fillRoundedRect(x, y, 124, 50, 8); }
      this.slotTexts[i].name.setAlpha(ok ? 1 : 0.45);
    });
    // entrenamiento
    if (b.training) { this.trainingInfo(); this.tutorialTick(); }
    if (Save.d.settings.showFps) T.fps.setText(Math.round(this.game.loop.actualFps) + ' FPS'); else T.fps.setText('');
    if (this.ePortrait) {
      const one = es.length === 1;
      this.ePortrait.prev.g.setVisible(one); this.ePortrait.prev.glow.setVisible(one);
      if (one && this.ePortrait.f !== es[0]) this.ePortrait.f = es[0];
    }
    for (const pr of this.portraits) { pr.prev.profile = pr.f.profile; pr.prev.anim = pr.f.alive ? (pr.f.auraPct < 0.3 ? 'hurt' : 'guard') : 'ko'; pr.prev.update(); }
    // borde de peligro
    if (p.auraPct < 0.25 && p.alive) { g.lineStyle(14, 0xff0033, 0.12 + Math.sin(this.t * 0.15) * 0.08); g.strokeRect(0, 0, 1280, 720); }
    if (b.domain) { g.lineStyle(30, 0x8a2be2, 0.25); g.strokeRect(0, 0, 1280, 720); }
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
    if (tH._n !== n) { tH._n = n; tH.setScale(1.5); this.tweens.add({ targets: tH, scale: 1, duration: 120 }); }
    tH.setText(n + ' HITS');
    const lab = COMBO_LABELS.find(c => n >= c[0]);
    tL.setText(lab ? lab[1] : '').setColor(lab ? lab[2] : '#ffffff');
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
    this.g.fillStyle(0x000000, 0.55); this.g.fillRoundedRect(930, 122, 340, 130, 10);
  }
}
void FONT;

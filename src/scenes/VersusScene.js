import Phaser from 'phaser';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, StickPreview, MenuBG, go, fadeIn, keyHints } from '../ui/UI.js';
import { playerProfile, botProfile } from '../core/Match.js';
import { LEVELS, STYLES } from '../sim/AI.js';
import { Save } from '../core/Save.js';
import { TIPS } from '../data/tips.js';

// Pantalla de presentación previa al combate
export class VersusScene extends Phaser.Scene {
  constructor() { super('Versus'); }
  init(data) { this.spec = data.spec; }
  create() {
    this.done = false;
    if (this.scene.isActive('Demo')) this.scene.stop('Demo');
    const spec = this.spec;
    this.bg = new MenuBG(this);
    const g = this.add.graphics();
    g.fillStyle(0x0a1a3a, 0.85); g.beginPath(); g.moveTo(0, 0); g.lineTo(700, 0); g.lineTo(580, 720); g.lineTo(0, 720); g.closePath(); g.fillPath();
    g.fillStyle(0x3a0a1a, 0.85); g.beginPath(); g.moveTo(700, 0); g.lineTo(1280, 0); g.lineTo(1280, 720); g.lineTo(580, 720); g.closePath(); g.fillPath();
    g.lineStyle(6, 0xffffff, 1); g.lineBetween(700, 0, 580, 720);
    const vsMode = spec.mode === 'versus';
    const p = vsMode ? spec.p1.profile : playerProfile();
    this.prevs = [new StickPreview(this, 300, 560, p, { scale: 2.6, facing: 1, anim: 'guard' })];
    txt(this, 60, 600, p.name, 56, '#ffffff');
    txt(this, 64, 664, vsMode ? 'JUGADOR 1' : (p.title || Save.rank.name), 22, '#7df9ff');
    if (vsMode) {
      const q = spec.p2.profile;
      this.prevs.push(new StickPreview(this, 980, 560, q, { scale: 2.6, facing: -1, anim: 'guard' }));
      txt(this, 1220, 600, q.name, 56, '#ffffff', { ox: 1 });
      txt(this, 1216, 664, 'JUGADOR 2', 22, '#ff5fa2', { ox: 1 });
      const sc = spec.score || [0, 0];
      if (sc[0] + sc[1] > 0) txt(this, 640, 470, `MARCADOR  ${sc[0]} – ${sc[1]}`, 34, '#ffd166', { ox: 0.5, oy: 0.5 });
      txt(this, 640, 520, spec.rounds > 1 ? `AL MEJOR DE ${spec.rounds * 2 - 1} RONDAS` : 'A UNA RONDA', 20, '#c9c3e6', { ox: 0.5, oy: 0.5 });
    }
    const es = spec.mode === 'survival' || vsMode ? [] : spec.enemies;
    const n = es.length;
    es.forEach((bot, i) => {
      const x = n === 1 ? 980 : 860 + i * (330 / Math.max(1, n - 1));
      const sc = (n === 1 ? 2.6 : 1.9) * (bot.scale || 1) * (bot.boss ? 0.9 : 1);
      this.prevs.push(new StickPreview(this, x, 560 - (n > 1 ? (i % 2) * 30 : 0), botProfile(bot), { scale: sc, facing: -1, anim: 'guard', glow: bot.boss ? 1.6 : 0.9 }));
    });
    if (n === 1) {
      const b = es[0];
      txt(this, 1220, 560, b.name, 52, b.boss ? '#ff4d6d' : '#ffffff', { ox: 1 });
      txt(this, 1220, 618, `${LEVELS[spec.levelOverride ?? b.level].name.toUpperCase()} · ${STYLES[b.style].name.toUpperCase()}`, 22, LEVELS[spec.levelOverride ?? b.level].color, { ox: 1 });
      txt(this, 1220, 654, `"${b.quote}"`, 20, '#e8e4ff', { ox: 1, body: true });
    } else if (n > 1) {
      txt(this, 1220, 630, es.map(b => b.name).join('  ·  '), 26, '#ffffff', { ox: 1 });
      txt(this, 1220, 668, `1 CONTRA ${n}`, 24, '#ff4d6d', { ox: 1 });
    } else if (!vsMode) {
      txt(this, 1220, 560, 'SUPERVIVENCIA', 58, '#ffd166', { ox: 1 });
      txt(this, 1220, 624, 'Oleadas sin fin. Recuperas aura entre oleadas.', 22, '#e8e4ff', { ox: 1, body: true });
      txt(this, 1220, 656, `Récord: ${Save.d.stats.survivalBest} oleadas`, 22, '#7df9ff', { ox: 1 });
    }
    this.vs = txt(this, 640, 300, 'VS', 180, '#ffffff', { ox: 0.5, oy: 0.5, strokeThickness: 14 });
    this.vs.setShadow(0, 0, '#ff4d6d', 40, true, true).setScale(4).setAlpha(0);
    this.tweens.add({ targets: this.vs, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut', delay: 250 });
    if (!vsMode && (spec.boss || es.some(e => e.boss))) txt(this, 640, 90, '⚠ COMBATE DE JEFE ⚠', 40, '#ff4d6d', { ox: 0.5 });
    if (spec.pathTitle) txt(this, 640, 40, spec.pathTitle, 26, '#ffd166', { ox: 0.5 });
    Audio.play('riser');
    this.time.delayedCall(320, () => { Audio.play('vineBoom'); this.cameras.main.shake(200, 0.01); });
    this.time.delayedCall(2800, () => this.start());
    this.pop = Input.push((a, code) => { if (a === 'confirm') this.start(); if (a === 'back' && (!vsMode || code === 'Escape')) { this.done = true; go(this, vsMode ? 'LocalSetup' : 'Menu'); } });
    this.events.once('shutdown', () => this.pop && this.pop());
    keyHints(this, 'ENTER empezar · ESC cancelar');
    txt(this, 640, 40 + (spec.pathTitle ? 26 : 0) + (spec.boss || es.some(e => e.boss) ? 60 : 0), 'CONSEJO: ' + TIPS[Math.floor(Math.random() * TIPS.length)], 17, '#c9c3e6', { ox: 0.5, body: true, wrap: 1100, align: 'center' });
    fadeIn(this);
    this.t = 0;
  }
  start() { if (this.done) return; this.done = true; go(this, 'Fight', { spec: this.spec }); }
  update() {
    this.t++;
    Input.pollPad();
    this.bg.update();
    for (const p of this.prevs) p.update();
    this.vs.setAngle(Math.sin(this.t * 0.05) * 3);
  }
}

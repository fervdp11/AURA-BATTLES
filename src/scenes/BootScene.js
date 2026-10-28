import Phaser from 'phaser';
import { makeTextures } from '../view/Textures.js';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, go } from '../ui/UI.js';

// Arranque: texturas, guardado y presentación animada del logo sincronizada con el sonido de inicio.
// Si el navegador bloquea el audio, primero pide una pulsación y entonces arranca la presentación.
const HIT = 75; // fotograma del impacto (1,25 s a 60 fps, igual que el sting)

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    makeTextures(this);
    const d = this.d = Save.load();
    Input.init(d.settings);
    Audio.setVolumes(d.settings.music, d.settings.sfx);
    this._started = false; this._intro = false; this._done = false;
    this.t = 0; this.it = 0;
    this.g = this.add.graphics();
    this.ga = this.add.graphics().setBlendMode('ADD');
    this.embers = Array.from({ length: 70 }, () => this.ember(true));
    // logo
    this.aura = txt(this, 640, 300, 'AURA', 168, '#ffffff', { ox: 0.5, oy: 0.5, strokeThickness: 12, shadow: false }).setAlpha(0);
    this.aura.setShadow(0, 0, '#7df9ff', 36, true, true);
    this.legends = txt(this, 640, 418, 'L E G E N D S', 64, '#ffd166', { ox: 0.5, oy: 0.5, strokeThickness: 8 }).setAlpha(0);
    this.legends.setShadow(0, 0, '#ff9e3d', 24, true, true);
    this.sub = txt(this, 640, 488, 'BATALLAS DE STICKMANS · MEMES · AURA', 22, '#c9c3e6', { ox: 0.5, oy: 0.5, body: true, bold: true }).setAlpha(0);
    this.press = txt(this, 640, 600, 'PULSA CUALQUIER TECLA O HAZ CLIC', 26, '#7df9ff', { ox: 0.5, oy: 0.5 });
    this.hint = txt(this, 640, 690, 'El audio se activa con tu primera pulsación', 15, '#7a7498', { ox: 0.5, oy: 0.5, body: true });

    const start = () => {
      if (this._started) return;
      this._started = true;
      Audio.init();
      Audio.setVolumes(d.settings.music, d.settings.sfx);
      this.beginIntro();
    };
    const skip = () => { if (this._intro && this.it > 30) this.finish(); };
    this.pop = Input.push(a => { if (!this._started) start(); else if (a === 'confirm' || a === 'back') skip(); });
    this.input.on('pointerdown', () => { if (!this._started) start(); else skip(); });
    this.events.once('shutdown', () => { if (this.pop) this.pop(); this.input.removeAllListeners(); });
    // si el audio ya está permitido (p. ej. al recargar tras interactuar), arranca solo
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && navigator.userActivation && navigator.userActivation.hasBeenActive) start();
    } catch (e) { /* esperar pulsación */ }
  }

  ember(init) {
    return { x: Math.random() * 1280, y: init ? Math.random() * 720 : 740, v: 0.4 + Math.random() * 1.4, s: 1 + Math.random() * 2.5, w: Math.random() * 6.28, c: Math.random() < 0.7 ? 0x7df9ff : 0xffd166 };
  }

  beginIntro() {
    this._intro = true; this.it = 0;
    this.press.setAlpha(0); this.hint.setAlpha(0);
    Audio.play('intro');
  }

  finish() {
    if (this._done) return;
    this._done = true;
    Audio.music('menu');
    go(this, 'Menu');
  }

  update() {
    this.t++;
    Input.pollPad();
    const g = this.g, ga = this.ga;
    g.clear(); ga.clear();
    // fondo: degradado profundo con niebla
    g.fillGradientStyle(0x05030c, 0x05030c, 0x170a2e, 0x0d0620, 1);
    g.fillRect(0, 0, 1280, 720);
    const it = this.it;
    const pre = this._intro ? Math.min(1, it / HIT) : 0;
    const post = this._intro ? Math.max(0, it - HIT) : 0;
    // brasas que ascienden (en la presentación convergen hacia el logo)
    for (const e of this.embers) {
      if (this._intro && it < HIT) { e.x += (640 - e.x) * 0.02 * pre; e.y += (330 - e.y) * 0.02 * pre; }
      else { e.y -= e.v * (post > 0 && post < 20 ? 6 : 1); e.x += Math.sin(this.t * 0.02 + e.w) * 0.4; }
      if (e.y < -10) Object.assign(e, this.ember(false));
      ga.fillStyle(e.c, 0.35); ga.fillCircle(e.x, e.y, e.s);
    }
    if (!this._intro) {
      this.press.setAlpha(0.5 + Math.sin(this.t * 0.08) * 0.45);
      // logo tenue de fondo mientras espera
      const k = 0.5 + Math.sin(this.t * 0.04) * 0.1;
      ga.fillStyle(0x7b2cbf, 0.08 * k); ga.fillCircle(640, 330, 260);
      return;
    }
    this.it++;
    // fase 1: aura cargando en el centro
    if (it < HIT) {
      const r = 20 + pre * 140;
      for (let i = 0; i < 4; i++) { ga.fillStyle(0x7df9ff, 0.05 + pre * 0.06); ga.fillCircle(640, 330, r * (1 - i * 0.2)); }
      ga.lineStyle(3, 0xffffff, pre * 0.8);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + it * 0.05, rr = 360 * (1 - pre) + 40;
        ga.lineBetween(640 + Math.cos(a) * rr, 330 + Math.sin(a) * rr, 640 + Math.cos(a) * (rr + 60 * (1 - pre)), 330 + Math.sin(a) * (rr + 60 * (1 - pre)));
      }
      this.cameras.main.shake(16, 0.002 * pre);
    }
    // fase 2: impacto
    if (it === HIT) { this.cameras.main.flash(260, 255, 255, 255); this.cameras.main.shake(380, 0.012); }
    if (it >= HIT) {
      const k = Math.min(1, post / 10);
      const sc = post < 10 ? 2.2 - Phaser.Math.Easing.Back.Out(k) * 1.2 : 1 + Math.sin(this.t * 0.05) * 0.012;
      this.aura.setAlpha(k).setScale(sc);
      const lk = Phaser.Math.Clamp((post - 8) / 16, 0, 1);
      this.legends.setAlpha(lk).setX(640 + (1 - Phaser.Math.Easing.Cubic.Out(lk)) * 300);
      this.sub.setAlpha(Phaser.Math.Clamp((post - 26) / 20, 0, 1));
      // onda de choque y llamas de aura detrás del logo
      if (post < 50) { const p = post / 50; ga.lineStyle(10 * (1 - p), 0x7df9ff, 1 - p); ga.strokeCircle(640, 330, 60 + p * 700); ga.lineStyle(4 * (1 - p), 0xffd166, 1 - p); ga.strokeCircle(640, 330, 40 + p * 520); }
      // llamas de aura suaves detrás del logo (lenguas de partículas aditivas)
      const boost = post < 30 ? (30 - post) / 30 : 0;
      for (let i = 0; i < 22; i++) {
        const bx = 420 + i * 21, ph = (this.t * 0.035 + i * 0.37) % 1;
        for (let k2 = 0; k2 < 6; k2++) {
          const q = (ph + k2 / 6) % 1, y = 400 - q * (150 + 60 * Math.sin(i * 2.1) + boost * 120);
          const x = bx + Math.sin(q * 6 + i + this.t * 0.05) * 10 * q;
          ga.fillStyle(q < 0.5 ? 0x4cc9f0 : 0x7df9ff, 0.07 * (1 - q)); ga.fillCircle(x, y, 22 * (1 - q * 0.7));
        }
      }
      for (let k2 = 0; k2 < 7; k2++) { ga.fillStyle(0x7df9ff, 0.012 + boost * 0.02); ga.fillEllipse(640, 335, 300 + k2 * 80, 120 + k2 * 34); }
      if (post > 70) { this.press.setText('PULSA ENTER'); this.press.setAlpha(0.5 + Math.sin(this.t * 0.08) * 0.45); }
      if (post > 200) this.finish();
    }
  }
}

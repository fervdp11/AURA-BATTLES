import Phaser from 'phaser';
import { makeTextures } from '../view/Textures.js';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, MenuBG, go } from '../ui/UI.js';

// Arranque: texturas, guardado, entrada y pantalla de inicio (desbloquea el audio con la primera pulsación)
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    makeTextures(this);
    const d = Save.load();
    Input.init(d.settings.bindings);
    Audio.setVolumes(d.settings.music, d.settings.sfx);
    Audio.voiceOn = d.settings.voice;
    Audio.announcerOn = d.settings.announcer;
    this.bg = new MenuBG(this);
    const title = txt(this, 640, 280, 'AURA LEGENDS', 112, '#ffffff', { ox: 0.5, oy: 0.5, strokeThickness: 10 });
    title.setShadow(0, 0, '#7df9ff', 30, true, true);
    this.title = title;
    txt(this, 640, 370, 'BATALLAS DE STICKMANS · MEMES · AURA', 26, '#ffd166', { ox: 0.5, oy: 0.5 });
    this.press = txt(this, 640, 520, 'PULSA ENTER O HAZ CLIC PARA EMPEZAR', 30, '#7df9ff', { ox: 0.5, oy: 0.5 });
    txt(this, 640, 690, 'Recomendado: teclado · Flechas para moverte · Z X C A S D · Shift · Espacio', 16, '#9a94b8', { ox: 0.5, oy: 0.5, body: true });
    const start = () => {
      if (this._started) return;
      this._started = true;
      Audio.init();
      Audio.setVolumes(d.settings.music, d.settings.sfx);
      Audio.play('ui_open');
      Audio.music('menu');
      this.time.delayedCall(150, () => go(this, 'Menu'));
    };
    this.pop = Input.push(a => { if (a === 'confirm') start(); });
    this.input.once('pointerdown', start);
    this.events.once('shutdown', () => this.pop && this.pop());
    this.t = 0;
  }
  update() {
    this.t++;
    this.bg.update();
    Input.pollPad();
    this.press.setAlpha(0.55 + Math.sin(this.t * 0.08) * 0.45);
    this.title.setScale(1 + Math.sin(this.t * 0.03) * 0.015);
  }
}

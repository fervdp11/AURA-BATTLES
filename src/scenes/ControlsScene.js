import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input, ACTIONS, ACTION_LABELS, PROFILE_NAMES, keyName } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, MenuList, go, fadeIn, keyHints, toast, MenuBG } from '../ui/UI.js';

// Controles personalizables por perfil (1 jugador · J1 · J2) con mapa de teclado y detección de conflictos.
const PROFS = ['solo', 'p1', 'p2'];
const PCOL = { solo: 0xffd166, p1: 0x7df9ff, p2: 0xff5fa2 };
const PCSS = { solo: '#ffd166', p1: '#7df9ff', p2: '#ff5fa2' };
// distribución de teclado (códigos físicos) para el mapa visual
const KB = [
  [['Escape', 1.2], ['Digit1', 1], ['Digit2', 1], ['Digit3', 1], ['Digit4', 1], ['Digit5', 1], ['Digit6', 1], ['Digit7', 1], ['Digit8', 1], ['Digit9', 1], ['Digit0', 1], ['Minus', 1], ['Backspace', 1.6]],
  [['Tab', 1.4], ['KeyQ', 1], ['KeyW', 1], ['KeyE', 1], ['KeyR', 1], ['KeyT', 1], ['KeyY', 1], ['KeyU', 1], ['KeyI', 1], ['KeyO', 1], ['KeyP', 1], ['BracketLeft', 1], ['Enter', 1.4]],
  [['CapsLock', 1.7], ['KeyA', 1], ['KeyS', 1], ['KeyD', 1], ['KeyF', 1], ['KeyG', 1], ['KeyH', 1], ['KeyJ', 1], ['KeyK', 1], ['KeyL', 1], ['Semicolon', 1], ['Quote', 1], ['Backslash', 1.1]],
  [['ShiftLeft', 1.3], ['IntlBackslash', 1], ['KeyZ', 1], ['KeyX', 1], ['KeyC', 1], ['KeyV', 1], ['KeyB', 1], ['KeyN', 1], ['KeyM', 1], ['Comma', 1], ['Period', 1], ['Slash', 1], ['ShiftRight', 1.9]],
  [['ControlLeft', 1.4], ['AltLeft', 1.2], ['Space', 6.2], ['AltRight', 1.2], ['ArrowLeft', 1], ['ArrowDown', 1], ['ArrowRight', 1]]
];
const SHORT = { left: '◀', right: '▶', up: 'SALTO', down: 'AGACH', light: 'RÁPIDO', heavy: 'FUERTE', special: 'ESPEC', skill1: 'HAB 1', skill2: 'HAB 2', ult: 'ULTI', dash: 'DASH', block: 'BLOQ', pause: 'PAUSA' };

export class ControlsScene extends Phaser.Scene {
  constructor() { super('Controls'); }
  init(data) { this.prof = (data && data.prof) || 'solo'; this.back = (data && data.back) || { scene: 'Settings' }; }
  create() {
    this.bg = new MenuBG(this, { hue: 200 });
    this.add.rectangle(640, 360, 1280, 720, 0x05030c, 0.55);
    txt(this, 50, 22, 'CONTROLES', 56, '#ffffff');
    this.tabG = this.add.graphics();
    this.tabT = PROFS.map((p, i) => txt(this, 70 + i * 200 + 90, 112, PROFILE_NAMES[p], 22, '#ffffff', { ox: 0.5, oy: 0.5 }));
    this.tabZones = PROFS.map((p, i) => this.add.zone(70 + i * 200, 92, 180, 40).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setProf(p)));
    this.kb = this.add.graphics();
    this.kbTexts = [];
    this.help = txt(this, 660, 470, '', 17, '#e8e4ff', { body: true, wrap: 580 });
    txt(this, 660, 610, 'Consejo: algunos teclados no registran muchas teclas a la vez (ghosting). Si una combinación de J1 y J2 falla, mueve esas acciones a otras teclas. Cada jugador puede usar también un mando.', 14, '#8f88b0', { body: true, wrap: 580 });
    this.capturing = null;
    this.buildMenu();
    keyHints(this, '↑↓ elegir · ENTER reasignar · TAB / Q E cambiar perfil · ESC volver');
    fadeIn(this);
  }
  setProf(p) {
    if (p === this.prof || this.capturing) return;
    this.prof = p; Audio.play('ui_move', { pitch: 1.2 });
    this.buildMenu();
  }
  buildMenu() {
    const prof = this.prof;
    const items = ACTIONS.map(a => ({
      label: ACTION_LABELS[a], action: a,
      value: () => Input.codesFor(a, prof).map(keyName).join(' / ') || '¡SIN TECLA!',
      help: `ENTER y pulsa la nueva tecla para "${ACTION_LABELS[a]}". Si ya estaba en uso, las teclas se intercambian para que nunca haya conflictos.`,
      onSelect: () => this.capture(a)
    }));
    items.push({ label: 'RESTABLECER ' + PROFILE_NAMES[prof], color: '#ffd166', help: 'Vuelve a las teclas por defecto de este perfil.', onSelect: () => { Input.resetProfile(prof); this.persist(); toast(this, 'Controles restablecidos: ' + PROFILE_NAMES[prof], PCSS[prof]); } });
    items.push({ label: 'RESTABLECER TODO', color: '#ff4d6d', help: 'Restablece los tres perfiles.', onSelect: () => { for (const p of PROFS) Input.resetProfile(p); this.persist(); toast(this, 'Todos los controles restablecidos', '#ff4d6d'); } });
    items.push({ label: 'VOLVER', onSelect: () => this.leave() });
    const keep = this.menu ? this.menu.idx : 0;
    if (this.menu) this.menu.destroy();
    this.menu = new MenuList(this, 50, 150, items, { w: 560, h: 34, gap: 4, size: 19, visible: 14, accent: PCOL[prof], onBack: () => this.leave(), onChange: it => this.help.setText(it.help || ''),
      onKey: (a, code) => { if (this.capturing) return; if (a === 'tab' || code === 'KeyQ' || code === 'KeyE') { const d = code === 'KeyQ' ? -1 : 1; this.setProf(PROFS[(PROFS.indexOf(this.prof) + d + 3) % 3]); } } });
    this.menu.idx = Math.min(keep, items.length - 1);
    this.help.setText(items[this.menu.idx].help || '');
  }
  capture(a) {
    const prof = this.prof;
    this.capturing = a;
    this.menu.active = false;
    this.help.setText(`Pulsa la tecla para "${ACTION_LABELS[a]}" (${PROFILE_NAMES[prof]})…   ESC cancela.`).setColor(PCSS[prof]);
    Input.captureNext(code => {
      this.capturing = null;
      if (code !== 'Escape' || a === 'pause') {
        const cs = Input.assign(prof, a, code);
        this.persist();
        Audio.play('ui_select');
        if (cs.length) {
          const c = cs[0];
          toast(this, `Conflicto resuelto: ${keyName(code)} estaba en ${PROFILE_NAMES[c.prof]} · ${ACTION_LABELS[c.action]} → intercambiadas`, '#ffb703');
        }
        const lost = Input.unbound(prof).concat(prof !== 'solo' ? Input.unbound(prof === 'p1' ? 'p2' : 'p1') : []);
        if (lost.length) toast(this, 'Atención: hay acciones sin tecla. Asígnalas.', '#ff4d6d', 400);
      } else Audio.play('ui_back');
      this.time.delayedCall(60, () => { this.menu.active = true; this.help.setColor('#e8e4ff').setText('Tecla asignada.'); });
    });
  }
  persist() { Input.store(Save.d.settings); Save.save(); }
  leave() { if (this.capturing) return; go(this, this.back.scene, this.back.data); }

  drawKeyboard() {
    const g = this.kb; g.clear();
    const prof = this.prof;
    const owner = {};
    const mark = (p, col) => { for (const a of ACTIONS) for (const c of Input.codesFor(a, p)) (owner[c] = owner[c] || []).push({ p, a, col }); };
    if (prof === 'solo') mark('solo', PCOL.solo); else { mark('p1', PCOL.p1); mark('p2', PCOL.p2); }
    const U = 44, x0 = 660, y0 = 150;
    let ti = 0;
    const T = (x, y, s, c, sz) => { let t = this.kbTexts[ti]; if (!t) { t = txt(this, 0, 0, '', sz, '#fff', { ox: 0.5, oy: 0.5, body: true, bold: true }); this.kbTexts.push(t); } t.setFontSize(sz).setText(s).setColor(c).setPosition(x, y).setVisible(true); ti++; };
    KB.forEach((row, r) => {
      let x = x0;
      for (const [code, w] of row) {
        const ow = owner[code];
        const kw = U * w - 4, y = y0 + r * (U + 2);
        const sel = this.menu && this.menu.items[this.menu.idx] && this.menu.items[this.menu.idx].action && ow && ow.some(o => o.p === prof && o.a === this.menu.items[this.menu.idx].action);
        const conflict = ow && ow.length > 1 && !(ow.every(o => o.a === 'pause'));
        g.fillStyle(ow ? (conflict ? 0xff2d55 : ow[0].col) : 0x1a1430, ow ? (sel ? 0.95 : 0.35) : 0.9);
        g.fillRoundedRect(x, y, kw, U - 4, 6);
        g.lineStyle(sel ? 3 : 1, sel ? 0xffffff : 0x3a2a66, 1); g.strokeRoundedRect(x, y, kw, U - 4, 6);
        T(x + kw / 2, y + 12, keyName(code).replace('SHIFT ', 'SH ').slice(0, 7), ow ? '#ffffff' : '#6f6890', 11);
        if (ow) T(x + kw / 2, y + 28, SHORT[ow[0].a] + (ow.length > 1 && !conflict ? '' : ''), sel ? '#000000' : '#ffffff', 10);
        x += U * w;
      }
    });
    for (; ti < this.kbTexts.length; ti++) this.kbTexts[ti].setVisible(false);
    // leyenda
    if (prof !== 'solo') { g.fillStyle(PCOL.p1, 0.8); g.fillRect(660, 392, 14, 14); g.fillStyle(PCOL.p2, 0.8); g.fillRect(800, 392, 14, 14); g.fillStyle(0xff2d55, 0.8); g.fillRect(940, 392, 14, 14); }
    if (!this.legend) {
      this.legend = [txt(this, 680, 391, 'JUGADOR 1', 14, '#7df9ff', { body: true, bold: true }), txt(this, 820, 391, 'JUGADOR 2', 14, '#ff5fa2', { body: true, bold: true }), txt(this, 960, 391, 'CONFLICTO', 14, '#ff2d55', { body: true, bold: true }), txt(this, 680, 391, 'TECLAS DEL MODO 1 JUGADOR', 14, '#ffd166', { body: true, bold: true })];
    }
    this.legend.forEach((t, i) => t.setVisible(prof === 'solo' ? i === 3 : i < 3));
  }
  update() {
    Input.pollPad();
    this.bg.update();
    this.menu.update();
    const g = this.tabG; g.clear();
    PROFS.forEach((p, i) => {
      const sel = p === this.prof, x = 70 + i * 200;
      g.fillStyle(sel ? PCOL[p] : 0x120c22, sel ? 0.9 : 0.85); g.fillRoundedRect(x, 92, 180, 40, 10);
      g.lineStyle(2, PCOL[p], 1); g.strokeRoundedRect(x, 92, 180, 40, 10);
      this.tabT[i].setColor(sel ? '#0a0614' : PCSS[p]);
    });
    this.drawKeyboard();
  }
}

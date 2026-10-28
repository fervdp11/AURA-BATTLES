// Gestor de entrada global: teclado (rebindeable) + mando, navegación de menús por pila de foco.
import { emptyInput } from '../sim/constants.js';

export const DEFAULT_BINDINGS = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  light: ['KeyZ'], heavy: ['KeyX'], special: ['KeyC'], skill1: ['KeyA'], skill2: ['KeyS'], ult: ['KeyD'],
  dash: ['ShiftLeft', 'ShiftRight'], block: ['Space'], pause: ['Escape', 'KeyP']
};

export const ACTION_LABELS = {
  left: 'Izquierda', right: 'Derecha', up: 'Saltar', down: 'Agacharse', light: 'Ataque rápido', heavy: 'Ataque fuerte',
  special: 'Especial', skill1: 'Habilidad 1', skill2: 'Habilidad 2', ult: 'Ultimate', dash: 'Dash / Esquiva', block: 'Bloqueo / Parry', pause: 'Pausa'
};

export function keyName(code) {
  if (!code) return '—';
  const map = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'ESPACIO', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT D', Escape: 'ESC', Enter: 'ENTER', ControlLeft: 'CTRL', ControlRight: 'CTRL D', AltLeft: 'ALT', Backspace: 'RETROCESO', Tab: 'TAB' };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code;
}

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab']);

class InputManager {
  constructor() {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    this.down = new Set();
    this.pressed = new Set();
    this.stack = [];
    this.capture = null;
    this.started = false;
    this.pad = { prev: {}, cur: {} };
    this.lastUiRepeat = 0;
    this.padPressed = new Set();
  }

  init(bindings) {
    if (bindings) this.setBindings(bindings);
    if (this.started) return;
    this.started = true;
    window.addEventListener('keydown', e => this.onDown(e), { capture: true });
    window.addEventListener('keyup', e => this.onUp(e), { capture: true });
    window.addEventListener('blur', () => { this.down.clear(); });
  }

  setBindings(b) {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    for (const k in b) if (Array.isArray(b[k]) && b[k].length) this.bindings[k] = b[k];
  }

  codesFor(action) { return this.bindings[action] || []; }
  actionsForCode(code) {
    const out = [];
    for (const a in this.bindings) if (this.bindings[a].includes(code)) out.push(a);
    return out;
  }

  onDown(e) {
    const code = e.code;
    if (GAME_KEYS.has(code) || this.actionsForCode(code).length) e.preventDefault();
    if (this.capture) { e.preventDefault(); const cb = this.capture; this.capture = null; cb(code); return; }
    if (!e.repeat) { this.down.add(code); this.pressed.add(code); }
    const ui = this.uiAction(code);
    if (ui && (!e.repeat || ['up', 'down', 'left', 'right'].includes(ui))) this.dispatch(ui, code, e.repeat);
    else if (!e.repeat) this.dispatch(null, code, false);
  }
  onUp(e) { this.down.delete(e.code); }

  uiAction(code) {
    if (code === 'ArrowUp' || this.codesFor('up').includes(code)) return 'up';
    if (code === 'ArrowDown' || this.codesFor('down').includes(code)) return 'down';
    if (code === 'ArrowLeft' || this.codesFor('left').includes(code)) return 'left';
    if (code === 'ArrowRight' || this.codesFor('right').includes(code)) return 'right';
    if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || this.codesFor('light').includes(code)) return 'confirm';
    if (code === 'Escape' || code === 'Backspace' || this.codesFor('heavy').includes(code)) return 'back';
    if (code === 'Tab') return 'tab';
    return null;
  }

  // pila de manejadores de UI: solo el de arriba recibe eventos
  push(handler) {
    const entry = { handler };
    this.stack.push(entry);
    return () => { const i = this.stack.indexOf(entry); if (i >= 0) this.stack.splice(i, 1); };
  }
  dispatch(action, code, repeat) {
    const top = this.stack[this.stack.length - 1];
    if (top) top.handler(action, code, repeat);
  }

  captureNext(cb) { this.capture = cb; }

  isDown(action) {
    for (const c of this.codesFor(action)) if (this.down.has(c)) return true;
    return false;
  }

  // mando: se consulta en cada paso
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(x => x && x.connected);
    const cur = {};
    if (p) {
      const btn = i => p.buttons[i] && p.buttons[i].pressed;
      const ax = p.axes || [];
      cur.left = btn(14) || ax[0] < -0.5; cur.right = btn(15) || ax[0] > 0.5;
      cur.up = btn(12) || ax[1] < -0.6; cur.down = btn(13) || ax[1] > 0.6;
      cur.light = btn(2); cur.heavy = btn(3); cur.special = btn(1); cur.skill1 = btn(4); cur.skill2 = btn(5); cur.ult = btn(7);
      cur.dash = btn(6) || btn(10); cur.block = btn(0); cur.pause = btn(9);
    }
    this.pad.prev = this.pad.cur; this.pad.cur = cur;
    // navegación de menús con mando
    const edge = a => cur[a] && !this.pad.prev[a];
    for (const a in cur) if (edge(a)) this.padPressed.add(a);
    if (edge('up')) this.dispatch('up'); if (edge('down')) this.dispatch('down');
    if (edge('left')) this.dispatch('left'); if (edge('right')) this.dispatch('right');
    if (edge('block')) this.dispatch('confirm'); if (edge('special')) this.dispatch('back');
    if (edge('pause')) this.dispatch(null, 'Escape');
  }

  // Estado de juego para el luchador humano; consume las pulsaciones
  readGame() {
    const inp = emptyInput();
    const pad = this.pad.cur;
    const held = a => this.isDown(a) || !!pad[a];
    const was = a => { for (const c of this.codesFor(a)) if (this.pressed.has(c)) return true; return this.padPressed.has(a); };
    inp.l = held('left'); inp.r = held('right'); inp.u = held('up'); inp.d = held('down');
    inp.pu = was('up'); inp.pd = was('down');
    for (const a of ['light', 'heavy', 'special', 'skill1', 'skill2', 'ult', 'dash', 'block']) {
      inp.held[a] = held(a); inp.pressed[a] = was(a);
    }
    this.pressed.clear();
    this.padPressed.clear();
    return inp;
  }
  clearPressed() { this.pressed.clear(); this.padPressed.clear(); }
}

export const Input = new InputManager();

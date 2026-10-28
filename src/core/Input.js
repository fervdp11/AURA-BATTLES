// Gestor de entrada global: teclado rebindeable por perfil (1 jugador, J1 y J2 en local), dos mandos
// y navegación de menús por pila de foco.
import { emptyInput } from '../sim/constants.js';

export const ACTIONS = ['left', 'right', 'up', 'down', 'light', 'heavy', 'special', 'skill1', 'skill2', 'ult', 'dash', 'block', 'pause'];

export const DEFAULT_PROFILES = {
  // un jugador contra bots
  solo: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    light: ['KeyZ'], heavy: ['KeyX'], special: ['KeyC'], skill1: ['KeyA'], skill2: ['KeyS'], ult: ['KeyD'],
    dash: ['ShiftLeft', 'ShiftRight'], block: ['Space'], pause: ['Escape', 'KeyP']
  },
  // multijugador local: J1 a la izquierda del teclado
  p1: {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    light: ['KeyF'], heavy: ['KeyG'], special: ['KeyH'], skill1: ['KeyR'], skill2: ['KeyT'], ult: ['KeyV'],
    dash: ['ShiftLeft'], block: ['Space'], pause: ['Escape']
  },
  // J2 a la derecha (flechas + J K L I O P, Enter; también teclado numérico)
  p2: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    light: ['KeyJ', 'Numpad1'], heavy: ['KeyK', 'Numpad2'], special: ['KeyL', 'Numpad3'], skill1: ['KeyI', 'Numpad4'], skill2: ['KeyO', 'Numpad5'], ult: ['KeyP', 'Numpad6'],
    dash: ['ShiftRight', 'Numpad0'], block: ['Enter', 'NumpadEnter'], pause: ['Escape']
  }
};
export const DEFAULT_BINDINGS = DEFAULT_PROFILES.solo;
export const PROFILE_NAMES = { solo: '1 JUGADOR', p1: 'JUGADOR 1', p2: 'JUGADOR 2' };
const SAVE_KEYS = { solo: 'bindings', p1: 'bindingsP1', p2: 'bindingsP2' };

export const ACTION_LABELS = {
  left: 'Izquierda', right: 'Derecha', up: 'Saltar', down: 'Agacharse', light: 'Ataque rápido', heavy: 'Ataque fuerte',
  special: 'Especial', skill1: 'Habilidad 1', skill2: 'Habilidad 2', ult: 'Ultimate', dash: 'Dash / Esquiva', block: 'Bloqueo / Parry', pause: 'Pausa'
};

export function keyName(code) {
  if (!code) return '—';
  const map = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'ESPACIO', ShiftLeft: 'SHIFT IZQ', ShiftRight: 'SHIFT DER', Escape: 'ESC', Enter: 'ENTER', NumpadEnter: 'INTRO NUM', ControlLeft: 'CTRL IZQ', ControlRight: 'CTRL DER', AltLeft: 'ALT', AltRight: 'ALT GR', Backspace: 'RETROCESO', Tab: 'TAB', Comma: ',', Period: '.', Slash: '-', Semicolon: 'Ñ', Quote: '´', BracketLeft: '`', BracketRight: '+', Backslash: 'Ç', IntlBackslash: '<', Minus: "'", Equal: '¡' };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code;
}

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab']);
const clone = o => JSON.parse(JSON.stringify(o));
const PAD_SLOT = { solo: 0, p1: 0, p2: 1 };

class InputManager {
  constructor() {
    this.profiles = clone(DEFAULT_PROFILES);
    this.down = new Set();
    this.pressed = new Set();
    this.stack = [];
    this.capture = null;
    this.started = false;
    this.pads = [{ prev: {}, cur: {} }, { prev: {}, cur: {} }];
    this.padPressed = [new Set(), new Set()];
    this.lastUiRepeat = 0;
  }
  // compatibilidad: el perfil de un jugador
  get bindings() { return this.profiles.solo; }
  get pad() { return this.pads[0]; }

  init(settings) {
    if (settings) for (const p in SAVE_KEYS) if (settings[SAVE_KEYS[p]]) this.setBindings(settings[SAVE_KEYS[p]], p);
    if (this.started) return;
    this.started = true;
    window.addEventListener('keydown', e => this.onDown(e), { capture: true });
    window.addEventListener('keyup', e => this.onUp(e), { capture: true });
    window.addEventListener('blur', () => { this.down.clear(); });
  }

  setBindings(b, prof = 'solo') {
    const out = clone(DEFAULT_PROFILES[prof]);
    if (b) for (const k in b) if (Array.isArray(b[k]) && b[k].length && out[k]) out[k] = b[k];
    this.profiles[prof] = out;
  }
  resetProfile(prof) { this.profiles[prof] = clone(DEFAULT_PROFILES[prof]); }
  // guarda los tres perfiles en los ajustes
  store(settings) { for (const p in SAVE_KEYS) settings[SAVE_KEYS[p]] = clone(this.profiles[p]); }

  codesFor(action, prof = 'solo') { return (this.profiles[prof] && this.profiles[prof][action]) || []; }
  actionsForCode(code, prof = 'solo') {
    const out = [];
    const b = this.profiles[prof];
    for (const a in b) if (b[a].includes(code)) out.push(a);
    return out;
  }
  anyProfileUses(code) { for (const p in this.profiles) if (this.actionsForCode(code, p).length) return true; return false; }

  // Conflictos de una tecla: otras acciones del mismo perfil y, en multijugador, del otro jugador
  conflicts(prof, action, code) {
    const out = [];
    const scan = [prof];
    if (prof === 'p1') scan.push('p2'); else if (prof === 'p2') scan.push('p1');
    for (const p of scan) for (const a of this.actionsForCode(code, p)) if (!(p === prof && a === action)) {
      // la pausa (ESC) es compartida a propósito entre J1 y J2
      if (a === 'pause' && action === 'pause' && p !== prof) continue;
      out.push({ prof: p, action: a });
    }
    return out;
  }
  // Asigna una tecla. Si estaba ocupada, intercambia: la otra acción recibe la tecla anterior.
  assign(prof, action, code) {
    const old = this.codesFor(action, prof)[0] || null;
    const cs = this.conflicts(prof, action, code);
    for (const c of cs) {
      const list = this.profiles[c.prof][c.action].filter(x => x !== code);
      if (!list.length && old && !(c.prof !== prof && this.conflicts(c.prof, c.action, old).length)) list.push(old);
      this.profiles[c.prof][c.action] = list;
    }
    // la tecla elegida pasa a ser la principal; se conservan las alternativas que no choquen
    const rest = this.codesFor(action, prof).filter(x => x !== code && x !== old);
    this.profiles[prof][action] = [code, ...rest];
    return cs;
  }
  // acciones sin ninguna tecla (tras un conflicto irresoluble)
  unbound(prof) { return ACTIONS.filter(a => !this.codesFor(a, prof).length); }

  onDown(e) {
    const code = e.code;
    if (GAME_KEYS.has(code) || this.anyProfileUses(code)) e.preventDefault();
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
  // acción de menú para un jugador concreto (pantalla de selección multijugador)
  uiActionFor(code, prof) {
    const has = a => this.codesFor(a, prof).includes(code);
    if (has('up')) return 'up';
    if (has('down')) return 'down';
    if (has('left')) return 'left';
    if (has('right')) return 'right';
    if (has('light') || has('block')) return 'confirm';
    if (has('heavy')) return 'back';
    return null;
  }

  // pila de manejadores de UI: solo el de arriba recibe eventos
  push(handler) {
    const entry = { handler };
    this.stack.push(entry);
    return () => { const i = this.stack.indexOf(entry); if (i >= 0) this.stack.splice(i, 1); };
  }
  dispatch(action, code, repeat, pad) {
    const top = this.stack[this.stack.length - 1];
    if (top) top.handler(action, code, repeat, pad);
  }

  captureNext(cb) { this.capture = cb; }

  isDown(action, prof = 'solo') {
    for (const c of this.codesFor(action, prof)) if (this.down.has(c)) return true;
    return false;
  }

  // mandos: el primero es de J1 (o del jugador único), el segundo de J2
  pollPad() {
    const all = navigator.getGamepads ? [...navigator.getGamepads()].filter(x => x && x.connected) : [];
    for (let i = 0; i < 2; i++) {
      const p = all[i];
      const cur = {};
      if (p) {
        const btn = k => p.buttons[k] && p.buttons[k].pressed;
        const ax = p.axes || [];
        cur.left = btn(14) || ax[0] < -0.5; cur.right = btn(15) || ax[0] > 0.5;
        cur.up = btn(12) || ax[1] < -0.6; cur.down = btn(13) || ax[1] > 0.6;
        cur.light = btn(2); cur.heavy = btn(3); cur.special = btn(1); cur.skill1 = btn(4); cur.skill2 = btn(5); cur.ult = btn(7);
        cur.dash = btn(6) || btn(10); cur.block = btn(0); cur.pause = btn(9);
      }
      const P = this.pads[i];
      P.prev = P.cur; P.cur = cur;
      const edge = a => cur[a] && !P.prev[a];
      for (const a in cur) if (edge(a)) this.padPressed[i].add(a);
      // navegación de menús con mando (se indica el índice del mando)
      if (edge('up')) this.dispatch('up', null, false, i); if (edge('down')) this.dispatch('down', null, false, i);
      if (edge('left')) this.dispatch('left', null, false, i); if (edge('right')) this.dispatch('right', null, false, i);
      if (edge('block')) this.dispatch('confirm', null, false, i); if (edge('special')) this.dispatch('back', null, false, i);
      if (edge('pause')) this.dispatch(null, 'Escape', false, i);
    }
  }

  // Estado de juego de un perfil; consume solo sus pulsaciones (los dos jugadores leen en el mismo paso)
  readGame(prof = 'solo') {
    const inp = emptyInput();
    const pi = PAD_SLOT[prof] ?? 0;
    const pad = this.pads[pi].cur, pp = this.padPressed[pi];
    const held = a => this.isDown(a, prof) || !!pad[a];
    const was = a => { for (const c of this.codesFor(a, prof)) if (this.pressed.has(c)) return true; return pp.has(a); };
    inp.l = held('left'); inp.r = held('right'); inp.u = held('up'); inp.d = held('down');
    inp.pu = was('up'); inp.pd = was('down');
    for (const a of ['light', 'heavy', 'special', 'skill1', 'skill2', 'ult', 'dash', 'block']) {
      inp.held[a] = held(a); inp.pressed[a] = was(a);
    }
    for (const a of ACTIONS) for (const c of this.codesFor(a, prof)) this.pressed.delete(c);
    pp.clear();
    return inp;
  }
  clearPressed() { this.pressed.clear(); this.padPressed[0].clear(); this.padPressed[1].clear(); }
}

export const Input = new InputManager();

import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { txt, panel, MenuList, go, fadeIn, keyHints } from '../ui/UI.js';
import { LEVELS } from '../sim/AI.js';
import { quickOpponents, bossFor } from '../core/Match.js';
import { ARENAS } from '../view/Arena.js';

// Jugar: combate rápido
export class PlayScene extends Phaser.Scene {
  constructor() { super('Play'); }
  create() {
    if (!this.scene.isActive('Demo')) this.scene.launch('Demo');
    this.scene.sendToBack('Demo');
    const d = Save.d;
    this.add.rectangle(640, 360, 1280, 720, 0x05030c, 0.7);
    txt(this, 70, 40, 'JUGAR', 72, '#ffffff');
    const st = this.st = { mode: 0, level: d.lastLevel ?? 2, rounds: 1, arena: 0 };
    const MODES = [['1 CONTRA 1', 1], ['1 CONTRA 2', 2], ['1 CONTRA 3', 3], ['JEFE', 1]];
    const ARENA_OPTS = [{ id: 'random', name: 'Aleatorio' }, ...ARENAS];
    const cyc = (k, n, d2) => { st[k] = (st[k] + d2 + n) % n; };
    const items = [
      { label: 'MODO', value: () => MODES[st.mode][0], onLeft: () => cyc('mode', 4, -1), onRight: () => cyc('mode', 4, 1) },
      { label: 'DIFICULTAD', value: () => LEVELS[st.level].name.toUpperCase(), onLeft: () => { st.level = Math.max(0, st.level - 1); }, onRight: () => { st.level = Math.min(6, st.level + 1); } },
      { label: 'RONDAS', value: () => (st.rounds === 1 ? 'A 1' : 'AL MEJOR DE ' + (st.rounds * 2 - 1)), onLeft: () => { st.rounds = Math.max(1, st.rounds - 1); }, onRight: () => { st.rounds = Math.min(3, st.rounds + 1); } },
      { label: 'ESCENARIO', value: () => ARENA_OPTS[st.arena].name.toUpperCase(), onLeft: () => cyc('arena', ARENA_OPTS.length, -1), onRight: () => cyc('arena', ARENA_OPTS.length, 1) },
      { label: '¡A PELEAR!', color: '#ffd166', onSelect: () => this.start(MODES, ARENA_OPTS) }
    ];
    this.info = txt(this, 640, 200, '', 20, '#e8e4ff', { body: true, wrap: 560 });
    panel(this, 620, 180, 600, 300, { alpha: 0.75 });
    this.menu = new MenuList(this, 70, 180, items, { w: 500, h: 56, gap: 10, onBack: () => go(this, 'Menu'), onChange: () => this.refresh() });
    this.menu.idx = 4;
    this.refresh();
    keyHints(this, '↑↓ elegir · ←→ cambiar · ENTER pelear · ESC volver');
    fadeIn(this);
  }
  refresh() {
    const st = this.st;
    const L = LEVELS[st.level];
    const desc = [
      'NPC Despistado: se distrae, apenas bloquea. Ideal para aprender.',
      'Novato: bloquea a veces y hace combos cortos.',
      'Casual: defiende y castiga errores evidentes.',
      'Competitivo: buenas lecturas, antiaéreos y combos con cancelación.',
      'Aura Master: parries, castigos fiables y gestión de energía.',
      'Sigma Legend: reacciona como un jugador experto y lee tus hábitos.',
      'Aura God: reflejos de élite, disciplina ante fintas y adaptación a tus patrones. Sin trampas: solo inteligencia.'
    ][st.level];
    this.info.setText(`${L.name.toUpperCase()}\n\n${desc}\n\nReacción: ${Math.round(L.reaction[0] * 16.7)}-${Math.round(L.reaction[1] * 16.7)} ms · Bloqueo ${Math.round(L.block * 100)}% · Parry ${Math.round(L.parry * 100)}%\n\nVictorias contra este nivel: ${Save.d.stats.byLevel[st.level] || 0}`);
    this.info.setPosition(645, 200);
  }
  start(MODES, ARENA_OPTS) {
    const st = this.st;
    Save.d.lastLevel = st.level; Save.save();
    const boss = st.mode === 3;
    const enemies = boss ? [bossFor(st.level)] : quickOpponents(st.level, MODES[st.mode][1]);
    const spec = { mode: boss ? 'boss' : 'quick', enemies, level: st.level, levelOverride: boss ? undefined : st.level, rounds: boss ? Math.max(2, st.rounds) : st.rounds, arena: ARENA_OPTS[st.arena].id };
    go(this, 'Versus', { spec });
  }
  update() { Input.pollPad(); this.menu.update(); }
}

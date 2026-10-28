import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { txt, panel, MenuList, StickPreview, go, fadeIn, keyHints } from '../ui/UI.js';
import { ALL_BOTS } from '../data/bots.js';
import { LEVELS, STYLES } from '../sim/AI.js';
import { ARENAS } from '../view/Arena.js';
import { MOVES } from '../sim/moves.js';
import { botProfile, quickOpponents } from '../core/Match.js';

export class CustomScene extends Phaser.Scene {
  constructor() { super('Custom'); }
  create() {
    if (!this.scene.isActive('Demo')) this.scene.launch('Demo');
    this.scene.sendToBack('Demo');
    this.add.rectangle(640, 360, 1280, 720, 0x05030c, 0.8);
    txt(this, 60, 30, 'DUELO PERSONALIZADO', 56, '#ffffff');
    const st = this.st = this.st || { bot: 0, diff: -1, mode: 0, arena: 0, rounds: 1, time: 1 };
    const ARENA_OPTS = [{ id: 'random', name: 'Aleatorio' }, ...ARENAS];
    const TIMES = [60, 99, 0];
    const N = ALL_BOTS.length;
    const items = [
      { label: 'RIVAL', value: () => `${st.bot + 1}/${N}`, onLeft: () => { st.bot = (st.bot - 1 + N) % N; }, onRight: () => { st.bot = (st.bot + 1) % N; } },
      { label: 'RIVAL x10', value: () => '', onLeft: () => { st.bot = (st.bot - 10 + N) % N; }, onRight: () => { st.bot = (st.bot + 10) % N; } },
      { label: 'DIFICULTAD', value: () => (st.diff < 0 ? 'LA DEL BOT' : LEVELS[st.diff].name.toUpperCase()), onLeft: () => { st.diff = Math.max(-1, st.diff - 1); }, onRight: () => { st.diff = Math.min(6, st.diff + 1); } },
      { label: 'MODO', value: () => ['1 CONTRA 1', '1 CONTRA 2', '1 CONTRA 3'][st.mode], onLeft: () => { st.mode = (st.mode + 2) % 3; }, onRight: () => { st.mode = (st.mode + 1) % 3; } },
      { label: 'ESCENARIO', value: () => ARENA_OPTS[st.arena].name.toUpperCase(), onLeft: () => { st.arena = (st.arena - 1 + ARENA_OPTS.length) % ARENA_OPTS.length; }, onRight: () => { st.arena = (st.arena + 1) % ARENA_OPTS.length; } },
      { label: 'RONDAS', value: () => (st.rounds === 1 ? 'A 1' : 'AL MEJOR DE ' + (st.rounds * 2 - 1)), onLeft: () => { st.rounds = Math.max(1, st.rounds - 1); }, onRight: () => { st.rounds = Math.min(3, st.rounds + 1); } },
      { label: 'TIEMPO', value: () => (TIMES[st.time] ? TIMES[st.time] + ' s' : '∞'), onLeft: () => { st.time = (st.time + 2) % 3; }, onRight: () => { st.time = (st.time + 1) % 3; } },
      { label: '¡LUCHAR!', color: '#ffd166', onSelect: () => this.start(ARENA_OPTS, TIMES) }
    ];
    panel(this, 620, 110, 620, 540, { alpha: 0.7 });
    this.name = txt(this, 930, 130, '', 40, '#ffffff', { ox: 0.5 });
    this.sub = txt(this, 930, 180, '', 20, '#ffd166', { ox: 0.5 });
    this.quote = txt(this, 930, 212, '', 18, '#e8e4ff', { ox: 0.5, body: true, wrap: 560, align: 'center' });
    this.moves = txt(this, 640, 470, '', 16, '#c9c3e6', { body: true, wrap: 580 });
    this.prev = new StickPreview(this, 930, 440, botProfile(ALL_BOTS[0]), { scale: 1.6, facing: -1, anim: 'guard', depth: 6 });
    this.menu = new MenuList(this, 50, 120, items, { w: 520, h: 52, gap: 8, onBack: () => go(this, 'Menu'), onChange: () => this.refresh() });
    this.refresh();
    keyHints(this, '↑↓ elegir · ←→ cambiar · ENTER luchar · ESC volver');
    fadeIn(this);
  }
  refresh() {
    const b = ALL_BOTS[this.st.bot];
    this.prev.setProfile(botProfile(b)); this.prev.scale = 1.6 * (b.scale || 1);
    this.name.setText(b.name).setColor(b.boss ? '#ff4d6d' : '#ffffff');
    const lv = this.st.diff < 0 ? b.level : this.st.diff;
    this.sub.setText(`${b.boss ? 'JEFE · ' : ''}${LEVELS[lv].name.toUpperCase()} · ${STYLES[b.style].name.toUpperCase()}`).setColor(LEVELS[lv].color);
    this.quote.setText(`"${b.quote}"`);
    const lo = b.loadout;
    this.moves.setText('Técnicas: ' + [lo.special, lo.specialF, lo.specialD, lo.skill1, lo.skill2].map(id => MOVES[id] ? MOVES[id].name : '?').join(' · ') + '\nUltimate: ' + (MOVES[lo.ult] ? MOVES[lo.ult].name : '?'));
  }
  start(ARENA_OPTS, TIMES) {
    const st = this.st;
    const b = ALL_BOTS[st.bot];
    const lv = st.diff < 0 ? b.level : st.diff;
    const enemies = [b, ...quickOpponents(Math.min(6, lv), st.mode)];
    go(this, 'Versus', { spec: { mode: 'custom', enemies, level: lv, levelOverride: st.diff < 0 ? undefined : st.diff, arena: ARENA_OPTS[st.arena].id, rounds: st.rounds, timer: TIMES[st.time] } });
  }
  update() { Input.pollPad(); this.menu.update(); this.prev.update(); }
}
void Save;

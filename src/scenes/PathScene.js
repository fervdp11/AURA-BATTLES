import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { txt, panel, MenuList, go, fadeIn, keyHints } from '../ui/UI.js';
import { PATH, chapterUnlocked, stageUnlocked } from '../data/path.js';
import { botById } from '../data/bots.js';
import { LEVELS } from '../sim/AI.js';

export class PathScene extends Phaser.Scene {
  constructor() { super('Path'); }
  create() {
    if (!this.scene.isActive('Demo')) this.scene.launch('Demo');
    this.scene.sendToBack('Demo');
    this.add.rectangle(640, 360, 1280, 720, 0x05030c, 0.78);
    txt(this, 60, 30, 'CAMINO DEL AURA', 60, '#ffffff');
    const d = Save.d;
    const done = PATH.reduce((n, c) => n + c.stages.filter(s => d.path.cleared[s.id]).length, 0);
    txt(this, 1220, 50, `${done} / ${PATH.length * 5} combates`, 24, '#ffd166', { ox: 1 });
    this.chapterIdx = 0;
    for (let i = 0; i < PATH.length; i++) if (chapterUnlocked(d, i)) this.chapterIdx = i;
    const chItems = PATH.map((c, i) => {
      const unlocked = chapterUnlocked(d, i);
      const cleared = c.stages.every(s => d.path.cleared[s.id]);
      return { label: `${i + 1}. ${c.name}`, locked: !unlocked, value: () => (cleared ? '✔' : ''), onSelect: () => this.openChapter(i) };
    });
    this.info = txt(this, 660, 140, '', 20, '#e8e4ff', { body: true, wrap: 560 });
    panel(this, 640, 120, 600, 520, { alpha: 0.7 });
    this.chMenu = new MenuList(this, 50, 130, chItems, { w: 540, h: 54, gap: 8, size: 24, onBack: () => go(this, 'Menu'), onChange: (it, i) => this.showChapter(i) });
    this.chMenu.idx = this.chapterIdx;
    this.showChapter(this.chapterIdx);
    this.stMenu = null;
    keyHints(this, '↑↓ elegir · ENTER abrir · ESC volver');
    fadeIn(this);
  }
  showChapter(i) {
    const c = PATH[i];
    const d = Save.d;
    const lines = [`CAPÍTULO ${i + 1}: ${c.name.toUpperCase()}`, c.desc, ''];
    c.stages.forEach((s, si) => {
      const ok = d.path.cleared[s.id];
      lines.push(`${ok ? '✔' : stageUnlocked(d, i, si) ? '▶' : '🔒'}  ${s.title}  ·  ${LEVELS[s.level].name}`);
    });
    if (!chapterUnlocked(d, i)) lines.push('', 'Completa el capítulo anterior para desbloquearlo.');
    this.info.setText(lines.join('\n'));
  }
  openChapter(ci) {
    const d = Save.d;
    const c = PATH[ci];
    this.chMenu.active = false;
    const items = c.stages.map((s, si) => ({
      label: `${si + 1}. ${s.title}`, locked: !stageUnlocked(d, ci, si), value: () => (d.path.cleared[s.id] ? '✔' : s.boss ? 'JEFE' : s.mode.toUpperCase()),
      color: s.boss ? '#ff4d6d' : undefined,
      onSelect: () => this.startStage(s)
    }));
    this.stMenu = new MenuList(this, 660, 360, items, { w: 560, h: 46, gap: 6, size: 22, depth: 30, onBack: () => { this.stMenu.destroy(); this.stMenu = null; this.chMenu.active = true; }, onChange: it => void it });
    let first = items.findIndex((it, si) => !it.locked && !d.path.cleared[c.stages[si].id]);
    this.stMenu.idx = first >= 0 ? first : 0;
    this.info.setText(`CAPÍTULO ${ci + 1}: ${c.name.toUpperCase()}\n${c.desc}\n\nElige combate:`);
  }
  startStage(s) {
    const enemies = s.enemies.map(botById);
    go(this, 'Versus', { spec: { mode: 'path', stageId: s.id, enemies, rounds: s.rounds, arena: s.arena, boss: !!s.boss, pathTitle: s.title } });
  }
  update() { Input.pollPad(); this.chMenu.update(); if (this.stMenu) this.stMenu.update(); }
}

import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, panel, MenuList, go, fadeIn, keyHints, toast } from '../ui/UI.js';
import { RANKS, rankFor, ACHIEVEMENTS } from '../data/progression.js';
import { LEVELS } from '../sim/AI.js';

export class PrestigeScene extends Phaser.Scene {
  constructor() { super('Prestige'); }
  create() {
    this.confirm = false;
    if (!this.scene.isActive('Demo')) this.scene.launch('Demo');
    this.scene.sendToBack('Demo');
    this.add.rectangle(640, 360, 1280, 720, 0x05030c, 0.86);
    txt(this, 50, 24, 'PRESTIGIO · ESTADÍSTICAS · LOGROS', 46, '#ffffff');
    panel(this, 560, 100, 680, 560, { alpha: 0.6 });
    this.body = txt(this, 585, 120, '', 18, '#e8e4ff', { body: true, wrap: 630 });
    this.g = this.add.graphics();
    this.menu = new MenuList(this, 50, 120, [
      { label: 'PRESTIGIO', onSelect: () => this.prestige(), tab: 'p' },
      { label: 'RANGOS', tab: 'r' },
      { label: 'ESTADÍSTICAS', tab: 's' },
      { label: 'LOGROS', tab: 'a' },
      { label: 'VOLVER', onSelect: () => go(this, 'Menu') }
    ], { w: 460, h: 56, gap: 10, onBack: () => go(this, 'Menu'), onChange: it => this.show(it.tab) });
    this.show('p');
    keyHints(this, '↑↓ elegir · ENTER confirmar · ESC volver');
    fadeIn(this);
  }
  show(tab) {
    const d = Save.d, s = d.stats;
    const r = rankFor(d.rankPoints);
    this.g.clear();
    if (tab === 'p') {
      this.body.setText([
        `PRESTIGIO ACTUAL: ${d.prestige ? '★'.repeat(Math.min(10, d.prestige)) + ' (' + d.prestige + ')' : 'ninguno'}`,
        `Rango: ${r.name} · ${d.rankPoints} PR`, '',
        'Al alcanzar el rango AURA GOD puedes hacer prestigio:',
        '· Tu rango vuelve a "Sin Aura" (conservas técnicas, cosméticos y logros).',
        '· +10% de AP permanente por cada nivel de prestigio.',
        '· +1000 AP de bonificación.',
        '· Desbloqueas auras, accesorios, celebraciones y títulos exclusivos.',
        '',
        Save.canPrestige() ? '✦ ¡PUEDES HACER PRESTIGIO! Pulsa ENTER sobre PRESTIGIO.' : `Te faltan ${Math.max(0, RANKS[7].rp - d.rankPoints)} PR para Aura God.`
      ].join('\n'));
    } else if (tab === 'r') {
      this.body.setText(RANKS.map((k, i) => `${i <= r.index ? '✔' : '·'} ${k.name.padEnd(16, ' ')}  ${k.rp} PR`).join('\n') +
        '\n\nGanas PR al vencer; más cuanto mayor es la dificultad, el número de rivales y si son jefes.\nPerder contra rivales fáciles resta un poco.');
    } else if (tab === 's') {
      const total = s.wins + s.losses;
      this.body.setText([
        `Combates: ${s.matches} · Victorias: ${s.wins} · Derrotas: ${s.losses} · ${total ? Math.round(s.wins / total * 100) : 0}% victorias`,
        `Racha actual: ${s.streak} · Mejor racha: ${s.bestStreak}`,
        `Victorias perfectas: ${s.perfects} · Jefes derrotados: ${s.bosses} · Victorias 1v3: ${s.wins1v3}`,
        `Combo máximo: ${s.maxCombo} · Parries: ${s.parries} · Humillaciones: ${s.humiliations}`,
        `Aura infligida: ${s.damage} · Rivales derrotados: ${s.kos} · Especiales: ${s.specials} · Ultimates: ${s.ults}`,
        `Supervivencia: récord ${s.survivalBest} oleadas (${s.survivalRuns} partidas)`,
        `Tiempo de combate: ${Math.round(s.playFrames / 3600)} min`,
        '', 'VICTORIAS / DERROTAS POR DIFICULTAD:',
        ...LEVELS.map((l, i) => `  ${l.name}: ${s.byLevel[i] || 0} / ${s.lossByLevel[i] || 0}`)
      ].join('\n'));
    } else if (tab === 'a') {
      const got = ACHIEVEMENTS.filter(a => d.achievements[a.id]).length;
      this.body.setText(`LOGROS ${got}/${ACHIEVEMENTS.length}\n` + ACHIEVEMENTS.map(a => `${d.achievements[a.id] ? '🏆' : '🔒'} ${a.name} — ${a.desc} (+${a.ap} AP)`).join('\n'));
      this.body.setFontSize(14);
      return;
    }
    this.body.setFontSize(18);
  }
  prestige() {
    if (!Save.canPrestige()) { Audio.play('ui_deny'); toast(this, 'Necesitas el rango AURA GOD', '#ff4d6d'); return; }
    if (!this.confirm) { this.confirm = true; toast(this, 'Pulsa ENTER otra vez para confirmar', '#ffd166'); this.time.delayedCall(3000, () => { this.confirm = false; }); return; }
    Save.doPrestige();
    this.confirm = false;
    Audio.play('victory'); Audio.announce('Prestigio');
    this.cameras.main.flash(500, 255, 220, 120);
    toast(this, '✦ PRESTIGIO ' + Save.d.prestige + ' ✦', '#ffd166');
    this.show('p');
  }
  update() { Input.pollPad(); this.menu.update(); }
}

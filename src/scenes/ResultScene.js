import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, panel, MenuList, StickPreview, MenuBG, go, fadeIn, toast, keyHints } from '../ui/UI.js';
import { playerProfile, quickOpponents } from '../core/Match.js';
import { rankFor } from '../data/progression.js';
import { PATH, stageById, chaptersCleared } from '../data/path.js';
import { botById } from '../data/bots.js';

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }
  init(data) { this.data2 = data; }
  create() {
    const { spec, result, info, rewards } = this.data2;
    this.bg = new MenuBG(this);
    const win = result && result.win && spec.mode !== 'survival';
    const surv = spec.mode === 'survival';
    const training = spec.mode === 'training';
    Audio.music('results');
    // progreso del Camino
    let nextStage = null;
    if (spec.mode === 'path' && win) {
      Save.d.path.cleared[spec.stageId] = true;
      Save.d.pathChapters = chaptersCleared(Save.d);
      Save.save();
      const more = Save.checkAchievements();
      if (rewards && more.length) rewards.newAch.push(...more);
      const st = stageById(spec.stageId);
      if (st) {
        const si = st.chapter.stages.indexOf(st.stage);
        nextStage = st.chapter.stages[si + 1] || (PATH[st.chapter.index + 1] ? PATH[st.chapter.index + 1].stages[0] : null);
      }
    }
    const title = surv ? 'FIN DE LA SUPERVIVENCIA' : training ? 'ENTRENAMIENTO' : win ? (result.perfect ? 'VICTORIA PERFECTA' : 'VICTORIA') : 'DERROTA';
    const col = surv ? '#ffd166' : win ? '#7df9ff' : '#ff4d6d';
    const t = txt(this, 640, 80, title, surv ? 64 : 96, col, { ox: 0.5, oy: 0.5, strokeThickness: 10 });
    t.setShadow(0, 0, col, 30, true, true).setScale(2).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });
    const prof = playerProfile();
    this.prev = new StickPreview(this, 250, 600, prof, { scale: 2.4, anim: win || surv ? (prof.celebration || 'flex') : 'dizzy', glow: win ? 1.4 : 0.4 });
    // estadísticas
    panel(this, 480, 150, 360, 370, { alpha: 0.85 });
    const st = info ? info.stats : {};
    const lines = [
      ['Daño de aura', Math.round(st.dmg || 0)], ['Golpes', st.hits || 0], ['Combo máximo', st.maxCombo || 0], ['Parries', st.parries || 0],
      ['Humillaciones', st.humiliations || 0], ['Especiales', st.specials || 0], ['Ultimates', st.ults || 0], ['Esquivas', st.dodges || 0],
      ['Tiempo', ((info ? info.frames : 0) / 60).toFixed(1) + ' s']
    ];
    if (surv) lines.unshift(['Oleadas superadas', info.waves]);
    txt(this, 500, 165, 'ESTADÍSTICAS', 26, '#ffffff');
    lines.forEach(([k, v], i) => { txt(this, 500, 205 + i * 33, k, 19, '#c9c3e6', { body: true }); txt(this, 820, 205 + i * 33, String(v), 20, '#ffffff', { ox: 1 }); });
    // recompensas
    panel(this, 870, 150, 370, 370, { alpha: 0.85 });
    txt(this, 890, 165, 'RECOMPENSAS', 26, '#ffffff');
    if (rewards) {
      this.apText = txt(this, 890, 210, '+0 AP', 40, '#7df9ff');
      this.rpText = txt(this, 890, 262, '', 26, rewards.rp >= 0 ? '#7bd389' : '#ff6b6b');
      this.rpText.setText((rewards.rp >= 0 ? '+' : '') + rewards.rp + ' PR');
      const r = rewards.rank;
      txt(this, 890, 310, 'RANGO', 18, '#9a94b8', { body: true });
      txt(this, 890, 332, r.name.toUpperCase(), 34, r.color);
      this.rankBar = this.add.graphics();
      this.rankTarget = r.progress; this.rankCur = 0; this.rankCol = Phaser.Display.Color.HexStringToColor(r.color).color;
      txt(this, 890, 410, r.next ? `${Save.d.rankPoints} / ${r.next.rp} PR para ${r.next.name}` : 'Rango máximo: ¡haz prestigio!', 16, '#c9c3e6', { body: true, wrap: 340 });
      txt(this, 890, 450, `Total: ${Save.d.ap} AP`, 22, '#ffd166');
      if (rewards.rankUp) { this.time.delayedCall(900, () => { toast(this, '¡SUBES DE RANGO! ' + r.name, r.color); Audio.play('victory'); }); }
      rewards.newAch.forEach((a, i) => toast(this, '🏆 ' + a.name + ' (+' + a.ap + ' AP)', '#ffd166', 1600 + i * 3000));
      this.apTarget = rewards.ap; this.apCur = 0;
    } else txt(this, 890, 220, 'Sin recompensas en entrenamiento.', 18, '#c9c3e6', { body: true, wrap: 330 });
    // opciones
    const items = [];
    if (spec.mode === 'path' && win && nextStage) items.push({ label: 'SIGUIENTE COMBATE', onSelect: () => this.toStage(nextStage) });
    if (spec.mode === 'path' && !win) items.push({ label: 'REINTENTAR', onSelect: () => go(this, 'Versus', { spec }) });
    if (spec.mode === 'quick' || spec.mode === 'custom' || spec.mode === 'boss') {
      items.push({ label: 'REVANCHA', onSelect: () => go(this, 'Versus', { spec }) });
      if (spec.mode === 'quick' && win) items.push({ label: 'NUEVO RIVAL', onSelect: () => go(this, 'Versus', { spec: { ...spec, enemies: quickOpponents(spec.level, spec.enemies.length) } }) });
    }
    if (surv) items.push({ label: 'OTRA VEZ', onSelect: () => go(this, 'Versus', { spec: { mode: 'survival', wave: 1 } }) });
    if (spec.mode === 'path') items.push({ label: 'CAMINO DEL AURA', onSelect: () => go(this, 'Path') });
    items.push({ label: 'MENÚ PRINCIPAL', onSelect: () => go(this, 'Menu') });
    this.menu = new MenuList(this, 480, 545, items, { w: 380, h: 40, gap: 4, size: 22 });
    keyHints(this, '↑↓ elegir · ENTER confirmar');
    fadeIn(this);
    if (win) for (let i = 0; i < 4; i++) this.time.delayedCall(i * 300, () => this.confetti());
  }
  toStage(s) {
    const enemies = s.enemies.map(botById);
    go(this, 'Versus', { spec: { mode: 'path', stageId: s.id, enemies, rounds: s.rounds, arena: s.arena, boss: !!s.boss, pathTitle: s.title } });
  }
  confetti() {
    const p = this.add.particles(0, 0, 'square', { x: { min: 0, max: 1280 }, y: -20, speedY: { min: 150, max: 400 }, speedX: { min: -80, max: 80 }, lifespan: 3000, rotate: { min: 0, max: 360 }, tint: [0xff4d6d, 0x7df9ff, 0xffd166, 0x7bd389, 0xc084fc], quantity: 4, frequency: 40, duration: 600 });
    p.setDepth(40);
  }
  update() {
    Input.pollPad();
    this.bg.update();
    this.prev.update();
    this.menu.update();
    if (this.apText && this.apCur < this.apTarget) {
      this.apCur = Math.min(this.apTarget, this.apCur + Math.max(1, Math.ceil(this.apTarget / 60)));
      this.apText.setText('+' + this.apCur + ' AP');
      if (this.apCur % 5 === 0) Audio.play('coin', { minGap: 0.05 });
    }
    if (this.rankBar) {
      this.rankCur += (this.rankTarget - this.rankCur) * 0.05;
      const g = this.rankBar; g.clear();
      g.fillStyle(0x000000, 0.7); g.fillRoundedRect(890, 382, 330, 16, 8);
      g.fillStyle(this.rankCol, 1); g.fillRoundedRect(890, 382, 330 * Math.max(0.02, this.rankCur), 16, 8);
    }
  }
}
void rankFor;

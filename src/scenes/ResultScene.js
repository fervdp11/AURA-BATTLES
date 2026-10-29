import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, panel, MenuList, StickPreview, MenuBG, go, fadeIn, toast, keyHints } from '../ui/UI.js';
import { playerProfile, quickOpponents } from '../core/Match.js';
import { rankFor, auraText } from '../data/progression.js';
import { PATH, stageById, chaptersCleared } from '../data/path.js';
import { botById } from '../data/bots.js';
import { Online } from '../net/Online.js';
import { CELEBRATIONS, DEFEATS } from '../sim/celebrations.js';

const loopStart = a => { const c = CELEBRATIONS[a] || DEFEATS[a]; return c && c.anim.loop ? c.anim.loop[0] : 0; };

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }
  init(data) { this.data2 = data; }
  create() {
    this.apText = null; this.rankBar = null; this.rpText = null;
    const { spec, result, info, rewards } = this.data2;
    this.bg = new MenuBG(this);
    this.prevB = null;
    if (spec.mode === 'versus') { this.createVersus(spec, result, info); return; }
    if (spec.mode === 'online') { this.createOnline(this.data2.online); return; }
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
    if (!win && !surv && !training && spec.enemies && spec.enemies[0]) {
      const bot = spec.enemies[0];
      txt(this, 640, 128, `${bot.name}: "${bot.quote}"`, 18, '#ff9fb0', { ox: 0.5, body: true, wrap: 900, align: 'center' });
    }
    // la animación continúa donde la dejó el combate (tramo en bucle), sin reiniciarse
    const pa = win || surv ? (CELEBRATIONS[prof.celebration] ? prof.celebration : 'flex') : ((info && info.defeatAnim) || 'kneel');
    this.prev = new StickPreview(this, 250, 640, prof, { scale: 2.0, anim: pa, startFrame: loopStart(pa), glow: win ? 1.4 : 0.4 });
    // aura final (-∞ a +∞)
    if (info && info.final && !training) this.auraFinal(240, 214, info.final, 1);
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
    // recompensas: resultado, ganancias, penalizaciones y cambio de saldo, cada cosa en su bloque
    panel(this, 870, 150, 370, 380, { alpha: 0.85 });
    const resLabel = surv ? 'SUPERVIVENCIA' : training ? 'ENTRENAMIENTO' : win ? 'VICTORIA' : 'DERROTA';
    txt(this, 890, 160, 'RESULTADO', 14, '#9a94b8', { body: true });
    txt(this, 1220, 158, resLabel, 20, col, { ox: 1 });
    if (rewards && !rewards.duplicate) {
      let y = 188;
      txt(this, 890, y, 'RECOMPENSAS', 18, '#7bd389'); y += 24;
      for (const it of rewards.items) {
        txt(this, 900, y, it.label, 15, '#c9c3e6', { body: true });
        txt(this, 1220, y, '+' + it.ap + ' AP', 16, '#7df9ff', { ox: 1 }); y += 20;
      }
      if (rewards.achAp) { txt(this, 900, y, 'Logros desbloqueados', 15, '#c9c3e6', { body: true }); txt(this, 1220, y, '+' + rewards.achAp + ' AP', 16, '#ffd166', { ox: 1 }); y += 20; }
      if (rewards.penalties.length) {
        y += 4; txt(this, 890, y, 'PENALIZACIONES', 18, '#ff6b6b'); y += 24;
        for (const pe of rewards.penalties) {
          txt(this, 900, y, pe.label, 15, '#c9c3e6', { body: true });
          txt(this, 1220, y, pe.ap !== undefined ? pe.ap + ' AP' : pe.rp + ' PR', 16, '#ff6b6b', { ox: 1 }); y += 20;
        }
      }
      y = Math.max(y + 6, 370);
      // cambio de saldo
      const b0 = rewards.before, b1 = { ap: Save.d.ap, rp: Save.d.rankPoints }, dAp = b1.ap - b0.ap, dRp = b1.rp - b0.rp;
      txt(this, 890, y - 4, 'SALDO', 14, '#9a94b8', { body: true });
      this.apText = txt(this, 890, y + 12, `${b0.ap} AP`, 26, '#ffd166');
      txt(this, 1220, y + 16, (dAp >= 0 ? '+' : '') + dAp + ' AP', 20, dAp >= 0 ? '#7bd389' : '#ff6b6b', { ox: 1 });
      this.rpText = txt(this, 890, y + 44, `${b0.rp} → ${b1.rp} PR`, 18, '#c9c3e6', { body: true });
      txt(this, 1220, y + 44, (dRp > 0 ? '+' : '') + dRp + ' PR', 18, dRp > 0 ? '#7bd389' : dRp < 0 ? '#ff6b6b' : '#c9c3e6', { ox: 1 });
      const r = rewards.rank;
      txt(this, 890, y + 72, r.name.toUpperCase(), 22, r.color);
      txt(this, 1220, y + 76, r.next ? `${Save.d.rankPoints}/${r.next.rp} → ${r.next.name}` : 'Rango máximo', 13, '#c9c3e6', { ox: 1, body: true });
      this.rankBar = this.add.graphics(); this.rankBarY = y + 104;
      this.rankTarget = r.progress; this.rankCur = 0; this.rankCol = Phaser.Display.Color.HexStringToColor(r.color).color;
      if (rewards.rankUp) { this.time.delayedCall(900, () => { toast(this, '¡SUBES DE RANGO! ' + r.name, r.color); Audio.play('victory'); }); }
      rewards.newAch.forEach((a, i) => toast(this, '🏆 ' + a.name + ' (+' + a.ap + ' AP)', '#ffd166', 1600 + i * 3000));
      this.apFrom = b0.ap; this.apTarget = b1.ap; this.apCur = b0.ap;
    } else txt(this, 890, 220, rewards && rewards.duplicate ? 'Esta partida ya se había registrado.' : 'Sin recompensas en entrenamiento.', 18, '#c9c3e6', { body: true, wrap: 330 });
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
  // Resultado del multijugador local: ganador, marcador de la sesión y estadísticas comparadas
  createVersus(spec, result, info) {
    Audio.music('results');
    const w = info.winner, cols = ['#7df9ff', '#ff5fa2'];
    const profs = [spec.p1.profile, spec.p2.profile];
    const t = txt(this, 640, 64, `¡GANA EL JUGADOR ${w + 1}!`, 78, cols[w], { ox: 0.5, oy: 0.5, strokeThickness: 10 });
    t.setShadow(0, 0, cols[w], 30, true, true).setScale(2).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });
    txt(this, 640, 116, info.names[w] + (result.rounds ? `  ·  rondas ${result.rounds[0]} – ${result.rounds[1]}` : ''), 22, '#ffffff', { ox: 0.5, oy: 0.5 });
    const an = i => (w === i ? (CELEBRATIONS[profs[i].celebration] ? profs[i].celebration : 'flex') : ((info.defeatAnim && info.defeatAnim[i]) || 'kneel'));
    this.prev = new StickPreview(this, 170, 600, profs[0], { scale: 2.2, facing: 1, anim: an(0), startFrame: loopStart(an(0)), glow: w === 0 ? 1.4 : 0.3 });
    this.prevB = new StickPreview(this, 1110, 600, profs[1], { scale: 2.2, facing: -1, anim: an(1), startFrame: loopStart(an(1)), glow: w === 1 ? 1.4 : 0.3 });
    txt(this, 170, 630, 'J1 · ' + info.names[0], 22, cols[0], { ox: 0.5 });
    txt(this, 1110, 630, 'J2 · ' + info.names[1], 22, cols[1], { ox: 0.5 });
    if (info.final) { this.auraFinal(170, 210, info.final[0], 0.8); this.auraFinal(1110, 210, info.final[1], 0.8); }
    // marcador de la sesión
    const sc = spec.score || [0, 0];
    panel(this, 390, 150, 500, 380, { alpha: 0.88 });
    txt(this, 640, 172, 'MARCADOR DE LA SESIÓN', 20, '#c9c3e6', { ox: 0.5 });
    const s1 = txt(this, 560, 230, String(sc[0]), 64, cols[0], { ox: 0.5, oy: 0.5 }), s2 = txt(this, 720, 230, String(sc[1]), 64, cols[1], { ox: 0.5, oy: 0.5 });
    txt(this, 640, 230, '–', 50, '#ffffff', { ox: 0.5, oy: 0.5 });
    (w === 0 ? s1 : s2).setScale(1.6); this.tweens.add({ targets: w === 0 ? s1 : s2, scale: 1, duration: 400, delay: 300, ease: 'Bounce.easeOut' });
    const st = info.stats;
    const rows = [['Daño de aura', x => Math.round(x.dmg || 0)], ['Golpes', x => x.hits || 0], ['Combo máximo', x => x.maxCombo || 0], ['Parries', x => x.parries || 0], ['Especiales', x => x.specials || 0], ['Ultimates', x => x.ults || 0], ['Esquivas', x => x.dodges || 0]];
    rows.forEach(([k, f], i) => {
      const a = f(st[0]), b = f(st[1]), y = 290 + i * 32;
      txt(this, 640, y, k, 17, '#9a94b8', { ox: 0.5, body: true });
      txt(this, 430, y, String(a), 20, a > b ? cols[0] : '#ffffff', {});
      txt(this, 850, y, String(b), 20, b > a ? cols[1] : '#ffffff', { ox: 1 });
    });
    const items = [
      { label: 'REVANCHA INSTANTÁNEA', color: '#ffd166', onSelect: () => go(this, 'Fight', { spec }) },
      { label: 'CAMBIAR PERSONAJES', onSelect: () => go(this, 'LocalSetup') },
      { label: 'MENÚ PRINCIPAL', onSelect: () => go(this, 'Menu') }
    ];
    this.menu = new MenuList(this, 450, 548, items, { w: 380, h: 42, gap: 6, size: 22 });
    keyHints(this, '↑↓ elegir · ENTER confirmar');
    fadeIn(this);
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 300, () => this.confetti());
  }
  // Resultado online: lo decide el servidor (ganador, motivo y recompensas); aquí solo se muestra
  createOnline(m) {
    Audio.music('results');
    const you = Online.start ? Online.start.you : Online.you, cols = ['#7df9ff', '#ff5fa2'];
    const win = m.result.winner === you;
    const reason = m.result.reason === 'abandon' ? (win ? 'El rival abandonó la partida' : 'Abandonaste la partida') : 'K.O.';
    const t = txt(this, 640, 62, win ? '¡VICTORIA ONLINE!' : 'DERROTA ONLINE', 74, win ? '#7df9ff' : '#ff4d6d', { ox: 0.5, oy: 0.5, strokeThickness: 10 });
    t.setShadow(0, 0, win ? '#7df9ff' : '#ff4d6d', 30, true, true).setScale(2).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });
    txt(this, 640, 112, `${m.names[0]}  vs  ${m.names[1]}  ·  ${reason}  ·  marcador ${(m.score || [0, 0]).join(' – ')}`, 19, '#ffffff', { ox: 0.5, oy: 0.5, body: true });
    const cfg = Online.start ? Online.start.cfg : null;
    const profs = cfg ? cfg.players.map(p => p.profile) : [{}, {}];
    const anim = i => (m.result.winner === i ? (CELEBRATIONS[profs[i].celebration] ? profs[i].celebration : 'flex') : 'kneel');
    this.prev = new StickPreview(this, 150, 610, profs[0], { scale: 2.0, facing: 1, anim: anim(0), startFrame: loopStart(anim(0)), glow: m.result.winner === 0 ? 1.4 : 0.3 });
    this.prevB = new StickPreview(this, 1130, 610, profs[1], { scale: 2.0, facing: -1, anim: anim(1), startFrame: loopStart(anim(1)), glow: m.result.winner === 1 ? 1.4 : 0.3 });
    txt(this, 150, 640, 'J1 · ' + m.names[0] + (you === 0 ? ' (TÚ)' : ''), 18, cols[0], { ox: 0.5 });
    txt(this, 1130, 640, 'J2 · ' + m.names[1] + (you === 1 ? ' (TÚ)' : ''), 18, cols[1], { ox: 0.5 });
    // estadísticas comparadas
    panel(this, 300, 150, 380, 380, { alpha: 0.85 });
    txt(this, 490, 166, 'ESTADÍSTICAS', 22, '#ffffff', { ox: 0.5 });
    const rows = [['Daño de aura', x => Math.round(x.dmg || 0)], ['Golpes', x => x.hits || 0], ['Combo máximo', x => x.maxCombo || 0], ['Parries', x => x.parries || 0], ['Humillaciones', x => x.humiliations || 0], ['Especiales', x => x.specials || 0], ['Ultimates', x => x.ults || 0], ['Esquivas', x => x.dodges || 0]];
    rows.forEach(([k, f], i) => {
      const a = f(m.stats[0]), b = f(m.stats[1]), y = 210 + i * 36;
      txt(this, 490, y, k, 16, '#9a94b8', { ox: 0.5, body: true });
      txt(this, 320, y, String(a), 19, a > b ? cols[0] : '#ffffff', {});
      txt(this, 660, y, String(b), 19, b > a ? cols[1] : '#ffffff', { ox: 1 });
    });
    // recompensas del servidor
    panel(this, 700, 150, 380, 380, { alpha: 0.85 });
    const R = m.applied || {};
    txt(this, 720, 162, 'RECOMPENSAS (SERVIDOR)', 20, '#7bd389');
    let y = 196;
    if (R.duplicate) txt(this, 720, y, 'Esta partida ya se había registrado.', 16, '#c9c3e6', { body: true });
    else {
      for (const it of R.items || []) { txt(this, 730, y, it.label, 15, '#c9c3e6', { body: true }); txt(this, 1060, y, '+' + it.ap + ' AP', 16, '#7df9ff', { ox: 1 }); y += 21; }
      if ((R.penalties || []).length) { y += 4; txt(this, 720, y, 'PENALIZACIONES', 17, '#ff6b6b'); y += 22; for (const pe of R.penalties) { txt(this, 730, y, pe.label, 15, '#c9c3e6', { body: true }); txt(this, 1060, y, pe.ap !== undefined ? pe.ap + ' AP' : pe.rp + ' PR', 16, '#ff6b6b', { ox: 1 }); y += 21; } }
      y = Math.max(y + 10, 400);
      if (R.before) {
        txt(this, 720, y, 'SALDO', 14, '#9a94b8', { body: true });
        txt(this, 720, y + 18, `${R.before.ap} → ${R.after.ap} AP`, 22, '#ffd166');
        txt(this, 720, y + 50, `${R.before.rp} → ${R.after.rp} PR`, 18, '#c9c3e6', { body: true });
        if (R.rank) txt(this, 1060, y + 50, R.rank.name.toUpperCase(), 18, R.rank.color, { ox: 1 });
      }
    }
    const fin = m.rewards[you] && m.rewards[you].final;
    if (fin) this.auraFinal(890, 600, { value: fin.value === 'inf' ? Infinity : fin.value === '-inf' ? -Infinity : fin.value, label: fin.label, color: fin.color }, 0.62);
    this.waitT = txt(this, 640, 668, '', 16, '#ffd166', { ox: 0.5, body: true });
    const items = [
      { label: 'REVANCHA', color: '#ffd166', onSelect: () => { Online.send({ type: 'rematch' }); this.waitT.setText('Esperando al rival para la revancha…'); } },
      { label: 'CAMBIAR PERSONAJE', onSelect: () => { Online.send({ type: 'lobby' }); go(this, 'OnlineLobby'); } },
      { label: 'SALIR', onSelect: () => { Online.leaveRoom(); go(this, 'Online'); } }
    ];
    this.menu = new MenuList(this, 300, 548, items, { w: 380, h: 30, gap: 4, size: 18 });
    this.offNet = Online.listen((type, msg) => {
      if (type === 'start') go(this, 'Fight', { spec: { mode: 'online', arena: msg.cfg.arena } });
      if (type === 'rematch') this.waitT.setText(`Revancha: ${msg.votes.filter(Boolean).length}/2 listos`);
      if (type === 'left') { this.waitT.setText('El rival ha salido de la sala.'); }
      if (type === 'room' && msg.state === 'lobby' && !this._toLobby) { this._toLobby = true; go(this, 'OnlineLobby'); }
    });
    this.events.once('shutdown', () => this.offNet());
    keyHints(this, '↑↓ elegir · ENTER confirmar');
    fadeIn(this);
    if (win) for (let i = 0; i < 4; i++) this.time.delayedCall(i * 300, () => this.confetti());
    (R.newAch || []).forEach((a, i) => toast(this, '🏆 ' + a.name + ' (+' + a.ap + ' AP)', '#ffd166', 1600 + i * 3000));
  }
  // contador animado del aura final: sube/baja hasta su valor; los infinitos se disparan y estallan en ∞
  auraFinal(x, y, F, k = 1) {
    const box = this.add.graphics().setDepth(20);
    const col = Phaser.Display.Color.HexStringToColor(F.color).color;
    box.fillStyle(0x07040f, 0.88); box.fillRoundedRect(x - 190 * k, y - 62 * k, 380 * k, 124 * k, 14);
    box.lineStyle(3, col, 1); box.strokeRoundedRect(x - 190 * k, y - 62 * k, 380 * k, 124 * k, 14);
    txt(this, x, y - 44 * k, 'AURA DE TU ACTUACIÓN', 16 * k, '#c9c3e6', { ox: 0.5, oy: 0.5 }).setDepth(21);
    const num = txt(this, x, y + 2 * k, '0', 54 * k, F.color, { ox: 0.5, oy: 0.5, strokeThickness: 7 }).setDepth(21);
    const lab = txt(this, x, y + 42 * k, F.label, 18 * k, F.color, { ox: 0.5, oy: 0.5 }).setDepth(21).setAlpha(0);
    num.setShadow(0, 0, F.color, 18, true, true);
    let t = 0;
    const inf = !Number.isFinite(F.value);
    const ev = this.time.addEvent({ delay: 16, loop: true, callback: () => {
      t++;
      const p = Math.min(1, t / 70), e = 1 - Math.pow(1 - p, 3);
      if (inf) {
        const big = Math.round(Math.pow(10, e * 9)) * Math.sign(F.value);
        num.setText(p < 1 ? auraText(big) : auraText(F.value));
        if (p >= 1) { num.setScale(1.6); this.tweens.add({ targets: num, scale: 1, duration: 300, ease: 'Back.easeOut' }); this.cameras.main.flash(250, 255, 255, 255); Audio.play(F.value > 0 ? 'victory' : 'koSting'); }
      } else {
        num.setText(auraText(F.value * e));
        if (t % 4 === 0 && p < 1) Audio.play('coin', { minGap: 0.05, pitch: F.value >= 0 ? 1 + e * 0.5 : 1 - e * 0.4 });
      }
      if (p >= 1) { ev.remove(); this.tweens.add({ targets: lab, alpha: 1, duration: 300 }); }
    } });
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
    if (this.prevB) this.prevB.update();
    this.menu.update();
    if (this.apText && this.apCur !== this.apTarget) {
      const step = Math.max(1, Math.ceil(Math.abs(this.apTarget - this.apFrom) / 60));
      this.apCur = this.apCur < this.apTarget ? Math.min(this.apTarget, this.apCur + step) : Math.max(this.apTarget, this.apCur - step);
      this.apText.setText(this.apCur + ' AP');
      if (this.apCur % 5 === 0) Audio.play('coin', { minGap: 0.05 });
    }
    if (this.rankBar) {
      this.rankCur += (this.rankTarget - this.rankCur) * 0.05;
      const g = this.rankBar, y = this.rankBarY; g.clear();
      g.fillStyle(0x000000, 0.7); g.fillRoundedRect(890, y, 330, 12, 6);
      g.fillStyle(this.rankCol, 1); g.fillRoundedRect(890, y, 330 * Math.max(0.03, this.rankCur), 12, 6);
    }
  }
}
void rankFor;

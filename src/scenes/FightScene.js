import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio, FIGHT_TRACKS } from '../core/Audio.js';
import { BattleView } from '../view/BattleView.js';
import { ARENAS } from '../view/Arena.js';
import { buildBattle, pickArena, survivalWave, botProfile } from '../core/Match.js';
import { AIController } from '../sim/AI.js';
import { go, txt } from '../ui/UI.js';
import { Online } from '../net/Online.js';
import { finalAura } from '../data/progression.js';
import { MOVES } from '../sim/moves.js';

const DUMMY = { id: 'dummy', name: 'Muñeco de Prácticas', style: 'balanced', level: 3, accessory: 'none', color: '#d4a373', aura: '#ffffff', accent: '#8d5524', quote: '...', celebration: 'bow', scale: 1, maxAura: 1000, loadout: { special: 'sixSeven', specialF: 'fakeHandshake', specialD: 'siuuu', skill1: 'rizz', skill2: 'hitTheWoah', ult: 'sixSevenBarrage' } };

function snapJoints(f) {
  const j = f.joints; if (!j || j.hipX === undefined) return;
  const p = f._pj || (f._pj = {});
  for (const k in j) if (typeof j[k] === 'number') p[k] = j[k];
  f._px = f.x; f._py = f.y; f._pf = f.facing; f._pv = true;
}

export class FightScene extends Phaser.Scene {
  constructor() { super('Fight'); }
  init(data) { this.spec = { ...(data.spec || { mode: 'training' }) }; }
  create() {
    this.matchId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    if (this.scene.isActive('Demo') || this.scene.isPaused('Demo')) this.scene.stop('Demo');
    const spec = this.spec;
    const st = Save.d.settings;
    if (spec.mode === 'online') { this.createOnline(); return; }
    if (spec.mode === 'training') {
      spec.enemies = [DUMMY];
      spec.infiniteEnergy = spec.infiniteEnergy ?? true;
      spec.dummyMode = spec.dummyMode || 'stand';
      spec.arena = spec.arena || 'dojo';
    }
    if (spec.mode === 'survival') {
      spec.wave = spec.wave || 1;
      const w = survivalWave(spec.wave);
      spec.enemies = w.enemies; spec.levelOverride = w.level; spec.timer = 0;
      spec.arena = spec.arena || 'colosseum';
    }
    this.arenaId = pickArena(spec);
    spec.arena = this.arenaId;
    this.battle = buildBattle(spec);
    this.view = new BattleView(this, this.battle, { arena: this.arenaId, shake: st.shake, damageNumbers: st.damageNumbers, hitboxes: st.hitboxes || spec.hitboxes, quality: st.quality });
    const arenaDef = ARENAS.find(a => a.id === this.arenaId);
    const boss = spec.enemies.some(e => e.boss);
    Audio.music(spec.mode === 'survival' ? 'survival' : boss ? 'boss' : (arenaDef && arenaDef.music) || FIGHT_TRACKS[Math.floor(Math.random() * FIGHT_TRACKS.length)]);
    Audio.muffle(false);
    this.acc = 0;
    this.paused = false;
    this.ended = false;
    this.kos = 0;
    this.wave = spec.wave || 1;
    this.events.off('bev');
    this.events.on('bev', e => this.onBattleEvent(e));
    this.scene.launch('HUD', { fight: this });
    this.scene.bringToTop('HUD');
    this.pop = Input.push((a, code) => {
      if (this.paused || this.ended) return;
      if (code === 'Escape' || (this.spec.mode !== 'versus' && Input.codesFor('pause').includes(code))) this.pause();
    });
    this.events.once('shutdown', () => {
      if (this.pop) this.pop();
      if (this.view) this.view.destroy();
      this.scene.stop('HUD');
    });
    Input.clearPressed();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ---------------- ONLINE ----------------
  createOnline() {
    const st = Save.d.settings;
    const S = Online.session;
    this.online = true; this.session = S;
    this.battle = S.render;
    this.arenaId = this.spec.arena || S.cfg.arena;
    this.view = new BattleView(this, this.battle, { arena: this.arenaId, shake: st.shake, damageNumbers: st.damageNumbers, hitboxes: false, quality: st.quality });
    const arenaDef = ARENAS.find(a => a.id === this.arenaId);
    Audio.music((arenaDef && arenaDef.music) || 'fight1'); Audio.muffle(false);
    this.paused = false; this.ended = false; this.kos = 0; this.acc = 0;
    this.events.off('bev'); this.events.on('bev', e => this.onBattleEvent(e));
    this.scene.launch('HUD', { fight: this }); this.scene.bringToTop('HUD');
    // capa de avisos (rival desconectado, reconectando, abandonar)
    this.ovG = this.add.graphics().setScrollFactor(0).setDepth(950);
    this.ovT = txt(this, 640, 330, '', 34, '#ffffff', { ox: 0.5, oy: 0.5 }).setScrollFactor(0).setDepth(951);
    this.ovS = txt(this, 640, 380, '', 18, '#c9c3e6', { ox: 0.5, oy: 0.5, body: true }).setScrollFactor(0).setDepth(951);
    this.quitAsk = false;
    this.pop = Input.push((a, code) => {
      if (this.ended) return;
      if (code === 'Escape' && Online.net && Online.net.status === 'error') { Online.disconnect(); go(this, 'Menu'); return; }
      if (code === 'Escape') { this.quitAsk = !this.quitAsk; Audio.play('ui_move'); return; }
      if (this.quitAsk && (code === 'Enter' || code === 'NumpadEnter')) { this.quitAsk = false; Online.send({ type: 'leave' }); this.onlineLeft = true; }
    });
    this.offNet = Online.listen((type, m) => { if (type === 'end') this.onlineEnd(m); });
    this.events.once('shutdown', () => { if (this.pop) this.pop(); if (this.offNet) this.offNet(); if (this.view) this.view.destroy(); this.scene.stop('HUD'); });
    Input.clearPressed();
    this.cameras.main.fadeIn(300, 0, 0, 0);
    if (Online.lastEnd && Online.start && Online.lastEnd.matchId === Online.start.matchId) this.onlineEnd(Online.lastEnd);
  }
  updateOnline(delta) {
    Input.pollPad();
    if (Online.net) Online.net.pump();
    const S = this.session;
    if (!this.endingOnline) S.frame(delta, () => Input.readGame('solo'));
    else {
      // tras el final del servidor ya no llegan confirmaciones: la celebración se reproduce en local
      this.acc += Math.min(delta, 100);
      while (this.acc >= 16.667) { this.acc -= 16.667; this.battle.step({}); }
    }
    this.view.interp = 1;
    this.view.update(delta);
    // avisos
    const g = this.ovG; g.clear();
    let title = '', sub = '';
    const n = Online.net, P = Online.pause;
    if (n && n.status === 'reconnecting') { title = 'RECONECTANDO…'; sub = 'Se ha cortado tu conexión. Intentando volver a la partida.'; }
    else if (n && n.status === 'error') { title = 'SIN CONEXIÓN'; sub = (n.lastError || '') + ' · ESC para salir'; }
    else if (P && P.resuming) { title = 'REANUDANDO EN ' + Math.max(1, Math.ceil((P.inMs - (performance.now() - P.at)) / 1000)); sub = '¡Atento!'; }
    else if (P) { const left = Math.max(0, Math.ceil((P.timeout - (performance.now() - P.at)) / 1000)); title = P.who === S.you ? 'RECONECTANDO…' : 'RIVAL DESCONECTADO'; sub = `Esperando su vuelta: ${left} s. Si no vuelve, ganas por abandono.`; }
    else if (this.quitAsk) { title = '¿ABANDONAR LA PARTIDA?'; sub = 'ENTER abandonar (cuenta como derrota) · ESC seguir jugando'; }
    else if (this.onlineLeft && !this.ended) { title = 'SALIENDO…'; }
    this.ovT.setText(title); this.ovS.setText(sub);
    if (title) { g.fillStyle(0x000000, 0.6); g.fillRect(0, 280, 1280, 130); }
  }
  onlineEnd(m) {
    if (this.endingOnline) return;
    this.endingOnline = true; this.ended = true;
    // se deja terminar la celebración local (si el combate acabó por K.O.) antes de ir a resultados
    const wait = m.result.reason === 'ko' ? 2600 : 600;
    this.time.delayedCall(wait, () => go(this, 'Result', { spec: { mode: 'online' }, online: m }));
  }

  pause() {
    if (this.battle.phase === 'over') return;
    this.paused = true;
    Audio.muffle(true);
    Audio.play('ui_open');
    this.scene.pause('HUD');
    this.scene.launch('Pause', { fight: this });
    this.scene.bringToTop('Pause');
    this.scene.pause();
  }
  resume() {
    this.paused = false;
    Audio.muffle(false);
    Input.clearPressed();
    this.scene.resume('HUD');
    this.scene.resume();
  }

  onBattleEvent(e) {
    const b = this.battle;
    if (e.type === 'ko' && e.attacker && e.attacker.isHuman) this.kos = (this.kos || 0) + 1;
    if (e.type === 'victory') {
      this.view.celebrate(e.team);
      Audio.music('results');
      const win = this.spec.mode === 'versus' || e.team === b.player.team;
      Audio.play(win ? 'victory' : 'defeat');
    }
    if (e.type === 'matchEnd' && !this.ended && !this.online) this.finish(e.result);
    if (e.type === 'waveClear') this.nextWave();
  }

  nextWave() {
    const b = this.battle;
    this.wave++;
    this.events.emit('wave', this.wave);
    Audio.play('roundGong');
    const p = b.player;
    p.heal(p.maxAura * 0.25); p.gainEnergy(25);
    this.time.delayedCall(1500, () => {
      if (!p.alive || this.ended) return;
      const w = survivalWave(this.wave);
      if (w.boss) Audio.music('boss'); else Audio.music('survival');
      w.enemies.forEach((bot, i) => {
        b.addFighter({ team: 1, profile: botProfile(bot), loadout: bot.loadout, maxAura: bot.maxAura, controller: new AIController({ level: w.level, style: bot.style }) }, i);
      });
    });
  }

  finish(result) {
    this.ended = true;
    const spec = this.spec;
    if (spec.mode === 'versus') {
      // multijugador local: marcador de la sesión, sin progreso ni recompensas
      const score = [...(spec.score || [0, 0])];
      score[result.winnerTeam]++;
      const [a, b2] = this.battle.fighters;
      const vs = Save.d.versusStats || (Save.d.versusStats = { matches: 0, p1: 0, p2: 0 });
      vs.matches++; vs[result.winnerTeam === 0 ? 'p1' : 'p2']++; Save.save();
      const info = { winner: result.winnerTeam, rounds: result.rounds, frames: this.battle.frame, stats: [{ ...a.stats }, { ...b2.stats }], names: [a.name, b2.name], defeatAnim: [a.defeatAnim || 'kneel', b2.defeatAnim || 'kneel'], aura: [a.aura / a.maxAura, b2.aura / b2.maxAura] };
      // aura final de cada jugador (de -∞ a +∞)
      info.final = [a, b2].map((q, i) => { const o = i ? a : b2, won = result.winnerTeam === i; return finalAura({ stats: q.stats, opp: o.stats, win: won, perfect: won && (o.stats.dmg || 0) <= 0, shutout: !won && (q.stats.dmg || 0) <= 0, level: 4, finisher: !!q.stats.finisher }); });
      this.time.delayedCall(400, () => go(this, 'Result', { spec: { ...spec, score }, result, info, rewards: null }));
      return;
    }
    const p = this.battle.player;
    const info = {
      mode: spec.mode, win: result.win, level: spec.levelOverride ?? Math.max(...spec.enemies.map(e => e.level)),
      enemies: spec.enemies.length, perfect: result.perfect, maxCombo: p.stats.maxCombo, humiliations: p.stats.humiliations,
      boss: spec.enemies.some(e => e.boss), stats: p.stats, frames: this.battle.frame, waves: spec.mode === 'survival' ? this.wave - 1 : 0,
      charms: this.battle.charmsByPlayer || 0, kos: this.kos,
      defeatAnim: p.defeatAnim || 'kneel', matchId: this.matchId, replay: spec.mode === 'path' && !!(Save.d.path.cleared || {})[spec.stageId]
    };
    if (spec.mode === 'survival') info.win = false;
    info.final = finalAura({ stats: p.stats, win: info.win, perfect: !!result.perfect && info.win, shutout: !info.win && spec.mode !== 'survival' && (p.stats.dmg || 0) <= 0, level: info.level, finisher: !!p.stats.finisher, enemies: info.enemies });
    if (spec.mode === 'survival') info.final.value += (info.waves || 0) * 400;
    const rewards = spec.mode === 'training' ? null : Save.recordMatch(info);
    this.time.delayedCall(400, () => go(this, 'Result', { spec, result, info, rewards }));
  }

  update(time, delta) {
    if (this.online) { this.updateOnline(delta); return; }
    if (this.paused) return;
    Input.pollPad();
    const b = this.battle;
    const ts = b.slowmo > 0 ? b.slowScale : 1;
    this.acc += Math.min(delta, 100) * ts;
    let n = 0;
    while (this.acc >= 16.667 && n < 5) {
      // cada humano lee su propio perfil de teclas en el mismo paso: pulsaciones simultáneas sin conflictos
      const inputs = {};
      for (const f of b.fighters) if (f.isHuman && !f.controller) inputs[f.id] = Input.readGame(f.ctrlProfile);
      Input.clearPressed();
      // instantánea del paso anterior para interpolar el dibujo (cámara lenta y pantallas de >60 Hz fluidas)
      for (const f of b.fighters) snapJoints(f);
      b.step(inputs);
      if (b.slowmo > 0) b.slowmo--;
      this.acc -= 16.667; n++;
      if (this.spec.mode === 'training') this.trainingTick();
    }
    this.view.interp = Math.max(0, Math.min(1, this.acc / 16.667));
    this.view.update(delta);
  }

  trainingTick() {
    const b = this.battle;
    const p = b.player;
    for (const f of b.fighters) if (!f.isHuman && f.dummyCtrl) f.controller = f.dummyCtrl;
    if (p.infiniteEnergy) p.energy = 100;
    for (const k in p.cool) if (this.spec.noCooldowns) p.cool[k] = 0;
    void MOVES;
  }

  resetPositions() {
    const b = this.battle;
    for (const f of b.fighters) {
      f.x = f.startX; f.y = 600; f.vx = f.vy = 0; f.move = null; f.status.length = 0; f.grounded = true;
      f.aura = f.maxAura; f.alive = true; f.setState('idle'); f.facing = f.team === 0 ? 1 : -1; f.comboTaken = 0; f.juggle = 0;
    }
    b.projectiles.length = 0;
  }
}

import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio, FIGHT_TRACKS } from '../core/Audio.js';
import { BattleView } from '../view/BattleView.js';
import { ARENAS } from '../view/Arena.js';
import { buildBattle, pickArena, survivalWave, botProfile } from '../core/Match.js';
import { AIController } from '../sim/AI.js';
import { go } from '../ui/UI.js';
import { MOVES } from '../sim/moves.js';

const DUMMY = { id: 'dummy', name: 'Muñeco de Prácticas', style: 'balanced', level: 3, accessory: 'none', color: '#d4a373', aura: '#ffffff', accent: '#8d5524', quote: '...', celebration: 'bow', scale: 1, maxAura: 1000, loadout: { special: 'sixSeven', specialF: 'fakeHandshake', specialD: 'siuuu', skill1: 'rizz', skill2: 'hitTheWoah', ult: 'sixSevenBarrage' } };

export class FightScene extends Phaser.Scene {
  constructor() { super('Fight'); }
  init(data) { this.spec = { ...(data.spec || { mode: 'training' }) }; }
  create() {
    if (this.scene.isActive('Demo') || this.scene.isPaused('Demo')) this.scene.stop('Demo');
    const spec = this.spec;
    const st = Save.d.settings;
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
    this.wave = spec.wave || 1;
    this.events.on('bev', e => this.onBattleEvent(e));
    this.scene.launch('HUD', { fight: this });
    this.scene.bringToTop('HUD');
    this.pop = Input.push((a, code) => {
      if (this.paused || this.ended) return;
      if (Input.codesFor('pause').includes(code) || code === 'Escape') this.pause();
    });
    this.events.once('shutdown', () => {
      if (this.pop) this.pop();
      if (this.view) this.view.destroy();
      this.scene.stop('HUD');
    });
    Input.clearPressed();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  pause() {
    if (this.battle.phase === 'over') return;
    this.paused = true;
    Audio.muffle(true);
    Audio.play('ui_open');
    this.scene.pause('HUD');
    this.scene.launch('Pause', { fight: this });
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
    if (e.type === 'victory') {
      this.view.celebrate(e.team);
      Audio.music('results');
      const win = e.team === b.player.team;
      Audio.play(win ? 'victory' : 'defeat');
      if (this.spec.mode !== 'survival') Audio.announce(win ? (e.result.perfect ? 'Victoria perfecta' : 'Victoria') : 'Derrota');
    }
    if (e.type === 'matchEnd' && !this.ended) this.finish(e.result);
    if (e.type === 'waveClear') this.nextWave();
  }

  nextWave() {
    const b = this.battle;
    this.wave++;
    this.events.emit('wave', this.wave);
    Audio.announce('Oleada ' + this.wave);
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
    const p = this.battle.player;
    const info = {
      mode: spec.mode, win: result.win, level: spec.levelOverride ?? Math.max(...spec.enemies.map(e => e.level)),
      enemies: spec.enemies.length, perfect: result.perfect, maxCombo: p.stats.maxCombo, humiliations: p.stats.humiliations,
      boss: spec.enemies.some(e => e.boss), stats: p.stats, frames: this.battle.frame, waves: spec.mode === 'survival' ? this.wave - 1 : 0,
      charms: this.battle.charmsByPlayer || 0
    };
    if (spec.mode === 'survival') info.win = false;
    const rewards = spec.mode === 'training' ? null : Save.recordMatch(info);
    this.time.delayedCall(400, () => go(this, 'Result', { spec, result, info, rewards }));
  }

  update(time, delta) {
    if (this.paused) return;
    Input.pollPad();
    const b = this.battle;
    const ts = b.slowmo > 0 ? b.slowScale : 1;
    this.acc += Math.min(delta, 100) * ts;
    let n = 0;
    while (this.acc >= 16.667 && n < 5) {
      const inp = Input.readGame();
      b.step({ [b.player.id]: inp });
      if (b.slowmo > 0) b.slowmo--;
      this.acc -= 16.667; n++;
      if (this.spec.mode === 'training') this.trainingTick();
    }
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

import {
  GROUND_Y, WALL_L, WALL_R, GRAVITY, MAX_FALL, MAX_AURA, MAX_ENERGY, WALK_SPEED, BACK_SPEED, JUMP_VY, JUMP_VX,
  DASH_FRAMES, DASH_SPEED, DASH_IFRAMES, DASH_COOLDOWN, PARRY_WINDOW, PARRY_LOCKOUT, BUFFER_FRAMES, TURN_DELAY,
  BURST_COST, emptyInput, ACTIONS, RUN_SPEED
} from './constants.js';
import { makePose, copyPose, lerpPose, computeJoints, hurtboxFromJoints, BONES } from './skeleton.js';
import { POSES, MODS, evalKeyframes } from './poses.js';
import { STATUS, CONTROL_IMMUNITY } from './status.js';
import { MOVES } from './moves.js';
import { CELEBRATIONS, DEFEATS } from './celebrations.js';

let NEXT_ID = 1;

export class Fighter {
  constructor(battle, cfg) {
    this.b = battle;
    this.id = NEXT_ID++;
    this.slot = cfg.slot ?? 0;
    this.team = cfg.team;
    this.profile = cfg.profile;
    this.name = cfg.profile.name;
    this.scale = cfg.profile.scale || 1;
    this.boss = !!cfg.profile.boss;
    this.loadout = Object.assign({ special: 'sixSeven', specialF: 'fakeHandshake', specialD: 'siuuu', skill1: 'mewing', skill2: 'rizz', ult: 'sixSevenBarrage' }, cfg.loadout || {});
    this.maxAura = cfg.maxAura || MAX_AURA;
    this.aura = this.maxAura;
    this.energy = cfg.energy ?? 0;
    this.isHuman = !!cfg.human;
    this.finisher = cfg.finisher || null; // remate de K.O. equipado
    this.ctrlProfile = cfg.ctrlProfile || 'solo'; // perfil de teclas (1 jugador, J1 o J2)
    this.controller = cfg.controller || null;
    this.x = cfg.x ?? 600; this.y = GROUND_Y; this.vx = 0; this.vy = 0;
    this.facing = cfg.facing ?? 1;
    this.grounded = true;
    this.state = 'idle'; this.sf = 0;
    this.move = null;
    this.input = emptyInput();
    this.buffer = [];
    this.status = [];
    this.immune = {};
    this.cool = {};
    this.stale = [];
    this.hitstun = 0; this.blockstun = 0; this.kdTimer = 0;
    this.invuln = 0; this.invulnType = 'all';
    this.juggle = 0; this.comboTaken = 0;
    this.combo = { hits: 0, dmg: 0, t: 0 };
    this.parryUntil = -1; this.parryLock = 0;
    this.dashCd = 0; this.airDash = 1; this.airJump = 1;
    this.dashDir = 1;
    this.lastWhiff = -999; this.lastParry = -999; this.lastHitTaken = -999;
    this.lastSpecial = null;
    this.posHist = [];
    this.pose = makePose(POSES.idle);
    this.animKey = ''; this.blendFrom = makePose(POSES.idle); this.blendT = 1; this.blendDur = 1;
    this.animF = 0; this.walkPhase = 0;
    this.feet = { n: { x: 0, y: 0, planted: false, step: null }, f: { x: 0, y: 0, planted: false, step: null } };
    this.reactPose = 'hurt'; this.hitstunMax = 16; this.reactSpin = false; this.kdFace = false;
    this.contactHands = null; this.ovrHands = null; this.ovrFeet = null;
    this.joints = {}; this.hurt = { x: 0, y: 0, w: 0, h: 0 };
    this.squashX = 1; this.squashY = 1; this.flash = 0;
    this.turnT = 0;
    this.crouching = false; this.blocking = false; this.lowBlock = false;
    this.knockdownOnLand = false; this.wallBounce = false; this.groundBounce = false;
    this.lockedBy = null; this.lockPose = null;
    this.alive = true; this.koFrame = -1;
    this.usedOnce = {};
    this.target = null;
    this.hitFlashColor = 0xffffff;
    this.trail = 0; // frames con estela (motion blur)
    this.visible = true; this.alpha = 1;
    this.lastLand = 0;
    this.stats = { dmg: 0, hits: 0, maxCombo: 0, parries: 0, blocks: 0, humiliations: 0, specials: 0, ults: 0, taken: 0, whiffs: 0, dodges: 0, counters: 0 };
    this.infiniteEnergy = false; this.infiniteAura = false;
    this.dummyMode = null;
    this.update0();
  }

  update0() { this.solve(true); }

  // ---------- consultas ----------
  hasStatus(id) { for (const s of this.status) if (s.id === id) return s; return null; }
  get auraPct() { return this.aura / this.maxAura; }
  enemyOf(o) { return o.team !== this.team; }
  isAirborne() { return !this.grounded; }
  controlStatus() {
    for (const s of this.status) { const d = STATUS[s.id]; if (d && d.control) return s; }
    return null;
  }
  mult(key) {
    let m = 1;
    for (const s of this.status) { const d = STATUS[s.id]; if (d && d[key] !== undefined) m *= d[key]; }
    return m;
  }
  dmgMult() {
    let m = this.mult('dmg');
    const r = this.hasStatus('sigmaGrind'); if (r) m *= 1 + Math.min(0.25, (r.data.stacks || 0) * 0.05);
    return m;
  }
  defMult() { return this.mult('def'); }
  speedMult() {
    let m = this.mult('speed');
    if (this.b.domainAgainst(this)) m *= 0.75;
    const g = this.hasStatus('sigmaGrind'); if (g) m *= 1 + Math.min(0.2, (g.data.stacks || 0) * 0.04);
    return m;
  }
  isImmune(id) {
    if (this.immune[id] && this.immune[id] > this.b.frame) return true;
    for (const s of this.status) { const d = STATUS[s.id]; if (d && d.immune && d.immune.includes(id)) return true; }
    return false;
  }
  fwdHeld() { return this.facing === 1 ? this.input.r : this.input.l; }
  backHeld() { return this.facing === 1 ? this.input.l : this.input.r; }
  inNeutral() { return this.state === 'idle' || this.state === 'block'; }
  isAttacking() { return this.state === 'attack' && this.move && !this.move.def.taunt && !this.move.def.buffOnly; }
  movePhase() {
    if (!this.move) return null;
    const d = this.move.def, f = this.move.f;
    if (f < d.startup) return 'startup';
    if (f < d.startup + d.active) return 'active';
    return 'recovery';
  }

  // ---------- estados ----------
  setState(s) {
    // un movimiento solo existe en estado de ataque: si algo externo nos saca de él, se cancela (y se suelta la llave)
    if (this.move && INTERRUPT.has(s)) { if (this.move.lock) this.b.releaseLock(this, this.move.lock, true); this.move = null; }
    this.state = s; this.sf = 0;
  }

  addStatus(id, frames, data = {}, from = null) {
    const def = STATUS[id];
    if (!def) return null;
    if (!def.buff && this.isImmune(id)) return null;
    if (def.control && this.immune['control'] > this.b.frame) return null;
    if (this.b.timeStopFor(this) && def.control) frames += 0;
    let s = this.hasStatus(id);
    if (s) { s.t = Math.max(s.t, frames); Object.assign(s.data, data); s.from = from || s.from; return s; }
    s = { id, t: frames, max: frames, data, from };
    this.status.push(s);
    if (id === 'charmed' && from && from.isHuman) this.b.charmsByPlayer = (this.b.charmsByPlayer || 0) + 1;
    if (def.control) { this.move = null; if (this.state === 'attack' || this.state === 'block' || this.state === 'dash') this.setState('idle'); }
    this.b.emit('status', { f: this, id, frames });
    return s;
  }
  removeStatus(id) {
    const i = this.status.findIndex(s => s.id === id);
    if (i >= 0) {
      const s = this.status[i];
      this.status.splice(i, 1);
      const d = STATUS[id];
      if (d && d.control) this.immune['control'] = this.b.frame + CONTROL_IMMUNITY;
      if (d && d.onEnd) d.onEnd(this, this.b, s);
      if (s.data.onEnd) s.data.onEnd(this, this.b, s);
    }
  }
  breakControl() {
    for (const s of [...this.status]) { const d = STATUS[s.id]; if (d.control && s.id !== 'frozen') this.removeStatus(s.id); }
  }

  gainEnergy(v) {
    if (v > 0) v *= this.mult('energyMult');
    this.energy = Math.max(0, Math.min(MAX_ENERGY, this.energy + v));
  }
  heal(v) { this.aura = Math.min(this.maxAura, this.aura + v); }

  // ---------- entrada ----------
  readInput(inp) {
    const prev = this.input;
    this.input = inp;
    if (this.hasStatus('inverted')) { const l = inp.l; inp.l = inp.r; inp.r = l; }
    const f = this.b.frame;
    for (const a of ACTIONS) {
      if (inp.pressed[a]) this.buffer.push({ a, fwd: this.fwdHeld(), back: this.backHeld(), down: inp.d, up: inp.u, t: f });
    }
    if (inp.pressed.block) {
      if (this.parryLock <= 0) { this.parryUntil = f + PARRY_WINDOW; this.parryLock = PARRY_LOCKOUT; }
    }
    if (inp.pu) this.buffer.push({ a: 'jump', fwd: this.fwdHeld(), back: this.backHeld(), t: f });
    while (this.buffer.length && f - this.buffer[0].t > BUFFER_FRAMES) this.buffer.shift();
    void prev;
  }

  takeBuffered(filter) {
    for (let i = 0; i < this.buffer.length; i++) {
      const e = this.buffer[i];
      if (!filter || filter(e)) { this.buffer.splice(i, 1); return e; }
    }
    return null;
  }

  // ---------- resolución de movimientos ----------
  moveIdFor(e) {
    const a = e.a;
    const dash = this.state === 'dash' && this.sf > 3;
    if (a === 'light') {
      if (dash) return 'dashAttack';
      if (!this.grounded) return 'airKick';
      if (e.down) return 'lowKick';
      return 'jab';
    }
    if (a === 'heavy') {
      if (dash) return 'dashAttack';
      if (!this.grounded) return 'diveKick';
      if (e.down) return 'uppercut';
      if (e.fwd) return 'lunge';
      if (e.back) return 'sweep';
      return 'roundhouse';
    }
    if (a === 'special') return e.fwd ? this.loadout.specialF : e.down ? this.loadout.specialD : this.loadout.special;
    if (a === 'skill1') return this.loadout.skill1;
    if (a === 'skill2') return this.loadout.skill2;
    if (a === 'ult') return this.loadout.ult;
    return null;
  }

  costOf(def) {
    let c = def.cost || 0;
    if (c && this.hasStatus('cooking') && def.slot !== 'basic') c *= 0.5;
    return c;
  }

  canUse(def, silentFail) {
    if (!def) return false;
    if (def.slot !== 'basic' && this.hasStatus('silenced')) { if (!silentFail) this.b.emit('deny', { f: this, reason: 'SILENCIADO' }); return false; }
    if ((this.cool[def.id] || 0) > 0) return false;
    if (!this.infiniteEnergy && this.energy < this.costOf(def)) { if (!silentFail && def.slot !== 'basic') this.b.emit('deny', { f: this, reason: 'SIN ENERGÍA' }); return false; }
    const air = !this.grounded;
    if (air && !def.air) return false;
    if (!air && def.air === 'only') return false;
    if (def.cond && !def.cond(this, this.b)) { if (!silentFail) this.b.emit('deny', { f: this, reason: def.condText || 'NO DISPONIBLE' }); return false; }
    if (def.once && this.usedOnce[def.id]) { if (!silentFail) this.b.emit('deny', { f: this, reason: 'YA USADO' }); return false; }
    return true;
  }

  startMove(id, opts = {}) {
    const def = MOVES[id];
    if (!def) return false;
    if (!opts.free && !this.canUse(def, opts.silent)) return false;
    if (!opts.free) {
      if (!this.infiniteEnergy) this.energy -= this.costOf(def);
      if (def.cd) this.cool[def.id] = def.cd;
      if (def.once) this.usedOnce[def.id] = true;
    }
    if (def.slot !== 'basic' && def.slot !== 'ult') { this.lastSpecial = def.id; this.stats.specials++; }
    if (def.slot === 'ult') this.stats.ults++;
    this.stale.push(def.id); if (this.stale.length > 8) this.stale.shift();
    this.move = { def, f: 0, hitIds: new Set(), hit: false, blocked: false, lock: null, data: {}, hitCount: 0, charge: 0, staleK: this.staleFactor(def.id) };
    this.setState('attack');
    if (def.keepVel !== true && this.grounded) this.vx = 0;
    if (def.cine) this.b.superFreeze(this, def);
    this.b.emit('move', { f: this, def });
    if (def.on && def.on.start) def.on.start(this, this.b, this.move);
    if (this.hasStatus('cooking') && def.slot !== 'basic' && def.slot !== undefined && !def.buffOnly && def.id !== 'letHimCook') {
      this.move.data.cooked = true; this.removeStatus('cooking');
    }
    return true;
  }

  staleFactor(id) {
    let n = 0;
    for (const s of this.stale) if (s === id) n++;
    const basic = MOVES[id] && MOVES[id].slot === 'basic';
    return Math.max(0.5, 1 - n * (basic ? 0.035 : 0.08));
  }

  endMove() {
    const m = this.move;
    if (m) {
      if (m.def.hit && !m.hit && !m.blocked && !m.def.taunt) { this.lastWhiff = this.b.frame; this.stats.whiffs++; }
      if (m.def.on && m.def.on.end) m.def.on.end(this, this.b, m);
      if (m.lock) this.b.releaseLock(this, m.lock, true);
    }
    this.move = null;
    this.setState(this.grounded ? 'idle' : 'air');
  }

  // ---------- bucle principal ----------
  update() {
    const b = this.b;
    this.sf++;
    this.animF++;
    if (this.dashCd > 0) this.dashCd--;
    if (this.parryLock > 0) this.parryLock--;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    if (this.trail > 0) this.trail--;
    for (const k in this.cool) if (this.cool[k] > 0) this.cool[k]--;
    this.squashX += (1 - this.squashX) * 0.2; this.squashY += (1 - this.squashY) * 0.2;
    if (this.combo.t > 0 && --this.combo.t === 0) this.combo.hits = 0, this.combo.dmg = 0;
    this.posHist.push(this.x); if (this.posHist.length > 60) this.posHist.shift();

    this.tickStatus();
    if (this.alive && this.b.phase === 'fight') this.gainEnergy(0.022);
    if (!this.alive) { this.physics(); this.animate(); return; }

    if (this.state === 'locked') { this.animate(); return; }

    const ctrl = this.controlStatus();
    switch (this.state) {
      case 'intro':
        // entrada: camina hasta su posición (los jefes caen del cielo)
        if (this.startX !== undefined && this.grounded) this.vx = Math.abs(this.startX - this.x) > 2 ? Math.sign(this.startX - this.x) * Math.min(3, Math.abs(this.startX - this.x) * 0.08) : 0;
        if (this.sf > 100) this.setState('idle');
        break;
      case 'win': case 'lose': this.vx *= 0.8; break;
      case 'idle': case 'block': ctrl ? this.controlled(ctrl) : this.neutral(); break;
      case 'air': ctrl ? null : this.airborne(); break;
      case 'dash': this.dashing(); break;
      case 'run': ctrl ? this.setState('idle') : this.running(); break;
      case 'attack': this.attacking(); break;
      case 'blockstun': if (--this.blockstun <= 0) this.setState('idle'); this.vx *= 0.85; break;
      case 'hitstun':
        this.vx *= 0.86;
        this.tryBurst();
        if (--this.hitstun <= 0) { this.setState('idle'); this.comboTaken = 0; this.juggle = 0; }
        break;
      case 'airhit': this.tryBurst(); break;
      case 'knockdown':
        this.vx *= 0.8;
        if (--this.kdTimer <= 0) { this.setState('getup'); this.invuln = 22; }
        else if (this.sf === 6 && this.input.held.dash) { this.setState('getup'); this.invuln = 18; this.vx = -this.facing * 6; }
        break;
      case 'getup': if (this.sf > 16) { this.setState('idle'); this.comboTaken = 0; this.juggle = 0; } break;
      case 'ko': break;
    }
    this.physics();
    this.updateFacing();
    this.animate();
  }

  tickStatus() {
    const b = this.b;
    for (let i = this.status.length - 1; i >= 0; i--) {
      const s = this.status[i];
      const d = STATUS[s.id];
      if (d.regen && this.alive) this.heal(d.regen);
      if (d.regenIdle && this.alive && b.frame - this.lastHitTaken > 60) this.heal(d.regenIdle);
      if (d.energyRegen) this.gainEnergy(d.energyRegen);
      if (s.data.tick) s.data.tick(this, b, s);
      if (--s.t <= 0) this.removeStatus(s.id);
    }
  }

  tryBurst() {
    if (this.energy < BURST_COST || this.lockedBy) return;
    const i = this.buffer.findIndex(e => e.a === 'dash');
    const j = this.buffer.findIndex(e => e.a === 'block');
    if (i >= 0 && j >= 0 && Math.abs(this.buffer[i].t - this.buffer[j].t) <= 4) {
      this.buffer.length = 0;
      this.energy -= BURST_COST;
      this.hitstun = 0; this.comboTaken = 0; this.juggle = 0;
      this.invuln = 20; this.invulnType = 'all';
      this.b.auraBurst(this);
      this.setState(this.grounded ? 'idle' : 'air');
    }
  }

  controlled(s) {
    const d = STATUS[s.id];
    const src = s.from;
    this.blocking = false; this.crouching = false;
    const sp = 1.6;
    if (d.control === 'charm' && src) { const dir = Math.sign(src.x - this.x) || 1; this.vx = dir * sp; this.facing = dir; }
    else if (d.control === 'fear' && src) { const dir = Math.sign(this.x - src.x) || 1; this.vx = dir * 2.2; this.facing = -dir; }
    else this.vx *= 0.7;
    this.buffer.length = 0;
  }

  neutral() {
    const inp = this.input;
    const b = this.b;
    const rooted = !!this.hasStatus('rooted');
    this.crouching = inp.d && this.grounded;
    this.blocking = inp.held.block;
    this.lowBlock = this.blocking && this.crouching;
    this.state = this.blocking ? 'block' : 'idle';
    // acciones bufferizadas
    const e = this.takeBuffered(x => x.a !== 'block');
    if (e) {
      if (e.a === 'jump' && !rooted) { this.doJump(e); return; }
      if (e.a === 'dash' && !rooted) { if (this.dashCd <= 0) { this.doDash(e); return; } }
      else if (e.a !== 'jump' && e.a !== 'dash') {
        const id = this.moveIdFor(e);
        if (id && this.startMove(id)) return;
      }
    }
    if (inp.u && !rooted && !this.blocking) { this.doJump({ fwd: this.fwdHeld(), back: this.backHeld() }); return; }
    if (this.blocking || this.crouching || rooted) { this.vx *= 0.6; return; }
    const sp = this.speedMult();
    if (this.fwdHeld()) this.vx = this.facing * WALK_SPEED * sp;
    else if (this.backHeld()) this.vx = -this.facing * BACK_SPEED * sp;
    else this.vx *= 0.6;
    // doble toque hacia delante = correr
    const fwd = this.fwdHeld();
    if (fwd && !this.prevFwd) {
      if (b.frame - (this.lastFwdTap || -99) < 14) { this.setState('run'); this.b.emit('run', { f: this }); }
      this.lastFwdTap = b.frame;
    }
    this.prevFwd = fwd;
  }

  running() {
    const inp = this.input;
    this.prevFwd = this.fwdHeld();
    const e = this.takeBuffered(x => x.a !== 'block');
    if (e) {
      if (e.a === 'jump') { this.doJump({ fwd: true }); this.vx *= 1.35; return; }
      if (e.a === 'dash') { if (this.dashCd <= 0) { this.doDash({ fwd: true }); return; } }
      else {
        const id = e.a === 'light' || e.a === 'heavy' ? 'dashAttack' : this.moveIdFor(e);
        if (id && this.startMove(id)) return;
      }
    }
    if (!this.fwdHeld() || inp.held.block || inp.d) { this.setState('idle'); this.b.emit('skid', { f: this }); return; }
    if (inp.u) { this.doJump({ fwd: true }); this.vx *= 1.35; return; }
    this.vx = this.facing * RUN_SPEED * this.speedMult();
  }

  doJump(e) {
    this.grounded = false;
    this.vy = JUMP_VY;
    const dir = e.fwd ? 1 : e.back ? -1 : 0;
    this.vx = dir * this.facing * JUMP_VX * this.speedMult();
    this.setState('air');
    this.squashX = 0.85; this.squashY = 1.18;
    this.airJump = 1; this.airDash = 1;
    this.b.emit('jump', { f: this });
  }

  doDash(e) {
    const fwd = e.fwd;
    this.dashDir = fwd ? 1 : -1;
    this.setState('dash');
    this.dashCd = Math.round(DASH_COOLDOWN * (this.hasStatus('speedrun') ? 0.5 : 1));
    this.trail = DASH_FRAMES;
    this.b.emit('dash', { f: this, dir: this.dashDir });
  }

  dashing() {
    const f = this.sf;
    const sp = DASH_SPEED * this.speedMult() * (this.dashDir > 0 ? 1 : 0.9);
    const k = f < DASH_FRAMES - 4 ? 1 : 0.5;
    this.vx = this.facing * this.dashDir * sp * k;
    if (!this.grounded) this.vy = Math.min(this.vy, 1);
    if (f >= DASH_IFRAMES[0] && f <= DASH_IFRAMES[1]) { this.invuln = Math.max(this.invuln, 1); this.invulnType = 'all'; }
    if (f > 3) {
      const e = this.takeBuffered(x => x.a === 'light' || x.a === 'heavy' || x.a === 'special' || x.a === 'skill1' || x.a === 'skill2' || x.a === 'ult');
      if (e) { const id = this.moveIdFor(e); if (id && this.startMove(id)) return; }
    }
    if (f >= DASH_FRAMES) this.setState(this.grounded ? 'idle' : 'air');
  }

  airborne() {
    const e = this.takeBuffered(x => x.a !== 'block');
    if (e) {
      if (e.a === 'jump' && this.airJump > 0) {
        this.airJump--; this.vy = JUMP_VY * 0.85;
        const dir = e.fwd ? 1 : e.back ? -1 : 0;
        if (dir) this.vx = dir * this.facing * JUMP_VX;
        this.squashY = 1.15; this.b.emit('jump', { f: this, double: true });
        return;
      }
      if (e.a === 'dash' && this.airDash > 0) {
        this.airDash--; this.dashDir = e.back ? -1 : 1; this.setState('dash'); this.vy = 0; this.trail = 12;
        this.b.emit('dash', { f: this, dir: this.dashDir, air: true });
        return;
      }
      const id = this.moveIdFor(e);
      if (id && this.startMove(id)) return;
    }
    // control aéreo ligero
    const ax = this.input.r ? 0.25 : this.input.l ? -0.25 : 0;
    this.vx = Math.max(-JUMP_VX * 1.1, Math.min(JUMP_VX * 1.1, this.vx + ax));
  }

  attacking() {
    const m = this.move;
    if (!m) { this.setState(this.grounded ? 'idle' : 'air'); return; }
    const d = m.def;
    const b = this.b;
    if (m.lock) { this.runLock(m); return; }
    m.f++;
    const f = m.f;
    // carga (mantener botón)
    if (d.charge && f === d.charge.at && m.charge < d.charge.max && this.input.held[d.charge.btn || this.heldButtonFor(d)]) {
      m.charge++; m.f--; this.b.emit('charge', { f: this, t: m.charge / d.charge.max });
    }
    if (d.motion) {
      for (const mo of d.motion) {
        if (f >= mo[0] && f < mo[1]) {
          this.vx = this.facing * mo[2] * (d.speedScaled ? this.speedMult() : 1);
          if (mo[3] !== undefined) { this.vy = mo[3]; if (mo[3] < 0) this.grounded = false; }
        }
      }
    }
    if (d.invuln && f >= d.invuln[0] && f <= d.invuln[1]) { this.invuln = Math.max(this.invuln, 1); this.invulnType = d.invulnType || 'all'; }
    if (d.on && d.on.frame) d.on.frame(this, b, m, f);
    if (!this.move || this.move !== m) return; // el hook pudo cambiar el movimiento
    if (d.proj && (Array.isArray(d.proj.at) ? d.proj.at.includes(f) : f === d.proj.at)) b.spawnMoveProjectile(this, d, m);
    if (f === d.startup && d.on && d.on.active) d.on.active(this, b, m);
    if (!this.move || this.move !== m) return;
    // multi-hit: reinicia la lista de impactados
    if (d.hit && d.hit.every && f > d.startup && (f - d.startup) % d.hit.every === 0) m.hitIds.clear();
    // cancelaciones
    if (this.tryCancel(m)) return;
    let total = d.startup + d.active + d.recovery;
    const rmul = this.mult('recovery');
    if (rmul !== 1) total = d.startup + d.active + Math.round(d.recovery * rmul);
    if (d.untilLand && !this.grounded) total = Math.max(total, f + 1);
    if (f >= total) this.endMove();
  }

  heldButtonFor(def) {
    for (const k of ['special', 'skill1', 'skill2']) {
      if (k === 'special' && (this.loadout.special === def.id || this.loadout.specialF === def.id || this.loadout.specialD === def.id)) return k;
      if (this.loadout[k] === def.id) return k;
    }
    return 'special';
  }

  tryCancel(m) {
    const d = m.def;
    const f = m.f;
    // Emote Cancel: cancela cualquier ataque propio
    const ec = this.buffer.findIndex(e => this.moveIdFor(e) === 'emoteCancel');
    if (ec >= 0 && d.id !== 'emoteCancel' && d.slot !== 'ult' && f > 1) {
      if (this.canUse(MOVES.emoteCancel, true)) { this.buffer.splice(ec, 1); this.startMove('emoteCancel', { cancel: d.id }); return true; }
    }
    if (!(m.hit || m.blocked)) return false;
    // cadena de básicos
    if (d.chain && f > d.startup) {
      const e = this.takeBuffered(x => x.a === 'light' && !x.down);
      if (e) { this.startMove(d.chain, { free: true }); return true; }
    }
    // salto cancelable (lanzadores)
    if (d.jumpCancel && m.hit && f > d.startup + 1) {
      const e = this.takeBuffered(x => x.a === 'jump');
      if (e) { this.move = null; this.doJump(e); this.vy = JUMP_VY * 1.05; return true; }
    }
    // básicos -> especiales
    if (d.slot === 'basic' && f > d.startup) {
      const e = this.takeBuffered(x => x.a === 'special' || x.a === 'skill1' || x.a === 'skill2' || x.a === 'ult' || (x.a === 'heavy' && d.weight === 'light'));
      if (e) {
        const id = this.moveIdFor(e);
        const nd = MOVES[id];
        if (nd && nd.id !== d.id && this.canUse(nd, true)) { this.startMove(id); return true; }
        this.buffer.unshift(e);
      }
    }
    return false;
  }

  runLock(m) {
    const L = m.lock;
    L.f++;
    const t = L.target;
    const spec = L.spec;
    if (!t.alive && !spec.allowKO) { this.b.releaseLock(this, L, true); this.endMove(); return; }
    const off = spec.off || [60, 0];
    const ox = typeof off[0] === 'function' ? off[0](L.f) : off[0];
    const oy = typeof off[1] === 'function' ? off[1](L.f) : off[1];
    // el agarrado se desliza a su sitio (sin teletransporte)
    let tx = this.x + this.facing * ox * this.scale;
    const ty = Math.min(GROUND_Y, this.y + oy);
    // en la esquina, el agarrado no atraviesa la pared: es el atacante el que retrocede
    const cx = Math.max(WALL_L, Math.min(WALL_R, tx));
    if (cx !== tx) { this.x = Math.max(WALL_L, Math.min(WALL_R, this.x - (tx - cx))); tx = cx; }
    const k = L.f < 10 ? 0.3 : 0.6;
    t.x += (tx - t.x) * k; t.y += (ty - t.y) * k;
    t.facing = -this.facing;
    t.lockPose = spec.tpose ? (typeof spec.tpose === 'function' ? spec.tpose(L.f) : spec.tpose) : 'held';
    if (t.lockReact && t.lockReact.until > L.f) t.lockPose = t.lockReact.pose;
    t.contactHands = spec.thands ? spec.thands(this, t, L.f, this.b) : null;
    if (spec.hits) for (const h of spec.hits) if (h.f === L.f) this.b.lockHit(this, t, h, m);
    if (spec.frame) spec.frame(this, this.b, m, L.f, t);
    if (!this.move || this.move.lock !== L) return;
    if (L.f >= spec.frames) {
      this.b.releaseLock(this, L, false);
      m.lock = null;
      m.f = m.def.startup + m.def.active; // pasa a recuperación
      if (spec.recovery !== undefined) m.f = m.def.startup + m.def.active + m.def.recovery - spec.recovery;
    }
  }

  // ---------- física ----------
  physics() {
    if (this.state === 'locked') return;
    // patada espacial: sale disparado hacia arriba hasta perderse entre las estrellas
    if (this.toSpace) { this.vy = Math.min(this.vy, -26); this.y += this.vy; this.x += this.vx * 0.3; if (this.y < GROUND_Y - 2600) { this.visible = false; this.vy = 0; } return; }
    const b = this.b;
    if (!this.grounded) {
      const g = this.move && this.move.def.gravity !== undefined ? this.move.def.gravity : 1;
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * g);
    }
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < WALL_L || this.x > WALL_R) {
      const side = this.x < WALL_L ? 1 : -1;
      this.x = Math.max(WALL_L, Math.min(WALL_R, this.x));
      if (this.state === 'airhit' && this.wallBounce) {
        this.wallBounce = false; this.vx = side * 5; this.vy = -8; this.b.emit('wallbounce', { f: this });
      } else if (this.state === 'airhit' || this.state === 'hitstun') this.vx = 0;
    }
    if (this.y >= GROUND_Y) {
      this.y = GROUND_Y;
      if (!this.grounded) this.land();
      this.vy = 0;
    } else if (this.y < GROUND_Y - 0.5) {
      if (this.grounded && this.vy >= 0 && this.state !== 'attack') this.y = GROUND_Y;
      else this.grounded = false;
    }
  }

  land() {
    const prevVy = this.vy;
    this.grounded = true; this.airJump = 1; this.airDash = 1;
    this.lastLand = this.b.frame;
    if (this.state === 'airhit') {
      if (this.groundBounce) { this.groundBounce = false; this.grounded = false; this.vy = -9; this.y = GROUND_Y - 1; this.b.emit('groundbounce', { f: this }); return; }
      if (!this.alive) { this.vx *= 0.4; this.setState('ko'); this.b.emit('land', { f: this, heavy: true }); return; }
      if (this.knockdownOnLand || this.juggle > 0) {
        this.setState('knockdown'); this.kdTimer = 38; this.knockdownOnLand = false; this.vx *= 0.4;
        this.b.emit('land', { f: this, heavy: true });
      } else { this.setState('hitstun'); this.hitstun = 6; }
      return;
    }
    if (this.state === 'ko') return;
    if (this.state === 'intro') { this.squashX = 1.25; this.squashY = 0.75; this.b.emit('land', { f: this, heavy: prevVy > 12 }); if (prevVy > 12) this.b.emit('bossLand', { f: this }); this.vx = 0; return; }
    if (this.state === 'attack' && this.move) {
      const d = this.move.def;
      if (d.on && d.on.land) { d.on.land(this, this.b, this.move); return; }
      if (d.air) { this.move = null; this.setState('idle'); }
    } else if (this.state === 'air' || this.state === 'dash') {
      this.setState('idle');
    }
    if (prevVy > 6) { this.squashX = 1.18; this.squashY = 0.82; this.b.emit('land', { f: this }); }
    this.vx *= 0.5;
  }

  updateFacing() {
    const t = this.b.targetFor(this);
    this.target = t;
    if (!t) return;
    const free = this.state === 'idle' || this.state === 'block' || (this.state === 'air' && this.sf < 2) || this.state === 'getup';
    if (!free || this.controlStatus()) { this.turnT = 0; return; }
    const want = t.x >= this.x ? 1 : -1;
    if (want !== this.facing && Math.abs(t.x - this.x) > 4) {
      if (++this.turnT >= TURN_DELAY) { this.facing = want; this.turnT = 0; }
    } else this.turnT = 0;
  }

  // ---------- animación ----------
  animTarget(out) {
    const st = this.state;
    const f = this.animF;
    const ctrl = this.controlStatus();
    if (st === 'attack' && this.move) {
      const m = this.move, d = m.def;
      let key = 'm:' + d.id;
      if (m.lock && m.lock.spec.anim) { evalAnim(m.lock.spec.anim, m.lock.f, out); this.applyMods(m.lock.spec.mods, m.lock.f, out); key += ':lock'; }
      else { evalAnim(d.anim, m.f, out); this.applyMods(d.mods, m.f, out); }
      if (d.face) out.face = d.face;
      return key;
    }
    if (st === 'locked') {
      const lp = POSES[this.lockPose] || POSES.held;
      copyPose(lp, out); MODS.tremble(out, f);
      return 'locked:' + this.lockPose;
    }
    if (ctrl && (st === 'idle' || st === 'block')) {
      const c = STATUS[ctrl.id].control;
      if (c === 'charm') { copyPose(POSES.charmed, out); MODS.bob(out, f); }
      else if (c === 'fear') { copyPose(POSES.scared, out); MODS.scared(out, f); }
      else if (c === 'dance') { copyPose(POSES.danced, out); MODS.dance(out, f); out.face = 'blank'; }
      else if (c === 'freeze') copyPose(POSES.frozen, out);
      else { copyPose(POSES.dizzy, out); MODS.dizzy(out, f); }
      return 'ctrl:' + ctrl.id;
    }
    switch (st) {
      case 'idle': {
        if (this.crouching) { copyPose(POSES.crouch, out); MODS.breathe(out, f); return 'crouch'; }
        const near = this.target && Math.abs(this.target.x - this.x) < 560;
        const walking = Math.abs(this.vx) > 0.6 && this.grounded;
        let base = near ? POSES.guard : POSES.idle, k = near ? 'g' : 'i';
        if (this.hasStatus('chill')) { base = POSES.pockets; k = 'p'; }
        else if (this.hasStatus('npc')) { base = POSES.npc; k = 'n'; }
        else if (this.hasStatus('auraWalk') || this.hasStatus('snapAura')) { base = POSES.snapWalk; k = 's'; }
        copyPose(base, out);
        if (walking) {
          const back = Math.sign(this.vx) !== this.facing;
          if (k === 'n') MODS.robot(out, this.walkPhase * 2);
          else if (k === 's') MODS.snapAlt(out, this.walkPhase);
          else if (k === 'p') out.lean -= 2;
          else { out.lean += back ? -4 : 3; out.hip[1] += 2; const s = Math.sin(this.walkPhase * 0.5); out.hn[0] += s * 3; out.hf[0] -= s * 3; }
        } else MODS.breathe(out, f);
        if (this.hasStatus('mewing') || this.hasStatus('infMewing')) out.face = 'mew';
        if (this.auraPct < 0.25 && out.face === 'normal') out.face = 'hurt';
        return 'idle:' + k + (walking ? 'w' : '');
      }
      case 'run': {
        copyPose(POSES.run, out);
        const s = Math.sin(this.walkPhase * 0.42);
        out.hn[0] = 6 + s * 30; out.hn[1] = 12 - Math.abs(s) * 10; out.hf[0] = 4 - s * 30; out.hf[1] = 14 - Math.abs(s) * 10;
        out.hip[1] = -72 + Math.abs(Math.cos(this.walkPhase * 0.42)) * 4;
        return 'run';
      }
      case 'block': copyPose(this.lowBlock ? POSES.lowBlock : POSES.block, out); return this.lowBlock ? 'lowblock' : 'block';
      case 'blockstun': copyPose(this.lowBlock ? POSES.lowBlock : POSES.block, out); out.hip[0] -= 4; out.lean -= 4; MODS.tremble(out, f); return 'blockstun';
      case 'air': {
        const rising = this.vy < 0;
        copyPose(rising ? POSES.jump : POSES.fall, out);
        if (this.airJump === 0 && rising) MODS.spin(out, this.sf * 1.3);
        if (!rising && this.y > GROUND_Y - 60) { out.fn[1] = 0; out.ff[1] = -4; out.hip[1] = -70; }
        return rising ? 'jump' : 'fall';
      }
      case 'dash': copyPose(this.dashDir > 0 ? POSES.dash : POSES.backdash, out); return 'dash' + this.dashDir;
      case 'hitstun': {
        const r = POSES[this.reactPose] || POSES.hurt;
        const max = this.hitstunMax || 16;
        const k = Math.max(0, Math.min(1, (this.sf - max * 0.45) / (max * 0.55)));
        // latigazo inicial y recuperación hacia la guardia
        lerpPose(r, POSES.guard, k * k, out);
        if (this.sf < 4) { out.head += (this.reactPose === 'slapped' ? -12 : -6) * (1 - this.sf / 4); out.hip[0] -= 3; }
        if (this.reactSpin) out.spin = Math.min(360, this.sf * 30);
        return 'hit' + (this.hitSeq || 0);
      }
      case 'airhit': {
        const big = this.vy < -10 || this.juggle > 2;
        copyPose(big ? POSES.tumble : POSES.airHurt, out);
        out.lean += -Math.max(-30, Math.min(40, this.vy * 3));
        if (this.reactSpin) out.spin = (this.sf * 26) % 360;
        return 'airhit';
      }
      case 'knockdown': {
        copyPose(this.kdFace ? POSES.lyingFace : POSES.lying, out);
        if (this.sf < 6) out.hip[1] -= (6 - this.sf) * 2.5; // rebote al caer
        if (this.sf > 20) out.face = 'hurt';
        return 'kd';
      }
      case 'getup': {
        evalAnim([[0, this.kdFace ? 'lyingFace' : 'lying'], [7, 'getup', 'out'], [16, 'guard', 'inOut']], this.sf, out);
        return 'getup';
      }
      case 'ko': {
        if (this.grounded) { copyPose(this.kdFace ? POSES.lyingFace : POSES.lying, out); if (this.sf < 8) out.hip[1] -= (8 - this.sf) * 2; }
        else { copyPose(POSES.ko, out); out.lean -= this.sf * 4; }
        out.face = 'ko';
        return 'ko';
      }
      case 'win': {
        const c = CELEBRATIONS[this.profile.celebration] || CELEBRATIONS.flex;
        playCelebration(c, this.sf, out);
        return 'win';
      }
      case 'lose': {
        playCelebration(DEFEATS[this.defeatAnim || 'kneel'] || DEFEATS.kneel, this.sf, out);
        return 'lose';
      }
      case 'intro':
        if (!this.grounded) { copyPose(POSES.fall, out); return 'introAir'; }
        if (this.lastLand && this.b.frame - this.lastLand < 30) { copyPose(POSES.heroLand, out); return 'introLand'; }
        copyPose(POSES.strut, out);
        if (Math.abs(this.vx) > 0.3) MODS.strutArms(out, this.walkPhase); else MODS.breathe(out, f);
        return 'intro';
    }
    copyPose(POSES.idle, out);
    return 'x';
  }

  applyMods(mods, f, out) {
    if (!mods) return;
    for (const m of mods) if (f >= m[0] && f < m[1] && MODS[m[2]]) MODS[m[2]](out, f - m[0]);
  }

  // Calcula la pose objetivo, mezcla transiciones y resuelve el esqueleto.
  updatePose() {
    this.animate();
    this.solve(true);
  }

  animate() {
    const tgt = _tgt;
    const key = this.animTarget(tgt);
    if (key !== this.animKey) {
      copyPose(this.pose, this.blendFrom);
      this.blendT = 0;
      const prev = this.animKey;
      this.blendDur = key.startsWith('m:') ? 3 : key.startsWith('hit') ? 2 : key === 'airhit' ? 3 : key.startsWith('idle') && prev.startsWith('idle') ? 7 : key === 'getup' ? 1 : key === 'lose' ? 16 : key === 'win' ? 8 : 5;
      this.animKey = key;
    }
    if (this.blendT < this.blendDur) { this.blendT++; lerpPose(this.blendFrom, tgt, easeInOut(this.blendT / this.blendDur), this.pose); }
    else copyPose(tgt, this.pose);
    if (Math.abs(this.vx) > 0.3 && this.grounded) this.walkPhase += Math.abs(this.vx) * 0.12;
  }

  // Resuelve articulaciones con anclaje de pies (sin deslizamientos) y contactos de manos.
  solve(plant) {
    const p = this.pose, s = this.scale;
    const grounded = this.grounded && this.state !== 'airhit' && !(this.state === 'ko' && !this.grounded);
    const fx = this.facing;
    if (plant) this.plantFeet(grounded);
    const o = _ovr; o.feet.n = null; o.feet.f = null; o.hands.n = null; o.hands.f = null;
    if (grounded) { o.feet.n = this.feet.n.planted || this.feet.n.step ? [this.feet.n.x, this.feet.n.y] : null; o.feet.f = this.feet.f.planted || this.feet.f.step ? [this.feet.f.x, this.feet.f.y] : null; }
    computeJoints(p, this.x, this.y, fx, s, grounded, this.joints, o);
    // contactos de manos declarados por el movimiento o la llave (apretón de manos, tortazo en la cara...)
    const hc = this.handContacts();
    if (hc) {
      for (const k of ['n', 'f']) if (hc[k]) {
        const cur = [this.joints[k + 'HandX'], this.joints[k + 'HandY']];
        const w = hc[k].w ?? 1;
        o.hands[k] = [cur[0] + (hc[k].x - cur[0]) * w, cur[1] + (hc[k].y - cur[1]) * w];
      }
      computeJoints(p, this.x, this.y, fx, s, grounded, this.joints, o);
    }
    this.ovrHands = o.hands; this.ovrFeet = o.feet;
    hurtboxFromJoints(this.joints, this.hurt);
    if (this.state === 'knockdown' || (this.state === 'ko' && this.grounded)) { this.hurt.h = Math.min(this.hurt.h, 34 * s); this.hurt.y = this.y - this.hurt.h; }
  }

  // re-resuelve con objetivos de mano/pie corregidos (anti-penetración)
  resolveWith(hands, feet) {
    const o = _ovr;
    o.hands.n = hands.n || (this.ovrHands && this.ovrHands.n) || null; o.hands.f = hands.f || (this.ovrHands && this.ovrHands.f) || null;
    o.feet.n = feet.n || (this.ovrFeet && this.ovrFeet.n) || null; o.feet.f = feet.f || (this.ovrFeet && this.ovrFeet.f) || null;
    const grounded = this.grounded && this.state !== 'airhit';
    computeJoints(this.pose, this.x, this.y, this.facing, this.scale, grounded, this.joints, o);
  }

  handContacts() {
    const m = this.move;
    if (this.contactHands) return this.contactHands; // fijado por una llave (p.ej. el agarrado)
    if (!m) return null;
    if (m.lock && m.lock.spec.hands) return m.lock.spec.hands(this, m.lock.target, m.lock.f, this.b);
    const cs = m.def.contacts;
    if (!cs) return null;
    const t = this.target;
    if (!t || !t.alive) return null;
    let out = null;
    for (const c of cs) {
      if (m.f < c.from || m.f > c.to) continue;
      if (c.onHit && !m.hit) continue;
      const pt = contactPoint(t, c.at, this.facing);
      if (!pt) continue;
      const reach = (BONES.upper + BONES.fore) * this.scale * 1.08;
      if (Math.hypot(pt[0] - this.joints.shX, pt[1] - this.joints.shY) > reach) continue;
      const ramp = Math.min(1, (m.f - c.from + 1) / 3, (c.to - m.f + 1) / 3);
      out = out || {};
      out[c.hand || 'n'] = { x: pt[0], y: pt[1], w: ramp };
    }
    return out;
  }

  // Anclaje de pies: un pie apoyado no se mueve en el mundo; cuando se aleja de su posición ideal da un paso.
  plantFeet(grounded) {
    const p = this.pose, s = this.scale, fx = this.facing;
    const F = this.feet;
    const speed = Math.abs(this.vx);
    for (const k of ['n', 'f']) {
      const ft = F[k];
      const tgt = k === 'n' ? p.fn : p.ff;
      const plantFlag = (k === 'n' ? p.pn : p.pf) >= 0.5;
      const dx = this.x + tgt[0] * fx * s, dy = this.y + tgt[1] * s;
      ft.dx = dx; ft.dy = dy;
      if (!grounded || !plantFlag || this.state === 'hitstun' || this.state === 'blockstun' || this.state === 'locked' || this.state === 'dash') {
        ft.planted = false; ft.step = null; ft.x = dx; ft.y = Math.min(dy, this.y); continue;
      }
      // teletransporte o recolocación brusca: replanta sin estirar la pierna
      if ((!ft.planted && !ft.step) || Math.abs(ft.x - dx) > 70 * s) { ft.planted = true; ft.step = null; ft.x = dx; ft.y = this.y; ft.idle = 0; continue; }
      if (ft.step) {
        const st = ft.step;
        st.t += 1 / st.dur;
        st.toX = dx + this.vx * st.dur * 0.45 * (1 - st.t);
        const e = easeInOut(Math.min(1, st.t));
        ft.x = st.fromX + (st.toX - st.fromX) * e;
        ft.y = this.y - Math.sin(Math.min(1, st.t) * Math.PI) * st.lift;
        if (st.t >= 1) { ft.step = null; ft.planted = true; ft.x = st.toX; ft.y = this.y; this.b.emit('step', { f: this, x: ft.x, k }); }
        continue;
      }
      ft.y = this.y;
      const err = Math.abs(ft.x - dx);
      const other = F[k === 'n' ? 'f' : 'n'];
      const moving = speed > 0.5;
      ft.idle = err > 5 * s ? (ft.idle || 0) + 1 : 0;
      const thr = (moving ? 13 : 22) * s;
      if ((err > thr && (!other.step || err > thr * 2.2)) || ft.idle > 14) {
        const dur = Math.max(5, Math.round(11 - speed * 0.7));
        ft.step = { fromX: ft.x, toX: dx, t: 0, dur, lift: (5 + Math.min(speed, 10) * 1.6) * s };
        ft.planted = false; ft.idle = 0;
      }
    }
  }
}

const INTERRUPT = new Set(['hitstun', 'airhit', 'knockdown', 'ko', 'lose', 'win', 'locked', 'getup']);
const _tgt = makePose(POSES.idle);
const _ovr = { hands: { n: null, f: null }, feet: { n: null, f: null } };
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

// Punto del cuerpo del rival para contactos (en coordenadas de mundo)
export function contactPoint(t, at, facing) {
  const j = t.joints;
  const s = t.scale;
  switch (at) {
    case 'face': return [j.headX - facing * j.headR * 0.85, j.headY + j.headR * 0.15];
    case 'head': return [j.headX - facing * j.headR, j.headY];
    case 'top': return [j.headX, j.headY - j.headR];
    case 'chest': return [j.neckX * 0.7 + j.hipX * 0.3 - facing * 11 * s, j.neckY * 0.7 + j.hipY * 0.3];
    case 'gut': return [j.neckX * 0.3 + j.hipX * 0.7 - facing * 11 * s, j.neckY * 0.3 + j.hipY * 0.7];
    case 'shoulder': return [j.shX - facing * 8 * s, j.shY];
    case 'nHand': return [j.nHandX, j.nHandY];
    case 'fHand': return [j.fHandX, j.fHandY];
    case 'knee': return [j.nKneeX, j.nKneeY];
    default: return null;
  }
}

function evalAnim(keys, f, out) {
  if (keys && keys.loop) {
    const [a, b] = keys.loop;
    if (f > b) f = a + ((f - a) % (b - a));
  }
  return evalKeyframes(keys, f, out);
}

export function playCelebration(c, f, out) {
  evalAnim(c.anim, f, out);
  if (c.mods) for (const m of c.mods) {
    const lf = c.anim.loop && f > c.anim.loop[1] ? c.anim.loop[0] + ((f - c.anim.loop[0]) % (c.anim.loop[1] - c.anim.loop[0])) : f;
    if (lf >= m[0] && lf < m[1] && MODS[m[2]]) MODS[m[2]](out, f - m[0]);
  }
  return out;
}

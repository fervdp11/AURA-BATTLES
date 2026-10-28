import {
  GROUND_Y, WALL_L, WALL_R, GRAVITY, MAX_FALL, MAX_AURA, MAX_ENERGY, WALK_SPEED, BACK_SPEED, JUMP_VY, JUMP_VX,
  DASH_FRAMES, DASH_SPEED, DASH_IFRAMES, DASH_COOLDOWN, PARRY_WINDOW, PARRY_LOCKOUT, BUFFER_FRAMES, TURN_DELAY,
  BURST_COST, emptyInput, ACTIONS
} from './constants.js';
import { makePose, copyPose, lerpPose, computeJoints, hurtboxFromJoints } from './skeleton.js';
import { POSES, MODS, evalKeyframes } from './poses.js';
import { STATUS, CONTROL_IMMUNITY } from './status.js';
import { MOVES } from './moves.js';
import { CELEBRATIONS } from './celebrations.js';

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

  update0() {
    computeJoints(this.pose, this.x, this.y, this.facing, this.scale, true, this.joints);
    hurtboxFromJoints(this.joints, this.hurt);
  }

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
  setState(s) { this.state = s; this.sf = 0; }

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
    if (!this.alive) { this.physics(); this.updatePose(); return; }

    if (this.state === 'locked') { this.updatePose(); return; }

    const ctrl = this.controlStatus();
    switch (this.state) {
      case 'intro': if (this.sf > 100) this.setState('idle'); this.vx = 0; break;
      case 'win': this.vx *= 0.8; break;
      case 'idle': case 'block': ctrl ? this.controlled(ctrl) : this.neutral(); break;
      case 'air': ctrl ? null : this.airborne(); break;
      case 'dash': this.dashing(); break;
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
    this.updatePose();
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
    if (Math.abs(this.vx) > 0.5) this.walkPhase += Math.abs(this.vx) * 0.24 * (this.fwdHeld() ? 1 : -1);
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
    t.x = this.x + this.facing * ox * this.scale; t.y = Math.min(GROUND_Y, this.y + oy);
    t.facing = -this.facing;
    t.lockPose = spec.tpose ? (typeof spec.tpose === 'function' ? spec.tpose(L.f) : spec.tpose) : 'held';
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
    let key = st;
    if (st === 'attack' && this.move) {
      const m = this.move, d = m.def;
      key = 'm:' + d.id;
      if (m.lock && m.lock.spec.anim) { evalKeyframes(m.lock.spec.anim, m.lock.f, out); this.applyMods(m.lock.spec.mods, m.lock.f, out); key += ':lock'; }
      else { evalKeyframes(d.anim, m.f, out); this.applyMods(d.mods, m.f, out); }
      if (d.face) out.face = d.face;
      return key;
    }
    if (st === 'locked') { copyPose(POSES[this.lockPose] || POSES.held, out); MODS.tremble(out, f); return 'locked:' + this.lockPose; }
    if (ctrl && (st === 'idle' || st === 'block')) {
      const c = STATUS[ctrl.id].control;
      if (c === 'charm') { copyPose(POSES.charmed, out); MODS.walkLegs(out, f); }
      else if (c === 'fear') { copyPose(POSES.scared, out); MODS.walkLegs(out, f * 1.4); }
      else if (c === 'dance') { copyPose(POSES.idle, out); MODS.dance(out, f); out.face = 'blank'; }
      else if (c === 'freeze') { copyPose(POSES.frozen, out); }
      else { copyPose(POSES.dizzy, out); MODS.dizzy(out, f); }
      return 'ctrl:' + ctrl.id;
    }
    switch (st) {
      case 'idle': {
        const near = this.target && Math.abs(this.target.x - this.x) < 520;
        if (this.crouching) { copyPose(POSES.crouch, out); MODS.breathe(out, f); return 'crouch'; }
        const walking = Math.abs(this.vx) > 0.6 && this.grounded;
        let base = near ? POSES.guard : POSES.idle;
        if (this.hasStatus('chill')) base = POSES.pockets;
        else if (this.hasStatus('npc')) base = POSES.npc;
        else if (this.hasStatus('auraWalk')) base = POSES.strut;
        copyPose(base, out);
        if (walking) {
          if (this.hasStatus('npc')) MODS.robot(out, this.walkPhase * 3);
          else if (this.hasStatus('auraWalk')) { MODS.slowWalk(out, this.walkPhase * 1.6); MODS.strutArms(out, this.walkPhase * 1.6); }
          else MODS.walkLegs(out, this.walkPhase);
        } else MODS.breathe(out, f);
        if (this.hasStatus('mewing') || this.hasStatus('infMewing')) out.face = 'mew';
        if (this.auraPct < 0.25 && out.face === 'normal') out.face = 'hurt';
        return 'idle:' + (base === POSES.guard ? 'g' : 'i') + (walking ? 'w' : '');
      }
      case 'block': copyPose(this.lowBlock ? POSES.lowBlock : POSES.block, out); return this.lowBlock ? 'lowblock' : 'block';
      case 'blockstun': copyPose(this.lowBlock ? POSES.lowBlock : POSES.block, out); MODS.tremble(out, f); return 'blockstun';
      case 'air': copyPose(this.vy < 0 ? POSES.jump : POSES.fall, out); if (this.airJump === 0 && this.vy < 0) MODS.spin(out, this.sf * 1.3); return this.vy < 0 ? 'jump' : 'fall';
      case 'dash': copyPose(this.dashDir > 0 ? POSES.dash : POSES.backdash, out); return 'dash' + this.dashDir;
      case 'hitstun': copyPose(this.lastHitLow ? POSES.hurtLow : POSES.hurt, out); return 'hit' + (this.hitSeq || 0);
      case 'airhit': copyPose(POSES.airHurt, out); out.lean = -58 - Math.max(-30, Math.min(40, this.vy * 3)); return 'airhit';
      case 'knockdown': copyPose(POSES.lying, out); if (this.sf > 20) out.face = 'hurt'; return 'kd';
      case 'getup': copyPose(POSES.getup, out); return 'getup';
      case 'ko': copyPose(this.grounded ? POSES.lying : POSES.ko, out); out.face = 'ko'; return 'ko';
      case 'win': {
        const c = CELEBRATIONS[this.profile.celebration] || CELEBRATIONS.flex;
        evalKeyframes(c.anim, Math.min(this.sf, c.loopFrom ?? 999) + (this.sf > (c.loopFrom ?? 999) ? 0 : 0), out);
        if (c.mods) this.applyMods(c.mods, this.sf, out);
        return 'win';
      }
      case 'intro': copyPose(POSES.strut, out); if (this.sf < 60) { MODS.slowWalk(out, this.sf * 1.5); MODS.strutArms(out, this.sf * 1.5); } else MODS.breathe(out, f); return 'intro';
    }
    copyPose(POSES.idle, out);
    return 'x';
  }

  applyMods(mods, f, out) {
    if (!mods) return;
    for (const m of mods) {
      if (f >= m[0] && f < m[1] && MODS[m[2]]) MODS[m[2]](out, f - m[0]);
    }
  }

  updatePose() {
    const tgt = _tgt;
    const key = this.animTarget(tgt);
    if (key !== this.animKey) {
      copyPose(this.pose, this.blendFrom);
      this.blendT = 0;
      this.blendDur = key.startsWith('m:') ? 2 : key.startsWith('hit') || key === 'airhit' ? 1 : key.startsWith('idle') && this.animKey.startsWith('idle') ? 6 : 4;
      this.animKey = key;
    }
    if (this.blendT < this.blendDur) {
      this.blendT++;
      lerpPose(this.blendFrom, tgt, this.blendT / this.blendDur, this.pose);
    } else copyPose(tgt, this.pose);
    const grounded = this.grounded && this.state !== 'airhit';
    computeJoints(this.pose, this.x, this.y, this.facing, this.scale, grounded, this.joints);
    hurtboxFromJoints(this.joints, this.hurt);
    if (this.state === 'knockdown' || (this.state === 'ko' && this.grounded)) { this.hurt.h = Math.min(this.hurt.h, 34); this.hurt.y = this.y - this.hurt.h; }
  }
}

const _tgt = makePose(POSES.idle);

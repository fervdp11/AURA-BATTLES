import { GROUND_Y, WALL_L, WALL_R, MAX_ENERGY, JUGGLE_LIMIT, COMBO_HIT_LIMIT, ARENA_W } from './constants.js';
import { Fighter } from './Fighter.js';
import { MOVES } from './moves.js';
import { STATUS } from './status.js';
import { emptyInput } from './constants.js';

// Generador pseudoaleatorio determinista (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HITSTOP = { light: 4, medium: 7, heavy: 11, mega: 16 };
let PROJ_ID = 1;

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class Battle {
  constructor(opts) {
    this.opts = opts;
    this.mode = opts.mode || 'versus';
    this.training = !!opts.training;
    this.rand = rng(opts.seed ?? (Date.now() & 0xffffffff));
    this.frame = 0;
    this.events = [];
    this.fighters = [];
    this.projectiles = [];
    this.hitstop = 0;
    this.slowmo = 0; this.slowScale = 1;
    this.freeze = null; // super freeze {owner, t}
    this.timeStop = null; // {owner, t}
    this.domain = null; // {owner, t}
    this.round = 1;
    this.roundsToWin = opts.roundsToWin || 1;
    this.wins = [0, 0];
    this.timerMax = opts.timer ?? 99;
    this.timer = this.timerMax;
    this.phase = 'intro';
    this.phaseT = 0;
    this.winnerTeam = -1;
    this.result = null;
    this.tokens = new Map();
    this.snapshots = [];
    this.lastKO = null;
    this.matchStats = { longestCombo: 0, perfect: true };
    const n0 = opts.fighters.filter(f => f.team === 0).length;
    const n1 = opts.fighters.filter(f => f.team === 1).length;
    let i0 = 0, i1 = 0;
    for (const cfg of opts.fighters) {
      const left = cfg.team === 0;
      const idx = left ? i0++ : i1++;
      const n = left ? n0 : n1;
      const x = left ? ARENA_W / 2 - 230 - idx * 90 : ARENA_W / 2 + 230 + idx * 110 - (n > 2 ? 60 : 0);
      const f = new Fighter(this, { ...cfg, x, facing: left ? 1 : -1, slot: idx });
      f.startX = x;
      if (cfg.infiniteEnergy) f.infiniteEnergy = true;
      if (cfg.infiniteAura) f.infiniteAura = true;
      f.setState('intro');
      if (f.boss) { f.y = GROUND_Y - 900; f.grounded = false; f.vy = 6; }
      else f.x = x - f.facing * 150;
      this.fighters.push(f);
    }
    this.emit('roundStart', { round: this.round });
  }

  emit(type, data = {}) { data.type = type; this.events.push(data); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  get player() { return this.fighters.find(f => f.isHuman) || this.fighters[0]; }
  alive(team) { return this.fighters.filter(f => f.alive && !f.decoyOf && (team === undefined || f.team === team)); }
  enemiesOf(f) { return this.fighters.filter(o => o.alive && o.team !== f.team && !o.decoyOf); }

  targetFor(f) {
    if (f.forcedTarget && f.forcedTarget.alive) return f.forcedTarget;
    let best = null, bd = 1e9;
    for (const o of this.fighters) {
      if (!o.alive || o.team === f.team) continue;
      const d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * 0.5;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  timeStopFor(f) { return this.timeStop && this.timeStop.owner !== f; }
  domainAgainst(f) { return this.domain && this.domain.owner.team !== f.team; }

  superFreeze(f, def) {
    this.freeze = { owner: f, t: 40 };
    this.emit('superFreeze', { f, def });
  }

  // ------------------------------------------------------------
  step(inputs) {
    this.frame++;
    if (this.freeze) {
      this.freeze.t--;
      if (this.freeze.t <= 0) this.freeze = null;
      for (const f of this.fighters) f.updatePose();
      return;
    }
    if (this.hitstop > 0) { this.hitstop--; return; }
    this.phaseT++;
    const fighting = this.phase === 'fight';

    // entradas
    for (const f of this.fighters) {
      let inp = null;
      if (fighting && f.alive) inp = f.controller ? f.controller.getInput(this, f) : (inputs && inputs[f.id]) || null;
      f.readInput(inp || emptyInput());
    }

    // timeStop / domain
    if (this.timeStop && --this.timeStop.t <= 0) { this.timeStop = null; this.emit('timeResume', {}); }
    if (this.domain && --this.domain.t <= 0) { this.domain = null; this.emit('domainEnd', {}); }

    for (const f of this.fighters) {
      if (this.timeStopFor(f)) { f.updatePose(); continue; }
      f.update();
    }
    this.pushApart();
    this.updateProjectiles();
    this.detectHits();
    this.tickTokens();
    if (this.combosEnded) this.combosEnded();
    this.snapshot();
    this.updatePhase();
  }

  snapshot() {
    const s = this.fighters.map(f => ({
      id: f.id, x: f.x, y: f.y, vx: f.vx, vy: f.vy, state: f.state, grounded: f.grounded, facing: f.facing,
      move: f.move ? f.move.def.id : null, phase: f.movePhase(), mf: f.move ? f.move.f : 0,
      crouch: f.crouching, block: f.state === 'block' || f.state === 'blockstun', alive: f.alive,
      aura: f.aura, energy: f.energy, ctrl: !!f.controlStatus(), invuln: f.invuln > 0, stance: f.move && f.move.def.counter ? f.move.def.id : null
    }));
    const p = this.projectiles.map(p => ({ team: p.team, x: p.x, y: p.y, vx: p.vx, vy: p.vy, w: p.w, h: p.h, active: p.delay <= 0, invisible: p.invisible, low: p.hit && p.hit.height === 'low', fromAbove: p.fromAbove }));
    this.snapshots.push({ frame: this.frame, f: s, p });
    if (this.snapshots.length > 40) this.snapshots.shift();
  }

  snapshotAgo(n) {
    const i = Math.max(0, this.snapshots.length - 1 - n);
    return this.snapshots[i];
  }

  // ---------------- fases de ronda ----------------
  updatePhase() {
    if (this.phase === 'intro') {
      if (this.phaseT === 70) this.emit('announce', { text: this.roundsToWin > 1 ? `RONDA ${this.round}` : '¿LISTOS?', sub: true });
      if (this.phaseT >= 110) {
        this.phase = 'fight'; this.phaseT = 0;
        for (const f of this.fighters) if (f.alive) f.setState('idle');
        this.emit('announce', { text: '¡PELEA!', fight: true });
      }
      return;
    }
    if (this.phase === 'fight') {
      if (!this.training && this.timerMax > 0 && this.phaseT % 60 === 0 && !this.timeStop) {
        this.timer--;
        if (this.timer <= 0) { this.timer = 0; this.endRound('time'); }
      }
      if (this.training) {
        for (const f of this.fighters) {
          if (f.infiniteAura && f.aura < f.maxAura && f.comboTaken === 0 && f.state === 'idle' && this.frame - f.lastHitTaken > 60) f.aura = f.maxAura;
          if (f.infiniteEnergy) f.energy = MAX_ENERGY;
        }
      }
      return;
    }
    if (this.phase === 'ko') {
      if (this.phaseT > 150) this.finishRound();
      return;
    }
    if (this.phase === 'roundEnd') {
      if (this.phaseT > 60) this.nextRound();
      return;
    }
    if (this.phase === 'over') {
      if (this.phaseT === 200) this.emit('matchEnd', { result: this.result });
    }
  }

  checkKO(f, attacker) {
    if (f.aura > 0 || !f.alive) return;
    if (f.state === 'locked') { f.aura = 1; if (f.lockedBy && f.lockedBy.move && f.lockedBy.move.lock) f.lockedBy.move.lock.lethal = true; return; }
    if (this.training && f.infiniteAura) { f.aura = 1; return; }
    f.aura = 0;
    f.alive = false;
    f.koFrame = this.frame;
    f.status.length = 0;
    if (f.lockedBy && f.lockedBy.move && f.lockedBy.move.lock) { /* se libera al terminar */ }
    if (f.state !== 'locked') { f.setState('airhit'); f.grounded = false; f.vy = Math.min(f.vy, -9); f.vx = (attacker ? Math.sign(f.x - attacker.x) || 1 : 1) * 9; }
    const teamAlive = this.alive(f.team).length;
    const final = teamAlive === 0;
    this.lastKO = { f, attacker, final };
    this.emit('ko', { f, attacker, final });
    if (attacker) attacker.combo.t = 90;
    if (final && this.phase === 'fight' && this.opts.endless && f.team !== this.player.team) {
      this.wave = (this.wave || 0) + 1;
      this.emit('waveClear', { wave: this.wave });
      this.slowmo = 50; this.slowScale = 0.35;
      return;
    }
    if (final && this.phase === 'fight') {
      this.phase = 'ko'; this.phaseT = 0;
      this.slowmo = 110; this.slowScale = 0.3;
    }
  }

  endRound(reason) {
    if (this.phase !== 'fight') return;
    // por tiempo: gana el equipo con más aura relativa
    const score = t => this.fighters.filter(f => f.team === t).reduce((s, f) => s + f.aura / f.maxAura, 0) / Math.max(1, this.fighters.filter(f => f.team === t).length);
    const s0 = score(0), s1 = score(1);
    const loserTeam = s0 >= s1 ? 1 : 0;
    this.emit('announce', { text: '¡TIEMPO!', time: true });
    for (const f of this.fighters) if (f.team === loserTeam && f.alive) { f.aura = 0; f.alive = false; f.setState('ko'); }
    this.lastKO = { f: this.fighters.find(f => f.team === loserTeam), attacker: null, final: true, time: true };
    this.phase = 'ko'; this.phaseT = 0;
    void reason;
  }

  finishRound() {
    const t0 = this.alive(0).length, t1 = this.alive(1).length;
    const winner = t0 > 0 && t1 === 0 ? 0 : t1 > 0 && t0 === 0 ? 1 : 0;
    this.wins[winner]++;
    for (const f of this.fighters) if (f.alive && f.team === winner) { f.setState('win'); f.move = null; }
    if (this.wins[winner] >= this.roundsToWin) {
      this.phase = 'over'; this.phaseT = 0; this.winnerTeam = winner;
      const p = this.player;
      this.result = {
        win: winner === p.team, winnerTeam: winner, rounds: [...this.wins], timeLeft: this.timer,
        perfect: winner === p.team && p.aura >= p.maxAura * 0.999 && this.matchStats.perfect,
        stats: { ...p.stats }, aura: p.aura / p.maxAura, frames: this.frame
      };
      this.emit('victory', { team: winner, result: this.result });
    } else {
      this.phase = 'roundEnd'; this.phaseT = 0;
      this.emit('announce', { text: winner === this.player.team ? 'RONDA GANADA' : 'RONDA PERDIDA' });
    }
  }

  nextRound() {
    this.round++;
    this.timer = this.timerMax;
    this.projectiles.length = 0;
    this.timeStop = null; this.domain = null;
    for (const f of this.fighters) {
      f.alive = true; f.aura = f.maxAura; f.x = f.startX; f.y = GROUND_Y; f.vx = f.vy = 0;
      f.status.length = 0; f.move = null; f.grounded = true; f.facing = f.team === 0 ? 1 : -1;
      f.combo = { hits: 0, dmg: 0, t: 0 }; f.comboTaken = 0; f.juggle = 0; f.usedOnce = {}; f.cool = {};
      f.energy = Math.min(f.energy + 25, MAX_ENERGY);
      f.setState('intro'); f.sf = 60;
    }
    this.phase = 'intro'; this.phaseT = 30;
    this.emit('roundStart', { round: this.round });
  }

  // Añade un luchador en mitad del combate (oleadas de supervivencia): cae desde el cielo
  addFighter(cfg, idx = 0) {
    const p = this.player;
    this.fighters = this.fighters.filter(f => f.alive || f.team === p.team);
    const side = (idx % 2 === 0) === (p.x < ARENA_W / 2) ? 1 : -1;
    const x = Math.max(WALL_L + 40, Math.min(WALL_R - 40, p.x + side * (380 + idx * 90)));
    const f = new Fighter(this, { ...cfg, x, facing: -side });
    f.startX = x;
    f.y = GROUND_Y - 700; f.grounded = false; f.vy = 4;
    f.setState('air');
    this.fighters.push(f);
    this.emit('spawn', { f });
    return f;
  }

  // ---------------- colisiones entre cuerpos ----------------
  pushApart() {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i];
      if (!a.alive || a.state === 'locked' || a.state === 'knockdown' || a.decoyOf) continue;
      for (let j = i + 1; j < fs.length; j++) {
        const c = fs[j];
        if (!c.alive || c.state === 'locked' || c.state === 'knockdown' || c.decoyOf) continue;
        if (a.invuln > 0 && a.state === 'attack' && a.move && a.move.def.passThrough) continue;
        if (c.invuln > 0 && c.state === 'attack' && c.move && c.move.def.passThrough) continue;
        if (Math.abs(a.y - c.y) > 70) continue;
        const min = 46 * (a.scale + c.scale) / 2;
        const dx = c.x - a.x;
        if (Math.abs(dx) < min) {
          const push = (min - Math.abs(dx)) / 2;
          const dir = dx === 0 ? (a.facing === 1 ? 1 : -1) : Math.sign(dx);
          a.x -= dir * push; c.x += dir * push;
          // contra la pared, empuja al otro
          if (a.x < WALL_L) { c.x += WALL_L - a.x; a.x = WALL_L; }
          if (c.x > WALL_R) { a.x -= c.x - WALL_R; c.x = WALL_R; }
          if (c.x < WALL_L) { a.x += WALL_L - c.x; c.x = WALL_L; }
          if (a.x > WALL_R) { c.x -= a.x - WALL_R; a.x = WALL_R; }
        }
      }
    }
  }

  // ---------------- hitboxes ----------------
  moveHitbox(f) {
    const m = f.move;
    if (!m || m.lock) return null;
    const d = m.def;
    const h = d.hit;
    if (!h || !h.box) return null;
    const f0 = h.from ?? d.startup, f1 = h.to ?? (d.startup + d.active);
    if (m.f < f0 || m.f >= f1) return null;
    if (h.maxHits && m.hitCount >= h.maxHits) return null;
    const B = h.box;
    const s = f.scale;
    if (B.joint) {
      const j = f.joints;
      const r = (B.r || 16) * s;
      const x = j[B.joint + 'X'] + (B.dx || 0) * f.facing * s, y = j[B.joint + 'Y'] + (B.dy || 0) * s;
      return { x: x - r, y: y - r, w: r * 2, h: r * 2 };
    }
    if (B.around) {
      const w = B.w * s, hh = B.h * s;
      return { x: f.x - w / 2, y: f.y - hh + (B.y || 0) * s, w, h: hh };
    }
    const w = B.w * s, hh = B.h * s;
    const x = f.facing === 1 ? f.x + B.x * s : f.x - B.x * s - w;
    return { x, y: f.y + B.y * s, w, h: hh };
  }

  detectHits() {
    for (const a of this.fighters) {
      if (a.state !== 'attack' || !a.move) continue;
      if (this.timeStopFor(a)) continue;
      const box = this.moveHitbox(a);
      if (!box) continue;
      a.lastBox = box;
      for (const d of this.fighters) {
        if (d === a || d.team === a.team || !d.alive || d.state === 'locked') continue;
        if (a.move.hitIds.has(d.id)) continue;
        if (!overlap(box, d.hurt)) continue;
        a.move.hitIds.add(d.id);
        const res = this.resolveHit(a, d, a.move.def.hit, { kind: 'strike', move: a.move });
        if (!a.move) break;
        if (res === 'hit' || res === 'armor') { a.move.hit = true; a.move.hitCount++; }
        else if (res === 'block' || res === 'parried') a.move.blocked = true;
      }
    }
  }

  // ---------------- resolución de impactos ----------------
  // devuelve 'hit' | 'block' | 'parried' | 'dodged' | 'countered' | 'armor' | 'none'
  resolveHit(a, d, hit, src) {
    if (!d.alive) return 'none';
    const isProj = src.kind === 'projectile';
    const move = src.move;
    const def = move ? move.def : null;
    const fromX = isProj ? src.p.x : a.x;
    // decoy: absorbe el golpe
    if (d.decoyOf) { this.popDecoy(d, a); return 'countered'; }
    // invulnerabilidad / esquiva
    if (d.invuln > 0 && !hit.ignoreInvuln) {
      const t = d.invulnType || 'all';
      const dodges = t === 'all' || (t === 'strike' && !isProj) || (t === 'proj' && isProj) || (t === 'high' && hit.height !== 'low');
      if (dodges) { this.onDodge(d, a, hit, src); return 'dodged'; }
    }
    if (isProj && d.status.some(s => STATUS[s.id].projImmune)) return 'dodged';
    // ventana de contraataque de la víctima
    if (d.state === 'attack' && d.move && d.move.def.counter && !d.move.lock) {
      const c = d.move.def.counter;
      const mf = d.move.f;
      if (mf >= c.from && mf <= c.to && (!c.types || c.types.includes(isProj ? 'projectile' : (hit.grab ? 'grab' : 'strike'))) && !hit.ultimate) {
        const ok = c.on(d, a, hit, src, this);
        if (ok !== false) { d.stats.counters++; this.emit('counter', { f: d, a, id: d.move ? d.move.def.id : null }); return 'countered'; }
      }
    }
    // big brain: parry automático
    const bb = d.hasStatus('bigBrain');
    const facingOk = Math.sign(fromX - d.x) === d.facing || Math.abs(fromX - d.x) < 6;
    const domain = this.domain && this.domain.owner === a;
    const canDefend = (d.state === 'idle' || d.state === 'block' || d.state === 'blockstun') && !d.controlStatus() && d.grounded;
    if (bb && canDefend && !hit.grab && !hit.unblockable) {
      d.removeStatus('bigBrain');
      this.parry(d, a, src);
      return 'parried';
    }
    // parry
    if (canDefend && facingOk && this.frame <= d.parryUntil && !hit.grab && !hit.unparryable) {
      this.parry(d, a, src);
      return 'parried';
    }
    // bloqueo
    const blocking = (d.state === 'block' || d.state === 'blockstun') && canDefend;
    if (blocking && facingOk && !hit.grab && !hit.unblockable && !domain) {
      const low = d.lowBlock;
      const ok = hit.height === 'low' ? low : hit.height === 'high' ? !low : true;
      if (ok) { this.block(d, a, hit, src); return 'block'; }
    }
    if (hit.grab && (d.state === 'air' || !d.grounded || d.state === 'dash' || d.state === 'knockdown' || d.state === 'getup')) return 'none';
    if (hit.grab && move && move.def.on && move.def.on.grab) {
      if (d.state === 'attack' && d.move && d.move.lock) this.releaseLock(d, d.move.lock, true);
      d.move = null;
      this.emit('grab', { a, f: d });
      move.def.on.grab(a, this, move, d);
      return 'hit';
    }
    // golpe conectado
    return this.applyHit(a, d, hit, src);
  }

  onDodge(d, a, hit, src) {
    d.stats.dodges++;
    this.emit('dodge', { f: d, a });
    if (d.state === 'attack' && d.move && d.move.def.on && d.move.def.on.dodge) d.move.def.on.dodge(d, this, d.move, a, src);
  }

  parry(d, a, src) {
    d.stats.parries++;
    d.lastParry = this.frame;
    d.parryLock = 0;
    d.gainEnergy(18);
    d.setState('idle');
    d.move = null;
    this.hitstop = 10;
    if (src.kind === 'projectile') { src.p.dead = true; }
    else if (a.state === 'attack') {
      if (a.move && a.move.lock) this.releaseLock(a, a.move.lock, true);
      a.move = null; a.setState('hitstun'); a.hitstun = 26; a.vx = -a.facing * 3; a.hitSeq = (a.hitSeq || 0) + 1;
    }
    this.emit('parry', { f: d, a, x: (d.x + (src.kind === 'projectile' ? src.p.x : a.x)) / 2, y: d.y - 110 * d.scale });
  }

  block(d, a, hit, src) {
    const dmg = (hit.dmg || 0) * (hit.chip ?? 0.12) * a.dmgMult() * d.defMult();
    d.aura -= dmg;
    d.stats.blocks++;
    d.setState('blockstun');
    d.blockstun = Math.max(6, Math.round((hit.stun || 14) * 0.6));
    const dir = Math.sign(d.x - (src.kind === 'projectile' ? src.p.x : a.x)) || -d.facing;
    d.vx = dir * Math.max(2.5, (hit.kb ? Math.abs(hit.kb[0]) : 3) * 0.7);
    d.gainEnergy(4); a.gainEnergy(3);
    this.hitstop = Math.max(this.hitstop, 4);
    if (src.kind === 'projectile') { if (!src.p.pierce) src.p.dead = true; }
    this.emit('block', { f: d, a, x: d.x + d.facing * 20 * d.scale, y: d.y - 110 * d.scale, low: d.lowBlock });
    if (src.move && src.move.def.on && src.move.def.on.block) src.move.def.on.block(a, this, src.move, d);
    if (d.aura <= 0) { d.aura = 1; }
  }

  applyHit(a, d, hit, src) {
    const move = src.move;
    const isProj = src.kind === 'projectile';
    let dmg = hit.dmg || 0;
    // escalado de combo
    const combo = d.comboTaken;
    const scale = Math.max(0.35, 1 - 0.085 * Math.max(0, combo - 2));
    let mult = a.dmgMult() * d.defMult() * (move ? move.staleK : (src.p && src.p.staleK) || 1);
    if (move && move.data.cooked) mult *= 1.5;
    if (src.p && src.p.cooked) mult *= 1.5;
    const counterHit = d.state === 'attack' && d.move && d.movePhase() === 'startup' && !hit.noCounter;
    if (counterHit) mult *= 1.2;
    const pt = a.hasStatus('plotTwist'); if (pt) { mult *= 1.4; a.removeStatus('plotTwist'); }
    const ratio = d.hasStatus('ratio'); if (ratio) mult *= 1 + 0.07 * (ratio.data.stacks || 1);
    if (this.timeStop && this.timeStop.owner === a) mult *= 0.7;
    dmg = dmg * scale * mult;
    // armadura (no hay hitstun)
    const armorMove = d.state === 'attack' && d.move && d.move.def.armor && d.move.f >= d.move.def.armor[0] && d.move.f <= d.move.def.armor[1];
    let armorBelow = 0;
    for (const s of d.status) if (STATUS[s.id].armorBelow) armorBelow = Math.max(armorBelow, STATUS[s.id].armorBelow);
    const armored = !hit.grab && !hit.ultimate && (armorMove || (armorBelow && (hit.dmg || 0) < armorBelow && d.state !== 'hitstun' && d.state !== 'airhit'));
    this.dealDamage(a, d, dmg, { counterHit, noKO: true });
    // thorns (this is fine)
    const thorns = d.hasStatus('thisIsFine');
    if (thorns && !isProj && a.alive) { a.aura -= STATUS.thisIsFine.thorns; this.emit('thorns', { f: a }); this.checkKO(a, d); }
    if (d.hasStatus('afk')) { /* reservado */ }
    // cancelar AFK / estados frágiles
    if (d.state === 'attack' && d.move && d.move.def.fragile && !armored) d.move.data.interrupted = true;

    if (armored) {
      d.flash = 6; d.hitFlashColor = 0xffd34d;
      this.hitstop = Math.max(this.hitstop, 5);
      this.emit('armor', { f: d, a, x: d.x, y: d.y - 100 * d.scale, dmg });
      if (isProj && !src.p.pierce) src.p.dead = true;
      if (move && move.def.on && move.def.on.hit) move.def.on.hit(a, this, move, d, { armored: true });
      return 'armor';
    }
    // reacción
    if (d.state === 'attack' && d.move && d.move.lock) this.releaseLock(d, d.move.lock, true);
    if (d.move && d.move.def.slot === 'ult' && d.move.data.cineStarted) {/* no interrumpir cinemática */}
    d.move = null;
    d.breakControl();
    d.removeStatus('frozen');
    d.comboTaken++;
    d.lastHitTaken = this.frame;
    d.lastHitLow = hit.height === 'low';
    d.hitSeq = (d.hitSeq || 0) + 1;
    d.flash = 5; d.hitFlashColor = 0xffffff;
    const dirX = Math.sign(d.x - (isProj ? src.p.x - src.p.vx : a.x)) || a.facing;
    const kb = hit.kb || [3, 0];
    const juggled = d.juggle >= JUGGLE_LIMIT || d.comboTaken > COMBO_HIT_LIMIT;
    const airborne = !d.grounded || (kb[1] < -2) || hit.launch;
    if (airborne) {
      d.setState('airhit');
      d.grounded = false;
      d.vx = dirX * kb[0];
      d.vy = juggled ? Math.max(kb[1], 2) : Math.min(kb[1] || -4, d.grounded ? kb[1] : -4);
      if (!d.grounded && !hit.launch && kb[1] >= 0) d.vy = Math.min(-3.5, -4 + d.juggle * 0.6);
      d.juggle++;
      d.knockdownOnLand = !!hit.knockdown || juggled;
      d.wallBounce = !!hit.wallBounce; d.groundBounce = !!hit.groundBounce;
      if (juggled) { d.invuln = 30; d.invulnType = 'all'; }
      d.y = Math.min(d.y, GROUND_Y - 1);
    } else if (hit.knockdown) {
      d.setState('airhit'); d.grounded = false; d.vx = dirX * kb[0]; d.vy = -5; d.knockdownOnLand = true; d.y = GROUND_Y - 1;
      d.wallBounce = !!hit.wallBounce;
    } else {
      d.setState('hitstun');
      d.hitstun = Math.round((hit.stun || 16) * (counterHit ? 1.25 : 1));
      d.vx = dirX * kb[0];
    }
    d.squashX = 0.88; d.squashY = 1.1;
    // estado alterado
    if (hit.status) for (const st of [].concat(hit.status)) d.addStatus(st.id, st.frames, { ...(st.data || {}) }, a);
    // energía
    const k = (move ? move.staleK : 1);
    a.gainEnergy(dmg * 0.14 * k);
    d.gainEnergy(dmg * 0.08);
    const grind = a.hasStatus('sigmaGrind'); if (grind) { grind.data.stacks = Math.min(5, (grind.data.stacks || 0) + 1); a.gainEnergy(3); }
    // combo
    if (d.comboTaken <= 1) { a.combo.hits = 0; a.combo.dmg = 0; }
    a.combo.hits++; a.combo.dmg += dmg; a.combo.t = 70;
    a.stats.hits++;
    if (a.combo.hits > a.stats.maxCombo) a.stats.maxCombo = a.combo.hits;
    if (a.combo.hits > this.matchStats.longestCombo) this.matchStats.longestCombo = a.combo.hits;
    const strength = hit.spark || (dmg > 85 ? 'heavy' : dmg > 40 ? 'medium' : 'light');
    this.hitstop = Math.max(this.hitstop, hit.hitstop ?? HITSTOP[strength] ?? 5);
    const hx = isProj ? src.p.x : (a.lastBox ? a.lastBox.x + a.lastBox.w / 2 : d.x);
    const hy = isProj ? src.p.y : (a.lastBox ? a.lastBox.y + a.lastBox.h / 2 : d.y - 100);
    this.emit('hit', { a, f: d, x: hx, y: hy, dmg, strength, counterHit, combo: a.combo.hits, move: move ? move.def.id : (src.p ? src.p.src : null), color: hit.color, proj: isProj, fx: hit.fx });
    if (counterHit) this.emit('callout', { f: a, text: 'COUNTER!', color: '#ff5050', small: true });
    if (move && move.def.on && move.def.on.hit) move.def.on.hit(a, this, move, d, {});
    if (isProj && src.p.onHit) src.p.onHit(this, src.p, d);
    if (isProj && !src.p.pierce) src.p.dead = true;
    this.checkKO(d, a);
    return 'hit';
  }

  dealDamage(a, d, dmg, info = {}) {
    if (!d.alive) return;
    const real = Math.max(0, Math.min(dmg, d.aura));
    if (d.infiniteAura && this.training) { d.aura = Math.max(1, d.aura - dmg); }
    else d.aura -= dmg;
    d.stats.taken += real;
    if (a && a !== d) a.stats.dmg += real;
    if (d.isHuman && dmg > 0) this.matchStats.perfect = false;
    const st = d.hasStatus('stonks');
    if (st) { st.data.taken = (st.data.taken || 0) + dmg; if (st.data.taken > 150) { d.removeStatus('stonks'); this.emit('callout', { f: d, text: 'STONKS CRASH', color: '#ff4444' }); } }
    if (d.hasStatus('auraFarm')) d.removeStatus('auraFarm');
    this.emit('damage', { f: d, a, dmg, ...info });
    if (!info.noKO) this.checkKO(d, a);
  }

  // Drenaje directo de aura (humillaciones) — no pasa por hitbox
  drain(a, d, amount, text, color = '#ff66cc') {
    if (!d.alive || d.isImmune('humiliate')) { this.emit('callout', { f: d, text: 'INMUNE', color: '#aaaaaa', small: true }); return false; }
    this.dealDamage(a, d, amount * a.dmgMult() * d.defMult(), { drain: true });
    a.stats.humiliations++;
    this.emit('humiliate', { a, f: d, text, color, amount });
    return true;
  }

  auraBurst(f) {
    this.emit('burst', { f });
    this.hitstop = 8;
    for (const o of this.fighters) {
      if (o.team === f.team || !o.alive) continue;
      const dx = o.x - f.x;
      if (Math.abs(dx) < 220 && Math.abs(o.y - f.y) < 200) {
        if (o.move && o.move.lock) this.releaseLock(o, o.move.lock, true);
        o.move = null;
        o.setState('airhit'); o.grounded = false; o.vx = Math.sign(dx || 1) * 11; o.vy = -7; o.knockdownOnLand = false; o.y = Math.min(o.y, GROUND_Y - 1);
      }
    }
  }

  // ---------------- llaves (agarres, cinemáticas) ----------------
  startLock(a, d, spec) {
    if (!a.move) return false;
    if (d.state === 'locked') return false;
    if (d.move && d.move.lock) this.releaseLock(d, d.move.lock, true);
    d.move = null;
    d.breakControl();
    d.setState('locked');
    d.lockedBy = a;
    d.vx = d.vy = 0;
    a.move.lock = { target: d, spec, f: 0 };
    a.vx = 0;
    if (spec.cine) { a.move.data.cineStarted = true; this.emit('cinematic', { a, f: d, frames: spec.frames, id: a.move.def.id }); }
    this.emit('lock', { a, f: d, id: a.move.def.id });
    return true;
  }

  lockHit(a, d, h, move) {
    if (!d.alive && !h.allowKO) return;
    let dmg = (h.dmg || 0) * a.dmgMult() * d.defMult() * (move.data.cooked ? 1.5 : 1) * (move.staleK || 1);
    this.dealDamage(a, d, dmg, { noKO: true });
    if (d.aura <= 0) { d.aura = 1; if (move.lock) move.lock.lethal = true; }
    a.combo.hits++; a.combo.dmg += dmg; a.combo.t = 90;
    if (a.combo.hits > a.stats.maxCombo) a.stats.maxCombo = a.combo.hits;
    a.gainEnergy(dmg * 0.06);
    a.stats.hits++;
    d.flash = 4; d.squashX = 0.9; d.squashY = 1.08;
    this.hitstop = Math.max(this.hitstop, h.hitstop ?? 3);
    this.emit('hit', { a, f: d, x: d.x, y: d.y - 100 * d.scale, dmg, strength: h.spark || (dmg > 60 ? 'heavy' : 'light'), combo: a.combo.hits, move: move.def.id, color: h.color, fx: h.fx, lock: true });
    if (h.say) this.emit('callout', { f: a, text: h.say, color: h.sayColor || '#ffffff' });
  }

  releaseLock(a, L, broken) {
    const d = L.target;
    if (!d || d.state !== 'locked') { if (a.move && a.move.lock === L) a.move.lock = null; return; }
    d.lockedBy = null;
    const end = L.spec.end || { kb: [6, -6], knockdown: true };
    if (broken) { d.setState('idle'); d.comboTaken = 0; }
    else {
      const dir = a.facing;
      d.setState('airhit'); d.grounded = false; d.y = Math.min(d.y, GROUND_Y - 1);
      d.vx = dir * end.kb[0]; d.vy = end.kb[1]; d.knockdownOnLand = end.knockdown !== false; d.wallBounce = !!end.wallBounce;
      d.juggle = JUGGLE_LIMIT - 1;
      if (end.status) d.addStatus(end.status.id, end.status.frames, {}, a);
      this.emit('lockEnd', { a, f: d });
    }
    if (a.move && a.move.lock === L) a.move.lock = null;
    if (L.lethal) { d.aura = 0; this.checkKO(d, a); }
  }

  // ---------------- proyectiles ----------------
  spawnMoveProjectile(f, def, move) {
    const P = def.proj;
    const n = P.count || 1;
    for (let i = 0; i < n; i++) {
      const spec = typeof P.make === 'function' ? P.make(f, this, move, i) : P;
      if (!spec) continue;
      this.spawnProjectile(f, { ...P, ...spec, src: def.id, staleK: move.staleK, cooked: move.data.cooked });
    }
  }

  spawnProjectile(owner, s) {
    const sc = owner.scale;
    const ox = s.ox ?? 40, oy = s.oy ?? -110;
    const p = {
      id: PROJ_ID++, owner, team: owner.team, kind: s.kind || 'orb', src: s.src,
      x: s.x ?? owner.x + owner.facing * ox * sc, y: s.y ?? owner.y + oy * sc,
      vx: (s.vx ?? s.speed ?? 8) * (s.absVx ? 1 : owner.facing), vy: s.vy || 0,
      w: (s.w || 30) * sc, h: (s.h || 30) * sc, life: s.life || 120, age: 0, delay: s.delay || 0,
      gravity: s.gravity || 0, hit: s.hit, pierce: !!s.pierce, reflectable: s.reflectable !== false,
      clash: s.clash !== false, invisible: !!s.invisible, track: s.track || null, trackFor: s.trackFor || 0,
      onHit: s.onHit || null, onUpdate: s.onUpdate || null, onExpire: s.onExpire || null, fromAbove: !!s.fromAbove,
      hitIds: new Set(), every: s.every || 0, color: s.color, facing: owner.facing, staleK: s.staleK || 1, cooked: s.cooked,
      ground: !!s.ground, scale: s.scale || 1, data: s.data || {}, maxHits: s.maxHits || 0, hits: 0, homing: s.homing || 0,
      dead: false
    };
    this.projectiles.push(p);
    this.emit('proj', { p });
    return p;
  }

  updateProjectiles() {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      if (this.timeStop && this.timeStop.owner !== p.owner) continue;
      p.age++;
      if (p.delay > 0) {
        p.delay--;
        if (p.track && p.age <= p.trackFor) { p.x += (p.track.x - p.x) * 0.15; }
        if (p.delay === 0) this.emit('projActive', { p });
        continue;
      }
      if (p.homing && p.owner) {
        const t = this.targetFor(p.owner);
        if (t) { const dy = (t.y - 90 * t.scale) - p.y; p.vy += Math.sign(dy) * p.homing; p.vy = Math.max(-4, Math.min(4, p.vy)); }
      }
      p.vy += p.gravity;
      p.x += p.vx; p.y += p.vy;
      if (p.onUpdate) p.onUpdate(this, p);
      if (p.y > GROUND_Y - p.h / 2 && p.gravity) { p.y = GROUND_Y - p.h / 2; if (p.data.onGround) p.data.onGround(this, p); else p.dead = true; }
      if (--p.life <= 0 || p.x < WALL_L - 300 || p.x > WALL_R + 300) { p.dead = true; if (p.onExpire) p.onExpire(this, p); }
    }
    // choques entre proyectiles
    const ps = this.projectiles;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i]; if (a.dead || !a.clash || a.delay > 0) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const c = ps[j]; if (c.dead || !c.clash || c.team === a.team || c.delay > 0) continue;
        if (overlap(this.pbox(a), this.pbox(c))) { a.dead = true; c.dead = true; this.emit('clash', { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }); }
      }
    }
    // impactos contra luchadores
    for (const p of ps) {
      if (p.dead || p.delay > 0 || !p.hit) continue;
      if (this.timeStop && this.timeStop.owner !== p.owner) continue;
      if (p.every && p.age % p.every === 0) p.hitIds.clear();
      const box = this.pbox(p);
      for (const d of this.fighters) {
        if (d.team === p.team || !d.alive || d.state === 'locked' || p.hitIds.has(d.id)) continue;
        if (!overlap(box, d.hurt)) continue;
        p.hitIds.add(d.id);
        const res = this.resolveHit(p.owner, d, p.hit, { kind: 'projectile', p });
        if (res === 'hit') p.hits++;
        if (p.maxHits && p.hits >= p.maxHits) p.dead = true;
        if (p.dead) break;
      }
    }
    for (const p of ps) if (p.dead && !p.gone) { p.gone = true; this.emit('projDie', { p }); }
    this.projectiles = ps.filter(p => !p.dead);
  }

  pbox(p) { return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h }; }

  reflect(p, newOwner, mult = 1.3) {
    p.owner = newOwner; p.team = newOwner.team; p.vx = -p.vx * 1.25; p.vy = -p.vy * 0.5; p.facing = -p.facing;
    p.hitIds.clear(); p.life = Math.max(p.life, 90);
    if (p.hit) p.hit = { ...p.hit, dmg: (p.hit.dmg || 0) * mult };
    this.emit('reflect', { p, f: newOwner });
  }

  // ---------------- utilidades para movimientos ----------------
  teleport(f, x, y) {
    const fromX = f.x, fromY = f.y;
    f.x = Math.max(WALL_L, Math.min(WALL_R, x));
    if (y !== undefined) { f.y = y; f.grounded = y >= GROUND_Y; }
    f.trail = 10;
    this.emit('teleport', { f, fromX, fromY });
  }

  inFront(a, d, range, minR = -20) {
    const dx = (d.x - a.x) * a.facing;
    return dx >= minR && dx <= range;
  }

  enemiesInRange(a, range, front = true, vrange = 200) {
    return this.fighters.filter(d => d.alive && d.team !== a.team && !d.decoyOf && Math.abs(d.y - a.y) < vrange &&
      (front ? this.inFront(a, d, range) : Math.abs(d.x - a.x) <= range));
  }

  isVulnerableForHumiliation(d) {
    return d.state === 'knockdown' || d.state === 'hitstun' || d.state === 'airhit' || !!d.controlStatus() || d.state === 'getup' ||
      (this.frame - d.lastWhiff < 90);
  }

  popDecoy(dec, attacker) {
    dec.alive = false;
    this.emit('decoyPop', { f: dec, a: attacker });
    const owner = dec.decoyOf;
    if (attacker && attacker.alive) {
      if (attacker.move && attacker.move.lock) this.releaseLock(attacker, attacker.move.lock, true);
      attacker.move = null; attacker.addStatus('dizzy', 45, {}, owner);
      this.emit('callout', { f: attacker, text: 'DELULU', color: '#ff77cc' });
    }
    this.fighters = this.fighters.filter(x => x !== dec);
  }

  spawnDecoy(owner) {
    const prof = { ...owner.profile, name: owner.name };
    const d = new Fighter(this, { team: owner.team, profile: prof, loadout: owner.loadout, x: owner.x, facing: owner.facing });
    d.decoyOf = owner; d.aura = 1; d.x = owner.x; d.facing = owner.facing; d.setState('idle');
    d.decoyLife = 300;
    d.controller = { getInput: () => { if (--d.decoyLife <= 0 && d.alive) { this.popDecoy(d, null); } const i = emptyInput(); i.held.block = false; return i; } };
    this.fighters.push(d);
    this.emit('decoy', { f: d, owner });
    return d;
  }

  // ---------------- fichas de ataque (IA en 1vN) ----------------
  requestToken(f, max) {
    const t = f.target ? f.target.id : 0;
    let set = this.tokens.get(t);
    if (!set) { set = new Map(); this.tokens.set(t, set); }
    if (set.has(f.id)) { set.set(f.id, 90); return true; }
    if (set.size < max) { set.set(f.id, 90); return true; }
    return false;
  }
  tickTokens() {
    for (const set of this.tokens.values()) for (const [k, v] of set) { if (v <= 1) set.delete(k); else set.set(k, v - 1); }
  }
}

export { MOVES };

// IA de combate. Juega con las mismas reglas que el jugador: produce entradas (no manipula el estado),
// percibe al rival con retardo de reacción humano y comete errores según su nivel.
import { emptyInput, PARRY_WINDOW, BURST_COST, GROUND_Y } from './constants.js';
import { MOVES } from './moves.js';
import { rng } from './Battle.js';

export const LEVELS = [
  { id: 0, name: 'NPC Despistado', reaction: [36, 52], think: 20, mistake: 0.32, block: 0.14, parry: 0.0, antiAir: 0.04, combo: 0.08, punish: 0.1, read: 0.0, special: 0.25, idle: 0.38, tech: 0.0, burst: 0.0, feint: 0.0, discipline: 0.0, tokens: 1, color: '#9aa0a6' },
  { id: 1, name: 'Novato', reaction: [28, 40], think: 15, mistake: 0.22, block: 0.3, parry: 0.02, antiAir: 0.14, combo: 0.25, punish: 0.22, read: 0.05, special: 0.35, idle: 0.2, tech: 0.1, burst: 0.1, feint: 0.0, discipline: 0.1, tokens: 1, color: '#7bd389' },
  { id: 2, name: 'Casual', reaction: [22, 32], think: 12, mistake: 0.15, block: 0.46, parry: 0.06, antiAir: 0.3, combo: 0.45, punish: 0.42, read: 0.15, special: 0.45, idle: 0.1, tech: 0.3, burst: 0.25, feint: 0.05, discipline: 0.25, tokens: 1, color: '#4cc9f0' },
  { id: 3, name: 'Competitivo', reaction: [17, 25], think: 9, mistake: 0.09, block: 0.62, parry: 0.14, antiAir: 0.5, combo: 0.66, punish: 0.62, read: 0.3, special: 0.55, idle: 0.04, tech: 0.55, burst: 0.45, feint: 0.12, discipline: 0.45, tokens: 2, color: '#f9c74f' },
  { id: 4, name: 'Aura Master', reaction: [14, 20], think: 7, mistake: 0.055, block: 0.75, parry: 0.25, antiAir: 0.68, combo: 0.8, punish: 0.76, read: 0.45, special: 0.62, idle: 0.02, tech: 0.7, burst: 0.6, feint: 0.2, discipline: 0.6, tokens: 2, color: '#f8961e' },
  { id: 5, name: 'Sigma Legend', reaction: [12, 17], think: 5, mistake: 0.03, block: 0.84, parry: 0.36, antiAir: 0.8, combo: 0.9, punish: 0.87, read: 0.6, special: 0.68, idle: 0.0, tech: 0.85, burst: 0.75, feint: 0.28, discipline: 0.75, tokens: 2, color: '#c084fc' },
  { id: 6, name: 'Aura God', reaction: [10, 14], think: 4, mistake: 0.012, block: 0.9, parry: 0.48, antiAir: 0.9, combo: 0.97, punish: 0.95, read: 0.8, special: 0.72, idle: 0.0, tech: 0.95, burst: 0.9, feint: 0.35, discipline: 0.9, tokens: 2, color: '#ff4d6d' }
];

// estilo -> pesos por rol y distancia preferida
export const STYLES = {
  balanced: { name: 'Equilibrado', aggr: 0.55, range: [80, 260], w: {} },
  rushdown: { name: 'Agresivo', aggr: 0.85, range: [40, 140], w: { poke: 1.4, pressure: 1.5, gap: 1.4, low: 1.2, overhead: 1.2, zone: 0.5, buff: 0.6, counter: 0.5 } },
  zoner: { name: 'Zoner', aggr: 0.35, range: [320, 620], w: { zone: 2.0, poke: 0.8, gap: 0.5, counter: 1.1, trap: 1.4, escape: 1.3 } },
  counter: { name: 'Contraataque', aggr: 0.3, range: [130, 280], w: { counter: 2.2, dodge: 1.6, poke: 0.9, read: 1.5, heavy: 1.2 } },
  trickster: { name: 'Tramposo', aggr: 0.6, range: [100, 320], w: { gap: 1.5, feint: 2.0, trap: 1.6, escape: 1.3, low: 1.3, overhead: 1.4, debuff: 1.4 } },
  grappler: { name: 'Agarrador', aggr: 0.75, range: [40, 120], w: { grab: 2.2, heavy: 1.3, poke: 1.0, gap: 1.2 } },
  showboat: { name: 'Fanfarrón', aggr: 0.5, range: [120, 320], w: { humiliate: 2.4, buff: 1.6, zone: 1.0, comeback: 1.4 } },
  chill: { name: 'Chill', aggr: 0.35, range: [200, 420], w: { buff: 2.0, counter: 1.4, zone: 1.2, heavy: 0.8 } }
};

const BASIC_INPUT = {
  jab: { a: 'light' }, lowKick: { a: 'light', down: true }, roundhouse: { a: 'heavy' }, uppercut: { a: 'heavy', down: true },
  lunge: { a: 'heavy', fwd: true }, sweep: { a: 'heavy', back: true }, airKick: { a: 'light', air: true }, diveKick: { a: 'heavy', air: true },
  dashAttack: { a: 'light' }
};

export class AIController {
  constructor(cfg = {}) {
    this.level = Math.max(0, Math.min(6, cfg.level ?? 2));
    this.L = LEVELS[this.level];
    this.style = STYLES[cfg.style] ? cfg.style : 'balanced';
    this.S = STYLES[this.style];
    this.r = rng(cfg.seed ?? Math.floor(Math.random() * 1e9));
    this.hold = { block: 0, crouch: 0, walk: 0, walkDir: 0, up: 0, dashHold: 0 };
    this.queue = [];
    this.nextThink = 0;
    this.reaction = this.rollReaction();
    this.plan = null;
    this.parryPlanned = -1;
    this.lastThreatId = null;
    this.habits = { jumps: 0, dashes: 0, projectiles: 0, grabs: 0, blocks: 0, frames: 1, lastSeen: {}, repeat: {} };
    this.lastOppState = null;
    this.afkUntil = 0;
    this.comboStep = 0;
    this.chainTimer = 0;
    this.panic = 0;
  }

  rollReaction() { const [a, b] = this.L.reaction; return Math.round(a + this.r() * (b - a)); }
  chance(p) { return this.r() < p; }

  // ---------------------------------------------------------------
  getInput(b, f) {
    const inp = emptyInput();
    this.b = b; this.f = f;
    if (!f.alive) return inp;
    let opp = b.targetFor(f);
    if (!opp) return inp;
    // los niveles altos detectan el clon Delulu
    if (opp.decoyOf && this.chance(this.L.read * 0.08)) { f.forcedTarget = opp.decoyOf; opp = opp.decoyOf; }
    this.opp = opp;
    const snap = b.snapshotAgo(this.reaction);
    const o = (snap && snap.f.find(s => s.id === opp.id)) || this.liveSnap(opp);
    this.o = o;
    this.dist = Math.abs(opp.x - f.x);
    this.pdist = Math.abs(o.x - f.x);
    this.observeHabits(o);

    // cola de pulsaciones programadas (combos, parries)
    this.runQueue(inp);

    if (f.state === 'locked' || f.state === 'ko' || f.state === 'win' || f.state === 'intro') return inp;
    if (f.state === 'hitstun' || f.state === 'airhit') { this.tryBurst(inp); return inp; }
    if (f.state === 'knockdown') { if (this.chance(this.L.tech * 0.25)) inp.held.dash = true; return inp; }
    if (f.controlStatus()) return inp;

    if (f.state === 'attack') { this.comboLogic(inp); this.applyHolds(inp); return inp; }

    // defensa reactiva (prioridad)
    const def = this.defend(inp, snap);
    if (!def) {
      if (f.state === 'air') this.airLogic(inp);
      else if (b.frame >= this.nextThink) this.think(inp);
      else this.continuePlan(inp);
    }
    this.applyHolds(inp);
    return inp;
  }

  liveSnap(opp) {
    return { id: opp.id, x: opp.x, y: opp.y, vx: opp.vx, vy: opp.vy, state: opp.state, grounded: opp.grounded, facing: opp.facing,
      move: opp.move ? opp.move.def.id : null, phase: opp.movePhase(), mf: opp.move ? opp.move.f : 0, crouch: opp.crouching,
      block: opp.state === 'block', alive: opp.alive, aura: opp.aura, energy: opp.energy, ctrl: !!opp.controlStatus(), invuln: opp.invuln > 0 };
  }

  observeHabits(o) {
    const h = this.habits;
    h.frames++;
    const prev = this.lastOppState;
    if (prev && prev !== o.state) {
      if (o.state === 'air') h.jumps++;
      if (o.state === 'dash') h.dashes++;
      if (o.state === 'block') h.blocks++;
    }
    if (o.move && h.lastSeen.id !== o.move) {
      h.lastSeen.id = o.move;
      const d = MOVES[o.move];
      if (d) {
        if (d.proj) h.projectiles++;
        if (d.hit && d.hit.grab) h.grabs++;
        h.repeat[o.move] = (h.repeat[o.move] || 0) + 1;
      }
    }
    if (!o.move) h.lastSeen.id = null;
    this.lastOppState = o.state;
    // decaimiento
    if (h.frames % 600 === 0) { h.jumps *= 0.6; h.dashes *= 0.6; h.projectiles *= 0.6; h.grabs *= 0.6; h.blocks *= 0.6; for (const k in h.repeat) h.repeat[k] *= 0.6; }
  }

  // ---------------------------------------------------------------
  // utilidades de entrada
  dirInput(inp, fwd, back) {
    const f = this.f;
    if (fwd) { if (f.facing === 1) inp.r = true; else inp.l = true; }
    if (back) { if (f.facing === 1) inp.l = true; else inp.r = true; }
  }
  press(inp, a, o = {}) {
    inp.pressed[a] = true; inp.held[a] = true;
    this.dirInput(inp, o.fwd, o.back);
    if (o.down) { inp.d = true; }
  }
  applyHolds(inp) {
    const h = this.hold;
    if (h.block > 0) { h.block--; inp.held.block = true; }
    if (h.crouch > 0) { h.crouch--; inp.d = true; }
    if (h.walk > 0) { h.walk--; if (!inp.l && !inp.r) this.dirInput(inp, h.walkDir > 0, h.walkDir < 0); }
    if (h.dashHold > 0) { h.dashHold--; inp.held.dash = true; }
  }
  stopHolds() { this.hold.block = 0; this.hold.crouch = 0; this.hold.walk = 0; }
  runQueue(inp) {
    const fr = this.b.frame;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      if (q.at <= fr) {
        this.queue.splice(i, 1);
        if (q.a === 'jump') { inp.pu = true; inp.u = true; this.dirInput(inp, q.fwd, q.back); }
        else if (q.a === 'blockHold') { this.hold.block = q.n; this.hold.crouch = q.low ? q.n : 0; }
        else this.press(inp, q.a, q);
      }
    }
  }

  slotFor(id) {
    const f = this.f;
    const lo = f.loadout;
    if (BASIC_INPUT[id]) return BASIC_INPUT[id];
    if (lo.special === id) return { a: 'special' };
    if (lo.specialF === id) return { a: 'special', fwd: true };
    if (lo.specialD === id) return { a: 'special', down: true };
    if (lo.skill1 === id) return { a: 'skill1' };
    if (lo.skill2 === id) return { a: 'skill2' };
    if (lo.ult === id) return { a: 'ult' };
    return null;
  }
  useMove(inp, id) {
    const s = this.slotFor(id);
    if (!s) return false;
    if (!this.f.canUse(MOVES[id], true)) return false;
    this.stopHolds();
    this.press(inp, s.a, s);
    return true;
  }
  equipped() {
    const lo = this.f.loadout;
    return [lo.special, lo.specialF, lo.specialD, lo.skill1, lo.skill2, lo.ult].filter(Boolean);
  }

  // ---------------------------------------------------------------
  // DEFENSA
  defend(inp, snap) {
    const f = this.f, b = this.b, o = this.o, L = this.L;
    const opp = this.opp;
    // amenaza de proyectiles
    if (snap) {
      for (const p of snap.p) {
        if (p.team === f.team || !p.active) continue;
        if (p.invisible && this.r() > L.read + 0.2) continue;
        const dx = p.x - f.x;
        const approaching = Math.sign(-dx) === Math.sign(p.vx) || p.fromAbove || p.vx === 0;
        if (!approaching) continue;
        const eta = p.vx ? Math.abs(dx) / Math.abs(p.vx) : (p.fromAbove ? (GROUND_Y - 100 - p.y) / Math.max(1, p.vy) : 10);
        const near = Math.abs(dx) < (p.fromAbove ? 120 : 260);
        if (!near && !(eta < 24 && eta > 0)) continue;
        if (!this.chance(L.block + 0.1)) continue;
        return this.dodgeProjectile(inp, p, eta);
      }
    }
    // amenaza cuerpo a cuerpo
    if (o.move && (o.phase === 'startup' || o.phase === 'active')) {
      const d = MOVES[o.move];
      if (!d || d.buffOnly || d.taunt) return false;
      const reach = d.ai.range[1] + 40;
      const threat = this.pdist < reach || d.slot === 'ult' || (d.ai.role === 'zone' && !d.proj);
      if (!threat) return false;
      return this.react(inp, d, o);
    }
    // salto del rival => antiaéreo
    if (!o.grounded && o.state === 'air' && this.pdist < 260 && o.vy > -4 && Math.sign(o.x - f.x) === f.facing) {
      if (this.chance(L.antiAir * (0.35 + Math.min(0.4, this.habits.jumps * 0.04 * L.read)))) {
        const aa = this.findMove(['antiair'], this.dist);
        if (aa && this.dist < 140) { this.useMove(inp, aa); return true; }
        if (this.dist < 110 && this.chance(0.5)) { this.useMove(inp, 'uppercut'); return true; }
      }
      if (this.chance(L.block * 0.3)) { this.hold.block = 14; this.hold.crouch = 0; return true; }
    }
    return false;
  }

  react(inp, d, o) {
    const f = this.f, L = this.L, b = this.b;
    if (this.hold.block > 0 && !this.chance(0.08)) return true; // ya defendiendo
    // tiempo restante hasta el impacto según lo percibido
    const elapsedSinceSnap = this.reaction;
    const remain = d.startup - o.mf - elapsedSinceSnap;
    const grab = d.hit && d.hit.grab;
    const role = d.ai.role;
    if (this.chance(L.mistake)) { if (this.chance(0.5)) { this.hold.crouch = 12; } return false; } // se lo come
    if (d.slot === 'ult') return this.reactUlt(inp, d, remain);
    if (grab) {
      if (remain > 3 && this.chance(L.read + 0.2)) {
        if (this.chance(0.5)) { this.queue.push({ at: b.frame, a: 'jump', back: true }); }
        else this.press(inp, 'dash', { back: true });
        return true;
      }
      if (remain > 6 && this.chance(L.punish * 0.5)) { this.useMove(inp, 'jab'); return true; }
      return false;
    }
    // contras propias equipadas (uno reverse, clap back, no reaction...)
    if (remain > 2 && this.chance(L.read * 0.6)) {
      const c = this.findMove(['counter'], this.dist, m => m.counter && m.counter.types.includes('strike'));
      if (c) { this.useMove(inp, c); return true; }
      const dg = this.findMove(['dodge'], this.dist);
      if (dg && (d.hit ? d.hit.height !== 'low' : true)) { this.useMove(inp, dg); return true; }
    }
    // parry programado: disciplina = esperar al último momento (las fintas no lo engañan)
    const canParry = f.parryLock <= 0;
    // los niveles altos leen hábitos: si repites una técnica, la parrean con más facilidad
    const rep = Math.min(0.35, (this.habits.repeat[d.id] || 0) * 0.035 * L.read);
    if (canParry && remain > 0 && this.chance(L.parry + rep)) {
      const wait = Math.max(0, remain - Math.round(PARRY_WINDOW * (0.3 + 0.5 * L.discipline)));
      const early = this.chance(1 - L.discipline) ? Math.min(wait, Math.round(this.r() * 8)) : 0;
      const at = b.frame + wait - early;
      if (this.parryPlanned < b.frame) {
        this.parryPlanned = at;
        this.queue.push({ at, a: 'block' });
        this.queue.push({ at: at + 1, a: 'blockHold', n: 10, low: d.hit && d.hit.height === 'low' });
      }
      return true;
    }
    if (!this.chance(L.block)) return false;
    // bloqueo con la altura correcta (con error)
    let low = d.hit && d.hit.height === 'low';
    if (d.hit && d.hit.height === 'high') low = false;
    if (this.chance(L.mistake * 1.4)) low = !low;
    if (d.hit && d.hit.height === 'mid' && this.chance(0.3)) low = true;
    this.hold.block = Math.max(12, (d.active || 4) + 8);
    this.hold.crouch = low ? this.hold.block : 0;
    // alternativa: esquivar con dash hacia atrás si va a llegar tarde
    if (remain > 8 && this.chance(0.15 + L.read * 0.2) && this.f.dashCd <= 0) { this.stopHolds(); this.press(inp, 'dash', { back: true }); }
    return true;
  }

  reactUlt(inp, d, remain) {
    const L = this.L, b = this.b;
    const id = d.id;
    if (!this.chance(L.read + 0.25)) { this.hold.block = 30; return true; }
    if (id === 'ultimateNonchalance') {
      const t = Math.max(0, remain - 2);
      this.queue.push({ at: b.frame + t, a: 'jump' });
      return true;
    }
    if (id === 'finalAuraJudgment' || id === 'rizzStorm' || id === 'auraOverload') {
      this.queue.push({ at: b.frame + Math.max(0, remain + 20), a: 'dash', back: true });
      this.hold.block = 30;
      return true;
    }
    if (id === 'timeStop' || id === 'domainExpansion') { this.press(inp, 'dash', { back: true }); return true; }
    // ultimates de agarre: salto o dash
    if (this.chance(0.5)) this.queue.push({ at: b.frame + Math.max(0, remain - 4), a: 'jump', back: true });
    else this.queue.push({ at: b.frame + Math.max(0, remain - 4), a: 'dash', back: true });
    return true;
  }

  dodgeProjectile(inp, p, eta) {
    const f = this.f, L = this.L;
    // reflejar / anular si tiene herramienta
    if (eta < 22 && this.chance(L.read)) {
      const c = this.findMove(['counter'], this.dist, m => m.counter && m.counter.types.includes('projectile'));
      if (c && this.useMove(inp, c)) return true;
    }
    if (p.fromAbove) {
      if (this.chance(0.6)) { this.hold.walk = 20; this.hold.walkDir = Math.sign(f.x - p.x) * f.facing || -1; return true; }
      this.hold.block = 18; return true;
    }
    if (p.low) { if (this.chance(0.5)) { this.queue.push({ at: this.b.frame, a: 'jump', back: false }); return true; } this.hold.block = 16; this.hold.crouch = 16; return true; }
    // corazones/flechas altos: agacharse
    if (p.y < f.y - 110 * f.scale && this.chance(0.5)) { this.hold.crouch = 18; return true; }
    if (eta < 14 && this.chance(L.read * 0.4) && f.dashCd <= 0) { this.press(inp, 'dash', { fwd: this.S.aggr > 0.6 }); return true; }
    if (this.chance(0.25) && this.S.aggr > 0.6) { this.queue.push({ at: this.b.frame, a: 'jump', fwd: true }); return true; }
    this.hold.block = Math.min(30, Math.max(10, Math.round(eta) + 6));
    return true;
  }

  tryBurst(inp) {
    const f = this.f;
    if (f.energy < BURST_COST || f.comboTaken < 4) return;
    if (this.chance(this.L.burst * 0.06)) { inp.pressed.dash = true; inp.held.dash = true; inp.pressed.block = true; inp.held.block = true; }
  }

  // ---------------------------------------------------------------
  // COMBOS
  comboLogic(inp) {
    const f = this.f, m = f.move, L = this.L, b = this.b;
    if (!m) return;
    const d = m.def;
    if (!(m.hit || m.blocked)) return;
    if (m.data.aiDone) return;
    if (m.f <= d.startup) return;
    m.data.aiDone = true;
    const confirm = m.hit; // los buenos confirman: no cancelan si fue bloqueado
    if (!confirm && this.chance(L.combo * 0.7)) {
      // bloqueado: a veces cambia a agarre o se resetea
      const g = this.findMove(['grab'], this.dist);
      if (g && this.chance(0.35 * L.read)) this.queue.push({ at: b.frame + d.recovery - 2, ...this.slotFor(g) });
      return;
    }
    if (!this.chance(L.combo)) return; // combo cortado (error humano)
    const delay = Math.max(1, Math.round((1 - L.combo) * 6 + this.r() * 3));
    if (d.chain) { this.queue.push({ at: b.frame + delay, a: 'light' }); return; }
    if (d.jumpCancel && confirm) {
      this.queue.push({ at: b.frame + delay, a: 'jump', fwd: true });
      this.queue.push({ at: b.frame + delay + 8, a: 'light' });
      return;
    }
    if (d.slot === 'basic') {
      // cancelar en especial o ultimate
      const opp = this.opp;
      const finisher = opp && opp.auraPct < 0.3 ? this.findMove(['finisher'], this.dist) : null;
      const ult = f.energy >= 100 && this.equipped().includes(f.loadout.ult) && this.inRange(f.loadout.ult, this.dist) ? f.loadout.ult : null;
      const pick = (ult && this.chance(0.6 + L.read * 0.3)) ? ult : finisher || this.findMove(['poke', 'pressure', 'heavy', 'gap', 'overhead'], this.dist, x => !x.buffOnly);
      if (pick) { const s = this.slotFor(pick); if (s) { this.queue.push({ at: b.frame + delay, ...s }); return; } }
      if (d.id === 'hook' || d.id === 'jab') this.queue.push({ at: b.frame + delay, a: 'heavy', down: this.chance(0.4) });
    }
  }

  inRange(id, dist) {
    const d = MOVES[id];
    if (!d) return false;
    const r = d.ai.range;
    return dist >= r[0] && dist <= r[1];
  }

  findMove(roles, dist, filter) {
    const f = this.f;
    const list = [];
    for (const id of this.equipped()) {
      const d = MOVES[id];
      if (!d || !roles.includes(d.ai.role)) continue;
      if (!this.inRange(id, dist)) continue;
      if (filter && !filter(d)) continue;
      if (!f.canUse(d, true)) continue;
      list.push(id);
    }
    if (!list.length) return null;
    return list[Math.floor(this.r() * list.length)];
  }

  // ---------------------------------------------------------------
  // AIRE
  airLogic(inp) {
    const f = this.f, o = this.o;
    const dist = this.dist;
    if (f.vy > -3 && dist < 150 && Math.sign(this.opp.x - f.x) === f.facing) {
      if (this.chance(0.6)) this.press(inp, 'light');
      else if (dist > 60) this.press(inp, 'heavy');
    }
    void o;
  }

  // ---------------------------------------------------------------
  // NEUTRAL / PLANIFICACIÓN
  think(inp) {
    const f = this.f, b = this.b, L = this.L, S = this.S, o = this.o, opp = this.opp;
    this.nextThink = b.frame + L.think + Math.floor(this.r() * L.think);
    if (this.r() < 0.1) this.reaction = this.rollReaction();
    const dist = this.dist;
    const [pmin, pmax] = S.range;
    // NPC despistado: se queda embobado
    if (b.frame < this.afkUntil) return;
    if (this.chance(L.idle * 0.3)) { this.afkUntil = b.frame + 30 + Math.floor(this.r() * 50); return; }
    // en 1vN: sin ficha de ataque no presiona
    const multi = b.alive(f.team === 0 ? 1 : 0).length > 0 && b.fighters.filter(x => x.alive && x.team === f.team && !x.decoyOf).length > 1;
    const token = !multi || b.requestToken(f, L.tokens);

    const opts = [];
    const add = (score, fn, tag) => { if (score > 0) opts.push({ score: score * (0.7 + this.r() * 0.6), fn, tag }); };
    const oppVuln = o.state === 'knockdown' || o.state === 'getup' || o.ctrl || o.state === 'hitstun';
    const oppRecover = o.phase === 'recovery' && o.move && !MOVES[o.move].buffOnly;
    const oppBuffing = o.move && MOVES[o.move] && (MOVES[o.move].buffOnly || MOVES[o.move].taunt);
    const hp = f.auraPct;

    // castigo de recuperación / buffs del rival
    if ((oppRecover || oppBuffing) && this.chance(L.punish)) {
      const remain = oppRecover ? (MOVES[o.move].total - o.mf - this.reaction) : 20;
      if (remain > 4) {
        let best = null;
        if (f.energy >= 100 && this.inRange(f.loadout.ult, dist)) best = f.loadout.ult;
        if (!best) best = this.findMove(['heavy', 'poke', 'gap', 'pressure', 'grab', 'finisher'], dist);
        if (!best) best = dist < 95 ? 'jab' : dist < 130 ? 'roundhouse' : dist < 230 ? 'lunge' : null;
        if (best) { add(6, () => this.useMove(inp, best), 'punish'); }
        else if (dist < 400) add(3, () => this.press(inp, 'dash', { fwd: true }), 'dashPunish');
      }
    }
    // humillar si está en el suelo
    if (oppVuln) {
      const h = this.findMove(['humiliate'], dist);
      if (h) add(3 * this.w('humiliate'), () => this.useMove(inp, h), 'humiliate');
      if (o.state === 'knockdown' && dist > 200) { const z = this.findMove(['buff'], dist); if (z) add(1.5 * this.w('buff'), () => this.useMove(inp, z), 'kdBuff'); }
    }
    // ultimate
    if (f.energy >= 100 && f.canUse(MOVES[f.loadout.ult], true) && this.inRange(f.loadout.ult, dist) && token) {
      const d = MOVES[f.loadout.ult];
      const grabUlt = d.hit && d.hit.grab;
      const good = !grabUlt || o.state !== 'air';
      add((good ? 2.2 : 0.6) * (0.5 + L.special), () => this.useMove(inp, f.loadout.ult), 'ult');
    }
    // remontada
    if (hp < 0.4) { const c = this.findMove(['comeback'], dist); if (c) add(3, () => this.useMove(inp, c), 'comeback'); }
    if (opp.auraPct < 0.3) { const c = this.findMove(['finisher'], dist); if (c) add(3.5, () => this.useMove(inp, c), 'finisher'); }

    // especiales por rol
    for (const id of this.equipped()) {
      if (id === f.loadout.ult) continue;
      const d = MOVES[id];
      if (!d || !f.canUse(d, true)) continue;
      const role = d.ai.role;
      if (!this.inRange(id, dist)) continue;
      if (role === 'buff' || role === 'comeback') {
        if (d.ai.status && f.hasStatus(d.ai.status)) continue;
        if (dist < 260 && !oppVuln) continue;
      }
      if (role === 'humiliate' && !oppVuln) { add(0.25 * this.w(role), () => this.useMove(inp, id), 'taunt'); continue; }
      if (role === 'counter' && !d.ai.vsProj && !(o.move || o.state === 'dash' || this.habits.dashes > 3)) continue;
      if (role === 'grab' && !(o.block || this.habits.blocks > 4)) { add(0.6 * this.w(role), () => this.useMove(inp, id), 'grab'); continue; }
      if (role === 'zone' && dist < 140 && d.proj) continue;
      if (role === 'copy' && !opp.lastSpecial) continue;
      if (role === 'feint' && !this.chance(L.feint * 3)) continue;
      if (!token && ['poke', 'pressure', 'gap', 'grab', 'heavy', 'low', 'overhead'].includes(role)) continue;
      const base = { zone: 1.6, poke: 1.3, pressure: 1.4, gap: 1.2, buff: 1.6, counter: 0.9, debuff: 1.3, trap: 1.0, heavy: 1.1, low: 1.1, overhead: 1.1, grab: 1.2, dodge: 0.4, escape: hp < 0.5 ? 1.0 : 0.3, humiliate: 0.3, finisher: 0.4, copy: 1.0, feint: 0.8 }[role] ?? 0.6;
      add(base * this.w(role) * (0.6 + L.special) * 1.35, () => this.useMove(inp, id), 'sp:' + id);
    }

    // básicos
    if (token) {
      // cuerpo a cuerpo todos los estilos se defienden con golpes
      const close = Math.max(S.aggr, 0.65);
      if (dist < 95) {
        add(2.0 * close, () => this.useMove(inp, 'jab'), 'jab');
        add(1.0 * close * (o.block ? 1.8 : 0.8), () => this.useMove(inp, this.chance(0.5) ? 'lowKick' : 'sweep'), 'low');
        if (o.state === 'air' || this.habits.jumps > 6) add(1.2 * L.antiAir, () => this.useMove(inp, 'uppercut'), 'upper');
      }
      if (dist >= 60 && dist < 135) add(1.3 * close, () => this.useMove(inp, 'roundhouse'), 'round');
      if (dist >= 120 && dist < 230) add(1.1 * S.aggr, () => this.useMove(inp, 'lunge'), 'lunge');
      if (dist >= 150 && dist < 280 && this.chance(0.5)) add(0.8 * S.aggr * (1 - L.antiAir * 0.3), () => { this.queue.push({ at: b.frame, a: 'jump', fwd: true }); }, 'jumpIn');
      if (dist > pmax) add(1.4 * (0.5 + S.aggr), () => { this.hold.walk = 16 + Math.floor(this.r() * 16); this.hold.walkDir = 1; }, 'approach');
      if (dist > pmax + 150 && f.dashCd <= 0) add(1.1 * S.aggr, () => this.press(inp, 'dash', { fwd: true }), 'dashIn');
    } else {
      // espera su turno a media distancia
      if (dist < 260) add(2, () => { this.hold.walk = 18; this.hold.walkDir = -1; }, 'wait');
      else add(1, () => { this.hold.block = 10; }, 'guard');
    }
    if (dist < pmin) add(1.2 * (1 - S.aggr) + (hp < 0.35 ? 0.6 : 0), () => { this.hold.walk = 14; this.hold.walkDir = -1; }, 'retreat');
    if (dist < pmin && f.dashCd <= 0 && (1 - S.aggr) > 0.5) add(0.7, () => this.press(inp, 'dash', { back: true }), 'backdash');
    // guardia paciente
    add(0.6 * (1 - S.aggr) + L.block * 0.3, () => { this.hold.block = 10 + Math.floor(this.r() * 16); this.hold.crouch = this.chance(0.4) ? this.hold.block : 0; }, 'guard');
    // finta
    if (this.chance(L.feint) && dist < 260) add(0.8, () => { this.press(inp, 'dash', { fwd: true }); this.queue.push({ at: b.frame + 6, a: 'dash', back: true }); }, 'feint');
    // errores: ataque al aire
    if (this.chance(L.mistake)) add(2, () => this.useMove(inp, ['jab', 'roundhouse', 'lowKick'][Math.floor(this.r() * 3)]), 'whiff');
    if (hp < 0.3 && this.chance(L.mistake * 2)) add(2, () => this.queue.push({ at: b.frame, a: 'jump', back: true }), 'panic');

    if (!opts.length) return;
    opts.sort((a, c) => c.score - a.score);
    // los niveles bajos eligen con más ruido
    const pickIdx = this.chance(L.mistake * 2) && opts.length > 1 ? 1 + Math.floor(this.r() * Math.min(3, opts.length - 1)) : 0;
    const choice = opts[pickIdx];
    this.plan = choice.tag;
    const ok = choice.fn();
    if (ok === false && opts.length > 1) opts[1].fn();
  }

  w(role) { return this.S.w[role] ?? 1; }

  continuePlan(inp) {
    const f = this.f;
    // mantener distancia mínima de forma natural
    if (this.hold.walk <= 0 && this.hold.block <= 0 && this.plan === 'approach' && this.dist > this.S.range[1]) { this.hold.walk = 6; this.hold.walkDir = 1; }
    void f; void inp;
  }
}

// Controlador del muñeco de entrenamiento
export class DummyController {
  constructor(mode = 'stand') { this.mode = mode; this.ai = null; this.t = 0; }
  setMode(m, level = 3) { this.mode = m; this.ai = m === 'cpu' ? new AIController({ level, style: 'balanced', seed: 7 }) : null; }
  getInput(b, f) {
    this.t++;
    if (this.mode === 'cpu' && this.ai) return this.ai.getInput(b, f);
    const inp = emptyInput();
    if (this.mode === 'crouch') inp.d = true;
    if (this.mode === 'block') inp.held.block = true;
    if (this.mode === 'lowblock') { inp.held.block = true; inp.d = true; }
    if (this.mode === 'jump' && f.grounded && f.state === 'idle') { inp.pu = true; inp.u = true; }
    if (this.mode === 'parry') {
      const o = b.targetFor(f);
      if (o && o.move && o.movePhase() === 'startup' && o.move.def.startup - o.move.f === 3) { inp.pressed.block = true; inp.held.block = true; }
      else if (o && o.move) inp.held.block = true;
    }
    return inp;
  }
}

// Humillaciones de Aura: gestos cómicos que recuperan aura propia SIN dañar al rival.
// Cada una tiene condición de activación, alcance, recuperación, enfriamiento, animación exclusiva con
// contacto de mano (IK con dedos articulados), sonidos no vocales y reacción del rival. Todas son
// interrumpibles: un golpe las corta (y la siesta te deja más expuesto), y se pueden cancelar con
// bloqueo o dash. El rival derribado puede responder con un "despertar con rabia" si le humillan cerca.
import { makePose } from './skeleton.js';

const P = o => makePose(o);
const UP = [-0.6, -1], OUT = [1, 0.2], DOWN = [-0.25, 1], BACK = [-1, 0.3];

// ---------- poses exclusivas ----------
export const HUM_POSES = {
  humKneelPat: P({ lean: 34, head: 18, hip: [-4, -40], hn: [44, 40], hf: [16, 34], en: OUT, ef: DOWN, hsn: 'flat', hsf: 'relaxed', fn: [24, 0], ff: [-26, -2], kf: [1, 1], face: 'smug' }),
  humKneelPatUp: P({ lean: 30, head: 14, hip: [-4, -41], hn: [42, 24], hf: [16, 34], en: OUT, ef: DOWN, hsn: 'flat', hsf: 'relaxed', fn: [24, 0], ff: [-26, -2], kf: [1, 1], face: 'smug' }),
  humCrouchBack: P({ lean: 40, head: 22, hip: [-2, -46], hn: [10, 40], hf: [46, 44], en: DOWN, ef: OUT, hsn: 'relaxed', hsf: 'flat', fn: [22, 0], ff: [-22, 0], face: 'chill' }),
  humCrouchBackUp: P({ lean: 36, head: 18, hip: [-2, -47], hn: [10, 40], hf: [44, 28], en: DOWN, ef: OUT, hsn: 'relaxed', hsf: 'flat', fn: [22, 0], ff: [-22, 0], face: 'chill' }),
  humDust: P({ lean: -4, head: 18, hip: [0, -76], hn: [-4, 2], hf: [-8, 54], en: [1, 0.6], hsn: 'flat', hsf: 'relaxed', fn: [12, 0], ff: [-12, 0], face: 'smug' }),
  humDust2: P({ lean: -2, head: 10, hip: [0, -76], hn: [6, 18], hf: [-8, 54], en: [1, 0.6], hsn: 'flat', hsf: 'relaxed', fn: [12, 0], ff: [-12, 0], face: 'chill' }),
  humNap: P({ lean: -88, head: 6, hip: [-8, -12], hn: [-34, 2], hf: [-30, -6], en: UP, ef: UP, hsn: 'hidden', hsf: 'hidden', fn: [56, -4], ff: [40, -18], kn: [0, -1], kf: [1, -1], pn: 0, pf: 0, face: 'sleep' }),
  humWatch: P({ lean: -2, head: 26, hip: [0, -76], hn: [14, 6], hf: [24, 4], en: DOWN, ef: [-0.2, 1], hsn: 'point', hsf: 'fist', rf: 90, fn: [12, 0], ff: [-12, 0], face: 'blank' }),
  humClapOpen: P({ lean: -6, head: -6, hip: [0, -76], hn: [34, -2], hf: [14, 8], en: DOWN, ef: DOWN, hsn: 'palm', hsf: 'palm', rn: 90, rf: -90, fn: [12, 0], ff: [-12, 0], face: 'blank' }),
  humClapShut: P({ lean: -6, head: -6, hip: [0, -76], hn: [24, 2], hf: [22, 3], en: DOWN, ef: DOWN, hsn: 'palm', hsf: 'palm', rn: 90, rf: -90, fn: [12, 0], ff: [-12, 0], face: 'smug' }),
  humThumb: P({ lean: -8, head: -8, hip: [0, -77], hn: [44, -8], hf: [-6, 54], en: DOWN, hsn: 'thumb', hsf: 'relaxed', fn: [14, 0], ff: [-14, 0], face: 'smug' }),
  humYawn: P({ lean: -12, head: -26, hip: [0, -78], hn: [10, -60], hf: [-12, -56], en: UP, ef: UP, hsn: 'fist', hsf: 'fist', fn: [10, 0], ff: [-10, 0], face: 'laugh' }),
  humYawnHand: P({ lean: -4, head: -10, hip: [0, -76], hn: [14, -24], hf: [-8, 54], en: [1, 0.6], hsn: 'flat', hsf: 'relaxed', fn: [10, 0], ff: [-10, 0], face: 'chill' }),
  humTie: P({ lean: 56, head: 20, hip: [-8, -36], hn: [30, 50], hf: [24, 52], en: OUT, ef: OUT, hsn: 'claw', hsf: 'claw', fn: [26, 0], ff: [-24, -2], kf: [1, 1], face: 'chill' }),
  humSelfie: P({ lean: -6, head: -14, hip: [0, -76], hn: [-30, -46], hf: [10, -30], en: UP, ef: UP, hsn: 'phone', hsf: 'peace', fn: [10, 0], ff: [-14, 0], spin: 180, face: 'smug' }),
  humSelfie2: P({ lean: -10, head: -20, hip: [0, -77], hn: [-34, -50], hf: [8, -34], en: UP, ef: UP, hsn: 'phone', hsf: 'peace', fn: [10, 0], ff: [-14, 0], spin: 180, face: 'laugh' }),
  // despertar con rabia (respuesta del derribado)
  wakeKick: P({ lean: -20, head: -6, hip: [0, -60], hn: [-26, 20], hf: [-30, 10], en: BACK, ef: BACK, hsn: 'fist', hsf: 'fist', fn: [-10, 0], ff: [70, -60], kf: [0.3, -1], face: 'angry' })
};

// ---------- utilidades ----------
// rival derribado (en el suelo de verdad) cuya cabeza está al alcance
export function downedFoe(f, b, range, minKd = 0) {
  let best = null, bd = Infinity;
  for (const d of b.fighters) {
    if (d.team === f.team || !d.alive || d.decoyOf || d.state !== 'knockdown' || !d.grounded || d.kdTimer < minKd) continue;
    const dist = Math.abs(d.joints.headX - f.x);
    if (dist < range && dist < bd) { bd = dist; best = d; }
  }
  return best;
}
function nearestFoe(f, b) {
  let best = null, bd = Infinity;
  for (const d of b.fighters) { if (d.team === f.team || !d.alive || d.decoyOf) continue; const k = Math.abs(d.x - f.x); if (k < bd) { bd = k; best = d; } }
  return best;
}
const recently = (b, t, n) => b.frame - (t ?? -9999) < n;

// recupera aura (nunca daña al rival) y registra la humillación
// rendimiento decreciente: repetir la misma humillación en la ronda recupera cada vez menos (×0,75)
export function humFactor(f, b) {
  const m = f.move;
  if (!m) return 1;
  if (m.data.humK === undefined) {
    if (!f.humUses || f.humUses.round !== b.round) f.humUses = { round: b.round };
    const n = f.humUses[m.def.id] = (f.humUses[m.def.id] || 0) + 1;
    m.data.humK = Math.pow(0.75, n - 1);
  }
  return m.data.humK;
}
function recover(f, b, amount, victim, text) {
  const before = f.aura;
  f.heal(amount * humFactor(f, b));
  const got = Math.round(f.aura - before);
  f.stats.humiliations++; f.stats.auraHumiliations = (f.stats.auraHumiliations || 0) + 1;
  b.emit('auraRecover', { f, amount: got, text, victim });
  if (victim) { victim.humReact = { face: 'angry', until: b.frame + 40 }; victim.gainEnergy(5); } // la humillación le da rabia (energía)
  return got;
}
// camina hasta el punto de contacto (sin teletransporte) durante los primeros fotogramas
function approach(f, x, t, until = 8) {
  if (t > until) { f.vx = 0; return; }
  const dx = x - f.x;
  f.vx = Math.sign(dx) * Math.min(Math.abs(dx) / Math.max(1, until - t + 1), 16);
  f.facing = f.vx !== 0 ? Math.sign(f.vx) || f.facing : f.facing;
}

const HUM_BASE = { slot: 'aura', taunt: true, humAura: true, cost: 0, air: false, keepVel: false, ai: { role: 'auraHum', range: [0, 9999] } };

// ---------- catálogo ----------
// cond(f, b): condición de activación (incluye el alcance). Cada una describe su animación y contactos.
export const HUMILIATIONS = {
  hum_goodBoy: {
    name: 'Good Boy', color: '#ffd166', cd: 420, startup: 14, active: 26, recovery: 10, recover: [20, 20, 20],
    condText: 'RIVAL NO DERRIBADO O LEJOS',
    desc: 'Vas hasta el rival derribado y le das palmaditas en la cabeza: "buen chico". Tres palmaditas, +20 de aura cada una.',
    when: 'Rival derribado, con su cabeza a menos de 240 px.',
    tip: 'Si te levantas a tiempo puedes despertar con rabia y castigarle.',
    cond: (f, b) => !!downedFoe(f, b, 240, 16),
    anim: [[0, 'run'], [10, 'run'], [14, 'humKneelPatUp', 'out'], [17, 'humKneelPat', 'snap'], [21, 'humKneelPatUp', 'inOut'], [25, 'humKneelPat', 'snap'], [29, 'humKneelPatUp', 'inOut'], [33, 'humKneelPat', 'snap'], [40, 'humKneelPatUp', 'inOut'], [50, 'guard', 'inOut']],
    contacts: [{ hand: 'n', at: 'headTop', from: 15, to: 36, victim: true }],
    start(f, b, m) { m.data.victim = downedFoe(f, b, 240); },
    frame(f, b, m, t) {
      const v = m.data.victim;
      if (!v) return;
      // se arrodilla al otro lado de la cabeza (no encima del cuerpo), mirando hacia ella
      const side = Math.sign(v.joints.headX - v.joints.hipX) || -v.facing;
      approach(f, v.joints.headX + side * 36 * f.scale, t, 13);
      if (t > 11) f.facing = -side;
      if (t === 17 || t === 25 || t === 33) {
        if (v.state !== 'knockdown' || !v.alive) { m.f = m.def.startup + m.def.active; b.emit('fx', { name: 'humMiss', f }); return; }
        b.emit('fx', { name: 'pat', f, x: v.joints.headX, y: v.joints.headY - v.joints.headR, victim: v });
        recover(f, b, m.def.recover[(t - 17) / 8], v, t === 33 ? 'GOOD BOY' : null);
      }
    }
  },
  hum_dustOff: {
    name: 'Sacudir el polvo', color: '#c9c3e6', cd: 360, startup: 6, active: 22, recovery: 8, recover: [18, 18],
    condText: 'SOLO TRAS ESQUIVAR',
    desc: 'Tras esquivar un ataque, te sacudes el polvo del hombro con toda la calma. +36 de aura.',
    when: 'Hasta 1,2 s después de una esquiva con éxito.',
    tip: 'Es lento: castígale mientras se sacude.',
    cond: (f, b) => recently(b, f.lastDodge, 72),
    anim: [[0, 'guard'], [6, 'humDust', 'out'], [11, 'humDust2', 'inOut'], [15, 'humDust', 'inOut'], [20, 'humDust2', 'inOut'], [26, 'humDust', 'inOut'], [36, 'guard', 'inOut']],
    contacts: [{ hand: 'n', self: 'fShoulder', from: 5, to: 28 }],
    frame(f, b, m, t) {
      if (t === 11 || t === 20) { b.emit('fx', { name: 'dust', f, x: f.joints.shX, y: f.joints.shY }); recover(f, b, m.def.recover[t === 11 ? 0 : 1], nearestFoe(f, b), t === 20 ? 'NI ME HAS TOCADO' : null); }
    }
  },
  hum_consolePat: {
    name: 'Palmadita de consuelo', color: '#7df9ff', cd: 420, startup: 14, active: 22, recovery: 10, recover: [24, 24],
    condText: 'RIVAL NO DERRIBADO O LEJOS',
    desc: 'Te acercas al rival derribado, te agachas y le das palmaditas de consuelo en la espalda. +48 de aura.',
    when: 'Rival derribado, con el torso a menos de 230 px.',
    tip: 'Levántate con rabia: está justo a tu lado.',
    cond: (f, b) => !!downedFoe(f, b, 260, 16),
    anim: [[0, 'run'], [10, 'run'], [14, 'humCrouchBackUp', 'out'], [19, 'humCrouchBack', 'snap'], [24, 'humCrouchBackUp', 'inOut'], [29, 'humCrouchBack', 'snap'], [36, 'humCrouchBackUp', 'inOut'], [46, 'guard', 'inOut']],
    contacts: [{ hand: 'f', at: 'torsoUp', from: 15, to: 33, victim: true }],
    start(f, b, m) { m.data.victim = downedFoe(f, b, 260); },
    frame(f, b, m, t) {
      const v = m.data.victim;
      if (!v) return;
      const tx = (v.joints.hipX + v.joints.neckX) / 2;
      const side = Math.sign(f.x - tx) || 1;
      approach(f, tx + side * 40 * f.scale, t, 11);
      if (t > 11) f.facing = -side;
      if (t === 19 || t === 29) {
        if (v.state !== 'knockdown' || !v.alive) { m.f = m.def.startup + m.def.active; b.emit('fx', { name: 'humMiss', f }); return; }
        b.emit('fx', { name: 'pat', f, x: tx, y: Math.min(v.joints.hipY, v.joints.neckY) - 8, victim: v, soft: true });
        recover(f, b, m.def.recover[t === 19 ? 0 : 1], v, t === 29 ? 'YA PASÓ, YA PASÓ' : null);
      }
    }
  },
  hum_sigmaNap: {
    name: 'Siesta Sigma', color: '#c084fc', cd: 720, startup: 12, active: 110, recovery: 16, perFrame: 1.1,
    condText: 'NADIE DERRIBADO CERCA',
    desc: 'Te tumbas a dormir junto al rival derribado. Recuperas aura cada instante (hasta +120), pero si te golpean recibes un 30% más.',
    when: 'Rival derribado a menos de 240 px. Pulsa cualquier botón para levantarte.',
    tip: 'Despiértale con un golpe: está indefenso y recibe más daño.',
    cond: (f, b) => !!downedFoe(f, b, 240, 6),
    anim: [[0, 'guard'], [12, 'humNap', 'inOut'], [122, 'humNap'], [131, 'getup', 'out'], [138, 'guard', 'inOut']],
    vulnerable: 1.3,
    frame(f, b, m, t) {
      const end = m.def.startup + m.def.active;
      if (t > 14 && t < end) {
        const k = humFactor(f, b), before = f.aura;
        f.heal(m.def.perFrame * k);
        m.data.got = (m.data.got || 0) + (f.aura - before);
        if (t % 30 === 0) b.emit('fx', { name: 'zzz', f });
        const inp = f.input;
        if (t > 20 && inp && (inp.pressed.light || inp.pressed.heavy || inp.pressed.block || inp.pressed.dash || inp.pu || inp.pressed.taunt)) m.f = end;
      }
      if (t === 16) { f.stats.humiliations++; f.stats.auraHumiliations = (f.stats.auraHumiliations || 0) + 1; const v = downedFoe(f, b, 300); if (v) { v.humReact = { face: 'angry', until: b.frame + 60 }; v.gainEnergy(5); } b.emit('auraRecover', { f, amount: 0, text: 'SIESTA SIGMA' }); }
      if (t === end) b.emit('auraRecover', { f, amount: Math.round(m.data.got || 0), text: null });
    }
  },
  hum_checkWatch: {
    name: 'Revisar la hora', color: '#ffe066', cd: 480, startup: 6, active: 20, recovery: 10, recover: [42],
    condText: 'SOLO TRAS UN FALLO FUERTE DEL RIVAL',
    desc: 'El rival falla un golpe lento y tú miras el reloj como si tuvieras prisa. +42 de aura.',
    when: 'Hasta 0,8 s después de que el rival falle un ataque fuerte o especial.',
    tip: 'Ataca durante el gesto: no se está defendiendo.',
    cond: (f, b) => { const o = nearestFoe(f, b); return !!o && recently(b, o.lastWhiff, 48) && !!o.lastWhiffHeavy; },
    anim: [[0, 'guard'], [6, 'humWatch', 'out'], [26, 'humWatch'], [36, 'guard', 'inOut']],
    contacts: [{ hand: 'n', self: 'fWrist', from: 5, to: 27 }],
    frame(f, b, m, t) {
      if (t === 10) b.emit('fx', { name: 'tick', f, x: f.joints.fHandX, y: f.joints.fHandY });
      if (t === 18) recover(f, b, m.def.recover[0], nearestFoe(f, b), 'TIC TAC');
    }
  },
  hum_slowClap: {
    name: 'Aplauso sarcástico', color: '#ff9f1c', cd: 600, startup: 6, active: 30, recovery: 8, recover: [15, 15, 15],
    condText: 'SOLO TRAS UN FALLO DEL RIVAL A DISTANCIA',
    desc: 'Aplaudes despacito el fallo del rival, desde una distancia prudente. Tres aplausos, +15 de aura cada uno.',
    when: 'Hasta 1,5 s después de un fallo del rival, a más de 110 px.',
    tip: 'Acércate con un dash: los aplausos no protegen.',
    cond: (f, b) => { const o = nearestFoe(f, b); return !!o && recently(b, o.lastWhiff, 90) && Math.abs(o.x - f.x) > 110; },
    anim: [[0, 'guard'], [6, 'humClapOpen', 'out'], [10, 'humClapShut', 'snap'], [16, 'humClapOpen', 'inOut'], [20, 'humClapShut', 'snap'], [26, 'humClapOpen', 'inOut'], [30, 'humClapShut', 'snap'], [36, 'humClapOpen', 'inOut'], [44, 'guard', 'inOut']],
    contacts: [{ hand: 'n', self: 'clap', from: 9, to: 11 }, { hand: 'f', self: 'clap', from: 9, to: 11 }, { hand: 'n', self: 'clap', from: 19, to: 21 }, { hand: 'f', self: 'clap', from: 19, to: 21 }, { hand: 'n', self: 'clap', from: 29, to: 31 }, { hand: 'f', self: 'clap', from: 29, to: 31 }],
    frame(f, b, m, t) {
      if (t === 10 || t === 20 || t === 30) { b.emit('fx', { name: 'clap', f, x: f.joints.nHandX, y: f.joints.nHandY }); recover(f, b, m.def.recover[(t - 10) / 10], nearestFoe(f, b), t === 30 ? 'BRAVO' : null); }
    }
  },
  hum_thumbsUp: {
    name: 'Pulgar arriba', color: '#7bd389', cd: 360, startup: 4, active: 18, recovery: 8, recover: [45],
    condText: 'SOLO TRAS UNA DEFENSA PERFECTA',
    desc: 'Tras un parry perfecto, le enseñas el pulgar al rival con una sonrisa. +45 de aura.',
    when: 'Hasta 1 s después de un parry.',
    tip: 'No te dejes parrear tanto.',
    cond: (f, b) => recently(b, f.lastParry, 60),
    anim: [[0, 'guard'], [5, 'humThumb', 'back'], [22, 'humThumb'], [30, 'guard', 'inOut']],
    frame(f, b, m, t) {
      if (t === 8) { b.emit('fx', { name: 'thumb', f, x: f.joints.nHandX, y: f.joints.nHandY - 12 }); recover(f, b, m.def.recover[0], nearestFoe(f, b), 'BUEN INTENTO'); }
    }
  },
  // ---- nuevas (distintas entre sí; ninguna es "caminar chasqueando") ----
  hum_yawn: {
    name: 'Bostezo aburrido', color: '#9be7ff', cd: 600, startup: 8, active: 30, recovery: 10, recover: [38],
    condText: 'EL RIVAL NO ESTÁ TORTUGUEANDO',
    desc: 'El rival lleva un rato bloqueando sin hacer nada: te estiras y bostezas tapándote la boca. +38 de aura.',
    when: 'El rival bloquea más de 0,75 s seguidos a más de 150 px.',
    tip: 'Deja de bloquear y aprovecha el estiramiento.',
    cond: (f, b) => { const o = nearestFoe(f, b); return !!o && (o.blockRun || 0) >= 45 && Math.abs(o.x - f.x) > 150; },
    anim: [[0, 'guard'], [8, 'humYawn', 'out'], [22, 'humYawn'], [28, 'humYawnHand', 'inOut'], [38, 'humYawnHand'], [48, 'guard', 'inOut']],
    contacts: [{ hand: 'n', self: 'mouth', from: 27, to: 39 }],
    frame(f, b, m, t) {
      if (t === 12) b.emit('fx', { name: 'stretch', f });
      if (t === 30) recover(f, b, m.def.recover[0], nearestFoe(f, b), 'QUÉ SUEÑO');
    }
  },
  hum_tieShoe: {
    name: 'Atarse los cordones', color: '#ff79c6', cd: 900, startup: 10, active: 34, recovery: 10, recover: [26, 26],
    condText: 'EL RIVAL ESTÁ DEMASIADO CERCA',
    desc: 'Con el rival lejos, te agachas a atarte las zapatillas con toda la calma del mundo. +52 de aura.',
    when: 'Rival a más de 420 px y sin atacar.',
    tip: 'Un proyectil o un dash largo le pillan con los cordones a medias.',
    cond: (f, b) => { const o = nearestFoe(f, b); return !!o && Math.abs(o.x - f.x) > 420 && !o.move; },
    anim: [[0, 'guard'], [10, 'humTie', 'inOut'], [44, 'humTie'], [54, 'guard', 'inOut']],
    contacts: [{ hand: 'n', self: 'nFoot', from: 11, to: 44 }, { hand: 'f', self: 'nFoot2', from: 12, to: 44 }],
    frame(f, b, m, t) {
      if (t % 6 === 0 && t > 12 && t < 44) b.emit('fx', { name: 'laces', f, x: f.joints.nFootX, y: f.joints.nFootY - 6 });
      if (t === 24 || t === 42) recover(f, b, m.def.recover[t === 24 ? 0 : 1], nearestFoe(f, b), t === 42 ? 'DOBLE NUDO' : null);
    }
  },
  hum_selfie: {
    name: 'Selfie con el caído', color: '#f72585', cd: 480, startup: 8, active: 22, recovery: 10, recover: [46],
    condText: 'NADIE DERRIBADO CERCA',
    desc: 'Te das la vuelta y te haces un selfie con el rival tirado en el suelo de fondo. +46 de aura.',
    when: 'Rival derribado a menos de 200 px.',
    tip: 'Levántate antes del flash y castígale: está de espaldas.',
    cond: (f, b) => !!downedFoe(f, b, 200, 10),
    anim: [[0, 'guard'], [8, 'humSelfie', 'out'], [18, 'humSelfie2', 'inOut'], [30, 'humSelfie2'], [40, 'guard', 'inOut']],
    start(f, b, m) { m.data.victim = downedFoe(f, b, 200); },
    frame(f, b, m, t) {
      const v = m.data.victim;
      if (t === 20) {
        if (!v || v.state !== 'knockdown') { b.emit('fx', { name: 'humMiss', f }); return; }
        b.emit('fx', { name: 'selfie', f, x: f.joints.nHandX, y: f.joints.nHandY });
        recover(f, b, m.def.recover[0], v, 'FOTO DE PERFIL');
      }
    }
  }
};
export const HUM_IDS = Object.keys(HUMILIATIONS);
export const STARTER_HUMS = ['hum_goodBoy', 'hum_dustOff', 'hum_thumbsUp'];

// Construye las definiciones de movimiento a partir del catálogo
export function humMoveDefs() {
  const out = {};
  for (const id of HUM_IDS) {
    const H = HUMILIATIONS[id];
    out[id] = {
      ...HUM_BASE, name: H.name, color: H.color, cd: H.cd, startup: H.startup, active: H.active, recovery: H.recovery,
      anim: H.anim, contacts: H.contacts, cond: H.cond, condText: H.condText, desc: H.desc, tip: H.tip, when: H.when,
      recover: H.recover, perFrame: H.perFrame, vulnerable: H.vulnerable,
      on: { start: H.start, frame: H.frame }
    };
  }
  // despertar con rabia: respuesta del derribado a una humillación cercana
  out.wakeRage = {
    slot: 'reversal', name: 'Despertar con rabia', color: '#ff4d6d', cost: 0, cd: 0, startup: 9, active: 4, recovery: 18,
    desc: 'Si te humillan estando en el suelo, pulsa ataque para levantarte de una patada.', tip: 'Humilla solo con el rival lejos de levantarse.',
    anim: [[0, 'lying'], [5, 'getup', 'out'], [9, 'wakeKick', 'snap'], [15, 'wakeKick'], [31, 'guard', 'inOut']],
    hit: { dmg: 48, stun: 22, kb: [8, -7], height: 'mid', box: { joint: 'fFoot', r: 24 }, knockdown: true, spark: 'heavy' },
    ai: { role: 'none', range: [0, 100] }
  };
  return out;
}

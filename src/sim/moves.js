// Definición de todos los movimientos. Cada técnica tiene animación propia, reglas de impacto
// y formas de ser esquivada o contrarrestada. Frames a 60 Hz. Daño sobre 1000 de aura.
import { GROUND_Y, WALL_L, WALL_R } from './constants.js';

export const MOVES = {};

const DEFAULTS = { slot: 'special', cost: 0, cd: 0, startup: 6, active: 3, recovery: 10, air: false };

function def(id, o) {
  const m = { ...DEFAULTS, ...o, id };
  if (!m.anim) m.anim = [[0, 'guard'], [m.startup, 'punchFwd'], [m.startup + m.active + m.recovery, 'guard']];
  MOVES[id] = m;
  return m;
}

const H = (dmg, o = {}) => ({ dmg, stun: 16, kb: [3, 0], height: 'mid', ...o });
const frontBox = (x, y, w, h) => ({ x, y, w, h });
const first = (b, f, range, front = true) => {
  const list = b.enemiesInRange(f, range, front);
  list.sort((p, q) => Math.abs(p.x - f.x) - Math.abs(q.x - f.x));
  return list[0] || null;
};
const say = (b, f, text, color = '#ffffff', small = false) => b.emit('callout', { f, text, color, small });
const fx = (b, name, data) => b.emit('fx', { name, ...data });
const total = d => d.startup + d.active + d.recovery;

// ---- contactos de manos (el rig IK lleva la mano exactamente al punto) ----
// Punto donde se encuentran las dos manos en un apretón: entre ambos hombros, con sacudida vertical.
const shakePoint = (a, t, fr, shake) => {
  const ja = a.joints, jt = t.joints;
  const x = (ja.shX + jt.shX) / 2;
  const y = (ja.shY + jt.shY) / 2 + 30 * a.scale + (shake ? Math.sin(fr * 0.75) * 7 * a.scale : 0);
  return { x, y };
};
const ramp = (fr, a, b) => Math.max(0, Math.min(1, (fr - a + 1) / 4, (b - fr + 1) / 4));
// mano del atacante en la cara del agarrado
const faceHit = (a, t, hand, from, to, fr, at = 'face') => {
  const w = ramp(fr, from, to);
  if (w <= 0) return null;
  const p = contactPointOf(t, at, a.facing);
  return p ? { x: p[0], y: p[1], w } : null;
};
function contactPointOf(t, at, facing) {
  const j = t.joints, s = t.scale;
  if (at === 'face') return [j.headX - facing * j.headR * 0.9, j.headY + j.headR * 0.2];
  if (at === 'chest') return [j.neckX * 0.7 + j.hipX * 0.3 - facing * 11 * s, j.neckY * 0.7 + j.hipY * 0.3];
  if (at === 'gut') return [j.neckX * 0.3 + j.hipX * 0.7 - facing * 11 * s, j.neckY * 0.3 + j.hipY * 0.7];
  if (at === 'top') return [j.headX, j.headY - j.headR];
  if (at === 'shoulder') return [j.shX - facing * 8 * s, j.shY];
  if (at === 'hip') return [j.hipX - facing * 12 * s, j.hipY + 4 * s];
  return null;
}
// apretón de manos: ambos sacuden la mano cercana en el mismo punto hasta 'release'
const handshake = (release, shakeTo, extra) => ({
  hands: (a, t, fr) => {
    const o = {};
    if (fr <= release) { const p = shakePoint(a, t, fr, fr <= shakeTo); o.n = { x: p.x, y: p.y, w: Math.min(1, fr / 4) }; }
    if (extra) { const e = extra(a, t, fr); if (e) Object.assign(o, e); }
    return o;
  },
  thands: (a, t, fr) => {
    if (fr > release) return null;
    const p = shakePoint(a, t, fr, fr <= shakeTo);
    return { n: { x: p.x, y: p.y, w: Math.min(1, fr / 4) } };
  }
});

// =====================================================================
// BÁSICOS
// =====================================================================
def('jab', {
  slot: 'basic', name: 'Jab', weight: 'light', startup: 4, active: 3, recovery: 8, chain: 'cross',
  anim: [[0, 'jabW'], [4, 'jab', 'snap'], [7, 'jab'], [15, 'guard', 'inOut']],
  hit: H(28, { stun: 14, kb: [2.5, 0], box: { joint: 'nHand', r: 16 } }),
  desc: 'Golpe rápido. Encadena con Z.', ai: { role: 'poke', range: [0, 95] }
});
def('cross', {
  slot: 'basic', name: 'Directo', weight: 'light', startup: 5, active: 3, recovery: 11, chain: 'hook',
  anim: [[0, 'jab'], [5, 'cross', 'snap'], [8, 'cross'], [19, 'guard', 'inOut']],
  hit: H(34, { stun: 16, kb: [3, 0], box: { joint: 'fHand', r: 17 } }),
  desc: 'Segundo golpe de la cadena.', ai: { role: 'poke', range: [0, 100] }
});
def('hook', {
  slot: 'basic', name: 'Gancho', weight: 'medium', startup: 7, active: 3, recovery: 16,
  anim: [[0, 'hookW'], [7, 'hook', 'snap'], [10, 'hook'], [26, 'guard', 'inOut']],
  hit: H(52, { stun: 22, kb: [7, 0], box: { joint: 'nHand', r: 19 }, spark: 'medium' }),
  desc: 'Remate de la cadena. Cancela en especial.', ai: { role: 'poke', range: [0, 100] }
});
def('lowKick', {
  slot: 'basic', name: 'Patada baja', weight: 'light', startup: 6, active: 3, recovery: 12,
  anim: [[0, 'crouch'], [6, 'lowKick', 'snap'], [9, 'lowKick'], [21, 'crouch', 'inOut']],
  hit: H(30, { stun: 15, kb: [3, 0], height: 'low', box: { joint: 'nFoot', r: 17 } }),
  desc: 'Golpe bajo: bloquéalo agachado.', ai: { role: 'low', range: [0, 105] }
});
def('airKick', {
  slot: 'basic', name: 'Patada aérea', weight: 'light', air: 'only', startup: 5, active: 10, recovery: 6, keepVel: true,
  anim: [[0, 'jump'], [5, 'airKick', 'snap'], [15, 'airKick'], [21, 'fall']],
  hit: H(42, { stun: 18, kb: [4, 0], height: 'high', box: { joint: 'nFoot', r: 19 } }),
  desc: 'Ataque alto desde el aire: bloquéalo de pie.', ai: { role: 'air', range: [0, 110] }
});
def('roundhouse', {
  slot: 'basic', name: 'Patada giratoria', weight: 'heavy', startup: 11, active: 4, recovery: 20,
  anim: [[0, 'roundW'], [11, 'roundhouse', 'snap'], [15, 'roundhouse'], [35, 'guard', 'inOut']],
  hit: H(85, { stun: 22, kb: [9, 0], box: { joint: 'nFoot', r: 21 }, spark: 'heavy' }),
  desc: 'Patada fuerte con gran retroceso.', ai: { role: 'heavy', range: [30, 135] }
});
def('uppercut', {
  slot: 'basic', name: 'Uppercut', weight: 'heavy', startup: 8, active: 4, recovery: 22, jumpCancel: true,
  invuln: [2, 8], invulnType: 'high', motion: [[8, 12, 2]],
  anim: [[0, 'upperW'], [8, 'uppercut', 'snap'], [12, 'uppercut'], [34, 'guard', 'inOut']],
  hit: H(70, { stun: 20, kb: [2, -15], launch: true, box: { joint: 'nHand', r: 22 }, spark: 'heavy' }),
  desc: 'Lanzador antiaéreo. Salta para continuar el combo.', ai: { role: 'antiair', range: [0, 95] }
});
def('lunge', {
  slot: 'basic', name: 'Embestida', weight: 'heavy', startup: 13, active: 4, recovery: 18, motion: [[5, 16, 9]],
  anim: [[0, 'lungeW'], [13, 'lunge', 'snap'], [17, 'lunge'], [35, 'guard', 'inOut']],
  hit: H(80, { stun: 24, kb: [10, 0], box: { joint: 'fHand', r: 19 }, spark: 'heavy' }),
  desc: 'Puñetazo con avance.', ai: { role: 'gap', range: [80, 230] }
});
def('sweep', {
  slot: 'basic', name: 'Barrida', weight: 'heavy', startup: 9, active: 4, recovery: 22,
  anim: [[0, 'crouch'], [9, 'sweep', 'snap'], [13, 'sweep'], [35, 'crouch', 'inOut']],
  hit: H(55, { stun: 20, kb: [3, 0], height: 'low', knockdown: true, box: { joint: 'nFoot', r: 21 } }),
  desc: 'Derriba. Bloquéala agachado.', ai: { role: 'low', range: [0, 120] }
});
def('diveKick', {
  slot: 'basic', name: 'Patada en picado', weight: 'heavy', air: 'only', startup: 6, active: 40, recovery: 8, gravity: 0, untilLand: true,
  motion: [[6, 46, 8, 10]],
  anim: [[0, 'jump'], [6, 'diveKick', 'snap'], [46, 'diveKick'], [54, 'land']],
  hit: H(60, { stun: 18, kb: [5, 0], height: 'high', box: { joint: 'nFoot', r: 20 }, spark: 'medium' }),
  on: { land(f, b, m) { m.f = Math.max(m.f, m.def.startup + m.def.active); f.vx = 0; f.vy = 0; f.grounded = true; b.emit('land', { f }); } },
  desc: 'Picado diagonal que cruza al rival.', ai: { role: 'air', range: [40, 220] }
});
def('dashAttack', {
  slot: 'basic', name: 'Hombrazo', weight: 'medium', startup: 5, active: 6, recovery: 16, motion: [[0, 11, 10]],
  anim: [[0, 'dash'], [5, 'shoulder', 'snap'], [11, 'shoulder'], [27, 'guard']],
  hit: H(55, { stun: 20, kb: [8, 0], box: frontBox(0, -135, 60, 75) }),
  desc: 'Ataque durante el dash.', ai: { role: 'gap', range: [60, 200] }
});

// =====================================================================
// GESTOS VIRALES Y MEMES
// =====================================================================

def('sixSeven', {
  name: 'Six Seven', cost: 15, cd: 30, startup: 7, active: 28, recovery: 14, color: '#ffd166',
  anim: [[0, 'palmsUp'], [7, 'palmsUp'], [35, 'palmsUp'], [49, 'guard']], mods: [[0, 35, 'sixseven']],
  motion: [[7, 35, 1.2]],
  hit: H(10, { stun: 14, kb: [1.6, 0], every: 4, box: frontBox(10, -150, 78, 80), spark: 'light', chip: 0.2 }),
  on: { frame(f, b, m, t) { if (t > 7 && t < 35 && t % 4 === 0) fx(b, 'sixseven', { f, alt: (t / 4) % 2 }); } },
  desc: 'Manos alternando a toda velocidad (6-7). 7 golpes rápidos a corta distancia.', tip: 'Parry en cualquier golpe o sal con dash.',
  ai: { role: 'poke', range: [0, 105] }
});

def('fakeHandshake', {
  name: 'Fake Handshake', cost: 15, cd: 60, startup: 12, active: 6, recovery: 30, color: '#9be7ff',
  anim: [[0, 'guard'], [10, 'offer', 'out'], [18, 'offer'], [48, 'guard']],
  hit: { dmg: 0, grab: true, box: frontBox(20, -150, 80, 120) },
  on: {
    grab(f, b, m, d) {
      // le ofreces la mano; el rival alarga la suya para dártela... y justo antes del contacto la quitas: ¡tortazo!
      const meet = (a, t) => { const j = a.joints; return { x: j.shX + a.facing * 44 * a.scale, y: j.shY + 20 * a.scale }; };
      b.startLock(f, d, {
        frames: 68, off: [92, 0], tpose: t => (t < 24 ? 'reachHand' : t < 44 ? 'graspAir' : 'held'),
        anim: [[0, 'offer'], [22, 'offer'], [26, 'tooSlow', 'snap'], [38, 'tooSlow'], [44, 'slapW', 'out'], [50, 'slap', 'snap'], [58, 'slap'], [68, 'guard', 'inOut']],
        // la mano del atacante se queda quieta ofreciendo hasta el último momento
        hands: (a, t, fr) => {
          if (fr <= 23) { const p = meet(a); return { n: { x: p.x, y: p.y, w: 1 } }; }
          const h = faceHit(a, t, 'n', 49, 58, fr); return h ? { n: h } : null;
        },
        // la del rival se acerca hasta casi tocarla y, cuando la quitas, aprieta el aire
        thands: (a, t, fr) => {
          if (fr > 44) return null;
          const p = meet(a), k = Math.min(1, fr / 24);
          const jt = t.joints, sx = jt.shX - a.facing * 20 * t.scale, sy = jt.shY + 24 * t.scale;
          const gap = fr <= 23 ? 30 * a.scale * (1 - k) + 22 * a.scale : -6 * a.scale; // se queda a un palmo... y luego aprieta el vacío
          return { n: { x: sx + (p.x - a.facing * gap - sx) * k, y: sy + (p.y - sy) * k, w: 1 } };
        },
        frame: (ff, bb, mm, t, tt) => { if (t === 24) { bb.emit('callout', { f: ff, text: '¡DEMASIADO LENTO!', color: '#9be7ff' }); bb.emit('fx', { name: 'tooSlow', f: ff, d: tt }); } },
        hits: [{ f: 50, dmg: 110, spark: 'heavy', fx: 'slap', say: '¡ZAS!', last: true, hitstop: 12, react: 'slapped' }],
        end: { kb: [10, -7], knockdown: true }
      });
      say(b, f, 'FAKE HANDSHAKE', '#9be7ff');
    },
    end(f, b, m) { if (!m.hit) { b.dealDamage(null, f, 15); say(b, f, 'LEFT HANGING', '#888888'); } }
  },
  desc: 'Ofreces la mano; cuando el rival va a dártela, la quitas en el último instante ("¡demasiado lento!") y le cruzas la cara. Agarre: atraviesa el bloqueo.', tip: 'Salta, haz dash o golpéalo mientras ofrece la mano. Si falla, queda colgado y pierde aura.',
  ai: { role: 'grab', range: [0, 105] }
});

def('mewing', {
  name: 'Mewing', cost: 20, cd: 600, startup: 22, active: 1, recovery: 8, buffOnly: true, fragile: true, color: '#9be7ff',
  anim: [[0, 'guard'], [8, 'mew'], [31, 'mew']],
  on: { active(f, b, m) { if (m.data.interrupted) return; f.addStatus('mewing', 360, {}, f); fx(b, 'jawline', { f }); say(b, f, 'MEWING ACTIVADO', '#9be7ff'); } },
  desc: 'Lengua al paladar, mandíbula marcada: defensa +35% y energía pasiva durante 6 s.', tip: 'Golpéalo durante la preparación para cancelarlo.',
  ai: { role: 'buff', range: [250, 2000], status: 'mewing' }
});

def('sigmaStare', {
  name: 'Sigma Stare', cost: 20, cd: 240, startup: 14, active: 30, recovery: 16, color: '#c084fc',
  anim: [[0, 'armsCrossed'], [44, 'armsCrossed'], [60, 'guard']],
  on: {
    frame(f, b, m, t) {
      if (t !== 14) return;
      fx(b, 'stare', { f, len: 560 });
      for (const d of b.enemiesInRange(f, 560, true, 160)) {
        const looking = Math.sign(f.x - d.x) === d.facing;
        const ducked = d.crouching;
        if (!looking || ducked || !d.grounded || d.state === 'dash' || d.isImmune('stareable') || d.hasStatus('npc')) { say(b, d, 'ESQUIVA LA MIRADA', '#aaaaaa', true); continue; }
        d.addStatus('fear', 75, {}, f);
        b.drain(f, d, 45, 'SIGMA STARE', '#c084fc');
        m.hit = true;
      }
    }
  },
  desc: 'Mirada fría de largo alcance: si te mira a los ojos, huye aterrorizado y pierde aura.', tip: 'Agáchate, salta, haz dash o lleva gafas (Deal With It) para no cruzar la mirada.',
  ai: { role: 'zone', range: [60, 540] }
});

def('auraWalk', {
  name: 'Aura Walk', cost: 25, cd: 900, startup: 18, active: 1, recovery: 4, buffOnly: true, color: '#ffd34d',
  anim: [[0, 'guard'], [6, 'strut'], [23, 'strut']], mods: [[0, 23, 'strutArms']],
  on: { active(f, b) { f.addStatus('auraWalk', 300, {}, f); fx(b, 'auraFlare', { f, color: 0xffd34d }); say(b, f, 'AURA WALK', '#ffd34d'); } },
  desc: 'Caminata imparable: velocidad, súper armadura contra golpes ligeros y regeneración de aura (5 s).', tip: 'Golpes fuertes, agarres y proyectiles potentes la atraviesan.',
  ai: { role: 'buff', range: [200, 2000], status: 'auraWalk' }
});

def('siuuu', {
  name: 'SIUUU', cost: 30, cd: 120, startup: 32, active: 8, recovery: 24, color: '#ff4d6d', keepVel: true,
  motion: [[0, 10, 5], [10, 11, 5, -17]], gravity: 1,
  anim: [[0, 'dash'], [10, 'siuSpin'], [30, 'siuSpin'], [32, 'siuLand', 'snap'], [64, 'siuLand']], mods: [[10, 31, 'spin']],
  on: {
    frame(f, b, m, t) {
      if (t > 11 && t < 32 && !f.grounded) { m.f = Math.min(m.f, 30); }
      if (t === 32 || (t > 11 && f.grounded && !m.data.landed)) {
        if (m.data.landed) return;
        m.data.landed = true; m.f = 32; f.vx = 0;
        b.spawnProjectile(f, { kind: 'shockwave', x: f.x, y: GROUND_Y - 20, vx: 0, absVx: true, w: 340, h: 40, life: 8, pierce: true, clash: false,
          hit: H(90, { stun: 26, kb: [9, -6], knockdown: true, height: 'low', spark: 'heavy' }), src: 'siuuu', staleK: m.staleK });
        fx(b, 'siuLand', { f });
      }
    },
    land(f, b, m) { f.vy = 0; }
  },
  desc: 'Carrera, salto con giro y aterrizaje "SIUUU" con onda expansiva en el suelo.', tip: 'Salta en el momento del aterrizaje o bloquea agachado.',
  ai: { role: 'gap', range: [100, 320] }
});

def('rizz', {
  name: 'Rizz', cost: 15, cd: 90, startup: 14, active: 2, recovery: 18, color: '#ff5fa2',
  anim: [[0, 'guard'], [6, 'kiss'], [14, 'kissOut', 'snap'], [34, 'guard']],
  proj: { at: 14, kind: 'heart', speed: 7, oy: -132, w: 30, h: 26, life: 140, hit: H(25, { stun: 10, kb: [1, 0], status: { id: 'charmed', frames: 80 } }) },
  desc: 'Beso volador: el corazón enamora al rival, que camina hacia ti sin poder defenderse.', tip: 'Agáchate (pasa por encima), bloquéalo o reflejalo.',
  ai: { role: 'zone', range: [150, 900] }
});

def('sideEye', {
  name: 'Side Eye', cost: 10, cd: 90, startup: 6, active: 10, recovery: 14, color: '#ffe066',
  anim: [[0, 'sideEye'], [30, 'sideEye']],
  on: {
    frame(f, b, m, t) {
      if (t < 6 || t > 16 || m.data.done) return;
      for (const d of b.enemiesInRange(f, 320, true, 200)) {
        const ph = d.movePhase();
        if ((d.state === 'attack' && d.move && !d.move.def.buffOnly) || d.state === 'dash') {
          m.data.done = true; m.hit = true;
          d.move = null; d.addStatus('caught', 50, {}, f);
          b.drain(f, d, 30, 'SIDE EYE', '#ffe066');
          fx(b, 'sideEye', { f, d });
          void ph;
        }
      }
    }
  },
  desc: 'Mirada de reojo: si el rival está atacando o haciendo dash, queda paralizado y humillado.', tip: 'No ataques mientras te mira de reojo: espera a que termine.',
  ai: { role: 'counter', range: [0, 300], read: true }
});

def('npcMode', {
  name: 'NPC Mode', cost: 20, cd: 600, startup: 10, active: 1, recovery: 4, buffOnly: true, color: '#aaaaaa',
  anim: [[0, 'npc'], [15, 'npc']], mods: [[0, 15, 'robot']],
  on: { active(f, b) { f.addStatus('npc', 240, {}, f); f.addStatus('plotTwist', 240, {}, f); say(b, f, 'NPC MODE', '#cccccc'); } },
  desc: 'Te vuelves un NPC de fondo: los proyectiles te atraviesan, inmune a humillaciones y tu próximo golpe es un giro de guion (+40%).', tip: 'Los golpes cuerpo a cuerpo siguen funcionando.',
  ai: { role: 'buff', range: [300, 2000], status: 'npc' }
});

def('unoReverse', {
  name: 'Uno Reverse', cost: 20, cd: 180, startup: 4, active: 28, recovery: 20, color: '#ff3b3b',
  anim: [[0, 'card'], [52, 'card'], [52, 'guard']],
  counter: {
    from: 3, to: 32, types: ['strike', 'projectile'],
    on(d, a, hit, src, b) {
      if (src.kind === 'projectile') { b.reflect(src.p, d, 1.4); say(b, d, 'UNO REVERSE', '#ff3b3b'); fx(b, 'uno', { f: d }); d.move.f = 32; return true; }
      const dmg = (hit.dmg || 40) * 1.2;
      if (a.move && a.move.lock) b.releaseLock(a, a.move.lock, true);
      a.move = null;
      const ax = a.x; b.teleport(a, d.x); b.teleport(d, ax);
      d.facing = Math.sign(a.x - d.x) || d.facing;
      a.setState('hitstun'); a.hitstun = 30;
      b.dealDamage(d, a, dmg);
      a.addStatus('dizzy', 30, {}, d);
      say(b, d, 'UNO REVERSE', '#ff3b3b'); fx(b, 'uno', { f: d });
      d.move.f = 32;
      return true;
    }
  },
  desc: 'Sacas la carta: devuelve los golpes al atacante (y os intercambia) o refleja proyectiles.', tip: 'Los agarres la atraviesan; espera a que la guarde.',
  ai: { role: 'counter', range: [0, 700] }
});

def('broReallyThought', {
  name: 'Bro Really Thought', cost: 0, cd: 240, startup: 10, active: 40, recovery: 10, taunt: true, color: '#ffcc00',
  anim: [[0, 'pointLaugh'], [60, 'pointLaugh']], mods: [[0, 60, 'laugh']],
  on: {
    active(f, b, m) {
      let any = false;
      for (const d of b.enemiesInRange(f, 420, false, 250)) {
        if (b.isVulnerableForHumiliation(d)) { if (b.drain(f, d, 85, 'BRO REALLY THOUGHT 💀', '#ffcc00')) { d.gainEnergy(-20); any = true; } }
      }
      if (!any) { f.gainEnergy(15); say(b, f, '+ENERGÍA', '#ffcc00', true); } else m.hit = true;
    }
  },
  desc: 'Te ríes señalando: si el rival acaba de fallar un ataque o está derribado/aturdido, pierde mucha aura y energía.', tip: 'No falles ataques cerca de él; si se ríe en neutral, castígalo.',
  ai: { role: 'humiliate', range: [0, 420] }
});

def('nahIdWin', {
  name: "Nah I'd Win", cost: 30, cd: 60, once: true, startup: 20, active: 1, recovery: 10, buffOnly: true, color: '#ffcc33',
  cond: f => f.auraPct < 0.4, condText: 'NECESITAS <40% AURA',
  anim: [[0, 'guard'], [10, 'nahWin'], [31, 'nahWin']],
  on: { active(f, b) { f.heal(120); f.addStatus('nahIdWin', 480, {}, f); fx(b, 'auraFlare', { f, color: 0xffcc33, big: true }); say(b, f, "NAH, I'D WIN", '#ffcc33'); } },
  desc: 'Remontada: con menos del 40% de aura recuperas 120 y haces +30% de daño durante 8 s. Una vez por ronda.', tip: 'Presiónalo antes de que llegue al 40%.',
  ai: { role: 'comeback', range: [250, 2000] }
});

def('chillGuy', {
  name: 'Chill Guy', cost: 20, cd: 900, startup: 14, active: 1, recovery: 6, buffOnly: true, color: '#7fd6a0',
  anim: [[0, 'guard'], [10, 'pockets'], [21, 'pockets']],
  on: { active(f, b) { f.addStatus('chill', 420, {}, f); say(b, f, 'JUST A CHILL GUY', '#7fd6a0'); fx(b, 'chill', { f }); } },
  desc: 'Manos en los bolsillos: regeneras aura mientras no te golpeen y eres inmune a miedo, rizz y tilt (7 s).', tip: 'Presión constante: la regeneración se corta al recibir golpes.',
  ai: { role: 'buff', range: [300, 2000], status: 'chill' }
});

def('noReaction', {
  name: 'No Reaction', cost: 20, cd: 240, startup: 3, active: 48, recovery: 12, color: '#dddddd',
  anim: [[0, 'blank'], [63, 'blank']],
  counter: {
    from: 3, to: 51, types: ['strike', 'projectile'],
    on(d, a, hit, src, b) {
      const dmg = (hit.dmg || 30) * 0.25;
      b.dealDamage(a, d, dmg);
      if (src.kind === 'projectile') src.p.dead = true;
      else { if (a.move && a.move.lock) b.releaseLock(a, a.move.lock, true); a.move = null; a.addStatus('dizzy', 24, {}, d); }
      b.drain(d, a, 55, 'NO REACTION', '#dddddd');
      d.flash = 4;
      d.move.f = 51;
      return true;
    }
  },
  desc: 'Cara de póker absoluta: absorbes el golpe sin inmutarte (25% de daño) y el atacante se avergüenza y pierde aura.', tip: 'Agárralo o espera a que termine.',
  ai: { role: 'counter', range: [0, 200] }
});

def('fakeHighFive', {
  name: 'Fake High Five', cost: 15, cd: 150, startup: 8, active: 70, recovery: 14, color: '#ffd166',
  anim: [[0, 'highFive'], [92, 'highFive']],
  counter: {
    from: 8, to: 78, types: ['strike', 'grab'],
    on(d, a, hit, src, b) { trigger(d, a, b); return true; }
  },
  on: {
    frame(f, b, m, t) {
      if (t < 8 || t > 78 || m.data.fired) return;
      const d = first(b, f, 115);
      if (d && d.grounded) trigger(f, d, b);
    }
  },
  desc: 'Ofreces chocar los cinco: si se acerca o te ataca, retiras la mano ("too slow") y le cruzas la cara.', tip: 'No te acerques: atácalo con un proyectil o espera.',
  ai: { role: 'trap', range: [0, 300] }
});
function trigger(f, d, b) {
  const m = f.move; if (!m || m.data.fired) return;
  m.data.fired = true;
  f.invuln = 12; f.invulnType = 'all';
  f.startMove('tooSlow', { free: true });
  say(b, f, 'TOO SLOW', '#ffd166');
  void d;
}
def('tooSlow', {
  slot: 'hidden', name: 'Too Slow', startup: 6, active: 4, recovery: 14, motion: [[0, 4, -6], [4, 8, 6]],
  anim: [[0, 'backhand'], [6, 'slap', 'snap'], [10, 'slap'], [24, 'guard']],
  hit: H(75, { stun: 26, kb: [8, -5], knockdown: true, box: frontBox(0, -160, 95, 80), spark: 'heavy', fx: 'slap' }),
  ai: { role: 'none', range: [0, 100] }
});

def('invisibleDap', {
  name: 'Invisible Dap', cost: 12, cd: 50, startup: 9, active: 2, recovery: 14, color: '#e0e0ff',
  anim: [[0, 'dapW'], [9, 'dap', 'snap'], [25, 'guard']],
  proj: { at: 9, kind: 'invisible', speed: 11, oy: -118, w: 34, h: 36, life: 90, invisible: true, hit: H(45, { stun: 18, kb: [5, 0] }) },
  desc: 'Un dap invisible que viaja por el aire. Casi no se ve.', tip: 'Atento a la distorsión del aire: bloquea o salta.',
  ai: { role: 'zone', range: [120, 900] }
});

def('noLook360', {
  name: '360 No Look', cost: 20, cd: 90, startup: 18, active: 6, recovery: 16, color: '#7df9ff', passThrough: true,
  invuln: [3, 15], invulnType: 'strike', motion: [[2, 16, 10]],
  anim: [[0, 'guard'], [2, 'siuSpin'], [16, 'siuSpin'], [18, 'backhand', 'snap'], [24, 'backhand'], [40, 'guard']], mods: [[2, 18, 'spin']],
  on: { frame(f, b, m, t) { if (t === 17) { const d = b.targetFor(f); if (d && Math.sign(d.x - f.x) !== f.facing) m.data.cross = true; } } },
  hit: H(75, { stun: 24, kb: [-8, -4], box: frontBox(-110, -165, 100, 90), spark: 'heavy' }),
  desc: 'Giro de 360° atravesando al rival y golpe de revés sin mirar. Ataca por la espalda.', tip: 'Bloquea tarde (se gira tras pasarte) o golpéalo antes del giro.',
  ai: { role: 'gap', range: [40, 170] }
});

def('disrespectfulDodge', {
  name: 'Disrespectful Dodge', cost: 10, cd: 60, startup: 1, active: 26, recovery: 14, color: '#a0ffa0',
  invuln: [1, 26], invulnType: 'high',
  anim: [[0, 'matrix', 'snap'], [27, 'matrix'], [41, 'guard']],
  on: {
    dodge(f, b, m, a) {
      if (m.data.dissed) return; m.data.dissed = true;
      f.gainEnergy(20);
      b.drain(f, a, 40, 'DISRESPECT', '#a0ffa0');
    }
  },
  desc: 'Esquiva estilo Matrix inclinándote hacia atrás. Si esquivas algo, el rival pierde aura.', tip: 'Los ataques bajos la atraviesan.',
  ai: { role: 'dodge', range: [0, 300] }
});

def('reverseAura', {
  name: 'Reverse Aura', cost: 25, cd: 300, startup: 14, active: 6, recovery: 18, color: '#9933ff',
  anim: [[0, 'pray'], [14, 'kissOut', 'snap'], [38, 'guard']],
  proj: { at: 14, kind: 'spiral', speed: 6, oy: -110, w: 60, h: 80, life: 34, hit: H(40, { stun: 14, kb: [2, 0], status: { id: 'inverted', frames: 200 } }) },
  desc: 'Espiral oscura de corto alcance: invierte los controles izquierda/derecha del rival durante 3 s.', tip: 'Bloquéala o esquívala con dash.',
  ai: { role: 'zone', range: [60, 220] }
});

def('dramaticEntrance', {
  name: 'Dramatic Entrance', cost: 30, cd: 300, startup: 64, active: 6, recovery: 26, color: '#ff7b00', gravity: 0,
  invuln: [1, 62],
  anim: [[0, 'jump'], [8, 'jump'], [62, 'diveKick'], [66, 'heroLand', 'snap'], [96, 'heroLand']],
  on: {
    start(f, b, m) { m.data.tx = f.x; },
    frame(f, b, m, t) {
      if (t < 12) { f.vy = -26; f.grounded = false; f.vx = 0; }
      else if (t === 12) { f.visible = false; f.vy = 0; f.y = GROUND_Y - 900; }
      if (t >= 12 && t < 50) { const d = b.targetFor(f); if (d) m.data.tx += (d.x - m.data.tx) * 0.2; }
      if (t >= 12 && t < 62) fx(b, 'shadow', { x: m.data.tx, lock: t >= 50 });
      if (t === 60) { f.visible = true; f.x = m.data.tx; f.y = GROUND_Y - 300; f.vy = 50; }
      if (t > 60 && t < 64) f.vy = 50;
      if (t === 64 || (t > 60 && f.grounded && !m.data.hit)) {
        if (m.data.hit) return; m.data.hit = true; m.f = 64;
        f.y = GROUND_Y; f.grounded = true; f.vy = 0;
        b.spawnProjectile(f, { kind: 'shockwave', x: f.x, y: GROUND_Y - 40, absVx: true, vx: 0, w: 260, h: 90, life: 6, pierce: true, clash: false,
          hit: H(110, { stun: 26, kb: [9, -8], knockdown: true, spark: 'mega' }), src: 'dramaticEntrance', staleK: m.staleK });
        fx(b, 'heroLand', { f });
      }
    },
    end(f) { f.visible = true; }
  },
  desc: 'Sales volando de la pantalla y caes como un superhéroe donde está el rival.', tip: 'Cuando la sombra se fija, muévete o haz dash.',
  ai: { role: 'zone', range: [200, 1500] }
});

def('phantomDap', {
  name: 'Phantom Dap', cost: 25, cd: 150, startup: 16, active: 20, recovery: 14, color: '#b9a7ff',
  anim: [[0, 'pray'], [16, 'dap', 'snap'], [50, 'guard']],
  proj: { at: [16, 24, 32], kind: 'ghost', speed: 12, oy: -80, w: 46, h: 140, life: 80, hit: H(30, { stun: 14, kb: [3, 0] }) },
  desc: 'Tres stickmans fantasma salen corriendo a darle un dap al rival.', tip: 'Salta por encima o refléjalos.',
  ai: { role: 'zone', range: [120, 900] }
});

def('emoteCancel', {
  name: 'Emote Cancel', cost: 25, cd: 30, startup: 6, active: 1, recovery: 2, buffOnly: true, color: '#ffffff',
  anim: [[0, 'flex', 'snap'], [9, 'guard']],
  on: {
    start(f, b, m) {
      f.vx = 0;
      if (!f.grounded) { f.vy = Math.min(f.vy, -2); }
      say(b, f, 'EMOTE CANCEL', '#ffffff', true);
      fx(b, 'emote', { f });
    }
  },
  desc: 'Cancela cualquier ataque al instante con un emote. En neutral sirve de finta.', tip: 'Cuidado con las fintas: no gastes el parry antes de tiempo.',
  ai: { role: 'feint', range: [60, 250] }
});

def('infiniteMewing', {
  name: 'Infinite Mewing', cost: 45, cd: 1800, startup: 26, active: 1, recovery: 8, buffOnly: true, fragile: true, color: '#6fd8ff',
  anim: [[0, 'guard'], [10, 'gigachad'], [35, 'gigachad']],
  on: { active(f, b, m) { if (m.data.interrupted) return; f.addStatus('infMewing', 600, {}, f); fx(b, 'jawline', { f, big: true }); say(b, f, 'INFINITE MEWING', '#6fd8ff'); } },
  desc: 'Mewing definitivo: defensa +50%, regeneración y energía durante 10 s.', tip: 'Interrúmpelo durante la preparación.',
  ai: { role: 'buff', range: [350, 2000], status: 'infMewing' }
});

def('auraTheft', {
  name: 'Aura Theft', cost: 25, cd: 120, startup: 12, active: 4, recovery: 18, color: '#ffd700',
  anim: [[0, 'charge'], [12, 'slap', 'snap'], [34, 'guard']],
  hit: H(60, { stun: 22, kb: [4, 0], box: frontBox(10, -150, 80, 70), spark: 'medium' }),
  on: { hit(f, b, m, d) { f.heal(60); const e = Math.min(20, d.energy); d.gainEnergy(-e); f.gainEnergy(e); fx(b, 'theft', { a: f, f: d }); say(b, f, 'AURA ROBADA', '#ffd700'); } },
  desc: 'Palmada que roba aura (te curas 60) y 20 de energía.', tip: 'Bloquéala o castiga su lenta recuperación.',
  ai: { role: 'poke', range: [0, 100] }
});

def('sigmaTeleport', {
  name: 'Sigma Teleport', cost: 25, cd: 120, startup: 16, active: 4, recovery: 16, color: '#c084fc',
  invuln: [1, 9],
  anim: [[0, 'armsCrossed'], [9, 'armsCrossed'], [10, 'dapW'], [16, 'shoulder', 'snap'], [36, 'guard']],
  on: {
    frame(f, b, m, t) {
      if (t === 2) f.visible = false;
      if (t === 9) {
        const d = b.targetFor(f);
        if (d) { const side = d.facing; b.teleport(f, d.x - side * 70); f.facing = Math.sign(d.x - f.x) || f.facing; }
        f.visible = true;
      }
    },
    end(f) { f.visible = true; }
  },
  hit: H(65, { stun: 22, kb: [8, -4], box: frontBox(0, -150, 75, 80), spark: 'heavy' }),
  desc: 'Desapareces y reapareces a la espalda del rival con un codazo.', tip: 'Date la vuelta y bloquea, o salta: el codazo tarda en salir.',
  ai: { role: 'gap', range: [100, 900] }
});

def('crowdControl', {
  name: 'Crowd Control', cost: 30, cd: 300, startup: 20, active: 30, recovery: 10, color: '#ffa94d',
  anim: [[0, 'guard'], [10, 'conduct'], [60, 'conduct']], mods: [[10, 60, 'conduct']],
  on: {
    frame(f, b, m, t) {
      if (t === 20) b.emit('crowd', { f, mood: 'throw' });
      if (t >= 20 && t < 50 && t % 4 === 0) {
        const d = b.targetFor(f); if (!d) return;
        const x = d.x + (b.rand() - 0.5) * 220 + d.vx * 12;
        b.spawnProjectile(f, { kind: b.rand() < 0.5 ? 'tomato' : 'shoe', x, y: GROUND_Y - 760, absVx: true, vx: (b.rand() - 0.5) * 2, vy: 9, gravity: 0.25, w: 26, h: 26, life: 140, fromAbove: true,
          hit: H(18, { stun: 12, kb: [1, 0] }), src: 'crowdControl', staleK: m.staleK });
      }
    }
  },
  desc: 'Diriges al público: lanza tomates y zapatillas sobre el rival.', tip: 'Bloquea o sal corriendo de la lluvia de objetos.',
  ai: { role: 'zone', range: [150, 1500] }
});

def('skibidiSpin', {
  name: 'Skibidi Spin', cost: 20, cd: 90, startup: 8, active: 30, recovery: 14, color: '#7df9ff',
  motion: [[8, 38, 2.5]],
  anim: [[0, 'guard'], [8, 'tPose'], [38, 'tPose'], [52, 'guard']], mods: [[8, 38, 'spin']],
  hit: H(14, { stun: 14, kb: [2, 0], every: 6, box: { around: true, w: 150, h: 120, y: -40 }, spark: 'light' }),
  desc: 'Giro en T que golpea a ambos lados 5 veces.', tip: 'Bloquéalo y castiga al final.',
  ai: { role: 'pressure', range: [0, 110] }
});

def('griddy', {
  name: 'Griddy', cost: 15, cd: 60, startup: 6, active: 26, recovery: 14, color: '#50fa7b',
  motion: [[6, 32, 7]],
  anim: [[0, 'guard'], [6, 'idle'], [32, 'idle'], [46, 'guard']], mods: [[6, 32, 'griddy']],
  hit: H(50, { stun: 20, kb: [3, 0], height: 'low', knockdown: true, maxHits: 1, box: frontBox(0, -40, 60, 40) }),
  desc: 'Bailas el Griddy hacia delante y le pisas los tobillos: derriba (bajo).', tip: 'Bloquea agachado o salta.',
  ai: { role: 'low', range: [60, 220] }
});

def('hitTheWoah', {
  name: 'Hit the Woah', cost: 8, cd: 24, startup: 5, active: 4, recovery: 12, color: '#8be9fd',
  anim: [[0, 'wave'], [5, 'slap', 'snap'], [9, 'slap'], [21, 'guard']],
  hit: H(45, { stun: 20, kb: [6, 0], box: frontBox(10, -170, 90, 70), spark: 'medium' }),
  desc: 'Barrido de brazo rápido estilo "woah". Gran herramienta de presión.', tip: 'Bloquéalo o agáchate (golpea alto).',
  ai: { role: 'poke', range: [0, 110] }
});

def('flossShield', {
  name: 'Floss Shield', cost: 15, cd: 150, startup: 3, active: 50, recovery: 10, color: '#ff79c6',
  anim: [[0, 'idle'], [63, 'idle']], mods: [[0, 53, 'floss']],
  counter: {
    from: 3, to: 53, types: ['projectile', 'strike'],
    on(d, a, hit, src, b) {
      if (src.kind === 'projectile') { b.reflect(src.p, d, 1.2); say(b, d, 'FLOSS REFLECT', '#ff79c6', true); return true; }
      if ((hit.dmg || 0) > 70) return false;
      b.block(d, a, hit, src); d.move.f = 53; d.setState('attack'); d.state = 'attack'; return true;
    }
  },
  desc: 'Bailas el Floss: reflejas proyectiles y bloqueas golpes ligeros por ambos lados.', tip: 'Los golpes fuertes y agarres lo rompen.',
  ai: { role: 'counter', range: [200, 900], vsProj: true }
});

def('dabOn', {
  name: 'Dab On Them', cost: 15, cd: 60, startup: 10, active: 6, recovery: 16, color: '#50fa7b',
  motion: [[10, 16, 9]],
  anim: [[0, 'dab', 'snap'], [10, 'dab'], [12, 'shoulder', 'snap'], [16, 'shoulder'], [32, 'guard']],
  hit: H(60, { stun: 22, kb: [7, 0], box: frontBox(0, -150, 70, 80), status: { id: 'tilted', frames: 300 } }),
  desc: 'Dab y codazo en carrera: el rival queda tilteado (gana la mitad de energía).', tip: 'Bloquéalo; es lento de recuperar.',
  ai: { role: 'gap', range: [60, 180] }
});

def('sheesh', {
  name: 'SHEEESH', cost: 20, cd: 90, startup: 12, active: 4, recovery: 18, color: '#00e5ff',
  charge: { at: 10, max: 60 },
  anim: [[0, 'charge'], [12, 'armsUp', 'snap'], [34, 'guard']], mods: [[0, 11, 'tremble']],
  proj: {
    at: 12,
    make(f, b, m) {
      const c = m.charge / 60;
      return { kind: 'sheesh', speed: 9 + c * 5, oy: -120, w: 50 + c * 50, h: 60 + c * 70, life: 90, data: { charge: c },
        hit: H(40 + c * 70, { stun: 18 + c * 10, kb: [5 + c * 6, c > 0.8 ? -6 : 0], knockdown: c > 0.8, spark: c > 0.6 ? 'heavy' : 'medium' }) };
    }
  },
  desc: 'Mantén el botón para cargar el SHEEESH: onda sonora que crece con la carga.', tip: 'Interrumpe la carga o salta la onda.',
  ai: { role: 'zone', range: [150, 1000] }
});

def('ratio', {
  name: 'Ratio', cost: 15, cd: 90, startup: 10, active: 4, recovery: 14, color: '#3fa9f5',
  anim: [[0, 'guard'], [10, 'point', 'snap'], [28, 'guard']],
  proj: {
    at: 10, count: 3,
    make: (f, b, m, i) => ({ kind: 'ratio', speed: 10, vy: (i - 1) * 1.1, oy: -125, w: 26, h: 26, life: 80,
      hit: H(14, { stun: 10, kb: [1, 0] }),
      onHit: (bb, p, d) => { const s = d.hasStatus('ratio'); const n = s ? Math.min(5, (s.data.stacks || 1) + 1) : 1; d.addStatus('ratio', 300, { stacks: n }, p.owner); } })
  },
  desc: 'Tres flechas "+1" en abanico. Cada impacto acumula Ratio: el rival recibe más daño.', tip: 'Bloquea o salta entre las flechas.',
  ai: { role: 'zone', range: [120, 800] }
});

def('lBozo', {
  name: 'L + Bozo', cost: 0, cd: 200, startup: 8, active: 40, recovery: 8, taunt: true, color: '#ff5555',
  anim: [[0, 'lForehead'], [56, 'lForehead']], mods: [[0, 56, 'bob']],
  on: {
    active(f, b, m) {
      let any = false;
      for (const d of b.enemiesInRange(f, 380, false, 250)) {
        if (d.state === 'knockdown' || d.controlStatus() || d.state === 'hitstun') { if (b.drain(f, d, 60, 'L + BOZO', '#ff5555')) { d.addStatus('tilted', 300, {}, f); any = true; } }
      }
      if (!any) f.gainEnergy(12); else m.hit = true;
    }
  },
  desc: 'L en la frente: si el rival está en el suelo o aturdido, pierde aura y queda tilteado.', tip: 'Levántate rápido (dash al caer) y castígalo.',
  ai: { role: 'humiliate', range: [0, 380] }
});

def('fanumTax', {
  name: 'Fanum Tax', cost: 0, cd: 300, startup: 6, active: 4, recovery: 16, color: '#ffb86c',
  anim: [[0, 'guard'], [6, 'slap', 'snap'], [26, 'guard']], motion: [[2, 8, 7]],
  hit: { dmg: 25, grab: true, box: frontBox(10, -150, 70, 100) },
  on: {
    grab(f, b, m, d) {
      const e = Math.min(30, d.energy);
      d.gainEnergy(-e); f.gainEnergy(e);
      b.dealDamage(f, d, 25);
      d.setState('hitstun'); d.hitstun = 16; d.vx = f.facing * 4;
      m.hit = true;
      fx(b, 'theft', { a: f, f: d, energy: true });
      say(b, f, `FANUM TAX -${Math.round(e)}`, '#ffb86c');
    }
  },
  desc: 'Robo rápido de 30 de energía. Atraviesa el bloqueo.', tip: 'Salta o haz dash; si falla queda expuesto.',
  ai: { role: 'grab', range: [0, 110] }
});

def('ohioMode', {
  name: 'Ohio Mode', cost: 25, cd: 240, startup: 16, active: 1, recovery: 16, color: '#7cfc00',
  anim: [[0, 'guard'], [8, 'armsUp'], [33, 'guard']], mods: [[0, 16, 'jitter']],
  on: {
    active(f, b, m) {
      const d = b.targetFor(f); if (!d) return;
      const r = Math.floor(b.rand() * 6);
      fx(b, 'ohio', { f, r });
      if (r === 0) { b.spawnProjectile(f, { kind: 'bighand', x: d.x, y: GROUND_Y - 80, absVx: true, vx: 0, w: 140, h: 160, life: 12, delay: 30, track: d, trackFor: 20, pierce: true, hit: H(90, { stun: 24, kb: [2, 0], knockdown: true, spark: 'heavy' }), src: 'ohioMode' }); say(b, f, 'MANO GIGANTE', '#7cfc00'); }
      if (r === 1) { if (d.grounded && d.state !== 'locked') { d.setState('airhit'); d.grounded = false; d.vy = -16; d.vx = 0; d.y -= 2; d.knockdownOnLand = true; say(b, d, 'GRAVEDAD OHIO', '#7cfc00'); } }
      if (r === 2) { b.spawnProjectile(f, { kind: 'lightning', x: d.x, y: GROUND_Y - 300, absVx: true, vx: 0, w: 60, h: 600, life: 10, delay: 26, track: d, trackFor: 14, pierce: true, hit: H(70, { stun: 26, kb: [2, 0], status: { id: 'dizzy', frames: 30 } }), src: 'ohioMode' }); say(b, f, 'RAYO', '#7cfc00'); }
      if (r === 3) { const x = f.x; b.teleport(f, d.x); b.teleport(d, x); say(b, f, 'INTERCAMBIO', '#7cfc00'); }
      if (r === 4) { f.heal(70); say(b, f, '+70 AURA', '#7cfc00'); }
      if (r === 5) { b.spawnProjectile(f, { kind: 'banana', x: d.x, y: GROUND_Y - 10, absVx: true, vx: 0, w: 40, h: 20, life: 300, delay: 4, pierce: false, hit: H(40, { stun: 20, kb: [2, 0], knockdown: true, height: 'low' }), src: 'ohioMode' }); say(b, f, 'PLÁTANO', '#7cfc00'); }
    }
  },
  desc: 'Algo raro pasa en Ohio: efecto aleatorio entre seis (mano gigante, gravedad, rayo, intercambio, curación, plátano).', tip: 'Imprevisible: mantente en movimiento.',
  ai: { role: 'zone', range: [0, 1500] }
});

def('mainCharacter', {
  name: 'Main Character', cost: 20, cd: 600, startup: 16, active: 1, recovery: 8, buffOnly: true, color: '#fff2a8',
  anim: [[0, 'guard'], [8, 'armsUp'], [25, 'flex']],
  on: { active(f, b) { f.addStatus('mainChar', 360, {}, f); b.emit('crowd', { f, mood: 'cheer' }); fx(b, 'spotlight', { f }); say(b, f, 'MAIN CHARACTER', '#fff2a8'); } },
  desc: 'Foco y ovación: +15% de daño y +50% de energía durante 6 s.', tip: 'Defiéndete hasta que se apague el foco.',
  ai: { role: 'buff', range: [300, 2000], status: 'mainChar' }
});

def('delulu', {
  name: 'Delulu', cost: 20, cd: 300, startup: 6, active: 1, recovery: 4, buffOnly: true, color: '#ff77cc',
  anim: [[0, 'guard'], [11, 'backdash']], motion: [[6, 11, -12]],
  on: { active(f, b) { b.spawnDecoy(f); f.invuln = 10; f.alpha = 0.6; say(b, f, 'DELULU', '#ff77cc', true); }, end(f) { f.alpha = 1; } },
  desc: 'Dejas un clon ilusorio en tu lugar y retrocedes. Si el rival lo golpea, explota y lo marea.', tip: 'El clon no se mueve ni ataca: fíjate en quién se mueve.',
  ai: { role: 'escape', range: [0, 200] }
});

def('touchGrass', {
  name: 'Touch Grass', cost: 20, cd: 150, startup: 12, active: 2, recovery: 16, color: '#33dd55',
  anim: [[0, 'guard'], [12, 'crouchPoint', 'snap'], [30, 'guard']],
  on: {
    active(f, b, m) {
      const d = b.targetFor(f); if (!d) return;
      b.spawnProjectile(f, { kind: 'grass', x: d.x, y: GROUND_Y - 35, absVx: true, vx: 0, w: 130, h: 70, life: 14, delay: 26, track: d, trackFor: 14, pierce: true, clash: false,
        hit: H(60, { stun: 20, kb: [1, -6], height: 'low', status: { id: 'rooted', frames: 90 } }), src: 'touchGrass', staleK: m.staleK });
    }
  },
  desc: 'Haces brotar césped bajo el rival: lo lanza y lo deja enraizado (no puede moverse).', tip: 'Muévete en cuanto veas el césped temblar, o bloquea agachado.',
  ai: { role: 'zone', range: [150, 1200] }
});

def('bombasticSideEye', {
  name: 'Bombastic Side Eye', cost: 25, cd: 150, startup: 18, active: 8, recovery: 16, color: '#ffe066',
  anim: [[0, 'sideEye'], [42, 'sideEye']],
  on: {
    frame(f, b, m, t) {
      if (t === 18) {
        fx(b, 'eyeBeam', { f, len: 900 });
        for (const d of b.enemiesInRange(f, 900, true, 120)) {
          if (d.crouching || !d.grounded && d.y < GROUND_Y - 120) continue;
          const r = b.resolveHit(f, d, H(55, { stun: 20, kb: [5, 0], status: { id: 'tilted', frames: 240 }, spark: 'medium' }), { kind: 'strike', move: m });
          if (r === 'hit') m.hit = true;
        }
      }
    }
  },
  desc: 'Rayo de mirada de reojo que cruza todo el escenario a la altura de la cabeza.', tip: 'Agáchate o salta por encima.',
  ai: { role: 'zone', range: [150, 900] }
});

def('caughtIn4K', {
  name: 'Caught in 4K', cost: 15, cd: 150, startup: 10, active: 6, recovery: 14, color: '#ffffff',
  anim: [[0, 'phone'], [30, 'phone']],
  on: {
    frame(f, b, m, t) {
      if (t !== 10) return;
      fx(b, 'flash4k', { f });
      for (const d of b.enemiesInRange(f, 300, true, 220)) {
        if (d.state === 'attack' || d.state === 'dash' || d.state === 'air') {
          d.move = null; d.addStatus('caught', 60, {}, f); b.dealDamage(f, d, 40); m.hit = true;
          say(b, d, 'CAUGHT IN 4K 📸', '#ffffff');
          if (d.isHuman) b.emit('blind', { f: d });
        }
      }
    }
  },
  desc: 'Foto con flash: si el rival estaba atacando, saltando o haciendo dash, queda "pillado" y aturdido.', tip: 'Quédate quieto o bloquea cuando saque el móvil.',
  ai: { role: 'counter', range: [0, 300], read: true }
});

def('letHimCook', {
  name: 'Let Him Cook', cost: 0, cd: 600, startup: 50, active: 1, recovery: 6, buffOnly: true, fragile: true, color: '#ff8844',
  anim: [[0, 'stir'], [57, 'stir']], mods: [[0, 50, 'stir']],
  on: { active(f, b, m) { if (m.data.interrupted) { say(b, f, 'SE QUEMÓ', '#888888', true); return; } f.addStatus('cooking', 600, {}, f); say(b, f, 'LET HIM COOK', '#ff8844'); fx(b, 'cook', { f }); } },
  desc: 'Remueves la olla: tu siguiente especial o ultimate hace x1.5 de daño y cuesta la mitad.', tip: 'Golpéalo mientras cocina para quemar el plato.',
  ai: { role: 'buff', range: [450, 2000], status: 'cooking' }
});

def('cooked', {
  name: "You're Cooked", cost: 30, cd: 240, startup: 10, active: 6, recovery: 22, color: '#ff5500',
  motion: [[4, 12, 8]],
  anim: [[0, 'guard'], [10, 'slap', 'snap'], [38, 'guard']],
  hit: { dmg: 0, grab: true, box: frontBox(10, -150, 80, 110) },
  on: {
    grab(f, b, m, d) {
      if (d.auraPct > 0.3) { b.dealDamage(f, d, 30); d.setState('hitstun'); d.hitstun = 14; say(b, f, 'NO ESTÁ COCINADO', '#888888', true); m.hit = true; return; }
      b.startLock(f, d, {
        frames: 60, off: [74, 0], tpose: 'held', cine: true,
        anim: [[0, 'bonkW'], [20, 'bonkW'], [26, 'bonk', 'snap'], [44, 'bonkW'], [50, 'bonk', 'snap'], [60, 'bonk']],
        hands: (a, t, fr) => { const w1 = faceHit(a, t, 'n', 25, 32, fr, 'top') || faceHit(a, t, 'n', 49, 60, fr, 'top'); return w1 ? { n: w1 } : null; },
        hits: [{ f: 26, dmg: 50, spark: 'heavy', fx: 'pan' }, { f: 50, dmg: 90, spark: 'mega', fx: 'pan', say: 'COOKED 🍳', last: true }],
        end: { kb: [9, -8], knockdown: true }
      });
    }
  },
  desc: 'Remate: si el rival tiene menos del 30% de aura, lo agarra y lo sartenea (140). Atraviesa bloqueo.', tip: 'Por encima del 30% solo hace un golpecito.',
  ai: { role: 'finisher', range: [0, 130] }
});

def('gigachadJaw', {
  name: 'Gigachad Jaw', cost: 15, cd: 60, startup: 14, active: 4, recovery: 18, color: '#d0d0d0',
  armor: [4, 14], motion: [[12, 18, 6]],
  anim: [[0, 'gigachad'], [12, 'gigachad'], [14, 'headbutt', 'snap'], [18, 'headbutt'], [36, 'guard']],
  hit: H(90, { stun: 24, kb: [9, -3], box: { joint: 'head', r: 26 }, spark: 'heavy' }),
  desc: 'Cabezazo con mandíbula de acero. Súper armadura durante la carga.', tip: 'Agárralo o haz dash hacia atrás.',
  ai: { role: 'heavy', range: [0, 120] }
});

def('mog', {
  name: 'Mog', cost: 15, cd: 300, startup: 20, active: 10, recovery: 10, color: '#555577',
  anim: [[0, 'guard'], [12, 'tall'], [40, 'tall']],
  on: {
    active(f, b, m) {
      fx(b, 'mog', { f });
      for (const d of b.enemiesInRange(f, 420, false, 200)) {
        if (d.hasStatus('auraWalk') || d.hasStatus('mainChar') || d.hasStatus('infMewing')) { say(b, d, 'NO SE DEJA MOGGEAR', '#aaaaaa', true); continue; }
        d.addStatus('mogged', 300, {}, f); b.drain(f, d, 25, 'MOGGED', '#9999bb'); m.hit = true;
      }
    }
  },
  desc: 'Te estiras y lo miras desde arriba: el rival hace -20% de daño durante 5 s.', tip: 'Aura Walk, Main Character o Infinite Mewing lo anulan.',
  ai: { role: 'debuff', range: [0, 420] }
});

def('susVent', {
  name: 'Sus Vent', cost: 25, cd: 180, startup: 44, active: 6, recovery: 20, color: '#ff3b3b',
  invuln: [4, 40],
  anim: [[0, 'vent'], [6, 'vent'], [40, 'vent'], [44, 'uppercut', 'snap'], [70, 'guard']],
  on: {
    frame(f, b, m, t) {
      if (t === 6) { f.visible = false; fx(b, 'vent', { x: f.x }); }
      if (t > 6 && t < 30) { const d = b.targetFor(f); if (d) m.data.tx = d.x; }
      if (t === 30) fx(b, 'vent', { x: m.data.tx ?? f.x, warn: true });
      if (t === 40) { f.x = m.data.tx ?? f.x; f.visible = true; const d = b.targetFor(f); if (d) f.facing = Math.sign(d.x - f.x) || f.facing; fx(b, 'vent', { x: f.x }); }
    },
    end(f) { f.visible = true; }
  },
  hit: H(60, { stun: 20, kb: [2, -14], launch: true, box: frontBox(-40, -170, 110, 170), spark: 'heavy' }),
  desc: 'Te metes por una rejilla y sales justo debajo del rival con un uppercut lanzador.', tip: 'Cuando aparezca la rejilla bajo tus pies, apártate.',
  ai: { role: 'zone', range: [150, 1200] }
});

def('emotionalDamage', {
  name: 'Emotional Damage', cost: 15, cd: 120, startup: 12, active: 2, recovery: 16, color: '#ff4d6d',
  anim: [[0, 'guard'], [12, 'point', 'snap'], [30, 'guard']],
  proj: { at: 12, kind: 'brokenHeart', speed: 5, oy: -125, w: 36, h: 32, life: 200, hit: H(35, { stun: 16, kb: [2, 0] }), onHit: (b, p, d) => { d.gainEnergy(-25); b.emit('callout', { f: d, text: 'EMOTIONAL DAMAGE', color: '#ff4d6d' }); } },
  desc: 'Corazón roto lento que daña y quita 25 de energía.', tip: 'Es lento: esquívalo saltando o agáchate.',
  ai: { role: 'zone', range: [150, 900] }
});

def('bonk', {
  name: 'Bonk', cost: 15, cd: 60, startup: 18, active: 4, recovery: 18, color: '#d6a46b',
  anim: [[0, 'bonkW'], [18, 'bonk', 'snap'], [22, 'bonk'], [40, 'guard']],
  hit: H(80, { stun: 24, kb: [3, 0], height: 'high', box: frontBox(20, -190, 80, 150), status: { id: 'dizzy', frames: 40 }, spark: 'heavy', fx: 'bonk' }),
  desc: 'Martillazo por arriba (overhead): marea al rival. Hay que bloquearlo de pie.', tip: 'No te agaches: bloquea de pie.',
  ai: { role: 'overhead', range: [0, 120] }
});

def('perfectlyBalanced', {
  name: 'Perfectly Balanced', cost: 0, cd: 1200, startup: 24, active: 1, recovery: 12, buffOnly: true, color: '#b388ff',
  anim: [[0, 'guard'], [20, 'snap'], [24, 'snap', 'snap'], [37, 'guard']],
  on: {
    active(f, b) {
      const d = b.targetFor(f); if (!d) return;
      fx(b, 'snap', { f });
      const e = (f.energy + d.energy) / 2; f.energy = e; d.energy = e;
      const pa = f.auraPct, pd = d.auraPct, avg = (pa + pd) / 2;
      f.aura = Math.max(1, f.aura + (avg - pa) * 0.4 * f.maxAura);
      d.aura = Math.max(1, d.aura + (avg - pd) * 0.4 * d.maxAura);
      say(b, f, 'PERFECTLY BALANCED', '#b388ff');
    }
  },
  desc: 'Chasquido: iguala la energía y acerca las auras un 40% a la media. Como todo debería ser.', tip: 'Interrúmpelo antes del chasquido.',
  ai: { role: 'comeback', range: [300, 2000] }
});

def('spidermanPoint', {
  name: 'Spider-Man Point', cost: 10, cd: 200, startup: 12, active: 1, recovery: 8, color: '#ff3355',
  anim: [[0, 'point'], [21, 'point']],
  on: {
    active(f, b, m) {
      const d = b.targetFor(f);
      const id = d && d.lastSpecial;
      if (!id || id === 'spidermanPoint' || !MOVES[id]) { say(b, f, '¿?', '#ff3355', true); return; }
      say(b, f, `COPIA: ${MOVES[id].name}`, '#ff3355');
      f.startMove(id, { free: true });
    }
  },
  desc: 'Señalas al rival y copias el último especial que usó, gratis.', tip: 'No le des especiales fáciles de copiar.',
  ai: { role: 'copy', range: [0, 600] }
});

def('thisIsFine', {
  name: 'This Is Fine', cost: 20, cd: 900, startup: 18, active: 1, recovery: 8, buffOnly: true, color: '#ff6a00',
  anim: [[0, 'guard'], [10, 'sit'], [27, 'sit']],
  on: { active(f, b) { f.addStatus('thisIsFine', 360, {}, f); fx(b, 'fire', { f }); say(b, f, 'THIS IS FINE 🔥', '#ff6a00'); } },
  desc: 'Todo arde y te da igual: armadura contra golpes débiles y quien te golpee se quema (6 s).', tip: 'Usa proyectiles o golpes fuertes.',
  ai: { role: 'buff', range: [200, 2000], status: 'thisIsFine' }
});

def('stonks', {
  name: 'Stonks', cost: 30, cd: 600, startup: 14, active: 1, recovery: 8, buffOnly: true, color: '#44ff88',
  anim: [[0, 'guard'], [8, 'stonks'], [23, 'stonks']],
  on: {
    active(f, b) {
      f.addStatus('stonks', 300, { onEnd: (ff, bb, s) => { if (s.t <= 0 && ff.alive) { ff.gainEnergy(70); bb.emit('callout', { f: ff, text: 'STONKS 📈 +70', color: '#44ff88' }); } } }, f);
      say(b, f, 'INVERSIÓN', '#44ff88', true);
    }
  },
  desc: 'Inviertes 30 de energía: en 5 s recibes 70. Si te hacen más de 150 de daño antes, la inversión se hunde.', tip: 'Haz un buen combo para hundir sus acciones.',
  ai: { role: 'buff', range: [450, 2000], status: 'stonks' }
});

def('bigBrain', {
  name: 'Big Brain', cost: 25, cd: 600, startup: 30, active: 1, recovery: 6, buffOnly: true, fragile: true, color: '#ff99ff',
  anim: [[0, 'think'], [37, 'think']],
  on: { active(f, b, m) { if (m.data.interrupted) return; f.addStatus('bigBrain', 240, {}, f); fx(b, 'brain', { f }); say(b, f, 'BIG BRAIN', '#ff99ff'); } },
  desc: 'Predices el futuro: el próximo golpe que recibas en 4 s se convierte en parry automático.', tip: 'Usa agarres o espera a que expire.',
  ai: { role: 'buff', range: [300, 2000], status: 'bigBrain' }
});

def('narutoRun', {
  name: 'Naruto Run', cost: 10, cd: 90, startup: 4, active: 36, recovery: 8, color: '#ffa040',
  motion: [[4, 40, 12]], speedScaled: true,
  anim: [[0, 'naruto'], [44, 'naruto']],
  hit: H(40, { stun: 18, kb: [8, 0], maxHits: 1, box: frontBox(0, -150, 50, 120) }),
  on: {
    start(f) { f.addStatus('narutoRun', 40, {}, f); f.trail = 40; },
    frame(f, b, m, t) {
      if (t > 8) {
        const e = f.takeBuffered(x => ['light', 'heavy', 'special', 'skill1', 'skill2'].includes(x.a));
        if (e) { const id = f.moveIdFor({ ...e, fwd: false }); f.removeStatus('narutoRun'); if (id && f.startMove(id === 'dashAttack' ? 'jab' : id)) return; }
      }
    },
    hit(f) { f.removeStatus('narutoRun'); },
    end(f) { f.removeStatus('narutoRun'); }
  },
  desc: 'Carrera ninja: inmune a proyectiles, atraviesa la pantalla y puede cancelarse en cualquier ataque.', tip: 'Golpes cuerpo a cuerpo la paran en seco.',
  ai: { role: 'gap', range: [250, 1200] }
});

def('oraBarrage', {
  name: 'ORA Barrage', cost: 30, cd: 150, startup: 10, active: 36, recovery: 18, color: '#b388ff',
  anim: [[0, 'jojo'], [10, 'punchFwd'], [46, 'punchFwd'], [64, 'guard']], mods: [[10, 46, 'barrage']],
  hit: H(9, { stun: 12, kb: [1.2, 0], every: 3, box: frontBox(20, -165, 100, 90), spark: 'light', chip: 0.18 }),
  on: { frame(f, b, m, t) { if (t > 10 && t < 46 && t % 3 === 0) fx(b, 'standFist', { f }); if (t === 45 && m.hitCount > 4) { const d = first(b, f, 140); if (d && d.state === 'hitstun') { d.setState('airhit'); d.grounded = false; d.vx = f.facing * 10; d.vy = -7; d.knockdownOnLand = true; d.y -= 1; } } } },
  desc: 'Pose de JoJo y una ráfaga de puños fantasma de 12 golpes. El último derriba.', tip: 'Parry o salta por encima.',
  ai: { role: 'pressure', range: [0, 130] }
});

def('omaeWaMou', {
  name: 'Omae Wa Mou', cost: 35, cd: 300, startup: 12, active: 4, recovery: 20, color: '#ff2222',
  anim: [[0, 'guard'], [12, 'point', 'snap'], [36, 'guard']],
  hit: H(12, { stun: 12, kb: [2, 0], box: frontBox(20, -150, 70, 70) }),
  on: {
    hit(f, b, m, d) {
      d.addStatus('marked', 75, {
        onEnd: (dd, bb, s) => {
          if (!dd.alive) return;
          bb.emit('callout', { f: dd, text: 'NANI?!', color: '#ff2222' });
          bb.emit('fx', { name: 'explosion', x: dd.x, y: dd.y - 90 });
          const p = bb.spawnProjectile(s.from, { kind: 'none', x: dd.x, y: dd.y - 90, absVx: true, vx: 0, w: 90, h: 160, life: 3, pierce: true, clash: false, hit: H(110, { stun: 30, kb: [6, -10], knockdown: true, unblockable: true, spark: 'mega' }), src: 'omaeWaMou' });
          void p;
        }
      }, f);
      say(b, f, 'OMAE WA MOU SHINDEIRU', '#ff2222');
    }
  },
  desc: 'Un toque que marca al rival. 1,2 s después: "NANI?!" y explota (110, imbloqueable).', tip: 'Evita el toque; si te marca, prepárate con dash/esquiva justo al final.',
  ai: { role: 'poke', range: [0, 105] }
});

def('falconPunch', {
  name: 'Falcon Punch', cost: 25, cd: 120, startup: 30, active: 5, recovery: 30, color: '#ff7b00',
  armor: [10, 30], motion: [[28, 35, 10]],
  anim: [[0, 'falconW'], [26, 'falconW'], [30, 'lunge', 'snap'], [35, 'lunge'], [65, 'guard']], mods: [[0, 28, 'tremble']],
  hit: H(150, { stun: 30, kb: [14, -7], knockdown: true, wallBounce: true, box: { joint: 'fHand', r: 26 }, spark: 'mega', fx: 'fireFist' }),
  desc: 'Puñetazo de fuego con carga eterna y súper armadura. Destroza.', tip: 'Agárralo, esquiva o castiga la recuperación.',
  ai: { role: 'heavy', range: [60, 180] }
});

def('rickroll', {
  name: 'Rickroll', cost: 30, cd: 300, startup: 18, active: 20, recovery: 14, color: '#ff66ff',
  anim: [[0, 'idle'], [52, 'idle']], mods: [[0, 52, 'dance']],
  proj: { at: 18, kind: 'notes', speed: 0, oy: -90, ox: 0, w: 60, h: 200, life: 24, pierce: true, clash: false,
    onUpdate: (b, p) => { p.w += 26; },
    hit: H(20, { stun: 10, kb: [0, 0], status: { id: 'dancing', frames: 90 } }) },
  desc: 'Bailas y una onda musical se expande: quien la toque baila sin control 1,5 s.', tip: 'Salta por encima o bloquéala.',
  ai: { role: 'zone', range: [0, 400] }
});

def('bingChilling', {
  name: 'Bing Chilling', cost: 20, cd: 150, startup: 14, active: 2, recovery: 16, color: '#aee8ff',
  anim: [[0, 'guard'], [14, 'kissOut', 'snap'], [32, 'guard']],
  proj: { at: 14, kind: 'icecream', speed: 7, vy: -9, gravity: 0.4, oy: -140, w: 30, h: 34, life: 120, hit: H(30, { stun: 14, kb: [1, 0], status: { id: 'frozen', frames: 60 } }) },
  desc: 'Lanzas un helado en parábola: congela al rival 1 s.', tip: 'Calcula la parábola y apártate o bloquea.',
  ai: { role: 'zone', range: [200, 700] }
});

def('ankleBreaker', {
  name: 'Ankle Breaker', cost: 15, cd: 90, startup: 3, active: 16, recovery: 12, color: '#ffb86c',
  invuln: [2, 16], invulnType: 'strike', motion: [[2, 16, 5]],
  anim: [[0, 'crouch'], [6, 'backdash'], [12, 'crouch'], [31, 'guard']],
  on: {
    dodge(f, b, m, a) {
      if (m.data.broke || !a || a.state !== 'attack') return; m.data.broke = true; m.hit = true;
      a.move = null; a.setState('airhit'); a.grounded = false; a.vy = -5; a.vx = 0; a.knockdownOnLand = true; a.y -= 1;
      b.dealDamage(f, a, 40); say(b, f, 'ANKLES BROKEN', '#ffb86c'); fx(b, 'ankle', { f: a });
    }
  },
  desc: 'Crossover de baloncesto: esquiva golpes y, si el rival atacaba, le rompe los tobillos (lo derriba).', tip: 'Usa proyectiles o espera a que acabe el crossover.',
  ai: { role: 'dodge', range: [0, 160] }
});

def('micDrop', {
  name: 'Mic Drop', cost: 20, cd: 150, startup: 16, active: 4, recovery: 18, color: '#cccccc',
  anim: [[0, 'micHold'], [14, 'micHold'], [16, 'thumbsDown', 'snap'], [38, 'guard']],
  on: {
    active(f, b, m) {
      fx(b, 'micDrop', { f });
      b.spawnProjectile(f, { kind: 'shockwave', x: f.x, y: GROUND_Y - 18, absVx: true, vx: 0, w: 420, h: 36, life: 8, pierce: true, clash: false,
        hit: H(50, { stun: 22, kb: [7, -5], height: 'low', knockdown: true }), src: 'micDrop', staleK: m.staleK });
    }
  },
  desc: 'Sueltas el micro: onda expansiva a ras de suelo hacia ambos lados.', tip: 'Salta o bloquea agachado.',
  ai: { role: 'zone', range: [0, 200] }
});

def('dealWithIt', {
  name: 'Deal With It', cost: 20, cd: 200, startup: 12, active: 1, recovery: 14, color: '#222222',
  anim: [[0, 'guard'], [12, 'stonks', 'snap'], [27, 'guard']],
  on: {
    active(f, b, m) {
      f.addStatus('cool', 300, {}, f);
      const d = b.targetFor(f); if (!d) return;
      b.spawnProjectile(f, { kind: 'glasses', x: d.x, y: GROUND_Y - 700, absVx: true, vx: 0, vy: 0, w: 60, h: 40, life: 200, delay: 30, track: d, trackFor: 22, fromAbove: true,
        onUpdate: (bb, p) => { p.vy = 14; }, hit: H(55, { stun: 20, kb: [1, 0], status: { id: 'dizzy', frames: 40 } }), src: 'dealWithIt', staleK: m.staleK });
    }
  },
  desc: 'Te pones las gafas (inmune a miradas y miedo 5 s) y unas gafas pixeladas caen sobre el rival.', tip: 'Las gafas siguen al rival un rato: muévete en el último momento.',
  ai: { role: 'zone', range: [150, 1200] }
});

def('bananaSlip', {
  name: 'Goofy Banana', cost: 10, cd: 120, startup: 10, active: 1, recovery: 12, color: '#ffe135',
  anim: [[0, 'guard'], [10, 'kissOut', 'snap'], [23, 'guard']],
  proj: { at: 10, kind: 'banana', speed: 4, vy: -5, gravity: 0.5, oy: -100, w: 40, h: 20, life: 600, clash: false,
    data: { onGround: (b, p) => { p.vx = 0; p.vy = 0; p.gravity = 0; p.y = GROUND_Y - 10; } },
    hit: H(40, { stun: 20, kb: [2, 0], knockdown: true, height: 'low' }) },
  desc: 'Tiras una piel de plátano que se queda en el suelo 10 s: quien la pise resbala.', tip: 'Salta por encima o golpéala con un proyectil.',
  ai: { role: 'trap', range: [100, 600] }
});

def('vineBoom', {
  name: 'Vine Boom', cost: 20, cd: 90, startup: 16, active: 4, recovery: 20, color: '#ff2222',
  anim: [[0, 'falconW'], [16, 'punchFwd', 'snap'], [20, 'punchFwd'], [40, 'guard']],
  hit: H(95, { stun: 28, kb: [11, -4], box: { joint: 'nHand', r: 24 }, spark: 'mega', hitstop: 18, fx: 'vineBoom' }),
  desc: 'Puñetazo con el BOOM de Vine: hitstop enorme y temblor de pantalla.', tip: 'Es lento: parry o castigo.',
  ai: { role: 'heavy', range: [0, 120] }
});

def('bruh', {
  name: 'Bruh', cost: 15, cd: 90, startup: 8, active: 6, recovery: 14, color: '#9aa0a6',
  anim: [[0, 'facepalm'], [8, 'holdUp', 'snap'], [28, 'guard']],
  proj: { at: 8, kind: 'soundwave', speed: 8, oy: -120, w: 40, h: 120, life: 28, pierce: true, hit: H(25, { stun: 12, kb: [2, 0], status: { id: 'dizzy', frames: 35 } }) },
  desc: 'Un "bruh" tan decepcionado que marea al rival a corta distancia.', tip: 'Bloquéalo: es de corto alcance.',
  ai: { role: 'poke', range: [40, 230] }
});

def('rageQuit', {
  name: 'Rage Quit', cost: 40, cd: 600, once: true, startup: 30, active: 4, recovery: 30, color: '#ff0000',
  cond: f => f.auraPct < 0.3, condText: 'NECESITAS <30% AURA',
  anim: [[0, 'rageW'], [30, 'armsUp', 'snap'], [64, 'guard']], mods: [[0, 30, 'tremble']],
  on: {
    active(f, b, m) {
      fx(b, 'explosion', { x: f.x, y: f.y - 90, big: true });
      b.dealDamage(f, f, 60, { noKO: true }); if (f.aura < 1) f.aura = 1;
      b.spawnProjectile(f, { kind: 'none', x: f.x, y: f.y - 90, absVx: true, vx: 0, w: 500, h: 260, life: 5, pierce: true, clash: false,
        hit: H(160, { stun: 30, kb: [13, -9], knockdown: true, spark: 'mega' }), src: 'rageQuit', staleK: m.staleK });
    }
  },
  desc: 'Desesperación (<30% aura): explotas dañando a todo alrededor (160), pero pierdes 60 de aura.', tip: 'Aléjate cuando empiece a temblar.',
  ai: { role: 'comeback', range: [0, 230] }
});

def('speedrun', {
  name: 'Speedrun', cost: 25, cd: 900, startup: 10, active: 1, recovery: 4, buffOnly: true, color: '#55ffee',
  anim: [[0, 'guard'], [6, 'naruto'], [15, 'guard']],
  on: { active(f, b) { f.addStatus('speedrun', 300, {}, f); say(b, f, 'SPEEDRUN ANY%', '#55ffee'); fx(b, 'auraFlare', { f, color: 0x55ffee }); } },
  desc: 'Velocidad +35%, dash con media recarga y recuperación de ataques -20% (5 s).', tip: 'Defiéndete y espera a que acabe.',
  ai: { role: 'buff', range: [300, 2000], status: 'speedrun' }
});

def('lagSpike', {
  name: 'Lag Spike', cost: 20, cd: 240, startup: 12, active: 1, recovery: 12, color: '#00ff66',
  anim: [[0, 'guard'], [12, 'point', 'snap'], [25, 'guard']],
  on: {
    active(f, b, m) {
      for (const d of b.enemiesInRange(f, 450, false, 250)) {
        if (d.state === 'locked' || d.invuln > 0) continue;
        const x = d.posHist[0] ?? d.x;
        b.teleport(d, x); d.move = null; d.vx = 0;
        if (d.grounded) d.setState('idle');
        d.addStatus('lagged', 24, {}, f); b.dealDamage(f, d, 20); m.hit = true;
        say(b, d, 'LAG SPIKE', '#00ff66');
      }
    }
  },
  desc: 'Provocas lag: el rival vuelve a donde estaba hace 1 s y se congela un instante.', tip: 'Esquívalo con dash en el momento del chasquido.',
  ai: { role: 'debuff', range: [0, 450] }
});

def('auraFarming', {
  name: 'Aura Farming', cost: 0, cd: 600, startup: 6, active: 84, recovery: 6, buffOnly: true, fragile: true, color: '#ffe066',
  anim: [[0, 'idle'], [96, 'idle']], mods: [[0, 90, 'dance']],
  on: {
    start(f, b) { f.addStatus('auraFarm', 96, {}, f); b.emit('crowd', { f, mood: 'cheer' }); },
    frame(f, b, m, t) {
      if (!f.hasStatus('auraFarm') && t > 6) { m.f = Math.max(m.f, 90); return; }
      if (t > 6 && t % 10 === 0) { f.heal(5); f.gainEnergy(4); fx(b, 'farm', { f }); }
    },
    end(f) { f.removeStatus('auraFarm'); }
  },
  desc: 'El baile viral de la barca: mientras bailas recuperas aura y energía. Se corta si te golpean.', tip: 'Castígalo: está totalmente expuesto.',
  ai: { role: 'buff', range: [500, 2000], status: 'auraFarm' }
});

def('tungTung', {
  name: 'Tung Tung Tung Sahur', cost: 20, cd: 120, startup: 12, active: 30, recovery: 16, color: '#c68642',
  anim: [[0, 'bonkW'], [12, 'bonk', 'snap'], [18, 'bonkW'], [24, 'bonk', 'snap'], [30, 'bonkW'], [36, 'bonk', 'snap'], [42, 'bonk'], [58, 'guard']],
  hit: H(32, { stun: 20, kb: [2.5, 0], height: 'high', every: 12, box: frontBox(20, -190, 85, 150), spark: 'medium', fx: 'tung', react: 'flattened' }),
  desc: 'Tres batazos por arriba al ritmo de "tung tung tung". Bloquéalos de pie.', tip: 'No te agaches.',
  ai: { role: 'overhead', range: [0, 125] }
});

def('bombardiro', {
  name: 'Bombardiro', cost: 30, cd: 300, startup: 20, active: 40, recovery: 10, color: '#6b8e23',
  anim: [[0, 'guard'], [12, 'stonks'], [70, 'stonks']],
  on: {
    frame(f, b, m, t) {
      if (t === 20) fx(b, 'plane', { f });
      if (t >= 24 && t <= 54 && (t - 24) % 10 === 0) {
        const d = b.targetFor(f); if (!d) return;
        const i = (t - 24) / 10;
        const x = d.x + (i - 1.5) * 90;
        b.spawnProjectile(f, { kind: 'bomb', x, y: GROUND_Y - 700, absVx: true, vx: 0, vy: 12, w: 34, h: 40, life: 120, fromAbove: true,
          data: { onGround: (bb, p) => { p.dead = true; bb.emit('fx', { name: 'explosion', x: p.x, y: GROUND_Y - 30 }); bb.spawnProjectile(p.owner, { kind: 'none', x: p.x, y: GROUND_Y - 40, absVx: true, vx: 0, w: 130, h: 90, life: 4, pierce: true, clash: false, hit: H(35, { stun: 16, kb: [4, -6], knockdown: true }), src: 'bombardiro' }); } },
          hit: H(35, { stun: 16, kb: [4, -6], knockdown: true }), src: 'bombardiro', staleK: m.staleK });
      }
    }
  },
  desc: 'Un cocodrilo-bombardero suelta cuatro bombas alrededor del rival.', tip: 'Las bombas caen en línea: sal corriendo hacia un lado.',
  ai: { role: 'zone', range: [200, 1500] }
});

def('ballerinaSpin', {
  name: 'Ballerina Spin', cost: 20, cd: 120, startup: 10, active: 14, recovery: 16, color: '#ffb6c1',
  invuln: [1, 8], invulnType: 'strike', motion: [[10, 24, 3, -9]], gravity: 0.6,
  anim: [[0, 'armsUp'], [10, 'siuSpin'], [24, 'siuSpin'], [40, 'guard']], mods: [[0, 26, 'spin']],
  hit: H(26, { stun: 18, kb: [3, -9], launch: true, every: 7, box: { around: true, w: 140, h: 160, y: 0 } }),
  desc: 'Pirueta de bailarina ascendente que lanza al rival. Invulnerable al empezar.', tip: 'Bloquéala y castígala al caer.',
  ai: { role: 'antiair', range: [0, 110] }
});

def('ggEz', {
  name: 'GG EZ', cost: 0, cd: 300, startup: 10, active: 40, recovery: 10, taunt: true, color: '#7CFC00',
  anim: [[0, 'thumbsUp'], [60, 'thumbsUp']], mods: [[0, 60, 'bob']],
  on: {
    active(f, b, m) {
      let any = false;
      for (const d of b.enemiesInRange(f, 400, false, 250)) if (d.state === 'knockdown' || d.state === 'getup') { if (b.drain(f, d, 90, 'GG EZ', '#7CFC00')) { f.gainEnergy(30); any = true; } }
      if (!any) f.gainEnergy(20); else m.hit = true;
    }
  },
  desc: 'Pulgar arriba burlón: si el rival está derribado, pierde 90 de aura y tú ganas 30 de energía.', tip: 'Recupérate rápido del suelo (Shift al caer).',
  ai: { role: 'humiliate', range: [0, 400] }
});

def('clapBack', {
  name: 'Clap Back', cost: 15, cd: 150, startup: 3, active: 18, recovery: 14, color: '#ffd166',
  anim: [[0, 'holdUp'], [21, 'holdUp'], [21, 'clap', 'snap'], [35, 'guard']],
  counter: {
    from: 3, to: 21, types: ['strike', 'projectile'],
    on(d, a, hit, src, b) {
      if (src.kind === 'projectile') { b.reflect(src.p, d, 1.3); }
      else {
        if (a.move && a.move.lock) b.releaseLock(a, a.move.lock, true);
        a.move = null; a.setState('airhit'); a.grounded = false; a.vx = d.facing * 11; a.vy = -6; a.knockdownOnLand = true; a.y -= 1;
        b.dealDamage(d, a, 70);
      }
      fx(b, 'clap', { f: d }); say(b, d, 'CLAP BACK', '#ffd166');
      d.move.f = 21;
      return true;
    }
  },
  desc: 'Postura de contra: aplauso que devuelve golpes (70) o refleja proyectiles.', tip: 'Agárralo o espera.',
  ai: { role: 'counter', range: [0, 600] }
});

def('shush', {
  name: 'Shush', cost: 20, cd: 300, startup: 12, active: 4, recovery: 14, color: '#cccccc',
  anim: [[0, 'guard'], [10, 'shush'], [30, 'shush']],
  proj: { at: 12, kind: 'shush', speed: 9, oy: -125, w: 40, h: 90, life: 40, pierce: true, hit: H(15, { stun: 10, kb: [1, 0], status: { id: 'silenced', frames: 240 } }) },
  desc: 'Dedo en los labios: el rival queda silenciado 4 s (sin especiales, habilidades ni ultimate).', tip: 'Bloquéalo o salta.',
  ai: { role: 'debuff', range: [60, 360] }
});

def('aimbot', {
  name: 'Finger Guns', cost: 15, cd: 60, startup: 8, active: 10, recovery: 12, color: '#ff5555',
  anim: [[0, 'fingerGuns'], [8, 'fingerGuns', 'snap'], [30, 'guard']],
  proj: { at: [8, 16], kind: 'bullet', speed: 16, oy: -120, w: 20, h: 12, life: 60, hit: H(22, { stun: 12, kb: [2, 0] }) },
  desc: 'Pistolas con los dedos: dos disparos muy rápidos.', tip: 'Bloquea o agáchate.',
  ai: { role: 'zone', range: [100, 900] }
});

def('skillIssue', {
  name: 'Skill Issue', cost: 0, cd: 240, startup: 10, active: 30, recovery: 10, taunt: true, color: '#66ccff',
  anim: [[0, 'facepalm'], [50, 'facepalm']], mods: [[0, 50, 'laugh']],
  on: {
    active(f, b, m) {
      let any = false;
      for (const d of b.enemiesInRange(f, 450, false, 250)) {
        if (b.frame - f.lastParry < 150 || b.frame - d.lastWhiff < 60) { if (b.drain(f, d, 70, 'SKILL ISSUE', '#66ccff')) any = true; }
      }
      if (!any) f.gainEnergy(12); else m.hit = true;
    }
  },
  desc: 'Tras un parry tuyo o un fallo del rival: "skill issue", el rival pierde 70 de aura.', tip: 'No te dejes parrear.',
  ai: { role: 'humiliate', range: [0, 450] }
});

def('afk', {
  name: 'AFK', cost: 0, cd: 900, startup: 6, active: 110, recovery: 6, buffOnly: true, fragile: true, color: '#8888ff',
  anim: [[0, 'sleep'], [122, 'sleep']],
  on: {
    frame(f, b, m, t) {
      if (m.data.interrupted) { m.f = Math.max(m.f, 116); return; }
      if (t > 6 && t < 116) { f.heal(1.3); if (t % 20 === 0) fx(b, 'zzz', { f }); }
    }
  },
  desc: 'Te vas AFK: recuperas mucha aura dormido, pero si te golpean te despiertas.', tip: '¡Castígalo ya!',
  ai: { role: 'buff', range: [600, 2000] }
});

def('goblinMode', {
  name: 'Goblin Mode', cost: 20, cd: 600, startup: 14, active: 1, recovery: 6, buffOnly: true, color: '#66cc33',
  anim: [[0, 'rageW'], [21, 'rageW']], mods: [[0, 21, 'tremble']],
  on: { active(f, b) { f.addStatus('goblin', 360, {}, f); say(b, f, 'GOBLIN MODE', '#66cc33'); fx(b, 'auraFlare', { f, color: 0x66cc33 }); } },
  desc: 'Modo goblin: +20% daño y velocidad, pero recibes +25% de daño (6 s).', tip: 'Arriesga: castígalo fuerte.',
  ai: { role: 'buff', range: [250, 2000], status: 'goblin' }
});

def('holdUp', {
  name: 'Hold Up', cost: 15, cd: 150, startup: 6, active: 30, recovery: 10, color: '#dddddd',
  anim: [[0, 'holdUp'], [46, 'holdUp']],
  counter: {
    from: 4, to: 36, types: ['projectile'],
    on(d, a, hit, src, b) { src.p.dead = true; b.emit('fx', { name: 'stopSign', f: d }); return true; }
  },
  on: {
    frame(f, b, m, t) {
      if (t !== 6) return;
      for (const d of b.enemiesInRange(f, 260, true, 200)) {
        if (d.state === 'dash' || (Math.sign(d.vx) === -f.facing && Math.abs(d.vx) > 2)) { d.addStatus('paused', 40, {}, f); say(b, d, 'HOLD UP', '#dddddd'); m.hit = true; }
      }
    }
  },
  desc: 'Mano de "espera": destruye proyectiles de frente y paraliza a quien venga corriendo hacia ti.', tip: 'No avances con dash hacia él.',
  ai: { role: 'counter', range: [0, 700], vsProj: true }
});

def('backflipDiss', {
  name: 'Backflip Diss', cost: 5, cd: 60, startup: 1, active: 22, recovery: 8, color: '#ffffff',
  invuln: [2, 18], motion: [[1, 2, -7, -12]], gravity: 1, keepVel: true,
  anim: [[0, 'jump'], [22, 'jump'], [30, 'thumbsDown']], mods: [[1, 22, 'spin']],
  on: { end(f, b) { f.gainEnergy(12); }, land(f, b, m) { m.f = Math.max(m.f, 22); f.vx = 0; } },
  desc: 'Mortal hacia atrás invulnerable y pulgar abajo. Escapa de la presión.', tip: 'Persíguelo con un proyectil.',
  ai: { role: 'escape', range: [0, 160] }
});

// =====================================================================
// ULTIMATES (100 de energía, pausa cinemática)
// =====================================================================
const ULT = { slot: 'ult', cost: 100, cine: true };

def('sixSevenBarrage', {
  ...ULT, name: '67 Barrage', startup: 14, active: 18, recovery: 24, color: '#ffd166',
  motion: [[14, 32, 14]], invuln: [0, 13],
  anim: [[0, 'palmsUp'], [14, 'dash'], [32, 'dash'], [56, 'guard']],
  hit: { dmg: 0, grab: true, unparryable: false, box: frontBox(0, -160, 80, 150) },
  on: {
    grab(f, b, m, d) {
      const hits = [];
      for (let i = 0; i < 16; i++) hits.push({ f: 12 + i * 5, dmg: 11, spark: 'light', fx: 'sixseven' });
      hits.push({ f: 104, dmg: 110, spark: 'mega', fx: 'doublePalm', say: '67!!', sayColor: '#ffd166', last: true, hitstop: 18 });
      b.startLock(f, d, {
        frames: 116, off: [76, 0], tpose: 'hurt', cine: true,
        anim: [[0, 'palmsUp'], [100, 'palmsUp'], [104, 'clap', 'snap'], [116, 'clap']], mods: [[0, 100, 'sixseven']],
        hits, end: { kb: [13, -11], knockdown: true, wallBounce: true }
      });
    }
  },
  desc: 'Embestida y ráfaga brutal de 6-7 con las manos: 17 golpes y remate (≈290).', tip: 'Salta o esquiva la embestida inicial.',
  ai: { role: 'ult', range: [0, 260] }
});

def('rizzStorm', {
  ...ULT, name: 'Rizz Storm', startup: 20, active: 100, recovery: 20, color: '#ff5fa2',
  anim: [[0, 'kiss'], [20, 'kissOut', 'snap'], [60, 'fingerGuns'], [100, 'kiss'], [120, 'kissOut', 'snap'], [140, 'guard']], mods: [[20, 100, 'bob']],
  on: {
    frame(f, b, m, t) {
      if (t >= 20 && t < 110 && t % 5 === 0) {
        const d = b.targetFor(f); if (!d) return;
        const fromSky = (t / 5) % 2 === 0;
        b.spawnProjectile(f, fromSky
          ? { kind: 'heart', x: d.x + (b.rand() - 0.5) * 300, y: GROUND_Y - 720, absVx: true, vx: 0, vy: 10, w: 30, h: 28, life: 90, fromAbove: true, hit: H(14, { stun: 12, kb: [1, 0], status: { id: 'charmed', frames: 25 } }), src: 'rizzStorm' }
          : { kind: 'heart', speed: 10, vy: (b.rand() - 0.5) * 3, oy: -60 - b.rand() * 100, w: 30, h: 28, life: 120, hit: H(14, { stun: 12, kb: [1, 0], status: { id: 'charmed', frames: 25 } }), src: 'rizzStorm' });
      }
      if (t === 118) {
        b.spawnProjectile(f, { kind: 'bigHeart', speed: 9, oy: -120, w: 110, h: 100, life: 120, pierce: false,
          hit: H(120, { stun: 30, kb: [10, -9], knockdown: true, spark: 'mega', ultimate: true, chip: 0.25 }), src: 'rizzStorm' });
      }
    }
  },
  desc: 'Tormenta de corazones desde el cielo y de frente, que acaba con un beso gigante explosivo.', tip: 'Bloquea y aguanta: el beso final se puede saltar.',
  ai: { role: 'ult', range: [100, 1200] }
});

def('ultimateNonchalance', {
  ...ULT, name: 'Ultimate Nonchalance', startup: 40, active: 6, recovery: 30, color: '#e0e0e0',
  anim: [[0, 'pockets'], [76, 'pockets']], mods: [[0, 76, 'breathe']],
  on: {
    frame(f, b, m, t) {
      if (t === 20) fx(b, 'pulseWarn', { f });
      if (t !== 40) return;
      fx(b, 'pulse', { f });
      for (const d of b.enemiesInRange(f, 2000, false, 400)) {
        if (!d.grounded || d.state === 'dash' || d.invuln > 0) { say(b, d, 'LO ESQUIVA', '#aaaaaa', true); continue; }
        if (m.lock) { b.dealDamage(f, d, 120); continue; }
        b.teleport(d, f.x + f.facing * 90);
        b.startLock(f, d, {
          frames: 110, off: [90, 0], tpose: t2 => t2 < 30 ? 'hurt' : t2 < 80 ? 'getup' : 'lying', cine: true,
          anim: [[0, 'pockets'], [110, 'pockets']], mods: [[0, 110, 'breathe']],
          hits: [{ f: 20, dmg: 60, spark: 'heavy', fx: 'pressure' }, { f: 50, dmg: 80, spark: 'heavy', fx: 'pressure' }, { f: 90, dmg: 140, spark: 'mega', fx: 'pressure', say: 'NO LE IMPORTA', last: true, hitstop: 20 }],
          end: { kb: [4, -4], knockdown: true }
        });
        m.hit = true;
      }
    }
  },
  desc: 'No haces nada. Absolutamente nada. Y la presión de tu indiferencia aplasta al rival (≈280). Imbloqueable.', tip: 'En el instante del pulso, salta o haz dash.',
  ai: { role: 'ult', range: [0, 2000] }
});

def('finalAuraJudgment', {
  ...ULT, name: 'Final Aura Judgment', startup: 30, active: 40, recovery: 24, color: '#fff6a0',
  anim: [[0, 'pray'], [24, 'judgment', 'snap'], [94, 'judgment']],
  on: {
    frame(f, b, m, t) {
      if (t === 30) {
        const d = b.targetFor(f); if (!d) return;
        b.spawnProjectile(f, { kind: 'pillar', x: d.x, y: GROUND_Y - 400, absVx: true, vx: 0, w: 110, h: 800, life: 14, delay: 36, track: d, trackFor: 24, pierce: true, clash: false,
          hit: { dmg: 0, unblockable: true, ultimate: true, grab: false, stun: 1, kb: [0, 0] }, src: 'finalAuraJudgment',
          onHit: (bb, p, dd) => {
            if (!f.move || f.move.def.id !== 'finalAuraJudgment' || f.move.lock) return;
            const hits = [];
            for (let i = 0; i < 5; i++) hits.push({ f: 14 + i * 14, dmg: 30, spark: 'heavy', fx: 'lightning' });
            hits.push({ f: 100, dmg: 150, spark: 'mega', fx: 'judgment', say: 'JUZGADO', sayColor: '#fff6a0', last: true, hitstop: 22 });
            bb.startLock(f, dd, { frames: 112, off: [() => (dd.x - f.x) * f.facing / f.scale, 0], tpose: 'airHurt', cine: true, anim: [[0, 'judgment'], [112, 'judgment']], hits, end: { kb: [3, -12], knockdown: true } });
          } });
      }
    }
  },
  desc: 'Señalas al cielo: un pilar de luz persigue al rival y lo juzga con 5 rayos y un veredicto final (≈300).', tip: 'Cuando el pilar se fija, sal con dash.',
  ai: { role: 'ult', range: [0, 2000] }
});

def('timeStop', {
  ...ULT, name: 'Time Stop', startup: 26, active: 1, recovery: 8, color: '#ffd700',
  anim: [[0, 'guard'], [20, 'timeStop', 'snap'], [35, 'timeStop']],
  on: { active(f, b) { b.timeStop = { owner: f, t: 150 }; b.emit('timeStop', { f }); say(b, f, 'ZA WARUDO', '#ffd700'); } },
  desc: 'Detienes el tiempo 2,5 s: solo tú puedes moverte. El daño en tiempo parado se reduce un 30%.', tip: 'Gana distancia antes para que no llegue a tiempo.',
  ai: { role: 'ult', range: [0, 400] }
});

def('coffinDance', {
  ...ULT, name: 'Coffin Dance', startup: 16, active: 8, recovery: 24, color: '#222222',
  motion: [[14, 24, 9]],
  anim: [[0, 'coffin'], [16, 'slap', 'snap'], [48, 'guard']],
  hit: { dmg: 0, grab: true, box: frontBox(0, -160, 90, 160) },
  on: {
    grab(f, b, m, d) {
      const exec = d.auraPct < 0.3;
      b.startLock(f, d, {
        frames: 140, off: [t => 70, t => (t > 20 && t < 120 ? -70 : 0)], tpose: 'lying', cine: true,
        anim: [[0, 'coffin'], [140, 'coffin']], mods: [[0, 140, 'dance']],
        frame: (ff, bb, mm, t) => { if (t === 2) bb.emit('fx', { name: 'coffin', f: ff, d }); },
        hits: [{ f: 40, dmg: 40, spark: 'light' }, { f: 80, dmg: 60, spark: 'medium' }, { f: 125, dmg: exec ? 999 : 150, spark: 'mega', fx: 'coffinDrop', say: exec ? 'GG' : '⚰️', last: true, hitstop: 20 }],
        end: { kb: [6, -5], knockdown: true }
      });
    }
  },
  desc: 'Los portadores del ataúd bailan y se llevan al rival (≈250). Si tiene menos del 30% de aura: KO instantáneo.', tip: 'Salta o esquiva el agarre inicial.',
  ai: { role: 'ult', range: [0, 230] }
});

def('sigmaRule', {
  ...ULT, name: 'Sigma Rule #1', startup: 12, active: 6, recovery: 26, color: '#c084fc',
  invuln: [0, 12],
  anim: [[0, 'armsCrossed'], [12, 'dap', 'snap'], [44, 'guard']],
  on: { frame(f, b, m, t) { if (t === 6) { const d = b.targetFor(f); if (d && Math.abs(d.x - f.x) < 500) { b.teleport(f, d.x - d.facing * 64); f.facing = Math.sign(d.x - f.x) || f.facing; } } } },
  hit: { dmg: 0, grab: true, box: frontBox(0, -160, 90, 160) }
});
MOVES.sigmaRule.on.grab = (f, b, m, d) => {
  b.startLock(f, d, {
    frames: 100, off: [76, 0], tpose: 'hurt', cine: true,
    anim: [[0, 'dap'], [16, 'punchFwd2', 'snap'], [32, 'roundhouse', 'snap'], [48, 'uppercut', 'snap'], [64, 'backhand', 'snap'], [80, 'armsCrossed'], [100, 'armsCrossed']],
    hands: (a, t, fr) => { const c = faceHit(a, t, 'f', 15, 22, fr, 'chest'); if (c) return { f: c }; const u = faceHit(a, t, 'n', 47, 54, fr, 'face'); return u ? { n: u } : null; },
    hits: [{ f: 16, dmg: 40, spark: 'heavy' }, { f: 32, dmg: 45, spark: 'heavy' }, { f: 48, dmg: 50, spark: 'heavy' }, { f: 64, dmg: 55, spark: 'heavy' }, { f: 90, dmg: 80, spark: 'mega', fx: 'sigmaFinish', say: 'SIGMA', sayColor: '#c084fc', last: true, hitstop: 18 }],
    end: { kb: [12, -8], knockdown: true }
  });
};
MOVES.sigmaRule.desc = 'Teletransporte a la espalda (hasta 500 px) y combo cinemático de 5 golpes con gafas de sol (≈270).';
MOVES.sigmaRule.tip = 'Salta justo cuando desaparece.';
MOVES.sigmaRule.ai = { role: 'ult', range: [0, 480] };

def('domainExpansion', {
  ...ULT, name: 'Domain Expansion', startup: 30, active: 1, recovery: 10, color: '#8a2be2',
  anim: [[0, 'guard'], [20, 'pray', 'snap'], [41, 'pray']],
  on: { active(f, b) { b.domain = { owner: f, t: 360 }; f.addStatus('domain', 360, {}, f); b.emit('domain', { f }); say(b, f, 'DOMAIN EXPANSION', '#c77dff'); } },
  desc: 'Expandes tu dominio 6 s: tus golpes no se pueden bloquear y los rivales se mueven un 25% más lento.', tip: 'Usa parries y esquivas hasta que se cierre.',
  ai: { role: 'ult', range: [0, 500] }
});

def('auraOverload', {
  ...ULT, name: 'Aura Overload', startup: 36, active: 10, recovery: 34, color: '#ffffff',
  armor: [0, 36],
  anim: [[0, 'charge'], [34, 'charge'], [36, 'armsUp', 'snap'], [80, 'armsUp']], mods: [[0, 36, 'tremble']],
  on: {
    active(f, b, m) {
      fx(b, 'overload', { f });
      b.spawnProjectile(f, { kind: 'none', x: f.x, y: f.y - 100, absVx: true, vx: 0, w: 700, h: 400, life: 10, pierce: true, clash: false,
        hit: H(230, { stun: 40, kb: [16, -12], knockdown: true, wallBounce: true, spark: 'mega', unblockable: false, chip: 0.35, ultimate: true }), src: 'auraOverload' });
    }
  },
  desc: 'Cargas todo tu aura (con súper armadura) y explotas en una onda gigante (230). Bloquear reduce, pero hace mucho daño de desgaste.', tip: 'Parry en el instante o aléjate muchísimo.',
  ai: { role: 'ult', range: [0, 340] }
});

// =====================================================================
// metadatos derivados
// =====================================================================

// =====================================================================
// NUEVAS TÉCNICAS DE AURA Y BRAINROT
// =====================================================================

def('snapWalk', {
  name: 'Paseo de Chasquidos', cost: 10, cd: 240, startup: 6, active: 75, recovery: 10, fragile: true, color: '#b388ff',
  motion: [[6, 81, 2.4]],
  anim: [[0, 'guard'], [6, 'snapWalk'], [81, 'snapWalk'], [91, 'guard']], mods: [[6, 81, 'snapBeat']],
  on: {
    frame(f, b, m, t) {
      if (t < 6 || t > 80 || m.data.interrupted || (t - 6) % 15 !== 0) return;
      // cada chasquido, al ritmo, genera aura y energía; si el rival está cerca, le saca de quicio
      m.data.snaps = (m.data.snaps || 0) + 1;
      f.heal(16 + m.data.snaps * 4); f.gainEnergy(5);
      fx(b, 'snapBeat', { f, i: m.data.snaps });
      for (const d of b.enemiesInRange(f, 180, true, 160)) {
        if (Math.sign(f.x - d.x) !== d.facing || d.isImmune('humiliate')) continue;
        if (b.drain(f, d, 10, 'CHASQUIDO', '#b388ff')) { d.addStatus('tilted', 45, {}, f); m.hit = true; }
      }
    }
  },
  desc: 'Caminas con actitud chasqueando los dedos al ritmo: cada chasquido te da aura y energía; de cerca, tiltea y humilla al rival.', tip: 'Es frágil: cualquier golpe corta el paseo.',
  ai: { role: 'buff', range: [200, 2000] }
});

def('sixSevenSlam', {
  name: 'Six Seven Slam', cost: 20, cd: 120, startup: 16, active: 4, recovery: 20, color: '#ffd166',
  anim: [[0, 'palmsUp'], [8, 'armsUp', 'out'], [16, 'palmSlam', 'snap'], [26, 'palmSlam'], [40, 'guard']], mods: [[0, 8, 'sixseven']],
  on: {
    active(f, b, m) {
      fx(b, 'sixsevenSlam', { f });
      for (const dir of [1, -1]) {
        b.spawnProjectile(f, { kind: 'shockwave', x: f.x + dir * 50 * f.scale, y: GROUND_Y - 22, absVx: true, vx: dir * 11, w: 90, h: 44, life: 28, pierce: true, clash: false,
          hit: H(55, { stun: 22, height: 'low', kb: [5, -6], knockdown: true, react: 'hurtLow' }), src: 'sixSevenSlam', staleK: m.staleK });
      }
    }
  },
  desc: 'Seis, siete... ¡y palmada al suelo! Dos ondas bajas recorren el suelo hacia ambos lados y derriban.', tip: 'Salta las ondas o bloquea agachado.',
  ai: { role: 'low', range: [0, 420] }
});

def('fakeGreeting', {
  name: 'Saludo Falso', cost: 10, cd: 90, startup: 18, active: 4, recovery: 16, color: '#8be9fd',
  motion: [[12, 18, 9]],
  anim: [[0, 'wave'], [12, 'wave'], [16, 'jabW', 'out'], [18, 'flick', 'snap'], [22, 'flick'], [38, 'guard']], mods: [[0, 12, 'wave']],
  hit: H(40, { stun: 26, height: 'high', kb: [3, 0], box: frontBox(0, -200, 85, 70), status: { id: 'dizzy', frames: 30 }, react: 'hurtHead', spark: 'medium', fx: 'flick' }),
  contacts: [{ hand: 'n', at: 'face', from: 18, to: 24, onHit: true }],
  on: { start(f, b) { say(b, f, '¡HOLA!', '#8be9fd', true); } },
  desc: 'Saludas con la mano como si nada... y avanzas para darle un toque en la frente que lo marea (alto).', tip: 'Agáchate cuando te salude.',
  ai: { role: 'poke', range: [60, 200] }
});

def('handshakeHeadbutt', {
  name: 'Apretón Sigma', cost: 20, cd: 120, startup: 12, active: 6, recovery: 30, color: '#c084fc',
  anim: [[0, 'guard'], [10, 'offer', 'out'], [18, 'offer'], [48, 'guard']],
  hit: { dmg: 0, grab: true, box: frontBox(20, -150, 70, 120) },
  on: {
    grab(f, b, m, d) {
      b.startLock(f, d, {
        frames: 56, off: [t => (t < 26 ? 80 : t < 34 ? 80 - (t - 26) * 1.6 : 68), 0], tpose: t => (t < 34 ? 'offer' : 'held'),
        anim: [[0, 'offer'], [24, 'offer'], [30, 'shakeGrip', 'out'], [34, 'headbutt', 'snap'], [44, 'headbutt'], [56, 'guard', 'inOut']],
        // se dan la mano de verdad, tira del rival hacia sí y cabezazo
        ...handshake(34, 24),
        hits: [{ f: 36, dmg: 105, spark: 'heavy', fx: 'headbutt', say: 'CABEZAZO SIGMA', sayColor: '#c084fc', last: true, hitstop: 12, react: 'hurtHead' }],
        end: { kb: [9, -6], knockdown: true }
      });
    },
    end(f, b, m) { if (!m.hit) b.dealDamage(null, f, 10); }
  },
  desc: 'Le das la mano con educación, tiras de él y le estampas un cabezazo. Agarre: atraviesa el bloqueo.', tip: 'Salta o castígalo mientras ofrece la mano.',
  ai: { role: 'grab', range: [0, 95] }
});

def('doubleSlap', {
  name: 'Doble Tortazo', cost: 15, cd: 90, startup: 9, active: 14, recovery: 16, color: '#ff9f1c',
  motion: [[9, 20, 3.6]],
  anim: [[0, 'bigSlapW'], [9, 'bigSlap', 'snap'], [13, 'slapCross', 'out'], [17, 'backSlap', 'snap'], [23, 'backSlap'], [39, 'guard']],
  hit: H(38, { stun: 22, kb: [0.8, 0], every: 8, maxHits: 2, box: frontBox(10, -200, 115, 80), react: 'slapped', spark: 'medium', fx: 'slap' }),
  contacts: [{ hand: 'n', at: 'face', from: 9, to: 14, onHit: true }, { hand: 'n', at: 'face', from: 17, to: 22, onHit: true }],
  desc: 'Tortazo de ida y revés de vuelta: dos impactos cómicos en la cara.', tip: 'Bloquéalo o agáchate (golpea alto).',
  ai: { role: 'poke', range: [0, 110] }
});

def('mewingGlare', {
  name: 'Mandíbula de Acero', cost: 15, cd: 180, startup: 4, active: 26, recovery: 12, color: '#9be7ff',
  anim: [[0, 'mew'], [42, 'mew']], mods: [[0, 42, 'menacing']],
  counter: {
    from: 4, to: 30, types: ['strike'],
    on(d, a, hit, src, b) {
      // el golpe rebota en la mandíbula marcada: el atacante se duele la mano
      if (a.move && a.move.lock) b.releaseLock(a, a.move.lock, true);
      a.move = null; a.setState('hitstun'); a.hitstun = 30; a.reactPose = 'shocked';
      a.addStatus('dizzy', 40, {}, d);
      b.dealDamage(d, a, 45);
      d.addStatus('mewing', 180, {}, d);
      fx(b, 'jawline', { f: d, big: true }); say(b, d, 'JAWLINE CHECK', '#9be7ff');
      d.move.f = 30;
      return true;
    }
  },
  desc: 'Postura de mewing: si te golpean, el puño rebota en tu mandíbula, el rival se marea y tú ganas Mewing.', tip: 'Agárralo o lánzale un proyectil.',
  ai: { role: 'counter', range: [0, 160] }
});

def('sigmaTurn', {
  name: 'Espalda Sigma', cost: 15, cd: 200, startup: 8, active: 44, recovery: 12, color: '#c084fc',
  anim: [[0, 'guard'], [8, 'sigmaBack', 'inOut'], [52, 'sigmaBack'], [64, 'guard', 'inOut']],
  counter: {
    from: 8, to: 52, types: ['strike', 'grab'],
    on(d, a, hit, src, b) {
      // ni te mira: aparece a su espalda y le da un codazo
      b.teleport(d, a.x - a.facing * 70 * a.scale);
      d.facing = a.facing;
      if (a.move && a.move.lock) b.releaseLock(a, a.move.lock, true);
      a.move = null; a.setState('airhit'); a.grounded = false; a.vx = d.facing * 9; a.vy = -7; a.knockdownOnLand = true; a.y -= 1;
      b.dealDamage(d, a, 80);
      fx(b, 'sigmaFinish', { f: d, x: a.x, y: a.y - 100 }); say(b, d, 'NI TE MIRA', '#c084fc');
      d.move.data.countered = true;
      d.move.f = 52;
      return true;
    }
  },
  on: { end(f, b, m) { if (!m.data.countered) { f.gainEnergy(18); f.addStatus('cool', 240, {}, f); } } },
  desc: 'Le das la espalda con total indiferencia: si te ataca, apareces detrás y le das un codazo; si no, ganas energía y estilo.', tip: 'Agárralo desde lejos, lánzale proyectiles o simplemente no ataques.',
  ai: { role: 'counter', range: [0, 300] }
});

def('rizzLean', {
  name: 'Rizz Apoyado', cost: 20, cd: 300, startup: 14, active: 30, recovery: 14, color: '#ff5fa2',
  anim: [[0, 'guard'], [14, 'leanWall', 'out'], [44, 'leanWall'], [58, 'guard']],
  on: {
    frame(f, b, m, t) {
      if (t !== 18) return;
      fx(b, 'rizzWink', { f });
      for (const d of b.enemiesInRange(f, 340, true, 180)) {
        if (Math.sign(f.x - d.x) !== d.facing || d.crouching || d.isImmune('charmed')) { say(b, d, 'INMUNE AL RIZZ', '#aaaaaa', true); continue; }
        d.addStatus('charmed', 80, {}, f); b.drain(f, d, 30, 'RIZZEADO', '#ff5fa2'); m.hit = true;
      }
    }
  },
  desc: 'Te apoyas en una pared invisible y guiñas: si te mira, queda rizzeado y camina hacia ti indefenso.', tip: 'Agáchate o date la vuelta.',
  ai: { role: 'zone', range: [60, 330] }
});

def('menacingPose', {
  name: 'Pose Amenazante', cost: 20, cd: 360, startup: 10, active: 40, recovery: 12, color: '#9b5de5',
  armor: [0, 50],
  anim: [[0, 'guard'], [10, 'menace', 'back'], [50, 'menace'], [62, 'guard']], mods: [[10, 50, 'menacing']],
  on: {
    frame(f, b, m, t) {
      if (t >= 10 && t % 8 === 2) fx(b, 'menace', { f });
      if (t !== 26) return;
      f.gainEnergy(15);
      for (const d of b.enemiesInRange(f, 420, true, 200)) {
        if (Math.sign(f.x - d.x) !== d.facing || d.isImmune('fear')) continue;
        d.addStatus('fear', 60, {}, f); b.drain(f, d, 25, 'ゴゴゴゴ', '#9b5de5'); m.hit = true;
      }
    }
  },
  desc: 'Pose de manga con ゴゴゴゴ: súper armadura, energía, y quien te mire se asusta y pierde aura.', tip: 'Agárralo: la armadura no para los agarres.',
  ai: { role: 'buff', range: [100, 420] }
});

def('tralalero', {
  name: 'Tralalero Tralala', cost: 25, cd: 180, startup: 16, active: 2, recovery: 18, color: '#4cc9f0',
  anim: [[0, 'sharkFin'], [14, 'sharkFin'], [16, 'point', 'snap'], [36, 'guard']],
  on: {
    active(f, b, m) {
      fx(b, 'tralalero', { f });
      b.spawnProjectile(f, { kind: 'shark', ox: 50, oy: -40, vx: 9.5, w: 110, h: 64, life: 110, maxHits: 1,
        hit: H(70, { stun: 20, kb: [6, -9], knockdown: true, fx: 'chomp', spark: 'heavy', react: 'hurtGut' }), src: 'tralalero', staleK: m.staleK });
    }
  },
  desc: 'Invocas al tiburón con zapatillas: corre por el suelo y muerde (70, derriba).', tip: 'Sáltalo o recíbelo bloqueando.',
  ai: { role: 'zone', range: [180, 1400] }
});

def('brrPatapim', {
  name: 'Brr Brr Patapim', cost: 25, cd: 300, startup: 14, active: 1, recovery: 22, color: '#6b8e23',
  anim: [[0, 'guard'], [14, 'treeArms', 'back'], [37, 'treeArms']], mods: [[14, 37, 'tremble']],
  on: {
    active(f, b, m) {
      const d = b.targetFor(f); if (!d) return;
      fx(b, 'patapim', { f });
      b.spawnProjectile(f, { kind: 'roots', x: d.x, y: GROUND_Y - 40, absVx: true, vx: 0, w: 120, h: 90, life: 14, delay: 34, track: d, trackFor: 20, pierce: true, clash: false,
        hit: H(30, { stun: 20, kb: [0, 0], height: 'low', status: { id: 'patapim', frames: 100 }, react: 'scared' }), src: 'brrPatapim', staleK: m.staleK });
    }
  },
  desc: 'El árbol con pies: unas raíces brotan bajo el rival y lo dejan clavado al suelo casi 2 segundos.', tip: 'Cuando veas la marca, salta o haz dash.',
  ai: { role: 'zone', range: [150, 1500] }
});

def('liriliLarila', {
  name: 'Lirilì Larilà', cost: 25, cd: 360, startup: 18, active: 1, recovery: 16, color: '#a7c957',
  anim: [[0, 'guard'], [18, 'clockArms', 'back'], [35, 'clockArms']],
  on: {
    active(f, b, m) {
      fx(b, 'lirili', { f });
      for (const d of b.enemiesInRange(f, 320, false, 220)) {
        d.addStatus('lirili', 180, {}, f); b.dealDamage(f, d, 25); m.hit = true;
        b.emit('callout', { f: d, text: 'TIEMPO LENTO', color: '#a7c957', small: true });
      }
    }
  },
  desc: 'El elefante-cactus del reloj: ralentiza a los rivales cercanos (velocidad y energía) durante 3 s y los pincha.', tip: 'Mantén la distancia cuando lo prepare.',
  ai: { role: 'zone', range: [0, 300] }
});

def('ballerinaCappuccina', {
  name: 'Ballerina Cappuccina', cost: 20, cd: 150, startup: 8, active: 30, recovery: 16, color: '#ffb6c1',
  invuln: [1, 8], invulnType: 'strike', motion: [[8, 38, 9]],
  anim: [[0, 'armsUp'], [8, 'pirouette'], [38, 'pirouette'], [44, 'arabesque', 'out'], [54, 'guard']], mods: [[8, 38, 'pirouette']],
  hit: H(18, { stun: 14, kb: [2, -2], every: 8, maxHits: 4, box: { around: true, w: 120, h: 170, y: 0 }, spark: 'light', fx: 'coffee' }),
  desc: 'Bailarina con cabeza de capuchino: cruza el escenario en piruetas que golpean 4 veces. Invulnerable al empezar.', tip: 'Bloquéala y castiga el arabesque final.',
  ai: { role: 'approach', range: [80, 330] }
});

def('shoulderBrush', {
  name: 'Quitarse el Polvo', cost: 0, cd: 300, startup: 6, active: 30, recovery: 8, taunt: true, fragile: true, color: '#e0e0e0',
  anim: [[0, 'guard'], [6, 'brushShoulder'], [36, 'brushShoulder'], [44, 'guard']], mods: [[6, 36, 'brush']],
  on: {
    active(f, b, m) {
      if (m.data.interrupted) return;
      for (const id of ['tilted', 'mogged', 'fear', 'ratio', 'dizzy']) f.removeStatus(id);
      f.heal(60); fx(b, 'brushOff', { f }); say(b, f, 'NI ME HA DOLIDO', '#e0e0e0', true);
      for (const d of b.enemiesInRange(f, 300, false, 200)) if (b.isVulnerableForHumiliation(d) && b.drain(f, d, 25, 'IRRELEVANTE', '#e0e0e0')) m.hit = true;
    }
  },
  desc: 'Te sacudes el hombro con desprecio: limpias estados negativos y recuperas 60 de aura. Humilla a rivales derribados.', tip: 'Es frágil: golpéalo mientras lo hace.',
  ai: { role: 'humiliate', range: [250, 2000] }
});

def('defaultDance', {
  name: 'Baile Default', cost: 0, cd: 400, startup: 6, active: 60, recovery: 8, taunt: true, fragile: true, color: '#50fa7b',
  anim: [[0, 'guard'], [6, 'danced'], [66, 'danced'], [74, 'guard']], mods: [[6, 66, 'defaultDance']],
  on: {
    frame(f, b, m, t) {
      if (t % 12 === 6) fx(b, 'notes', { f });
      if (t !== 66 || m.data.interrupted) return;
      f.gainEnergy(35);
      for (const d of b.enemiesInRange(f, 420, false, 250)) if (b.isVulnerableForHumiliation(d) && b.drain(f, d, 45, 'BAILADO', '#50fa7b')) m.hit = true;
    }
  },
  desc: 'El baile por defecto, entero: si nadie te interrumpe, +35 de energía y humillas a los rivales en el suelo.', tip: 'Castígalo: deja todo el cuerpo abierto.',
  ai: { role: 'humiliate', range: [300, 2000] }
});

def('headPalm', {
  name: 'Tranquilo, Fiera', cost: 15, cd: 180, startup: 3, active: 22, recovery: 14, color: '#ffd166',
  anim: [[0, 'holdUp'], [25, 'holdUp'], [39, 'guard']],
  counter: {
    from: 3, to: 25, types: ['strike'],
    on(d, a, hit, src, b) {
      // le sujeta la cabeza con la palma: el rival da molinetes al aire sin llegar
      if (a.move && a.move.lock) b.releaseLock(a, a.move.lock, true);
      d.move.f = d.move.def.startup + 2;
      b.startLock(d, a, {
        frames: 64, off: [74, 0], tpose: t => (Math.floor(t / 5) % 2 ? 'windmillA' : 'windmillB'),
        anim: [[0, 'headPalm'], [54, 'headPalm'], [58, 'dapW', 'snap'], [64, 'dap', 'snap']],
        hands: (aa, tt, fr) => { if (fr > 56) return null; const j = tt.joints; return { n: { x: j.headX - aa.facing * j.headR * 0.6, y: j.headY - j.headR * 0.55, w: Math.min(1, fr / 3) } }; },
        frame: (ff, bb, mm, t, tt) => { if (t % 10 === 5) bb.emit('fx', { name: 'whiff', f: tt }); },
        hits: [{ f: 30, dmg: 0, drain: 40, say: 'TRANQUILO, FIERA', sayColor: '#ffd166' }, { f: 62, dmg: 55, spark: 'heavy', fx: 'slap', last: true, react: 'hurtGut' }],
        end: { kb: [10, -5], knockdown: true }
      });
      return true;
    }
  },
  desc: 'Contra: le pones la palma en la frente y el rival da molinetes al aire sin alcanzarte. Luego lo empujas.', tip: 'Agárralo, usa un proyectil o espera a que termine.',
  ai: { role: 'counter', range: [0, 130] }
});

def('brainrotInvasion', {
  ...ULT, name: 'Invasión Brainrot', startup: 24, active: 30, recovery: 24, color: '#4cc9f0',
  anim: [[0, 'sharkFin'], [20, 'sharkFin'], [24, 'point', 'snap'], [54, 'point']],
  on: {
    active(f, b, m) {
      fx(b, 'tralalero', { f, big: true });
      b.spawnProjectile(f, { kind: 'shark', ox: 50, oy: -40, vx: 14, w: 140, h: 80, life: 90, maxHits: 1, scale: 1.4,
        hit: { dmg: 0, unblockable: true, ultimate: true, stun: 1, kb: [0, 0] }, src: 'brainrotInvasion',
        onHit: (bb, p, dd) => {
          if (!f.move || f.move.def.id !== 'brainrotInvasion' || f.move.lock) return;
          p.dead = true;
          bb.startLock(f, dd, {
            frames: 150, off: [() => (dd.x - f.x) * f.facing / f.scale, 0], tpose: t => (t < 40 ? 'airHurt' : t < 80 ? 'scared' : t < 115 ? 'dizzy' : 'hurt'), cine: true,
            anim: [[0, 'point'], [40, 'conduct'], [150, 'conduct']], mods: [[40, 150, 'conduct']],
            frame: (ff, b2, mm, t, tt) => {
              if (t === 2) b2.emit('fx', { name: 'brainrot', step: 'shark', f: tt, a: ff });
              if (t === 40) b2.emit('fx', { name: 'brainrot', step: 'plane', f: tt, a: ff });
              if (t === 80) b2.emit('fx', { name: 'brainrot', step: 'tung', f: tt, a: ff });
              if (t === 112) b2.emit('fx', { name: 'brainrot', step: 'ballerina', f: tt, a: ff });
            },
            hits: [{ f: 6, dmg: 50, spark: 'heavy', fx: 'chomp' }, { f: 56, dmg: 30, spark: 'heavy', fx: 'boom' }, { f: 64, dmg: 30, spark: 'heavy', fx: 'boom' }, { f: 72, dmg: 30, spark: 'heavy', fx: 'boom' },
              { f: 90, dmg: 40, spark: 'heavy', fx: 'tung' }, { f: 98, dmg: 40, spark: 'heavy', fx: 'tung' }, { f: 132, dmg: 90, spark: 'mega', fx: 'coffee', say: 'BRAINROT TOTAL', sayColor: '#4cc9f0', last: true, hitstop: 18 }],
            end: { kb: [10, -11], knockdown: true }
          });
        } });
    }
  },
  desc: 'El tiburón con zapatillas abre paso; si muerde, llegan el cocodrilo bombardero, Tung Tung Sahur y la bailarina capuchino (≈310).', tip: 'Salta al tiburón inicial.',
  ai: { role: 'ult', range: [0, 1300] }
});

def('mainCharacterEnding', {
  ...ULT, name: 'Final de Protagonista', startup: 20, active: 40, recovery: 20, color: '#ffe066',
  anim: [[0, 'pockets'], [60, 'pockets']],
  on: {
    frame(f, b, m, t) {
      if (t !== 20) return;
      const d = b.targetFor(f); if (!d) return;
      b.spawnProjectile(f, { kind: 'none', x: d.x, y: GROUND_Y - 100, absVx: true, vx: 0, w: 120, h: 200, life: 10, delay: 26, track: d, trackFor: 20, pierce: true, clash: false,
        hit: { dmg: 0, unblockable: true, ultimate: true, stun: 1, kb: [0, 0] }, src: 'mainCharacterEnding',
        onHit: (bb, p, dd) => {
          if (!f.move || f.move.def.id !== 'mainCharacterEnding' || f.move.lock) return;
          f.addStatus('cool', 300, {}, f);
          bb.startLock(f, dd, {
            // el protagonista se aleja sin mirar mientras todo explota a su espalda
            frames: 130, off: [t => Math.max(80, (dd.x - f.x) * f.facing / f.scale), 0], tpose: t => (t < 90 ? 'scared' : 'airHurt'), cine: true,
            anim: [[0, 'pockets'], [14, 'walkAway', 'inOut'], [130, 'walkAway']],
            frame: (ff, b2, mm, t, tt) => {
              if (t > 14 && t < 100) ff.x -= ff.facing * 2.2;
              if (t === 20) b2.emit('fx', { name: 'credits', f: ff });
              if (t === 92) b2.emit('fx', { name: 'explosion', x: tt.x, y: tt.y - 80, big: true });
            },
            hits: [{ f: 40, dmg: 20, spark: 'light' }, { f: 92, dmg: 240, spark: 'mega', fx: 'boom', say: 'COOL GUYS DON\'T LOOK AT EXPLOSIONS', sayColor: '#ffe066', last: true, hitstop: 20 }],
            end: { kb: [7, -12], knockdown: true }
          });
        } });
    }
  },
  desc: 'Marcas al rival con un foco, te pones las gafas y te alejas sin mirar mientras explota a tu espalda (≈260).', tip: 'Cuando aparezca el foco, sal con dash.',
  ai: { role: 'ult', range: [0, 2000] }
});


// ---------- agarre de humillación ----------
def('teabag', {
  name: 'Teabag Supremo', cost: 20, cd: 150, startup: 10, active: 6, recovery: 26, color: '#ff66cc',
  anim: [[0, 'guard'], [8, 'dapW', 'out'], [12, 'teabagHold'], [40, 'guard']],
  hit: { dmg: 0, grab: true, box: frontBox(20, -160, 70, 130) },
  on: {
    grab(f, b, m, d) {
      // le agarra la cabeza, se la baja hasta la cintura y le da tres caderazos en la cara
      b.startLock(f, d, {
        frames: 64, off: [t => (t < 8 ? 70 : 82), 0], tpose: t => (t < 6 ? 'held' : 'headPulled'),
        anim: [[0, 'teabagHold'], [64, 'teabagHold']], mods: [[10, 52, 'thrust']],
        hands: (a, t, fr) => { const j = t.joints; return fr < 56 ? { n: { x: j.headX, y: j.headY - j.headR * 0.8, w: Math.min(1, fr / 4) } } : null; },
        frame: (ff, bb, mm, t, tt) => { if (t === 12) bb.emit('callout', { f: ff, text: 'TEABAG', color: '#ff66cc' }); },
        hits: [{ f: 13, dmg: 20, drain: 15, fx: 'boing', spark: 'light', react: 'headPulled' }, { f: 25, dmg: 20, drain: 15, fx: 'boing', spark: 'light', react: 'headPulled' }, { f: 38, dmg: 25, drain: 20, fx: 'boing', spark: 'medium', react: 'headPulled', say: 'HUMILLADO', sayColor: '#ff66cc' },
          { f: 58, dmg: 40, spark: 'heavy', fx: 'slap', last: true, react: 'hurtGut' }],
        end: { kb: [9, -5], knockdown: true }
      });
    }
  },
  desc: 'Le agarras la cabeza, se la bajas hasta tu cintura y le das tres caderazos en toda la cara. Agarre de humillación: atraviesa el bloqueo.', tip: 'Salta o castígalo mientras alarga el brazo.',
  ai: { role: 'grab', range: [0, 95] }
});

// ---------- REMATES DE K.O. (se activan con el golpe que gana el combate; se equipan en Personaje) ----------
const FIN = { slot: 'finisher', cost: 0, cd: 0, startup: 1, active: 2, recovery: 10, cine: false, ai: { role: 'finisher', range: [0, 0] } };
export const FINISHERS = {
  kickSpace: { name: 'Patada Espacial', price: 0, desc: 'Una patada tan fuerte que lo mandas al espacio exterior. Brilla como una estrella.' },
  pantsDown: { name: 'Bajada de Pantalones', price: 0, desc: 'Le bajas los pantalones delante de todos, lo señalas y te ríes. Calzoncillos de corazones incluidos.' },
  bonkGround: { name: 'Bonk Sello', price: 400, desc: 'Tres batazos que lo dejan aplastado como un sello.' },
  explosionWalk: { name: 'Explosión de Espaldas', price: 700, desc: 'Te das la vuelta, te alejas y explota a tu espalda. Ni lo miras.' }
};
export const FINISHER_SPECS = {
  kickSpace: (a, d) => ({
    // carga, patada vertical: el empeine sube hasta la barbilla (contacto IK) y en ese mismo instante sale
    // disparado en vertical; el atacante mantiene la patada arriba y luego mira al cielo con la mano en la frente
    frames: 64, off: [44, 0], launchAt: 16, tpose: t => (t < 4 ? 'scared' : t < 15 ? 'dazedUp' : 'launchUp'), cine: true,
    anim: [[0, 'guard'], [9, 'spaceKickW', 'anticip'], [15, 'spaceKick', 'snap'], [28, 'spaceKick'], [36, 'spaceKickHold', 'inOut'], [44, 'spaceKickDown', 'inOut'], [52, 'spaceLookUp', 'inOut'], [64, 'spaceLookUp']],
    feet: (aa, t, fr) => {
      if (fr < 11 || fr > 16) return null;
      const j = t.joints, w = Math.min(1, (fr - 10) / 5);
      // barbilla del rival (algo hacia su cara) y el tobillo justo debajo: la punta del pie toca la barbilla
      return { f: { x: j.headX + t.facing * j.headR * 0.3 - aa.facing * 3 * aa.scale, y: j.headY + j.headR * 0.95 + 11 * aa.scale, w } };
    },
    hits: [{ f: 15, dmg: 0, spark: 'heavy', fx: 'spaceKick', hitstop: 14, react: 'launchUp', reactFrames: 60 }],
    end: { kb: [0.4, -34], knockdown: true, space: true }
  }),
  pantsDown: (a, d) => ({
    // agarra la cinturilla, tira hacia abajo (la prenda baja por las piernas con la mano) y se ríe señalando
    frames: 112, off: [t => (t < 18 ? 58 : 74), 0], tpose: t => (t < 16 ? 'held' : 'pantsShock'), cine: true,
    anim: [[0, 'guard'], [10, 'pantsGrab', 'out'], [16, 'pantsGrab'], [26, 'crouch', 'inOut'], [36, 'pointLaugh', 'out'], [104, 'pointLaugh']], mods: [[36, 104, 'laugh']],
    hands: (aa, t, fr) => {
      if (fr < 8 || fr > 27) return null;
      const j = t.joints, s = t.scale, w = Math.min(1, (fr - 7) / 3) * (fr > 24 ? Math.max(0, 1 - (fr - 24) / 3) : 1);
      const drop = t.pantsDrop || 0, top = Math.min(1.82, 0.15 + drop * 1.7);
      const lp = (k, u) => (u <= 1 ? [j.hipX + (j[k + 'KneeX'] - j.hipX) * u, j.hipY + (j[k + 'KneeY'] - j.hipY) * u] : [j[k + 'KneeX'] + (j[k + 'FootX'] - j[k + 'KneeX']) * (u - 1), j[k + 'KneeY'] + (j[k + 'FootY'] - j[k + 'KneeY']) * (u - 1)]);
      const [nx, ny] = drop > 0 ? lp('n', top) : [j.hipX, j.hipY - 4 * s], [fx, fy] = drop > 0 ? lp('f', top) : [j.hipX, j.hipY - 2 * s];
      return { n: { x: nx - aa.facing * 6 * s, y: ny, w }, f: { x: fx - aa.facing * 2 * s, y: fy + 2 * s, w } };
    },
    frame: (ff, bb, mm, t, tt) => {
      if (t >= 16 && t <= 25) tt.pantsDrop = Math.min(1, (t - 15) / 9);
      if (t === 18) bb.emit('fx', { name: 'pantsDown', f: tt, a: ff });
      if (t > 36 && t % 18 === 0) bb.emit('fx', { name: 'laughPoint', f: ff });
    },
    hits: [{ f: 18, dmg: 0, drain: 0, fx: 'boing', react: 'pantsShock', reactFrames: 90 }, { f: 100, dmg: 0, spark: 'light', last: true, react: 'pantsShock' }],
    end: { kb: [1, -3], knockdown: true }
  }),
  bonkGround: (a, d) => ({
    frames: 92, off: [64, 0], tpose: 'held', cine: true,
    anim: [[0, 'bonkW'], [16, 'bonkW'], [22, 'bonk', 'snap'], [34, 'bonkW'], [42, 'bonk', 'snap'], [54, 'bonkW'], [62, 'bonk', 'snap'], [92, 'bonk']],
    hands: (aa, t, fr) => { for (const h of [22, 42, 62]) if (fr >= h - 1 && fr < h + 8) { const j = t.joints; return { n: { x: j.headX, y: j.headY - j.headR, w: 1 } }; } return null; },
    frame: (ff, bb, mm, t, tt) => { const n = (t >= 22) + (t >= 42) + (t >= 62); tt.squashY = 1 - n * 0.2; tt.squashX = 1 + n * 0.18; },
    hits: [{ f: 22, dmg: 0, fx: 'tung', spark: 'heavy', react: 'flattened', reactFrames: 30 }, { f: 42, dmg: 0, fx: 'tung', spark: 'heavy', react: 'flattened', reactFrames: 30 }, { f: 62, dmg: 0, fx: 'tung', spark: 'mega', react: 'flattened', reactFrames: 40, say: 'APLASTADO', sayColor: '#c68642', last: true, hitstop: 14 }],
    end: { kb: [0, -2], knockdown: true }
  }),
  explosionWalk: (a, d) => ({
    frames: 100, off: [t => 80 + Math.max(0, t - 14) * 2.2, 0], tpose: t => (t < 70 ? 'scared' : 'airHurt'), cine: true,
    anim: [[0, 'pockets'], [14, 'walkAway', 'inOut'], [100, 'walkAway']],
    frame: (ff, bb, mm, t, tt) => { if (t === 14) ff.addStatus('cool', 240, {}, ff); if (t === 70) bb.emit('fx', { name: 'explosion', x: tt.x, y: tt.y - 80, big: true }); },
    hits: [{ f: 70, dmg: 0, spark: 'mega', fx: 'boom', say: 'NI LO MIRA', sayColor: '#ffe066', last: true, hitstop: 16 }],
    end: { kb: [8, -13], knockdown: true }
  })
};
for (const id in FINISHERS) def('fin_' + id, { ...FIN, name: FINISHERS[id].name, color: '#ffd166', anim: [[0, 'guard']], desc: FINISHERS[id].desc, tip: '' });

// Contactos automáticos: los movimientos de bofetada/palmada llevan la mano a la cara (o al pecho) al conectar.
for (const m of Object.values(MOVES)) {
  if (m.contacts || !m.anim) continue;
  const end = m.startup + m.active + 3;
  const has = n => m.anim.some(k => k[1] === n);
  if (has('slap')) m.contacts = [{ hand: 'n', at: 'face', from: m.startup, to: end, onHit: true }];
  else if (has('dap') || has('bonk')) m.contacts = [{ hand: 'n', at: has('bonk') ? 'top' : 'chest', from: m.startup, to: end, onHit: true }];
  else if (has('clap')) m.contacts = [{ hand: 'n', at: 'face', from: m.startup, to: end, onHit: true }];
}

export const BASIC_IDS = Object.values(MOVES).filter(m => m.slot === 'basic').map(m => m.id);
export const SPECIAL_IDS = Object.values(MOVES).filter(m => m.slot === 'special').map(m => m.id);
export const ULT_IDS = Object.values(MOVES).filter(m => m.slot === 'ult').map(m => m.id);

for (const m of Object.values(MOVES)) {
  m.total = total(m);
  if (!m.ai) m.ai = { role: 'none', range: [0, 100] };
  if (!m.ai.range) m.ai.range = [0, 100];
}

export function moveCount() { return BASIC_IDS.length + SPECIAL_IDS.length + ULT_IDS.length; }
export { WALL_L, WALL_R };

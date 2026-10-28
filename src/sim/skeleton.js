// Rig del stickman con cinemática inversa (IK) de dos huesos.
// Las poses no son ángulos: describen OBJETIVOS (dónde está cada mano y cada pie) y el IK coloca
// codos y rodillas. Así las manos alcanzan exactamente su objetivo (barbilla, mandíbula, mano del rival...).
//
// Marco local (antes de aplicar orientación y escala): x = hacia delante, y = hacia abajo.
//  hip  : posición de la cadera respecto a la raíz (punto del suelo bajo el personaje). De pie: [0, -76].
//  hn/hf: mano cercana / lejana respecto al hombro.
//  fn/ff: pie cercano / lejano respecto a la raíz (y = 0 apoyado en el suelo, negativo = levantado).
//  en/ef, kn/kf: pistas de dirección para codos y rodillas.

export const BONES = { thigh: 40, shin: 39, torso: 54, neck: 9, headR: 15, upper: 31, fore: 29, hand: 6, foot: 13, shoulderDrop: 6 };
export const STAND_HIP = -76;

const D2R = Math.PI / 180;

export const BASE_POSE = {
  hip: [0, STAND_HIP], lean: 4, head: 0,
  hn: [8, 56], hf: [-6, 56], fn: [12, 0], ff: [-12, 0],
  en: [-0.3, 1], ef: [-0.3, 1], kn: [1, 0.15], kf: [1, 0.15],
  hsn: 'fist', hsf: 'fist', rn: 0, rf: 0, face: 'normal', spin: 0, pn: 1, pf: 1
};

const NUM = ['lean', 'head', 'rn', 'rf', 'spin', 'pn', 'pf'];
const VEC = ['hip', 'hn', 'hf', 'fn', 'ff', 'en', 'ef', 'kn', 'kf'];

export function makePose(p = {}) {
  const o = {};
  for (const k of NUM) o[k] = p[k] ?? BASE_POSE[k];
  for (const k of VEC) { const v = p[k] || BASE_POSE[k]; o[k] = [v[0], v[1]]; }
  o.hsn = p.hsn ?? BASE_POSE.hsn; o.hsf = p.hsf ?? BASE_POSE.hsf; o.face = p.face ?? BASE_POSE.face;
  // pies levantados por defecto no se anclan al suelo
  if (p.pn === undefined) o.pn = o.fn[1] < -4 ? 0 : 1;
  if (p.pf === undefined) o.pf = o.ff[1] < -4 ? 0 : 1;
  return o;
}

export function copyPose(src, dst) {
  dst = dst || makePose(src);
  for (const k of NUM) dst[k] = src[k];
  for (const k of VEC) { dst[k][0] = src[k][0]; dst[k][1] = src[k][1]; }
  dst.hsn = src.hsn; dst.hsf = src.hsf; dst.face = src.face;
  return dst;
}

export function lerpPose(a, b, t, out) {
  out = out || makePose(a);
  for (const k of NUM) out[k] = a[k] + (b[k] - a[k]) * t;
  for (const k of VEC) { out[k][0] = a[k][0] + (b[k][0] - a[k][0]) * t; out[k][1] = a[k][1] + (b[k][1] - a[k][1]) * t; }
  const pick = t < 0.5 ? a : b;
  out.hsn = pick.hsn; out.hsf = pick.hsf; out.face = pick.face;
  return out;
}

export const ease = {
  linear: t => t,
  out: t => 1 - (1 - t) * (1 - t),
  in: t => t * t,
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  back: t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  snap: t => 1 - Math.pow(1 - t, 4),
  anticip: t => (t < 0.25 ? -0.15 * Math.sin(t * 4 * Math.PI) : 1 - Math.pow(1 - (t - 0.25) / 0.75, 3)),
  hold: t => (t < 1 ? 0 : 1)
};

// IK de dos huesos: desde la raíz (ax,ay) al objetivo (tx,ty). hint = dirección preferida de la articulación media.
// Devuelve [mx, my, ex, ey] (articulación media y extremo alcanzado).
export function ik2(ax, ay, tx, ty, l1, l2, hx, hy, out) {
  let dx = tx - ax, dy = ty - ay;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.01, min = Math.abs(l1 - l2) + 0.5;
  if (d < 1e-4) { dx = 0; dy = 1; d = 1e-4; }
  const dc = Math.max(min, Math.min(max, d));
  const ux = dx / d, uy = dy / d;
  const ex = ax + ux * dc, ey = ay + uy * dc;
  // ley del coseno: distancia a lo largo y altura del codo
  const a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const px = ax + ux * a, py = ay + uy * a;
  // dos soluciones perpendiculares; elige la alineada con la pista
  const nx = -uy, ny = ux;
  const s = (nx * hx + ny * hy) >= 0 ? 1 : -1;
  out[0] = px + nx * h * s; out[1] = py + ny * h * s; out[2] = ex; out[3] = ey;
  return out;
}

const _ik = [0, 0, 0, 0];

// Calcula las articulaciones en coordenadas de mundo.
// o.feet = {n:[x,y], f:[x,y]} anclajes de pie en mundo; o.hands = {n:[x,y], f:[x,y]} objetivos de mano en mundo.
export function computeJoints(pose, x, y, facing, scale, grounded, out, o = null) {
  out = out || {};
  const s = scale, B = BONES;
  const spin = pose.spin || 0;
  const fx = facing * (spin ? (Math.abs(Math.cos(spin * D2R)) < 0.06 ? 0.06 * Math.sign(Math.cos(spin * D2R) || 1) : Math.cos(spin * D2R)) : 1);
  const hipX = x + pose.hip[0] * fx * s, hipY = y + pose.hip[1] * s;
  const L = pose.lean * D2R;
  const neckX = hipX + Math.sin(L) * fx * B.torso * s, neckY = hipY - Math.cos(L) * B.torso * s;
  const shX = neckX - Math.sin(L) * fx * B.shoulderDrop * s, shY = neckY + Math.cos(L) * B.shoulderDrop * s;
  const H = (pose.lean + pose.head) * D2R;
  const hd = (B.neck + B.headR) * s;
  const headX = neckX + Math.sin(H) * fx * hd, headY = neckY - Math.cos(H) * hd;

  // brazos
  const arm = (key, tgt, hint, ovr) => {
    let tx, ty;
    if (ovr) { tx = ovr[0]; ty = ovr[1]; } else { tx = shX + tgt[0] * fx * s; ty = shY + tgt[1] * s; }
    ik2(shX, shY, tx, ty, B.upper * s, B.fore * s, hint[0] * fx, hint[1], _ik);
    out[key + 'ElbowX'] = _ik[0]; out[key + 'ElbowY'] = _ik[1]; out[key + 'HandX'] = _ik[2]; out[key + 'HandY'] = _ik[3];
  };
  arm('n', pose.hn, pose.en, o && o.hands && o.hands.n);
  arm('f', pose.hf, pose.ef, o && o.hands && o.hands.f);
  // piernas
  const leg = (key, tgt, hint, ovr) => {
    let tx, ty;
    if (ovr) { tx = ovr[0]; ty = ovr[1]; } else { tx = x + tgt[0] * fx * s; ty = y + tgt[1] * s; }
    if (grounded && ty > y) ty = y;
    ik2(hipX, hipY, tx, ty, B.thigh * s, B.shin * s, hint[0] * fx, hint[1], _ik);
    out[key + 'KneeX'] = _ik[0]; out[key + 'KneeY'] = _ik[1]; out[key + 'FootX'] = _ik[2]; out[key + 'FootY'] = _ik[3];
  };
  leg('n', pose.fn, pose.kn, o && o.feet && o.feet.n);
  leg('f', pose.ff, pose.kf, o && o.feet && o.feet.f);

  out.hipX = hipX; out.hipY = hipY; out.neckX = neckX; out.neckY = neckY; out.shX = shX; out.shY = shY;
  out.headX = headX; out.headY = headY; out.headR = B.headR * s;
  out.facing = facing; out.fx = fx; out.lean = pose.lean; out.headAng = pose.lean + pose.head; out.s = s;
  out.rootX = x; out.rootY = y;
  return out;
}

const JKEYS = ['hip', 'neck', 'sh', 'head', 'fElbow', 'fHand', 'nElbow', 'nHand', 'fKnee', 'fFoot', 'nKnee', 'nFoot'];
export const JOINT_NAMES = JKEYS;

export function shiftJoints(j, dx, dy) {
  for (const k of JKEYS) { j[k + 'X'] += dx; j[k + 'Y'] += dy; }
  if (j.rootX !== undefined) { j.rootX += dx; j.rootY += dy; }
}

export function cloneJoints(j) {
  const o = {};
  for (const k of JKEYS) { o[k + 'X'] = j[k + 'X']; o[k + 'Y'] = j[k + 'Y']; }
  o.headR = j.headR; o.facing = j.facing; o.fx = j.fx; o.s = j.s; o.headAng = j.headAng; o.lean = j.lean; o.rootX = j.rootX; o.rootY = j.rootY;
  return o;
}

// Caja de daño: cuerpo (cabeza, torso y piernas). Los brazos no cuentan para recibir golpes.
export function hurtboxFromJoints(j, out) {
  out = out || {};
  const r = j.headR;
  const x1 = Math.min(j.headX - r, j.hipX - 12 * j.s, j.neckX - 12 * j.s, j.nKneeX, j.fKneeX);
  const x2 = Math.max(j.headX + r, j.hipX + 12 * j.s, j.neckX + 12 * j.s, j.nKneeX, j.fKneeX);
  const y1 = Math.min(j.headY - r, j.neckY, j.hipY);
  const y2 = Math.max(j.headY + r, j.nFootY, j.fFootY, j.hipY + 10 * j.s);
  const cx = (x1 + x2) / 2;
  const w = Math.max(34 * j.s, Math.min(x2 - x1, 92 * j.s));
  out.x = cx - w / 2; out.w = w;
  out.y = y1 - 2; out.h = y2 - y1 + 4;
  return out;
}

// Superficie del cuerpo para contactos: devuelve el punto más cercano del torso/cabeza a (px,py)
// y si (px,py) está dentro (penetración), el punto empujado hacia fuera en la dirección dada.
export function bodySurface(j, px, py, dirX) {
  const s = j.s;
  // torso como cápsula cadera-cuello de radio 11
  const r = 11 * s;
  const ax = j.hipX, ay = j.hipY, bx = j.neckX, by = j.neckY;
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
  const cx = ax + vx * t, cy = ay + vy * t;
  const dT = Math.hypot(px - cx, py - cy);
  const hr = j.headR + 2 * s;
  const dH = Math.hypot(px - j.headX, py - j.headY);
  if (dH < hr && dH - hr < dT - r) {
    const ux = dH > 0.01 ? (px - j.headX) / dH : -dirX, uy = dH > 0.01 ? (py - j.headY) / dH : 0;
    return { inside: true, x: j.headX + ux * hr, y: j.headY + uy * hr, part: 'head' };
  }
  if (dT < r) {
    // empuja hacia el lado del atacante (dirección horizontal opuesta a dirX)
    return { inside: true, x: cx - dirX * r, y: py, part: py < cy - 0.2 * (by - ay) ? 'chest' : 'gut' };
  }
  return { inside: false, x: px, y: py, part: null };
}

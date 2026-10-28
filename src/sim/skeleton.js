// Esqueleto procedural del stickman: poses por ángulos absolutos y cinemática directa.
// Convención de ángulos: 0 = apuntando hacia abajo, +90 = hacia delante (dirección de mirada), 180 = arriba.
// Brazo/pierna "f" = lejano (detrás), "n" = cercano (delante).

export const BONES = {
  torso: 50, neck: 9, headR: 14, upper: 30, fore: 28, thigh: 37, shin: 37
};

const D2R = Math.PI / 180;

export const BASE_POSE = {
  hx: 0, hy: 0, lean: 0, head: 0,
  fa: [-12, 10], na: [14, 40],
  fl: [-8, -10], nl: [10, 4],
  fh: 'fist', nh: 'fist', face: 'normal', squash: 1
};

const NUM_KEYS = ['hx', 'hy', 'lean', 'head'];
const PAIR_KEYS = ['fa', 'na', 'fl', 'nl'];

export function makePose(p) {
  return {
    hx: p.hx ?? 0, hy: p.hy ?? 0, lean: p.lean ?? 0, head: p.head ?? 0,
    fa: p.fa ? [p.fa[0], p.fa[1]] : [...BASE_POSE.fa],
    na: p.na ? [p.na[0], p.na[1]] : [...BASE_POSE.na],
    fl: p.fl ? [p.fl[0], p.fl[1]] : [...BASE_POSE.fl],
    nl: p.nl ? [p.nl[0], p.nl[1]] : [...BASE_POSE.nl],
    fh: p.fh ?? 'fist', nh: p.nh ?? 'fist', face: p.face ?? 'normal',
    spin: p.spin ?? 0
  };
}

export function copyPose(src, dst) {
  dst = dst || makePose(src);
  for (const k of NUM_KEYS) dst[k] = src[k];
  for (const k of PAIR_KEYS) { dst[k][0] = src[k][0]; dst[k][1] = src[k][1]; }
  dst.fh = src.fh; dst.nh = src.nh; dst.face = src.face; dst.spin = src.spin || 0;
  return dst;
}

export function lerpPose(a, b, t, out) {
  out = out || makePose(a);
  for (const k of NUM_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  for (const k of PAIR_KEYS) {
    out[k][0] = a[k][0] + (b[k][0] - a[k][0]) * t;
    out[k][1] = a[k][1] + (b[k][1] - a[k][1]) * t;
  }
  out.spin = (a.spin || 0) + ((b.spin || 0) - (a.spin || 0)) * t;
  const pick = t < 0.5 ? a : b;
  out.fh = pick.fh; out.nh = pick.nh; out.face = pick.face;
  return out;
}

export const ease = {
  linear: t => t,
  out: t => 1 - (1 - t) * (1 - t),
  in: t => t * t,
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  snap: t => 1 - Math.pow(1 - t, 4)
};

function dir(angle, facing, len) {
  const r = angle * D2R;
  return [Math.sin(r) * facing * len, Math.cos(r) * len];
}

// Calcula las articulaciones en coordenadas de mundo.
// root = (x, y) a nivel de los pies. grounded => la articulación más baja toca el suelo.
export function computeJoints(pose, x, y, facing, scale, grounded, out) {
  const s = scale;
  const B = BONES;
  out = out || {};
  const standH = (B.thigh + B.shin) * 0.985 * s;
  let hipX = x + pose.hx * s * facing;
  let hipY = y - standH + pose.hy * s;
  const spin = pose.spin || 0; // giro 360: comprime horizontalmente
  const fx = facing * (spin ? Math.cos(spin * D2R) || 0.0001 : 1);

  const lean = pose.lean;
  // torso hacia arriba: ángulo 180 = arriba; lean positivo inclina hacia delante
  const neckX = hipX + Math.sin((180 - lean) * D2R) * fx * B.torso * s;
  const neckY = hipY + Math.cos((180 - lean) * D2R) * B.torso * s;
  const sh = 5 * s; // hombros un poco por debajo del cuello
  const shX = neckX - Math.sin(lean * D2R) * fx * sh;
  const shY = neckY + Math.cos(lean * D2R) * sh;
  const headAng = 180 - lean - pose.head;
  const hd = B.neck * s + B.headR * s;
  const headX = neckX + Math.sin(headAng * D2R) * fx * hd;
  const headY = neckY + Math.cos(headAng * D2R) * hd;

  const limb = (a, l1, l2, ox, oy, key1, key2) => {
    const e = dir(a[0], fx, l1 * s);
    const ex = ox + e[0], ey = oy + e[1];
    const h = dir(a[1], fx, l2 * s);
    out[key1 + 'X'] = ex; out[key1 + 'Y'] = ey;
    out[key2 + 'X'] = ex + h[0]; out[key2 + 'Y'] = ey + h[1];
  };
  limb(pose.fa, B.upper, B.fore, shX, shY, 'fElbow', 'fHand');
  limb(pose.na, B.upper, B.fore, shX, shY, 'nElbow', 'nHand');
  limb(pose.fl, B.thigh, B.shin, hipX, hipY, 'fKnee', 'fFoot');
  limb(pose.nl, B.thigh, B.shin, hipX, hipY, 'nKnee', 'nFoot');

  out.hipX = hipX; out.hipY = hipY;
  out.neckX = neckX; out.neckY = neckY;
  out.shX = shX; out.shY = shY;
  out.headX = headX; out.headY = headY; out.headR = B.headR * s;
  out.facing = facing; out.fx = fx; out.lean = lean; out.headAng = headAng;

  if (grounded) {
    let low = Math.max(out.fFootY, out.nFootY, out.fKneeY, out.nKneeY, hipY + 4 * s, headY + B.headR * s,
      out.fHandY, out.nHandY);
    const dy = y - low;
    if (dy !== 0) shiftJoints(out, 0, dy);
  }
  return out;
}

const JKEYS = ['hip', 'neck', 'sh', 'head', 'fElbow', 'fHand', 'nElbow', 'nHand', 'fKnee', 'fFoot', 'nKnee', 'nFoot'];
export const JOINT_NAMES = JKEYS;

export function shiftJoints(j, dx, dy) {
  for (const k of JKEYS) { j[k + 'X'] += dx; j[k + 'Y'] += dy; }
}

export function cloneJoints(j) {
  const o = {};
  for (const k of JKEYS) { o[k + 'X'] = j[k + 'X']; o[k + 'Y'] = j[k + 'Y']; }
  o.headR = j.headR; o.facing = j.facing; o.fx = j.fx;
  return o;
}

// Caja de daño (hurtbox) derivada del cuerpo
export function hurtboxFromJoints(j, out) {
  out = out || {};
  const r = j.headR;
  let x1 = Math.min(j.headX - r, j.hipX, j.neckX, j.fKneeX, j.nKneeX, j.fFootX, j.nFootX);
  let x2 = Math.max(j.headX + r, j.hipX, j.neckX, j.fKneeX, j.nKneeX, j.fFootX, j.nFootX);
  let y1 = Math.min(j.headY - r, j.neckY, j.hipY, j.fFootY, j.nFootY);
  let y2 = Math.max(j.headY + r, j.fFootY, j.nFootY, j.hipY, j.fKneeY, j.nKneeY);
  const cx = (x1 + x2) / 2;
  const w = Math.max(36, Math.min(x2 - x1, 90));
  out.x = cx - w / 2 - 4; out.w = w + 8;
  out.y = y1 - 4; out.h = y2 - y1 + 6;
  return out;
}

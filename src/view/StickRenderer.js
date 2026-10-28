// Dibujo vectorial del stickman: contorno, extremidades, cara expresiva, manos gestuales, accesorios y props.
import { JOINT_NAMES } from '../sim/skeleton.js';

export function hex(c) { return typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16); }
export function shade(c, f) {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * f)), g = Math.min(255, Math.max(0, ((c >> 8) & 255) * f)), b = Math.min(255, Math.max(0, (c & 255) * f));
  return (r << 16) | (g << 8) | b;
}
export function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
export function hsl(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

const T = {};
for (const k of JOINT_NAMES) { T[k + 'X'] = 0; T[k + 'Y'] = 0; }

function squash(j, sx, sy, rx, ry) {
  for (const k of JOINT_NAMES) {
    T[k + 'X'] = rx + (j[k + 'X'] - rx) * sx;
    T[k + 'Y'] = ry + (j[k + 'Y'] - ry) * sy;
  }
  T.headR = j.headR; T.fx = j.fx; T.facing = j.facing; T.headAng = j.headAng;
  return T;
}

function seg(g, x1, y1, x2, y2, w, color, alpha) {
  g.lineStyle(w, color, alpha);
  g.lineBetween(x1, y1, x2, y2);
  g.fillStyle(color, alpha);
  g.fillCircle(x1, y1, w / 2);
  g.fillCircle(x2, y2, w / 2);
}

function limb(g, ax, ay, bx, by, cx, cy, w, ow, col, oc, a) {
  seg(g, ax, ay, bx, by, ow, oc, a); seg(g, bx, by, cx, cy, ow, oc, a);
  seg(g, ax, ay, bx, by, w, col, a); seg(g, bx, by, cx, cy, w, col, a);
}

// ------------------------------------------------------------------
export function drawFighter(g, glow, f, look, opts = {}) {
  const s = f.scale;
  const alpha = (opts.alpha ?? 1) * (f.alpha ?? 1);
  const j = squash(f.joints, f.squashX, f.squashY, f.x, f.y);
  drawBody(g, glow, j, f.pose, s, look, alpha, opts, f);
}

export function drawBody(g, glow, j, pose, s, look, alpha, opts = {}, f = null) {
  const w = 7 * s, ow = w + 4.5 * s;
  const body = look.body, oc = look.outline ?? 0x0a0a14;
  const far = shade(body, 0.68);
  const flash = opts.flash || 0;
  const bodyC = flash ? mix(body, look.flashColor ?? 0xffffff, flash) : body;
  const farC = flash ? mix(far, look.flashColor ?? 0xffffff, flash) : far;
  const fx = j.fx;
  const dirSign = fx >= 0 ? 1 : -1;
  const time = opts.time || 0;

  // aura (capa aditiva)
  if (glow && opts.glow > 0) {
    const gi = opts.glow;
    const ac = look.auraFn ? look.auraFn(time) : look.aura;
    for (const [mul, al] of [[3.6, 0.07], [2.2, 0.12], [1.4, 0.16]]) {
      const ww = w * mul * (1 + Math.sin(time * 0.15) * 0.06);
      const a2 = al * gi * alpha;
      seg(glow, j.hipX, j.hipY, j.neckX, j.neckY, ww, ac, a2);
      seg(glow, j.shX, j.shY, j.fElbowX, j.fElbowY, ww, ac, a2); seg(glow, j.fElbowX, j.fElbowY, j.fHandX, j.fHandY, ww, ac, a2);
      seg(glow, j.shX, j.shY, j.nElbowX, j.nElbowY, ww, ac, a2); seg(glow, j.nElbowX, j.nElbowY, j.nHandX, j.nHandY, ww, ac, a2);
      seg(glow, j.hipX, j.hipY, j.fKneeX, j.fKneeY, ww, ac, a2); seg(glow, j.fKneeX, j.fKneeY, j.fFootX, j.fFootY, ww, ac, a2);
      seg(glow, j.hipX, j.hipY, j.nKneeX, j.nKneeY, ww, ac, a2); seg(glow, j.nKneeX, j.nKneeY, j.nFootX, j.nFootY, ww, ac, a2);
      glow.fillStyle(ac, a2); glow.fillCircle(j.headX, j.headY, j.headR + ww * 0.45);
    }
  }
  if (opts.ghost) {
    // solo silueta luminosa (clones, stands, fantasmas)
    const gc = opts.ghostColor ?? look.aura;
    const gg = glow || g;
    seg(gg, j.hipX, j.hipY, j.neckX, j.neckY, w, gc, alpha);
    for (const [a, b2, c] of [['sh', 'fElbow', 'fHand'], ['sh', 'nElbow', 'nHand'], ['hip', 'fKnee', 'fFoot'], ['hip', 'nKnee', 'nFoot']]) {
      seg(gg, j[a + 'X'], j[a + 'Y'], j[b2 + 'X'], j[b2 + 'Y'], w, gc, alpha);
      seg(gg, j[b2 + 'X'], j[b2 + 'Y'], j[c + 'X'], j[c + 'Y'], w, gc, alpha);
    }
    gg.lineStyle(w * 0.8, gc, alpha); gg.strokeCircle(j.headX, j.headY, j.headR);
    return;
  }

  const fh = pose.fh, nh = pose.nh;
  // brazo lejano
  limb(g, j.shX, j.shY, j.fElbowX, j.fElbowY, j.fHandX, j.fHandY, w, ow, farC, oc, alpha);
  drawHand(g, j.fElbowX, j.fElbowY, j.fHandX, j.fHandY, fh, s, farC, oc, alpha, dirSign);
  // pierna lejana
  limb(g, j.hipX, j.hipY, j.fKneeX, j.fKneeY, j.fFootX, j.fFootY, w, ow, farC, oc, alpha);
  drawFoot(g, j.fKneeX, j.fKneeY, j.fFootX, j.fFootY, s, farC, oc, alpha, dirSign);
  // torso
  seg(g, j.hipX, j.hipY, j.neckX, j.neckY, ow + 2 * s, oc, alpha);
  seg(g, j.hipX, j.hipY, j.neckX, j.neckY, w + 2 * s, bodyC, alpha);
  // cuello + cabeza
  seg(g, j.neckX, j.neckY, j.headX, j.headY, w * 0.8, bodyC, alpha);
  if (look.accessory === 'chain' || look.accessory === 'scarf') drawNeckAcc(g, j, s, look, alpha, dirSign, time);
  g.fillStyle(oc, alpha); g.fillCircle(j.headX, j.headY, j.headR + 2.4 * s);
  g.fillStyle(bodyC, alpha); g.fillCircle(j.headX, j.headY, j.headR);
  const showFace = Math.abs(fx) > 0.35 && Math.sign(fx) === Math.sign(j.facing);
  if (showFace) drawFace(g, j, pose.face, s, oc, alpha, dirSign, look, opts);
  drawAccessory(g, glow, j, s, look, alpha, dirSign, time, opts);
  // pierna cercana
  limb(g, j.hipX, j.hipY, j.nKneeX, j.nKneeY, j.nFootX, j.nFootY, w, ow, bodyC, oc, alpha);
  drawFoot(g, j.nKneeX, j.nKneeY, j.nFootX, j.nFootY, s, bodyC, oc, alpha, dirSign);
  // brazo cercano
  limb(g, j.shX, j.shY, j.nElbowX, j.nElbowY, j.nHandX, j.nHandY, w, ow, bodyC, oc, alpha);
  drawHand(g, j.nElbowX, j.nElbowY, j.nHandX, j.nHandY, nh, s, bodyC, oc, alpha, dirSign);
  if (opts.prop) opts.prop(g, glow, j, s, look, alpha, dirSign, time);
}

function drawFoot(g, kx, ky, x, y, s, col, oc, a, d) {
  const len = 9 * s;
  const ang = Math.atan2(y - ky, x - kx);
  // el pie apunta "hacia delante" perpendicular a la espinilla
  const px = Math.cos(ang - Math.PI / 2 * d) * len, py = Math.sin(ang - Math.PI / 2 * d) * len;
  const fx2 = x + px, fy2 = y + py;
  seg(g, x, y, fx2, fy2, 8.5 * s, oc, a);
  seg(g, x, y, fx2, fy2, 5 * s, col, a);
}

function drawHand(g, ex, ey, x, y, shape, s, col, oc, a, d) {
  if (shape === 'hidden') return;
  const ang = Math.atan2(y - ey, x - ex);
  const r = 4.6 * s;
  const finger = (rel, len, w = 2.6) => {
    const aa = ang + rel;
    const x2 = x + Math.cos(aa) * len * s, y2 = y + Math.sin(aa) * len * s;
    seg(g, x, y, x2, y2, (w + 2.4) * s, oc, a);
    seg(g, x, y, x2, y2, w * s, col, a);
  };
  switch (shape) {
    case 'open': finger(-0.55, 9); finger(-0.18, 10.5); finger(0.18, 10.5); finger(0.55, 9); finger(-1.25 * d, 7); break;
    case 'palm': finger(-1.4 * d, 8); finger(-1.2 * d, 9); finger(-1.0 * d, 9); break;
    case 'point': finger(0, 12); break;
    case 'peace': finger(-0.25, 11); finger(0.25, 11); break;
    case 'L': finger(0, 11); finger(-1.5 * d, 9); break;
    case 'thumb': { const x2 = x, y2 = y - 10 * s; seg(g, x, y, x2, y2, 5 * s, oc, a); seg(g, x, y, x2, y2, 2.8 * s, col, a); } break;
    case 'thumbDown': { const x2 = x, y2 = y + 10 * s; seg(g, x, y, x2, y2, 5 * s, oc, a); seg(g, x, y, x2, y2, 2.8 * s, col, a); } break;
    case 'snap': finger(-0.4, 7); finger(0.4, 6); break;
    case 'phone': {
      g.fillStyle(oc, a); g.fillRect(x - 6 * s, y - 11 * s, 12 * s, 20 * s);
      g.fillStyle(0x4cc9f0, a); g.fillRect(x - 4.5 * s, y - 9.5 * s, 9 * s, 15 * s);
      break;
    }
  }
  g.fillStyle(oc, a); g.fillCircle(x, y, r + 2 * s);
  g.fillStyle(col, a); g.fillCircle(x, y, r);
}

function drawFace(g, j, face, s, oc, a, d, look, opts) {
  const r = j.headR, hx = j.headX, hy = j.headY;
  const ex1 = hx + d * r * 0.12, ex2 = hx + d * r * 0.55, ey = hy - r * 0.12;
  const mx = hx + d * r * 0.42, my = hy + r * 0.45;
  const er = Math.max(1.6, 1.9 * s);
  const line = (x1, y1, x2, y2, w = 2.2) => { g.lineStyle(w * s, oc, a); g.lineBetween(x1, y1, x2, y2); };
  const dot = (x, y, rr = er) => { g.fillStyle(oc, a); g.fillCircle(x, y, rr); };
  const shades = look.shades || look.accessory === 'shades';
  switch (face) {
    case 'angry':
      dot(ex1, ey + 1); dot(ex2, ey + 1);
      line(ex1 - d * 3 * s, ey - 5 * s, ex1 + d * 3 * s, ey - 3 * s); line(ex2 - d * 3 * s, ey - 3 * s, ex2 + d * 3 * s, ey - 6 * s);
      line(mx - d * 4 * s, my, mx + d * 3 * s, my);
      break;
    case 'smug':
      line(ex1 - 2.5 * s, ey, ex1 + 2.5 * s, ey); line(ex2 - 2.5 * s, ey, ex2 + 2.5 * s, ey);
      dot(ex1 + d * s, ey + 1.2 * s, er * 0.8); dot(ex2 + d * s, ey + 1.2 * s, er * 0.8);
      g.lineStyle(2.2 * s, oc, a); g.beginPath(); g.moveTo(mx - d * 5 * s, my); g.lineTo(mx, my + 1.5 * s); g.lineTo(mx + d * 4 * s, my - 3 * s); g.strokePath();
      break;
    case 'side': case 'stare': {
      g.fillStyle(0xffffff, a); g.fillEllipse(ex1, ey, 6 * s, 4 * s); g.fillEllipse(ex2, ey, 6 * s, 4 * s);
      const off = face === 'side' ? -d * 2.2 * s : d * 1.8 * s;
      dot(ex1 + off, ey, er * 0.9); dot(ex2 + off, ey, er * 0.9);
      line(ex1 - 3 * s, ey - 2.5 * s, ex1 + 3 * s, ey - 2.5 * s, 2.6); line(ex2 - 3 * s, ey - 2.5 * s, ex2 + 3 * s, ey - (face === 'side' ? 4.5 : 2.5) * s, 2.6);
      line(mx - d * 3 * s, my + s, mx + d * 3 * s, my + (face === 'side' ? 0 : 1) * s);
      if (face === 'stare' && opts.eyeGlow) { g.fillStyle(look.aura, 0.9 * a); g.fillCircle(ex2 + off, ey, er * 0.8); }
      break;
    }
    case 'shock':
      g.fillStyle(0xffffff, a); g.fillCircle(ex1, ey, 3.4 * s); g.fillCircle(ex2, ey, 3.4 * s);
      dot(ex1, ey, er * 0.7); dot(ex2, ey, er * 0.7);
      g.fillStyle(oc, a); g.fillEllipse(mx, my + s, 4.5 * s, 6 * s);
      break;
    case 'ko':
      for (const ex of [ex1, ex2]) { line(ex - 2.5 * s, ey - 2.5 * s, ex + 2.5 * s, ey + 2.5 * s); line(ex - 2.5 * s, ey + 2.5 * s, ex + 2.5 * s, ey - 2.5 * s); }
      g.fillStyle(oc, a); g.fillEllipse(mx, my, 6 * s, 3.5 * s);
      g.fillStyle(0xff6b8a, a); g.fillEllipse(mx + d * s, my + 2.5 * s, 3 * s, 3 * s);
      break;
    case 'mew':
      dot(ex1, ey); dot(ex2, ey);
      line(ex1 - 3 * s, ey - 4 * s, ex1 + 3 * s, ey - 3.5 * s); line(ex2 - 3 * s, ey - 3.5 * s, ex2 + 3 * s, ey - 4 * s);
      line(mx - d * 3 * s, my - 1 * s, mx + d * 2.5 * s, my - 1 * s, 1.8);
      // mandíbula marcada
      g.lineStyle(2.4 * s, oc, a); g.beginPath();
      g.moveTo(hx - d * r * 0.55, hy + r * 0.55); g.lineTo(hx + d * r * 0.35, hy + r * 1.02); g.lineTo(hx + d * r * 0.92, hy + r * 0.62); g.strokePath();
      break;
    case 'blank':
      dot(ex1, ey, er * 0.7); dot(ex2, ey, er * 0.7);
      line(mx - d * 3 * s, my, mx + d * 3 * s, my, 1.8);
      break;
    case 'siu':
      g.lineStyle(2.2 * s, oc, a);
      g.beginPath(); g.arc(ex1, ey + 1.5 * s, 2.6 * s, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
      g.beginPath(); g.arc(ex2, ey + 1.5 * s, 2.6 * s, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
      g.fillStyle(oc, a); g.fillEllipse(mx, my, 7 * s, 9 * s);
      g.fillStyle(0xd94b6a, a); g.fillEllipse(mx, my + 2 * s, 4 * s, 3 * s);
      break;
    case 'rizz':
      line(ex1 - 2.5 * s, ey, ex1 + 2.5 * s, ey); dot(ex2, ey, er * 1.1);
      g.fillStyle(0xff7aa2, 0.55 * a); g.fillEllipse(hx + d * r * 0.55, hy + r * 0.25, 6 * s, 3.5 * s);
      g.lineStyle(2.2 * s, oc, a); g.beginPath(); g.arc(mx, my - 2 * s, 3.2 * s, 0.2, Math.PI - 0.2); g.strokePath();
      break;
    case 'rizzed':
      heartShape(g, ex1, ey, 3.2 * s, 0xff3b6b, a); heartShape(g, ex2, ey, 3.2 * s, 0xff3b6b, a);
      g.lineStyle(2 * s, oc, a); g.beginPath(); g.arc(mx, my - 2 * s, 3 * s, 0.2, Math.PI - 0.2); g.strokePath();
      break;
    case 'chill':
      line(ex1 - 2.5 * s, ey + 0.5 * s, ex1 + 2.5 * s, ey + 0.5 * s); line(ex2 - 2.5 * s, ey + 0.5 * s, ex2 + 2.5 * s, ey + 0.5 * s);
      dot(ex1, ey + 1.6 * s, er * 0.7); dot(ex2, ey + 1.6 * s, er * 0.7);
      g.lineStyle(2 * s, oc, a); g.beginPath(); g.arc(mx, my - 2 * s, 2.8 * s, 0.4, Math.PI - 0.6); g.strokePath();
      break;
    case 'laugh':
      g.lineStyle(2.2 * s, oc, a);
      g.beginPath(); g.arc(ex1, ey + 2 * s, 2.5 * s, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
      g.beginPath(); g.arc(ex2, ey + 2 * s, 2.5 * s, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
      g.fillStyle(oc, a); g.beginPath(); g.arc(mx, my - 1 * s, 5 * s, 0, Math.PI); g.closePath(); g.fillPath();
      g.fillStyle(0xffffff, a); g.fillRect(mx - 3.5 * s, my - 1 * s, 7 * s, 1.6 * s);
      break;
    case 'hurt':
      line(ex1 - 2.5 * s, ey - 2 * s, ex1 + 2 * s, ey); line(ex1 - 2.5 * s, ey + 2 * s, ex1 + 2 * s, ey);
      line(ex2 + 2.5 * s, ey - 2 * s, ex2 - 2 * s, ey); line(ex2 + 2.5 * s, ey + 2 * s, ex2 - 2 * s, ey);
      g.fillStyle(oc, a); g.fillEllipse(mx, my + s, 5 * s, 4 * s);
      break;
    case 'dizzy':
      g.lineStyle(1.6 * s, oc, a);
      for (const ex of [ex1, ex2]) { g.beginPath(); g.arc(ex, ey, 2.8 * s, 0, Math.PI * 1.6); g.strokePath(); dot(ex, ey, er * 0.5); }
      g.beginPath(); g.moveTo(mx - 4 * s, my); g.lineTo(mx - 1.5 * s, my - 1.5 * s); g.lineTo(mx + 1.5 * s, my + 1.5 * s); g.lineTo(mx + 4 * s, my); g.strokePath();
      break;
    case 'sleep':
      line(ex1 - 2.5 * s, ey + s, ex1 + 2.5 * s, ey + s); line(ex2 - 2.5 * s, ey + s, ex2 + 2.5 * s, ey + s);
      g.fillStyle(oc, a); g.fillCircle(mx, my, 1.8 * s);
      break;
    default:
      dot(ex1, ey); dot(ex2, ey);
      line(mx - d * 3 * s, my, mx + d * 3 * s, my, 2);
  }
  if (shades && face !== 'ko') {
    g.fillStyle(0x050505, a);
    g.fillRoundedRect(Math.min(ex1, ex2) - 4.5 * s, ey - 3.2 * s, Math.abs(ex2 - ex1) + 9 * s, 6 * s, 2 * s);
    g.fillStyle(0xffffff, 0.35 * a); g.fillRect(Math.min(ex1, ex2) - 2 * s, ey - 2 * s, 3 * s, 1.5 * s);
  }
}

export function heartShape(g, x, y, r, color, a) {
  g.fillStyle(color, a);
  g.fillCircle(x - r * 0.5, y - r * 0.25, r * 0.6);
  g.fillCircle(x + r * 0.5, y - r * 0.25, r * 0.6);
  g.fillTriangle(x - r * 1.08, y - r * 0.05, x + r * 1.08, y - r * 0.05, x, y + r * 1.1);
}

function drawNeckAcc(g, j, s, look, a, d, time) {
  const ac = look.accent, oc = look.outline ?? 0x0a0a14;
  if (look.accessory === 'chain') {
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = j.neckX - d * 6 * s + d * 14 * s * t, y = j.neckY + 4 * s + Math.sin(t * Math.PI) * 9 * s;
      g.fillStyle(oc, a); g.fillCircle(x, y, 3 * s); g.fillStyle(0xffd700, a); g.fillCircle(x, y, 2 * s);
    }
    g.fillStyle(0xffd700, a); g.fillCircle(j.neckX + d * s, j.neckY + 14 * s, 4 * s);
  } else {
    g.lineStyle(7 * s, oc, a); g.lineBetween(j.neckX - 6 * s, j.neckY + 2 * s, j.neckX + 6 * s, j.neckY + 2 * s);
    g.lineStyle(5 * s, ac, a); g.lineBetween(j.neckX - 6 * s, j.neckY + 2 * s, j.neckX + 6 * s, j.neckY + 2 * s);
    const wv = Math.sin(time * 0.2) * 4 * s;
    g.lineStyle(5 * s, ac, a); g.lineBetween(j.neckX, j.neckY + 2 * s, j.neckX - d * 20 * s, j.neckY + 8 * s + wv);
  }
}

function drawAccessory(g, glow, j, s, look, a, d, time, opts) {
  const acc = look.accessory;
  if (!acc || acc === 'none' || acc === 'chain' || acc === 'scarf' || acc === 'shades') return;
  const r = j.headR, hx = j.headX, hy = j.headY, top = hy - r;
  const ac = look.accent, oc = look.outline ?? 0x0a0a14;
  const fillO = (fn) => { fn(oc, 1.2); fn(ac, 1); };
  switch (acc) {
    case 'cap':
      g.fillStyle(oc, a); g.beginPath(); g.arc(hx, hy - r * 0.15, r + 2.5 * s, Math.PI, 0); g.closePath(); g.fillPath();
      g.fillStyle(ac, a); g.beginPath(); g.arc(hx, hy - r * 0.15, r + 0.5 * s, Math.PI, 0); g.closePath(); g.fillPath();
      g.lineStyle(5 * s, oc, a); g.lineBetween(hx - d * r * 0.8, hy - r * 0.2, hx - d * r * 1.8, hy - r * 0.05);
      g.lineStyle(3 * s, ac, a); g.lineBetween(hx - d * r * 0.8, hy - r * 0.2, hx - d * r * 1.75, hy - r * 0.05);
      break;
    case 'beanie':
      g.fillStyle(oc, a); g.beginPath(); g.arc(hx, hy - r * 0.1, r + 2.5 * s, Math.PI, 0); g.closePath(); g.fillPath();
      g.fillStyle(ac, a); g.beginPath(); g.arc(hx, hy - r * 0.1, r + 0.8 * s, Math.PI, 0); g.closePath(); g.fillPath();
      g.fillStyle(shade(ac, 0.75), a); g.fillRect(hx - r - 1.5 * s, hy - r * 0.35, r * 2 + 3 * s, 5 * s);
      g.fillStyle(oc, a); g.fillCircle(hx, top - 3 * s, 5 * s); g.fillStyle(0xffffff, a); g.fillCircle(hx, top - 3 * s, 3.5 * s);
      break;
    case 'headband': {
      g.lineStyle(6 * s, oc, a); g.lineBetween(hx - r, hy - r * 0.35, hx + r, hy - r * 0.35);
      g.lineStyle(4 * s, ac, a); g.lineBetween(hx - r, hy - r * 0.35, hx + r, hy - r * 0.35);
      const w1 = Math.sin(time * 0.25) * 5 * s, w2 = Math.sin(time * 0.25 + 1) * 5 * s;
      g.lineStyle(3.5 * s, ac, a);
      g.lineBetween(hx - d * r, hy - r * 0.35, hx - d * (r + 16 * s), hy - r * 0.1 + w1);
      g.lineBetween(hx - d * r, hy - r * 0.35, hx - d * (r + 13 * s), hy + r * 0.25 + w2);
      break;
    }
    case 'crown':
      fillO((c, k) => { g.fillStyle(c, a); g.beginPath(); const w = r * 1.0 * k, h = 11 * s * k; g.moveTo(hx - w, top + 3 * s); g.lineTo(hx - w, top - h); g.lineTo(hx - w * 0.5, top - h * 0.45); g.lineTo(hx, top - h * 1.1); g.lineTo(hx + w * 0.5, top - h * 0.45); g.lineTo(hx + w, top - h); g.lineTo(hx + w, top + 3 * s); g.closePath(); g.fillPath(); });
      g.fillStyle(0xff3355, a); g.fillCircle(hx, top - 2 * s, 2 * s);
      break;
    case 'halo':
      if (glow) { glow.lineStyle(6 * s, 0xfff6a0, 0.5 * a); glow.strokeEllipse(hx, top - 9 * s, r * 2.2, 7 * s); }
      g.lineStyle(3 * s, 0xfff6a0, a); g.strokeEllipse(hx, top - 9 * s, r * 2.2, 7 * s);
      break;
    case 'horns':
      for (const sx of [-1, 1]) {
        g.fillStyle(oc, a); g.fillTriangle(hx + sx * r * 0.35, top + 4 * s, hx + sx * r * 0.95, top + 2 * s, hx + sx * r * 0.95, top - 12 * s);
        g.fillStyle(0xd62828, a); g.fillTriangle(hx + sx * r * 0.45, top + 3 * s, hx + sx * r * 0.88, top + 1.5 * s, hx + sx * r * 0.9, top - 9 * s);
      }
      break;
    case 'tophat':
      g.fillStyle(oc, a); g.fillRect(hx - r * 0.75, top - 22 * s, r * 1.5, 24 * s); g.fillRect(hx - r * 1.35, top - 1 * s, r * 2.7, 5 * s);
      g.fillStyle(ac, a); g.fillRect(hx - r * 0.75 + 2, top - 6 * s, r * 1.5 - 4, 4 * s);
      break;
    case 'mohawk':
      for (let i = 0; i < 5; i++) {
        const ang = Math.PI * (0.25 + i * 0.125);
        const bx = hx - Math.cos(ang) * r * d, by = hy - Math.sin(ang) * r;
        g.fillStyle(oc, a); g.fillTriangle(bx - 4 * s, by + 2 * s, bx + 4 * s, by + 2 * s, bx - Math.cos(ang) * 11 * s * d, by - Math.sin(ang) * 12 * s);
        g.fillStyle(ac, a); g.fillTriangle(bx - 2.5 * s, by + 1 * s, bx + 2.5 * s, by + 1 * s, bx - Math.cos(ang) * 9 * s * d, by - Math.sin(ang) * 10 * s);
      }
      break;
    case 'bow':
      g.fillStyle(oc, a); g.fillTriangle(hx - d * 2 * s, top + 2 * s, hx - d * 13 * s, top - 7 * s, hx - d * 13 * s, top + 8 * s);
      g.fillTriangle(hx - d * 2 * s, top + 2 * s, hx + d * 9 * s, top - 7 * s, hx + d * 9 * s, top + 8 * s);
      g.fillStyle(ac, a); g.fillTriangle(hx - d * 2 * s, top + 2 * s, hx - d * 11 * s, top - 5 * s, hx - d * 11 * s, top + 6 * s);
      g.fillTriangle(hx - d * 2 * s, top + 2 * s, hx + d * 7 * s, top - 5 * s, hx + d * 7 * s, top + 6 * s);
      g.fillStyle(oc, a); g.fillCircle(hx - d * 2 * s, top + 1.5 * s, 3 * s);
      break;
    case 'antenna':
      g.lineStyle(2.5 * s, oc, a); g.lineBetween(hx, top, hx + d * 4 * s, top - 16 * s);
      g.fillStyle(oc, a); g.fillCircle(hx + d * 4 * s, top - 17 * s, 4.5 * s);
      g.fillStyle(Math.floor(time / 20) % 2 ? 0xff4444 : 0x44ff44, a); g.fillCircle(hx + d * 4 * s, top - 17 * s, 3 * s);
      break;
    case 'cowboy':
      g.fillStyle(oc, a); g.fillEllipse(hx, top + 2 * s, r * 3.4, 7 * s); g.fillRect(hx - r * 0.75, top - 12 * s, r * 1.5, 14 * s);
      g.fillStyle(0x8b5a2b, a); g.fillEllipse(hx, top + 2 * s, r * 3.1, 5 * s); g.fillRect(hx - r * 0.65, top - 10 * s, r * 1.3, 12 * s);
      g.fillStyle(ac, a); g.fillRect(hx - r * 0.65, top - 2 * s, r * 1.3, 2.5 * s);
      break;
    case 'bucket':
      g.fillStyle(oc, a); g.beginPath(); g.moveTo(hx - r * 1.45, top + 7 * s); g.lineTo(hx - r * 0.8, top - 7 * s); g.lineTo(hx + r * 0.8, top - 7 * s); g.lineTo(hx + r * 1.45, top + 7 * s); g.closePath(); g.fillPath();
      g.fillStyle(ac, a); g.beginPath(); g.moveTo(hx - r * 1.3, top + 5.5 * s); g.lineTo(hx - r * 0.72, top - 5.5 * s); g.lineTo(hx + r * 0.72, top - 5.5 * s); g.lineTo(hx + r * 1.3, top + 5.5 * s); g.closePath(); g.fillPath();
      break;
    case 'wizard':
      g.fillStyle(oc, a); g.fillTriangle(hx - r * 1.1, top + 4 * s, hx + r * 1.1, top + 4 * s, hx - d * 8 * s, top - 32 * s);
      g.fillStyle(0x3a0ca3, a); g.fillTriangle(hx - r * 0.95, top + 2.5 * s, hx + r * 0.95, top + 2.5 * s, hx - d * 7 * s, top - 28 * s);
      g.fillStyle(0xffd700, a); g.fillCircle(hx - d * 2 * s, top - 8 * s, 2.5 * s);
      break;
    case 'flameHair':
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI * (0.15 + i * 0.14);
        const bx = hx - Math.cos(ang) * r * d, by = hy - Math.sin(ang) * r;
        const fl = (12 + Math.sin(time * 0.4 + i * 1.7) * 5) * s;
        if (glow) { glow.fillStyle(0xff7b00, 0.35 * a); glow.fillCircle(bx, by - fl * 0.5, fl * 0.6); }
        g.fillStyle(0xff3d00, a); g.fillTriangle(bx - 4 * s, by + 2 * s, bx + 4 * s, by + 2 * s, bx - d * 3 * s, by - fl);
        g.fillStyle(0xffd000, a); g.fillTriangle(bx - 2 * s, by + 1 * s, bx + 2 * s, by + 1 * s, bx - d * 2 * s, by - fl * 0.6);
      }
      break;
  }
  void opts;
}

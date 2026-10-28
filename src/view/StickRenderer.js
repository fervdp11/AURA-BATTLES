// Render vectorial premium del stickman: extremidades afiladas con volumen (sombra + brillo + borde),
// manos con dedos según el gesto, zapatos, cara expresiva, accesorios y llamas de aura.
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
const lighten = (c, t) => mix(c, 0xffffff, t);

const T = {};
for (const k of JOINT_NAMES) { T[k + 'X'] = 0; T[k + 'Y'] = 0; }
function squash(j, sx, sy, rx, ry) {
  for (const k of JOINT_NAMES) { T[k + 'X'] = rx + (j[k + 'X'] - rx) * sx; T[k + 'Y'] = ry + (j[k + 'Y'] - ry) * sy; }
  T.headR = j.headR; T.fx = j.fx; T.facing = j.facing; T.headAng = j.headAng; T.lean = j.lean; T.s = j.s; T.rootX = j.rootX; T.rootY = ry + ((j.rootY ?? ry) - ry) * sy;
  return T;
}

// cápsula afilada (dos radios) con triángulos: sin teselado costoso
export function capsule(g, ax, ay, ar, bx, by, br, color, alpha) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  g.fillStyle(color, alpha);
  if (L < 0.5) { g.fillCircle(ax, ay, Math.max(ar, br)); return; }
  const nx = -dy / L, ny = dx / L;
  const x1 = ax + nx * ar, y1 = ay + ny * ar, x2 = bx + nx * br, y2 = by + ny * br;
  const x3 = bx - nx * br, y3 = by - ny * br, x4 = ax - nx * ar, y4 = ay - ny * ar;
  g.fillTriangle(x1, y1, x2, y2, x3, y3);
  g.fillTriangle(x1, y1, x3, y3, x4, y4);
  g.fillCircle(ax, ay, ar);
  g.fillCircle(bx, by, br);
}

// segmento con volumen: borde, relleno, sombra interior y brillo hacia la luz (arriba-izquierda)
function limbSeg(g, ax, ay, ar, bx, by, br, col, oc, ow, a) {
  capsule(g, ax, ay, ar + ow, bx, by, br + ow, oc, a);
  capsule(g, ax, ay, ar, bx, by, br, col, a);
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L, ny = dx / L;
  if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
  capsule(g, ax - nx * ar * 0.45, ay - ny * ar * 0.45, ar * 0.5, bx - nx * br * 0.45, by - ny * br * 0.45, br * 0.5, shade(col, 0.86), a * 0.45);
  capsule(g, ax + nx * ar * 0.4, ay + ny * ar * 0.4, ar * 0.28, bx + nx * br * 0.4, by + ny * br * 0.4, br * 0.28, lighten(col, 0.5), a * 0.55);
}

// ------------------------------------------------------------------
export function drawFighter(g, glow, f, look, opts = {}) {
  const alpha = (opts.alpha ?? 1) * (f.alpha ?? 1);
  const j = squash(f.joints, f.squashX, f.squashY, f.x, f.y);
  drawBody(g, glow, j, f.pose, f.scale, look, alpha, opts, f);
}

export function drawBody(g, glow, j, pose, s, look, alpha, opts = {}, f = null) {
  const oc = look.outline ?? 0x0a0a14;
  const body = look.body;
  const flash = opts.flash || 0;
  const fc = look.flashColor ?? 0xffffff;
  const bodyC = flash ? mix(body, fc, flash) : body;
  const farC = flash ? mix(shade(body, 0.62), fc, flash) : shade(body, 0.62);
  const d = j.fx >= 0 ? 1 : -1;
  const time = opts.time || 0;
  const ow = 2.4 * s;
  const R = { up: 4.7 * s, el: 3.9 * s, wr: 3.1 * s, th: 6 * s, kn: 4.6 * s, an: 3.5 * s, hip: 8.2 * s, chest: 10.4 * s };

  if (glow && opts.glow > 0) drawAuraGlow(glow, j, s, look, alpha, opts.glow, time, R);
  if (opts.ghost) { drawGhost(glow || g, j, s, opts.ghostColor ?? look.aura, alpha, R); return; }

  const hn = pose.hsn, hf = pose.hsf;
  // brazo lejano
  limbSeg(g, j.shX, j.shY, R.up, j.fElbowX, j.fElbowY, R.el, farC, oc, ow, alpha);
  limbSeg(g, j.fElbowX, j.fElbowY, R.el, j.fHandX, j.fHandY, R.wr, farC, oc, ow, alpha);
  drawHand(g, j.fElbowX, j.fElbowY, j.fHandX, j.fHandY, hf, pose.rf, s, farC, oc, alpha, d, time, true);
  // pierna lejana
  limbSeg(g, j.hipX, j.hipY, R.th, j.fKneeX, j.fKneeY, R.kn, farC, oc, ow, alpha);
  limbSeg(g, j.fKneeX, j.fKneeY, R.kn, j.fFootX, j.fFootY, R.an, farC, oc, ow, alpha);
  drawShoe(g, j.fKneeX, j.fKneeY, j.fFootX, j.fFootY, s, shade(look.accent, 0.6), oc, alpha, d, j.rootY);
  // torso (cadera estrecha, pecho ancho) + cinturón de acento
  const chX = j.hipX + (j.neckX - j.hipX) * 0.78, chY = j.hipY + (j.neckY - j.hipY) * 0.78;
  limbSeg(g, j.hipX, j.hipY, R.hip, chX, chY, R.chest, bodyC, oc, ow, alpha);
  capsule(g, chX, chY, R.chest * 0.9, j.neckX, j.neckY, 4.5 * s, bodyC, alpha);
  {
    const tx = j.neckX - j.hipX, ty = j.neckY - j.hipY, tl = Math.hypot(tx, ty) || 1;
    const px = -ty / tl, py = tx / tl, bx = j.hipX + tx * 0.12, by = j.hipY + ty * 0.12, w = R.hip * 1.02;
    capsule(g, bx - px * w, by - py * w, 2.2 * s, bx + px * w, by + py * w, 2.2 * s, look.accent, alpha);
  }
  // cuello y cabeza
  limbSeg(g, j.neckX, j.neckY, 4 * s, j.headX, j.headY, 3.6 * s, bodyC, oc, ow * 0.8, alpha);
  if (look.accessory === 'chain' || look.accessory === 'scarf') drawNeckAcc(g, j, s, look, alpha, d, time);
  drawHead(g, glow, j, s, bodyC, oc, alpha, d, look);
  const showFace = Math.abs(j.fx) > 0.35;
  if (showFace) drawFace(g, j, pose.face, s, oc, alpha, d, look, opts);
  drawAccessory(g, glow, j, s, look, alpha, d, time, opts);
  // pierna cercana
  limbSeg(g, j.hipX, j.hipY, R.th, j.nKneeX, j.nKneeY, R.kn, bodyC, oc, ow, alpha);
  limbSeg(g, j.nKneeX, j.nKneeY, R.kn, j.nFootX, j.nFootY, R.an, bodyC, oc, ow, alpha);
  drawShoe(g, j.nKneeX, j.nKneeY, j.nFootX, j.nFootY, s, look.accent, oc, alpha, d, j.rootY);
  // brazo cercano
  limbSeg(g, j.shX, j.shY, R.up, j.nElbowX, j.nElbowY, R.el, bodyC, oc, ow, alpha);
  limbSeg(g, j.nElbowX, j.nElbowY, R.el, j.nHandX, j.nHandY, R.wr, bodyC, oc, ow, alpha);
  drawHand(g, j.nElbowX, j.nElbowY, j.nHandX, j.nHandY, hn, pose.rn, s, bodyC, oc, alpha, d, time, false);
  if (opts.prop) opts.prop(g, glow, j, s, look, alpha, d, time);
}

function drawHead(g, glow, j, s, col, oc, a, d, look) {
  const r = j.headR, x = j.headX, y = j.headY;
  g.fillStyle(oc, a); g.fillCircle(x, y, r + 2.6 * s);
  g.fillStyle(col, a); g.fillCircle(x, y, r);
  // sombreado lateral y brillo
  g.fillStyle(shade(col, 0.8), a * 0.55); g.fillCircle(x + 3 * s, y + 3.2 * s, r * 0.82);
  g.fillStyle(col, a); g.fillCircle(x - 1.2 * s, y - 1.2 * s, r * 0.82);
  g.fillStyle(lighten(col, 0.6), a * 0.8); g.fillEllipse(x - r * 0.42, y - r * 0.5, r * 0.55, r * 0.32);
  if (glow) { glow.lineStyle(2 * s, look.aura, 0.35 * a); glow.beginPath(); glow.arc(x, y, r + 2.6 * s, d > 0 ? Math.PI * 0.6 : -0.4, d > 0 ? Math.PI * 1.4 : 0.4); glow.strokePath(); }
}

function drawGhost(g, j, s, gc, alpha, R) {
  const seg = (a, b, r1, r2) => capsule(g, j[a + 'X'], j[a + 'Y'], r1, j[b + 'X'], j[b + 'Y'], r2, gc, alpha);
  seg('hip', 'neck', R.hip, R.chest);
  seg('sh', 'fElbow', R.up, R.el); seg('fElbow', 'fHand', R.el, R.wr);
  seg('sh', 'nElbow', R.up, R.el); seg('nElbow', 'nHand', R.el, R.wr);
  seg('hip', 'fKnee', R.th, R.kn); seg('fKnee', 'fFoot', R.kn, R.an);
  seg('hip', 'nKnee', R.th, R.kn); seg('nKnee', 'nFoot', R.kn, R.an);
  g.fillStyle(gc, alpha); g.fillCircle(j.headX, j.headY, j.headR);
}

function drawAuraGlow(g, j, s, look, alpha, gi, time, R) {
  const ac = look.auraFn ? look.auraFn(time) : look.aura;
  const segs = [['hip', 'neck'], ['sh', 'fElbow'], ['fElbow', 'fHand'], ['sh', 'nElbow'], ['nElbow', 'nHand'], ['hip', 'fKnee'], ['fKnee', 'fFoot'], ['hip', 'nKnee'], ['nKnee', 'nFoot']];
  for (const [mul, al] of [[3.4, 0.04], [2.2, 0.07], [1.5, 0.1]]) {
    const w = 5 * s * mul * (1 + Math.sin(time * 0.15) * 0.05);
    const a2 = al * gi * alpha;
    for (const [p, q] of segs) capsule(g, j[p + 'X'], j[p + 'Y'], w, j[q + 'X'], j[q + 'Y'], w * 0.8, ac, a2);
    g.fillStyle(ac, a2); g.fillCircle(j.headX, j.headY, j.headR + w * 0.7);
  }
  // llamas de aura que suben del cuerpo
  if (gi > 0.55) {
    const n = 9, k = Math.min(1.6, gi);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const bx = j.hipX + (j.neckX - j.hipX) * t * 0.9 + Math.sin(time * 0.2 + i * 2.1) * 6 * s;
      const by = j.hipY + (j.neckY - j.hipY) * t * 0.9 + 10 * s;
      const h = (34 + 26 * Math.sin(time * 0.31 + i * 1.7) ** 2) * s * k;
      const w = (9 + 3 * Math.sin(time * 0.4 + i)) * s;
      const sway = Math.sin(time * 0.17 + i * 0.9) * 9 * s;
      g.fillStyle(ac, 0.09 * alpha * k);
      g.fillTriangle(bx - w, by, bx + w, by, bx + sway, by - h);
      g.fillStyle(lighten(ac, 0.5), 0.07 * alpha * k);
      g.fillTriangle(bx - w * 0.45, by, bx + w * 0.45, by, bx + sway * 0.8, by - h * 0.65);
    }
  }
}

function drawShoe(g, kx, ky, x, y, s, col, oc, a, d, rootY) {
  // en el suelo el pie queda plano; en el aire, perpendicular a la espinilla
  let ang = Math.atan2(y - ky, x - kx) - Math.PI / 2 * d;
  const flat = d > 0 ? 0 : Math.PI;
  if (rootY !== undefined) {
    const k = Math.max(0, Math.min(1, 1 - Math.abs(rootY - y) / (14 * s)));
    let diff = flat - ang; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
    ang += diff * k;
  }
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const len = 12 * s;
  const tx = x + ca * len, ty = y + sa * len;
  const hx = x - ca * 3.2 * s, hy = y - sa * 3.2 * s;
  capsule(g, hx, hy, 4.6 * s, tx, ty, 3.9 * s, oc, a);
  capsule(g, hx, hy, 3.2 * s, tx, ty, 2.6 * s, col, a);
  // suela
  const nx = -sa, ny = ca;
  const sx = d > 0 ? 1 : -1;
  capsule(g, hx + nx * 2.4 * s * sx, hy + ny * 2.4 * s * sx, 1.3 * s, tx + nx * 2 * s * sx, ty + ny * 2 * s * sx, 1.2 * s, 0xf2f2f2, a * 0.9);
}

// ---------------- manos ----------------
// Dedos en el marco local de la mano: u = a lo largo del antebrazo, v = perpendicular (hacia el pulgar).
function drawHand(g, ex, ey, x, y, shape, rot, s, col, oc, a, d, time, far) {
  if (shape === 'hidden') return;
  let ang = Math.atan2(y - ey, x - ex) + (rot || 0) * Math.PI / 180 * d;
  const u = [Math.cos(ang), Math.sin(ang)], v = [-u[1] * d, u[0] * d];
  const P = (pu, pv) => [x + (u[0] * pu + v[0] * pv) * s, y + (u[1] * pu + v[1] * pv) * s];
  const fw = 1.7 * s;
  const finger = (bu, bv, len, dir = 0, w = fw) => {
    const c = Math.cos(dir), sn = Math.sin(dir);
    const [x1, y1] = P(bu, bv);
    const [x2, y2] = P(bu + c * len, bv + sn * len);
    capsule(g, x1, y1, w + 1.6 * s, x2, y2, w * 0.9 + 1.6 * s, oc, a);
    capsule(g, x1, y1, w, x2, y2, w * 0.9, col, a);
  };
  const palm = (rw = 4.4, rl = 3.2) => {
    const [ax2, ay2] = P(-0.5, 0), [bx2, by2] = P(3.4, 0);
    capsule(g, ax2, ay2, (rw + 1.5) * s, bx2, by2, (rw + 1.1) * s, oc, a);
    capsule(g, ax2, ay2, rw * s, bx2, by2, (rw - 0.4) * s, col, a);
  };
  switch (shape) {
    case 'fist': default: {
      const [a1x, a1y] = P(-0.5, 0), [b1x, b1y] = P(4.5, 0), [t1x, t1y] = P(1.5, 3.2), [t2x, t2y] = P(5, 2.4);
      capsule(g, a1x, a1y, 6.2 * s, b1x, b1y, 5.8 * s, oc, a);
      capsule(g, t1x, t1y, 3 * s, t2x, t2y, 2.7 * s, oc, a);
      capsule(g, a1x, a1y, 4.8 * s, b1x, b1y, 4.4 * s, col, a);
      capsule(g, t1x, t1y, 1.6 * s, t2x, t2y, 1.4 * s, shade(col, 0.9), a);
      g.lineStyle(1 * s, shade(col, 0.7), a); for (let i = -1; i <= 1; i++) { const [k1x, k1y] = P(6.3, i * 2.4 - 1); const [k2x, k2y] = P(6.3, i * 2.4 + 1); g.lineBetween(k1x, k1y, k2x, k2y); }
      break;
    }
    case 'relaxed': palm(3.8, 2.8); finger(4, -2, 4.2, 0.6); finger(4, 0, 4.6, 0.7); finger(4, 2, 4.2, 0.8); finger(1, 3.2, 3, 0.3, 1.4 * s); break;
    case 'open': palm(); finger(4.5, -3, 6.5, -0.35); finger(5, -1, 7.5, -0.1); finger(5, 1, 7.5, 0.1); finger(4.5, 3, 6.5, 0.35); finger(0.5, 4.5, 5, 1.0); break;
    case 'flat': palm(4, 3.4); finger(5, -1.6, 7.5, 0); finger(5, 0, 8, 0); finger(5, 1.6, 7.5, 0); finger(1, 3.6, 4.5, 0.5, 1.5 * s); break;
    case 'shake': palm(4, 3.4); finger(5, -1.4, 7, 0.1); finger(5, 0.2, 7.4, 0.1); finger(5, 1.8, 6.8, 0.1); finger(2, 4, 5.5, -0.9); break;
    case 'palm': palm(4.2, 3.6); finger(5, -2, 7, -0.15); finger(5, 0, 7.6, 0); finger(5, 2, 7, 0.15); finger(1, -4, 4.5, -0.9); break;
    case 'point': palm(3.6, 3); finger(4.5, -1.5, 10, 0); finger(3.8, 0.8, 3, 1.8); finger(3.8, 2.4, 2.6, 1.9); finger(1, 3.4, 4, 0.4, 1.5 * s); break;
    case 'gun': palm(3.6, 3); finger(4.5, -1.5, 10, 0); finger(4.5, 0.4, 9, 0.05); finger(0, -3.6, 5.5, -1.5, 1.5 * s); break;
    case 'peace': palm(3.6, 3); finger(4.5, -2, 9, -0.3); finger(4.5, 0.5, 9, 0.25); finger(3.8, 2.4, 2.6, 1.9); break;
    case 'L': palm(3.6, 3); finger(4.5, -1.5, 10, 0); finger(0.5, -3.5, 6.5, -1.57, 1.5 * s); break;
    case 'thumb': { const [a1x, a1y] = P(0, 0), [b1x, b1y] = P(4, 0); capsule(g, a1x, a1y, 6 * s, b1x, b1y, 5.4 * s, oc, a); capsule(g, a1x, a1y, 4.6 * s, b1x, b1y, 4 * s, col, a); const up = d * (ang > -Math.PI / 2 && ang < Math.PI / 2 ? -1 : 1); void up; const [tx, ty] = [x, y - 11 * s]; capsule(g, x, y - 2 * s, 3.3 * s, tx, ty, 2.9 * s, oc, a); capsule(g, x, y - 2 * s, 1.8 * s, tx, ty, 1.5 * s, col, a); break; }
    case 'thumbDown': { const [a1x, a1y] = P(0, 0), [b1x, b1y] = P(4, 0); capsule(g, a1x, a1y, 6 * s, b1x, b1y, 5.4 * s, oc, a); capsule(g, a1x, a1y, 4.6 * s, b1x, b1y, 4 * s, col, a); capsule(g, x, y + 2 * s, 3.3 * s, x, y + 11 * s, 2.9 * s, oc, a); capsule(g, x, y + 2 * s, 1.8 * s, x, y + 11 * s, 1.5 * s, col, a); break; }
    case 'snap': {
      palm(3.6, 3);
      finger(4, -1.2, 6, 0.7); finger(3.6, 0.8, 3.2, 1.6); finger(3.6, 2.4, 2.8, 1.8); finger(1, 3.6, 5, 0.25, 1.5 * s);
      const ph = (time % 22) / 22;
      if (ph < 0.18) { const [sx, sy] = P(7, 2); g.lineStyle(1.6 * s, 0xffffff, a * (1 - ph * 5)); for (let i = 0; i < 5; i++) { const an = i * 1.26; g.lineBetween(sx + Math.cos(an) * 4 * s, sy + Math.sin(an) * 4 * s, sx + Math.cos(an) * 9 * s, sy + Math.sin(an) * 9 * s); } }
      break;
    }
    case 'claw': palm(3.8, 3.2); for (let i = -1; i <= 2; i++) finger(4.5, -3 + i * 2, 5, 0.9 + i * 0.1); finger(1, 4, 4, 1.2, 1.5 * s); break;
    case 'kiss': palm(3.4, 2.8); finger(4, -1.2, 5, 0.25); finger(4, 0.6, 5, 0.35); finger(1, 3.2, 4, 0.6, 1.5 * s); break;
    case 'heart': palm(3.6, 3); finger(4, -2, 6, 0.9); finger(4, 0, 6, 1.0); finger(0, -3.6, 6, -0.6, 1.5 * s); break;
    case 'card': {
      palm(3.6, 3);
      const [cx, cy] = P(7, -2);
      g.fillStyle(oc, a); g.fillRoundedRect(cx - 9 * s, cy - 13 * s, 18 * s, 26 * s, 3 * s);
      g.fillStyle(0xe63946, a); g.fillRoundedRect(cx - 7.5 * s, cy - 11.5 * s, 15 * s, 23 * s, 2.5 * s);
      g.fillStyle(0xffffff, a); g.fillEllipse(cx, cy, 10 * s, 17 * s);
      g.fillStyle(0xe63946, a); g.fillTriangle(cx - 4 * s, cy - 1 * s, cx + 2 * s, cy - 6 * s, cx + 2 * s, cy + 1 * s); g.fillTriangle(cx + 4 * s, cy + 1 * s, cx - 2 * s, cy + 6 * s, cx - 2 * s, cy - 1 * s);
      finger(1, 3.6, 5, 0.3, 1.5 * s);
      break;
    }
    case 'phone': {
      palm(3.6, 3);
      const [cx, cy] = P(6, 0);
      g.fillStyle(0x111111, a); g.fillRoundedRect(cx - 6 * s, cy - 11 * s, 12 * s, 22 * s, 2.5 * s);
      g.fillStyle(0x4cc9f0, a); g.fillRoundedRect(cx - 4.6 * s, cy - 9 * s, 9.2 * s, 17 * s, 1.5 * s);
      g.fillStyle(0xffffff, a * 0.5); g.fillRect(cx - 3.6 * s, cy - 8 * s, 2 * s, 15 * s);
      finger(1, 3.6, 5, 0.2, 1.5 * s);
      break;
    }
    case 'mug': {
      const [cx, cy] = P(4, 0);
      g.fillStyle(0x0a0a14, a); g.fillRoundedRect(cx - 6.5 * s, cy - 8.5 * s, 13 * s, 16 * s, 2.5 * s);
      g.fillStyle(0xf4f1e8, a); g.fillRoundedRect(cx - 5 * s, cy - 7 * s, 10 * s, 13 * s, 2 * s);
      g.fillStyle(0x6b4423, a); g.fillRect(cx - 5 * s, cy - 7 * s, 10 * s, 3 * s);
      palm(3.2, 2.6);
      break;
    }
    case 'banana': {
      palm(3.6, 3);
      const [cx, cy] = P(7, 0);
      g.lineStyle(7 * s, 0x5c4500, a); g.beginPath(); g.arc(cx, cy - 6 * s, 9 * s, 0.2, 2.6); g.strokePath();
      g.lineStyle(4.4 * s, 0xffe135, a); g.beginPath(); g.arc(cx, cy - 6 * s, 9 * s, 0.25, 2.55); g.strokePath();
      finger(1, 3.6, 5, 0.3, 1.5 * s);
      break;
    }
  }
  void far;
}

// ---------------- cara ----------------
function drawFace(g, j, face, s, oc, a, d, look, opts) {
  const r = j.headR, hx = j.headX, hy = j.headY;
  s *= 1.22;
  const ex1 = hx + d * r * 0.06, ex2 = hx + d * r * 0.56, ey = hy - r * 0.1;
  const mx = hx + d * r * 0.46, my = hy + r * 0.48;
  const L = (x1, y1, x2, y2, w = 2) => { g.lineStyle(w * s, oc, a); g.lineBetween(x1, y1, x2, y2); };
  const eye = (x, y, w = 2.6, h = 3.4, px = 0, py = 0) => {
    g.fillStyle(0xffffff, a); g.fillEllipse(x, y, w * 2 * s, h * 2 * s);
    g.fillStyle(oc, a); g.fillEllipse(x + px * s, y + py * s, w * 1.15 * s, h * 1.3 * s);
    g.fillStyle(0xffffff, a); g.fillCircle(x + (px - 0.6) * s, y + (py - 1) * s, 0.7 * s);
  };
  const dot = (x, y, rr = 1.9) => { g.fillStyle(oc, a); g.fillCircle(x, y, rr * s); };
  const brow = (x, y, tilt) => L(x - 2.8 * s, y - tilt * s, x + 2.8 * s, y + tilt * s, 2.2);
  const shades = look.shades || look.accessory === 'shades';
  switch (face) {
    case 'angry': eye(ex1, ey, 2.2, 2.4, d * 0.6, 0.4); eye(ex2, ey, 2.2, 2.4, d * 0.6, 0.4); brow(ex1, ey - 4.2 * s, d * 1.4); brow(ex2, ey - 4.6 * s, d * 1.4); L(mx - d * 4 * s, my + s, mx + d * 3 * s, my, 2.2); break;
    case 'smug':
      L(ex1 - 2.6 * s, ey - 0.6 * s, ex1 + 2.6 * s, ey - 0.6 * s, 2); L(ex2 - 2.6 * s, ey - 0.6 * s, ex2 + 2.6 * s, ey - 0.6 * s, 2);
      dot(ex1 + d * s, ey + 0.8 * s, 1.3); dot(ex2 + d * s, ey + 0.8 * s, 1.3);
      g.lineStyle(2.1 * s, oc, a); g.beginPath(); g.moveTo(mx - d * 5 * s, my); g.lineTo(mx, my + 1.4 * s); g.lineTo(mx + d * 4 * s, my - 3 * s); g.strokePath();
      break;
    case 'side': case 'stare': {
      const off = face === 'side' ? -d * 1.6 : d * 1.2;
      eye(ex1, ey, 2.8, 1.8, off, 0); eye(ex2, ey, 2.8, 1.8, off, 0);
      L(ex1 - 3 * s, ey - 2.4 * s, ex1 + 3 * s, ey - 2.4 * s, 2.4); L(ex2 - 3 * s, ey - 2.4 * s, ex2 + 3 * s, ey - (face === 'side' ? 4.6 : 2.4) * s, 2.4);
      L(mx - d * 3 * s, my + s, mx + d * 3 * s, my + (face === 'side' ? 0 : 1) * s, 2);
      if (face === 'stare' && opts.eyeGlow) { g.fillStyle(look.aura, 0.95 * a); g.fillCircle(ex2 + off * s, ey, 1.6 * s); }
      break;
    }
    case 'shock': eye(ex1, ey, 3, 3.6, 0, 0); eye(ex2, ey, 3, 3.6, 0, 0); g.fillStyle(oc, a); g.fillEllipse(mx, my + s, 4.6 * s, 6 * s); break;
    case 'ko':
      for (const ex of [ex1, ex2]) { L(ex - 2.4 * s, ey - 2.4 * s, ex + 2.4 * s, ey + 2.4 * s); L(ex - 2.4 * s, ey + 2.4 * s, ex + 2.4 * s, ey - 2.4 * s); }
      g.fillStyle(oc, a); g.fillEllipse(mx, my, 6 * s, 3.5 * s); g.fillStyle(0xff6b8a, a); g.fillEllipse(mx + d * s, my + 2.4 * s, 3 * s, 3 * s);
      break;
    case 'mew':
      eye(ex1, ey, 2.2, 2, d * 0.5, 0); eye(ex2, ey, 2.2, 2, d * 0.5, 0);
      brow(ex1, ey - 4.2 * s, d * 0.8); brow(ex2, ey - 4.2 * s, -d * 0.4);
      L(mx - d * 3 * s, my - s, mx + d * 2.6 * s, my - s, 1.8);
      g.lineStyle(2.4 * s, oc, a); g.beginPath();
      g.moveTo(hx - d * r * 0.62, hy + r * 0.5); g.lineTo(hx + d * r * 0.3, hy + r * 1.04); g.lineTo(hx + d * r * 0.95, hy + r * 0.6); g.strokePath();
      break;
    case 'blank': dot(ex1, ey, 1.4); dot(ex2, ey, 1.4); L(mx - d * 3 * s, my, mx + d * 3 * s, my, 1.7); break;
    case 'siu':
      g.lineStyle(2.1 * s, oc, a);
      g.beginPath(); g.arc(ex1, ey + 1.5 * s, 2.6 * s, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
      g.beginPath(); g.arc(ex2, ey + 1.5 * s, 2.6 * s, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
      g.fillStyle(oc, a); g.fillEllipse(mx, my, 7 * s, 9 * s); g.fillStyle(0xd94b6a, a); g.fillEllipse(mx, my + 2 * s, 4 * s, 3 * s);
      break;
    case 'rizz': case 'kiss':
      L(ex1 - 2.5 * s, ey, ex1 + 2.5 * s, ey); eye(ex2, ey, 2.4, 2.8, d * 0.4, 0);
      g.fillStyle(0xff7aa2, 0.55 * a); g.fillEllipse(hx + d * r * 0.55, hy + r * 0.28, 6 * s, 3.4 * s);
      if (face === 'kiss') { g.fillStyle(0xd94b6a, a); g.fillCircle(mx + d * 0.6 * s, my - 0.6 * s, 2.2 * s); }
      else { g.lineStyle(2.1 * s, oc, a); g.beginPath(); g.arc(mx, my - 2 * s, 3.2 * s, 0.2, Math.PI - 0.2); g.strokePath(); }
      break;
    case 'rizzed':
      heartShape(g, ex1, ey, 3.2 * s, 0xff3b6b, a); heartShape(g, ex2, ey, 3.2 * s, 0xff3b6b, a);
      g.lineStyle(2 * s, oc, a); g.beginPath(); g.arc(mx, my - 2 * s, 3 * s, 0.2, Math.PI - 0.2); g.strokePath();
      break;
    case 'chill':
      L(ex1 - 2.5 * s, ey + 0.4 * s, ex1 + 2.5 * s, ey + 0.4 * s); L(ex2 - 2.5 * s, ey + 0.4 * s, ex2 + 2.5 * s, ey + 0.4 * s);
      dot(ex1, ey + 1.6 * s, 1.3); dot(ex2, ey + 1.6 * s, 1.3);
      g.lineStyle(2 * s, oc, a); g.beginPath(); g.arc(mx, my - 2 * s, 2.8 * s, 0.4, Math.PI - 0.6); g.strokePath();
      break;
    case 'laugh':
      g.lineStyle(2.1 * s, oc, a);
      g.beginPath(); g.arc(ex1, ey + 2 * s, 2.5 * s, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
      g.beginPath(); g.arc(ex2, ey + 2 * s, 2.5 * s, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
      g.fillStyle(oc, a); g.beginPath(); g.arc(mx, my - 1 * s, 5 * s, 0, Math.PI); g.closePath(); g.fillPath();
      g.fillStyle(0xffffff, a); g.fillRect(mx - 3.5 * s, my - 1 * s, 7 * s, 1.6 * s);
      break;
    case 'hurt':
      L(ex1 - 2.5 * s, ey - 2 * s, ex1 + 2 * s, ey); L(ex1 - 2.5 * s, ey + 2 * s, ex1 + 2 * s, ey);
      L(ex2 + 2.5 * s, ey - 2 * s, ex2 - 2 * s, ey); L(ex2 + 2.5 * s, ey + 2 * s, ex2 - 2 * s, ey);
      g.fillStyle(oc, a); g.fillEllipse(mx, my + s, 5 * s, 4 * s);
      break;
    case 'cry':
      L(ex1 - 2.5 * s, ey, ex1 + 2.5 * s, ey + s); L(ex2 - 2.5 * s, ey + s, ex2 + 2.5 * s, ey);
      g.fillStyle(0x7fd1ff, a); g.fillEllipse(ex2, ey + 4 * s, 2 * s, 4 * s);
      g.lineStyle(2 * s, oc, a); g.beginPath(); g.arc(mx, my + 3 * s, 3 * s, Math.PI + 0.3, Math.PI * 2 - 0.3); g.strokePath();
      break;
    case 'dizzy':
      g.lineStyle(1.6 * s, oc, a);
      for (const ex of [ex1, ex2]) { g.beginPath(); g.arc(ex, ey, 2.8 * s, 0, Math.PI * 1.6); g.strokePath(); dot(ex, ey, 0.8); }
      g.beginPath(); g.moveTo(mx - 4 * s, my); g.lineTo(mx - 1.5 * s, my - 1.5 * s); g.lineTo(mx + 1.5 * s, my + 1.5 * s); g.lineTo(mx + 4 * s, my); g.strokePath();
      break;
    case 'sleep': L(ex1 - 2.5 * s, ey + s, ex1 + 2.5 * s, ey + s); L(ex2 - 2.5 * s, ey + s, ex2 + 2.5 * s, ey + s); dot(mx, my, 1.6); break;
    default: eye(ex1, ey, 2, 2.6, d * 0.5, 0); eye(ex2, ey, 2, 2.6, d * 0.5, 0); L(mx - d * 3 * s, my, mx + d * 3 * s, my, 2);
  }
  if (shades && face !== 'ko') {
    g.fillStyle(0x050505, a);
    g.fillRoundedRect(Math.min(ex1, ex2) - 4.6 * s, ey - 3.4 * s, Math.abs(ex2 - ex1) + 9.2 * s, 6.2 * s, 2 * s);
    g.fillStyle(0xffffff, 0.4 * a); g.fillRect(Math.min(ex1, ex2) - 2 * s, ey - 2.2 * s, 3 * s, 1.4 * s);
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

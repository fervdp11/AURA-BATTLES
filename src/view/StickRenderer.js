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

// Cadena de segmentos con volumen. Primero TODOS los bordes, luego todos los rellenos y por último el
// sombreado opaco: así las articulaciones (rodillas, codos) no muestran anillos ni círculos superpuestos.
function limbChain(g, pts, radii, cols, oc, ow, a) {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) capsule(g, pts[i][0], pts[i][1], radii[i] + ow, pts[i + 1][0], pts[i + 1][1], radii[i + 1] + ow, oc, a);
  for (let i = 0; i < n; i++) capsule(g, pts[i][0], pts[i][1], radii[i], pts[i + 1][0], pts[i + 1][1], radii[i + 1], cols[i], a);
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], ar = radii[i], br = radii[i + 1], col = cols[i];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L;
    if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
    // sombra (lado opuesto a la luz) y brillo (lado de la luz), en colores opacos ya mezclados
    const t0 = 0.12, t1 = 0.88;
    const sx = ax + dx * t0, sy = ay + dy * t0, ex = ax + dx * t1, ey = ay + dy * t1;
    const r0 = ar + (br - ar) * t0, r1 = ar + (br - ar) * t1;
    capsule(g, sx - nx * r0 * 0.45, sy - ny * r0 * 0.45, r0 * 0.5, ex - nx * r1 * 0.45, ey - ny * r1 * 0.45, r1 * 0.5, mix(col, shade(col, 0.8), 0.6), a);
    capsule(g, sx + nx * r0 * 0.42, sy + ny * r0 * 0.42, r0 * 0.26, ex + nx * r1 * 0.42, ey + ny * r1 * 0.42, r1 * 0.26, mix(col, 0xffffff, 0.32), a);
  }
}
function limbSeg(g, ax, ay, ar, bx, by, br, col, oc, ow, a) { limbChain(g, [[ax, ay], [bx, by]], [ar, br], [col], oc, ow, a); }

// colores por zona según el patrón del cuerpo (multicolor)
function bodyColors(look, time, flash, fc) {
  const c1 = look.body, c2 = look.body2 ?? c1, p = look.bodyPattern || 'solid';
  let up = c1, low = c1, arm = c1, leg = c1, head = c1;
  if (p === 'split') { low = c2; leg = c2; }
  else if (p === 'stripes') { arm = c2; leg = c2; }
  else if (p === 'gradient') { up = mix(c1, c2, 0.25); low = mix(c1, c2, 0.6); arm = mix(c1, c2, 0.4); leg = c2; head = c1; }
  else if (p === 'lava') { const k = 0.5 + Math.sin(time * 0.05) * 0.5; up = mix(c1, 0xffb000, k * 0.35); low = mix(c1, c2, 0.5); arm = mix(c1, c2, 0.3); leg = mix(c1, c2, 0.7); head = mix(c1, 0xffd000, 0.2); }
  else if (p === 'rainbow') { const h = (time * 2) % 360; head = hsl(h, 0.8, 0.65); up = hsl((h + 40) % 360, 0.8, 0.62); arm = hsl((h + 80) % 360, 0.8, 0.62); low = hsl((h + 120) % 360, 0.8, 0.6); leg = hsl((h + 160) % 360, 0.8, 0.6); }
  else if (p === 'galaxy') { up = mix(c1, c2, 0.3); low = c1; arm = mix(c1, c2, 0.5); leg = c1; head = mix(c1, c2, 0.2); }
  const F = c => (flash ? mix(c, fc, flash) : c);
  return { up: F(up), low: F(low), arm: F(arm), leg: F(leg), head: F(head) };
}

// ------------------------------------------------------------------
export function drawFighter(g, glow, f, look, opts = {}) {
  const alpha = (opts.alpha ?? 1) * (f.alpha ?? 1);
  const j = squash(f.joints, f.squashX, f.squashY, f.x, f.y);
  if (!f._cloth) f._cloth = { sway: 0, v: 0, px: f.x };
  drawBody(g, glow, j, f.pose, f.scale, look, alpha, { ...opts, cloth: f._cloth, pantsDrop: f.pantsDrop || 0 }, f);
}

export function drawBody(g, glow, j, pose, s, look, alpha, opts = {}, f = null) {
  const oc = look.outline ?? 0x0a0a14;
  const flash = opts.flash || 0;
  const fc = look.flashColor ?? 0xffffff;
  const time = opts.time || 0;
  const BC = bodyColors(look, time, flash, fc);
  const far = c => shade(c, 0.66);
  const d = j.fx >= 0 ? 1 : -1;
  const ow = 2.4 * s;
  const R = { up: 4.7 * s, el: 3.9 * s, wr: 3.1 * s, th: 6 * s, kn: 4.6 * s, an: 3.5 * s, hip: 8.2 * s, chest: 10.4 * s };
  if (opts.ghost) { drawGhost(glow || g, j, s, opts.ghostColor ?? look.aura, alpha, R); return; }
  // física secundaria de la tela: muelle amortiguado excitado por el desplazamiento horizontal
  const cl = opts.cloth;
  if (cl) {
    const vx = j.hipX - (cl.px ?? j.hipX); cl.px = j.hipX;
    cl.v += (-vx * 0.35 - cl.sway) * 0.18; cl.v *= 0.82; cl.sway = Math.max(-1.6, Math.min(1.6, cl.sway + cl.v));
  }
  const sway = cl ? cl.sway : Math.sin(time * 0.05) * 0.2;
  const shark = look.skin === 'shark';
  const hn = pose.hsn, hf = pose.hsf;
  // brazo lejano
  if (shark) drawFin(g, j, 'f', s, far(BC.arm), oc, alpha, d);
  else {
    limbChain(g, [[j.shX, j.shY], [j.fElbowX, j.fElbowY], [j.fHandX, j.fHandY]], [R.up, R.el, R.wr], [far(BC.arm), far(BC.arm)], oc, ow, alpha);
    drawHand(g, j.fElbowX, j.fElbowY, j.fHandX, j.fHandY, hf, pose.rf, s, far(BC.arm), oc, alpha, d, time, true);
  }
  // pierna lejana (+ pantalón y calzado)
  drawLeg(g, glow, j, 'f', s, R, far(BC.leg), oc, ow, alpha, d, look, sway, opts, pose, true, time);
  // torso
  const chX = j.hipX + (j.neckX - j.hipX) * 0.78, chY = j.hipY + (j.neckY - j.hipY) * 0.78;
  if (shark) drawSharkBody(g, glow, j, s, BC, look, oc, alpha, d, time);
  else {
    limbChain(g, [[j.hipX, j.hipY], [chX, chY]], [R.hip, R.chest], [BC.up], oc, ow, alpha);
    capsule(g, chX, chY, R.chest * 0.9, j.neckX, j.neckY, 4.5 * s, BC.up, alpha);
    if (look.bodyPattern === 'galaxy') starDust(g, j.hipX, j.hipY, chX, chY, s, alpha, time);
  }
  drawWaist(g, glow, j, s, R, look, oc, alpha, d, opts, time);
  if (!shark) {
    // cuello y cabeza
    limbSeg(g, j.neckX, j.neckY, 4 * s, j.headX, j.headY, 3.6 * s, BC.head, oc, ow * 0.8, alpha);
    if (look.neck === 'chain' || look.neck === 'scarf' || look.accessory === 'chain' || look.accessory === 'scarf') drawNeckAcc(g, j, s, look, alpha, d, time);
    drawHead(g, glow, j, s, BC.head, oc, alpha, d, look);
    const showFace = Math.abs(j.fx) > 0.35;
    if (showFace) drawFace(g, j, pose.face, s, oc, alpha, d, look, opts);
    drawAccessory(g, glow, j, s, look, alpha, d, time, opts);
  }
  // pierna cercana
  drawLeg(g, glow, j, 'n', s, R, BC.leg, oc, ow, alpha, d, look, sway, opts, pose, false, time);
  // brazo cercano
  if (shark) drawFin(g, j, 'n', s, BC.arm, oc, alpha, d);
  else {
    limbChain(g, [[j.shX, j.shY], [j.nElbowX, j.nElbowY], [j.nHandX, j.nHandY]], [R.up, R.el, R.wr], [BC.arm, BC.arm], oc, ow, alpha);
    drawHand(g, j.nElbowX, j.nElbowY, j.nHandX, j.nHandY, hn, pose.rn, s, BC.arm, oc, alpha, d, time, false);
  }
  if (look.bodyGlowLines && glow) { glow.lineStyle(2 * s, look.body2, 0.5 * alpha); glow.lineBetween(j.hipX, j.hipY, j.neckX, j.neckY); }
  if (opts.prop) opts.prop(g, glow, j, s, look, alpha, d, time);
}

function starDust(g, ax, ay, bx, by, s, a, time) {
  for (let i = 0; i < 6; i++) {
    const t = ((i * 0.37 + time * 0.003) % 1), x = ax + (bx - ax) * t + Math.sin(i * 7.1) * 5 * s, y = ay + (by - ay) * t + Math.cos(i * 3.3) * 3 * s;
    g.fillStyle(0xffffff, a * (0.5 + 0.5 * Math.sin(time * 0.2 + i))); g.fillCircle(x, y, 0.9 * s);
  }
}

// ---------- pierna + pantalón (con tela) + calzado ----------
const lerp = (a, b, t) => a + (b - a) * t;
function drawLeg(g, glow, j, k, s, R, col, oc, ow, a, d, look, sway, opts, pose, isFar, time) {
  const hx = j.hipX, hy = j.hipY, kx = j[k + 'KneeX'], ky = j[k + 'KneeY'], fx = j[k + 'FootX'], fy = j[k + 'FootY'];
  limbChain(g, [[hx, hy], [kx, ky], [fx, fy]], [R.th, R.kn, R.an], [col, col], oc, ow, a);
  drawPantsLeg(g, glow, j, k, s, R, look, oc, a, d, sway, opts, isFar, time);
  const sc = look.shoesColor ?? (isFar ? shade(look.accent, 0.6) : look.accent);
  drawShoe(g, glow, kx, ky, fx, fy, s, isFar ? shade(sc, look.shoesColor != null ? 0.72 : 1) : sc, oc, a, d, j.rootY, look.shoes, pose.pt === k, time);
}

// tubo de tela con bajo recto (pantalón corto): polígono a lo largo de la pierna, contorno exterior y
// pliegue sombreado en el lado opuesto a la luz — sin remates redondos en la rodilla
function clothTube(g, pts, rad, col, dark, oc, ow, a) {
  const n = pts.length, L = [], Rr = [], OL = [], OR = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const nx = -dy, ny = dx, w = rad[i];
    const ext = i === n - 1 ? ow : i === 0 ? -ow : 0;
    const x = pts[i][0], y = pts[i][1];
    L.push({ x: x + nx * w, y: y + ny * w }); Rr.push({ x: x - nx * w, y: y - ny * w });
    OL.push({ x: x + nx * (w + ow) + dx * ext, y: y + ny * (w + ow) + dy * ext }); OR.push({ x: x - nx * (w + ow) + dx * ext, y: y - ny * (w + ow) + dy * ext });
  }
  g.fillStyle(oc, a); g.fillPoints(OL.concat(OR.reverse()), true);
  g.fillStyle(col, a); g.fillPoints(L.concat(Rr.slice().reverse()), true);
  // sombra suave de un lado (degradado en dos tonos opacos)
  const S1 = [], S2 = [];
  for (let i = 0; i < n; i++) { S1.push({ x: lerp(Rr[i].x, L[i].x, 0.0), y: lerp(Rr[i].y, L[i].y, 0.0) }); S2.push({ x: lerp(Rr[i].x, L[i].x, 0.3), y: lerp(Rr[i].y, L[i].y, 0.3) }); }
  g.fillStyle(mix(col, dark, 0.7), a); g.fillPoints(S1.concat(S2.reverse()), true);
  // dobladillo
  g.lineStyle(Math.max(1, ow * 0.6), dark, a); g.lineBetween(lerp(L[n - 1].x, L[n - 2].x, 0.18), lerp(L[n - 1].y, L[n - 2].y, 0.18), lerp(Rr[n - 1].x, Rr[n - 2].x, 0.18), lerp(Rr[n - 1].y, Rr[n - 2].y, 0.18));
}

const PANTS = {
  sport: { len: 0.8, w: 2.2, flare: 1.6 }, boxing: { len: 0.64, w: 3.0, flare: 2.4, band: 1 }, long: { len: 1.9, w: 1.8, flare: 0.8 },
  joggers: { len: 1.94, w: 3.0, flare: 0.4, cuff: 1 }, camo: { len: 1.9, w: 2.6, flare: 1, camo: 1 }, future: { len: 1.92, w: 1.6, flare: 0.2, glow: 1 },
  flames: { len: 1.9, w: 2.2, flare: 1, flames: 1 }, galaxy: { len: 1.9, w: 2.2, flare: 1, stars: 1 }, sixseven: { len: 0.84, w: 2.4, flare: 1.6, sixseven: 1 }
};
// punto a lo largo de la pierna: t en [0,1] muslo, [1,2] espinilla
function legPoint(j, k, t) {
  if (t <= 1) return [lerp(j.hipX, j[k + 'KneeX'], t), lerp(j.hipY, j[k + 'KneeY'], t)];
  return [lerp(j[k + 'KneeX'], j[k + 'FootX'], t - 1), lerp(j[k + 'KneeY'], j[k + 'FootY'], t - 1)];
}
function drawPantsLeg(g, glow, j, k, s, R, look, oc, a, d, sway, opts, isFar, time) {
  const P = PANTS[look.pants] || PANTS.sport;
  const c1 = isFar ? shade(look.pantsColor, 0.72) : look.pantsColor, c2 = isFar ? shade(look.pantsColor2, 0.8) : look.pantsColor2;
  const drop = opts.pantsDrop || 0;
  if (drop > 0) {
    // calzoncillos (nunca desnudez) y la prenda arrugada bajando por las piernas
    const bx = lerp(j.hipX, j[k + 'KneeX'], 0.42), by = lerp(j.hipY, j[k + 'KneeY'], 0.42);
    capsule(g, j.hipX, j.hipY, R.th + 3.2 * s, bx, by, R.th + 2.2 * s, oc, a);
    capsule(g, j.hipX, j.hipY, R.th + 1.6 * s, bx, by, R.th + 0.8 * s, 0xffffff, a);
    heartShape(g, lerp(j.hipX, bx, 0.55), lerp(j.hipY, by, 0.55), 2.6 * s, 0xff3b6b, a);
    const top = Math.min(1.82, 0.15 + drop * 1.7), bot = Math.min(1.97, top + 0.25);
    const [ax, ay] = legPoint(j, k, top), [cx, cy] = legPoint(j, k, bot);
    capsule(g, ax, ay, R.kn + 5.5 * s, cx, cy, R.an + 5 * s, oc, a);
    capsule(g, ax, ay, R.kn + 3.8 * s, cx, cy, R.an + 3.4 * s, c1, a);
    g.lineStyle(1.4 * s, shade(c1, 0.6), a);
    for (let i = 1; i < 4; i++) { const [wx, wy] = legPoint(j, k, lerp(top, bot, i / 4)); g.lineBetween(wx - 4 * s, wy - 1.5 * s, wx + 4 * s, wy + 1.5 * s); }
    return;
  }
  const len = P.len;
  const pts = [], rad = [];
  const steps = len > 1 ? 4 : 3;
  for (let i = 0; i <= steps; i++) {
    const t = len * i / steps;
    const p = legPoint(j, k, t);
    const base = t <= 1 ? lerp(R.th, R.kn, t) : lerp(R.kn, R.an, t - 1);
    let w = base + P.w * s;
    if (i === steps) { w += P.flare * s * (1 + Math.abs(sway) * 0.4); if (P.cuff) w = base + 1.4 * s; }
    // la tela se arrastra con el movimiento: el bajo se desplaza hacia atrás
    if (i > 0) { const lag = sway * (i / steps) * (len > 1 ? 2.2 : 3.4) * s; p[0] += lag; p[1] += Math.abs(sway) * 0.6 * s * (i / steps); }
    pts.push(p); rad.push(w);
  }
  if (len <= 1) clothTube(g, pts, rad, c1, shade(c1, 0.82), oc, 1.8 * s, a);
  else {
    const cols = []; for (let i = 0; i < steps; i++) cols.push(c1);
    limbChain(g, pts, rad, cols, oc, 1.8 * s, a);
  }
  const [ex, ey] = pts[steps];
  // detalles por estilo
  if (P.band || look.pants === 'sport' || look.pants === 'sixseven') {
    const [mx, my] = pts[Math.max(1, steps - 1)];
    g.lineStyle(2.2 * s, c2, a); g.lineBetween(lerp(mx, ex, 0.6), lerp(my, ey, 0.6), ex, ey);
  }
  if (P.cuff) { g.fillStyle(oc, a); g.fillCircle(ex, ey, rad[steps] + 2.4 * s); g.fillStyle(shade(c1, 0.8), a); g.fillCircle(ex, ey, rad[steps] + 0.8 * s); }
  if (P.camo) for (let i = 0; i < 4; i++) { const [px, py] = legPoint(j, k, 0.2 + i * 0.42); g.fillStyle(i % 2 ? c2 : shade(c1, 0.75), a); g.fillEllipse(px + (i % 2 ? 2 : -2) * s, py, 6 * s, 4 * s); }
  if (P.flames) for (let i = 0; i < 3; i++) { const [px, py] = legPoint(j, k, 1.4 + i * 0.16); g.fillStyle(i === 1 ? 0xffd000 : c2, a); g.fillTriangle(px - 4 * s, py + 3 * s, px + 4 * s, py + 3 * s, px + Math.sin(time * 0.3 + i) * 2 * s, py - (7 + Math.sin(time * 0.4 + i * 2) * 2) * s); }
  if (P.stars) starDust(g, pts[0][0], pts[0][1], ex, ey, s * 1.2, a, time);
  if (P.glow && glow) { glow.lineStyle(2 * s, c2, 0.8 * a); glow.lineBetween(pts[0][0], pts[0][1], ex, ey); }
  if (P.sixseven && !isFar) {
    const [px, py] = legPoint(j, k, 0.45);
    g.fillStyle(c2, a); g.fillRect(px - 3 * s, py - 4 * s, 2 * s, 8 * s); g.fillRect(px + 1 * s, py - 4 * s, 3 * s, 2 * s); g.fillRect(px + 2.2 * s, py - 4 * s, 1.6 * s, 8 * s);
  }
}
// cintura del pantalón (encima del torso) — al bajarse, se ven los calzoncillos con goma de corazones
function drawWaist(g, glow, j, s, R, look, oc, a, d, opts, time) {
  const tx = j.neckX - j.hipX, ty = j.neckY - j.hipY, tl = Math.hypot(tx, ty) || 1;
  const px = -ty / tl, py = tx / tl, w = R.hip * 1.08;
  const drop = opts.pantsDrop || 0;
  if (drop > 0) {
    g.fillStyle(oc, a); g.fillCircle(j.hipX, j.hipY, R.hip + 3.2 * s);
    g.fillStyle(0xffffff, a); g.fillCircle(j.hipX, j.hipY, R.hip + 1.6 * s);
    capsule(g, j.hipX - px * w + tx * 0.1, j.hipY - py * w + ty * 0.1, 2 * s, j.hipX + px * w + tx * 0.1, j.hipY + py * w + ty * 0.1, 2 * s, 0xff3b6b, a);
    heartShape(g, j.hipX + d * 2 * s, j.hipY - 1 * s, 3 * s, 0xff3b6b, a);
    return;
  }
  const P = PANTS[look.pants] || PANTS.sport;
  const c1 = look.pantsColor;
  const top = 0.16;
  const bx = j.hipX + tx * top, by = j.hipY + ty * top;
  capsule(g, j.hipX, j.hipY, R.hip + 3.6 * s, bx, by, R.hip + 2.6 * s, oc, a);
  capsule(g, j.hipX, j.hipY, R.hip + 2.2 * s, bx, by, R.hip + 1.2 * s, c1, a);
  // cinturilla (acento) y cordón
  const band = P.band ? look.pantsColor2 : look.accent;
  capsule(g, bx - px * w, by - py * w, (P.band ? 3 : 2.2) * s, bx + px * w, by + py * w, (P.band ? 3 : 2.2) * s, band, a);
  if (P.glow && glow) { glow.lineStyle(3 * s, look.pantsColor2, 0.7 * a); glow.lineBetween(bx - px * w, by - py * w, bx + px * w, by + py * w); }
  void time;
}

function drawFin(g, j, k, s, col, oc, a, d) {
  // aleta pectoral del tiburón (sigue al brazo del rig: mano = punta de la aleta)
  const ax = j.shX, ay = j.shY, bx = j[k + 'HandX'], by = j[k + 'HandY'], ex = j[k + 'ElbowX'], ey = j[k + 'ElbowY'];
  g.fillStyle(oc, a); g.fillTriangle(ax - 5 * s, ay - 3 * s, ax + 5 * s, ay + 4 * s, bx, by); g.fillTriangle(ax, ay, ex, ey, bx, by);
  g.fillStyle(col, a); g.fillTriangle(ax - 3 * s, ay - 1 * s, ax + 3 * s, ay + 2.5 * s, lerp(ax, bx, 0.92), lerp(ay, by, 0.92)); g.fillTriangle(ax, ay, lerp(ax, ex, 0.95), lerp(ay, ey, 0.95), lerp(ax, bx, 0.9), lerp(ay, by, 0.9));
  void d;
}
// cuerpo de tiburón sobre el rig: el torso es el lomo, la cabeza es el morro con dientes
function drawSharkBody(g, glow, j, s, BC, look, oc, a, d, time) {
  const hx = j.hipX, hy = j.hipY, nx = j.headX, ny = j.headY;
  const ang = Math.atan2(ny - hy, nx - hx), L = Math.hypot(nx - hx, ny - hy);
  const cx = (hx + nx) / 2, cy = (hy + ny) / 2;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = (u, v) => [cx + ca * u - sa * v * d, cy + sa * u + ca * v * d];
  const ellipse = (rx, ry, col) => { g.fillStyle(col, a); const pts = []; for (let i = 0; i < 20; i++) { const t = i / 20 * Math.PI * 2; const p = P(Math.cos(t) * rx, Math.sin(t) * ry); pts.push({ x: p[0], y: p[1] }); } g.fillPoints(pts, true); };
  const rx = L * 0.62, ry = 15 * s;
  // cola (en la cadera)
  const [t1x, t1y] = P(-rx - 2 * s, 0), [t2x, t2y] = P(-rx - 20 * s, -16 * s), [t3x, t3y] = P(-rx - 18 * s, 14 * s);
  g.fillStyle(oc, a); g.fillTriangle(t1x, t1y, t2x, t2y, t3x, t3y);
  g.fillStyle(shade(BC.up, 0.85), a); { const [u1x, u1y] = P(-rx, 0), [u2x, u2y] = P(-rx - 16 * s, -12 * s), [u3x, u3y] = P(-rx - 14 * s, 10 * s); g.fillTriangle(u1x, u1y, u2x, u2y, u3x, u3y); }
  // aleta dorsal
  const [f1x, f1y] = P(-6 * s, -ry + 2 * s), [f2x, f2y] = P(10 * s, -ry + 2 * s), [f3x, f3y] = P(-10 * s, -ry - 18 * s);
  g.fillStyle(oc, a); g.fillTriangle(f1x - 2 * s, f1y, f2x + 2 * s, f2y, f3x, f3y - 2 * s);
  g.fillStyle(shade(BC.up, 0.8), a); g.fillTriangle(f1x, f1y, f2x, f2y, f3x, f3y);
  ellipse(rx + 2.4 * s, ry + 2.4 * s, oc);
  ellipse(rx, ry, BC.up);
  // vientre claro
  g.fillStyle(mix(BC.up, 0xffffff, 0.75), a); { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12 * Math.PI; const p = P(Math.cos(t) * rx * 0.85, Math.sin(t) * ry * 0.75 + 3 * s); pts.push({ x: p[0], y: p[1] }); } g.fillPoints(pts, true); }
  // ojo, boca y dientes en el morro
  const [ex, ey] = P(rx * 0.62, -ry * 0.25); g.fillStyle(0xffffff, a); g.fillCircle(ex, ey, 3.6 * s); g.fillStyle(oc, a); g.fillCircle(ex + ca * d * 0.8 * s, ey, 2 * s);
  const [m1x, m1y] = P(rx * 0.98, ry * 0.25), [m2x, m2y] = P(rx * 0.45, ry * 0.32), [m3x, m3y] = P(rx * 0.92, ry * 0.62);
  g.fillStyle(0x7a0b1d, a); g.fillTriangle(m1x, m1y, m2x, m2y, m3x, m3y);
  g.fillStyle(0xffffff, a); for (let i = 0; i < 4; i++) { const u = rx * (0.5 + i * 0.12); const [q1x, q1y] = P(u, ry * 0.3), [q2x, q2y] = P(u + 3 * s, ry * 0.3), [q3x, q3y] = P(u + 1.5 * s, ry * 0.52); g.fillTriangle(q1x, q1y, q2x, q2y, q3x, q3y); }
  // branquias
  g.lineStyle(1.4 * s, shade(BC.up, 0.6), a); for (let i = 0; i < 3; i++) { const [g1x, g1y] = P(rx * 0.3 - i * 4 * s, -ry * 0.3), [g2x, g2y] = P(rx * 0.26 - i * 4 * s, ry * 0.2); g.lineBetween(g1x, g1y, g2x, g2y); }
  if (look.accessory && look.accessory !== 'none') { const fake = { ...j, headX: P(rx * 0.7, 0)[0], headY: P(rx * 0.7, 0)[1], headR: 11 * s }; drawAccessory(g, glow, fake, s, look, a, d, time, {}); }
}

// calzado por estilo; 'pointed' = punta del pie estirada en la dirección de la espinilla (patadas verticales)
function drawShoe(g, glow, kx, ky, x, y, s, col, oc, a, d, rootY, style = 'sneaker', pointed = false, time = 0) {
  let ang = Math.atan2(y - ky, x - kx) - Math.PI / 2 * d;
  if (pointed) ang = Math.atan2(y - ky, x - kx);
  const flat = d > 0 ? 0 : Math.PI;
  if (rootY !== undefined && !pointed) {
    const k = Math.max(0, Math.min(1, 1 - Math.abs(rootY - y) / (14 * s)));
    let diff = flat - ang; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
    ang += diff * k;
  }
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const len = (style === 'boots' ? 11.5 : style === 'slides' ? 11 : 12) * s;
  const tx = x + ca * len, ty = y + sa * len;
  const hx = x - ca * 3.2 * s, hy = y - sa * 3.2 * s;
  const nx = -sa, ny = ca, sx = d > 0 ? 1 : -1;
  if (style === 'golden') col = 0xffd700;
  if (style === 'slides') {
    capsule(g, hx, hy, 3.6 * s, tx, ty, 3 * s, oc, a); capsule(g, hx, hy, 2.4 * s, tx, ty, 2 * s, 0xf4f4f8, a);
    capsule(g, hx + nx * 2.2 * s * sx, hy + ny * 2.2 * s * sx, 1.6 * s, tx + nx * 2.2 * s * sx, ty + ny * 2.2 * s * sx, 1.4 * s, col, a);
    return;
  }
  const r1 = (style === 'boots' || style === 'hightops' ? 5.2 : 4.6) * s;
  capsule(g, hx, hy, r1, tx, ty, 3.9 * s, oc, a);
  capsule(g, hx, hy, r1 - 1.4 * s, tx, ty, 2.6 * s, col, a);
  if (style === 'hightops' || style === 'boots') { const ux = x - ca * 1 * s - nx * 5 * s * sx, uy = y - sa * 1 * s - ny * 5 * s * sx; capsule(g, hx, hy, 3.4 * s, ux, uy, 3.4 * s, oc, a); capsule(g, hx, hy, 2.2 * s, ux, uy, 2.2 * s, style === 'boots' ? shade(col, 0.8) : col, a); }
  // suela
  const soleC = style === 'boots' ? 0x3a2410 : style === 'cleats' ? 0x111111 : style === 'golden' ? 0xfff2b0 : 0xf2f2f2;
  capsule(g, hx + nx * 2.4 * s * sx, hy + ny * 2.4 * s * sx, 1.3 * s, tx + nx * 2 * s * sx, ty + ny * 2 * s * sx, 1.2 * s, soleC, a * 0.95);
  if (style === 'cleats') for (let i = 0; i < 3; i++) { const t = 0.15 + i * 0.35; g.fillStyle(0xdddddd, a); g.fillCircle(lerp(hx, tx, t) + nx * 3.6 * s * sx, lerp(hy, ty, t) + ny * 3.6 * s * sx, 1 * s); }
  if (style === 'sneaker' || style === 'hightops' || style === 'shark') { g.lineStyle(1.2 * s, 0xffffff, a * 0.9); g.lineBetween(lerp(hx, tx, 0.3) - nx * 1 * s * sx, lerp(hy, ty, 0.3) - ny * 1 * s * sx, lerp(hx, tx, 0.7) + nx * 0.6 * s * sx, lerp(hy, ty, 0.7) + ny * 0.6 * s * sx); }
  if (style === 'shark') { g.fillStyle(0x3a7bd5, a); g.fillTriangle(lerp(hx, tx, 0.3), lerp(hy, ty, 0.3), lerp(hx, tx, 0.55), lerp(hy, ty, 0.55), lerp(hx, tx, 0.4) - nx * 6 * s * sx, lerp(hy, ty, 0.4) - ny * 6 * s * sx); }
  if (style === 'jets' && glow) {
    const fl = (6 + Math.sin(time * 0.6) * 2) * s;
    glow.fillStyle(0xff9e1c, 0.55 * a); glow.fillTriangle(hx + nx * 2 * s * sx - ca * 2 * s, hy + ny * 2 * s * sx - sa * 2 * s, hx + nx * 2 * s * sx + ca * 2 * s, hy + ny * 2 * s * sx + sa * 2 * s, hx + nx * (2 * s + fl) * sx, hy + ny * (2 * s + fl) * sx);
  }
  if (style === 'golden') { g.fillStyle(0xffffff, a * (0.5 + 0.5 * Math.sin(time * 0.3))); g.fillCircle(lerp(hx, tx, 0.6) - nx * 1 * s * sx, lerp(hy, ty, 0.6) - ny * 1 * s * sx, 0.9 * s); }
}

function drawHead(g, glow, j, s, col, oc, a, d, look) {
  const r = j.headR, x = j.headX, y = j.headY;
  g.fillStyle(oc, a); g.fillCircle(x, y, r + 2.6 * s);
  g.fillStyle(col, a); g.fillCircle(x, y, r);
  // sombreado lateral y brillo
  g.fillStyle(shade(col, 0.8), a * 0.55); g.fillCircle(x + 3 * s, y + 3.2 * s, r * 0.82);
  g.fillStyle(col, a); g.fillCircle(x - 1.2 * s, y - 1.2 * s, r * 0.82);
  g.fillStyle(lighten(col, 0.6), a * 0.8); g.fillEllipse(x - r * 0.42, y - r * 0.5, r * 0.55, r * 0.32);
  void glow; void look; void d;
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
  const eyew = shades ? 'shades' : look.eyewear || 'none';
  if (eyew !== 'none' && face !== 'ko') {
    const x0 = Math.min(ex1, ex2), w = Math.abs(ex2 - ex1);
    switch (eyew) {
      case 'shades':
        g.fillStyle(0x050505, a); g.fillRoundedRect(x0 - 4.6 * s, ey - 3.4 * s, w + 9.2 * s, 6.2 * s, 2 * s);
        g.fillStyle(0xffffff, 0.4 * a); g.fillRect(x0 - 2 * s, ey - 2.2 * s, 3 * s, 1.4 * s); break;
      case 'round':
        g.lineStyle(1.4 * s, oc, a); g.strokeCircle(ex1, ey, 3.6 * s); g.strokeCircle(ex2, ey, 3.6 * s); g.lineBetween(ex1 + 3.4 * s * Math.sign(ex2 - ex1), ey, ex2 - 3.4 * s * Math.sign(ex2 - ex1), ey); break;
      case 'monocle':
        g.lineStyle(1.6 * s, 0xd4af37, a); g.strokeCircle(ex2, ey, 4 * s); g.lineBetween(ex2, ey + 4 * s, ex2 - d * 2 * s, ey + 12 * s); break;
      case 'visor':
        g.fillStyle(0x0a0a14, a); g.fillRoundedRect(x0 - 5 * s, ey - 3 * s, w + 10 * s, 5.4 * s, 2.6 * s);
        g.fillStyle(0x00f0ff, a * (0.75 + 0.25 * Math.sin((opts.time || 0) * 0.2))); g.fillRoundedRect(x0 - 4 * s, ey - 1.6 * s, w + 8 * s, 2.4 * s, 1.2 * s); break;
      case 'star':
        for (const ex of [ex1, ex2]) { g.fillStyle(0x0a0a14, a); drawStar5(g, ex, ey, 5.2 * s); g.fillStyle(0xff4fd8, a); drawStar5(g, ex, ey, 4 * s); } break;
    }
  }
}

function drawStar5(g, x, y, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push({ x: x + Math.cos(t) * rr, y: y + Math.sin(t) * rr }); }
  g.fillPoints(pts, true);
}

export function heartShape(g, x, y, r, color, a) {
  g.fillStyle(color, a);
  g.fillCircle(x - r * 0.5, y - r * 0.25, r * 0.6);
  g.fillCircle(x + r * 0.5, y - r * 0.25, r * 0.6);
  g.fillTriangle(x - r * 1.08, y - r * 0.05, x + r * 1.08, y - r * 0.05, x, y + r * 1.1);
}

function drawNeckAcc(g, j, s, look, a, d, time) {
  const ac = look.accent, oc = look.outline ?? 0x0a0a14;
  if (look.neck === 'chain' || look.accessory === 'chain') {
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
    case 'headphones':
      g.lineStyle(4.4 * s, oc, a); g.beginPath(); g.arc(hx, hy, r + 2.5 * s, Math.PI * 1.05, Math.PI * 1.95); g.strokePath();
      g.lineStyle(2.6 * s, ac, a); g.beginPath(); g.arc(hx, hy, r + 2.5 * s, Math.PI * 1.05, Math.PI * 1.95); g.strokePath();
      g.fillStyle(oc, a); g.fillRoundedRect(hx - d * r * 0.25 - 5 * s, hy - 6 * s, 10 * s, 12 * s, 4 * s);
      g.fillStyle(ac, a); g.fillRoundedRect(hx - d * r * 0.25 - 3.6 * s, hy - 4.6 * s, 7.2 * s, 9.2 * s, 3 * s);
      break;
    case 'catEars':
      for (const sx of [-0.55, 0.55]) {
        const bx = hx + sx * r;
        g.fillStyle(oc, a); g.fillTriangle(bx - 6 * s, top + 5 * s, bx + 6 * s, top + 5 * s, bx + sx * 3 * s, top - 11 * s);
        g.fillStyle(ac, a); g.fillTriangle(bx - 4 * s, top + 4 * s, bx + 4 * s, top + 4 * s, bx + sx * 3 * s, top - 7.5 * s);
        g.fillStyle(0xffb3c6, a); g.fillTriangle(bx - 2 * s, top + 3 * s, bx + 2 * s, top + 3 * s, bx + sx * 2.5 * s, top - 3 * s);
      }
      break;
    case 'propeller': {
      g.fillStyle(oc, a); g.beginPath(); g.arc(hx, hy - r * 0.15, r + 2.5 * s, Math.PI, 0); g.closePath(); g.fillPath();
      const segs = [0xff4d6d, 0xffd166, 0x4cc9f0, 0x7bd389];
      for (let i = 0; i < 4; i++) { g.fillStyle(segs[i], a); g.beginPath(); g.moveTo(hx, hy - r * 0.15); g.arc(hx, hy - r * 0.15, r + 0.6 * s, Math.PI + i * Math.PI / 4, Math.PI + (i + 1) * Math.PI / 4); g.closePath(); g.fillPath(); }
      g.lineStyle(2 * s, oc, a); g.lineBetween(hx, top - 1 * s, hx, top - 7 * s);
      const pw = Math.cos(time * 0.9) * 13 * s;
      g.lineStyle(3 * s, 0xffd166, a); g.lineBetween(hx - pw, top - 7 * s, hx + pw, top - 7 * s);
      break;
    }
    case 'helmet':
      g.fillStyle(oc, a); g.fillCircle(hx, hy - 1 * s, r + 4.4 * s);
      g.fillStyle(ac, a); g.fillCircle(hx, hy - 1 * s, r + 2.6 * s);
      g.fillStyle(0x0a0a14, 0.85 * a); g.beginPath(); g.moveTo(hx + d * r * 0.05, hy - r * 0.55); g.lineTo(hx + d * (r + 3 * s), hy - r * 0.45); g.lineTo(hx + d * (r + 3 * s), hy + r * 0.3); g.lineTo(hx + d * r * 0.05, hy + r * 0.25); g.closePath(); g.fillPath();
      g.fillStyle(0xffffff, 0.35 * a); g.fillRect(hx + d * r * 0.3, hy - r * 0.4, d * r * 0.4, 2 * s);
      break;
    case 'viking':
      g.fillStyle(oc, a); g.beginPath(); g.arc(hx, hy - r * 0.1, r + 2.6 * s, Math.PI, 0); g.closePath(); g.fillPath();
      g.fillStyle(0x9aa0a6, a); g.beginPath(); g.arc(hx, hy - r * 0.1, r + 1 * s, Math.PI, 0); g.closePath(); g.fillPath();
      g.fillStyle(0x6b4423, a); g.fillRect(hx - r - 1 * s, hy - r * 0.25, 2 * r + 2 * s, 3.4 * s);
      for (const sx of [-1, 1]) { g.fillStyle(oc, a); g.fillTriangle(hx + sx * r * 0.85, top + 6 * s, hx + sx * (r + 9 * s), top - 2 * s, hx + sx * (r + 4 * s), top - 14 * s); g.fillStyle(0xf4ead5, a); g.fillTriangle(hx + sx * r * 0.9, top + 4.5 * s, hx + sx * (r + 7 * s), top - 1.5 * s, hx + sx * (r + 3.6 * s), top - 11 * s); }
      break;
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

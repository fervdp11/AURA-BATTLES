// Criaturas brainrot dibujadas con vectores (sin recursos externos): tiburón con zapatillas, cocodrilo
// bombardero, Tung Tung Sahur, bailarina capuchino, árbol con pies (Patapim) y elefante-cactus con reloj.
const OUT = 0x0a0a14;

function sneaker(g, x, y, s, d, col = 0xffffff) {
  g.fillStyle(OUT, 1); g.fillRoundedRect(x - 12 * s, y - 7 * s, 26 * s, 12 * s, 5 * s);
  g.fillStyle(col, 1); g.fillRoundedRect(x - 10.5 * s, y - 5.5 * s, 23 * s, 9 * s, 4 * s);
  g.fillStyle(0x4cc9f0, 1); g.fillRect(x - 8 * s + (d > 0 ? 6 : 0) * s, y - 3 * s, 8 * s, 2.5 * s);
  g.fillStyle(0x222222, 1); g.fillRect(x - 10.5 * s, y + 1.5 * s, 23 * s, 2 * s);
}

// Tralalero Tralala: tiburón azul con tres patas y zapatillas
export function drawShark(g, x, y, d, s, t) {
  const bob = Math.sin(t * 0.6) * 3 * s;
  // patas corriendo
  for (let i = 0; i < 3; i++) {
    const ph = t * 0.7 + i * 2.1, lx = x + (-22 + i * 22) * s * d, ly = y + 18 * s;
    const fx = lx + Math.sin(ph) * 12 * s * d, fy = y + 40 * s - Math.max(0, Math.cos(ph)) * 8 * s;
    g.lineStyle(7 * s, OUT, 1); g.lineBetween(lx, ly, fx, fy);
    g.lineStyle(5 * s, 0x5a8fd6, 1); g.lineBetween(lx, ly, fx, fy);
    sneaker(g, fx + 4 * s * d, fy + 2 * s, s * 0.8, d);
  }
  const by = y + bob;
  // cola
  g.fillStyle(OUT, 1); g.fillTriangle(x - d * 52 * s, by - 4 * s, x - d * 78 * s, by - 26 * s, x - d * 74 * s, by + 18 * s);
  g.fillStyle(0x3a7bd5, 1); g.fillTriangle(x - d * 54 * s, by - 3 * s, x - d * 74 * s, by - 21 * s, x - d * 71 * s, by + 14 * s);
  // cuerpo
  g.fillStyle(OUT, 1); g.fillEllipse(x, by, 120 * s, 50 * s);
  g.fillStyle(0x3a7bd5, 1); g.fillEllipse(x, by - 1 * s, 114 * s, 44 * s);
  g.fillStyle(0xeaf4ff, 1); g.fillEllipse(x + d * 8 * s, by + 10 * s, 84 * s, 18 * s);
  // aleta dorsal
  g.fillStyle(OUT, 1); g.fillTriangle(x - d * 14 * s, by - 18 * s, x + d * 12 * s, by - 20 * s, x - d * 10 * s, by - 46 * s);
  g.fillStyle(0x2f68b8, 1); g.fillTriangle(x - d * 11 * s, by - 18 * s, x + d * 8 * s, by - 19 * s, x - d * 9 * s, by - 40 * s);
  // ojo y boca con dientes
  g.fillStyle(0xffffff, 1); g.fillCircle(x + d * 36 * s, by - 8 * s, 6 * s); g.fillStyle(OUT, 1); g.fillCircle(x + d * 38 * s, by - 8 * s, 3 * s);
  g.fillStyle(0x7a0b1d, 1); g.fillTriangle(x + d * 56 * s, by + 2 * s, x + d * 26 * s, by + 6 * s, x + d * 54 * s, by + 14 * s);
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 4; i++) g.fillTriangle(x + d * (30 + i * 6) * s, by + 5 * s, x + d * (33 + i * 6) * s, by + 5 * s, x + d * (31.5 + i * 6) * s, by + 10 * s);
}

// Bombardiro Crocodilo: cocodrilo-avión
export function drawCrocPlane(g, x, y, d, s, t) {
  // alas
  g.fillStyle(OUT, 1); g.fillTriangle(x - d * 20 * s, y, x + d * 20 * s, y, x - d * 10 * s, y - 50 * s); g.fillTriangle(x - d * 20 * s, y + 6 * s, x + d * 20 * s, y + 6 * s, x - d * 6 * s, y + 46 * s);
  g.fillStyle(0x556b2f, 1); g.fillTriangle(x - d * 16 * s, y, x + d * 16 * s, y, x - d * 9 * s, y - 44 * s); g.fillTriangle(x - d * 16 * s, y + 6 * s, x + d * 16 * s, y + 6 * s, x - d * 6 * s, y + 40 * s);
  // fuselaje + morro de cocodrilo
  g.fillStyle(OUT, 1); g.fillRoundedRect(x - 64 * s, y - 13 * s, 128 * s, 28 * s, 13 * s);
  g.fillStyle(0x6b8e23, 1); g.fillRoundedRect(x - 61 * s, y - 10 * s, 122 * s, 22 * s, 11 * s);
  g.fillStyle(0x6b8e23, 1); g.fillRoundedRect(x + (d > 0 ? 46 : -86) * s, y - 6 * s, 40 * s, 14 * s, 6 * s);
  g.fillStyle(0xffffff, 1); for (let i = 0; i < 5; i++) g.fillTriangle(x + d * (52 + i * 6) * s, y + 7 * s, x + d * (55 + i * 6) * s, y + 7 * s, x + d * (53.5 + i * 6) * s, y + 12 * s);
  g.fillStyle(0xffd166, 1); g.fillCircle(x + d * 40 * s, y - 8 * s, 4 * s); g.fillStyle(OUT, 1); g.fillCircle(x + d * 41 * s, y - 8 * s, 2 * s);
  // hélice
  const pr = Math.abs(Math.sin(t * 1.3)) * 18 * s;
  g.fillStyle(0xdddddd, 0.8); g.fillEllipse(x - d * 64 * s, y, 6 * s, pr + 4 * s);
  // escarapelas
  g.fillStyle(0xff4d6d, 1); g.fillCircle(x - d * 4 * s, y - 24 * s, 4 * s);
}

// Tung Tung Tung Sahur: tronco con cara y bate
export function drawTungTung(g, x, y, s, t, d = 1) {
  const sw = Math.sin(t * 0.5);
  // piernas
  g.lineStyle(6 * s, OUT, 1); g.lineBetween(x - 8 * s, y - 30 * s, x - 12 * s, y); g.lineBetween(x + 8 * s, y - 30 * s, x + 12 * s, y);
  // tronco
  g.fillStyle(OUT, 1); g.fillRoundedRect(x - 22 * s, y - 120 * s, 44 * s, 94 * s, 14 * s);
  g.fillStyle(0xb5835a, 1); g.fillRoundedRect(x - 19 * s, y - 117 * s, 38 * s, 88 * s, 12 * s);
  g.lineStyle(1.5 * s, 0x7a5230, 1); for (let i = 0; i < 4; i++) g.lineBetween(x - 15 * s + i * 9 * s, y - 112 * s, x - 13 * s + i * 9 * s, y - 34 * s);
  g.fillStyle(0xd6a77a, 1); g.fillEllipse(x, y - 117 * s, 36 * s, 8 * s);
  // cara
  g.fillStyle(0xffffff, 1); g.fillCircle(x - 8 * s, y - 92 * s, 6 * s); g.fillCircle(x + 8 * s, y - 92 * s, 6 * s);
  g.fillStyle(OUT, 1); g.fillCircle(x - 7 * s, y - 92 * s, 3 * s); g.fillCircle(x + 9 * s, y - 92 * s, 3 * s);
  g.fillStyle(0x3a1a0a, 1); g.fillEllipse(x, y - 74 * s, 16 * s, 8 * s);
  // brazo con bate
  const ang = -1.2 + sw * 0.9, hx = x + d * 22 * s, hy = y - 80 * s;
  const bx = hx + Math.cos(ang) * d * 70 * s, byy = hy + Math.sin(ang) * 70 * s;
  g.lineStyle(10 * s, OUT, 1); g.lineBetween(hx, hy, bx, byy);
  g.lineStyle(7 * s, 0xc68642, 1); g.lineBetween(hx, hy, bx, byy);
  g.fillStyle(0xc68642, 1); g.fillCircle(bx, byy, 7 * s);
}

// Ballerina Cappuccina: taza de capuchino como cabeza y tutú rosa
export function drawBallerina(g, x, y, s, t) {
  const spin = Math.cos(t * 0.6);
  g.lineStyle(4 * s, OUT, 1); g.lineBetween(x, y - 40 * s, x, y); g.lineBetween(x, y - 40 * s, x + 18 * s * spin, y - 20 * s);
  g.fillStyle(0xffb6c1, 1); g.fillEllipse(x, y - 46 * s, 70 * s * Math.max(0.35, Math.abs(spin)), 16 * s);
  g.lineStyle(4 * s, OUT, 1); g.lineBetween(x, y - 46 * s, x, y - 80 * s);
  g.lineBetween(x, y - 76 * s, x - 22 * s * spin, y - 100 * s); g.lineBetween(x, y - 76 * s, x + 22 * s * spin, y - 100 * s);
  // taza
  g.fillStyle(OUT, 1); g.fillRoundedRect(x - 18 * s, y - 112 * s, 36 * s, 30 * s, 8 * s);
  g.fillStyle(0xffffff, 1); g.fillRoundedRect(x - 15 * s, y - 109 * s, 30 * s, 24 * s, 6 * s);
  g.fillStyle(0x8b5a2b, 1); g.fillEllipse(x, y - 108 * s, 30 * s, 8 * s);
  g.fillStyle(0xf5deb3, 1); g.fillEllipse(x - 3 * s, y - 109 * s, 14 * s, 4 * s);
  g.lineStyle(3 * s, 0xffffff, 1); g.strokeCircle(x + 18 * s * spin, y - 97 * s, 6 * s);
}

// Brr Brr Patapim: raíces que brotan del suelo
export function drawRoots(g, x, y, s, k, t) {
  for (let i = -3; i <= 3; i++) {
    const h = (40 + (3 - Math.abs(i)) * 18) * k * s, bx = x + i * 16 * s, sw = Math.sin(t * 0.3 + i) * 4 * s;
    g.fillStyle(OUT, 1); g.fillTriangle(bx - 8 * s, y, bx + 8 * s, y, bx + sw, y - h - 4 * s);
    g.fillStyle(i % 2 ? 0x6b4423 : 0x8b5a2b, 1); g.fillTriangle(bx - 6 * s, y, bx + 6 * s, y, bx + sw, y - h);
    if (k > 0.6) { g.fillStyle(0x6b8e23, 1); g.fillCircle(bx + sw, y - h, 6 * s); }
  }
}

// Lirilì Larilà: elefante-cactus con un reloj
export function drawLirili(g, x, y, s, t) {
  g.fillStyle(OUT, 1); g.fillEllipse(x, y - 40 * s, 76 * s, 64 * s);
  g.fillStyle(0x7cae52, 1); g.fillEllipse(x, y - 40 * s, 70 * s, 58 * s);
  g.fillStyle(0x7cae52, 1); g.fillRoundedRect(x + 22 * s, y - 50 * s, 30 * s, 12 * s, 6 * s);
  g.fillStyle(0xffffff, 1); for (let i = 0; i < 8; i++) g.fillCircle(x - 26 * s + i * 7 * s, y - 60 * s + (i % 2) * 30 * s, 1.5 * s);
  g.fillStyle(OUT, 1); g.fillCircle(x + 12 * s, y - 50 * s, 3 * s);
  // reloj
  const cx = x - 6 * s, cy = y - 100 * s;
  g.fillStyle(OUT, 1); g.fillCircle(cx, cy, 22 * s); g.fillStyle(0xfff6d5, 1); g.fillCircle(cx, cy, 19 * s);
  g.lineStyle(3 * s, OUT, 1); g.lineBetween(cx, cy, cx + Math.cos(t * 0.05) * 14 * s, cy + Math.sin(t * 0.05) * 14 * s);
  g.lineStyle(2 * s, 0xff4d6d, 1); g.lineBetween(cx, cy, cx + Math.cos(t * 0.4) * 16 * s, cy + Math.sin(t * 0.4) * 16 * s);
  // patas con sandalias
  g.fillStyle(0x5c8f3a, 1); g.fillRect(x - 20 * s, y - 14 * s, 12 * s, 14 * s); g.fillRect(x + 8 * s, y - 14 * s, 12 * s, 14 * s);
  g.fillStyle(0x8b5a2b, 1); g.fillRect(x - 22 * s, y - 2 * s, 16 * s, 3 * s); g.fillRect(x + 6 * s, y - 2 * s, 16 * s, 3 * s);
}

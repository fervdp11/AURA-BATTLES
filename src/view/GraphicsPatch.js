// Optimización: Phaser tesela cada arco con 101 puntos (y triangula con earcut al rellenar).
// Con cientos de círculos por frame (articulaciones, partículas) eso dispara el coste de CPU.
// Aquí los círculos se dibujan como abanicos de triángulos y los arcos con segmentos según su radio.
import Phaser from 'phaser';

const TAU = Math.PI * 2;
const segs = r => (r < 3 ? 6 : r < 6 ? 8 : r < 12 ? 12 : r < 28 ? 16 : r < 70 ? 24 : 36);
const COS = {}, SIN = {};
for (const n of [6, 8, 12, 16, 24, 36]) {
  COS[n] = []; SIN[n] = [];
  for (let i = 0; i <= n; i++) { COS[n].push(Math.cos(i / n * TAU)); SIN[n].push(Math.sin(i / n * TAU)); }
}

const G = Phaser.GameObjects.Graphics.prototype;

G.fillCircle = function (x, y, r) {
  if (!(r > 0)) return this;
  const n = segs(r), c = COS[n], s = SIN[n];
  let px = x + r, py = y;
  for (let i = 1; i <= n; i++) {
    const nx = x + c[i] * r, ny = y + s[i] * r;
    this.fillTriangle(x, y, px, py, nx, ny);
    px = nx; py = ny;
  }
  return this;
};

G.arc = function (x, y, radius, startAngle, endAngle, anticlockwise = false) {
  let d = endAngle - startAngle;
  if (anticlockwise) { if (d < -TAU) d = -TAU; else if (d > 0) d = -TAU + (d % TAU); }
  else if (d > TAU) d = TAU; else if (d < 0) d = TAU + (d % TAU);
  const n = Math.max(2, Math.ceil(segs(radius) * Math.abs(d) / TAU));
  for (let i = 0; i <= n; i++) {
    const a = startAngle + d * i / n;
    this.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
  }
  return this;
};

G.fillEllipse = function (x, y, w, h) {
  const rx = w / 2, ry = h / 2;
  const n = segs(Math.max(rx, ry)), c = COS[n], s = SIN[n];
  let px = x + rx, py = y;
  for (let i = 1; i <= n; i++) {
    const nx = x + c[i] * rx, ny = y + s[i] * ry;
    this.fillTriangle(x, y, px, py, nx, ny);
    px = nx; py = ny;
  }
  return this;
};

G.strokeEllipse = function (x, y, w, h) {
  const rx = w / 2, ry = h / 2;
  const n = segs(Math.max(rx, ry)), c = COS[n], s = SIN[n];
  this.beginPath();
  for (let i = 0; i <= n; i++) this.lineTo(x + c[i] * rx, y + s[i] * ry);
  this.strokePath();
  return this;
};

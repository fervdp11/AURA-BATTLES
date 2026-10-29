// Matemática determinista para la simulación: solo usa + − × ÷ y sqrt (exactos en IEEE-754 en todos los
// motores JS). Math.sin/cos/pow/hypot pueden diferir en el último bit entre navegadores, y en una partida
// online con predicción eso acaba desincronizando; con estas funciones servidor y clientes calculan igual.
const PI = 3.141592653589793, TAU = 6.283185307179586, HALF = 1.5707963267948966;

export function dsin(x) {
  x = x - TAU * Math.round(x / TAU); // [-π, π]
  if (x > HALF) x = PI - x; else if (x < -HALF) x = -PI - x; // [-π/2, π/2]
  const x2 = x * x;
  // serie de Taylor hasta x^17 (error < 1e-15 en el intervalo)
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800 + x2 * (-1 / 1307674368000 + x2 * (1 / 355687428096000)))))))));
}
export function dcos(x) { return dsin(x + HALF); }
export function dhypot(x, y) { return Math.sqrt(x * x + y * y); }
export function ipow(b, n) { let r = 1; for (let i = 0; i < n; i++) r *= b; return r; }

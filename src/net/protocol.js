// Protocolo de red: versión, entrada compacta (un entero de bits) y utilidades compartidas cliente/servidor.
import { emptyInput } from '../sim/constants.js';

export const PROTOCOL = 3;
export const TICK_MS = 1000 / 60;
// ventana de compensación de lag del servidor: entradas que lleguen con hasta este retraso se aplican en
// su tick real (el servidor rebobina con su historial de estados); más tarde se rechazan
export const LAG_WINDOW = 12;
// adelanto máximo permitido de una entrada respecto al servidor (más = trampa / reloj roto)
export const MAX_AHEAD = 40;

const KEYS = ['light', 'heavy', 'special', 'skill1', 'skill2', 'ult', 'dash', 'block', 'taunt'];
// bits 0-5 direcciones, 6-14 botones mantenidos, 15-23 botones pulsados
export function encodeInput(i) {
  let n = (i.l ? 1 : 0) | (i.r ? 2 : 0) | (i.u ? 4 : 0) | (i.d ? 8 : 0) | (i.pu ? 16 : 0) | (i.pd ? 32 : 0);
  for (let k = 0; k < KEYS.length; k++) { if (i.held[KEYS[k]]) n |= 1 << (6 + k); if (i.pressed[KEYS[k]]) n |= 1 << (15 + k); }
  return n;
}
export function decodeInput(n) {
  const i = emptyInput();
  i.l = !!(n & 1); i.r = !!(n & 2); i.u = !!(n & 4); i.d = !!(n & 8); i.pu = !!(n & 16); i.pd = !!(n & 32);
  for (let k = 0; k < KEYS.length; k++) { i.held[KEYS[k]] = !!(n & (1 << (6 + k))); i.pressed[KEYS[k]] = !!(n & (1 << (15 + k))); }
  return i;
}
// entrada "prevista" del rival cuando aún no ha llegado: mantiene lo que tenía pulsado, sin pulsaciones nuevas
export function predictInput(last) { return last & 0x7fcf; } // quita pu/pd y los bits de "pulsado"
export const VALID_BITS = (1 << 24) - 1;

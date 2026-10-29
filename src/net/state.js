// Copia y restauración del estado completo de una partida (para predicción con rollback y para el historial
// de estados del servidor), más un hash del estado para detectar desincronizaciones.
// - cloneState(b): copia profunda del grafo (respeta referencias compartidas y ciclos).
// - restoreInto(dst, src): deja dst idéntico a src REUTILIZANDO sus objetos (los luchadores siguen siendo
//   los mismos objetos para la vista), conservando los campos solo-visuales (los que empiezan por "_").
// Los datos inmutables (definiciones de movimientos, estados, poses, perfiles, configuración) se comparten.
import { MOVES } from '../sim/moves.js';
import { STATUS } from '../sim/status.js';
import { POSES } from '../sim/poses.js';

const SHARED = new WeakSet();
const share = o => { if (o && typeof o === 'object' && !SHARED.has(o)) { SHARED.add(o); for (const k in o) { const v = o[k]; if (v && typeof v === 'object' && !(v instanceof Set)) share(v); } } };
for (const m of Object.values(MOVES)) share(m);
for (const s of Object.values(STATUS)) share(s);
for (const p of Object.values(POSES)) share(p);
// configuración de la partida y perfiles (no cambian durante el combate)
export function markShared(b) {
  share(b.opts);
  for (const f of b.fighters) { if (f.profile) share(f.profile); if (f.loadout) share(f.loadout); if (f.controller) SHARED.add(f.controller); }
}
const isView = k => k.charCodeAt(0) === 95; // '_' → solo visual (tela, interpolación, estelas)

export function cloneState(b) {
  markShared(b);
  const map = new Map();
  const cp = v => {
    if (v === null || typeof v !== 'object' || SHARED.has(v)) return v;
    let c = map.get(v);
    if (c) return c;
    if (Array.isArray(v)) { c = new Array(v.length); map.set(v, c); for (let i = 0; i < v.length; i++) c[i] = cp(v[i]); return c; }
    if (v instanceof Set) { c = new Set(); map.set(v, c); for (const x of v) c.add(cp(x)); return c; }
    if (v instanceof Map) { c = new Map(); map.set(v, c); for (const [k, x] of v) c.set(k, cp(x)); return c; }
    c = Object.create(Object.getPrototypeOf(v)); map.set(v, c);
    for (const k of Object.keys(v)) if (!isView(k)) c[k] = cp(v[k]);
    return c;
  };
  return cp(b);
}

export function restoreInto(dst, src) {
  markShared(src);
  const map = new Map(), used = new Set();
  const conv = (sv, dv) => {
    if (sv === null || typeof sv !== 'object' || SHARED.has(sv)) return sv;
    const m = map.get(sv);
    if (m) return m;
    if (Array.isArray(sv)) {
      const d = Array.isArray(dv) && !used.has(dv) && !SHARED.has(dv) ? dv : [];
      map.set(sv, d); used.add(d);
      d.length = sv.length;
      for (let i = 0; i < sv.length; i++) d[i] = conv(sv[i], d[i]);
      return d;
    }
    if (sv instanceof Set) { const d = new Set(); map.set(sv, d); for (const x of sv) d.add(conv(x, null)); return d; }
    if (sv instanceof Map) { const d = new Map(); map.set(sv, d); for (const [k, x] of sv) d.set(k, conv(x, null)); return d; }
    const proto = Object.getPrototypeOf(sv);
    const d = dv && typeof dv === 'object' && !Array.isArray(dv) && !used.has(dv) && !SHARED.has(dv) && Object.getPrototypeOf(dv) === proto ? dv : Object.create(proto);
    map.set(sv, d); used.add(d);
    for (const k of Object.keys(d)) if (!isView(k) && !(k in sv)) delete d[k];
    for (const k of Object.keys(sv)) if (!isView(k)) d[k] = conv(sv[k], d[k]);
    return d;
  };
  map.set(src, dst); used.add(dst);
  for (const k of Object.keys(dst)) if (!isView(k) && !(k in src)) delete dst[k];
  for (const k of Object.keys(src)) if (!isView(k)) dst[k] = conv(src[k], dst[k]);
  return dst;
}

// hash del estado relevante para el juego (FNV-1a sobre valores cuantizados)
export function stateHash(b) {
  let h = 2166136261 >>> 0;
  const mix = n => { h ^= n | 0; h = Math.imul(h, 16777619) >>> 0; };
  const num = x => mix(Math.round((x || 0) * 64));
  const str = s => { s = String(s || ''); for (let i = 0; i < s.length; i++) mix(s.charCodeAt(i)); };
  mix(b.frame); mix(b.rngState); str(b.phase); mix(b.round || 0); num(b.timer);
  for (const f of b.fighters) {
    num(f.x); num(f.y); num(f.vx); num(f.vy); num(f.aura); num(f.energy); str(f.state); mix(f.sf); mix(f.facing);
    str(f.move ? f.move.def.id : ''); mix(f.move ? f.move.f : -1); mix(f.hitstun); mix(f.alive ? 1 : 0);
    for (const s of f.status) { str(s.id); mix(s.t ?? s.frames ?? 0); }
  }
  for (const p of b.projectiles) { num(p.x); num(p.y); mix(p.life || 0); }
  return h >>> 0;
}

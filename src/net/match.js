// Configuración de una partida online, compartida por servidor y clientes (sin Phaser).
// El servidor valida y sanea todo lo que llega del cliente: perfil (solo estética), loadout (ids de técnicas
// reales en su hueco correcto) y remate. Nada de economía viaja del cliente al servidor.
import { Battle } from '../sim/Battle.js';
import { MOVES, FINISHERS } from '../sim/moves.js';
import { byId } from '../data/cosmetics.js';
import { ACCESSORIES } from '../data/progression.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const SLOT_KIND = { special: 'special', specialF: 'special', specialD: 'special', skill1: 'special', skill2: 'special', ult: 'ult', hum1: 'aura', hum2: 'aura', hum3: 'aura' };
const DEFAULT_LOADOUT = { special: 'sixSeven', specialF: 'fakeHandshake', specialD: 'siuuu', skill1: 'mewing', skill2: 'rizz', ult: 'sixSevenBarrage', hum1: 'hum_goodBoy', hum2: 'hum_dustOff', hum3: 'hum_thumbsUp' };
const EQUIP_CATS = ['skin', 'body', 'accent', 'pants', 'shoes', 'head', 'face', 'neck', 'aura', 'auraColor'];

export function sanitizeName(n) { return String(n || 'JUGADOR').replace(/[^\p{L}\p{N} _.\-★]/gu, '').trim().slice(0, 14).toUpperCase() || 'JUGADOR'; }

export function sanitizeProfile(p = {}) {
  const out = { name: sanitizeName(p.name) };
  for (const k of ['color', 'color2', 'accent', 'pantsColor', 'pantsColor2', 'shoesColor']) if (HEX.test(p[k] || '')) out[k] = p[k];
  if (p.aura === 'rainbow' || HEX.test(p.aura || '')) out.aura = p.aura;
  if (ACCESSORIES.some(a => a.id === p.accessory)) out.accessory = p.accessory;
  if (typeof p.celebration === 'string' && /^[a-zA-Z]{1,20}$/.test(p.celebration)) out.celebration = p.celebration;
  out.equip = {};
  if (p.equip && typeof p.equip === 'object') for (const c of EQUIP_CATS) { const id = p.equip[c]; const it = typeof id === 'string' ? byId(id) : null; if (it && it.cat === c) out.equip[c] = id; }
  out.scale = 1; // la escala nunca la decide el cliente (afecta a las hitboxes)
  return out;
}

export function sanitizeLoadout(lo = {}) {
  const out = {};
  const used = new Set();
  for (const slot in SLOT_KIND) {
    const id = lo[slot];
    const m = typeof id === 'string' ? MOVES[id] : null;
    out[slot] = m && m.slot === SLOT_KIND[slot] && !used.has(id) ? id : DEFAULT_LOADOUT[slot];
    used.add(out[slot]);
  }
  return out;
}
export function sanitizeFinisher(f) { return f === 'none' || (typeof f === 'string' && FINISHERS[f]) ? f : 'kickSpace'; }

// Construye la partida idéntica en servidor y clientes a partir de la configuración acordada
export function buildOnlineBattle(cfg) {
  return new Battle({
    fighters: cfg.players.map((p, i) => ({ team: i, profile: { ...p.profile, scale: 1, title: 'J' + (i + 1) }, loadout: { ...p.loadout }, human: true, ctrlProfile: i === 0 ? 'p1' : 'p2', finisher: p.finisher })),
    mode: 'versus', versus: true, online: true, timer: cfg.timer, roundsToWin: cfg.rounds, seed: cfg.seed
  });
}

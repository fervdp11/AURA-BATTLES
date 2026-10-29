// Rangos, recompensas, catálogo de desbloqueos, logros y títulos.
import { MOVES, SPECIAL_IDS, ULT_IDS, FINISHERS } from '../sim/moves.js';
import { CELEBRATIONS } from '../sim/celebrations.js';

export const RANKS = [
  { id: 'none', name: 'Sin Aura', rp: 0, color: '#6b7280' },
  { id: 'npc', name: 'NPC', rp: 60, color: '#9ca3af' },
  { id: 'beginner', name: 'Aura Beginner', rp: 200, color: '#7bd389' },
  { id: 'farmer', name: 'Aura Farmer', rp: 500, color: '#4cc9f0' },
  { id: 'sigma', name: 'Sigma', rp: 1000, color: '#c084fc' },
  { id: 'master', name: 'Aura Master', rp: 1900, color: '#f8961e' },
  { id: 'legend', name: 'Aura Legend', rp: 3300, color: '#ffd166' },
  { id: 'god', name: 'Aura God', rp: 5400, color: '#ff4d6d' }
];

export function rankFor(rp) {
  let r = RANKS[0], i = 0;
  for (let k = 0; k < RANKS.length; k++) if (rp >= RANKS[k].rp) { r = RANKS[k]; i = k; }
  const next = RANKS[i + 1] || null;
  return { ...r, index: i, next, progress: next ? (rp - r.rp) / (next.rp - r.rp) : 1 };
}

// Puntos de rango (PR) y de aura (AP) por partida, desglosados: cada línea dice de dónde sale cada punto.
// 'farm' (0..1) reduce el AP si se repiten partidas en bucle contra rivales muy por debajo (anti-farmeo).
export function matchRewards({ win, level, mode, enemies = 1, perfect, maxCombo = 0, prestige = 0, humiliations = 0, boss = false, waves = 0, farm = 1, replay = false }) {
  const lv = level ?? 2;
  const items = [], penalties = [];
  if (mode === 'training') return { rp: 0, ap: 0, items, penalties };
  let rp = 0;
  if (mode === 'survival') {
    rp = Math.round(waves * (6 + lv * 3));
    items.push({ label: `Oleadas superadas (${waves})`, ap: Math.round(waves * (15 + lv * 6)) });
  } else if (win) {
    rp = Math.round((10 + lv * 9) * (1 + (enemies - 1) * 0.6) * (boss ? 1.8 : 1));
    items.push({ label: boss ? 'Victoria contra jefe' : 'Victoria', ap: Math.round((40 + lv * 22) * (1 + (enemies - 1) * 0.5) * (boss ? 2 : 1)) });
    if (perfect) { rp += 10 + lv * 2; items.push({ label: 'Victoria perfecta', ap: 50 }); }
  } else {
    const loss = Math.round(Math.max(0, 6 - lv) * 1.5);
    rp = -loss;
    items.push({ label: 'Participación (derrota)', ap: 12 + lv * 4 });
    if (loss) penalties.push({ label: 'Derrota', rp: -loss });
  }
  const cb = Math.min(60, maxCombo * 2);
  if (cb) items.push({ label: `Combo máximo x${maxCombo}`, ap: cb });
  if (humiliations) items.push({ label: `Humillaciones (${humiliations})`, ap: humiliations * 5 });
  let ap = items.reduce((a, it) => a + it.ap, 0);
  if (prestige) { const b = Math.round(ap * prestige * 0.1); items.push({ label: `Bonus de prestigio ${prestige}`, ap: b }); ap += b; }
  if (replay && win) { const c = -Math.round(ap * 0.5); penalties.push({ label: 'Combate ya superado (-50%)', ap: c }); ap += c; }
  if (farm < 1) { const c = -Math.round(ap * (1 - farm)); if (c) { penalties.push({ label: `Partidas en bucle (-${Math.round((1 - farm) * 100)}%)`, ap: c }); ap += c; } }
  return { rp, ap: Math.max(0, ap), items, penalties };
}

// Recompensa media real por partida (victorias y derrotas a partes iguales, niveles 1-5, combo típico):
// base de todos los precios de la tienda (técnicas, remates y cosméticos).
export const AVG_MATCH_AP = (() => {
  let sum = 0, n = 0;
  for (let lv = 1; lv <= 5; lv++) for (const win of [true, false]) { sum += matchRewards({ win, level: lv, mode: 'quick', maxCombo: 7, humiliations: 1 }).ap; n++; }
  return sum / n;
})();
// redondeo hacia arriba a 50: un artículo "de 5 partidas" nunca cuesta menos de 5 partidas
export const priceMatches = m => Math.max(50, Math.ceil(AVG_MATCH_AP * m / 50) * 50);

// Anti-farmeo: muchas partidas en la última hora reducen el AP poco a poco (nunca por debajo del 40%).
export function farmFactor(recent, now = Date.now()) {
  const n = (recent || []).filter(t => now - t < 3600e3).length;
  return n <= 12 ? 1 : Math.max(0.4, Math.pow(0.93, n - 12));
}

// Movimientos iniciales; el resto se compran con Aura (AP) y algunos exigen rango
export const STARTER_MOVES = ['sixSeven', 'fakeHandshake', 'siuuu', 'mewing', 'rizz', 'sixSevenBarrage', 'hitTheWoah', 'sideEye', 'broReallyThought', 'chillGuy', 'invisibleDap', 'griddy', 'lBozo', 'bonk'];

// tier: [partidas medias que cuesta, rango mínimo (índice), rareza]
const TIER_OF = {
  1: [5, 0, 'common'], 2: [7, 1, 'common'], 3: [11, 2, 'rare'], 4: [16, 3, 'rare'], 5: [26, 4, 'epic'], 6: [45, 5, 'legendary']
};
const MOVE_TIERS = {
  1: ['snapWalk', 'fakeGreeting', 'doubleSlap', 'shoulderBrush', 'defaultDance', 'sigmaStare', 'noReaction', 'fakeHighFive', 'disrespectfulDodge', 'ratio', 'aimbot', 'emotionalDamage', 'dabOn', 'backflipDiss', 'skillIssue', 'ggEz', 'hitTheWoah', 'bananaSlip'],
  2: ['teabag', 'sixSevenSlam', 'handshakeHeadbutt', 'mewingGlare', 'rizzLean', 'tralalero', 'headPalm', 'auraWalk', 'unoReverse', 'npcMode', 'noLook360', 'phantomDap', 'auraTheft', 'skibidiSpin', 'flossShield', 'sheesh', 'fanumTax', 'bruh', 'vineBoom', 'tungTung', 'clapBack', 'shush', 'goblinMode'],
  3: ['sigmaTurn', 'menacingPose', 'brrPatapim', 'liriliLarila', 'ballerinaCappuccina', 'nahIdWin', 'reverseAura', 'sigmaTeleport', 'crowdControl', 'touchGrass', 'caughtIn4K', 'gigachadJaw', 'mog', 'micDrop', 'dealWithIt', 'ballerinaSpin', 'holdUp', 'afk', 'auraFarming', 'rizzStorm', 'emoteCancel'],
  4: ['brainrotInvasion', 'dramaticEntrance', 'mainCharacter', 'delulu', 'bombasticSideEye', 'letHimCook', 'cooked', 'susVent', 'thisIsFine', 'stonks', 'narutoRun', 'bingChilling', 'ankleBreaker', 'speedrun', 'lagSpike', 'ohioMode', 'ultimateNonchalance', 'sigmaRule'],
  5: ['mainCharacterEnding', 'infiniteMewing', 'bigBrain', 'oraBarrage', 'omaeWaMou', 'falconPunch', 'rickroll', 'rageQuit', 'bombardiro', 'spidermanPoint', 'perfectlyBalanced', 'coffinDance', 'timeStop'],
  6: ['finalAuraJudgment', 'domainExpansion', 'auraOverload']
};
export const MOVE_SHOP = {};
for (const t in MOVE_TIERS) for (const id of MOVE_TIERS[t]) if (MOVES[id] && !STARTER_MOVES.includes(id)) MOVE_SHOP[id] = { price: priceMatches(TIER_OF[t][0] * (MOVES[id].slot === 'ult' ? 1.4 : 1)), rank: TIER_OF[t][1], tier: +t, rarity: TIER_OF[t][2] };
// cualquier especial no listado
for (const id of [...SPECIAL_IDS, ...ULT_IDS]) if (!MOVE_SHOP[id] && !STARTER_MOVES.includes(id)) MOVE_SHOP[id] = { price: priceMatches(TIER_OF[3][0]), rank: 2, tier: 3, rarity: 'rare' };

// Remates: mismas reglas de economía (los gratuitos siguen gratis; lo ya comprado se conserva)
const FIN_RARITY = { kickSpace: null, pantsDown: null, bonkGround: ['rare', 13], explosionWalk: ['epic', 28] };
for (const id in FINISHERS) {
  const r = FIN_RARITY[id] === undefined ? ['rare', 13] : FIN_RARITY[id];
  FINISHERS[id].rarity = r ? r[0] : 'common';
  FINISHERS[id].price = r ? priceMatches(r[1]) : 0;
}

// Cosméticos
export const BODY_COLORS = ['#f4f4f8', '#ffd166', '#ff6b6b', '#4cc9f0', '#7bd389', '#c084fc', '#ff9f1c', '#2ec4b6', '#f72585', '#a3a3a3', '#3a86ff', '#e9c46a', '#06d6a0', '#ef476f', '#8338ec', '#fb5607', '#222222'];
export const AURA_COLORS = [
  { c: '#7df9ff', name: 'Cian', req: null }, { c: '#ffd34d', name: 'Oro', req: null }, { c: '#ff4d6d', name: 'Carmesí', req: null },
  { c: '#c084fc', name: 'Violeta Sigma', req: { rank: 4 } }, { c: '#50fa7b', name: 'Verde Tóxico', req: { rank: 2 } }, { c: '#ff79c6', name: 'Rosa Rizz', req: { rank: 3 } },
  { c: '#ffffff', name: 'Blanco Divino', req: { rank: 6 } }, { c: '#ff7b00', name: 'Llama', req: { rank: 5 } }, { c: '#00e5ff', name: 'Hielo', req: { rank: 1 } },
  { c: '#111111', name: 'Aura Oscura', req: { prestige: 1 } }, { c: 'rainbow', name: 'Arcoíris Prestigio', req: { prestige: 2 } }, { c: '#ffdf00', name: 'Oro Legendario', req: { prestige: 3 } }
];
export const ACCESSORIES = [
  { id: 'none', name: 'Nada', req: null }, { id: 'cap', name: 'Gorra hacia atrás', req: null }, { id: 'headband', name: 'Cinta ninja', req: null },
  { id: 'beanie', name: 'Gorro', req: { rank: 1 } }, { id: 'shades', name: 'Gafas de sol', req: { rank: 2 } }, { id: 'bucket', name: 'Bucket hat', req: { rank: 2 } },
  { id: 'mohawk', name: 'Cresta', req: { rank: 3 } }, { id: 'chain', name: 'Cadena de oro', req: { rank: 3 } }, { id: 'horns', name: 'Cuernos', req: { rank: 4 } },
  { id: 'tophat', name: 'Chistera', req: { rank: 4 } }, { id: 'cowboy', name: 'Sombrero vaquero', req: { ach: 'combo20' } }, { id: 'scarf', name: 'Bufanda', req: { ach: 'parry50' } },
  { id: 'halo', name: 'Halo', req: { rank: 6 } }, { id: 'crown', name: 'Corona', req: { rank: 7 } }, { id: 'antenna', name: 'Antena NPC', req: { ach: 'beatNpc' } },
  { id: 'bow', name: 'Lazo', req: { ach: 'rizz' } }, { id: 'wizard', name: 'Sombrero de mago', req: { prestige: 1 } }, { id: 'flameHair', name: 'Pelo en llamas', req: { prestige: 2 } }
];
export const CELEBRATION_REQ = {
  flex: null, victory: null, wave: null, siuuu: null, griddy: { rank: 1 }, mewing: { rank: 2 }, chill: { rank: 2 }, sixSeven: { rank: 3 },
  dab: { rank: 1 }, floss: { rank: 3 }, sigma: { rank: 4 }, laugh: { ach: 'humiliate25' }, auraFarming: { rank: 5 }, bow: { ach: 'perfect' }, jojo: { prestige: 1 }
};
export const CELEBRATION_LIST = Object.keys(CELEBRATIONS);

export function reqMet(req, save) {
  if (!req) return true;
  const ri = rankFor(save.rankPoints).index;
  if (req.rank !== undefined && ri < req.rank && save.prestige === 0) return false;
  if (req.prestige !== undefined && save.prestige < req.prestige) return false;
  if (req.ach && !save.achievements[req.ach]) return false;
  return true;
}
export function reqText(req) {
  if (!req) return '';
  if (req.rank !== undefined) return 'Rango ' + RANKS[req.rank].name;
  if (req.prestige !== undefined) return 'Prestigio ' + req.prestige;
  if (req.ach) return 'Logro: ' + (ACHIEVEMENTS.find(a => a.id === req.ach) || {}).name;
  return '';
}

// Logros
export const ACHIEVEMENTS = [
  { id: 'firstWin', name: 'Primera Aura', desc: 'Gana tu primer combate', ap: 50, check: s => s.stats.wins >= 1 },
  { id: 'wins10', name: 'Farmeando Aura', desc: 'Gana 10 combates', ap: 150, check: s => s.stats.wins >= 10 },
  { id: 'wins50', name: 'Aura Infinita', desc: 'Gana 50 combates', ap: 500, check: s => s.stats.wins >= 50 },
  { id: 'wins100', name: 'Leyenda Viviente', desc: 'Gana 100 combates', ap: 1000, check: s => s.stats.wins >= 100 },
  { id: 'streak5', name: 'Racha Sigma', desc: 'Racha de 5 victorias', ap: 200, check: s => s.stats.bestStreak >= 5 },
  { id: 'streak10', name: 'Imparable', desc: 'Racha de 10 victorias', ap: 500, check: s => s.stats.bestStreak >= 10 },
  { id: 'perfect', name: 'Aura Perfecta', desc: 'Gana sin recibir daño', ap: 300, check: s => s.stats.perfects >= 1 },
  { id: 'combo10', name: 'Combo Rizz', desc: 'Haz un combo de 10 golpes', ap: 100, check: s => s.stats.maxCombo >= 10 },
  { id: 'combo20', name: 'Combo Infinito', desc: 'Haz un combo de 20 golpes', ap: 300, check: s => s.stats.maxCombo >= 20 },
  { id: 'parry10', name: 'Reflejos', desc: 'Haz 10 parries', ap: 100, check: s => s.stats.parries >= 10 },
  { id: 'parry50', name: 'Muro Sigma', desc: 'Haz 50 parries', ap: 300, check: s => s.stats.parries >= 50 },
  { id: 'humiliate25', name: 'Bro Really Thought', desc: 'Humilla 25 veces', ap: 250, check: s => s.stats.humiliations >= 25 },
  { id: 'ult10', name: 'Cinemático', desc: 'Usa 10 ultimates', ap: 150, check: s => s.stats.ults >= 10 },
  { id: 'beatNpc', name: 'Despierta, NPC', desc: 'Gana a un NPC Despistado', ap: 30, check: s => s.stats.byLevel[0] >= 1 },
  { id: 'beatComp', name: 'Competitivo', desc: 'Gana a un rival Competitivo', ap: 150, check: s => s.stats.byLevel[3] >= 1 },
  { id: 'beatMaster', name: 'Aura Master', desc: 'Gana a un Aura Master', ap: 300, check: s => s.stats.byLevel[4] >= 1 },
  { id: 'beatSigma', name: 'Más Sigma que Sigma', desc: 'Gana a un Sigma Legend', ap: 500, check: s => s.stats.byLevel[5] >= 1 },
  { id: 'beatGod', name: 'Deicida', desc: 'Gana a un Aura God', ap: 1000, check: s => s.stats.byLevel[6] >= 1 },
  { id: 'boss1', name: 'Cazajefes', desc: 'Derrota a un jefe', ap: 300, check: s => s.stats.bosses >= 1 },
  { id: 'boss5', name: 'Exterminador', desc: 'Derrota 5 jefes', ap: 800, check: s => s.stats.bosses >= 5 },
  { id: 'surv5', name: 'Superviviente', desc: 'Supera 5 oleadas', ap: 150, check: s => s.stats.survivalBest >= 5 },
  { id: 'surv15', name: 'Inmortal', desc: 'Supera 15 oleadas', ap: 600, check: s => s.stats.survivalBest >= 15 },
  { id: 'v3', name: 'Uno contra todos', desc: 'Gana un 1v3', ap: 300, check: s => s.stats.wins1v3 >= 1 },
  { id: 'rizz', name: 'W Rizz', desc: 'Enamora 20 veces a tus rivales', ap: 150, check: s => (s.stats.charms || 0) >= 20 },
  { id: 'path1', name: 'El Camino', desc: 'Completa el capítulo 1 del Camino del Aura', ap: 200, check: s => (s.pathChapters || 0) >= 1 },
  { id: 'pathAll', name: 'Fin del Camino', desc: 'Completa el Camino del Aura', ap: 2000, check: s => (s.pathChapters || 0) >= 8 },
  { id: 'rankSigma', name: 'Sigma Oficial', desc: 'Alcanza el rango Sigma', ap: 300, check: s => rankFor(s.rankPoints).index >= 4 || s.prestige > 0 },
  { id: 'rankGod', name: 'Aura God', desc: 'Alcanza el rango Aura God', ap: 1500, check: s => rankFor(s.rankPoints).index >= 7 || s.prestige > 0 },
  { id: 'prestige1', name: 'Renacido', desc: 'Haz prestigio por primera vez', ap: 500, check: s => s.prestige >= 1 },
  { id: 'collector', name: 'Coleccionista', desc: 'Desbloquea 40 movimientos', ap: 600, check: s => s.unlockedMoves.length >= 40 },
  { id: 'allMoves', name: 'Enciclopedia del Meme', desc: 'Desbloquea todos los movimientos', ap: 3000, check: s => s.unlockedMoves.length >= Object.keys(MOVE_SHOP).length + STARTER_MOVES.length }
];

export const TITLES = [
  { id: 'novato', name: 'Novato del Aura', req: null },
  { id: 'npcSlayer', name: 'Despertador de NPCs', req: { ach: 'beatNpc' } },
  { id: 'rizzler', name: 'The Rizzler', req: { ach: 'rizz' } },
  { id: 'parryGod', name: 'Muro Sigma', req: { ach: 'parry50' } },
  { id: 'comboMaker', name: 'Combo Infinito', req: { ach: 'combo20' } },
  { id: 'bully', name: 'Bro Really Thought', req: { ach: 'humiliate25' } },
  { id: 'farmer', name: 'Aura Farmer', req: { rank: 3 } },
  { id: 'sigma', name: 'Sigma Male', req: { rank: 4 } },
  { id: 'master', name: 'Maestro del Aura', req: { rank: 5 } },
  { id: 'legend', name: 'Leyenda del Aura', req: { rank: 6 } },
  { id: 'god', name: 'Aura God', req: { rank: 7 } },
  { id: 'deicide', name: 'Deicida', req: { ach: 'beatGod' } },
  { id: 'survivor', name: 'Inmortal', req: { ach: 'surv15' } },
  { id: 'reborn', name: 'Renacido', req: { prestige: 1 } },
  { id: 'eternal', name: 'Aura Eterna', req: { prestige: 3 } },
  { id: 'chill', name: 'Just a Chill Guy', req: { ach: 'wins10' } },
  { id: 'perfect', name: 'Intocable', req: { ach: 'perfect' } }
];

// Aura final de la partida según cómo has jugado: puede ir de -∞ a +∞.
// Victoria perfecta (sin recibir ni un golpe) = +∞; perder sin hacer ni un rasguño = -∞.
export function finalAura({ stats = {}, win, perfect, shutout, level = 3, finisher = false, enemies = 1, opp = null }) {
  if (perfect && win) return { value: Infinity, label: 'AURA INFINITA', color: '#ffd166' };
  if (shutout && !win) return { value: -Infinity, label: 'AURA NEGATIVA INFINITA', color: '#ff2d55' };
  const s = stats;
  let v = (s.dmg || 0) * 1.2 - (s.taken || 0) * 0.9
    + (s.maxCombo || 0) * 30 + (s.parries || 0) * 80 + (s.counters || 0) * 60 + (s.humiliations || 0) * 45
    + (s.dodges || 0) * 15 + (s.ults || 0) * 60 + (s.specials || 0) * 6 - (s.whiffs || 0) * 4 - (s.blocks || 0) * 2;
  v += win ? 600 + level * 120 + (enemies - 1) * 300 : -700 + level * 40;
  if (finisher) v += 400;
  if (opp && opp.humiliations) v -= opp.humiliations * 40;
  v = Math.round(v);
  const tiers = [[3000, 'AURA LEGENDARIA', '#ffd166'], [1800, 'AURA SIGMA', '#c084fc'], [900, 'MUCHA AURA', '#7df9ff'], [200, 'AURA DECENTE', '#7bd389'], [-200, 'AURA NEUTRA', '#c9c3e6'], [-1000, 'AURA NEGATIVA', '#ff9f1c'], [-Infinity, 'AURA EN LA RUINA', '#ff4d6d']];
  // el texto nunca contradice el resultado: ganar es como mínimo "aura decente"; perder, como mucho
  if (win) v = Math.max(v, 200); else v = Math.min(v, 899);
  const t = tiers.find(x => v >= x[0]);
  return { value: v, label: t[1], color: t[2] };
}
export function auraText(v) {
  if (v === Infinity) return '+∞';
  if (v === -Infinity) return '-∞';
  const a = Math.abs(Math.round(v)).toLocaleString('es-ES');
  return (v >= 0 ? '+' : '-') + a;
}

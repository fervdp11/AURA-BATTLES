// Catálogo de cosméticos (solo apariencia: nunca dan ventaja), rarezas, precios calculados a partir de las
// recompensas reales por partida, propiedad/equipamiento y construcción del "look" que usa el renderer.
import { AVG_MATCH_AP, priceMatches, reqMet, AURA_COLORS, ACCESSORIES, BODY_COLORS } from './progression.js';

export const RARITY = {
  common: { name: 'COMÚN', color: '#b8c0cc', mult: 5 },
  rare: { name: 'RARO', color: '#4cc9f0', mult: 13 },
  epic: { name: 'ÉPICO', color: '#c084fc', mult: 28 },
  legendary: { name: 'LEGENDARIO', color: '#ffd166', mult: 60 }
};

export { AVG_MATCH_AP };
// Un artículo común cuesta al menos ~5 partidas medias; raro, épico y legendario, bastante más.
export const priceFor = rarity => priceMatches(RARITY[rarity].mult);

export const SLOTS = {
  skin: 'TIPO DE CUERPO', body: 'COLORES DEL CUERPO', pants: 'PANTALONES', shoes: 'CALZADO',
  head: 'CABEZA', face: 'GAFAS', neck: 'CUELLO', aura: 'AURA', auraColor: 'COLOR DEL AURA'
};

const C = [];
const add = (cat, id, name, rarity, data = {}, free = false) => C.push({ cat, id: cat + ':' + id, key: id, name, rarity, free, data, price: free ? 0 : priceFor(rarity) });

// ---- tipo de cuerpo ----
add('skin', 'stick', 'Stickman clásico', 'common', {}, true);
add('skin', 'shark', 'Tiburón con zapatillas', 'legendary', { shark: true });

// ---- colores del cuerpo: los sólidos de siempre son gratuitos; las combinaciones se compran ----
BODY_COLORS.forEach((c, i) => add('body', 'solid' + i, 'Color ' + c.toUpperCase(), 'common', { pattern: 'solid', c1: c, c2: c }, true));
add('body', 'duoFire', 'Dúo Fuego', 'common', { pattern: 'split', c1: '#ff6b6b', c2: '#ffd166' });
add('body', 'duoOcean', 'Dúo Océano', 'common', { pattern: 'split', c1: '#4cc9f0', c2: '#3a86ff' });
add('body', 'duoMint', 'Dúo Menta', 'common', { pattern: 'split', c1: '#f4f4f8', c2: '#06d6a0' });
add('body', 'stripesBee', 'Rayas Abeja', 'rare', { pattern: 'stripes', c1: '#ffd166', c2: '#222222' });
add('body', 'stripesCandy', 'Rayas Caramelo', 'rare', { pattern: 'stripes', c1: '#ffffff', c2: '#ef476f' });
add('body', 'gradSunset', 'Degradado Atardecer', 'rare', { pattern: 'gradient', c1: '#ffd166', c2: '#f72585' });
add('body', 'gradIce', 'Degradado Hielo', 'rare', { pattern: 'gradient', c1: '#ffffff', c2: '#4cc9f0' });
add('body', 'neon', 'Neón Sigma', 'epic', { pattern: 'gradient', c1: '#c084fc', c2: '#00f0ff', glowLines: true });
add('body', 'lava', 'Lava', 'epic', { pattern: 'lava', c1: '#ff3d00', c2: '#2a0a00' });
add('body', 'goldBlack', 'Oro y Ónice', 'epic', { pattern: 'split', c1: '#ffd700', c2: '#151515' });
add('body', 'rainbow', 'Arcoíris Animado', 'legendary', { pattern: 'rainbow', c1: '#ff4d6d', c2: '#7df9ff' });
add('body', 'galaxy', 'Galaxia', 'legendary', { pattern: 'galaxy', c1: '#1b0f3b', c2: '#7b2cbf' });

// ---- pantalones (con física secundaria de tela en el renderer) ----
add('pants', 'sport', 'Pantalón corto deportivo', 'common', { style: 'sport', c1: '#2b2d42', c2: '#ffffff' }, true);
add('pants', 'boxing', 'Calzón de boxeo', 'common', { style: 'boxing', c1: '#d62828', c2: '#ffd166' });
add('pants', 'long', 'Pantalón largo', 'common', { style: 'long', c1: '#3d405b', c2: '#3d405b' });
add('pants', 'joggers', 'Joggers', 'rare', { style: 'joggers', c1: '#6c757d', c2: '#f4f4f8' });
add('pants', 'camo', 'Cargo camuflaje', 'rare', { style: 'camo', c1: '#606c38', c2: '#283618' });
add('pants', 'future', 'Pantalón futurista', 'epic', { style: 'future', c1: '#14213d', c2: '#00f0ff' });
add('pants', 'flames', 'Pantalón en llamas', 'epic', { style: 'flames', c1: '#111111', c2: '#ff7b00' });
add('pants', 'galaxy', 'Pantalón Galaxia', 'legendary', { style: 'galaxy', c1: '#1b0f3b', c2: '#c084fc' });
add('pants', 'sixseven', 'Pantalón Six Seven', 'legendary', { style: 'sixseven', c1: '#ffd166', c2: '#111111' });

// ---- calzado ----
add('shoes', 'sneaker', 'Zapatillas', 'common', { style: 'sneaker', c1: null }, true);
add('shoes', 'hightops', 'Bambas altas', 'common', { style: 'hightops', c1: '#ef476f' });
add('shoes', 'slides', 'Chanclas con calcetín', 'common', { style: 'slides', c1: '#f4f4f8' });
add('shoes', 'boots', 'Botas', 'rare', { style: 'boots', c1: '#6b4423' });
add('shoes', 'cleats', 'Botas de fútbol', 'rare', { style: 'cleats', c1: '#00f0ff' });
add('shoes', 'jets', 'Zapatillas propulsoras', 'epic', { style: 'jets', c1: '#b0b8c8' });
add('shoes', 'sharkSneaks', 'Zapatillas Tralalero', 'epic', { style: 'shark', c1: '#4cc9f0' });
add('shoes', 'golden', 'Zapatillas de oro', 'legendary', { style: 'golden', c1: '#ffd700' });

// ---- cabeza (incluye los accesorios de siempre; los ya desbloqueados por rango/logro se respetan) ----
const HEAD_RARITY = { none: 'common', cap: 'common', headband: 'common', beanie: 'common', bucket: 'common', mohawk: 'rare', horns: 'rare', tophat: 'rare', cowboy: 'rare', bow: 'rare', antenna: 'rare', halo: 'epic', crown: 'legendary', wizard: 'epic', flameHair: 'legendary' };
for (const a of ACCESSORIES) {
  if (a.id === 'shades' || a.id === 'chain' || a.id === 'scarf') continue;
  add('head', a.id, a.name, HEAD_RARITY[a.id] || 'rare', { acc: a.id, req: a.req }, a.id === 'none' || a.id === 'cap' || a.id === 'headband');
}
add('head', 'headphones', 'Auriculares', 'common', { acc: 'headphones' });
add('head', 'catEars', 'Orejas de gato', 'rare', { acc: 'catEars' });
add('head', 'propeller', 'Gorra con hélice', 'rare', { acc: 'propeller' });
add('head', 'helmet', 'Casco de moto', 'epic', { acc: 'helmet' });
add('head', 'viking', 'Casco vikingo', 'epic', { acc: 'viking' });

// ---- gafas ----
add('face', 'none', 'Sin gafas', 'common', { eye: 'none' }, true);
add('face', 'shades', 'Gafas de sol', 'common', { eye: 'shades', req: { rank: 2 } });
add('face', 'round', 'Gafas redondas', 'common', { eye: 'round' });
add('face', 'monocle', 'Monóculo', 'rare', { eye: 'monocle' });
add('face', 'visor', 'Visor cyber', 'epic', { eye: 'visor' });
add('face', 'starGlasses', 'Gafas de estrella', 'legendary', { eye: 'star' });

// ---- cuello ----
add('neck', 'none', 'Nada', 'common', { neck: 'none' }, true);
add('neck', 'chain', 'Cadena de oro', 'rare', { neck: 'chain', req: { rank: 3 } });
add('neck', 'scarf', 'Bufanda', 'rare', { neck: 'scarf', req: { ach: 'parry50' } });

// ---- auras: estilo y color por separado ----
add('aura', 'classic', 'Aura clásica', 'common', { style: 'classic' }, true);
add('aura', 'flame', 'Llamarada', 'rare', { style: 'flame' });
add('aura', 'sparkle', 'Destellos', 'rare', { style: 'sparkle' });
add('aura', 'electric', 'Eléctrica', 'epic', { style: 'electric' });
add('aura', 'hearts', 'Corazones Rizz', 'epic', { style: 'hearts' });
add('aura', 'sixseven', 'Six Seven', 'legendary', { style: 'sixseven' });
add('aura', 'prism', 'Prisma multicolor', 'legendary', { style: 'prism' });
add('aura', 'void', 'Vacío', 'legendary', { style: 'void' });
const AURA_RARITY = { 0: 'common', 1: 'common', 2: 'common' };
AURA_COLORS.forEach((a, i) => add('auraColor', 'c' + i, a.name, a.req ? (a.req.prestige ? 'legendary' : a.req.rank >= 5 ? 'epic' : 'rare') : AURA_RARITY[i] || 'common', { c: a.c, req: a.req }, !a.req));

export const COSMETICS = C;
export const byId = id => C.find(c => c.id === id);
export const ofCat = cat => C.filter(c => c.cat === cat);

// ---------- propiedad ----------
export function isOwned(save, item) {
  if (!item) return false;
  if (item.free) return true;
  if ((save.ownedCosmetics || []).includes(item.id)) return true;
  // progreso existente: lo que antes se desbloqueaba por rango/logro sigue desbloqueado
  if (item.data.req && reqMet(item.data.req, save)) return true;
  return false;
}
export function buy(save, item) {
  if (!item || isOwned(save, item)) return { ok: false, reason: 'owned' };
  if (save.ap < item.price) return { ok: false, reason: 'ap', missing: item.price - save.ap };
  save.ap -= item.price;
  (save.ownedCosmetics = save.ownedCosmetics || []).push(item.id);
  return { ok: true };
}

// ---------- equipamiento (perfil → ids) ----------
export const DEFAULT_COSMETICS = { skin: 'skin:stick', body: null, pants: 'pants:sport', shoes: 'shoes:sneaker', head: null, face: 'face:none', neck: 'neck:none', aura: 'aura:classic', auraColor: null };
export function equippedId(profile, cat) {
  const e = profile.equip || {};
  if (e[cat]) return e[cat];
  // compatibilidad con perfiles antiguos
  if (cat === 'head') return 'head:' + (profile.accessory && byId('head:' + profile.accessory) ? profile.accessory : 'none');
  if (cat === 'face') return profile.accessory === 'shades' ? 'face:shades' : 'face:none';
  if (cat === 'neck') return profile.accessory === 'chain' ? 'neck:chain' : profile.accessory === 'scarf' ? 'neck:scarf' : 'neck:none';
  if (cat === 'auraColor') { const i = AURA_COLORS.findIndex(a => a.c === profile.aura); return 'auraColor:c' + Math.max(0, i); }
  if (cat === 'body') { const i = BODY_COLORS.indexOf(profile.color); return i >= 0 ? 'body:solid' + i : null; }
  return DEFAULT_COSMETICS[cat];
}
export function equip(profile, item) {
  profile.equip = profile.equip || {};
  profile.equip[item.cat] = item.id;
  const d = item.data;
  if (item.cat === 'body') { profile.color = d.c1; profile.color2 = d.c2; }
  if (item.cat === 'head') profile.accessory = d.acc;
  if (item.cat === 'auraColor') profile.aura = d.c;
  if (item.cat === 'pants') { profile.pantsColor = d.c1; profile.pantsColor2 = d.c2; }
  if (item.cat === 'shoes') profile.shoesColor = d.c1;
}

// ---------- look para el renderer (todos los menús, combates y la red usan esta misma función) ----------
const hex = c => (typeof c === 'number' ? c : parseInt(String(c || '#ffffff').replace('#', ''), 16));
export function makeLook(p = {}) {
  const get = cat => byId(equippedId(p, cat));
  const body = get('body'), pants = get('pants'), shoes = get('shoes'), face = get('face'), neck = get('neck'), aura = get('aura'), skin = get('skin');
  const rainbowAura = p.aura === 'rainbow';
  return {
    body: hex(p.color || '#f4f4f8'), body2: hex(p.color2 || (body ? body.data.c2 : null) || p.color || '#f4f4f8'),
    bodyPattern: body ? body.data.pattern : 'solid', bodyGlowLines: !!(body && body.data.glowLines),
    accent: hex(p.accent || '#ffd166'), outline: p.boss ? 0x14000a : 0x0a0a14,
    aura: rainbowAura ? 0xffffff : hex(p.aura || '#7df9ff'), auraRainbow: rainbowAura,
    auraStyle: aura ? aura.data.style : 'classic',
    accessory: p.accessory && p.accessory !== 'shades' && p.accessory !== 'chain' && p.accessory !== 'scarf' ? p.accessory : 'none',
    eyewear: face ? face.data.eye : (p.accessory === 'shades' ? 'shades' : 'none'),
    neck: neck ? neck.data.neck : 'none',
    pants: pants ? pants.data.style : 'sport', pantsColor: hex(p.pantsColor || (pants ? pants.data.c1 : '#2b2d42')), pantsColor2: hex(p.pantsColor2 || (pants ? pants.data.c2 : '#ffffff')),
    shoes: shoes ? shoes.data.style : 'sneaker', shoesColor: p.shoesColor ? hex(p.shoesColor) : null,
    skin: skin && skin.data.shark ? 'shark' : 'stick'
  };
}

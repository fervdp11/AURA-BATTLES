// Construcción de combates a partir de una especificación de partida.
import { Battle } from '../sim/Battle.js';
import { AIController, DummyController } from '../sim/AI.js';
import { Save } from './Save.js';
import { BOTS, BOSSES, botsOfLevel } from '../data/bots.js';
import { ARENAS } from '../view/Arena.js';
import { TITLES } from '../data/progression.js';

export function playerProfile() {
  const d = Save.d;
  const t = TITLES.find(x => x.id === d.profile.title);
  return { ...d.profile, title: t ? t.name : '', scale: 1 };
}

// Ropa de los bots: elegida de forma estable a partir del nombre (solo estética, nunca da ventaja)
const BOT_PANTS = ['sport', 'boxing', 'long', 'joggers', 'camo', 'future', 'flames', 'galaxy', 'sixseven'];
const BOT_SHOES = ['sneaker', 'hightops', 'slides', 'boots', 'cleats', 'jets', 'golden'];
const BOT_AURA = ['classic', 'classic', 'flame', 'sparkle', 'electric', 'classic'];
function nameHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
export function botProfile(bot) {
  const h = nameHash(bot.name || 'bot');
  const lv = bot.level || 0;
  const pants = BOT_PANTS[Math.min(BOT_PANTS.length - 1, (h % 5) + (lv >= 4 ? 3 : lv >= 2 ? 1 : 0))];
  const equip = { skin: /^Tralalero/.test(bot.name || '') ? 'skin:shark' : 'skin:stick', pants: 'pants:' + pants, shoes: 'shoes:' + BOT_SHOES[(h >>> 5) % BOT_SHOES.length], aura: 'aura:' + (bot.boss ? 'flame' : BOT_AURA[(h >>> 9) % BOT_AURA.length]) };
  return { name: bot.name, color: bot.color, accent: bot.accent, aura: bot.aura, accessory: bot.accessory, celebration: bot.celebration, scale: bot.scale, boss: bot.boss, title: bot.boss ? 'JEFE' : '', quote: bot.quote, style: bot.style, level: bot.level, equip };
}

export function buildBattle(spec) {
  const d = Save.d;
  const fighters = [];
  // multijugador local: dos humanos, cada uno con su perfil de teclas
  if (spec.mode === 'versus') {
    fighters.push({ team: 0, profile: { ...spec.p1.profile, scale: 1 }, loadout: { ...spec.p1.loadout }, human: true, ctrlProfile: 'p1', finisher: spec.p1.finisher });
    fighters.push({ team: 1, profile: { ...spec.p2.profile, scale: 1 }, loadout: { ...spec.p2.loadout }, human: true, ctrlProfile: 'p2', finisher: spec.p2.finisher });
    return new Battle({ fighters, mode: 'versus', versus: true, timer: spec.timer ?? 99, roundsToWin: spec.rounds || 1, seed: (Math.random() * 1e9) | 0 });
  }
  fighters.push({ team: 0, profile: playerProfile(), loadout: { ...d.loadout }, human: true, finisher: spec.mode === 'training' ? null : d.finisher, infiniteEnergy: spec.mode === 'training' && spec.infiniteEnergy, energy: spec.startEnergy || 0,
    controller: spec.aiPlayer ? new AIController({ level: spec.aiPlayer, style: 'balanced', seed: 99 }) : undefined });
  spec.enemies.forEach((bot, i) => {
    const level = spec.levelOverride ?? bot.level;
    const ctrl = spec.mode === 'training' ? new DummyController(spec.dummyMode || 'stand') : new AIController({ level, style: bot.style, seed: (Date.now() + i * 7919) & 0xffffff });
    fighters.push({ team: 1, profile: botProfile(bot), loadout: { ...bot.loadout }, controller: ctrl, finisher: ['kickSpace', 'pantsDown', 'bonkGround', 'explosionWalk'][(bot.name.length + i) % 4], maxAura: spec.mode === 'training' ? 1000 : bot.maxAura, infiniteAura: spec.mode === 'training' });
  });
  const b = new Battle({
    fighters, mode: spec.mode, training: spec.mode === 'training', timer: spec.mode === 'training' ? 0 : (spec.timer ?? 99),
    roundsToWin: spec.rounds || 1, seed: (Math.random() * 1e9) | 0, endless: spec.mode === 'survival'
  });
  if (spec.mode === 'training') {
    for (const f of b.fighters) if (!f.isHuman) { f.infiniteAura = true; f.dummyCtrl = f.controller; }
    const p = b.player; p.infiniteEnergy = !!spec.infiniteEnergy;
  }
  return b;
}

export function pickArena(spec) {
  if (spec.arena && spec.arena !== 'random') return spec.arena;
  if ((spec.enemies || []).some(e => e.boss)) return 'colosseum';
  const list = ARENAS.filter(a => a.id !== 'colosseum');
  return list[Math.floor(Math.random() * list.length)].id;
}

export function quickOpponents(level, count) {
  const pool = botsOfLevel(level);
  const out = [];
  const used = new Set();
  while (out.length < count) {
    const b = pool[Math.floor(Math.random() * pool.length)];
    if (!used.has(b.id) || used.size >= pool.length) { used.add(b.id); out.push(b); }
  }
  return out;
}

export function bossFor(level) {
  const list = BOSSES.filter(b => b.level <= Math.max(1, level));
  return list.length ? list[list.length - 1] : BOSSES[0];
}

// Oleadas de supervivencia: dificultad y número de rivales crecientes
export function survivalWave(n) {
  const level = Math.min(6, Math.floor((n - 1) / 2));
  const count = n % 5 === 0 ? 1 : Math.min(3, 1 + Math.floor((n - 1) / 4));
  if (n % 5 === 0) return { enemies: [BOSSES[Math.min(BOSSES.length - 1, Math.floor(n / 5) - 1)]], level: Math.min(6, level + 1), boss: true };
  return { enemies: quickOpponents(level, count), level };
}

export { BOTS, BOSSES };

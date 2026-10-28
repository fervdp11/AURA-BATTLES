// Guardado local (localStorage) de progreso, estadísticas, desbloqueos y ajustes.
import { STARTER_MOVES, ACHIEVEMENTS, rankFor, matchRewards } from '../data/progression.js';

const KEY = 'aura-legends-save-v1';

function defaults() {
  return {
    version: 1,
    profile: { name: 'TÚ', color: '#f4f4f8', accent: '#ffd166', aura: '#7df9ff', accessory: 'cap', celebration: 'flex', title: 'novato' },
    loadout: { special: 'sixSeven', specialF: 'fakeHandshake', specialD: 'siuuu', skill1: 'mewing', skill2: 'rizz', ult: 'sixSevenBarrage' },
    unlockedMoves: [...STARTER_MOVES],
    ap: 300, rankPoints: 0, prestige: 0,
    stats: { wins: 0, losses: 0, matches: 0, streak: 0, bestStreak: 0, byLevel: [0, 0, 0, 0, 0, 0, 0], lossByLevel: [0, 0, 0, 0, 0, 0, 0], perfects: 0, maxCombo: 0, parries: 0, humiliations: 0, damage: 0, ults: 0, bosses: 0, survivalBest: 0, survivalRuns: 0, wins1v3: 0, charms: 0, playFrames: 0, specials: 0, kos: 0 },
    path: { cleared: {} }, pathChapters: 0,
    achievements: {},
    lastLevel: 2,
    settings: { music: 0.55, sfx: 0.8, voice: true, shake: 1, damageNumbers: true, showFps: false, hitboxes: false, bindings: null, quality: 'alta', announcer: true }
  };
}

function merge(base, src) {
  if (!src || typeof src !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (src[k] === undefined) continue;
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) base[k] = merge(base[k], src[k]);
    else base[k] = src[k];
  }
  for (const k of Object.keys(src)) if (base[k] === undefined) base[k] = src[k];
  return base;
}

class SaveManager {
  constructor() { this.data = defaults(); this.listeners = []; }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(defaults(), JSON.parse(raw));
    } catch (e) { this.data = defaults(); }
    return this.data;
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* almacenamiento no disponible */ } }
  reset() { this.data = defaults(); this.save(); }
  get d() { return this.data; }
  get rank() { return rankFor(this.data.rankPoints); }

  // Registra una partida y devuelve recompensas + logros nuevos
  recordMatch(info) {
    const d = this.data, s = d.stats;
    const prevRank = rankFor(d.rankPoints).index;
    const r = matchRewards({ ...info, prestige: d.prestige });
    if (info.mode !== 'training') {
      s.matches++;
      if (info.mode !== 'survival') {
        if (info.win) {
          s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak);
          if (info.level !== undefined) s.byLevel[info.level] = (s.byLevel[info.level] || 0) + 1;
          if (info.perfect) s.perfects++;
          if (info.boss) s.bosses++;
          if (info.enemies >= 3) s.wins1v3++;
        } else { s.losses++; s.streak = 0; if (info.level !== undefined) s.lossByLevel[info.level] = (s.lossByLevel[info.level] || 0) + 1; }
      }
      if (info.mode === 'survival') { s.survivalRuns++; s.survivalBest = Math.max(s.survivalBest, info.waves || 0); }
    }
    const st = info.stats || {};
    s.maxCombo = Math.max(s.maxCombo, st.maxCombo || 0);
    s.parries += st.parries || 0;
    s.humiliations += st.humiliations || 0;
    s.damage += Math.round(st.dmg || 0);
    s.ults += st.ults || 0;
    s.specials += st.specials || 0;
    s.charms += info.charms || 0;
    s.playFrames += info.frames || 0;
    d.rankPoints = Math.max(0, d.rankPoints + r.rp);
    d.ap += r.ap;
    const newAch = this.checkAchievements();
    const rank = rankFor(d.rankPoints);
    this.save();
    return { ...r, newAch, rank, rankUp: rank.index > prevRank };
  }

  checkAchievements() {
    const d = this.data;
    const out = [];
    for (const a of ACHIEVEMENTS) {
      if (d.achievements[a.id]) continue;
      let ok = false;
      try { ok = a.check(d); } catch (e) { ok = false; }
      if (ok) { d.achievements[a.id] = Date.now(); d.ap += a.ap; out.push(a); }
    }
    if (out.length) this.save();
    return out;
  }

  canPrestige() { return rankFor(this.data.rankPoints).index >= 7; }
  doPrestige() {
    if (!this.canPrestige()) return false;
    this.data.prestige++;
    this.data.rankPoints = 0;
    this.data.ap += 1000;
    this.checkAchievements();
    this.save();
    return true;
  }
}

export const Save = new SaveManager();

// Guardado local (localStorage) de progreso, estadísticas, desbloqueos y ajustes.
import { STARTER_MOVES, ACHIEVEMENTS, rankFor, matchRewards, farmFactor } from '../data/progression.js';

const KEY = 'aura-legends-save-v1';

function defaults() {
  return {
    version: 1,
    profile: { name: 'TÚ', color: '#f4f4f8', accent: '#ffd166', aura: '#7df9ff', accessory: 'cap', celebration: 'flex', title: 'novato' },
    loadout: { special: 'sixSeven', specialF: 'fakeHandshake', specialD: 'siuuu', skill1: 'mewing', skill2: 'rizz', ult: 'sixSevenBarrage', hum1: 'hum_goodBoy', hum2: 'hum_dustOff', hum3: 'hum_thumbsUp' },
    unlockedMoves: [...STARTER_MOVES],
    finisher: 'kickSpace', unlockedFinishers: ['kickSpace', 'pantsDown'],
    ap: 300, rankPoints: 0, prestige: 0,
    stats: { wins: 0, losses: 0, matches: 0, streak: 0, bestStreak: 0, byLevel: [0, 0, 0, 0, 0, 0, 0], lossByLevel: [0, 0, 0, 0, 0, 0, 0], perfects: 0, maxCombo: 0, parries: 0, humiliations: 0, damage: 0, ults: 0, bosses: 0, survivalBest: 0, survivalRuns: 0, wins1v3: 0, charms: 0, playFrames: 0, specials: 0, kos: 0 },
    path: { cleared: {} }, pathChapters: 0,
    ownedCosmetics: [], recentMatches: [], recordedMatchIds: [],
    achievements: {},
    lastLevel: 1,
    settings: { music: 0.55, sfx: 0.8, shake: 1, damageNumbers: true, showFps: false, hitboxes: false, bindings: null, bindingsP1: null, bindingsP2: null, quality: 'alta' }
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
      // movimientos iniciales añadidos en versiones nuevas (p.ej. humillaciones de aura): se conceden sin tocar lo comprado
      for (const id of STARTER_MOVES) if (!this.data.unlockedMoves.includes(id)) this.data.unlockedMoves.push(id);
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
    const before = { ap: d.ap, rp: d.rankPoints };
    // cada partida se registra una sola vez (evita duplicar recompensas al reenviar el resultado)
    if (info.matchId) {
      if (d.recordedMatchIds.includes(info.matchId)) return { rp: 0, ap: 0, items: [], penalties: [], newAch: [], rank: rankFor(d.rankPoints), rankUp: false, before, after: before, duplicate: true };
      d.recordedMatchIds.push(info.matchId); if (d.recordedMatchIds.length > 40) d.recordedMatchIds.shift();
    }
    const now = Date.now();
    d.recentMatches = (d.recentMatches || []).filter(t => now - t < 3600e3);
    const r = matchRewards({ ...info, prestige: d.prestige, farm: info.mode === 'training' ? 1 : farmFactor(d.recentMatches, now) });
    if (info.mode !== 'training') d.recentMatches.push(now);
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
    s.kos += info.kos || 0;
    s.playFrames += info.frames || 0;
    d.rankPoints = Math.max(0, d.rankPoints + r.rp);
    d.ap += r.ap;
    const apMatch = d.ap;
    const newAch = this.checkAchievements();
    const rank = rankFor(d.rankPoints);
    this.save();
    return { ...r, rp: d.rankPoints - before.rp, newAch, rank, rankUp: rank.index > prevRank, before, after: { ap: apMatch, rp: d.rankPoints }, achAp: d.ap - apMatch };
  }

  // Partida online: las recompensas vienen calculadas por el servidor (nunca por el cliente) y se aplican
  // una sola vez por partida.
  recordOnline({ matchId, reward, win, stats = {} }) {
    const d = this.data, s = d.stats;
    const before = { ap: d.ap, rp: d.rankPoints };
    if (!matchId || !reward || d.recordedMatchIds.includes(matchId)) return { duplicate: true, before, after: before, items: [], penalties: [], newAch: [], rank: rankFor(d.rankPoints) };
    d.recordedMatchIds.push(matchId); if (d.recordedMatchIds.length > 40) d.recordedMatchIds.shift();
    const ap = Math.max(0, Math.min(5000, Math.round(reward.ap || 0))), rp = Math.max(-200, Math.min(500, Math.round(reward.rp || 0)));
    const prevRank = rankFor(d.rankPoints).index;
    s.matches++; s.online = (s.online || 0) + 1;
    if (win) { s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); s.onlineWins = (s.onlineWins || 0) + 1; } else { s.losses++; s.streak = 0; }
    s.maxCombo = Math.max(s.maxCombo, stats.maxCombo || 0); s.parries += stats.parries || 0; s.humiliations += stats.humiliations || 0;
    d.rankPoints = Math.max(0, d.rankPoints + rp); d.ap += ap;
    const apMatch = d.ap;
    const newAch = this.checkAchievements();
    const rank = rankFor(d.rankPoints);
    this.save();
    return { ap, rp: d.rankPoints - before.rp, items: reward.items || [], penalties: reward.penalties || [], newAch, rank, rankUp: rank.index > prevRank, before, after: { ap: apMatch, rp: d.rankPoints }, achAp: d.ap - apMatch };
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

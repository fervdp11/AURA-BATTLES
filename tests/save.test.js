// Guardado: un guardado antiguo conserva compras y progreso y recibe lo nuevo; las recompensas no se duplican.
import test from 'node:test';
import assert from 'node:assert';

const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { Save } = await import('../src/core/Save.js');
const { isOwned, byId } = await import('../src/data/cosmetics.js');

test('migración de un guardado antiguo sin perder compras ni progreso', () => {
  const old = {
    version: 1, ap: 4321, rankPoints: 1200, prestige: 0,
    profile: { name: 'VETERANO', color: '#ff6b6b', accent: '#ffd166', aura: '#c084fc', accessory: 'tophat', celebration: 'griddy', title: 'sigma' },
    loadout: { special: 'sixSevenSlam', specialF: 'fakeHandshake', specialD: 'siuuu', skill1: 'mewing', skill2: 'rizz', ult: 'domainExpansion' },
    unlockedMoves: ['sixSeven', 'sixSevenSlam', 'domainExpansion'], achievements: { firstWin: 1 }, stats: { wins: 30, losses: 4 }
  };
  store.set('aura-legends-save-v1', JSON.stringify(old));
  const d = Save.load();
  assert.equal(d.ap, 4321); assert.equal(d.rankPoints, 1200);
  assert.equal(d.stats.wins, 30);
  assert.ok(d.unlockedMoves.includes('sixSevenSlam') && d.unlockedMoves.includes('domainExpansion'), 'compras conservadas');
  assert.ok(d.unlockedMoves.includes('hum_goodBoy'), 'humillaciones iniciales concedidas');
  assert.equal(d.loadout.ult, 'domainExpansion');
  assert.equal(d.loadout.hum1, 'hum_goodBoy');
  assert.deepEqual(d.ownedCosmetics, []);
  // lo que antes se desbloqueaba por rango (chistera: rango 4 = Sigma, 1000 PR) sigue siendo suyo
  assert.ok(isOwned(d, byId('head:tophat')));
});

test('las recompensas de una partida se aplican una sola vez', () => {
  Save.reset();
  const info = { mode: 'quick', win: true, level: 3, enemies: 1, maxCombo: 5, humiliations: 2, stats: { maxCombo: 5 }, matchId: 'm-1' };
  const a = Save.recordMatch(info), ap1 = Save.d.ap;
  const b = Save.recordMatch(info);
  assert.ok(a.ap > 0); assert.ok(b.duplicate); assert.equal(Save.d.ap, ap1);
  const o1 = Save.recordOnline({ matchId: 'srv-1', reward: { ap: 150, rp: 20 }, win: true }), ap2 = Save.d.ap;
  const o2 = Save.recordOnline({ matchId: 'srv-1', reward: { ap: 150, rp: 20 }, win: true });
  assert.equal(o1.ap, 150); assert.ok(o2.duplicate); assert.equal(Save.d.ap, ap2);
  // valores absurdos se acotan
  const o3 = Save.recordOnline({ matchId: 'srv-2', reward: { ap: 1e9, rp: 1e9 }, win: true });
  assert.ok(o3.ap <= 5000);
});

test('una derrota nunca da recompensa de victoria y una victoria nunca penaliza', async () => {
  const { matchRewards, finalAura } = await import('../src/data/progression.js');
  for (let lv = 0; lv <= 6; lv++) {
    const w = matchRewards({ win: true, level: lv, mode: 'quick' }), l = matchRewards({ win: false, level: lv, mode: 'quick' });
    assert.ok(!l.items.some(it => /Victoria/.test(it.label)), 'derrota sin líneas de victoria');
    assert.ok(w.rp >= 0 && w.penalties.length === 0, 'victoria sin penalización');
    assert.ok(l.rp <= 0);
    const fw = finalAura({ stats: { taken: 5000 }, win: true, level: lv }), fl = finalAura({ stats: { dmg: 9000, maxCombo: 50 }, win: false, level: lv });
    assert.ok(fw.value >= 200, 'ganar nunca muestra aura negativa');
    assert.ok(fl.value < 900, 'perder nunca muestra mucha aura');
  }
});

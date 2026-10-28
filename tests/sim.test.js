import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/sim/Battle.js';
import { AIController, STYLES } from '../src/sim/AI.js';
import { MOVES, SPECIAL_IDS, ULT_IDS } from '../src/sim/moves.js';

function loadoutFor(seed) {
  const pick = (arr, k) => arr[(seed * 7919 + k * 104729) % arr.length];
  return { special: pick(SPECIAL_IDS, 1), specialF: pick(SPECIAL_IDS, 2), specialD: pick(SPECIAL_IDS, 3), skill1: pick(SPECIAL_IDS, 4), skill2: pick(SPECIAL_IDS, 5), ult: pick(ULT_IDS, 6) };
}

function runBattle(seed, l0, l1, n1 = 1) {
  const styles = Object.keys(STYLES);
  const fighters = [{ team: 0, profile: { name: 'A' }, loadout: loadoutFor(seed), controller: new AIController({ level: l0, style: styles[seed % styles.length], seed }) }];
  for (let i = 0; i < n1; i++) fighters.push({ team: 1, profile: { name: 'B' + i }, loadout: loadoutFor(seed + 11 + i), controller: new AIController({ level: l1, style: styles[(seed + 3 + i) % styles.length], seed: seed + 99 + i }) });
  const b = new Battle({ fighters, seed, timer: 99 });
  let ended = false;
  for (let i = 0; i < 99 * 60 + 2000; i++) {
    b.step({});
    for (const e of b.drainEvents()) if (e.type === 'matchEnd') ended = true;
    for (const f of b.fighters) {
      assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.aura) && Number.isFinite(f.energy), `NaN en ${f.name} estado ${f.state}`);
      assert.ok(f.x >= 0 && f.x <= 2000, 'fuera del escenario ' + f.x);
      assert.ok(f.y <= 600.01, 'bajo el suelo ' + f.y + ' ' + f.state);
    }
    if (ended) break;
  }
  return { b, ended };
}

test('hay ~90+ movimientos con datos completos', () => {
  const ids = Object.keys(MOVES).filter(k => MOVES[k].slot !== 'hidden');
  assert.ok(ids.length >= 90, 'movimientos: ' + ids.length);
  for (const id of ids) {
    const m = MOVES[id];
    assert.ok(m.name && m.anim && m.anim.length, 'sin anim ' + id);
    assert.ok(m.desc, 'sin descripción ' + id);
  }
});

test('combates IA vs IA terminan sin errores (todos los niveles)', () => {
  let wins = [0, 0];
  for (let s = 1; s <= 14; s++) {
    const { b, ended } = runBattle(s, s % 7, (s * 3) % 7);
    assert.ok(ended, 'combate sin terminar seed ' + s + ' fase ' + b.phase);
    wins[b.winnerTeam]++;
  }
  assert.ok(wins[0] + wins[1] === 14);
});

test('1v3 y supervivencia de IA', () => {
  for (let s = 20; s < 24; s++) {
    const { ended } = runBattle(s, 6, 2, 3);
    assert.ok(ended);
  }
});

test('la IA de nivel alto gana a la de nivel bajo', () => {
  let hi = 0;
  for (let s = 30; s < 40; s++) { const { b } = runBattle(s, 6, 0); if (b.winnerTeam === 0) hi++; }
  assert.ok(hi >= 8, 'Aura God ganó ' + hi + '/10 a NPC');
});

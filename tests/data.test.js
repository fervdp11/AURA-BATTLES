import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOTS, BOSSES, ALL_BOTS } from '../src/data/bots.js';
import { PATH } from '../src/data/path.js';
import { MOVES } from '../src/sim/moves.js';
import { RANKS, rankFor, matchRewards, MOVE_SHOP, STARTER_MOVES, ACHIEVEMENTS, TITLES, ACCESSORIES } from '../src/data/progression.js';
import { STYLES, LEVELS } from '../src/sim/AI.js';

test('más de 100 bots con identidad propia y loadouts válidos', () => {
  assert.ok(BOTS.length >= 100, 'bots: ' + BOTS.length);
  assert.equal(LEVELS.length, 7);
  const names = new Set();
  for (const b of ALL_BOTS) {
    assert.ok(!names.has(b.name), 'nombre repetido ' + b.name); names.add(b.name);
    assert.ok(b.quote && b.quote.length > 1, 'sin frase ' + b.name);
    assert.ok(STYLES[b.style], 'estilo inválido ' + b.style);
    assert.ok(ACCESSORIES.some(a => a.id === b.accessory), 'accesorio ' + b.accessory);
    const ids = Object.values(b.loadout);
    assert.equal(new Set(ids).size, 9, 'loadout repetido ' + b.name);
    for (const [slot, id] of Object.entries(b.loadout)) {
      assert.ok(MOVES[id], `movimiento inexistente ${id} en ${b.name}`);
      assert.equal(MOVES[id].slot === 'ult', slot === 'ult', `slot incorrecto ${id} en ${b.name}`);
      assert.equal(MOVES[id].slot === 'aura', slot.startsWith('hum'), `hueco de humillación incorrecto ${id} en ${b.name}`);
    }
  }
  for (let lv = 0; lv < 7; lv++) assert.ok(BOTS.filter(b => b.level === lv).length >= 10);
  assert.ok(BOSSES.length >= 8);
});

test('Camino del Aura: 8 capítulos con jefe final', () => {
  assert.equal(PATH.length, 8);
  for (const c of PATH) {
    assert.equal(c.stages.length, 5);
    assert.ok(c.stages[4].boss);
    for (const s of c.stages) for (const id of s.enemies) assert.ok(ALL_BOTS.find(b => b.id === id), 'bot ' + id);
  }
});

test('rangos y recompensas coherentes', () => {
  assert.equal(RANKS.map(r => r.name).join(','), 'Sin Aura,NPC,Aura Beginner,Aura Farmer,Sigma,Aura Master,Aura Legend,Aura God');
  assert.equal(rankFor(0).name, 'Sin Aura');
  assert.equal(rankFor(99999).name, 'Aura God');
  const easy = matchRewards({ win: true, level: 0, mode: 'quick' });
  const hard = matchRewards({ win: true, level: 6, mode: 'quick' });
  const triple = matchRewards({ win: true, level: 6, mode: 'quick', enemies: 3 });
  assert.ok(hard.rp > easy.rp && triple.rp > hard.rp);
  assert.ok(matchRewards({ win: false, level: 0, mode: 'quick' }).rp < 0);
  for (const id of [...Object.keys(MOVE_SHOP), ...STARTER_MOVES]) assert.ok(MOVES[id], 'tienda ' + id);
  const all = Object.values(MOVES).filter(m => m.slot === 'special' || m.slot === 'ult').map(m => m.id);
  for (const id of all) assert.ok(MOVE_SHOP[id] || STARTER_MOVES.includes(id), 'no se puede conseguir ' + id);
  assert.ok(ACHIEVEMENTS.length >= 25 && TITLES.length >= 10);
});

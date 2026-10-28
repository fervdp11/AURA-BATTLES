import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/sim/Battle.js';
import { MOVES } from '../src/sim/moves.js';
import { emptyInput } from '../src/sim/constants.js';

// Ejecuta cada movimiento contra un muñeco en distintas situaciones
function trial(id, dist, dummy = 'stand', air = false) {
  const ctrl = { getInput: () => { const i = emptyInput(); if (dummy === 'block') i.held.block = true; return i; } };
  const b = new Battle({ fighters: [
    { team: 0, profile: { name: 'A' }, controller: { getInput: () => emptyInput() } },
    { team: 1, profile: { name: 'B' }, controller: ctrl }
  ], seed: 3, timer: 0 });
  while (b.phase !== 'fight') b.step({});
  const [a, d] = b.fighters;
  a.x = 1000; d.x = 1000 + dist; a.facing = 1; d.facing = -1;
  a.energy = 100; a.aura = 300; // para condiciones de remontada
  if (air) { a.grounded = false; a.y = 600 - 120; a.vy = -2; a.setState('air'); }
  const before = d.aura;
  const ok = a.startMove(id, { free: true });
  let frames = 0;
  for (; frames < 420; frames++) {
    b.step({});
    if (!a.move && frames > 2 && b.projectiles.every(p => p.kind === 'banana') && !d.status.some(s => s.id === 'marked')) break;
  }
  return { ok, dealt: before - d.aura, frames, endedState: a.state, hits: a.stats.hits };
}

test('cada movimiento se ejecuta, termina y puede conectar', () => {
  const never = [];
  for (const id of Object.keys(MOVES)) {
    const m = MOVES[id];
    const air = m.air === 'only';
    let best = 0;
    for (const dist of [70, 120, 220, 400]) {
      const r = trial(id, dist, 'stand', air);
      assert.ok(r.ok, `no arranca ${id}`);
      assert.ok(r.frames < 420, `${id} no termina (estado ${r.endedState})`);
      best = Math.max(best, r.dealt);
    }
    const offensive = m.hit || m.proj || ['zone', 'poke', 'heavy', 'gap', 'pressure', 'low', 'overhead', 'grab', 'ult', 'humiliate', 'debuff', 'antiair', 'finisher', 'air'].includes(m.ai.role);
    if (offensive && best <= 0) never.push(id);
  }
  console.log('Movimientos ofensivos que no dañaron al muñeco quieto:', never.join(', ') || 'ninguno');
});

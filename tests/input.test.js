import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input, DEFAULT_PROFILES, ACTIONS } from '../src/core/Input.js';
import { Battle } from '../src/sim/Battle.js';
import { emptyInput } from '../src/sim/constants.js';

test('los perfiles J1 y J2 por defecto no comparten teclas (salvo la pausa)', () => {
  const used = new Map();
  for (const p of ['p1', 'p2']) for (const a of ACTIONS) for (const c of DEFAULT_PROFILES[p][a]) {
    if (a === 'pause') continue;
    assert.ok(!used.has(c), `tecla ${c} repetida: ${used.get(c)} y ${p}.${a}`);
    used.set(c, `${p}.${a}`);
  }
});

test('reasignar una tecla ocupada la intercambia y nunca deja conflictos', () => {
  for (const p of ['solo', 'p1', 'p2']) Input.resetProfile(p);
  // J1 quiere la J (ataque rápido de J2)
  const cs = Input.assign('p1', 'light', 'KeyJ');
  assert.equal(cs.length, 1);
  assert.deepEqual(cs[0], { prof: 'p2', action: 'light' });
  assert.equal(Input.codesFor('light', 'p1')[0], 'KeyJ');
  assert.ok(!Input.codesFor('light', 'p2').includes('KeyJ'));
  // dentro del mismo perfil: intercambio con la acción que la tenía
  const cs2 = Input.assign('solo', 'light', 'KeyX');
  assert.deepEqual(cs2[0], { prof: 'solo', action: 'heavy' });
  assert.deepEqual(Input.codesFor('heavy', 'solo'), ['KeyZ']);
  for (const p of ['solo', 'p1', 'p2']) Input.resetProfile(p);
  assert.deepEqual(Input.codesFor('light', 'p1'), ['KeyF']);
});

test('multijugador local: los dos humanos actúan a la vez con sus entradas', () => {
  const b = new Battle({ fighters: [{ team: 0, profile: { name: 'J1' }, human: true, ctrlProfile: 'p1' }, { team: 1, profile: { name: 'J2' }, human: true, ctrlProfile: 'p2' }], versus: true, timer: 99, roundsToWin: 2, seed: 1 });
  while (b.phase !== 'fight') b.step({});
  const [A, B] = b.fighters;
  const x0 = [A.x, B.x];
  for (let i = 0; i < 30; i++) { const a = emptyInput(); a.r = true; const c = emptyInput(); c.l = true; b.step({ [A.id]: a, [B.id]: c }); }
  assert.ok(A.x > x0[0] + 40 && B.x < x0[1] - 40, 'ambos avanzan a la vez');
  const a = emptyInput(); a.pressed.light = true; a.held.light = true;
  const c = emptyInput(); c.pressed.light = true; c.held.light = true;
  b.step({ [A.id]: a, [B.id]: c });
  assert.equal(A.state, 'attack'); assert.equal(B.state, 'attack');
  assert.equal(A.facing, 1); assert.equal(B.facing, -1);
});

test('los señuelos no pasan a la siguiente ronda', () => {
  const b = new Battle({ fighters: [{ team: 0, profile: { name: 'A' }, controller: { getInput: () => emptyInput() } }, { team: 1, profile: { name: 'B' }, controller: { getInput: () => emptyInput() } }], timer: 99, roundsToWin: 2, seed: 2 });
  while (b.phase !== 'fight') b.step({});
  const [A] = b.fighters;
  A.startMove('delulu', { free: true });
  for (let i = 0; i < 20; i++) b.step({});
  b.dealDamage(A, b.fighters[1], 99999);
  for (let i = 0; i < 400 && b.round === 1; i++) b.step({});
  assert.equal(b.round, 2);
  for (const f of b.fighters) assert.ok(Number.isFinite(f.x) && !f.decoyOf);
});

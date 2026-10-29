// La red con rollback exige que el estado se pueda copiar/restaurar y que la simulación sea determinista.
import test from 'node:test';
import assert from 'node:assert';
import { Battle } from '../src/sim/Battle.js';
import { emptyInput } from '../src/sim/constants.js';
import { BOTS } from '../src/data/bots.js';
import { cloneState, restoreInto, stateHash } from '../src/net/state.js';
import { encodeInput, decodeInput } from '../src/net/protocol.js';

function rngF(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const KEYS = ['light', 'heavy', 'special', 'skill1', 'skill2', 'ult', 'dash', 'block', 'taunt'];
function randInput(r) {
  const i = emptyInput();
  i.l = r() < 0.3; i.r = !i.l && r() < 0.4; i.u = r() < 0.04; i.d = r() < 0.12; i.pu = i.u; i.pd = i.d && r() < 0.3;
  for (const k of KEYS) { i.held[k] = r() < (k === 'block' ? 0.15 : 0.05); i.pressed[k] = i.held[k] && r() < 0.6; }
  return i;
}
export function makeBattle(seed, ai, bi) {
  const A = BOTS[ai % BOTS.length], B = BOTS[bi % BOTS.length];
  return new Battle({ fighters: [
    { team: 0, profile: { name: A.name, color: A.color }, loadout: { ...A.loadout }, human: true, ctrlProfile: 'p1', finisher: 'kickSpace' },
    { team: 1, profile: { name: B.name, color: B.color }, loadout: { ...B.loadout }, human: true, ctrlProfile: 'p2', finisher: 'pantsDown' }
  ], mode: 'versus', versus: true, timer: 99, roundsToWin: 2, seed });
}

test('copiar y restaurar el estado no altera la simulación (determinismo para rollback)', () => {
  let checked = 0;
  for (let g = 0; g < 12; g++) {
    const r = rngF(1000 + g);
    const b1 = makeBattle(77 + g, g * 7, g * 13 + 3);
    const other = makeBattle(5, g + 1, g + 2); // objeto distinto donde restaurar
    const inputs = [];
    for (let t = 0; t < 2400; t++) inputs.push([randInput(r), randInput(r)]);
    const step = (b, t) => { const [a, c] = inputs[t]; b.step({ [b.fighters[0].id]: decodeInput(encodeInput(a)), [b.fighters[1].id]: decodeInput(encodeInput(c)) }); b.drainEvents(); };
    let b2 = null, b3 = null;
    const T = 200 + Math.floor(r() * 1200);
    for (let t = 0; t < 2400; t++) {
      if (t === T) { b2 = cloneState(b1); for (let k = 0; k < 30; k++) step(other, k); b3 = restoreInto(other, b1); }
      step(b1, t);
      if (b2) { step(b2, t); step(b3, t); const h = stateHash(b1); assert.equal(stateHash(b2), h, `clon divergente en partida ${g}, tick ${t}`); assert.equal(stateHash(b3), h, `restauración divergente en partida ${g}, tick ${t}`); checked++; }
      if (b1.phase === 'over') break;
    }
  }
  assert.ok(checked > 5000, 'ticks comparados: ' + checked);
});

test('codificación compacta de entradas sin pérdidas', () => {
  const r = rngF(9);
  for (let n = 0; n < 2000; n++) { const i = randInput(r); assert.deepEqual(decodeInput(encodeInput(i)), i); }
});

test('cada técnica especial/ultimate es restaurable a mitad de ejecución', async () => {
  const { SPECIAL_IDS, ULT_IDS, AURA_IDS } = await import('../src/sim/moves.js');
  const bad = [];
  const setup = (id, dist = 90) => {
    const b = makeBattle(3, 1, 2);
    while (b.phase !== 'fight') { b.step({}); b.drainEvents(); }
    const [A, B] = b.fighters;
    A.x = 600; B.x = 600 + dist; A.energy = B.energy = 100; A.aura = B.aura = 1000;
    const slot = ULT_IDS.includes(id) ? 'ult' : AURA_IDS.includes(id) ? 'hum1' : 'special';
    A.loadout = { ...A.loadout, [slot]: id };
    if (AURA_IDS.includes(id)) { A.lastDodge = A.lastParry = b.frame; B.lastWhiff = b.frame; B.lastWhiffHeavy = true; }
    return { b, slot };
  };
  // distancia a la que la técnica conecta (las llaves solo se prueban de verdad si agarran)
  const distFor = id => {
    for (const dist of [90, 60, 150, 260, 420]) {
      const { b, slot } = setup(id, dist);
      for (let t = 0; t < 160; t++) { const ia = emptyInput(); if (t === 0) { const k = slot === 'hum1' ? 'taunt' : slot; ia.pressed[k] = ia.held[k] = true; } b.step({ [b.fighters[0].id]: ia }); b.drainEvents(); if (b.fighters[0].move && b.fighters[0].move.lock) return dist; }
    }
    return 90;
  };
  let locks = 0;
  for (const id of [...SPECIAL_IDS, ...ULT_IDS, ...AURA_IDS]) {
    const dist = distFor(id);
    for (const off of [3, 9, 18, 30, 55, 90]) {
      const r = rngF(id.length * 31 + off);
      const plan = []; // entradas verdaderas
      for (let t = 0; t < 260; t++) plan.push([t > 120 ? randInput(r) : emptyInput(), t > 60 ? randInput(r) : emptyInput()]);
      const go = (b, slot, t, ia, ib) => { if (t === 0) { ia = emptyInput(); const k = slot === 'hum1' ? 'taunt' : slot; ia.pressed[k] = ia.held[k] = true; } b.step({ [b.fighters[0].id]: ia, [b.fighters[1].id]: ib }); b.drainEvents(); };
      const { b: b1, slot } = setup(id, dist), { b: ref } = setup(id, dist);
      const noise = rngF(999);
      let clone = null;
      for (let t = 0; t < 260; t++) {
        if (t === off) { clone = cloneState(b1); if (b1.fighters[0].move && b1.fighters[0].move.lock) locks++; }
        // tras clonar, el original sigue con entradas DISTINTAS: un cierre que lea el original se delataría
        if (clone) go(b1, slot, t, randInput(noise), randInput(noise)); else go(b1, slot, t, ...plan[t]);
        go(ref, slot, t, ...plan[t]);
        if (clone) { go(clone, slot, t, ...plan[t]); if (stateHash(clone) !== stateHash(ref)) { bad.push(`${id}@${off}→t${t}`); break; } }
      }
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(locks >= 12, 'clonados a mitad de llave: ' + locks);
});

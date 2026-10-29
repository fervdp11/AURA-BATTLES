// Pruebas del online REAL: servidor autoritativo + dos clientes independientes por WebSocket, con red
// simulada (latencia, jitter, pérdida), reconexión en mitad del combate y abandono.
import test from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import { startServer } from '../server/server.js';
import { NetClient } from '../src/net/NetClient.js';
import { ClientSession } from '../src/net/ClientSession.js';
import { emptyInput } from '../src/sim/constants.js';
import { stateHash } from '../src/net/state.js';

process.env.QUIET = '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 15000, what = '') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('tiempo agotado: ' + what); await sleep(10); } };

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// jugador agresivo: se acerca y ataca (para que haya golpes, combos y K.O.)
function brawler(seed, session) {
  const r = rng(seed);
  return () => {
    const i = emptyInput(), b = session.render, me = b.fighters[session.you], op = b.fighters[session.other];
    const dir = Math.sign(op.x - me.x);
    if (Math.abs(op.x - me.x) > 90) { if (dir > 0) i.r = true; else i.l = true; }
    for (const k of ['light', 'heavy', 'special', 'skill1', 'ult', 'taunt']) if (r() < (k === 'light' ? 0.25 : 0.04)) { i.pressed[k] = true; i.held[k] = true; }
    if (r() < 0.05) { i.held.block = true; i.pressed.block = r() < 0.3; }
    if (r() < 0.02) { i.u = i.pu = true; }
    return i;
  };
}

async function player(url, name, netsim) {
  const net = new NetClient({ url, name, WS: WebSocket, netsim });
  const p = { net, name, msgs: [], session: null, ended: null };
  net.on('*', m => p.msgs.push(m));
  net.on('room', m => { p.room = m; });
  net.on('start', m => { p.session = new ClientSession({ cfg: m.cfg, you: m.you, net }); p.matchId = m.matchId; });
  net.on('f', m => p.session && p.session.onFinals(m));
  net.on('r', m => p.session && p.session.onRelay(m));
  net.on('pong', m => p.session && p.session.onPong(m));
  net.on('resume', m => { if (!p.session || p.session.cfg.seed !== m.cfg.seed) p.session = new ClientSession({ cfg: m.cfg, you: m.you, net, finals: m.finals, st: m.st }); else p.session.resync(m); p.resumed = (p.resumed || 0) + 1; });
  net.on('pause', () => { if (p.session) p.session.paused = true; p.pauses = (p.pauses || 0) + 1; });
  net.on('unpause', m => { setTimeout(() => { if (p.session) { p.session.paused = false; p.session.serverTick = m.st; p.session.serverAt = performance.now(); } }, m.inMs); });
  net.on('end', m => { p.ended = m; });
  net.connect();
  await until(() => net.token, 5000, 'welcome ' + name);
  return p;
}
function drive(players, seedBase) {
  let last = performance.now();
  const t = setInterval(() => {
    const now = performance.now(), d = now - last; last = now;
    for (const [k, p] of players.entries()) if (p.session && !p.ended) {
      if (!p.input) p.input = brawler(seedBase + k, p.session);
      p.session.frame(d, p.input);
    }
  }, 16);
  return () => clearInterval(t);
}
async function setupMatch(srv, simA, simB) {
  const url = `ws://127.0.0.1:${srv.port}/ws`;
  const A = await player(url, 'Ana', simA), B = await player(url, 'Beto', simB);
  A.net.send({ type: 'create' });
  await until(() => A.room && A.room.code, 5000, 'sala');
  B.net.send({ type: 'join', code: A.room.code });
  await until(() => B.room && B.room.code === A.room.code, 5000, 'unirse');
  for (const [p, lo] of [[A, { special: 'sixSeven', ult: 'sixSevenBarrage' }], [B, { special: 'fakeHandshake', ult: 'rizzStorm' }]]) {
    p.net.send({ type: 'choose', profile: { name: p.name, color: '#ff0000', scale: 9 /* el servidor lo ignora */ }, loadout: lo, finisher: 'kickSpace' });
    p.net.send({ type: 'ready', ready: true });
  }
  await until(() => A.session && B.session, 8000, 'inicio');
  return [A, B];
}
function compareHashes(A, B) {
  if (process.env.NETDEBUG) console.log('STATS', JSON.stringify({ A: A.session.stats, B: B.session.stats, C: [A.session.C, B.session.C], rtt: [Math.round(A.net.rtt), Math.round(B.net.rtt)], winner: A.ended && A.ended.result }));
  let same = 0;
  for (const [t, h] of A.session.myHashes) if (B.session.myHashes.has(t)) { assert.equal(B.session.myHashes.get(t), h, 'desincronía en el tick ' + t); same++; }
  return same;
}

test('online: dos clientes, partida completa sincronizada y resultado del servidor', { timeout: 90000 }, async () => {
  const srv = await startServer({ port: 0, countdownMs: 300, timer: 25, rounds: 1 });
  try {
    const [A, B] = await setupMatch(srv);
    // el servidor ignora la escala enviada por el cliente (afecta a las hitboxes)
    assert.equal(A.session.cfg.players[0].profile.scale, 1);
    const stop = drive([A, B], 10);
    await until(() => A.ended && B.ended, 70000, 'fin de partida');
    stop();
    assert.equal(A.ended.matchId, B.ended.matchId);
    assert.equal(A.ended.result.winner, B.ended.result.winner);
    assert.ok(A.ended.rewards[0].ap >= 0 && A.ended.rewards[1].ap >= 0, 'recompensas calculadas por el servidor');
    const same = compareHashes(A, B);
    assert.ok(same > 10, 'puntos comparados: ' + same);
    assert.equal(A.session.stats.desyncs + B.session.stats.desyncs, 0);
    // la predicción converge a lo confirmado
    assert.ok(A.session.C > 600);
    A.net.close(); B.net.close();
  } finally { await srv.close(); }
});

test('online: latencia 120 ms, jitter 40 ms y 8% de pérdida sin desincronía', { timeout: 90000 }, async () => {
  const srv = await startServer({ port: 0, countdownMs: 300, timer: 20, rounds: 1 });
  try {
    const sim = { lat: 120, jitter: 40, loss: 8 };
    const [A, B] = await setupMatch(srv, sim, { lat: 90, jitter: 25, loss: 8 });
    const stop = drive([A, B], 20);
    await until(() => A.ended && B.ended, 70000, 'fin con mala red');
    stop();
    assert.equal(A.ended.result.winner, B.ended.result.winner);
    assert.ok(compareHashes(A, B) > 8);
    assert.equal(A.session.stats.desyncs + B.session.stats.desyncs, 0, 'sin desincronías');
    assert.ok(A.session.stats.rollbacks > 0 && B.session.stats.rollbacks > 0, 'hubo reconciliación');
    A.net.close(); B.net.close();
  } finally { await srv.close(); }
});

test('online: reconexión temporal en mitad del combate', { timeout: 90000 }, async () => {
  const srv = await startServer({ port: 0, countdownMs: 300, timer: 22, rounds: 1, reconnectMs: 8000 });
  try {
    const [A, B] = await setupMatch(srv);
    const stop = drive([A, B], 30);
    await until(() => A.session.C > 300, 20000, 'mitad');
    const before = B.session.C;
    B.net.dropConnection(); // corte de red: el cliente se reconecta solo con su token
    await until(() => A.pauses > 0, 5000, 'pausa por desconexión');
    await until(() => B.resumed > 0, 10000, 'reanudación');
    assert.ok(B.session.C >= before, 'B recupera todo el historial confirmado');
    await until(() => A.ended && B.ended, 70000, 'fin tras reconexión');
    stop();
    assert.equal(A.ended.result.reason, 'ko');
    assert.ok(compareHashes(A, B) > 5);
    assert.equal(A.session.stats.desyncs + B.session.stats.desyncs, 0);
    A.net.close(); B.net.close();
  } finally { await srv.close(); }
});

test('online: abandono (no vuelve) da la victoria al rival', { timeout: 60000 }, async () => {
  const srv = await startServer({ port: 0, countdownMs: 300, timer: 60, rounds: 1, reconnectMs: 2000 });
  try {
    const [A, B] = await setupMatch(srv);
    const stop = drive([A, B], 40);
    await until(() => A.session.C > 120, 20000, 'arranque');
    B.net.close(); // se va de verdad
    await until(() => A.ended, 15000, 'fin por abandono');
    stop();
    assert.equal(A.ended.result.reason, 'abandon');
    assert.equal(A.ended.result.winner, A.session.you);
    A.net.close();
  } finally { await srv.close(); }
});

test('online: el servidor rechaza entradas imposibles (futuro lejano, bits inválidos, tardías)', { timeout: 30000 }, async () => {
  const srv = await startServer({ port: 0, countdownMs: 200, timer: 30, rounds: 1 });
  try {
    const [A, B] = await setupMatch(srv);
    const stop = drive([A, B], 50);
    await until(() => A.session.C > 60, 10000, 'arranque');
    A.net.send({ type: 'in', s: 1, i: [[A.session.L + 5000, 1], [A.session.L + 1, -5], [0, 1 << 30], [1, 2]] });
    await sleep(300);
    stop();
    const room = srv.rooms.get(A.room.code);
    assert.ok(room.match.rejected[A.session.you] >= 3, 'rechazadas: ' + room.match.rejected);
    assert.ok(Number.isInteger(stateHash(A.session.confirmed)));
    A.net.close(); B.net.close();
  } finally { await srv.close(); }
});

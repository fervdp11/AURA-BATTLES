// Servidor online autoritativo de AURA LEGENDS (Node + WebSocket).
// - Salas con código, elección de personaje, listo, inicio sincronizado y revancha.
// - Simula la MISMA partida que los clientes a 60 Hz fijos con sus entradas (tick + secuencia).
// - Compensación de lag: una entrada que llega tarde (≤ LAG_WINDOW ticks) se aplica en su tick real
//   rebobinando con el historial de estados y resimulando; si llega más tarde, se rechaza. Las entradas
//   del futuro lejano también se rechazan. Los golpes, el daño y el aura los calcula solo el servidor.
// - Confirma a ambos clientes las entradas definitivas (con hash de estado para detectar desincronías),
//   reenvía al rival las entradas provisionales para mejorar la predicción.
// - Desconexión: pausa y espera reconexión (token) hasta RECONNECT_MS; si no vuelve, pierde por abandono.
// - Resultado y recompensas calculados aquí; el cliente nunca envía valores de economía.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { PROTOCOL, TICK_MS, LAG_WINDOW, MAX_AHEAD, VALID_BITS, predictInput, decodeInput } from '../src/net/protocol.js';
import { buildOnlineBattle, sanitizeProfile, sanitizeLoadout, sanitizeFinisher, sanitizeName } from '../src/net/match.js';
import { cloneState, restoreInto, stateHash } from '../src/net/state.js';
import { matchRewards, finalAura } from '../src/data/progression.js';
import { ARENAS } from '../src/view/Arena.js';

let RECONNECT_MS = 20000;
let COUNTDOWN_MS = 3000;
let MATCH_TIMER = 99, MATCH_ROUNDS = 2;
const HASH_EVERY = 30;
const MAX_MSG_BYTES = 8192;
const MAX_MSGS_PER_SEC = 150;
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const log = (...a) => { if (process.env.QUIET !== '1') console.log(new Date().toISOString().slice(11, 19), ...a); };
const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };

// ------------------------------------------------------------------ partida autoritativa
class ServerMatch {
  constructor(room, cfg) {
    this.room = room; this.cfg = cfg;
    this.battle = buildOnlineBattle(cfg);
    this.tick = 0;                 // siguiente tick a simular
    this.inputs = [new Map(), new Map()]; // entradas recibidas por tick
    this.used = [[], []];          // entrada usada en cada tick (real o prevista)
    this.lastReal = [0, 0];        // último tick con entrada real de cada jugador
    this.finals = [];              // entradas definitivas [b0, b1] por tick
    this.hist = new Map();         // tick -> estado ANTES de simular ese tick (historial para rebobinar)
    this.dirtyFrom = Infinity;
    this.rejected = [0, 0];
    this.endTick = -1; this.ended = false;
    this.rollbacks = 0;
  }
  // entradas de un cliente: [[tick, bits], ...] (redundantes)
  receive(pi, list) {
    let fresh = [];
    for (const it of list) {
      if (!Array.isArray(it) || it.length !== 2) continue;
      const [t, bits] = it;
      if (!Number.isInteger(t) || !Number.isInteger(bits) || t < 0 || (bits & ~VALID_BITS)) { this.rejected[pi]++; continue; }
      if (this.inputs[pi].has(t)) continue; // duplicado (redundancia)
      if (t > this.tick + MAX_AHEAD) { this.rejected[pi]++; continue; } // del futuro: reloj trucado
      if (t < this.finals.length) { this.rejected[pi]++; continue; }   // demasiado tarde: ya es definitivo
      this.inputs[pi].set(t, bits);
      if (t > this.lastReal[pi]) this.lastReal[pi] = t;
      // ya simulado con una entrada prevista distinta: rebobinar a ese tick (compensación de lag)
      if (t < this.tick && this.used[pi][t] !== bits) this.dirtyFrom = Math.min(this.dirtyFrom, t);
      fresh.push(it);
    }
    return fresh;
  }
  inputFor(pi, t) {
    if (this.inputs[pi].has(t)) return this.inputs[pi].get(t);
    // sin entrada aún: se repite lo mantenido (sin pulsaciones nuevas)
    let k = t - 1; while (k >= 0 && !this.inputs[pi].has(k) && k > t - 600) k--;
    return k >= 0 && this.inputs[pi].has(k) ? predictInput(this.inputs[pi].get(k)) : 0;
  }
  simulate(t) {
    const b = this.battle;
    this.hist.set(t, cloneState(b));
    const i0 = this.inputFor(0, t), i1 = this.inputFor(1, t);
    this.used[0][t] = i0; this.used[1][t] = i1;
    b.step({ [b.fighters[0].id]: decodeBits(i0), [b.fighters[1].id]: decodeBits(i1) });
    for (const e of b.drainEvents()) if (e.type === 'matchEnd' && this.endTick < 0) { this.endTick = t; this.endResult = e.result; }
  }
  advance() {
    // rebobinado por entradas tardías
    if (this.dirtyFrom < this.tick) {
      const from = this.dirtyFrom;
      restoreInto(this.battle, this.hist.get(from));
      if (this.endTick >= from) { this.endTick = -1; this.endResult = null; }
      for (let t = from; t < this.tick; t++) this.simulate(t);
      this.rollbacks++;
    }
    this.dirtyFrom = Infinity;
    this.simulate(this.tick);
    this.tick++;
    // ticks que ya no pueden cambiar: definitivos
    const out = [];
    let hash = null;
    while (this.finals.length < this.tick - LAG_WINDOW) {
      const t = this.finals.length;
      const pair = [this.used[0][t], this.used[1][t]];
      this.finals.push(pair); out.push(pair);
      if (t % HASH_EVERY === 0) hash = [t, stateHash(this.hist.get(t))];
      this.hist.delete(t - 2);
      this.inputs[0].delete(t - 2); this.inputs[1].delete(t - 2);
    }
    if (this.endTick >= 0 && this.finals.length > this.endTick && !this.ended) this.ended = true;
    return { out, hash };
  }
  result() {
    const b = this.battle, r = this.endResult || {};
    const winner = r.winnerTeam ?? b.winnerTeam;
    return { winner, rounds: r.rounds || b.wins, reason: 'ko' };
  }
}
const decodeBits = decodeInput;

// ------------------------------------------------------------------ salas
const rooms = new Map();
const clients = new Map(); // token -> client
function newCode() { let c; do { c = Array.from({ length: 5 }, () => CODE_ABC[crypto.randomInt(CODE_ABC.length)]).join(''); } while (rooms.has(c)); return c; }

class Room {
  constructor(code) { this.code = code; this.players = [null, null]; this.state = 'lobby'; this.match = null; this.matchNo = 0; this.rematch = [false, false]; this.score = [0, 0]; this.pausedAt = 0; this.created = Date.now(); }
  index(c) { return this.players.indexOf(c); }
  broadcast(msg) { for (const p of this.players) if (p) send(p.ws, msg); }
  summary() {
    return { type: 'room', code: this.code, state: this.state, score: this.score,
      players: this.players.map(p => p && { name: p.name, ready: p.ready, connected: !!(p.ws && p.ws.readyState === 1), character: p.choice ? p.choice.profile.name : null, rtt: Math.round(p.rtt || 0) }) };
  }
  sendRoom() { for (let i = 0; i < 2; i++) { const p = this.players[i]; if (p) send(p.ws, { ...this.summary(), you: i }); } }
  tryStart() {
    if (this.state !== 'lobby' || !this.players.every(p => p && p.ready && p.choice && p.ws && p.ws.readyState === 1)) return;
    const seed = crypto.randomInt(1, 2 ** 31);
    const arenas = ARENAS;
    const cfg = {
      seed, timer: MATCH_TIMER, rounds: MATCH_ROUNDS, arena: arenas[seed % arenas.length].id,
      players: this.players.map(p => ({ profile: p.choice.profile, loadout: p.choice.loadout, finisher: p.choice.finisher }))
    };
    this.matchNo++;
    const matchId = this.code + '-' + this.matchNo + '-' + seed.toString(36);
    this.match = new ServerMatch(this, cfg);
    this.match.id = matchId;
    this.state = 'countdown';
    this.rematch = [false, false];
    const startAt = Date.now() + COUNTDOWN_MS;
    this.match.startAt = startAt;
    for (let i = 0; i < 2; i++) send(this.players[i].ws, { type: 'start', matchId, cfg, you: i, countdownMs: COUNTDOWN_MS });
    log(`sala ${this.code}: partida ${matchId} (${cfg.players.map(p => p.profile.name).join(' vs ')})`);
  }
  endMatch(result, reason) {
    const m = this.match; if (!m || this.state === 'ended') return;
    this.state = 'ended';
    const b = m.battle;
    const rewards = [0, 1].map(i => {
      const f = b.fighters[i], o = b.fighters[1 - i];
      const win = result.winner === i;
      const st = f.stats;
      const rw = matchRewards({ win, level: 4, mode: 'online', enemies: 1, perfect: win && (o.stats.dmg || 0) >= 0 && (st.taken || 0) <= 0, maxCombo: st.maxCombo || 0, humiliations: st.humiliations || 0 });
      const fa = finalAura({ stats: st, opp: o.stats, win, perfect: win && (st.taken || 0) <= 0, shutout: !win && (st.dmg || 0) <= 0, level: 4, finisher: !!st.finisher });
      return { ...rw, final: { value: Number.isFinite(fa.value) ? fa.value : (fa.value > 0 ? 'inf' : '-inf'), label: fa.label, color: fa.color } };
    });
    if (result.winner === 0 || result.winner === 1) this.score[result.winner]++;
    const stats = b.fighters.map(f => ({ ...f.stats }));
    this.broadcast({ type: 'end', matchId: m.id, result: { ...result, reason }, rewards, stats, names: b.fighters.map(f => f.name), score: this.score });
    log(`sala ${this.code}: fin ${m.id} gana J${result.winner + 1} (${reason}); rollbacks ${m.rollbacks}, rechazadas ${m.rejected.join('/')}`);
    for (const p of this.players) if (p) p.ready = false;
  }
}

// bucle de ticks fijo (sin deriva): se calculan los ticks pendientes según el reloj de alta resolución
function loop() {
  const now = Date.now();
  for (const room of rooms.values()) {
    const m = room.match;
    if (!m) continue;
    if (room.state === 'countdown' && now >= m.startAt) { room.state = 'playing'; m.t0 = performance.now(); m.ticked = 0; }
    if (room.state === 'paused') {
      const who = room.players.findIndex(p => p && (!p.ws || p.ws.readyState !== 1));
      if (who >= 0 && now - room.pausedAt > RECONNECT_MS) room.endMatch({ winner: 1 - who, rounds: m.battle.wins }, 'abandon');
      continue;
    }
    if (room.state !== 'playing') continue;
    const due = Math.floor((performance.now() - m.t0) / TICK_MS);
    let n = 0;
    while (m.ticked < due && n++ < 8) {
      const { out, hash } = m.advance();
      m.ticked++;
      if (out.length) {
        const from = m.finals.length - out.length;
        room.broadcast({ type: 'f', from, n: out, st: m.tick, h: hash });
      }
      if (m.ended) { room.endMatch(m.result(), 'ko'); break; }
    }
    if (m.ticked < due - 30) m.t0 = performance.now() - m.ticked * TICK_MS; // servidor saturado: no acumular deuda
  }
  for (const [code, room] of rooms) if (room.players.every(p => !p) || (Date.now() - room.created > 6 * 3600e3)) rooms.delete(code);
}

function attach(room, c, idx) {
  room.players[idx] = c; c.room = room; c.ready = false;
}
function leave(c, explicit) {
  const room = c.room; if (!room) return;
  const i = room.index(c);
  if (room.state === 'playing' || room.state === 'countdown' || room.state === 'paused') {
    if (explicit) { room.endMatch({ winner: 1 - i, rounds: room.match.battle.wins }, 'abandon'); }
    else {
      // desconexión: se pausa y se espera la reconexión
      if (room.state !== 'paused') { room.prevState = room.state; room.state = 'paused'; room.pausedAt = Date.now(); room.pauseTick = room.match.tick; }
      room.broadcast({ type: 'pause', who: i, timeout: RECONNECT_MS, reason: 'disconnect' });
      return;
    }
  }
  if (explicit || room.state === 'lobby' || room.state === 'ended') {
    room.players[i] = null; c.room = null;
    room.state = room.state === 'ended' ? 'lobby' : room.state;
    room.sendRoom();
    room.broadcast({ type: 'left', who: i });
  }
}

function onMessage(c, msg) {
  const room = c.room;
  switch (msg.type) {
    case 'create': {
      if (room) leave(c, true);
      const r = new Room(newCode()); rooms.set(r.code, r); attach(r, c, 0); r.sendRoom();
      log(`sala ${r.code} creada por ${c.name}`);
      break;
    }
    case 'join': {
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const r = rooms.get(code);
      if (!r) return send(c.ws, { type: 'error', code: 'noroom', msg: 'No existe ninguna sala con ese código.' });
      const free = r.players.indexOf(null);
      if (free < 0 || r.state !== 'lobby') return send(c.ws, { type: 'error', code: 'full', msg: 'La sala está llena o en partida.' });
      if (room) leave(c, true);
      attach(r, c, free); r.sendRoom();
      break;
    }
    case 'choose': {
      if (!room || room.state !== 'lobby') return;
      c.choice = { profile: sanitizeProfile(msg.profile), loadout: sanitizeLoadout(msg.loadout), finisher: sanitizeFinisher(msg.finisher) };
      c.ready = false; room.sendRoom();
      break;
    }
    case 'ready': {
      if (!room || room.state !== 'lobby' || !c.choice) return;
      c.ready = !!msg.ready; room.sendRoom(); room.tryStart();
      break;
    }
    case 'in': {
      if (!room || !room.match || !Array.isArray(msg.i) || msg.i.length > 64) return;
      const i = room.index(c);
      if (room.state !== 'playing' && room.state !== 'countdown') return;
      const fresh = room.match.receive(i, msg.i);
      // reenvío provisional al rival (mejor predicción); lo definitivo llega en los mensajes 'f'
      if (fresh.length) send(room.players[1 - i] && room.players[1 - i].ws, { type: 'r', p: i, i: fresh });
      break;
    }
    case 'ping': send(c.ws, { type: 'pong', t: msg.t, st: room && room.match ? room.match.tick : 0, srv: Date.now() }); if (typeof msg.rtt === 'number') c.rtt = msg.rtt; break;
    case 'rematch': {
      if (!room || room.state !== 'ended') return;
      const i = room.index(c); room.rematch[i] = true;
      room.broadcast({ type: 'rematch', votes: room.rematch });
      if (room.rematch.every(Boolean)) { room.state = 'lobby'; for (const p of room.players) if (p) p.ready = true; room.tryStart(); }
      break;
    }
    case 'lobby': {
      if (!room || room.state !== 'ended') return;
      room.state = 'lobby'; for (const p of room.players) if (p) p.ready = false; room.sendRoom();
      break;
    }
    case 'resync': {
      if (!room || !room.match) return;
      send(c.ws, { type: 'resume', matchId: room.match.id, cfg: room.match.cfg, you: room.index(c), finals: room.match.finals, st: room.match.tick, state: room.state });
      break;
    }
    case 'need': {
      // el cliente perdió confirmaciones (pérdida de paquetes simulada o real): reenvío desde ese tick
      if (!room || !room.match) return;
      const from = Math.max(0, Math.min(room.match.finals.length, msg.from | 0));
      const n = room.match.finals.slice(from, from + 900);
      if (n.length) send(c.ws, { type: 'f', from, n, st: room.match.tick, h: null });
      break;
    }
    case 'leave': leave(c, true); break;
  }
}

// ------------------------------------------------------------------ HTTP + WebSocket
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

export function startServer({ port = Number(process.env.PORT) || 8080, host = '0.0.0.0', reconnectMs, countdownMs, timer, rounds } = {}) {
  if (reconnectMs) RECONNECT_MS = reconnectMs; if (countdownMs) COUNTDOWN_MS = countdownMs; if (timer) MATCH_TIMER = timer; if (rounds) MATCH_ROUNDS = rounds;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify({ ok: true, protocol: PROTOCOL, rooms: rooms.size, clients: clients.size })); return; }
    // sirve el juego compilado (dist/) para desplegar cliente y servidor juntos
    let p = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
    if (!p.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, 'index.html');
    if (!fs.existsSync(p)) { res.writeHead(404); res.end('Compila el cliente con "npm run build" para servirlo desde aquí.'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MSG_BYTES });
  wss.on('connection', ws => {
    let c = null;
    let window0 = Date.now(), count = 0;
    ws.on('message', data => {
      // límite de frecuencia y tamaño (anti-spam)
      const now = Date.now();
      if (now - window0 > 1000) { window0 = now; count = 0; }
      if (++count > MAX_MSGS_PER_SEC) return;
      let msg; try { msg = JSON.parse(data); } catch { return; }
      if (!msg || typeof msg.type !== 'string') return;
      if (!c) {
        if (msg.type !== 'hello') return;
        if (msg.v !== PROTOCOL) { send(ws, { type: 'error', code: 'version', msg: 'Versión distinta del juego: recarga la página.' }); ws.close(); return; }
        const old = msg.token && clients.get(msg.token);
        if (old) {
          // reconexión: se recupera el sitio en la sala y la partida en curso
          c = old; if (c.ws && c.ws !== ws) try { c.ws.close(); } catch { /* */ }
          c.ws = ws;
          send(ws, { type: 'welcome', token: c.token, name: c.name, reconnected: true });
          const room = c.room;
          if (room) {
            room.sendRoom();
            if (room.match && (room.state === 'paused' || room.state === 'playing' || room.state === 'countdown')) {
              send(ws, { type: 'resume', matchId: room.match.id, cfg: room.match.cfg, you: room.index(c), finals: room.match.finals, st: room.match.tick, state: room.state });
              if (room.state === 'paused' && room.players.every(p => p && p.ws && p.ws.readyState === 1)) {
                // reanudación sincronizada tras una cuenta atrás
                room.state = 'resuming';
                room.broadcast({ type: 'unpause', inMs: 2000, st: room.match.tick });
                setTimeout(() => { if (room.state === 'resuming') { room.state = 'playing'; room.match.t0 = performance.now() - room.match.ticked * TICK_MS; } }, 2000);
              }
            }
          }
          log(`reconexión de ${c.name}`);
          return;
        }
        c = { token: crypto.randomBytes(16).toString('hex'), ws, name: sanitizeName(msg.name), room: null, ready: false, choice: null, rtt: 0 };
        clients.set(c.token, c);
        send(ws, { type: 'welcome', token: c.token, name: c.name });
        if (msg.room) onMessage(c, { type: 'join', code: msg.room });
        return;
      }
      try { onMessage(c, msg); } catch (e) { log('error', e.message); }
    });
    ws.on('close', () => { if (c) { if (c.ws === ws) { c.ws = null; leave(c, false); } setTimeout(() => { if (!c.ws) { if (c.room && (c.room.state === 'lobby' || c.room.state === 'ended')) leave(c, true); clients.delete(c.token); } }, RECONNECT_MS + 5000); } });
    ws.on('error', () => {});
  });
  const loopT = setInterval(loop, 2);
  return new Promise(resolve => server.listen(port, host, () => {
    log(`AURA LEGENDS online: http://${host}:${server.address().port}  (ws en /ws, protocolo ${PROTOCOL})`);
    resolve({ server, wss, rooms, port: server.address().port, close: () => new Promise(r => { clearInterval(loopT); for (const ws of wss.clients) ws.terminate(); wss.close(); server.close(() => r()); }) });
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();

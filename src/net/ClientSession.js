// Partida online en el cliente: predicción local + reconciliación (rollback) contra el servidor autoritativo.
// - confirmed: la partida avanzada SOLO con las entradas definitivas del servidor (idéntica a la suya).
// - render: la partida que se dibuja; va por delante con mis entradas inmediatas y la entrada del rival
//   conocida (reenviada) o prevista (repite lo que mantenía). Si una predicción falla, se restaura desde
//   confirmed y se resimula hasta el presente (en < 1 ms); los eventos de ticks ya mostrados se descartan.
// - Reloj: el cliente va adelantado al servidor lo justo (RTT/2 + jitter + margen) para que sus entradas
//   lleguen a tiempo; si se adelanta o atrasa demasiado, corrige saltando o repitiendo un tick.
// - Cada cierto tiempo compara el hash de su estado confirmado con el del servidor; si no coincide pide
//   una resincronización (reconstruye la partida a partir de todas las entradas definitivas).
import { buildOnlineBattle } from './match.js';
import { cloneState, restoreInto, stateHash } from './state.js';
import { encodeInput, decodeInput, predictInput, TICK_MS } from './protocol.js';

const MAX_PREDICT = 40;   // ticks máximos por delante de lo confirmado antes de esperar
const REDUNDANCY = 10;    // entradas no confirmadas que se reenvían en cada paquete

export class ClientSession {
  constructor({ cfg, you, net, finals = [], st = 0, now = () => performance.now() }) {
    this.cfg = cfg; this.you = you; this.other = 1 - you; this.net = net; this.now = now;
    this.confirmed = buildOnlineBattle(cfg);
    this.render = buildOnlineBattle(cfg);
    this.C = 0;                 // ticks definitivos aplicados a confirmed
    this.finals = [];
    this.local = new Map();     // mis entradas por tick
    this.remote = new Map();    // entradas provisionales del rival por tick
    this.usedR = [];            // entradas usadas al simular render (para detectar fallos de predicción)
    this.L = 0;                 // siguiente tick a simular en render
    this.dirty = false;
    this.hashes = new Map(); this.myHashes = new Map();
    this.serverTick = st; this.serverAt = now();
    this.stats = { rollbacks: 0, resims: 0, desyncs: 0, stalls: 0, skips: 0, maxAhead: 0 };
    this.paused = false;
    this.seq = 0;
    if (finals.length) this.addFinals(0, finals);
    this.L = this.C;
    restoreInto(this.render, this.confirmed);
  }

  // ---- mensajes del servidor
  onFinals(msg) {
    if (msg.st !== undefined) { this.serverTick = msg.st; this.serverAt = this.now(); }
    if (msg.h) this.hashes.set(msg.h[0], msg.h[1]);
    if (msg.from > this.finals.length) { this.net.send({ type: 'need', from: this.finals.length }); return; } // hueco: pedir reenvío
    this.addFinals(msg.from, msg.n);
  }
  addFinals(from, list) {
    for (let k = 0; k < list.length; k++) {
      const t = from + k;
      if (t < this.finals.length) continue;
      this.finals.push(list[k]);
    }
    // avanza el estado confirmado y comprueba la predicción de esos ticks
    while (this.C < this.finals.length) {
      const t = this.C, pair = this.finals[t];
      if (this.hashes.has(t)) {
        if (stateHash(this.confirmed) !== this.hashes.get(t)) { this.stats.desyncs++; this.desync = true; this.net.send({ type: 'resync' }); }
        this.hashes.delete(t);
      }
      const b = this.confirmed;
      b.step({ [b.fighters[0].id]: decodeInput(pair[0]), [b.fighters[1].id]: decodeInput(pair[1]) });
      this.lastEvents = b.drainEvents();
      if (t < this.L) { const u = this.usedR[t]; if (!u || u[0] !== pair[0] || u[1] !== pair[1]) this.dirty = true; }
      if (t % 60 === 0) { this.myHashes.set(t, stateHash(this.confirmed)); if (this.myHashes.size > 400) this.myHashes.delete(this.myHashes.keys().next().value); }
      this.local.delete(t - 30); this.remote.delete(t - 30); delete this.usedR[t - 30];
      this.C++;
    }
  }
  onRelay(msg) {
    if (msg.p !== this.other) return;
    for (const [t, bits] of msg.i) {
      if (t < this.C) continue;
      this.remote.set(t, bits);
      if (t < this.L && this.usedR[t] && this.usedR[t][this.other] !== bits) this.dirty = true;
    }
  }
  onPong(msg) { if (msg.st !== undefined) { this.serverTick = msg.st + (this.net.rtt / 2) / TICK_MS; this.serverAt = this.now(); } }
  // resincronización completa (desincronía o reconexión): se reconstruye desde todas las entradas definitivas
  resync(msg) {
    this.confirmed = buildOnlineBattle(this.cfg);
    this.C = 0; this.finals = []; this.hashes.clear(); this.usedR = [];
    this.addFinals(0, msg.finals);
    this.serverTick = msg.st; this.serverAt = this.now();
    this.L = this.C; this.dirty = false;
    restoreInto(this.render, this.confirmed);
    this.desync = false;
  }

  // ---- entradas
  remoteInputFor(t) {
    if (t < this.C) return this.finals[t][this.other];
    if (this.remote.has(t)) return this.remote.get(t);
    // previsión: lo último conocido del rival, sin pulsaciones nuevas
    for (let k = t - 1; k >= Math.max(0, t - 120); k--) {
      if (k < this.C) return predictInput(this.finals[k][this.other]);
      if (this.remote.has(k)) return predictInput(this.remote.get(k));
    }
    return 0;
  }
  stepRender(keepEvents) {
    const t = this.L, b = this.render;
    const mine = t < this.C ? this.finals[t][this.you] : (this.local.get(t) ?? 0);
    const theirs = this.remoteInputFor(t);
    const pair = this.you === 0 ? [mine, theirs] : [theirs, mine];
    this.usedR[t] = pair;
    const ev = b.events; b.events = [];
    b.step({ [b.fighters[0].id]: decodeInput(pair[0]), [b.fighters[1].id]: decodeInput(pair[1]) });
    const out = b.events;
    b.events = keepEvents ? ev.concat(out) : ev;
    this.L++;
  }
  // rollback: restaura lo confirmado y resimula hasta el tick actual (sin repetir efectos ya mostrados)
  reconcile() {
    if (!this.dirty) return false;
    this.dirty = false;
    const pending = this.render.events;
    const L = this.L;
    const pre = this.render.fighters.map(f => [f.x, f.y]);
    restoreInto(this.render, this.confirmed);
    this.L = this.C;
    while (this.L < L) this.stepRender(false);
    this.render.events = pending;
    // suavizado visual: la corrección no se ve como un salto; se absorbe en unos fotogramas
    this.render.fighters.forEach((f, i) => {
      const dx = pre[i][0] - f.x, dy = pre[i][1] - f.y;
      if (Math.abs(dx) < 160 && Math.abs(dy) < 160) { f._cx = (f._cx || 0) + dx; f._cy = (f._cy || 0) + dy; } else { f._cx = 0; f._cy = 0; }
    });
    this.stats.rollbacks++; this.stats.resims += L - this.C;
    return true;
  }

  // tick objetivo según el reloj estimado del servidor: vamos por delante lo justo para que la entrada llegue
  targetTick() {
    const est = this.serverTick + (this.now() - this.serverAt) / TICK_MS;
    const lead = Math.ceil((this.net.rtt / 2 + this.net.jitter * 2) / TICK_MS) + 2;
    return Math.round(est + lead);
  }

  // un tick local: lee mi entrada, la envía (con redundancia) y avanza la predicción
  tick(input) {
    if (this.paused) return false;
    if (this.L - this.C >= MAX_PREDICT) { this.stats.stalls++; return false; } // demasiado por delante: esperar
    const bits = encodeInput(input);
    this.local.set(this.L, bits);
    const list = [];
    for (let t = Math.max(this.C, this.L - REDUNDANCY + 1); t <= this.L; t++) if (this.local.has(t)) list.push([t, this.local.get(t)]);
    this.net.send({ type: 'in', s: ++this.seq, a: this.C, i: list });
    this.stepRender(true);
    this.stats.maxAhead = Math.max(this.stats.maxAhead, this.L - this.C);
    return true;
  }

  // avance por fotograma: decide cuántos ticks simular (sincronía con el reloj del servidor).
  // Si el equipo va lento (pocos FPS, pestaña en segundo plano) se recupera el ritmo simulando más ticks
  // por fotograma; si se ha quedado por detrás de lo confirmado, salta directamente al estado confirmado.
  frame(delta, readInput) {
    this.acc = (this.acc || 0) + Math.min(delta, 250);
    let n = 0;
    while (this.acc >= TICK_MS) { this.acc -= TICK_MS; n++; }
    const target = this.targetTick();
    if (this.L < this.C) {
      const pending = this.render.events;
      restoreInto(this.render, this.confirmed);
      this.render.events = pending;
      this.L = this.C; this.dirty = false; this.stats.jumps = (this.stats.jumps || 0) + 1;
    }
    const behind = target - this.L;
    if (behind > n + 2) { n = Math.min(behind, 15); this.stats.skips++; }   // atrasados: recuperar
    else if (behind < -3 && n > 0) { n--; this.stats.stalls++; }           // demasiado adelantados: esperar
    n = Math.min(n, 15);
    this.reconcile();
    for (let i = 0; i < n; i++) if (!this.tick(readInput())) break;
    this.reconcile();
    return n;
  }
  snapshotForTest() { return cloneState(this.confirmed); }
}

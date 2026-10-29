// Conexión con el servidor online: WebSocket con reconexión automática (token de sesión), ping/jitter,
// reparto de mensajes y un simulador de red opcional (latencia, jitter y pérdida) para pruebas.
// Funciona en el navegador y en Node (se le inyecta la clase WebSocket).
import { PROTOCOL } from './protocol.js';

export class NetClient {
  constructor({ url, name, WS = globalThis.WebSocket, netsim = null, storage = null, now = () => performance.now() } = {}) {
    this.url = url; this.name = name; this.WS = WS; this.now = now;
    this.sim = netsim; // { lat, jitter, loss } en ms / porcentaje
    this.storage = storage;
    this.handlers = {};
    this.status = 'idle'; // idle | connecting | open | reconnecting | closed | error
    this.rtt = 0; this.jitter = 0; this.lastPong = 0;
    this.token = storage ? storage.getItem('aura-online-token') : null;
    this.attempts = 0; this.wanted = false;
    this.outQ = []; this.inQ = []; this.lastOut = 0; this.lastIn = 0;
    this.lastError = '';
  }
  on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); return () => { this.handlers[type] = this.handlers[type].filter(x => x !== fn); }; }
  emit(type, msg) { for (const fn of (this.handlers[type] || [])) fn(msg); for (const fn of (this.handlers['*'] || [])) fn(msg); }

  connect() {
    this.wanted = true;
    this.status = this.attempts ? 'reconnecting' : 'connecting';
    this.emit('status', { status: this.status });
    let ws;
    try { ws = new this.WS(this.url); } catch (e) { this.fail('URL de servidor no válida: ' + this.url); return; }
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0; this.status = 'open';
      this.rawSend({ type: 'hello', v: PROTOCOL, name: this.name, token: this.token, room: this.pendingRoom || undefined });
      this.pendingRoom = null;
      this.emit('status', { status: 'open' });
      clearInterval(this.pingT);
      this.pingT = setInterval(() => this.send({ type: 'ping', t: this.now(), rtt: this.rtt }), 1000);
    };
    ws.onmessage = ev => {
      let msg; try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString()); } catch { return; }
      this.deliver(msg);
    };
    ws.onerror = () => { this.lastError = 'No se puede conectar con el servidor.'; };
    ws.onclose = () => {
      clearInterval(this.pingT);
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.wanted) { this.status = 'closed'; this.emit('status', { status: 'closed' }); return; }
      // reconexión con espera creciente (red caída, servidor reiniciado...)
      this.attempts++;
      if (this.attempts > 8) { this.fail(this.lastError || 'Conexión perdida.'); return; }
      this.status = 'reconnecting'; this.emit('status', { status: 'reconnecting', attempt: this.attempts });
      setTimeout(() => { if (this.wanted && !this.ws) this.connect(); }, Math.min(5000, 400 * 2 ** (this.attempts - 1)));
    };
  }
  fail(msg) { this.status = 'error'; this.lastError = msg; this.wanted = false; this.emit('status', { status: 'error', msg }); }
  close() { this.wanted = false; clearInterval(this.pingT); if (this.ws) { try { this.ws.close(); } catch { /* */ } } this.ws = null; this.status = 'closed'; }
  // simula un corte de red (pruebas de reconexión)
  dropConnection() { if (this.ws) { const w = this.ws; try { w.close(); } catch { /* */ } } }

  deliver(msg) {
    if (this.sim) {
      if (this.sim.loss && Math.random() * 100 < this.sim.loss && droppable(msg)) return;
      const at = Math.max(this.lastIn, this.now() + this.sim.lat / 2 + Math.random() * (this.sim.jitter || 0));
      this.lastIn = at; this.inQ.push({ at, msg }); this.pump(); return;
    }
    this.handle(msg);
  }
  handle(msg) {
    if (msg.type === 'welcome') { this.token = msg.token; if (this.storage) this.storage.setItem('aura-online-token', msg.token); }
    if (msg.type === 'pong') {
      const r = this.now() - msg.t;
      this.jitter = this.rtt ? this.jitter * 0.8 + Math.abs(r - this.rtt) * 0.2 : 0;
      this.rtt = this.rtt ? this.rtt * 0.8 + r * 0.2 : r;
      this.lastPong = this.now();
    }
    this.emit(msg.type, msg);
  }
  send(msg) {
    if (this.sim) {
      if (this.sim.loss && Math.random() * 100 < this.sim.loss && droppable(msg)) return;
      const at = Math.max(this.lastOut, this.now() + this.sim.lat / 2 + Math.random() * (this.sim.jitter || 0));
      this.lastOut = at; this.outQ.push({ at, msg }); this.pump(); return;
    }
    this.rawSend(msg);
  }
  rawSend(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  // entrega los mensajes retrasados por el simulador de red
  pump() {
    const t = this.now();
    while (this.outQ.length && this.outQ[0].at <= t) this.rawSend(this.outQ.shift().msg);
    while (this.inQ.length && this.inQ[0].at <= t) this.handle(this.inQ.shift().msg);
    if ((this.outQ.length || this.inQ.length) && !this.pumpT) this.pumpT = setTimeout(() => { this.pumpT = null; this.pump(); }, 2);
  }
}
// solo se "pierden" mensajes de tiempo real (entradas y confirmaciones); la red real es TCP, esto prueba la
// redundancia y la recuperación de huecos
const droppable = m => m.type === 'in' || m.type === 'f' || m.type === 'r' || m.type === 'ping' || m.type === 'pong';

// URL del servidor: ?server=…, ajuste guardado, variable de compilación o el propio host si sirve el juego
export function defaultServerUrl(saved) {
  try {
    const q = new URLSearchParams(location.search).get('server');
    if (q) return q;
  } catch { /* */ }
  if (saved) return saved;
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_ONLINE_URL : '';
  if (env) return env;
  if (typeof location !== 'undefined' && !/github\.io$/.test(location.hostname)) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  return '';
}

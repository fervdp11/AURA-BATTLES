// Estado online compartido entre escenas (una sola conexión): sala, partida en curso y último resultado.
import { NetClient, defaultServerUrl } from './NetClient.js';
import { ClientSession } from './ClientSession.js';
import { Save } from '../core/Save.js';

function netsimFromUrl() {
  // ?netsim=120,30,5 → latencia 120 ms, jitter 30 ms, 5% de pérdida (pruebas de red en el navegador)
  try { const v = new URLSearchParams(location.search).get('netsim'); if (!v) return null; const [lat, jitter, loss] = v.split(',').map(Number); return { lat: lat || 0, jitter: jitter || 0, loss: loss || 0 }; } catch { return null; }
}
export function roomFromUrl() { try { return (new URLSearchParams(location.search).get('sala') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); } catch { return ''; } }

class OnlineState {
  constructor() { this.net = null; this.room = null; this.you = 0; this.session = null; this.start = null; this.lastEnd = null; this.error = ''; this.listeners = new Set(); this.rematch = [false, false]; this.pause = null; }
  get url() { return defaultServerUrl(Save.d.settings.onlineUrl); }
  setUrl(u) { Save.d.settings.onlineUrl = u; Save.save(); this.disconnect(); }
  notify(type, msg) { for (const fn of this.listeners) fn(type, msg); }
  listen(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  connected() { return !!(this.net && this.net.status === 'open'); }
  connect() {
    if (this.net && (this.net.status === 'open' || this.net.status === 'connecting' || this.net.status === 'reconnecting')) return this.net;
    const url = this.url;
    if (!url) { this.error = 'No hay servidor online configurado.'; this.notify('error', { msg: this.error }); return null; }
    let storage = null; try { storage = window.sessionStorage; } catch { /* */ }
    const net = new NetClient({ url, name: Save.d.profile.name, netsim: netsimFromUrl(), storage });
    this.net = net; this.error = '';
    net.on('status', m => { if (m.status === 'error') this.error = m.msg; this.notify('status', m); });
    net.on('error', m => { this.error = m.msg; this.notify('error', m); });
    net.on('room', m => { this.room = m; this.you = m.you; this.notify('room', m); });
    net.on('start', m => {
      this.start = m; this.lastEnd = null; this.pause = null; this.rematch = [false, false];
      this.session = new ClientSession({ cfg: m.cfg, you: m.you, net });
      this.notify('start', m);
    });
    net.on('f', m => this.session && this.session.onFinals(m));
    net.on('r', m => this.session && this.session.onRelay(m));
    net.on('pong', m => this.session && this.session.onPong(m));
    net.on('resume', m => {
      if (!this.session || !this.start || this.start.matchId !== m.matchId) { this.start = { matchId: m.matchId, cfg: m.cfg, you: m.you }; this.session = new ClientSession({ cfg: m.cfg, you: m.you, net, finals: m.finals, st: m.st }); this.notify('start', this.start); }
      else this.session.resync(m);
      this.notify('resume', m);
    });
    net.on('pause', m => { this.pause = { ...m, at: performance.now() }; if (this.session) this.session.paused = true; this.notify('pause', m); });
    net.on('unpause', m => { this.pause = { resuming: true, inMs: m.inMs, at: performance.now() }; setTimeout(() => { this.pause = null; if (this.session) { this.session.paused = false; this.session.serverTick = m.st; this.session.serverAt = performance.now(); } this.notify('unpause', m); }, m.inMs); });
    net.on('end', m => { this.lastEnd = m; this.applyRewards(m); this.notify('end', m); });
    net.on('rematch', m => { this.rematch = m.votes; this.notify('rematch', m); });
    net.on('left', m => this.notify('left', m));
    net.connect();
    return net;
  }
  // recompensas: SOLO las calculadas por el servidor, una vez por partida
  applyRewards(m) {
    const you = this.start ? this.start.you : this.you;
    m.applied = Save.recordOnline({ matchId: m.matchId, reward: m.rewards[you], win: m.result.winner === you, stats: m.stats[you] });
  }
  send(msg) { if (this.net) this.net.send(msg); }
  leaveRoom() { this.send({ type: 'leave' }); this.room = null; this.session = null; this.start = null; }
  disconnect() { if (this.net) this.net.close(); this.net = null; this.room = null; this.session = null; this.start = null; }
}
export const Online = new OnlineState();

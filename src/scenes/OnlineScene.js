// Menú ONLINE: crear sala, unirse por código o enlace (?sala=CÓDIGO) y configurar el servidor.
import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, panel, MenuList, MenuBG, go, fadeIn, keyHints, toast, textPrompt } from '../ui/UI.js';
import { Online, roomFromUrl } from '../net/Online.js';

export class OnlineScene extends Phaser.Scene {
  constructor() { super('Online'); }
  create() {
    this.bg = new MenuBG(this, { hue: 190 });
    txt(this, 60, 30, 'ONLINE', 64, '#7df9ff');
    txt(this, 64, 110, 'Combates 1 contra 1 por internet con servidor autoritativo.', 18, '#c9c3e6', { body: true });
    panel(this, 640, 150, 580, 420, { alpha: 0.75 });
    this.info = txt(this, 665, 170, '', 17, '#e8e4ff', { body: true, wrap: 530 });
    this.status = txt(this, 665, 520, '', 18, '#ffd166', { body: true, wrap: 530 });
    this.menu = new MenuList(this, 60, 170, [
      { label: 'CREAR SALA', color: '#7df9ff', onSelect: () => this.create_() },
      { label: 'UNIRSE CON CÓDIGO', onSelect: () => this.join() },
      { label: 'SERVIDOR', value: () => (Online.url ? short(Online.url) : 'SIN CONFIGURAR'), onSelect: () => this.editServer() },
      { label: 'VOLVER', onSelect: () => this.back() }
    ], { w: 540, h: 52, gap: 8, size: 24, onBack: () => this.back() });
    this.off = Online.listen((type, m) => this.onNet(type, m));
    this.events.once('shutdown', () => this.off());
    keyHints(this, '↑↓ elegir · ENTER confirmar · ESC volver');
    fadeIn(this);
    this.refresh();
    // enlace de invitación: ?sala=CÓDIGO
    const code = roomFromUrl();
    if (code && !this._autoJoined) { this._autoJoined = true; this.pending = { type: 'join', code }; this.ensure(); }
  }
  back() { Online.disconnect(); go(this, 'Menu'); }
  refresh() {
    const url = Online.url;
    this.info.setText([
      'CÓMO FUNCIONA',
      '• Crea una sala y comparte el código o el enlace con tu rival.',
      '• Cada jugador elige personaje y pulsa LISTO; el combate empieza a la vez para los dos.',
      '• El servidor simula el combate y valida golpes, aura y recompensas: nadie puede hacer trampas desde su navegador.',
      '• Tu personaje responde al instante (predicción) y se corrige solo si la red se retrasa.',
      '• Si se corta la conexión tienes 20 s para volver; si no, pierdes por abandono.',
      '',
      url ? 'Servidor: ' + url : 'No hay servidor online configurado. Arranca uno con "npm run server" (ver ONLINE.md) y escribe su dirección en SERVIDOR, p. ej. ws://localhost:8080/ws.'
    ].join('\n'));
    const n = Online.net;
    this.status.setText(Online.error ? '⚠ ' + Online.error : !n ? '' : n.status === 'open' ? `Conectado · ping ${Math.round(n.rtt)} ms` : n.status === 'connecting' ? 'Conectando…' : n.status === 'reconnecting' ? 'Reconectando…' : '');
  }
  ensure() {
    const net = Online.connect();
    if (!net) { toast(this, Online.error, '#ff4d6d'); Audio.play('ui_deny'); this.refresh(); return false; }
    if (net.status === 'open' && this.pending) { Online.send(this.pending); this.pending = null; }
    return true;
  }
  create_() { this.pending = { type: 'create' }; this.ensure(); this.refresh(); }
  async join() {
    this.menu.active = false;
    const code = await textPrompt(this, 'CÓDIGO DE LA SALA', '', { max: 6, filter: s => s.toUpperCase().replace(/[^A-Z0-9]/g, '') });
    this.menu.active = true;
    if (!code) return;
    this.pending = { type: 'join', code };
    this.ensure(); this.refresh();
  }
  async editServer() {
    this.menu.active = false;
    const u = await textPrompt(this, 'DIRECCIÓN DEL SERVIDOR (ws:// o wss://)', Save.d.settings.onlineUrl || Online.url || 'ws://localhost:8080/ws', { max: 120, mono: true });
    this.menu.active = true;
    if (u === null) return;
    const v = u.trim();
    if (v && !/^wss?:\/\/[^\s]+$/.test(v)) { toast(this, 'Debe empezar por ws:// o wss://', '#ff4d6d'); return; }
    Online.setUrl(v); this.refresh();
  }
  onNet(type, m) {
    if (type === 'status' && m.status === 'open' && this.pending) { Online.send(this.pending); this.pending = null; }
    if (type === 'room') go(this, 'OnlineLobby');
    if (type === 'error') { toast(this, m.msg, '#ff4d6d'); Audio.play('ui_deny'); }
    this.refresh();
  }
  update() { Input.pollPad(); this.bg.update(); this.menu.update(); if (this.game.loop.frame % 30 === 0) this.refresh(); }
}
const short = u => (u.length > 34 ? u.slice(0, 31) + '…' : u);

// Sala online: código y enlace para invitar, elección de personaje, LISTO e inicio sincronizado.
import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, panel, MenuList, MenuBG, StickPreview, go, fadeIn, keyHints, toast } from '../ui/UI.js';
import { Online } from '../net/Online.js';
import { playerProfile, botProfile } from '../core/Match.js';
import { BOTS, BOSSES } from '../data/bots.js';

function roster() {
  const me = { name: Save.d.profile.name + ' (TU PERSONAJE)', profile: playerProfile(), loadout: { ...Save.d.loadout }, finisher: Save.d.finisher || 'kickSpace' };
  const bots = [...BOTS, ...BOSSES].map(b => ({ name: b.name, profile: { ...botProfile(b), boss: false, title: '' }, loadout: { ...b.loadout }, finisher: 'kickSpace' }));
  return [me, ...bots];
}

export class OnlineLobbyScene extends Phaser.Scene {
  constructor() { super('OnlineLobby'); }
  create() {
    this.bg = new MenuBG(this, { hue: 190 });
    this.R = roster();
    this.ci = 0;
    this.ready = false;
    txt(this, 60, 24, 'SALA ONLINE', 54, '#7df9ff');
    this.codeT = txt(this, 1220, 30, '', 54, '#ffd166', { ox: 1 });
    this.linkT = txt(this, 1220, 96, '', 15, '#c9c3e6', { ox: 1, body: true });
    panel(this, 60, 140, 560, 330, { alpha: 0.75 });
    panel(this, 660, 140, 560, 330, { alpha: 0.75 });
    this.cards = [0, 1].map(i => ({
      head: txt(this, 80 + i * 600, 155, 'JUGADOR ' + (i + 1), 24, i ? '#ff5fa2' : '#7df9ff'),
      name: txt(this, 80 + i * 600, 192, '', 20, '#ffffff', { body: true }),
      ch: txt(this, 80 + i * 600, 222, '', 17, '#c9c3e6', { body: true, wrap: 300 }),
      st: txt(this, 80 + i * 600, 430, '', 22, '#ffd166'),
      prev: null
    }));
    this.menu = new MenuList(this, 60, 500, [
      { label: 'PERSONAJE', value: () => this.R[this.ci].name, onLeft: () => this.pick(-1), onRight: () => this.pick(1), onSelect: () => this.pick(1) },
      { label: 'LISTO', color: '#7bd389', value: () => (this.ready ? '✓ ESPERANDO AL RIVAL' : 'PULSA ENTER'), onSelect: () => this.toggleReady() },
      { label: 'COPIAR ENLACE DE INVITACIÓN', onSelect: () => this.copyLink() },
      { label: 'SALIR DE LA SALA', onSelect: () => this.leave() }
    ], { w: 760, h: 40, gap: 5, size: 21, onBack: () => this.leave() });
    this.off = Online.listen((type, m) => this.onNet(type, m));
    this.events.once('shutdown', () => this.off());
    keyHints(this, '↑↓ elegir · ←→ personaje · ENTER confirmar · ESC salir');
    fadeIn(this);
    this.sendChoice();
    this.refresh();
  }
  link() { const code = Online.room ? Online.room.code : ''; try { return `${location.origin}${location.pathname}?sala=${code}${Save.d.settings.onlineUrl ? '&server=' + encodeURIComponent(Save.d.settings.onlineUrl) : ''}`; } catch { return code; } }
  async copyLink() { try { await navigator.clipboard.writeText(this.link()); toast(this, 'Enlace copiado', '#7bd389'); } catch { toast(this, this.link(), '#ffd166'); } }
  pick(d) { if (this.ready) return; this.ci = (this.ci + d + this.R.length) % this.R.length; this.sendChoice(); }
  sendChoice() {
    const c = this.R[this.ci];
    Online.send({ type: 'choose', profile: c.profile, loadout: c.loadout, finisher: c.finisher });
    this.ready = false;
  }
  toggleReady() { this.ready = !this.ready; Online.send({ type: 'ready', ready: this.ready }); Audio.play(this.ready ? 'fingerSnap' : 'ui_back'); }
  leave() { Online.leaveRoom(); go(this, 'Online'); }
  onNet(type, m) {
    if (type === 'start') { Audio.play('roundGong'); go(this, 'Fight', { spec: { mode: 'online', arena: m.cfg.arena } }); }
    if (type === 'left') toast(this, 'El rival ha salido de la sala', '#ff9f1c');
    if (type === 'status' && m.status === 'error') { toast(this, m.msg || 'Conexión perdida', '#ff4d6d'); go(this, 'Online'); }
    this.refresh();
  }
  refresh() {
    const r = Online.room;
    if (!r) return;
    this.codeT.setText(r.code);
    this.linkT.setText('Comparte el código o el enlace · marcador ' + (r.score || [0, 0]).join(' – '));
    r.players.forEach((p, i) => {
      const c = this.cards[i];
      const me = i === Online.you;
      c.name.setText(p ? (p.name + (me ? '  (TÚ)' : '')) : 'Esperando rival…');
      c.ch.setText(p ? ('Personaje: ' + (p.character || '—') + '\n' + (p.connected ? `Conectado${p.rtt ? ' · ' + p.rtt + ' ms' : ''}` : 'Desconectado')) : 'Envíale el código: ' + r.code);
      c.st.setText(p ? (p.ready ? '✓ LISTO' : 'ELIGIENDO…') : '');
      // vista previa del personaje elegido (el mío al momento; el del rival cuando lo anuncia)
      const prof = me ? this.R[this.ci].profile : (p && p.profile) || null;
      const key = me ? 'me' + this.ci : p && p.profile ? JSON.stringify(p.profile) : '';
      if (prof && (!c.prev || c.prevKey !== key)) { if (c.prev) c.prev.destroy(); c.prev = new StickPreview(this, 470 + i * 600, 440, prof, { scale: 1.5, facing: i ? -1 : 1, anim: p && p.ready ? 'flex' : 'guard', depth: 6 }); c.prevKey = key; }
      if (!prof && c.prev) { c.prev.destroy(); c.prev = null; c.prevKey = null; }
    });
  }
  update() {
    Input.pollPad(); this.bg.update(); this.menu.update();
    for (const c of this.cards) if (c.prev) c.prev.update();
    if (this.game.loop.frame % 20 === 0) this.refresh();
  }
}

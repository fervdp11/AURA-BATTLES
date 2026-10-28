import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input, keyName } from '../core/Input.js';
import { txt, panel, MenuList, keyHints } from '../ui/UI.js';
import { MOVES, BASIC_IDS } from '../sim/moves.js';

const SLOT_NAMES = { special: 'ESPECIAL', specialF: '→ + ESPECIAL', specialD: '↓ + ESPECIAL', skill1: 'HABILIDAD 1', skill2: 'HABILIDAD 2', ult: 'ULTIMATE' };
const BASIC_KEYS = { jab: 'Z (x3 cadena)', lowKick: '↓ + Z', airKick: 'Z en el aire', roundhouse: 'X', uppercut: '↓ + X', lunge: '→ + X', sweep: '← + X', diveKick: 'X en el aire', dashAttack: 'Z/X durante el dash', cross: 'Z, Z', hook: 'Z, Z, Z' };

export class MoveListScene extends Phaser.Scene {
  constructor() { super('MoveList'); }
  init(data) { this.from = data.from; }
  create() {
    const lo = Save.d.loadout;
    const k = a => keyName(Input.codesFor(a)[0]);
    this.add.rectangle(640, 360, 1280, 720, 0x05030c, 0.92);
    txt(this, 60, 30, 'LISTA DE MOVIMIENTOS', 48, '#ffffff');
    const items = [];
    items.push({ label: 'CONTROLES', head: true, desc: [
      `Moverse: ${k('left')} ${k('right')} · Saltar: ${k('up')} (doble salto en el aire) · Agacharse: ${k('down')}`,
      `Dash / esquiva: ${k('dash')} (+dirección; invulnerable unos frames, también en el aire)`,
      `Bloqueo: mantener ${k('block')} (agachado bloquea golpes bajos; de pie, los altos)`,
      `PARRY: pulsa ${k('block')} justo antes del impacto. Si lo spameas se bloquea un momento.`,
      `AURA BURST: ${k('dash')} + ${k('block')} a la vez mientras recibes un combo (50 de energía).`,
      `Ataque rápido ${k('light')} · Fuerte ${k('heavy')} · Especial ${k('special')} · Habilidades ${k('skill1')} / ${k('skill2')} · Ultimate ${k('ult')}`,
      'Los básicos se cancelan en especiales al conectar. El uppercut permite saltar para seguir el combo.',
      'Anti-spam: repetir la misma técnica reduce su daño. Humillar a un rival derribado le quita aura.'
    ].join('\n') });
    for (const s of Object.keys(SLOT_NAMES)) { const m = MOVES[lo[s]]; if (m) items.push({ label: `${SLOT_NAMES[s]} · ${m.name}`, m }); }
    for (const id of BASIC_IDS) items.push({ label: `${BASIC_KEYS[id] || ''} · ${MOVES[id].name}`, m: MOVES[id] });
    this.desc = txt(this, 640, 120, '', 20, '#e8e4ff', { body: true, wrap: 590 });
    panel(this, 620, 100, 630, 540, { alpha: 0.6 });
    this.menu = new MenuList(this, 40, 110, items, { w: 540, h: 42, gap: 4, size: 19, visible: 12, onChange: it => this.show(it), onBack: () => this.close() });
    this.show(items[0]);
    keyHints(this, '↑↓ navegar · ESC volver');
  }
  show(it) {
    if (it.desc) { this.desc.setText(it.desc); return; }
    const m = it.m;
    const h = m.hit || {};
    const lines = [m.name.toUpperCase(), '', m.desc || '', '',
      `Coste: ${m.cost || 0} energía · Recarga: ${m.cd ? (m.cd / 60).toFixed(1) + ' s' : '—'}`,
      `Frames: arranque ${m.startup} · activo ${m.active} · recuperación ${m.recovery}`,
      h.dmg ? `Daño base: ${h.dmg}${h.hits ? '' : ''} · Altura: ${({ low: 'BAJO (bloquea agachado)', high: 'ALTO (bloquea de pie)', mid: 'MEDIO' })[h.height] || 'MEDIO'}${h.grab ? ' · AGARRE (atraviesa bloqueo)' : ''}${h.unblockable ? ' · IMBLOQUEABLE' : ''}` : '',
      '', m.tip ? 'CÓMO CONTRARRESTARLO: ' + m.tip : ''];
    this.desc.setText(lines.filter(x => x !== undefined).join('\n'));
  }
  close() {
    this.scene.stop();
    if (this.from) this.scene.resume(this.from);
  }
  update() { Input.pollPad(); this.menu.update(); }
}

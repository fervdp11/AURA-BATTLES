import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input, keyName } from '../core/Input.js';
import { txt, panel, MenuList, keyHints } from '../ui/UI.js';
import { MOVES, BASIC_IDS } from '../sim/moves.js';

const SLOT_NAMES = { special: 'ESPECIAL', specialF: 'ESPECIAL HACIA DELANTE', specialD: 'ESPECIAL ABAJO', skill1: 'HABILIDAD 1', skill2: 'HABILIDAD 2', ult: 'ULTIMATE', hum1: 'HUMILLACIÓN DE AURA', hum2: 'HUMILLACIÓN DE AURA', hum3: 'HUMILLACIÓN DE AURA' };
// combinación de cada básico y de cada hueco del loadout, construida con las teclas REALES del perfil
const K = (a, prof) => keyName(Input.codesFor(a, prof)[0]);
const FWD = prof => (prof === 'p2' ? K('left', prof) : K('right', prof)), BCK = prof => (prof === 'p2' ? K('right', prof) : K('left', prof));
const BASIC_COMBO = {
  jab: p => K('light', p), cross: p => `${K('light', p)}, ${K('light', p)}`, hook: p => `${K('light', p)} ×3`,
  lowKick: p => `${K('down', p)} + ${K('light', p)}`, airKick: p => `${K('light', p)} en el aire`, roundhouse: p => K('heavy', p),
  uppercut: p => `${K('down', p)} + ${K('heavy', p)}`, lunge: p => `${FWD(p)} + ${K('heavy', p)}`, sweep: p => `${BCK(p)} + ${K('heavy', p)}`,
  diveKick: p => `${K('heavy', p)} en el aire`, dashAttack: p => `${K('light', p)}/${K('heavy', p)} en dash`
};
const SLOT_COMBO = { special: p => K('special', p), specialF: p => `${FWD(p)} + ${K('special', p)}`, specialD: p => `${K('down', p)} + ${K('special', p)}`, skill1: p => K('skill1', p), skill2: p => K('skill2', p), ult: p => K('ult', p), hum1: p => K('taunt', p), hum2: p => K('taunt', p), hum3: p => K('taunt', p) };

export class MoveListScene extends Phaser.Scene {
  constructor() { super('MoveList'); }
  // data.players: [{ prof, loadout, name }] — en multijugador se muestran las teclas de J1 y J2
  init(data) { this.from = data.from; this.players = data.players && data.players.length ? data.players : [{ prof: 'solo', loadout: Save.d.loadout, name: '' }]; }
  create() {
    const P = this.players, multi = P.length > 1;
    const lo = P[0].loadout;
    const k = a => P.map(p => (multi ? (p.prof === 'p1' ? 'J1 ' : 'J2 ') : '') + K(a, p.prof)).join('  |  ');
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
      'Anti-spam: repetir la misma técnica reduce su daño. Humillar a un rival derribado le quita aura.',
      `HUMILLACIONES DE AURA: ${k('taunt')} hace la humillación equipada cuya condición se cumpla. Recuperan TU aura sin dañar. Se cancelan con ${k('block')} o ${k('dash')}.`,
      `Si te humillan estando en el suelo, pulsa ${k('light')} o ${k('heavy')} para despertar con rabia.`
    ].join('\n') });
    for (const pl of P) {
      if (multi) items.push({ label: `— TÉCNICAS DE ${pl.prof === 'p1' ? 'J1' : 'J2'} · ${pl.name} —`, head: true, desc: 'Técnicas equipadas por este jugador con sus teclas.' });
      for (const s of Object.keys(SLOT_NAMES)) { const m = MOVES[pl.loadout[s]]; if (m) items.push({ label: `[${SLOT_COMBO[s](pl.prof)}] ${m.name}`, m, keys: `${SLOT_NAMES[s]}: ${SLOT_COMBO[s](pl.prof)}` }); }
    }
    for (const id of BASIC_IDS) items.push({ label: `[${P.map(p => BASIC_COMBO[id] ? BASIC_COMBO[id](p.prof) : '').join(' | ')}] ${MOVES[id].name}`, m: MOVES[id], keys: P.map(p => (multi ? (p.prof === 'p1' ? 'J1: ' : 'J2: ') : '') + (BASIC_COMBO[id] ? BASIC_COMBO[id](p.prof) : '')).join('   ') });
    void lo;
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
    const lines = [m.name.toUpperCase(), it.keys ? 'TECLAS: ' + it.keys : '', '', m.desc || '', '',
      `Coste: ${m.cost || 0} energía · Recarga: ${m.cd ? (m.cd / 60).toFixed(1) + ' s' : '—'}`,
      m.humAura ? `CUÁNDO: ${m.when || ''}` : '',
      m.humAura ? `Recupera: ${m.recover ? '+' + m.recover.reduce((a, b) => a + b, 0) : 'hasta +' + Math.round(m.perFrame * m.active)} de aura propia · no daña al rival` : '',
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

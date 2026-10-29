import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input, keyName } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, StickPreview, MenuBG, go, fadeIn } from '../ui/UI.js';
import { playerProfile, botProfile } from '../core/Match.js';
import { BOTS, BOSSES } from '../data/bots.js';
import { BODY_COLORS, AURA_COLORS } from '../data/progression.js';
import { MOVES, SPECIAL_IDS, ULT_IDS, AURA_IDS, FINISHERS } from '../sim/moves.js';
import { ARENAS } from '../view/Arena.js';
import { hex } from '../view/StickRenderer.js';

// Multijugador local 1v1: cada jugador elige personaje, colores y técnicas con SUS teclas a la vez.
const PCOL = [0x7df9ff, 0xff5fa2], PCSS = ['#7df9ff', '#ff5fa2'], PROF = ['p1', 'p2'];
const SLOTS = [['special', 'ESPECIAL'], ['specialF', 'ESPECIAL →'], ['specialD', 'ESPECIAL ↓'], ['skill1', 'HABILIDAD 1'], ['skill2', 'HABILIDAD 2'], ['ult', 'ULTIMATE'], ['hum1', 'HUMILLACIÓN 1'], ['hum2', 'HUMILLACIÓN 2'], ['hum3', 'HUMILLACIÓN 3']];
const ROUNDS = [1, 2, 3], TIMES = [60, 99, 0];
const AURAS = AURA_COLORS.map(a => a.c).filter(c => c !== 'rainbow');

function roster() {
  const me = { id: 'me', name: Save.d.profile.name, profile: playerProfile(), loadout: { ...Save.d.loadout } };
  const bots = [...BOTS].sort((a, b) => a.level - b.level).map(b => ({ id: b.id, name: b.name, profile: botProfile(b), loadout: { ...b.loadout }, boss: false }));
  const bosses = BOSSES.map(b => ({ id: b.id, name: b.name + ' ★', profile: { ...botProfile(b), boss: false, title: '' }, loadout: { ...b.loadout }, boss: true }));
  return [me, ...bots, ...bosses];
}

export class LocalSetupScene extends Phaser.Scene {
  constructor() { super('LocalSetup'); }
  create() {
    if (this.scene.isActive('Demo')) this.scene.stop('Demo');
    this.done = false;
    this.R = roster();
    const saved = Save.d.versusSetup || {};
    this.rules = { rounds: saved.rounds ?? 1, time: saved.time ?? 1, arena: saved.arena ?? 0 };
    this.P = [0, 1].map(i => this.makePlayer(i, saved['p' + (i + 1)]));
    this.bg = new MenuBG(this, { hue: 300 });
    this.g = this.add.graphics();
    this.gTop = this.add.graphics().setDepth(20);
    const title = txt(this, 640, 34, '2 JUGADORES · MULTIJUGADOR LOCAL', 46, '#ffffff', { ox: 0.5, oy: 0.5, strokeThickness: 7 });
    title.setShadow(0, 0, '#c084fc', 18, true, true);
    txt(this, 640, 72, 'Cada jugador elige con sus propias teclas. Cuando los dos estéis LISTOS, empieza el combate.', 16, '#c9c3e6', { ox: 0.5, oy: 0.5, body: true });
    this.P.forEach((p, i) => this.buildPanel(p, i));
    this.rulesTxt = txt(this, 640, 694, '', 18, '#ffd166', { ox: 0.5, oy: 0.5 });
    this.countTxt = txt(this, 640, 360, '', 120, '#ffffff', { ox: 0.5, oy: 0.5, strokeThickness: 12 }).setDepth(30);
    this.pop = Input.push((a, code, repeat, pad) => this.onInput(a, code, repeat, pad));
    this.events.once('shutdown', () => { if (this.pop) this.pop(); for (const p of this.P) p.prev.destroy(); });
    Audio.music('menu');
    fadeIn(this);
    this.t = 0;
  }

  makePlayer(i, s) {
    s = s || {};
    let ci = this.R.findIndex(c => c.id === s.char);
    if (ci < 0) ci = i === 0 ? 0 : Math.min(this.R.length - 1, 40 + Math.floor(Math.random() * 30));
    const c = this.R[ci];
    const p = { i, ci, ready: false, cur: 0, curY: 0, bump: 0,
      color: s.color || c.profile.color, accent: s.accent || c.profile.accent, aura: s.aura || c.profile.aura,
      finisher: s.finisher && (FINISHERS[s.finisher] || s.finisher === 'none') ? s.finisher : i === 0 ? 'kickSpace' : 'pantsDown',
      loadout: s.loadout && SLOTS.slice(0, 6).every(([k]) => MOVES[s.loadout[k]]) ? { ...c.loadout, ...s.loadout, ...(SLOTS.slice(6).every(([k]) => MOVES[s.loadout[k]]) ? {} : { hum1: c.loadout.hum1 || 'hum_goodBoy', hum2: c.loadout.hum2 || 'hum_dustOff', hum3: c.loadout.hum3 || 'hum_thumbsUp' }) } : { ...c.loadout } };
    return p;
  }
  profileOf(p) {
    const c = this.R[p.ci];
    // la ropa y los accesorios del personaje se conservan; si se cambia el color, el patrón de cuerpo vuelve a liso
    const eq = { ...(c.profile.equip || {}) };
    if (p.color !== c.profile.color) eq.body = null;
    if (p.aura !== c.profile.aura) eq.auraColor = null;
    if (p.accent !== c.profile.accent) eq.accent = null;
    return { ...c.profile, equip: eq, name: c.name.replace(' ★', ''), color: p.color, accent: p.accent, aura: p.aura, title: 'J' + (p.i + 1) };
  }

  rows(p) {
    const c = this.R[p.ci];
    const out = [
      { k: 'char', label: 'PERSONAJE', value: () => c.name },
      { k: 'color', label: 'COLOR', value: () => '', swatch: hex(p.color) },
      { k: 'accent', label: 'ACENTO', value: () => '', swatch: hex(p.accent) },
      { k: 'aura', label: 'AURA', value: () => (AURA_COLORS.find(a => a.c === p.aura) || {}).name || 'Propia', swatch: hex(p.aura) },
      ...SLOTS.map(([k, l]) => ({ k: 'slot', slot: k, label: l, value: () => (MOVES[p.loadout[k]] || {}).name || '-' })),
      { k: 'finisher', label: 'REMATE K.O.', value: () => (p.finisher === 'none' ? 'NINGUNO' : FINISHERS[p.finisher].name) }
    ];
    if (p.i === 0) out.push(
      { k: 'rounds', label: 'RONDAS (reglas)', value: () => (ROUNDS[this.rules.rounds] === 1 ? 'A 1' : 'AL MEJOR DE ' + (ROUNDS[this.rules.rounds] * 2 - 1)) },
      { k: 'time', label: 'TIEMPO (reglas)', value: () => (TIMES[this.rules.time] ? TIMES[this.rules.time] + ' s' : '∞') },
      { k: 'arena', label: 'ESCENARIO (reglas)', value: () => (this.rules.arena === 0 ? 'ALEATORIO' : ARENAS[this.rules.arena - 1].name.toUpperCase()) }
    );
    out.push({ k: 'controls', label: 'CONTROLES', value: () => 'CONFIGURAR' }, { k: 'ready', label: '¡LISTO!', value: () => '' });
    return out;
  }

  buildPanel(p, i) {
    const x0 = i === 0 ? 30 : 650;
    p.x0 = x0;
    p.prev = new StickPreview(this, x0 + 128, 596, this.profileOf(p), { scale: 1.95, facing: i === 0 ? 1 : -1, anim: 'guard', depth: 5, glow: 1 });
    p.head = txt(this, x0 + 20, 100, 'JUGADOR ' + (i + 1), 30, PCSS[i]);
    p.readyT = txt(this, x0 + 580, 104, '', 22, '#7bd389', { ox: 1 });
    p.labels = []; p.values = [];
    for (let r = 0; r < 20; r++) {
      p.labels.push(txt(this, 0, 0, '', 16, '#c9c3e6', { oy: 0.5, body: true, bold: true }).setDepth(10));
      p.values.push(txt(this, 0, 0, '', 17, '#ffffff', { ox: 0.5, oy: 0.5 }).setDepth(10));
      const zone = this.add.zone(x0 + 250, 140 + r * 24, 330, 24).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(12);
      zone.on('pointerdown', ptr => { const rs = this.rows(p); if (r >= rs.length) return; p.cur = r; this.act(p, ptr.x < x0 + 415 ? 'left' : 'right', true); });
    }
    const k = a => keyName(Input.codesFor(a, PROF[i])[0]);
    p.hint = txt(this, x0 + 300, 648, `${k('up')}/${k('down')} elegir · ${k('left')}/${k('right')} cambiar · ${k('light')} confirmar · ${k('heavy')} atrás`, 14, '#9a94b8', { ox: 0.5, body: true });
    p.keys = txt(this, x0 + 20, 140, '', 13, '#8f88b0', { body: true, wrap: 220 });
  }

  // asigna acciones de menú a cada jugador según su perfil de teclas (o su mando)
  onInput(a, code, repeat, pad) {
    if (this.done) return;
    if (code === 'Escape') { Audio.play('ui_back'); this.leave(); return; }
    if (code === null && pad !== undefined) { const p = this.P[pad]; if (p) this.act(p, a); return; }
    for (const p of this.P) {
      const act = Input.uiActionFor(code, PROF[p.i]);
      if (!act) continue;
      if (repeat && !['up', 'down', 'left', 'right'].includes(act)) continue;
      this.act(p, act);
    }
  }

  act(p, act, click = false) {
    const rows = this.rows(p);
    if (p.ready) { if (act === 'back' || act === 'confirm') { p.ready = false; Audio.play('ui_back'); } return; }
    if (act === 'up' || act === 'down') { p.cur = (p.cur + (act === 'up' ? -1 : 1) + rows.length) % rows.length; Audio.play('ui_move'); return; }
    const row = rows[p.cur];
    if (act === 'back') { Audio.play('ui_back'); p.cur = rows.length - 1; return; }
    if (row.k === 'ready') { if (act === 'confirm' || click) { p.ready = true; Audio.play('ui_select'); Audio.play('fingerSnap'); p.prev.setAnim(this.profileOf(p).celebration || 'flex'); this.checkStart(); } return; }
    if (row.k === 'controls') { if (act === 'confirm' || click) { this.saveSetup(); go(this, 'Controls', { prof: PROF[p.i], back: { scene: 'LocalSetup' } }); } return; }
    const d = act === 'left' ? -1 : act === 'right' || act === 'confirm' ? 1 : 0;
    if (!d) return;
    this.cycle(p, row, d);
    p.bump = 1;
    Audio.play('ui_move', { pitch: d > 0 ? 1.2 : 0.85 });
    p.prev.setProfile(this.profileOf(p));
  }

  cycle(p, row, d) {
    const cyc = (list, v) => list[(Math.max(0, list.indexOf(v)) + d + list.length) % list.length];
    switch (row.k) {
      case 'char': {
        p.ci = (p.ci + d + this.R.length) % this.R.length;
        const c = this.R[p.ci];
        p.color = c.profile.color; p.accent = c.profile.accent; p.aura = c.profile.aura; p.loadout = { ...c.loadout };
        break;
      }
      case 'color': p.color = cyc(BODY_COLORS, p.color); break;
      case 'accent': p.accent = cyc(BODY_COLORS, p.accent); break;
      case 'aura': p.aura = cyc(AURAS, p.aura); break;
      case 'slot': {
        const pool = row.slot === 'ult' ? ULT_IDS : row.slot.startsWith('hum') ? AURA_IDS : SPECIAL_IDS;
        const used = Object.entries(p.loadout).filter(([k]) => k !== row.slot).map(([, v]) => v);
        let i = pool.indexOf(p.loadout[row.slot]);
        for (let n = 0; n < pool.length; n++) { i = (i + d + pool.length) % pool.length; if (!used.includes(pool[i])) break; }
        p.loadout[row.slot] = pool[i];
        break;
      }
      case 'finisher': { const L = [...Object.keys(FINISHERS), 'none']; p.finisher = L[(L.indexOf(p.finisher) + d + L.length) % L.length]; break; }
      case 'rounds': this.rules.rounds = (this.rules.rounds + d + ROUNDS.length) % ROUNDS.length; break;
      case 'time': this.rules.time = (this.rules.time + d + TIMES.length) % TIMES.length; break;
      case 'arena': this.rules.arena = (this.rules.arena + d + ARENAS.length + 1) % (ARENAS.length + 1); break;
    }
  }

  saveSetup() {
    const s = { rounds: this.rules.rounds, time: this.rules.time, arena: this.rules.arena };
    this.P.forEach(p => { s['p' + (p.i + 1)] = { char: this.R[p.ci].id, color: p.color, accent: p.accent, aura: p.aura, finisher: p.finisher, loadout: { ...p.loadout } }; });
    Save.d.versusSetup = s; Save.save();
  }

  checkStart() {
    if (!this.P.every(p => p.ready)) return;
    this.saveSetup();
    this.done = true;
    let n = 3;
    const tick = () => {
      if (n === 0) {
        this.countTxt.setText('¡A PELEAR!').setScale(1.6); this.tweens.add({ targets: this.countTxt, scale: 1, duration: 200 });
        Audio.play('fightHit');
        const [a, b] = this.P.map(p => ({ profile: this.profileOf(p), loadout: { ...p.loadout }, finisher: p.finisher }));
        if (a.profile.name === b.profile.name) b.profile.name += ' (J2)';
        const spec = { mode: 'versus', p1: a, p2: b, enemies: [], rounds: ROUNDS[this.rules.rounds], timer: TIMES[this.rules.time], arena: this.rules.arena === 0 ? 'random' : ARENAS[this.rules.arena - 1].id, score: [0, 0] };
        this.time.delayedCall(450, () => go(this, 'Versus', { spec }));
        return;
      }
      this.countTxt.setText(String(n)).setScale(1.8); this.tweens.add({ targets: this.countTxt, scale: 1, duration: 220, ease: 'Back.easeOut' });
      Audio.play('count');
      n--;
      this.time.delayedCall(420, tick);
    };
    tick();
  }
  leave() { if (this.done) return; this.saveSetup(); this.done = true; go(this, 'Menu'); }

  update() {
    this.t++;
    Input.pollPad();
    this.bg.update();
    const g = this.g; g.clear();
    for (const p of this.P) {
      const x0 = p.x0, col = PCOL[p.i], rows = this.rows(p);
      // panel
      g.fillStyle(0x0d0820, 0.86); g.fillRoundedRect(x0, 90, 600, 540, 16);
      g.lineStyle(p.ready ? 4 : 2, col, p.ready ? 1 : 0.7); g.strokeRoundedRect(x0, 90, 600, 540, 16);
      g.fillStyle(col, 0.08 + (p.ready ? Math.sin(this.t * 0.15) * 0.04 + 0.06 : 0)); g.fillRoundedRect(x0, 90, 240, 540, 16);
      // suelo y sombra del personaje
      g.fillStyle(col, 0.12); g.fillEllipse(x0 + 128, 600, 180, 22);
      p.curY += (p.cur - p.curY) * 0.3;
      p.bump *= 0.8;
      const ry = r => 140 + r * 24;
      g.fillStyle(col, 0.2); g.fillRoundedRect(x0 + 246, ry(p.curY) - 1, 342, 25, 7);
      g.fillStyle(col, 1); g.fillRect(x0 + 246, ry(p.curY) + 3, 4, 18);
      for (let r = 0; r < p.labels.length; r++) {
        const row = rows[r], L = p.labels[r], V = p.values[r];
        if (!row) { L.setVisible(false); V.setVisible(false); continue; }
        L.setVisible(true); V.setVisible(true);
        const sel = r === p.cur, y = ry(r) + 12;
        L.setText(row.label).setPosition(x0 + 258, y).setColor(row.k === 'ready' ? (p.ready ? '#7bd389' : '#ffd166') : sel ? '#ffffff' : '#9a94b8');
        const v = row.value();
        const arrows = sel && !['ready', 'controls'].includes(row.k) && !p.ready;
        V.setText(arrows ? `◀ ${v} ▶` : v).setPosition(x0 + (row.swatch !== undefined ? 470 : 480), y).setScale(sel ? 1 + p.bump * 0.15 : 1).setColor(sel ? '#ffffff' : '#d9d4f0');
        if (row.swatch !== undefined) { g.fillStyle(0x000000, 1); g.fillRoundedRect(x0 + 520, y - 9, 40, 18, 5); g.fillStyle(row.swatch, 1); g.fillRoundedRect(x0 + 522, y - 7, 36, 14, 4); }
        if (row.k === 'ready' && p.ready) V.setText('✓');
      }
      p.readyT.setText(p.ready ? '✓ LISTO' : '').setColor('#7bd389');
      const k = a => keyName(Input.codesFor(a, PROF[p.i])[0]);
      p.keys.setText(`${k('light')} rápido · ${k('heavy')} fuerte · ${k('special')} especial\n${k('skill1')} hab.1 · ${k('skill2')} hab.2 · ${k('ult')} ulti\n${k('dash')} dash · ${k('block')} bloqueo · ${k('taunt')} humillación`);
      p.prev.update();
    }
    this.rulesTxt.setText(`REGLAS: ${ROUNDS[this.rules.rounds] === 1 ? '1 RONDA' : 'AL MEJOR DE ' + (ROUNDS[this.rules.rounds] * 2 - 1)}  ·  TIEMPO ${TIMES[this.rules.time] ? TIMES[this.rules.time] + ' s' : '∞'}  ·  ${this.rules.arena === 0 ? 'ESCENARIO ALEATORIO' : ARENAS[this.rules.arena - 1].name.toUpperCase()}   ·   ESC volver`);
  }
}

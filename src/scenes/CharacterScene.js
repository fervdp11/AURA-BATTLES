import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, panel, MenuList, StickPreview, go, fadeIn, keyHints, toast } from '../ui/UI.js';
import { MOVES, SPECIAL_IDS, ULT_IDS } from '../sim/moves.js';
import { BODY_COLORS, AURA_COLORS, ACCESSORIES, CELEBRATION_LIST, CELEBRATION_REQ, TITLES, MOVE_SHOP, RANKS, reqMet, reqText, rankFor } from '../data/progression.js';
import { CELEBRATIONS } from '../sim/celebrations.js';
import { playerProfile } from '../core/Match.js';

const SLOTS = [['special', 'ESPECIAL (C)'], ['specialF', '→ + ESPECIAL'], ['specialD', '↓ + ESPECIAL'], ['skill1', 'HABILIDAD 1 (A)'], ['skill2', 'HABILIDAD 2 (S)'], ['ult', 'ULTIMATE (D)']];

export class CharacterScene extends Phaser.Scene {
  constructor() { super('Character'); }
  create() {
    if (!this.scene.isActive('Demo')) this.scene.launch('Demo');
    this.scene.sendToBack('Demo');
    this.add.rectangle(640, 360, 1280, 720, 0x05030c, 0.86);
    txt(this, 50, 24, 'PERSONAJE', 56, '#ffffff');
    this.apText = txt(this, 1230, 40, '', 26, '#7df9ff', { ox: 1 });
    panel(this, 830, 100, 410, 560, { alpha: 0.6 });
    this.prev = new StickPreview(this, 1035, 520, playerProfile(), { scale: 2.2, anim: 'guard', depth: 6 });
    this.descT = txt(this, 845, 545, '', 15, '#e8e4ff', { body: true, wrap: 380 });
    this.menu = null;
    this.root();
    keyHints(this, '↑↓ elegir · ←→ cambiar · ENTER confirmar · ESC volver');
    fadeIn(this);
  }

  setMenu(items, o = {}) {
    if (this.menu) this.menu.destroy();
    this.menu = new MenuList(this, 50, 110, items, { w: 740, h: 44, gap: 5, size: 22, visible: 12, ...o });
    if (this.menu.items[this.menu.idx] && o.onChange) o.onChange(this.menu.items[this.menu.idx]);
  }
  refreshPreview(anim) {
    this.prev.setProfile(playerProfile());
    if (anim) this.prev.setAnim(anim);
    this.apText.setText(Save.d.ap + ' AP');
  }

  root() {
    const d = Save.d;
    this.refreshPreview('guard');
    this.descT.setText('');
    this.setMenu([
      { label: 'APARIENCIA', onSelect: () => this.appearance() },
      { label: 'TÉCNICAS EQUIPADAS', onSelect: () => this.loadout() },
      { label: 'TIENDA DE TÉCNICAS', onSelect: () => this.shop() },
      { label: 'CELEBRACIÓN DE VICTORIA', value: () => (CELEBRATIONS[d.profile.celebration] || {}).name || '', onSelect: () => this.celebration() },
      { label: 'TÍTULO', value: () => (TITLES.find(t => t.id === d.profile.title) || {}).name || '', onSelect: () => this.titles() },
      { label: 'NOMBRE', value: () => d.profile.name, onSelect: () => this.editName() },
      { label: 'VOLVER', onSelect: () => go(this, 'Menu') }
    ], { onBack: () => go(this, 'Menu') });
  }

  appearance() {
    const p = Save.d.profile;
    const save = () => { Save.save(); this.refreshPreview(); };
    const cycle = (arr, cur, dir, ok = () => true) => {
      let i = arr.indexOf(cur);
      for (let n = 0; n < arr.length; n++) { i = (i + dir + arr.length) % arr.length; if (ok(arr[i])) return arr[i]; }
      return cur;
    };
    const auraOk = c => reqMet((AURA_COLORS.find(a => a.c === c) || {}).req, Save.d);
    const accOk = id => reqMet((ACCESSORIES.find(a => a.id === id) || {}).req, Save.d);
    const auraIds = AURA_COLORS.map(a => a.c), accIds = ACCESSORIES.map(a => a.id);
    this.setMenu([
      { label: 'COLOR DEL CUERPO', value: () => p.color.toUpperCase(), onLeft: () => { p.color = cycle(BODY_COLORS, p.color, -1); save(); }, onRight: () => { p.color = cycle(BODY_COLORS, p.color, 1); save(); } },
      { label: 'COLOR DE ACENTO', value: () => p.accent.toUpperCase(), onLeft: () => { p.accent = cycle(BODY_COLORS, p.accent, -1); save(); }, onRight: () => { p.accent = cycle(BODY_COLORS, p.accent, 1); save(); } },
      { label: 'COLOR DEL AURA', value: () => (AURA_COLORS.find(a => a.c === p.aura) || {}).name || p.aura, onLeft: () => { p.aura = cycle(auraIds, p.aura, -1, auraOk); save(); }, onRight: () => { p.aura = cycle(auraIds, p.aura, 1, auraOk); save(); } },
      { label: 'ACCESORIO', value: () => (ACCESSORIES.find(a => a.id === p.accessory) || {}).name || '', onLeft: () => { p.accessory = cycle(accIds, p.accessory, -1, accOk); save(); }, onRight: () => { p.accessory = cycle(accIds, p.accessory, 1, accOk); save(); } },
      { label: 'VOLVER', onSelect: () => this.root() }
    ], { onBack: () => this.root(), onChange: () => this.lockedInfo() });
  }
  lockedInfo() {
    const lockedAura = AURA_COLORS.filter(a => !reqMet(a.req, Save.d)).map(a => `${a.name} (${reqText(a.req)})`);
    const lockedAcc = ACCESSORIES.filter(a => !reqMet(a.req, Save.d)).map(a => `${a.name} (${reqText(a.req)})`);
    this.descT.setText((lockedAura.length ? 'Auras bloqueadas: ' + lockedAura.slice(0, 4).join(', ') + '\n' : '') + (lockedAcc.length ? 'Accesorios bloqueados: ' + lockedAcc.slice(0, 4).join(', ') : '¡Todo desbloqueado!'));
  }

  loadout() {
    const lo = Save.d.loadout;
    this.setMenu([
      ...SLOTS.map(([k, name]) => ({ label: name, value: () => (MOVES[lo[k]] ? MOVES[lo[k]].name : '-'), onSelect: () => this.pickMove(k), m: MOVES[lo[k]] })),
      { label: 'VER LISTA DE MOVIMIENTOS', onSelect: () => { this.menu.active = false; this.scene.launch('MoveList', { from: 'Character' }); this.scene.bringToTop('MoveList'); this.scene.pause(); } },
      { label: 'VOLVER', onSelect: () => this.root() }
    ], { onBack: () => this.root(), onChange: it => this.moveInfo(it.m || (it.label && MOVES[lo[(SLOTS.find(s => s[1] === it.label) || [])[0]]])) });
    this.events.off('resume'); this.events.on('resume', () => { if (this.menu) this.menu.active = true; });
  }
  moveInfo(m) {
    if (!m) { this.descT.setText(''); return; }
    const h = m.hit || {};
    this.descT.setText(`${m.name.toUpperCase()}  ·  ${m.cost || 0} energía${m.cd ? ' · recarga ' + (m.cd / 60).toFixed(1) + 's' : ''}\n${m.desc || ''}${h.dmg ? '\nDaño ' + h.dmg : ''}${m.tip ? '\nContra: ' + m.tip : ''}`);
    const pose = m.anim && m.anim[Math.min(1, m.anim.length - 1)];
    this.prev.setAnim(pose && typeof pose[1] === 'string' ? pose[1] : 'guard');
  }
  pickMove(slot) {
    const d = Save.d;
    const pool = (slot === 'ult' ? ULT_IDS : SPECIAL_IDS).filter(id => d.unlockedMoves.includes(id));
    const equipped = Object.values(d.loadout);
    this.setMenu([
      ...pool.map(id => ({ label: MOVES[id].name, value: () => (d.loadout[slot] === id ? 'EQUIPADA' : equipped.includes(id) ? 'en uso' : ''), m: MOVES[id], onSelect: () => {
        // si ya está en otro hueco, intercambia
        const other = Object.keys(d.loadout).find(k => d.loadout[k] === id);
        if (other && other !== slot) d.loadout[other] = d.loadout[slot];
        d.loadout[slot] = id; Save.save(); Audio.play('coin'); this.loadout();
      } })),
      { label: 'VOLVER', onSelect: () => this.loadout() }
    ], { onBack: () => this.loadout(), onChange: it => this.moveInfo(it.m) });
    const cur = this.menu.items.findIndex(it => it.m && it.m.id === d.loadout[slot]);
    if (cur >= 0) { this.menu.idx = cur; this.moveInfo(this.menu.items[cur].m); }
  }

  shop() {
    const d = Save.d;
    const ri = rankFor(d.rankPoints).index;
    const ids = Object.keys(MOVE_SHOP).sort((a, b) => MOVE_SHOP[a].tier - MOVE_SHOP[b].tier || MOVE_SHOP[a].price - MOVE_SHOP[b].price);
    const items = ids.map(id => {
      const s = MOVE_SHOP[id];
      const owned = d.unlockedMoves.includes(id);
      const rankOk = ri >= s.rank || d.prestige > 0;
      return {
        label: (MOVES[id].slot === 'ult' ? '★ ' : '') + MOVES[id].name, m: MOVES[id],
        value: () => (d.unlockedMoves.includes(id) ? 'COMPRADA' : rankOk ? s.price + ' AP' : '🔒 ' + RANKS[s.rank].name),
        onSelect: () => {
          if (d.unlockedMoves.includes(id)) { Audio.play('ui_deny'); return; }
          if (!rankOk) { toast(this, 'Necesitas rango ' + RANKS[s.rank].name, '#ff4d6d'); return; }
          if (d.ap < s.price) { toast(this, 'Te faltan ' + (s.price - d.ap) + ' AP', '#ff4d6d'); return; }
          d.ap -= s.price; d.unlockedMoves.push(id); Save.save();
          const ach = Save.checkAchievements();
          ach.forEach((a, i) => toast(this, '🏆 ' + a.name, '#ffd166', 400 + i * 2800));
          toast(this, '¡Desbloqueada: ' + MOVES[id].name + '!', '#7df9ff');
          Audio.play('victory');
          this.refreshPreview();
        }
      };
      void owned;
    });
    items.push({ label: 'VOLVER', onSelect: () => this.root() });
    this.setMenu(items, { onBack: () => this.root(), onChange: it => this.moveInfo(it.m) });
  }

  celebration() {
    const p = Save.d.profile;
    const items = CELEBRATION_LIST.map(id => {
      const ok = reqMet(CELEBRATION_REQ[id], Save.d);
      return { label: CELEBRATIONS[id].name, locked: !ok, value: () => (p.celebration === id ? 'EQUIPADA' : ok ? '' : reqText(CELEBRATION_REQ[id])), id, onSelect: () => { p.celebration = id; Save.save(); this.root(); } };
    });
    items.push({ label: 'VOLVER', onSelect: () => this.root() });
    this.setMenu(items, { onBack: () => this.root(), onChange: it => { if (it.id) this.prev.setAnim(it.id); this.descT.setText(it.id ? 'Vista previa de la celebración' : ''); } });
  }

  titles() {
    const p = Save.d.profile;
    const items = TITLES.map(t => {
      const ok = reqMet(t.req, Save.d);
      return { label: t.name, locked: !ok, value: () => (p.title === t.id ? 'EQUIPADO' : ok ? '' : reqText(t.req)), onSelect: () => { p.title = t.id; Save.save(); this.root(); } };
    });
    items.push({ label: 'VOLVER', onSelect: () => this.root() });
    this.setMenu(items, { onBack: () => this.root() });
  }

  editName() {
    const p = Save.d.profile;
    this.menu.active = false;
    let name = p.name;
    const box = this.add.graphics().setDepth(80);
    box.fillStyle(0x000000, 0.8); box.fillRect(0, 0, 1280, 720);
    box.fillStyle(0x120c22, 1); box.fillRoundedRect(340, 270, 600, 180, 14); box.lineStyle(2, 0x7df9ff, 1); box.strokeRoundedRect(340, 270, 600, 180, 14);
    const t1 = txt(this, 640, 300, 'ESCRIBE TU NOMBRE', 28, '#ffffff', { ox: 0.5 }).setDepth(81);
    const t2 = txt(this, 640, 360, name + '_', 44, '#7df9ff', { ox: 0.5 }).setDepth(81);
    const t3 = txt(this, 640, 420, 'ENTER guardar · ESC cancelar', 16, '#9a94b8', { ox: 0.5, body: true }).setDepth(81);
    const close = (ok) => {
      pop();
      if (ok && name.trim()) { p.name = name.trim().toUpperCase(); Save.save(); }
      box.destroy(); t1.destroy(); t2.destroy(); t3.destroy();
      this.root();
    };
    const pop = Input.push((a, code) => {
      if (code === 'Enter' || code === 'NumpadEnter') return close(true);
      if (code === 'Escape') return close(false);
      if (code === 'Backspace') name = name.slice(0, -1);
      else if (name.length < 14) {
        if (code && code.startsWith('Key')) name += code.slice(3);
        else if (code && code.startsWith('Digit')) name += code.slice(5);
        else if (code === 'Space') name += ' ';
        else if (code === 'Minus') name += '-';
      }
      t2.setText(name + '_');
      Audio.play('ui_move');
    });
  }

  update() { Input.pollPad(); if (this.menu) this.menu.update(); this.prev.update(); }
}

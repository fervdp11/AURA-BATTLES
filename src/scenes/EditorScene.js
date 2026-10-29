// Editor de personaje y tienda de cosméticos: categorías, vista previa animada (prueba antes de comprar),
// compra con confirmación, equipar, rarezas con color propio, estados de bloqueo y guardado persistente.
// Los cosméticos son solo estética: no cambian estadísticas, hitboxes ni daño.
import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, panel, MenuList, StickPreview, go, fadeIn, keyHints, toast } from '../ui/UI.js';
import { SLOTS, RARITY, ofCat, isOwned, buy, equip, equippedId, byId, AVG_MATCH_AP } from '../data/cosmetics.js';
import { reqText } from '../data/progression.js';
import { playerProfile } from '../core/Match.js';

const CATS = Object.keys(SLOTS);
const SHOWCASE = ['guard', 'griddy', 'dab', 'siuuu', 'floss', 'flex'];
const RANK_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };

export class EditorScene extends Phaser.Scene {
  constructor() { super('Editor'); }
  init(data) { this.back = (data && data.back) || 'Character'; this.startCat = (data && data.cat) || 'body'; }
  create() {
    if (!this.scene.isActive('Demo')) this.scene.launch('Demo');
    this.scene.sendToBack('Demo');
    this.add.rectangle(640, 360, 1280, 720, 0x05030c, 0.9);
    txt(this, 40, 18, 'EDITOR DE PERSONAJE', 44, '#ffffff');
    this.apText = txt(this, 1240, 30, '', 26, '#7df9ff', { ox: 1 });
    this.catIdx = Math.max(0, CATS.indexOf(this.startCat));
    // pestañas de categoría
    this.tabG = this.add.graphics().setDepth(5);
    this.tabT = CATS.map((c, i) => {
      const t = txt(this, 0, 0, SLOTS[c], 13, '#c9c3e6', { ox: 0.5, oy: 0.5 }).setDepth(6);
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setCat(i));
      return t;
    });
    // panel de vista previa e información
    panel(this, 660, 120, 580, 560, { alpha: 0.6 });
    this.stage = this.add.graphics().setDepth(4);
    this.prev = new StickPreview(this, 860, 600, this.tryProfile(null), { scale: 2.5, anim: 'guard', depth: 8, glow: 1 });
    this.nameT = txt(this, 1000, 150, '', 30, '#ffffff', { wrap: 230 }).setDepth(9);
    this.rarT = txt(this, 1000, 0, '', 16, '#ffffff').setDepth(9);
    this.stateT = txt(this, 1000, 0, '', 16, '#e8e4ff', { body: true, wrap: 230 }).setDepth(9);
    this.noteT = txt(this, 1000, 0, 'Solo estética: no cambia estadísticas ni hitboxes.', 13, '#9a94b8', { body: true, wrap: 230 }).setDepth(9);
    this.menu = null;
    this.t = 0; this.showIdx = 0;
    this.setCat(this.catIdx);
    keyHints(this, '↑↓ elegir · ←→ / Q E categoría · ENTER comprar / equipar · ESC volver');
    fadeIn(this);
  }

  // perfil de prueba: lo equipado + el artículo seleccionado puesto encima (sin guardar)
  tryProfile(item) {
    const p = JSON.parse(JSON.stringify(playerProfile()));
    if (item) equip(p, item);
    return p;
  }

  items() {
    const cat = CATS[this.catIdx];
    return ofCat(cat).slice().sort((a, b) => (b.free - a.free) || RANK_ORDER[a.rarity] - RANK_ORDER[b.rarity] || a.price - b.price);
  }

  setCat(i) {
    this.catIdx = i;
    Audio.play('ui_move');
    const d = Save.d, prof = d.profile;
    const cat = CATS[i];
    const list = this.items().map(it => ({
      label: it.name, item: it, labelColor: RARITY[it.rarity].color, color: RARITY[it.rarity].color,
      value: () => {
        if (equippedId(prof, cat) === it.id) return 'EQUIPADO';
        if (isOwned(d, it)) return 'EN PROPIEDAD';
        return '🔒 ' + it.price + ' AP';
      },
      onLeft: () => this.setCat((this.catIdx - 1 + CATS.length) % CATS.length),
      onRight: () => this.setCat((this.catIdx + 1) % CATS.length),
      onSelect: () => this.choose(it)
    }));
    list.push({ label: 'VOLVER', onSelect: () => go(this, this.back), onLeft: () => this.setCat((this.catIdx - 1 + CATS.length) % CATS.length), onRight: () => this.setCat((this.catIdx + 1) % CATS.length) });
    if (this.menu) this.menu.destroy();
    this.menu = new MenuList(this, 40, 150, list, { w: 590, h: 40, gap: 4, size: 19, visible: 12, onBack: () => go(this, this.back), onChange: it => this.select(it.item), onKey: (a, code) => this.catKey(code) });
    // empieza en lo que llevas puesto
    const cur = list.findIndex(x => x.item && x.item.id === equippedId(prof, cat));
    if (cur >= 0) this.menu.idx = cur;
    this.select(list[this.menu.idx] && list[this.menu.idx].item);
    this.drawTabs();
  }

  catKey(code) {
    if (code === 'KeyQ') this.setCat((this.catIdx - 1 + CATS.length) % CATS.length);
    if (code === 'KeyE') this.setCat((this.catIdx + 1) % CATS.length);
  }

  drawTabs() {
    const g = this.tabG; g.clear();
    const n = CATS.length, x0 = 40, w = (1200) / n;
    CATS.forEach((c, i) => {
      const x = x0 + i * w, sel = i === this.catIdx;
      g.fillStyle(sel ? 0x2a1a55 : 0x120b24, sel ? 0.95 : 0.8); g.fillRoundedRect(x + 2, 88, w - 4, 44, 8);
      if (sel) { g.lineStyle(2, 0x7df9ff, 1); g.strokeRoundedRect(x + 2, 88, w - 4, 44, 8); }
      const t = this.tabT[i]; t.setPosition(x + w / 2, 110).setColor(sel ? '#ffffff' : '#9a94b8');
      t.setWordWrapWidth(w - 10); t.setAlign('center');
    });
  }

  select(item) {
    this.sel = item || null;
    this.prev.setProfile(this.tryProfile(item));
    this.refreshInfo();
  }

  refreshInfo() {
    const d = Save.d, it = this.sel;
    this.apText.setText(d.ap + ' AP');
    if (!it) { this.nameT.setText(''); this.rarT.setText(''); this.stateT.setText(''); return; }
    const R = RARITY[it.rarity];
    this.nameT.setText(it.name.toUpperCase());
    this.rarT.setText(R.name).setColor(R.color).setY(this.nameT.y + this.nameT.height + 6);
    let st;
    if (equippedId(d.profile, it.cat) === it.id) st = 'Equipado.';
    else if (isOwned(d, it)) st = 'En propiedad · ENTER para equipar.';
    else {
      const partidas = Math.round(it.price / AVG_MATCH_AP);
      st = `Precio: ${it.price} AP (≈ ${partidas} partidas)\n` + (d.ap >= it.price ? 'ENTER para comprar.' : `Te faltan ${it.price - d.ap} AP.`);
      if (it.data.req) st += `\nGratis al conseguir: ${reqText(it.data.req)}`;
    }
    this.stateT.setText(st).setY(this.rarT.y + 28);
    this.noteT.setY(this.stateT.y + this.stateT.height + 12);
  }

  choose(it) {
    const d = Save.d;
    if (isOwned(d, it)) {
      equip(d.profile, it); Save.save(); Audio.play('coin');
      this.prev.setProfile(this.tryProfile(null)); this.refreshInfo();
      return;
    }
    if (d.ap < it.price) { toast(this, 'Te faltan ' + (it.price - d.ap) + ' AP', '#ff4d6d'); Audio.play('ui_deny'); return; }
    this.confirm(`¿Comprar ${it.name} por ${it.price} AP?`, () => {
      const r = buy(d, it);
      if (!r.ok) { toast(this, r.reason === 'ap' ? 'Te faltan ' + r.missing + ' AP' : 'Ya lo tienes', '#ff4d6d'); return; }
      equip(d.profile, it); Save.save();
      const ach = Save.checkAchievements();
      ach.forEach((a, i) => toast(this, '🏆 ' + a.name, '#ffd166', 400 + i * 2800));
      toast(this, '¡' + it.name + ' desbloqueado!', RARITY[it.rarity].color);
      Audio.play('victory');
      this.prev.setAnim(SHOWCASE[1 + (this.showIdx++ % (SHOWCASE.length - 1))]);
      this.refreshInfo();
    });
  }

  // confirmación de compra (evita compras accidentales)
  confirm(text, onYes) {
    this.menu.active = false;
    const g = this.add.graphics().setDepth(80);
    g.fillStyle(0x000000, 0.7); g.fillRect(0, 0, 1280, 720);
    g.fillStyle(0x120c22, 1); g.fillRoundedRect(330, 280, 620, 160, 14); g.lineStyle(2, 0xffd166, 1); g.strokeRoundedRect(330, 280, 620, 160, 14);
    const t1 = txt(this, 640, 330, text, 24, '#ffffff', { ox: 0.5, oy: 0.5, wrap: 580, align: 'center' }).setDepth(81);
    const t2 = txt(this, 640, 400, 'ENTER confirmar · ESC cancelar', 16, '#9a94b8', { ox: 0.5, body: true }).setDepth(81);
    this.modal = true;
    const close = ok => { pop(); g.destroy(); t1.destroy(); t2.destroy(); this.modal = false; this.time.delayedCall(50, () => { if (this.menu) this.menu.active = true; }); if (ok) onYes(); };
    const pop = Input.push((a, code) => {
      if (a === 'confirm' || code === 'Enter') close(true);
      else if (a === 'back' || code === 'Escape') { Audio.play('ui_back'); close(false); }
    });
  }

  update() {
    Input.pollPad();
    if (this.menu) this.menu.update();
    this.t++;
    // vitrina: alterna animaciones (la ropa se mueve con el cuerpo) y gira de vez en cuando
    if (this.t % 200 === 0) { this.prev.setAnim(SHOWCASE[this.showIdx++ % SHOWCASE.length]); if (this.t % 600 === 0) this.prev.facing *= -1; }
    const g = this.stage; g.clear();
    for (let i = 0; i < 6; i++) { g.fillStyle(0x7df9ff, 0.025 * (6 - i)); g.fillEllipse(860, 604, 260 - i * 30, 40 - i * 4); }
    this.prev.update();
    const it = this.sel;
    if (it) { g.fillStyle(Phaser.Display.Color.HexStringToColor(RARITY[it.rarity].color).color, 1); g.fillRect(1000, 140, 6, 6); }
    void byId;
  }
}

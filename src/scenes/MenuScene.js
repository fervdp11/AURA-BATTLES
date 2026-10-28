import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, panel, MenuList, StickPreview, go, fadeIn, keyHints } from '../ui/UI.js';
import { rankFor } from '../data/progression.js';
import { playerProfile } from '../core/Match.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    if (!this.scene.isActive('Demo')) { this.scene.launch('Demo'); }
    this.scene.sendToBack('Demo');
    Audio.music('menu');
    Audio.muffle(false);
    const d = Save.d;
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x05030c, 0x05030c, 0x05030c, 0x05030c, 0.88, 0.2, 0.88, 0.2);
    shade.fillRect(0, 0, 1280, 720);
    this.title = txt(this, 70, 50, 'AURA LEGENDS', 84, '#ffffff', { strokeThickness: 9 });
    this.title.setShadow(0, 0, '#7df9ff', 26, true, true);
    txt(this, 76, 140, 'El aura es tu vida. No la pierdas.', 22, '#ffd166');
    const items = [
      { label: '1 JUGADOR · CONTRA BOTS', desc: 'Combate rápido contra la IA: 1v1, 1v2, 1v3 o contra un jefe.', onSelect: () => go(this, 'Play') },
      { label: '2 JUGADORES · LOCAL', desc: 'Multijugador local 1v1 en el mismo teclado (J1: WASD + F G H R T V · J2: flechas + J K L I O P). También con mandos.', color: '#ff5fa2', onSelect: () => go(this, 'LocalSetup') },
      { label: 'CAMINO DEL AURA', desc: 'Modo historia: 8 capítulos de rivales cada vez más fuertes y jefes finales.', onSelect: () => go(this, 'Path') },
      { label: 'SUPERVIVENCIA', desc: 'Oleadas infinitas de bots. ¿Cuánto aguanta tu aura?', onSelect: () => go(this, 'Versus', { spec: { mode: 'survival', wave: 1 } }) },
      { label: 'DUELO PERSONALIZADO', desc: 'Elige rival entre más de 100 bots, dificultad, escenario y reglas.', onSelect: () => go(this, 'Custom') },
      { label: 'ENTRENAMIENTO', desc: 'Practica combos y movimientos contra un muñeco configurable.', onSelect: () => go(this, 'Fight', { spec: { mode: 'training', enemies: null } }) },
      { label: 'PERSONAJE', desc: 'Apariencia, movimientos equipados, tienda de técnicas, celebraciones y títulos.', onSelect: () => go(this, 'Character') },
      { label: 'PRESTIGIO', desc: 'Prestigio, estadísticas y logros.', onSelect: () => go(this, 'Prestige') },
      { label: 'AJUSTES', desc: 'Audio, controles personalizables, vídeo y datos.', onSelect: () => go(this, 'Settings') }
    ];
    this.desc = txt(this, 76, 660, '', 18, '#c9c3e6', { body: true });
    this.menu = new MenuList(this, 70, 186, items, { w: 470, h: 46, gap: 6, onChange: it => this.desc.setText(it.desc) });
    this.desc.setText(items[this.menu.idx].desc);
    // panel de perfil
    const r = rankFor(d.rankPoints);
    panel(this, 860, 120, 360, 470, { alpha: 0.72 });
    this.preview = new StickPreview(this, 1040, 500, playerProfile(), { scale: 1.45, anim: 'guard', depth: 6 });
    txt(this, 1040, 140, d.profile.name, 34, '#ffffff', { ox: 0.5 });
    txt(this, 1040, 182, r.name.toUpperCase() + (d.prestige ? `  ·  ★${d.prestige}` : ''), 24, r.color, { ox: 0.5 });
    const bar = this.add.graphics();
    bar.fillStyle(0x000000, 0.6); bar.fillRoundedRect(900, 220, 280, 12, 6);
    bar.fillStyle(Phaser.Display.Color.HexStringToColor(r.color).color, 1); bar.fillRoundedRect(900, 220, 280 * Math.min(1, r.progress), 12, 6);
    txt(this, 1040, 238, r.next ? `${d.rankPoints} / ${r.next.rp} PR` : `${d.rankPoints} PR · MÁXIMO`, 15, '#9a94b8', { ox: 0.5, body: true });
    txt(this, 900, 520, `Victorias  ${d.stats.wins}`, 20, '#7bd389');
    txt(this, 900, 548, `Derrotas  ${d.stats.losses}`, 20, '#ff6b6b');
    txt(this, 1180, 520, `Racha ${d.stats.streak}`, 20, '#ffd166', { ox: 1 });
    txt(this, 1180, 548, `${d.ap} AP`, 20, '#7df9ff', { ox: 1 });
    keyHints(this, '↑↓ navegar   ·   ENTER / Z seleccionar   ·   ESC / X volver');
    this.t = 0;
    fadeIn(this);
    const ach = Save.checkAchievements();
    void ach;
  }
  update() {
    this.t++;
    Input.pollPad();
    this.menu.update();
    this.preview.update();
    this.title.setShadow(0, 0, Phaser.Display.Color.HSLToColor(((this.t * 0.4) % 360) / 360, 1, 0.6).rgba, 26 + Math.sin(this.t * 0.08) * 8, true, true);
  }
}

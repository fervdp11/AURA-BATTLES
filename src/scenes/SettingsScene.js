import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input, DEFAULT_BINDINGS, ACTION_LABELS, keyName } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, panel, MenuList, go, fadeIn, keyHints, toast } from '../ui/UI.js';

export class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }
  create() {
    if (!this.scene.isActive('Demo')) this.scene.launch('Demo');
    this.scene.sendToBack('Demo');
    this.add.rectangle(640, 360, 1280, 720, 0x05030c, 0.86);
    txt(this, 50, 24, 'AJUSTES', 56, '#ffffff');
    this.help = txt(this, 820, 140, '', 18, '#e8e4ff', { body: true, wrap: 400 });
    panel(this, 800, 110, 440, 300, { alpha: 0.6 });
    this.menu = null;
    this.main();
    keyHints(this, '↑↓ elegir · ←→ cambiar · ENTER confirmar · ESC volver');
    fadeIn(this);
  }
  setMenu(items, back) {
    if (this.menu) this.menu.destroy();
    this.menu = new MenuList(this, 50, 110, items, { w: 700, h: 44, gap: 5, size: 22, visible: 12, onBack: back, onChange: it => this.help.setText(it.help || '') });
    this.help.setText(items[0].help || '');
  }
  main() {
    const st = Save.d.settings;
    const sv = () => { Save.save(); Audio.setVolumes(st.music, st.sfx); };
    const vol = (k, dlt) => { st[k] = Math.max(0, Math.min(1, Math.round((st[k] + dlt) * 10) / 10)); sv(); if (k === 'sfx') Audio.play('hitMed'); };
    const tog = k => { st[k] = !st[k]; sv(); };
    const yn = v => (v ? 'SÍ' : 'NO');
    this.setMenu([
      { label: 'MÚSICA', value: () => Math.round(st.music * 100) + '%', onLeft: () => vol('music', -0.1), onRight: () => vol('music', 0.1), help: 'Volumen de la música phonk generada en tiempo real.' },
      { label: 'EFECTOS', value: () => Math.round(st.sfx * 100) + '%', onLeft: () => vol('sfx', -0.1), onRight: () => vol('sfx', 0.1), help: 'Volumen de golpes, auras y efectos (sin voces).' },
      { label: 'TEMBLOR DE PANTALLA', value: () => Math.round(st.shake * 100) + '%', onLeft: () => { st.shake = Math.max(0, Math.round((st.shake - 0.25) * 4) / 4); sv(); }, onRight: () => { st.shake = Math.min(1.5, Math.round((st.shake + 0.25) * 4) / 4); sv(); }, help: 'Intensidad del screen shake.' },
      { label: 'NÚMEROS DE DAÑO', value: () => yn(st.damageNumbers), onLeft: () => tog('damageNumbers'), onRight: () => tog('damageNumbers') },
      { label: 'CALIDAD GRÁFICA', value: () => st.quality.toUpperCase(), onLeft: () => { st.quality = st.quality === 'alta' ? 'baja' : 'alta'; sv(); }, onRight: () => { st.quality = st.quality === 'alta' ? 'baja' : 'alta'; sv(); }, help: 'ALTA: bloom, viñeta y todas las partículas. BAJA: para equipos modestos.' },
      { label: 'MOSTRAR HITBOXES', value: () => yn(st.hitboxes), onLeft: () => tog('hitboxes'), onRight: () => tog('hitboxes'), help: 'Muestra cajas de golpe (rojo) y de daño (verde).' },
      { label: 'MOSTRAR FPS', value: () => yn(st.showFps), onLeft: () => tog('showFps'), onRight: () => tog('showFps') },
      { label: 'PANTALLA COMPLETA', onSelect: () => { if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen(); } },
      { label: 'CONTROLES', onSelect: () => this.controls(), help: 'Cambia la tecla de cada acción.' },
      { label: 'BORRAR PROGRESO', color: '#ff4d6d', onSelect: () => this.wipe(), help: 'Elimina todo el progreso guardado en este navegador.' },
      { label: 'VOLVER', onSelect: () => go(this, 'Menu') }
    ], () => go(this, 'Menu'));
  }
  controls() {
    const st = Save.d.settings;
    const actions = Object.keys(DEFAULT_BINDINGS);
    const items = actions.map(a => ({
      label: ACTION_LABELS[a], value: () => Input.codesFor(a).map(keyName).join(' / '), help: 'ENTER y pulsa la nueva tecla. ESC cancela.',
      onSelect: () => {
        this.menu.active = false;
        this.help.setText(`Pulsa una tecla para "${ACTION_LABELS[a]}"…`);
        Input.captureNext(code => {
          if (code !== 'Escape') {
            const b = JSON.parse(JSON.stringify(Input.bindings));
            for (const k in b) b[k] = b[k].filter(c => c !== code);
            b[a] = [code];
            Input.setBindings(b);
            st.bindings = Input.bindings; Save.save();
            Audio.play('ui_select');
          }
          this.time.delayedCall(50, () => { this.menu.active = true; this.help.setText('Tecla asignada.'); });
        });
      }
    }));
    items.push({ label: 'RESTABLECER CONTROLES', onSelect: () => { Input.setBindings(DEFAULT_BINDINGS); st.bindings = null; Save.save(); toast(this, 'Controles restablecidos', '#7df9ff'); } });
    items.push({ label: 'VOLVER', onSelect: () => this.main() });
    this.setMenu(items, () => this.main());
  }
  wipe() {
    if (!this.confirmWipe) { this.confirmWipe = true; toast(this, 'Pulsa otra vez para BORRAR TODO', '#ff4d6d'); this.time.delayedCall(3000, () => { this.confirmWipe = false; }); return; }
    Save.reset(); Input.setBindings(DEFAULT_BINDINGS);
    toast(this, 'Progreso borrado', '#ff4d6d');
    this.confirmWipe = false;
    this.main();
  }
  update() { Input.pollPad(); this.menu.update(); }
}

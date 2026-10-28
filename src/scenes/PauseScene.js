import Phaser from 'phaser';
import { Save } from '../core/Save.js';
import { Input } from '../core/Input.js';
import { Audio } from '../core/Audio.js';
import { txt, panel, MenuList, keyHints } from '../ui/UI.js';
import { DummyController, LEVELS } from '../sim/AI.js';

const DUMMY_MODES = ['stand', 'crouch', 'block', 'lowblock', 'jump', 'parry', 'cpu'];
const DUMMY_NAMES = { stand: 'QUIETO', crouch: 'AGACHADO', block: 'BLOQUEA', lowblock: 'BLOQUEA BAJO', jump: 'SALTA', parry: 'PARRY', cpu: 'CPU' };

export class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }
  init(data) { this.fight = data.fight; }
  create() {
    const fs = this.fight;
    const spec = fs.spec;
    const st = Save.d.settings;
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.65);
    panel(this, 390, 90, 500, 560, { alpha: 0.92 });
    txt(this, 640, 110, 'PAUSA', 64, '#ffffff', { ox: 0.5 });
    const training = spec.mode === 'training';
    const items = [
      { label: 'CONTINUAR', onSelect: () => this.close() },
      { label: 'LISTA DE MOVIMIENTOS', onSelect: () => { this.menu.active = false; this.scene.launch('MoveList', { from: 'Pause' }); this.scene.pause(); } }
    ];
    if (training) {
      const setDummy = () => {
        const d = fs.battle.fighters.find(f => !f.isHuman);
        const c = new DummyController(spec.dummyMode);
        c.setMode(spec.dummyMode, spec.cpuLevel ?? 3);
        if (d) { d.dummyCtrl = c; d.controller = c; }
      };
      items.push(
        { label: 'MUÑECO', value: () => DUMMY_NAMES[spec.dummyMode], onLeft: () => { spec.dummyMode = DUMMY_MODES[(DUMMY_MODES.indexOf(spec.dummyMode) + DUMMY_MODES.length - 1) % DUMMY_MODES.length]; setDummy(); }, onRight: () => { spec.dummyMode = DUMMY_MODES[(DUMMY_MODES.indexOf(spec.dummyMode) + 1) % DUMMY_MODES.length]; setDummy(); } },
        { label: 'NIVEL CPU', value: () => LEVELS[spec.cpuLevel ?? 3].name, onLeft: () => { spec.cpuLevel = Math.max(0, (spec.cpuLevel ?? 3) - 1); setDummy(); }, onRight: () => { spec.cpuLevel = Math.min(6, (spec.cpuLevel ?? 3) + 1); setDummy(); } },
        { label: 'ENERGÍA INFINITA', value: () => (fs.battle.player.infiniteEnergy ? 'SÍ' : 'NO'), onRight: () => { fs.battle.player.infiniteEnergy = !fs.battle.player.infiniteEnergy; }, onLeft: () => { fs.battle.player.infiniteEnergy = !fs.battle.player.infiniteEnergy; } },
        { label: 'SIN RECARGAS', value: () => (spec.noCooldowns ? 'SÍ' : 'NO'), onRight: () => { spec.noCooldowns = !spec.noCooldowns; }, onLeft: () => { spec.noCooldowns = !spec.noCooldowns; } },
        { label: 'HITBOXES', value: () => (fs.view.opts.hitboxes ? 'SÍ' : 'NO'), onRight: () => { fs.view.opts.hitboxes = !fs.view.opts.hitboxes; }, onLeft: () => { fs.view.opts.hitboxes = !fs.view.opts.hitboxes; } },
        { label: 'RESETEAR POSICIONES', onSelect: () => { fs.resetPositions(); this.close(); } }
      );
    } else {
      items.push({ label: 'REINICIAR COMBATE', onSelect: () => { this.scene.stop(); fs.scene.restart({ spec: { ...spec, enemies: spec.mode === 'survival' ? null : spec.enemies, wave: 1 } }); } });
    }
    items.push(
      { label: 'MÚSICA', value: () => Math.round(st.music * 100) + '%', onLeft: () => this.vol('music', -0.1), onRight: () => this.vol('music', 0.1) },
      { label: 'EFECTOS', value: () => Math.round(st.sfx * 100) + '%', onLeft: () => this.vol('sfx', -0.1), onRight: () => this.vol('sfx', 0.1) },
      { label: 'SALIR AL MENÚ', color: '#ff4d6d', onSelect: () => { this.scene.stop('HUD'); this.scene.stop(); fs.scene.stop(); Audio.muffle(false); this.scene.start('Menu'); } }
    );
    this.menu = new MenuList(this, 420, 190, items, { w: 440, h: 40, gap: 5, size: 22, visible: 10, onBack: () => this.close() });
    keyHints(this, '↑↓ elegir · ←→ cambiar · ENTER confirmar · ESC continuar');
    this.events.on('resume', () => { this.menu.active = true; });
  }
  vol(k, d) {
    const st = Save.d.settings;
    st[k] = Math.max(0, Math.min(1, Math.round((st[k] + d) * 10) / 10));
    Audio.setVolumes(st.music, st.sfx);
    Save.save();
  }
  close() {
    Audio.play('ui_back');
    this.scene.stop();
    this.fight.resume();
  }
  update() { Input.pollPad(); this.menu.update(); }
}

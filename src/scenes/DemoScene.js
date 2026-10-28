import Phaser from 'phaser';
import { Battle } from '../sim/Battle.js';
import { AIController } from '../sim/AI.js';
import { BattleView } from '../view/BattleView.js';
import { BOTS } from '../data/bots.js';
import { ARENAS } from '../view/Arena.js';
import { botProfile } from '../core/Match.js';

// Combate IA vs IA real que se ejecuta de fondo en los menús
export class DemoScene extends Phaser.Scene {
  constructor() { super('Demo'); }
  create() {
    this.newBattle();
    this.events.once('shutdown', () => { if (this.view) this.view.destroy(); this.view = null; });
  }
  newBattle() {
    if (this.view) this.view.destroy();
    const pick = () => BOTS.filter(b => b.level >= 3)[Math.floor(Math.random() * BOTS.filter(b => b.level >= 3).length)];
    const a = pick(), c = pick();
    const arena = ARENAS[Math.floor(Math.random() * ARENAS.length)].id;
    this.battle = new Battle({
      fighters: [
        { team: 0, profile: botProfile(a), loadout: a.loadout, controller: new AIController({ level: 5, style: a.style }), energy: 60 },
        { team: 1, profile: botProfile(c), loadout: c.loadout, controller: new AIController({ level: 5, style: c.style }), energy: 60 }
      ], timer: 60, seed: (Math.random() * 1e9) | 0
    });
    this.view = new BattleView(this, this.battle, { arena, silent: true, shake: 0.3, damageNumbers: false, quality: 'baja' });
    this.acc = 0;
  }
  update(time, delta) {
    if (!this.view) return;
    this.acc += Math.min(delta, 50);
    let n = 0;
    while (this.acc >= 16.667 && n < 4) {
      this.battle.step({}); this.acc -= 16.667; n++;
      if (this.battle.phase === 'over' && this.battle.phaseT > 150) { this.newBattle(); return; }
    }
    this.view.update(delta);
  }
}

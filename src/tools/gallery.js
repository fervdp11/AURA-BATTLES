// Galería de depuración: dibuja poses, movimientos y celebraciones con el render real.
// gallery.html?set=poses|moves|move:<id>|celebs|defeats&facing=-1&from=0&n=24&dist=90&scale=1
import Phaser from 'phaser';
import '../view/GraphicsPatch.js';
import { Battle } from '../sim/Battle.js';
import { MOVES } from '../sim/moves.js';
import { POSES } from '../sim/poses.js';
import { CELEBRATIONS, DEFEATS } from '../sim/celebrations.js';
import { computeJoints, makePose } from '../sim/skeleton.js';
import { playCelebration } from '../sim/Fighter.js';
import { drawFighter, drawBody, hex } from '../view/StickRenderer.js';
import { emptyInput } from '../sim/constants.js';

const Q = new URLSearchParams(location.search);
const set = Q.get('set') || 'poses';
const facing = +(Q.get('facing') || 1);
const from = +(Q.get('from') || 0), n = +(Q.get('n') || 24);
const dist = +(Q.get('dist') || 95);
const scl = +(Q.get('scale') || 1);
const Z = +(Q.get('z') || 1);
const COLS = Math.round(6 / Z), CW = 1440 / COLS, CH = 270 * Z;
const lookA = { body: 0xf4f4f8, accent: 0xffd166, aura: 0x7df9ff, accessory: 'cap', outline: 0x0a0a14 };
const lookB = { body: 0xff8fab, accent: 0x4cc9f0, aura: 0xff5fa2, accessory: 'none', outline: 0x0a0a14 };

class G extends Phaser.Scene {
  constructor() { super('G'); }
  create() {
    const items = [];
    if (set === 'poses') for (const k of Object.keys(POSES)) items.push({ label: k, pose: k });
    else if (set === 'celebs') for (const k of Object.keys(CELEBRATIONS)) for (const fr of [20, 45, 80]) items.push({ label: k + '@' + fr, celeb: CELEBRATIONS[k], fr });
    else if (set === 'defeats') for (const k of Object.keys(DEFEATS)) for (const fr of [10, 30, 60]) items.push({ label: k + '@' + fr, celeb: DEFEATS[k], fr });
    else if (set === 'moves') for (const k of Object.keys(MOVES)) items.push({ label: k, move: k, fr: Q.get('frame') ? +Q.get('frame') : null });
    else if (set.startsWith('move:')) { const id = set.slice(5); const m = MOVES[id]; const tot = m.startup + m.active + m.recovery + 60; for (let f = 0; f < Math.min(tot, 160); f += Math.max(2, Math.round(tot / 24))) items.push({ label: id + ' f' + f, move: id, fr: f }); }
    const list = items.slice(from, from + n);
    list.forEach((it, i) => this.cell(it, i));
    this.add.text(4, 4, `${set} facing=${facing} ${from}-${from + list.length}/${items.length}`, { fontSize: '14px', color: '#fff' });
    window.__done = true;
  }
  cell(it, i) {
    const cx = (i % COLS) * CW, cy = Math.floor(i / COLS) * CH + 20;
    const g = this.add.graphics(), gl = this.add.graphics().setBlendMode('ADD'), dbg = this.add.graphics();
    const k = 0.95 * Z;
    const wx = 1000, wy = 600;
    for (const o of [g, gl, dbg]) { o.setScale(k); o.setPosition(cx + CW / 2 - wx * k, cy + CH - 30 - wy * k); }
    g.fillStyle(0x1a1430, 1); g.fillRect(wx - CW / 2 / k + 2, wy - (CH - 30) / k, CW / k - 4, CH / k - 4);
    g.lineStyle(1, 0x555577, 1); g.lineBetween(wx - CW / 2 / k, wy, wx + CW / 2 / k, wy);
    if (it.pose || it.celeb) {
      const p = makePose(POSES[it.pose] || POSES.idle);
      if (it.celeb) playCelebration(it.celeb, it.fr, p);
      const j = computeJoints(p, wx, wy, facing, scl, true, {});
      drawBody(g, gl, j, p, scl, lookA, 1, { glow: +(Q.get('glow') ?? 0.6), time: 30 });
    } else if (it.move) {
      const b = new Battle({ fighters: [{ team: 0, profile: { name: 'A', scale: scl }, controller: { getInput: () => emptyInput() } }, { team: 1, profile: { name: 'B' }, controller: { getInput: () => emptyInput() } }], seed: 2, timer: 0 });
      while (b.phase !== 'fight') b.step({});
      const [A, B] = b.fighters;
      A.x = wx - facing * dist / 2; B.x = wx + facing * dist / 2; A.facing = facing; B.facing = -facing;
      A.energy = 100; A.aura = 300;
      for (let s = 0; s < 3; s++) b.step({});
      A.startMove(it.move, { free: true });
      const target = it.fr ?? (MOVES[it.move].startup + 1);
      for (let s = 0; s < target; s++) { b.step({}); b.hitstop = 0; b.freeze = null; }
      for (const f of b.fighters) drawFighter(g, gl, f, f === A ? lookA : lookB, { glow: 0.5, time: 30 });
      dbg.lineStyle(1, 0x00ff00, 0.5); dbg.strokeRect(B.hurt.x, B.hurt.y, B.hurt.w, B.hurt.h);
      const hb = b.moveHitbox(A); if (hb) { dbg.lineStyle(2, 0xff3333, 0.9); dbg.strokeRect(hb.x, hb.y, hb.w, hb.h); }
      for (const p of b.projectiles) { const bx = b.pbox(p); dbg.lineStyle(1, 0xffaa00, 1); dbg.strokeRect(bx.x, bx.y, bx.w, bx.h); }
    }
    this.add.text(cx + 6, cy + 2, it.label, { fontSize: '13px', color: '#9be7ff' });
  }
}
new Phaser.Game({ type: Phaser.WEBGL, parent: 'g', width: 1440, height: Math.ceil(n / COLS) * CH + 30, backgroundColor: '#0b0816', scene: [G] });

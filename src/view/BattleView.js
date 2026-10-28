// Vista del combate: dibuja luchadores, proyectiles y estados; traduce eventos de la simulación en
// efectos, sonido, reacciones del escenario y cámara dinámica.
import { Arena } from './Arena.js';
import { FX } from './FX.js';
import { drawFighter, drawBody, hex, shade, hsl, heartShape, mix } from './StickRenderer.js';
import { Audio } from '../core/Audio.js';
import { MOVES } from '../sim/moves.js';
import { POSES, MODS } from '../sim/poses.js';
import { computeJoints, makePose, copyPose, cloneJoints } from '../sim/skeleton.js';
import { GROUND_Y, ARENA_W, WALL_L, WALL_R } from '../sim/constants.js';
import { drawShark, drawCrocPlane, drawTungTung, drawBallerina, drawRoots, drawLirili } from './Brainrot.js';

const STRENGTH_SFX = { light: 'hitLight', medium: 'hitMed', heavy: 'hitHeavy', mega: 'hitMega' };
// firma sonora (sin voces) de cada técnica al lanzarla
const MOVE_SFX = {
  sixSeven: ['tauntHorn'], sixSevenBarrage: ['tauntHorn', 'ultCast'], fakeHandshake: ['swish'], mewing: ['mewClick'], infiniteMewing: ['mewClick', 'sparkle'],
  sigmaStare: ['sigmaHum'], sigmaTeleport: ['sigmaHum', 'teleport'], sigmaRule: ['sigmaHum'], rizz: ['kissPop', 'rizzChime'], rizzStorm: ['rizzChime'],
  siuuu: ['whooshHeavy'], auraWalk: ['fingerSnap'], auraFarming: ['sparkle'], griddy: ['scratch'], flossShield: ['scratch'], skibidiSpin: ['scratch'],
  unoReverse: ['card'], clapBack: ['swish'], tungTung: ['woodKnock'], bombardiro: ['planeEngine'], ballerinaSpin: ['musicBox'], timeStop: ['rewind'],
  perfectlyBalanced: ['fingerSnap'], letHimCook: ['fire'], caughtIn4K: ['shutter'], rickroll: ['tauntHorn'], ggEz: ['tauntHorn'], lBozo: ['tauntHorn'],
  broReallyThought: ['tauntHorn'], skillIssue: ['tauntHorn'], micDrop: ['swish'], dealWithIt: ['swish'], mainCharacter: ['sparkle'], ohioMode: ['glitch'],
  lagSpike: ['glitch'], afk: ['heartbeat'], thisIsFine: ['fire'], stonks: ['coin'], bigBrain: ['energyFull'], narutoRun: ['dash'], speedrun: ['dash'],
  snapWalk: ['fingerSnap'], sixSevenSlam: ['tauntHorn'], fakeGreeting: ['swish'], handshakeHeadbutt: ['swish'], doubleSlap: ['whooshHeavy'], mewingGlare: ['mewClick'],
  sigmaTurn: ['sigmaHum'], rizzLean: ['rizzChime'], menacingPose: ['sigmaHum'], tralalero: ['bubbles'], brrPatapim: ['woodKnock'], liriliLarila: ['tick'],
  ballerinaCappuccina: ['musicBox', 'pirouette'], shoulderBrush: ['swish'], defaultDance: ['scratch'], headPalm: ['swish'], brainrotInvasion: ['ultCast', 'bubbles'], mainCharacterEnding: ['sigmaHum'],
  domainExpansion: ['domain'], finalAuraJudgment: ['ultCast'], ultimateNonchalance: ['sigmaHum'], coffinDance: ['tauntHorn'], auraOverload: ['ultCast']
};
const SHAKE = { light: [0, 0], medium: [70, 0.0025], heavy: [130, 0.005], mega: [240, 0.01] };
const _ghostPose = makePose(POSES.dash);
const _ghostJ = {};

export class BattleView {
  constructor(scene, battle, opts = {}) {
    this.scene = scene; this.b = battle; this.opts = opts;
    this.shakeMul = opts.shake ?? 1;
    this.arena = new Arena(scene, opts.arena || 'rooftop', { quality: opts.quality });
    const add = scene.add;
    this.gRefl = add.graphics().setDepth(-50).setAlpha(this.arena.reflect);
    this.gShadow = add.graphics().setDepth(-5);
    this.gBack = add.graphics().setDepth(5);
    this.gGlow = add.graphics().setDepth(8).setBlendMode('ADD');
    this.gBody = add.graphics().setDepth(10);
    this.gProj = add.graphics().setDepth(20);
    this.gProjAdd = add.graphics().setDepth(21).setBlendMode('ADD');
    this.gOver = add.graphics().setDepth(25);
    this.gOverAdd = add.graphics().setDepth(26).setBlendMode('ADD');
    this.gDebug = add.graphics().setDepth(90);
    this.dim = add.rectangle(ARENA_W / 2, 0, 9000, 6000, 0x000000, 1).setDepth(-20).setAlpha(0);
    this.dimTarget = 0;
    this.fx = new FX(scene, opts.quality);
    this.looks = new Map();
    this.ghosts = new Map();
    this.wtrails = new Map();
    this.cam = scene.cameras.main;
    this.cam.setBackgroundColor('#05030c');
    this.cs = { x: ARENA_W / 2, y: GROUND_Y - 170, zoom: 1.25, punch: 0, focus: null };
    this.t = 0;
    this.colorFx = null;
    this.vignette = null;
    this.bloom = null;
    if (opts.quality !== 'baja' && this.cam.postFX) {
      // sin bloom de cámara: sin umbral lava los colores; el brillo lo aportan las capas aditivas propias
      try { this.vignette = this.cam.postFX.addVignette(0.5, 0.5, 0.92, 0.35); } catch (e) { this.vignette = null; }
    }
    for (const f of battle.fighters) this.lookFor(f);
    this.cam.centerOn(this.cs.x, this.cs.y);
    this.cam.setZoom(this.cs.zoom);
  }

  sfx(n, o) { if (!this.opts.silent) Audio.play(n, o); }
  // sonido posicionado en estéreo según la x de mundo
  sfxAt(n, x, o = {}) { if (this.opts.silent) return; const half = 640 / (this.cs.zoom || 1); Audio.play(n, { ...o, pan: (x - this.cs.x) / half }); }
  duck(a, b) { if (!this.opts.silent) Audio.duck(a, b); }

  lookFor(f) {
    let l = this.looks.get(f.id);
    if (l) return l;
    const p = f.profile;
    const rainbow = p.aura === 'rainbow';
    l = {
      body: hex(p.color || '#f4f4f8'), accent: hex(p.accent || '#ffd166'), aura: rainbow ? 0xffffff : hex(p.aura || '#7df9ff'),
      accessory: p.accessory || 'none', outline: p.boss ? 0x14000a : 0x0a0a14,
      auraFn: rainbow ? (t => hsl((t * 3) % 360, 1, 0.6)) : null
    };
    this.looks.set(f.id, l);
    return l;
  }

  // ------------------------------------------------------------
  update(dtMs) {
    const k = dtMs / 16.667;
    this.t += k;
    for (const e of this.b.drainEvents()) this.onEvent(e);
    this.arena.update(k);
    this.drawFighters();
    this.drawProjectiles();
    this.fx.update();
    this.updateCamera(k);
    if (this.opts.hitboxes) this.drawDebug(); else this.gDebug.clear();
    this.dim.alpha += (this.dimTarget - this.dim.alpha) * 0.15;
  }

  // ------------------------------------------------------------
  drawFighters() {
    const b = this.b, gb = this.gBody, gg = this.gGlow, go = this.gOver, ga = this.gOverAdd, gs = this.gShadow, gk = this.gBack;
    gb.clear(); gg.clear(); go.clear(); ga.clear(); gs.clear(); gk.clear(); this.gRefl.clear();
    const list = [...b.fighters].sort((a, c) => (a.alive ? 1 : 0) - (c.alive ? 1 : 0) || (a.state === 'attack' ? 1 : 0) - (c.state === 'attack' ? 1 : 0));
    const multi = b.fighters.filter(f => !f.decoyOf).length > 2;
    for (const f of list) {
      const look = this.lookFor(f);
      if (f.decoyOf) Object.assign(look, this.lookFor(f.decoyOf));
      // sombra
      const hAbove = Math.max(0, GROUND_Y - f.y);
      if (f.visible) {
        // sombra suave en capas + sombras de contacto bajo cada pie apoyado
        const k = Math.max(0.2, 1 - hAbove / 400), wsh = 74 * f.scale * Math.max(0.4, 1 - hAbove / 500);
        for (let i = 0; i < 3; i++) { gs.fillStyle(0x000000, 0.12 * k); gs.fillEllipse(f.x, GROUND_Y + 4, wsh * (1.3 - i * 0.2), 16 * f.scale * (1.2 - i * 0.15)); }
        const j = f.joints;
        for (const fx2 of [j.nFootX, j.fFootX]) { const fy = j[fx2 === j.nFootX ? 'nFootY' : 'fFootY'], c = Math.max(0, 1 - (GROUND_Y - fy) / 40); if (c > 0) { gs.fillStyle(0x000000, 0.3 * c); gs.fillEllipse(fx2, GROUND_Y + 2, 22 * f.scale, 6 * f.scale); } }
      }
      if (!f.visible) continue;
      // reflejo en suelos brillantes
      if (this.arena.reflect > 0 && f.alive !== undefined) {
        const rj = mirrorJoints(f.joints, _reflJ);
        drawBody(this.gRefl, null, rj, f.pose, f.scale, look, 1, { time: this.t });
      }
      // KO en 1vN: desvanecer
      let alpha = f.alpha ?? 1;
      if (!f.alive && !b.lastKO?.final && b.lastKO?.f !== f && f.grounded) { f.koFade = (f.koFade || 0) + 1; alpha *= Math.max(0, 1 - Math.max(0, f.koFade - 60) / 40); if (alpha <= 0) continue; }
      if (f.hasStatus('npc')) alpha *= 0.7;
      if (f.decoyOf) alpha *= 0.86 + Math.sin(this.t * 0.4) * 0.06;
      // sacudida por hitstop
      let ox = 0;
      if (b.hitstop > 0 && f.flash > 0) ox = (Math.random() - 0.5) * 6;
      if (ox) { f.x += ox; f.joints && shiftAll(f.joints, ox); }
      // estelas (afterimages)
      this.updateGhosts(f, look);
      // stand fantasma (ORA)
      if (f.move && (f.move.def.id === 'oraBarrage' || f.move.def.id === 'sigmaRule') && f.state === 'attack') this.drawStand(f, look);
      // intensidad del aura
      const e = f.energy / 100;
      let glow = f.alive ? 0.32 + e * 0.5 + (e >= 1 ? 0.35 + Math.sin(this.t * 0.25) * 0.2 : 0) : 0;
      if (f.hasStatus('auraWalk') || f.hasStatus('nahIdWin') || f.hasStatus('mainChar') || f.hasStatus('domain') || f.hasStatus('goblin')) glow += 0.6;
      if (f.state === 'attack' && f.move && f.move.def.slot === 'ult') glow += 0.8;
      if (f.boss) glow += 0.3;
      if (f.auraPct < 0.25 && f.alive) glow *= 0.5 + Math.random() * 0.5;
      // llamas de aura con la ultimate cargada o buffs fuertes
      if (f.alive && (f.energy >= 100 || glow > 1.2)) {
        const ac = look.auraFn ? look.auraFn(this.t) : look.aura;
        const j = f.joints;
        for (let i = 0; i < 7; i++) {
          const ph = this.t * 0.22 + i * 1.7;
          const bx = j.hipX + (i - 3) * 9 * f.scale, by = j.hipY + 30 * f.scale - Math.abs(i - 3) * 6;
          const h = (70 + Math.sin(ph) * 25 + (i % 2) * 20) * f.scale;
          const sway = Math.sin(ph * 0.7) * 10 * f.scale;
          gg.fillStyle(ac, 0.13);
          gg.fillTriangle(bx - 12 * f.scale, by, bx + 12 * f.scale, by, bx + sway, by - h);
        }
      }
      // partículas de aura
      if (f.alive && Math.random() < 0.12 + glow * 0.25) this.fx.motes(f.joints.hipX, f.joints.hipY - 20 * f.scale, look.auraFn ? look.auraFn(this.t) : look.aura, 1, 40 * f.scale);
      const flashK = f.flash > 0 ? Math.min(1, f.flash / 4) : 0;
      const shades = !!f.hasStatus('cool') || (f.state === 'attack' && f.move && f.move.def.id === 'sigmaRule');
      const lk = shades ? { ...look, shades: true } : look;
      if (f.flash > 0) lk.flashColor = f.hitFlashColor;
      drawFighter(gb, gg, f, lk, {
        alpha, glow, flash: flashK * 0.85, time: this.t,
        eyeGlow: f.move && (f.move.def.id === 'sigmaStare' || f.move.def.id === 'bombasticSideEye'),
        prop: this.propFor(f)
      });
      if (ox) { f.x -= ox; shiftAll(f.joints, -ox); }
      this.drawWeaponTrail(f, look);
      this.drawStatus(f, look, go, ga);
      // marcadores
      if (multi && f.alive && !f.decoyOf) this.drawTag(f, look, go);
    }
  }

  drawTag(f, look, g) {
    const hx = f.joints.headX, hy = f.joints.headY - f.joints.headR - 22 * f.scale;
    if (f.isHuman) {
      g.fillStyle(0x7df9ff, 1); g.fillTriangle(hx - 8, hy - 12, hx + 8, hy - 12, hx, hy);
    } else {
      const w = 56;
      g.fillStyle(0x000000, 0.6); g.fillRect(hx - w / 2 - 1, hy - 6, w + 2, 6);
      g.fillStyle(hex('#ff4d6d'), 1); g.fillRect(hx - w / 2, hy - 5, w * f.auraPct, 4);
    }
  }

  propFor(f) {
    if (f.state !== 'attack' || !f.move) {
      if (f.hasStatus('cooking')) return chefHat;
      if (f.hasStatus('thisIsFine') && f.state === 'idle') return null;
      return null;
    }
    const id = f.move.def.id, mf = f.move.f;
    const lock = f.move.lock;
    switch (id) {
      case 'unoReverse': return unoCard;
      case 'letHimCook': return cookPot;
      case 'micDrop': return mf < 16 ? mic : null;
      case 'bonk': case 'tungTung': return bat;
      case 'cooked': return lock ? pan : null;
      case 'thisIsFine': return mug;
      case 'coffinDance': return lock ? coffin : null;
      case 'stonks': return null;
      default: return f.hasStatus('cooking') ? chefHat : null;
    }
  }

  drawStand(f, look) {
    const j = _ghostJ;
    const p = f.pose;
    computeJoints(p, f.x - f.facing * 26 * f.scale, f.y - 34 * f.scale, f.facing, f.scale * 1.18, false, j);
    drawBody(this.gGlow, null, j, p, f.scale * 1.18, look, 0.55, { ghost: true, ghostColor: look.aura, time: this.t });
  }

  updateGhosts(f, look) {
    let gl = this.ghosts.get(f.id);
    if (!gl) { gl = []; this.ghosts.set(f.id, gl); }
    const fast = f.trail > 0 || f.state === 'dash' || f.hasStatus('speedrun') || f.hasStatus('narutoRun') || (f.state === 'attack' && f.move && f.move.def.slot === 'ult' && Math.abs(f.vx) > 6) || (f.hasStatus('auraWalk') && Math.abs(f.vx) > 1);
    if (fast && Math.floor(this.t) % 2 === 0 && f.visible) gl.push({ j: cloneJoints(f.joints), pose: { ...f.pose }, a: 0.5 });
    for (const g of gl) {
      g.a -= 0.05;
      if (g.a > 0) drawBody(this.gGlow, null, g.j, g.pose, f.scale, look, g.a, { ghost: true, ghostColor: look.auraFn ? look.auraFn(this.t) : look.aura });
    }
    while (gl.length && gl[0].a <= 0) gl.shift();
    if (gl.length > 8) gl.shift();
  }

  drawWeaponTrail(f, look) {
    let tr = this.wtrails.get(f.id);
    if (!tr) { tr = []; this.wtrails.set(f.id, tr); }
    const box = f.state === 'attack' ? this.b.moveHitbox(f) : null;
    if (box && f.move && f.move.def.hit && f.move.def.hit.box && f.move.def.hit.box.joint) {
      const jn = f.move.def.hit.box.joint;
      tr.push({ x: f.joints[jn + 'X'], y: f.joints[jn + 'Y'], a: 1 });
    } else if (f.state === 'attack' && f.move) {
      // smear: sigue la extremidad que más rápido se mueve durante el golpe
      const prev = f._ext || (f._ext = {});
      let best = null, bv = 9 * f.scale, bj = null;
      for (const jn of ['nHand', 'fHand', 'nFoot', 'fFoot']) {
        const x = f.joints[jn + 'X'], y = f.joints[jn + 'Y'];
        if (prev[jn]) { const v = Math.hypot(x - prev[jn][0], y - prev[jn][1]) - Math.abs(f.vx); if (v > bv) { bv = v; best = [x, y]; bj = jn; } }
        prev[jn] = [x, y];
      }
      if (best) tr.push({ x: best[0], y: best[1], a: 0.8, jn: bj });
    } else if (f._ext) f._ext = null;
    const g = this.gGlow;
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], c = tr[i];
      if (a.jn !== c.jn) continue;
      g.lineStyle(10 * f.scale * c.a, look.aura, 0.55 * c.a); g.lineBetween(a.x, a.y, c.x, c.y);
      g.lineStyle(4 * f.scale * c.a, 0xffffff, 0.8 * c.a); g.lineBetween(a.x, a.y, c.x, c.y);
    }
    for (const p of tr) p.a -= 0.16;
    while (tr.length && tr[0].a <= 0) tr.shift();
  }

  drawStatus(f, look, g, ga) {
    const j = f.joints, t = this.t, s = f.scale;
    const hx = j.headX, hy = j.headY, top = hy - j.headR;
    for (const st of f.status) {
      switch (st.id) {
        case 'charmed':
          for (let i = 0; i < 3; i++) { const a = t * 0.12 + i * 2.1; heartShape(g, hx + Math.cos(a) * 22 * s, top - 8 * s + Math.sin(a) * 6 * s, 5 * s, 0xff3b6b, 1); }
          break;
        case 'dizzy': case 'caught': case 'paused':
          for (let i = 0; i < 3; i++) { const a = t * 0.15 + i * 2.1; const x = hx + Math.cos(a) * 20 * s, y = top - 6 * s + Math.sin(a) * 6 * s; g.fillStyle(0xffe066, 1); drawStar(g, x, y, 6 * s); }
          if (st.id === 'caught' && Math.floor(t) % 20 < 10) { g.lineStyle(3, 0xffffff, 1); g.strokeRect(f.hurt.x - 8, f.hurt.y - 8, f.hurt.w + 16, f.hurt.h + 16); }
          break;
        case 'fear':
          g.fillStyle(0x7fd1ff, 0.9); g.fillCircle(hx - f.facing * 10 * s, hy - 4 * s + (t % 20), 2.5 * s);
          ga.fillStyle(0x6633aa, 0.25); ga.fillCircle(hx, hy, 26 * s);
          break;
        case 'frozen': case 'lagged':
          if (st.id === 'frozen') {
            g.fillStyle(0xaee8ff, 0.35); g.fillRect(f.hurt.x - 6, f.hurt.y - 6, f.hurt.w + 12, f.hurt.h + 8);
            g.lineStyle(2, 0xffffff, 0.8); g.strokeRect(f.hurt.x - 6, f.hurt.y - 6, f.hurt.w + 12, f.hurt.h + 8);
          } else {
            for (let i = 0; i < 4; i++) { g.fillStyle([0x00ff66, 0xff00ff, 0x00ffff][i % 3], 0.6); g.fillRect(f.hurt.x + Math.random() * f.hurt.w, f.hurt.y + Math.random() * f.hurt.h, 10 + Math.random() * 30, 4); }
          }
          break;
        case 'dancing': if (Math.random() < 0.08) this.fx.emit('note', hx, top - 10, 1, 0xff66ff); break;
        case 'rooted':
          for (let i = -3; i <= 3; i++) { g.fillStyle(0x33aa33, 1); g.fillTriangle(f.x + i * 8 - 4, GROUND_Y, f.x + i * 8 + 4, GROUND_Y, f.x + i * 8 + Math.sin(t * 0.2 + i) * 3, GROUND_Y - 18 - Math.abs(i) * 2); }
          break;
        case 'silenced': g.fillStyle(0x9a9a9a, 1); g.fillRect(hx + f.facing * 3 * s - 7 * s, hy + 4 * s, 14 * s, 5 * s); break;
        case 'inverted':
          g.lineStyle(3, 0xb366ff, 1); g.beginPath(); g.arc(hx, top - 14 * s, 10 * s, t * 0.2, t * 0.2 + 4.5); g.strokePath();
          break;
        case 'tilted': if (Math.random() < 0.15) this.fx.p(hx + (Math.random() - 0.5) * 16, top, (Math.random() - 0.5), -1.5, 30, 5, 0xff4444, 'puff', { add: false, drag: 0.97 }); break;
        case 'mogged': g.fillStyle(0x333344, 0.75); g.fillEllipse(hx, top - 16 * s, 40 * s, 14 * s); g.fillEllipse(hx - 10 * s, top - 20 * s, 22 * s, 14 * s); break;
        case 'marked': {
          const k = 1 - st.t / st.max;
          g.lineStyle(2 + k * 3, 0xff2222, 0.6 + k * 0.4); g.strokeCircle(j.neckX, j.neckY + 20 * s, (30 - k * 14) * s);
          g.lineBetween(j.neckX - 36 * s, j.neckY + 20 * s, j.neckX + 36 * s, j.neckY + 20 * s); g.lineBetween(j.neckX, j.neckY - 16 * s, j.neckX, j.neckY + 56 * s);
          break;
        }
        case 'ratio': for (let i = 0; i < (st.data.stacks || 1); i++) { g.fillStyle(0x3fa9f5, 1); g.fillTriangle(hx - 20 + i * 10, top - 22, hx - 15 + i * 10, top - 30, hx - 10 + i * 10, top - 22); } break;
        case 'bigBrain':
          ga.fillStyle(0xff99ff, 0.5); for (let i = 0; i < 5; i++) ga.fillCircle(hx - 8 * s + i * 4 * s, top - 14 * s - Math.abs(2 - i) * 3 * s, 7 * s);
          break;
        case 'mainChar': ga.fillStyle(0xfff2a8, 0.08); ga.fillTriangle(f.x, -500, f.x - 90 * s, GROUND_Y, f.x + 90 * s, GROUND_Y); break;
        case 'thisIsFine': if (Math.random() < 0.5) this.fx.p(f.x + (Math.random() - 0.5) * 60 * s, GROUND_Y - 4, 0, -2 - Math.random() * 2, 22, 6 * s, Math.random() < 0.5 ? 0xff6a00 : 0xffcc00, 'dot', { drag: 0.97 }); break;
        case 'nahIdWin': if (Math.random() < 0.06) this.fx.lightning(hx + (Math.random() - 0.5) * 60, hy - 50, f.x + (Math.random() - 0.5) * 50, f.y - 20, 0xffcc33, 2, 6, 0); break;
        case 'stonks': g.lineStyle(3, 0x44ff88, 1); g.beginPath(); g.moveTo(hx - 16, top - 12); g.lineTo(hx - 6, top - 20); g.lineTo(hx + 2, top - 15); g.lineTo(hx + 16, top - 30); g.strokePath(); break;
        case 'chill': case 'goblin': case 'infMewing': if (Math.random() < 0.1) this.fx.motes(f.x, f.y - 60, STATUS_COL[st.id], 1, 50); break;
      }
    }
  }

  // ------------------------------------------------------------
  drawProjectiles() {
    const g = this.gProj, ga = this.gProjAdd;
    g.clear(); ga.clear();
    const t = this.t;
    for (const p of this.b.projectiles) {
      const look = this.lookFor(p.owner);
      const x = p.x, y = p.y, d = Math.sign(p.vx) || p.facing || 1;
      if (p.delay > 0) { this.drawWarning(p, look); continue; }
      switch (p.kind) {
        case 'heart': ga.fillStyle(0xff5fa2, 0.35); ga.fillCircle(x, y, 22); heartShape(g, x, y, 12 + Math.sin(t * 0.4) * 1.5, 0xff3b6b, 1); heartShape(g, x - 3, y - 4, 4, 0xffc2d6, 0.9); if (Math.random() < 0.3) this.fx.p(x - d * 10, y, -d, -0.5, 18, 3, 0xff8fb8); break;
        case 'bigHeart': ga.fillStyle(0xff5fa2, 0.4); ga.fillCircle(x, y, 80); heartShape(g, x, y, 48, 0xff2d6f, 1); heartShape(g, x - 14, y - 16, 14, 0xffc2d6, 0.8); break;
        case 'brokenHeart': heartShape(g, x, y, 14, 0x9b1b30, 1); g.lineStyle(3, 0x1a0005, 1); g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x - 4, y - 2); g.lineTo(x + 3, y + 3); g.lineTo(x - 1, y + 12); g.strokePath(); break;
        case 'invisible': ga.lineStyle(2, 0xffffff, 0.12 + Math.sin(t * 0.8) * 0.06); ga.strokeCircle(x, y, 14 + Math.sin(t * 0.5) * 3); ga.strokeCircle(x - d * 14, y, 9); break;
        case 'ghost': {
          copyPose(POSES.dash, _ghostPose); MODS.airRun(_ghostPose, p.age * 1.5);
          _ghostPose.hn[0] = 50; _ghostPose.hn[1] = -6; _ghostPose.hf[0] = 44; _ghostPose.hf[1] = 2;
          computeJoints(_ghostPose, x, y + 70, d, p.owner.scale, false, _ghostJ);
          drawBody(ga, null, _ghostJ, _ghostPose, p.owner.scale, look, 0.6, { ghost: true, ghostColor: 0xb9a7ff });
          break;
        }
        case 'shockwave': ga.fillStyle(look.aura, 0.25); ga.fillEllipse(x, y + 10, p.w * (0.5 + p.age * 0.1), 40); g.lineStyle(4, 0xffffff, 0.8); g.strokeEllipse(x, y + 10, p.w * (0.4 + p.age * 0.08), 30); break;
        case 'spiral': for (let i = 0; i < 3; i++) { ga.lineStyle(5, 0x9933ff, 0.6); ga.beginPath(); ga.arc(x, y, 14 + i * 12, t * 0.4 + i, t * 0.4 + i + 4); ga.strokePath(); } break;
        case 'sheesh': {
          const c = p.data.charge || 0;
          for (let i = 0; i < 4; i++) { ga.lineStyle(6 - i, 0x00e5ff, 0.7 - i * 0.12); ga.beginPath(); ga.arc(x - d * i * 14, y, p.h * 0.45 - i * 6, d > 0 ? -0.9 : Math.PI - 0.9, d > 0 ? 0.9 : Math.PI + 0.9); ga.strokePath(); }
          if (c > 0.6) { ga.fillStyle(0xffffff, 0.2); ga.fillCircle(x, y, p.h * 0.3); }
          break;
        }
        case 'ratio': g.fillStyle(0x3fa9f5, 1); g.fillTriangle(x + d * 14, y, x - d * 6, y - 10, x - d * 6, y + 10); g.fillRect(x - d * 18 - 3, y - 3, 14, 6); ga.fillStyle(0x3fa9f5, 0.3); ga.fillCircle(x, y, 16); break;
        case 'tomato': g.fillStyle(0xe63946, 1); g.fillCircle(x, y, 11); g.fillStyle(0x2d6a4f, 1); g.fillCircle(x, y - 10, 4); break;
        case 'shoe': g.fillStyle(0xf4f4f8, 1); g.fillRoundedRect(x - 14, y - 6, 28, 12, 5); g.fillStyle(0xff4d6d, 1); g.fillRect(x - 14, y + 3, 28, 4); break;
        case 'notes': ga.lineStyle(5, 0xff66ff, 0.5); ga.strokeEllipse(x, y, p.w, 160); if (Math.random() < 0.6) this.fx.emit('note', x + (Math.random() - 0.5) * p.w, y - 40, 1, 0xff66ff); break;
        case 'icecream': g.fillStyle(0xd4a373, 1); g.fillTriangle(x - 9, y - 4, x + 9, y - 4, x, y + 18); g.fillStyle(0xffd6e0, 1); g.fillCircle(x, y - 9, 10); g.fillStyle(0xaee8ff, 1); g.fillCircle(x + 4, y - 15, 6); break;
        case 'banana': g.lineStyle(9, 0x7a5c00, 1); g.beginPath(); g.arc(x, y - 8, 16, 0.3, 2.8); g.strokePath(); g.lineStyle(6, 0xffe135, 1); g.beginPath(); g.arc(x, y - 8, 16, 0.3, 2.8); g.strokePath(); break;
        case 'shark': drawShark(g, x, y, d, p.owner.scale * (p.scale || 1), t + p.id); if (Math.random() < 0.4) this.fx.dust(x - d * 40, GROUND_Y, 1, 0x9fd3ff, -d, 0.6); break;
        case 'roots': drawRoots(g, x, GROUND_Y + 2, p.owner.scale, Math.min(1, p.age / 4), t); break;
        case 'bomb': g.fillStyle(0x222222, 1); g.fillCircle(x, y, 14); g.fillStyle(0x6b8e23, 1); g.fillRect(x - 4, y - 22, 8, 8); ga.fillStyle(0xffaa00, 0.8); ga.fillCircle(x, y - 24 + Math.sin(t) * 2, 4); break;
        case 'glasses': g.fillStyle(0x000000, 1); for (let i = 0; i < 6; i++) g.fillRect(x - 30 + i * 10, y - 6, 9, 9); g.fillRect(x - 30, y - 9, 60, 4); g.fillStyle(0xffffff, 1); g.fillRect(x - 26, y - 4, 4, 4); g.fillRect(x + 6, y - 4, 4, 4); break;
        case 'grass': for (let i = -6; i <= 6; i++) { g.fillStyle(i % 2 ? 0x2f9e44 : 0x51cf66, 1); g.fillTriangle(x + i * 10 - 6, GROUND_Y, x + i * 10 + 6, GROUND_Y, x + i * 10, GROUND_Y - 30 - Math.abs(Math.sin(i * 1.7)) * 40); } break;
        case 'lightning': if (p.age % 3 === 0) this.fx.lightning(x + (Math.random() - 0.5) * 30, y - 300, x, GROUND_Y, 0x7cfc00, 6, 8, 2); break;
        case 'pillar': ga.fillStyle(0xfff6a0, 0.5); ga.fillRect(x - p.w / 2, -1200, p.w, 1800 + 600); ga.fillStyle(0xffffff, 0.8); ga.fillRect(x - p.w / 6, -1200, p.w / 3, 2400); break;
        case 'bighand': g.fillStyle(0xffd6a5, 1); g.fillRoundedRect(x - 60, y - 70, 120, 120, 30); for (let i = 0; i < 4; i++) g.fillRoundedRect(x - 56 + i * 30, y - 140, 24, 80, 12); break;
        case 'soundwave': for (let i = 0; i < 3; i++) { ga.lineStyle(4, 0xcccccc, 0.6 - i * 0.15); ga.beginPath(); ga.arc(x - d * i * 10, y, 30 + i * 12, d > 0 ? -0.8 : Math.PI - 0.8, d > 0 ? 0.8 : Math.PI + 0.8); ga.strokePath(); } break;
        case 'shush': g.fillStyle(0xcccccc, 0.9); g.fillCircle(x, y, 10); ga.lineStyle(3, 0xffffff, 0.4); ga.strokeEllipse(x, y, 40, 80); break;
        case 'bullet': ga.fillStyle(0xffd166, 0.6); ga.fillRect(x - d * 30, y - 3, 30 * d, 6); g.fillStyle(0xffffff, 1); g.fillCircle(x, y, 5); break;
        case 'orb': ga.fillStyle(look.aura, 0.5); ga.fillCircle(x, y, 18); g.fillStyle(0xffffff, 1); g.fillCircle(x, y, 7); break;
        default: break;
      }
    }
  }

  drawWarning(p, look) {
    const ga = this.gProjAdd, g = this.gProj;
    const k = Math.sin(this.t * 0.5) * 0.5 + 0.5;
    if (p.kind === 'pillar') { ga.fillStyle(0xfff6a0, 0.08 + k * 0.08); ga.fillRect(p.x - p.w / 2, -1200, p.w, 1800 + 600); ga.lineStyle(3, 0xfff6a0, 0.6); ga.strokeEllipse(p.x, GROUND_Y, p.w * 1.4, 26); }
    else if (p.kind === 'grass') { g.fillStyle(0x2f9e44, 0.6); for (let i = -4; i <= 4; i++) g.fillTriangle(p.x + i * 12 - 4, GROUND_Y, p.x + i * 12 + 4, GROUND_Y, p.x + i * 12, GROUND_Y - 6 - k * 6); }
    else if (p.kind === 'roots') { g.fillStyle(0x3a2410, 0.5); g.fillEllipse(p.x, GROUND_Y + 2, 120, 18); g.lineStyle(2, 0x6b8e23, 0.5 + k * 0.5); g.strokeEllipse(p.x, GROUND_Y + 2, 130, 22); drawRoots(g, p.x, GROUND_Y + 2, p.owner.scale, 0.12 + k * 0.08, this.t); }
    else if (p.kind === 'glasses' || p.kind === 'bighand' || p.kind === 'lightning' || p.kind === 'none') { g.fillStyle(0x000000, 0.4); g.fillEllipse(p.x, GROUND_Y, 100, 18); g.lineStyle(2, look.aura, 0.5 + k * 0.5); g.strokeEllipse(p.x, GROUND_Y, 110, 22); }
    else { g.lineStyle(2, look.aura, 0.4 + k * 0.4); g.strokeEllipse(p.x, GROUND_Y, 100, 18); }
  }

  drawDebug() {
    const g = this.gDebug; g.clear();
    for (const f of this.b.fighters) {
      g.lineStyle(1, f.invuln > 0 ? 0x4444ff : 0x00ff00, 0.9); g.strokeRect(f.hurt.x, f.hurt.y, f.hurt.w, f.hurt.h);
      const hb = this.b.moveHitbox(f); if (hb) { g.lineStyle(2, 0xff0000, 1); g.strokeRect(hb.x, hb.y, hb.w, hb.h); }
    }
    for (const p of this.b.projectiles) { const bx = this.b.pbox(p); g.lineStyle(1, 0xffaa00, 1); g.strokeRect(bx.x, bx.y, bx.w, bx.h); }
  }

  // ------------------------------------------------------------
  updateCamera(k) {
    const b = this.b, cs = this.cs, cam = this.cam;
    const fs = b.fighters.filter(f => (f.alive || (b.lastKO && b.lastKO.f === f)) && f.visible && !f.decoyOf && f.y > GROUND_Y - 800);
    let minX = 1e9, maxX = -1e9, minY = GROUND_Y;
    for (const f of fs) { minX = Math.min(minX, f.x); maxX = Math.max(maxX, f.x); minY = Math.min(minY, f.y - 170 * f.scale); }
    if (!fs.length) { minX = maxX = ARENA_W / 2; }
    const spread = maxX - minX;
    let zoom = Math.max(0.76, Math.min(1.38, 1280 * 0.74 / (spread + 270)));
    let tx = (minX + maxX) / 2;
    let ty = GROUND_Y - (0.8 - 0.5) * 720 / zoom;
    ty = Math.min(ty, minY + 280 / zoom);
    let lerp = 0.08;
    if (cs.focus) {
      const fo = cs.focus;
      tx = fo.x; ty = fo.y; zoom = fo.zoom; lerp = fo.lerp || 0.12;
      fo.t -= k; if (fo.t <= 0) cs.focus = null;
    }
    zoom += cs.punch;
    cs.punch *= 0.86;
    // límites del escenario
    const halfW = 640 / zoom;
    tx = Math.max(WALL_L - 120 + halfW, Math.min(WALL_R + 120 - halfW, tx));
    cs.x += (tx - cs.x) * lerp * k;
    cs.y += (ty - cs.y) * lerp * k;
    cs.zoom += (zoom - cs.zoom) * lerp * k;
    cam.setZoom(cs.zoom);
    cam.centerOn(cs.x, cs.y);
  }

  shake(strength) {
    const s = SHAKE[strength] || strength;
    if (!s || !s[0] || this.shakeMul <= 0) return;
    this.cam.shake(s[0], s[1] * this.shakeMul, true);
  }
  focus(x, y, zoom, t, lerp) { this.cs.focus = { x, y, zoom, t, lerp }; }

  // ------------------------------------------------------------
  onEvent(e) {
    this.scene.events.emit('bev', e);
    const fx = this.fx;
    const S = this.scene;
    switch (e.type) {
      case 'hit': {
        const look = this.lookFor(e.a);
        const col = e.color ? hex(e.color) : look.aura;
        const n = { light: 8, medium: 14, heavy: 22, mega: 34 }[e.strength] || 10;
        const dir = Math.atan2(0, e.f.x - e.a.x || 1);
        fx.sparks(e.x, e.y, n, 0xffffff, 10 + n * 0.3, dir, 1.6);
        fx.sparks(e.x, e.y, n * 0.6, col, 8, dir, 2.4);
        fx.flash(e.x, e.y, col, e.strength === 'mega' ? 2.4 : e.strength === 'heavy' ? 1.5 : 0.9);
        if (e.strength !== 'light') fx.ring(e.x, e.y, col, e.strength === 'mega' ? 2.2 : e.strength === 'heavy' ? 1.3 : 0.8);
        if (e.counterHit) fx.ring(e.x, e.y, 0xff3030, 1.6);
        if (e.strength !== 'light') fx.starburst(e.x, e.y, col, e.strength === 'mega' ? 2 : e.strength === 'heavy' ? 1.4 : 0.9, dir);
        if (e.strength === 'mega' || (e.strength === 'heavy' && e.counterHit)) this.impactFrame();
        this.sfxAt(STRENGTH_SFX[e.strength] || 'hitLight', e.x, { pitch: 0.92 + Math.random() * 0.16, minGap: 0.02 });
        this.shake(e.strength);
        if (e.strength === 'heavy' || e.strength === 'mega') { this.cs.punch += e.strength === 'mega' ? 0.08 : 0.035; this.arena.react('ooh', 0.4); }
        if (this.opts.damageNumbers !== false && e.dmg >= 1) fx.number(e.x, e.y - 20, e.dmg, e.counterHit ? '#ff5050' : '#ffffff', e.dmg > 80);
        if (e.fx) this.hitFx(e);
        if (e.combo >= 5 && e.combo % 5 === 0) this.arena.react('cheer', 0.5);
        break;
      }
      case 'block':
        fx.sparks(e.x, e.y, 8, 0x7fd1ff, 7, e.f.facing > 0 ? 0 : Math.PI, 2);
        fx.custom(10, (gt, gn, k) => { gt.lineStyle(5 * k, 0x7fd1ff, k); gt.beginPath(); gt.arc(e.f.x, e.f.y - 100 * e.f.scale, 50 * e.f.scale, e.f.facing > 0 ? -1 : Math.PI - 1, e.f.facing > 0 ? 1 : Math.PI + 1); gt.strokePath(); });
        this.sfxAt('block', e.x, { pitch: 0.9 + Math.random() * 0.2 });
        break;
      case 'parry':
        fx.ring(e.x, e.y, 0xffd34d, 2.4, 420); fx.flash(e.x, e.y, 0xffffff, 2.6);
        fx.sparks(e.x, e.y, 30, 0xffe08a, 14);
        fx.text(e.x, e.y - 40, 'PARRY!', { color: '#ffd34d', size: 44 });
        this.sfx('parry');
        this.cs.punch += 0.07;
        this.arena.react('ooh', 1);
        if (e.f.isHuman) this.scene.events.emit('flash', 0xffd34d, 90);
        break;
      case 'dodge':
        fx.text(e.f.x, e.f.y - 190 * e.f.scale, 'ESQUIVA', { color: '#a0ffa0', size: 22, hold: 200 });
        e.f.trail = 10;
        break;
      case 'armor': fx.flash(e.x, e.y, 0xffd34d, 1.2); this.sfx('block', { pitch: 0.6 }); break;
      case 'move': this.onMove(e); break;
      case 'superFreeze': {
        const f = e.f;
        this.focus(f.x + f.facing * 40, f.y - 120 * f.scale, 1.55, 40, 0.25);
        this.dimTarget = 0.7;
        S.time.delayedCall(700, () => { this.dimTarget = 0; });
        this.sfx('ultCast'); this.sfx('charge', { dur: 0.6 }); this.duck(1.2, 0.25);
        fx.ring(f.x, f.y - 100, this.lookFor(f).aura, 3, 600);
        fx.flash(f.x, f.y - 100, this.lookFor(f).aura, 3, 500);
        this.scene.events.emit('ultBanner', { f, def: e.def });
        this.arena.react('cheer', 1);
        break;
      }
      case 'cinematic': {
        const mx = (e.a.x + e.f.x) / 2;
        this.focus(mx, e.a.y - 120, 1.32, e.frames, 0.1);
        this.dimTarget = 0.5;
        S.time.delayedCall(e.frames * 16, () => { this.dimTarget = 0; });
        this.scene.events.emit('letterbox', e.frames);
        break;
      }
      case 'lockEnd': this.dimTarget = 0; break;
      case 'callout': {
        const f = e.f;
        fx.text(f.x, f.y - (e.small ? 200 : 230) * f.scale, e.text, { color: e.color || '#fff', size: e.small ? 22 : 34, hold: e.small ? 350 : 700 });
        break;
      }
      case 'humiliate': {
        const f = e.f;
        fx.text(f.x, f.y - 250 * f.scale, e.text, { color: e.color || '#ff66cc', size: 40, hold: 900 });
        fx.number(f.x, f.y - 150, e.amount, '#ff66cc', true);
        fx.emit('star', f.x, f.y - 120, 10, hex(e.color || '#ff66cc'));
        this.sfx('tauntHorn'); this.sfx('sparkle');
        this.arena.react('cheer', 0.8);
        this.cs.punch += 0.04;
        this.shake('medium');
        break;
      }
      case 'status': {
        const f = e.f;
        if (e.id === 'charmed') { fx.emit('heart', f.x, f.y - 140, 10, 0xff5fa2); this.sfx('heart'); }
        if (e.id === 'frozen') { this.sfx('ice'); fx.emit('glow', f.x, f.y - 90, 12, 0xaee8ff); }
        if (e.id === 'fear') fx.emit('glow', f.x, f.y - 100, 10, 0x6633aa);
        if (e.id === 'inverted') this.sfx('glitch');
        break;
      }
      case 'projDie': {
        const p = e.p;
        if (p.kind !== 'none' && p.kind !== 'shockwave') { fx.sparks(p.x, p.y, 6, 0xffffff, 5); }
        if (p.kind === 'heart' || p.kind === 'bigHeart') fx.emit('heart', p.x, p.y, p.kind === 'bigHeart' ? 20 : 4, 0xff5fa2);
        if (p.kind === 'tomato') fx.dust(p.x, p.y, 6, 0xe63946);
        break;
      }
      case 'proj': {
        const p = e.p;
        if (p.kind === 'heart') this.sfx('heart', { minGap: 0.05 });
        else if (p.kind === 'sheesh' || p.kind === 'soundwave') this.sfx('wave');
        else if (p.kind === 'bullet') this.sfx('hitLight', { pitch: 2 });
        else if (p.kind === 'ghost' || p.kind === 'invisible') this.sfx('whoosh', { pitch: 1.4 });
        else if (p.kind === 'spiral') this.sfx('glitch');
        break;
      }
      case 'projActive': {
        const p = e.p;
        if (p.kind === 'pillar') { this.sfx('thunder'); fx.pillar(p.x, 0xfff6a0, 70, 30); this.shake('heavy'); }
        if (p.kind === 'grass') { this.sfx('pop'); fx.dust(p.x, GROUND_Y, 10, 0x51cf66); }
        if (p.kind === 'bighand') { this.sfx('vineBoom'); this.shake('heavy'); }
        if (p.kind === 'lightning') { this.sfx('zap'); }
        break;
      }
      case 'clash': fx.sparks(e.x, e.y, 16, 0xffffff, 10); fx.ring(e.x, e.y, 0xffffff, 1); this.sfx('block', { pitch: 1.4 }); break;
      case 'reflect': fx.ring(e.p.x, e.p.y, 0xff3b3b, 1.2); this.sfx('card'); break;
      case 'teleport': {
        const look = this.lookFor(e.f);
        fx.emit('glow', e.fromX, e.fromY - 90, 14, look.aura); fx.emit('glow', e.f.x, e.f.y - 90, 14, look.aura);
        this.sfx('teleport');
        break;
      }
      case 'step': if (Math.abs(e.f.vx) > 3) fx.dust(e.x, GROUND_Y, 2, 0xcfc6b8, -Math.sign(e.f.vx) * e.f.facing, 0.5); this.sfxAt('step', e.x, { gain: Math.min(1, 0.4 + Math.abs(e.f.vx) * 0.08), minGap: 0.05 }); break;
      case 'jump': fx.dust(e.f.x, GROUND_Y, e.double ? 4 : 6); this.sfx('jump'); break;
      case 'land': fx.dust(e.f.x, GROUND_Y, e.heavy ? 14 : 8); this.sfx('land'); if (e.heavy) this.shake('medium'); break;
      case 'dash': fx.dust(e.f.x, GROUND_Y, 6, 0xcfc6b8, -e.f.facing * e.dir); this.sfx('dash'); break;
      case 'bossLand': {
        const f = e.f;
        fx.groundWave(f.x, GROUND_Y - 4, this.lookFor(f).aura, 500); fx.dust(f.x, GROUND_Y, 30); fx.ring(f.x, f.y - 60, this.lookFor(f).aura, 3);
        this.sfx('vineBoom'); this.sfx('explosion'); this.shake('mega'); this.arena.react('ooh', 2);
        fx.text(f.x, f.y - 280, f.name.toUpperCase(), { color: '#ff4d6d', size: 44, hold: 900 });
        break;
      }
      case 'wallbounce': case 'groundbounce': fx.dust(e.f.x, e.f.y, 12); fx.ring(e.f.x, e.f.y - 60, 0xffffff, 1.2); this.sfx('hitHeavy', { pitch: 0.7 }); this.shake('heavy'); break;
      case 'burst': {
        const look = this.lookFor(e.f);
        fx.ring(e.f.x, e.f.y - 90, look.aura, 3, 400); fx.flash(e.f.x, e.f.y - 90, look.aura, 3);
        fx.text(e.f.x, e.f.y - 220, 'AURA BURST', { color: '#ffffff', size: 34 });
        this.sfx('burst'); this.shake('heavy');
        break;
      }
      case 'thorns': fx.emit('glow', e.f.x, e.f.y - 80, 10, 0xff6a00); this.sfx('fire'); break;
      case 'ko': this.onKO(e); break;
      case 'deny': if (e.f.isHuman) { fx.text(e.f.x, e.f.y - 200, e.reason, { color: '#aaaaaa', size: 20, hold: 250 }); this.sfx('deny'); } break;
      case 'counter': fx.ring(e.f.x, e.f.y - 100, 0xffffff, 1.5); this.sfx('parry'); this.cs.punch += 0.05; break;
      case 'grab': this.sfx('slap', { pitch: 0.6 }); break;
      case 'decoy': fx.emit('glow', e.f.x, e.f.y - 90, 18, 0xff77cc); this.sfx('teleport'); break;
      case 'decoyPop': fx.emit('heart', e.f.x, e.f.y - 90, 14, 0xff77cc); fx.ring(e.f.x, e.f.y - 90, 0xff77cc, 1.6); this.sfx('pop'); break;
      case 'crowd': this.arena.react(e.mood === 'throw' ? 'cheer' : e.mood, 1); break;
      case 'charge': if (Math.random() < 0.5) this.fx.motes(e.f.x, e.f.y - 100, this.lookFor(e.f).aura, 2, 60); break;
      case 'timeStop': {
        this.sfx('timeStop');
        if (this.cam.postFX) { try { this.colorFx = this.cam.postFX.addColorMatrix(); this.colorFx.negative(); S.time.delayedCall(260, () => { if (this.colorFx) { this.colorFx.reset(); this.colorFx.grayscale(0.85); } }); } catch (err) { this.colorFx = null; } }
        fx.ring(e.f.x, e.f.y - 100, 0xffd700, 6, 900);
        break;
      }
      case 'timeResume':
        if (this.colorFx) { try { this.cam.postFX.remove(this.colorFx); } catch (err) { /* sin postFX */ } this.colorFx = null; }
        this.sfx('whooshHeavy');
        break;
      case 'domain': {
        this.sfx('domain');
        this.domainOwner = e.f;
        fx.ring(e.f.x, e.f.y - 100, 0x8a2be2, 8, 1200);
        this.dimTarget = 0.35;
        break;
      }
      case 'domainEnd': this.dimTarget = 0; this.domainOwner = null; break;
      case 'blind': this.scene.events.emit('flash', 0xffffff, 400); break;
      case 'fx': this.namedFx(e); break;
      case 'announce': case 'roundStart': case 'victory': case 'matchEnd': break;
    }
  }

  // fotograma de impacto: inversión de color durante 3 fotogramas (estilo anime)
  impactFrame() {
    if (this.opts.quality === 'baja' || !this.cam.postFX || this.colorFx || this._impact) return;
    try {
      const fxm = this.cam.postFX.addColorMatrix(); fxm.negative(); fxm.contrast(0.6, true);
      this._impact = fxm;
      this.scene.time.delayedCall(55, () => { try { this.cam.postFX.remove(fxm); } catch (err) { /* sin postFX */ } this._impact = null; });
    } catch (err) { this._impact = null; }
  }

  onMove(e) {
    const f = e.f, d = e.def;
    if (d.slot === 'basic') {
      this.sfx(d.weight === 'heavy' ? 'whooshHeavy' : 'whoosh', { pitch: 0.9 + Math.random() * 0.25 });
      if (d.weight === 'heavy') this.scene.time.delayedCall(d.startup * 16, () => { if (f.state === 'attack' && f.move && f.move.def === d) this.fx.slash(f.x + f.facing * 40 * f.scale, f.y - 110 * f.scale, f.facing, this.lookFor(f).aura, 70 * f.scale); });
      return;
    }
    if (d.slot === 'hidden') { this.sfx('whoosh'); return; }
    this.sfx('whoosh', { pitch: 1.2 });
    if (d.slot !== 'ult') this.fx.text(f.x, f.y - 215 * f.scale, d.name.toUpperCase(), { color: d.color || '#ffffff', size: 26, hold: 420, rise: 30 });
    const sig = MOVE_SFX[d.id] || [d.slot === 'ult' ? 'ultCast' : 'cast'];
    for (const n of sig) this.sfxAt(n, f.x);
    if (d.id === 'sixSeven' || d.id === 'sixSevenBarrage') this.sfx('count');
  }

  hitFx(e) {
    const fx = this.fx;
    switch (e.fx) {
      case 'slap': fx.text(e.x, e.y - 30, '¡ZAS!', { color: '#ffffff', size: 48 }); this.sfx('slap'); this.shake('heavy'); fx.emit('star', e.x, e.y, 10, 0xffffff); break;
      case 'bonk': fx.text(e.x, e.y - 50, 'BONK', { color: '#d6a46b', size: 40 }); this.sfx('bonk'); fx.emit('star', e.f.joints.headX, e.f.joints.headY, 8, 0xffe066); break;
      case 'flick': fx.text(e.x, e.y - 60, 'TOC', { color: '#8be9fd', size: 34 }); this.sfx('fingerSnap'); fx.emit('star', e.f.joints.headX, e.f.joints.headY - 10, 6, 0xffe066); break;
      case 'headbutt': fx.text(e.x, e.y - 60, '¡CRACK!', { color: '#c084fc', size: 44 }); this.sfx('woodKnock', { pitch: 0.6 }); this.shake('heavy'); fx.emit('star', e.f.joints.headX, e.f.joints.headY, 12, 0xffffff); break;
      case 'chomp': fx.text(e.x, e.y - 60, 'ÑAM', { color: '#4cc9f0', size: 44 }); this.sfx('chomp'); this.sfx('bubbles'); this.shake('heavy'); break;
      case 'coffee': fx.emit('smoke', e.x, e.y - 20, 8, 0xf5deb3); this.sfx('pirouette'); break;
      case 'boom': fx.flash(e.x, e.y, 0xff7b00, 2.2); fx.emit('smoke', e.x, e.y, 10, 0x444444); fx.sparks(e.x, e.y, 18, 0xffaa00, 11); this.sfx('explosion'); this.shake('heavy'); break;
      case 'tung': fx.text(e.x, e.y - 60, 'TUNG', { color: '#c68642', size: 40, angle: (Math.random() - 0.5) * 20 }); this.sfx('woodKnock'); fx.emit('star', e.f.joints.headX, e.f.joints.headY - 10, 6, 0xffe066); break;
      case 'pan': fx.text(e.x, e.y - 50, 'CLANG', { color: '#cccccc', size: 40 }); this.sfx('bonk', { pitch: 0.6 }); break;
      case 'vineBoom': this.sfx('vineBoom'); this.scene.events.emit('flash', 0xffffff, 120); this.shake('mega'); break;
      case 'fireFist': fx.emit('glow', e.x, e.y, 30, 0xff7b00); fx.ring(e.x, e.y, 0xff7b00, 2.5); this.sfx('explosion'); fx.text(e.x, e.y - 60, 'FALCON PUNCH!', { color: '#ff7b00', size: 46 }); break;
      case 'sixseven': fx.emit('glow', e.x, e.y, 3, 0xffd166); break;
      case 'doublePalm': fx.ring(e.x, e.y, 0xffd166, 3); fx.emit('star', e.x, e.y, 20, 0xffd166); this.sfx('vineBoom'); break;
      case 'pressure': fx.ring(e.f.x, e.f.y - 80, 0xffffff, 2.5); this.shake('heavy'); this.sfx('vineBoom'); break;
      case 'lightning': fx.lightning(e.f.x + (Math.random() - 0.5) * 40, -400, e.f.x, e.f.y - 60, 0xfff6a0, 7, 12, 3); this.sfx('zap'); break;
      case 'judgment': fx.pillar(e.f.x, 0xfff6a0, 120, 50); this.sfx('thunder'); this.scene.events.emit('flash', 0xfff6a0, 300); break;
      case 'coffinDrop': fx.dust(e.f.x, GROUND_Y, 20); this.sfx('vineBoom'); this.shake('mega'); break;
      case 'sigmaFinish': fx.ring(e.x, e.y, 0xc084fc, 3); this.scene.events.emit('flash', 0xc084fc, 200); this.sfx('vineBoom'); break;
    }
  }

  namedFx(e) {
    const fx = this.fx;
    const f = e.f;
    const look = f ? this.lookFor(f) : null;
    switch (e.name) {
      case 'sixseven': fx.motes(e.alt ? f.joints.fHandX : f.joints.nHandX, e.alt ? f.joints.fHandY : f.joints.nHandY, 0xffd166, 2, 10); break;
      case 'snapBeat': {
        const hx = e.i % 2 ? f.joints.nHandX : f.joints.fHandX, hy = e.i % 2 ? f.joints.nHandY : f.joints.fHandY;
        fx.ring(hx, hy, 0xb388ff, 0.9 + e.i * 0.08, 260); fx.motes(f.x, f.y - 60, look.aura, 4, 50);
        fx.text(hx, hy - 30, '✦', { color: '#d9c2ff', size: 24, hold: 120, rise: 30 });
        this.sfxAt('fingerSnap', f.x, { pitch: 1 + (e.i % 4) * 0.06 }); break;
      }
      case 'sixsevenSlam':
        fx.groundWave(f.x, GROUND_Y - 4, 0xffd166, 520); fx.dust(f.x, GROUND_Y, 16); this.shake('heavy'); this.sfx('stomp');
        fx.text(f.x - 60, f.y - 160, '6', { color: '#ffd166', size: 64 }); fx.text(f.x + 60, f.y - 160, '7', { color: '#ffd166', size: 64 }); break;
      case 'rizzWink': fx.emit('heart', f.joints.headX + f.facing * 20, f.joints.headY, 8, 0xff5fa2); fx.text(f.joints.headX + f.facing * 30, f.joints.headY - 40, '😉', { size: 34, hold: 300 }); this.sfx('kissPop'); break;
      case 'menace': for (let i = 0; i < 2; i++) fx.text(f.x + (Math.random() - 0.5) * 220, f.y - 120 - Math.random() * 140, 'ゴ', { color: '#9b5de5', size: 30 + Math.random() * 26, hold: 260, rise: 40, angle: (Math.random() - 0.5) * 30 }); if (Math.random() < 0.5) this.sfx('heartbeat', { gain: 0.5 }); break;
      case 'tralalero': fx.emit('glow', f.x + f.facing * 50, GROUND_Y - 40, 14, 0x4cc9f0); fx.text(f.x, f.y - 210, 'TRALALERO TRALALA', { color: '#4cc9f0', size: e.big ? 40 : 30 }); this.sfx('bubbles'); break;
      case 'patapim': fx.text(f.x, f.y - 210, 'BRR BRR PATAPIM', { color: '#a7c957', size: 30 }); fx.dust(f.x, GROUND_Y, 8, 0x6b4423); this.sfx('woodKnock', { pitch: 0.5 }); break;
      case 'lirili':
        fx.ring(f.x, f.y - 90, 0xa7c957, 5, 600); this.sfx('tick'); this.sfx('rewind');
        fx.custom(70, (gt, gn, k, el) => drawLirili(gn, f.x - f.facing * 90, GROUND_Y, f.scale * 0.9, el));
        fx.text(f.x, f.y - 230, 'LIRILÌ LARILÀ', { color: '#a7c957', size: 30 }); break;
      case 'brushOff': fx.dust(f.joints.shX, f.joints.shY, 6, 0xdddddd, -f.facing, 0.5); fx.emit('star', f.joints.shX, f.joints.shY, 4, 0xffffff); break;
      case 'notes': fx.emit('note', f.x, f.y - 160, 2, [0x50fa7b, 0xff66ff, 0xffd166][Math.floor(Math.random() * 3)]); break;
      case 'whiff': fx.text(f.joints.nHandX, f.joints.nHandY - 20, 'FIU', { color: '#cccccc', size: 20, hold: 120, rise: 20 }); this.sfx('whoosh', { pitch: 1.3, gain: 0.6 }); break;
      case 'credits': {
        const a = f;
        fx.custom(110, (gt, gn, k, el) => { gt.fillStyle(0xfff2a8, 0.12 * Math.min(1, el / 10)); gt.fillTriangle(a.x, -600, a.x - 120, GROUND_Y, a.x + 120, GROUND_Y); });
        fx.text(a.x, a.y - 240, '★ PROTAGONISTA ★', { color: '#ffe066', size: 36, hold: 1400 });
        break;
      }
      case 'brainrot': this.brainrotStep(e); break;
      case 'jawline': fx.custom(40, (gt, gn, k) => { gt.lineStyle(4, 0x9be7ff, k); const j = f.joints, d = f.facing; gt.lineBetween(j.headX - d * 8, j.headY + 8, j.headX + d * 5, j.headY + 15); gt.lineBetween(j.headX + d * 5, j.headY + 15, j.headX + d * 13, j.headY + 9); }); fx.emit('star', f.joints.headX + f.facing * 6, f.joints.headY + 12, e.big ? 10 : 5, 0x9be7ff); this.sfx('ice'); break;
      case 'stare': {
        const j = f.joints;
        const ex = j.headX + f.facing * 8, ey = j.headY - 2;
        fx.beam(ex, ey, ex + f.facing * e.len, ey, 0xc084fc, 5, 22);
        fx.beam(ex, ey + 4, ex + f.facing * e.len, ey + 30, 0xc084fc, 2, 22);
        fx.beam(ex, ey - 4, ex + f.facing * e.len, ey - 30, 0xc084fc, 2, 22);
        this.sfx('beam'); this.dimTarget = 0.4; this.scene.time.delayedCall(300, () => { this.dimTarget = 0; });
        break;
      }
      case 'eyeBeam': { const j = f.joints; fx.beam(j.headX + f.facing * 8, j.headY - 2, j.headX + f.facing * e.len, j.headY - 2, 0xffe066, 14, 20); this.sfx('beam'); this.shake('medium'); break; }
      case 'sideEye': fx.text(e.d.x, e.d.y - 210, '👀', { size: 40, hold: 400 }); this.sfx('shutter'); fx.beam(f.joints.headX, f.joints.headY, e.d.joints.headX, e.d.joints.headY, 0xffe066, 3, 14); break;
      case 'auraFlare': fx.ring(f.x, f.y - 90, e.color, e.big ? 3 : 2, 500); fx.emit('glow', f.x, f.y - 90, e.big ? 40 : 20, e.color); this.sfx('burst'); if (e.big) { this.shake('heavy'); this.scene.events.emit('flash', e.color, 200); } break;
      case 'siuLand': fx.groundWave(f.x, GROUND_Y - 4, 0xff4d6d, 340); fx.dust(f.x, GROUND_Y, 20); fx.flash(f.x, f.y - 80, 0xffffff, 2); this.shake('heavy'); this.sfx('vineBoom'); this.arena.react('cheer', 1.2); break;
      case 'shadow': if (Math.floor(this.t) % 2 === 0) fx.marker(e.x, GROUND_Y, e.lock ? 0xff3333 : 0xffaa00, 3, 'shadow'); break;
      case 'heroLand': fx.groundWave(f.x, GROUND_Y - 4, look.aura, 300); fx.dust(f.x, GROUND_Y, 26); fx.ring(f.x, f.y - 40, look.aura, 2.4); this.shake('mega'); this.sfx('explosion'); break;
      case 'uno': fx.ring(f.x, f.y - 110, 0xff3b3b, 2); this.sfx('card'); fx.text(f.x, f.y - 160, '🔄', { size: 40, hold: 300 }); break;
      case 'chill': fx.emit('glow', f.x, f.y - 90, 12, 0x7fd6a0); break;
      case 'theft': fx.custom(24, (gt, gn, k) => { for (let i = 0; i < 6; i++) { const t2 = ((1 - k) + i / 6) % 1; const x = e.f.x + (e.a.x - e.f.x) * t2, y = e.f.y - 100 - Math.sin(t2 * Math.PI) * 60; gt.fillStyle(e.energy ? 0x4cc9f0 : 0xffd700, k); gt.fillCircle(x, y, 6); } }); this.sfx('coin'); break;
      case 'emote': fx.emit('star', f.x, f.y - 120, 8, 0xffffff); this.sfx('pop'); break;
      case 'ohio': fx.emit('glow', f.x, f.y - 100, 20, 0x7cfc00); this.sfx('glitch'); break;
      case 'spotlight': fx.custom(60, (gt, gn, k) => { gt.fillStyle(0xfff2a8, 0.25 * k); gt.fillTriangle(f.x, -600, f.x - 110, GROUND_Y, f.x + 110, GROUND_Y); }); this.sfx('sparkle'); break;
      case 'flash4k': fx.flash(f.joints.nHandX, f.joints.nHandY, 0xffffff, 3, 300); this.sfx('shutter'); fx.custom(10, (gt, gn, k) => { gt.fillStyle(0xffffff, 0.35 * k); gt.fillTriangle(f.joints.nHandX, f.joints.nHandY, f.x + f.facing * 320, f.y - 260, f.x + f.facing * 320, f.y); }); break;
      case 'cook': fx.emit('smoke', f.joints.nHandX, f.joints.nHandY, 10, 0xffffff); this.sfx('fire'); break;
      case 'mog': fx.ring(f.x, f.y - 120, 0x555577, 3, 500); this.sfx('whooshHeavy', { pitch: 0.5 }); break;
      case 'vent': if (e.warn) { fx.marker(e.x, GROUND_Y, 0xff3b3b, 30, 'warn'); } else { fx.dust(e.x, GROUND_Y, 14, 0x777777); this.sfx('teleport'); } break;
      case 'snap': fx.ring(f.joints.nHandX, f.joints.nHandY, 0xb388ff, 2.5); fx.flash(f.joints.nHandX, f.joints.nHandY, 0xb388ff, 2); this.sfx('snap'); this.scene.events.emit('flash', 0xb388ff, 150); break;
      case 'fire': fx.emit('glow', f.x, f.y - 30, 20, 0xff6a00); this.sfx('fire'); break;
      case 'brain': fx.emit('glow', f.joints.headX, f.joints.headY - 20, 12, 0xff99ff); this.sfx('energyFull'); break;
      case 'standFist': {
        const j = f.joints;
        const x = j.nHandX + f.facing * (20 + Math.random() * 60), y = j.nHandY + (Math.random() - 0.5) * 70;
        fx.custom(6, (gt, gn, k) => { gt.fillStyle(0xb388ff, 0.7 * k); gt.fillCircle(x, y, 9); gt.lineStyle(6 * k, 0xb388ff, 0.5 * k); gt.lineBetween(x - f.facing * 30, y, x, y); });
        this.sfx('hitLight', { pitch: 1.3, minGap: 0.04 });
        break;
      }
      case 'explosion': fx.flash(e.x, e.y, 0xff7b00, e.big ? 4 : 2.2); fx.emit('smoke', e.x, e.y, e.big ? 20 : 10, 0x444444); fx.sparks(e.x, e.y, 24, 0xffaa00, 12); fx.ring(e.x, e.y, 0xff7b00, e.big ? 4 : 2); this.sfx('explosion'); this.shake(e.big ? 'mega' : 'heavy'); break;
      case 'micDrop': fx.groundWave(f.x, GROUND_Y - 4, 0xcccccc, 420); this.sfx('vineBoom'); this.shake('heavy'); fx.text(f.x, f.y - 200, '🎤⬇', { size: 30 }); break;
      case 'ankle': fx.text(f.x, f.y - 120, 'CRACK', { color: '#ffb86c', size: 36 }); this.sfx('snap'); break;
      case 'farm': fx.emit('glow', f.x, f.y - 100, 4, 0xffe066); break;
      case 'plane': fx.custom(70, (gt, gn, k, el) => { const x = (f.facing > 0 ? WALL_L - 300 : WALL_R + 300) + f.facing * el * 40, y = GROUND_Y - 640; gn.fillStyle(0x6b8e23, 1); gn.fillRoundedRect(x - 60, y - 10, 120, 22, 10); gn.fillTriangle(x - 20, y, x + 10, y, x - 10, y - 40); gn.fillStyle(0xffffff, 1); gn.fillCircle(x + f.facing * 45, y - 2, 4); }); this.sfx('whooshHeavy', { pitch: 0.6 }); break;
      case 'pulseWarn': fx.ring(f.x, f.y - 100, 0xffffff, 1.5, 700); this.sfx('charge', { dur: 0.35 }); break;
      case 'pulse': fx.ring(f.x, f.y - 100, 0xe0e0e0, 12, 600); fx.groundWave(f.x, GROUND_Y, 0xffffff, 2400, 600); this.shake('heavy'); this.sfx('vineBoom'); break;
      case 'overload': fx.ring(f.x, f.y - 100, 0xffffff, 8, 700); fx.flash(f.x, f.y - 100, 0xffffff, 6, 600); this.scene.events.emit('flash', 0xffffff, 300); this.shake('mega'); this.sfx('explosion'); break;
      case 'coffin': {
        const a = f, d = e.d;
        fx.custom(140, (gt, gn, k, el) => {
          if (!a.move || !a.move.lock) return;
          const cx = d.x, cy = d.y - 30;
          gn.fillStyle(0x3b2414, 1); gn.fillRect(cx - 70, cy - 2, 140, 22); gn.fillStyle(0x6b4423, 1); gn.fillRect(cx - 66, cy + 2, 132, 14);
          for (const ox of [-80, -40, 40, 80]) {
            const bob = Math.sin(el * 0.35 + ox) * 6;
            const px = cx + ox, py = GROUND_Y;
            gn.lineStyle(6, 0x111111, 1); gn.lineBetween(px, py - 60 + bob, px, py - 110 + bob); gn.lineBetween(px, py - 60 + bob, px - 8, py); gn.lineBetween(px, py - 60 + bob, px + 8, py);
            gn.lineBetween(px, py - 104 + bob, px, cy + 20); gn.fillStyle(0x111111, 1); gn.fillCircle(px, py - 124 + bob, 12);
            gn.fillStyle(0xffffff, 1); gn.fillRect(px - 9, py - 128 + bob, 18, 4);
          }
        });
        this.sfx('tauntHorn');
        break;
      }
      case 'clap': fx.ring(f.joints.nHandX, f.joints.nHandY, 0xffd166, 2); this.sfx('slap', { pitch: 1.3 }); break;
      case 'stopSign': fx.text(f.x + f.facing * 60, f.y - 140, '✋', { size: 40, hold: 200 }); this.sfx('block', { pitch: 0.8 }); break;
      case 'zzz': fx.text(f.joints.headX + 20, f.joints.headY - 20, 'Z', { size: 22, color: '#8888ff', hold: 300 }); break;
    }
  }

  // secuencia cinemática de la Invasión Brainrot
  brainrotStep(e) {
    const fx = this.fx, v = e.f, a = e.a, d = Math.sign(v.x - a.x) || 1;
    switch (e.step) {
      case 'shark': fx.custom(40, (gt, gn, k, el) => { const p = Math.min(1, el / 8); drawShark(gn, a.x + (v.x - a.x) * p, GROUND_Y - 60 - Math.sin(p * Math.PI) * 60, d, 1.4, el * 2); }); break;
      case 'plane':
        this.sfx('planeEngine', { dur: 1.2 });
        fx.custom(44, (gt, gn, k, el) => { const x = v.x - d * 700 + d * el * 32; drawCrocPlane(gn, x, v.y - 420, d, 1.3, el); });
        for (const dt of [12, 20, 28]) this.scene.time.delayedCall(dt * 16, () => { this.sfx('bombWhistle'); fx.custom(10, (gt, gn, k2, el2) => { gn.fillStyle(0x222222, 1); gn.fillCircle(v.x + (Math.random() - 0.5) * 6, v.y - 380 + el2 * 32, 10); }); });
        break;
      case 'tung': fx.custom(36, (gt, gn, k, el) => drawTungTung(gn, v.x + d * 90, GROUND_Y, 1.3, el * 1.4, -d)); fx.text(v.x, v.y - 260, 'TUNG TUNG TUNG SAHUR', { color: '#c68642', size: 36 }); break;
      case 'ballerina': this.sfx('musicBox'); fx.custom(30, (gt, gn, k, el) => drawBallerina(gn, v.x - d * 300 + d * el * 12, GROUND_Y, 1.4, el * 2)); fx.text(v.x, v.y - 260, 'BALLERINA CAPPUCCINA', { color: '#ffb6c1', size: 34 }); break;
    }
  }

  onKO(e) {
    const f = e.f, fx = this.fx;
    const look = e.attacker ? this.lookFor(e.attacker) : { aura: 0xffffff };
    fx.ring(f.x, f.y - 90, 0xffffff, 4, 700);
    fx.ring(f.x, f.y - 90, look.aura, 6, 1000);
    fx.flash(f.x, f.y - 90, 0xffffff, 5, 600);
    fx.sparks(f.x, f.y - 90, 50, look.aura, 16);
    fx.emit('glow', f.x, f.y - 90, 40, this.lookFor(f).aura);
    this.sfx('ko'); this.sfx('vineBoom');
    this.shake([500, 0.016]);
    this.arena.react('cheer', 2);
    if (e.final) {
      this.focus(f.x, f.y - 120, 1.45, 110, 0.06);
      this.scene.events.emit('ko', e);
      this.scene.events.emit('flash', 0xffffff, 250);
    } else {
      fx.text(f.x, f.y - 220, 'ELIMINADO', { color: '#ff4d6d', size: 40 });
    }
  }

  celebrate(team) {
    for (const f of this.b.fighters) if (f.team === team && f.alive) {
      this.fx.emit('confetti', f.x, f.y - 200, 60, Math.random() * 0xffffff);
      this.sfx('sparkle');
    }
    for (let i = 0; i < 3; i++) this.scene.time.delayedCall(400 * i, () => this.fx.emit('confetti', this.cs.x + (Math.random() - 0.5) * 800, this.cs.y - 300, 40));
  }

  destroy() {
    this.arena.destroy();
    this.fx.destroy();
    for (const g of [this.gRefl, this.gShadow, this.gBack, this.gGlow, this.gBody, this.gProj, this.gProjAdd, this.gOver, this.gOverAdd, this.gDebug, this.dim]) g.destroy();
    if (this.cam.postFX) { try { this.cam.postFX.clear(); } catch (e) { /* nada */ } }
  }
}

const STATUS_COL = { chill: 0x7fd6a0, goblin: 0x66cc33, infMewing: 0x6fd8ff };

const _reflJ = {};
function mirrorJoints(j, o) {
  for (const k in j) o[k] = j[k];
  for (const k in j) if (k.endsWith('Y') && typeof j[k] === 'number') o[k] = 2 * GROUND_Y - j[k];
  o.headAng = 180 - (j.headAng || 0); o.lean = 180 - (j.lean || 0);
  return o;
}

function shiftAll(j, dx) {
  for (const k in j) if (k.endsWith('X') && typeof j[k] === 'number') j[k] += dx;
}

function drawStar(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillPath();
}

// ---------------- props ----------------
function unoCard(g, glow, j, s, look, a, d) {
  const x = j.nHandX + d * 6 * s, y = j.nHandY - 14 * s;
  g.fillStyle(0x0a0a14, a); g.fillRoundedRect(x - 12 * s, y - 17 * s, 24 * s, 34 * s, 4 * s);
  g.fillStyle(0xe63946, a); g.fillRoundedRect(x - 10 * s, y - 15 * s, 20 * s, 30 * s, 3 * s);
  g.fillStyle(0xffffff, a); g.fillEllipse(x, y, 14 * s, 22 * s);
  g.fillStyle(0xe63946, a); g.fillTriangle(x - 5 * s, y - 2 * s, x + 3 * s, y - 8 * s, x + 3 * s, y + 2 * s); g.fillTriangle(x + 5 * s, y + 2 * s, x - 3 * s, y + 8 * s, x - 3 * s, y - 2 * s);
  if (glow) { glow.fillStyle(0xff3b3b, 0.3 * a); glow.fillCircle(x, y, 26 * s); }
}
function cookPot(g, glow, j, s, look, a, d) {
  const x = j.nHandX + d * 4 * s, y = j.nHandY + 18 * s;
  g.fillStyle(0x0a0a14, a); g.fillRoundedRect(x - 22 * s, y - 4 * s, 44 * s, 30 * s, 6 * s);
  g.fillStyle(0x5c5c6e, a); g.fillRoundedRect(x - 20 * s, y - 2 * s, 40 * s, 26 * s, 5 * s);
  g.fillStyle(0xff8844, a); g.fillEllipse(x, y, 38 * s, 8 * s);
  g.lineStyle(3 * s, 0x8b5a2b, a); g.lineBetween(j.nHandX, j.nHandY, x - d * 6 * s, y + 4 * s);
}
function mic(g, glow, j, s, look, a, d) {
  const x = j.nHandX, y = j.nHandY;
  g.lineStyle(6 * s, 0x222222, a); g.lineBetween(x, y, x + d * 4 * s, y - 14 * s);
  g.fillStyle(0x999999, a); g.fillCircle(x + d * 5 * s, y - 17 * s, 6 * s);
}
function bat(g, glow, j, s, look, a, d) {
  const ang = Math.atan2(j.nHandY - j.nElbowY, j.nHandX - j.nElbowX);
  const x2 = j.nHandX + Math.cos(ang) * 56 * s, y2 = j.nHandY + Math.sin(ang) * 56 * s;
  g.lineStyle(11 * s, 0x0a0a14, a); g.lineBetween(j.nHandX, j.nHandY, x2, y2);
  g.lineStyle(5 * s, 0x8d5524, a); g.lineBetween(j.nHandX, j.nHandY, x2, y2);
  g.fillStyle(0x0a0a14, a); g.fillCircle(x2, y2, 8 * s); g.fillStyle(0xa0662e, a); g.fillCircle(x2, y2, 6 * s);
  void d;
}
function pan(g, glow, j, s, look, a, d) {
  const ang = Math.atan2(j.nHandY - j.nElbowY, j.nHandX - j.nElbowX);
  const x2 = j.nHandX + Math.cos(ang) * 30 * s, y2 = j.nHandY + Math.sin(ang) * 30 * s;
  g.lineStyle(5 * s, 0x222222, a); g.lineBetween(j.nHandX, j.nHandY, x2, y2);
  g.fillStyle(0x111111, a); g.fillCircle(x2 + Math.cos(ang) * 14 * s, y2 + Math.sin(ang) * 14 * s, 15 * s);
  g.fillStyle(0x3a3a3a, a); g.fillCircle(x2 + Math.cos(ang) * 14 * s, y2 + Math.sin(ang) * 14 * s, 11 * s);
  void d;
}
function mug(g, glow, j, s, look, a, d) {
  const x = j.nHandX + d * 3 * s, y = j.nHandY - 4 * s;
  g.fillStyle(0xffffff, a); g.fillRect(x - 6 * s, y - 8 * s, 12 * s, 14 * s);
  g.lineStyle(2 * s, 0xffffff, a); g.strokeCircle(x + d * 8 * s, y - 1 * s, 4 * s);
  g.fillStyle(0x6b4423, a); g.fillRect(x - 6 * s, y - 8 * s, 12 * s, 3 * s);
  g.fillStyle(0x6b4423, a); g.fillRect(j.hipX - 22 * s, j.hipY + 6 * s, 44 * s, 6 * s);
  g.fillRect(j.hipX - 20 * s, j.hipY + 10 * s, 5 * s, GROUND_Y - j.hipY - 10 * s); g.fillRect(j.hipX + 15 * s, j.hipY + 10 * s, 5 * s, GROUND_Y - j.hipY - 10 * s);
}
function coffin(g, glow, j, s, look, a, d) { void g; void glow; void j; void s; void look; void a; void d; }
function chefHat(g, glow, j, s, look, a, d) {
  const x = j.headX, y = j.headY - j.headR;
  g.fillStyle(0x0a0a14, a); g.fillRect(x - 11 * s, y - 6 * s, 22 * s, 9 * s);
  g.fillStyle(0xffffff, a); g.fillRect(x - 9 * s, y - 5 * s, 18 * s, 7 * s);
  g.fillCircle(x - 7 * s, y - 12 * s, 7 * s); g.fillCircle(x + 7 * s, y - 12 * s, 7 * s); g.fillCircle(x, y - 17 * s, 8 * s);
  void d; void glow; void look;
}
export { mix, shade };

// Sistema de efectos: partículas propias (chispas, estelas, polvo), emisores con textura, ondas, rayos y textos.
import { heartShape } from './StickRenderer.js';

const FONT = '"Anton", Impact, "Arial Black", sans-serif';

export class FX {
  constructor(scene, quality = 'alta') {
    this.s = scene;
    this.q = quality === 'baja' ? 0.5 : 1;
    this.parts = [];
    this.temps = []; // efectos de duración (rayos, haces, marcas)
    this.g = scene.add.graphics().setDepth(30).setBlendMode('ADD');
    this.gn = scene.add.graphics().setDepth(29);
    this.gt = scene.add.graphics().setDepth(31).setBlendMode('ADD');
    const em = (tex, cfg, depth = 28) => {
      const e = scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
      e.setDepth(depth);
      return e;
    };
    this.em = {
      glow: em('dot', { speed: { min: 60, max: 260 }, lifespan: { min: 250, max: 600 }, scale: { start: 0.9, end: 0 }, alpha: { start: 0.8, end: 0 }, blendMode: 'ADD' }),
      heart: em('heart', { speed: { min: 80, max: 260 }, lifespan: { min: 500, max: 1000 }, scale: { start: 0.6, end: 0.1 }, alpha: { start: 1, end: 0 }, gravityY: -120, rotate: { min: -30, max: 30 } }),
      star: em('star', { speed: { min: 100, max: 380 }, lifespan: { min: 300, max: 700 }, scale: { start: 0.7, end: 0 }, rotate: { start: 0, end: 360 }, blendMode: 'ADD' }),
      note: em('note', { speed: { min: 60, max: 180 }, lifespan: { min: 600, max: 1100 }, scale: { start: 0.8, end: 0.3 }, alpha: { start: 1, end: 0 }, gravityY: -80 }),
      confetti: em('square', { speed: { min: 200, max: 600 }, angle: { min: 220, max: 320 }, lifespan: { min: 1200, max: 2200 }, scale: { start: 1, end: 0.6 }, gravityY: 600, rotate: { min: 0, max: 360 } }, 40),
      smoke: em('smoke', { speed: { min: 20, max: 120 }, lifespan: { min: 500, max: 900 }, scale: { start: 0.6, end: 2.2 }, alpha: { start: 0.45, end: 0 } }, 27)
    };
  }

  emit(name, x, y, n, tint) {
    const e = this.em[name];
    if (!e) return;
    if (tint !== undefined) e.setParticleTint(tint);
    e.explode(Math.max(1, Math.round(n * this.q)), x, y);
  }

  // partícula propia
  p(x, y, vx, vy, life, size, color, type = 'dot', extra = {}) {
    if (this.parts.length > 900) return;
    this.parts.push({ x, y, vx, vy, life, max: life, size, color, type, drag: extra.drag ?? 0.92, grav: extra.grav ?? 0, add: extra.add !== false, len: extra.len || 1 });
  }

  sparks(x, y, n, color, speed = 9, dir = 0, spread = Math.PI * 2) {
    n = Math.round(n * this.q);
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const sp = speed * (0.4 + Math.random() * 0.9);
      this.p(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 10 + Math.random() * 14, 2 + Math.random() * 2.5, color, 'streak', { drag: 0.88, len: 2.2 });
    }
  }
  dust(x, y, n = 8, color = 0xcfc6b8, dir = 0) {
    n = Math.round(n * this.q);
    for (let i = 0; i < n; i++) {
      const a = Math.PI + Math.random() * Math.PI;
      this.p(x + (Math.random() - 0.5) * 30, y - 4, Math.cos(a) * (2 + Math.random() * 3) + dir * 2, Math.sin(a) * (1 + Math.random() * 2), 24 + Math.random() * 18, 6 + Math.random() * 8, color, 'puff', { add: false, drag: 0.9, grav: -0.02 });
    }
  }
  motes(x, y, color, n = 1, spread = 30) {
    for (let i = 0; i < n; i++) this.p(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * 0.6, -1 - Math.random() * 2.2, 26 + Math.random() * 24, 2 + Math.random() * 3, color, 'dot', { drag: 0.99 });
  }

  ring(x, y, color, size = 1, dur = 320, thick = 1, depth = 33) {
    const im = this.s.add.image(x, y, 'ring').setTint(color).setBlendMode('ADD').setDepth(depth).setScale(0.15 * size).setAlpha(0.95);
    this.s.tweens.add({ targets: im, scale: 1.4 * size, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => im.destroy() });
    void thick;
  }
  groundWave(x, y, color, width = 300, dur = 380) {
    const im = this.s.add.image(x, y, 'ring').setTint(color).setBlendMode('ADD').setDepth(33).setScale(0.2, 0.05).setAlpha(1);
    this.s.tweens.add({ targets: im, scaleX: width / 64, scaleY: width / 640, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => im.destroy() });
  }
  flash(x, y, color, size = 1, dur = 240) {
    const im = this.s.add.image(x, y, 'flare').setTint(color).setBlendMode('ADD').setDepth(32).setScale(0.3 * size).setAlpha(1);
    this.s.tweens.add({ targets: im, scale: 1.7 * size, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => im.destroy() });
  }

  lightning(x1, y1, x2, y2, color = 0xbfe9ff, width = 4, life = 14, branches = 2) {
    const pts = [[x1, y1]];
    const n = 10;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push([x1 + (x2 - x1) * t + (Math.random() - 0.5) * 40, y1 + (y2 - y1) * t + (Math.random() - 0.5) * 20]);
    }
    pts.push([x2, y2]);
    this.temps.push({ type: 'bolt', pts, color, width, life, max: life });
    for (let b = 0; b < branches; b++) {
      const k = 2 + Math.floor(Math.random() * (n - 4));
      const [bx, by] = pts[k];
      const bp = [[bx, by]];
      for (let i = 1; i < 5; i++) bp.push([bx + (Math.random() - 0.3) * 30 * i, by + 20 * i]);
      this.temps.push({ type: 'bolt', pts: bp, color, width: width * 0.5, life: life * 0.7, max: life * 0.7 });
    }
  }
  beam(x1, y1, x2, y2, color, width, life) { this.temps.push({ type: 'beam', x1, y1, x2, y2, color, width, life, max: life }); }
  pillar(x, color, width, life) { this.temps.push({ type: 'pillar', x, color, width, life, max: life }); }
  marker(x, y, color, life, kind = 'shadow') { this.temps.push({ type: kind, x, y, color, life, max: life }); }
  custom(life, draw) { this.temps.push({ type: 'custom', life, max: life, draw }); }

  text(x, y, str, opts = {}) {
    const size = opts.size || 34;
    const t = this.s.add.text(x, y, str, {
      fontFamily: FONT, fontSize: size + 'px', color: opts.color || '#ffffff', stroke: opts.stroke || '#000000', strokeThickness: Math.max(4, size / 6),
      shadow: { offsetX: 0, offsetY: 3, color: '#000', blur: 6, fill: true }
    }).setOrigin(0.5).setDepth(opts.depth || 60).setScale(0.2).setAngle(opts.angle ?? (Math.random() - 0.5) * 8);
    this.s.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.s.tweens.add({ targets: t, y: y - (opts.rise ?? 50), alpha: 0, delay: opts.hold ?? 600, duration: 450, ease: 'Cubic.easeIn', onComplete: () => t.destroy() });
    return t;
  }
  number(x, y, val, color = '#ffffff', big = false) {
    const t = this.s.add.text(x + (Math.random() - 0.5) * 30, y, String(Math.round(val)), {
      fontFamily: FONT, fontSize: (big ? 30 : 20) + 'px', color, stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(61);
    this.s.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  update() {
    const g = this.g, gn = this.gn;
    g.clear(); gn.clear(); this.gt.clear();
    for (const p of this.parts) {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.grav;
      p.x += p.vx; p.y += p.vy; p.life--;
      const k = p.life / p.max;
      const gg = p.add ? g : gn;
      if (p.type === 'streak') {
        gg.lineStyle(p.size * (0.5 + k), p.color, k);
        gg.lineBetween(p.x, p.y, p.x - p.vx * p.len, p.y - p.vy * p.len);
      } else if (p.type === 'puff') {
        gg.fillStyle(p.color, 0.35 * k); gg.fillCircle(p.x, p.y, p.size * (1.6 - k * 0.6));
      } else {
        gg.fillStyle(p.color, k); gg.fillCircle(p.x, p.y, p.size * (0.4 + k * 0.6));
      }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    const gt = this.gt;
    for (const t of this.temps) {
      const k = t.life / t.max;
      if (t.type === 'bolt') {
        for (const [w, a] of [[t.width * 3, 0.25], [t.width, 1]]) {
          gt.lineStyle(w * (0.5 + k * 0.5), w > t.width ? t.color : 0xffffff, a * k);
          gt.beginPath(); gt.moveTo(t.pts[0][0], t.pts[0][1]);
          for (const p of t.pts) gt.lineTo(p[0], p[1]);
          gt.strokePath();
        }
      } else if (t.type === 'beam') {
        gt.lineStyle(t.width * 2.2 * k, t.color, 0.3 * k); gt.lineBetween(t.x1, t.y1, t.x2, t.y2);
        gt.lineStyle(t.width * k, 0xffffff, 0.9 * k); gt.lineBetween(t.x1, t.y1, t.x2, t.y2);
      } else if (t.type === 'pillar') {
        const w = t.width * (0.4 + (1 - k) * 0.8);
        gt.fillStyle(t.color, 0.35 * k); gt.fillRect(t.x - w, -1200, w * 2, 1800 + 600);
        gt.fillStyle(0xffffff, 0.7 * k); gt.fillRect(t.x - w * 0.3, -1200, w * 0.6, 2400);
      } else if (t.type === 'shadow') {
        gn.fillStyle(0x000000, 0.45 * Math.min(1, (t.max - t.life) / 10 + 0.2)); gn.fillEllipse(t.x, t.y, 130, 26);
        gn.lineStyle(3, t.color, 0.8); gn.strokeEllipse(t.x, t.y, 140 + Math.sin(t.life) * 6, 30);
      } else if (t.type === 'warn') {
        gn.lineStyle(4, t.color, 0.5 + Math.sin(t.life * 0.6) * 0.4); gn.strokeEllipse(t.x, t.y, 140, 30);
        gn.fillStyle(t.color, 0.12); gn.fillEllipse(t.x, t.y, 140, 30);
      } else if (t.type === 'custom') {
        t.draw(gt, gn, k, t.max - t.life);
      }
      t.life--;
    }
    this.temps = this.temps.filter(t => t.life > 0);
  }

  heart(g, x, y, r, color, a) { heartShape(g, x, y, r, color, a); }

  destroy() {
    for (const k in this.em) this.em[k].destroy();
    this.g.destroy(); this.gn.destroy(); this.gt.destroy();
  }
}

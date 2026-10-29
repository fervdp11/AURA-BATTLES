// Auras profesionales y sombras suaves con sprites de degradado (sin círculos duros ni pixelado).
// Cada luchador recibe: resplandor corporal en capas a lo largo del rig, lenguas de fuego que nacen del
// cuerpo y suben con parpadeo, y partículas según el estilo de aura (clásica, llamarada, destellos,
// eléctrica, corazones, Six Seven, prisma multicolor, vacío). Todo se recalcula cada fotograma desde un pool.
import { hsl } from './StickRenderer.js';
import { GROUND_Y } from '../sim/constants.js';

class Pool {
  constructor(scene, depth, blend) { this.s = scene; this.depth = depth; this.blend = blend; this.items = []; this.i = 0; }
  begin() { this.i = 0; }
  get(tex) {
    let im = this.items[this.i];
    if (!im) { im = this.s.add.image(0, 0, tex).setDepth(this.depth).setBlendMode(this.blend); this.items.push(im); }
    else if (im.texture.key !== tex) im.setTexture(tex);
    this.i++;
    return im.setVisible(true).setRotation(0).setOrigin(0.5, 0.5);
  }
  end() { for (let k = this.i; k < this.items.length; k++) this.items[k].setVisible(false); }
  destroy() { for (const im of this.items) im.destroy(); this.items = []; }
}

const SEGS = [['hip', 'neck', 1], ['sh', 'nElbow', 0.55], ['nElbow', 'nHand', 0.5], ['sh', 'fElbow', 0.5], ['fElbow', 'fHand', 0.45], ['hip', 'nKnee', 0.6], ['nKnee', 'nFoot', 0.5], ['hip', 'fKnee', 0.55], ['fKnee', 'fFoot', 0.45]];

export class AuraLayer {
  constructor(scene, depth = 7, shadowDepth = -6, low = false) {
    this.s = scene; this.low = low; // calidad baja: menos capas y partículas
    this.back = new Pool(scene, depth, 'ADD');       // resplandor y llamas detrás del cuerpo
    this.front = new Pool(scene, depth + 4, 'ADD');  // destellos finos delante
    this.dark = new Pool(scene, depth - 1, 'NORMAL'); // aura de vacío (oscura)
    this.shad = new Pool(scene, shadowDepth, 'NORMAL'); // sombras en el suelo
    this.parts = new Map(); // partículas por luchador
  }
  begin() { this.back.begin(); this.front.begin(); this.dark.begin(); this.shad.begin(); }
  end() { this.back.end(); this.front.end(); this.dark.end(); this.shad.end(); }
  destroy() { this.back.destroy(); this.front.destroy(); this.dark.destroy(); this.shad.destroy(); }

  // j: articulaciones; I: intensidad (0..2+); style; color base; key: id estable del luchador
  draw(key, j, s, color, I, style = 'classic', time = 0, alpha = 1, opts = {}) {
    if (I <= 0.02 || alpha <= 0.02) return;
    const A = Math.min(1.4, I) * alpha;
    const col = i => (style === 'prism' || opts.rainbow ? hsl((time * 3 + i * 47) % 360, 1, 0.62) : style === 'sixseven' ? (Math.floor(time / 8 + i) % 2 ? 0xffd166 : 0xffffff) : color);
    const pulse = 1 + Math.sin(time * 0.12) * 0.06;
    // 1) resplandor corporal: blobs suaves a lo largo de cada segmento (varias capas, sin bordes)
    if (style === 'void') {
      for (const [a, b, w] of SEGS) for (let t = 0; t <= 1; t += 0.5) {
        const im = this.dark.get('softGlow'); const x = j[a + 'X'] + (j[b + 'X'] - j[a + 'X']) * t, y = j[a + 'Y'] + (j[b + 'Y'] - j[a + 'Y']) * t;
        im.setPosition(x, y).setScale(0.75 * s * w * pulse).setTint(0x12001f).setAlpha(0.32 * A);
      }
    }
    let n = 0;
    const step = this.low ? 1 : 0.5;
    for (const [a, b, w] of SEGS) {
      for (let t = 0; t <= 1.001; t += step) {
        const x = j[a + 'X'] + (j[b + 'X'] - j[a + 'X']) * t, y = j[a + 'Y'] + (j[b + 'Y'] - j[a + 'Y']) * t;
        const im = this.back.get('softGlow');
        im.setPosition(x, y).setScale(0.62 * s * w * pulse * (0.9 + I * 0.25)).setTint(style === 'void' ? 0x8a2be2 : col(n++)).setAlpha(0.13 * A);
      }
    }
    const head = this.back.get('softGlow');
    head.setPosition(j.headX, j.headY).setScale(0.55 * s * pulse * (0.9 + I * 0.25)).setTint(style === 'void' ? 0x8a2be2 : col(3)).setAlpha(0.16 * A);
    // núcleo cálido en el pecho
    const core = this.back.get('softGlow');
    core.setPosition((j.hipX + j.neckX) / 2, (j.hipY + j.neckY) / 2).setScale(1.3 * s * pulse).setTint(style === 'void' ? 0x2a0045 : col(5)).setAlpha(0.1 * A);
    // 2) lenguas de fuego que nacen del cuerpo (a partir de intensidad media, o siempre en llamarada)
    const flames = Math.round((style === 'flame' ? 14 : I > 0.55 ? 6 + I * 4 : 0) * (this.low ? 0.5 : 1));
    for (let i = 0; i < flames; i++) {
      const u = (i + 0.5) / flames;
      const ph = time * 0.09 + i * 1.37;
      const bx = j.hipX + (j.neckX - j.hipX) * u * 0.95 + Math.sin(ph * 1.7) * 5 * s;
      const by = j.hipY + (j.neckY - j.hipY) * u * 0.95 + 14 * s;
      const h = (0.42 + 0.22 * Math.sin(ph) ** 2) * s * Math.min(1.7, I + (style === 'flame' ? 0.6 : 0));
      const im = this.back.get('flameSoft');
      im.setOrigin(0.5, 0.92).setPosition(bx, by).setScale(0.55 * s * (0.8 + 0.3 * Math.sin(ph * 2.3)), h).setRotation(Math.sin(ph * 0.8) * 0.18).setTint(style === 'void' ? 0x6a0dad : col(i)).setAlpha(0.32 * A);
      if (i % 2 === 0) { const c2 = this.back.get('flameSoft'); c2.setOrigin(0.5, 0.92).setPosition(bx, by).setScale(0.3 * s, h * 0.62).setRotation(Math.sin(ph * 0.8) * 0.18).setTint(0xffffff).setAlpha(0.18 * A); }
    }
    // 3) partículas del estilo
    let P = this.parts.get(key);
    if (!P) { P = []; this.parts.set(key, P); }
    const rate = { classic: 0.25, flame: 0.45, sparkle: 0.5, electric: 0.35, hearts: 0.28, sixseven: 0.3, prism: 0.45, void: 0.35 }[style] ?? 0.25;
    if (Math.random() < rate * Math.min(1.5, I) * (this.low ? 0.5 : 1) && P.length < (this.low ? 16 : 40)) {
      const t = Math.random();
      P.push({ x: j.hipX + (j.neckX - j.hipX) * t + (Math.random() - 0.5) * 30 * s, y: j.hipY + (j.neckY - j.hipY) * t + (Math.random() - 0.5) * 20 * s, vx: (Math.random() - 0.5) * 0.6, vy: -0.8 - Math.random() * 1.6, life: 1, i: Math.floor(Math.random() * 99), r: Math.random() * 6.28 });
    }
    const tex = { sparkle: 'sparkleSoft', hearts: 'heart', electric: 'sparkleSoft', prism: 'sparkleSoft' }[style] || 'softGlow';
    for (const p of P) {
      p.x += p.vx; p.y += p.vy; p.life -= 0.022; p.r += 0.05;
      if (p.life <= 0) continue;
      const im = this.front.get(style === 'sixseven' ? (p.i % 2 ? 'glyph6' : 'glyph7') : tex);
      const sc = style === 'sixseven' ? 0.32 * s : style === 'hearts' ? 0.32 * s : style === 'sparkle' || style === 'prism' || style === 'electric' ? 0.3 * s : 0.12 * s;
      im.setPosition(p.x, p.y).setScale(sc * (0.6 + p.life * 0.6)).setTint(style === 'void' ? 0xb388ff : style === 'hearts' ? 0xff5fa2 : col(p.i)).setAlpha(Math.min(1, p.life * 1.6) * 0.85 * alpha).setRotation(style === 'sparkle' || style === 'prism' ? p.r : 0);
    }
    for (let i = P.length - 1; i >= 0; i--) if (P[i].life <= 0) P.splice(i, 1);
    // 4) chispas eléctricas cortas entre articulaciones
    if (style === 'electric' && Math.random() < 0.5) {
      const [a, b] = SEGS[Math.floor(Math.random() * SEGS.length)];
      const im = this.front.get('sparkleSoft'); im.setPosition(j[a + 'X'] + (Math.random() - 0.5) * 16 * s, j[a + 'Y'] + (Math.random() - 0.5) * 16 * s).setScale(0.45 * s).setTint(0xbfe9ff).setAlpha(0.9 * alpha); void b;
    }
  }

  // sombra suave proyectada: centrada bajo el centro de masas, se estira según la luz del escenario y se
  // desvanece con la altura; más un contacto suave bajo cada pie apoyado.
  shadow(f, j, lightDx = 0.25, alpha = 1) {
    const G = f.groundY ?? GROUND_Y, s = f.scale, h = Math.max(0, G - f.y);
    const k = Math.max(0.15, 1 - h / 420) * alpha;
    const cx = (j.hipX * 2 + j.nFootX + j.fFootX) / 4;
    const span = Math.abs(j.nFootX - j.fFootX);
    const w = (52 + span * 0.9) * s * Math.max(0.45, 1 - h / 600);
    const sh = this.shad.get('shadowSoft');
    sh.setPosition(cx + lightDx * (60 + h * 0.25) * s, G + 3).setScale(w / 128 * 1.35, 18 * s / 64 * 1.2).setAlpha(0.42 * k).setTint(0x000000);
    for (const p of ['n', 'f']) {
      const fy = j[p + 'FootY'], c = Math.max(0, 1 - (G - fy) / 30);
      if (c <= 0) continue;
      const fs = this.shad.get('shadowSoft');
      fs.setPosition(j[p + 'FootX'] + f.facing * 4 * s, G + 2).setScale(26 * s / 128 * 1.4, 7 * s / 64 * 1.6).setAlpha(0.5 * c * alpha).setTint(0x000000);
    }
  }
}

// Biblioteca de poses del stickman y modificadores procedurales.
import { makePose, lerpPose, copyPose, ease } from './skeleton.js';

const P = (o) => makePose(o);

export const POSES = {
  idle: P({ lean: 3, fa: [-10, 8], na: [12, 26], fl: [-10, -6], nl: [12, 4] }),
  guard: P({ lean: 8, fa: [38, 148], na: [58, 158], fl: [-16, -22], nl: [24, 2] }),
  crouch: P({ lean: 24, fa: [40, 130], na: [62, 140], fl: [52, -40], nl: [82, -6] }),
  jump: P({ lean: 6, fa: [-40, -10], na: [120, 160], fl: [40, -60], nl: [78, -12] }),
  fall: P({ lean: -4, fa: [-70, -50], na: [100, 80], fl: [-12, -24], nl: [22, 2] }),
  land: P({ lean: 20, fa: [-30, 10], na: [40, 80], fl: [40, -50], nl: [70, -10] }),
  dash: P({ lean: 34, fa: [-118, -104], na: [-108, -92], fl: [-42, -20], nl: [58, -26], face: 'angry' }),
  backdash: P({ lean: -18, fa: [60, 120], na: [70, 130], fl: [30, -40], nl: [-20, -30] }),
  hurt: P({ lean: -26, head: -22, fa: [-50, -20], na: [-30, 20], fl: [-6, -10], nl: [18, 2], face: 'hurt' }),
  hurtLow: P({ lean: 34, head: 18, fa: [20, 40], na: [40, 60], fl: [30, -30], nl: [50, -10], face: 'hurt' }),
  airHurt: P({ lean: -58, head: -30, fa: [-140, -120], na: [-80, -40], fl: [40, 60], nl: [70, 90], face: 'hurt' }),
  lying: P({ lean: -90, head: -6, fa: [-120, -150], na: [-70, -40], fl: [88, 92], nl: [92, 90], face: 'ko' }),
  getup: P({ lean: 40, fa: [60, 10], na: [40, 0], fl: [80, -60], nl: [90, -10], face: 'angry' }),
  block: P({ lean: -4, head: 8, fa: [72, 172], na: [88, 176], fl: [-18, -14], nl: [20, 4], face: 'angry', fh: 'open', nh: 'open' }),
  lowBlock: P({ lean: 22, head: 10, fa: [70, 150], na: [84, 160], fl: [52, -40], nl: [82, -6], face: 'angry', fh: 'open', nh: 'open' }),
  dizzy: P({ lean: -8, head: 18, fa: [-6, 2], na: [4, 6], fl: [-8, -4], nl: [10, 2], face: 'dizzy' }),
  frozen: P({ lean: 10, fa: [40, 100], na: [60, 120], fl: [-14, -20], nl: [24, 0], face: 'shock' }),
  ko: P({ lean: -70, head: -40, fa: [-160, -170], na: [-110, -150], fl: [60, 70], nl: [80, 100], face: 'ko' }),
  held: P({ lean: -10, head: -8, fa: [-30, -10], na: [20, 40], fl: [-6, -4], nl: [8, 2], face: 'shock' }),
  charmed: P({ lean: 12, head: 10, fa: [60, 80], na: [70, 90], fl: [-8, -6], nl: [16, 6], face: 'rizzed', fh: 'open', nh: 'open' }),
  scared: P({ lean: -22, head: -10, fa: [70, 170], na: [80, 175], fl: [-30, -10], nl: [10, 0], face: 'shock', fh: 'open', nh: 'open' }),

  // golpes básicos
  jabW: P({ lean: 8, fa: [42, 150], na: [40, 152], fl: [-16, -22], nl: [24, 2] }),
  jab: P({ lean: 16, hx: 4, fa: [40, 150], na: [90, 90], fl: [-22, -22], nl: [30, 4], face: 'angry' }),
  cross: P({ lean: 24, hx: 8, fa: [90, 90], na: [40, 140], fl: [-26, -20], nl: [34, 6], face: 'angry' }),
  hookW: P({ lean: 4, fa: [40, 140], na: [-30, 70], fl: [-16, -22], nl: [24, 2] }),
  hook: P({ lean: 22, hx: 6, fa: [36, 140], na: [100, 140], fl: [-24, -18], nl: [32, 6], face: 'angry' }),
  lowKick: P({ lean: -12, fa: [40, 140], na: [58, 150], fl: [-14, -8], nl: [74, 76], face: 'angry' }),
  roundW: P({ lean: 6, fa: [-40, 0], na: [40, 140], fl: [-10, -6], nl: [40, -40] }),
  roundhouse: P({ lean: -28, fa: [-70, -40], na: [40, 140], fl: [-8, -4], nl: [112, 104], face: 'angry' }),
  upperW: P({ lean: 26, fa: [40, 130], na: [30, 60], fl: [44, -40], nl: [76, -8] }),
  uppercut: P({ lean: 4, hy: -8, fa: [-30, 10], na: [168, 176], fl: [-16, -12], nl: [26, 8], face: 'angry' }),
  lungeW: P({ lean: -6, fa: [-60, 40], na: [50, 150], fl: [-10, -10], nl: [16, 0] }),
  lunge: P({ lean: 36, hx: 10, fa: [96, 92], na: [30, 120], fl: [-44, -42], nl: [58, 18], face: 'angry' }),
  airKick: P({ lean: -14, fa: [-60, -30], na: [60, 140], fl: [30, -70], nl: [86, 86], face: 'angry' }),
  diveKick: P({ lean: -20, fa: [-100, -80], na: [80, 160], fl: [30, -80], nl: [44, 40], face: 'angry' }),
  sweep: P({ lean: 40, fa: [60, 0], na: [80, 10], fl: [70, -60], nl: [94, 94], face: 'angry' }),
  shoulder: P({ lean: 34, hx: 10, fa: [-30, 30], na: [60, 20], fl: [-40, -36], nl: [52, 10], face: 'angry' }),
  airPunch: P({ lean: 20, fa: [-20, 20], na: [70, 60], fl: [30, -60], nl: [50, -30], face: 'angry' }),

  // gestos y memes
  palmsUp: P({ lean: 4, fa: [48, 96], na: [44, 92], fh: 'palm', nh: 'palm', face: 'smug' }),
  offer: P({ lean: 6, fa: [-6, 12], na: [74, 86], nh: 'open', face: 'smug' }),
  slapW: P({ lean: -14, fa: [-10, 20], na: [-150, -170], nh: 'open', face: 'smug' }),
  slap: P({ lean: 22, hx: 6, fa: [-30, 0], na: [104, 116], nh: 'open', fl: [-20, -20], nl: [28, 4], face: 'angry' }),
  mew: P({ lean: -4, head: -12, fa: [-8, 4], na: [30, 168], nh: 'point', face: 'mew' }),
  armsCrossed: P({ lean: -2, head: -2, fa: [24, 96], na: [20, 102], face: 'stare', fl: [-8, -6], nl: [10, 4] }),
  strut: P({ lean: -6, head: -6, fa: [-24, -10], na: [22, 30], face: 'chill' }),
  siuSpin: P({ lean: 0, hy: -6, fa: [-96, -96], na: [96, 96], fl: [-4, -2], nl: [4, 2], fh: 'open', nh: 'open', face: 'siu' }),
  siuLand: P({ lean: -10, head: -24, fa: [-48, -36], na: [-40, -28], fl: [-28, -6], nl: [30, 6], fh: 'open', nh: 'open', face: 'siu' }),
  kiss: P({ lean: 4, head: 4, fa: [-6, 10], na: [64, 176], nh: 'open', face: 'rizz' }),
  kissOut: P({ lean: 12, fa: [-10, 0], na: [96, 100], nh: 'open', face: 'rizz' }),
  fingerGuns: P({ lean: 2, fa: [64, 92], na: [80, 92], fh: 'point', nh: 'point', face: 'rizz' }),
  sideEye: P({ lean: -3, head: -8, fa: [-6, 4], na: [4, 12], face: 'side' }),
  npc: P({ lean: 0, head: 0, fa: [0, 0], na: [0, 0], fl: [-4, -4], nl: [4, 4], face: 'blank', fh: 'open', nh: 'open' }),
  card: P({ lean: 4, fa: [-10, 10], na: [80, 120], nh: 'open', face: 'smug' }),
  pointLaugh: P({ lean: -14, head: -16, fa: [30, 120], na: [86, 88], nh: 'point', face: 'laugh' }),
  nahWin: P({ lean: -6, head: -6, fa: [-10, 10], na: [56, 170], nh: 'peace', face: 'smug' }),
  pockets: P({ lean: -5, head: -4, fa: [-12, 34], na: [-8, 40], fh: 'hidden', nh: 'hidden', fl: [-4, 6], nl: [8, -6], face: 'chill' }),
  blank: P({ lean: 0, fa: [-2, 0], na: [2, 0], fl: [-5, -5], nl: [5, 5], face: 'blank', fh: 'open', nh: 'open' }),
  highFive: P({ lean: 2, fa: [-10, 10], na: [158, 170], nh: 'open', face: 'smug' }),
  dapW: P({ lean: 6, fa: [-10, 10], na: [40, 140] }),
  dap: P({ lean: 14, fa: [-10, 10], na: [86, 96], face: 'smug' }),
  backhand: P({ lean: -6, fa: [30, 60], na: [-100, -96], nh: 'open', face: 'smug' }),
  matrix: P({ lean: -64, head: -10, fa: [-120, -150], na: [-96, -128], fl: [30, -40], nl: [48, -26], face: 'smug' }),
  heroLand: P({ lean: 52, head: -24, fa: [-80, -60], na: [34, 2], fl: [-50, -84], nl: [84, 2], face: 'angry' }),
  conduct: P({ lean: -4, head: -10, fa: [-150, -168], na: [150, 172], fh: 'open', nh: 'open', face: 'smug' }),
  judgment: P({ lean: -8, head: -18, fa: [-30, -10], na: [172, 178], nh: 'point', face: 'stare' }),
  pray: P({ lean: 6, head: 6, fa: [64, 146], na: [66, 150], fh: 'open', nh: 'open', face: 'stare' }),
  charge: P({ lean: 18, fa: [40, -20], na: [50, -10], fl: [40, -40], nl: [70, -10], fh: 'open', nh: 'open', face: 'angry' }),
  dab: P({ lean: 10, head: 26, fa: [-136, -136], na: [132, 250], face: 'smug' }),
  armsUp: P({ lean: -6, head: -16, fa: [-160, -170], na: [160, 172], fh: 'open', nh: 'open', face: 'siu' }),
  tPose: P({ lean: 0, fa: [-92, -92], na: [92, 92], fh: 'open', nh: 'open', face: 'blank' }),
  timeStop: P({ lean: -10, head: -14, fa: [-150, -150], na: [150, 150], fh: 'open', nh: 'open', fl: [-24, -6], nl: [24, 4], face: 'angry' }),
  punchFwd: P({ lean: 20, hx: 6, fa: [40, 140], na: [92, 90], fl: [-26, -20], nl: [34, 6], face: 'angry' }),
  punchFwd2: P({ lean: 20, hx: 6, fa: [92, 90], na: [40, 140], fl: [-26, -20], nl: [34, 6], face: 'angry' }),
  falconW: P({ lean: -20, fa: [-120, -60], na: [-110, -140], fl: [-30, -20], nl: [30, 10], face: 'angry' }),
  naruto: P({ lean: 46, head: -10, fa: [-112, -112], na: [-102, -102], fl: [-40, -10], nl: [64, -20], face: 'angry' }),
  point: P({ lean: 2, fa: [-6, 6], na: [90, 90], nh: 'point', face: 'shock' }),
  jojo: P({ lean: -16, head: -16, hx: -4, fa: [-36, 66], na: [150, 232], nh: 'open', fl: [-4, 20], nl: [22, -30], face: 'smug' }),
  gigachad: P({ lean: -9, head: -14, fa: [-20, 30], na: [-14, 36], fh: 'hidden', nh: 'hidden', face: 'mew' }),
  stir: P({ lean: 14, fa: [50, 90], na: [60, 70], face: 'smug' }),
  crouchPoint: P({ lean: 40, fa: [40, 0], na: [60, 20], nh: 'point', fl: [52, -40], nl: [82, -6], face: 'smug' }),
  tall: P({ lean: -6, head: -14, hy: -10, fa: [-6, 2], na: [6, 4], fl: [-4, -2], nl: [4, 2], face: 'stare' }),
  stonks: P({ lean: -4, fa: [-10, 10], na: [134, 136], nh: 'point', face: 'smug' }),
  think: P({ lean: 4, head: 8, fa: [30, 100], na: [40, 172], nh: 'point', face: 'stare' }),
  shush: P({ lean: 2, fa: [-6, 6], na: [34, 178], nh: 'point', face: 'stare' }),
  facepalm: P({ lean: 10, head: 14, fa: [-6, 6], na: [56, 200], nh: 'open', face: 'blank' }),
  lForehead: P({ lean: -6, head: -10, fa: [-10, 10], na: [66, 214], nh: 'L', face: 'laugh' }),
  wave: P({ lean: 0, fa: [-6, 6], na: [150, 168], nh: 'open', face: 'smug' }),
  thumbsDown: P({ lean: 4, fa: [-6, 6], na: [80, 40], nh: 'thumbDown', face: 'smug' }),
  thumbsUp: P({ lean: -2, fa: [-6, 6], na: [60, 150], nh: 'thumb', face: 'smug' }),
  micHold: P({ lean: -4, fa: [-6, 6], na: [92, 92], nh: 'fist', face: 'smug' }),
  clap: P({ lean: 10, fa: [80, 96], na: [84, 100], fh: 'open', nh: 'open', face: 'angry' }),
  holdUp: P({ lean: -4, fa: [-6, 6], na: [92, 178], nh: 'open', face: 'stare' }),
  bonkW: P({ lean: -16, fa: [-160, -170], na: [-150, -165], face: 'angry' }),
  bonk: P({ lean: 34, fa: [100, 80], na: [96, 70], face: 'angry', fl: [-26, -20], nl: [36, 6] }),
  headbutt: P({ lean: 40, head: 30, hx: 12, fa: [-60, -30], na: [-50, -20], fl: [-40, -30], nl: [50, 10], face: 'mew' }),
  sit: P({ lean: -12, fa: [-30, 30], na: [40, 80], fl: [86, -2], nl: [90, 2], face: 'chill' }),
  rageW: P({ lean: 30, head: 20, fa: [30, 140], na: [36, 150], fl: [40, -40], nl: [70, -10], face: 'angry' }),
  vent: P({ lean: 30, fa: [20, 0], na: [30, 0], fl: [70, -60], nl: [90, -20], face: 'blank' }),
  laughBent: P({ lean: 36, head: -20, fa: [30, 90], na: [36, 100], face: 'laugh' }),
  bow: P({ lean: 50, head: 20, fa: [10, 40], na: [70, 110], face: 'smug' }),
  snap: P({ lean: -4, fa: [-6, 6], na: [100, 150], nh: 'snap', face: 'stare' }),
  coffin: P({ lean: -4, fa: [150, 170], na: [150, 172], fh: 'open', nh: 'open', face: 'blank' }),
  phone: P({ lean: 10, head: 18, fa: [40, 130], na: [44, 136], fh: 'open', nh: 'phone', face: 'blank' }),
  sleep: P({ lean: -6, head: 22, fa: [-4, 2], na: [2, 4], face: 'sleep' }),
  flex: P({ lean: -6, head: -8, fa: [-90, -200], na: [90, 200], face: 'angry' }),
  victoryFist: P({ lean: -6, head: -12, fa: [-10, 10], na: [168, 176], face: 'smug' })
};

export function pose(name) {
  return POSES[name] || POSES.idle;
}

// Modificadores procedurales: mutan una pose en función del tiempo (frames)
export const MODS = {
  breathe(p, f) { const s = Math.sin(f * 0.07); p.hy += s * 1.6; p.fa[1] += s * 3; p.na[1] -= s * 3; p.lean += s * 0.8; },
  sixseven(p, f) {
    const s = Math.sin(f * 0.95);
    p.fa[0] = 46 + s * 10; p.fa[1] = 94 + s * 34;
    p.na[0] = 44 - s * 10; p.na[1] = 92 - s * 34;
    p.head = s * 4; p.hy += Math.abs(s) * 2;
  },
  shake(p, f) { const s = Math.sin(f * 1.3); p.na[1] += s * 14; p.na[0] += s * 6; },
  wave(p, f) { const s = Math.sin(f * 0.6); p.na[1] += s * 22; },
  barrage(p, f) {
    const ph = Math.floor(f / 2) % 2;
    const s = (f % 2) / 2;
    if (ph) { p.na[0] = 88 + s * 6; p.na[1] = 90; p.fa[0] = 40; p.fa[1] = 140; }
    else { p.fa[0] = 88 + s * 6; p.fa[1] = 90; p.na[0] = 40; p.na[1] = 140; }
    p.lean = 20 + Math.sin(f) * 4;
  },
  griddy(p, f) {
    const s = Math.sin(f * 0.5);
    p.fl[0] = -10 + s * 30; p.fl[1] = p.fl[0] - 30;
    p.nl[0] = 10 - s * 30; p.nl[1] = p.nl[0] - 30;
    p.fa[0] = -40 - s * 30; p.fa[1] = 40;
    p.na[0] = -40 + s * 30; p.na[1] = 40;
    p.lean = 14; p.hy += Math.abs(s) * 4;
  },
  floss(p, f) {
    const s = Math.sin(f * 0.55);
    p.fa[0] = s * 45; p.fa[1] = s * 50;
    p.na[0] = s * 45; p.na[1] = s * 50;
    p.hx = -s * 6; p.lean = -s * 5;
  },
  spin(p, f) { p.spin = (f * 24) % 360; },
  walkLegs(p, f) {
    const s = Math.sin(f * 0.32);
    p.fl[0] = -6 + s * 22; p.fl[1] = p.fl[0] - 12 - Math.max(0, s) * 20;
    p.nl[0] = 6 - s * 22; p.nl[1] = p.nl[0] - 12 - Math.max(0, -s) * 20;
  },
  strutArms(p, f) { const s = Math.sin(f * 0.16); p.fa[0] = -20 + s * 18; p.na[0] = 20 - s * 18; p.fa[1] = p.fa[0] + 10; p.na[1] = p.na[0] + 14; p.hy += Math.abs(s) * 1.5; },
  slowWalk(p, f) {
    const s = Math.sin(f * 0.16);
    p.fl[0] = -6 + s * 18; p.fl[1] = p.fl[0] - 8 - Math.max(0, s) * 14;
    p.nl[0] = 6 - s * 18; p.nl[1] = p.nl[0] - 8 - Math.max(0, -s) * 14;
  },
  robot(p, f) {
    const s = Math.sign(Math.sin(f * 0.2));
    p.fl[0] = s * 14; p.fl[1] = s * 14; p.nl[0] = -s * 14; p.nl[1] = -s * 14;
    p.fa[0] = -s * 20; p.fa[1] = -s * 20; p.na[0] = s * 20; p.na[1] = s * 20;
  },
  jitter(p, f) { p.hx += Math.sin(f * 2.1) * 2; p.head += Math.sin(f * 1.7) * 4; },
  bob(p, f) { p.hy += Math.sin(f * 0.4) * 4; p.head += Math.sin(f * 0.4) * 6; },
  laugh(p, f) { p.lean += Math.sin(f * 0.9) * 6; p.head += Math.sin(f * 0.9) * 8; },
  stir(p, f) { const s = Math.sin(f * 0.4), c = Math.cos(f * 0.4); p.na[0] = 60 + s * 16; p.na[1] = 70 + c * 30; },
  conduct(p, f) { const s = Math.sin(f * 0.5); p.fa[0] = -150 + s * 20; p.na[0] = 150 - s * 20; },
  tremble(p, f) { p.hx += Math.sin(f * 3) * 1.5; },
  dance(p, f) {
    const s = Math.sin(f * 0.35);
    p.hx = s * 8; p.lean = s * 10; p.fa[0] = -60 + s * 50; p.na[0] = 60 + s * 50;
    p.fa[1] = p.fa[0] + 60; p.na[1] = p.na[0] + 60; p.hy += Math.abs(s) * 5;
  },
  woah(p, f) { const s = Math.min(1, (f % 30) / 6); p.na[0] = 140 - s * 70; p.na[1] = 140 - s * 70; p.lean = -6 + s * 10; },
  dizzy(p, f) { p.head = 14 + Math.sin(f * 0.25) * 10; p.lean = Math.sin(f * 0.18) * 8; }
};

const _tmpA = makePose({});
const _tmpB = makePose({});

// Evalúa una animación definida por keyframes [[frame, poseName|poseObj, ease?], ...]
export function evalKeyframes(keys, frame, out) {
  if (!keys || !keys.length) return copyPose(POSES.idle, out);
  let a = keys[0], b = keys[keys.length - 1];
  if (frame <= a[0]) return copyPose(resolve(a[1]), out);
  if (frame >= b[0]) return copyPose(resolve(b[1]), out);
  for (let i = 0; i < keys.length - 1; i++) {
    if (frame >= keys[i][0] && frame <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  }
  const span = b[0] - a[0] || 1;
  const e = ease[b[2] || 'out'] || ease.out;
  const t = e((frame - a[0]) / span);
  copyPose(resolve(a[1]), _tmpA);
  copyPose(resolve(b[1]), _tmpB);
  return lerpPose(_tmpA, _tmpB, t, out);
}

function resolve(p) {
  return typeof p === 'string' ? (POSES[p] || POSES.idle) : p;
}

export { lerpPose, copyPose };

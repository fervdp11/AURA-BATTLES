// Biblioteca de poses (formato por objetivos, ver skeleton.js) y modificadores procedurales.
// Referencias respecto al hombro (escala 1): barbilla [7,-14], boca [9,-20], ojos [9,-30], frente [6,-40],
// coronilla [0,-46], pecho [8,14], barriga [6,32], cadera [0,48]. Alcance máximo del brazo: 60.
import { dsin, dcos } from './dmath.js';
import { makePose, lerpPose, copyPose, ease } from './skeleton.js';
import { HUM_POSES } from './humiliations.js';

const P = o => makePose(o);
const UP = [-0.6, -1], OUT = [1, 0.2], DOWN = [-0.25, 1], BACK = [-1, 0.3], FWD = [1, 0.4];
const KNEE_IN = [1, 0.1];

export const POSES = {
  // ---------- base ----------
  idle: P({ lean: 3, hn: [6, 55], hf: [-6, 55], hsn: 'relaxed', hsf: 'relaxed', fn: [13, 0], ff: [-11, 0] }),
  guard: P({ lean: 9, hip: [0, -72], hn: [24, -10], hf: [14, -2], en: DOWN, ef: DOWN, fn: [21, 0], ff: [-19, 0] }),
  crouch: P({ lean: 22, hip: [-2, -46], hn: [26, -4], hf: [16, 4], fn: [22, 0], ff: [-20, 0] }),
  run: P({ lean: 22, hip: [0, -72], hn: [30, 6], hf: [-24, 18], en: DOWN, ef: [0.4, 1], fn: [10, 0], ff: [-10, 0], face: 'angry' }),
  jump: P({ lean: 6, hip: [0, -76], hn: [26, -18], hf: [-18, 20], fn: [16, -34], ff: [-6, -22], kn: KNEE_IN, kf: KNEE_IN }),
  fall: P({ lean: -2, hip: [0, -76], hn: [34, 8], hf: [-30, 4], ef: BACK, fn: [14, -6], ff: [-10, -12] }),
  land: P({ lean: 18, hip: [0, -52], hn: [30, 18], hf: [-18, 26], fn: [20, 0], ff: [-20, 0] }),
  dash: P({ lean: 30, hip: [0, -66], hn: [-30, 30], hf: [-38, 22], en: BACK, ef: BACK, fn: [30, 0], ff: [-30, -10], hsn: 'flat', hsf: 'flat', face: 'angry' }),
  backdash: P({ lean: -16, hip: [-6, -66], hn: [28, 4], hf: [20, 10], fn: [8, -16], ff: [-32, 0] }),
  // ---------- defensa y reacciones ----------
  block: P({ lean: -2, hip: [-4, -72], hn: [20, -22], hf: [14, -14], en: DOWN, ef: DOWN, hsn: 'fist', hsf: 'fist', rn: -80, rf: -80, fn: [14, 0], ff: [-24, 0], face: 'angry' }),
  lowBlock: P({ lean: 24, hip: [-4, -46], hn: [30, 20], hf: [22, 26], rn: 40, rf: 40, fn: [20, 0], ff: [-24, 0], face: 'angry' }),
  hurt: P({ lean: -22, head: -18, hip: [-8, -72], hn: [14, 26], hf: [-24, 30], ef: BACK, hsn: 'open', hsf: 'open', fn: [8, 0], ff: [-28, 0], face: 'hurt' }),
  hurtHead: P({ lean: -30, head: -30, hip: [-10, -72], hn: [20, -20], hf: [-30, 20], ef: BACK, hsn: 'open', hsf: 'open', fn: [10, 0], ff: [-26, 0], face: 'hurt' }),
  hurtGut: P({ lean: 38, head: 22, hip: [-8, -64], hn: [14, 30], hf: [8, 34], hsn: 'open', hsf: 'open', fn: [8, 0], ff: [-24, 0], face: 'hurt' }),
  hurtLow: P({ lean: 26, head: 14, hip: [-4, -58], hn: [26, 30], hf: [-10, 40], hsn: 'open', hsf: 'open', fn: [26, 0], ff: [-14, -10], face: 'hurt' }),
  slapped: P({ lean: -14, head: -40, hip: [-10, -74], hn: [-8, -10], hf: [-34, 10], en: BACK, ef: BACK, hsn: 'open', hsf: 'open', fn: [4, 0], ff: [-24, 0], face: 'hurt' }),
  airHurt: P({ lean: -60, head: -26, hip: [0, -76], hn: [-20, -40], hf: [-40, -10], en: UP, ef: UP, hsn: 'open', hsf: 'open', fn: [30, -26], ff: [22, -40], face: 'hurt' }),
  tumble: P({ lean: -110, head: -30, hip: [0, -76], hn: [-30, -30], hf: [-10, -48], hsn: 'open', hsf: 'open', fn: [36, -50], ff: [20, -60], face: 'hurt' }),
  lying: P({ lean: -88, head: 4, hip: [6, -11], hn: [-14, 22], hf: [10, 24], hsn: 'open', hsf: 'open', fn: [62, -3], ff: [54, -1], kn: [0, -1], kf: [0, -1], pn: 0, pf: 0, face: 'ko' }),
  lyingFace: P({ lean: 88, head: -10, hip: [-6, -10], hn: [22, 30], hf: [-4, 30], hsn: 'flat', hsf: 'flat', fn: [-60, -2], ff: [-54, -1], kn: [0, -1], kf: [0, -1], pn: 0, pf: 0, face: 'ko' }),
  getup: P({ lean: 46, head: -10, hip: [-6, -44], hn: [30, 46], hf: [20, 50], hsn: 'flat', hsf: 'flat', fn: [20, 0], ff: [-22, 0], face: 'angry' }),
  dizzy: P({ lean: -6, head: 18, hip: [0, -74], hn: [12, 54], hf: [-8, 54], hsn: 'relaxed', hsf: 'relaxed', fn: [10, 0], ff: [-12, 0], face: 'dizzy' }),
  frozen: P({ lean: 8, hip: [0, -72], hn: [30, 10], hf: [18, 18], hsn: 'open', hsf: 'open', fn: [18, 0], ff: [-18, 0], face: 'shock' }),
  ko: P({ lean: -76, head: -36, hip: [0, -76], hn: [-36, -30], hf: [-20, -50], hsn: 'open', hsf: 'open', fn: [40, -30], ff: [30, -44], face: 'ko' }),
  held: P({ lean: -6, head: -6, hip: [0, -76], hn: [10, 52], hf: [-8, 54], hsn: 'open', hsf: 'open', fn: [10, 0], ff: [-10, 0], face: 'shock' }),
  charmed: P({ lean: 14, head: 12, hip: [0, -74], hn: [24, -10], hf: [18, -6], rn: -70, rf: -70, hsn: 'open', hsf: 'open', fn: [12, 0], ff: [-12, 0], face: 'rizzed' }),
  scared: P({ lean: -20, head: -10, hip: [-6, -66], hn: [18, -30], hf: [10, -24], en: DOWN, ef: DOWN, hsn: 'open', hsf: 'open', rn: -90, rf: -90, fn: [10, 0], ff: [-26, 0], face: 'shock' }),
  flattened: P({ lean: 30, head: 30, hip: [0, -36], hn: [34, 30], hf: [-30, 32], hsn: 'open', hsf: 'open', fn: [30, 0], ff: [-30, 0], face: 'ko' }),
  shocked: P({ lean: -8, head: -10, hip: [0, -80], hn: [30, -40], hf: [-26, -36], en: UP, ef: UP, hsn: 'open', hsf: 'open', fn: [22, 0], ff: [-22, 0], face: 'shock' }),
  danced: P({ lean: 0, hip: [0, -74], hn: [30, -40], hf: [-20, -40], hsn: 'point', hsf: 'open', fn: [14, 0], ff: [-14, 0], face: 'blank' }),

  // ---------- golpes básicos ----------
  jabW: P({ lean: 10, hip: [0, -72], hn: [18, -8], hf: [14, -2], fn: [22, 0], ff: [-18, 0] }),
  jab: P({ lean: 16, hip: [6, -72], hn: [58, -8], hf: [12, -4], en: DOWN, fn: [26, 0], ff: [-18, 0], face: 'angry' }),
  cross: P({ lean: 24, hip: [10, -70], hn: [16, -2], hf: [62, -6], ef: DOWN, fn: [26, 0], ff: [-24, 0], face: 'angry' }),
  hookW: P({ lean: 4, hip: [-2, -72], hn: [-10, 0], hf: [14, -4], en: BACK, fn: [20, 0], ff: [-20, 0] }),
  hook: P({ lean: 22, hip: [8, -70], hn: [46, -12], hf: [10, -2], en: [0.3, 1], rn: 70, fn: [26, 0], ff: [-24, 0], face: 'angry' }),
  lowKick: P({ lean: -10, hip: [-2, -72], hn: [22, -8], hf: [12, 0], fn: [66, -22], ff: [-16, 0], kn: KNEE_IN, face: 'angry' }),
  roundW: P({ lean: 6, hip: [0, -72], hn: [-20, 20], hf: [18, 0], fn: [30, -34], ff: [-14, 0], face: 'angry' }),
  roundhouse: P({ lean: -26, hip: [-4, -76], hn: [-32, 24], hf: [22, -6], en: BACK, fn: [80, -100], ff: [-14, 0], kn: [0.4, -1], face: 'angry' }),
  upperW: P({ lean: 26, hip: [0, -54], hn: [10, 30], hf: [18, -2], fn: [22, 0], ff: [-20, 0] }),
  uppercut: P({ lean: 4, hip: [6, -80], hn: [18, -60], hf: [-10, 30], en: [1, 0.3], rn: -90, fn: [16, 0], ff: [-16, -4], face: 'angry' }),
  lungeW: P({ lean: -6, hip: [-6, -72], hn: [14, -4], hf: [-22, 10], ef: BACK, fn: [16, 0], ff: [-20, 0] }),
  lunge: P({ lean: 34, hip: [12, -64], hn: [6, 14], hf: [64, -8], fn: [44, 0], ff: [-36, 0], face: 'angry' }),
  airKick: P({ lean: -12, hip: [0, -76], hn: [-16, 10], hf: [20, -4], fn: [64, 10], ff: [4, -30], kn: KNEE_IN, face: 'angry' }),
  diveKick: P({ lean: -18, hip: [0, -76], hn: [-30, -10], hf: [10, 0], en: BACK, fn: [40, 34], ff: [-4, -34], face: 'angry' }),
  sweep: P({ lean: 42, hip: [-10, -32], hn: [20, 24], hf: [4, 30], hsn: 'flat', hsf: 'flat', fn: [72, -4], ff: [-20, 0], pn: 0, face: 'angry' }),
  shoulder: P({ lean: 32, hip: [8, -66], hn: [16, 24], hf: [-4, 30], en: FWD, fn: [36, 0], ff: [-32, 0], face: 'angry' }),
  airPunch: P({ lean: 22, hip: [0, -76], hn: [56, 16], hf: [-10, 20], fn: [18, -30], ff: [-8, -20], face: 'angry' }),
  punchFwd: P({ lean: 18, hip: [6, -72], hn: [60, -6], hf: [12, -2], fn: [26, 0], ff: [-22, 0], face: 'angry' }),
  punchFwd2: P({ lean: 22, hip: [8, -72], hn: [14, -2], hf: [62, -4], fn: [26, 0], ff: [-22, 0], face: 'angry' }),

  // ---------- gestos y memes ----------
  palmsUp: P({ lean: 4, hip: [0, -74], hn: [32, 26], hf: [24, 30], en: DOWN, ef: DOWN, hsn: 'palm', hsf: 'palm', rn: -90, rf: -90, fn: [16, 0], ff: [-14, 0], face: 'smug' }),
  offer: P({ lean: 6, hip: [0, -74], hn: [52, 18], hf: [-6, 54], hsn: 'shake', hsf: 'relaxed', rn: -10, fn: [18, 0], ff: [-14, 0], face: 'smug' }),
  shakeGrip: P({ lean: 4, hip: [0, -74], hn: [44, 20], hf: [-6, 54], hsn: 'shake', hsf: 'relaxed', fn: [16, 0], ff: [-14, 0], face: 'smug' }),
  slapW: P({ lean: -16, hip: [-4, -74], hn: [-26, -36], hf: [6, 40], en: UP, hsn: 'flat', fn: [16, 0], ff: [-20, 0], face: 'smug' }),
  slap: P({ lean: 22, hip: [8, -72], hn: [54, -20], hf: [-14, 30], en: DOWN, hsn: 'flat', rn: 90, fn: [28, 0], ff: [-22, 0], face: 'angry' }),
  mew: P({ lean: -4, head: -14, hip: [0, -76], hn: [10, -14], hf: [-6, 54], en: DOWN, hsn: 'point', hsf: 'relaxed', rn: -150, fn: [12, 0], ff: [-12, 0], face: 'mew' }),
  armsCrossed: P({ lean: -3, head: -4, hip: [0, -76], hn: [18, 16], hf: [22, 12], en: DOWN, ef: DOWN, hsn: 'hidden', hsf: 'flat', rn: 0, rf: 0, fn: [12, 0], ff: [-14, 0], face: 'stare' }),
  strut: P({ lean: -6, head: -6, hip: [0, -76], hn: [10, 54], hf: [-12, 54], hsn: 'relaxed', hsf: 'relaxed', fn: [12, 0], ff: [-12, 0], face: 'chill' }),
  siuSpin: P({ lean: 0, hip: [0, -78], hn: [56, -12], hf: [-56, -12], en: UP, ef: UP, hsn: 'open', hsf: 'open', fn: [4, -8], ff: [-4, -8], face: 'siu' }),
  siuLand: P({ lean: -12, head: -26, hip: [0, -72], hn: [-20, 46], hf: [-34, 40], en: BACK, ef: BACK, hsn: 'open', hsf: 'open', rn: 90, rf: 90, fn: [24, 0], ff: [-26, 0], face: 'siu' }),
  kiss: P({ lean: 4, head: 6, hip: [0, -76], hn: [12, -20], hf: [-6, 54], en: DOWN, hsn: 'kiss', hsf: 'relaxed', fn: [14, 0], ff: [-12, 0], face: 'kiss' }),
  kissOut: P({ lean: 12, hip: [4, -74], hn: [58, -26], hf: [-10, 50], hsn: 'open', hsf: 'relaxed', rn: -40, fn: [22, 0], ff: [-14, 0], face: 'rizz' }),
  fingerGuns: P({ lean: 4, hip: [0, -74], hn: [56, -6], hf: [48, 0], hsn: 'gun', hsf: 'gun', fn: [18, 0], ff: [-16, 0], face: 'rizz' }),
  sideEye: P({ lean: -4, head: -10, hip: [0, -76], hn: [6, 52], hf: [-14, 30], ef: [-1, 0.3], hsn: 'relaxed', hsf: 'hidden', fn: [12, 0], ff: [-12, 0], face: 'side' }),
  npc: P({ lean: 0, head: 0, hip: [0, -78], hn: [2, 58], hf: [-2, 58], hsn: 'flat', hsf: 'flat', fn: [8, 0], ff: [-8, 0], face: 'blank' }),
  card: P({ lean: 4, hip: [0, -74], hn: [44, -16], hf: [-6, 54], hsn: 'card', hsf: 'relaxed', rn: -80, fn: [18, 0], ff: [-14, 0], face: 'smug' }),
  pointLaugh: P({ lean: -14, head: -16, hip: [-4, -74], hn: [58, -10], hf: [4, 30], hsn: 'point', hsf: 'flat', fn: [16, 0], ff: [-16, 0], face: 'laugh' }),
  nahWin: P({ lean: -6, head: -8, hip: [0, -76], hn: [14, -30], hf: [-6, 54], en: DOWN, hsn: 'peace', hsf: 'relaxed', rn: -150, fn: [14, 0], ff: [-14, 0], face: 'smug' }),
  pockets: P({ lean: -5, head: -4, hip: [0, -76], hn: [4, 46], hf: [-4, 46], en: [-1, 0.3], ef: [-1, 0.3], hsn: 'hidden', hsf: 'hidden', fn: [8, 0], ff: [-10, 0], face: 'chill' }),
  blank: P({ lean: 0, hip: [0, -78], hn: [3, 58], hf: [-3, 58], hsn: 'relaxed', hsf: 'relaxed', fn: [10, 0], ff: [-10, 0], face: 'blank' }),
  highFive: P({ lean: 2, hip: [0, -76], hn: [26, -54], hf: [-6, 54], en: OUT, hsn: 'open', hsf: 'relaxed', rn: -90, fn: [14, 0], ff: [-12, 0], face: 'smug' }),
  dapW: P({ lean: 6, hip: [0, -74], hn: [10, 6], hf: [-6, 54], en: BACK, fn: [16, 0], ff: [-14, 0] }),
  dap: P({ lean: 14, hip: [6, -72], hn: [56, -2], hf: [-10, 50], hsf: 'relaxed', fn: [24, 0], ff: [-18, 0], face: 'smug' }),
  backhand: P({ lean: -8, hip: [0, -74], hn: [-54, -10], hf: [10, 30], en: UP, hsn: 'flat', rn: 180, fn: [16, 0], ff: [-18, 0], face: 'smug' }),
  matrix: P({ lean: -62, head: -12, hip: [-4, -54], hn: [-40, -10], hf: [-50, 6], en: UP, ef: UP, hsn: 'open', hsf: 'open', fn: [30, 0], ff: [-6, 0], kn: KNEE_IN, kf: KNEE_IN, face: 'smug' }),
  heroLand: P({ lean: 46, head: -26, hip: [-4, -36], hn: [22, 52], hf: [-40, 16], ef: BACK, hsn: 'flat', fn: [30, 0], ff: [-30, -2], kf: [1, 1], face: 'angry' }),
  conduct: P({ lean: -4, head: -12, hip: [0, -76], hn: [30, -50], hf: [-26, -46], en: OUT, ef: BACK, hsn: 'open', hsf: 'open', fn: [16, 0], ff: [-16, 0], face: 'smug' }),
  judgment: P({ lean: -8, head: -22, hip: [0, -76], hn: [10, -60], hf: [-14, 40], en: OUT, hsn: 'point', hsf: 'flat', rn: 0, fn: [16, 0], ff: [-16, 0], face: 'stare' }),
  pray: P({ lean: 6, head: 6, hip: [0, -76], hn: [20, -4], hf: [18, -4], en: DOWN, ef: DOWN, hsn: 'flat', hsf: 'flat', rn: -90, rf: -90, fn: [12, 0], ff: [-12, 0], face: 'stare' }),
  charge: P({ lean: 16, hip: [0, -60], hn: [16, 34], hf: [-12, 36], hsn: 'claw', hsf: 'claw', fn: [26, 0], ff: [-26, 0], face: 'angry' }),
  dab: P({ lean: 12, head: 30, hip: [0, -74], hn: [6, -26], hf: [-50, -36], en: [1, -0.3], ef: UP, hsn: 'fist', hsf: 'point', fn: [18, 0], ff: [-16, 0], face: 'smug' }),
  armsUp: P({ lean: -6, head: -16, hip: [0, -78], hn: [18, -58], hf: [-14, -58], en: OUT, ef: BACK, hsn: 'open', hsf: 'open', fn: [16, 0], ff: [-16, 0], face: 'siu' }),
  tPose: P({ lean: 0, hip: [0, -78], hn: [60, -2], hf: [-60, -2], hsn: 'flat', hsf: 'flat', fn: [8, 0], ff: [-8, 0], face: 'blank' }),
  timeStop: P({ lean: -10, head: -14, hip: [0, -74], hn: [34, -46], hf: [-34, -42], en: OUT, ef: BACK, hsn: 'claw', hsf: 'claw', fn: [24, 0], ff: [-24, 0], face: 'angry' }),
  falconW: P({ lean: -18, hip: [-6, -70], hn: [-34, -6], hf: [24, -10], en: BACK, hsn: 'fist', fn: [24, 0], ff: [-24, 0], face: 'angry' }),
  naruto: P({ lean: 44, head: -12, hip: [0, -66], hn: [-44, 30], hf: [-52, 22], en: UP, ef: UP, hsn: 'flat', hsf: 'flat', fn: [16, 0], ff: [-16, 0], face: 'angry' }),
  point: P({ lean: 2, hip: [0, -76], hn: [58, -10], hf: [-6, 54], hsn: 'point', hsf: 'relaxed', fn: [16, 0], ff: [-12, 0], face: 'shock' }),
  jojo: P({ lean: -16, head: -18, hip: [-4, -76], hn: [10, -26], hf: [-20, 40], en: [1, 0.2], hsn: 'open', hsf: 'relaxed', rn: -170, fn: [20, -2], ff: [-8, 0], kn: [1, -0.2], face: 'smug' }),
  gigachad: P({ lean: -9, head: -16, hip: [0, -78], hn: [2, 46], hf: [-4, 46], en: [-1, 0.3], ef: [-1, 0.3], hsn: 'hidden', hsf: 'hidden', fn: [14, 0], ff: [-14, 0], face: 'mew' }),
  stir: P({ lean: 14, head: 14, hip: [0, -72], hn: [40, 24], hf: [30, 34], hsn: 'fist', hsf: 'flat', fn: [18, 0], ff: [-16, 0], face: 'smug' }),
  crouchPoint: P({ lean: 40, hip: [-4, -42], hn: [46, 40], hf: [6, 30], hsn: 'point', hsf: 'flat', fn: [24, 0], ff: [-20, 0], face: 'smug' }),
  tall: P({ lean: -6, head: -16, hip: [0, -84], hn: [8, 56], hf: [-8, 56], hsn: 'flat', hsf: 'flat', fn: [6, -2], ff: [-6, -2], face: 'stare' }),
  stonks: P({ lean: -4, hip: [0, -76], hn: [44, -40], hf: [-6, 54], en: DOWN, hsn: 'point', hsf: 'relaxed', fn: [14, 0], ff: [-12, 0], face: 'smug' }),
  think: P({ lean: 4, head: 10, hip: [0, -76], hn: [10, -24], hf: [16, 18], en: DOWN, ef: DOWN, hsn: 'point', hsf: 'fist', rn: -160, fn: [12, 0], ff: [-12, 0], face: 'stare' }),
  shush: P({ lean: 2, hip: [0, -76], hn: [12, -20], hf: [-6, 54], en: DOWN, hsn: 'point', hsf: 'relaxed', rn: -180, fn: [12, 0], ff: [-12, 0], face: 'stare' }),
  facepalm: P({ lean: 10, head: 18, hip: [0, -76], hn: [10, -28], hf: [-6, 54], en: DOWN, hsn: 'flat', hsf: 'relaxed', rn: -120, fn: [12, 0], ff: [-12, 0], face: 'blank' }),
  lForehead: P({ lean: -6, head: -10, hip: [0, -76], hn: [10, -40], hf: [-6, 54], en: DOWN, hsn: 'L', hsf: 'relaxed', rn: -100, fn: [14, 0], ff: [-12, 0], face: 'laugh' }),
  wave: P({ lean: 0, hip: [0, -76], hn: [22, -50], hf: [-6, 54], en: OUT, hsn: 'open', hsf: 'relaxed', rn: -90, fn: [12, 0], ff: [-12, 0], face: 'smug' }),
  thumbsDown: P({ lean: 4, hip: [0, -76], hn: [46, 10], hf: [-6, 54], hsn: 'thumbDown', hsf: 'relaxed', fn: [14, 0], ff: [-12, 0], face: 'smug' }),
  thumbsUp: P({ lean: -2, hip: [0, -76], hn: [40, -4], hf: [-6, 54], hsn: 'thumb', hsf: 'relaxed', fn: [14, 0], ff: [-12, 0], face: 'smug' }),
  micHold: P({ lean: -4, hip: [0, -76], hn: [50, 0], hf: [-6, 54], hsn: 'fist', hsf: 'relaxed', rn: -90, fn: [14, 0], ff: [-12, 0], face: 'smug' }),
  clap: P({ lean: 10, hip: [0, -74], hn: [38, 2], hf: [34, 2], hsn: 'flat', hsf: 'flat', rn: -90, rf: -90, fn: [18, 0], ff: [-16, 0], face: 'angry' }),
  holdUp: P({ lean: -4, hip: [0, -76], hn: [44, -26], hf: [-6, 54], hsn: 'open', hsf: 'relaxed', rn: -90, fn: [14, 0], ff: [-14, 0], face: 'stare' }),
  bonkW: P({ lean: -16, hip: [-4, -76], hn: [-6, -58], hf: [-14, -54], en: OUT, ef: OUT, fn: [16, 0], ff: [-20, 0], face: 'angry' }),
  bonk: P({ lean: 32, hip: [8, -70], hn: [52, 18], hf: [44, 22], fn: [30, 0], ff: [-26, 0], face: 'angry' }),
  headbutt: P({ lean: 40, head: 30, hip: [10, -68], hn: [-20, 40], hf: [-30, 36], ef: BACK, en: BACK, fn: [34, 0], ff: [-34, 0], face: 'mew' }),
  sit: P({ lean: -10, hip: [-8, -44], hn: [30, 6], hf: [10, 30], hsn: 'mug', hsf: 'relaxed', fn: [34, 0], ff: [28, 0], kn: [1, -0.6], kf: [1, -0.6], face: 'chill' }),
  rageW: P({ lean: 30, head: 20, hip: [0, -60], hn: [20, 20], hf: [10, 24], hsn: 'fist', hsf: 'fist', fn: [26, 0], ff: [-26, 0], face: 'angry' }),
  vent: P({ lean: 30, hip: [0, -30], hn: [30, 28], hf: [10, 30], hsn: 'flat', hsf: 'flat', fn: [20, 0], ff: [-20, 0], face: 'blank' }),
  laughBent: P({ lean: 34, head: -22, hip: [-2, -70], hn: [16, 32], hf: [8, 34], hsn: 'flat', hsf: 'flat', fn: [14, 0], ff: [-16, 0], face: 'laugh' }),
  bow: P({ lean: 56, head: 22, hip: [-6, -76], hn: [10, 14], hf: [-6, 46], hsn: 'flat', hsf: 'relaxed', fn: [12, 0], ff: [-12, 0], face: 'smug' }),
  snap: P({ lean: -4, hip: [0, -76], hn: [40, -18], hf: [-6, 54], hsn: 'snap', hsf: 'relaxed', rn: -60, fn: [14, 0], ff: [-12, 0], face: 'stare' }),
  coffin: P({ lean: -4, hip: [0, -76], hn: [16, -56], hf: [-10, -56], en: OUT, ef: BACK, hsn: 'flat', hsf: 'flat', fn: [14, 0], ff: [-14, 0], face: 'blank' }),
  phone: P({ lean: 10, head: 16, hip: [0, -76], hn: [30, -16], hf: [24, -10], en: DOWN, ef: DOWN, hsn: 'phone', hsf: 'fist', rn: -90, fn: [14, 0], ff: [-12, 0], face: 'blank' }),
  sleep: P({ lean: -6, head: 24, hip: [0, -76], hn: [4, 56], hf: [-4, 56], hsn: 'relaxed', hsf: 'relaxed', fn: [10, 0], ff: [-10, 0], face: 'sleep' }),
  flex: P({ lean: -6, head: -10, hip: [0, -76], hn: [28, -24], hf: [-28, -24], en: [1, 0.6], ef: [-1, 0.6], hsn: 'fist', hsf: 'fist', fn: [20, 0], ff: [-20, 0], face: 'angry' }),
  victoryFist: P({ lean: -6, head: -14, hip: [0, -78], hn: [14, -60], hf: [-6, 54], en: OUT, hsn: 'fist', hsf: 'relaxed', fn: [16, 0], ff: [-14, 0], face: 'smug' }),
  // ---------- nuevas poses ----------
  snapWalk: P({ lean: -7, head: -8, hip: [0, -76], hn: [30, -12], hf: [-24, -8], en: DOWN, ef: [-1, 0.4], hsn: 'snap', hsf: 'snap', rn: -60, rf: -60, fn: [12, 0], ff: [-12, 0], face: 'chill' }),
  salute: P({ lean: -4, head: -6, hip: [0, -78], hn: [14, -30], hf: [-4, 54], en: OUT, hsn: 'flat', hsf: 'flat', rn: -140, fn: [8, 0], ff: [-8, 0], face: 'stare' }),
  bigSlapW: P({ lean: -22, hip: [-8, -74], hn: [-40, -40], hf: [20, 10], en: UP, hsn: 'flat', fn: [18, 0], ff: [-24, 0], face: 'smug' }),
  bigSlap: P({ lean: 26, hip: [12, -70], hn: [58, -16], hf: [-20, 24], hsn: 'flat', rn: 90, fn: [34, 0], ff: [-28, 0], face: 'angry' }),
  sharkFin: P({ lean: 10, hip: [0, -60], hn: [8, -50], hf: [-14, -46], en: OUT, ef: OUT, hsn: 'flat', hsf: 'flat', rn: -90, rf: -90, fn: [22, 0], ff: [-24, 0], face: 'angry' }),
  slide: P({ lean: -40, hip: [10, -28], hn: [-20, 34], hf: [-34, 30], hsn: 'flat', hsf: 'flat', fn: [80, -6], ff: [30, -4], pn: 0, pf: 0, face: 'angry' }),
  wings: P({ lean: 20, hip: [0, -76], hn: [20, -10], hf: [-50, -14], en: UP, ef: UP, hsn: 'flat', hsf: 'flat', rn: 0, fn: [10, -20], ff: [-14, -18], face: 'angry' }),
  batRest: P({ lean: -4, hip: [0, -76], hn: [6, -12], hf: [-6, 54], en: DOWN, hsn: 'fist', hsf: 'relaxed', fn: [16, 0], ff: [-14, 0], face: 'blank' }),
  pirouette: P({ lean: 0, head: -10, hip: [0, -86], hn: [10, -60], hf: [-8, -60], en: OUT, ef: BACK, hsn: 'flat', hsf: 'flat', fn: [4, 0], ff: [10, -40], kf: [1, -0.4], face: 'smug' }),
  arabesque: P({ lean: 40, head: -20, hip: [0, -80], hn: [56, -20], hf: [-50, -20], hsn: 'flat', hsf: 'flat', fn: [4, 0], ff: [-70, -60], pf: 0, face: 'smug' }),
  hipsHands: P({ lean: -6, head: -10, hip: [0, -78], hn: [8, 40], hf: [-8, 40], en: [1, 0], ef: [-1, 0], hsn: 'fist', hsf: 'fist', fn: [20, 0], ff: [-20, 0], face: 'smug' }),
  menace: P({ lean: 12, head: 14, hip: [0, -70], hn: [36, -6], hf: [-30, 10], en: DOWN, ef: BACK, hsn: 'claw', hsf: 'claw', fn: [28, 0], ff: [-26, 0], face: 'stare' }),
  kneel: P({ lean: 10, head: 20, hip: [-4, -40], hn: [26, 34], hf: [6, 40], hsn: 'flat', hsf: 'relaxed', fn: [26, 0], ff: [-30, -2], kf: [1, 1], face: 'hurt' }),
  slump: P({ lean: 26, head: 30, hip: [-6, -24], hn: [24, 40], hf: [-2, 36], hsn: 'relaxed', hsf: 'relaxed', fn: [40, 0], ff: [30, 0], kn: [1, -0.5], kf: [1, -0.5], face: 'cry' }),
  monkey: P({ lean: 26, head: -6, hip: [0, -60], hn: [30, 30], hf: [-20, 34], en: OUT, ef: BACK, hsn: 'banana', hsf: 'open', fn: [30, 0], ff: [-30, 0], face: 'laugh' }),
  catLeap: P({ lean: 40, hip: [0, -76], hn: [56, 16], hf: [44, 22], hsn: 'claw', hsf: 'claw', fn: [-10, -30], ff: [-30, -20], face: 'angry' }),
  cupPour: P({ lean: 6, hip: [0, -76], hn: [40, -22], hf: [24, -2], hsn: 'mug', hsf: 'flat', rn: 70, fn: [14, 0], ff: [-14, 0], face: 'smug' }),
  heartHands: P({ lean: 2, hip: [0, -76], hn: [24, -26], hf: [20, -24], en: DOWN, ef: DOWN, hsn: 'heart', hsf: 'heart', rn: -120, rf: -120, fn: [12, 0], ff: [-12, 0], face: 'rizz' }),
  stareDown: P({ lean: 18, head: 20, hip: [4, -74], hn: [8, 46], hf: [-8, 46], en: [-1, 0.3], ef: [-1, 0.3], hsn: 'hidden', hsf: 'hidden', fn: [14, 0], ff: [-14, 0], face: 'stare' }),
  gulp: P({ lean: -8, head: -6, hip: [0, -74], hn: [8, -10], hf: [-6, 54], hsn: 'flat', hsf: 'relaxed', rn: -150, fn: [10, 0], ff: [-14, 0], face: 'shock' }),
  spinKick: P({ lean: -20, hip: [0, -78], hn: [-36, 0], hf: [30, -10], en: BACK, fn: [70, -70], ff: [-10, 0], kn: [0.4, -1], face: 'angry' }),
  stomp: P({ lean: 16, hip: [0, -70], hn: [20, 10], hf: [-24, 14], fn: [30, -40], ff: [-14, 0], kn: KNEE_IN, face: 'angry' }),
  // ---------- nuevas técnicas ----------
  headPulled: P({ lean: 74, head: 18, hip: [-14, -70], hn: [26, 52], hf: [10, 56], en: OUT, ef: OUT, hsn: 'open', hsf: 'open', fn: [12, 0], ff: [-22, 0], face: 'shock' }),
  teabagHold: P({ lean: -8, head: 10, hip: [4, -74], hn: [40, 10], hf: [-14, 30], en: DOWN, hsn: 'claw', hsf: 'relaxed', rn: 90, fn: [16, 0], ff: [-16, 0], face: 'smug' }),
  pantsGrab: P({ lean: 40, head: 10, hip: [6, -50], hn: [48, 46], hf: [40, 50], en: OUT, ef: OUT, hsn: 'claw', hsf: 'claw', fn: [28, 0], ff: [-22, 0], face: 'smug' }),
  pantsShock: P({ lean: 10, head: -12, hip: [0, -72], hn: [14, 44], hf: [8, 46], en: OUT, ef: OUT, hsn: 'flat', hsf: 'flat', rn: 90, rf: 90, fn: [4, 0], ff: [-4, 0], kn: [1, 0.05], kf: [1, 0.05], face: 'cry' }),
  bigKickW: P({ lean: -14, hip: [-6, -74], hn: [30, -10], hf: [-30, -4], en: OUT, ef: BACK, fn: [10, 0], ff: [-34, -16], face: 'angry' }),
  // patada espacial: carga agachado, patada vertical con la pierna estirada y la punta del pie hacia arriba
  spaceKickW: P({ lean: 26, head: -6, hip: [-6, -50], hn: [-26, 26], hf: [-34, 20], en: BACK, ef: BACK, hsn: 'fist', hsf: 'fist', fn: [16, 0], ff: [-14, 0], kn: [1, 0.2], kf: [1, 0.2], face: 'angry' }),
  spaceKick: P({ lean: -18, head: -24, hip: [4, -80], hn: [-36, 16], hf: [30, -6], en: BACK, ef: OUT, hsn: 'fist', hsf: 'open', fn: [-8, 0], ff: [26, -150], kf: [1, -0.1], pt: 'f', face: 'angry' }),
  spaceKickHold: P({ lean: -22, head: -34, hip: [4, -82], hn: [-38, 10], hf: [26, -14], en: BACK, ef: OUT, hsn: 'fist', hsf: 'open', fn: [-8, 0], ff: [20, -162], kf: [1, -0.1], pt: 'f', face: 'smug' }),
  spaceKickDown: P({ lean: -10, head: -30, hip: [2, -78], hn: [-30, 14], hf: [24, -4], en: BACK, ef: OUT, hsn: 'fist', hsf: 'open', fn: [-8, 0], ff: [44, -34], kf: [1, -0.2], face: 'smug' }),
  spaceLookUp: P({ lean: -8, head: -32, hip: [0, -76], hn: [14, -36], hf: [-6, 54], en: [1, -0.4], hsn: 'flat', hsf: 'relaxed', rn: -170, fn: [14, 0], ff: [-14, 0], face: 'smug' }),
  dazedUp: P({ lean: 12, head: -30, hip: [0, -76], hn: [10, 50], hf: [-6, 52], hsn: 'relaxed', hsf: 'relaxed', fn: [10, 0], ff: [-12, 0], face: 'shock' }),
  launchUp: P({ lean: -6, head: -42, hip: [0, -78], hn: [12, -54], hf: [-16, -50], en: UP, ef: UP, hsn: 'open', hsf: 'open', fn: [8, -6], ff: [-10, -14], kn: KNEE_IN, kf: KNEE_IN, face: 'hurt' }),
  bigKick: P({ lean: -24, hip: [4, -82], hn: [-26, -20], hf: [-40, 0], en: BACK, ef: BACK, fn: [-6, 0], ff: [78, -96], kf: [0.3, -1], face: 'angry' }),
  tooSlow: P({ lean: -10, head: -8, hip: [-4, -76], hn: [-4, -52], hf: [-6, 50], en: UP, hsn: 'open', hsf: 'relaxed', rn: -90, fn: [14, 0], ff: [-18, 0], face: 'smug' }),
  reachHand: P({ lean: 16, head: 4, hip: [6, -74], hn: [50, 16], hf: [-8, 52], hsn: 'shake', hsf: 'relaxed', fn: [24, 0], ff: [-14, 0], face: 'smug' }),
  graspAir: P({ lean: 24, head: 10, hip: [10, -72], hn: [58, 18], hf: [-12, 46], hsn: 'fist', hsf: 'open', fn: [32, 0], ff: [-16, -4], face: 'shock' }),
  slapCross: P({ lean: 10, hip: [6, -72], hn: [8, -22], hf: [-18, 26], en: DOWN, hsn: 'flat', rn: -90, fn: [30, 0], ff: [-24, 0], face: 'smug' }),
  backSlap: P({ lean: 24, hip: [12, -70], hn: [58, -20], hf: [-22, 24], en: [0.2, 1], hsn: 'flat', rn: -90, fn: [36, 0], ff: [-26, 0], face: 'angry' }),
  palmSlam: P({ lean: 42, head: 10, hip: [6, -44], hn: [44, 52], hf: [36, 56], en: OUT, ef: OUT, hsn: 'palm', hsf: 'palm', rn: 90, rf: 90, fn: [30, 0], ff: [-26, 0], face: 'angry' }),
  flick: P({ lean: 18, hip: [8, -72], hn: [56, -36], hf: [-10, 40], en: DOWN, hsn: 'snap', hsf: 'relaxed', rn: -20, fn: [30, 0], ff: [-22, 0], face: 'smug' }),
  leanWall: P({ lean: -16, head: -10, hip: [-6, -76], hn: [-44, -40], hf: [6, 40], en: UP, hsn: 'flat', hsf: 'relaxed', rn: 180, fn: [18, 0], ff: [6, -4], kf: [1, 0.6], face: 'rizz' }),
  windmillA: P({ lean: 6, head: -16, hip: [0, -76], hn: [30, -50], hf: [-34, 30], en: UP, ef: BACK, hsn: 'fist', hsf: 'fist', fn: [16, 0], ff: [-14, 0], face: 'angry' }),
  windmillB: P({ lean: 6, head: -16, hip: [0, -76], hn: [34, 30], hf: [-28, -50], en: DOWN, ef: UP, hsn: 'fist', hsf: 'fist', fn: [16, 0], ff: [-14, 0], face: 'angry' }),
  headPalm: P({ lean: -6, head: -8, hip: [-4, -78], hn: [58, -26], hf: [-10, 42], en: DOWN, hsn: 'palm', hsf: 'relaxed', rn: 90, fn: [16, 0], ff: [-16, 0], face: 'chill' }),
  brushShoulder: P({ lean: -4, head: 16, hip: [0, -76], hn: [-4, 2], hf: [-8, 50], en: OUT, hsn: 'flat', hsf: 'relaxed', rn: -150, fn: [12, 0], ff: [-12, 0], face: 'chill' }),
  sigmaBack: P({ lean: 2, head: -4, hip: [0, -78], hn: [10, 10], hf: [-6, 12], en: OUT, ef: OUT, hsn: 'fist', hsf: 'fist', fn: [10, 0], ff: [-10, 0], spin: 180, face: 'stare' }),
  elbow: P({ lean: 30, hip: [10, -70], hn: [26, -10], hf: [-10, 20], en: [1, -0.6], fn: [34, 0], ff: [-26, 0], face: 'stare' }),
  treeArms: P({ lean: 0, head: -14, hip: [0, -78], hn: [30, -54], hf: [-26, -50], en: OUT, ef: OUT, hsn: 'claw', hsf: 'claw', fn: [26, 0], ff: [-26, 0], face: 'angry' }),
  clockArms: P({ lean: -2, head: -6, hip: [0, -78], hn: [0, -58], hf: [42, -6], en: OUT, ef: DOWN, hsn: 'point', hsf: 'point', fn: [12, 0], ff: [-12, 0], face: 'stare' }),
  walkAway: P({ lean: 2, head: -6, hip: [0, -76], hn: [6, 40], hf: [-6, 40], en: [-1, 0.2], ef: [-1, 0.2], hsn: 'hidden', hsf: 'hidden', fn: [12, 0], ff: [-12, 0], spin: 180, face: 'chill' }),
  twerkless: P({ lean: 28, hip: [-8, -60], hn: [30, 30], hf: [24, 36], hsn: 'flat', hsf: 'flat', fn: [26, 0], ff: [-26, 0], face: 'laugh' })
};

export function pose(name) { return POSES[name] || POSES.idle; }

// ---------- modificadores procedurales (mutan una pose según el frame) ----------
const S = dsin, C = dcos;
Object.assign(POSES, HUM_POSES);

export const MODS = {
  breathe(p, f) { const s = S(f * 0.07); p.hip[1] += s * 1.2; p.hn[1] -= s * 1.5; p.hf[1] -= s * 1.5; p.lean += s * 0.6; },
  sixseven(p, f) {
    const s = S(f * 0.95);
    p.hn[1] = 24 + s * 16; p.hf[1] = 26 - s * 16; p.hn[0] = 32 + s * 3; p.hf[0] = 24 - s * 3;
    p.head = s * 4; p.hip[1] += Math.abs(s) * 1.5;
  },
  shake(p, f) { p.hn[1] += S(f * 1.2) * 8; },
  wave(p, f) { p.hn[0] += S(f * 0.6) * 14; p.rn = -90 + S(f * 0.6) * 25; },
  barrage(p, f) {
    const ph = Math.floor(f / 2) % 2, s = (f % 2) / 2;
    const out = [58 + s * 2, -8 + S(f * 1.7) * 14], back = [14, -2];
    if (ph) { p.hn[0] = out[0]; p.hn[1] = out[1]; p.hf[0] = back[0]; p.hf[1] = back[1]; }
    else { p.hf[0] = out[0]; p.hf[1] = out[1]; p.hn[0] = back[0]; p.hn[1] = back[1]; }
    p.lean = 18 + S(f) * 3;
  },
  griddy(p, f) {
    const s = S(f * 0.5);
    p.fn = [14 + s * 10, s > 0 ? -s * 10 : 0]; p.ff = [-14 + s * 10, s < 0 ? s * 10 : 0];
    p.pn = s > 0 ? 0 : 1; p.pf = s < 0 ? 0 : 1;
    p.hn = [8 - s * 24, 20]; p.hf = [-8 + s * 24, 20]; p.hsn = 'point'; p.hsf = 'point';
    p.lean = 14; p.hip[1] = -72 + Math.abs(s) * 3;
  },
  floss(p, f) {
    const s = S(f * 0.55);
    p.hn = [18 * s + 4, 46]; p.hf = [18 * s - 4, 46]; p.hip[0] = -s * 7; p.lean = -s * 4; p.hsn = 'fist'; p.hsf = 'fist';
  },
  spin(p, f) { p.spin = (f * 24) % 360; },
  airRun(p, f) { const s = S(f * 0.5); p.fn = [14 + s * 20, -10 - Math.max(0, s) * 18]; p.ff = [-14 - s * 20, -10 - Math.max(0, -s) * 18]; },
  strutArms(p, f) { const s = S(f * 0.16); p.hn[0] = 10 + s * 14; p.hf[0] = -12 - s * 14; p.hip[1] += Math.abs(s) * 1.2; },
  robot(p, f) { const s = Math.sign(S(f * 0.2)); p.hn = [s * 18, 56]; p.hf = [-s * 18, 56]; p.head = s * 2; },
  jitter(p, f) { p.hip[0] += S(f * 2.1) * 2; p.head += S(f * 1.7) * 4; },
  bob(p, f) { p.hip[1] += S(f * 0.4) * 3; p.head += S(f * 0.4) * 6; },
  laugh(p, f) { p.lean += S(f * 0.9) * 6; p.head += S(f * 0.9) * 8; },
  stir(p, f) { p.hn[0] = 40 + S(f * 0.4) * 10; p.hn[1] = 24 + C(f * 0.4) * 5; },
  conduct(p, f) { const s = S(f * 0.5); p.hn[0] = 30 + s * 10; p.hn[1] = -50 + C(f * 0.5) * 8; p.hf[0] = -26 - s * 10; },
  tremble(p, f) { p.hip[0] += S(f * 3) * 1.5; },
  dance(p, f) {
    const s = S(f * 0.35);
    p.hip[0] = s * 7; p.lean = s * 9; p.hn = [26 + s * 14, -30 + C(f * 0.7) * 16]; p.hf = [-24 + s * 14, -30 - C(f * 0.7) * 16];
    p.hip[1] = -72 + Math.abs(s) * 4;
  },
  boat(p, f) {
    // "aura farming": baile de la barca (brazos en ola, cadera, señalar)
    const s = S(f * 0.22), c = C(f * 0.22);
    p.hip[0] = s * 6; p.lean = -4 + s * 6; p.head = -8 + c * 6;
    p.hn = [34 + s * 18, -10 + c * 26]; p.hf = [-30 + s * 14, 6 - c * 22];
    p.hsn = 'flat'; p.hsf = 'flat'; p.rn = -60 + s * 40; p.rf = 60 + c * 40;
  },
  woah(p, f) { const s = Math.min(1, (f % 30) / 6); p.hn = [44 + s * 14, -40 + s * 56]; p.lean = -6 + s * 10; },
  dizzy(p, f) { p.head = 14 + S(f * 0.25) * 10; p.lean = S(f * 0.18) * 8; p.hip[0] = S(f * 0.18) * 5; },
  snapAlt(p, f) { const s = S(f * 0.34); p.hn[1] = -12 + Math.max(0, s) * -10; p.hf[1] = -8 + Math.max(0, -s) * -10; p.head = -8 + s * 3; },
  pirouette(p, f) { p.spin = (f * 30) % 360; p.hip[1] = -86 + S(f * 0.3) * 2; },
  scared(p, f) { p.hip[0] += S(f * 2.4) * 2; p.head += S(f * 2) * 3; },
  // paseo con chasquidos: la mano que chasquea sube junto a la cabeza al ritmo (cada 15 fotogramas)
  snapBeat(p, f) {
    const beat = Math.floor(f / 15) % 2, k = f % 15, pop = k < 4 ? 1 - k / 4 : 0;
    const up = [24, -40 - pop * 4], low = [-16, 2];
    if (beat) { p.hn = up; p.hf = low; } else { p.hf = [20, -38 - pop * 4]; p.hn = [10, 6]; }
    p.hsn = 'snap'; p.hsf = 'snap'; p.head = -10 + (beat ? 4 : -4) + pop * 3; p.lean = -6;
    p.hip[1] = -76 + Math.abs(S(f * Math.PI / 15)) * 2;
  },
  brush(p, f) { const s = S(f * 0.6); p.hn = [-2 + s * 6, 0 + s * 8]; p.head = 18 + s * 3; },
  // baile "default": brazos alternos y rodillas
  defaultDance(p, f) {
    const s = S(f * 0.42), c = C(f * 0.42);
    p.hn = [30 * s + 6, -20 + c * 20]; p.hf = [-30 * s - 6, -20 - c * 20]; p.hsn = 'fist'; p.hsf = 'fist';
    p.hip[0] = s * 6; p.hip[1] = -70 + Math.abs(c) * 6; p.lean = s * 6; p.head = c * 8;
    p.fn = [16 + s * 6, s > 0.5 ? -10 : 0]; p.ff = [-16 + s * 6, s < -0.5 ? -10 : 0];
  },
  thrust(p, f) { const k = Math.max(0, dsin(f * 0.5)); p.hip[0] += k * 12; p.lean -= k * 10; p.head -= k * 6; },
  menacing(p, f) { p.lean += S(f * 0.1) * 2; p.head += S(f * 0.13) * 3; p.hn[1] += S(f * 0.2) * 2; },
  shiver(p, f) { p.hn[0] += S(f * 3) * 2; p.hf[0] += S(f * 3.3) * 2; }
};

const _a = makePose({}), _b = makePose({});

// Evalúa keyframes [[frame, pose|nombre, ease?], ...]
export function evalKeyframes(keys, frame, out) {
  if (!keys || !keys.length) return copyPose(POSES.idle, out);
  let a = keys[0], b = keys[keys.length - 1];
  if (frame <= a[0]) return copyPose(res(a[1]), out);
  if (frame >= b[0]) return copyPose(res(b[1]), out);
  for (let i = 0; i < keys.length - 1; i++) if (frame >= keys[i][0] && frame <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const span = b[0] - a[0] || 1;
  const e = ease[b[2] || 'inOut'] || ease.inOut;
  copyPose(res(a[1]), _a); copyPose(res(b[1]), _b);
  return lerpPose(_a, _b, e((frame - a[0]) / span), out);
}
function res(p) { return typeof p === 'string' ? (POSES[p] || POSES.idle) : p; }

export { lerpPose, copyPose };

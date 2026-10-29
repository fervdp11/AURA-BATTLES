// Celebraciones de victoria y animaciones de derrota.
// anim: keyframes [[frame, pose, ease]] con anim.loop = [desde, hasta] para repetir el tramo final.
import { makePose } from './skeleton.js';

const P = o => makePose(o);
const k = (arr, loop) => { arr.loop = loop; return arr; };

// poses propias de las celebraciones
const C = {
  flexA: P({ lean: -6, head: -10, hip: [0, -76], hn: [26, -26], hf: [-26, -26], en: [1, 0.7], ef: [-1, 0.7], fn: [22, 0], ff: [-22, 0], face: 'angry' }),
  flexB: P({ lean: 10, head: 6, hip: [0, -68], hn: [12, 20], hf: [-8, 22], en: [1, -0.2], ef: [-1, -0.2], fn: [24, 0], ff: [-24, 0], face: 'angry' }),
  flexC: P({ lean: -10, head: -16, hip: [0, -78], hn: [30, -30], hf: [-30, -30], en: [1, 0.8], ef: [-1, 0.8], fn: [22, 0], ff: [-22, 0], face: 'smug' }),
  siuRun: P({ lean: 18, hip: [0, -72], hn: [24, 10], hf: [-20, 16], fn: [26, 0], ff: [-18, -10], face: 'siu' }),
  siuAir: P({ lean: 0, hip: [0, -78], hn: [56, -14], hf: [-56, -14], en: [-0.6, -1], ef: [-0.6, -1], hsn: 'open', hsf: 'open', fn: [6, -12], ff: [-6, -12], face: 'siu' }),
  siuLand: P({ lean: -14, head: -30, hip: [0, -70], hn: [-22, 44], hf: [-36, 38], en: [-1, 0.3], ef: [-1, 0.3], hsn: 'open', hsf: 'open', rn: 90, rf: 90, fn: [26, 0], ff: [-28, 0], face: 'siu' }),
  mewA: P({ lean: -4, head: -16, hip: [0, -76], hn: [6, -12], hf: [-6, 54], hsn: 'point', hsf: 'relaxed', rn: -140, fn: [12, 0], ff: [-12, 0], face: 'mew' }),
  mewB: P({ lean: -4, head: -22, hip: [0, -77], hn: [14, -16], hf: [-6, 54], hsn: 'point', hsf: 'relaxed', rn: -170, fn: [12, 0], ff: [-12, 0], face: 'mew' }),
  chillA: P({ lean: -5, head: -4, hip: [0, -76], hn: [4, 46], hf: [-4, 46], en: [-1, 0.3], ef: [-1, 0.3], hsn: 'hidden', hsf: 'hidden', fn: [8, 0], ff: [-10, 0], face: 'chill' }),
  chillB: P({ lean: -2, head: 6, hip: [2, -76], hn: [4, 46], hf: [-4, 46], en: [-1, 0.3], ef: [-1, 0.3], hsn: 'hidden', hsf: 'hidden', fn: [8, 0], ff: [-10, 0], face: 'chill' }),
  palmUp: P({ lean: 4, hip: [0, -75], hn: [32, 12], hf: [24, 36], hsn: 'palm', hsf: 'palm', rn: -90, rf: -90, fn: [16, 0], ff: [-14, 0], face: 'smug' }),
  palmDn: P({ lean: 4, hip: [0, -75], hn: [32, 36], hf: [24, 12], hsn: 'palm', hsf: 'palm', rn: -90, rf: -90, fn: [16, 0], ff: [-14, 0], face: 'smug' }),
  crossA: P({ lean: -3, head: -4, hip: [0, -76], hn: [18, 16], hf: [22, 12], hsn: 'hidden', hsf: 'flat', fn: [12, 0], ff: [-14, 0], face: 'stare' }),
  crossB: P({ lean: -3, head: 18, hip: [0, -76], hn: [18, 16], hf: [22, 12], hsn: 'hidden', hsf: 'flat', fn: [12, 0], ff: [-14, 0], face: 'side' }),
  dabA: P({ lean: 12, head: 32, hip: [0, -72], hn: [6, -26], hf: [-50, -38], en: [1, -0.3], ef: [-0.6, -1], hsn: 'fist', hsf: 'point', fn: [20, 0], ff: [-18, 0], face: 'smug' }),
  dabB: P({ lean: -12, head: -32, hip: [0, -72], hn: [50, -38], hf: [-6, -26], en: [0.6, -1], ef: [-1, -0.3], hsn: 'point', hsf: 'fist', fn: [20, 0], ff: [-18, 0], face: 'smug' }),
  waveA: P({ lean: 0, hip: [0, -76], hn: [14, -52], hf: [-6, 54], hsn: 'open', hsf: 'relaxed', rn: -100, fn: [12, 0], ff: [-12, 0], face: 'smug' }),
  waveB: P({ lean: 2, hip: [0, -76], hn: [34, -46], hf: [-6, 54], hsn: 'open', hsf: 'relaxed', rn: -60, fn: [12, 0], ff: [-12, 0], face: 'smug' }),
  laughA: P({ lean: 34, head: -22, hip: [-2, -70], hn: [16, 32], hf: [8, 34], hsn: 'flat', hsf: 'flat', fn: [14, 0], ff: [-16, 0], face: 'laugh' }),
  laughB: P({ lean: -10, head: -26, hip: [-2, -74], hn: [56, -12], hf: [8, 30], hsn: 'point', hsf: 'flat', fn: [14, 0], ff: [-16, 0], face: 'laugh' }),
  bowA: P({ lean: 0, hip: [0, -78], hn: [14, 14], hf: [-8, 40], hsn: 'flat', hsf: 'relaxed', rn: -90, fn: [10, 0], ff: [-10, 0], face: 'smug' }),
  bowB: P({ lean: 58, head: 24, hip: [-8, -76], hn: [10, 14], hf: [-30, 10], hsn: 'flat', hsf: 'flat', rn: -90, fn: [10, 0], ff: [-10, 0], face: 'smug' }),
  jojoA: P({ lean: -16, head: -18, hip: [-4, -76], hn: [10, -26], hf: [-20, 40], en: [1, 0.2], hsn: 'open', rn: -170, fn: [20, -2], ff: [-8, 0], face: 'smug' }),
  jojoB: P({ lean: 14, head: 20, hip: [4, -70], hn: [-14, -34], hf: [30, 10], en: [-1, 0.2], hsn: 'peace', hsf: 'open', rn: -60, fn: [24, 0], ff: [-20, 0], kf: [1, 0.6], face: 'smug' }),
  fistA: P({ lean: 10, hip: [0, -60], hn: [20, 10], hf: [-10, 30], fn: [22, 0], ff: [-22, 0], face: 'angry' }),
  fistB: P({ lean: -8, head: -16, hip: [0, -78], hn: [14, -60], hf: [-8, 30], en: [1, 0.2], hsn: 'fist', fn: [16, -6], ff: [-14, -6], face: 'smug' }),
  snapA: P({ lean: -7, head: -8, hip: [0, -76], hn: [30, -16], hf: [-26, -4], hsn: 'snap', hsf: 'snap', rn: -60, rf: -60, fn: [12, 0], ff: [-12, 0], face: 'chill' }),
  snapB: P({ lean: -7, head: -4, hip: [2, -77], hn: [32, -24], hf: [-24, -14], hsn: 'snap', hsf: 'snap', rn: -60, rf: -60, fn: [12, 0], ff: [-12, 0], face: 'smug' }),
  batA: P({ lean: -4, hip: [0, -76], hn: [6, -12], hf: [-6, 54], hsn: 'fist', hsf: 'relaxed', fn: [16, 0], ff: [-14, 0], face: 'blank' }),
  batB: P({ lean: 6, head: 8, hip: [0, -74], hn: [8, -16], hf: [-6, 50], hsn: 'fist', hsf: 'relaxed', fn: [16, 0], ff: [-14, -8], face: 'blank' }),
  balA: P({ lean: 0, head: -10, hip: [0, -86], hn: [12, -60], hf: [-10, -60], en: [1, 0.2], ef: [-1, 0.2], hsn: 'flat', hsf: 'flat', fn: [3, 0], ff: [10, -40], kf: [1, -0.4], face: 'smug' }),
  balB: P({ lean: 40, head: -20, hip: [0, -80], hn: [56, -20], hf: [-50, -20], hsn: 'flat', hsf: 'flat', fn: [4, 0], ff: [-70, -62], face: 'smug' }),
  // derrotas
  kneelA: P({ lean: 10, head: 20, hip: [-4, -42], hn: [26, 36], hf: [6, 40], hsn: 'flat', hsf: 'relaxed', fn: [26, 0], ff: [-30, -2], kf: [1, 1], face: 'hurt' }),
  kneelB: P({ lean: 28, head: 34, hip: [-6, -40], hn: [32, 42], hf: [20, 42], hsn: 'flat', hsf: 'flat', fn: [26, 0], ff: [-30, -2], kf: [1, 1], face: 'cry' }),
  slumpA: P({ lean: 24, head: 30, hip: [-6, -22], hn: [26, 38], hf: [-2, 34], hsn: 'relaxed', hsf: 'relaxed', fn: [40, 0], ff: [30, 0], kn: [1, -0.5], kf: [1, -0.5], face: 'cry' }),
  punchGroundW: P({ lean: 30, head: 10, hip: [-4, -42], hn: [10, -30], hf: [20, 40], en: [1, 0.3], fn: [26, 0], ff: [-30, -2], kf: [1, 1], face: 'angry' }),
  punchGround: P({ lean: 46, head: 26, hip: [-4, -40], hn: [40, 62], hf: [20, 44], fn: [26, 0], ff: [-30, -2], kf: [1, 1], face: 'cry' }),
  shrugA: P({ lean: 0, head: 10, hip: [0, -76], hn: [26, -6], hf: [-24, -4], en: [1, 1], ef: [-1, 1], hsn: 'palm', hsf: 'palm', rn: -90, rf: -90, fn: [10, 0], ff: [-10, 0], face: 'blank' }),
  headDown: P({ lean: 14, head: 30, hip: [0, -74], hn: [6, 56], hf: [-6, 56], hsn: 'relaxed', hsf: 'relaxed', fn: [8, 0], ff: [-8, 0], face: 'cry' })
};

export const CELEBRATIONS = {
  flex: { name: 'Flexeo total', anim: k([[0, 'guard'], [10, C.flexB, 'out'], [22, C.flexA, 'back'], [44, C.flexC, 'inOut'], [66, C.flexA, 'inOut'], [88, C.flexB, 'inOut'], [100, C.flexA, 'back']], [22, 100]) },
  siuuu: { name: 'SIUUU', anim: k([[0, 'guard'], [8, C.siuRun], [16, C.siuRun], [22, C.siuAir, 'out'], [38, C.siuAir], [44, C.siuLand, 'snap'], [120, C.siuLand], [140, C.siuLand]], [120, 140]), mods: [[22, 40, 'spin']] },
  griddy: { name: 'Griddy', anim: k([[0, 'guard'], [6, 'idle'], [200, 'idle']], [6, 200]), mods: [[6, 9999, 'griddy']] },
  mewing: { name: 'Mewing', anim: k([[0, 'guard'], [14, C.mewA, 'out'], [50, C.mewB, 'inOut'], [86, C.mewA, 'inOut']], [14, 86]) },
  chill: { name: 'Chill Guy', anim: k([[0, 'guard'], [14, C.chillA, 'out'], [54, C.chillB, 'inOut'], [94, C.chillA, 'inOut']], [14, 94]) },
  sixSeven: { name: 'Six Seven', anim: k([[0, 'guard'], [8, C.palmUp, 'out'], [16, C.palmDn, 'inOut'], [24, C.palmUp, 'inOut']], [8, 24]) },
  sigma: { name: 'Sigma Stare', anim: k([[0, 'guard'], [12, C.crossA, 'out'], [50, C.crossA], [64, C.crossB, 'inOut'], [110, C.crossB], [124, C.crossA, 'inOut']], [12, 124]) },
  dab: { name: 'Doble dab', anim: k([[0, 'guard'], [8, C.dabA, 'snap'], [30, C.dabA], [36, C.dabB, 'snap'], [58, C.dabB], [64, C.dabA, 'snap']], [8, 64]) },
  auraFarming: { name: 'Aura Farming', anim: k([[0, 'guard'], [10, 'idle'], [300, 'idle']], [10, 300]), mods: [[10, 9999, 'boat']] },
  wave: { name: 'Bye Bye', anim: k([[0, 'guard'], [10, C.waveA, 'out'], [20, C.waveB, 'inOut'], [30, C.waveA, 'inOut']], [10, 30]) },
  floss: { name: 'Floss', anim: k([[0, 'guard'], [6, 'idle'], [200, 'idle']], [6, 200]), mods: [[6, 9999, 'floss']] },
  laugh: { name: 'Bro Really Thought', anim: k([[0, 'guard'], [10, C.laughB, 'out'], [40, C.laughB], [52, C.laughA, 'inOut'], [90, C.laughA], [102, C.laughB, 'inOut']], [10, 102]), mods: [[10, 9999, 'laugh']] },
  bow: { name: 'Reverencia', anim: k([[0, 'guard'], [14, C.bowA, 'inOut'], [34, C.bowB, 'inOut'], [70, C.bowB], [90, C.bowA, 'inOut'], [130, C.bowA]], [14, 130]) },
  jojo: { name: 'Pose JoJo', anim: k([[0, 'guard'], [12, C.jojoA, 'back'], [60, C.jojoA], [70, C.jojoB, 'back'], [118, C.jojoB], [128, C.jojoA, 'back']], [12, 128]) },
  victory: { name: 'Puño al cielo', anim: k([[0, 'guard'], [8, C.fistA, 'out'], [16, C.fistB, 'back'], [40, C.fistB], [48, C.fistA, 'inOut'], [56, C.fistB, 'back']], [16, 56]) },
  snapWalk: { name: 'Chasquidos con actitud', anim: k([[0, 'guard'], [10, C.snapA, 'out'], [24, C.snapB, 'snap'], [38, C.snapA, 'inOut'], [52, C.snapB, 'snap'], [66, C.snapA, 'inOut']], [10, 66]) },
  tungTung: { name: 'Tung Tung Sahur', anim: k([[0, 'guard'], [12, C.batA, 'out'], [30, C.batB, 'inOut'], [48, C.batA, 'inOut']], [12, 48]) },
  ballerina: { name: 'Ballerina Cappuccina', anim: k([[0, 'guard'], [12, C.balA, 'out'], [52, C.balA], [62, C.balB, 'inOut'], [96, C.balB], [106, C.balA, 'inOut']], [12, 106]), mods: [[12, 52, 'pirouette']] }
};
export const CELEBRATION_IDS = Object.keys(CELEBRATIONS);

export const DEFEATS = {
  kneel: { name: 'De rodillas', anim: k([[0, 'hurt'], [14, C.kneelA, 'out'], [40, C.kneelB, 'inOut'], [80, C.kneelA, 'inOut']], [14, 80]) },
  slump: { name: 'Hundido', anim: k([[0, 'hurt'], [20, C.slumpA, 'out'], [60, C.slumpA]], [20, 60]), mods: [[20, 9999, 'breathe']] },
  rage: { name: 'Golpe al suelo', anim: k([[0, 'hurt'], [12, C.kneelA, 'out'], [24, C.punchGroundW, 'out'], [30, C.punchGround, 'snap'], [50, C.punchGround], [62, C.punchGroundW, 'inOut'], [68, C.punchGround, 'snap'], [90, C.punchGround], [102, C.punchGroundW, 'inOut']], [24, 102]) },
  shrug: { name: 'Encogerse', anim: k([[0, 'hurt'], [16, C.headDown, 'out'], [40, C.shrugA, 'back'], [60, C.headDown, 'inOut'], [90, C.headDown]], [16, 90]) }
};
export const DEFEAT_IDS = Object.keys(DEFEATS);

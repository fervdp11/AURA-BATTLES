// Celebraciones de victoria (animaciones en bucle mediante modificadores)
export const CELEBRATIONS = {
  flex: { name: 'Flexeo', anim: [[0, 'guard'], [12, 'flex', 'back']], mods: [[12, 9999, 'breathe']], voice: 'too easy' },
  siuuu: { name: 'SIUUU', anim: [[0, 'guard'], [10, 'siuSpin'], [30, 'siuLand', 'snap']], mods: [[10, 30, 'spin']], voice: 'siuuuuuu' },
  griddy: { name: 'Griddy', anim: [[0, 'idle']], mods: [[0, 9999, 'griddy']], voice: '' },
  mewing: { name: 'Mewing', anim: [[0, 'guard'], [12, 'mew']], mods: [[12, 9999, 'breathe']], voice: 'mewing streak' },
  chill: { name: 'Chill Guy', anim: [[0, 'guard'], [14, 'pockets']], mods: [[14, 9999, 'breathe']], voice: 'just a chill guy' },
  sixSeven: { name: 'Six Seven', anim: [[0, 'palmsUp']], mods: [[0, 9999, 'sixseven']], voice: 'six seven' },
  sigma: { name: 'Sigma Stare', anim: [[0, 'guard'], [14, 'armsCrossed']], mods: [[14, 9999, 'breathe']], voice: 'sigma' },
  dab: { name: 'Dab', anim: [[0, 'guard'], [8, 'dab', 'snap']], mods: [], voice: 'dab' },
  auraFarming: { name: 'Aura Farming', anim: [[0, 'idle']], mods: [[0, 9999, 'dance']], voice: 'aura farming' },
  wave: { name: 'Bye Bye', anim: [[0, 'guard'], [10, 'wave']], mods: [[10, 9999, 'wave']], voice: 'bye bye' },
  floss: { name: 'Floss', anim: [[0, 'idle']], mods: [[0, 9999, 'floss']], voice: '' },
  laugh: { name: 'Bro Really Thought', anim: [[0, 'guard'], [10, 'laughBent']], mods: [[10, 9999, 'laugh']], voice: 'bro really thought' },
  bow: { name: 'Reverencia', anim: [[0, 'guard'], [20, 'bow', 'inOut']], mods: [], voice: 'thank you' },
  jojo: { name: 'Pose JoJo', anim: [[0, 'guard'], [14, 'jojo', 'back']], mods: [[14, 9999, 'breathe']], voice: 'yare yare daze' },
  victory: { name: 'Puño al cielo', anim: [[0, 'guard'], [10, 'victoryFist', 'back']], mods: [[10, 9999, 'bob']], voice: 'easy' }
};
export const CELEBRATION_IDS = Object.keys(CELEBRATIONS);

// Estados alterados (buffs y debuffs). Cada uno define multiplicadores y comportamiento.
// control: anula el control del jugador ('charm' camina hacia la fuente, 'fear' huye, 'stun' inmóvil, 'dance', 'freeze').
export const STATUS = {
  // ---- buffs ----
  mewing: { buff: true, def: 0.65, energyRegen: 0.05, color: 0x9be7ff, label: 'MEWING' },
  infMewing: { buff: true, def: 0.5, regen: 0.18, energyRegen: 0.06, immune: ['tilted'], color: 0x6fd8ff, label: 'INFINITE MEWING' },
  auraWalk: { buff: true, speed: 1.15, armorBelow: 70, regen: 0.25, color: 0xffd34d, label: 'AURA WALK' },
  chill: { buff: true, regenIdle: 0.35, immune: ['fear', 'charmed', 'tilted', 'mogged'], color: 0x7fd6a0, label: 'CHILL' },
  npc: { buff: true, projImmune: true, immune: ['fear', 'charmed', 'tilted', 'mogged', 'humiliate'], color: 0xaaaaaa, label: 'NPC MODE' },
  plotTwist: { buff: true, nextHit: 1.4, color: 0xaaaaff },
  nahIdWin: { buff: true, dmg: 1.3, color: 0xffcc33, label: "NAH I'D WIN" },
  mainChar: { buff: true, dmg: 1.15, energyMult: 1.5, color: 0xfff2a8, label: 'MAIN CHARACTER' },
  cooking: { buff: true, color: 0xff8844, label: 'COOKING' },
  thisIsFine: { buff: true, thorns: 18, armorBelow: 45, color: 0xff6a00, label: 'THIS IS FINE' },
  stonks: { buff: true, color: 0x44ff88, label: 'STONKS' },
  bigBrain: { buff: true, autoParry: true, color: 0xff99ff, label: 'BIG BRAIN' },
  sigmaGrind: { buff: true, color: 0xb0b0ff, label: 'GRINDSET' },
  speedrun: { buff: true, speed: 1.35, recovery: 0.8, color: 0x55ffee, label: 'SPEEDRUN' },
  cool: { buff: true, immune: ['fear', 'stareable'], color: 0x222222, label: 'DEAL WITH IT' },
  auraFarm: { buff: true, color: 0xffe066 },
  narutoRun: { buff: true, projImmune: true, color: 0xffa040 },
  decoy: { buff: true, color: 0xff77cc },
  domain: { buff: true, color: 0x8a2be2, label: 'DOMAIN' },
  goblin: { buff: true, dmg: 1.2, def: 1.25, speed: 1.2, color: 0x66cc33, label: 'GOBLIN MODE' },

  // ---- debuffs ----
  fear: { control: 'fear', color: 0x6633aa, label: 'MIEDO' },
  charmed: { control: 'charm', color: 0xff5fa2, label: 'RIZZEADO' },
  inverted: { inverted: true, color: 0x9933ff, label: 'INVERTIDO' },
  tilted: { energyMult: 0.5, color: 0xff4444, label: 'TILTEADO' },
  ratio: { color: 0x3fa9f5, label: 'RATIO' },
  rooted: { rooted: true, color: 0x33aa33, label: 'TOCA CÉSPED' },
  silenced: { silenced: true, color: 0x888888, label: 'SILENCIADO' },
  mogged: { dmg: 0.8, color: 0x555577, label: 'MOGGED' },
  frozen: { control: 'freeze', color: 0xaee8ff, label: 'CONGELADO' },
  dizzy: { control: 'stun', color: 0xffee55, label: 'MAREADO' },
  caught: { control: 'stun', color: 0xffffff, label: 'CAUGHT IN 4K' },
  paused: { control: 'stun', color: 0xdddddd, label: 'HOLD UP' },
  dancing: { control: 'dance', color: 0xff66ff, label: 'RICKROLLED' },
  lagged: { control: 'freeze', color: 0x00ff66, label: 'LAG' },
  marked: { color: 0xff2222, label: 'OMAE WA MOU...' },
  patapim: { rooted: true, color: 0x6b8e23, label: 'RAÍCES PATAPIM' },
  lirili: { speed: 0.55, energyMult: 0.6, color: 0x88aa44, label: 'LIRILÌ LARILÀ' },
    slowed: { speed: 0.7, color: 0x6688aa, label: 'LENTO' },
  burning: { color: 0xff5500 }
};

export const CONTROL_IMMUNITY = 100; // frames de inmunidad tras un control

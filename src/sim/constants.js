// Constantes globales de simulación (unidades: píxeles y frames a 60 Hz)
export const FPS = 60;
export const GROUND_Y = 600;
export const ARENA_W = 2000;
export const WALL_L = 150;
export const WALL_R = ARENA_W - 150;
export const GRAVITY = 0.82;
export const MAX_FALL = 22;
export const MAX_AURA = 1000;
export const MAX_ENERGY = 100;

export const WALK_SPEED = 4.4;
export const BACK_SPEED = 3.4;
export const JUMP_VY = -16.2;
export const JUMP_VX = 5.2;
export const DASH_FRAMES = 14;
export const DASH_SPEED = 13;
export const DASH_IFRAMES = [2, 10];
export const DASH_COOLDOWN = 18;

export const PARRY_WINDOW = 7;
export const PARRY_LOCKOUT = 26;
export const BUFFER_FRAMES = 8;
export const TURN_DELAY = 5;
export const JUGGLE_LIMIT = 7;
export const COMBO_HIT_LIMIT = 16;
export const BURST_COST = 50;

export const ACTIONS = ['light', 'heavy', 'special', 'skill1', 'skill2', 'ult', 'dash', 'block'];

export function emptyInput() {
  return {
    l: false, r: false, u: false, d: false,
    pu: false, pd: false,
    held: { light: false, heavy: false, special: false, skill1: false, skill2: false, ult: false, dash: false, block: false },
    pressed: { light: false, heavy: false, special: false, skill1: false, skill2: false, ult: false, dash: false, block: false }
  };
}

// Source model: ChatGPT 5.6 Sol
export const VIEW_W = 960;
export const VIEW_H = 540;
export const WORLD_W = 900;
export const WORLD_H = 4580;

export const PHYSICS = {
  gravity: -1650,
  maxFall: -980,
  groundAcceleration: 1850,
  groundSpeed: 275,
  airAcceleration: 430,
  airSpeed: 410,
  groundFriction: 12,
  iceFriction: 1.15,
  chargeMinMs: 80,
  chargeMaxMs: 1050,
  jumpMin: 575,
  jumpMax: 1010,
  jumpHorizontalMin: 190,
  jumpHorizontalMax: 455,
  airBudget: 150,
  springVelocity: 1120,
} as const;

export const COLORS = {
  ink: '#07101d',
  slate: '#17253b',
  brass: '#d7a94b',
  cyan: '#75e5ed',
  ice: '#92d7f2',
  cream: '#f3e9ce',
  danger: '#ef6c62',
  violet: '#9f86ff',
} as const;

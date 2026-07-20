// Source model: ChatGPT 5.6 Sol
export type Vec = { x: number; y: number };

export type PlatformKind = 'normal' | 'moving' | 'crumble' | 'spring' | 'oneway' | 'ice' | 'checkpoint';

export interface Platform {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PlatformKind;
  baseX?: number;
  range?: number;
  speed?: number;
  phase?: number;
  crumbleAt?: number;
  disabledUntil?: number;
  checkpoint?: number;
}

export interface Collectible {
  id: string;
  x: number;
  y: number;
  collected: boolean;
  phase: number;
}

export interface Rotor {
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
}

export interface Checkpoint {
  id: number;
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
  groundKind: PlatformKind | null;
  facing: -1 | 1;
  charging: boolean;
  chargeStarted: number;
  chargeRatio: number;
  coyoteUntil: number;
  airBudget: number;
  squish: number;
  invulnerableUntil: number;
}

export interface RunStats {
  startedAt: number;
  elapsedMs: number;
  penaltyMs: number;
  falls: number;
  maxHeight: number;
  collected: number;
}

export interface BestScore {
  timeMs: number;
  falls: number;
  collected: number;
  completedAt: string;
}

export type GameMode = 'intro' | 'playing' | 'paused' | 'complete';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
}

export interface Pulse {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  maxRadius: number;
}

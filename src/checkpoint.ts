// Source model: ChatGPT 5.6 Sol
import type { Checkpoint } from './types';

export interface RespawnState {
  checkpoint: Checkpoint;
  falls: number;
  penaltyMs: number;
}

export function advanceCheckpoint(current: Checkpoint, candidate: Checkpoint): Checkpoint {
  return candidate.id > current.id ? candidate : current;
}

export function applyFall(checkpoint: Checkpoint, falls: number, penaltyMs: number): RespawnState {
  return { checkpoint, falls: falls + 1, penaltyMs: penaltyMs + 8000 };
}

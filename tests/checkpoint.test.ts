// Source model: ChatGPT 5.6 Sol
import { describe, expect, it } from 'vitest';
import { advanceCheckpoint, applyFall } from '../src/checkpoint';
import type { Checkpoint } from '../src/types';

const base: Checkpoint = { id: 0, x: 100, y: 80 };
const upper: Checkpoint = { id: 2, x: 520, y: 2942 };

describe('checkpoint and fall penalty', () => {
  it('only advances upward', () => {
    expect(advanceCheckpoint(base, upper)).toEqual(upper);
    expect(advanceCheckpoint(upper, base)).toEqual(upper);
  });

  it('preserves checkpoint while adding a fall and eight-second penalty', () => {
    const result = applyFall(upper, 3, 16000);
    expect(result.checkpoint).toBe(upper);
    expect(result.falls).toBe(4);
    expect(result.penaltyMs).toBe(24000);
  });
});

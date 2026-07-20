// Source model: ChatGPT 5.6 Sol
import { describe, expect, it } from 'vitest';
import { PHYSICS } from '../src/config';
import { chargeRatio, jumpImpulse } from '../src/physics';

describe('charge model', () => {
  it('clamps charge below minimum and above maximum', () => {
    expect(chargeRatio(0)).toBe(0);
    expect(chargeRatio(PHYSICS.chargeMaxMs + 5000)).toBe(1);
  });

  it('increases vertical and horizontal impulse with hold time', () => {
    const tap = jumpImpulse(PHYSICS.chargeMinMs, 1);
    const full = jumpImpulse(PHYSICS.chargeMaxMs, 1);
    expect(full.vy).toBeGreaterThan(tap.vy);
    expect(full.vx).toBeGreaterThan(tap.vx);
    expect(full.ratio).toBe(1);
  });

  it('keeps direction symmetric', () => {
    const left = jumpImpulse(650, -1);
    const right = jumpImpulse(650, 1);
    expect(left.vx).toBeCloseTo(-right.vx);
    expect(left.vy).toBeCloseTo(right.vy);
  });
});

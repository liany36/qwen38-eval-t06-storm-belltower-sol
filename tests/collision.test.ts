// Source model: ChatGPT 5.6 Sol
import { describe, expect, it } from 'vitest';
import { resolvePlatforms } from '../src/physics';
import type { Platform, Player } from '../src/types';

function player(overrides: Partial<Player>): Player {
  return {
    x: 120, y: 100, prevX: 120, prevY: 120, vx: 0, vy: -200,
    width: 32, height: 64, grounded: false, groundKind: null, facing: 1,
    charging: false, chargeStarted: 0, chargeRatio: 0, coyoteUntil: 0,
    airBudget: 100, squish: 0, invulnerableUntil: 0, ...overrides,
  };
}

const solid: Platform = { id: 'p', x: 50, y: 110, w: 180, h: 20, kind: 'normal' };

describe('platform collision resolution', () => {
  it('lands stably when feet cross a platform top', () => {
    const subject = player({ prevY: 124, y: 104, vy: -300 });
    const result = resolvePlatforms(subject, [solid], 0);
    expect(result.landed?.id).toBe('p');
    expect(subject.y).toBe(110);
    expect(subject.vy).toBe(0);
    expect(subject.grounded).toBe(true);
  });

  it('blocks a solid platform underside', () => {
    const subject = player({ y: 28, prevY: 20, vy: 350, height: 64 });
    const result = resolvePlatforms(subject, [solid], 0);
    expect(result.hitCeiling).toBe(true);
    expect(subject.y).toBe(26);
    expect(subject.vy).toBe(0);
  });

  it('allows passage through a one-way platform underside', () => {
    const oneWay: Platform = { ...solid, id: 'one', kind: 'oneway' };
    const subject = player({ y: 28, prevY: 20, vy: 350, height: 64 });
    const result = resolvePlatforms(subject, [oneWay], 0);
    expect(result.hitCeiling).toBe(false);
    expect(subject.y).toBe(28);
  });
});

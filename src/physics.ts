// Source model: ChatGPT 5.6 Sol
import { PHYSICS } from './config';
import { clamp, lerp, smoothstep } from './math';
import type { Platform, Player } from './types';

export interface JumpImpulse { vx: number; vy: number; ratio: number }
export interface CollisionResult { landed: Platform | null; hitCeiling: boolean; hitWall: boolean }

export function chargeRatio(heldMs: number): number {
  return clamp((heldMs - PHYSICS.chargeMinMs) / (PHYSICS.chargeMaxMs - PHYSICS.chargeMinMs), 0, 1);
}

export function jumpImpulse(heldMs: number, direction: -1 | 0 | 1): JumpImpulse {
  const ratio = chargeRatio(heldMs);
  const eased = smoothstep(ratio);
  return {
    vx: direction * lerp(PHYSICS.jumpHorizontalMin, PHYSICS.jumpHorizontalMax, eased),
    vy: lerp(PHYSICS.jumpMin, PHYSICS.jumpMax, eased),
    ratio,
  };
}

function overlapX(player: Player, platform: Platform): boolean {
  const half = player.width / 2;
  return player.x + half > platform.x + 2 && player.x - half < platform.x + platform.w - 2;
}

function platformEnabled(platform: Platform, now: number): boolean {
  return !platform.disabledUntil || platform.disabledUntil <= now;
}

export function resolvePlatforms(player: Player, platforms: Platform[], now: number): CollisionResult {
  let landed: Platform | null = null;
  let hitCeiling = false;
  let hitWall = false;
  const half = player.width / 2;

  if (player.vy <= 0) {
    let highestCrossed = -Infinity;
    for (const platform of platforms) {
      if (!platformEnabled(platform, now) || !overlapX(player, platform)) continue;
      const crossedTop = player.prevY >= platform.y - 3 && player.y <= platform.y + 1;
      if (crossedTop && platform.y > highestCrossed) {
        highestCrossed = platform.y;
        landed = platform;
      }
    }
    if (landed) {
      player.y = landed.y;
      player.vy = landed.kind === 'spring' ? PHYSICS.springVelocity : 0;
      player.grounded = landed.kind !== 'spring';
      player.groundKind = landed.kind;
    }
  }

  for (const platform of platforms) {
    if (!platformEnabled(platform, now) || platform.kind === 'oneway') continue;
    const bottom = platform.y - platform.h;
    const top = platform.y;
    if (!overlapX(player, platform)) continue;
    const prevHead = player.prevY + player.height;
    const head = player.y + player.height;
    if (player.vy > 0 && prevHead <= bottom + 2 && head >= bottom) {
      player.y = bottom - player.height;
      player.vy = Math.min(0, player.vy);
      hitCeiling = true;
    }

    const verticalOverlap = player.y < top - 4 && player.y + player.height > bottom + 4;
    if (!verticalOverlap) continue;
    const prevLeft = player.prevX - half;
    const prevRight = player.prevX + half;
    const left = player.x - half;
    const right = player.x + half;
    if (prevRight <= platform.x + 2 && right > platform.x) {
      player.x = platform.x - half;
      player.vx = Math.min(0, player.vx);
      hitWall = true;
    } else if (prevLeft >= platform.x + platform.w - 2 && left < platform.x + platform.w) {
      player.x = platform.x + platform.w + half;
      player.vx = Math.max(0, player.vx);
      hitWall = true;
    }
  }

  return { landed, hitCeiling, hitWall };
}

export function rotorHit(player: Player, rotorX: number, rotorY: number, radius: number, angle: number): boolean {
  const px = player.x;
  const py = player.y + player.height * 0.48;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const projection = clamp((px - rotorX) * ux + (py - rotorY) * uy, -radius, radius);
  const closestX = rotorX + ux * projection;
  const closestY = rotorY + uy * projection;
  return Math.hypot(px - closestX, py - closestY) < player.width * 0.48 + 7;
}

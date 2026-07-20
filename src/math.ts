// Source model: ChatGPT 5.6 Sol
import type { Vec } from './types';

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const damp = (current: number, target: number, speed: number, dt: number): number => lerp(current, target, 1 - Math.exp(-speed * dt));
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);
export const length = (v: Vec): number => Math.hypot(v.x, v.y);
export const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const formatTime = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 10));
  const minutes = Math.floor(total / 6000);
  const seconds = Math.floor((total % 6000) / 100);
  const centis = total % 100;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
};

export function seededNoise(index: number): number {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

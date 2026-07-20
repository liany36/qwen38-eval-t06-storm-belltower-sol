// Source model: ChatGPT 5.6 Sol
import { describe, expect, it } from 'vitest';
import { BEST_SCORE_KEY, isBetter, loadBest, saveBest } from '../src/storage';
import type { BestScore, RunStats } from '../src/types';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

const prior: BestScore = { timeMs: 100000, falls: 2, collected: 9, completedAt: '2026-01-01T00:00:00.000Z' };
const stats: RunStats = { startedAt: 0, elapsedMs: 80000, penaltyMs: 8000, falls: 1, maxHeight: 4465, collected: 10 };

describe('best score persistence', () => {
  it('prefers lower adjusted completion time', () => {
    expect(isBetter({ ...prior, timeMs: 90000 }, prior)).toBe(true);
    expect(isBetter({ ...prior, timeMs: 110000 }, prior)).toBe(false);
  });

  it('saves and reloads a valid best result', () => {
    const storage = new MemoryStorage();
    const saved = saveBest(storage, stats, prior);
    expect(saved.timeMs).toBe(88000);
    expect(loadBest(storage as unknown as Storage)).toEqual(saved);
    expect(storage.getItem(BEST_SCORE_KEY)).toContain('88000');
  });

  it('ignores malformed stored data', () => {
    const storage = new MemoryStorage();
    storage.setItem(BEST_SCORE_KEY, '{broken');
    expect(loadBest(storage as unknown as Storage)).toBeNull();
  });
});

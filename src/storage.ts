// Source model: ChatGPT 5.6 Sol
import type { BestScore, RunStats } from './types';

export const BEST_SCORE_KEY = 'storm-belltower.best.v1';

export function loadBest(storage: Pick<Storage, 'getItem'>): BestScore | null {
  try {
    const raw = storage.getItem(BEST_SCORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BestScore>;
    if (!Number.isFinite(parsed.timeMs) || !Number.isFinite(parsed.falls) || !Number.isFinite(parsed.collected)) return null;
    return parsed as BestScore;
  } catch {
    return null;
  }
}

export function isBetter(candidate: BestScore, previous: BestScore | null): boolean {
  if (!previous) return true;
  if (candidate.timeMs !== previous.timeMs) return candidate.timeMs < previous.timeMs;
  if (candidate.falls !== previous.falls) return candidate.falls < previous.falls;
  return candidate.collected > previous.collected;
}

export function saveBest(storage: Pick<Storage, 'setItem'>, stats: RunStats, previous: BestScore | null): BestScore {
  const candidate: BestScore = {
    timeMs: stats.elapsedMs + stats.penaltyMs,
    falls: stats.falls,
    collected: stats.collected,
    completedAt: new Date().toISOString(),
  };
  const result = isBetter(candidate, previous) ? candidate : previous!;
  storage.setItem(BEST_SCORE_KEY, JSON.stringify(result));
  return result;
}

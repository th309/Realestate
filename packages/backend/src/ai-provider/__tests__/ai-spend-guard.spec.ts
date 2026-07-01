import { AiSpendGuard, AiSpendCapExceededError } from '../ai-spend-guard';

/**
 * Deterministic clock helper: the guard reads `now()` (ms since epoch) so tests
 * can advance time and cross UTC day boundaries without real timers.
 */
function fixedClock(startMs: number) {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    set: (ms: number) => {
      t = ms;
    },
  };
}

// deepseek-v4-pro pricing: input 0.435/M, output 0.87/M.
// 1M prompt + 1M completion = 0.435 + 0.87 = 1.305 USD per record().
const ONE_M = 1_000_000;
const COST_PER_CALL = 1.305;

describe('AiSpendGuard', () => {
  it('accumulates estimated cost for recorded calls in the current UTC day', () => {
    const clock = fixedClock(Date.UTC(2026, 6, 1, 10, 0, 0));
    const guard = new AiSpendGuard({ dailyCapUsd: 100, now: clock.now });

    guard.record('deepseek-v4-pro', ONE_M, ONE_M);
    guard.record('deepseek-v4-pro', ONE_M, ONE_M);

    expect(guard.getDailySpendUsd()).toBeCloseTo(COST_PER_CALL * 2, 5);
  });

  it('does not throw from assertUnderCap while spend is below the cap', () => {
    const clock = fixedClock(Date.UTC(2026, 6, 1, 10, 0, 0));
    const guard = new AiSpendGuard({ dailyCapUsd: 100, now: clock.now });

    guard.record('deepseek-v4-pro', ONE_M, ONE_M);

    expect(() => guard.assertUnderCap()).not.toThrow();
  });

  it('throws AiSpendCapExceededError once accumulated spend reaches the cap', () => {
    const clock = fixedClock(Date.UTC(2026, 6, 1, 10, 0, 0));
    const guard = new AiSpendGuard({ dailyCapUsd: 2, now: clock.now });

    guard.record('deepseek-v4-pro', ONE_M, ONE_M); // 1.305 < 2 → still ok
    expect(() => guard.assertUnderCap()).not.toThrow();

    guard.record('deepseek-v4-pro', ONE_M, ONE_M); // 2.61 >= 2 → cap breached
    expect(() => guard.assertUnderCap()).toThrow(AiSpendCapExceededError);
  });

  it('resets accumulated spend when the UTC day rolls over', () => {
    const clock = fixedClock(Date.UTC(2026, 6, 1, 23, 0, 0));
    const guard = new AiSpendGuard({ dailyCapUsd: 2, now: clock.now });

    guard.record('deepseek-v4-pro', ONE_M, ONE_M);
    guard.record('deepseek-v4-pro', ONE_M, ONE_M);
    expect(() => guard.assertUnderCap()).toThrow(AiSpendCapExceededError);

    clock.advance(2 * 60 * 60 * 1000); // +2h → next UTC day (2026-07-02 01:00)
    expect(guard.getDailySpendUsd()).toBe(0);
    expect(() => guard.assertUnderCap()).not.toThrow();
  });

  it('is disabled (never throws) when dailyCapUsd is zero or negative', () => {
    const clock = fixedClock(Date.UTC(2026, 6, 1, 10, 0, 0));
    const guard = new AiSpendGuard({ dailyCapUsd: 0, now: clock.now });

    guard.record('deepseek-v4-pro', ONE_M, ONE_M);
    guard.record('deepseek-v4-pro', ONE_M, ONE_M);

    expect(() => guard.assertUnderCap()).not.toThrow();
  });

  it('treats unknown-model (unpriced) calls as zero cost', () => {
    const clock = fixedClock(Date.UTC(2026, 6, 1, 10, 0, 0));
    const guard = new AiSpendGuard({ dailyCapUsd: 100, now: clock.now });

    guard.record('totally-unknown-model', ONE_M, ONE_M);

    expect(guard.getDailySpendUsd()).toBe(0);
  });

  it('emits a warning once per crossed threshold (50/80/100%)', () => {
    const clock = fixedClock(Date.UTC(2026, 6, 1, 10, 0, 0));
    const warnings: string[] = [];
    // cap = 1.305 so each COST_PER_CALL record is exactly one full cap unit.
    const guard = new AiSpendGuard({
      dailyCapUsd: COST_PER_CALL,
      now: clock.now,
      warn: (m) => warnings.push(m),
    });

    // Spread cost across small calls so we cross 50% then 80% then 100%.
    guard.record('deepseek-v4-pro', 500_000, 500_000); // ~50%
    guard.record('deepseek-v4-pro', 300_000, 300_000); // ~80%
    guard.record('deepseek-v4-pro', 300_000, 300_000); // ~110% (>=100%)

    // One warning per threshold, no duplicates.
    expect(warnings.length).toBe(3);
    guard.record('deepseek-v4-pro', 100_000, 100_000); // still >=100%, no new warn
    expect(warnings.length).toBe(3);
  });
});

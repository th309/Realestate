import { runGuardedCompletion, envNumber } from '../ai-guarded-completion';
import { AiCompletionCache } from '../ai-completion-cache';
import { AiSpendGuard, AiSpendCapExceededError } from '../ai-spend-guard';
import type { AiCompletionResponse } from '../ai-provider.types';

const NOOP_LOGGER = { log: () => {} };

function response(content: string): AiCompletionResponse {
  return {
    content,
    model: 'deepseek-v4-pro',
    provider: 'deepseek',
    usage: {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      totalTokens: 2_000_000,
    },
    durationMs: 1,
  };
}

function makeDeps(
  overrides: Partial<Parameters<typeof runGuardedCompletion>[0]> = {},
) {
  return {
    purpose: 'report_narrative',
    model: 'deepseek-v4-pro',
    cacheKey: 'key-1',
    cache: new AiCompletionCache<AiCompletionResponse>({ ttlMs: 60_000 }),
    spendGuard: new AiSpendGuard({ dailyCapUsd: 1000 }),
    logger: NOOP_LOGGER,
    execute: async () => response('hello'),
    ...overrides,
  };
}

describe('runGuardedCompletion', () => {
  it('executes on a cache miss, records spend, and caches the result', async () => {
    let calls = 0;
    const deps = makeDeps({
      execute: async () => {
        calls++;
        return response('hello');
      },
    });

    const first = await runGuardedCompletion(deps);
    expect(first.fromCache).toBe(false);
    expect(first.response.content).toBe('hello');
    expect(calls).toBe(1);
    expect(deps.spendGuard.getDailySpendUsd()).toBeGreaterThan(0);

    // Same key again → served from cache, executor not called a second time.
    const second = await runGuardedCompletion(deps);
    expect(second.fromCache).toBe(true);
    expect(calls).toBe(1);
  });

  it('does not cache an empty completion (so it will regenerate)', async () => {
    let calls = 0;
    const deps = makeDeps({
      execute: async () => {
        calls++;
        return response('   '); // whitespace-only = empty
      },
    });

    await runGuardedCompletion(deps);
    await runGuardedCompletion(deps);
    expect(calls).toBe(2);
  });

  it('never caches when cacheKey is null', async () => {
    let calls = 0;
    const deps = makeDeps({
      cacheKey: null,
      execute: async () => {
        calls++;
        return response('hello');
      },
    });

    await runGuardedCompletion(deps);
    await runGuardedCompletion(deps);
    expect(calls).toBe(2);
  });

  it('throws the cap error and never calls the executor when the cap is hit', async () => {
    let calls = 0;
    const spendGuard = new AiSpendGuard({ dailyCapUsd: 0.01 });
    spendGuard.record('deepseek-v4-pro', 1_000_000, 1_000_000); // push over $0.01
    const deps = makeDeps({
      spendGuard,
      execute: async () => {
        calls++;
        return response('hello');
      },
    });

    await expect(runGuardedCompletion(deps)).rejects.toBeInstanceOf(
      AiSpendCapExceededError,
    );
    expect(calls).toBe(0);
  });
});

describe('envNumber', () => {
  it('parses a numeric string', () => {
    expect(envNumber('300000', 999)).toBe(300000);
  });
  it('falls back when unset or non-numeric', () => {
    expect(envNumber(undefined, 999)).toBe(999);
    expect(envNumber('abc', 999)).toBe(999);
  });
  it('honors an explicit zero (disabled sentinel)', () => {
    expect(envNumber('0', 999)).toBe(0);
  });
});

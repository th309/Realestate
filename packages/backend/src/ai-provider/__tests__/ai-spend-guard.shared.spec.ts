import {
  getSharedSpendGuard,
  guardedChat,
  guardedAnthropic,
  assertAiBudget,
  recordAiUsage,
  __resetSharedSpendGuardForTests,
} from '../ai-spend-guard.shared';

const ONE_M = 1_000_000;

describe('shared AI spend guard', () => {
  beforeEach(() => __resetSharedSpendGuardForTests());

  it('returns a stable singleton instance', () => {
    expect(getSharedSpendGuard()).toBe(getSharedSpendGuard());
  });

  it('guardedChat records OpenAI-shaped usage against the shared ledger', async () => {
    const before = getSharedSpendGuard().getDailySpendUsd();
    const result = await guardedChat('deepseek-v4-pro', async () => ({
      content: 'x',
      usage: { prompt_tokens: ONE_M, completion_tokens: ONE_M },
    }));

    expect(result.content).toBe('x');
    // deepseek-v4-pro: 0.435 + 0.87 = 1.305
    expect(getSharedSpendGuard().getDailySpendUsd() - before).toBeCloseTo(
      1.305,
      5,
    );
  });

  it('guardedAnthropic records Anthropic-shaped usage (input/output_tokens)', async () => {
    const before = getSharedSpendGuard().getDailySpendUsd();
    await guardedAnthropic('claude-sonnet-4-6', async () => ({
      usage: { input_tokens: ONE_M, output_tokens: ONE_M },
    }));

    // claude-sonnet-4-6: 3 + 15 = 18
    expect(getSharedSpendGuard().getDailySpendUsd() - before).toBeCloseTo(
      18,
      5,
    );
  });

  it('guardedChat tolerates a response with no usage (records nothing)', async () => {
    const before = getSharedSpendGuard().getDailySpendUsd();
    const result = await guardedChat('deepseek-v4-pro', async () => ({
      content: 'y',
      usage: undefined,
    }));
    expect(result.content).toBe('y');
    expect(getSharedSpendGuard().getDailySpendUsd()).toBe(before);
  });

  it('recordAiUsage + assertAiBudget operate on the shared ledger', () => {
    expect(() => assertAiBudget()).not.toThrow();
    recordAiUsage('deepseek-v4-pro', ONE_M, ONE_M);
    expect(getSharedSpendGuard().getDailySpendUsd()).toBeGreaterThan(0);
  });
});

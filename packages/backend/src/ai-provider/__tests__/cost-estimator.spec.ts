import { estimateCostUsd } from '../cost-estimator';

describe('estimateCostUsd', () => {
  it('returns input+output cost for a known model', () => {
    const cost = estimateCostUsd('claude-opus-4-7', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(30, 5);
  });

  it('returns null when model is unknown', () => {
    expect(estimateCostUsd('does-not-exist', 100, 100)).toBeNull();
  });

  it('returns null when token counts are missing', () => {
    expect(estimateCostUsd('claude-opus-4-7', undefined, 100)).toBeNull();
    expect(estimateCostUsd('claude-opus-4-7', 100, undefined)).toBeNull();
  });

  it('scales linearly with token counts', () => {
    const half = estimateCostUsd('deepseek-v4-pro', 500_000, 500_000)!;
    const full = estimateCostUsd('deepseek-v4-pro', 1_000_000, 1_000_000)!;
    expect(full).toBeCloseTo(half * 2, 5);
  });

  it('prices content-pipeline chat + embedding models so their spend counts', () => {
    // gpt-4o-mini: 0.15 input + 0.60 output per 1M
    expect(estimateCostUsd('gpt-4o-mini', 1_000_000, 1_000_000)).toBeCloseTo(
      0.75,
      5,
    );
    // text-embedding-3-small: 0.02 input, 0 output (embeddings are input-only)
    expect(estimateCostUsd('text-embedding-3-small', 1_000_000, 0)).toBeCloseTo(
      0.02,
      5,
    );
  });
});

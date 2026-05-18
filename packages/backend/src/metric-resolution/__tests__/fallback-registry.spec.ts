import {
  FALLBACK_REGISTRY,
  getFallbackChain,
  getAllRegisteredMetricIds,
} from '../fallback-registry';

/**
 * Characterization test for the fallback registry. Locks in the exact set
 * of registered metric IDs and the full shape of every chain — runs against
 * a Jest snapshot so any drift (additions, removals, or chain edits) shows
 * up as a diff that must be reviewed.
 *
 * The registry is split into per-domain sub-files (price.ts, rent.ts, …)
 * and merged via the index. This test exists primarily to verify that
 * split was byte-for-byte equivalent. Future legitimate changes to the
 * registry update the snapshot intentionally with `jest -u`.
 */
describe('FALLBACK_REGISTRY characterization', () => {
  it('matches the registered metric ID set', () => {
    expect([...getAllRegisteredMetricIds()].sort()).toMatchSnapshot();
  });

  it('matches the full registry shape', () => {
    // Walk keys in sorted order so the snapshot is stable regardless of
    // insertion order across sub-files.
    const sorted = Object.fromEntries(
      Object.keys(FALLBACK_REGISTRY)
        .sort()
        .map((k) => [k, FALLBACK_REGISTRY[k]]),
    );
    expect(sorted).toMatchSnapshot();
  });

  it('getFallbackChain returns each metric verbatim', () => {
    for (const id of getAllRegisteredMetricIds()) {
      expect(getFallbackChain(id)).toEqual(FALLBACK_REGISTRY[id]);
    }
  });

  it('returns null for unknown metrics', () => {
    expect(getFallbackChain('nope_not_real')).toBeNull();
  });
});

/**
 * Shared value transforms used across fallback chains.
 *
 * Kept in a tiny dedicated module so every section sub-file can import the
 * same helper without recreating it. Adding a new transform here requires
 * updating the characterization snapshot in
 * `__tests__/fallback-registry.spec.ts` if it's referenced from a chain.
 */

/** Multiply a decimal ratio (0.062) into a percent (6.2). */
export const toPercent = (v: number) => v * 100;

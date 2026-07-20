/** ≤1 lifetime session — never really returned after signup. */
export function isZeroSessionEligible(sessionCount: number): boolean {
  return sessionCount <= 1;
}

/** Exactly 2 lifetime sessions — came back once, then stopped. */
export function isTriedOnceEligible(sessionCount: number): boolean {
  return sessionCount === 2;
}

/** 3+ sessions — was genuinely using it before going quiet. */
export function isEngagedThenQuietEligible(sessionCount: number): boolean {
  return sessionCount >= 3;
}

import type { TourPhase, Persona, MarketRef } from "./types";

/**
 * Resolves the phase actually rendered by the tour switch from the raw session.
 *
 * Two self-heals prevent dead-ends (spec §5.2 — never strand the user):
 *  1. A step phase reached with NO market falls back to collecting what's
 *     missing (persona first, then market).
 *  2. The vestigial step2/step3 phases (no real UI on /tour — they otherwise
 *     hit the "Phase 04 placeholder") redirect into the product via "step1"
 *     when a market IS already selected.
 */
export function resolveTourPhase(session: {
  phase: TourPhase;
  market: MarketRef | null;
  persona: Persona | null;
}): TourPhase {
  const STEP_PHASES: TourPhase[] = ["step1", "step2", "step3", "step4"];
  const VESTIGIAL_STEP_PHASES: TourPhase[] = ["step2", "step3"];

  if (STEP_PHASES.includes(session.phase) && !session.market) {
    return session.persona ? "market" : "persona";
  }
  if (VESTIGIAL_STEP_PHASES.includes(session.phase) && session.market) {
    return "step1";
  }
  return session.phase;
}

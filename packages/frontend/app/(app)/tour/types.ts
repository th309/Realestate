import type { MarketRef, Persona } from "@/lib/data";

export type TourPhase =
  | "persona"
  | "market"
  | "step1"
  | "step2"
  | "step3"
  | "step4"
  | "celebrate";

export interface TourSession {
  sessionId: string;
  persona: Persona | null;
  market: MarketRef | null;
  phase: TourPhase;
  reportId: string | null;
  startedAt: number;
  /**
   * The authenticated user this tour state belongs to. Used to scope persisted
   * state per account so a DIFFERENT user signing in on the same browser does
   * NOT resume the prior account's persona/market/phase. `null`/`undefined`
   * means a legacy or anonymous (pre-signup) tour — those must still resume.
   */
  userId?: string | null;
}

export const STEP_ORDER: TourPhase[] = [
  "persona",
  "market",
  "step1",
  "step2",
  "step3",
  "step4",
  "celebrate",
];

export function nextPhase(current: TourPhase): TourPhase | null {
  const i = STEP_ORDER.indexOf(current);
  return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null;
}

export type { MarketRef, Persona };

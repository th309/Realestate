import type { AnalyzerInputState } from "@/lib/analyzer/useAnalyzer";
import type { AnalyzerAssumptions } from "./analyzer-assumptions";
import type { ProvenanceMap } from "./use-analyzer-state.provenance";
import type { PiqByGeo } from "./use-piq-by-geo";
import type { InvestorGoal } from "./goal-types";
import type { AnalysisMode } from "../components/InputPanel/StrategyControls";
import type { AnyStrategyThresholds } from "../components/CustomizeThresholdsDrawer/preset-helpers";

export const DEAL_STATE_VERSION = 2 as const;

export interface RentcastEcho {
  city: string | null;
  state: string | null;
  zip: string | null;
  avmValue: number | null;
}

/**
 * The complete, resumable state of a saved deal — stored in
 * `deal_analyses.input_snapshot`.
 *
 * Holds ONLY what a recompute cannot reproduce. Derived analytics
 * (projection, sensitivity, after-tax, break-even, BRRRR timeline, grading)
 * are deliberately absent: they are pure functions of the fields below and
 * become a lie the moment an input changes. `result_snapshot` continues to
 * store them because a frozen share artifact has no live input to recompute
 * from.
 */
export interface DealStateV2 {
  v: typeof DEAL_STATE_VERSION;
  input: AnalyzerInputState;
  address: string;
  selectedZip: string | null;
  label: string | null;
  arvLocal: number;
  rehabBudget: number;
  propertyType: "sfh" | "mf";
  unitCount: number | null;
  assumptions: AnalyzerAssumptions;
  /** Per-deal UI state. The investor GOAL is global — see spec §4.6. */
  analysisMode: AnalysisMode;
  /** Audit record of what framed the saved narratives. Never restored. */
  activeGoalAtSave: InvestorGoal | null;
  thresholds?: AnyStrategyThresholds;
  provenance: ProvenanceMap;
  rentcastEcho: RentcastEcho | null;
  piqByGeo: PiqByGeo | null;
  notes: string;
  shareNotes: boolean;
  /** ISO 8601. Staleness clock — NOT bumped by autosave. See spec §4.5. */
  marketCapturedAt: string;
}

/**
 * Composes the props bundle passed into `<AnalyzerHeaderActions>` for the
 * Share / PDF flow. Kept in its own file so `AnalyzerClient.tsx` doesn't
 * have to inline ~30 lines of prop-building and bust its 400-line cap.
 *
 * Everything here is just data shuffling — no React/hooks, no side effects.
 */

import type { AiInsightPayload } from "@/lib/data";
import type {
  AnalyzerSnapshotDerived,
  AnalyzerSnapshotExtras,
  AnalyzerSnapshotState,
} from "./build-analyzer-snapshot";

type Strategy = "buyAndHold" | "flip" | "brrrr";

interface BuildArgs {
  /** Output of `useAnalyzerState` — destructure access. */
  state: {
    address: string;
    analyzer: {
      input: unknown;
      rental: unknown;
      flip: unknown;
      brrrr: unknown;
    };
    rentcastData: AnalyzerSnapshotState["rentcastData"];
    marketContext: unknown;
    projection: unknown;
    sensitivity: unknown;
    afterTax: unknown;
    breakEven: unknown;
    brrrrTimeline: unknown;
    assumptions: Record<string, unknown>;
    arvLocal: number;
    rehabBudget: number;
    propertyType: string;
    unitCount: number | null;
    propertyClass: string;
    piqByGeo: {
      zip: number | null;
      county: number | null;
      metro: number | null;
    };
  };
  displayAddress: string | null;
  subjectLat: number | null;
  subjectLon: number | null;
  paramZip: string | undefined;
  /** Derived expense rollup so the share page can render the waterfall. */
  expense: {
    grossRentMonthly: number;
    vacancyMonthly: number;
    opexMonthly: number;
    debtServiceMonthly: number;
  };
  grading: unknown;
  bestStrategy: Strategy;
  activeEngineStrategy: "BUY_AND_HOLD" | "FIX_AND_FLIP" | "BRRRR" | null;
  goal: string | null;
  comps: {
    salesComps?: Array<Record<string, unknown>>;
    rentalComps?: Array<Record<string, unknown>>;
    pricePerSqftValues?: number[];
    yourPricePerSqft?: number;
    subjectPrice?: number;
  };
  /** Owner "My Notes" free-text. */
  notes?: string;
  /** Whether notes are visible on the public share link / PDF. */
  shareNotes?: boolean;
}

export interface ShareBundle {
  state: AnalyzerSnapshotState;
  derived: AnalyzerSnapshotDerived;
  extras: AnalyzerSnapshotExtras;
  aiPayload: AiInsightPayload | null;
}

export function buildShareBundle(a: BuildArgs): ShareBundle {
  const state: AnalyzerSnapshotState = {
    address: a.state.address,
    analyzer: a.state.analyzer,
    rentcastData: a.state.rentcastData,
    marketContext: a.state.marketContext,
  };

  const derived: AnalyzerSnapshotDerived = {
    displayAddress: a.displayAddress,
    subjectLat: a.subjectLat,
    subjectLon: a.subjectLon,
    paramZip: a.paramZip,
  };

  const grading = a.grading as {
    letter?: "A" | "B" | "C" | "D" | "F";
    label?: string;
    finalGpa?: number;
  } | null;

  const extras: AnalyzerSnapshotExtras = {
    projection: a.state.projection,
    sensitivity: a.state.sensitivity,
    afterTax: a.state.afterTax,
    breakEven: a.state.breakEven,
    brrrrTimeline: a.state.brrrrTimeline,
    expense: a.expense,
    assumptions: a.state.assumptions,
    arvLocal: a.state.arvLocal,
    rehabBudget: a.state.rehabBudget,
    propertyType: a.state.propertyType,
    unitCount: a.state.unitCount,
    propertyClass: a.state.propertyClass,
    grading: grading?.letter
      ? {
          letter: grading.letter,
          label: grading.label,
          finalGpa: grading.finalGpa,
        }
      : undefined,
    bestStrategy: a.bestStrategy,
    comps: {
      salesComps: a.comps.salesComps,
      pricePerSqftValues: a.comps.pricePerSqftValues,
      yourPricePerSqft: a.comps.yourPricePerSqft,
      subjectPrice: a.comps.subjectPrice,
      subjectLat: a.subjectLat,
      subjectLon: a.subjectLon,
    },
    notes: a.notes,
    shareNotes: a.shareNotes,
  };

  const aiPayload: AiInsightPayload | null =
    a.activeEngineStrategy != null
      ? ({
          input: a.state.analyzer.input,
          result: {
            rental: a.state.analyzer.rental,
            flip: a.state.analyzer.flip,
            brrrr: a.state.analyzer.brrrr,
          },
          rentcast: a.state.rentcastData,
          piq: a.state.marketContext,
          grading: grading ?? undefined,
          strategy: a.activeEngineStrategy,
          piqByGeo: a.state.piqByGeo,
          goal: a.goal,
        } as AiInsightPayload)
      : null;

  return { state, derived, extras, aiPayload };
}

export function mapStrategyToBestPlay(s: string): Strategy {
  if (s === "FIX_AND_FLIP" || s === "flip") return "flip";
  if (s === "BRRRR" || s === "brrrr") return "brrrr";
  return "buyAndHold";
}

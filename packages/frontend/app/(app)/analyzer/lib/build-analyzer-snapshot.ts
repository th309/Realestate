import type { SaveAnalysisPayload } from "@/lib/data/fetchers/analyzer";
import type { RichResultSnapshot } from "./analyzer-snapshot-types";

/**
 * Derived values not present on the `useAnalyzerState` return shape —
 * computed by the parent component during render.
 */
export interface AnalyzerSnapshotDerived {
  displayAddress: string | null;
  subjectLat: number | null;
  subjectLon: number | null;
  paramZip: string | undefined;
}

/** Loose shape — we only read a small slice of `useAnalyzerState`'s output. */
export interface AnalyzerSnapshotState {
  address: string;
  analyzer: { input: unknown; rental: unknown; flip: unknown; brrrr: unknown };
  rentcastData: {
    property_record?: {
      city?: string | null;
      state?: string | null;
      zip?: string | null;
    } | null;
  } | null;
  marketContext: unknown;
}

/**
 * Extras captured at Share-click time so the share/PDF page can render the
 * full analyzer view from a pure snapshot — no live recompute, no client
 * hooks needed. All fields optional so an older save still works.
 */
export interface AnalyzerSnapshotExtras {
  projection?: unknown;
  sensitivity?: unknown;
  afterTax?: unknown;
  breakEven?: unknown;
  brrrrTimeline?: unknown;
  expense?: {
    grossRentMonthly: number;
    vacancyMonthly: number;
    opexMonthly: number;
    debtServiceMonthly: number;
  };
  assumptions?: Record<string, unknown>;
  arvLocal?: number | null;
  rehabBudget?: number | null;
  propertyType?: string;
  unitCount?: number | null;
  propertyClass?: string;
  grading?: {
    letter: "A" | "B" | "C" | "D" | "F";
    label?: string;
    summary?: string;
    finalGpa?: number;
  };
  bestStrategy?: "buyAndHold" | "flip" | "brrrr";
  comps?: {
    salesComps?: Array<Record<string, unknown>>;
    pricePerSqftValues?: number[];
    yourPricePerSqft?: number;
    subjectPrice?: number;
    subjectLat?: number | null;
    subjectLon?: number | null;
  };
  aiNarratives?: RichResultSnapshot["aiNarratives"];
  /** Free-text owner notes from the "My Notes" section. */
  notes?: string;
  /** Whether `notes` is visible on the public share link / PDF. */
  shareNotes?: boolean;
}

/**
 * Compose a `SaveAnalysisPayload` from the analyzer's working state. Pulled
 * out of `AnalyzerClient` to keep that React component under its 400-line
 * limit. Address fields prefer the RentCast-resolved values (canonical) and
 * fall back to user-typed address.
 */
export function buildAnalyzerSnapshot(
  state: AnalyzerSnapshotState,
  derived: AnalyzerSnapshotDerived,
  extras: AnalyzerSnapshotExtras = {},
): SaveAnalysisPayload {
  const rec = state.rentcastData?.property_record ?? null;
  const result: RichResultSnapshot = {
    rental: state.analyzer.rental as Partial<RichResultSnapshot["rental"]>,
    flip: state.analyzer.flip as RichResultSnapshot["flip"],
    brrrr: state.analyzer.brrrr as RichResultSnapshot["brrrr"],
    projection: extras.projection,
    sensitivity: extras.sensitivity,
    afterTax: extras.afterTax,
    breakEven: extras.breakEven,
    brrrrTimeline: extras.brrrrTimeline,
    expense: extras.expense,
    input: state.analyzer.input as Record<string, unknown>,
    assumptions: extras.assumptions,
    arvLocal: extras.arvLocal,
    rehabBudget: extras.rehabBudget,
    propertyType: extras.propertyType,
    unitCount: extras.unitCount,
    propertyClass: extras.propertyClass,
    grading: extras.grading,
    bestStrategy: extras.bestStrategy,
    comps: extras.comps,
    aiNarratives: extras.aiNarratives,
    notes: extras.notes,
    shareNotes: extras.shareNotes,
  };

  return {
    label: null,
    address_full: derived.displayAddress ?? null,
    address_city: rec?.city ?? state.address.trim(),
    address_state: rec?.state ?? "",
    address_zip: rec?.zip ?? derived.paramZip ?? null,
    lat: derived.subjectLat ?? null,
    lon: derived.subjectLon ?? null,
    input_snapshot: state.analyzer.input as Record<string, unknown>,
    result_snapshot: result as unknown as Record<string, unknown>,
    market_context: (state.marketContext ?? null) as Record<
      string,
      unknown
    > | null,
    ai_verdict: (extras.aiNarratives ?? null) as Record<string, unknown> | null,
  };
}

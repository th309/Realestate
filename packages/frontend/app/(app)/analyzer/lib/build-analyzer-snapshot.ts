/**
 * Payload builders for the analyzer's two write paths.
 *
 * The saved-deal row has three columns with three different lifetimes:
 *
 * | column            | written by                                      |
 * | ----------------- | ----------------------------------------------- |
 * | `input_snapshot`  | Save, Notes-Save, Share, PDF, autosave           |
 * | `result_snapshot` | Share and PDF ONLY — the published artifact      |
 * | `market_context`  | the save that CREATES the row, then only an      |
 * |                   | explicit "Update market data"                    |
 *
 * One builder writing all three made "which button may republish a link
 * already in a client's hands" a property of call sites. It is now a
 * property of types: `buildDealStatePayload` returns a `DealStatePayload`,
 * whose `result_snapshot`/`ai_verdict` are `?: never`, so a Save that tries
 * to publish is a compile error rather than a review catch.
 */

import type {
  DealStatePayload,
  PublishedArtifactPayload,
} from "@/lib/data/fetchers/analyzer";
import type { DealStateV2 } from "./deal-state-types";
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
 *
 * These feed `result_snapshot` only. Anything a reopened deal needs to
 * RESUME belongs in `DealStateV2` instead — see `deal-state-types.ts`.
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

/** Which row a write targets. */
export interface SnapshotTarget {
  /**
   * Saved-deal row id, once one exists — see `AnalyzerPersistenceService.save()`,
   * which updates that row in place instead of re-deriving it from
   * `(owner, address)`. Absent means this write CREATES the row, which is
   * also what makes it the one save allowed to capture `market_context`.
   */
  id?: string;
}

/**
 * The columns every write path sets: who/where the deal is, plus the
 * resumable state. Address fields prefer the RentCast-resolved values
 * (canonical) and fall back to the user-typed address.
 */
function buildIdentityColumns(
  dealState: DealStateV2,
  state: AnalyzerSnapshotState,
  derived: AnalyzerSnapshotDerived,
  target: SnapshotTarget,
): DealStatePayload {
  const rec = state.rentcastData?.property_record ?? null;
  return {
    ...(target.id ? { id: target.id } : {}),
    // The deal name lives IN the state blob, so the column is a projection
    // of it rather than a second source of truth a rename can desync from.
    // The autosave path projects the same field server-side — see
    // `AnalyzerPersistenceService.patchState()`.
    label: dealState.label ?? null,
    address_full: derived.displayAddress ?? null,
    address_city: rec?.city ?? state.address.trim(),
    address_state: rec?.state ?? "",
    address_zip: rec?.zip ?? derived.paramZip ?? null,
    lat: derived.subjectLat ?? null,
    lon: derived.subjectLon ?? null,
    input_snapshot: dealState as unknown as Record<string, unknown>,
    // Captured once, when the row is created. A re-save omits the key
    // entirely so the backend's spread leaves the stored capture alone —
    // sending `null` here would erase it on every save.
    ...(target.id
      ? {}
      : {
          market_context: (state.marketContext ?? null) as Record<
            string,
            unknown
          > | null,
        }),
  };
}

/**
 * Compose the payload for an explicit **Save** or the "My Notes" Save.
 *
 * Persists the deal's identity and its resumable `DealStateV2` — and
 * nothing else. Structurally cannot carry `result_snapshot`, so no Save can
 * republish a share link, and it takes no `extras`, so no Save has a reason
 * to pre-await AI narratives.
 */
export function buildDealStatePayload(
  dealState: DealStateV2,
  state: AnalyzerSnapshotState,
  derived: AnalyzerSnapshotDerived,
  target: SnapshotTarget = {},
): DealStatePayload {
  return buildIdentityColumns(dealState, state, derived, target);
}

/**
 * Compose the payload for **Share** or **PDF** — a deal-state save PLUS the
 * frozen render artifact the public page and the PDF render from.
 *
 * `result_snapshot.input` stays a FLAT `DealInput` (not the versioned
 * envelope): it is the readonly view's primary source, and freezing the
 * shape it already expects is what keeps the artifact self-contained.
 */
export function buildPublishedArtifact(
  dealState: DealStateV2,
  state: AnalyzerSnapshotState,
  derived: AnalyzerSnapshotDerived,
  extras: AnalyzerSnapshotExtras = {},
  target: SnapshotTarget = {},
): PublishedArtifactPayload {
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
    input: dealState.input as unknown as Record<string, unknown>,
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
    ...buildIdentityColumns(dealState, state, derived, target),
    result_snapshot: result as unknown as Record<string, unknown>,
    ai_verdict: (extras.aiNarratives ?? null) as Record<string, unknown> | null,
  };
}

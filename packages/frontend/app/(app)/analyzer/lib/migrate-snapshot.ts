import type { DealInput, FinancingTerms } from "@propertyiq/analyzer-core";
import { DEAL_STATE_VERSION, type DealStateV2 } from "./deal-state-types";
import {
  DEFAULT_ASSUMPTIONS,
  type AnalyzerAssumptions,
} from "./analyzer-assumptions";

const DEFAULT_FINANCING: FinancingTerms = {
  downPaymentPct: 0.2,
  interestRatePct: 7.1,
  termYears: 30,
  closingCostsPct: 0.03,
};

function num(v: unknown, fallback: number | null = null): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))
    return Number(v);
  return fallback;
}

export function migrateSnapshot(raw: unknown): DealInput {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const fin = obj.financing as Record<string, unknown> | undefined;

  return {
    price: num(obj.price, 0) ?? 0,
    rentMonthly: num(obj.rentMonthly, null),
    taxAnnual: num(obj.taxAnnual, null),
    insuranceAnnual: num(obj.insuranceAnnual, null),
    hoaMonthly: num(obj.hoaMonthly, 0) ?? 0,
    financing: fin
      ? {
          downPaymentPct:
            num(fin.downPaymentPct, DEFAULT_FINANCING.downPaymentPct) ??
            DEFAULT_FINANCING.downPaymentPct,
          interestRatePct:
            num(fin.interestRatePct, DEFAULT_FINANCING.interestRatePct) ??
            DEFAULT_FINANCING.interestRatePct,
          termYears:
            num(fin.termYears, DEFAULT_FINANCING.termYears) ??
            DEFAULT_FINANCING.termYears,
          closingCostsPct:
            num(fin.closingCostsPct, DEFAULT_FINANCING.closingCostsPct) ??
            DEFAULT_FINANCING.closingCostsPct,
        }
      : { ...DEFAULT_FINANCING },
  };
}

interface LegacyRow {
  label?: string | null;
  address_full?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  updated_at?: string | null;
  input_snapshot?: unknown;
  result_snapshot?: unknown;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * Loosely-typed grab-bag of possible values for each `DealStateV2` field,
 * gathered from either a v1 row's `result_snapshot` (whose field names
 * happen to match) or a v2 row's own blob (already the right shape, just
 * untrusted). `unknown` because both sources come straight off the wire.
 */
interface DealStateCandidate {
  input?: unknown;
  address?: unknown;
  selectedZip?: unknown;
  label?: unknown;
  arvLocal?: unknown;
  rehabBudget?: unknown;
  propertyType?: unknown;
  unitCount?: unknown;
  assumptions?: unknown;
  analysisMode?: unknown;
  activeGoalAtSave?: unknown;
  thresholds?: unknown;
  provenance?: unknown;
  rentcastEcho?: unknown;
  piqByGeo?: unknown;
  notes?: unknown;
  shareNotes?: unknown;
  marketCapturedAt?: unknown;
}

/**
 * `unitCount` is `number | null` — null is a legitimate "not yet set" state
 * (an sfh deal has no unit count), not something to paper over. Only a
 * value that is missing or the wrong type gets the `1` default.
 */
function unitCountOrDefault(v: unknown): number | null {
  return v === null ? null : num(v, 1);
}

/**
 * `rentcastEcho` is `RentcastEcho | null` — null means "no market lookup
 * yet" and must round-trip as null, not as an object of null leaves. A
 * present-but-partial object gets its individual leaves defaulted so a
 * saved `{}` can't erase a captured city/state/zip.
 */
function defaultRentcastEcho(v: unknown): DealStateV2["rentcastEcho"] {
  if (v == null) return null;
  const echo = obj(v);
  return {
    city: typeof echo.city === "string" ? echo.city : null,
    state: typeof echo.state === "string" ? echo.state : null,
    zip: typeof echo.zip === "string" ? echo.zip : null,
    avmValue: num(echo.avmValue, null),
  };
}

/**
 * The single source of truth for "what a fully-defaulted `DealStateV2`
 * looks like." Both the v1 harvest path and the v2 self-repair path funnel
 * every field through here so a partially-populated nested object (an
 * `assumptions: {}`, a half-filled `rentcastEcho`) never shadows its own
 * defaults via a shallow spread. Never throws — every read is a `typeof`
 * check or an `obj()`/`num()`/`str()` coercion, never a direct property
 * access on a value that might not be an object.
 */
function withDealStateDefaults(candidate: DealStateCandidate): DealStateV2 {
  return {
    v: DEAL_STATE_VERSION,
    input: migrateSnapshot(candidate.input),
    address: str(candidate.address, ""),
    selectedZip:
      typeof candidate.selectedZip === "string" ? candidate.selectedZip : null,
    label: typeof candidate.label === "string" ? candidate.label : null,
    arvLocal: num(candidate.arvLocal, 0) ?? 0,
    rehabBudget: num(candidate.rehabBudget, 45_000) ?? 45_000,
    propertyType: candidate.propertyType === "mf" ? "mf" : "sfh",
    unitCount: unitCountOrDefault(candidate.unitCount),
    assumptions: {
      ...DEFAULT_ASSUMPTIONS,
      ...obj(candidate.assumptions),
    } as AnalyzerAssumptions,
    analysisMode: candidate.analysisMode === "compare" ? "compare" : "focused",
    activeGoalAtSave:
      (candidate.activeGoalAtSave as DealStateV2["activeGoalAtSave"]) ?? null,
    thresholds: candidate.thresholds as DealStateV2["thresholds"],
    provenance: obj(
      candidate.provenance,
    ) as unknown as DealStateV2["provenance"],
    rentcastEcho: defaultRentcastEcho(candidate.rentcastEcho),
    piqByGeo: (candidate.piqByGeo as DealStateV2["piqByGeo"]) ?? null,
    notes: str(candidate.notes, ""),
    shareNotes: candidate.shareNotes === true,
    marketCapturedAt: str(
      candidate.marketCapturedAt,
      new Date(0).toISOString(),
    ),
  };
}

/**
 * Upconvert a saved row to `DealStateV2`.
 *
 * v1 rows stored a bare `DealInput` in `input_snapshot` and scattered the
 * rest of the user's state through `result_snapshot`'s display extras, so
 * most of it IS recoverable — harvested into a `DealStateCandidate` and run
 * through `withDealStateDefaults()`. `analysisMode`, `activeGoalAtSave`,
 * `thresholds`, `provenance` and `piqByGeo` were never written in v1 and
 * fall back to defaults there.
 *
 * A `v: 2` row is trusted less than its version tag claims: it still runs
 * through `withDealStateDefaults()` so a forward-compat gap (`DealStateV2`
 * grows a field a saved row predates, or ships a partial `assumptions`)
 * gets repaired instead of silently handed to a consumer that assumes the
 * object is whole.
 *
 * MUST NOT throw: a corrupt row has to open as an empty analyzer, never as
 * a crash.
 */
export function migrateDealState(row: LegacyRow): DealStateV2 {
  const snap = obj(row?.input_snapshot);
  if (snap.v === DEAL_STATE_VERSION) {
    return withDealStateDefaults(snap as DealStateCandidate);
  }

  const result = obj(row?.result_snapshot);
  const zip = typeof row?.address_zip === "string" ? row.address_zip : null;

  return withDealStateDefaults({
    input: Object.keys(snap).length > 0 ? snap : result.input,
    address: row?.address_full,
    selectedZip: zip,
    label: row?.label,
    arvLocal: result.arvLocal,
    rehabBudget: result.rehabBudget,
    propertyType: result.propertyType,
    unitCount: result.unitCount,
    assumptions: result.assumptions,
    rentcastEcho: {
      city: row?.address_city,
      state: row?.address_state,
      zip,
      avmValue: null,
    },
    notes: result.notes,
    shareNotes: result.shareNotes,
    marketCapturedAt: row?.updated_at,
  });
}

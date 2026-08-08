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
 * Upconvert a saved row to `DealStateV2`.
 *
 * v1 rows stored a bare `DealInput` in `input_snapshot` and scattered the
 * rest of the user's state through `result_snapshot`'s display extras, so
 * most of it IS recoverable. `analysisMode`, `activeGoalAtSave`,
 * `thresholds`, `provenance` and `piqByGeo` were never written in v1 and
 * fall back to defaults.
 *
 * MUST NOT throw: a corrupt row has to open as an empty analyzer, never as
 * a crash.
 */
export function migrateDealState(row: LegacyRow): DealStateV2 {
  const snap = obj(row?.input_snapshot);
  if (snap.v === DEAL_STATE_VERSION) return snap as unknown as DealStateV2;

  const result = obj(row?.result_snapshot);
  const zip = typeof row?.address_zip === "string" ? row.address_zip : null;

  return {
    v: DEAL_STATE_VERSION,
    input: migrateSnapshot(Object.keys(snap).length > 0 ? snap : result.input),
    address: str(row?.address_full, ""),
    selectedZip: zip,
    label: typeof row?.label === "string" ? row.label : null,
    arvLocal: num(result.arvLocal, 0) ?? 0,
    rehabBudget: num(result.rehabBudget, 45_000) ?? 45_000,
    propertyType: result.propertyType === "mf" ? "mf" : "sfh",
    unitCount: num(result.unitCount, 1),
    assumptions: {
      ...DEFAULT_ASSUMPTIONS,
      ...obj(result.assumptions),
    } as AnalyzerAssumptions,
    analysisMode: "focused",
    activeGoalAtSave: null,
    thresholds: undefined,
    provenance: {},
    rentcastEcho: {
      city: typeof row?.address_city === "string" ? row.address_city : null,
      state: typeof row?.address_state === "string" ? row.address_state : null,
      zip,
      avmValue: null,
    },
    piqByGeo: null,
    notes: str(result.notes, ""),
    shareNotes: result.shareNotes === true,
    marketCapturedAt: str(row?.updated_at, new Date(0).toISOString()),
  };
}

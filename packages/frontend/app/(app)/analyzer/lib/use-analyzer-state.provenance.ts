/**
 * Helpers, types, and provenance logic for use-analyzer-state.ts.
 * Extracted to keep the main hook under the 300-line hard limit (CLAUDE.md §1.3).
 */
import type { AnalyzerPrefillBundle, PrefillField } from "@/lib/data";
import type { DealInput } from "@propertyiq/analyzer-core";
import type { AnalyzerAssumptions } from "./analyzer-assumptions";

/**
 * Pull the trailing 5-digit ZIP from a RentCast resolved_address or user-typed
 * address. Returns null when absent so market-context queries stay disabled.
 */
export function extractZip(resolvedAddress: string | undefined): string | null {
  if (!resolvedAddress) return null;
  const match = resolvedAddress.match(/\b(\d{5})(?:-\d{4})?\b\s*$/);
  return match ? match[1] : null;
}

export interface AnalyzerStateOptions {
  isPro: boolean;
  initialAddress?: string;
  paramAddress?: string;
  /** Explicit ZIP from `?zip=` URL param (highest priority). */
  paramZip?: string;
}

/** Provenance for one prefilled field, kept beside the plain-number input. */
export interface FieldProvenance extends PrefillField {
  /** The prefilled value we set, used to detect user overrides (>30%). */
  baseline: number | null;
}

export type ProvenanceMap = Partial<Record<string, FieldProvenance>>;

/** True when `current` diverges from `baseline` by more than 30%. */
export function isDivergent(
  baseline: number | null,
  current: number | null,
): boolean {
  if (baseline == null || baseline === 0 || current == null) return false;
  return Math.abs(current - baseline) / Math.abs(baseline) > 0.3;
}

/** Apply a prefill bundle to input + assumptions state setters, returning the new provenance map. */
export function buildProvenanceFromBundle(
  bundle: AnalyzerPrefillBundle,
  setInput: (updater: (prev: DealInput) => DealInput) => void,
  setAssumptions: (
    updater: (prev: AnalyzerAssumptions) => AnalyzerAssumptions,
  ) => void,
): ProvenanceMap {
  const f = bundle.fields;
  setInput((prev) => ({
    ...prev,
    price: f.price.value ?? prev.price,
    rentMonthly: f.rentMonthly.value ?? prev.rentMonthly,
    taxAnnual: f.taxAnnual.value ?? prev.taxAnnual,
    insuranceAnnual: f.insuranceAnnual.value ?? prev.insuranceAnnual,
    hoaMonthly: f.hoaMonthly.value ?? prev.hoaMonthly,
    vacancyPctOfRent: f.vacancyPctOfRent.value ?? prev.vacancyPctOfRent,
  }));
  setAssumptions((prev) => ({
    ...prev,
    appreciationPct:
      f.appreciationPct.value != null
        ? f.appreciationPct.value / 100
        : prev.appreciationPct,
    rentGrowthPct: f.rentGrowthPct.value ?? prev.rentGrowthPct,
  }));
  return {
    price: { ...f.price, baseline: f.price.value },
    rentMonthly: { ...f.rentMonthly, baseline: f.rentMonthly.value },
    taxAnnual: { ...f.taxAnnual, baseline: f.taxAnnual.value },
    insuranceAnnual: {
      ...f.insuranceAnnual,
      baseline: f.insuranceAnnual.value,
    },
    hoaMonthly: { ...f.hoaMonthly, baseline: f.hoaMonthly.value },
    vacancyPctOfRent: {
      ...f.vacancyPctOfRent,
      baseline: f.vacancyPctOfRent.value,
    },
    appreciationPct: {
      ...f.appreciationPct,
      baseline: f.appreciationPct.value,
    },
    rentGrowthPct: { ...f.rentGrowthPct, baseline: f.rentGrowthPct.value },
  };
}

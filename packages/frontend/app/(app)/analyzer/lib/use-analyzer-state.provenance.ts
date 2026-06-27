/**
 * Helpers, types, and provenance logic for use-analyzer-state.ts.
 * Extracted to keep the main hook under the 300-line hard limit (CLAUDE.md §1.3).
 */
import type {
  AnalyzerPrefillBundle,
  PrefillField,
  PropertyLookupResult,
} from "@/lib/data";
import type { DealInput } from "@propertyiq/analyzer-core";

/** Insurance has no RentCast source; estimate from price to match the backend
 *  prefill bundle (backend prefill-estimates.ts INSURANCE_RATE_ANNUAL). */
const INSURANCE_RATE_ANNUAL = 0.0055;

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

/**
 * Apply a prefill bundle to the DealInput state setter, returning the new
 * provenance map.
 *
 * Prefill fills PROPERTY FACTS only — price, rent, taxes, insurance, HOA,
 * vacancy. It intentionally does NOT touch Advanced Assumptions
 * (appreciation, rent-growth): those are long-run, user-controlled
 * assumptions that keep their stable defaults. The bundle's market
 * `home_value_yoy` is a single-period listing-price YoY — far too noisy
 * (often ~0 or negative) to seed a 30-year appreciation rate, and overriding
 * the default silently flattened the wealth projection.
 */
export function buildProvenanceFromBundle(
  bundle: AnalyzerPrefillBundle,
  setInput: (updater: (prev: DealInput) => DealInput) => void,
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
  };
}

/**
 * Merge a RentCast property-lookup result into the DealInput. Used by the
 * "Fetch property" button, deep-links, and page refresh — every path that
 * populates rentcastData (the autocomplete dropdown instead fills these fields
 * via buildProvenanceFromBundle). Price/rent/tax/HOA come straight from the
 * parcel; insurance is estimated from price since RentCast has no such field.
 */
export function mergeRentcastIntoInput(
  data: PropertyLookupResult,
  prev: DealInput,
): DealInput {
  const price = data.avm?.value ?? null;
  const latestTax = data.property_record?.propertyTaxes?.[0]?.total;
  return {
    ...prev,
    price: price ?? prev.price,
    rentMonthly: data.rent?.value ?? prev.rentMonthly,
    taxAnnual: latestTax ?? prev.taxAnnual,
    insuranceAnnual:
      price != null
        ? Math.round(price * INSURANCE_RATE_ANNUAL)
        : prev.insuranceAnnual,
    hoaMonthly: data.property_record?.hoaFee ?? prev.hoaMonthly,
  };
}

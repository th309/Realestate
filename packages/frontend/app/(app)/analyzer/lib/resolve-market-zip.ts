import { extractZip } from "./use-analyzer-state.provenance";

/** Every geography signal the analyzer has for the property being analyzed. */
export interface MarketZipSources {
  /** `?zip=` URL param — explicit, from a deep-link. */
  paramZip?: string;
  /** `postalCode` on the address suggestion the user picked from autocomplete. */
  selectedZip?: string | null;
  /** RentCast's canonical `resolved_address`. Pro tier only. */
  resolvedAddress?: string;
  /** Whatever is currently in the address field. */
  typedAddress?: string;
}

/**
 * Resolve the ZIP the market-context query should ask for.
 *
 * Priority, most trustworthy first:
 *   1. `?zip=` URL param — the caller stated it outright.
 *   2. The postcode Mapbox returned with the suggestion the user selected.
 *      This is structured data, so it beats parsing a display string — and it
 *      is the only signal free-tier users have, since they never get RentCast.
 *   3. A ZIP parsed out of RentCast's resolved address.
 *   4. A ZIP parsed out of the raw address field.
 *
 * Server-side, MetricResolutionService handles county/state fallback when a
 * ZIP has no metric coverage — so getting *a* ZIP here is what matters.
 */
export function resolveMarketZip({
  paramZip,
  selectedZip,
  resolvedAddress,
  typedAddress,
}: MarketZipSources): string | null {
  const isZip = (value: string | null | undefined): value is string =>
    typeof value === "string" && /^\d{5}$/.test(value);

  if (isZip(paramZip)) return paramZip;
  if (isZip(selectedZip)) return selectedZip;
  return extractZip(resolvedAddress) ?? extractZip(typedAddress);
}

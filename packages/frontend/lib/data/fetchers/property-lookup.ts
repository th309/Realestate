/**
 * PROPERTY LOOKUP FETCHER
 *
 * GET /api/analyzer/property-lookup orchestrates 3 RentCast endpoints
 * (property-record + value-estimate + rent-estimate) with monthly cap +
 * 30-day Redis cache. Pro-gated.
 *
 * Returns `{ quotaExceeded: true }` on HTTP 429 so the UI can show
 * "RentCast monthly quota reached — try again next month".
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface PropertyLookupResult {
  avm: { value: number; low: number; high: number; comps_count: number } | null;
  rent: {
    value: number;
    low: number;
    high: number;
    comps_count: number;
  } | null;
  property_record: unknown;
  sales_comps: unknown[];
  rental_comps: unknown[];
  cache_age_days: number;
  source: "rentcast";
}

export async function fetchPropertyLookup(params: {
  address: string;
}): Promise<PropertyLookupResult | { quotaExceeded: true }> {
  const url = `${API_URL}/api/analyzer/property-lookup?address=${encodeURIComponent(params.address)}`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, { credentials: "include", headers });
  if (res.status === 429) return { quotaExceeded: true };
  if (!res.ok) throw new Error(`property-lookup ${res.status}`);
  return (await res.json()) as PropertyLookupResult;
}

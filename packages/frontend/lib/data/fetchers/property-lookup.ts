/**
 * PROPERTY LOOKUP FETCHER
 *
 * GET /api/analyzer/property-lookup orchestrates 3 RentCast endpoints
 * (property-record + value-estimate + rent-estimate) with monthly cap +
 * 30-day Redis cache. Pro-gated.
 *
 * Returns `{ quotaExceeded: true }` on HTTP 429 so the UI can show
 * "RentCast monthly quota reached — try again next month".
 *
 * Type shapes mirror the backend `RentcastPropertyRecord` / `RentcastComp`
 * exactly so the analyzer can render every field RentCast returns.
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface RentcastTaxAssessment {
  year: number;
  value: number | null;
  land: number | null;
  improvements: number | null;
}

export interface RentcastPropertyTax {
  year: number;
  total: number | null;
}

export interface RentcastSaleEvent {
  date: string;
  event: string;
  price: number | null;
}

export interface RentcastPropertyRecord {
  // Identity
  id: string | null;
  formattedAddress: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  county: string | null;
  countyFips: string | null;

  // Physical
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  propertyType: string | null;

  // Location
  lat: number | null;
  lon: number | null;

  // Public records
  assessorID: string | null;
  legalDescription: string | null;
  subdivision: string | null;

  // Last sale
  lastSaleDate: string | null;
  lastSalePrice: number | null;

  // HOA
  hoaFee: number | null;

  // Features
  architectureType: string | null;
  unitCount: number | null;
  floorCount: number | null;
  garage: boolean | null;
  garageSpaces: number | null;

  // Tax history (most recent first)
  taxAssessment: number | null;
  taxAssessments: RentcastTaxAssessment[];
  propertyTaxes: RentcastPropertyTax[];

  // Sale history (most recent first)
  saleHistory: RentcastSaleEvent[];

  // Owner
  ownerNames: string[] | null;
  ownerType: string | null;
  ownerOccupied: boolean | null;
}

export interface RentcastComp {
  id: string | null;
  address: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  countyFips: string | null;
  lat: number | null;
  lon: number | null;
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  status: string | null;
  listingType: string | null;
  listedDate: string | null;
  removedDate: string | null;
  lastSeenDate: string | null;
  daysOnMarket: number | null;
  daysOld: number | null;
  price: number | null;
  rent: number | null;
  saleDate: string | null;
  distance: number;
  correlation: number;
}

export interface PropertyLookupResult {
  avm: { value: number; low: number; high: number; comps_count: number } | null;
  rent: {
    value: number;
    low: number;
    high: number;
    comps_count: number;
  } | null;
  property_record: RentcastPropertyRecord | null;
  sales_comps: RentcastComp[];
  rental_comps: RentcastComp[];
  cache_age_days: number;
  source: "rentcast";
  /** RentCast's parsed address — visible sanity check for ZIP typos. */
  resolved_address?: string;
  /** Per-endpoint error messages when a sub-call rejected (silent-null killer). */
  errors?: { property?: string; avm?: string; rent?: string };
}

/**
 * Thrown on non-429 HTTP failures, carrying the status code so the mutation
 * can retry 5xx (transient) but not 4xx (bad address, auth). Message keeps
 * the legacy `property-lookup <status>` shape callers may display.
 */
export class PropertyLookupHttpError extends Error {
  constructor(public readonly status: number) {
    super(`property-lookup ${status}`);
    this.name = "PropertyLookupHttpError";
  }
}

export async function fetchPropertyLookup(params: {
  address: string;
}): Promise<PropertyLookupResult | { quotaExceeded: true }> {
  const url = `${API_URL}/api/analyzer/property-lookup?address=${encodeURIComponent(params.address)}`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, { credentials: "include", headers });
  if (res.status === 429) return { quotaExceeded: true };
  if (!res.ok) throw new PropertyLookupHttpError(res.status);
  return (await res.json()) as PropertyLookupResult;
}

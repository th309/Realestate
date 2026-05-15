/**
 * RentCast API response types.
 *
 * These are the normalized shapes returned by `RentcastService` after
 * mapping from the raw RentCast API responses. Numeric fields default to
 * `null` when the API omits them (rather than 0) so callers can distinguish
 * "missing" from "zero".
 */

export interface RentcastPropertyRecord {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  taxAssessment: number | null;
  propertyType: string | null;
}

export interface RentcastValueEstimate {
  value: number;
  low: number;
  high: number;
  comps: RentcastComp[];
}

export interface RentcastRentEstimate {
  rent: number;
  low: number;
  high: number;
  comps: RentcastComp[];
}

export interface RentcastComp {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  /** Latitude/longitude when RentCast returned coordinates; required for map pins. */
  lat: number | null;
  lon: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  price: number | null;
  rent: number | null;
  saleDate: string | null;
  distance: number;
  correlation: number;
}

/**
 * RentCast API response types.
 *
 * These are the normalized shapes returned by `RentcastService` after
 * mapping from the raw RentCast API responses. Numeric fields default to
 * `null` when the API omits them (rather than 0) so callers can distinguish
 * "missing" from "zero".
 *
 * Field coverage mirrors what RentCast actually returns — every documented
 * field is exposed here so the frontend can display the full record without
 * a second round trip.
 */

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
  /** ISO date string from RentCast's history map. */
  date: string;
  /** e.g. "Sale". */
  event: string;
  price: number | null;
}

export interface RentcastPropertyRecord {
  // --- Identity ---
  id: string | null;
  formattedAddress: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  county: string | null;
  countyFips: string | null;

  // --- Physical ---
  /** Canonical RentCast key kept as `beds` for backwards compat with the UI. */
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  propertyType: string | null;

  // --- Location ---
  /** Latitude/longitude of the matched property — required for map pin. */
  lat: number | null;
  lon: number | null;

  // --- Public records ---
  assessorID: string | null;
  legalDescription: string | null;
  subdivision: string | null;

  // --- Last sale (denormalized for quick display) ---
  lastSaleDate: string | null;
  lastSalePrice: number | null;

  // --- HOA ---
  hoaFee: number | null;

  // --- Features ---
  architectureType: string | null;
  unitCount: number | null;
  floorCount: number | null;
  garage: boolean | null;
  garageSpaces: number | null;

  // --- Tax history (most recent first) ---
  /** Latest tax-assessment value, kept for backwards compat with the UI. */
  taxAssessment: number | null;
  taxAssessments: RentcastTaxAssessment[];
  propertyTaxes: RentcastPropertyTax[];

  // --- Sale history (most recent first) ---
  saleHistory: RentcastSaleEvent[];

  // --- Owner ---
  ownerNames: string[] | null;
  ownerType: string | null;
  ownerOccupied: boolean | null;
}

export interface RentcastValueEstimate {
  value: number;
  low: number;
  high: number;
  /** RentCast's parsed address — useful to detect ZIP typos / wrong property. */
  resolvedAddress?: string;
  comps: RentcastComp[];
}

export interface RentcastRentEstimate {
  rent: number;
  low: number;
  high: number;
  /** RentCast's parsed address — useful to detect ZIP typos / wrong property. */
  resolvedAddress?: string;
  comps: RentcastComp[];
}

export interface RentcastComp {
  // --- Identity ---
  id: string | null;
  /** Convenience field carrying `formattedAddress`. */
  address: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  countyFips: string | null;

  // --- Location ---
  /** Latitude/longitude when RentCast returned coordinates; required for map pins. */
  lat: number | null;
  lon: number | null;

  // --- Physical ---
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;

  // --- Listing lifecycle ---
  status: string | null;
  listingType: string | null;
  listedDate: string | null;
  removedDate: string | null;
  lastSeenDate: string | null;
  daysOnMarket: number | null;
  daysOld: number | null;

  // --- Price / rent ---
  /** Sale or list price for sales comps; null for rental comps. */
  price: number | null;
  /** Monthly rent for rental comps; null for sales comps. */
  rent: number | null;
  /** Best-effort sale date (RentCast doesn't expose a distinct one on comps). */
  saleDate: string | null;

  // --- Similarity ---
  distance: number;
  correlation: number;
}

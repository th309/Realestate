/**
 * GEOCODING FETCHER
 *
 * Resolves a postal address to building-level coordinates.
 *
 * Exists because the Analyzer's subject coordinates fall back to the centroid
 * of comparable sales when RentCast's property record carries none. For comps
 * spread across neighbouring towns that centroid can land kilometres from the
 * real address, which silently mislocates the subject pin and any imagery.
 */

import { fetchAPI } from "./base";

export interface GeocodeResult {
  lat: number;
  lon: number;
  /** Google's `location_type` for the match. */
  precision: string;
  formattedAddress: string;
  /** True only for ROOFTOP / RANGE_INTERPOLATED. */
  isPropertyLevel: boolean;
}

/**
 * Never rejects. A null means "no reliable position", which callers must treat
 * as a reason to hide imagery rather than to fall back to an approximate point.
 */
export async function fetchGeocodedAddress(
  address: string,
): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  try {
    return await fetchAPI<GeocodeResult | null>(
      `/api/geocoding/resolve?address=${encodeURIComponent(trimmed)}`,
    );
  } catch {
    return null;
  }
}

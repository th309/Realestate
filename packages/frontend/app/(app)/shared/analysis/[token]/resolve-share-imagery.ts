import { fetchGeocodedAddress, fetchStreetView } from "@/lib/data";

export interface ShareImagery {
  /** Signed Street View URL, or null when no panorama views this address. */
  streetUrl: string | null;
  lat: number | null;
  lon: number | null;
}

const NONE: ShareImagery = { streetUrl: null, lat: null, lon: null };

/**
 * Resolve the imagery for a shared analysis, server-side.
 *
 * Deliberately geocodes the address rather than trusting the saved row's
 * `lat`/`lon`. Rows saved before the centroid fix carry the average position
 * of their comparable sales, which for comps spread across neighbouring towns
 * sits kilometres from the property — geocoding at render time corrects those
 * retroactively instead of reprinting a wrong photo.
 *
 * The address is also what puts the camera on the street the property is
 * addressed on; selecting by coordinate returns the nearest panorama, which on
 * a corner lot photographs the side wall.
 *
 * Never throws: imagery is secondary to the analysis, so any failure degrades
 * to no photo rather than breaking a client-facing report.
 */
export async function resolveShareImagery(
  address: string | null | undefined,
): Promise<ShareImagery> {
  const trimmed = address?.trim();
  if (!trimmed) return NONE;

  const geocoded = await fetchGeocodedAddress(trimmed);
  // A street- or city-level match would mislocate the property; show nothing.
  if (!geocoded?.isPropertyLevel) return NONE;

  const streetView = await fetchStreetView(geocoded.lat, geocoded.lon, trimmed);

  return {
    streetUrl: streetView.available ? streetView.url : null,
    lat: geocoded.lat,
    lon: geocoded.lon,
  };
}

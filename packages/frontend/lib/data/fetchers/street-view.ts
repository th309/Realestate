/**
 * STREET VIEW FETCHER
 *
 * Resolves a signed Google Street View image URL for a coordinate. The Google
 * key and signing secret live on the backend; this only ever sees the signed
 * URL. Imagery is never stored — Google's policy forbids caching the bytes.
 */

import { fetchAPI } from "./base";

export interface StreetViewResolution {
  available: boolean;
  url: string | null;
  panoId: string | null;
  capturedAt: string | null;
}

const UNAVAILABLE: StreetViewResolution = {
  available: false,
  url: null,
  panoId: null,
  capturedAt: null,
};

/**
 * Never rejects. Imagery is decorative relative to the analysis, so a failure
 * degrades to "no photo" rather than surfacing an error to the user.
 */
export async function fetchStreetView(
  lat: number,
  lon: number,
): Promise<StreetViewResolution> {
  try {
    return await fetchAPI<StreetViewResolution>(
      `/api/street-view/resolve?lat=${lat}&lon=${lon}`,
    );
  } catch {
    return UNAVAILABLE;
  }
}

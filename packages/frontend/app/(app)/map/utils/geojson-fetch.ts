/**
 * GeoJSON URL resolution and fetch-with-retry logic.
 * Extracted from useMapLayers to keep the hook focused on orchestration.
 */
import type { GeoLevel } from "../types";
import { GEOJSON_SOURCES } from "../types";
import { getGeoJsonApiUrl } from "@/lib/data";

/**
 * Fetch with retry logic for large GeoJSON endpoints (county, zip).
 * These can timeout on cold cache, so retry up to maxRetries times with linear backoff.
 */
export async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      // Retry on 500 errors (cold cache timeout)
      if (response.status >= 500) {
        lastError = new Error(`Server error: ${response.status}`);
        if (attempt < maxRetries) {
          const delay = baseDelayMs * attempt; // Linear backoff: 1s, 2s, 3s
          console.warn(
            `GeoJSON fetch failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * attempt;
        console.warn(
          `GeoJSON fetch error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`,
          err,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error("Fetch failed after retries");
}

/**
 * Resolve the GeoJSON URL for a given geography level and optional state filter.
 * Returns null if the combination is unsupported.
 */
export function getGeojsonUrl(
  geoLevel: GeoLevel,
  selectedState: string,
): string | null {
  // Prefer static files (served from /public, no backend or DB hit)
  // This bypasses the DB entirely and leverages Next.js edge caching.
  if (geoLevel === "national") return "/geojson/national.json";
  if (geoLevel === "state") return "/geojson/states.json";
  if (geoLevel === "metro") return "/geojson/metros.json";
  if (geoLevel === "county" && !selectedState) return "/geojson/counties.json";

  // These layers remain on the backend API (cached 24h in-memory)
  // because generating a nationwide static file for every single zip code/city is too large.
  if (geoLevel === "county" && selectedState) {
    return getGeoJsonApiUrl(
      `${GEOJSON_SOURCES.county}/${selectedState.toUpperCase()}`,
    );
  } else if (geoLevel === "city" && selectedState) {
    return getGeoJsonApiUrl(
      `${GEOJSON_SOURCES.city}/${selectedState.toUpperCase()}`,
    );
  } else if (geoLevel === "zip" && selectedState) {
    return getGeoJsonApiUrl(
      `${GEOJSON_SOURCES.zip}/${selectedState.toUpperCase()}`,
    );
  } else if (geoLevel === "tract" && selectedState) {
    console.warn("Tract data not available");
    return null;
  }
  return null;
}

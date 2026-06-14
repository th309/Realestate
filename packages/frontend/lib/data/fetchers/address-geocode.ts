/**
 * Street-address geocoding for the Deal Analyzer's address autocomplete.
 *
 * Uses Mapbox Geocoding (types=address,postcode) — the platform already ships
 * a public Mapbox token for the map. This is the ONLY place the analyzer
 * resolves a typed address to a ZIP for free-tier geo prefill (RentCast does
 * its own geocoding for Pro parcel lookups). Markets are deliberately excluded
 * (types is address+postcode only) so the analyzer stays property-entry.
 */

export interface AddressSuggestion {
  id: string;
  label: string;
  lng: number;
  lat: number;
  zip: string | null;
}

interface MapboxFeature {
  id: string;
  place_type: string[];
  place_name: string;
  text: string;
  center: [number, number];
  context?: { id: string; text: string; short_code?: string }[];
}

/** Pure: map a Mapbox feature to our suggestion shape (unit-tested). */
export function featureToSuggestion(feature: MapboxFeature): AddressSuggestion {
  const zipFromSelf = feature.place_type.includes("postcode")
    ? feature.text
    : null;
  const zipFromContext =
    feature.context?.find((c) => c.id.startsWith("postcode"))?.text ?? null;
  const zipRaw = zipFromSelf ?? zipFromContext;
  const zip = zipRaw && /^\d{5}$/.test(zipRaw) ? zipRaw : null;
  return {
    id: feature.id,
    label: feature.place_name,
    lng: feature.center[0],
    lat: feature.center[1],
    zip,
  };
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export async function geocodeAddress(
  query: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 4 || !MAPBOX_TOKEN) return [];
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json` +
    `?access_token=${MAPBOX_TOKEN}&country=us&types=address,postcode&autocomplete=true&limit=5`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: MapboxFeature[] };
    return (data.features ?? []).map(featureToSuggestion);
  } catch {
    return [];
  }
}

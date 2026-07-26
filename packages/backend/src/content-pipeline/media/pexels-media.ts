// packages/backend/src/content-pipeline/media/pexels-media.ts
//
// Pexels photo search with Troy's subject-alignment gate: media must match the
// message. Metro posts query the ACTUAL city ("Houston skyline", never a generic
// "city skyline"), and a result is accepted ONLY if the city name appears in the
// photo's alt metadata — a wrong city's skyline is misleading content, worse than
// no photo. No confident match → null → the caller falls back to a typographic
// look. Curated (not free-form) query map so retrieval stays deterministic and
// on-message; shared with the future video-b-roll lane.

/** Curated media-search queries by content category. Data-entry seam for new
 *  categories (agent recruitment, farm-area, brokerage) — only metro skyline is
 *  live today. Free-form / LLM-generated queries are deliberately NOT used. */
export const MEDIA_QUERY_MAP = {
  metro_skyline: (city: string): string[] => [
    `${city} skyline`,
    `${city} downtown`,
    `${city} cityscape`,
  ],
  // Future (structure only; not wired):
  // agent: () => ['real estate agent showing home', 'open house', 'home sold sign'],
} as const;

export type MediaCategory = keyof typeof MEDIA_QUERY_MAP;

/** A Pexels photo that passed the alignment gate, with provenance for auditing. */
export interface PexelsPhoto {
  id: number;
  alt: string;
  photographer: string;
  photographerUrl: string;
  /** Pexels page URL (attribution link). */
  pageUrl: string;
  /** Direct large2x image URL to download. */
  downloadUrl: string;
}

type FetchFn = typeof fetch;

/**
 * Search Pexels for a skyline photo of `city` and return the first result whose
 * alt text confirms the city (the alignment gate). Tries the curated query list
 * in order. Returns null when the key is absent, the API errors, or NO result
 * confidently matches the city — never a "maybe this is <city>" image.
 */
export async function searchCitySkylinePhoto(
  city: string,
  apiKey: string | undefined,
  fetchImpl: FetchFn = fetch,
): Promise<PexelsPhoto | null> {
  const cityQuery = city.trim();
  if (!apiKey || !cityQuery) return null;
  const needle = cityQuery.toLowerCase();

  for (const query of MEDIA_QUERY_MAP.metro_skyline(cityQuery)) {
    const url =
      'https://api.pexels.com/v1/search?orientation=landscape&per_page=15&query=' +
      encodeURIComponent(query);
    let json: PexelsSearchResponse;
    try {
      const res = await fetchImpl(url, { headers: { Authorization: apiKey } });
      if (!res.ok) continue;
      json = (await res.json()) as PexelsSearchResponse;
    } catch {
      continue;
    }
    const match = (json.photos ?? []).find((p) =>
      (p.alt ?? '').toLowerCase().includes(needle),
    );
    if (match?.src?.large2x) {
      return {
        id: match.id,
        alt: match.alt ?? '',
        photographer: match.photographer ?? '',
        photographerUrl: match.photographer_url ?? '',
        pageUrl: match.url ?? '',
        downloadUrl: match.src.large2x,
      };
    }
  }
  return null;
}

interface PexelsSearchResponse {
  photos?: Array<{
    id: number;
    alt?: string;
    url?: string;
    photographer?: string;
    photographer_url?: string;
    src?: { large2x?: string };
  }>;
}

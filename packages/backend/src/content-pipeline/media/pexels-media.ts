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

import { passesCityAlignmentGate } from './city-alignment-gate';


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

/** Bound every Pexels call so a hung response can never delay/stall a render. */
const PEXELS_TIMEOUT_MS = 12_000;
async function pexelsFetch(
  url: string,
  apiKey: string,
  fetchImpl: FetchFn,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PEXELS_TIMEOUT_MS);
  try {
    return await fetchImpl(url, {
      headers: { Authorization: apiKey },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

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
  expectedState?: string | null,
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
      const res = await pexelsFetch(url, apiKey, fetchImpl);
      if (!res.ok) continue;
      json = (await res.json()) as PexelsSearchResponse;
    } catch {
      continue;
    }
    const match = (json.photos ?? []).find((p) =>
      passesCityAlignmentGate(p.alt ?? '', needle, expectedState),
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

/** A Pexels video that passed the alignment gate, with provenance. */
export interface PexelsVideo {
  id: number;
  /** Direct portrait video-file URL (~1080 wide) to download. */
  downloadUrl: string;
  pageUrl: string;
  user: string;
  durationSec: number;
}

/** Pick the portrait file nearest 1080 wide (largest <= 1080, else smallest). */
function pickVideoFile(
  files: Array<{ link?: string; width?: number; height?: number }>,
): string | null {
  const portrait = files.filter(
    (f) => f.link && (f.height ?? 0) >= (f.width ?? 0),
  );
  const pool = portrait.length ? portrait : files.filter((f) => f.link);
  if (!pool.length) return null;
  const under = pool
    .filter((f) => (f.width ?? 0) <= 1080)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  if (under[0]?.link) return under[0].link;
  const over = pool.sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return over[0]?.link ?? null;
}

/**
 * Search Pexels VIDEOS for `city` b-roll. Videos carry no alt text, so the
 * alignment gate matches the city against the url slug + tags — the only per-
 * result metadata. Returns null when the key is absent, the API errors, or NO
 * result confidently names the city (many metros have thin/wrong-city footage —
 * caller must fall back, never ship a mismatched clip).
 */
export async function searchCitySkylineVideo(
  city: string,
  apiKey: string | undefined,
  fetchImpl: FetchFn = fetch,
  expectedState?: string | null,
): Promise<PexelsVideo | null> {
  const cityQuery = city.trim();
  if (!apiKey || !cityQuery) return null;
  const needle = cityQuery.toLowerCase();

  for (const query of MEDIA_QUERY_MAP.metro_skyline(cityQuery)) {
    const url =
      'https://api.pexels.com/videos/search?orientation=portrait&per_page=15&query=' +
      encodeURIComponent(query);
    let json: PexelsVideoResponse;
    try {
      const res = await pexelsFetch(url, apiKey, fetchImpl);
      if (!res.ok) continue;
      json = (await res.json()) as PexelsVideoResponse;
    } catch {
      continue;
    }
    const match = (json.videos ?? []).find((v) => {
      const slug = (v.url ?? '').toLowerCase();
      const tags = (v.tags ?? []).map((t) => String(t).toLowerCase()).join(' ');
      return passesCityAlignmentGate(`${slug} ${tags}`, needle, expectedState);
    });
    const link = match ? pickVideoFile(match.video_files ?? []) : null;
    if (match && link) {
      return {
        id: match.id,
        downloadUrl: link,
        pageUrl: match.url ?? '',
        user: match.user?.name ?? '',
        durationSec: match.duration ?? 0,
      };
    }
  }
  return null;
}

interface PexelsVideoResponse {
  videos?: Array<{
    id: number;
    url?: string;
    duration?: number;
    tags?: string[];
    user?: { name?: string };
    video_files?: Array<{ link?: string; width?: number; height?: number }>;
  }>;
}

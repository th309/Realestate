// packages/backend/src/content-pipeline/post-images/post-image-names.ts
//
// Name + formatting helpers shared by the single-post content builder and the
// media-query builder. The load-bearing one is shortMarketName: raw CBSA titles
// ("Houston-The Woodlands-Sugar Land, TX") flow verbatim from geographies.name /
// cbsa_name / region_name into grounding.marketName and every market row, where a
// 3-line-wrapping name desyncs a row against its single-line score. This derives a
// clean "City, ST" once, and is also the SSOT the Pexels subject-alignment query
// reuses so the searched city matches the shown city.

import { formatDelta, formatScore, scoreTone } from './post-image-shared';
import { PostImageGrounding, PostImageRow } from './post-image.types';

/**
 * Short display name for a market: the first principal city of a CBSA title plus
 * its state, once. Real shapes handled (traced live from geographies.name and the
 * score rows): "City, ST", "City-City-City, ST" (principal cities joined by
 * hyphens/slashes), and the "City, ST metro area" form some score rows carry.
 *
 * Deterministic + pure; never returns empty (falls back to the input). Known
 * limitation: a genuinely hyphenated single city ("Winston-Salem") collapses to
 * its first token ("Winston") — accepted per the city-before-first-hyphen rule;
 * those are a small minority against the multi-city CBSA titles this fixes.
 */
export function shortMarketName(
  name: string | null | undefined,
  state?: string | null,
): string {
  const raw = (name ?? '').trim();
  if (!raw) return raw;
  // Drop a trailing "metro area" / "micropolitan area" suffix if present.
  const noSuffix = raw
    .replace(/\s+(metro|micro)(politan)?\s+area$/i, '')
    .trim();
  // Split a trailing ", ST" state suffix off the name (an explicit state wins).
  const m = noSuffix.match(/^(.*),\s*([A-Za-z]{2})$/);
  const cityPart = (m ? m[1] : noSuffix).trim();
  const st = (state?.trim() || (m ? m[2] : '') || '').trim();
  // CBSA titles join principal cities with hyphens or slashes; take the first.
  const city = cityPart.split(/[-–—/]/)[0].trim() || cityPart || raw;
  if (st && !new RegExp(`,\\s*${st}$`, 'i').test(city)) return `${city}, ${st}`;
  return city;
}

/**
 * Just the city (no state) for a media-search query — "Houston skyline", never
 * "Houston-The Woodlands-Sugar Land skyline". Reuses shortMarketName then strips
 * the state so the query is a bare city.
 */
export function marketCityForQuery(
  name: string | null | undefined,
  state?: string | null,
): string {
  return shortMarketName(name, state)
    .replace(/,\s*[A-Za-z]{2}$/, '')
    .trim();
}

export function titleCase(str: string): string {
  return str.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Current weekday, uppercased, for the dark Daily Card eyebrow. */
export function weekday(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toUpperCase();
}

/** The market's short "City, ST" line for eyebrows / stat context / attribution. */
export function marketLine(
  g: PostImageGrounding | undefined,
): string | undefined {
  if (!g?.marketName) return undefined;
  return shortMarketName(g.marketName, g.state);
}

/** Stable non-negative hash of a seed (post id) for deterministic variant picks. */
export function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Real grounding market → a renderable row (short name, momentum word + tone). */
export function toRow(
  m: NonNullable<PostImageGrounding['markets']>[number],
): PostImageRow {
  return {
    name: shortMarketName(m.name, m.state),
    score: formatScore(m.score),
    momentum: m.scoreLabel ? m.scoreLabel.toUpperCase() : null,
    delta: formatDelta(m.scoreDelta),
    tone: scoreTone(m.score),
  };
}

/**
 * Choose the phrase to highlight in a quote: the clause after the last comma when
 * it's a meaningful tail, else the last few words (the punchline). Deterministic,
 * never the whole line unless the quote is very short.
 */
export function pickEmphasis(text: string): string | undefined {
  const t = (text ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/["'.“”]+$/, '');
  if (!t) return undefined;
  const words = t.split(' ');
  if (words.length <= 3) return t;
  const lastComma = t.lastIndexOf(',');
  let phrase =
    lastComma >= 0 && lastComma > t.length * 0.4
      ? t.slice(lastComma + 1).trim()
      : '';
  if (!phrase || phrase.length > t.length * 0.6) {
    const n = Math.min(4, Math.max(2, Math.round(words.length * 0.35)));
    phrase = words.slice(-n).join(' ');
  }
  return phrase.replace(/[.,;:]+$/, '');
}

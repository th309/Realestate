// scripts/generate-forecast-blog-redirects.ts
/**
 * One-time supersede: maps the static 2026 forecast-intent blog posts to the
 * data-fed /forecast pages, emits a redirect JSON spliced into next.config.mjs,
 * and deletes the superseded MDX files (delete stale content, don't keep
 * drifted duplicates — see tasks/lessons.md).
 *
 * Matches: housing-market-forecast-2026 (-> /forecast) and
 * [YYYY-MM-DD-]{city[-st]}-real-estate-market-2026 (-> /forecast/<metro-slug>,
 * falling back to /forecast when no published metro matches confidently).
 * All other blog posts (best-cash-flow-*, brrrr, movers, etc.) are untouched.
 *
 * Usage: npx tsx scripts/generate-forecast-blog-redirects.ts
 */
import * as fs from "fs";
import * as path from "path";

const BLOG_DIR = path.resolve("packages/frontend/content/blog");
const OUT_FILE = path.resolve(
  "packages/frontend/lib/data/forecast-blog-redirects.json",
);

interface MetroRow {
  cbsaCode: string;
  slug: string;
  name: string; // Full: "Austin-Round Rock-San Marcos, TX"
  state: string;
}

const METRO_DATA = JSON.parse(
  fs.readFileSync(
    path.resolve("packages/frontend/lib/data/metro-slug-data.json"),
    "utf8",
  ),
) as MetroRow[];

// ---------------------------------------------------------------------------
// Alias derivation — replicated EXACTLY from
// packages/frontend/lib/data/market-slug-aliases.ts (metroAliasesFor,
// principalCityCount) and lib/data/metro-slugs.ts (generateMetroSlug), so a
// "city, ST" candidate slugifies byte-identically to the production alias key.
// That file is the authoritative source for this rule — do not drift from it.
// ---------------------------------------------------------------------------

/** Verbatim copy of generateMetroSlug from lib/data/metro-slugs.ts. */
function generateMetroSlug(metroName: string): string {
  return metroName
    .toLowerCase()
    .replace(/[,.'()/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Verbatim copy of principalCityCount from lib/data/market-slug-aliases.ts. */
function principalCityCount(entry: MetroRow): number {
  const comma = entry.name.indexOf(",");
  const cityPart = comma === -1 ? entry.name : entry.name.slice(0, comma);
  return cityPart.split("-").length;
}

/** Verbatim copy of metroAliasesFor from lib/data/market-slug-aliases.ts. */
function metroAliasesFor(entry: MetroRow): string[] {
  const comma = entry.name.indexOf(",");
  const cityPart = comma === -1 ? entry.name : entry.name.slice(0, comma);
  const statePart =
    comma === -1 ? entry.state : entry.name.slice(comma + 1).trim();

  const firstCity = cityPart.split("-")[0].trim();
  const stateCodes = statePart
    .split("-")
    .map((s) => s.trim())
    .filter(Boolean);

  return stateCodes.map((stateCode) =>
    generateMetroSlug(`${firstCity}, ${stateCode}`),
  );
}

const SLUG_SET = new Set(METRO_DATA.map((m) => m.slug));

/**
 * Production-equivalent alias map: "firstcity-state" -> canonical slug,
 * excluding aliases that equal their own canonical slug (single-city metros),
 * exactly mirroring METRO_SLUG_ALIASES in market-slug-aliases.ts.
 */
const ALIASES = new Map<string, string>();
for (const metro of METRO_DATA) {
  for (const alias of metroAliasesFor(metro)) {
    if (SLUG_SET.has(alias)) continue;
    if (!ALIASES.has(alias)) ALIASES.set(alias, metro.slug);
  }
}

/**
 * Broader match index used ONLY for resolving blog-slug candidates (not the
 * production routing alias map). Unlike ALIASES, this does NOT skip aliases
 * that equal their own canonical slug — that skip exists in production only
 * to avoid a redundant self-redirect route, which is irrelevant here and
 * would otherwise blind us to single-city metros ("tulsa-ok",
 * "pittsburgh-pa", "colorado-springs-co"). Same derivation, same prominence
 * tie-break (principalCityCount — more principal cities named = a larger,
 * more prominent CBSA, e.g. "Austin-Round Rock-San Marcos, TX" beats the
 * unrelated "Austin, MN"). A same-score collision (Cleveland, OH/MS/TN — all
 * single-city, all score 1) is left genuinely ambiguous rather than guessed.
 */
type IndexEntry = { slug: string; score: number } | null;
const CANDIDATE_INDEX = new Map<string, IndexEntry>();
for (const metro of METRO_DATA) {
  const score = principalCityCount(metro);
  for (const alias of metroAliasesFor(metro)) {
    const existing = CANDIDATE_INDEX.get(alias);
    if (existing === undefined) {
      CANDIDATE_INDEX.set(alias, { slug: metro.slug, score });
    } else if (existing === null || existing.slug === metro.slug) {
      // already ambiguous, or the same metro's other state alias — no-op
    } else if (score > existing.score) {
      CANDIDATE_INDEX.set(alias, { slug: metro.slug, score });
    } else if (score === existing.score) {
      CANDIDATE_INDEX.set(alias, null); // true tie -> ambiguous, don't guess
    }
  }
}

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "al",
  alaska: "ak",
  arizona: "az",
  arkansas: "ar",
  california: "ca",
  colorado: "co",
  connecticut: "ct",
  delaware: "de",
  florida: "fl",
  georgia: "ga",
  hawaii: "hi",
  idaho: "id",
  illinois: "il",
  indiana: "in",
  iowa: "ia",
  kansas: "ks",
  kentucky: "ky",
  louisiana: "la",
  maine: "me",
  maryland: "md",
  massachusetts: "ma",
  michigan: "mi",
  minnesota: "mn",
  mississippi: "ms",
  missouri: "mo",
  montana: "mt",
  nebraska: "ne",
  nevada: "nv",
  "new-hampshire": "nh",
  "new-jersey": "nj",
  "new-mexico": "nm",
  "new-york": "ny",
  "north-carolina": "nc",
  "north-dakota": "nd",
  ohio: "oh",
  oklahoma: "ok",
  oregon: "or",
  pennsylvania: "pa",
  "rhode-island": "ri",
  "south-carolina": "sc",
  "south-dakota": "sd",
  tennessee: "tn",
  texas: "tx",
  utah: "ut",
  vermont: "vt",
  virginia: "va",
  washington: "wa",
  "west-virginia": "wv",
  wisconsin: "wi",
  wyoming: "wy",
};

/** Rewrite a trailing full state name ("...-ohio", "...-west-virginia") to its abbreviation. */
function normalizeStateSuffix(candidate: string): string | null {
  const parts = candidate.split("-");
  for (const wordCount of [2, 1]) {
    if (parts.length <= wordCount) continue;
    const tail = parts.slice(-wordCount).join("-");
    const abbr = STATE_NAME_TO_ABBR[tail];
    if (abbr) return `${parts.slice(0, -wordCount).join("-")}-${abbr}`;
  }
  return null;
}

/**
 * Resolve a blog slug's "city[-st]" candidate to a canonical metro slug, or
 * null if no confident match exists. Order: exact canonical slug, exact
 * production alias, exact single-city candidate-index entry, then (candidate
 * has no state suffix) a prominence-resolved prefix match across the
 * candidate index, then two normalization retries (spelled-out state name;
 * trailing "-city", e.g. "new-york-city").
 */
function resolveMetroSlug(candidate: string): string | null {
  if (SLUG_SET.has(candidate)) return candidate;
  if (ALIASES.has(candidate)) return ALIASES.get(candidate)!;
  const exact = CANDIDATE_INDEX.get(candidate);
  if (exact) return exact.slug;

  let best: { slug: string; score: number } | null = null;
  let bestCount = 0;
  const seenSlugs = new Set<string>();
  for (const [key, entry] of CANDIDATE_INDEX) {
    if (key.replace(/-[a-z]{2}$/, "") !== candidate) continue;
    if (entry === null) {
      bestCount = Math.max(bestCount, 2);
      continue;
    }
    if (seenSlugs.has(entry.slug)) continue;
    seenSlugs.add(entry.slug);
    if (best === null || entry.score > best.score) {
      best = entry;
      bestCount = 1;
    } else if (entry.score === best.score) {
      bestCount++;
    }
  }
  if (best !== null && bestCount === 1) return best.slug;
  if (best !== null) return null; // genuine tie (e.g. Jacksonville FL/IL/NC/TX)

  const stateNormalized = normalizeStateSuffix(candidate);
  if (stateNormalized && stateNormalized !== candidate) {
    const resolved = resolveMetroSlug(stateNormalized);
    if (resolved) return resolved;
  }
  const cityStripped = candidate.replace(/-city$/, "");
  if (cityStripped !== candidate) {
    const resolved = resolveMetroSlug(cityStripped);
    if (resolved) return resolved;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Generate redirects
// ---------------------------------------------------------------------------

const NATIONAL_POST = /^(?:\d{4}-\d{2}-\d{2}-)?housing-market-forecast-2026$/;
const CITY_POST = /^(?:\d{4}-\d{2}-\d{2}-)?(.+)-real-estate-market-2026$/;

interface Redirect {
  source: string;
  destination: string;
  permanent: boolean;
}
const redirects: Redirect[] = [];
const toDelete: string[] = [];

for (const file of fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"))) {
  const slug = file.replace(/\.mdx$/, "");

  if (NATIONAL_POST.test(slug)) {
    redirects.push({
      source: `/blog/${slug}`,
      destination: "/forecast",
      permanent: true,
    });
    toDelete.push(file);
    continue;
  }

  const m = CITY_POST.exec(slug);
  if (!m) continue;
  const metroSlug = resolveMetroSlug(m[1]);
  const destination = metroSlug ? `/forecast/${metroSlug}` : "/forecast";
  redirects.push({ source: `/blog/${slug}`, destination, permanent: true });
  toDelete.push(file);
}

fs.writeFileSync(OUT_FILE, JSON.stringify(redirects, null, 2) + "\n");
console.log(`wrote ${redirects.length} redirects to ${OUT_FILE}`);
const matched = redirects.filter((r) => r.destination !== "/forecast").length;
console.log(
  `metro-matched: ${matched}; fell back to /forecast: ${redirects.length - matched}`,
);
for (const f of toDelete) fs.unlinkSync(path.join(BLOG_DIR, f));
console.log(`deleted ${toDelete.length} superseded MDX posts`);

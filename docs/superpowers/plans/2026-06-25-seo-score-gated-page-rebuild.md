# SEO Score-Gated Page Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the metro/county/zip SEO pages exist only for geos that currently carry a PropertyIQ score, regenerate that page set automatically every month after the scoring run, and gracefully redirect (not 404-flap) geos that temporarily drop out of scoring.

**Architecture:** Page existence is gated at its single source of truth — the committed slug-data JSON files. A monthly job (chained off the existing post-import scoring workflow) regenerates those JSONs from the **published set** (geos scored in the trailing `PUBLISH_WINDOW_MONTHS` monthly runs), failing _closed_ (keeps the prior JSON on any fetch error so an outage can never empty the site). Because the JSON is now exactly the publishable set, the runtime per-page score checks (`isLocationIndexable` noindex branch, sitemap re-filter) become redundant and are removed — slug data alone decides existence, indexability, and sitemap inclusion. Geos that fall out of the publish window but were scored within `REDIRECT_LOOKBACK_MONTHS` get a temporary redirect to their nearest still-published ancestor; geos with no recent score simply 404.

**Tech Stack:** Next.js 16 App Router (ISR), TypeScript, Node `tsx` build scripts, NestJS backend (`/api/scores/ids/:geography`, `/api/markets/*`), GitHub Actions (monthly cron), Jest for unit tests.

## Global Constraints

- **Publish window:** `PUBLISH_WINDOW_MONTHS = 2`. A geo is published iff it has a score in the latest 2 distinct monthly `score_date`s.
- **Redirect lookback:** `REDIRECT_LOOKBACK_MONTHS = 6`. A geo scored within the last 6 runs but not in the publish window redirects to its nearest published ancestor; older than that → 404.
- **Redirect type:** Next.js `permanent: false` (HTTP 307, temporary) — these geos commonly re-score, so the redirect must be reversible and must not be hard-cached.
- **Fail closed (build/regen only):** if the scored-set fetch returns empty or throws during regeneration, abort and leave the existing JSON untouched. NEVER write an empty file and NEVER fall back to the full (ungated) geo universe.
- **Fail open (request time):** the runtime gate is `notFound()` driven purely by committed slug data; there is no live scored-set fetch on the request path after this change (so a backend outage cannot mass-404 live pages).
- **Score source of truth:** read scored IDs only from `GET /api/scores/ids/:geography?score_type=propertyiq&date=YYYY-MM-DD` (CLAUDE.md §5.1 — never query score tables ad hoc).
- **Slug-data SSOT:** `packages/frontend/lib/data/{metro,county,zip}-slug-data.json` are the ONLY source of which pages exist. Do not hand-edit; only the generators write them.
- **Score-type:** `propertyiq` only. No legacy score types.
- **Branch:** work on `develop`. Never hand-merge to `main` (CLAUDE.md §2.6 — use `npm run release:main`). Do not push without explicit user ask.
- **Naming:** descriptive names only (CLAUDE.md §1.4). File-size limits per CLAUDE.md §1.3.

---

## File Structure

**New**

- `scripts/lib/published-set.ts` — pure helpers: pick recent `score_date`s, compute the published ID set, compute the redirect set, resolve nearest published ancestor. (No I/O — unit-testable.)
- `scripts/lib/published-set.test.ts` — unit tests for the above.
- `scripts/lib/scored-set-client.ts` — thin I/O wrapper: fetch recent periods + scored IDs per period from the backend; throws on empty (fail-closed signal).
- `scripts/generate-zip-slugs.ts` — **re-create** the missing ZIP generator, score-gated.
- `packages/frontend/lib/data/descored-redirects.json` — generated map of de-scored geo paths → ancestor paths (committed).
- `packages/frontend/lib/data/descored-redirects.ts` — typed loader exporting the array for `next.config.mjs`.
- `packages/backend/src/scoring/dto/score-periods.response.ts` — (only if a typed response object is wanted; inline type is acceptable).

**Modified**

- `scripts/generate-metro-slugs.ts` — gate output on the published set; fail closed.
- `scripts/generate-county-slugs.ts` — gate output on the published set; fail closed.
- `packages/backend/src/scoring/scoring.controller.ts` — add `GET ids/:geography/periods` (recent distinct `score_date`s).
- `packages/backend/src/scoring/scoring.service.ts` — add `getScorePeriods(geoLevel, scoreType, limit)`.
- `packages/frontend/app/(public)/markets/[slug]/page.tsx` — drop the noindex branch + `isLocationIndexable` import.
- `packages/frontend/app/(public)/markets/county/[slug]/page.tsx` — same.
- `packages/frontend/app/(public)/markets/zip/[slug]/page.tsx` — same.
- `packages/frontend/lib/seo/sitemap-builder.ts` — stop re-filtering (slug data is already gated); keep using the endpoint only for honest `lastmod`.
- `packages/frontend/next.config.mjs` — spread `descored-redirects` into `redirects()`.
- `package.json` (root) — add `seo:rebuild-slugs` + per-geo scripts.
- `.github/workflows/post-import-refresh.yml` — add a "Rebuild SEO slug data" step after scoring, commit artifacts (fail-closed), trigger redeploy.

**Deleted**

- `packages/frontend/lib/seo/scored-locations.ts` — redundant after gating (verify no other importers first).

---

## Task 0: Confirm two deployment facts (no code)

These two unknowns change later tasks; resolve them first and record the answers at the top of the plan file as you go.

- [ ] **Step 1: Confirm the frontend production deploy branch.**

Run:

```bash
git remote -v
git log --oneline -5 origin/main
git log --oneline -5 origin/develop
```

Then check the Railway frontend service's deploy branch (Railway dashboard → frontend service → Settings → Source, or `railway` CLI). Record: **does the production frontend deploy from `main` or `develop`?** This determines the commit target + promotion step in Task 11.

- [ ] **Step 2: Confirm the `/markets/state/[state]` slug format** (needed for the rare state-fallback redirect).

Run:

```bash
sed -n '1,40p' "packages/frontend/app/(public)/markets/state/[state]/page.tsx"
```

Record how `state` slugs are formed (full lowercased name, e.g. `texas`, vs abbreviation). Used in Task 9's ancestor resolver.

- [ ] **Step 3: Confirm score-date uniformity across geo levels.**

The churn analysis already showed metro/county/zip all share `score_date = 2026-05-31` and `2026-04-30`. Re-confirm before relying on a single period list:

```bash
# via Supabase MCP or psql
# select geography, max(score_date), count(distinct score_date) from propertyiq_scores_v2 where score_type='propertyiq' group by geography;
```

Expected: all three levels share the same latest two `score_date`s. (The code fetches periods per-geography regardless, so this is a sanity check, not a dependency.)

---

## Task 1: Backend — recent score periods endpoint

Gives the rebuild script the list of recent `score_date`s per geography so it can request each period's scored IDs.

**Files:**

- Modify: `packages/backend/src/scoring/scoring.service.ts`
- Modify: `packages/backend/src/scoring/scoring.controller.ts:649-690` (add a sibling route)
- Test: `packages/backend/src/scoring/scoring.controller.spec.ts` (or the existing scoring spec file)

**Interfaces:**

- Produces: `GET /api/scores/ids/:geography/periods?score_type=propertyiq&limit=6` → `{ geography: string; score_type: string; periods: string[] }` where `periods` is distinct `score_date`s (ISO `YYYY-MM-DD`) newest-first, length ≤ `limit`.

- [ ] **Step 1: Write the failing service test.**

In the scoring service spec, add:

```typescript
it("getScorePeriods returns distinct score_dates newest-first, capped at limit", async () => {
  // Arrange: mock supabase to return rows with score_dates incl. duplicates
  const rows = [
    { score_date: "2026-05-31" },
    { score_date: "2026-05-31" },
    { score_date: "2026-04-30" },
    { score_date: "2026-03-31" },
  ];
  jest.spyOn(service as any, "queryScorePeriodRows").mockResolvedValue(rows);

  const out = await service.getScorePeriods("zip", "propertyiq", 2);

  expect(out).toEqual(["2026-05-31", "2026-04-30"]);
});
```

- [ ] **Step 2: Run it to confirm failure.**

Run: `npm run test -w backend -- --t "getScorePeriods"`
Expected: FAIL — `service.getScorePeriods is not a function`.

- [ ] **Step 3: Implement `getScorePeriods` in the service.**

Add to `ScoringService` (follow the existing `getScoredLocationIds` query style — same table/view, `score_type` filter, `geography` map):

```typescript
/**
 * Distinct score_dates for a geography, newest-first, capped at `limit`.
 * Used by the monthly SEO slug rebuild to enumerate the publish/redirect windows.
 */
async getScorePeriods(
  geoLevel: 'metro' | 'county' | 'zip',
  scoreType: string,
  limit: number,
): Promise<string[]> {
  const { data, error } = await this.supabase
    .from('propertyiq_scores')
    .select('score_date')
    .eq('geography', geoLevel)
    .eq('score_type', scoreType)
    .order('score_date', { ascending: false })
    .limit(5000); // bounded; distinct is applied in-memory below
  if (error) throw error;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data ?? []) {
    const d = row.score_date as string;
    if (!seen.has(d)) { seen.add(d); out.push(d); }
    if (out.length >= limit) break;
  }
  return out;
}
```

(If the service already has a private supabase query helper, route through it for the test's mock seam `queryScorePeriodRows`; otherwise adapt the test's spy target to the actual seam.)

- [ ] **Step 4: Run the service test — expect PASS.**

Run: `npm run test -w backend -- --t "getScorePeriods"`
Expected: PASS.

- [ ] **Step 5: Add the controller route** next to `getScoredIds` (after line 690):

```typescript
@Get('ids/:geography/periods')
@Header('Cache-Control', 'public, max-age=21600')
@ApiOperation({ summary: 'List recent distinct score_dates for a geography' })
@ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
@ApiQuery({ name: 'score_type', required: false, description: 'propertyiq (default)' })
@ApiQuery({ name: 'limit', required: false, description: 'Max periods (default 6)' })
async getScorePeriods(
  @Param('geography') geography: string,
  @Query('score_type') scoreType = 'propertyiq',
  @Query('limit') limit = '6',
): Promise<{ geography: string; score_type: string; periods: string[] }> {
  const geoLevel = this.normalizeGeography(geography); // reuse the same guard getScoredIds uses
  const periods = await this.scoringService.getScorePeriods(
    geoLevel,
    scoreType,
    Math.min(Math.max(parseInt(limit, 10) || 6, 1), 24),
  );
  return { geography: geoLevel, score_type: scoreType, periods };
}
```

(Use the exact geography-validation helper `getScoredIds` already uses; mirror its error handling.)

- [ ] **Step 6: Build the backend to verify no type errors.**

Run: `npm run build -w backend`
Expected: exits 0 (fix ALL errors if any — lessons.md rule).

- [ ] **Step 7: Commit.**

```bash
git add packages/backend/src/scoring/scoring.controller.ts packages/backend/src/scoring/scoring.service.ts packages/backend/src/scoring/scoring.controller.spec.ts
git commit -m "feat(scoring): add recent score-periods endpoint for SEO slug rebuild"
```

---

## Task 2: Pure published-set helpers

The window math, with zero I/O, so it is fully unit-testable.

**Files:**

- Create: `scripts/lib/published-set.ts`
- Test: `scripts/lib/published-set.test.ts`

**Interfaces:**

- Produces:
  - `pickWindows(periods: string[]): { publish: string[]; lookback: string[] }`
  - `computePublishedIds(scoredByPeriod: Map<string, Set<string>>, publishPeriods: string[]): Set<string>`
  - `computeRedirectIds(scoredByPeriod: Map<string, Set<string>>, publishPeriods: string[], lookbackPeriods: string[]): Set<string>`
  - `assertNonEmpty(label: string, ids: Set<string>): void` (throws → fail-closed)
  - constants `PUBLISH_WINDOW_MONTHS = 2`, `REDIRECT_LOOKBACK_MONTHS = 6`

- [ ] **Step 1: Write failing tests.**

```typescript
import {
  pickWindows,
  computePublishedIds,
  computeRedirectIds,
  assertNonEmpty,
  PUBLISH_WINDOW_MONTHS,
  REDIRECT_LOOKBACK_MONTHS,
} from "./published-set";

describe("pickWindows", () => {
  it("splits newest-first periods into publish (2) and lookback (6)", () => {
    const periods = [
      "2026-05",
      "2026-04",
      "2026-03",
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
    ];
    const { publish, lookback } = pickWindows(periods);
    expect(publish).toEqual(["2026-05", "2026-04"]);
    expect(lookback).toEqual([
      "2026-05",
      "2026-04",
      "2026-03",
      "2026-02",
      "2026-01",
      "2025-12",
    ]);
  });
});

describe("computePublishedIds", () => {
  it("unions scored IDs across the publish window (grace = scored in either month)", () => {
    const byPeriod = new Map([
      ["2026-05", new Set(["a", "b"])],
      ["2026-04", new Set(["b", "c"])], // c is in grace (not in latest)
    ]);
    const out = computePublishedIds(byPeriod, ["2026-05", "2026-04"]);
    expect([...out].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("computeRedirectIds", () => {
  it("is lookback-union minus published", () => {
    const byPeriod = new Map([
      ["2026-05", new Set(["a"])],
      ["2026-04", new Set(["a"])],
      ["2026-03", new Set(["d"])], // aged out of publish window → redirect
      ["2026-02", new Set(["a", "e"])], // e aged out → redirect
    ]);
    const publish = ["2026-05", "2026-04"];
    const lookback = ["2026-05", "2026-04", "2026-03", "2026-02"];
    const out = computeRedirectIds(byPeriod, publish, lookback);
    expect([...out].sort()).toEqual(["d", "e"]);
  });
});

describe("assertNonEmpty", () => {
  it("throws on empty set (fail-closed)", () => {
    expect(() => assertNonEmpty("zip", new Set())).toThrow(/fail-closed/i);
  });
  it("does not throw on a populated set", () => {
    expect(() => assertNonEmpty("zip", new Set(["a"]))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing).

Run: `npx jest scripts/lib/published-set.test.ts`
Expected: FAIL — cannot find module `./published-set`.

- [ ] **Step 3: Implement the helpers.**

```typescript
// scripts/lib/published-set.ts
// Pure window math for score-gated SEO page generation. No I/O.

export const PUBLISH_WINDOW_MONTHS = 2;
export const REDIRECT_LOOKBACK_MONTHS = 6;

/** Split newest-first periods into the publish window and the (larger) redirect lookback. */
export function pickWindows(periods: string[]): {
  publish: string[];
  lookback: string[];
} {
  return {
    publish: periods.slice(0, PUBLISH_WINDOW_MONTHS),
    lookback: periods.slice(0, REDIRECT_LOOKBACK_MONTHS),
  };
}

function unionOver(
  byPeriod: Map<string, Set<string>>,
  periods: string[],
): Set<string> {
  const out = new Set<string>();
  for (const p of periods) for (const id of byPeriod.get(p) ?? []) out.add(id);
  return out;
}

/** A geo is published if scored in ANY publish-window month (grace within the window). */
export function computePublishedIds(
  byPeriod: Map<string, Set<string>>,
  publishPeriods: string[],
): Set<string> {
  return unionOver(byPeriod, publishPeriods);
}

/** Redirect candidates = scored within lookback but not currently published. */
export function computeRedirectIds(
  byPeriod: Map<string, Set<string>>,
  publishPeriods: string[],
  lookbackPeriods: string[],
): Set<string> {
  const published = computePublishedIds(byPeriod, publishPeriods);
  const recent = unionOver(byPeriod, lookbackPeriods);
  const out = new Set<string>();
  for (const id of recent) if (!published.has(id)) out.add(id);
  return out;
}

/** Fail-closed guard: a never-empty publish set is required to overwrite a slug JSON. */
export function assertNonEmpty(label: string, ids: Set<string>): void {
  if (ids.size === 0) {
    throw new Error(
      `fail-closed: refusing to regenerate ${label} slug data from an empty published set`,
    );
  }
}
```

- [ ] **Step 4: Run — expect PASS.**

Run: `npx jest scripts/lib/published-set.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit.**

```bash
git add scripts/lib/published-set.ts scripts/lib/published-set.test.ts
git commit -m "feat(seo): pure published-set window helpers for score-gated slugs"
```

---

## Task 3: Scored-set client (I/O wrapper, fail-closed)

Fetches recent periods + per-period scored IDs from the backend. Throws on empty so the generator aborts before touching any JSON.

**Files:**

- Create: `scripts/lib/scored-set-client.ts`

**Interfaces:**

- Consumes: backend `GET /api/scores/ids/:geography/periods` (Task 1) and `GET /api/scores/ids/:geography?date=` (existing, `scoring.controller.ts:649`).
- Produces:
  - `fetchScoredByPeriod(apiBase: string, geo: 'metro'|'county'|'zip'): Promise<{ periods: string[]; scoredByPeriod: Map<string, Set<string>> }>`
  - throws if the periods list is empty OR the latest period's ID set is empty (fail-closed).

- [ ] **Step 1: Implement.**

```typescript
// scripts/lib/scored-set-client.ts
import { REDIRECT_LOOKBACK_MONTHS } from "./published-set";

type Geo = "metro" | "county" | "zip";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function fetchScoredByPeriod(
  apiBase: string,
  geo: Geo,
): Promise<{ periods: string[]; scoredByPeriod: Map<string, Set<string>> }> {
  const { periods } = await getJson<{ periods: string[] }>(
    `${apiBase}/api/scores/ids/${geo}/periods?score_type=propertyiq&limit=${REDIRECT_LOOKBACK_MONTHS}`,
  );
  if (!periods.length)
    throw new Error(`fail-closed: no score periods returned for ${geo}`);

  const scoredByPeriod = new Map<string, Set<string>>();
  for (const date of periods) {
    const { ids } = await getJson<{ ids: string[] }>(
      `${apiBase}/api/scores/ids/${geo}?score_type=propertyiq&date=${date}`,
    );
    scoredByPeriod.set(date, new Set(ids));
  }
  const latest = scoredByPeriod.get(periods[0]);
  if (!latest || latest.size === 0) {
    throw new Error(
      `fail-closed: latest period ${periods[0]} had no scored ${geo} ids`,
    );
  }
  return { periods, scoredByPeriod };
}
```

- [ ] **Step 2: Type-check.**

Run: `npx tsc --noEmit scripts/lib/scored-set-client.ts` (or `npx tsx --check`)
Expected: no errors. (If `tsc` complains about config, rely on the generator's runtime smoke test in Task 6.)

- [ ] **Step 3: Commit.**

```bash
git add scripts/lib/scored-set-client.ts
git commit -m "feat(seo): fail-closed scored-set client for slug generators"
```

---

## Task 4: Gate the metro slug generator

**Files:**

- Modify: `scripts/generate-metro-slugs.ts` (currently fetches `/api/markets/metros` and writes all metros)

**Interfaces:**

- Consumes: `fetchScoredByPeriod` (Task 3), `pickWindows`/`computePublishedIds`/`assertNonEmpty` (Task 2).
- Produces: `metro-slug-data.json` containing only published metros (entry shape unchanged: `{ cbsaCode, slug, name, shortName, state }`).

- [ ] **Step 1: Add the gate** between fetching metros (line 55) and mapping entries (line 58). Insert:

```typescript
import {
  pickWindows,
  computePublishedIds,
  assertNonEmpty,
} from "./lib/published-set";
import { fetchScoredByPeriod } from "./lib/scored-set-client";
// ...
const API_BASE = process.env.API_URL || "http://localhost:3001";
const { periods, scoredByPeriod } = await fetchScoredByPeriod(
  API_BASE,
  "metro",
);
const { publish } = pickWindows(periods);
const publishedCbsa = computePublishedIds(scoredByPeriod, publish);
assertNonEmpty("metro", publishedCbsa); // fail-closed before any write
```

- [ ] **Step 2: Filter the entries** — change the `entries` construction (line 58) to gate on `publishedCbsa`:

```typescript
const entries = metros
  .map((m) => ({
    cbsaCode: String(m.regionId),
    slug: generateSlug(m.name),
    name: m.name,
    shortName: getShortName(m.name),
    state: getState(m.name),
  }))
  .filter((e) => publishedCbsa.has(e.cbsaCode));

console.log(
  `Published metros: ${entries.length} / ${metros.length} tracked (window: ${publish.join(", ")})`,
);
```

- [ ] **Step 3: Guard the write** — before `fs.writeFileSync` (line 111-equivalent), assert again so a filter bug can't empty the file:

```typescript
if (entries.length === 0) {
  throw new Error(
    "fail-closed: 0 published metro entries after filtering — not overwriting JSON",
  );
}
```

- [ ] **Step 4: Smoke-test against a running backend** (local or prod URL):

```bash
API_URL=https://backend-production-ee4d.up.railway.app npx tsx scripts/generate-metro-slugs.ts
```

Expected: logs `Published metros: 935 / 928 tracked` (≈935 — see note) and writes the JSON. Verify count:

```bash
node -e "console.log(require('./packages/frontend/lib/data/metro-slug-data.json').length)"
```

Expected: ~935. (Note: scored metros can slightly exceed the `geographies` dim count — that's the known 7-orphan dimension gap, not an error.)

- [ ] **Step 5: Commit** (script only; JSON regen is committed by the monthly job, but commit the first gated snapshot here too):

```bash
git add scripts/generate-metro-slugs.ts packages/frontend/lib/data/metro-slug-data.json
git commit -m "feat(seo): score-gate the metro slug generator (published-window only)"
```

---

## Task 5: Gate the county slug generator

**Files:**

- Modify: `scripts/generate-county-slugs.ts` (fetches `/api/markets/counties` + crosswalk; writes all counties)

**Interfaces:**

- Consumes: same helpers as Task 4. Gate key = county `fips`.
- Produces: `county-slug-data.json` with only published counties (shape unchanged: `{ fips, slug, name, shortName, state, cbsaCode }`).

- [ ] **Step 1: Add the gate** after fetching counties (line 46) and before mapping (line 74):

```typescript
import {
  pickWindows,
  computePublishedIds,
  assertNonEmpty,
} from "./lib/published-set";
import { fetchScoredByPeriod } from "./lib/scored-set-client";
// ...
const API_BASE = process.env.API_URL || "http://localhost:3001";
const { periods, scoredByPeriod } = await fetchScoredByPeriod(
  API_BASE,
  "county",
);
const { publish } = pickWindows(periods);
const publishedFips = computePublishedIds(scoredByPeriod, publish);
assertNonEmpty("county", publishedFips);
```

- [ ] **Step 2: Filter entries** — append a filter to the `entries` map (line 74-81):

```typescript
const entries = counties
  .map((c) => ({
    fips: c.fips,
    slug: generateSlug(c.name, c.state),
    name: `${c.name} County`,
    shortName: `${c.name} County, ${c.state}`,
    state: c.state,
    cbsaCode: crosswalkMap.get(c.fips) || null,
  }))
  .filter((e) => publishedFips.has(e.fips));

console.log(
  `Published counties: ${entries.length} / ${counties.length} tracked (window: ${publish.join(", ")})`,
);
if (entries.length === 0) {
  throw new Error(
    "fail-closed: 0 published county entries after filtering — not overwriting JSON",
  );
}
```

- [ ] **Step 3: Smoke-test:**

```bash
API_URL=https://backend-production-ee4d.up.railway.app npx tsx scripts/generate-county-slugs.ts
node -e "console.log(require('./packages/frontend/lib/data/county-slug-data.json').length)"
```

Expected: ~3,137.

- [ ] **Step 4: Commit.**

```bash
git add scripts/generate-county-slugs.ts packages/frontend/lib/data/county-slug-data.json
git commit -m "feat(seo): score-gate the county slug generator"
```

---

## Task 6: Create the gated ZIP slug generator (was missing)

**Files:**

- Create: `scripts/generate-zip-slugs.ts`
- Reference (do not modify): `packages/frontend/lib/data/zip-slugs.ts` (exports `generateZipSlug()` + `ZipSlugEntry`), backend `/api/markets/zips`.

**Interfaces:**

- Consumes: `/api/markets/zips` (all-zip metadata), `fetchScoredByPeriod` + helpers, `generateZipSlug`.
- Produces: `zip-slug-data.json` with only published ZIPs (shape `{ zip, slug, name, shortName, state, countyFips, cbsaCode }`).

- [ ] **Step 1: Inspect the zips endpoint payload shape** so field mapping is exact:

```bash
curl -s "https://backend-production-ee4d.up.railway.app/api/markets/zips" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);console.log(a.length); console.log(JSON.stringify(a[0],null,2));})"
```

Record the exact field names (`zip`/`region_name`/`state`/`county_fips`/`cbsa_code` etc.) and adjust the mapping in Step 2 to match.

- [ ] **Step 2: Write the generator** (mirror the metro/county generators' structure; adjust field names to Step 1's output):

```typescript
// Run with: API_URL=<backend> npx tsx scripts/generate-zip-slugs.ts
// Fetches all ZIPs from /api/markets/zips, keeps only ZIPs scored in the publish
// window, and writes packages/frontend/lib/data/zip-slug-data.json.
import { generateZipSlug } from "../packages/frontend/lib/data/zip-slugs";
import {
  pickWindows,
  computePublishedIds,
  assertNonEmpty,
} from "./lib/published-set";
import { fetchScoredByPeriod } from "./lib/scored-set-client";

const API_BASE = process.env.API_URL || "http://localhost:3001";

interface ZipRow {
  zip: string;
  name: string;
  state: string;
  countyFips: string | null;
  cbsaCode: string | null;
}

async function main() {
  const res = await fetch(`${API_BASE}/api/markets/zips`);
  if (!res.ok) throw new Error(`zips API ${res.status}: ${await res.text()}`);
  const zips = (await res.json()) as ZipRow[]; // map field names per Step 1
  console.log(`Fetched ${zips.length} ZIPs.`);

  const { periods, scoredByPeriod } = await fetchScoredByPeriod(
    API_BASE,
    "zip",
  );
  const { publish } = pickWindows(periods);
  const publishedZips = computePublishedIds(scoredByPeriod, publish);
  assertNonEmpty("zip", publishedZips);

  const entries = zips
    .filter((z) => publishedZips.has(z.zip))
    .map((z) => {
      const cityState = z.name; // adapt to Step 1 fields
      return {
        zip: z.zip,
        slug: generateZipSlug(z.zip, cityState, z.state),
        name: `${z.zip} (${cityState})`,
        shortName: `${z.zip}, ${cityState}, ${z.state}`,
        state: z.state,
        countyFips: z.countyFips ?? null,
        cbsaCode: z.cbsaCode ?? null,
      };
    });

  console.log(
    `Published ZIPs: ${entries.length} / ${zips.length} tracked (window: ${publish.join(", ")})`,
  );
  if (entries.length === 0) {
    throw new Error(
      "fail-closed: 0 published ZIP entries — not overwriting JSON",
    );
  }

  const fs = await import("fs");
  const path = await import("path");
  const jsonPath = path.join(
    "packages",
    "frontend",
    "lib",
    "data",
    "zip-slug-data.json",
  );
  fs.writeFileSync(jsonPath, JSON.stringify(entries, null, 2) + "\n");
  console.log(`Written ${entries.length} entries to ${jsonPath}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
```

(Confirm `generateZipSlug`'s exact parameter order against `zip-slugs.ts` before running — adjust if it differs.)

- [ ] **Step 3: Smoke-test:**

```bash
API_URL=https://backend-production-ee4d.up.railway.app npx tsx scripts/generate-zip-slugs.ts
node -e "console.log(require('./packages/frontend/lib/data/zip-slug-data.json').length)"
```

Expected: ~29,417.

- [ ] **Step 4: Commit.**

```bash
git add scripts/generate-zip-slugs.ts packages/frontend/lib/data/zip-slug-data.json
git commit -m "feat(seo): create score-gated ZIP slug generator (replaces missing script)"
```

---

## Task 7: Simplify the three market pages (remove the noindex branch)

Now that slug data == published set, every page that resolves is publishable. Drop the per-page score check; `notFound()` (already present) handles non-published geos.

**Files:**

- Modify: `packages/frontend/app/(public)/markets/[slug]/page.tsx`
- Modify: `packages/frontend/app/(public)/markets/county/[slug]/page.tsx`
- Modify: `packages/frontend/app/(public)/markets/zip/[slug]/page.tsx`

- [ ] **Step 1: ZIP page edits.**
  - Delete the import (line 8): `import { isLocationIndexable } from "@/lib/seo/scored-locations";`
  - Replace the `Promise.all` block (lines 41–44) with a direct stats fetch:
    ```typescript
    const stats = await fetchSeoMarketStats("zip", zip.zip, zip.state);
    ```
  - Delete the `robots:` line (line 52) entirely (default is indexable).

- [ ] **Step 2: County page edits** (same shape):
  - Delete `import { isLocationIndexable } from "@/lib/seo/scored-locations";` (line 7).
  - Replace the `Promise.all([isLocationIndexable("county", county.fips), fetchSeoMarketStats(...)])` with the direct `fetchSeoMarketStats("county", county.fips, county.state)` call.
  - Delete the `robots: indexable ? undefined : { index: false, follow: true }` line (line 51).

- [ ] **Step 3: Metro page edits** (same shape):
  - Delete `import { isLocationIndexable } from "@/lib/seo/scored-locations";` (line 6).
  - Replace the `Promise.all([isLocationIndexable("metro", metro.cbsaCode), fetchSeoMarketStats(...)])` with the direct `fetchSeoMarketStats(...)` call.
  - Delete the `robots:` line (line 51).

- [ ] **Step 4: Confirm no remaining importers, then delete the dead module.**

```bash
grep -rn "scored-locations" packages/frontend --include="*.ts" --include="*.tsx"
```

Expected: zero matches outside the file itself. Then:

```bash
git rm packages/frontend/lib/seo/scored-locations.ts
```

- [ ] **Step 5: Type-check the frontend.**

Run: `npm run build -w web` is heavy; instead `cd packages/frontend && npx tsc --noEmit` if a tsconfig allows, else rely on Task 10's prod-preview build.
Expected: no references to `isLocationIndexable` / `scored-locations`.

- [ ] **Step 6: Commit.**

```bash
git add "packages/frontend/app/(public)/markets"
git commit -m "refactor(seo): drop per-page noindex branch; slug data is the gate now"
```

---

## Task 8: Keep the sitemap consistent (no double-gating)

The sitemap currently re-filters slug data to the _latest_ scored set, which would wrongly drop grace-window pages. Since slug data is already the published set, stop filtering — keep the endpoint only for honest `lastmod`.

**Files:**

- Modify: `packages/frontend/lib/seo/sitemap-builder.ts:52-65` (`scoredEntries`) and the zip path (`getScoredZipData`).

- [ ] **Step 1: Replace the filter in `scoredEntries`** so it returns all entries with the honest `lastmod`:

```typescript
async function scoredEntries<T>(
  geo: "metro" | "county" | "zip",
  entries: T[],
  _idOf: (entry: T) => string,
): Promise<{ lastmod: string | undefined; entries: T[] }> {
  // Slug data is already score-gated at generation time, so do NOT re-filter
  // (re-filtering to the latest-only scored set would drop grace-window pages).
  // We still hit the endpoint purely for the honest <lastmod> date.
  const { date } = await fetchScoredLocationData(geo);
  return { lastmod: isoOrUndefined(date), entries };
}
```

- [ ] **Step 2: Apply the same change to the ZIP path** (`getScoredZipData`) — return all `ZIP_SLUG_DATA` entries with the endpoint's `date` as `lastmod`, no `scored.has()` filter.

- [ ] **Step 3: Verify the sitemap count matches slug data** (after Task 10's build):

```bash
curl -s http://localhost:3100/sitemaps/metros | grep -c "<loc>"
node -e "console.log(require('./packages/frontend/lib/data/metro-slug-data.json').length)"
```

Expected: the two counts match (≈935).

- [ ] **Step 4: Commit.**

```bash
git add packages/frontend/lib/seo/sitemap-builder.ts
git commit -m "refactor(seo): sitemap trusts gated slug data; endpoint used only for lastmod"
```

---

## Task 9: Generate the de-scored redirect map

**Files:**

- Modify: `scripts/lib/published-set.ts` — add `resolveAncestorRedirect`.
- Modify: `scripts/lib/published-set.test.ts` — add tests.
- Create: `packages/frontend/lib/data/descored-redirects.ts` (typed loader).
- Generated by the monthly job: `packages/frontend/lib/data/descored-redirects.json`.

**Interfaces:**

- Produces:
  - `resolveAncestorRedirect(entry, publishedCountyFips, publishedCbsa, stateSlugOf): string | null` — returns the destination path (`/markets/county/<slug>` → `/markets/<metroSlug>` → `/markets/state/<stateSlug>`) or `null` if nothing resolves.
  - Redirect JSON entry shape: `{ source: string; destination: string; permanent: false }`.

- [ ] **Step 1: Write failing tests** for the resolver:

```typescript
import { resolveAncestorRedirect } from "./published-set";

describe("resolveAncestorRedirect (zip)", () => {
  const publishedCounties = new Map([["17031", "cook-county-il"]]);
  const publishedMetros = new Map([["16980", "chicago-il"]]);
  const stateSlugOf = (s: string) =>
    s.toLowerCase() === "il" ? "illinois" : s.toLowerCase();

  it("redirects to county when county is published", () => {
    const zip = {
      zip: "60601",
      countyFips: "17031",
      cbsaCode: "16980",
      state: "IL",
    };
    expect(
      resolveAncestorRedirect(
        zip,
        publishedCounties,
        publishedMetros,
        stateSlugOf,
      ),
    ).toBe("/markets/county/cook-county-il");
  });
  it("falls back to metro when county is not published", () => {
    const zip = {
      zip: "60601",
      countyFips: "99999",
      cbsaCode: "16980",
      state: "IL",
    };
    expect(
      resolveAncestorRedirect(
        zip,
        publishedCounties,
        publishedMetros,
        stateSlugOf,
      ),
    ).toBe("/markets/chicago-il");
  });
  it("falls back to state when neither parent is published", () => {
    const zip = {
      zip: "60601",
      countyFips: "99999",
      cbsaCode: "00000",
      state: "IL",
    };
    expect(
      resolveAncestorRedirect(
        zip,
        publishedCounties,
        publishedMetros,
        stateSlugOf,
      ),
    ).toBe("/markets/state/illinois");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx jest scripts/lib/published-set.test.ts`

- [ ] **Step 3: Implement `resolveAncestorRedirect`** (county-slug map keyed by FIPS, metro-slug map keyed by CBSA both built from the freshly-gated JSONs):

```typescript
export interface AncestorKeys {
  countyFips?: string | null;
  cbsaCode?: string | null;
  state: string;
}
export function resolveAncestorRedirect(
  entry: AncestorKeys,
  publishedCountySlugByFips: Map<string, string>,
  publishedMetroSlugByCbsa: Map<string, string>,
  stateSlugOf: (state: string) => string,
): string | null {
  if (entry.countyFips && publishedCountySlugByFips.has(entry.countyFips)) {
    return `/markets/county/${publishedCountySlugByFips.get(entry.countyFips)}`;
  }
  if (entry.cbsaCode && publishedMetroSlugByCbsa.has(entry.cbsaCode)) {
    return `/markets/${publishedMetroSlugByCbsa.get(entry.cbsaCode)}`;
  }
  if (entry.state) return `/markets/state/${stateSlugOf(entry.state)}`;
  return null;
}
```

(County entries pass `countyFips: undefined` so they skip straight to metro→state; metro entries skip to state.)

- [ ] **Step 4: Run — expect PASS.** `npx jest scripts/lib/published-set.test.ts`

- [ ] **Step 5: Extend each generator to emit redirect rows** for that geo level (append to metro/county/zip generators): compute `computeRedirectIds`, then for each redirect ID look up its metadata (from the all-geo fetch) and resolve the ancestor against the _just-built_ published maps; collect `{ source: '/markets/zip/<old-slug>', destination, permanent: false }`. The three generators each write their slice to a shared `descored-redirects.json` via a small merge step in the orchestration script (Task 11), OR each writes `descored-redirects.<geo>.json` and the orchestrator concatenates. **Choose concatenation** (simpler, no read-modify-write races):
  - metro generator → `descored-redirects.metro.json`
  - county generator → `descored-redirects.county.json`
  - zip generator → `descored-redirects.zip.json`

- [ ] **Step 6: Create the typed loader** `packages/frontend/lib/data/descored-redirects.ts`:

```typescript
// Aggregated de-scored → ancestor redirects, regenerated monthly. Do not hand-edit.
import metro from "./descored-redirects.metro.json";
import county from "./descored-redirects.county.json";
import zip from "./descored-redirects.zip.json";

export interface DescoredRedirect {
  source: string;
  destination: string;
  permanent: false;
}
export const DESCORED_REDIRECTS: DescoredRedirect[] = [
  ...metro,
  ...county,
  ...zip,
];
```

(Seed all three JSON files with `[]` so the import resolves before the first monthly run.)

- [ ] **Step 7: Commit.**

```bash
git add scripts/lib/published-set.ts scripts/lib/published-set.test.ts scripts/generate-*-slugs.ts packages/frontend/lib/data/descored-redirects.ts packages/frontend/lib/data/descored-redirects.*.json
git commit -m "feat(seo): generate de-scored ancestor redirect map (307, lookback window)"
```

---

## Task 10: Wire redirects into next.config and verify on a prod-preview build

**Files:**

- Modify: `packages/frontend/next.config.mjs:77-157` (`redirects()`).

- [ ] **Step 1: Import + spread** the generated redirects into the existing `redirects()` array (after the static entries, before the closing `]`):

```javascript
// near top of file:
import { DESCORED_REDIRECTS } from './lib/data/descored-redirects.ts';
// (Next supports importing JSON-backed TS here; if ESM import of .ts fails in next.config,
//  import the .json files directly and spread them.)

// inside redirects(), append:
      ...DESCORED_REDIRECTS,
    ];
  },
```

If importing `.ts` into `next.config.mjs` is problematic, import the three JSON files directly:

```javascript
import metroRedirects from "./lib/data/descored-redirects.metro.json" assert { type: "json" };
import countyRedirects from "./lib/data/descored-redirects.county.json" assert { type: "json" };
import zipRedirects from "./lib/data/descored-redirects.zip.json" assert { type: "json" };
// ...append: ...metroRedirects, ...countyRedirects, ...zipRedirects,
```

- [ ] **Step 2: Build a production preview** into the isolated dist dir (never the dev `.next` — see memory `next-build-clobbers-dev-next`):

```bash
cd packages/frontend
NEXT_DIST_DIR=.next-verify npx next build
NEXT_DIST_DIR=.next-verify npx next start -p 3100
```

- [ ] **Step 3: Verify gating end-to-end** (live, per the "no mocks" rule). Pick a known **scored** zip, a known **never-scored** zip, and a **de-scored** zip from the redirect JSON:

```bash
# scored → 200, no noindex
curl -sI http://localhost:3100/markets/zip/<scored-slug> | grep -iE '^HTTP|x-robots-tag'
# never-scored → 404
curl -sI http://localhost:3100/markets/zip/<never-scored-old-slug> | grep -iE '^HTTP'
# de-scored → 307 to ancestor
curl -sI http://localhost:3100/markets/zip/<descored-slug> | grep -iE '^HTTP|^location'
```

Expected: scored → `200` and NO `x-robots-tag: noindex`; never-scored → `404`; de-scored → `307` + `Location: /markets/county/...`.

- [ ] **Step 4: Verify sitemap matches slug data** (Task 8 Step 3 commands). Expected: counts match.

- [ ] **Step 5: Commit.**

```bash
git add packages/frontend/next.config.mjs
git commit -m "feat(seo): serve 307 redirects for de-scored market pages"
```

---

## Task 11: Monthly automation (chain off the scoring workflow, fail-closed)

**Files:**

- Modify: `package.json` (root) — add scripts.
- Modify: `.github/workflows/post-import-refresh.yml` (after the scoring step at lines 136–164).

- [ ] **Step 1: Add npm scripts** to root `package.json`:

```json
"seo:rebuild-slugs": "npm run seo:slugs:metro && npm run seo:slugs:county && npm run seo:slugs:zip && npm run seo:redirects:merge",
"seo:slugs:metro": "tsx scripts/generate-metro-slugs.ts",
"seo:slugs:county": "tsx scripts/generate-county-slugs.ts",
"seo:slugs:zip": "tsx scripts/generate-zip-slugs.ts",
"seo:redirects:merge": "tsx scripts/merge-descored-redirects.ts"
```

(`merge-descored-redirects.ts` is a no-op if you chose per-geo JSON files in Task 9 Step 5; include it only if you need a combined file. If per-geo files are imported directly in Task 10, drop this script and the `&& npm run seo:redirects:merge`.)

- [ ] **Step 2: Add the rebuild step** to `post-import-refresh.yml` immediately AFTER the "Run PropertyIQ Scoring Pipeline" step (so it sees fresh scores), guarded by the same `if` condition the scoring step uses (only when new data was imported):

```yaml
- name: Rebuild SEO slug data (score-gated)
  if: steps.scoring.outcome == 'success'
  env:
    API_URL: https://backend-production-ee4d.up.railway.app
  run: |
    set -euo pipefail   # any generator failure (incl. fail-closed throw) aborts the job
    npm ci
    npm run seo:rebuild-slugs

- name: Commit regenerated slug data
  if: steps.scoring.outcome == 'success'
  run: |
    set -euo pipefail
    git config user.name "propertyiq-bot"
    git config user.email "bot@propertyiq.app"
    git add packages/frontend/lib/data/metro-slug-data.json \
            packages/frontend/lib/data/county-slug-data.json \
            packages/frontend/lib/data/zip-slug-data.json \
            packages/frontend/lib/data/descored-redirects.*.json
    if git diff --cached --quiet; then
      echo "No slug changes this month."
    else
      git commit -m "chore(seo): monthly score-gated slug + redirect rebuild [skip ci]"
      git push origin HEAD:develop
    fi
```

**Fail-closed guarantee:** `set -euo pipefail` + the generators' `assertNonEmpty`/throw means a bad fetch aborts BEFORE `git add`, so the prior committed JSON is never overwritten or emptied.

- [ ] **Step 3: Production promotion** — implement per Task 0 Step 1's finding:
  - **If the frontend deploys from `develop`:** the `git push origin HEAD:develop` above already triggers the redeploy. Done.
  - **If the frontend deploys from `main`:** do NOT auto-merge develop→main (CLAUDE.md §2.6). Instead, after the push, trigger a Railway redeploy of the frontend service pinned to the committed data via the Railway API/CLI **OR** open a PR for the user to release. Add the chosen mechanism here as an explicit step. (This is the one decision flagged for the user — see Execution Handoff.)

- [ ] **Step 4: Dry-run the workflow** on a branch via `workflow_dispatch` (add a manual trigger temporarily) or `act`, confirming the rebuild step runs and the fail-closed path aborts on a simulated empty fetch (point `API_URL` at a stub that returns `{ "periods": [] }`). Expected: job fails at the generator, no `git add` runs.

- [ ] **Step 5: Commit.**

```bash
git add package.json .github/workflows/post-import-refresh.yml scripts/merge-descored-redirects.ts
git commit -m "ci(seo): monthly score-gated slug + redirect rebuild after scoring (fail-closed)"
```

---

## Task 12: Backfill verification + cleanup

- [ ] **Step 1: Confirm the committed JSON counts** reflect the gated reality (not the old full universe):

```bash
for f in metro county zip; do
  echo "$f: $(node -e "console.log(require('./packages/frontend/lib/data/$f-slug-data.json').length)")"
done
```

Expected: metro ≈935, county ≈3,137, zip ≈29,417 (NOT 928/3,238/39,499).

- [ ] **Step 2: Confirm zero stale references** to the deleted module and old behavior:

```bash
grep -rn "isLocationIndexable\|scored-locations" packages/frontend --include="*.ts" --include="*.tsx"
```

Expected: no matches.

- [ ] **Step 3: Run the full unit suite** for the new helpers + backend:

```bash
npx jest scripts/lib/published-set.test.ts
npm run test -w backend -- --t "getScorePeriods"
```

Expected: all pass.

- [ ] **Step 4: Dispatch background validation agents** (CLAUDE.md §1.6): `code-reviewer` on the diff, `data-layer-reviewer` on the page edits, `dto-validation-auditor` on the new controller route. Surface only CRITICAL/WARNING.

- [ ] **Step 5: Final commit / ready for review.**

```bash
git status --short   # verify ONLY intended files staged (memory: commit-explicit-pathspec)
```

---

## Self-Review

**Spec coverage:**

- Monthly rebuild → Task 11. ✓
- Fail closed → `assertNonEmpty` (Task 2), generator guards (Tasks 4–6), `set -euo pipefail` + pre-`git add` abort (Task 11). ✓
- Score-gated page existence → Tasks 4–6 (slug gen) + Task 7 (`notFound` is the gate). ✓
- Grace window (no flap on 1-month gaps) → `computePublishedIds` union over `PUBLISH_WINDOW_MONTHS` (Task 2), consumed by all generators. ✓
- De-scored → 307 to nearest published ancestor → Task 9 (`resolveAncestorRedirect`, `REDIRECT_LOOKBACK_MONTHS`) + Task 10 (next.config). ✓
- Never-scored → 404 → falls out of slug data → `notFound()` (Task 7). ✓
- Sitemap consistency → Task 8. ✓
- Missing ZIP generator recreated → Task 6. ✓

**Placeholder scan:** Task 0 (deploy branch), Task 6 Step 1 (zips payload field names), Task 9 Step 5 (per-geo vs merged redirect files), and Task 11 Step 3 (promotion mechanism) are explicit _investigations with recorded outputs_, not hand-waves — each has a concrete command and a decision rule. No "add error handling"-style gaps.

**Type consistency:** `computePublishedIds`/`computeRedirectIds`/`assertNonEmpty`/`pickWindows`/`resolveAncestorRedirect` signatures are defined in Task 2/9 and consumed verbatim in Tasks 4–6/9. Slug entry shapes match the confirmed interfaces (`MetroSlugEntry`/`CountySlugEntry`/`ZipSlugEntry`). Endpoint `GET ids/:geography/periods` defined in Task 1, consumed in Task 3.

**Open decision for the user:** production promotion when the frontend deploys from `main` (Task 11 Step 3) — auto-merge is forbidden by §2.6, so this needs a release-policy choice.

# Landing Page Narrative-Scroll Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Invoke `frontend-design:frontend-design` before building each visual beat (Phase 2).**

**Goal:** Ship a new 8-beat narrative-funnel homepage (variant B) alongside the untouched current homepage (variant A), switchable by a Railway env flag, with server-side sticky variant assignment, per-variant funnel measurement, and strict SEO/LCP preservation.

**Architecture:** The current `app/(app)/page.tsx` stays as control A. A new static, `noindex` route renders variant B. `middleware.ts` (already matching `/`) reads a `LANDING_EXPERIMENT` env flag, assigns a sticky `piq-variant` cookie, and `rewrite()`s `/` to the B route for B-assigned visitors — so each variant statically caches and there is no client flash. The B page is one continuous server component composing 8 beat sections; motion is `IntersectionObserver`-driven via the existing `useInView` hook (already reduced-motion safe) and CSS `position: sticky` — no GSAP/WebGL/scroll-jacking. The hero shows a **dynamic momentum contrast** (biggest 3-month faller vs biggest riser from a curated recognizable-metro pool) pulled from the existing cached `/api/scores/batch/metro` endpoint. Funnel events reuse the existing `trackEvent` tracker, stamping `variant` into the `properties` JSONB written to `user_events`.

**Tech Stack:** Next.js 16 App Router (RSC), React 19, Tailwind 4 / M3 tokens, Mapbox GL (existing), Supabase (`user_events`), NestJS scores API (existing, unchanged).

## Global Constraints

- **Control A untouched.** Do NOT edit `app/(app)/page.tsx` or any currently-composed `app/components/home/*` section except where this plan explicitly says so (measurement helper, middleware). B is parallel/additive. Deletion of old sections is a deferred follow-up after the flag is promoted to `on`.
- **SEO verbatim carryover.** B reuses the exact `metadata` export, `JsonLd` component, `canonical: https://www.propertyiq.app`, and OpenGraph from `app/(app)/page.tsx`. B previews are `noindex`. Canonical on B still points to `/` — no duplicate indexable URL.
- **Gradient is fixed:** page wrapper keeps `text-on-surface font-sans bg-gradient-to-b from-[#1A237E] via-[#3949AB] via-30% to-[#E8EAF6]`. Top beats use light-on-dark; lower beats dark-on-light. Hold WCAG AA at both ends.
- **Hero is the LCP element:** server-rendered, static markup, no load animation, no client-side data fetch in the hero's critical path. All motion is below the fold and observer-driven.
- **Motion system:** reuse `app/components/home/hooks/useInView.ts` (defaults visible on SSR, collapses to instant under `prefers-reduced-motion`). Reveal = opacity 0→1 + translateY 20px→0, `duration-400`, ease `cubic-bezier(0.2,0,0,1)`. Count-ups reuse `AnimatedCounter`. Sticky = CSS `position: sticky` only. NO GSAP, NO WebGL, NO scroll-jacking/scroll-snap-trap.
- **No fabricated data.** Every score/number is a live real value or a frozen capture of a genuine product run. No testimonials/user-counts/press-logos until real assets exist (reserve a hidden slot).
- **No per-visitor regeneration.** Hero/score data is cached (ISR). Persona snapshots are static frozen captures. Never call analyzer/AI/MCP live on page load.
- **Score copy follows CLAUDE.md §9 exactly:** "50 = state average," computed nationally, calibrated to state. NEVER write "ranked within state."
- **Data layer rule (CLAUDE.md §5):** new fetches go in `lib/data/fetchers/`, exported from `lib/data/index.ts`. Exception already in code: `tracker.ts` (analytics) and the legacy in-page `fetchStickyScores`.
- **Brand voice (CLAUDE.md §8.6):** confident, specific, data-first. Real markets, real numbers.
- **Single repeated primary CTA:** "Start free — every account starts on Pro, no card." Repeated at hero, after Score, after Proof, after persona, close. Email-first capture via `AnonCaptureModal`. Secondary links de-emphasized.

## File Structure

**New — variant infrastructure:**

- `packages/frontend/lib/experiments/landing-variant.ts` — flag parsing + deterministic split + variant resolution (pure, unit-tested).
- `packages/frontend/lib/experiments/__tests__/landing-variant.test.ts` — tests.
- `packages/frontend/app/(app)/home-v2/page.tsx` — variant B route (static, `noindex`), composes the 8 beats.
- `packages/frontend/app/(app)/home-v2/layout.tsx` — (if needed) `robots: noindex` metadata for the B route.

**New — shared primitives:**

- `packages/frontend/lib/data/fetchers/hero-contrast.ts` — `fetchHeroContrast()` (momentum selection over curated pool).
- `packages/frontend/lib/data/fetchers/__tests__/hero-contrast.test.ts` — momentum-selection unit tests.
- `packages/frontend/app/components/home/landing-v2/config/featured-pool.ts` — curated recognizable-metro CBSA pool (the ONE human-maintained artifact).
- `packages/frontend/app/components/home/landing-v2/Reveal.tsx` — thin wrapper around `useInView` for reveal + stagger.
- `packages/frontend/app/components/home/landing-v2/BeatSection.tsx` — section shell (full-bleed, vertical rhythm, optional eyebrow/anchor id).
- `packages/frontend/app/components/home/landing-v2/PrimaryCta.tsx` — the repeated primary CTA, opens `AnonCaptureModal`, stamps variant on click.

**New — the 8 beats** (all under `app/components/home/landing-v2/`):

- `BeatHero.tsx` (1), `BeatTension.tsx` (2), `BeatFoundation.tsx` (3), `BeatScore.tsx` (4, sticky), `BeatMap.tsx` (5), `BeatProof.tsx` (6), `BeatPersona.tsx` (7) + `persona/PersonaTabs.tsx` + `persona/snapshots/*`, `BeatClose.tsx` (8). Plus `BeatDataDepth.tsx` + `BeatPricing.tsx` (supporting) and a hidden `BeatSocialProofSlot.tsx`.
- `app/components/home/landing-v2/snapshots/` — static frozen product-output captures (JSON/MDX/images) for the persona tabs.

**Modified (behavior-preserving / additive):**

- `packages/frontend/middleware.ts` — add variant assignment + rewrite for `/` only (additive; A path unchanged when flag `off`).
- `packages/frontend/lib/analytics/tracker.ts` — add `setVariant()` + auto-include `variant` in every event's `properties` (additive; no-op until set).
- `packages/frontend/lib/data/index.ts` — export `fetchHeroContrast`.

**Verification only (not shipped):**

- `packages/frontend/tests/e2e/landing-v2.spec.ts` — Playwright desktop+mobile, reduced-motion, SEO/noindex, LCP.
- `docs/superpowers/results/2026-06-20-landing-v2-measurement.sql` — the per-variant readout query.

---

## PHASE 0 — Variant Infrastructure

Build the flag + middleware + B-route skeleton + measurement stamping FIRST, behind a flag defaulting to `off`, so nothing changes for real users until B exists and is promoted.

### Task 0.1: Landing variant flag module

**Files:**

- Create: `packages/frontend/lib/experiments/landing-variant.ts`
- Test: `packages/frontend/lib/experiments/__tests__/landing-variant.test.ts`

**Interfaces:**

- Produces:
  - `type LandingVariant = 'A' | 'B'`
  - `type LandingMode = { kind: 'off' } | { kind: 'preview' } | { kind: 'ab'; percentB: number } | { kind: 'on' }`
  - `parseLandingMode(raw: string | undefined): LandingMode` — parses `LANDING_EXPERIMENT` env: `'off'|undefined → off`, `'preview' → preview`, `'ab:<n>' → ab(n)` (n clamped 0–100), `'on' → on`. Unknown → `off`.
  - `hashToPercent(seed: string): number` — deterministic 0–99 from a cookie/uid seed (FNV-1a or simple char-sum mod 100; must be stable, no `Math.random`).
  - `resolveVariant(mode: LandingMode, opts: { existingCookie?: 'A'|'B'; previewOverride?: boolean; splitSeed: string }): LandingVariant` — preview override → B; mode `off` → A; `on` → B; `preview` → A unless override; `ab` → existingCookie if present else `hashToPercent(splitSeed) < percentB ? 'B' : 'A'`.

- [ ] **Step 1: Write failing tests**

```ts
// packages/frontend/lib/experiments/__tests__/landing-variant.test.ts
import {
  parseLandingMode,
  hashToPercent,
  resolveVariant,
} from "../landing-variant";

describe("parseLandingMode", () => {
  it("defaults to off when unset or unknown", () => {
    expect(parseLandingMode(undefined)).toEqual({ kind: "off" });
    expect(parseLandingMode("garbage")).toEqual({ kind: "off" });
  });
  it("parses preview and on", () => {
    expect(parseLandingMode("preview")).toEqual({ kind: "preview" });
    expect(parseLandingMode("on")).toEqual({ kind: "on" });
  });
  it("parses ab:<n> and clamps 0-100", () => {
    expect(parseLandingMode("ab:50")).toEqual({ kind: "ab", percentB: 50 });
    expect(parseLandingMode("ab:150")).toEqual({ kind: "ab", percentB: 100 });
    expect(parseLandingMode("ab:-5")).toEqual({ kind: "ab", percentB: 0 });
  });
});

describe("hashToPercent", () => {
  it("is deterministic and in range 0-99", () => {
    const a = hashToPercent("visitor-123");
    expect(a).toBe(hashToPercent("visitor-123"));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });
});

describe("resolveVariant", () => {
  const seed = "seed-x";
  it("off → A, on → B", () => {
    expect(resolveVariant({ kind: "off" }, { splitSeed: seed })).toBe("A");
    expect(resolveVariant({ kind: "on" }, { splitSeed: seed })).toBe("B");
  });
  it("preview → A unless override", () => {
    expect(resolveVariant({ kind: "preview" }, { splitSeed: seed })).toBe("A");
    expect(
      resolveVariant(
        { kind: "preview" },
        { splitSeed: seed, previewOverride: true },
      ),
    ).toBe("B");
  });
  it("ab honors existing cookie (sticky)", () => {
    expect(
      resolveVariant(
        { kind: "ab", percentB: 0 },
        { splitSeed: seed, existingCookie: "B" },
      ),
    ).toBe("B");
    expect(
      resolveVariant(
        { kind: "ab", percentB: 100 },
        { splitSeed: seed, existingCookie: "A" },
      ),
    ).toBe("A");
  });
  it("ab:100 assigns B, ab:0 assigns A for new visitor", () => {
    expect(
      resolveVariant({ kind: "ab", percentB: 100 }, { splitSeed: seed }),
    ).toBe("B");
    expect(
      resolveVariant({ kind: "ab", percentB: 0 }, { splitSeed: seed }),
    ).toBe("A");
  });
});
```

- [ ] **Step 2: Run tests, verify they FAIL** — Run: `npm --prefix packages/frontend test -- landing-variant` — Expected: FAIL "Cannot find module '../landing-variant'".

- [ ] **Step 3: Implement the module**

```ts
// packages/frontend/lib/experiments/landing-variant.ts
export type LandingVariant = "A" | "B";
export type LandingMode =
  | { kind: "off" }
  | { kind: "preview" }
  | { kind: "ab"; percentB: number }
  | { kind: "on" };

export function parseLandingMode(raw: string | undefined): LandingMode {
  if (!raw) return { kind: "off" };
  const v = raw.trim().toLowerCase();
  if (v === "off") return { kind: "off" };
  if (v === "preview") return { kind: "preview" };
  if (v === "on") return { kind: "on" };
  const m = v.match(/^ab:(\d{1,3})$/);
  if (m) {
    const n = Math.min(100, Math.max(0, parseInt(m[1], 10)));
    return { kind: "ab", percentB: n };
  }
  return { kind: "off" };
}

// FNV-1a, stable across processes (no Math.random / Date).
export function hashToPercent(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 100;
}

export function resolveVariant(
  mode: LandingMode,
  opts: {
    existingCookie?: LandingVariant;
    previewOverride?: boolean;
    splitSeed: string;
  },
): LandingVariant {
  if (opts.previewOverride) return "B";
  switch (mode.kind) {
    case "off":
      return "A";
    case "on":
      return "B";
    case "preview":
      return "A";
    case "ab":
      if (opts.existingCookie) return opts.existingCookie;
      return hashToPercent(opts.splitSeed) < mode.percentB ? "B" : "A";
  }
}

export const LANDING_VARIANT_COOKIE = "piq-variant";
export const LANDING_PREVIEW_PARAM = "landing"; // ?landing=v2 forces B
```

- [ ] **Step 4: Run tests, verify PASS** — Run: `npm --prefix packages/frontend test -- landing-variant` — Expected: PASS all.

- [ ] **Step 5: Commit** — `git add packages/frontend/lib/experiments && git commit -m "feat(landing): add LANDING_EXPERIMENT variant flag module"`

### Task 0.2: Middleware variant assignment + rewrite

**Files:**

- Modify: `packages/frontend/middleware.ts` (add a block after the `piq-uid` cookie set, ~line 134, before the `/get-started` redirect; and a rewrite for `/`).

**Interfaces:**

- Consumes: `parseLandingMode`, `resolveVariant`, `LANDING_VARIANT_COOKIE`, `LANDING_PREVIEW_PARAM` from Task 0.1.
- Produces: on a request to `/` (exactly), sets `piq-variant` cookie (client-readable, like `piq-uid`) and, when variant resolves to `B`, `NextResponse.rewrite(new URL('/home-v2', request.url))` carrying forward all cookies. A-variant and all non-`/` paths are unchanged.

**Behavior contract (must hold):** with `LANDING_EXPERIMENT` unset/`off`, `/` renders exactly today's `page.tsx` (A) — no rewrite, no behavior change. The variant cookie may still be set to `A` (inert).

- [ ] **Step 1: Add the variant block to middleware.** Insert AFTER the `piq-uid` set/delete block (current line ~134) and define a helper near the top:

```ts
// near imports
import {
  parseLandingMode,
  resolveVariant,
  LANDING_VARIANT_COOKIE,
  LANDING_PREVIEW_PARAM,
  type LandingVariant,
} from "@/lib/experiments/landing-variant";

// ... inside middleware(), after the piq-uid block, BEFORE `const { pathname } = request.nextUrl;` reuse existing pathname:
// (pathname is already destructured below; move its declaration up or reuse)
if (pathname === "/") {
  const mode = parseLandingMode(process.env.LANDING_EXPERIMENT);
  const existing = request.cookies.get(LANDING_VARIANT_COOKIE)?.value;
  const existingCookie =
    existing === "A" || existing === "B"
      ? (existing as LandingVariant)
      : undefined;
  const previewOverride =
    request.nextUrl.searchParams.get(LANDING_PREVIEW_PARAM) === "v2";
  // Stable seed: prefer uid, fall back to the visitor cookie, then a per-request fallback.
  const splitSeed =
    user?.id ||
    request.cookies.get("piq-visitor")?.value ||
    request.headers.get("x-forwarded-for") ||
    "anon";
  const variant = resolveVariant(mode, {
    existingCookie,
    previewOverride,
    splitSeed,
  });

  supabaseResponse.cookies.set(LANDING_VARIANT_COOKIE, variant, {
    path: "/",
    httpOnly: false, // client reads it to stamp analytics
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days — sticky per visitor
  });

  if (variant === "B") {
    const url = request.nextUrl.clone();
    url.pathname = "/home-v2";
    const rewrite = NextResponse.rewrite(url, { request });
    // carry forward the cookies we set on supabaseResponse
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => rewrite.cookies.set(c.name, c.value, c));
    return rewrite;
  }
}
```

> Note: the existing code declares `const { pathname } = request.nextUrl;` at ~line 136. Move that declaration ABOVE this inserted block (or duplicate-read) so `pathname` is in scope. Keep the existing `/get-started`, `/_dev`, protected-route logic unchanged below.

- [ ] **Step 2: Manual behavior check — flag off.** Run the dev server (`npm run dev:fresh` per the local-dev-servers skill; single instance). With `LANDING_EXPERIMENT` unset, `curl -s localhost:3000/ | grep -o 'hero-heading'` still returns the A hero id. Direct `curl -s localhost:3000/home-v2` returns the B skeleton (Task 0.3). Expected: `/` = A unchanged.

- [ ] **Step 3: Manual behavior check — preview + on.** Set `LANDING_EXPERIMENT=preview` in `packages/frontend/.env.local`, restart. `curl -s 'localhost:3000/?landing=v2'` serves B (rewritten, URL stays `/`); plain `curl -s localhost:3000/` serves A. Set `LANDING_EXPERIMENT=on`, restart: `/` serves B. Set back to unset. Expected: matches the mode table.

- [ ] **Step 4: Commit** — `git add packages/frontend/middleware.ts && git commit -m "feat(landing): middleware assigns sticky variant cookie + rewrites / to B"`

### Task 0.3: Variant B route skeleton + noindex

**Files:**

- Create: `packages/frontend/app/(app)/home-v2/page.tsx`
- Create: `packages/frontend/app/(app)/home-v2/layout.tsx`

**Interfaces:**

- Produces: a server-rendered route at `/home-v2` that (a) is `noindex`, (b) reuses the A page's `JsonLd` + the SAME `metadata`/canonical/OG (so when rewritten to `/` it is SEO-equivalent to A), (c) renders a placeholder `<main>` to be filled by Phase 2 beats.

- [ ] **Step 1: Layout with noindex + carried metadata.**

```tsx
// packages/frontend/app/(app)/home-v2/layout.tsx
import type { Metadata } from "next";
// Re-use the EXACT metadata object exported by the A page so the rewritten `/`
// is byte-equivalent for SEO. Extract A's metadata into a shared module in
// Phase 3 (Task 3.2); for the skeleton, import and spread it, then force noindex
// for direct /home-v2 hits (the rewrite to `/` is what real users see).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
export default function HomeV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 2: Page skeleton (server component, gradient wrapper).**

```tsx
// packages/frontend/app/(app)/home-v2/page.tsx
import { JsonLd } from "@/app/components/home/JsonLd";

export default function HomeV2Page() {
  return (
    <div className="text-on-surface font-sans bg-gradient-to-b from-[#1A237E] via-[#3949AB] via-30% to-[#E8EAF6]">
      <JsonLd />
      <main id="landing-v2" className="min-h-screen">
        {/* Phase 2 beats mount here, in order 1→8 */}
        <p className="sr-only">PropertyIQ landing (variant B)</p>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify route renders.** `curl -s localhost:3000/home-v2 | grep -o 'landing-v2'` → matches; response has `<meta name="robots" content="noindex` (check built/SSR HTML). Expected: PASS.

- [ ] **Step 4: Commit** — `git add packages/frontend/app/\(app\)/home-v2 && git commit -m "feat(landing): noindex variant-B route skeleton with carried JsonLd"`

### Task 0.4: Variant stamping in the analytics tracker

**Files:**

- Modify: `packages/frontend/lib/analytics/tracker.ts` (add `currentVariant` + `setVariant`, include in `enrichedProperties`).
- Create: `packages/frontend/app/components/home/landing-v2/VariantStamp.tsx` (client component that reads the `piq-variant` cookie and calls `setVariant` + fires `home_view` once).

**Interfaces:**

- Consumes: `trackEvent`, new `setVariant(v: string|null)`.
- Produces: every event emitted while on the homepage carries `properties.variant = 'A'|'B'`. A `home.view` event fires once per page load with the variant.

- [ ] **Step 1: Add variant to tracker (additive).** In `tracker.ts`, add module state and setter, and merge into properties:

```ts
let currentVariant: string | null = null;
export function setVariant(v: string | null): void {
  currentVariant = v;
}
```

In `trackEvent`, where `enrichedProperties` is built, add:

```ts
if (currentVariant)
  enrichedProperties = { ...enrichedProperties, variant: currentVariant };
```

- [ ] **Step 2: VariantStamp client component.**

```tsx
// packages/frontend/app/components/home/landing-v2/VariantStamp.tsx
"use client";
import { useEffect } from "react";
import { setVariant, trackEvent } from "@/lib/analytics/tracker";

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export function VariantStamp({ variant }: { variant: "A" | "B" }) {
  useEffect(() => {
    const v = variant || readCookie("piq-variant") || "A";
    setVariant(v);
    trackEvent("home.view", { variant: v });
  }, [variant]);
  return null;
}
```

Mount `<VariantStamp variant="B" />` in `home-v2/page.tsx`; the A page (Phase 3, Task 3.3) gets `<VariantStamp variant="A" />` — the ONE allowed edit to the A page, additive and behind the analytics no-op.

- [ ] **Step 3: Verify** an event POSTs to `/api/usage/events` with `properties.variant` set — load `/home-v2`, watch Network for `events` POST, inspect body. Expected: `variant: "B"` present.

- [ ] **Step 4: Commit** — `git add ... && git commit -m "feat(landing): stamp variant into analytics events (properties JSONB)"`

---

## PHASE 1 — Shared Primitives

### Task 1.1: Curated featured-metro pool

**Files:**

- Create: `packages/frontend/app/components/home/landing-v2/config/featured-pool.ts`

**Interfaces:**

- Produces: `FEATURED_METRO_POOL: { cbsa: string; name: string }[]` — ~35 recognizable metros (the ONE human-maintained artifact). Missing/no-score members are skipped at fetch time, so the list can be generous.

- [ ] **Step 1: Write the pool** (real CBSA codes; trim names to brand-friendly city, state):

```ts
// packages/frontend/app/components/home/landing-v2/config/featured-pool.ts
export const FEATURED_METRO_POOL: { cbsa: string; name: string }[] = [
  { cbsa: "12420", name: "Austin, TX" },
  { cbsa: "19100", name: "Dallas, TX" },
  { cbsa: "26420", name: "Houston, TX" },
  { cbsa: "41700", name: "San Antonio, TX" },
  { cbsa: "34980", name: "Nashville, TN" },
  { cbsa: "12060", name: "Atlanta, GA" },
  { cbsa: "16740", name: "Charlotte, NC" },
  { cbsa: "39580", name: "Raleigh, NC" },
  { cbsa: "38060", name: "Phoenix, AZ" },
  { cbsa: "29820", name: "Las Vegas, NV" },
  { cbsa: "19740", name: "Denver, CO" },
  { cbsa: "41620", name: "Salt Lake City, UT" },
  { cbsa: "14260", name: "Boise, ID" },
  { cbsa: "33100", name: "Miami, FL" },
  { cbsa: "45300", name: "Tampa, FL" },
  { cbsa: "36740", name: "Orlando, FL" },
  { cbsa: "27260", name: "Jacksonville, FL" },
  { cbsa: "42660", name: "Seattle, WA" },
  { cbsa: "38900", name: "Portland, OR" },
  { cbsa: "15380", name: "Buffalo, NY" },
  { cbsa: "38300", name: "Pittsburgh, PA" },
  { cbsa: "40380", name: "Rochester, NY" },
  { cbsa: "19820", name: "Detroit, MI" },
  { cbsa: "41180", name: "St. Louis, MO" },
  { cbsa: "17140", name: "Cincinnati, OH" },
  { cbsa: "18140", name: "Columbus, OH" },
  { cbsa: "26900", name: "Indianapolis, IN" },
  { cbsa: "28140", name: "Kansas City, MO" },
  { cbsa: "33340", name: "Milwaukee, WI" },
  { cbsa: "33460", name: "Minneapolis, MN" },
  { cbsa: "16980", name: "Chicago, IL" },
  { cbsa: "37980", name: "Philadelphia, PA" },
  { cbsa: "14460", name: "Boston, MA" },
  { cbsa: "47900", name: "Washington, DC" },
  { cbsa: "31080", name: "Los Angeles, CA" },
  { cbsa: "41740", name: "San Diego, CA" },
  { cbsa: "40900", name: "Sacramento, CA" },
  { cbsa: "32820", name: "Memphis, TN" },
];
```

- [ ] **Step 2: Commit** — `git add ... && git commit -m "feat(landing): curated featured-metro pool for hero momentum selection"`

### Task 1.2: Hero contrast fetcher (momentum selection)

**Files:**

- Create: `packages/frontend/lib/data/fetchers/hero-contrast.ts`
- Test: `packages/frontend/lib/data/fetchers/__tests__/hero-contrast.test.ts`
- Modify: `packages/frontend/lib/data/index.ts` (export `fetchHeroContrast`, types)

**Interfaces:**

- Consumes: `FEATURED_METRO_POOL`; the existing API base (`getApiUrl()` / `API_URL` per `lib/data/fetchers/api-url.ts`); endpoint `GET /api/scores/batch/metro?ids=<csv>&historyMonths=3` returning `{ geography, scores: (ScoreResult | {location_id, error})[] }` where `ScoreResult.scores.propertyiq` has `{ score, grade, confidence, history: { data: {date,score}[], change } }`.
- Produces:
  - `type HeroMarket = { cbsa: string; name: string; score: number; delta: number; direction: 'up'|'down'; confidenceLevel: string }`
  - `type HeroContrast = { cooler: HeroMarket; riser: HeroMarket; asOf: string }`
  - `selectContrast(rows: PoolRow[]): HeroContrast | null` — pure; cooler = most-negative `delta`, riser = most-positive `delta`; deterministic tiebreak by lowest/highest absolute score then cbsa; needs ≥2 valid rows with ≥3mo history.
  - `async fetchHeroContrast(): Promise<HeroContrast | null>` — fetch batch (ISR `revalidate: 21600`), map to `PoolRow[]`, call `selectContrast`. Returns `null` on failure (hero falls back to static copy — see Beat 1).
  - `delta` is computed from history: `latest.score - score3moPrior.score` (use the earliest of the last 4 history points so it's robust to gaps).

- [ ] **Step 1: Write failing tests for `selectContrast`** (pure logic — no network):

```ts
import { selectContrast } from "../hero-contrast";
const row = (cbsa: string, name: string, score: number, delta: number) =>
  ({
    cbsa,
    name,
    score,
    delta,
    direction: delta >= 0 ? "up" : "down",
    confidenceLevel: "A",
  }) as const;

describe("selectContrast", () => {
  it("picks biggest faller as cooler and biggest riser as riser", () => {
    const out = selectContrast([
      row("12420", "Austin, TX", 2, -7),
      row("34980", "Nashville, TN", 16, -24),
      row("15380", "Buffalo, NY", 96, 4),
      row("38300", "Pittsburgh, PA", 52, 12),
    ]);
    expect(out?.cooler.name).toBe("Nashville, TN"); // delta -24
    expect(out?.riser.name).toBe("Pittsburgh, PA"); // delta +12
  });
  it("returns null with fewer than 2 valid rows", () => {
    expect(selectContrast([row("12420", "Austin, TX", 2, -7)])).toBeNull();
  });
  it("never returns the same market for both sides", () => {
    const out = selectContrast([row("a", "A", 50, -3), row("b", "B", 50, -1)]);
    expect(out?.cooler.cbsa).not.toBe(out?.riser.cbsa);
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL** — `npm --prefix packages/frontend test -- hero-contrast` → FAIL (module missing).

- [ ] **Step 3: Implement.**

```ts
// packages/frontend/lib/data/fetchers/hero-contrast.ts
import { getApiUrl } from "./api-url";
import { FEATURED_METRO_POOL } from "@/app/components/home/landing-v2/config/featured-pool";

export type HeroMarket = {
  cbsa: string;
  name: string;
  score: number;
  delta: number;
  direction: "up" | "down";
  confidenceLevel: string;
};
export type HeroContrast = {
  cooler: HeroMarket;
  riser: HeroMarket;
  asOf: string;
};
type PoolRow = HeroMarket & { asOf: string };

export function selectContrast(rows: PoolRow[]): HeroContrast | null {
  if (rows.length < 2) return null;
  const byFall = [...rows].sort(
    (a, b) =>
      a.delta - b.delta || a.score - b.score || a.cbsa.localeCompare(b.cbsa),
  );
  const byRise = [...rows].sort(
    (a, b) =>
      b.delta - a.delta || b.score - a.score || a.cbsa.localeCompare(b.cbsa),
  );
  const cooler = byFall[0];
  const riser = byRise[0].cbsa === cooler.cbsa ? byRise[1] : byRise[0];
  if (!riser || riser.cbsa === cooler.cbsa) return null;
  return { cooler, riser, asOf: cooler.asOf };
}

export async function fetchHeroContrast(): Promise<HeroContrast | null> {
  try {
    const ids = FEATURED_METRO_POOL.map((m) => m.cbsa).join(",");
    const res = await fetch(
      `${getApiUrl()}/api/scores/batch/metro?ids=${ids}&historyMonths=3`,
      { next: { revalidate: 21600 } }, // 6h, matches backend Cache-Control
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { scores: any[] };
    const nameByCbsa = new Map(
      FEATURED_METRO_POOL.map((m) => [m.cbsa, m.name]),
    );
    const rows: PoolRow[] = [];
    for (const s of json.scores ?? []) {
      if (!s || s.error) continue;
      const piq = s.scores?.propertyiq;
      const hist = piq?.history?.data as
        | { date: string; score: number }[]
        | undefined;
      if (!piq || typeof piq.score !== "number" || !hist || hist.length < 2)
        continue;
      const latest = hist[0];
      const prior = hist[Math.min(3, hist.length - 1)]; // ~3 months back, gap-robust
      const delta = latest.score - prior.score;
      rows.push({
        cbsa: s.location_id,
        name: nameByCbsa.get(s.location_id) ?? s.location_name,
        score: piq.score,
        delta,
        direction: delta >= 0 ? "up" : "down",
        confidenceLevel: piq.confidence_level ?? piq.confidence?.level ?? "A",
        asOf: latest.date,
      });
    }
    return selectContrast(rows);
  } catch {
    return null;
  }
}
```

> Verify the exact `history` shape on `ScoreResult` against `scoring.service.ts` during implementation; adjust the `piq.history.data` / `confidence_level` paths if the batch response nests differently. The unit test covers the selection logic regardless.

- [ ] **Step 4: Run tests, verify PASS** — `npm --prefix packages/frontend test -- hero-contrast` → PASS.

- [ ] **Step 5: Export + integration smoke.** Add to `lib/data/index.ts`: `export { fetchHeroContrast, type HeroContrast, type HeroMarket } from './fetchers/hero-contrast';`. With the backend running, add a temporary script/route log to confirm `fetchHeroContrast()` returns a real `{cooler, riser}` pair against live data (per the no-mocks rule). Remove the temp log.

- [ ] **Step 6: Commit** — `git add ... && git commit -m "feat(landing): hero momentum-contrast fetcher over curated pool"`

### Task 1.3: Reveal wrapper, BeatSection shell, PrimaryCta

**Files:**

- Create: `app/components/home/landing-v2/Reveal.tsx`, `BeatSection.tsx`, `PrimaryCta.tsx`

**Interfaces:**

- Produces:
  - `<Reveal as?="div" delayMs?={0} className?>` — wraps children; uses `useInView`; applies `opacity/translateY` transition classes when `inView`, instant when not animating (reduced-motion handled by `useInView`).
  - `<BeatSection id eyebrow? tone="dark"|"light" className>` — full-bleed section shell with vertical rhythm + max-width inner; `tone` sets text color for the gradient position.
  - `<PrimaryCta label? source>` — client; renders the brand CTA button; on click stamps `trackEvent('cta.click', { variant, source })` then opens `AnonCaptureModal` (`featureName="PropertyIQ Pro"`, `returnTo="/map"`); on email submit the modal already fires its own capture events.

- [ ] **Step 1: Reveal**

```tsx
// app/components/home/landing-v2/Reveal.tsx
"use client";
import { useInView } from "@/app/components/home/hooks/useInView";

export function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const [ref, inView] = useInView(0.15);
  return (
    <div
      ref={ref}
      className={`transition-all duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      } ${className}`}
      style={{ transitionDelay: inView ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: BeatSection**

```tsx
// app/components/home/landing-v2/BeatSection.tsx
export function BeatSection({
  id,
  eyebrow,
  tone = "light",
  className = "",
  children,
}: {
  id: string;
  eyebrow?: string;
  tone?: "dark" | "light";
  className?: string;
  children: React.ReactNode;
}) {
  const text = tone === "dark" ? "text-on-primary" : "text-on-surface";
  return (
    <section id={id} className={`px-5 py-20 md:py-28 ${text} ${className}`}>
      <div className="mx-auto w-full max-w-5xl">
        {eyebrow && (
          <p
            className={`mb-3 text-sm font-medium tracking-wide uppercase ${tone === "dark" ? "text-primary-light" : "text-primary"}`}
          >
            {eyebrow}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: PrimaryCta** — client; reuse `AnonCaptureModal` (props `{ featureName, returnTo, onDismiss }`) with local open state; stamp `cta.click`.

```tsx
// app/components/home/landing-v2/PrimaryCta.tsx
"use client";
import { useState } from "react";
import { AnonCaptureModal } from "@/components/entitlements/AnonCaptureModal";
import { trackEvent } from "@/lib/analytics/tracker";

export function PrimaryCta({
  source,
  label = "Start free — no card",
}: {
  source: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          trackEvent("cta.click", { source });
          setOpen(true);
        }}
        className="inline-flex items-center justify-center rounded-full bg-primary px-7 h-14 text-on-primary font-medium shadow-sm transition-colors duration-200 hover:bg-primary-medium"
      >
        {label}
      </button>
      <p className="mt-2 text-xs text-on-surface-variant">
        Every account starts on Pro. Cancel anytime.
      </p>
      {open && (
        <AnonCaptureModal
          featureName="PropertyIQ Pro"
          returnTo="/map"
          onDismiss={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Commit** — `git add ... && git commit -m "feat(landing): reveal wrapper, beat-section shell, primary CTA"`

---

## PHASE 2 — The 8 Beats

> **Before each beat: invoke `frontend-design:frontend-design`.** This plan fixes each beat's _responsibility, data source, copy, motion, layout intent, and acceptance_; the design skill governs the _visual craft_ (exact spacing, type scale, micro-interactions) within the M3/brand system. Where a beat has behavior (sticky mechanic, tab control, dynamic data) the code/logic below is authoritative. Each beat is one task: build component → mount in `home-v2/page.tsx` in order → verify in browser → commit.

### Task 2.1 — Beat 1: Hero (verdict-first, dynamic contrast, LCP element)

**Files:** Create `app/components/home/landing-v2/BeatHero.tsx`. Modify `home-v2/page.tsx` (server-fetch `fetchHeroContrast`, pass to hero).

**Interfaces:** Consumes `fetchHeroContrast()` (server, in `page.tsx`) and `ScoreDisplay` (presentational, prop `value`). Hero receives `contrast: HeroContrast | null` as a prop — **no client fetch in the hero** (LCP). Renders two `ScoreDisplay` rings server-side with values already in hand.

**Copy (evergreen template, real numbers injected):**

- Eyebrow: `THE VERDICT, FIRST`
- H1 (the LCP text, static): `Don't buy a market on its reputation.`
- Sub: `{cooler.name} scores {cooler.score} and dropped {abs(cooler.delta)} points in three months. {riser.name} quietly climbed to {riser.score}. The PropertyIQ Score tells you which markets are actually moving — before you commit.`
- Two labeled rings: left "Cooling: {cooler.name}" (value `cooler.score`, ▼{abs delta}), right "Heating up: {riser.name}" (value `riser.score`, ▲{delta}). Small "as of {asOf}" attribution (required by data terms).
- Primary CTA (`<PrimaryCta source="hero" />`). One secondary text link "See how the Score works" → anchors to Beat 4.
- **Fallback when `contrast === null`:** render static copy with no rings ("Score every U.S. market on one 1–99 scale.") so the hero never blocks on data.

**Motion:** none on load (LCP). Rings are static server HTML.

- [ ] Step 1: Invoke `frontend-design`. Step 2: Build `BeatHero.tsx` per copy/structure above; H1 + sub + signals full-opacity in SSR (no reveal gating on hero text). Step 3: In `page.tsx`, `const contrast = await fetchHeroContrast();` then `<BeatHero contrast={contrast} />`. Step 4: Browser-verify at desktop+mobile with live data — hero paints instantly, shows real cooler/riser, CTA opens modal. Step 5: Confirm hero `<h1>` is the LCP element (DevTools Performance/Lighthouse) — no regression vs A. Step 6: Commit.

### Task 2.2 — Beat 2: The Tension

**Files:** `BeatTension.tsx`. **Tone:** dark (top of gradient).
**Point (one):** picking a market on gut feel is guessing — the sources disagree and there are too many markets.
**Copy:** Eyebrow `THE PROBLEM`. Headline `Zillow says one thing. Realtor.com says another. You're supposed to just... know?`. Body: three tight lines (PAS agitate) — `~935 metros. 3,150 counties. 34,000 ZIPs.` / `Conflicting numbers from every source.` / `One wrong market sets you back years.` No CTA (tension beat). **Motion:** `Reveal` fade-up, 70ms stagger on the three lines.

- [ ] Steps: frontend-design → build → mount → browser-verify (reduced-motion shows instant) → commit.

### Task 2.3 — Beat 3: The Foundation (scale = credibility)

**Files:** `BeatFoundation.tsx`. **Tone:** dark→transition.
**Point:** we cover everything, from five real sources.
**Copy:** Eyebrow `THE FOUNDATION`. Headline `Every market. Five sources. One number.` Count-up stat row using `AnimatedCounter`: `935 metros`, `3,150 counties`, `34,000 ZIPs`, `2001 history start`. Source line: `Zillow · Realtor.com · Census · FRED · BLS`. **Motion:** `AnimatedCounter` triggers on enter (`duration-600`), below fold only.

- [ ] Steps: frontend-design → build (reuse `AnimatedCounter` from `app/components/home/AnimatedCounter`) → mount → verify count-ups fire on scroll + collapse under reduced-motion → commit.

### Task 2.4 — Beat 4: The Score (sticky centerpiece)

**Files:** `BeatScore.tsx`. **Tone:** transition.
**Point:** one number, 1–99, 50 = your state's average, confidence is separate.
**Mechanic:** two-column on desktop — left column the Score ring pinned with `position: sticky; top: 20vh`; right column three stacked copy panels (each ~80vh tall) that scroll past. On mobile: ring on top (sticky relaxed/static), copy panels below. The ring features the **live cooler** (dynamic) via client `ScoreWidget` (below fold → client fetch OK).
**The three copy panels (scroll past the pinned ring):**

1. `One number. 1 to 99.` — "Every market gets a single PropertyIQ Score from its demand signal — momentum, days-on-market, and price cuts, distilled."
2. `50 is your state's average.` — "The Score is computed nationally across every market, then calibrated so 50 equals your state's average performance. Above 50 means it's outpacing its state; below means it's lagging." (CLAUDE.md §9 — do NOT say "ranked within state.")
3. `Confidence is separate.` — "An A–F confidence grade tells you how complete the data is — independent of the score itself. A strong score with thin data still says so."
   **Code (sticky skeleton):**

```tsx
"use client";
import { ScoreWidget } from "@/app/components/scoring/ScoreWidget";
// props: { coolerCbsa: string }  (passed from page.tsx contrast.cooler.cbsa; fallback a constant)
// layout:
// <div className="grid md:grid-cols-2 gap-8">
//   <div className="md:sticky md:top-[20vh] md:h-[60vh] flex items-center justify-center">
//     <ScoreWidget geographyType="metro" geographyId={coolerCbsa} scoreType="propertyiq" showConfidence size={220} />
//   </div>
//   <div className="space-y-[60vh] md:space-y-[70vh]"> {/* three Reveal panels */} </div>
// </div>
```

**Motion:** native CSS sticky only (NO scroll-jacking). Copy panels use `Reveal`. CTA `<PrimaryCta source="after_score" />` at the end of the beat.

- [ ] Steps: frontend-design → build sticky two-col + mobile stack → mount with `coolerCbsa={contrast?.cooler.cbsa ?? '12420'}` → browser-verify the ring pins while copy scrolls and releases at section end, on desktop AND mobile (stacks) → reduced-motion: panels instant, sticky still fine → commit.

### Task 2.5 — Beat 5: See It On The Map

**Files:** `BeatMap.tsx`. **Point:** the Score is spatial — here's the cooler market on the map.
**Approach (v1, low-risk):** reuse the existing `MapShowcase` pattern (lazy-loads mapbox on scroll) embedded in the beat, centered on the live cooler metro, with a single scripted `flyTo`/zoom triggered once on scroll-enter (via `useInView`), then released. Do NOT build the full cinematic satellite/spotlight here — that is the separate `NEXT_PUBLIC_CINEMATIC_ZOOM` spec (`2026-06-20-map-cinematic-geo-zoom-design.md`); if/when that ships, this beat can opt into it. Copy: `It's not a spreadsheet. It's a map.` + one line. CTA secondary "Explore the full map" → `/map`.
**Motion:** one fly on enter; reduced-motion → static framed map (jumpTo), no animation.

- [ ] Steps: frontend-design → build (reuse MapShowcase; pass cooler center; gate the fly behind `useInView` + reduced-motion check) → mount → verify map lazy-loads on scroll, flies once, no first-load cost (map JS not in initial bundle) → commit.

### Task 2.6 — Beat 6: Proof

**Files:** `BeatProof.tsx`. **Point:** it's validated — backtested, with a named author.
**Copy (real backtest facts only — CLAUDE.md §9):** Eyebrow `THE PROOF`. Headline `We backtested it. Here's what held up.` Body: `Markets scoring 45–55 realized roughly zero excess return versus their state. Higher-scoring markets outperformed their state; lower-scoring ones lagged.` Small chart: a simple SVG/Recharts scatter or bar showing score-bucket vs excess return (use real backtest numbers from `docs/superpowers/results/` score-backtest docs — pull exact figures at build; if unavailable, show the 45–55≈0 band qualitatively, NO invented points). Named author + methodology link (E-E-A-T). **Hidden** social-proof slot component mounted here, rendering nothing until real assets exist. **Motion:** chart `Reveal` fade-in. CTA `<PrimaryCta source="after_proof" />`.

- [ ] Steps: frontend-design → pull real backtest figures from results docs → build chart (no fabricated points) → mount + hidden `BeatSocialProofSlot` → verify → commit.

### Task 2.7 — Beat 7: Persona Branch (4 co-equal tabs, real output)

**Files:** `BeatPersona.tsx`, `persona/PersonaTabs.tsx`, `persona/snapshots/*` (static captures), `app/components/home/landing-v2/snapshots/` (frozen output assets).
**Point:** here's what YOU do with it — shown as real product output, not feature blurbs.
**Tabs (default Investor):** Investor → Deal Analyzer verdict snapshot; Agent → Report snapshot; First-time buyer → Affordability/rent-vs-own snapshot; Power user → **real MCP query→response exchange** snapshot. Each panel leads with the marquee feature as **real frozen output** (§6) for a fixed snapshot market (default **Austin** — iconic; independent of the dynamic hero pair).
**Control:** real segmented control — roving tabindex / radio semantics, arrow-key navigable, `aria-selected`. NOT divs. 200ms opacity cross-fade on switch.
**MCP tab copy framing:** "PropertyIQ where you already work — Claude, MCP, and the API," with plain-language gloss ("ask your AI assistant about any market and it answers from our data"). The shown exchange is a real captured MCP tool call + response (capture in the step below using the live MCP tools — a genuine run, frozen).
**Snapshot capture (real, not mocked):**

- [ ] Step A: Capture the MCP exchange — run a real PropertyIQ MCP tool (e.g. `get_market_snapshot`/`get_propertyiq_score` for Austin) and freeze the actual request+response as a static asset.
- [ ] Step B: Capture the Deal Analyzer verdict — run a real property through the analyzer for the snapshot market; freeze the cashflow + deal-grade output.
- [ ] Step C: Capture the Report — freeze a real listing-presentation/market-report view.
- [ ] Step D: Capture the affordability/rent-vs-own view — freeze a real output.
- [ ] Step E: frontend-design → build `PersonaTabs` (a11y segmented control) + four panels rendering the frozen captures → mount (Investor default) → verify keyboard nav + cross-fade + all four real outputs render → CTA `<PrimaryCta source="after_persona" />` → commit.

### Task 2.8 — Beat 8 (+ supporting): Data-depth, Pricing, Close

**Files:** `BeatDataDepth.tsx`, `BeatPricing.tsx`, `BeatClose.tsx`. **Tone:** light (bottom of gradient).

- **Data-depth** (supporting, brief): one line on history depth + freshness; small Reveal. No CTA.
- **Pricing** (supporting): reuse `PricingSection`'s data via `usePricingTiers()` (do not re-fetch); compact tier presentation; value framing "less than one bad weekend of due diligence." Risk-reversal line.
- **Close:** Headline `Stop guessing which market. Start knowing.` Single `<PrimaryCta source="close" />`, reverse-trial framing. Quiet `Reveal` fade-up.
- [ ] Steps: frontend-design → build the three → mount in order → verify → commit.

---

## PHASE 3 — Assembly, SEO Carryover, Measurement

### Task 3.1: Final B-page assembly + ordering

- [ ] Compose `home-v2/page.tsx` top-to-bottom: `VariantStamp` → `BeatHero` → `BeatTension` → `BeatFoundation` → `BeatScore` → `BeatMap` → `BeatProof` → (`BeatSocialProofSlot` hidden) → `BeatPersona` → `BeatDataDepth` → `BeatPricing` → `BeatClose` → reuse `Footer`. Server-fetch `fetchHeroContrast()` once, thread `contrast` to Hero + Beat 4. Verify one continuous funnel renders. Commit.

### Task 3.2: SEO carryover (verbatim) + verification

- [ ] Extract A's `metadata` object from `app/(app)/page.tsx` into a shared `app/components/home/landing-metadata.ts`; import it in BOTH A's `page.tsx` (no value change) and `home-v2/layout.tsx` (spread + add `robots: noindex` for direct hits). Confirm canonical stays `https://www.propertyiq.app`, OG unchanged, `JsonLd` identical.
- [ ] **Verify in built HTML** (not dev): `NEXT_DIST_DIR=.next-verify npm --prefix packages/frontend run build` then inspect the rendered `/home-v2` HTML for: identical `<title>`, canonical, OG tags as A, plus `robots noindex`. (Per the next-build-clobbers-dev rule, build to `.next-verify`, never the running `.next`.) Commit.

### Task 3.3: Funnel event wiring + readout query

- [ ] Confirm events stamped with `variant`: `home.view` (Task 0.4), `cta.click` (PrimaryCta), anon-capture (AnonCaptureModal already fires `feature/anon-capture/view|click_upgrade` — confirm variant rides along via `setVariant`), and signup completion (verify the signup-complete event carries the cookie-derived variant; if signup happens after navigation away from `/`, read `piq-variant` cookie at signup and include it).
- [ ] Add `<VariantStamp variant="A" />` to A's `page.tsx` (the single allowed additive edit) so A pageviews are measured too.
- [ ] Write `docs/superpowers/results/2026-06-20-landing-v2-measurement.sql` using the REAL column path (`properties->>'variant'`), verified against `user_events` live schema:

```sql
select properties->>'variant' as variant,
       count(*) filter (where event_name = 'view'      and event_category='home')   as visitors,
       count(*) filter (where event_name = 'click'     and event_category='cta')    as cta_clicks,
       count(*) filter (where event_action = 'signup_completed')                    as conversions
from user_events
where created_at >= now() - interval '14 days'
  and properties->>'variant' in ('A','B')
group by 1;
```

> Verify exact `event_name`/`event_category`/`event_action` decomposition against the tracker (it splits `category.action`) and the real signup-complete event name in `user_events` before finalizing. Commit.

---

## PHASE 4 — Verification (live data, real browser)

### Task 4.1: Playwright e2e — desktop + mobile, live data

- [ ] `tests/e2e/landing-v2.spec.ts`: with `LANDING_EXPERIMENT=on` (or `?landing=v2`), at desktop (1440) and mobile (390) widths against the running app with LIVE data (no mocks): hero shows real cooler/riser rings; all 8 beats render top-to-bottom; Beat 4 ring pins then releases; persona tabs switch via keyboard; CTA opens AnonCaptureModal. Capture screenshots.

### Task 4.2: Accessibility + motion

- [ ] With `prefers-reduced-motion: reduce` emulated: all reveals/count-ups/sticky transitions show instant final states; map jump-cuts; nothing hidden. Persona control fully keyboard-operable (Tab/Arrows/Enter), `aria-selected` correct.

### Task 4.3: SEO + CWV gates

- [ ] Built-HTML check (Task 3.2) passes: metadata/JsonLd/canonical/OG identical to A; `/home-v2` direct = noindex; rewritten `/` = indexable A-equivalent, no duplicate URL.
- [ ] Lighthouse on B vs A: hero is LCP element; LCP/INP/CLS no worse than A. No GSAP/WebGL/scroll-jacking in the bundle (grep deps; confirm no scroll-snap-trap).

### Task 4.4: Flag matrix

- [ ] Exercise each mode against the running app: `off`→everyone A; `preview`→A unless `?landing=v2`; `ab:50`→sticky split (same visitor same variant across reloads via cookie); `on`→everyone B. Confirm no redeploy needed to switch (env change only) and `off` is instant rollback.

---

## Self-Review (run after build, before promotion)

1. **Spec coverage:** every §11 acceptance bullet maps to a task — control-intact (0.x), flag modes (0.1/0.2/4.4), instant rollback (4.4), server-side no-flash assignment (0.2), noindex/no-dup (0.3/3.2/4.3), variant in user_events + readout (0.4/3.3), deferred cleanup (Global Constraints), 8-beat funnel (Phase 2/3.1), conversion best-practices (PrimaryCta repetition + PAS ordering across beats), real-output persona (2.7), no per-visit regen (hero ISR + static snapshots), sticky Beat 4 (2.4), map moment (2.5), real-proof-only (2.6), §9 score copy (2.4), SEO carryover (3.2/4.3), reduced-motion (4.2), LCP hero (2.1/4.3), no GSAP/WebGL/scroll-jack (4.3), live-browser verify (4.1).
2. **Open items to resolve at build:** exact `ScoreResult.history`/`confidence_level` JSON path (1.2 step 3); real backtest figures for Beat 6 (2.6); real signup-complete event name (3.3); snapshot market confirm (Austin default).
3. **Deferred (explicit follow-up, not this plan):** delete old homepage + 7 dead `home/*` components AFTER flag promoted to `on`.

---

## Execution Handoff

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks. Note: per the user's parallel-pipelined-subagents preference, independent tasks within a phase (e.g. several Phase 2 beats) can run as true parallel agents staging only their own files, with index.lock retry on commit.
2. **Inline Execution** — batch with checkpoints via `superpowers:executing-plans`.

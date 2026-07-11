# Market Page Internal Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the SEO market pages (metro/county/ZIP/state) real cross-tier internal linking — metro→county→ZIP down-links, full breadcrumb chains, and a consolidated same-tier linking component — replacing four copy-pasted inline blocks and adding three new "view all" overflow pages.

**Architecture:** One new pure data-layer module (`lib/data/market-hierarchy.ts`) builds parent→children reverse indexes and full ancestor chains from the _existing_ slug data (no new generation step). Two new shared presentational components (`MarketBreadcrumbs`, `MarketRelatedLinks`) consume that data and replace the duplicated inline blocks in all four page types. Three new statically-generated routes give large metros/counties a genuine "view all" destination. Sitemap and de-scored-redirect generation are extended to cover the new routes.

**Tech Stack:** Next.js App Router (Server Components + one "use client" boundary per page type), TypeScript, Vitest + `@testing-library/react` for unit tests.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-market-internal-linking-design.md`.
- No new data generation step — reverse indexes are built from existing `metro-slug-data.ts` / `county-slug-data.ts` / `zip-slug-data.ts`, which already carry `cbsaCode`/`countyFips` parent pointers.
- Hierarchy relationships only — no lat/long proximity, no new geo data sourced (per spec §2 Non-Goals).
- Display/overflow cap is **12** everywhere (`MARKET_LINKS_DISPLAY_CAP`), matching the existing `state/[state]/page.tsx` `ZIP_DISPLAY_CAP`.
- A "view all" link — and the overflow page it points to — is generated **only** when a parent has more than 12 children. A parent at or under the cap gets no overflow page (avoids duplicate/thin content).
- Import alias: `@/app/markets/components/...` resolves to `app/(public)/markets/components/...` (confirmed via `packages/frontend/tsconfig.json` `paths`). Use this exact alias form, not `@/app/(public)/markets/...`.
- Test runner: `vitest` (via `npm --prefix packages/frontend run test:unit -- <pattern>`). Follow the existing style in `app/(public)/markets/components/__tests__/MarketStatsBlock.test.tsx` — `container.querySelector`/`toBeTruthy()`/`toEqual()`, not `@testing-library/jest-dom` matchers (not confirmed registered globally).
- Git: work happens on `develop` (confirm with `git branch --show-current` before each commit). No `Co-Authored-By` trailer in commits.

---

### Task 1: `market-hierarchy.ts` — reverse indexes + ancestor chains

**Files:**

- Create: `packages/frontend/lib/data/market-hierarchy.ts`
- Create: `packages/frontend/lib/data/__tests__/market-hierarchy.test.ts`

**Interfaces:**

- Produces: `MARKET_LINKS_DISPLAY_CAP: number`, `getCountiesForMetro(cbsaCode: string): CountySlugEntry[]`, `getZipsForMetro(cbsaCode: string): ZipSlugEntry[]`, `getZipsForCounty(countyFips: string): ZipSlugEntry[]`, `getAncestorChainForMetro(metro: MetroSlugEntry): AncestorChain`, `getAncestorChainForCounty(county: CountySlugEntry): AncestorChain`, `getAncestorChainForZip(zip: ZipSlugEntry): AncestorChain`, and the `AncestorChain` interface (`{ state: StateSlugEntry | null; metro: MetroSlugEntry | null; county: CountySlugEntry | null }`). Every later task in this plan imports from this module.

- [ ] **Step 1: Write the failing test**

Create `packages/frontend/lib/data/__tests__/market-hierarchy.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../metro-slug-data", () => ({
  METRO_SLUG_DATA: [
    {
      cbsaCode: "12345",
      slug: "test-metro-tx",
      name: "Test Metro, TX",
      shortName: "Test Metro, TX",
      state: "TX",
    },
  ],
  CBSA_TO_METRO: new Map([
    [
      "12345",
      {
        cbsaCode: "12345",
        slug: "test-metro-tx",
        name: "Test Metro, TX",
        shortName: "Test Metro, TX",
        state: "TX",
      },
    ],
  ]),
}));

vi.mock("../county-slug-data", () => ({
  COUNTY_SLUG_DATA: [
    {
      fips: "48001",
      slug: "test-county-tx",
      name: "Test County",
      shortName: "Test County, TX",
      state: "TX",
      cbsaCode: "12345",
    },
    {
      fips: "48002",
      slug: "rural-county-tx",
      name: "Rural County",
      shortName: "Rural County, TX",
      state: "TX",
      cbsaCode: null,
    },
  ],
  FIPS_TO_COUNTY: new Map([
    [
      "48001",
      {
        fips: "48001",
        slug: "test-county-tx",
        name: "Test County",
        shortName: "Test County, TX",
        state: "TX",
        cbsaCode: "12345",
      },
    ],
    [
      "48002",
      {
        fips: "48002",
        slug: "rural-county-tx",
        name: "Rural County",
        shortName: "Rural County, TX",
        state: "TX",
        cbsaCode: null,
      },
    ],
  ]),
}));

vi.mock("../zip-slug-data", () => ({
  ZIP_SLUG_DATA: [
    {
      zip: "78701",
      slug: "78701-austin-tx",
      name: "78701 (Austin)",
      shortName: "78701, Austin, TX",
      state: "TX",
      countyFips: "48001",
      cbsaCode: "12345",
    },
    {
      zip: "78999",
      slug: "78999-nowhere-tx",
      name: "78999 (Nowhere)",
      shortName: "78999, Nowhere, TX",
      state: "TX",
      countyFips: "48002",
      cbsaCode: null,
    },
  ],
}));

import {
  getCountiesForMetro,
  getZipsForMetro,
  getZipsForCounty,
  getAncestorChainForMetro,
  getAncestorChainForCounty,
  getAncestorChainForZip,
} from "../market-hierarchy";
import { METRO_SLUG_DATA } from "../metro-slug-data";
import { COUNTY_SLUG_DATA } from "../county-slug-data";
import { ZIP_SLUG_DATA } from "../zip-slug-data";

describe("market-hierarchy", () => {
  it("getCountiesForMetro groups counties by cbsaCode", () => {
    expect(getCountiesForMetro("12345").map((c) => c.fips)).toEqual(["48001"]);
  });

  it("getCountiesForMetro returns an empty array for a metro with no counties", () => {
    expect(getCountiesForMetro("99999")).toEqual([]);
  });

  it("getZipsForMetro groups zips by cbsaCode, excluding zips with no cbsaCode", () => {
    expect(getZipsForMetro("12345").map((z) => z.zip)).toEqual(["78701"]);
  });

  it("getZipsForCounty groups zips by countyFips", () => {
    expect(getZipsForCounty("48002").map((z) => z.zip)).toEqual(["78999"]);
  });

  it("getAncestorChainForMetro resolves state only, no self-referential metro/county", () => {
    const chain = getAncestorChainForMetro(METRO_SLUG_DATA[0]);
    expect(chain.state?.abbrev).toBe("TX");
    expect(chain.metro).toBeNull();
    expect(chain.county).toBeNull();
  });

  it("getAncestorChainForCounty resolves the parent metro when cbsaCode is present", () => {
    const chain = getAncestorChainForCounty(COUNTY_SLUG_DATA[0]);
    expect(chain.state?.abbrev).toBe("TX");
    expect(chain.metro?.cbsaCode).toBe("12345");
  });

  it("getAncestorChainForCounty omits the metro tier for a non-CBSA county", () => {
    const chain = getAncestorChainForCounty(COUNTY_SLUG_DATA[1]);
    expect(chain.metro).toBeNull();
  });

  it("getAncestorChainForZip resolves both county and metro", () => {
    const chain = getAncestorChainForZip(ZIP_SLUG_DATA[0]);
    expect(chain.county?.fips).toBe("48001");
    expect(chain.metro?.cbsaCode).toBe("12345");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test:unit -- market-hierarchy`
Expected: FAIL — `Cannot find module '../market-hierarchy'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `packages/frontend/lib/data/market-hierarchy.ts`:

```ts
/**
 * Reverse-index lookups (parent -> children) and full ancestor-chain resolution
 * for the market page hierarchy (state -> metro -> county -> zip).
 *
 * Built from the existing forward-pointer slug data (a county/zip entry already
 * knows its own cbsaCode/countyFips) rather than a new generation step, so there
 * is exactly one source of truth for the hierarchy.
 */
import { makeLazyMap } from "./lazy-map";
import { CBSA_TO_METRO } from "./metro-slug-data";
import { COUNTY_SLUG_DATA, FIPS_TO_COUNTY } from "./county-slug-data";
import { ZIP_SLUG_DATA } from "./zip-slug-data";
import { ABBREV_TO_STATE } from "./state-slug-data";
import type { MetroSlugEntry } from "./metro-slugs";
import type { CountySlugEntry } from "./county-slugs";
import type { ZipSlugEntry } from "./zip-slugs";
import type { StateSlugEntry } from "./state-slug-data";

/** Shared cap for how many child links render inline before a "view all" link takes over. */
export const MARKET_LINKS_DISPLAY_CAP = 12;

const COUNTIES_BY_CBSA = makeLazyMap<string, CountySlugEntry[]>(() => {
  const map = new Map<string, CountySlugEntry[]>();
  for (const county of COUNTY_SLUG_DATA) {
    if (!county.cbsaCode) continue;
    const group = map.get(county.cbsaCode) ?? [];
    group.push(county);
    map.set(county.cbsaCode, group);
  }
  return map;
});

const ZIPS_BY_CBSA = makeLazyMap<string, ZipSlugEntry[]>(() => {
  const map = new Map<string, ZipSlugEntry[]>();
  for (const zip of ZIP_SLUG_DATA) {
    if (!zip.cbsaCode) continue;
    const group = map.get(zip.cbsaCode) ?? [];
    group.push(zip);
    map.set(zip.cbsaCode, group);
  }
  return map;
});

const ZIPS_BY_COUNTY_FIPS = makeLazyMap<string, ZipSlugEntry[]>(() => {
  const map = new Map<string, ZipSlugEntry[]>();
  for (const zip of ZIP_SLUG_DATA) {
    if (!zip.countyFips) continue;
    const group = map.get(zip.countyFips) ?? [];
    group.push(zip);
    map.set(zip.countyFips, group);
  }
  return map;
});

/** All counties belonging to a metro, in slug-data order. */
export function getCountiesForMetro(cbsaCode: string): CountySlugEntry[] {
  return COUNTIES_BY_CBSA.get(cbsaCode) ?? [];
}

/** All ZIPs belonging to a metro, in slug-data order. */
export function getZipsForMetro(cbsaCode: string): ZipSlugEntry[] {
  return ZIPS_BY_CBSA.get(cbsaCode) ?? [];
}

/** All ZIPs belonging to a county, in slug-data order. */
export function getZipsForCounty(countyFips: string): ZipSlugEntry[] {
  return ZIPS_BY_COUNTY_FIPS.get(countyFips) ?? [];
}

/**
 * Ancestors of the CURRENT page's geo, excluding the geo itself. A metro page's
 * chain has metro=null (the metro IS the page, not its own ancestor); a county
 * page's chain includes metro when the county belongs to one; a zip page's chain
 * includes both. Any tier can be null (non-CBSA county, ZIP with unresolved
 * county) — callers must render only the non-null tiers.
 */
export interface AncestorChain {
  state: StateSlugEntry | null;
  metro: MetroSlugEntry | null;
  county: CountySlugEntry | null;
}

export function getAncestorChainForMetro(metro: MetroSlugEntry): AncestorChain {
  return {
    state: ABBREV_TO_STATE.get(metro.state) ?? null,
    metro: null,
    county: null,
  };
}

export function getAncestorChainForCounty(
  county: CountySlugEntry,
): AncestorChain {
  const metro = county.cbsaCode
    ? (CBSA_TO_METRO.get(county.cbsaCode) ?? null)
    : null;
  return {
    state: ABBREV_TO_STATE.get(county.state) ?? null,
    metro,
    county: null,
  };
}

export function getAncestorChainForZip(zip: ZipSlugEntry): AncestorChain {
  const metro = zip.cbsaCode ? (CBSA_TO_METRO.get(zip.cbsaCode) ?? null) : null;
  const county = zip.countyFips
    ? (FIPS_TO_COUNTY.get(zip.countyFips) ?? null)
    : null;
  return { state: ABBREV_TO_STATE.get(zip.state) ?? null, metro, county };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test:unit -- market-hierarchy`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/data/market-hierarchy.ts packages/frontend/lib/data/__tests__/market-hierarchy.test.ts
git commit -m "feat(seo): add market-hierarchy reverse-index and ancestor-chain utility"
```

---

### Task 2: `MarketBreadcrumbs` shared component

**Files:**

- Create: `packages/frontend/app/(public)/markets/components/MarketBreadcrumbs.tsx`
- Create: `packages/frontend/app/(public)/markets/components/__tests__/MarketBreadcrumbs.test.tsx`

**Interfaces:**

- Consumes: `AncestorChain` from Task 1 (`@/lib/data/market-hierarchy`).
- Produces: `MarketBreadcrumbs({ chain, currentName, currentHref }: MarketBreadcrumbsProps)` — renders the visible breadcrumb nav (`<nav aria-label="Breadcrumb">`) AND a matching `BreadcrumbList` JSON-LD `<script>` from the same crumb list. Used by Tasks 4, 5, 6, 7, 8, 9, 10.

- [ ] **Step 1: Write the failing test**

Create `packages/frontend/app/(public)/markets/components/__tests__/MarketBreadcrumbs.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarketBreadcrumbs } from "../MarketBreadcrumbs";
import type { AncestorChain } from "@/lib/data/market-hierarchy";

const stateEntry = { abbrev: "TX", slug: "texas", name: "Texas" };
const metroEntry = {
  cbsaCode: "12345",
  slug: "test-metro-tx",
  name: "Test Metro, TX",
  shortName: "Test Metro, TX",
  state: "TX",
};
const countyEntry = {
  fips: "48001",
  slug: "test-county-tx",
  name: "Test County",
  shortName: "Test County, TX",
  state: "TX",
  cbsaCode: "12345",
};

describe("MarketBreadcrumbs", () => {
  it("renders Home / Markets / State for a metro page (no self-referential metro crumb)", () => {
    const chain: AncestorChain = {
      state: stateEntry,
      metro: null,
      county: null,
    };
    const { container, getByText } = render(
      <MarketBreadcrumbs
        chain={chain}
        currentName="Test Metro, TX"
        currentHref="/markets/test-metro-tx"
      />,
    );
    const links = container.querySelectorAll("nav a");
    expect(Array.from(links).map((a) => a.textContent)).toEqual([
      "Home",
      "Markets",
      "Texas",
    ]);
    expect(getByText("Test Metro, TX")).toBeTruthy();
  });

  it("renders the full chain (state, metro, county) for a ZIP page", () => {
    const chain: AncestorChain = {
      state: stateEntry,
      metro: metroEntry,
      county: countyEntry,
    };
    const { container } = render(
      <MarketBreadcrumbs
        chain={chain}
        currentName="78701, Austin, TX"
        currentHref="/markets/zip/78701-austin-tx"
      />,
    );
    const links = container.querySelectorAll("nav a");
    expect(Array.from(links).map((a) => a.textContent)).toEqual([
      "Home",
      "Markets",
      "Texas",
      "Test Metro, TX",
      "Test County, TX",
    ]);
  });

  it("emits a matching BreadcrumbList JSON-LD script", () => {
    const chain: AncestorChain = {
      state: stateEntry,
      metro: null,
      county: null,
    };
    const { container } = render(
      <MarketBreadcrumbs
        chain={chain}
        currentName="Test Metro, TX"
        currentHref="/markets/test-metro-tx"
      />,
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).toBeTruthy();
    const jsonLd = JSON.parse(script!.innerHTML);
    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement).toHaveLength(4);
    expect(jsonLd.itemListElement[3]).toMatchObject({
      position: 4,
      name: "Test Metro, TX",
      item: "https://www.propertyiq.app/markets/test-metro-tx",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test:unit -- MarketBreadcrumbs`
Expected: FAIL — `Cannot find module '../MarketBreadcrumbs'`.

- [ ] **Step 3: Write the implementation**

Create `packages/frontend/app/(public)/markets/components/MarketBreadcrumbs.tsx`:

```tsx
import Link from "next/link";
import type { AncestorChain } from "@/lib/data/market-hierarchy";

const BASE_URL = "https://www.propertyiq.app";

interface Crumb {
  name: string;
  href: string;
}

function buildCrumbs(
  chain: AncestorChain,
  currentName: string,
  currentHref: string,
): Crumb[] {
  const crumbs: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "Markets", href: "/markets" },
  ];
  if (chain.state) {
    crumbs.push({
      name: chain.state.name,
      href: `/markets/state/${chain.state.slug}`,
    });
  }
  if (chain.metro) {
    crumbs.push({
      name: chain.metro.shortName,
      href: `/markets/${chain.metro.slug}`,
    });
  }
  if (chain.county) {
    crumbs.push({
      name: chain.county.shortName,
      href: `/markets/county/${chain.county.slug}`,
    });
  }
  crumbs.push({ name: currentName, href: currentHref });
  return crumbs;
}

export interface MarketBreadcrumbsProps {
  chain: AncestorChain;
  currentName: string;
  currentHref: string;
}

/**
 * Full ancestor-chain breadcrumb (Home / Markets / State / Metro / County / current),
 * skipping any tier absent from `chain`. Renders the visible nav AND the matching
 * BreadcrumbList JSON-LD from the same crumb list, so they cannot drift apart.
 */
export function MarketBreadcrumbs({
  chain,
  currentName,
  currentHref,
}: MarketBreadcrumbsProps) {
  const crumbs = buildCrumbs(chain, currentName, currentHref);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${BASE_URL}${crumb.href}`,
    })),
  };

  return (
    <>
      <nav
        className="text-sm text-on-surface-variant mb-6"
        aria-label="Breadcrumb"
      >
        {crumbs.map((crumb, index) => (
          <span key={crumb.href}>
            {index > 0 && <span className="mx-2">/</span>}
            {index === crumbs.length - 1 ? (
              <span className="text-on-surface font-medium">{crumb.name}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-primary">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <script
        type="application/ld+json"
        // Safe: JSON.stringify of a server-built object with no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test:unit -- MarketBreadcrumbs`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(public)/markets/components/MarketBreadcrumbs.tsx" "packages/frontend/app/(public)/markets/components/__tests__/MarketBreadcrumbs.test.tsx"
git commit -m "feat(seo): add shared MarketBreadcrumbs component with matching JSON-LD"
```

---

### Task 3: `MarketRelatedLinks` shared component

**Files:**

- Create: `packages/frontend/app/(public)/markets/components/MarketRelatedLinks.tsx`
- Create: `packages/frontend/app/(public)/markets/components/__tests__/MarketRelatedLinks.test.tsx`

**Interfaces:**

- Produces: `RelatedLink { key, label, href }`, `RelatedLinkGroup { label, links, viewAllHref?, viewAllCount? }`, `buildLinkGroup(label, items, cap, viewAllHref): RelatedLinkGroup`, `MarketRelatedLinks({ groups }: { groups: RelatedLinkGroup[] })`. Used by Tasks 4, 5, 6.

- [ ] **Step 1: Write the failing test**

Create `packages/frontend/app/(public)/markets/components/__tests__/MarketRelatedLinks.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarketRelatedLinks, buildLinkGroup } from "../MarketRelatedLinks";

describe("buildLinkGroup", () => {
  const items = Array.from({ length: 15 }, (_, i) => ({
    key: `item-${i}`,
    label: `Item ${i}`,
    href: `/markets/item-${i}`,
  }));

  it("caps links to the given limit and sets viewAll fields when items exceed the cap", () => {
    const group = buildLinkGroup("Test Group", items, 12, "/markets/view-all");
    expect(group.links).toHaveLength(12);
    expect(group.viewAllHref).toBe("/markets/view-all");
    expect(group.viewAllCount).toBe(15);
  });

  it("omits viewAll fields when items fit within the cap", () => {
    const group = buildLinkGroup(
      "Test Group",
      items.slice(0, 5),
      12,
      "/markets/view-all",
    );
    expect(group.links).toHaveLength(5);
    expect(group.viewAllHref).toBeUndefined();
    expect(group.viewAllCount).toBeUndefined();
  });
});

describe("MarketRelatedLinks", () => {
  it("renders each non-empty group with its links and view-all link", () => {
    const { container, getByText } = render(
      <MarketRelatedLinks
        groups={[
          {
            label: "Counties in this metro",
            links: [
              {
                key: "a",
                label: "Alpha County",
                href: "/markets/county/alpha",
              },
            ],
            viewAllHref: "/markets/test-metro/counties",
            viewAllCount: 20,
          },
          { label: "Empty group", links: [] },
        ]}
      />,
    );
    expect(getByText("Counties in this metro")).toBeTruthy();
    expect(getByText("Alpha County")).toBeTruthy();
    expect(getByText("View all 20 →")).toBeTruthy();
    expect(
      container.querySelectorAll('a[href="/markets/county/alpha"]'),
    ).toHaveLength(1);
    expect(() => getByText("Empty group")).toThrow();
  });

  it("renders nothing when every group is empty", () => {
    const { container } = render(
      <MarketRelatedLinks groups={[{ label: "Empty", links: [] }]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test:unit -- MarketRelatedLinks`
Expected: FAIL — `Cannot find module '../MarketRelatedLinks'`.

- [ ] **Step 3: Write the implementation**

Create `packages/frontend/app/(public)/markets/components/MarketRelatedLinks.tsx`:

```tsx
import Link from "next/link";

export interface RelatedLink {
  key: string;
  label: string;
  href: string;
}

export interface RelatedLinkGroup {
  label: string;
  links: RelatedLink[];
  viewAllHref?: string;
  viewAllCount?: number;
}

/**
 * Caps `items` to `cap` and sets `viewAllHref`/`viewAllCount` only when there are
 * more items than fit — the "view all" link is omitted entirely when the capped
 * list already shows everything (an overflow page identical to the inline list
 * would be redundant).
 */
export function buildLinkGroup(
  label: string,
  items: RelatedLink[],
  cap: number,
  viewAllHref: string,
): RelatedLinkGroup {
  const shown = items.slice(0, cap);
  const remaining = items.length - shown.length;
  return {
    label,
    links: shown,
    viewAllHref: remaining > 0 ? viewAllHref : undefined,
    viewAllCount: remaining > 0 ? items.length : undefined,
  };
}

export interface MarketRelatedLinksProps {
  groups: RelatedLinkGroup[];
}

/** Renders each non-empty link group (down-tier children, same-tier nearby markets) as a pill list, with an optional "View all N" link. */
export function MarketRelatedLinks({ groups }: MarketRelatedLinksProps) {
  const visible = groups.filter((group) => group.links.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="mt-8 space-y-8">
      {visible.map((group) => (
        <div key={group.label}>
          <h3 className="text-base font-medium text-on-surface mb-3">
            {group.label}
          </h3>
          <div className="flex flex-wrap gap-2">
            {group.links.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="px-4 py-2 rounded-full bg-surface-container-low text-on-surface text-sm hover:bg-surface-container-high transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          {group.viewAllHref && group.viewAllCount !== undefined && (
            <Link
              href={group.viewAllHref}
              className="inline-block mt-2 text-sm text-on-surface-variant hover:text-primary underline underline-offset-4"
            >
              View all {group.viewAllCount} →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test:unit -- MarketRelatedLinks`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(public)/markets/components/MarketRelatedLinks.tsx" "packages/frontend/app/(public)/markets/components/__tests__/MarketRelatedLinks.test.tsx"
git commit -m "feat(seo): add shared MarketRelatedLinks component with capped view-all groups"
```

---

### Task 4: Wire breadcrumbs + down-links into the metro page

**Files:**

- Modify: `packages/frontend/app/(public)/markets/[slug]/page.tsx`
- Modify: `packages/frontend/app/(public)/markets/[slug]/MetroPageContent.tsx`

**Interfaces:**

- Consumes: `getAncestorChainForMetro`, `getCountiesForMetro`, `getZipsForMetro`, `MARKET_LINKS_DISPLAY_CAP` (Task 1); `MarketBreadcrumbs` (Task 2); `MarketRelatedLinks`, `buildLinkGroup` (Task 3).

- [ ] **Step 1: Replace `packages/frontend/app/(public)/markets/[slug]/page.tsx` in full**

```tsx
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { METRO_SLUG_DATA, SLUG_TO_METRO } from "@/lib/data/metro-slug-data";
import { resolveMetroAlias } from "@/lib/data/market-slug-aliases";
import {
  fetchSeoMarketStats,
  fetchRankings,
  fetchCachedInsight,
} from "@/lib/data";
import {
  buildMarketTitle,
  buildMarketDescription,
  buildMarketOgImagePath,
} from "@/lib/seo/market-metadata";
import { MarketStatsBlock } from "@/app/markets/components/MarketStatsBlock";
import { buildStatsJsonLd } from "@/app/markets/components/buildStatsJsonLd";
import { MarketFaqSection } from "@/app/markets/components/MarketFaqSection";
import { buildMarketFaqs } from "@/app/markets/components/build-market-faqs";
import {
  MarketRelatedLinks,
  buildLinkGroup,
} from "@/app/markets/components/MarketRelatedLinks";
import {
  getAncestorChainForMetro,
  getCountiesForMetro,
  getZipsForMetro,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
import { MetroPageContent } from "./MetroPageContent";
import { generateMarketSeoContent } from "./generate-seo-content";

// Pre-render a bounded set at build; the long tail renders on-demand via ISR (dynamicParams default true) to avoid OOM from per-page server fetches.
export function generateStaticParams() {
  return METRO_SLUG_DATA.slice(0, 150).map((metro) => ({ slug: metro.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) return {};

  const pageUrl = `https://www.propertyiq.app/markets/${metro.slug}`;

  // Stats (24h-cached; also used by the page body, so this is a cache hit) feed
  // data-interpolated title + description so each page is data-distinct, not
  // micro-boilerplate Google would rewrite.
  const stats = await fetchSeoMarketStats("metro", metro.cbsaCode, metro.state);
  const title = buildMarketTitle(metro.shortName, stats);
  const description = buildMarketDescription(metro.shortName, stats);
  const ogImageUrl = buildMarketOgImagePath(metro.shortName, stats);

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: "website",
      url: pageUrl,
      title: `${title} | PropertyIQ`,
      description,
      siteName: "PropertyIQ",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${metro.shortName} Housing Market Analysis - PropertyIQ`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours
export const dynamicParams = true;

export default async function MetroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) {
    // A natural city-name slug ("charlotte-nc") isn't canonical, but it
    // unambiguously points at one metro page ("charlotte-concord-gastonia-nc-sc").
    // 308-redirect to canonical instead of 404, mirroring the bare-ZIP route.
    const canonical = resolveMetroAlias(slug);
    if (canonical) permanentRedirect(`/markets/${canonical}`);
    notFound();
  }

  const chain = getAncestorChainForMetro(metro);

  const stats = await fetchSeoMarketStats("metro", metro.cbsaCode, metro.state);
  const seoContent = generateMarketSeoContent(metro, stats);

  // Same OG card the meta tags reference, embedded as a real, alt-bearing image
  // so non-JS AI crawlers (GPTBot/ClaudeBot/PerplexityBot) see an actual visual
  // of this market's data — not just a <meta> link. Absolute URL for the schema.
  const ogImagePath = buildMarketOgImagePath(metro.shortName, stats);
  const ogImageUrl = `https://www.propertyiq.app${ogImagePath}`;
  const ogImageAlt = `${metro.shortName} housing market snapshot from PropertyIQ — median home price, year-over-year appreciation, median days on market, and PropertyIQ demand score.`;

  // Cache-only narrative for SSR: surfaces the pre-generated AI market overview
  // into the initial HTML when one exists, and NEVER triggers a paid generation
  // during ISR (cachedOnly=1). Null when uncached — the client island then
  // fetches live for real visitors.
  const serverInsight = await fetchCachedInsight(
    "metro",
    metro.cbsaCode,
    "market_overview",
  );

  // Related metros: same-state ranked by PropertyIQ score (server-rendered).
  const metroRank = await fetchRankings("propertyiq", "metro", {
    state: metro.state,
    limit: 8,
  });
  const metroBySlug = new Map(METRO_SLUG_DATA.map((m) => [m.cbsaCode, m]));
  const relatedMetros = metroRank
    .filter((r) => r.id !== metro.cbsaCode && metroBySlug.has(r.id))
    .map((r) => metroBySlug.get(r.id)!)
    .slice(0, 5);

  // Down-links: every county/ZIP in this metro, capped with a "view all" link
  // to the dedicated overflow page (only present when the parent exceeds the cap).
  const counties = getCountiesForMetro(metro.cbsaCode);
  const zips = getZipsForMetro(metro.cbsaCode);
  const linkGroups = [
    buildLinkGroup(
      `Counties in the ${metro.shortName} metro area`,
      counties.map((c) => ({
        key: c.fips,
        label: c.shortName,
        href: `/markets/county/${c.slug}`,
      })),
      MARKET_LINKS_DISPLAY_CAP,
      `/markets/${metro.slug}/counties`,
    ),
    buildLinkGroup(
      `ZIP codes in the ${metro.shortName} metro area`,
      zips.map((z) => ({
        key: z.zip,
        label: z.zip,
        href: `/markets/zip/${z.slug}`,
      })),
      MARKET_LINKS_DISPLAY_CAP,
      `/markets/${metro.slug}/zips`,
    ),
    {
      label: `Top markets in ${metro.state}`,
      links: relatedMetros.map((m) => ({
        key: m.cbsaCode,
        label: m.shortName,
        href: `/markets/${m.slug}`,
      })),
    },
  ];

  return (
    <>
      <MetroPageContent
        metro={metro}
        initialInsight={serverInsight}
        chain={chain}
      />

      {stats && <MarketStatsBlock data={stats} geoName={metro.shortName} />}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildStatsJsonLd(
                stats,
                metro.shortName,
                `https://www.propertyiq.app/markets/${metro.slug}`,
              ),
            ),
          }}
        />
      )}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ImageObject",
              "@id": `https://www.propertyiq.app/markets/${metro.slug}#primaryimage`,
              url: ogImageUrl,
              contentUrl: ogImageUrl,
              width: 1200,
              height: 630,
              encodingFormat: "image/png",
              caption: ogImageAlt,
              representativeOfPage: true,
              creditText: "PropertyIQ",
              creator: { "@type": "Organization", name: "PropertyIQ" },
            }),
          }}
        />
      )}

      {/* Server-rendered SEO content — visible to crawlers without JS */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-medium text-on-surface mb-6">
          {metro.shortName} Housing Market Overview
        </h2>

        {stats && (
          <figure className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic edge-generated OG card; not worth routing through the next/image optimizer */}
            <img
              src={ogImagePath}
              alt={ogImageAlt}
              width={1200}
              height={630}
              loading="lazy"
              className="w-full max-w-2xl mx-auto rounded-xl border border-outline-variant shadow-sm"
            />
            <figcaption className="mt-2 text-center text-xs text-on-surface-variant/70">
              {metro.shortName} market snapshot
              {stats.latestDate
                ? ` — data through ${new Date(
                    stats.latestDate,
                  ).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}`
                : ""}
            </figcaption>
          </figure>
        )}

        <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
          {seoContent.dataSummary && (
            <p className="text-on-surface font-medium">
              {seoContent.dataSummary}
            </p>
          )}
          <p>{seoContent.opening}</p>
          <p>{seoContent.regional}</p>
          {seoContent.stateContext && <p>{seoContent.stateContext}</p>}
          <p>{seoContent.middle}</p>
          <p>{seoContent.closing}</p>
        </div>

        <MarketRelatedLinks groups={linkGroups} />

        <p className="mt-8 text-xs text-on-surface-variant/60">
          {stats?.latestDate
            ? `Market data through ${new Date(stats.latestDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`
            : ""}{" "}
          Sourced from Zillow, Realtor.com, Redfin, U.S. Census Bureau, FRED,
          BLS, and BEA. Per-statistic source and date shown above.
        </p>
      </section>

      <MarketFaqSection
        faqs={buildMarketFaqs({
          displayName: metro.shortName,
          geoLabel: "metro area",
          stats,
        })}
      />
    </>
  );
}
```

Note what was removed: the manually-built `breadcrumbJsonLd` object and its standalone `<script>` (now produced by `MarketBreadcrumbs` inside `MetroPageContent`), and the plain `relatedMetros` pill block (now one of the three `linkGroups` rendered by `MarketRelatedLinks`).

- [ ] **Step 2: Replace `packages/frontend/app/(public)/markets/[slug]/MetroPageContent.tsx` in full**

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { MetroSlugEntry } from "@/lib/data/metro-slugs";
import type { AncestorChain } from "@/lib/data/market-hierarchy";
import { ScoreWidget } from "@/app/components/scoring/ScoreWidget";
import { PersonaCaptureBlock } from "@/app/markets/components/PersonaCaptureBlock";
import { MarketBreadcrumbs } from "@/app/markets/components/MarketBreadcrumbs";
import { MarketOverviewSection } from "./MarketOverviewSection";
import { LeadMagnetModal } from "./components/LeadMagnetModal";
import MarketReportCTA from "../components/MarketReportCTA";
import { useMilestone } from "@/lib/hooks/useMilestone";

interface MetroPageContentProps {
  metro: MetroSlugEntry;
  /**
   * Pre-generated (cached) AI market overview, fetched server-side for SSR/SEO.
   * When present, MarketOverviewSection renders it in the initial HTML and skips
   * the client fetch. Null when uncached — the client fetches live.
   */
  initialInsight?: { content: string; generated_at: string } | null;
  /** Full ancestor chain for the breadcrumb (state; metro/county are always null here — this IS the metro page). */
  chain: AncestorChain;
}

export function MetroPageContent({
  metro,
  initialInsight,
  chain,
}: MetroPageContentProps) {
  const [showLeadMagnet, setShowLeadMagnet] = useState(false);
  const { recordMilestone } = useMilestone();

  // Fire first_market_viewed after 5s dwell (intent: user actually read the page)
  useEffect(() => {
    const timer = setTimeout(
      () => void recordMilestone("first_market_viewed"),
      5000,
    );
    return () => clearTimeout(timer);
  }, [recordMilestone]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 overflow-x-hidden min-w-0">
      <MarketBreadcrumbs
        chain={chain}
        currentName={metro.shortName}
        currentHref={`/markets/${metro.slug}`}
      />

      {/* H1 */}
      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3 break-words">
        {metro.shortName} Housing Market
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        AI-powered market intelligence for the {metro.name} metro area.
      </p>

      {/* Market report CTA — deep-link to the AI Report builder (geo-scale) */}
      <div className="mb-8">
        <MarketReportCTA
          geoLevel="metro"
          geoId={metro.cbsaCode}
          geoName={metro.shortName}
          stateAbbr={metro.state}
        />
      </div>

      {/* Scores */}
      <section
        className="mb-10"
        onMouseEnter={() => void recordMilestone("first_score_explored")}
      >
        <h2 className="text-xl font-semibold text-on-surface mb-4">
          PropertyIQ Scores
        </h2>
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-2">
            <ScoreWidget
              geographyType="metro"
              geographyId={metro.cbsaCode}
              scoreType="propertyiq"
            />
            <span className="text-sm font-medium text-on-surface">
              PropertyIQ Score
            </span>
          </div>
        </div>
      </section>

      {/* AI Market Overview */}
      <MarketOverviewSection
        metroName={metro.shortName}
        cbsaCode={metro.cbsaCode}
        initialInsight={initialInsight}
      />

      {/* CTAs */}
      <section className="flex flex-wrap gap-4 mb-10">
        <Link
          href={`/map?geo=metro&id=${metro.cbsaCode}&name=${encodeURIComponent(metro.name)}&state=${metro.state}`}
          className="px-6 py-3 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors"
        >
          View on Interactive Map
        </Link>
        <Link
          href={`/market/${metro.cbsaCode}?type=metro`}
          className="px-6 py-3 bg-surface-container-low text-on-surface rounded-full font-medium border border-outline hover:bg-surface-container-high transition-colors"
        >
          Full Market Dashboard
        </Link>
        <button
          onClick={() => setShowLeadMagnet(true)}
          className="px-6 py-3 bg-tertiary-container text-on-tertiary-container rounded-full font-medium hover:bg-tertiary-container/80 transition-colors"
        >
          Get Free Market Report
        </button>
      </section>

      {/* Role-segmented persona capture */}
      <PersonaCaptureBlock geoName={metro.shortName} />

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Place",
            "@id": `https://www.propertyiq.app/markets/${metro.slug}#place`,
            name: metro.name,
            url: `https://www.propertyiq.app/markets/${metro.slug}`,
            containedInPlace: {
              "@type": "Country",
              name: "United States",
            },
          }),
        }}
      />

      {/* Lead Magnet Modal */}
      {showLeadMagnet && (
        <LeadMagnetModal
          metroName={metro.shortName}
          onClose={() => setShowLeadMagnet(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check and run the full unit test suite**

Run: `npm --prefix packages/frontend exec -- tsc --noEmit`
Expected: no new errors.

Run: `npm --prefix packages/frontend run test:unit`
Expected: PASS (no existing test imports the old inline breadcrumb/related-metros markup by shape, so nothing else should break).

- [ ] **Step 4: Commit**

```bash
git add "packages/frontend/app/(public)/markets/[slug]/page.tsx" "packages/frontend/app/(public)/markets/[slug]/MetroPageContent.tsx"
git commit -m "feat(seo): add metro-page down-links to counties/zips and full breadcrumb chain"
```

---

### Task 5: Wire breadcrumbs + down-links into the county page

**Files:**

- Modify: `packages/frontend/app/(public)/markets/county/[slug]/page.tsx`
- Modify: `packages/frontend/app/(public)/markets/county/[slug]/CountyPageContent.tsx`

**Interfaces:**

- Consumes: `getAncestorChainForCounty`, `getZipsForCounty`, `MARKET_LINKS_DISPLAY_CAP` (Task 1); `MarketBreadcrumbs` (Task 2); `MarketRelatedLinks`, `buildLinkGroup` (Task 3).

- [ ] **Step 1: Replace `packages/frontend/app/(public)/markets/county/[slug]/page.tsx` in full**

```tsx
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { COUNTY_SLUG_DATA, SLUG_TO_COUNTY } from "@/lib/data/county-slug-data";
import { resolveCountyAlias } from "@/lib/data/market-slug-aliases";
import { CBSA_TO_METRO } from "@/lib/data/metro-slug-data";
import { fetchSeoMarketStats, fetchRankings } from "@/lib/data";
import {
  buildMarketTitle,
  buildMarketDescription,
  buildMarketOgImagePath,
} from "@/lib/seo/market-metadata";
import { MarketStatsBlock } from "@/app/markets/components/MarketStatsBlock";
import { buildStatsJsonLd } from "@/app/markets/components/buildStatsJsonLd";
import { MarketFaqSection } from "@/app/markets/components/MarketFaqSection";
import { buildMarketFaqs } from "@/app/markets/components/build-market-faqs";
import {
  MarketRelatedLinks,
  buildLinkGroup,
} from "@/app/markets/components/MarketRelatedLinks";
import {
  getAncestorChainForCounty,
  getZipsForCounty,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
import { CountyPageContent } from "./CountyPageContent";
import { generateCountySeoContent } from "./generate-seo-content";

// Pre-render a bounded set at build; the long tail renders on-demand via ISR (dynamicParams default true) to avoid OOM from per-page server fetches.
export function generateStaticParams() {
  return COUNTY_SLUG_DATA.slice(0, 150).map((county) => ({
    slug: county.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const county = SLUG_TO_COUNTY.get(slug);
  if (!county) return {};

  const pageUrl = `https://www.propertyiq.app/markets/county/${county.slug}`;

  // Stats (24h-cached; also used by the page body, so this is a cache hit) feed
  // data-interpolated title + description so each page is data-distinct.
  const stats = await fetchSeoMarketStats("county", county.fips, county.state);
  const title = buildMarketTitle(county.shortName, stats);
  const description = buildMarketDescription(county.shortName, stats);
  const ogImageUrl = buildMarketOgImagePath(county.shortName, stats);

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      title: `${title} | PropertyIQ`,
      description,
      siteName: "PropertyIQ",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${county.shortName} Housing Market Analysis`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours
export const dynamicParams = true;

export default async function CountyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const county = SLUG_TO_COUNTY.get(slug);
  if (!county) {
    // A natural county slug without the "-county" segment ("mecklenburg-nc")
    // isn't canonical, but unambiguously points at one county page. 308-redirect
    // to canonical ("mecklenburg-county-nc") instead of 404.
    const canonical = resolveCountyAlias(slug);
    if (canonical) permanentRedirect(`/markets/county/${canonical}`);
    notFound();
  }

  // Find parent metro for cross-linking
  const parentMetro = county.cbsaCode
    ? CBSA_TO_METRO.get(county.cbsaCode)
    : null;

  const chain = getAncestorChainForCounty(county);

  // Neighboring counties in the same state, ranked by PropertyIQ score.
  const countyRank = await fetchRankings("propertyiq", "county", {
    state: county.state,
    limit: 12,
  });
  const countyByFips = new Map(COUNTY_SLUG_DATA.map((c) => [c.fips, c]));
  const rankedCounties = countyRank
    .filter((r) => r.id !== county.fips && countyByFips.has(r.id))
    .map((r) => countyByFips.get(r.id)!)
    .slice(0, 6);
  const nearbyCounties = rankedCounties.length
    ? rankedCounties
    : COUNTY_SLUG_DATA.filter(
        (c) => c.state === county.state && c.fips !== county.fips,
      ).slice(0, 6);

  const stats = await fetchSeoMarketStats("county", county.fips, county.state);
  const seoContent = generateCountySeoContent(county, stats);

  // Same OG card the meta tags reference, embedded as a real, alt-bearing image
  // so non-JS AI crawlers (GPTBot/ClaudeBot/PerplexityBot) see an actual visual
  // of this county's data — not just a <meta> link. Absolute URL for the schema.
  const ogImagePath = buildMarketOgImagePath(county.shortName, stats);
  const ogImageUrl = `https://www.propertyiq.app${ogImagePath}`;
  const ogImageAlt = `${county.shortName} housing market snapshot from PropertyIQ — median home price, year-over-year appreciation, median days on market, and PropertyIQ demand score.`;

  // Down-link: every ZIP in this county, capped with a "view all" link.
  const zips = getZipsForCounty(county.fips);
  const linkGroups = [
    buildLinkGroup(
      `ZIP codes in ${county.shortName}`,
      zips.map((z) => ({
        key: z.zip,
        label: z.zip,
        href: `/markets/zip/${z.slug}`,
      })),
      MARKET_LINKS_DISPLAY_CAP,
      `/markets/county/${county.slug}/zips`,
    ),
    {
      label: `Other ${county.state} Counties`,
      links: nearbyCounties.map((c) => ({
        key: c.fips,
        label: c.shortName,
        href: `/markets/county/${c.slug}`,
      })),
    },
  ];

  return (
    <>
      <CountyPageContent
        county={county}
        parentMetroSlug={parentMetro?.slug ?? null}
        parentMetroName={parentMetro?.shortName ?? null}
        chain={chain}
      />

      {stats && <MarketStatsBlock data={stats} geoName={county.shortName} />}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildStatsJsonLd(
                stats,
                county.shortName,
                `https://www.propertyiq.app/markets/county/${county.slug}`,
              ),
            ),
          }}
        />
      )}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ImageObject",
              "@id": `https://www.propertyiq.app/markets/county/${county.slug}#primaryimage`,
              url: ogImageUrl,
              contentUrl: ogImageUrl,
              width: 1200,
              height: 630,
              encodingFormat: "image/png",
              caption: ogImageAlt,
              representativeOfPage: true,
              creditText: "PropertyIQ",
              creator: { "@type": "Organization", name: "PropertyIQ" },
            }),
          }}
        />
      )}

      {/* Server-rendered SEO content */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-medium text-on-surface mb-6">
          {county.shortName} Housing Market Overview
        </h2>

        {stats && (
          <figure className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic edge-generated OG card; not worth routing through the next/image optimizer */}
            <img
              src={ogImagePath}
              alt={ogImageAlt}
              width={1200}
              height={630}
              loading="lazy"
              className="w-full max-w-2xl mx-auto rounded-xl border border-outline-variant shadow-sm"
            />
            <figcaption className="mt-2 text-center text-xs text-on-surface-variant/70">
              {county.shortName} market snapshot
              {stats.latestDate
                ? ` — data through ${new Date(
                    stats.latestDate,
                  ).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}`
                : ""}
            </figcaption>
          </figure>
        )}

        <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
          {seoContent.dataSummary && (
            <p className="text-on-surface font-medium">
              {seoContent.dataSummary}
            </p>
          )}
          <p>{seoContent.opening}</p>
          <p>{seoContent.regional}</p>
          <p>{seoContent.middle}</p>
          <p>{seoContent.closing}</p>
        </div>

        <MarketRelatedLinks groups={linkGroups} />

        {parentMetro && (
          <p className="mt-6 text-sm text-on-surface-variant">
            {county.shortName} is part of the{" "}
            <Link
              href={`/markets/${parentMetro.slug}`}
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {parentMetro.shortName} metro area
            </Link>
            .
          </p>
        )}

        <p className="mt-8 text-xs text-on-surface-variant/60">
          {stats?.latestDate
            ? `Market data through ${new Date(stats.latestDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`
            : ""}{" "}
          Sourced from Zillow, Realtor.com, Redfin, U.S. Census Bureau, FRED,
          BLS, and BEA. Per-statistic source and date shown above.
        </p>
      </section>

      <MarketFaqSection
        faqs={buildMarketFaqs({
          displayName: county.shortName,
          geoLabel: "county",
          stats,
        })}
      />
    </>
  );
}
```

- [ ] **Step 2: Replace `packages/frontend/app/(public)/markets/county/[slug]/CountyPageContent.tsx` in full**

```tsx
"use client";

import Link from "next/link";
import type { CountySlugEntry } from "@/lib/data/county-slugs";
import type { AncestorChain } from "@/lib/data/market-hierarchy";
import { ScoreWidget } from "@/app/components/scoring/ScoreWidget";
import { PersonaCaptureBlock } from "@/app/markets/components/PersonaCaptureBlock";
import { MarketBreadcrumbs } from "@/app/markets/components/MarketBreadcrumbs";
import MarketReportCTA from "../../components/MarketReportCTA";

interface CountyPageContentProps {
  county: CountySlugEntry;
  parentMetroSlug: string | null;
  parentMetroName: string | null;
  chain: AncestorChain;
}

export function CountyPageContent({
  county,
  parentMetroSlug,
  parentMetroName,
  chain,
}: CountyPageContentProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <MarketBreadcrumbs
        chain={chain}
        currentName={county.shortName}
        currentHref={`/markets/county/${county.slug}`}
      />

      {/* H1 */}
      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        {county.shortName} Housing Market
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        AI-powered market intelligence for {county.name}, {county.state}.
        {parentMetroName && (
          <>
            {" "}
            Part of the{" "}
            <Link
              href={`/markets/${parentMetroSlug}`}
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {parentMetroName}
            </Link>{" "}
            metro area.
          </>
        )}
      </p>

      {/* Market report CTA — deep-link to the AI Report builder (geo-scale) */}
      <div className="mb-8">
        <MarketReportCTA
          geoLevel="county"
          geoId={county.fips}
          geoName={county.shortName}
          stateAbbr={county.state}
        />
      </div>

      {/* Score */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-on-surface mb-4">
          PropertyIQ Score
        </h2>
        <ScoreWidget
          geographyType="county"
          geographyId={county.fips}
          scoreType="propertyiq"
        />
      </section>

      {/* CTAs */}
      <section className="grid sm:grid-cols-2 gap-4 mb-10">
        <Link
          href={`/map?geo=county&region=${county.fips}`}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          View on Map
        </Link>
        <Link
          href="/reports"
          className="flex items-center justify-center gap-2 px-6 py-3 border border-primary text-primary rounded-xl font-medium hover:bg-primary/10 transition-colors"
        >
          Generate AI Report
        </Link>
      </section>

      {/* Role-segmented persona capture */}
      <PersonaCaptureBlock geoName={county.shortName} />
    </div>
  );
}
```

- [ ] **Step 3: Type-check and run the full unit test suite**

Run: `npm --prefix packages/frontend exec -- tsc --noEmit`
Expected: no new errors.

Run: `npm --prefix packages/frontend run test:unit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "packages/frontend/app/(public)/markets/county/[slug]/page.tsx" "packages/frontend/app/(public)/markets/county/[slug]/CountyPageContent.tsx"
git commit -m "feat(seo): add county-page down-links to zips and full breadcrumb chain"
```

---

### Task 6: Wire breadcrumbs into the ZIP page

ZIPs have no children, so this task adds the full breadcrumb chain only — the existing same-tier "Other {state} ZIP Codes" block is migrated to `MarketRelatedLinks` for consistency but keeps its current behavior (no down-links, no view-all).

**Files:**

- Modify: `packages/frontend/app/(public)/markets/zip/[slug]/page.tsx`
- Modify: `packages/frontend/app/(public)/markets/zip/[slug]/ZipPageContent.tsx`

**Interfaces:**

- Consumes: `getAncestorChainForZip` (Task 1); `MarketBreadcrumbs` (Task 2); `MarketRelatedLinks` (Task 3, used without `buildLinkGroup` since there's no cap/view-all here).

- [ ] **Step 1: Replace `packages/frontend/app/(public)/markets/zip/[slug]/page.tsx` in full**

```tsx
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import {
  ZIP_SLUG_DATA,
  SLUG_TO_ZIP,
  ZIP_TO_ENTRY,
} from "@/lib/data/zip-slug-data";
import { CBSA_TO_METRO } from "@/lib/data/metro-slug-data";
import { FIPS_TO_COUNTY } from "@/lib/data/county-slug-data";
import { fetchSeoMarketStats, fetchRankings } from "@/lib/data";
import {
  buildMarketTitle,
  buildMarketDescription,
  buildMarketOgImagePath,
} from "@/lib/seo/market-metadata";
import { MarketStatsBlock } from "@/app/markets/components/MarketStatsBlock";
import { buildStatsJsonLd } from "@/app/markets/components/buildStatsJsonLd";
import { MarketFaqSection } from "@/app/markets/components/MarketFaqSection";
import { buildMarketFaqs } from "@/app/markets/components/build-market-faqs";
import { MarketRelatedLinks } from "@/app/markets/components/MarketRelatedLinks";
import { getAncestorChainForZip } from "@/lib/data/market-hierarchy";
import { ZipPageContent } from "./ZipPageContent";
import { generateZipSeoContent } from "./generate-seo-content";
import type { ZipSlugEntry } from "@/lib/data/zip-slugs";

/**
 * A legacy/malformed entry has no real city: its `shortName` is "<zip>, <zip>, "
 * (city echoed the ZIP, empty state) and `slug` is "<zip>-<zip>". Such rows
 * should no longer be generated, but guard at render so a directly-hit stale
 * slug never produces a "<zip> <zip>" title.
 */
function isMissingCity(zip: ZipSlugEntry): boolean {
  return zip.state.trim() === "" || zip.slug === `${zip.zip}-${zip.zip}`;
}

/** Clean display label: "Springfield, MA 01093" style, or "ZIP <zip>" fallback. */
function zipDisplayName(zip: ZipSlugEntry): string {
  return isMissingCity(zip) ? `ZIP ${zip.zip}` : zip.shortName;
}

// Pre-render a bounded set at build; the long tail renders on-demand via ISR (dynamicParams default true) to avoid OOM from per-page server fetches.
// Exclude any malformed (city-less) entry so we never statically build a broken page.
export function generateStaticParams() {
  return ZIP_SLUG_DATA.filter((zip) => !isMissingCity(zip))
    .slice(0, 50)
    .map((zip) => ({ slug: zip.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const zip = SLUG_TO_ZIP.get(slug);
  if (!zip) return {};

  // Resilience: a malformed entry (no city — e.g. a stale "01093-01093" slug
  // where shortName is "01093, 01093, ") must never yield a "01093 01093"
  // title. Derive a clean place name, falling back to "ZIP <zip>".
  const cityState = isMissingCity(zip)
    ? ""
    : zip.shortName.replace(`${zip.zip}, `, "").trim();
  const place = cityState ? `${zip.zip} ${cityState}` : `ZIP ${zip.zip}`;
  const ogTitle = cityState ? zip.shortName : `ZIP ${zip.zip}`;
  const pageUrl = `https://www.propertyiq.app/markets/zip/${zip.slug}`;

  // Stats (24h-cached; also used by the page body, so this is a cache hit) feed
  // data-interpolated title + description so each page is data-distinct.
  const name = place;
  const stats = await fetchSeoMarketStats("zip", zip.zip, zip.state);
  const title = buildMarketTitle(name, stats);
  const description = buildMarketDescription(name, stats);
  const ogImageUrl = buildMarketOgImagePath(ogTitle, stats);

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      title: `${title} | PropertyIQ`,
      description,
      siteName: "PropertyIQ",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${ogTitle} Housing Market Analysis`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours
export const dynamicParams = true;

export default async function ZipPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const zip = SLUG_TO_ZIP.get(slug);
  if (!zip) {
    // A bare 5-digit ZIP (e.g. "28202") is the most natural URL a person types,
    // but the canonical page lives at the city-state slug ("28202-charlotte-nc").
    // The ZIP alone is unambiguous, so 308-redirect to canonical instead of 404.
    if (/^\d{5}$/.test(slug)) {
      const canonical = ZIP_TO_ENTRY.get(slug);
      if (canonical && !isMissingCity(canonical) && canonical.slug !== slug) {
        permanentRedirect(`/markets/zip/${canonical.slug}`);
      }
    }
    notFound();
  }

  // Clean, city-aware label (never "<zip>, <zip>, ") for all visible copy.
  const displayName = zipDisplayName(zip);

  // Find parent metro for cross-linking
  const parentMetro = zip.cbsaCode ? CBSA_TO_METRO.get(zip.cbsaCode) : null;

  // Find parent county for cross-linking
  const parentCounty = zip.countyFips
    ? FIPS_TO_COUNTY.get(zip.countyFips)
    : null;

  const chain = getAncestorChainForZip(zip);

  // Nearby ZIPs in the same state, ranked by PropertyIQ score.
  const zipRank = await fetchRankings("propertyiq", "zip", {
    state: zip.state,
    limit: 12,
  });
  const zipByCode = new Map(ZIP_SLUG_DATA.map((z) => [z.zip, z]));
  const rankedZips = zipRank
    .filter((r) => r.id !== zip.zip && zipByCode.has(r.id))
    .map((r) => zipByCode.get(r.id)!)
    .slice(0, 6);
  const nearbyZips = rankedZips.length
    ? rankedZips
    : ZIP_SLUG_DATA.filter(
        (z) => z.state === zip.state && z.zip !== zip.zip,
      ).slice(0, 6);

  const stats = await fetchSeoMarketStats("zip", zip.zip, zip.state);
  const seoContent = generateZipSeoContent(zip, stats);

  // Same OG card the meta tags reference, embedded as a real, alt-bearing image
  // so non-JS AI crawlers (GPTBot/ClaudeBot/PerplexityBot) see an actual visual
  // of this ZIP's data — not just a <meta> link. Absolute URL for the schema.
  const ogImagePath = buildMarketOgImagePath(displayName, stats);
  const ogImageUrl = `https://www.propertyiq.app${ogImagePath}`;
  const ogImageAlt = `${displayName} housing market snapshot from PropertyIQ — median home price, year-over-year appreciation, median days on market, and PropertyIQ demand score.`;

  const linkGroups = [
    {
      label: `Other ${zip.state} ZIP Codes`,
      links: nearbyZips.map((z) => ({
        key: z.zip,
        label: z.shortName,
        href: `/markets/zip/${z.slug}`,
      })),
    },
  ];

  return (
    <>
      <ZipPageContent
        zip={zip}
        parentMetroSlug={parentMetro?.slug ?? null}
        parentMetroName={parentMetro?.shortName ?? null}
        parentCountySlug={parentCounty?.slug ?? null}
        parentCountyName={parentCounty?.shortName ?? null}
        chain={chain}
      />

      {stats && <MarketStatsBlock data={stats} geoName={displayName} />}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildStatsJsonLd(
                stats,
                displayName,
                `https://www.propertyiq.app/markets/zip/${zip.slug}`,
              ),
            ),
          }}
        />
      )}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ImageObject",
              "@id": `https://www.propertyiq.app/markets/zip/${zip.slug}#primaryimage`,
              url: ogImageUrl,
              contentUrl: ogImageUrl,
              width: 1200,
              height: 630,
              encodingFormat: "image/png",
              caption: ogImageAlt,
              representativeOfPage: true,
              creditText: "PropertyIQ",
              creator: { "@type": "Organization", name: "PropertyIQ" },
            }),
          }}
        />
      )}

      {/* Server-rendered SEO content */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-medium text-on-surface mb-6">
          {displayName} Housing Market Overview
        </h2>

        {stats && (
          <figure className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic edge-generated OG card; not worth routing through the next/image optimizer */}
            <img
              src={ogImagePath}
              alt={ogImageAlt}
              width={1200}
              height={630}
              loading="lazy"
              className="w-full max-w-2xl mx-auto rounded-xl border border-outline-variant shadow-sm"
            />
            <figcaption className="mt-2 text-center text-xs text-on-surface-variant/70">
              {displayName} market snapshot
              {stats.latestDate
                ? ` — data through ${new Date(
                    stats.latestDate,
                  ).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}`
                : ""}
            </figcaption>
          </figure>
        )}

        <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
          {seoContent.dataSummary && (
            <p className="text-on-surface font-medium">
              {seoContent.dataSummary}
            </p>
          )}
          <p>{seoContent.opening}</p>
          <p>{seoContent.regional}</p>
          <p>{seoContent.middle}</p>
          <p>{seoContent.closing}</p>
        </div>

        <MarketRelatedLinks groups={linkGroups} />

        {parentCounty && (
          <p className="mt-6 text-sm text-on-surface-variant">
            {displayName} is located in{" "}
            <Link
              href={`/markets/county/${parentCounty.slug}`}
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {parentCounty.shortName}
            </Link>
            .
          </p>
        )}

        {parentMetro && (
          <p className="mt-4 text-sm text-on-surface-variant">
            This ZIP code is part of the{" "}
            <Link
              href={`/markets/${parentMetro.slug}`}
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {parentMetro.shortName} metro area
            </Link>
            .
          </p>
        )}

        <p className="mt-8 text-xs text-on-surface-variant/60">
          {stats?.latestDate
            ? `Market data through ${new Date(stats.latestDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`
            : ""}{" "}
          Sourced from Zillow, Realtor.com, Redfin, U.S. Census Bureau, FRED,
          BLS, and BEA. Per-statistic source and date shown above.
        </p>
      </section>

      <MarketFaqSection
        faqs={buildMarketFaqs({
          displayName,
          geoLabel: "ZIP code",
          stats,
        })}
      />
    </>
  );
}
```

- [ ] **Step 2: Replace `packages/frontend/app/(public)/markets/zip/[slug]/ZipPageContent.tsx` in full**

```tsx
"use client";

import Link from "next/link";
import type { ZipSlugEntry } from "@/lib/data/zip-slugs";
import type { AncestorChain } from "@/lib/data/market-hierarchy";
import { ScoreWidget } from "@/app/components/scoring/ScoreWidget";
import { PersonaCaptureBlock } from "@/app/markets/components/PersonaCaptureBlock";
import { MarketBreadcrumbs } from "@/app/markets/components/MarketBreadcrumbs";
import MarketReportCTA from "../../components/MarketReportCTA";

interface ZipPageContentProps {
  zip: ZipSlugEntry;
  parentMetroSlug: string | null;
  parentMetroName: string | null;
  parentCountySlug: string | null;
  parentCountyName: string | null;
  chain: AncestorChain;
}

export function ZipPageContent({
  zip,
  parentMetroSlug,
  parentMetroName,
  parentCountySlug,
  parentCountyName,
  chain,
}: ZipPageContentProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <MarketBreadcrumbs
        chain={chain}
        currentName={zip.shortName}
        currentHref={`/markets/zip/${zip.slug}`}
      />

      {/* H1 */}
      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        {zip.shortName} Housing Market
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        Hyperlocal market intelligence for ZIP code {zip.zip} in {zip.state}.
        {parentCountyName && (
          <>
            {" "}
            Located in{" "}
            <Link
              href={`/markets/county/${parentCountySlug}`}
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {parentCountyName}
            </Link>
            .
          </>
        )}
        {parentMetroName && (
          <>
            {" "}
            Part of the{" "}
            <Link
              href={`/markets/${parentMetroSlug}`}
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {parentMetroName}
            </Link>{" "}
            metro area.
          </>
        )}
      </p>

      {/* Market report CTA — deep-link to the AI Report builder (geo-scale) */}
      <div className="mb-8">
        <MarketReportCTA
          geoLevel="zip"
          geoId={zip.zip}
          geoName={zip.shortName}
          stateAbbr={zip.state}
        />
      </div>

      {/* Score */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-on-surface mb-4">
          PropertyIQ Score
        </h2>
        <ScoreWidget
          geographyType="zip"
          geographyId={zip.zip}
          scoreType="propertyiq"
        />
      </section>

      {/* CTAs */}
      <section className="grid sm:grid-cols-2 gap-4 mb-10">
        <Link
          href={`/map?geo=zip&region=${zip.zip}`}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          View on Map
        </Link>
        <Link
          href="/reports"
          className="flex items-center justify-center gap-2 px-6 py-3 border border-primary text-primary rounded-xl font-medium hover:bg-primary/10 transition-colors"
        >
          Generate AI Report
        </Link>
      </section>

      {/* Role-segmented persona capture */}
      <PersonaCaptureBlock geoName={zip.shortName} />
    </div>
  );
}
```

- [ ] **Step 3: Type-check and run the full unit test suite**

Run: `npm --prefix packages/frontend exec -- tsc --noEmit`
Expected: no new errors.

Run: `npm --prefix packages/frontend run test:unit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "packages/frontend/app/(public)/markets/zip/[slug]/page.tsx" "packages/frontend/app/(public)/markets/zip/[slug]/ZipPageContent.tsx"
git commit -m "feat(seo): add full breadcrumb chain to zip page, migrate related links to shared component"
```

---

### Task 7: Refactor the state page onto `market-hierarchy.ts` + `MarketBreadcrumbs`

**Files:**

- Modify: `packages/frontend/app/(public)/markets/state/[state]/page.tsx`
- Modify: `packages/frontend/app/(public)/markets/state/[state]/StatePageContent.tsx`

**Interfaces:**

- Consumes: `getZipsForMetro`, `getZipsForCounty`, `MARKET_LINKS_DISPLAY_CAP` (Task 1, replacing the page's own ad hoc `zipsByMetro`/`zipsByCounty` grouping and local `ZIP_DISPLAY_CAP`); `MarketBreadcrumbs` (Task 2, replacing the inline breadcrumb JSON-LD + nav in both files).
- The `ZipLinks` helper's "+N more" link now points to the new dedicated overflow pages from Tasks 8/10 (`/markets/{slug}/zips`, `/markets/county/{slug}/zips`) instead of back to the parent metro/county page — the parent page previously had no ZIP list to land on; after Tasks 4–5 it has a capped one, but the dedicated overflow page (generated under the exact same >12 condition) is the real "all of them" destination.

- [ ] **Step 1: Replace `packages/frontend/app/(public)/markets/state/[state]/page.tsx` in full**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STATE_SLUG_DATA, SLUG_TO_STATE } from "@/lib/data/state-slug-data";
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";
import { COUNTY_SLUG_DATA } from "@/lib/data/county-slug-data";
import { fetchRankings } from "@/lib/data";
import {
  getZipsForMetro,
  getZipsForCounty,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
import { MarketBreadcrumbs } from "@/app/markets/components/MarketBreadcrumbs";
import { StateTopMarketsTables } from "@/app/markets/components/StateTopMarketsTables";
import { StatePageContent } from "./StatePageContent";
import { generateStateSeoContent } from "./generate-seo-content";
import type { ZipSlugEntry } from "@/lib/data/zip-slugs";

export function generateStaticParams() {
  return STATE_SLUG_DATA.map((s) => ({ state: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state: stateSlug } = await params;
  const stateEntry = SLUG_TO_STATE.get(stateSlug);
  if (!stateEntry) return {};

  const pageUrl = `https://www.propertyiq.app/markets/state/${stateEntry.slug}`;
  const title = `Best Cities to Invest in ${stateEntry.name} — 2026 Real Estate Market`;
  const description = `Compare housing markets across ${stateEntry.name} — PropertyIQ scores, median home prices, rental yields, and AI-powered forecasts for every metro area and county. Find the best cities to invest in ${stateEntry.name} in 2026.`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      title,
      description,
      siteName: "PropertyIQ",
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(stateEntry.name + " Real Estate")}`,
          width: 1200,
          height: 630,
          alt: `${stateEntry.name} Real Estate Market Analysis - PropertyIQ`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        `/api/og?title=${encodeURIComponent(stateEntry.name + " Real Estate")}`,
      ],
    },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours

function ZipLinks({
  zips,
  viewAllHref,
}: {
  zips: ZipSlugEntry[];
  viewAllHref: string;
}) {
  if (zips.length === 0) return null;
  const shown = zips.slice(0, MARKET_LINKS_DISPLAY_CAP);
  const remaining = zips.length - shown.length;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
      {shown.map((zip) => (
        <a
          key={zip.zip}
          href={`/markets/zip/${zip.slug}`}
          className="text-xs text-primary/80 hover:text-primary underline underline-offset-2"
        >
          {zip.zip}
        </a>
      ))}
      {remaining > 0 && (
        <a
          href={viewAllHref}
          className="text-xs text-on-surface-variant hover:text-primary underline underline-offset-2"
        >
          +{remaining} more ZIP{remaining === 1 ? "" : "s"} →
        </a>
      )}
    </div>
  );
}

export default async function StatePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state: stateSlug } = await params;
  const stateEntry = SLUG_TO_STATE.get(stateSlug);
  if (!stateEntry) notFound();

  const metros = METRO_SLUG_DATA.filter((m) => m.state === stateEntry.abbrev);
  const counties = COUNTY_SLUG_DATA.filter(
    (c) => c.state === stateEntry.abbrev,
  );

  // Top-10 metros and counties in this state, ranked by PropertyIQ score.
  // Rows carry slugs (not raw CBSA/FIPS) so links resolve to /markets/<slug>.
  const [topMetrosRaw, topCountiesRaw] = await Promise.all([
    fetchRankings("propertyiq", "metro", {
      state: stateEntry.abbrev,
      limit: 10,
    }),
    fetchRankings("propertyiq", "county", {
      state: stateEntry.abbrev,
      limit: 10,
    }),
  ]);
  const metroSlugById = new Map(
    METRO_SLUG_DATA.map((m) => [m.cbsaCode, m.slug]),
  );
  const countySlugById = new Map(COUNTY_SLUG_DATA.map((c) => [c.fips, c.slug]));
  const topMetros = topMetrosRaw
    .filter((r) => metroSlugById.has(r.id))
    .map((r) => ({ ...r, id: metroSlugById.get(r.id)! }));
  const topCounties = topCountiesRaw
    .filter((r) => countySlugById.has(r.id))
    .map((r) => ({ ...r, id: countySlugById.get(r.id)! }));

  const stateSchemaJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "State",
    name: stateEntry.name,
    containedInPlace: { "@type": "Country", name: "United States" },
    url: `https://www.propertyiq.app/markets/state/${stateEntry.slug}`,
  });

  const seoContent = generateStateSeoContent(
    stateEntry.abbrev,
    stateEntry.name,
  );
  const today = new Date().toISOString().split("T")[0];

  // Same branded OG card the meta tags reference, embedded as a real,
  // alt-bearing image + ImageObject so non-JS AI crawlers see an actual visual
  // for this hub page. A state has no single headline snapshot (no state-level
  // PropertyIQ score / median), so this is the honest branded title card — it
  // asserts no per-market numbers. Absolute URL for the schema.
  const ogImagePath = `/api/og?title=${encodeURIComponent(stateEntry.name + " Real Estate")}`;
  const ogImageUrl = `https://www.propertyiq.app${ogImagePath}`;
  const ogImageAlt = `${stateEntry.name} real estate market overview from PropertyIQ — compare PropertyIQ demand scores, home prices, and rental trends across every metro and county in ${stateEntry.name}.`;

  return (
    <>
      {/* Safe JSON-LD injection — server-generated from trusted static data only */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stateSchemaJsonLd }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ImageObject",
            "@id": `https://www.propertyiq.app/markets/state/${stateEntry.slug}#primaryimage`,
            url: ogImageUrl,
            contentUrl: ogImageUrl,
            width: 1200,
            height: 630,
            encodingFormat: "image/png",
            caption: ogImageAlt,
            representativeOfPage: true,
            creditText: "PropertyIQ",
            creator: { "@type": "Organization", name: "PropertyIQ" },
          }),
        }}
      />

      <StateTopMarketsTables
        stateName={stateEntry.name}
        metros={topMetros}
        counties={topCounties}
        metroHrefBase="/markets"
        countyHrefBase="/markets/county"
      />

      <StatePageContent
        state={stateEntry}
        metros={metros}
        counties={counties}
      />

      {/* Server-rendered SEO content — crawlable without JS */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <MarketBreadcrumbs
          chain={{ state: null, metro: null, county: null }}
          currentName={stateEntry.name}
          currentHref={`/markets/state/${stateEntry.slug}`}
        />

        <h2 className="text-xl font-medium text-on-surface mb-6">
          {stateEntry.name} Real Estate Market Analysis
        </h2>

        <figure className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic edge-generated OG card; not worth routing through the next/image optimizer */}
          <img
            src={ogImagePath}
            alt={ogImageAlt}
            width={1200}
            height={630}
            loading="lazy"
            className="w-full max-w-2xl mx-auto rounded-xl border border-outline-variant shadow-sm"
          />
          <figcaption className="mt-2 text-center text-xs text-on-surface-variant/70">
            {stateEntry.name} real estate market overview
          </figcaption>
        </figure>

        <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
          <p>{seoContent.opening}</p>
          <p>{seoContent.economic}</p>
          <p>{seoContent.closing}</p>
        </div>

        {/* Metro Areas with ZIP codes — full hierarchy for crawlability */}
        {metros.length > 0 && (
          <div className="mt-8">
            <h3 className="text-base font-medium text-on-surface mb-4">
              {stateEntry.name} Metro Areas and ZIP Codes
            </h3>
            <div className="space-y-6">
              {metros.map((metro) => (
                <div key={metro.cbsaCode}>
                  <a
                    href={`/markets/${metro.slug}`}
                    className="text-sm font-semibold text-on-surface hover:text-primary underline underline-offset-4"
                  >
                    {metro.shortName}
                  </a>
                  <ZipLinks
                    zips={getZipsForMetro(metro.cbsaCode)}
                    viewAllHref={`/markets/${metro.slug}/zips`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Counties with ZIP codes — full hierarchy for crawlability */}
        {counties.length > 0 && (
          <div className="mt-10">
            <h3 className="text-base font-medium text-on-surface mb-4">
              {stateEntry.name} Counties and ZIP Codes
            </h3>
            <div className="space-y-6">
              {counties.map((county) => (
                <div key={county.fips}>
                  <a
                    href={`/markets/county/${county.slug}`}
                    className="text-sm font-semibold text-on-surface hover:text-primary underline underline-offset-4"
                  >
                    {county.shortName}
                  </a>
                  <ZipLinks
                    zips={getZipsForCounty(county.fips)}
                    viewAllHref={`/markets/county/${county.slug}/zips`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-8 text-xs text-on-surface-variant/60">
          Last updated: {today}. Data from Zillow, Realtor.com, Redfin, U.S.
          Census Bureau, FRED, BLS, and BEA.
        </p>
      </section>
    </>
  );
}
```

Note: the old `breadcrumbJsonLd` object and its `<script>` are removed (now produced by `MarketBreadcrumbs`), and `zipsByMetro`/`zipsByCounty` are removed in favor of `getZipsForMetro`/`getZipsForCounty` called per-metro/per-county in the render loop (each call hits the same lazily-built, memoized map from Task 1 — no repeated work).

- [ ] **Step 2: Update `packages/frontend/app/(public)/markets/state/[state]/StatePageContent.tsx` — replace the inline breadcrumb nav (lines 27–41) with `MarketBreadcrumbs`**

Replace:

```tsx
{
  /* Breadcrumb */
}
<nav className="text-sm text-on-surface-variant mb-6" aria-label="Breadcrumb">
  <Link href="/" className="hover:text-primary">
    Home
  </Link>
  <span className="mx-2">/</span>
  <Link href="/markets" className="hover:text-primary">
    Markets
  </Link>
  <span className="mx-2">/</span>
  <span className="text-on-surface font-medium">{state.name}</span>
</nav>;
```

with:

```tsx
<MarketBreadcrumbs
  chain={{ state: null, metro: null, county: null }}
  currentName={state.name}
  currentHref={`/markets/state/${state.slug}`}
/>
```

And add the import near the top of the file, alongside the existing imports:

```tsx
import { MarketBreadcrumbs } from "../../components/MarketBreadcrumbs";
```

(Relative import here, not the `@/app/markets/components/...` alias, matching this file's existing `import MarketReportCTA from "../../components/MarketReportCTA";` convention one line below.)

This produces two `MarketBreadcrumbs` renders on the state page (one inside `StatePageContent` near the top, one inside the SEO content `<section>` added in Step 1) — both point at the same state, which is intentional: it mirrors the existing pre-change structure where the state page already had two separate breadcrumb-adjacent regions (the nav in `StatePageContent` and no breadcrumb at all in the SEO section). Confirm this reads correctly when you do the manual check in Task 13; if two breadcrumbs on one page looks wrong, remove the one added in Step 1's SEO section and keep only the `StatePageContent` one (the SEO section didn't have any breadcrumb before this task, so removing it is a no-risk fallback that still leaves this task's core goal — one honest breadcrumb component — intact).

- [ ] **Step 3: Type-check and run the full unit test suite**

Run: `npm --prefix packages/frontend exec -- tsc --noEmit`
Expected: no new errors.

Run: `npm --prefix packages/frontend run test:unit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "packages/frontend/app/(public)/markets/state/[state]/page.tsx" "packages/frontend/app/(public)/markets/state/[state]/StatePageContent.tsx"
git commit -m "refactor(seo): state page onto shared market-hierarchy + MarketBreadcrumbs, view-all ZIP links point to dedicated overflow pages"
```

---

### Task 8: New overflow route `/markets/[slug]/counties`

**Files:**

- Create: `packages/frontend/app/(public)/markets/[slug]/counties/page.tsx`

**Interfaces:**

- Consumes: `getCountiesForMetro`, `getAncestorChainForMetro`, `MARKET_LINKS_DISPLAY_CAP` (Task 1); `MarketBreadcrumbs` (Task 2).

- [ ] **Step 1: Create `packages/frontend/app/(public)/markets/[slug]/counties/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { METRO_SLUG_DATA, SLUG_TO_METRO } from "@/lib/data/metro-slug-data";
import {
  getCountiesForMetro,
  getAncestorChainForMetro,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
import { MarketBreadcrumbs } from "@/app/markets/components/MarketBreadcrumbs";

// Only generate this overflow page for metros with more counties than the
// inline display cap — a metro at or under the cap already shows every county
// on its own page, so a duplicate "view all" page would be redundant content.
export function generateStaticParams() {
  return METRO_SLUG_DATA.filter(
    (metro) =>
      getCountiesForMetro(metro.cbsaCode).length > MARKET_LINKS_DISPLAY_CAP,
  ).map((metro) => ({ slug: metro.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) return {};
  const counties = getCountiesForMetro(metro.cbsaCode);
  if (counties.length <= MARKET_LINKS_DISPLAY_CAP) return {};

  const pageUrl = `https://www.propertyiq.app/markets/${metro.slug}/counties`;
  const title = `All ${counties.length} Counties in the ${metro.shortName} Metro Area`;
  const description = `Browse PropertyIQ market data for every county in the ${metro.shortName} metro area — ${counties.length} counties tracked.`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours
export const dynamicParams = true;

export default async function MetroCountiesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) notFound();

  const counties = getCountiesForMetro(metro.cbsaCode);
  if (counties.length <= MARKET_LINKS_DISPLAY_CAP) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <MarketBreadcrumbs
        chain={getAncestorChainForMetro(metro)}
        currentName={`${metro.shortName} Counties`}
        currentHref={`/markets/${metro.slug}/counties`}
      />

      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        All Counties in the {metro.shortName} Metro Area
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        {counties.length} counties tracked by PropertyIQ in the{" "}
        {metro.shortName} metro area.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {counties.map((county) => (
          <Link
            key={county.fips}
            href={`/markets/county/${county.slug}`}
            className="block p-3 rounded-lg border border-outline-variant hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <span className="text-sm font-medium text-on-surface">
              {county.shortName}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm --prefix packages/frontend exec -- tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "packages/frontend/app/(public)/markets/[slug]/counties/page.tsx"
git commit -m "feat(seo): add /markets/[slug]/counties overflow page for large metros"
```

---

### Task 9: New overflow route `/markets/[slug]/zips`

**Files:**

- Create: `packages/frontend/app/(public)/markets/[slug]/zips/page.tsx`

**Interfaces:**

- Consumes: `getZipsForMetro`, `getAncestorChainForMetro`, `MARKET_LINKS_DISPLAY_CAP` (Task 1); `MarketBreadcrumbs` (Task 2).

- [ ] **Step 1: Create `packages/frontend/app/(public)/markets/[slug]/zips/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { METRO_SLUG_DATA, SLUG_TO_METRO } from "@/lib/data/metro-slug-data";
import {
  getZipsForMetro,
  getAncestorChainForMetro,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
import { MarketBreadcrumbs } from "@/app/markets/components/MarketBreadcrumbs";

// Only generate this overflow page for metros with more ZIPs than the inline
// display cap — see the sibling /counties route for the same reasoning.
export function generateStaticParams() {
  return METRO_SLUG_DATA.filter(
    (metro) =>
      getZipsForMetro(metro.cbsaCode).length > MARKET_LINKS_DISPLAY_CAP,
  ).map((metro) => ({ slug: metro.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) return {};
  const zips = getZipsForMetro(metro.cbsaCode);
  if (zips.length <= MARKET_LINKS_DISPLAY_CAP) return {};

  const pageUrl = `https://www.propertyiq.app/markets/${metro.slug}/zips`;
  const title = `All ${zips.length} ZIP Codes in the ${metro.shortName} Metro Area`;
  const description = `Browse PropertyIQ market data for every ZIP code in the ${metro.shortName} metro area — ${zips.length} ZIP codes tracked.`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours
export const dynamicParams = true;

export default async function MetroZipsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) notFound();

  const zips = getZipsForMetro(metro.cbsaCode);
  if (zips.length <= MARKET_LINKS_DISPLAY_CAP) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <MarketBreadcrumbs
        chain={getAncestorChainForMetro(metro)}
        currentName={`${metro.shortName} ZIP Codes`}
        currentHref={`/markets/${metro.slug}/zips`}
      />

      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        All ZIP Codes in the {metro.shortName} Metro Area
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        {zips.length} ZIP codes tracked by PropertyIQ in the {metro.shortName}{" "}
        metro area.
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {zips.map((zip) => (
          <Link
            key={zip.zip}
            href={`/markets/zip/${zip.slug}`}
            className="block p-3 rounded-lg border border-outline-variant hover:border-primary hover:bg-primary/5 transition-colors text-center"
          >
            <span className="text-sm font-medium text-on-surface">
              {zip.zip}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm --prefix packages/frontend exec -- tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "packages/frontend/app/(public)/markets/[slug]/zips/page.tsx"
git commit -m "feat(seo): add /markets/[slug]/zips overflow page for large metros"
```

---

### Task 10: New overflow route `/markets/county/[slug]/zips`

**Files:**

- Create: `packages/frontend/app/(public)/markets/county/[slug]/zips/page.tsx`

**Interfaces:**

- Consumes: `getZipsForCounty`, `getAncestorChainForCounty`, `MARKET_LINKS_DISPLAY_CAP` (Task 1); `MarketBreadcrumbs` (Task 2).

- [ ] **Step 1: Create `packages/frontend/app/(public)/markets/county/[slug]/zips/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { COUNTY_SLUG_DATA, SLUG_TO_COUNTY } from "@/lib/data/county-slug-data";
import {
  getZipsForCounty,
  getAncestorChainForCounty,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
import { MarketBreadcrumbs } from "@/app/markets/components/MarketBreadcrumbs";

// Only generate this overflow page for counties with more ZIPs than the inline
// display cap — see the metro /counties and /zips routes for the same reasoning.
export function generateStaticParams() {
  return COUNTY_SLUG_DATA.filter(
    (county) => getZipsForCounty(county.fips).length > MARKET_LINKS_DISPLAY_CAP,
  ).map((county) => ({ slug: county.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const county = SLUG_TO_COUNTY.get(slug);
  if (!county) return {};
  const zips = getZipsForCounty(county.fips);
  if (zips.length <= MARKET_LINKS_DISPLAY_CAP) return {};

  const pageUrl = `https://www.propertyiq.app/markets/county/${county.slug}/zips`;
  const title = `All ${zips.length} ZIP Codes in ${county.shortName}`;
  const description = `Browse PropertyIQ market data for every ZIP code in ${county.shortName} — ${zips.length} ZIP codes tracked.`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours
export const dynamicParams = true;

export default async function CountyZipsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const county = SLUG_TO_COUNTY.get(slug);
  if (!county) notFound();

  const zips = getZipsForCounty(county.fips);
  if (zips.length <= MARKET_LINKS_DISPLAY_CAP) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <MarketBreadcrumbs
        chain={getAncestorChainForCounty(county)}
        currentName={`${county.shortName} ZIP Codes`}
        currentHref={`/markets/county/${county.slug}/zips`}
      />

      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        All ZIP Codes in {county.shortName}
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        {zips.length} ZIP codes tracked by PropertyIQ in {county.shortName}.
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {zips.map((zip) => (
          <Link
            key={zip.zip}
            href={`/markets/zip/${zip.slug}`}
            className="block p-3 rounded-lg border border-outline-variant hover:border-primary hover:bg-primary/5 transition-colors text-center"
          >
            <span className="text-sm font-medium text-on-surface">
              {zip.zip}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm --prefix packages/frontend exec -- tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "packages/frontend/app/(public)/markets/county/[slug]/zips/page.tsx"
git commit -m "feat(seo): add /markets/county/[slug]/zips overflow page for large counties"
```

---

### Task 11: Sitemap wiring for the three overflow routes

**Files:**

- Modify: `packages/frontend/lib/seo/sitemap-builder.ts`

**Interfaces:**

- Consumes: `getCountiesForMetro`, `getZipsForMetro`, `getZipsForCounty`, `MARKET_LINKS_DISPLAY_CAP` (Task 1).
- Produces: `buildMetroCountiesUrls()`, `buildMetroZipsUrls()`, `buildCountyZipsUrls()`, wired into `buildSitemapById` (new ids `"metro-counties"`, `"metro-zips"`, `"county-zips"`) and `buildIndexEntries`. No changes needed to `app/sitemaps/[id]/route.ts` or `app/sitemap.xml/route.ts` — both already call these functions generically by id/via `buildIndexEntries`.

- [ ] **Step 1: Add the import and three builder functions**

Add to the import block at the top of `packages/frontend/lib/seo/sitemap-builder.ts` (after the existing `STATE_SLUG_DATA` import):

```ts
import {
  getCountiesForMetro,
  getZipsForMetro,
  getZipsForCounty,
  MARKET_LINKS_DISPLAY_CAP,
} from "@/lib/data/market-hierarchy";
```

Add after `buildCountiesUrls` (after line 156, before `buildZipChunkUrls`):

```ts
export async function buildMetroCountiesUrls(): Promise<SitemapUrl[]> {
  const { lastmod, entries } = await scoredEntries(
    "metro",
    METRO_SLUG_DATA,
    (metro) => metro.cbsaCode,
  );
  return entries
    .filter(
      (metro) =>
        getCountiesForMetro(metro.cbsaCode).length > MARKET_LINKS_DISPLAY_CAP,
    )
    .map((metro) => ({
      loc: `${BASE_URL}/markets/${metro.slug}/counties`,
      lastmod,
    }));
}

export async function buildMetroZipsUrls(): Promise<SitemapUrl[]> {
  const { lastmod, entries } = await scoredEntries(
    "metro",
    METRO_SLUG_DATA,
    (metro) => metro.cbsaCode,
  );
  return entries
    .filter(
      (metro) =>
        getZipsForMetro(metro.cbsaCode).length > MARKET_LINKS_DISPLAY_CAP,
    )
    .map((metro) => ({
      loc: `${BASE_URL}/markets/${metro.slug}/zips`,
      lastmod,
    }));
}

export async function buildCountyZipsUrls(): Promise<SitemapUrl[]> {
  const { lastmod, entries } = await scoredEntries(
    "county",
    COUNTY_SLUG_DATA,
    (county) => county.fips,
  );
  return entries
    .filter(
      (county) =>
        getZipsForCounty(county.fips).length > MARKET_LINKS_DISPLAY_CAP,
    )
    .map((county) => ({
      loc: `${BASE_URL}/markets/county/${county.slug}/zips`,
      lastmod,
    }));
}
```

- [ ] **Step 2: Wire into `buildIndexEntries` — insert after the existing `counties` entry (after line 191, before the ZIP chunk loop)**

Replace:

```ts
const entries: { loc: string; lastmod?: string }[] = [
  { loc: `${BASE_URL}/sitemaps/main` },
  // States share the same monthly refresh date as the other geo tiers.
  { loc: `${BASE_URL}/sitemaps/states`, lastmod: isoOrUndefined(metro.date) },
  { loc: `${BASE_URL}/sitemaps/metros`, lastmod: isoOrUndefined(metro.date) },
  {
    loc: `${BASE_URL}/sitemaps/counties`,
    lastmod: isoOrUndefined(county.date),
  },
];
```

with:

```ts
const entries: { loc: string; lastmod?: string }[] = [
  { loc: `${BASE_URL}/sitemaps/main` },
  // States share the same monthly refresh date as the other geo tiers.
  { loc: `${BASE_URL}/sitemaps/states`, lastmod: isoOrUndefined(metro.date) },
  { loc: `${BASE_URL}/sitemaps/metros`, lastmod: isoOrUndefined(metro.date) },
  {
    loc: `${BASE_URL}/sitemaps/counties`,
    lastmod: isoOrUndefined(county.date),
  },
  {
    loc: `${BASE_URL}/sitemaps/metro-counties`,
    lastmod: isoOrUndefined(metro.date),
  },
  {
    loc: `${BASE_URL}/sitemaps/metro-zips`,
    lastmod: isoOrUndefined(metro.date),
  },
  {
    loc: `${BASE_URL}/sitemaps/county-zips`,
    lastmod: isoOrUndefined(county.date),
  },
];
```

- [ ] **Step 3: Wire into `buildSitemapById` — add the three new ids before the `zipMatch` regex check**

Replace:

```ts
export async function buildSitemapById(
  id: string,
): Promise<SitemapUrl[] | null> {
  if (id === "main") return buildMainUrls();
  if (id === "states") return buildStatesUrls();
  if (id === "metros") return buildMetrosUrls();
  if (id === "counties") return buildCountiesUrls();

  const zipMatch = /^zips-(\d+)$/.exec(id);
```

with:

```ts
export async function buildSitemapById(
  id: string,
): Promise<SitemapUrl[] | null> {
  if (id === "main") return buildMainUrls();
  if (id === "states") return buildStatesUrls();
  if (id === "metros") return buildMetrosUrls();
  if (id === "counties") return buildCountiesUrls();
  if (id === "metro-counties") return buildMetroCountiesUrls();
  if (id === "metro-zips") return buildMetroZipsUrls();
  if (id === "county-zips") return buildCountyZipsUrls();

  const zipMatch = /^zips-(\d+)$/.exec(id);
```

- [ ] **Step 4: Type-check**

Run: `npm --prefix packages/frontend exec -- tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/seo/sitemap-builder.ts
git commit -m "feat(seo): add overflow-page URLs to the sitemap index"
```

---

### Task 12: Extend de-scored redirects to cover overflow pages

**Files:**

- Modify: `scripts/generate-descored-redirects.ts`

**Interfaces:**

- No new exports — extends the existing metro and county redirect-generation blocks. Adds two redirects per de-scored metro (`/markets/{slug}/counties`, `/markets/{slug}/zips`) and one per de-scored county (`/markets/county/{slug}/zips`), all pointing at the same `destination` already computed for the geo's main page. A redirect rule for an overflow page that was never actually generated (parent had ≤12 children) is a harmless no-op — it simply never matches an incoming request — so this does not need to recompute whether the overflow page existed.

- [ ] **Step 1: Extend the metro redirect block**

Replace:

```ts
      const ancestorKeys: AncestorKeys = { state: oldEntry.state };
      const destination = resolveAncestorRedirect(
        ancestorKeys,
        publishedCountySlugByFips,
        publishedMetroSlugByCbsa,
        stateSlugOf,
      );
      if (destination !== null) {
        allRedirects.push({
          source: `/markets/${oldEntry.slug}`,
          destination,
          permanent: false,
        });
        count++;
      }
    }
    console.log(`metro: ${count} redirects`);
```

with:

```ts
      const ancestorKeys: AncestorKeys = { state: oldEntry.state };
      const destination = resolveAncestorRedirect(
        ancestorKeys,
        publishedCountySlugByFips,
        publishedMetroSlugByCbsa,
        stateSlugOf,
      );
      if (destination !== null) {
        allRedirects.push({
          source: `/markets/${oldEntry.slug}`,
          destination,
          permanent: false,
        });
        // Overflow pages (if this metro ever had >12 counties/zips) must
        // redirect alongside the main page. A rule for an overflow page that
        // never existed is a harmless no-op — it just never matches a request.
        allRedirects.push({
          source: `/markets/${oldEntry.slug}/counties`,
          destination,
          permanent: false,
        });
        allRedirects.push({
          source: `/markets/${oldEntry.slug}/zips`,
          destination,
          permanent: false,
        });
        count++;
      }
    }
    console.log(`metro: ${count} redirects`);
```

- [ ] **Step 2: Extend the county redirect block**

Replace:

```ts
      const ancestorKeys: AncestorKeys = {
        cbsaCode: oldEntry.cbsaCode,
        state: oldEntry.state,
      };
      const destination = resolveAncestorRedirect(
        ancestorKeys,
        publishedCountySlugByFips,
        publishedMetroSlugByCbsa,
        stateSlugOf,
      );
      if (destination !== null) {
        allRedirects.push({
          source: `/markets/county/${oldEntry.slug}`,
          destination,
          permanent: false,
        });
        count++;
      }
    }
    console.log(`county: ${count} redirects`);
```

with:

```ts
      const ancestorKeys: AncestorKeys = {
        cbsaCode: oldEntry.cbsaCode,
        state: oldEntry.state,
      };
      const destination = resolveAncestorRedirect(
        ancestorKeys,
        publishedCountySlugByFips,
        publishedMetroSlugByCbsa,
        stateSlugOf,
      );
      if (destination !== null) {
        allRedirects.push({
          source: `/markets/county/${oldEntry.slug}`,
          destination,
          permanent: false,
        });
        // Overflow page (if this county ever had >12 zips) must redirect
        // alongside the main page — same no-op reasoning as the metro block above.
        allRedirects.push({
          source: `/markets/county/${oldEntry.slug}/zips`,
          destination,
          permanent: false,
        });
        count++;
      }
    }
    console.log(`county: ${count} redirects`);
```

- [ ] **Step 3: Type-check**

Run: `npm --prefix packages/frontend exec -- tsc --noEmit` is frontend-only; this script lives at repo root. Run: `npx tsc --noEmit -p tsconfig.json` from the repo root if one exists, otherwise verify with `npx tsx --check scripts/generate-descored-redirects.ts` (a syntax/type parse, no execution). If neither is configured, skip straight to Step 4 — the script's only new code is two more `allRedirects.push({...})` calls with the same shape already used four lines above, so the type surface is unchanged.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-descored-redirects.ts
git commit -m "feat(seo): redirect overflow pages alongside their parent metro/county on de-score"
```

---

### Task 13: Full verification — build, sitemap, and a live link-chain walk

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit test suite**

Run: `npm --prefix packages/frontend run test:unit`
Expected: PASS, including all tests added in Tasks 1–3.

- [ ] **Step 2: Full type-check**

Run: `npm --prefix packages/frontend exec -- tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm --prefix packages/frontend run build`
Expected: build succeeds. Per CLAUDE.md/lessons.md, fix ANY error before proceeding — including pre-existing ones encountered along the way. Watch the metro/county/ZIP static-generation step for `generateStaticParams` counts on the three new overflow routes and confirm they're non-zero (a metro-heavy state like Texas or California should produce at least a few dozen `/counties` and `/zips` overflow pages; most counties should produce at least a few hundred `/zips` overflow pages nationally, since ZIP-per-county density is high).

- [ ] **Step 4: Start the app locally and manually walk one full chain**

Run: `npm --prefix packages/frontend run start` (after `build`, or `npm --prefix packages/frontend run dev` for a quicker iteration loop), then in a browser walk:

1. `/markets/state/texas` — confirm the breadcrumb shows Home / Markets / Texas, and metro/county ZIP "+more" links now point at `/markets/{slug}/zips` or `/markets/county/{slug}/zips` (not back to the parent page).
2. Click into a large Texas metro (e.g. the Austin or Houston metro page) — confirm the breadcrumb reads Home / Markets / Texas / {Metro}, and two new down-link groups appear ("Counties in the ... metro area", "ZIP codes in the ... metro area") each with a "View all N →" link.
3. Click "View all N counties" — confirm `/markets/{slug}/counties` renders the full list with a working breadcrumb, and every link resolves to a real county page (no 404s).
4. From that metro, click into one of its counties — confirm the breadcrumb reads Home / Markets / Texas / {Metro} / {County}, and a "ZIP codes in {County}" down-link group with its own "View all N →" appears (if the county has >12 ZIPs).
5. Click "View all N ZIP codes" — confirm `/markets/county/{slug}/zips` renders and every link resolves to a real ZIP page.
6. From that ZIP page, confirm the breadcrumb reads the full Home / Markets / Texas / {Metro} / {County} / {ZIP} chain.
7. Pick a small metro (≤12 counties, e.g. most non-CBSA-dense metros) — confirm NO "View all" link appears for its down-link group that's at/under the cap, and that hitting `/markets/{that-slug}/counties` directly returns a 404 (matches the `generateStaticParams` filter).

- [ ] **Step 5: Sitemap check**

Run: `npm --prefix packages/frontend run dev` (if not already running), then fetch:

- `curl -s http://localhost:3000/sitemap.xml` — confirm `<sitemap>` entries for `metro-counties`, `metro-zips`, `county-zips` appear alongside the existing `metros`/`counties`/`zips-N` entries.
- `curl -s http://localhost:3000/sitemaps/metro-counties` — confirm it returns a non-empty `<urlset>` with `/markets/{slug}/counties` URLs.
- `curl -s http://localhost:3000/sitemaps/county-zips` — confirm it returns a non-empty `<urlset>` with `/markets/county/{slug}/zips` URLs.

- [ ] **Step 6: Confirm this is a clean stopping point**

No commit needed for this task (verification only). If any spot-check in Step 4 or 5 fails, fix the root cause in the relevant earlier task's files and re-run that task's own type-check/test step before returning here — do not patch around it with a special case in Task 13.

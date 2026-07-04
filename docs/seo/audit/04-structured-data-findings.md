# SEO Audit 04 — Structured Data (JSON-LD) Findings

> **Scope:** PropertyIQ's live JSON-LD markup graded against Google's own structured-data rules (rubrics `05-appearance-titles-snippets-sd-core.md` + `06-structured-data-types-images.md`).
> **Method:** Read the source builders, then extracted the ACTUAL rendered JSON-LD from the live DOM (Playwright, not markdown) on 5 production pages, and captured the VISIBLE market stats to test the must-match-visible cardinal rule.
> **Date:** 2026-06-19. Live host: `https://www.propertyiq.app`.
> **Severity legend:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · ⚪ LOW.

---

## 0. HEADLINE VERDICT

**No must-match-visible (Critical, C1) violations were found.** The Dataset builder reads from the exact same server view-model that the visible `MarketStatsBlock` renders, and it `.filter()`s out null fields — so JSON-LD never asserts a value the page doesn't show. This is the single most important result and it passes by construction.

The remaining findings are corrective/cleanup, not manual-action class:

| #   | Finding                                                                                     | Severity | Type             |
| --- | ------------------------------------------------------------------------------------------- | -------- | ---------------- |
| F1  | `Organization.sameAs` points to placeholder social profiles that do not exist               | 🟠 HIGH  | Accuracy (C6/C1) |
| F2  | `WebSite.potentialAction` / `SearchAction` is dead weight (sitelinks searchbox retired)     | 🟡 MED   | Deprecation (D2) |
| F3  | `/data` page emits **duplicate** `WebPage` + duplicate `BreadcrumbList` (two LD blocks)     | 🟡 MED   | Correctness      |
| F4  | `FAQPage` produces no rich result for a RE SaaS (inert); keep only for users/AI             | 🟡 MED   | Deprecation (D2) |
| F5  | Dataset is under-built vs. Google Dataset Search recommendations (opportunity)              | 🟡 MED   | Opportunity      |
| F6  | `SoftwareApplication.featureList`/`billingIncrement` are non-standard / unsupported props   | ⚪ LOW   | Polish           |
| F7  | Bare `Place` block on metro pages is inert (no rich result), but harmless + visible-aligned | ⚪ LOW   | Polish           |

---

## 1. MUST-MATCH-VISIBLE (Cardinal C1) — Dataset on market pages ✅ PASS

**Rule (C1, 🔴):** JSON-LD may only assert values that are _also visible_ on the rendered page (intro-structured-data + sd-policies). Markup-only data is a manual-action-class violation.

**Builder:** `packages/frontend/app/(public)/markets/components/buildStatsJsonLd.ts`. Its `variableMeasured` array is built from `data.headline.{medianPrice, rent, daysOnMarket, yoy}` — the **same `MarketStatsData` object** consumed by the visible `MarketStatsBlock.tsx`. Both call `.filter((f) => f.value !== null)` / render `—` for nulls, so they stay in lockstep.

### Live verification — Metro (Austin, `…/markets/austin-round-rock-san-marcos-tx`)

| Field        | JSON-LD `variableMeasured` value   | Visible in `MarketStatsBlock` | Match                          |
| ------------ | ---------------------------------- | ----------------------------- | ------------------------------ |
| Median Price | `428524.117…` (obsDate 2026-05-31) | `$429K`                       | ✅ (rounded)                   |
| Rent (ZORI)  | `1635.209…`                        | `$2K`                         | ✅ (formatValue rounds $1,635) |
| Median DOM   | `56` (obsDate 2026-05-01)          | `56 days`                     | ✅                             |
| YoY          | `-3.145…`                          | `-3.1%`                       | ✅                             |

### Live verification — ZIP (`…/markets/zip/35201-birmingham-al`)

The ZIP Dataset emitted **only 3** `variableMeasured` entries — **YoY was correctly dropped** because its value was null, and the page **visibly shows `YoY —`**. This is the rule working exactly as intended (null markup AND null visible).

| Field        | JSON-LD value | Visible    | Match                  |
| ------------ | ------------- | ---------- | ---------------------- |
| Median Price | `86112`       | `$86K`     | ✅                     |
| Rent (ZORI)  | `1266`        | `$1K`      | ✅                     |
| Median DOM   | `109`         | `109 days` | ✅                     |
| YoY          | _(omitted)_   | `—`        | ✅ (absent both sides) |

**Verdict:** ✅ **Compliant.** Keep the builder as-is — the shared-view-model pattern is the correct, defensible design. No fix required.

> Note (data, not markup): the ZIP `dateModified` was `2026-01-01` while `Median Price.observationDate` was `2024-02-01` — a _data-freshness_ gap for that ZIP, but not a structured-data violation since the marked-up value equals the visibly-shown value. Surfacing the real per-field `observationDate` (which the builder already does) is the honest move.

---

## 2. Per-Type Grades

### 2.1 Organization (homepage) — USE, but FIX `sameAs` 🟠

**Source:** `app/components/home/JsonLd.tsx`. **Live:** present, single `@graph` block.

| Rubric check (type 06 §1)     | Status                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `url`                 | ✅ present                                                                                                                          |
| `logo` crawlable & ≥112px     | ✅ `https://www.propertyiq.app/logo.png`, 512×512 (well over the 112px minimum) — verify the PNG renders on white per Google's note |
| `contactPoint` (email)        | ✅ `support@propertyiq.app`                                                                                                         |
| `description`, `foundingDate` | ✅ present                                                                                                                          |
| **`sameAs` accuracy**         | 🟠 **VIOLATION**                                                                                                                    |

**F1 — `sameAs` placeholders (🟠 HIGH, accuracy):** Live markup asserts
`"https://twitter.com/propertyiq"` and `"https://linkedin.com/company/propertyiq"`.
These are **template/placeholder handles**. If those profiles are not real, claimed, and owned by PropertyIQ, this violates the accuracy/non-misleading guideline ("Your structured data must be a true representation of the page content" / "Don't … misrepresent your ownership, affiliation"). Inaccurate `sameAs` also harms brand disambiguation rather than helping it.

- **Exact fix (`app/components/home/JsonLd.tsx`, `organizationSchema.sameAs`):** replace with the **real, verified** profile URLs PropertyIQ actually controls (X is now `https://x.com/<handle>`, plus the real LinkedIn company slug, Crunchbase, etc.). If no official social profiles exist yet, **remove `sameAs` entirely** rather than ship fabricated handles — an absent `sameAs` is compliant; a wrong one is not.

### 2.2 SoftwareApplication (+ Offer) (homepage) — USE, minor polish ⚪

**Source:** `JsonLd.tsx` `softwareSchema`. **Live:** present.

| Required (type 06 §2)                                | Status                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `name`                                               | ✅ "PropertyIQ"                                                        |
| One of `aggregateRating` / `review` / `offers.price` | ✅ `offers[].price` present (Free `"0"`, Pro `"39"`, Team `"99"`)      |
| `offers[].priceCurrency`                             | ✅ `"USD"` on every offer (rubric requirement met for the $39/mo tier) |
| `applicationCategory`, `operatingSystem`             | ✅ `BusinessApplication`, `Web`                                        |

**Verdict: eligible** — required "one-of" satisfied with valid `offers.price` + `priceCurrency`. Do **not** add `aggregateRating`/`review` unless real first-party reviews are displayed (fabrication = C6 manual action).

**F6 — non-standard props (⚪ LOW):** `billingIncrement: "P1M"` is **not a schema.org Offer property** (the correct recurring-price construct is `priceSpecification` → `UnitPriceSpecification` with `billingDuration`/`billingIncrement`, or simply leave it off). `featureList` is also not a Google-supported SoftwareApplication property and is ignored. Both are harmless (Google ignores unknown props) — clean up at leisure; not blocking. Optionally co-type `WebApplication` to better match the SaaS subtype (rubric §2 note).

### 2.3 WebSite + SearchAction (homepage) — DROP the SearchAction 🟡

**Source:** `JsonLd.tsx` `websiteSchema`. **Live:** `WebSite{name,url,description,publisher}` **plus** `potentialAction → SearchAction` targeting `/map?q={search_term_string}`.

**F2 (🟡 MED, confirmed deprecation — rubric 06 §3 / 05 §D2):** the **sitelinks search box feature was retired Nov 2024**; `SearchAction` markup is now **inert** and removed from Search Console + the Rich Results Test. It produces **no rich result**.

- **Exact fix (`JsonLd.tsx`):** delete the `potentialAction` block from `websiteSchema`. **Keep** the bare `WebSite { @id, url, name }` — that variation still powers the site-name feature in the SERP and is worth retaining. (Leaving the SearchAction in is harmless to Google but is dead weight that misleads code readers into thinking it does something.)

### 2.4 BreadcrumbList — USE (high value), all correct ✅

**Live across metro, ZIP, scores, data, blog.** Verified on every page:

| Page           | Items | Positions                  | Items resolvable                          |
| -------------- | ----- | -------------------------- | ----------------------------------------- |
| Metro (Austin) | 3     | 1→2→3 sequential ✅        | Home / Markets / Austin, TX ✅            |
| ZIP (35201)    | 3     | 1→2→3 ✅                   | Home / Markets / 35201, Birmingham, AL ✅ |
| Scores         | 2     | 1→2 ✅                     | Home / Scores ✅                          |
| Data           | 2     | 1→2 ✅ (×2, see F3)        | Home / Data Sources ✅                    |
| Blog post      | 3     | 1→2→3 ✅ (source-verified) | Home / Blog / {title} ✅                  |

All satisfy the rubric: ≥2 ListItems, `position` starts at 1 and increments sequentially (the #1 silent-failure), every item has `name` + resolvable `item` URL, schema.org JSON-LD (not deprecated data-vocabulary.org). **No fix needed** — except the duplication on `/data` (F3).

### 2.5 Dataset (market pages) — USE, BIG OPPORTUNITY to strengthen 🟡

**Source:** `buildStatsJsonLd.ts`. **Live:** present on metro + ZIP.

| Required (type 06 §5) | Status                                                    |
| --------------------- | --------------------------------------------------------- |
| `name`                | ✅ unique per market (`"Austin, TX Housing Market Data"`) |
| `description`         | ✅ 50–5000 chars                                          |

Recommended present: `url`, `dateModified`, `creator` (Organization PropertyIQ), `license` (`/terms`), `variableMeasured` (with per-field `observationDate`). Good baseline — **and it's the cardinal-rule-safe one (§1).**

**F5 — Dataset Search optimization (🟡 MED, opportunity):** to maximize eligibility in Google's Dataset Search vertical (the whole point for a 33k-page data site), add the recommended properties the builder currently omits:

- `spatialCoverage` — a `Place` with the metro/ZIP name (and ideally `geo`/`GeoShape`). High signal for a geo dataset; you already have the geography.
- `temporalCoverage` — ISO-8601 interval of the data window (e.g. `"2001-01/2026-05"` or the per-page series span).
- `isAccessibleForFree: true` (these SEO pages are public).
- `keywords` — e.g. `["housing market", "home prices", "{metro} real estate", "rent", "days on market"]`.
- `identifier` / `sameAs` — a stable canonical URL identifier per market.
- Optionally `distribution` (`DataDownload`) **only if** a real downloadable/queryable artifact exists — do not fabricate a download URL.

- **Exact fix:** extend `buildStatsJsonLd.ts` to accept the geo descriptor (name + lat/long if available) and emit `spatialCoverage`, `temporalCoverage`, `isAccessibleForFree`, `keywords`. Keep `variableMeasured` reading from the same view-model so §1 compliance is preserved.

### 2.6 FAQPage (scores page) — DROP for SEO value / keep only for users 🟡

**Source:** `app/(app)/scores/ScoresFaqSection.tsx` (`ScoresFaqJsonLd`). **Live:** present; **all 7 Q&A answers are also rendered visibly** in the on-page FAQ accordion (must-match-visible ✅).

**F4 (🟡 MED, confirmed deprecation — rubric 05 §D2 / 06 §6):** FAQ rich results were restricted (Aug 2023) to **government/health sites only** and Google announced FAQ rich results stop appearing as of **May 7, 2026**, with report/Rich-Results-Test support dropped June 2026. **A real-estate SaaS gets ZERO FAQ rich result.**

- **Recommendation:** This is correctly built and visible-aligned, so it is **not harmful** — but it earns **no SERP rich result**. **Deprioritize.** Keep the visible accordion for users and AI-citation value; the `FAQPage` JSON-LD can stay (inert) or be removed. **Do not claim it produces rich results**, and don't invest further effort in it. Note one consistency nit: the FAQ answer says "865 metro areas, 3,073 counties, over 26,000 ZIPs" (validation-window numbers) while the homepage SoftwareApplication says "935 metros, 3,137 counties, 29,417 ZIPs" (live-scored numbers) — both are defensible (validated vs. scored) but the difference can read as inconsistent; consider a one-line clarifier.

### 2.7 Article / BlogPosting (blog) — USE, minor type nit ⚪

**Source:** `app/(app)/blog/[slug]/page.tsx` (source-verified; live blog post not separately fetched).

- Uses `@type: "Article"` with `headline`, `description`, `datePublished`, `dateModified`, `author` (Person + url), `publisher` (Organization), `mainEntityOfPage`, conditional `image`, and a 3-item BreadcrumbList. No required props for Article, so it's **eligible** and well-formed.
- ⚪ Rubric §7 recommends **`BlogPosting`** (more specific) for blog content over the generic `Article`. Optional refinement.
- `author.name` should contain only the name (no honorifics) — verify the frontmatter `author` values comply.

### 2.8 DataCatalog + nested Datasets (`/data` page) — FIX duplication 🟡

**Source:** `app/(app)/data/page.tsx`. **Live:** **two** `<script type=ld+json>` blocks:

1. `WebPageJsonLd` component → `@graph:[WebPage, BreadcrumbList]`
2. inline script → `@graph:[WebPage, DataCatalog, BreadcrumbList]`

**F3 (🟡 MED, correctness):** the page emits **two `WebPage` nodes and two `BreadcrumbList` nodes** for the same URL. The page renders `<WebPageJsonLd …/>` _and_ a hand-rolled inline block that both describe the page and both include a breadcrumb. Duplicate same-type nodes are not an error per se, but they're redundant/conflicting and untidy; a single source is cleaner and avoids ambiguity.

- **Exact fix (`app/(app)/data/page.tsx`):** drop the `<WebPageJsonLd …/>` call **or** remove the `WebPage`+`BreadcrumbList` members from the inline `@graph`, leaving exactly one `WebPage` and one `BreadcrumbList`. Keep the `DataCatalog` (its 7 nested `Dataset` names all map to provider sections visibly rendered on the page — must-match-visible ✅). Optionally give each nested `Dataset` a `url`/anchor and a `description` ≥50 chars to strengthen Dataset Search eligibility.

### 2.9 Place (metro pages) — inert, harmless ⚪

**Source:** `app/(public)/markets/[slug]/MetroPageContent.tsx` (a child component **not in the original review list** — surfaced by reading the live DOM). **Live:** `Place{ name: metro.name, url, containedInPlace: Country US }`.

**F7 (⚪ LOW):** `Place` is not a Google rich-result type, so this block does nothing in Search. It IS visible-aligned — `metro.name` ("Austin-Round Rock-San Marcos, TX") appears in the page subhead ("…for the {metro.name} metro area"). Harmless. Either remove it, or **fold its geo signal into the Dataset's `spatialCoverage`** (F5) where it actually helps Dataset Search.

---

## 3. Cross-cutting checks (pass)

- **Crawlable (C4):** all pages returned full rendered HTML with JSON-LD present; no `noindex`/robots block observed on the audited pages.
- **JSON-LD format (C3):** all markup is JSON-LD in `<script type="application/ld+json">` — recommended format. ✅
- **Favicon (E2):** homepage declares `rel=icon` incl. `/icon-512.png` (512×512 square) — exceeds the ≥48px square guideline. ✅
- **One dominant H1 (A4):** each audited page has exactly one `<h1>` aligned to its `<title>` (e.g. metro H1 "Austin, TX Housing Market" ↔ title "Austin, TX Housing Market — 2026 Analysis"). ✅
- **No fabricated reviews/ratings (C6):** no `aggregateRating`/`review` markup anywhere. ✅

---

## 4. Prioritized fix list

1. 🟠 **F1** — Fix or remove `Organization.sameAs` placeholder social URLs (`JsonLd.tsx`). Accuracy/ownership risk.
2. 🟡 **F2** — Delete `WebSite.potentialAction`/`SearchAction`; keep bare `WebSite{name,url}` (`JsonLd.tsx`).
3. 🟡 **F3** — De-duplicate `WebPage` + `BreadcrumbList` on `/data` (`data/page.tsx`).
4. 🟡 **F5** — Strengthen `Dataset` with `spatialCoverage`/`temporalCoverage`/`isAccessibleForFree`/`keywords` for Dataset Search (`buildStatsJsonLd.ts`).
5. 🟡 **F4** — Deprioritize `FAQPage`; keep visible accordion, stop expecting a rich result (`ScoresFaqSection.tsx`).
6. ⚪ **F6/F7** — Clean up non-standard `billingIncrement`/`featureList`; fold `Place` into Dataset `spatialCoverage`.

**No Critical (must-match-visible) violations. No fabricated review/rating markup. No manual-action exposure found.**

# Address-Prefilled Deal Analyzer — Design Spec

**Date:** 2026-06-14
**Backlog item:** #5 — "Market-prefilled deal analyzer with source, as-of date, and confidence on every field"
**Status:** Design — awaiting review before implementation plan

---

## 1. Framing correction

The backlog titles this "market-prefilled" and mentions prefilling "by ZIP/address." That framing is misleading and is corrected here per a standing product rule:

> **The Deal Analyzer is for a specific property, never a geography.** Geographies never route into the analyzer. The user enters a concrete **address**; we resolve that address's geography _internally_ only to enrich prefill. We are not routing a market selection into the analyzer.

So this feature is an **address-driven prefill**: when the user enters a specific property address, we prefill every assumption field we can with the best data available for that property, and we stamp each prefilled field with its **source**, **as-of date**, and an **A/B/C/F confidence grade** — distinguishing real sourced data from honest estimates.

## 2. Goals & non-goals

**Goals**

- Entering an address fills the analyzer's property/market fields in one step ("2-minute analysis, zero spreadsheet").
- Every prefilled field shows source + as-of + confidence grade.
- Sourced data and heuristic estimates are visually and semantically distinct — the brand promise is "shows its receipts," so estimates are never dressed up as data.
- Works for **all tiers**, with richer (parcel-level) data for Pro.
- A non-blocking warning when a user override diverges sharply from the prefilled baseline.

**Non-goals**

- No changes to the deal math (`analyzer-core` stays plain-number inputs; no `npm run build` of the engine required).
- No new third-party data integrations for insurance/vacancy (none exist; they remain estimates).
- Geographies still do not route into the analyzer.
- Maintenance/management/expense-growth/closing-cost/financing knobs are investor _policy_, not property data — out of prefill scope.

## 3. Current state (verified in code)

- **Analyzer is already address-driven:** `app/(app)/analyzer/page.tsx` accepts `?address=` / `?zip=`; `AnalyzerClient` + `use-analyzer-state.ts` drive it. RentCast property lookup runs via button (auto for Pro on mount).
- **RentCast** (`/api/analyzer/property-lookup`, **Pro-gated**, 30-day cache, ~45 calls/mo cap) returns, per parcel: AVM, rent estimate, **property-tax history** (`propertyTaxes[]` year+total), **HOA fee**, beds/baths/sqft, resolved address with ZIP/county/countyFips, comps.
- **Today only** `avm.value → price` and `rent.value → rentMonthly` are applied (`use-analyzer-state.ts` ~141–150). **Tax history and HOA are fetched, displayed, and ignored for prefill.**
- **Market-context API** (`/api/analyzer/market-context`, ungated) returns `home_value`, `home_value_yoy`, `rent_index`, `market_heat`, `net_migration`, `piq_score` — but `toMetricValueDto` **strips the as-of date**, returning only `{value, source}`. Fetched but **only displayed**, never prefilled.
- **`MetricResolutionService.resolveMetricBatch`** returns `ResolvedMetric { value, date, source, sourceGeoId, sourceGeoLevel, isInherited, isFallback }` — all the metadata needed to stamp and grade.
- **Data gaps (honest):** no source anywhere for **insurance** or **vacancy**; no registered **rent-growth** metric; no **property-tax-rate** metric (RentCast parcel history is the only tax source, Pro-only).
- **`analyzer-core` `DealInput`** is plain numbers, no metadata — provenance must live in a parallel frontend structure.
- **Confidence/grade utilities exist:** `ConfidenceDisplay` (a/b/c/f + pct + stars), `getLetterGrade`, and `MetricTitle` (canonical "source · as of · inherited-from" provenance popover) — all reusable.
- **The search widget is markets-only** (`useUniversalSearch` → `geographies` table; custom multi-state name parsing + relevance ranking). It cannot geocode street addresses and must not be reused as the analyzer's address input (would route a geo into the analyzer).

## 4. Product decisions (from brainstorming)

1. **Free/anon prefill = geo layer only** (rent_index, home_value_yoy, ZHVI), keyed to the address's ZIP. **Pro adds the RentCast parcel layer** on top. Everyone gets prefill; Pro gets the precise version.
2. **No-data fields** (insurance, vacancy, rent-growth; + tax for free) are **labeled estimates with low confidence** — sensible value, visually distinct, C/F grade. Never blank, never disguised as data.
3. **Address input = a new Mapbox address-autocomplete** (`types=address,postcode`), styled like the existing `SearchWidget`. Resolves lat/lng + ZIP + county. Free uses the geo layer; Pro passes the address to RentCast. The analyzer stays strictly property-entry.

## 5. Architecture (Approach A — backend prefill bundle service)

A single tier-aware endpoint owns assembly and grading server-side, next to `ResolvedMetric`. The frontend just applies the bundle.

```
User picks address in AddressAutocomplete (Mapbox)               [client, all tiers]
   → { formattedAddress, lat, lng, zip }
   → GET /api/analyzer/prefill?zip=&address=&lat=&lng=
        ├─ resolve geo chain from zip (zip→county→metro→state)
        ├─ geo layer:   resolveMetricBatch(['rent_index','home_value','home_value_yoy'])   [all tiers]
        ├─ parcel layer: existing property-lookup service (RentCast), reused internally     [Pro only]
        ├─ merge:        parcel overrides geo where present
        ├─ estimates:    fill remaining gaps (insurance, vacancy, rent-growth, free-tier tax)
        └─ grade:        per-field grade via prefill-grade.ts → returns AnalyzerPrefillDto
   → frontend applies bundle → DealInput + assumptions + parallel provenance map
   → each field renders source · as-of · grade stamp
   → user edits a field → divergence check vs baseline → non-blocking warning if >30%
```

**Why A:** keeps all fallback + grade derivation server-side (CLAUDE.md §5.1 — resolution logic must live in `MetricResolutionService`), one round trip, carries the as-of date `market-context` drops, and is unit-testable as a pure function. The frontend's job collapses to "apply the bundle."

**Code locations**

- Backend: `analyzer.controller.ts` (new `GET /api/analyzer/prefill`), `analyzer.service.ts` (`getPrefillBundle()`), new pure helper `analyzer/prefill-grade.ts`, new `analyzer/dto/analyzer-prefill.dto.ts`. RentCast reuses the **existing** property-lookup service method (inherits cache + quota).
- Frontend (all through `@/lib/data`): `lib/data/fetchers/address-geocode.ts` (Mapbox) + `lib/data/fetchers/analyzer-prefill.ts`; hooks `useAddressGeocode`, `useAnalyzerPrefill`; new `AddressAutocomplete` component; changes in `use-analyzer-state.ts` (replace price/rent-only sync with bundle application + provenance map) and `InputPanel` (render stamps + divergence + new input).
- `analyzer-core`: **no change**.

## 6. Bundle contract

```ts
type ConfidenceGrade = "a" | "b" | "c" | "f";

interface PrefillFieldDto {
  value: number | null;
  source: string | null; // "RentCast", "Zillow ZORI", "Realtor", "Estimate"
  asOf: string | null; // period_date / tax year; null for estimates
  confidence: { grade: ConfidenceGrade; pct: number };
  kind: "data" | "estimate";
  geoLevel: "parcel" | "zip" | "county" | "metro" | "state" | null;
  inherited: boolean;
}

type PrefillFieldKey =
  | "price"
  | "rentMonthly"
  | "taxAnnual"
  | "insuranceAnnual"
  | "hoaMonthly"
  | "vacancyPctOfRent"
  | "appreciationPct"
  | "rentGrowthPct";

interface AnalyzerPrefillDto {
  resolvedAddress: string | null;
  geo: {
    zip: string | null;
    countyFips: string | null;
    cbsaCode: string | null;
    state: string | null;
  };
  hasParcelData: boolean; // RentCast layer applied (Pro + quota available)
  fields: Record<PrefillFieldKey, PrefillFieldDto>;
  notes: string[];
}
```

## 7. Field mapping (per tier + gap handling)

| Field              | Pro (parcel)                                  | Free / anon (geo)                                                  | kind                         |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| `price`            | RentCast AVM                                  | ZHVI typical value (capped grade C, labeled "Typical {zip} value") | data                         |
| `rentMonthly`      | RentCast rent estimate                        | `rent_index` (ZORI → FMR → Census)                                 | data                         |
| `taxAnnual`        | RentCast `propertyTaxes[0].total`             | Estimate: effective-rate × price                                   | data (Pro) / estimate (free) |
| `hoaMonthly`       | RentCast `hoaFee` if present, else 0          | 0                                                                  | data / estimate              |
| `insuranceAnnual`  | Estimate ≈ 0.55%/yr × price                   | same                                                               | estimate                     |
| `vacancyPctOfRent` | Estimate 5% (or user default)                 | same                                                               | estimate                     |
| `appreciationPct`  | `home_value_yoy` (Realtor)                    | same                                                               | data                         |
| `rentGrowthPct`    | Estimate = clamp(appreciation, 2–5%), else 3% | same                                                               | estimate (market-derived)    |

Out of scope (remain user/default policy, unstamped): `maintenancePctOfRent`, `managementPctOfRent`, `expenseGrowthPct`, closing costs, financing terms.

## 8. Confidence grade derivation (`prefill-grade.ts`, pure + unit-tested)

**Data fields** — start at 100, subtract:

- **Specificity** (from `sourceGeoLevel` / `isInherited`): parcel −0, ZIP −5, county −20, metro −30, state −45.
- **Freshness:** `max(0, monthsOld − 3) × 2`, capped at −30 (from the as-of date).
- **Fallback:** `isFallback ? −10 : 0`.
- **Special case:** free-tier `price` from ZHVI is a geo proxy for a specific purchase → pct hard-capped at 60 (grade C).

**Estimate fields:**

- Constants (insurance, vacancy) → grade **F** (~35%), source "Estimate".
- Market-derived (rent-growth, free-tier tax) → grade **C** (~50%), source "Estimate (market-based)".

`pct → grade` thresholds match `ConfidenceDisplay`: **A ≥80, B 65–79, C 45–64, F <45** — analyzer grades read identically to PropertyIQ score grades.

## 9. Frontend UX

- **`AddressAutocomplete`** — Mapbox `types=address,postcode&country=us`, styled like `SearchWidget`; `onSelect → { formattedAddress, lat, lng, zip }`. Typed-then-Enter still works (geocode on submit). Replaces the plain text input.
- **Apply bundle** — `use-analyzer-state.ts` replaces the price/rent-only sync with full bundle application to `DealInput` + assumptions, plus a parallel `provenance` map keyed by field (`{value, source, asOf, grade, kind, baseline}`).
- **Per-field stamp** — compact `FieldProvenance` line: `source · as of {date} · {A/B/C/F chip}`. Estimates render muted with an "Estimate" tag. Detail popover reuses the `MetricTitle` provenance pattern.
- **Divergence flag** — baseline stored per field; on edit, if `|new − baseline| / baseline > 0.30`, a non-blocking inline note ("2.1× the market estimate of $1,850"); clears when back in range. Data + market-derived fields only.
- **Address change = new property** — re-fetch and reset property prefill fields; **preserve** investor financing/policy assumptions; warn if manual edits exist.
- **Entry messaging** — empty state becomes "2-minute analysis, zero spreadsheet — enter an address and we'll fill in the market data," replacing the Pro-only RentCast CTA as the primary instruction.

## 10. Error handling & edge cases

- **Geocode no match** → keep manual entry, subtle notice, no prefill.
- **ZIP with no metric coverage** → geo-chain inheritance fills from county/metro/state; grade reflects the inheritance (no fake precision). If even state is missing → field null / estimate.
- **RentCast quota/error (Pro)** → silently fall back to the geo layer; `hasParcelData=false`; add a `notes` line. Never hard-fail.
- **Anonymous/free** → entitlement check means RentCast is never called.
- **Sanitization** → bundle is built server-side; no secrets or raw provider payloads reach the client.
- **Tier render safety** → no `analyzer-core` change, so no dist crash risk; still verified across tiers.

## 11. Testing (real data, no mocks)

**Backend unit**

- `prefill-grade.ts`: specificity/freshness/fallback → expected grade; free-tier price cap; estimate grades.
- `getPrefillBundle`: tier branching, parcel-override precedence, estimate fill, quota fallback, `notes` emission.

**E2E (Playwright, live DB)** — maps to backlog acceptance criteria:

- Free/anon: enter a real 78702 address → rent/appreciation/home-value non-null and **equal to a direct `resolveMetricBatch`** call for that geo; insurance/vacancy/tax show "Estimate" + low grade; every field shows source + as-of + grade.
- Pro: same address → tax/rent/HOA come from RentCast (higher grades), matching the `property-lookup` response.
- Override prefilled rent by 2× → divergence flag renders.
- Anonymous + free + Pro all render the analyzer page (no dist crash).

## 12. Acceptance criteria (from backlog #5)

- [ ] Real ZIP (78702) → rent/tax/insurance/vacancy prefill non-null, matching the metric layer's live values; each shows source + as-of + grade.
- [ ] Override a prefilled rent by 2× → divergence flag renders.
- [ ] Anonymous + free + Pro verified in a live browser; analyzer page renders (no analyzer-core dist crash).
- [ ] Prefill values match a direct `resolveMetricBatch` call for the same geo.
- [ ] RentCast property-tax history is consumed (previously ignored).
- [ ] "2-minute analysis, zero spreadsheet" messaging at the analyzer entry point.

## 13. Open items for reviewer

- Insurance heuristic rate (0.55%/yr of value) — acceptable placeholder, or do you want a state-table later? (YAGNI: start flat.)
- Free-tier `price` from ZHVI — confirm we want to prefill purchase price at all for free users, or leave `price` blank for free and only prefill rent/appreciation. (Spec currently prefills it as a capped-C estimate.)

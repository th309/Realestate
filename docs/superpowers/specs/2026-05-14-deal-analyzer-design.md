# PropertyIQ Deal Analyzer — Design Spec

**Date:** 2026-05-14
**Status:** Draft, pending user approval
**Origin:** User asked to "rebuild a Chrome extension and include it into our site," referencing [DealSnap REI](https://www.dealsnaprei.com/). Brainstorm resolved this to an **on-site analyzer page** (no actual browser extension), built on a shared workspace package.

## 1. Summary

Add an on-site real estate deal analyzer to PropertyIQ that matches the DealSnap REI feature set (cap rate, CoC, DSCR, 1% rule, monthly cashflow, 70% rule MAO, BRRRR score) and adds a PropertyIQ market-context layer (PIQ score, market heat, rent trend, net migration) that DealSnap does not have.

The deal math lives in a new shared workspace package `@propertyiq/analyzer-core` consumed by the frontend (instant recomputation), backend (AI verdict context, server validation), and `packages/mcp-server` (refactor of `cashflow_estimate` and `deal_analyzer` tools). The MCP refactor must preserve exact existing behavior — verified by golden-file parity tests.

The analyzer is reachable at `/analyzer` (top-nav), with a contextual "Analyze a property in this market" CTA on existing market detail pages. Free anonymous users get 3 lifetime analyses (signed httpOnly cookie counter) before a signup wall. Pro tier unlocks the AI buy/negotiate/pass verdict, the market-context layer, save/history, and public shareable analysis links.

## 2. Goals & Non-Goals

### Goals

- Ship a single-page deal analyzer that feels instant (no API round-trip for math edits).
- Differentiate from DealSnap by surfacing PropertyIQ's market data on every analysis.
- Establish `@propertyiq/analyzer-core` as the canonical home for deal math, eliminating MCP-inline duplication.
- Drive signups via the 3-analysis lifetime preview wall.
- Drive upgrades via the AI verdict + market-context Pro gates.

### Non-Goals

- **No actual Chrome extension.** A future extension could wrap the same backend, but is out of scope for this spec.
- **No Zillow URL scraping.** Address autocomplete + manual entry only.
- **No amortization schedule, sensitivity analysis, IRR projection, or strategy-comparison matrix.** Reserved for a follow-on "Investor-grade expansion."
- **No bulk analysis / batch import.**
- **No expansion of MCP tool surface area.** The MCP refactor is internal — same tool names, same params, same returns.

## 3. Scope

| In scope                                                                   | Out of scope                                        |
| -------------------------------------------------------------------------- | --------------------------------------------------- |
| New `packages/analyzer-core` workspace package                             | Chrome extension manifest, content script           |
| New `/analyzer` route on frontend                                          | Zillow / Redfin / Realtor scraping                  |
| New `/markets/[…]` CTA inserting `?address=…` deep-link                    | MLS integration                                     |
| New backend module `packages/backend/src/analyzer/`                        | New PropertyIQ score variants                       |
| New table `deal_analyses` with RLS + sharing tokens                        | New entitlements tier (uses existing Pro)           |
| MCP refactor of `cashflow_estimate`, `deal_analyzer` to call analyzer-core | New MCP tools                                       |
| Mapbox Places autocomplete component (new)                                 | Geocoding caching layer (use Mapbox response as-is) |
| Free-tier cookie counter middleware                                        | Anonymous fingerprinting / IP rate limiting         |
| Public shared-analysis page `/shared/analysis/[token]`                     | Edit-on-shared-link (read-only only)                |

## 4. Architecture

### 4.1 Component map

```
┌─────────────────────────────────────────────────────────────────┐
│  packages/analyzer-core/  (NEW shared workspace package)        │
│  Pure TS, zero IO, single source of truth for deal math.        │
│                                                                 │
│    computeRentalMetrics(input)  →  RentalResult                 │
│    computeFlipMetrics(input)    →  FlipResult                   │
│    computeBrrrrScore(input)     →  BrrrrResult                  │
│    Types: DealInput, FinancingTerms, *Result                    │
└─────────────────────────────────────────────────────────────────┘
              ▲                  ▲                  ▲
              │ imports          │ imports          │ imports
              │                  │                  │
   ┌──────────┴─────┐   ┌────────┴───────┐   ┌──────┴────────────┐
   │  Frontend      │   │  Backend       │   │  MCP Server       │
   │  Next.js       │   │  NestJS        │   │  (refactor)       │
   │                │   │                │   │                   │
   │ /analyzer page │   │ AnalyzerCtrl   │   │ cashflow_estimate │
   │ instant recalc │   │ AnalyzerSvc    │   │ deal_analyzer     │
   │ on input edit  │   │                │   │                   │
   │                │   │ GET  context   │   │ Behavior frozen   │
   │ + API calls    │   │ POST verdict   │   │ by golden tests   │
   │ for context,   │   │ POST save      │   │                   │
   │ AI, save/load  │   │ GET  saved     │   │                   │
   └────────────────┘   │ GET  share/:t  │   └───────────────────┘
                        │                │
                        │ Cookie counter │
                        │ middleware     │
                        └────────────────┘
                                │
                                ▼
                ┌───────────────────────────────────┐
                │  Supabase                         │
                │                                   │
                │  NEW: deal_analyses (RLS)         │
                │  REUSED: geography_crosswalk,     │
                │          propertyiq_scores,       │
                │          zillow_zip / metro / …   │
                └───────────────────────────────────┘
```

### 4.2 New packages, modules, routes

| Path                                                                     | Kind              | Purpose                                                                                      |
| ------------------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------- |
| `packages/analyzer-core/`                                                | Workspace package | Pure TS math + types. Vitest + fast-check.                                                   |
| `packages/backend/src/analyzer/`                                         | NestJS module     | Controller, service, DTOs, cookie middleware.                                                |
| `packages/frontend/app/analyzer/page.tsx`                                | Next.js route     | Two-column analyzer UI.                                                                      |
| `packages/frontend/app/analyzer/components/`                             | Components        | Input form, results panel, market context, AI verdict modal.                                 |
| `packages/frontend/app/shared/analysis/[token]/page.tsx`                 | Next.js route     | Public read-only shared analysis.                                                            |
| `packages/frontend/lib/analyzer/`                                        | Frontend helpers  | Hooks (`useAnalyzer`, `useAddressAutocomplete`, `useMarketContext`).                         |
| `packages/backend/src/database/migrations/<ts>_create_deal_analyses.sql` | Migration         | Table + indexes + RLS policies + GRANTs (per memory note on service_role GRANT requirement). |

### 4.3 Reused infrastructure

- `MetricResolutionService` for ZIP→County→Metro→State→National fallback chain.
- `PropertyiqScoresController` / underlying service for the PIQ score lookup.
- `EntitlementsContext` + `PaywallProvider` for Pro gating in the UI.
- `geography_crosswalk` table for parent geography resolution.
- Existing Anthropic SDK integration for the AI verdict stream.

## 5. `analyzer-core` Public Interface

```ts
// packages/analyzer-core/src/index.ts

export interface FinancingTerms {
  downPaymentPct: number; // 0..1
  interestRatePct: number; // annual, e.g. 7.1
  termYears: number; // typically 30
  closingCostsPct?: number; // 0..1, default 0.03
}

export interface DealInput {
  price: number; // listing / offer price USD
  rentMonthly: number | null; // null → 1% rule + rental metrics return null
  taxAnnual: number | null;
  insuranceAnnual: number | null;
  hoaMonthly?: number;
  maintenancePctOfRent?: number; // default 0.08
  vacancyPctOfRent?: number; // default 0.05
  managementPctOfRent?: number; // default 0.08
  financing: FinancingTerms;
}

export interface RentalResult {
  noiAnnual: number | null;
  capRatePct: number | null;
  cashOnCashPct: number | null;
  dscr: number | null;
  cashflowMonthly: number | null;
  onePctRulePct: number | null;
  totalCashInvested: number;
  monthlyDebtService: number;
}

export interface FlipInput {
  arv: number;
  rehabBudget: number;
  holdingMonths?: number; // default 4
  sellingCostsPct?: number; // default 0.07
}

export interface FlipResult {
  mao70: number; // 70% rule max allowable offer
  wholetailMax: number; // 80% rule
  projectedProfit: number;
  projectedRoiPct: number;
}

export interface BrrrrInput extends DealInput {
  arv: number;
  rehabBudget: number;
  refinanceLTVPct?: number; // default 0.75
}

export interface BrrrrResult {
  score: number; // 0..10
  refinanceCashOut: number;
  remainingCashInDeal: number;
  postRefiCashflowMonthly: number;
  rating: "EXCELLENT" | "STRONG" | "OK" | "WEAK" | "POOR";
}

export function computeRentalMetrics(input: DealInput): RentalResult;
export function computeFlipMetrics(
  input: FlipInput & { price: number },
): FlipResult;
export function computeBrrrrScore(input: BrrrrInput): BrrrrResult;
```

**Hard rules baked into the package:**

- All functions are pure (no `Date.now()`, no `Math.random()`, no IO).
- All numeric returns are JS `number` (not strings). MCP-side adapters do the `.toFixed(1) + "%"` formatting to match current MCP output strings exactly.
- Any input that is `null` collapses dependent outputs to `null` (caller decides what to render). Functions never throw on null inputs.
- Negative outputs (negative cashflow, sub-1.0 DSCR) are returned as-is — they are valid analyses, not errors.

## 6. Backend HTTP Interface

All endpoints prefixed `/api/analyzer`.

| Method   | Path              | Auth          | Body / Query                                   | Returns                       | Notes                                                                                                           |
| -------- | ----------------- | ------------- | ---------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/market-context` | none          | `?address=` _(or)_ `?zip=&county_fips=&state=` | `MarketContextDto`            | Server-side Mapbox lookup if `address` given; else direct DB lookup. All fields independently nullable.         |
| `POST`   | `/ai-verdict`     | cookie-gated  | `{ input, result, marketContext }`             | streaming `text/event-stream` | Decrements cookie counter for anonymous; bypassed for authenticated users on free-tier policy. Pro skips quota. |
| `POST`   | `/save`           | Pro required  | `AnalysisSnapshotDto`                          | `{ id, shareToken }`          | RLS-enforced INSERT. `shareToken` is a `crypto.randomUUID()`-derived opaque string.                             |
| `GET`    | `/saved`          | authenticated | `?limit=&cursor=`                              | `AnalysisSnapshotDto[]`       | RLS filters to owner.                                                                                           |
| `GET`    | `/saved/:id`      | authenticated | —                                              | `AnalysisSnapshotDto`         | 404 if not owner.                                                                                               |
| `DELETE` | `/saved/:id`      | authenticated | —                                              | `204`                         | RLS owner-only.                                                                                                 |
| `GET`    | `/share/:token`   | none          | —                                              | `PublicAnalysisDto`           | Read-only. PII-stripped (no owner_id, no address number — just city/state for marketing).                       |

**DTOs:** all defined with `class-validator` per CLAUDE.md §1.2. No `as any`, no default-fallback for any secret.

## 7. Database Schema

```sql
CREATE TABLE deal_analyses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token       TEXT NOT NULL UNIQUE,
  label             TEXT,                          -- user-provided "123 Main St" or auto
  address_full      TEXT,                          -- full from Mapbox
  address_city      TEXT NOT NULL,
  address_state     TEXT NOT NULL,
  address_zip       TEXT,
  lat               NUMERIC(9, 6),
  lon               NUMERIC(9, 6),
  input_snapshot    JSONB NOT NULL,                -- full DealInput / FlipInput / BrrrrInput payload
  result_snapshot   JSONB NOT NULL,                -- RentalResult + FlipResult + BrrrrResult
  market_context    JSONB,                         -- snapshot at save-time; may be NULL
  ai_verdict        JSONB,                         -- {verdict: 'buy'|'negotiate'|'pass', reasoning, target_price}
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_analyses_owner ON deal_analyses (owner_id, created_at DESC);
CREATE INDEX idx_deal_analyses_share_token ON deal_analyses (share_token);

ALTER TABLE deal_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_analyses_owner_select ON deal_analyses
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY deal_analyses_owner_insert ON deal_analyses
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY deal_analyses_owner_update ON deal_analyses
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY deal_analyses_owner_delete ON deal_analyses
  FOR DELETE USING (auth.uid() = owner_id);

-- Per memory note: service_role and authenticated GRANTs required.
GRANT ALL ON deal_analyses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON deal_analyses TO authenticated;
```

Public `/share/:token` access bypasses RLS via a `SECURITY DEFINER` Postgres function `get_shared_analysis(token TEXT)` that strips PII fields before returning (or, equivalently, a dedicated `sb_secret_`-keyed server-side route — choose during implementation, the spec is agnostic).

## 8. User Experience

### 8.1 Layout (approved: A — two-column)

- **Header bar:** PropertyIQ nav + free-preview counter chip ("2 of 3 free") shown only to anonymous users.
- **Address bar:** Full-width Mapbox autocomplete; on select, fires market-context fetch.
- **Left rail (38%):** Editable input form. Auto-filled fields show `✓ auto` badge. Unavailable fields show "N/A — enter manually" placeholder with editable input.
- **Right column (62%):**
  - Hero metrics row: Cap Rate, Cash-on-Cash, Monthly Cashflow (color-coded by sign).
  - Strategy tab strip: Rental / Flip / BRRRR — each tab swaps the secondary metrics block.
  - PropertyIQ Market Context tile (Pro-gated for anonymous users — shows locked teaser).
  - Bottom action row: AI Verdict button (Pro), Save button (Pro), Share toggle (after save).

Responsive: collapses to single column under 900px (left rail becomes a collapsible "Inputs" accordion above the results).

### 8.2 State matrix

| State                    | Address      | Market context | Rent        | Other inputs       | UI behavior                                                                                        |
| ------------------------ | ------------ | -------------- | ----------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| **Happy path**           | resolved     | full           | auto-filled | auto + user-edited | All tiles render; sliders update results instantly.                                                |
| **Partial market data**  | resolved     | rent missing   | null        | user supplies      | Rent field renders empty editable; on input, all rental metrics recompute.                         |
| **No PIQ score**         | resolved     | no piq         | auto        | normal             | Market context tile renders other 3 metrics, hides PIQ row.                                        |
| **Mapbox failure**       | manual entry | none           | null        | all user-supplied  | Page enters "manual mode" — no market context tile, only deal math.                                |
| **Anonymous over quota** | —            | —              | —           | —                  | Inputs editable, results blur with "Sign up to see results" overlay; AI/Save/Share already locked. |
| **Pro authenticated**    | —            | —              | —           | —                  | All Pro features unlocked; analyses save with one click.                                           |

### 8.3 Routes

- `/analyzer` — main page. Accepts `?address=…&zip=…&piq_market=…` query params for deep-linking from market pages.
- `/analyzer/saved/[id]` — Pro-authenticated saved analysis view (editable, re-runnable).
- `/shared/analysis/[token]` — public read-only.
- Market detail pages (`/markets/[slug]`, `/markets/county/[slug]`, `/markets/zip/[slug]`) get a primary CTA: "Analyze a property in this market →" linking to `/analyzer?piq_market=<geoId>`.

## 9. Tier Gating & Free Preview

| Feature                                     | Anonymous           | Free (logged in) | Pro          |
| ------------------------------------------- | ------------------- | ---------------- | ------------ |
| Math (cap, CoC, DSCR, cashflow, MAO, BRRRR) | ✅ first 3 lifetime | ✅ unlimited     | ✅ unlimited |
| Market context tile                         | locked teaser       | locked teaser    | ✅           |
| AI verdict                                  | ❌                  | ❌               | ✅ streaming |
| Save analysis                               | ❌                  | ❌               | ✅           |
| Share via public link                       | ❌                  | ❌               | ✅           |
| Market detail "Analyze" CTA                 | ✅ to /analyzer     | ✅               | ✅           |

**Free-preview enforcement (anonymous only):**

- HTTP-only signed cookie `piq_analyzer_uses` set on first `/api/analyzer/market-context` hit; counter on the server, signed with `process.env.ANALYZER_PREVIEW_SECRET` (no fallback default, crashes on missing per CLAUDE.md §1.2).
- Counter is a lifetime cap. Reset only on signup (server clears cookie on successful auth callback for the analyzer flow).
- 4th anonymous attempt → 402-style "signup required" response; UI shows signup wall over the results panel.
- Authenticated users skip the cookie middleware entirely.

## 10. MCP Refactor — Non-Breakage Plan

This section satisfies the [[feedback-mcp-refactors-must-not-break]] hard gate.

### 10.1 Step 0 — Capture characterization fixtures (BEFORE any code change)

Add `packages/mcp-server/src/tools/__tests__/investors.golden.spec.ts` that:

1. Calls the **current inline** `cashflow_estimate` and `deal_analyzer` handlers with a representative input matrix:
   - Edge cases: rent=0, price=0, financing=100% cash, very high rate, very long term, missing taxes.
   - Realistic cases: 3 metros × {cheap, median, expensive} × {high-rent, normal, low-rent}.
2. Serializes responses to `__fixtures__/investors-golden.json` checked into the repo.
3. The test asserts `current_response === fixture` for every case.

### 10.2 Step 1 — Build `analyzer-core` and its tests independently

No MCP changes yet. analyzer-core ships green with unit + property-based tests.

### 10.3 Step 2 — Refactor MCP tool handlers

- Replace inline math with `analyzer-core` calls.
- Keep all string formatting (`"$1,234"`, `"8.5%"`, `"0.8x"`) inside the MCP handler — analyzer-core returns raw numbers, the formatter layer stays in the MCP tool.
- The golden spec must continue to pass byte-for-byte. **Any diff blocks the refactor PR.**

### 10.4 Step 3 — Cross-verify in CI

CI runs `npm test --workspace packages/mcp-server` as a hard gate. The golden fixture file is treated as a contract — only updateable via an explicit signed commit (mention "MCP behavior change approved" in commit message).

## 11. Testing Strategy (Option 3: full)

| Layer                          | Tool                             | Files                                                              | What                                                                                                                         |
| ------------------------------ | -------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Unit — analyzer-core           | Vitest                           | `packages/analyzer-core/src/**/*.test.ts`                          | Hand-computed fixtures for each pure function. ~30 cases.                                                                    |
| Property-based — analyzer-core | fast-check                       | same dir                                                           | Invariants: `cashflow + debt_service ≈ noi/12 - vacancy/maint/mgmt`; `mao70 < arv`; `dscr > 0 iff noi > 0`; etc.             |
| Golden parity — MCP            | Vitest                           | `packages/mcp-server/src/tools/__tests__/investors.golden.spec.ts` | Pre- vs post-refactor outputs identical.                                                                                     |
| Unit — backend service         | Jest (existing NestJS pattern)   | `packages/backend/src/analyzer/**/*.spec.ts`                       | Mock `MetricResolutionService` + `PropertyiqScoresService`; assert graceful nulls.                                           |
| Integration — backend          | Jest + real Supabase test schema | `packages/backend/test/analyzer.e2e-spec.ts`                       | Full Controller→Service→DB round-trip. Free-quota cookie middleware. Per [[feedback_plans-must-include-e2e-tests]].          |
| E2E — frontend                 | Playwright                       | `packages/frontend/e2e/analyzer.spec.ts`                           | Happy path, partial-data path, anonymous quota wall, Pro AI verdict, save+share.                                             |
| Render check                   | manual                           | —                                                                  | Per [[feedback_server-health-checks]] and [[feedback_verify-after-every-task]]: visual render verification after each phase. |

## 12. Risks & Mitigations

| Risk                                                       | Mitigation                                                                                                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCP output drift breaks Paperclip agent                    | Golden fixtures (§10), CI gate, explicit approval to update fixtures.                                                                                                |
| Mapbox API costs spike from autocomplete                   | Frontend debounces 250ms; only fires on ≥3 chars; cache last 20 results in `sessionStorage`.                                                                         |
| AI verdict cost balloons on viral free use                 | Endpoint requires authenticated Pro session — anonymous users cannot reach it at all.                                                                                |
| Free-preview cookie bypass via incognito                   | Acknowledged. Cookie is friction, not security. Per brainstorm decision: "good enough for funnel."                                                                   |
| RLS gap on share token                                     | Use `SECURITY DEFINER` Postgres function with PII stripping; security-reviewer agent runs in §1.6 background after impl.                                             |
| Sliders feel laggy on slow devices                         | All recomputation is local & synchronous on pure functions; <1ms per call. No risk.                                                                                  |
| New `analyzer-core` workspace package breaks build tooling | Mirror `packages/mcp-server` workspace config (existing in repo); validate `nest build` / `next build` on every commit per [[feedback_check-untracked-before-push]]. |

## 13. Open Questions

None — all decisions captured during brainstorm. Implementation plan will surface tactical questions as they arise.

## 14. Acceptance Criteria

A reasonable senior reviewer should be able to walk through this list and check each box:

- [ ] `packages/analyzer-core/` exists; `npm test --workspace packages/analyzer-core` passes with unit + fast-check suites.
- [ ] `cashflow_estimate` and `deal_analyzer` MCP tools call `analyzer-core` internally; golden fixture spec passes with byte-for-byte parity.
- [ ] `/analyzer` page renders Layout A on desktop and the responsive collapse on mobile; both visually inspected.
- [ ] Mapbox autocomplete works on the address bar; selecting a result fires `/api/analyzer/market-context` and populates rent/tax inputs with `✓ auto` badge.
- [ ] Removing any single market-context field (rent / taxes / PIQ score / migration) gracefully degrades — no `undefined` in the UI, no thrown errors.
- [ ] Mapbox failure → page enters fully manual mode; deal math still computes.
- [ ] Anonymous: 3 successful analyses, then the 4th surfaces the signup wall. Cookie cleared on signup.
- [ ] Authenticated free: skips cookie wall, still cannot see market context / AI verdict / save (Pro overlay shown).
- [ ] Pro: AI verdict streams from `/api/analyzer/ai-verdict`; save creates `deal_analyses` row + share token; `/shared/analysis/[token]` renders read-only with PII stripped.
- [ ] Market detail pages render the "Analyze a property in this market" CTA; clicking it deep-links to `/analyzer?piq_market=…`.
- [ ] Playwright E2E `analyzer.spec.ts` green in CI.
- [ ] Backend e2e against a real Supabase test schema green in CI.
- [ ] `code-reviewer`, `data-layer-reviewer`, `security-reviewer`, `file-size-compliance` background agents run per CLAUDE.md §1.6 and report no CRITICAL/WARNING issues.
- [ ] No file in the new code exceeds the CLAUDE.md §1.3 hard limits.

## 15. References

- DealSnap REI (functional reference): https://www.dealsnaprei.com/
- Project: [[project_paperclip-agent]] — MCP downstream consumer to protect.
- Memory: [[feedback-mcp-refactors-must-not-break]], [[feedback_plans-must-include-e2e-tests]], [[feedback_verify-after-every-task]], [[feedback_server-health-checks]], [[feedback_check-untracked-before-push]], [[feedback_no-mock-urls-in-production]].
- CLAUDE.md sections: §1.2 (security), §1.3 (file size), §1.6 (background validation agents), §5.1 (MetricResolutionService), §6 (metric config), §9 (score & confidence display).

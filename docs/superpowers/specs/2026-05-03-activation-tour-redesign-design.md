# Activation Tour Redesign

**Date:** 2026-05-03
**Status:** Design — pending implementation plan
**Owner:** Troy Houston
**Brainstorm session:** `.superpowers/brainstorm/2528-1777823013/`

## Summary

Replace PropertyIQ's current activation flow (`/get-started` persona+market wizard, plus the spotlight tour that requires it) with a new anonymous-friendly experience at `/tour` that lets unauthenticated visitors generate a real, personalized listing presentation for a market they choose, then converts them at peak desire with an inline signup form. The MVP targets the agent persona; investor and homebuyer follow.

The redesign is the response to two problems: (1) `/get-started` had 0 sessions in 30 days while signup was 11 starts / 0 completes (per project memory 2026-04-14), and (2) the existing tour gates value behind signup, but 94% of inbound traffic is programmatic-SEO mobile traffic that never reaches signup.

The core conversion lever is letting users generate a real listing presentation for their own market before signup. Industry benchmarks (Userpilot 2023, Notion, Loom, Calendly) suggest 2-3× lift over gated-demo patterns. Estimated overall `/tour → signup` conversion: ≥15%, vs. effectively 0% today.

## Problem

The current onboarding has three structural problems:

1. **Two competing wizards.** `/onboarding` (5-step preferences quiz) and `/get-started` (persona cards + market search) serve different goals but compete for "the onboarding." Dashboard banner pushes to `/onboarding`; auth callback routes to `/get-started`.
2. **Activation gated behind signup.** The spotlight tour only fires post-signup on `/market/[id]?onboarding=true`. Programmatic-SEO traffic (94% of inbound) never reaches signup, so it never sees the tour.
3. **Dashboard checklist sells features that don't exist.** "Compare two markets" links to `/market` with no comparison feature; "View a PropertyIQ Score" links to a search landing, not a score.

The dashboard "Take the tour" button (shipped earlier this session) and `?resetTour=1` shortcut work correctly but don't address the underlying flow. They make a broken funnel re-runnable, not converting.

## Goals

- **Capture cold traffic.** Anonymous users at `/tour` complete a meaningful product experience without signing up.
- **Convert at peak desire.** Signup happens AFTER the user has a real listing presentation in front of them, not before.
- **Persona-specific tours.** Agent / investor / homebuyer get materially different experiences. Agent ships first.
- **Rock-star deliverable.** The listing presentation generated at step 4 is the best market-intel deliverable on the open web for any market in the U.S.
- **Mobile first.** 94% of traffic is mobile-leaning programmatic SEO; the tour is designed for that traffic, not as a desktop afterthought.
- **Measurable funnel.** Every step instrumented. Conversion measured pre/post via feature-flag canary.

## Non-goals

- Preferences quiz redesign. `/onboarding` (the quiz) stays; it's repurposed as an _optional_ dashboard personalization, not the activation path.
- MLS / transaction-level data. We don't have it. The listing presentation is built entirely from public data sources + PropertyIQ's proprietary score.
- Cross-device anonymous-session claim. Acknowledged trade-off; users who sign up on a different device than they generated on get a fresh tour. Not solved in v1.
- Investor and homebuyer tours. These are explicit future phases (after agent MVP ships).
- Comparison feature (market-vs-market). The comparison view shown in the tour is auto-generated against a peer market we pick; it's not a user-facing build-your-own-comparison feature. That remains a separate project.

## Architecture

### Flow

```
SEO city page (e.g. /charlotte-nc)  ──► floating CTA "60-sec tour for [persona]"
                                              │
                                              ▼
                                      /tour (anonymous)
                                              │
                                  Pick persona ─► Pick market ─► Tour steps 1-4
                                                                       │
                                            Step 4 = listing presentation (the aha)
                                                                       │
                                                            Inline signup form
                                                                       │
                                                              POST /auth/sign-up
                                                                       │
                                                       Auth callback claims session
                                                                       │
                                                          Post-signup celebrate
                                                                       │
                                                                  /dashboard
```

### Routes

| Route                                   | Status   | Purpose                                                                                                                |
| --------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/tour`                                 | NEW      | Canonical tour entry. Anonymous-friendly. Persona+market screens if no query params.                                   |
| `/tour?persona=agent&market=cbsa-16740` | NEW      | Pre-filled deep-link from SEO CTAs / email campaigns.                                                                  |
| `/api/anonymous/listing-presentation`   | NEW      | Rate-limited (1/IP/24h) generation of the unauth report. Watermarked. Server-cached.                                   |
| `/api/markets/peers/{geoLevel}/{geoId}` | NEW      | Returns ranked list of comparable peer markets. Step 3 displays the top 1; listing presentation §5 displays the top 3. |
| `/auth/sign-up`, `/auth/callback`       | KEEP     | Existing flow, plus a new branch in callback to claim `tour:<sessionId>` from cookie.                                  |
| `/onboarding`                           | KEEP     | Preferences quiz, repurposed as optional dashboard personalization.                                                    |
| `/get-started`                          | REDIRECT | Permanent 308 → `/tour`, preserving query params.                                                                      |
| `/dashboard`                            | KEEP     | "Take the tour" button updated to point at `/tour?resume=fresh`.                                                       |

### State model — five tiers

| Tier                                      | Job                                                                                | TTL       |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | --------- |
| URL params (`?persona=…&market=…&step=…`) | Authoritative for tour position. Shareable, back/forward works.                    | n/a       |
| Cookie `piq_tour_session=<uuid>`          | Anonymous identity for rate-limit + Redis lookup. HttpOnly, SameSite=Lax.          | 7 days    |
| localStorage `piq_tour`                   | Mirror of progress. Survives refresh.                                              | 24h idle  |
| Redis `tour:<sessionId>`                  | Generated artifact + persona/market. Single source of truth for the unauth report. | 7 days    |
| Database `reports` table                  | Post-signup permanent home. Watermark cleared, `is_demo: false`.                   | permanent |

The handoff between Redis and the `reports` table happens atomically in the auth callback claim handler.

## Detailed design

### 1. Tour entry & persona selection

**Persona screen** appears at `/tour` when no `?persona=` is in the URL. Three cards: agent / investor / homebuyer. Agent card carries a subtle "For you" badge + soft gradient during MVP (priority signal without hiding the others). Each card lists the three things their tour delivers. Selection sets `?persona=` and advances to market picker.

**Market picker** appears when persona is set but no `?market=`. Typeahead search (existing `useUniversalSearch`), but suggestions show the live PropertyIQ Score in a colored chip (green for ≥80, amber for 50-79, red for <50). Helper chips below: top markets (Charlotte / Phoenix / Tampa) + a "skip — show me Charlotte" fallback for users without a market in mind. On select, `?market=` is set and tour advances to step 1.

### 2. Sandbox tour steps 1-3 (real product, real data)

**Step 1 — Search bar spotlight.** User is on `/map` with their market loaded. Tooltip: "You picked Cary — let's go." Action-gated on user clicking anywhere or pressing Continue. Reuses existing `BreathingSpotlight` + `ConnectedTooltip` from `packages/frontend/app/onboarding/`.

**Step 2 — PropertyIQ Score reveal.** User is on `/market/[id]`. Spotlight on `[data-tour="propertyiq-score"]` (already wired). Tooltip explains the score, confidence, trend. Score-card animation: ring fills clockwise + number counts up.

**Step 3 — Auto-comparison.** Tour navigates to `/compare?a=<their-market>&b=<auto-suggested-peer>`. Spotlight on the compare grid showing their market vs. the top-1 auto-selected peer. Peer selected by `/api/markets/peers/{geoLevel}/{geoId}` using algorithm: same parent metro + ±1 score band + similar household count → top result. (Listing presentation §5 reuses the same endpoint to show the top 3.)

All three steps support both action-gating (existing pattern) and manual advance via Continue button (`allowManualAdvance` flag, already added to `OnboardingStep` type this session).

### 3. Step 4 — The rock-star listing presentation (the aha)

The listing presentation is the conversion lever. It MUST be the best market-intel deliverable available on the open web for any U.S. market.

**10 sections, every one substantive, every one cited.** Built from public data sources we already have or are ingesting in Phase 01:

| Section                     | Content                                                                                                            | Data sources                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1. Executive summary        | PropertyIQ Score + confidence + 3-paragraph thesis + recommendation callout                                        | `propertyiq_scores`                                         |
| 2. The market right now     | 8-stat grid: median price, DOM, % sold above list, months supply, rent, sale-to-list, $/sqft, est. active listings | Zillow ZHVI, Redfin Market Tracker                          |
| 3. 12-month trajectory      | SVG line chart: target vs parent metro vs state, indexed                                                           | `metric_observations`                                       |
| 4. Forecast                 | Projected price (12-mo) with 80% CI shading, projected rent trend, mortgage-rate risk callout                      | `home_value_forecast` MCP tool, FRED 30Y rate               |
| 5. Comparable peers         | Cary highlighted vs auto-suggested top-3 peer markets, color-coded winners                                         | New peers helper endpoint                                   |
| 6. Migration & demographics | Top 5 in-migration source metros + buyer affordability profile (income, age, education)                            | **IRS county-to-county migration (NEW INGEST)**, Census ACS |
| 7. Affordability            | Two gauges: affordability index, rent-vs-buy break-even                                                            | Custom calc on existing data + FRED 30Y rate                |
| 8. Economic drivers         | Sector employment breakdown + labor-market signals                                                                 | **BLS QCEW (NEW INGEST)**, FRED, BLS                        |
| 9. Validated track record   | Score validation accuracy + 3Y excess return for the market                                                        | Existing `score_validation` pipeline                        |
| 10. AI strategy             | Serif-typeface narrative (4 paragraphs) + 3 concrete action cards                                                  | Claude Haiku 4.5 synthesis of all above                     |

**Visual treatment** — gradient indigo cover, M3 design tokens, real SVG charts, source citations footer, brandable shell (post-claim, cover gets agent's photo + brokerage logo, watermark removed).

**Watermark strategy** — single subtle amber banner inside the report ("Demo report — sign up free to save, share, and remove this watermark"), header chip (no fake "DEMO" stamp), footer with expiry. The conversion pressure comes from gating save / share / re-generate, not from a heavy visual watermark.

### 4. Inline signup + claim flow

Below the rendered listing presentation, an inline signup form appears (NOT a modal — keeping the artifact visible above is critical for loss aversion). Form has email + password inputs, submit button reads "Save my report →" (not "Sign up"). Bullet list: 14-day Pro trial, no credit card, unlimited markets, branded shareable links.

**On submit:**

1. `POST /auth/sign-up` with body containing `tour_session_id` from cookie
2. Server creates Supabase auth user, sends confirmation email
3. Auth callback fires (after email confirm in prod, immediately in dev with auto-confirm)
4. Callback's claim handler: read cookie → fetch `tour:<sessionId>` from Redis → INSERT into `reports` with `user_id` → mark Redis row `claimedBy: <userId>` (audit) → set `onboarding_market` on user_profiles → redirect to `/tour?resume=<sessionId>&step=5`
5. Step 5 (post-signup celebrate screen) renders with the saved-report card visible

**If user dismisses the signup form**, it collapses to a small "Sign up to save" pill button at the top-right of the report. They can scroll, re-read, then sign up later. The Redis session persists for 7 days.

### 5. Post-signup transition (single celebrate screen)

One screen, not a multi-step tour. Indigo gradient with green check badge. Headline "Your Cary report is saved." Saved-report card preview. Three CTAs: Open my report / Try another market / Go to dashboard. End of tour.

Justification: post-signup tours longer than 2 steps depress D1 retention by ~15% per Userpilot benchmarks. Once converted, users want to use the product, not sit through more guidance.

### 6. Demo-mode API + rate-limit + watermark

**`POST /api/anonymous/listing-presentation`** — generates the report.

Request:

```json
{
  "sessionId": "<uuid from piq_tour_session cookie>",
  "persona": "agent" | "investor" | "homebuyer",
  "market": { "geoLevel": "metro|county|zip", "geoId": "16740", "name": "..." }
}
```

Response (success):

```json
{
  "reportId": "anon-rpt-<uuid>",
  "sessionId": "<same uuid>",
  "watermark": "PropertyIQ Demo · Sign up free to remove",
  "expiresAt": "<7 days from now>",
  "claimable": true,
  "report": {
    /* full presentation payload */
  }
}
```

Response (rate-limited): HTTP 429 with `retryAfter` and a `signupUrl` pointing to `/auth/sign-up?from=tour-rate-limit`.

**Three-layer rate limit:**

1. **Edge** — Cloudflare bot rules + ASN reputation (free, blocks obvious crawlers).
2. **App middleware** — Redis-backed `anon_rpt:<ip>` counter, TTL 24h. INCR + check-against-limit. **1 generation per IP per 24h.**
3. **User-agent screening** — reject obvious bot UAs, reject `navigator.webdriver` evidence, soft-block headless Chrome from non-residential ASNs.

**Explicit non-defenses:** No CAPTCHA on happy path (kills conversion). No SMS verification. No long-term IP storage (24h Redis only).

### 7. Edge cases

| Scenario                                          | Handling                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User refreshes mid-tour                           | URL params + localStorage preserve position. Tour resumes exactly where they left off.                                                                                         |
| User closes tab, returns next day                 | Cookie still valid (7-day). Visiting `/tour` re-fetches Redis → re-serves same generated report. They pick up at step 4 with their original artifact.                          |
| Sparse-data market (rural ZIP, no Redfin)         | Suggestion chip shows "—" if confidence < C. Tour proceeds; report renders graceful "Limited data available" callouts in affected sections. Never empty section.               |
| Generation failure (Claude timeout, missing data) | Error screen + "Try again" (no extra rate-limit charge). Twice-failed: fallback non-AI version. Logged + alerted.                                                              |
| Generation slow (>12s)                            | Rotating progress messages, then "Still working" at 15s, timeout at 30s.                                                                                                       |
| Rate limit hit                                    | 429 → friendly screen: "You've used today's free demo. Sign up free for unlimited — your first report is saved and waiting." CTA to inline signup with prior session attached. |
| User dismisses signup                             | Form collapses to pill button. Report stays visible. Not trapped.                                                                                                              |
| Email confirmation pending                        | Inline message: "Check your email." Report claimed server-side under pending account; confirm link finishes auth. 7-day window to confirm before Redis expires unclaimed.      |
| Bot / abuse                                       | L1 (Cloudflare) → L2 (Redis cap) → L3 (UA screening). Daily cost ceiling alert; kill-switch to disable anon generation.                                                        |
| Slow network / 3G mobile                          | Skeleton loaders. Report SVGs lazy-load below fold. Total wire weight: <200KB unauth report.                                                                                   |

### 8. Mobile design

Mobile is mandatory because 94% of inbound traffic is mobile-leaning programmatic SEO. **Different layout, not a downgrade.**

| Surface                     | Mobile change                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Persona cards               | Stack vertically, full-width. Same content.                                                  |
| Tour tooltip                | Bottom-sheet instead of floating tooltip. More screen real-estate, less awkward positioning. |
| Listing presentation charts | Line chart simplifies to 3 key data points + sparkline.                                      |
| Stat grid                   | 4 columns → 2 columns.                                                                       |
| Comparison view             | Vertical card stack instead of side-by-side.                                                 |
| Inline signup               | Bottom-fixed sticky form bar.                                                                |

### 9. Re-tour for existing users

Dashboard "Take the tour" button (shipped this session) updates to point at `/tour?resume=fresh`. Behavior:

- Same flow, but skip auth gate and signup screens.
- Pre-fills with their saved `onboarding_market` if present; otherwise opens market picker.
- Generates a fresh report in their account (no rate limit since authenticated). Adds to their saved reports.
- Post-tour transition is a single "Tour complete" toast. No celebrate screen since they've seen it.

## Implementation phases (agent MVP)

| #   | Phase      | Goal                                                                                                                           | Days |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 01  | Foundation | IRS migration + BLS QCEW ingest, anon listing-presentation API, peers helper, rate-limit middleware                            | 3-4  |
| 02  | Shell      | `/tour` route, persona screen, market picker, state plumbing, `/get-started` 308 redirect, auth callback update                | 3-4  |
| 03  | Sandbox    | Steps 1-3 spotlight tour reusing TourProvider in anon mode, mobile-first layout                                                | 3-4  |
| 04  | Aha        | 10-section listing-presentation component, real data wiring, Claude Haiku narrative, charts, watermark, mobile + print layouts | 4-5  |
| 05  | Convert    | Inline signup, claim handler, post-signup celebrate, SEO floating CTA                                                          | 2-3  |
| 06  | Polish     | Edge cases, a11y, telemetry, E2E Playwright, visual regression, perf audit                                                     | 2-3  |

**Total: 17-23 working days for agent MVP.**

Each phase is independently shippable — you could pause after any of them and have a sane partial state. Phase 01 must complete before Phase 04 (data dependency); other phases can interleave.

### Future phases

| #   | Phase                                     | Days |
| --- | ----------------------------------------- | ---- |
| 07  | Investor tour (reuses 80% of agent infra) | 3-4  |
| 08  | Homebuyer tour                            | 3-4  |

## Testing strategy

Test pyramid weighted toward integration + E2E because the value is in orchestration, not any single component.

- **Unit (~30%)** — Tour state machine reducer, rate-limit logic, peer-matching algorithm, watermark application, claim handler logic. Pure functions where possible.
- **Integration (~35%)** — Anon API endpoints with real Redis, claim flow (anon → authed), auth callback branching, listing-presentation generation pipeline end-to-end. Mock Claude only.
- **E2E (~25%)** — Playwright: full agent tour → signup mid-tour → claim → celebrate. Mobile viewport. Slow-network throttle. Visual regression on the listing presentation across 5 representative markets.
- **Manual (~10%)** — Real agent walkthrough (alpha test, 2-3 agents) before public launch.

## Success metrics

| Metric                       | Target | Why                                                                                                   |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `/tour` visit → step 4 reach | ≥ 60%  | Below = demo flow too long, broken, or persona/market step confusing                                  |
| Step 4 reach → signup        | ≥ 25%  | Once they see the report, 25% should sign up. Below = report not delivering or signup form needs work |
| Overall `/tour` → signup     | ≥ 15%  | Headline metric. 3-5x today's effective rate. Calendly/Loom benchmarks suggest 15-25% achievable      |
| Signup → D7 retention        | ≥ 40%  | Conversion lift only compounds into revenue if leads are high-quality                                 |
| Report generation p95        | ≤ 8s   | Above 10s, abandonment spikes                                                                         |
| Mobile signup share          | ≥ 50%  | Below = mobile UX is broken given 94% inbound traffic is mobile-leaning                               |

## Risks & mitigations

| Risk                                         | Severity | Mitigation                                                                                                                                                                                  |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI narrative quality varies across markets   | HIGH     | Curated test set of 20 representative markets (urban / suburban / rural / small / large / hot / slow). Pre-launch review of every output. Deterministic fallback templates for QC failures. |
| Claude API outage during peak traffic        | MED      | Graceful degrade: render report without §10 (AI strategy). Show "Strategy synthesis temporarily unavailable." Sign-up still works.                                                          |
| IRS migration data missing for small markets | MED      | Migration data is county-level minimum. Sub-county geographies aggregate up. Counties with <50 inflow records suppress §6 with friendly message.                                            |
| Bot abuse drives up Claude API costs         | MED      | Three-layer rate limit. Daily cost ceiling alert. Kill-switch to disable anon generation.                                                                                                   |
| Cross-device anon session loss               | LOW      | Acknowledged trade-off. Mobile users still convert; cross-device is a v2 nicety.                                                                                                            |
| Hidden coupling in existing tour code        | LOW      | Audited this session. Extension surface understood. Phase 03 starts with a small spike.                                                                                                     |

## Feature-flag rollout

`/tour` is wrapped behind a `tour_v2_enabled` flag.

1. **Internal alpha** — flag on for the team only. Walk through every persona path manually.
2. **10% canary** — flag on for 10% of new visitors. Monitor conversion vs. control. Watch error rates.
3. **50% A/B** — half new tour, half legacy `/get-started`. Compare signup rates with statistical confidence (~2-3 weeks at current traffic).
4. **100% rollout** — flip the flag. Deprecate `/get-started` (308 redirect already in place).

## Data sources

| Source                                        | Use                                                 | Status                    |
| --------------------------------------------- | --------------------------------------------------- | ------------------------- |
| Zillow ZHVI                                   | Home values, time-series, $/sqft                    | Existing                  |
| Zillow Rent Index                             | Median rent                                         | Existing                  |
| Redfin Market Tracker                         | DOM, % sold above list, months supply, sale-to-list | Existing                  |
| U.S. Census ACS 5-Year                        | Demographics, household income, education           | Existing                  |
| FRED / BEA                                    | Employment, wage growth, 30Y mortgage rate          | Existing                  |
| BLS LAUS                                      | Unemployment rate                                   | Existing                  |
| **BLS QCEW**                                  | **Sector employment breakdown**                     | **NEW INGEST (Phase 01)** |
| **IRS Statistics of Income — Migration Data** | **County-to-county migration flows**                | **NEW INGEST (Phase 01)** |
| PropertyIQ Score v4                           | Composite signal + components                       | Existing (proprietary)    |
| Anthropic Claude (Haiku 4.5)                  | AI narrative synthesis                              | Existing                  |
| Score validation pipeline                     | 3Y/5Y excess return, directional accuracy           | Existing                  |

Forecasts derived from PropertyIQ time-series model with 80% confidence intervals. All public-data sources are free, support our license/attribution requirements, and have annual or quarterly refresh cycles compatible with the platform.

## Explicitly deferred

- **Cross-device anonymous session claim.** Users who generate on desktop and sign up on mobile get a fresh tour. Solving this requires email-as-anchor or a session-link share mechanism; deferred to v2 if data shows it matters.
- **Investor tour and homebuyer tour.** Future phases 07 and 08.
- **Build-your-own market-vs-market comparison.** The auto-comparison at step 3 picks the peer for the user. A user-driven "compare any two markets" feature is a separate project not in this spec.
- **Rent forecast model.** Section 4 currently shows projected price (existing forecast model) and rent _trend_ (not forecast). A proper rent-forecast model is a separate project.
- **Listing presentation branding customization UI.** Post-signup users see watermark removed, but a full "upload your photo + brokerage logo" UI is a follow-up. v1 strips watermark only.
- **Re-tour for existing users with a different persona.** v1 always re-uses the user's saved persona. Switching persona mid-account is a v2 nicety.

## Open questions

None — all surfaced questions resolved during the brainstorm.

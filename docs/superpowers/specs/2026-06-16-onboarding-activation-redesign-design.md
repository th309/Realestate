# PropertyIQ Onboarding & Activation System — Design Spec

**Date:** 2026-06-16
**Status:** Approved design (brainstorming) — pending implementation plan
**Branch target:** `develop`
**Author:** brainstorming session (Troy + Claude)

---

## 1. Problem & Context

The current new-signup tour is actively harmful: it spotlights **blurred** content and tries to **demo broken** features. Root-cause analysis found three stacked defects and one structural problem.

### 1.1 Structural problem — two tour systems coexist (a stalled migration)

|          | **System A — "Sandbox tour" (LIVE)**                 | **System B — "Onboarding spotlight" (DORMANT)**                      |
| -------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Location | `packages/frontend/app/(app)/tour/`                  | `packages/frontend/app/(app)/onboarding/`                            |
| Trigger  | `?tour=stepN` (new signups reach this)               | `?onboarding=true` (legacy, no longer set)                           |
| Driver   | `useTourFromUrl` + `TourSpotlight`                   | `TourProvider` (globally mounted in `providers.tsx:170`)             |
| Steps    | `step-content.ts`: search-bar → score → compare-grid | `onboarding-steps.ts`: score → breakdown → generate-report → upgrade |

`TourSpotlight.tsx:4-5` imports System B's `BreathingSpotlight` + `ConnectedTooltip`, so System B's bugs ship to the live tour. Both collide on `data-tour="propertyiq-score"`. **Decision: delete System B, keep & harden System A.**

### 1.2 Why highlights are blurred (3 independent causes)

1. **Un-maskable spotlight blur (desktop).** `BreathingSpotlight.tsx:95-122` puts `backdropFilter: blur(3px)` on the full-screen `<svg>`; the SVG mask only cuts the _dimming_ rect, not the CSS backdrop-filter. Target is un-dimmed but stays blurred.
2. **Mobile blurs everything (no cutout).** `TourBottomSheet.tsx:37-40` renders `bg-black/40 backdrop-blur-[1px]` full-screen with no hole — the "highlighted" element is blurred too.
3. **Paywall free-flash.** New signups get a Pro trial via **fire-and-forget** `startOnboardingTrial()` (`complete-signup.ts:63`, `callback/page.tsx:272`). On cold load, entitlements resolve as **`free`** before the trial row lands (`EntitlementsContext.tsx:41-48,161-165`; `entitlements-helpers.ts:10-16`), so `BlurredTeaser` / `PaywallOverlay` / `MetricItem` blur the very content the tour highlights.

### 1.3 Why demos break

- **No-target → full-screen blur** fallback (`BreathingSpotlight.tsx:82-90`): missing target blurs the whole app.
- **Tour dies on navigation:** `useTourFromUrl.ts:29` requires `market`+`sessionId` in the URL; any stray nav strips `?tour=…` and the tour silently ends.
- **Dismiss exits the app:** `useTourFromUrl.ts:62` `dismiss()` pushes `/` (public marketing page), not into the product.
- **Disabled-button dead-end** in System B (`generate-report` waits on a `disabled` button → never clicks).

### 1.4 What already exists (high reuse)

- **Rich market report:** `ListingPresentation.tsx` renders a 10-section intelligence report (Executive Summary, Market Now, Trajectory, Forecast, Peers, Migration, Affordability, Employment, Validation, AI Strategy). Currently the _anonymous_ `Step4Aha` payload (watermarked + `InlineSignupForm`).
- **Email/drip infra (mature):** `email.service.ts` (Resend + React Email + `email_log`), `drip.service.ts` (`@Cron`, Redis-locked via `redis-lock.service.ts`, gated by `RUN_CRONS` in `cron-schedule.imports.ts`). Existing onboarding sequence templates **Day 0/1/3/5/7/10/14** (`packages/emails/index.ts`), behavioral triggers (day-10/13/expiry/inactive-24h), winback, NPS, monthly digest. Compliance in place: `email_preferences.marketing` opt-out, `email_triggers` dedup, CAN-SPAM footer, preference center (`email.controller.ts`).
- **Checklist:** `dashboard/components/ProgressChecklist.tsx` (5 items).
- **Usage tracking (partial):** `usage_stats` keys = `markets_viewed`, `scores_checked`, `reports_generated`; checklist tasks = `search_market`, `view_score`, `generate_report`, `compare_markets`(auto). Events via `trackEvent` (`lib/analytics/tracker.ts`) → `/api/usage/events`.

### 1.5 MCP/Claude — the differentiator

PropertyIQ exposes a live MCP server (50+ `mcp__propertyiq-production__*` tools) letting users query markets/scores/deals **from inside Claude** in plain English. No competitor offers this. It becomes a featured element across the activation surfaces.

---

## 2. Goals, Non-Goals, Success Criteria

### Goals

- A trustworthy, value-first first session: a new user sees their **Score → the AI "why" → a full market report** in < 60 seconds, with everything genuinely unlocked.
- Surface the platform's breadth over the 14-day trial via a checklist, a usage-aware return surface, and a behavior-aware email drip — all reading one **feature-coverage signal**.
- Make the **Claude/MCP connection** impossible to miss.

### Non-Goals

- Redesigning the persona/market entry screens (`PersonaCards`, `MarketPickerStep`) — kept as-is.
- Rebuilding email infrastructure or the `ListingPresentation` report — reuse both.
- Any work on legacy `homeready_score` / `investoredge_score` / `market_health_score` (out of scope).

### Success Criteria

1. **Zero paywall-blur** for trial users during onboarding (no free-flash) — verified live on prod.
2. **No full-screen-blur failure state** — the spotlight always has a crisp target or auto-advances/skips; the highlighted element is razor-sharp on desktop **and** mobile.
3. Tour is **interactive** (advances on real actions), **skippable into the app** (not `/`), and **survives navigation**.
4. New signup completes the core arc (Score + AI read + report) in the first session.
5. **Activation lift:** % of new signups completing ≥1 post-signup checklist item within 14 days (baseline measured first, target set in plan).
6. **MCP connection rate** among new trials becomes a tracked metric (new).
7. The drip **suppresses** emails for features a user has already used (behavior-aware).

---

## 3. Locked Decisions

1. **Delete System B**, keep & harden System A.
2. **Approach A — Guided-first**: persona → market → _choice_ (Show me around / Explore) → short interactive tour → app + checklist.
3. **Tour steps:** Score (interactive) → Why (AI narrative, same page) → 🎉 Pro + full report → **bonus** Connect Claude (optional, before exit).
4. **Breadth via 3 layers:** report-as-finale + persona springboard + persistent checklist; carried over the trial by the return-surface and the drip.
5. **One shared feature-coverage signal** powers checklist, return-surface, and drip.
6. **MCP/Claude** featured across all breadth surfaces + the bonus tour beat.
7. **Spotlight visual:** crisp target + dimmed/blurred surroundings (premium spotlight look).
8. Scope is the **full activation system in one spec**, delivered in phases (§9).

---

## 4. Architecture — the 14-day activation system

```
                       ┌─────────────────────────────────────────────┐
   First session  ───▶ │  Onboarding (Day 0)                          │
   (Day 0)             │  persona → market → CHOICE                   │
                       │   ├─ "Show me around": Score→Why→Pro+report  │
                       │   │                      → bonus Connect Claude
                       │   └─ "I'll explore": app + 1 Score coachmark │
                       └───────────────┬─────────────────────────────┘
                                       ▼
   Return visits  ───▶  "Next best move" + "new since you left"  (Days 1-14)
                                       ▼
   Email          ───▶  Behavior-aware drip (existing DripService, enhanced)
                                       ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │  SHARED: Feature-coverage signal — "what has this user done/not?"  │
   │  derived from usage_stats + checklist_tasks + user_events          │
   └───────────────────────────────────────────────────────────────────┘
```

Each unit has one purpose and a defined interface:

- **Tour engine** — renders a resilient spotlight over real surfaces; knows nothing about email.
- **Coverage signal** — pure read model; inputs = events/stats, output = per-feature used/not-used + recommended next feature. Consumed by 3 surfaces; no surface owns it.
- **Return-surface** & **drip** — presentation/delivery over the signal.

---

## 5. Component Design

### 5.1 Trial-unblur (prerequisite — must land first)

**Requirement:** A new signup's trial must be resolvable **before first authenticated render**, and the entitlements tier must be **seeded server-side** so no surface ever flashes `free`.

**Primary approach (robust, no flash for anyone):**

1. **Grant the trial server-side at user creation** — move the grant out of the client fire-and-forget path into a guaranteed server path (preferred: the DB `handle_new_user` flow / a Supabase trigger that inserts the `user_trials` row from `trial_config`; alternative: an **awaited** backend step in the signup/callback path). Keep `startOnboardingTrial()` as a resilience fallback. Refs: `onboarding.service.ts:33-98` (`ensureTrialStarted`), `trial_config` (`102-create-trial-tables.sql`).
2. **Seed entitlements tier from the server on first render** — resolve tier during SSR using the cookie user id and pass it into `EntitlementsProvider` (`initialResources`/initial tier) so `DEFAULT_ENTITLEMENTS_STATE.tier = "free"` (`entitlements-helpers.ts:10-16`) is never shown to a Pro/trial user. Backend resolver already supports this (`tier-resolver.service.ts:39-157`).

**Lighter alternative (frontend-only fallback):** optimistic `tier:"pro"` on fresh auth in `EntitlementsContext.tsx`. ⚠️ Risk: an expired-trial returning user would flash Pro→free. The server-seed approach avoids this; prefer it. Decide in the plan.

**Acceptance:** load the app as a brand-new trial user on prod → Score, metrics, and report render unblurred on first paint.

### 5.2 Tour engine rebuild (one resilient component)

Replace the broken compositing and fragility. A single `TourSpotlight` (System A) backed by a fixed spotlight primitive:

- **Correct compositing:** remove `backdropFilter` from the masked SVG. Render the dim + blur as the **inverse of the target rect** so the target is never filtered. Implementation options (plan picks one): four dim/blur divs around the target rect, OR a single overlay with an `evenodd` `clip-path` hole. Add a soft indigo glow ring on the target. Fix `BreathingSpotlight.tsx:95-122`.
- **No full-screen-blur failure:** if the target selector isn't found within a short bounded poll, **auto-advance or skip** the step — never blur the whole app. Replace `BreathingSpotlight.tsx:82-90`.
- **Mobile real cutout:** give `TourBottomSheet` an actual target highlight (cutout/ring), not a full-screen blur (`TourBottomSheet.tsx:37-40`).
- **Survives navigation:** persist tour state (step + market + persona + sessionId) in a store/localStorage, not only URL params, so a stray click doesn't kill it (`useTourFromUrl.ts:24-36`).
- **Dismiss into the app:** `dismiss()` → `/dashboard` (or current market), not `/` (`useTourFromUrl.ts:61-63`).
- **Accessibility:** focus management + visible focus, `Esc` to exit, `prefers-reduced-motion` disables the breathing/scale animations, ARIA on the tooltip dialog.

### 5.3 Tour steps (3 core + 1 bonus)

On the user's real picked market, persona-tailored copy:

1. **PropertyIQ Score (interactive)** — spotlight `[data-tour="propertyiq-score"]` (`market/[id]/components/ScoreColumn.tsx:30`). "Boise scores 72 — strong demand vs. its state." Advance = the user **taps to reveal the breakdown** (the 4 signals + confidence + trend), not a passive Next.
2. **What's driving it** — spotlight the AI narrative `[data-tour="ai-assessment"]` (`market/[id]/MarketDashboard.tsx:240`), same page (no navigation). The "smart friend" differentiator beat.
3. **🎉 Pro unlocked — your first win** — truthful celebration over a genuinely unlocked screen; hands the user the **full market report** (§5.4) and the **persona springboard** (§5.5).
4. **Bonus — Connect Claude** (optional, before exit) — pitch the MCP differentiator with a one-tap path to the connect flow; skippable.

Compare/screener/analyzer/watchlist move to the checklist (§5.6), keeping the tour < 60s.

### 5.4 Report-as-finale (reuse `ListingPresentation`)

Repoint the existing 10-section report from the anonymous funnel to the post-signup aha:

- Render `ListingPresentation` for the signed-in trial user with `showWatermark={false}` and **without** `InlineSignupForm` (`Step4Aha.tsx:74-88`).
- Provide an **authenticated report fetch** equivalent to `useAnonymousListingPresentation` (confirm/extend in the plan; the section components are presentational and unchanged).
- CTA: "Save / share this report" + "Generate another."

### 5.5 Persona springboard ("now put it to work")

Under the report, 3-4 persona-weighted deep-link cards (each lands the surface with a coachmark waiting). The **first card is always the Claude/MCP hero** (`⚡ Only on PropertyIQ`). Investor example: Connect Claude · Analyze a deal · Screen for cashflow · Compare markets.

### 5.6 Getting-started checklist (extend `ProgressChecklist`)

Evolve the existing component:

- **Value-framed items** (sell the payoff, not the task): Score ✓ · Read your market report ✓ · **Connect Claude** `⚡ unique` · Compare to a peer · Screen markets · Analyze a property · Save to watchlist.
- Auto-checks from the coverage signal; persistent on the dashboard + a small launcher; dismissible; re-engages across the trial. Extend `CHECKLIST_ITEMS` (`ProgressChecklist.tsx:6-20`) and the backend checklist task set (`onboarding.service.ts:109-124`).

### 5.7 Feature-coverage signal (new shared module)

A pure read model: **input** = `usage_stats` + `checklist_tasks` + `user_events`; **output** = per-feature `{used: boolean, lastUsedAt}` for {map, score, compare, analyzer, screener, watchlist, reports, graphs, mcp} + a **recommended next feature** (persona-weighted over the unused set). One module, consumed by checklist (5.6), return-surface (5.9), drip (5.10). No consumer reaches into raw tables.

### 5.8 Feature event instrumentation (fills the gaps)

E2 found these features **untracked**: analyzer, screener, watchlist, graphs, **MCP connection**. Add `trackEvent`/`incrementUsageStat` (and, for MCP, a connection-status signal — likely a `mcp.connected` event emitted when the MCP server first authenticates a user, surfaced to the backend) so the coverage signal can see them. Follow the existing `feature.*` taxonomy (`lib/analytics/tracker.ts`).

### 5.9 Return-visit surface

Top-of-dashboard, once per return/session, dismissible:

- **"Your next best move"** — the coverage signal's recommended unused feature, persona-weighted (CTA deep-links with a coachmark).
- **"New since you left"** — data-driven (fresh data on their markets / a genuinely new feature).
- **Progress trail** (done vs todo chips).
  Renders in `dashboard/page.tsx`.

### 5.10 Drip email enhancement (extend `DripService`)

Reuse the mature infra; add only the delta:

- **Behavior-awareness:** before sending each day's email, read the coverage signal → **skip** features already used; **lead** with the highest-value unused one. (`drip.service.ts` send loop + `email_preferences.marketing` already checked.)
- **The Claude/MCP email:** one dedicated send ("the one thing only PropertyIQ does"). New template in `packages/emails/`.
- **Key to trial start** + dedup via `email_log`/`email_triggers`.
- **Verify `RUN_CRONS=true` in prod** during the build (is the drip actually sending today?).

### 5.11 System B deletion

Remove `app/(app)/onboarding/TourProvider.tsx`, `onboarding-steps.ts`, the `providers.tsx:170` mount, and the `?onboarding=true` path. **Extract & keep** the shared primitives that System A uses (`BreathingSpotlight`, `ConnectedTooltip`, `OnboardingProgressBar`, `celebrations.ts`) — move them under `app/(app)/tour/` and apply the §5.2 fixes there. One set of `data-tour` selectors; remove duplicates. (Keep `dashboard/.../ProgressChecklist.tsx`, the `/onboarding` quiz page, and the entitlements system — those are not System B.)

---

## 6. Data Flow

```
signup → (server) grant trial + seed tier → app renders Pro (no flash)
tour interactions → trackEvent + updateChecklistTask/incrementUsageStat
                  → /api/usage/events + user_profiles.{usage_stats,checklist_tasks}
coverage signal reads those → feeds checklist UI, return-surface, drip cron
drip cron (daily, Redis-locked) → coverage signal → skip-used / lead-unused → Resend
```

---

## 7. Error Handling & Resilience

- Spotlight target missing → bounded poll → auto-skip (never blur app).
- Report generation error → graceful inline error + "skip to dashboard" (reuse `ListingPresentationError` pattern), tour still completable.
- Entitlements resolve `free` unexpectedly → server-seeded tier is source of truth; never hard-gate the tour's own surfaces.
- Tour state lost (cleared storage) → exits cleanly into the app, never into a half-state.
- Drip: per-user `email_triggers` dedup; `RUN_CRONS`/Redis-lock prevents double-sends across instances.

## 8. Testing Strategy

Per project rule — **live data, no mocks for UI verification**:

- **Unit:** coverage-signal derivation (used/not-used per feature; recommended-next), spotlight geometry (target rect → cutout), drip skip-used logic.
- **E2E (Playwright, real DB):** fresh-signup → unblurred Pro → full tour → report → checklist; dismiss-into-app; navigation-survival; mobile cutout; no-target auto-skip. Extend `tests/e2e/onboarding-conversion.spec.ts`.
- **Manual prod verification:** brand-new trial signup shows zero blur on first paint; the drip is actually sending (`RUN_CRONS`).

## 9. Phased Delivery (one spec, sequenced build)

- **P0 — Stop the bleeding:** §5.1 trial-unblur, §5.2 spotlight rebuild, §5.11 System B deletion, dismiss-into-app. _(Biggest UX gain; mostly self-contained.)_
- **P1 — The aha:** §5.3 tour steps (incl. bonus Connect Claude), §5.4 report-as-finale, §5.5 springboard, §5.6 checklist.
- **P2 — The signal & return:** §5.7 coverage signal, §5.8 instrumentation, §5.9 return-surface.
- **P3 — Lifecycle:** §5.10 drip enhancement + MCP email, metrics/success tracking.

## 10. Risks & Open Questions

- **Trial-unblur mechanism:** DB trigger vs awaited backend step — confirm `handle_new_user` is the right hook and that `trial_config.is_enabled = true` in prod.
- **Authenticated report endpoint:** confirm `useAnonymousListingPresentation` has (or needs) a signed-in equivalent.
- **MCP connection signal:** how the MCP server reports "user connected" back to the app (event/webhook/entitlements) — needs a small backend touchpoint.
- **`RUN_CRONS` in prod:** verify the drip is live before depending on it.
- **Baseline metrics:** capture current activation + MCP-connect rates before P0 to measure lift.

## 11. Key File Change Map

| Area                            | Files                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trial-unblur                    | `lib/entitlements/EntitlementsContext.tsx`, `entitlements-helpers.ts`, `backend/.../tier-resolver.service.ts`, `onboarding.service.ts`, signup/`handle_new_user` |
| Spotlight rebuild               | `app/(app)/tour/components/TourSpotlight.tsx`, `TourBottomSheet.tsx`, `hooks/useTourFromUrl.ts`, + extracted `BreathingSpotlight`/`ConnectedTooltip`             |
| Tour steps/report               | `tour/step-content.ts`, `tour/components/Step4Aha.tsx`, `ListingPresentation.tsx`, `market/[id]/MarketDashboard.tsx` (`data-tour` hooks)                         |
| Springboard/checklist           | new springboard component, `dashboard/components/ProgressChecklist.tsx`, `onboarding.service.ts`                                                                 |
| Coverage signal/instrumentation | new `lib/.../feature-coverage` module, `lib/analytics/tracker.ts` call sites (analyzer/screener/watchlist/graphs), MCP connect signal                            |
| Return-surface                  | new component in `dashboard/page.tsx`                                                                                                                            |
| Drip                            | `backend/.../drip.service.ts`, `packages/emails/` (new MCP template)                                                                                             |
| Deletion                        | remove `app/(app)/onboarding/{TourProvider,onboarding-steps}.tsx`, `providers.tsx:170`                                                                           |

---

_Companion mockups for this design persist in `.superpowers/brainstorm/` (gitignored)._

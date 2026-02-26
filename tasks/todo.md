# Beta Testing Bug Fix Plan

Organized from feedback-export-1772064847886.md. Deduplicated and prioritized.

---

## Priority 0: CRITICAL — Security Gaps Found During Code Review

Discovered by background code-reviewer agent after P1 fixes.

- [x] **0a.** `ExportController` — No guards at all (missed in P1 pass) → Added JwtAuthGuard
- [x] **0b.** `HealthController` alert endpoints — accept userId from body with no auth → Added AdminGuard + @AuthUserId
- [x] **0c.** `x-user-id` header fallback in JwtAuthGuard — complete auth bypass → Removed entirely
- [x] **0d.** `shares.controller.ts` — class-level guard blocks public `access/:token` → Moved to method-level guards
- [x] **0e.** `PipelinesController` in same file as `HealthController` — violates single responsibility → Split to own file

## Priority 1: CRITICAL — Unguarded Admin/Backend Endpoints (Security)

These endpoints were publicly accessible without authentication. All fixed.

- [x] **1a.** `data-ingestion.controller.ts` — Added AdminGuard at class level
- [x] **1b.** `ml-workflow.controller.ts` — Added AdminGuard at class level
- [x] **1c.** `ml-validation.controller.ts` — Added AdminGuard at class level
- [x] **1d.** `backtest-runs.controller.ts` — Added AdminGuard at class level
- [x] **1e.** `validation.controller.ts` — Added AdminGuard at class level
- [x] **1f.** `pipelines.controller.ts` — Added AdminGuard at class level
- [x] **1g.** `scoring.controller.ts` — Added AdminGuard on POST calculate/validate methods
- [x] **1h.** Analytics controllers — Converted from userId query param to JwtAuthGuard + @AuthUserId
- [x] **1i.** AI insights executor — Investigated: already AdminGuard-protected, limited to tier_features table. Lower risk than reported. Needs DTO validation (deferred).

## Priority 2: HIGH — Auth/Entitlement Gating Broken

Root causes investigated. Implementing fixes now.

- [x] **2a.** AnonPaywallOverlay race condition — Added authLoading guard to PaywallProvider
- [x] **2b.** AnonPaywallOverlay testing — Added simulatedAuth support to PaywallProvider
- [x] **2c.** Alerts page paywall flash — Added entitlementsLoading guard with skeleton
- [x] **2d.** Reports page upsell — Added `feature_reports` migration + EntitlementGate loading support
- [x] **2e.** /upgrade/success auth gate — Added to middleware + component-level useAuth redirect

## Priority 3: HIGH — Data Accuracy Issues

- [x] **3a.** Metro SEO page — Already fixed, ScoreWidget components are in place. "--" is SSR pre-hydration state.
- [x] **3b.** Kansas score = 0 — Fixed null-to-zero coercion in scoring-queries, MarketDashboard, and 5 downstream consumers
- [x] **3c.** State data mismatch — Fixed FIPS-to-abbreviation normalization in market-snapshot fetchZillow/fetchRealtor

## Priority 4: MEDIUM — Broken Features

- [x] **4a.** Newsletter 500 — Created newsletter_signups migration + added Zod validation to route
- [x] **4b.** Graphs query params — Read mid/mname/mtype synchronously in useState initializer
- [x] **4c.** Map query params — Fixed CTA to pass id/name/state + added region fallback alias
- [x] **4d.** Alerts 404 — Fixed controller path from `@Controller('alerts')` to `@Controller('api/alerts')`
- [x] **4e.** Admin Tiers loading — Added response.ok checks with 401/403 error messages + retry button
- [x] **4f.** Insights server error — Added try/catch returning empty array on DB failure
- [x] **4g.** Top Blocked Resources zeros — Fixed field name mismatch (views/clicks vs view_count/click_count)
- [x] **4h.** Score Validation empty — Added zero-data detection with M3 empty state message
- [x] **4i.** Health data-freshness 404 — Wired DataFreshnessService to HealthController GET route

## Priority 5: MEDIUM — UX/Content Issues

- [x] **5a.** Blog title duplicate — Removed redundant "| PropertyIQ" from blog layout metadata
- [x] **5b.** Compare page FAQ schema — Removed FAQPage JSON-LD (no visible FAQ section)
- [x] **5c.** Metric freshness date — Added loading skeleton to MetricFreshnessDate component
- [x] **5d.** Help page email — Changed propertyiq.ai to propertyiq.app
- [x] **5e.** Pricing reports price — Added skeleton loading + static fallback for price display
- [x] **5f.** Contact Sales — Changed href from /about to /contact?subject=Enterprise%20Inquiry
- [x] **5g.** Feature limits — Updated pricing page to show DB-configured limits instead of "Unlimited"
- [x] **5h.** Trial CTA for Pro — Added tier check, shows "Manage Subscription" for paid users
- [x] **5i.** Admin Free tier — Already present in dropdown, bug was testing artifact
- [x] **5j.** Dashboard redirect — Replaced empty page with server-side redirect to /map
- [x] **5k.** Tier simulation — Set simulatedAuth=true when ?tier= param is used
- [x] **5l.** Blog categories — Created BlogFilterableList client component with useState filtering

## Priority 6: MEDIUM — Architecture/Code Quality

- [x] **6a.** Sitemap — Replaced new Date() with static '2026-02-25'
- [x] **6b.** Compare catch — Added console.error to empty catch block
- [x] **6c.** Report fallback duplication — Rewrote metricHelpers to use backend provenance, removed duplicate chains
- [x] **6d.** Loading states — Replaced '...' with skeleton animations in 3 key components
- [x] **6e.** Em-dash consistency — Changed hardcoded "--" to "\u2014" in 6 score components
- [x] **6f.** useDataCardBatch — Removed null-value filtering, cards now render with em-dash
- [x] **6g.** ResolvedMetric metadata — Added provenance to reports-data-fetcher + reports-orchestrator
- [x] **6h.** InheritedBadge — Already wired in map/market pages; added to report MetricGrid/Highlight/Detail
- [x] **6i.** MetricTitle source — Already supports resolvedMetric prop; wired provenance in report sections
- [x] **6j.** GA hardcoded fallback — Removed, returns null if env var missing

## Priority 7: LOW — Nice to Have / Feature Requests

- [x] **7a.** ML Workflow unmount — Added isMountedRef guard to all async state updates
- [ ] **7b.** Stripe billing portal lacks plan switching (Stripe dashboard config — not a code fix)
- [x] **7c.** Pricing loading — Added skeleton cards while plans load
- [x] **7d.** System health status is mocked — Wired real /api/health + /api/health/data-sources via useSystemHealth hook
- [x] **7e.** Real-time tier push — Added Supabase Realtime subscription on user_profiles with auto-refetch + toast
- [x] **7f.** Tester management Deactivate/Reactivate — Already implemented (TesterManager + API routes)
- [x] **7g.** Newsletter double opt-in — Confirmation token + Resend email + /api/newsletter/confirm endpoint
- [x] **7h.** Newsletter API rate limiting — Added IP-based 5 req/15min via reusable RateLimiter
- [x] **7i.** API retry logic — Added React Query retry(3) with exponential backoff, skips 4xx errors
- [x] **7j.** Pro-to-Free downgrade — Cancel-at-period-end + resume flow, M3 dialog, backend endpoints
- [x] **7k.** metro-slug-data.ts refactor — Extracted to JSON data file, TS wrapper now 18 lines
- [x] **7l.** Google OAuth error — Added friendlyAuthError() to show user-friendly messages
- [x] **7m.** Compare pricing regex — Replaced regex with {{PRO_PRICE}}/{{ENTERPRISE_PRICE}} templates

## Deferred / Won't Fix

- Google OAuth provider not enabled — Supabase dashboard configuration, not a code fix
- Stripe portal plan switching — Stripe dashboard configuration

---

## Notes

- AnonPaywallOverlay has contradictory reports (2a vs 2b) — both share root cause (auth loading race)
- Newsletter 500 reported 3 times across different pages — single root cause
- Alerts 404 reported 2 times — single root cause (endpoints don't exist)
- Several admin controller guard issues reported 2x each — deduplicated above

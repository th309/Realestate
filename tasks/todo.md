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
- [x] **7b.** Stripe billing portal lacks plan switching — Added portal configuration API with plan switching, cancellation, payment methods, invoice history + security hardening
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

- ~~Google OAuth provider not enabled~~ — Enabled in Supabase dashboard

---

## Notes

- AnonPaywallOverlay has contradictory reports (2a vs 2b) — both share root cause (auth loading race)
- Newsletter 500 reported 3 times across different pages — single root cause
- Alerts 404 reported 2 times — single root cause (endpoints don't exist)
- Several admin controller guard issues reported 2x each — deduplicated above

---

---

# Plan: In-app OAuth for content-pipeline platform publishers (2026-04-23)

**Goal:** Replace the env-var + OAuth Playground dance with a proper per-platform Connect button → Google consent → encrypted DB-stored refresh token. Eliminate the 24h Playground revocation trap that blocked Wave 0 smoke today.

**Scope (user decisions, 2026-04-23):**

- Build **YouTube Shorts** credential flow end-to-end. Pre-wire the other 5 rows (TikTok, IG Reels, FB Reels, LinkedIn, YouTube Long) with _disabled_ "Connect" buttons so the UI shows the full roadmap. Wiring their actual OAuth flows lands with their publishers in P2/P3.
- **One credential per platform** — unique `(platform)` constraint, no multi-account in P1. Keep `account_label` column for forward compat.

**Non-goals:** Token auto-rotation, multi-account support, other platform OAuth flows, revoke-on-channel-deletion automation, token-health probe cron.

**Acceptance criteria:** one green end-to-end run from admin UI wizard → YouTube Shorts on the dedicated channel without touching env vars. Disconnect button clears credentials and returns publisher to `isConfigured() = false`.

---

## Architecture

```
User clicks "Connect YouTube" on /admin/content-pipeline/platforms
  ↓ POST /api/admin/content-pipeline/platforms/youtube_shorts/oauth-start
  ← { authUrl: "https://accounts.google.com/o/oauth2/v2/auth?..." }
  ↓ window.location.href = authUrl
Google consent page → user approves
  ↓ Google redirects to ${APP_BASE_URL}/admin/content-pipeline/platforms/oauth-callback/youtube?code=...
Frontend callback page reads `code` from URL
  ↓ POST /api/admin/content-pipeline/platforms/youtube_shorts/oauth-complete { code }
Backend exchanges code for tokens
  ↓ upsert platform_credentials { platform='youtube_shorts', refresh_token_enc, access_token_enc, ... }
  ← { success: true, account_label: "channel-handle" }
Frontend redirects to /admin/content-pipeline/platforms?connected=youtube_shorts
PlatformRow re-fetches, shows "Connected · @channel-handle" with Disconnect button

YouTubeShortsPublisher.getAuth():
  1. SELECT refresh_token_enc, access_token_enc FROM platform_credentials WHERE platform='youtube_shorts'
  2. If found: decrypt with CredentialCrypto, set on google.auth.OAuth2
  3. If missing: fall back to YOUTUBE_OAUTH_* env vars (local dev convenience)
  4. isConfigured() returns true if DB row OR env set
```

---

## Tasks

### Phase A: Schema + crypto wiring

- [ ] **A1.** Migration `20260423000200_platform_credentials.sql`
  - Table: `platform_credentials (id uuid PK, platform text NOT NULL, account_label text, refresh_token_enc text NOT NULL, access_token_enc text, token_expires_at timestamptz, scopes text[], connected_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), disconnected_at timestamptz)`
  - Unique index: `UNIQUE (platform) WHERE disconnected_at IS NULL` (one active cred per platform; historical rows preserved)
  - GRANT SELECT, INSERT, UPDATE, DELETE ON platform_credentials TO service_role, authenticated (per memory note)
  - Apply via `scripts/apply-content-pipeline-migrations.js` (add to MIGRATIONS array), verify row shape.
- [ ] **A2.** `PlatformCredentialsService` (`platform-credentials.service.ts`, <200 lines)
  - `getActiveCredential(platform): Promise<{ refreshToken, accessToken, expiresAt, accountLabel } | null>` — decrypts from DB
  - `upsertCredential(platform, accountLabel, refreshToken, accessToken, expiresAt, scopes)` — encrypts + UPSERT
  - `disconnect(platform)` — UPDATE set disconnected_at
  - Injects `CredentialCrypto` and `SupabaseService`

### Phase B: Backend OAuth completion flow

- [ ] **B1.** Verify existing `platform-manager.service.ts:startOAuth` sends the correct redirect URI. Redirect URI must match what we'll register in Google Cloud Console.
- [ ] **B2.** Add callback DTO and controller endpoint
  - `dto/oauth-complete.dto.ts` — `{ code: string, state?: string }`, class-validator
  - `POST /api/admin/content-pipeline/platforms/:platform/oauth-complete` in `content-pipeline.controller.ts`
  - Exchanges `code` for tokens via `google.auth.OAuth2.getToken`
  - Fetches channel snippet via YouTube Data API to get `account_label` (channel handle)
  - Calls `PlatformCredentialsService.upsertCredential(...)`
  - Returns `{ success: true, account_label, platform }`
  - AdminGuard-protected
- [ ] **B3.** `DELETE /api/admin/content-pipeline/platforms/:platform/credentials` — AdminGuard, calls `disconnect(platform)`
- [ ] **B4.** Update `YouTubeShortsPublisher.getAuth()` and `isConfigured()`:
  - Inject `PlatformCredentialsService`
  - `isConfigured()` → true if DB row OR env set
  - `getAuth()` → prefer DB, fall back to env; if DB row found, overwrite env-sourced refresh_token
  - Add unit test covering both paths + "env fallback only if no DB row"
- [ ] **B5.** Extend `PlatformManagerService.getPlatformStatuses()` to include `accountLabel` + `connectedAt` from DB for connected platforms.

### Phase C: Frontend connect flow

- [ ] **C1.** Callback page: `packages/frontend/app/admin/content-pipeline/platforms/oauth-callback/youtube/page.tsx`
  - Client component, reads `?code=...&error=...` from URL
  - If `error`: show message with "Retry Connect" link
  - If `code`: POST to `/oauth-complete`, then `router.replace('/admin/content-pipeline/platforms?connected=youtube_shorts')`
  - Minimal UI — M3 circular progress during exchange
- [ ] **C2.** Update `PlatformRow` component:
  - Show Connect button when `!configured && supported`
  - Show "Connected · @handle" + Disconnect button when configured
  - Show "Coming in P2/P3" disabled state for unsupported platforms
  - Connect → POST `/oauth-start` → `window.location.href = authUrl`
  - Disconnect → confirm modal → DELETE `/credentials` → refetch
- [ ] **C3.** Update `lib/content-pipeline-api.ts` with `startPlatformOAuth`, `completePlatformOAuth`, `disconnectPlatform`.
- [ ] **C4.** Add `?connected=youtube_shorts` toast on platforms page when returning from callback.

### Phase D: Google Cloud Console + local env

- [ ] **D1.** Update the existing OAuth client's Authorized redirect URIs (user does this in Google Console):
  - Add `http://localhost:3000/admin/content-pipeline/platforms/oauth-callback/youtube`
  - Add `https://www.propertyiq.app/admin/content-pipeline/platforms/oauth-callback/youtube`
  - Leave the Playground URI for fallback/legacy generation
- [ ] **D2.** Confirm `APP_BASE_URL` is correct in `.env.local` (was `https://backend-dev-d9ca.up.railway.app` on dev; for local must be `http://localhost:3000` so the generated authUrl points at the local frontend which has the callback page). **This is the subtle gotcha** — `APP_BASE_URL` is used for the OAuth redirect, so it must point at the _frontend_ origin, not the backend.
- [ ] **D3.** Same for prod: Railway prod env `APP_BASE_URL` should be `https://www.propertyiq.app` (not the backend URL).

### Phase E: End-to-end test + cleanup

- [ ] **E1.** Local smoke: load `/admin/content-pipeline/platforms`, click Connect, complete Google flow on dedicated channel, verify DB row has encrypted tokens, click Disconnect, verify row has `disconnected_at`.
- [ ] **E2.** Retry the failed Miami or Bloomington run — should now publish successfully using DB credentials.
- [ ] **E3.** Verify `isConfigured()` returns true post-connect and false post-disconnect.
- [ ] **E4.** Update `deploy-state.md`:
  - Mark OAuth no longer needs env var for prod
  - Note new migration `20260423000200`
  - Note: Railway env `YOUTUBE_OAUTH_REFRESH_TOKEN` can be cleared after Connect runs on prod UI

### Phase F: Deploy

- [ ] **F1.** Commit Phase A+B+C together with message like `feat(content-pipeline): in-app OAuth connect flow for platform credentials`
- [ ] **F2.** Apply migration to prod Supabase via `apply-content-pipeline-migrations.js`
- [ ] **F3.** Merge branch → develop → main, watch Railway redeploy (both envs)
- [ ] **F4.** On prod `/admin/content-pipeline/platforms`, click Connect with the dedicated channel, verify DB row + successful retry of a grade_reveal run.

---

## Files created / modified

**New files (8):**

- `supabase/migrations/20260423000200_platform_credentials.sql`
- `packages/backend/src/content-pipeline/platform-credentials.service.ts`
- `packages/backend/src/content-pipeline/dto/oauth-complete.dto.ts`
- `packages/backend/src/content-pipeline/platform-credentials.service.spec.ts`
- `packages/frontend/app/admin/content-pipeline/platforms/oauth-callback/youtube/page.tsx`

**Modified (7):**

- `packages/backend/src/content-pipeline/content-pipeline.controller.ts` (add callback + disconnect endpoints)
- `packages/backend/src/content-pipeline/platform-manager.service.ts` (include credential metadata in statuses)
- `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.ts` (DB-first auth)
- `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.spec.ts`
- `packages/backend/src/content-pipeline/content-pipeline.module.ts` (register new service)
- `packages/frontend/app/admin/content-pipeline/platforms/platform-row.tsx` (connect/disconnect UI)
- `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts` (three new client helpers)
- `scripts/apply-content-pipeline-migrations.js` (add migration)
- `docs/content-pipeline/platform-setup/youtube.md` (document the new flow)
- `docs/content-pipeline/deploy-state.md` (phase E4)

---

## Risks + mitigations

- **Redirect URI mismatch** — Google's strictest check. Mitigation: D1 lists all three URIs exactly; do smoke in local first.
- **APP_BASE_URL confusion** — in this monorepo `APP_BASE_URL` is used by both backend endpoints (short-link, OAuth redirect generation) and any frontend absolute URL building. For local dev it must be `http://localhost:3000`; setting it to `:3001` breaks the OAuth redirect. Flag in D2.
- **Env-var fallback breaking existing tests** — B4 unit test covers the precedence order. Happy-path E2E already passes on current env-only flow; must still pass after the change.
- **Migration idempotency** — use `CREATE TABLE IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS` so re-runs are safe (lesson learned from migration 9).
- **Locking existing runs out** — during the transition, any Wave 0 retries must still work. Solution: B4 falls back to env vars when no DB row exists, so pre-connect behavior is unchanged.

---

## Open questions for the operator

1. For `account_label`, prefer the channel **handle** (`@troyhouston322`) or the channel **title** (`Troy Houston`)? Handle is more stable, title can change. My lean: handle.
2. Post-MVP: do we want a "token health" indicator on the PlatformRow (last access_token refresh ts + warning if >50 days old)? Not in this plan; defer to P4's credential-health-probe cron.
3. If the user re-connects a previously-disconnected platform, should history preserve (multiple rows with `disconnected_at` set) or just overwrite the old row? Plan says preserve — aligns with upcoming audit needs.

---

## Check-in gate

Before executing, confirm with operator:

- Plan matches scope (YouTube now, others pre-wired disabled)
- Answers to open questions
- No objection to 2h-ish implementation window

Then Phase A → B → C → D → E → F, committing at sensible boundaries, verifying each phase's acceptance before moving on.

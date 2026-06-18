# Handoff — Trial Walkthrough & Welcome-Stream Fixes (2026-06-18)

**Branch:** `develop` (all work committed, **not pushed**). **DB migrations: applied to PROD.**

## Start here next session

The user is **manually walking the 14-day trial** to give feedback. Resume with their
feedback. Everything below is done/verified except where it says **NEEDS USER FEEDBACK**.
Manual-walk tooling + steps: `docs/superpowers/runbooks/manual-trial-walkthrough.md`.

---

## Original goal

"Walk through a full 14-day trial — the emails, the tracking of what the user tried,
suggestions — and make it work end to end with real emails." Then: fix all follow-ups,
production-ready (no workarounds); the secret Supabase key should have full DB access;
emails must never use localhost URLs; the tour must not be "suppressed" per-page.

## Design + plan docs

- Spec: `docs/superpowers/specs/2026-06-17-trial-walkthrough-live-harness-design.md`
- Plan: `docs/superpowers/plans/2026-06-17-trial-walkthrough-live-harness.md`

---

## What shipped (all on `develop`)

### The core bug — reverse-trial users got almost no trial emails (FIXED)

Every signup gets a "reverse Pro trial" in `user_trials`. But the onboarding drip
**skipped** active-trial users, and the countdown emails queried `user_subscriptions`
(Stripe-only) — so reverse-trial users received neither.

- `f95d9a6c` drip now serves trial users (suppresses only day-10/14 overlap).
- `85c30413` countdown emails target `user_trials`.
- `92fa2249` **critical**: `user_trials` has no FK to `user_profiles`, so the PostgREST
  embed errored `PGRST200` and silently sent nothing → rewrote to a two-query lookup.
- `8fb6496b` exposed `fireWelcome`, exported trigger services.

### DB migrations (APPLIED TO PROD — project `pysflbhpnqwoczyuaaif`) — `8b241169`

- `20260618140000_widen_event_session_id_columns.sql` — `user_events` / `user_sessions` /
  `visitor_identities` id columns `varchar(50)→100`. Fixes the `server-session:<uuid>`
  (51 char) overflow that was silently failing EVERY server-side analytics insert.
- `20260618140100_grant_service_role_full_public_access.sql` — grants `service_role`
  (the secret key's role) ALL on every public table/sequence + default privileges.
  `email_log` etc. were missing it (caused "permission denied"). Verified: only
  `spatial_ref_sys` (PostGIS system table) intentionally remains ungranted.

### Email links never localhost (F7) — `bf5e20d2`, `2da3a535`

- New `packages/backend/src/email/email-link-base.ts` `getEmailLinkBaseUrl(config)` —
  rejects localhost/127.0.0.1/LAN, prefers `EMAIL_LINK_BASE_URL`→`FRONTEND_URL`→
  canonical `https://propertyiq.app`. Now used by drip / behavioral / engagement /
  monthly-digest services. Unit-tested.
- Also extracted shared `email-recipients.util.ts` (`getMarketingOptOutIds`) → got
  `behavioral-trigger.service.ts` back under the 300-line limit (F4); removed dead
  `extractUsersFromTrials` (F5).

### Tour / welcome-stream production fixes (F1) — `6b6255ad`

- **No more haunting:** `useTourFromUrl.ts` resumes a saved tour only when the path is
  the tour's own market page, and clears the stale `piq.activeTour` otherwise. The
  earlier test-side "suppress on every page" hack was removed (`779e859d`) — the prod
  fix replaces it.
- **Finale can't hang:** `listing-presentation-narrative.service.ts` wraps the AI call
  in a 40s timeout → falls through to the existing deterministic fallback, so the tour
  finale always resolves. Client fetches got 55s safety timeouts.

### Dev tooling + harness

- Triple-gated dev endpoints `POST /api/admin/dev/trial-walkthrough/{advance,fire}` +
  `DELETE /user/:id` (`3e181ee7`, `3df1ab8c`) — gated by `AdminGuard` +
  `DEV_WALKTHROUGH_ENABLED=true` + refuses in production. `fireJob` is scoped to one
  `userId` (`57f5e260`) so it never emails other users.
- **Manual control tool** `scripts/trial-walkthrough.sh` + runbook (`ec938b0e`).
- Playwright harness `packages/frontend/tests/e2e/trial-walkthrough.spec.ts` + helpers
  (`tests/harness/*`): real signup→OTP→tour→per-day feature usage→logout/login→expiry.

---

## Verification status

- ✅ Automated harness passed Day 0→15 once (signup, OTP, tour, logout/login persistence,
  suggestions, expiry, teardown) — earlier run, with the now-removed suppression.
- ✅ All email types delivered to a real inbox: welcome, onboarding day 1/3/5/7, and the
  three countdown emails (`trial_day_10` "4 days left", `trial_day_13` "last chance",
  `trial_expired` "ended") — the latter three previously never sent.
- ✅ Backend logged `trial_day_10/13/expired: sent 1`; data-layer proof of the two-query fix.
- ✅ DB migrations verified on prod (columns=100; `email_log` reads 200 with secret key).
- ✅ Backend `tsc` clean + 56 email/anonymous tests pass; frontend `tsc` clean.
- **NEEDS USER FEEDBACK (manual walk in progress):** that the tour visually never haunts
  feature pages; that the finale resolves in the browser; that received emails' links are
  `propertyiq.app`; general UX of the welcome stream day-by-day.

The user reached **day 15 / expired** on account `troyhouston76+test5@gmail.com` and was
verifying the post-trial app state + inbox.

---

## How to resume the manual walk (env + gotchas)

1. **Local stack** (frontend :3000, backend :3001) must run with these in
   `packages/backend/.env` (LOCAL ONLY — re-add if stripped): `DEV_WALKTHROUGH_ENABLED=true`,
   `ALLOW_DEV_AUTH=true`, `RESEND_API_KEY=<real>`, `EMAIL_FROM=<verified sender>`.
   Harness/tool env is in `packages/frontend/.env.harness.local` (gitignored).
2. Start: kill all node (PowerShell `Get-Process node | Stop-Process -Force`), then
   `npm run dev:fresh`. **Gotcha:** `dev:fresh` (next dev --webpack) crash-loops if `.next`
   is corrupted from repeated restarts — if it exits 127 / ports go 000, `rm -rf
packages/frontend/.next packages/frontend/.next-verify` then restart, and don't thrash it.
3. Drive a fresh account (don't reuse a half-used one): sign up at
   `localhost:3000/auth/sign-up` (real 6-digit OTP from the inbox), then:
   `bash scripts/trial-walkthrough.sh jump <email> <day>` for day ∈ 0 1 3 5 7 10 13 15;
   `status` to inspect; `reset` to wipe. (Run in Git Bash.)

### Environmental gotchas hit this session (so you don't relearn them)

- **Norton "Mail Shield" intercepts IMAP** (`imap.gmail.com:993`) with an Untrusted-Root
  cert → the harness's IMAP OTP reader fails TLS; disabling Auto-Protect AND Smart Firewall
  did NOT stop it. The OTP was obtained via the Resend API instead (read the sent email).
- **Resend MCP + other plugin MCPs disconnect** whenever node is killed (server restart)
  and don't always auto-reconnect → OTP reads via Resend MCP become unavailable; fall back
  to the user pasting the code, or read via the Resend dashboard/API with a _full_ key
  (the `RESEND_API_KEY` in `.env.local` is send-only and can't list/read).
- **Gmail MCP search index lagged hours** for this inbox — unreliable for fresh OTPs.
- The OTP bridge (`tests/harness/gmailOtp.ts`, env `OTP_BRIDGE_DIR`) lets the controller
  hand a code to the running harness; timeout is 600s.

---

## Remaining follow-ups / cleanup

- **Strip dev flags** `DEV_WALKTHROUGH_ENABLED` + `ALLOW_DEV_AUTH` from local
  `packages/backend/.env` when manual testing is done (security hygiene). RESEND/EMAIL_FROM
  too if you want local back to console-logging emails.
- **Push / release:** nothing pushed. Decide `develop`→`main` per CLAUDE.md §2.6
  (`npm run release:main`). The two DB migrations are already on prod, so they ship cleanly.
- **Pre-existing (not addressed):** `drip.service.ts` is ~523 lines (>300 limit) — pre-existing,
  pragmatically deferred. `packages/frontend/app/backend/[[...path]]/route.ts` is an untracked
  pre-existing same-origin proxy (not from this work).
- **Consider:** `EMAIL_LINK_BASE_URL` could be set explicitly in prod env to pin the email
  domain rather than relying on `FRONTEND_URL`.
- Beta coverage may be stale (new dev surface) — `/sync-beta-test-coverage` if desired.

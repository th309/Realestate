# OAuth Onboarding Routing + Linked-Account Notice — Design

**Date:** 2026-06-25
**Status:** Approved (design); pending implementation plan
**Area:** `packages/frontend` — auth callback + onboarding routing + global toast
**Related:** [[reference_onauthstatechange-setsession-deadlock]] (the deadlock fix that first made the OAuth callback path reachable)

## Background

After the OAuth-callback deadlock fix (commit `59f90625`, released `62ee2d83`), the Google sign-in path runs to completion for the first time. That exposed two pre-existing behaviors:

1. **Returning users are force-onboarded.** A user with an established account (e.g. an email/password account created 2026-04-13) signs in with Google and is sent to the `/tour` "what brings you to PropertyIQ?" onboarding, as if brand new.
2. **No acknowledgment that Google was linked to an existing account.** Supabase auto-links the Google identity to the existing user (same `auth.users.id`) because both emails are verified. This is correct and safe, but silent — the user expected a "you already have an account" signal.

### Evidence (live prod DB, project `pysflbhpnqwoczyuaaif`, 2026-06-25)

- The callback gates onboarding on `user_profiles.onboarding_market IS NULL`.
- **`onboarding_market` is null for all 29 users** — it is only written by a mid-flow market-pick step (`backend/src/onboarding/onboarding.service.ts`, `backend/src/anonymous/listing-presentation-claim.service.ts`) and is effectively never set. So the gate sends _every_ user to `/tour` on OAuth / email-confirm sign-in.
- **`onboarding_completed_at` is set for 4 users** — written by `completeOnboarding()` in `frontend/lib/data/fetchers/onboarding.ts:65`. This is the real "finished onboarding" marker. The callback checks the wrong column, so even these 4 would be re-onboarded.
- **`last_login_at` is null for all 29** — dead column, not usable as a signal.
- The only reliable "new vs returning" signal is **`auth.users.created_at`** (available on the session as `session.user.created_at`).
- **2 users have multiple linked identities** — linking is rare; the notice is low volume.

## Goals

1. Force the onboarding flow only for **genuinely new accounts** that have not completed onboarding. Returning users always go straight to the app.
2. Show a **one-time, auto-dismissing toast** when a Google sign-in links to a pre-existing account.

## Non-goals

- Changing Supabase's automatic identity-linking behavior. It is safe (both emails verified) and stays as-is; we only acknowledge it.
- Adding DB columns or migrations.
- Wiring up `last_login_at` (separate concern).
- Changing the `type=recovery` (password reset) flow.

## Design

### Part 1 — Onboarding routing fix

File: `packages/frontend/app/(app)/auth/callback/page.tsx`, inside the deferred `completeSignIn` handler.

Replace:

```ts
needsOnboarding = !!profile && profile.onboarding_market === null;
```

with a "new, not-yet-onboarded account" rule:

```ts
const accountAgeMs = Date.now() - new Date(session.user.created_at).getTime();
const isNewAccount = accountAgeMs < NEW_ACCOUNT_WINDOW_MS; // 30 min
const isEmailConfirmSignup = type === "signup"; // confirm link carries type; survives long delays
const hasCompletedOnboarding = !!profile?.onboarding_completed_at;

needsOnboarding =
  !hasCompletedOnboarding && (isNewAccount || isEmailConfirmSignup);
```

- The profile query changes from selecting `onboarding_market` to `onboarding_completed_at`.
- `auth.users.created_at` (via `session.user.created_at`) is the age signal. The 30-minute window comfortably exceeds an OAuth round-trip (seconds); email-confirm delays are handled by `type === "signup"`, not by the window, so a slow email confirmation still onboards.
- Returning users (old account, not an email-confirm) → `needsOnboarding = false` → existing destination logic (`next`, etc.).
- The tour-claim priority (`claimedTourSessionId` → celebrate screen) is unchanged and still takes precedence.

The decision is extracted into a pure, unit-testable helper:

```ts
export function decideNeedsOnboarding(input: {
  accountCreatedAt: string; // session.user.created_at
  type: string | null; // searchParams "type"
  onboardingCompletedAt: string | null;
  now: number;
  newAccountWindowMs?: number; // default 30 * 60_000
}): boolean;
```

Location: a small module under `app/(app)/auth/callback/` (e.g. `onboarding-routing.ts`) so the callback page imports it and tests target it directly.

**Blast radius:** all 29 existing users are old accounts → none are force-onboarded again. The 4 completed users are never re-onboarded. New signups (OAuth or email) still onboard exactly once.

### Part 2 — One-time linked-account toast

**Detection** (client-side, in `completeSignIn`, after `setSession`, wrapped in the existing `withTimeout`):

```ts
const { data } = await withTimeout(supabase.auth.getUserIdentities());
const ids = data?.identities ?? [];
const oauth = ids.find((i) => i.provider !== "email");
const justLinked =
  ids.some((i) => i.provider === "email") &&
  !!oauth &&
  Date.now() - new Date(oauth.created_at).getTime() < 60_000;
if (justLinked) sessionStorage.setItem("piq_account_linked", oauth!.provider);
```

- `getUserIdentities()` is authenticated and safe here because `completeSignIn` runs off the `onAuthStateChange` callback (no auth-lock re-entrancy — see related deadlock reference).
- Best-effort: failure/timeout → no flag, no toast; auth never blocked.

**Display:**

- A top-level, always-mounted client component (the host of the global `components/ui/Toast`) reads and clears `piq_account_linked` once on mount and fires a toast: _"Welcome back — your Google sign-in is now linked to your existing PropertyIQ account."_ Auto-dismiss.
- The exact mount point (the `(app)` layout or the existing Toast provider host) is confirmed during planning.
- `sessionStorage` handoff (not a query param) so the toast shows regardless of the redirect destination (`/tour`, `/map`, celebrate screen, etc.).

## Error handling

- `getUserIdentities` timeout/error → no toast (swallowed).
- Missing/invalid `session.user.created_at` → treat as not-new (returning), i.e. do not force onboarding; never crash the callback.
- All onboarding-routing changes stay inside the existing `try/catch`; any throw still falls back to `router.replace(next)`.

## Testing

**Unit (vitest)** — `decideNeedsOnboarding`:

- New OAuth account, no completion → `true`
- Old account, no completion → `false` (the reported bug)
- Delayed email-confirm (`type=signup`, old `created_at`), no completion → `true`
- Completed onboarding (`onboarding_completed_at` set) → `false`

**Live E2E (real DB, no mocks)** — on prod after deploy:

1. Existing account (`troyhouston76@gmail.com`) signs in with Google → lands on the app, NOT `/tour`, and sees the linked toast once.
2. Brand-new Google signup (fresh email) → routed through `/tour`.
3. Reload after the toast → no repeat (flag cleared).

## Rollout

- Single PR-style change on `develop`, released to `main` via `npm run release:main`.
- No migration; no env changes.
- Verify on prod per the E2E checklist above.

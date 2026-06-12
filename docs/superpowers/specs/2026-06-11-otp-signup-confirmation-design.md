# Email-OTP Signup Confirmation — Design Spec

**Date:** 2026-06-11
**Parent work:** signup-chain repair (backlog item #1) → funnel completion
**Supersedes (for email signup):** the magic-link confirmation flow.

---

## 1. Problem

Prod requires email confirmation, and the confirmation **magic link** is consumed by email link-scanners (Gmail/Outlook SafeLinks prefetch the one-time URL). Evidence: a real test account (`troyhouston76+live1@gmail.com`) showed `email_confirmed_at` set **9 seconds** after signup (scanner), `last_sign_in_at` null, **0 events**, and the human click hit **"Verification link expired."** Funnel: **18 `signup_start` / 0 `signup_complete`** in 30 days. Email delivery was already fixed (Resend SMTP); this is the remaining blocker.

Fix: replace the signup confirmation **link** with a **6-digit email OTP code** the user types. A code cannot be prefetched/consumed by a scanner. (Decision 2026-06-11: standardize on 6 digits — set Supabase `mailer_otp_length: 6`.)

## 2. Pinned facts (verified empirically 2026-06-11, not assumed)

- **Verify:** `supabase.auth.verifyOtp({ email, token, type: "email" })` → returns a full session (`type: "email"`, NOT `"signup"`). Confirmed against this project's Supabase.
- **Resend:** `supabase.auth.resend({ type: "signup", email })`.
- **OTP length:** project was returning **8 digits** by default (`generateLink` returned `69095657`/`64283907`); we are standardizing on **6** — set `mailer_otp_length: 6` in Supabase. The input expects exactly 6 (must match the Supabase setting).
- **Client flow:** `flowType: "implicit"` → bare-token `verifyOtp` returns a session directly (no PKCE `token_hash`).
- **Token sharing:** the magic link and `{{ .Token }}` share the SAME one-time token → the link MUST be removed from the template or a scanner still breaks the code.
- **E2E:** `admin.generateLink({ type: "signup", email, password })` returns `properties.email_otp` and **re-mints for an existing unconfirmed user** (verified) — the only inbox-free way to read a valid plaintext OTP.

## 3. Supabase config (manual; outside code)

**Auth → Emails → "Confirm signup" template** → show the code, remove the link:

```html
<h2>Confirm your PropertyIQ signup</h2>
<p>Enter this code to activate your account:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
<p>This code expires in 1 hour. If you didn't request it, ignore this email.</p>
```

Keep **"Confirm email" ON** (we still verify, by code). OTP expiry ~1h default is fine.

## 4. Design

### 4.1 `AuthContext` — two thin wrappers

- `verifySignupOtp(email, token) → { error, session }` wrapping `verifyOtp({ email, token, type: "email" })`.
- `resendSignupOtp(email) → { error }` wrapping `resend({ type: "signup", email })`.
  Add both to the context type + value (mirrors existing `signInWithMagicLink` style).

### 4.2 Shared post-signup effects (DRY)

Extract today's autoconfirm `if (session)` block from `sign-up/page.tsx` into one reusable async helper (`app/auth/sign-up/complete-signup.ts`), called by BOTH the autoconfirm path and the OTP-verify path. It runs, in order: `trackEvent("conversion.signup_complete", { method })` + `flush()`; `user_profiles` upsert (`id`, `email`, `full_name`, `tos_accepted_at`); welcome email POST (fire-and-forget); `__piq_attr` attribution forward (fire-and-forget); then returns the destination string (`checkoutIntent && explicitRedirect ? explicitRedirect : redirectTo`). The caller does `router.push(destination)`. No router coupling inside the helper.

### 4.3 New `OtpConfirmation.tsx` (built via `frontend-design` skill)

Sibling of `page.tsx` to keep it under 400 lines. Props: `{ email, onVerified(session), method?: "email" }`.

- Single field: `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`, numeric-only; Verify enabled when exactly 6 digits entered.
- Verify → `verifySignupOtp(email, code)`; on `session` → `onVerified(session)`; on error, parse **expired vs invalid** into distinct inline messages (reuse error-banner styling).
- **Resend** link with a 60s cooldown countdown; calls `resendSignupOtp`; rate-limit errors → friendly "try again in a moment."
- Loading/disabled states reuse the page's `Loader2` + disabled pattern. M3 classes copied from the sign-up form.
- Failed-attempt guard: after 5 wrong codes, prompt to resend (resets counter).

### 4.4 `page.tsx` wiring

- Replace the `confirmationSent` branch's `<ConfirmationSent />` with `<OtpConfirmation email={email} onVerified={handleOtpVerified} />`.
- `handleOtpVerified(session)`: `await completeSignup(session, {...})` → `router.push(destination)`.
- Refactor the autoconfirm `if (session)` block to call the same `completeSignup` helper (DRY).
- **Delete `ConfirmationSent.tsx`** (now obsolete; per "delete stale, don't port").
- Keep the `conversion.signup_pending_confirmation` event (now means "OTP sent, awaiting code").

### 4.5 Resilience & real-world handling

- On entering the OTP state, persist `{ email }` in `sessionStorage` (`piq_signup_pending`); restore the OTP screen on mount if present so a refresh doesn't dead-end. `checkoutIntent` (already in sessionStorage) and the `?redirect=` URL param survive naturally. Clear on success.
- If `signUp` reports an **unconfirmed** email already exists, route to the OTP screen (resend) instead of a dead "already registered" error.
- Do not leak email existence beyond Supabase's own messaging.

## 5. E2E (no inbox)

Update `signup-chain.spec.ts` email test: UI signup form → OTP screen appears → obtain a valid code via `admin.generateLink({ type: "signup", email, password })` (`properties.email_otp`, re-mints for the existing unconfirmed user) → type it → land in app → assert `conversion/signup_complete` in `user_events` (fixed helper) → delete the user in `finally`. Add `getSignupOtp(email, password)` to `supabase-admin.ts`. Also keep a wrong-code error-path assertion.

## 6. Scope & follow-ups

- **In scope:** email **signup** confirmation only (`/auth/sign-up`).
- **Follow-up (still link-based / scanner-vulnerable):** magic-link **sign-in** (`signInWithMagicLink`) and **password-reset** emails. OAuth + recovery continue via `/auth/callback` unchanged. The `/auth/callback` `type=signup` branch becomes unused for email signup but is harmless (kept for any residual link flows).

## 7. Acceptance criteria

- [ ] E2E (prod): UI signup → OTP screen → valid code (via generateLink) → lands in app → `conversion/signup_complete` row in `user_events` for the new user; user cleaned up.
- [ ] Wrong code → distinct inline error; expired code → distinct message; resend respects a 60s cooldown.
- [ ] `checkoutIntent` + `?redirect=` preserved through OTP → post-verify lands on the right destination (checkout resumes / redirect honored).
- [ ] `user_profiles.tos_accepted_at` set after OTP verify.
- [ ] Refresh on the OTP screen recovers (email restored from sessionStorage), no dead-end.
- [ ] `page.tsx` stays < 400 lines; `ConfirmationSent.tsx` deleted; autoconfirm and OTP paths share one `completeSignup` helper.

## 8. Risks & mitigations

- **OTP length coupling** — the input requires exactly 6 digits, so Supabase `mailer_otp_length` MUST be 6 (set in Task 8 before the prod E2E). If Supabase emits a different length, the code won't fully enter; Supabase also rejects wrong codes regardless.
- **`verifyOtp` type version drift** → pinned `"email"` empirically; E2E would catch a regression.
- **Resend rate limits** → client cooldown + friendly error; never blocks the verify field.
- **State loss mid-OTP** → sessionStorage persistence + restore.
- **Other link flows remain scanner-vulnerable** → explicit follow-up, documented.

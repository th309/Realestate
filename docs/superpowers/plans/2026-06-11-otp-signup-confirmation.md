# Email-OTP Signup Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scanner-fragile magic-link signup confirmation with an 8-digit email OTP code the user types, so email signups actually complete (`signup_complete` fires) instead of dying at "Verification link expired."

**Architecture:** Add `verifySignupOtp`/`resendSignupOtp` wrappers to `AuthContext`; extract the post-signup side-effects into one shared `completeSignup` helper used by both the autoconfirm and OTP-verify paths (DRY); add an `OtpConfirmation` component the sign-up page shows instead of the old "check your email" screen; verify via `verifyOtp({type:"email"})` (pinned empirically) and resend via `resend({type:"signup"})`. E2E reads a valid OTP through `admin.generateLink` (no inbox).

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Tailwind/M3, Supabase JS (`@supabase/supabase-js`), Playwright.

**Spec:** `docs/superpowers/specs/2026-06-11-otp-signup-confirmation-design.md`

**Branch/working-dir policy:** Work on `develop` in `D:\Projects\rei-platform`. Commit per task. Do NOT push or deploy — the user pushes/merges to `main` and edits the Supabase template.

**Per-task verification:** after each code task run `npm run lint` (eslint on the changed files) and `npx tsc --noEmit -p tsconfig.json` (ignore the 4 pre-existing repo errors in untouched files: `DirectionalBarsTooltip`, `newsletter`, `embeds`, `app/page.tsx`). UI behavior is verified by the prod Playwright E2E (Task 8), not mocked unit tests (`feedback_no-mock-tests-use-live-data`). NOTE the local `next dev --webpack` stale-client-bundle gotcha (`reference_next-dev-stale-client-bundle`) — do not trust local hydrated DOM; SSR curl or the prod build is ground truth.

---

## File Structure

| File                                                      | Change | Responsibility                                                                                                |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `packages/frontend/lib/auth/AuthContext.tsx`              | Modify | Add `verifySignupOtp`, `resendSignupOtp`; have `signUp` also return `user` (for already-registered detection) |
| `packages/frontend/app/auth/sign-up/complete-signup.ts`   | Create | Shared post-signup side-effects → returns destination                                                         |
| `packages/frontend/app/auth/sign-up/OtpConfirmation.tsx`  | Create | 8-digit OTP entry UI (verify + resend cooldown + errors)                                                      |
| `packages/frontend/app/auth/sign-up/page.tsx`             | Modify | Use `completeSignup` in both paths; show OTP screen; sessionStorage restore; already-registered handling      |
| `packages/frontend/app/auth/sign-up/ConfirmationSent.tsx` | Delete | Obsolete "check your email" link screen                                                                       |
| `packages/frontend/tests/e2e/helpers/supabase-admin.ts`   | Modify | Add `getSignupOtp(email, password)` via `generateLink`                                                        |
| `packages/frontend/tests/e2e/signup-chain.spec.ts`        | Modify | Rewrite email test to OTP flow + add wrong-code test                                                          |

---

## Task 1: AuthContext — OTP verify/resend wrappers + signUp returns user

**Files:**

- Modify: `packages/frontend/lib/auth/AuthContext.tsx`

- [ ] **Step 1: Extend the context type**

In the `AuthContextValue` interface, change the `signUp` signature to also return `user`, and add the two OTP methods. Replace the current `signUp` type member (lines ~21-25) with:

```ts
signUp: (email: string, password: string, redirectTo?: string) =>
  Promise<{
    error: AuthError | null;
    session: Session | null;
    user: User | null;
  }>;
verifySignupOtp: (email: string, token: string) =>
  Promise<{ error: AuthError | null; session: Session | null }>;
resendSignupOtp: (email: string) => Promise<{ error: AuthError | null }>;
```

- [ ] **Step 2: Return `user` from the `signUp` implementation**

Change the `signUp` callback's return (line ~94) from:

```ts
return { error, session: data?.session ?? null };
```

to:

```ts
return {
  error,
  session: data?.session ?? null,
  user: data?.user ?? null,
};
```

- [ ] **Step 3: Add the two OTP callbacks**

Immediately after the `signUp` `useCallback` (after line ~97) add:

```ts
const verifySignupOtp = useCallback(async (email: string, token: string) => {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  return { error, session: data?.session ?? null };
}, []);

const resendSignupOtp = useCallback(async (email: string) => {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  return { error };
}, []);
```

- [ ] **Step 4: Expose them in the context value + memo deps**

In the `useMemo` value object (after `signUp,` at line ~137) add `verifySignupOtp,` and `resendSignupOtp,`. In the deps array (after `signUp,` at line ~150) add the same two identifiers. Both the object and the deps array must include them.

- [ ] **Step 5: Verify**

```bash
cd packages/frontend && npx eslint lib/auth/AuthContext.tsx && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors in `AuthContext.tsx` (the 4 pre-existing unrelated errors may still print).

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/lib/auth/AuthContext.tsx
git commit -m "feat(auth): add verifySignupOtp/resendSignupOtp + return user from signUp"
```

---

## Task 2: Shared `completeSignup` helper (DRY)

**Files:**

- Create: `packages/frontend/app/auth/sign-up/complete-signup.ts`

- [ ] **Step 1: Write the helper**

This is the autoconfirm `if (session)` block extracted verbatim, parameterized, returning the destination (caller navigates).

```ts
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackEvent, flush } from "@/lib/analytics/tracker";
import { readAttributionCookie } from "./helpers";

/**
 * Runs every post-signup side-effect once a session exists (autoconfirm OR
 * OTP-verified) and returns where to navigate. Caller does router.push().
 */
export async function completeSignup(
  session: Session,
  opts: {
    email: string;
    explicitRedirect: string | null;
    redirectTo: string;
    method: string;
  },
): Promise<string> {
  trackEvent("conversion.signup_complete", { method: opts.method });
  flush(); // send queued events before navigation unmounts the page

  const supabase = createSupabaseBrowserClient();
  await supabase.from("user_profiles").upsert(
    {
      id: session.user.id,
      email: session.user.email,
      full_name:
        (session.user.user_metadata?.full_name as string) ||
        opts.email.split("@")[0],
      tos_accepted_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  // Fire-and-forget welcome email
  fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});

  // Fire-and-forget content-pipeline attribution forward
  const attributionCookie = readAttributionCookie();
  if (attributionCookie) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    fetch(`${apiUrl}/api/auth-hooks/on-user-created`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.user.id,
        cookieValue: attributionCookie,
        tierAtSignup: "free",
      }),
      keepalive: true,
    }).catch(() => {});
  }

  // Honor a pending purchase intent: resume checkout on /pricing, else normal.
  const hasCheckoutIntent =
    typeof window !== "undefined" &&
    !!window.sessionStorage.getItem("checkoutIntent");
  return hasCheckoutIntent && opts.explicitRedirect
    ? opts.explicitRedirect
    : opts.redirectTo;
}
```

- [ ] **Step 2: Verify**

```bash
cd packages/frontend && npx eslint app/auth/sign-up/complete-signup.ts && npx tsc --noEmit -p tsconfig.json
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/auth/sign-up/complete-signup.ts
git commit -m "refactor(signup): extract shared completeSignup post-signup helper"
```

---

## Task 3: `OtpConfirmation` component

**Files:**

- Create: `packages/frontend/app/auth/sign-up/OtpConfirmation.tsx`

The single 8-digit field (tolerant 6–8), verify, resend with 60s cooldown, expired-vs-invalid messages, 5-attempt guard. Matches the page's M3 classes. (Optionally refine visuals later via `frontend-design`; this already reuses the established design system.)

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import { Mail, AlertCircle, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth";
import { trackEvent, flush } from "@/lib/analytics/tracker";

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function friendlyOtpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("expired")) {
    return "That code has expired. Request a new one below.";
  }
  if (m.includes("invalid") || m.includes("token") || m.includes("otp")) {
    return "That code didn't match. Check it and try again.";
  }
  return message;
}

export function OtpConfirmation({
  email,
  onVerified,
}: {
  email: string;
  onVerified: (session: Session) => void | Promise<void>;
}) {
  const { verifySignupOtp, resendSignupOtp } = useAuth();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const canVerify =
    code.length >= 6 &&
    code.length <= 8 &&
    !verifying &&
    attempts < MAX_ATTEMPTS;

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!canVerify) return;
    setVerifying(true);
    setError(null);
    trackEvent("conversion.signup_otp_attempt", {});
    const { error: vErr, session } = await verifySignupOtp(email, code);
    if (vErr || !session) {
      const next = attempts + 1;
      setAttempts(next);
      setError(
        next >= MAX_ATTEMPTS
          ? "Too many attempts. Request a new code below."
          : friendlyOtpError(vErr?.message || "Verification failed"),
      );
      setVerifying(false);
      return;
    }
    trackEvent("conversion.signup_otp_verified", {});
    flush();
    await onVerified(session);
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    const { error: rErr } = await resendSignupOtp(email);
    setResending(false);
    if (rErr) {
      setError(
        rErr.message.toLowerCase().includes("rate")
          ? "Please wait a moment before requesting another code."
          : rErr.message,
      );
      return;
    }
    setAttempts(0);
    setCode("");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    inputRef.current?.focus();
  };

  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Mail className="w-6 h-6 text-primary" />
      </div>
      <h2 className="text-lg font-medium text-on-surface mb-1">
        Enter your code
      </h2>
      <p className="text-sm text-on-surface-variant mb-6">
        We sent a code to{" "}
        <span className="font-medium text-on-surface">{email}</span>. Enter it
        below to activate your account.
      </p>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error text-left">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={8}
          placeholder="00000000"
          aria-label="Verification code"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
          }
          disabled={verifying}
          className="w-full text-center font-mono text-lg tracking-[0.5em] py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canVerify}
          className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
          Verify
        </button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || resending}
        className="mt-5 text-sm text-primary hover:text-primary/80 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {cooldown > 0
          ? `Resend code in ${cooldown}s`
          : resending
            ? "Sending..."
            : "Resend code"}
      </button>

      <p className="mt-6 text-sm text-on-surface-variant">
        <Link
          href="/auth/sign-in"
          className="text-primary hover:text-primary/80 font-medium"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd packages/frontend && npx eslint app/auth/sign-up/OtpConfirmation.tsx && npx tsc --noEmit -p tsconfig.json
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/auth/sign-up/OtpConfirmation.tsx
git commit -m "feat(signup): add OtpConfirmation 8-digit code entry component"
```

---

## Task 4: Wire the sign-up page to OTP + shared helper; delete ConfirmationSent

**Files:**

- Modify: `packages/frontend/app/auth/sign-up/page.tsx`
- Delete: `packages/frontend/app/auth/sign-up/ConfirmationSent.tsx`

- [ ] **Step 1: Swap imports**

Replace the import block lines 6-18 (lucide + helpers + the three sibling components) with:

```tsx
import { Building2, Lock, Loader2, AlertCircle, Mail } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackEvent, flush } from "@/lib/analytics/tracker";
import {
  allRequirementsMet,
  friendlyAuthError,
  getPasswordRequirements,
} from "./helpers";
import { PasswordStrength } from "./PasswordStrength";
import { GoogleIcon } from "./GoogleIcon";
import { OtpConfirmation } from "./OtpConfirmation";
import { completeSignup } from "./complete-signup";
```

(Removed only: `ConfirmationSent` (deleted) and `readAttributionCookie` (now used inside `completeSignup`). **KEPT `createSupabaseBrowserClient`** — `handleOAuth` still uses it (line ~164). Kept `Mail`/`AlertCircle`/`Building2`/`Lock`/`Loader2` — still used by the form. `Suspense, useState, useEffect, useRef, FormEvent` from react and `Link`, `useRouter`, `useSearchParams` stay as-is on lines 3-5.)

- [ ] **Step 2: Rename the pending-state flag + add OTP-restore effect**

Replace line 45:

```tsx
const [confirmationSent, setConfirmationSent] = useState(false);
```

with:

```tsx
const [awaitingOtp, setAwaitingOtp] = useState(false);
```

Then, immediately after the existing `signup_start` tracking effect (after line 53), add a restore effect so a refresh on the OTP screen recovers:

```tsx
// Restore the OTP screen after a refresh: the pending email is persisted in
// sessionStorage when we transition to it.
useEffect(() => {
  try {
    const raw = window.sessionStorage.getItem("piq_signup_pending");
    if (raw) {
      const parsed = JSON.parse(raw) as { email?: string };
      if (parsed.email) {
        setEmail(parsed.email);
        setAwaitingOtp(true);
      }
    }
  } catch {
    /* ignore */
  }
}, []);
```

- [ ] **Step 3: Replace the autoconfirm block + confirmation branch in `handleSignUp`**

Replace the entire block from line 91 (`// With autoconfirm enabled...`) through line 151 (`setLoading(false);` of the confirmation branch) — i.e., everything between the `if (authError) {...}` block and the closing `};` of `handleSignUp` — with:

```tsx
    // Autoconfirm path (rare in prod): a session is returned immediately.
    if (session) {
      const destination = await completeSignup(session, {
        email,
        explicitRedirect,
        redirectTo,
        method: "email",
      });
      router.push(destination);
      return;
    }

    // Already-registered (confirmed) users get an obfuscated user with no
    // identities and no session — route them to sign in, don't show OTP.
    if (user && (user.identities?.length ?? 0) === 0) {
      setError("This email is already registered. Please sign in instead.");
      setLoading(false);
      return;
    }

    // Brand-new OR existing-unconfirmed: Supabase sent an 8-digit OTP code.
    // Persist the email so a refresh on the OTP screen recovers, record the
    // funnel stage, and show the code-entry screen.
    try {
      window.sessionStorage.setItem(
        "piq_signup_pending",
        JSON.stringify({ email }),
      );
    } catch {
      /* ignore */
    }
    trackEvent("conversion.signup_pending_confirmation", { method: "email" });
    flush();
    setAwaitingOtp(true);
    setLoading(false);
  };
```

- [ ] **Step 4: Destructure `user` from `signUp`**

Change the `signUp` call (lines 79-83) from:

```tsx
const { error: authError, session } = await signUp(email, password, redirectTo);
```

to:

```tsx
const {
  error: authError,
  session,
  user,
} = await signUp(email, password, redirectTo);
```

- [ ] **Step 5: Add the OTP-verified handler**

Immediately after `handleSignUp` (after its closing `};`, before `handleOAuth`) add:

```tsx
const handleOtpVerified = async (session: Session) => {
  try {
    window.sessionStorage.removeItem("piq_signup_pending");
  } catch {
    /* ignore */
  }
  const destination = await completeSignup(session, {
    email,
    explicitRedirect,
    redirectTo,
    method: "email",
  });
  router.push(destination);
};
```

- [ ] **Step 6: Swap the render branch**

Replace lines 190-193 (the `{confirmationSent ? (<ConfirmationSent .../>) : (` opening) with:

```tsx
        {/* OTP code entry (post-signup) */}
        {awaitingOtp ? (
          <OtpConfirmation email={email} onVerified={handleOtpVerified} />
        ) : (
```

(The `) : (` and the closing `)}` at line 365 stay; only the condition + the OTP branch content change.)

- [ ] **Step 7: Delete the obsolete component**

```bash
git rm packages/frontend/app/auth/sign-up/ConfirmationSent.tsx
```

- [ ] **Step 8: Verify (lint + typecheck + line count)**

```bash
cd packages/frontend && npx eslint app/auth/sign-up/page.tsx && npx tsc --noEmit -p tsconfig.json
```

Expected: clean; confirm `page.tsx` is well under 400 lines (the autoconfirm block shrank). SSR render check: `Invoke-WebRequest http://localhost:3000/auth/sign-up` still shows the form (ground truth is SSR, not hydrated DOM — local dev bundle may be stale per the reference note).

- [ ] **Step 9: Commit**

```bash
git add packages/frontend/app/auth/sign-up/page.tsx
git commit -m "feat(signup): OTP code confirmation flow; shared completeSignup; delete ConfirmationSent"
```

---

## Task 5: E2E helper — read a valid OTP without an inbox

**Files:**

- Modify: `packages/frontend/tests/e2e/helpers/supabase-admin.ts`

- [ ] **Step 1: Add `getSignupOtp`**

Append this exported function (it uses the existing `adminClient()` in the file — do not redefine it):

```ts
/**
 * Returns a VALID 8-digit signup OTP for `email` via the admin generateLink
 * API. Re-mints for an existing unconfirmed user (verified), so call it AFTER
 * the UI signup so the returned code is the current one. No inbox needed.
 */
export async function getSignupOtp(
  email: string,
  password: string,
): Promise<string | null> {
  const supabase = adminClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
  });
  if (error) throw error;
  const props = data?.properties as { email_otp?: string } | undefined;
  return props?.email_otp ?? null;
}
```

- [ ] **Step 2: Verify**

```bash
cd packages/frontend && npx eslint tests/e2e/helpers/supabase-admin.ts && npx tsc --noEmit -p tsconfig.json
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/tests/e2e/helpers/supabase-admin.ts
git commit -m "test(e2e): add getSignupOtp helper (admin generateLink, no inbox)"
```

---

## Task 6: E2E — OTP completion + wrong-code tests

**Files:**

- Modify: `packages/frontend/tests/e2e/signup-chain.spec.ts`

- [ ] **Step 1: Update the imports**

Ensure the helper import line includes `getSignupOtp`:

```ts
import {
  findUserIdByEmail,
  hasSignupCompleteEvent,
  deleteUser,
  getSignupOtp,
} from "./helpers/supabase-admin";
```

- [ ] **Step 2: Replace the email-signup test**

Replace the existing `test("completes email signup from homepage and logs signup_complete", ...)` block in full with these two tests:

```ts
test("email signup completes via OTP and logs signup_complete", async ({
  page,
}) => {
  const email = `piq-e2e-${Date.now()}@example.com`;
  const password = `Zq9${Date.now()}Lr`;
  try {
    await page.goto("/auth/sign-up");
    await page.getByLabel(/^email$/i).fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#confirm-password").fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /create account/i }).click();

    // OTP entry screen
    await expect(
      page.getByRole("heading", { name: /enter your code/i }),
    ).toBeVisible({ timeout: 20_000 });

    // Read a valid code (re-mints for the existing unconfirmed user).
    const otp = await getSignupOtp(email, password);
    expect(otp).toBeTruthy();
    await page
      .locator('input[autocomplete="one-time-code"]')
      .fill(otp as string);
    await page.getByRole("button", { name: /^verify$/i }).click();

    // Lands in the app (tour/map, or pricing if a checkout intent existed).
    await page.waitForURL(/\/(tour|map|pricing)/, { timeout: 25_000 });

    const userId = await findUserIdByEmail(email);
    expect(userId).toBeTruthy();
    await expect
      .poll(() => hasSignupCompleteEvent(userId as string), {
        timeout: 20_000,
      })
      .toBe(true);
  } finally {
    const id = await findUserIdByEmail(email);
    if (id) await deleteUser(id);
  }
});

test("wrong OTP shows an inline error", async ({ page }) => {
  const email = `piq-e2e-${Date.now()}@example.com`;
  const password = `Zq9${Date.now()}Lr`;
  try {
    await page.goto("/auth/sign-up");
    await page.getByLabel(/^email$/i).fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#confirm-password").fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(
      page.getByRole("heading", { name: /enter your code/i }),
    ).toBeVisible({ timeout: 20_000 });

    await page.locator('input[autocomplete="one-time-code"]').fill("00000000");
    await page.getByRole("button", { name: /^verify$/i }).click();
    await expect(page.getByText(/didn't match|expired|too many/i)).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    const id = await findUserIdByEmail(email);
    if (id) await deleteUser(id);
  }
});
```

- [ ] **Step 3: Verify (lint only — do not run Playwright yet)**

```bash
cd packages/frontend && npx eslint tests/e2e/signup-chain.spec.ts
```

Expected: clean. (The E2E runs against prod in Task 8 after the template change + deploy.)

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/tests/e2e/signup-chain.spec.ts
git commit -m "test(e2e): signup completes via OTP; wrong-code error path"
```

---

## Task 7: Full local typecheck/build sanity

**Files:** none (verification).

- [ ] **Step 1: Authoritative typecheck of all changed files**

```bash
cd packages/frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | findstr /C:"auth/sign-up" /C:"lib/auth/AuthContext" /C:"helpers/supabase-admin" /C:"signup-chain"
```

Expected: NO lines (zero type errors in our files). The 4 pre-existing repo errors are unrelated.

- [ ] **Step 2: Confirm no dangling references to the deleted file**

```bash
cd packages/frontend && findstr /S /C:"ConfirmationSent" app tests
```

Expected: no matches (all references removed).

---

## Task 8: Supabase template change, deploy, prod E2E acceptance

**Files:** none (gated on user action).

- [ ] **Step 1: Hand off the Supabase template change**

Ask the user to update **Auth → Emails → "Confirm signup"** to the `{{ .Token }}` template from spec §3 (remove `{{ .ConfirmationURL }}`), keeping "Confirm email" ON. The link MUST be removed (shared token).

- [ ] **Step 2: Push + deploy**

User pushes `develop` and merges to `main` (Railway prod deploy). Confirm the deploy reaches terminal SUCCESS with the new commit (don't trust 200s — blue-green).

- [ ] **Step 3: Run the prod E2E**

```bash
cd packages/frontend && PLAYWRIGHT_BASE_URL=https://www.propertyiq.app npx playwright test signup-chain --project=chromium --no-deps --reporter=list
```

Expected: all pass, including "email signup completes via OTP and logs signup_complete" and "wrong OTP shows an inline error".

- [ ] **Step 4: Confirm cleanup + funnel**

```bash
cd packages/frontend && node -r dotenv/config tests/e2e/helpers/cleanup-test-users.mjs dotenv_config_path=.env.local
```

Expected: 0 leftover `piq-e2e-*` users. Optionally re-query the 30-day `conversion/signup_complete` count to confirm it is now non-zero after a real signup.

- [ ] **Step 5: Mark acceptance criteria** (spec §7) with evidence (Playwright report + DB query output).

---

## Notes / deferred follow-ups

- **Magic-link sign-in** (`signInWithMagicLink`) and **password-reset** emails still use scanner-vulnerable links — separate follow-up (convert to OTP or scanner-proof page). OAuth + recovery via `/auth/callback` unchanged.
- The `/auth/callback` `type=signup` branch is now unused for email signup but harmless (kept for any residual link flows).
- New funnel events added: `conversion.signup_otp_attempt`, `conversion.signup_otp_verified` (visibility into the OTP step).

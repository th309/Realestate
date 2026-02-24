# ToS Acceptance at Signup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Require users to accept the Terms of Service before creating an account, and record the acceptance timestamp in `user_profiles`.

**Architecture:** Frontend checkbox gates both email/password and OAuth signup buttons. ToS acceptance is persisted via Supabase user metadata (email flow) or callback query param (OAuth flow), with the auth callback route writing `tos_accepted_at` to `user_profiles` for both paths.

**Tech Stack:** Next.js App Router, Supabase Auth, PostgreSQL

**Design doc:** `docs/plans/2026-02-24-tos-acceptance-at-signup-design.md`

---

### Task 1: Add `tos_accepted_at` Column to `user_profiles`

**Files:**
- Create: `scripts/migrations/104-add-tos-accepted-at.sql`

**Step 1: Write the migration**

```sql
-- Migration: Add ToS acceptance tracking to user_profiles
-- This column records when a user accepted the Terms of Service during signup.
-- Nullable: existing users will have NULL (no re-acceptance required).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.tos_accepted_at IS
  'Timestamp when user accepted the Terms of Service during signup';
```

**Step 2: Run the migration against Supabase**

Run the migration via the Supabase SQL Editor or CLI. Verify:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'tos_accepted_at';
```

Expected: one row with `data_type = 'timestamp with time zone'`, `is_nullable = 'YES'`.

**Step 3: Commit**

```bash
git add scripts/migrations/104-add-tos-accepted-at.sql
git commit -m "feat: add tos_accepted_at column to user_profiles"
```

---

### Task 2: Pass ToS Acceptance Through `signUp()` Metadata

**Files:**
- Modify: `packages/frontend/lib/auth/AuthContext.tsx:51-58`

**Step 1: Update the `signUp` callback to include `tos_accepted_at` in user metadata**

In `AuthContext.tsx`, change the `signUp` callback (lines 51-58) from:

```typescript
const signUp = useCallback(async (email: string, password: string) => {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  return { error };
}, []);
```

To:

```typescript
const signUp = useCallback(async (email: string, password: string) => {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: { tos_accepted_at: new Date().toISOString() },
    },
  });
  return { error };
}, []);
```

This stores `tos_accepted_at` in `auth.users.raw_user_meta_data` so the auth callback can read it later after email confirmation.

**Step 2: Verify the app builds**

Run: `cd packages/frontend && npx next build 2>&1 | tail -5`

Expected: build succeeds with no errors.

**Step 3: Commit**

```bash
git add packages/frontend/lib/auth/AuthContext.tsx
git commit -m "feat: include tos_accepted_at in signUp user metadata"
```

---

### Task 3: Pass ToS Acceptance Through OAuth Callback URL

**Files:**
- Modify: `packages/frontend/app/auth/sign-up/page.tsx:84-94`

**Step 1: Update `handleOAuth` to append `tos=1` to the callback URL**

In `sign-up/page.tsx`, the `handleOAuth` function (lines 84-94) calls `signInWithOAuth(provider, redirectTo)`. But this uses the shared `signInWithOAuth` from AuthContext, which builds the callback URL without a `tos` param.

Instead of modifying the shared `signInWithOAuth`, call Supabase directly in the sign-up page to include the `tos=1` param. Replace lines 84-94:

```typescript
const handleOAuth = async (provider: 'google') => {
  setLoading(true);
  setError(null);

  const supabase = createSupabaseBrowserClient();
  const callbackUrl = `${window.location.origin}/auth/callback?tos=1&next=${encodeURIComponent(redirectTo)}`;
  const { error: authError } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl },
  });

  if (authError) {
    setError(authError.message);
    setLoading(false);
  }
};
```

Add the import for `createSupabaseBrowserClient` at the top of the file:

```typescript
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
```

**Step 2: Verify the app builds**

Run: `cd packages/frontend && npx next build 2>&1 | tail -5`

Expected: build succeeds.

**Step 3: Commit**

```bash
git add packages/frontend/app/auth/sign-up/page.tsx
git commit -m "feat: pass tos=1 through OAuth callback URL on signup"
```

---

### Task 4: Record ToS Acceptance in Auth Callback

**Files:**
- Modify: `packages/frontend/app/auth/callback/route.ts`

**Step 1: Update the callback to write `tos_accepted_at` to `user_profiles`**

Replace the entire file content:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';
  const tosAccepted = searchParams.get('tos') === '1';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Record ToS acceptance for new signups
      await recordTosAcceptance(supabase, data.user, tosAccepted);

      if (type === 'recovery') {
        return NextResponse.redirect(
          `${origin}/account?tab=profile&reset=true`
        );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code exchange failed or no code provided
  return NextResponse.redirect(
    `${origin}/auth/sign-in?error=auth_callback_failed`
  );
}

/**
 * Write tos_accepted_at to user_profiles if this is a new signup.
 *
 * Two signals indicate ToS was accepted:
 * 1. Email signup: tos_accepted_at in user_metadata (set during signUp())
 * 2. OAuth signup: tos=1 query param in callback URL
 *
 * Uses upsert so it works whether or not the user_profiles row exists yet.
 * Only writes if tos_accepted_at is currently NULL (won't overwrite).
 */
async function recordTosAcceptance(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: { id: string; user_metadata?: Record<string, unknown> } | undefined,
  tosFromParam: boolean,
) {
  if (!user) return;

  const tosFromMetadata = !!user.user_metadata?.tos_accepted_at;

  if (!tosFromParam && !tosFromMetadata) return;

  try {
    await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          tos_accepted_at: new Date().toISOString(),
        },
        { onConflict: 'id', ignoreDuplicates: false },
      )
      .match({ id: user.id })
      .is('tos_accepted_at', null);
  } catch (err) {
    // Log but don't block — the user already accepted in the UI.
    // The DB record is supplementary.
    console.error('[auth/callback] Failed to record ToS acceptance:', err);
  }
}
```

**Important note on the upsert:** The `.is('tos_accepted_at', null)` filter ensures we only write if the column is currently NULL, so returning users who sign in via OAuth won't get their timestamp overwritten.

**Step 2: Verify the app builds**

Run: `cd packages/frontend && npx next build 2>&1 | tail -5`

Expected: build succeeds.

**Step 3: Commit**

```bash
git add packages/frontend/app/auth/callback/route.ts
git commit -m "feat: record tos_accepted_at in auth callback for both signup flows"
```

---

### Task 5: Add ToS Checkbox to Sign-up Form

**Files:**
- Modify: `packages/frontend/app/auth/sign-up/page.tsx`

**Step 1: Add `tosAccepted` state**

In `SignUpContent()`, after the existing state declarations (line 53), add:

```typescript
const [tosAccepted, setTosAccepted] = useState(false);
```

**Step 2: Add early return to `handleSignUp` if ToS not accepted**

At the top of `handleSignUp` (after `e.preventDefault()`, line 58), add:

```typescript
if (!tosAccepted) {
  setError('You must accept the Terms of Service to create an account');
  return;
}
```

**Step 3: Add the checkbox between the Confirm Password field and the Submit button**

After the Confirm Password `</div>` (line 248) and before the Submit `<button>` (line 251), insert:

```tsx
{/* Terms of Service Checkbox */}
<label className="flex items-start gap-3 cursor-pointer select-none py-1">
  <input
    type="checkbox"
    checked={tosAccepted}
    onChange={(e) => setTosAccepted(e.target.checked)}
    disabled={loading}
    className="mt-0.5 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/30 accent-primary"
  />
  <span className="text-sm text-on-surface-variant leading-snug">
    I agree to the{' '}
    <a
      href="/about/terms"
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:text-primary/80 font-medium underline underline-offset-2"
      onClick={(e) => e.stopPropagation()}
    >
      Terms of Service
    </a>
  </span>
</label>
```

**Step 4: Disable both buttons when ToS is not accepted**

Update the Submit button (line 251-258) disabled condition:

```tsx
<button
  type="submit"
  disabled={loading || !tosAccepted}
  className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
>
  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
  Create Account
</button>
```

Update the Google OAuth button (line 272-297) disabled condition:

```tsx
<button
  type="button"
  onClick={() => handleOAuth('google')}
  disabled={loading || !tosAccepted}
  className="flex-1 px-4 py-2.5 bg-surface-container-high border border-outline-variant rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
>
```

**Step 5: Verify the app builds**

Run: `cd packages/frontend && npx next build 2>&1 | tail -5`

Expected: build succeeds.

**Step 6: Commit**

```bash
git add packages/frontend/app/auth/sign-up/page.tsx
git commit -m "feat: add ToS acceptance checkbox gating both signup buttons"
```

---

### Task 6: Manual Verification

**Step 1: Start the dev server**

Run: `cd packages/frontend && npm run dev`

**Step 2: Test email/password signup**

1. Navigate to `/auth/sign-up`
2. Verify the ToS checkbox is visible between password fields and the submit button
3. Verify "Create Account" button is disabled (grayed out) when checkbox is unchecked
4. Verify "Google" button is disabled when checkbox is unchecked
5. Check the checkbox — both buttons should become enabled
6. Verify the "Terms of Service" link opens `/about/terms` in a new tab
7. Fill in email/password, check the box, click "Create Account"
8. Verify success state shows "Check your email"

**Step 3: Test OAuth signup**

1. Navigate to `/auth/sign-up`
2. Check the ToS checkbox
3. Click "Google" — verify the redirect URL includes `tos=1`

**Step 4: Verify database write**

After confirming a test account, check the database:

```sql
SELECT id, email, tos_accepted_at FROM user_profiles ORDER BY created_at DESC LIMIT 5;
```

Expected: the new user's `tos_accepted_at` is populated with a recent timestamp.

**Step 5: Verify existing users unaffected**

```sql
SELECT count(*) FROM user_profiles WHERE tos_accepted_at IS NULL;
```

Expected: all pre-existing users still have `NULL`.

# ToS Acceptance at Signup — Design

**Date:** 2026-02-24
**Status:** Approved
**Scope:** Signup-only (no re-acceptance for existing users)

## Summary

Add a Terms of Service acceptance checkbox to the sign-up page that gates both
the email/password "Create Account" button and the "Continue with Google" OAuth
button. Record acceptance as a timestamp on `user_profiles`.

## Requirements

- All signup paths (email/password and Google OAuth) require explicit ToS acceptance
- The ToS checkbox must be checked before either signup action is available
- Acceptance is recorded as a `tos_accepted_at` timestamp in the database
- Existing users are not affected (no re-acceptance flow)
- No new backend endpoints required

## Database Change

```sql
ALTER TABLE user_profiles
  ADD COLUMN tos_accepted_at TIMESTAMPTZ;
```

- Nullable — existing users will have `NULL`, which is fine
- No default value
- No new RLS policy needed — existing "Users can update own profile" covers writes

## Sign-up Page Changes

**File:** `packages/frontend/app/auth/sign-up/page.tsx`

- Add `tosAccepted` boolean state (default `false`)
- Add an M3-styled checkbox between the password fields and the submit button
- Label: `I agree to the Terms of Service` (linked to `/about/terms`, opens in new tab)
- Both "Create Account" and "Continue with Google" buttons are `disabled` until the
  checkbox is checked
- No changes to the sign-in page — ToS is a signup concern only

## Recording Acceptance

Both signup flows converge at the auth callback route for the final DB write.

### Email/Password Flow

1. User checks ToS checkbox on the sign-up form
2. `signUp(email, password)` called with user metadata:
   `options.data: { tos_accepted_at: new Date().toISOString() }`
3. Supabase stores this in `auth.users.raw_user_meta_data`
4. User sees "Check your email" confirmation
5. User clicks confirmation link → `/auth/callback?code=...`
6. Callback exchanges code for session
7. Callback reads `user.user_metadata.tos_accepted_at` and upserts to
   `user_profiles.tos_accepted_at`

### Google OAuth Flow

1. User checks ToS checkbox on the sign-up form
2. User clicks Google button → OAuth redirect includes `tos=1` in the callback URL:
   `/auth/callback?next=/dashboard&tos=1`
3. Google OAuth completes → redirects to callback with `tos=1` param
4. Callback exchanges code for session
5. Callback sees `tos=1` param → upserts `tos_accepted_at = NOW()` to `user_profiles`

### Auth Callback Changes

**File:** `packages/frontend/app/auth/callback/route.ts`

After exchanging the code for a session, add logic to:

1. Check if `tos=1` query param exists (OAuth path) OR if
   `user.user_metadata.tos_accepted_at` exists (email path)
2. If either is present, upsert into `user_profiles`:
   ```sql
   INSERT INTO user_profiles (id, tos_accepted_at)
   VALUES ($userId, NOW())
   ON CONFLICT (id) DO UPDATE SET tos_accepted_at = NOW()
   WHERE user_profiles.tos_accepted_at IS NULL;
   ```
3. Use the server-side Supabase client (already available in the callback)

## Error Handling

- **`user_profiles` row doesn't exist:** The upsert handles this — creates the row
  with the user's ID and `tos_accepted_at`
- **DB write fails:** Log the error, don't block the redirect. The legal requirement
  was met when they checked the box; the DB record is supplementary.
- **Existing users:** `tos_accepted_at` stays `NULL`. No middleware enforcement.
- **Checkbox bypass:** Frontend-only enforcement. Acceptable risk for signup-only scope.

## Files Modified

| File | Change |
|------|--------|
| `packages/frontend/app/auth/sign-up/page.tsx` | Add ToS checkbox, gate buttons |
| `packages/frontend/app/auth/callback/route.ts` | Write `tos_accepted_at` after session exchange |
| `packages/frontend/lib/auth/AuthContext.tsx` | Pass `tos_accepted_at` in signUp metadata |
| SQL migration | Add `tos_accepted_at` column to `user_profiles` |

## Out of Scope

- Re-acceptance flow for terms updates
- Versioned terms tracking
- Backend enforcement / middleware blocking
- Sign-in page changes

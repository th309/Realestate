# Auth Pages & Account Profile Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build complete authentication flow (sign-in, sign-up, password reset with 5 auth methods) and a unified tabbed account profile page (Profile, Subscription, Activity, Support).

**Architecture:** Supabase Auth handles all authentication (email/password, magic link, passkey, OAuth). A new `useAuth` hook wraps `supabase.auth` for the frontend. The account page is a single `/account` route with client-side tabs. All data fetching goes through `@/lib/data`. Existing components (WatchlistDashboard, AlertFeed) are reused in the Activity tab.

**Tech Stack:** Supabase Auth + SSR, Next.js 16 app router, React 19, TanStack Query, Tailwind CSS (MD3 tokens), Playwright E2E testing.

---

## Task 1: Auth Hook & Context

Create a `useAuth` hook that wraps Supabase Auth and provides user state, sign-in/out methods, and session management to the entire app.

**Files:**
- Create: `packages/frontend/lib/auth/useAuth.ts`
- Create: `packages/frontend/lib/auth/AuthContext.tsx`
- Create: `packages/frontend/lib/auth/index.ts`
- Modify: `packages/frontend/app/providers.tsx`

**Step 1: Create the auth hook**

Create `packages/frontend/lib/auth/useAuth.ts`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuthState() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, loading: false });
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState({ user: session?.user ?? null, session, loading: false });
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
```

**Step 2: Create the auth context**

Create `packages/frontend/lib/auth/AuthContext.tsx`:

```typescript
'use client';

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuthState } from './useAuth';
import type { User, Session, AuthError } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: 'google' | 'apple' | 'github') => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  updateProfile: (data: { display_name?: string; avatar_url?: string }) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, session, loading } = useAuthState();

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error };
  }, []);

  const signInWithOAuth = useCallback(async (provider: 'google' | 'apple' | 'github') => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    return { error };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  }, []);

  const updateProfile = useCallback(async (data: { display_name?: string; avatar_url?: string }) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      data: { display_name: data.display_name, avatar_url: data.avatar_url },
    });
    return { error };
  }, []);

  const value = useMemo(() => ({
    user, session, loading,
    signInWithPassword, signInWithMagicLink, signInWithOAuth,
    signUp, signOut, resetPassword, updatePassword, updateProfile,
  }), [user, session, loading, signInWithPassword, signInWithMagicLink, signInWithOAuth, signUp, signOut, resetPassword, updatePassword, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

**Step 3: Create the barrel export**

Create `packages/frontend/lib/auth/index.ts`:

```typescript
export { AuthProvider, useAuth } from './AuthContext';
export type { AuthState } from './useAuth';
```

**Step 4: Wire AuthProvider into app providers**

Modify `packages/frontend/app/providers.tsx` — wrap children with `<AuthProvider>` inside `QueryClientProvider` but outside `EntitlementsProvider`:

```typescript
import { AuthProvider } from '@/lib/auth';

// In the Providers component return:
return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <EntitlementsProvider>
        {children}
      </EntitlementsProvider>
    </AuthProvider>
  </QueryClientProvider>
);
```

**Step 5: Commit**

```bash
git add packages/frontend/lib/auth/ packages/frontend/app/providers.tsx
git commit -m "feat(auth): add useAuth hook and AuthProvider context"
```

---

## Task 2: Auth Callback Route

Handle OAuth redirects, magic link callbacks, and password reset tokens.

**Files:**
- Create: `packages/frontend/app/auth/callback/route.ts`

**Step 1: Create the callback route handler**

Create `packages/frontend/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password recovery redirects to account page with password change prompt
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/account?tab=profile&reset=true`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to sign-in with error
  return NextResponse.redirect(`${origin}/auth/sign-in?error=auth_callback_failed`);
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/auth/callback/
git commit -m "feat(auth): add OAuth/magic-link callback route handler"
```

---

## Task 3: Sign-In Page

Build the sign-in page with all 5 auth methods.

**Files:**
- Create: `packages/frontend/app/auth/sign-in/page.tsx`

**Step 1: Create the sign-in page**

Create `packages/frontend/app/auth/sign-in/page.tsx`. This page includes:

- Email + password form (default)
- "Use magic link instead" toggle that swaps the password field for a "Send link" button
- OAuth buttons for Google, Apple, GitHub
- Passkey button (uses `supabase.auth.signInWithPasskey()` — note: requires Supabase project to have WebAuthn enabled)
- Error display for failed attempts
- "Forgot password?" link to `/auth/forgot-password`
- "Don't have an account? Sign up" link to `/auth/sign-up`
- Redirect param support: reads `?redirect=/some/page` from URL

**Key patterns to follow:**
- Use `'use client'` directive
- Import `useAuth` from `@/lib/auth`
- Import `useRouter, useSearchParams` from `next/navigation`
- Use MD3 token classes: `bg-surface`, `text-on-surface`, `border-outline-variant`, `bg-primary`, `text-on-primary`
- Form inputs: `px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface`
- Primary button: `w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50`
- OAuth buttons: `w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors` with provider icon
- Center layout: `min-h-screen bg-surface flex items-center justify-center`
- Card: `w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant p-8`

**Step 2: Verify the page renders**

Run: `npm run dev` in `packages/frontend` and navigate to `http://localhost:3000/auth/sign-in`. Verify the form renders with all auth options.

**Step 3: Commit**

```bash
git add packages/frontend/app/auth/sign-in/
git commit -m "feat(auth): add sign-in page with email, magic link, OAuth, and passkey"
```

---

## Task 4: Sign-Up Page

Build the registration page.

**Files:**
- Create: `packages/frontend/app/auth/sign-up/page.tsx`

**Step 1: Create the sign-up page**

Create `packages/frontend/app/auth/sign-up/page.tsx`. This page includes:

- Email + password form with password confirmation field
- Password strength indicator (min 8 chars, uppercase, lowercase, number)
- OAuth buttons (same as sign-in — creates account on first use)
- "Already have an account? Sign in" link
- Success state: "Check your email to confirm your account" message after email sign-up
- Same layout/styling patterns as the sign-in page

**Step 2: Verify the page renders**

Navigate to `http://localhost:3000/auth/sign-up`. Verify the form renders.

**Step 3: Commit**

```bash
git add packages/frontend/app/auth/sign-up/
git commit -m "feat(auth): add sign-up page with email registration and OAuth"
```

---

## Task 5: Forgot Password Page

Build the password reset request page.

**Files:**
- Create: `packages/frontend/app/auth/forgot-password/page.tsx`

**Step 1: Create the forgot password page**

Create `packages/frontend/app/auth/forgot-password/page.tsx`. This page includes:

- Email input form
- Submit calls `resetPassword(email)` from `useAuth`
- Success state: "Check your email for a password reset link" message
- "Back to sign in" link
- Same card layout as sign-in/sign-up

**Step 2: Commit**

```bash
git add packages/frontend/app/auth/forgot-password/
git commit -m "feat(auth): add forgot-password page"
```

---

## Task 6: Update Header with Real Auth

Replace the placeholder auth state in Header with real Supabase auth.

**Files:**
- Modify: `packages/frontend/src/components/layout/Header.tsx`

**Step 1: Replace placeholder auth with useAuth hook**

In `packages/frontend/src/components/layout/Header.tsx`:

1. Remove `const [isLoggedIn, setIsLoggedIn] = useState(false);` (line ~29)
2. Add `import { useAuth } from '@/lib/auth';`
3. Add `const { user, loading, signOut } = useAuth();`
4. Replace `isLoggedIn` checks with `!!user`
5. Replace the "Log in" button `onClick` to navigate to `/auth/sign-in`
6. Replace the "Get Started" button `onClick` to navigate to `/auth/sign-up`
7. Replace the "Sign out" button `onClick` to call `signOut()` then redirect to `/`
8. Add user display: show `user.user_metadata?.display_name || user.email` in the profile dropdown
9. Update "Settings" link in dropdown to point to `/account`
10. Update "Billing" link in dropdown to point to `/account?tab=subscription`

**Step 2: Verify header behavior**

Navigate to the app. Verify:
- Unauthenticated: "Log in" and "Get Started" buttons appear
- Click "Log in" → navigates to `/auth/sign-in`
- After sign-in → profile dropdown appears with user info
- Click "Sign out" → returns to unauthenticated state

**Step 3: Commit**

```bash
git add packages/frontend/src/components/layout/Header.tsx
git commit -m "feat(auth): wire Header to real Supabase auth via useAuth"
```

---

## Task 7: Update Middleware for Route Protection

Extend middleware to protect account routes and refresh auth sessions.

**Files:**
- Modify: `packages/frontend/middleware.ts`

**Step 1: Update middleware**

Modify `packages/frontend/middleware.ts` to:

1. Import `createServerClient` from `@supabase/ssr` and `cookies` helpers
2. On every request, refresh the Supabase session cookie (prevents expiry)
3. For protected routes (`/account`, `/dashboard`, `/alerts`, `/reports`), check for a valid session
4. If no session on protected route, redirect to `/auth/sign-in?redirect={originalPath}`
5. For auth routes (`/auth/sign-in`, `/auth/sign-up`), if already authenticated, redirect to `/dashboard`
6. Update the `matcher` to include all relevant routes

**Step 2: Verify protection**

- Navigate to `/account` while logged out → redirected to `/auth/sign-in?redirect=/account`
- Sign in → redirected back to `/account`
- Navigate to `/auth/sign-in` while logged in → redirected to `/dashboard`

**Step 3: Commit**

```bash
git add packages/frontend/middleware.ts
git commit -m "feat(auth): add session refresh and route protection to middleware"
```

---

## Task 8: Account Page Shell with Tabs

Build the account page with tab navigation infrastructure.

**Files:**
- Create: `packages/frontend/app/account/page.tsx`

**Step 1: Create the account page with tab navigation**

Create `packages/frontend/app/account/page.tsx`. This page includes:

- **Profile header** (always visible above tabs):
  - Avatar circle (user initials if no avatar, image if uploaded)
  - Display name + email
  - Tier badge with color: Free (gray), Pro (primary/blue), Enterprise (tertiary/purple), Admin (error/red)
  - "Member since" date from `user.created_at`
- **Tab bar** with 4 tabs: Profile, Subscription, Activity, Support
  - Read initial tab from `?tab=` URL search param (default: `profile`)
  - Update URL when switching tabs (shallow navigation via `router.replace`)
  - Active tab indicator: `border-b-2 border-primary text-primary`
  - Inactive tab: `text-on-surface-variant hover:text-on-surface`
- **Tab content area** — renders the active tab's component
- Uses `useAuth()` for user data and `useEntitlements()` for tier

Each tab will be a separate component file (Tasks 9-12).

**Imports needed:**
```typescript
import { useAuth } from '@/lib/auth';
import { useEntitlements } from '@/lib/entitlements';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
```

**Layout pattern:**
```typescript
<div className="min-h-screen bg-surface">
  <div className="max-w-4xl mx-auto px-6 py-8">
    <PageHeaderWithBreadcrumbs
      breadcrumbs={[{ label: 'Account' }]}
      title="Account"
      description="Manage your profile and settings"
      icon={<UserIcon />}
    />
    {/* Profile header card */}
    {/* Tab bar */}
    {/* Tab content */}
  </div>
</div>
```

For now, render placeholder `<div>` for each tab with the tab name.

**Step 2: Verify the page renders with tab switching**

Navigate to `/account`. Verify:
- Profile header shows user info and tier badge
- Tab bar renders 4 tabs
- Clicking tabs changes URL param and renders correct placeholder
- `/account?tab=subscription` goes directly to the Subscription tab

**Step 3: Commit**

```bash
git add packages/frontend/app/account/page.tsx
git commit -m "feat(account): add account page shell with tab navigation"
```

---

## Task 9: Profile Tab

Build the Profile tab with personal info editing, security settings, and account actions.

**Files:**
- Create: `packages/frontend/components/account/ProfileTab.tsx`

**Step 1: Create the ProfileTab component**

Create `packages/frontend/components/account/ProfileTab.tsx`. This component includes:

**Personal Info section:**
- Display name input (editable, saves via `updateProfile()` from `useAuth`)
- Email display (read-only, shown as disabled input with lock icon)
- Avatar upload: click-to-upload area, calls Supabase Storage to upload image, then `updateProfile({ avatar_url })` to save URL
  - Use `supabase.storage.from('avatars').upload(path, file)` for upload
  - Generate public URL with `supabase.storage.from('avatars').getPublicUrl(path)`
- "Save" button per field (not a single form submit)

**Security section:**
- "Change Password" — expandable form with current password, new password, confirm password fields. Calls `updatePassword()` from `useAuth`
- "Connected Accounts" — list of OAuth providers (Google, Apple, GitHub) with connect/disconnect status
  - Show which providers are linked via `user.identities` array
  - "Connect" button triggers OAuth flow
  - "Disconnect" button calls `supabase.auth.unlinkIdentity()`

**Account Actions section:**
- "Delete Account" button (red/error styling)
- Opens a confirmation modal (reuse existing Modal component at `packages/frontend/components/ui/Modal.tsx`)
- Modal explains: "This will permanently delete your account and all associated data. This action cannot be undone."
- Requires typing "DELETE" to confirm
- Calls backend endpoint to handle deletion (future implementation, for now show "Contact support to delete your account")

**Key patterns:**
- Section headers: `<h3 className="text-sm font-semibold text-on-surface mb-4">Section Name</h3>`
- Section dividers: `<div className="border-t border-outline-variant my-8" />`
- Input styling matches existing form patterns from `CreateAlertForm`
- Save buttons: `px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium`
- Success toast: brief inline "Saved!" message that fades after 2s

**Step 2: Wire ProfileTab into the account page**

Import `ProfileTab` in `packages/frontend/app/account/page.tsx` and render it when `activeTab === 'profile'`.

**Step 3: Verify profile editing**

- Change display name → save → refresh page → name persists
- Upload avatar → appears in profile header
- Change password → logs out and back in with new password

**Step 4: Commit**

```bash
git add packages/frontend/components/account/ProfileTab.tsx packages/frontend/app/account/page.tsx
git commit -m "feat(account): add Profile tab with personal info, security, and account actions"
```

---

## Task 10: Subscription Tab

Build the Subscription tab showing plan, usage meters, and plan comparison.

**Files:**
- Create: `packages/frontend/components/account/SubscriptionTab.tsx`

**Step 1: Create the SubscriptionTab component**

Create `packages/frontend/components/account/SubscriptionTab.tsx`. This component reuses patterns from the existing billing page (`packages/frontend/app/account/billing/page.tsx`) but adds more detail.

**Current Plan card** (reuse pattern from billing page):
- Tier name, price, billing cycle
- Trial badge if active with days remaining
- "Active" badge for paid subscribers

**Usage Meters section:**
- Progress bars for each limited feature, sourced from `useEntitlements().getUsage(slug)`:
  - `reports_monthly` — "Reports This Month: 3/5"
  - `ai_analysis_monthly` — "AI Analyses: 7/20"
  - Watchlist count from `useWatchlist` — "Saved Markets: 5/10"
  - Alert count from `useAlerts` — "Active Alerts: 2/5"
- Each meter: label, count/limit, progress bar
- Progress bar color: `bg-primary` normally, `bg-error` when > 80% used
- For unlimited features (limit === -1): show count with "Unlimited" label, no bar

**Plan Comparison cards:**
- 3 cards side-by-side: Free, Pro ($29/mo), Enterprise ($99/mo)
- Feature bullets per tier (static content, hardcoded like the pricing page)
- "Current" badge on the user's active tier
- "Upgrade" button on higher tiers → link to `/pricing`

**Actions:**
- Paid users: "Manage Subscription" button → calls `getBillingPortalUrl()` → redirect to Stripe portal
- Free users: "Upgrade to Pro" button → link to `/pricing`

**Imports:**
```typescript
import { useEntitlements } from '@/lib/entitlements';
import { useAuth } from '@/lib/auth';
import { getBillingPortalUrl } from '@/lib/data';
import { useWatchlist } from '@/components/analytics-assistant/persistence/useWatchlist';
import { useAlerts } from '@/lib/alerts/hooks';
```

**Step 2: Wire SubscriptionTab into the account page**

Import and render when `activeTab === 'subscription'`.

**Step 3: Verify**

- Free user sees upgrade CTAs, no Stripe portal button
- Pro user sees correct usage meters and "Manage Subscription" button
- Usage meters show real data from entitlements

**Step 4: Commit**

```bash
git add packages/frontend/components/account/SubscriptionTab.tsx packages/frontend/app/account/page.tsx
git commit -m "feat(account): add Subscription tab with plan info, usage meters, and plan comparison"
```

---

## Task 11: Activity Tab

Build the Activity tab combining Watchlist, Alerts, and Notification Preferences.

**Files:**
- Create: `packages/frontend/components/account/ActivityTab.tsx`

**Step 1: Create the ActivityTab component**

Create `packages/frontend/components/account/ActivityTab.tsx`. This component has 3 sections:

**Watchlist section:**
- Reuse `WatchlistDashboard` component from `packages/frontend/components/watchlist/WatchlistDashboard.tsx`
- Add "Remove" button on each card (the existing component links to map; add an `onRemove` callback prop or overlay a remove button)
- Show count vs limit: "5 of 10 markets saved" using `useEntitlements().getUsage('watchlist')`
- Use `useWatchlist({ userId: user.id, autoLoad: true })` from `@/components/analytics-assistant/persistence/useWatchlist`

**Alerts section:**
- Reuse `AlertFeed` component from `packages/frontend/components/alerts/AlertFeed.tsx`
- Show active alert count from `useAlerts()` hook
- Show count vs limit: "2 of 5 active alerts"
- "Manage Alerts" link to `/alerts` page
- If tier is free, show gated message with upgrade CTA (same pattern as alerts page)

**Notification Preferences section:**
- Move the toggle logic from `packages/frontend/app/account/notifications/page.tsx` into this section
- 3 toggles: weekly digest, alert emails, marketing
- Fetch from `GET /api/email/preferences` and update via `PATCH /api/email/preferences`
- Note: the existing notifications page uses direct `fetch()` — refactor to use `@/lib/data` fetchers (create new fetcher if needed)

**Imports:**
```typescript
import { useAuth } from '@/lib/auth';
import { useEntitlements } from '@/lib/entitlements';
import { WatchlistDashboard } from '@/components/watchlist';
import { useWatchlist } from '@/components/analytics-assistant/persistence/useWatchlist';
import { AlertFeed } from '@/components/alerts';
import { useAlerts, useAlertHistory } from '@/lib/alerts/hooks';
```

**Step 2: Create email preferences fetcher (if not already in data layer)**

Check if email preference functions exist in `@/lib/data`. If not, create `packages/frontend/lib/data/fetchers/email-preferences.ts`:

```typescript
import { fetchAPI, fetchAPIRaw } from './base';

export interface EmailPreferences {
  weekly_digest: boolean;
  alert_emails: boolean;
  marketing: boolean;
}

export async function fetchEmailPreferences(): Promise<EmailPreferences> {
  return fetchAPI<EmailPreferences>('/api/email/preferences');
}

export async function updateEmailPreferences(
  updates: Partial<EmailPreferences>
): Promise<void> {
  await fetchAPIRaw('/api/email/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}
```

Export from `packages/frontend/lib/data/index.ts`.

**Step 3: Wire ActivityTab into the account page**

Import and render when `activeTab === 'activity'`.

**Step 4: Verify**

- Watchlist shows saved markets with remove capability
- Alerts section shows active alerts and history
- Notification toggles save and persist on refresh

**Step 5: Commit**

```bash
git add packages/frontend/components/account/ActivityTab.tsx packages/frontend/lib/data/fetchers/email-preferences.ts packages/frontend/lib/data/index.ts packages/frontend/app/account/page.tsx
git commit -m "feat(account): add Activity tab with watchlist, alerts, and notification preferences"
```

---

## Task 12: Support Tab

Build the Support tab with a contact form.

**Files:**
- Create: `packages/frontend/components/account/SupportTab.tsx`
- Create: `packages/frontend/lib/data/fetchers/support.ts`

**Step 1: Create the support fetcher**

Create `packages/frontend/lib/data/fetchers/support.ts`:

```typescript
import { fetchAPIRaw } from './base';

export interface SupportTicket {
  issue_type: 'bug' | 'feature_request' | 'billing' | 'general';
  description: string;
  email_override?: string;
}

export async function submitSupportTicket(ticket: SupportTicket): Promise<void> {
  const res = await fetchAPIRaw('/api/support/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticket),
  });
  if (!res.ok) {
    throw new Error('Failed to submit support ticket');
  }
}
```

Export from `packages/frontend/lib/data/index.ts`.

**Step 2: Create the SupportTab component**

Create `packages/frontend/components/account/SupportTab.tsx`. This component includes:

- Issue type dropdown: Bug report, Feature request, Billing question, General question
- Description textarea (required, min 10 chars)
- Optional email override field (pre-filled with user's email)
- Submit button with loading state
- Success state: "Thanks for reaching out! We'll get back to you within 1-2 business days." with a "Submit another" button to reset
- Form validation: require issue type and description before enabling submit

**Styling:**
- Same form patterns as existing components
- Select: `px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface`
- Textarea: same styling with `min-h-[120px] resize-y`
- Submit button: primary button pattern

**Step 3: Wire SupportTab into the account page**

Import and render when `activeTab === 'support'`.

**Step 4: Commit**

```bash
git add packages/frontend/components/account/SupportTab.tsx packages/frontend/lib/data/fetchers/support.ts packages/frontend/lib/data/index.ts packages/frontend/app/account/page.tsx
git commit -m "feat(account): add Support tab with contact form"
```

---

## Task 13: Backend — Support Tickets Endpoint

Create the backend endpoint to receive support ticket submissions.

**Files:**
- Create: `packages/backend/src/support/support.controller.ts`
- Create: `packages/backend/src/support/support.service.ts`
- Create: `packages/backend/src/support/support.module.ts`
- Modify: `packages/backend/src/app.module.ts`

**Step 1: Create the support module**

Create `packages/backend/src/support/support.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
```

**Step 2: Create the support service**

Create `packages/backend/src/support/support.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface CreateTicketDto {
  userId: string;
  userEmail: string;
  issueType: string;
  description: string;
  emailOverride?: string;
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async createTicket(dto: CreateTicketDto) {
    const { data, error } = await this.supabase.getClient()
      .from('support_tickets')
      .insert({
        user_id: dto.userId,
        user_email: dto.emailOverride || dto.userEmail,
        issue_type: dto.issueType,
        description: dto.description,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create support ticket: ${error.message}`);
      throw error;
    }

    return data;
  }
}
```

**Step 3: Create the support controller**

Create `packages/backend/src/support/support.controller.ts`:

```typescript
import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { SupportService } from './support.service';

@Controller('api/support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Post('tickets')
  async createTicket(
    @Body() body: { issue_type: string; description: string; email_override?: string },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-email') userEmail: string,
  ) {
    if (!body.issue_type || !body.description) {
      throw new BadRequestException('issue_type and description are required');
    }

    await this.service.createTicket({
      userId: userId || 'anonymous',
      userEmail: userEmail || '',
      issueType: body.issue_type,
      description: body.description,
      emailOverride: body.email_override,
    });

    return { success: true };
  }
}
```

**Step 4: Register the module**

Add `SupportModule` to the imports array in `packages/backend/src/app.module.ts`.

**Step 5: Create the support_tickets table**

Apply a Supabase migration to create the table:

```sql
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('bug', 'feature_request', 'billing', 'general')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own tickets"
  ON support_tickets FOR SELECT
  USING (user_id = auth.uid()::text);
```

**Step 6: Commit**

```bash
git add packages/backend/src/support/ packages/backend/src/app.module.ts
git commit -m "feat(api): add support tickets endpoint with Supabase storage"
```

---

## Task 14: Old Route Redirects

Redirect the existing `/account/billing` and `/account/notifications` sub-pages to the unified `/account` page.

**Files:**
- Modify: `packages/frontend/app/account/billing/page.tsx`
- Modify: `packages/frontend/app/account/notifications/page.tsx`

**Step 1: Replace billing page with redirect**

Replace the contents of `packages/frontend/app/account/billing/page.tsx` with:

```typescript
import { redirect } from 'next/navigation';

export default function BillingRedirect() {
  redirect('/account?tab=subscription');
}
```

**Step 2: Replace notifications page with redirect**

Replace the contents of `packages/frontend/app/account/notifications/page.tsx` with:

```typescript
import { redirect } from 'next/navigation';

export default function NotificationsRedirect() {
  redirect('/account?tab=activity');
}
```

**Step 3: Commit**

```bash
git add packages/frontend/app/account/billing/page.tsx packages/frontend/app/account/notifications/page.tsx
git commit -m "refactor(account): redirect old billing/notifications pages to unified account page"
```

---

## Task 15: E2E Tests — Auth Flows

Build comprehensive Playwright tests for all authentication flows.

**Files:**
- Create: `packages/frontend/tests/e2e/auth-flows.spec.ts`

**Step 1: Write auth flow E2E tests**

Create `packages/frontend/tests/e2e/auth-flows.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  test.describe('Sign-In Page', () => {
    test('renders all auth options', async ({ page }) => {
      await page.goto('/auth/sign-in');
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /magic link/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /apple/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /github/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
    });

    test('shows error for invalid credentials', async ({ page }) => {
      await page.goto('/auth/sign-in');
      await page.getByLabel(/email/i).fill('invalid@test.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 10_000 });
    });

    test('successful email/password login redirects to dashboard', async ({ page }) => {
      await page.goto('/auth/sign-in');
      await page.getByLabel(/email/i).fill(process.env.TEST_FREE_USER_EMAIL || 'free@test.propertyiq.com');
      await page.getByLabel(/password/i).fill(process.env.TEST_FREE_USER_PASSWORD || 'TestPassword123!');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(/\/(dashboard|account|map)?$/, { timeout: 15_000 });
    });

    test('respects redirect param after login', async ({ page }) => {
      await page.goto('/auth/sign-in?redirect=/account');
      await page.getByLabel(/email/i).fill(process.env.TEST_FREE_USER_EMAIL || 'free@test.propertyiq.com');
      await page.getByLabel(/password/i).fill(process.env.TEST_FREE_USER_PASSWORD || 'TestPassword123!');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(/\/account/, { timeout: 15_000 });
    });
  });

  test.describe('Sign-Up Page', () => {
    test('renders registration form', async ({ page }) => {
      await page.goto('/auth/sign-up');
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/^password$/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign up|create account|get started/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    });

    test('shows password strength requirements', async ({ page }) => {
      await page.goto('/auth/sign-up');
      await page.getByLabel(/^password$/i).fill('weak');
      // Should show strength indicator feedback
      await expect(page.locator('[data-testid="password-strength"]')).toBeVisible();
    });
  });

  test.describe('Forgot Password', () => {
    test('renders reset form and shows success message', async ({ page }) => {
      await page.goto('/auth/forgot-password');
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByRole('button', { name: /send|reset/i }).click();
      await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Route Protection', () => {
    test('redirects unauthenticated user from /account to sign-in', async ({ page }) => {
      await page.goto('/account');
      await page.waitForURL(/\/auth\/sign-in/, { timeout: 10_000 });
      expect(page.url()).toContain('redirect');
    });

    test('redirects authenticated user from /auth/sign-in to dashboard', async ({ page }) => {
      // First sign in
      await page.goto('/auth/sign-in');
      await page.getByLabel(/email/i).fill(process.env.TEST_FREE_USER_EMAIL || 'free@test.propertyiq.com');
      await page.getByLabel(/password/i).fill(process.env.TEST_FREE_USER_PASSWORD || 'TestPassword123!');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(/\/(dashboard|account|map)?$/, { timeout: 15_000 });

      // Then try to visit sign-in again
      await page.goto('/auth/sign-in');
      await page.waitForURL(/\/(dashboard)/, { timeout: 10_000 });
    });
  });

  test.describe('Header Integration', () => {
    test('shows login buttons when unauthenticated', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('link', { name: /log in/i }).or(page.getByRole('button', { name: /log in/i }))).toBeVisible();
    });

    test('shows profile menu when authenticated', async ({ page }) => {
      await page.goto('/auth/sign-in');
      await page.getByLabel(/email/i).fill(process.env.TEST_FREE_USER_EMAIL || 'free@test.propertyiq.com');
      await page.getByLabel(/password/i).fill(process.env.TEST_FREE_USER_PASSWORD || 'TestPassword123!');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(/\/(dashboard|account|map)?$/, { timeout: 15_000 });
      await page.goto('/');
      await expect(page.getByTestId('user-menu').or(page.getByTestId('profile-menu'))).toBeVisible({ timeout: 10_000 });
    });
  });
});
```

**Step 2: Run the tests**

Run: `npx playwright test tests/e2e/auth-flows.spec.ts --project=chromium` from `packages/frontend`.
Expected: Tests for rendering should pass. Login tests require test user accounts in Supabase.

**Step 3: Commit**

```bash
git add packages/frontend/tests/e2e/auth-flows.spec.ts
git commit -m "test(auth): add comprehensive E2E tests for authentication flows"
```

---

## Task 16: E2E Tests — Account Page Per-Tier

Build comprehensive Playwright tests for every account page tab across all tiers.

**Files:**
- Create: `packages/frontend/tests/e2e/account-page.spec.ts`

**Step 1: Write per-tier account page tests**

Create `packages/frontend/tests/e2e/account-page.spec.ts`:

The test file should:

1. Use `test.describe.configure({ mode: 'serial' })` and `test.setTimeout(60_000)`
2. Define a helper `loginAndNavigate(page, tier, tab?)` that:
   - Signs in with the appropriate test user (or uses tier simulation via `?tier=free|pro|enterprise`)
   - Navigates to `/account?tab={tab}`
3. Test each tab for each tier:

**Profile Tab (all tiers):**
- Verify user info displays (name, email, avatar area)
- Verify display name is editable
- Verify password change form works
- Verify connected accounts section shows

**Subscription Tab:**
- **Free tier:** Verify shows "Free" plan, upgrade CTAs visible, no Stripe portal button, usage meters show correct limits
- **Pro tier:** Verify shows "Pro" plan with $29/mo, "Manage Subscription" button visible, usage meters show Pro limits (e.g., 5 reports/mo), correct features listed
- **Enterprise tier:** Verify shows "Enterprise" plan, higher limits, "Manage Subscription" button
- **Admin tier:** Verify shows "Admin" badge, no upgrade CTA, unlimited usage

**Activity Tab:**
- **Free tier:** Watchlist section shows (limited slots), alerts section shows gated message, notifications toggles work
- **Pro tier:** Watchlist shows with Pro limits, alerts section shows active alerts, all notifications toggles work
- **Enterprise tier:** Higher limits, all features accessible
- **Admin tier:** Unlimited access

**Support Tab (all tiers):**
- Verify form renders with all fields
- Submit with valid data → success message
- Submit with empty description → validation error

**Tier transitions:**
- Start as Free → verify limits → simulate upgrade to Pro → verify limits change
- Start as Pro → verify → simulate downgrade to Free → verify graceful degradation

```typescript
import { test, expect } from '@playwright/test';

// Helper to navigate with tier simulation
async function navigateWithTier(page, url: string, tier: string) {
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}tier=${tier}`);
}

test.describe('Account Page - Per Tier', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  for (const tier of ['free', 'pro', 'enterprise', 'admin']) {
    test.describe(`${tier} tier`, () => {

      test(`Profile tab renders for ${tier}`, async ({ page }) => {
        await navigateWithTier(page, '/account?tab=profile', tier);
        await expect(page.getByText(/display name|personal info/i)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(/security|password/i)).toBeVisible();
      });

      test(`Subscription tab shows correct plan for ${tier}`, async ({ page }) => {
        await navigateWithTier(page, '/account?tab=subscription', tier);
        const tierLabel = tier === 'admin' ? 'Admin' : tier.charAt(0).toUpperCase() + tier.slice(1);
        await expect(page.getByText(tierLabel)).toBeVisible({ timeout: 10_000 });

        if (tier === 'free') {
          await expect(page.getByText(/upgrade/i)).toBeVisible();
        }
        if (tier === 'pro' || tier === 'enterprise') {
          await expect(page.getByText(/manage subscription/i)).toBeVisible();
        }
      });

      test(`Subscription tab shows usage meters for ${tier}`, async ({ page }) => {
        await navigateWithTier(page, '/account?tab=subscription', tier);
        // Usage meters should be visible for all tiers
        await expect(page.getByText(/reports/i)).toBeVisible({ timeout: 10_000 });
      });

      test(`Activity tab renders for ${tier}`, async ({ page }) => {
        await navigateWithTier(page, '/account?tab=activity', tier);
        await expect(page.getByText(/watchlist|saved markets/i)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(/notification/i)).toBeVisible();

        if (tier === 'free') {
          // Alerts should be gated
          await expect(page.getByText(/pro feature|upgrade/i)).toBeVisible();
        }
      });

      test(`Support tab form works for ${tier}`, async ({ page }) => {
        await navigateWithTier(page, '/account?tab=support', tier);
        await expect(page.getByText(/issue type|report/i)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
      });
    });
  }

  test.describe('Tier Transitions', () => {
    test('Free to Pro upgrade updates usage limits', async ({ page }) => {
      // Start as free
      await navigateWithTier(page, '/account?tab=subscription', 'free');
      await expect(page.getByText(/upgrade/i)).toBeVisible({ timeout: 10_000 });

      // Switch to pro
      await navigateWithTier(page, '/account?tab=subscription', 'pro');
      await expect(page.getByText(/manage subscription/i)).toBeVisible({ timeout: 10_000 });
    });
  });
});
```

**Step 2: Run the tests**

Run: `npx playwright test tests/e2e/account-page.spec.ts --project=chromium` from `packages/frontend`.

**Step 3: Commit**

```bash
git add packages/frontend/tests/e2e/account-page.spec.ts
git commit -m "test(account): add comprehensive per-tier E2E tests for account page"
```

---

## Task 17: Final Integration & Cleanup

Wire everything together, run all tests, clean up.

**Files:**
- Modify: `packages/frontend/app/dashboard/page.tsx` — remove inline `supabase.auth.getUser()` pattern, use `useAuth()` instead
- Create: `packages/frontend/components/account/index.ts` — barrel export for all tab components

**Step 1: Update dashboard to use useAuth**

In `packages/frontend/app/dashboard/page.tsx`, replace the manual Supabase auth check:

```typescript
// BEFORE:
const [userId, setUserId] = useState<string | null>(null);
const [authLoading, setAuthLoading] = useState(true);
useEffect(() => {
  const supabase = createSupabaseBrowserClient();
  supabase.auth.getUser().then(({ data: { user } }) => { ... });
}, []);

// AFTER:
import { useAuth } from '@/lib/auth';
const { user, loading: authLoading } = useAuth();
const userId = user?.id ?? null;
```

**Step 2: Create barrel export**

Create `packages/frontend/components/account/index.ts`:

```typescript
export { ProfileTab } from './ProfileTab';
export { SubscriptionTab } from './SubscriptionTab';
export { ActivityTab } from './ActivityTab';
export { SupportTab } from './SupportTab';
```

**Step 3: Run the full test suite**

Run: `npx playwright test --project=chromium` from `packages/frontend`.
Verify all existing tests still pass alongside the new ones.

**Step 4: Commit**

```bash
git add packages/frontend/app/dashboard/page.tsx packages/frontend/components/account/index.ts
git commit -m "refactor: use useAuth hook in dashboard, add account component barrel export"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | Auth hook & context | 3 | 1 |
| 2 | Auth callback route | 1 | 0 |
| 3 | Sign-in page | 1 | 0 |
| 4 | Sign-up page | 1 | 0 |
| 5 | Forgot password page | 1 | 0 |
| 6 | Header auth integration | 0 | 1 |
| 7 | Middleware route protection | 0 | 1 |
| 8 | Account page shell + tabs | 1 | 0 |
| 9 | Profile tab | 1 | 1 |
| 10 | Subscription tab | 1 | 1 |
| 11 | Activity tab + email prefs fetcher | 2 | 2 |
| 12 | Support tab + fetcher | 2 | 1 |
| 13 | Backend support tickets | 3 | 1 |
| 14 | Old route redirects | 0 | 2 |
| 15 | E2E tests — auth flows | 1 | 0 |
| 16 | E2E tests — account page per-tier | 1 | 0 |
| 17 | Final integration & cleanup | 1 | 1 |
| **Total** | | **20 new** | **12 modified** |

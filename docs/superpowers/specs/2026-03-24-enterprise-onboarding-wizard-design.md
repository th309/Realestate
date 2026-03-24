# Enterprise Onboarding Wizard

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Frontend + minimal backend addition

## Problem

When a user is upgraded to the Enterprise tier (via admin panel, Stripe checkout, or post-sales provisioning), nothing guides them through creating an organization. They land on the regular app and hit dead ends — the "Manage Seats" header link goes to `/team` which had no page, enterprise features like API keys and embeds require an org that doesn't exist, and there's no indication that their tier changed or what they should do next.

## Solution

A state-driven onboarding system that detects `tier === "enterprise" && no org membership` and guides the user through organization setup via a 3-step wizard, with a persistent banner for users who bail out.

## Trigger Mechanism

The trigger is a **state check**, not tied to any specific upgrade path. All three upgrade methods (admin panel, Stripe self-serve, post-sales provisioning) result in the same state: `user_profiles.subscription_tier = "enterprise"` with no row in `organization_members`. The frontend detects this combination and activates onboarding.

**Detection stack:**

- `useEntitlements()` → provides `tier`
- `useMyOrg()` (new hook) → calls `GET /api/org/mine` → returns `{ slug, name, role }` or `{ slug: null }`
- `EnterpriseOnboardingGate` provider → combines both signals

## Onboarding Behavior

### First Detection (no sessionStorage flag)

Redirect to `/team/setup`. Set `piq-org-setup-seen` in sessionStorage so the redirect only fires once per browser session.

### Subsequent Visits (flag exists, still no org)

Show `OrgSetupBanner` — a full-width bar below the header on all product pages. Not dismissible. Disappears only when the user creates an org.

### Org Exists

No redirect, no banner. Normal app experience.

### Fail-Open Policy

If `fetchMyOrg()` errors out, do not redirect and do not show the banner. Never block the user due to a transient API failure.

## Wizard: `/team/setup`

Three steps, linear progression. User can navigate back to previous steps but not skip ahead.

### Step 1: Name Your Organization

- Text input for organization name
- Live slug preview below the input (auto-derived via slugify: lowercase, hyphens, no special chars)
- Slug updates as user types: "Acme Real Estate Group" → `acme-real-estate-group`
- "Create Organization" button calls `createOrganization({ name, slug })`
- On slug collision: inline error with suggested alternative (e.g., `acme-real-estate-group-1`)
- On success: advances to Step 2, org is now created in DB

### Step 2: Invite Your Team

- Header: "Your plan includes 10 seats"
- Seat usage indicator: "1 of 10 seats used" (owner counts as 1)
- Email input with "Add another" button for multiple invites
- As emails are added, counter updates: "4 of 10 seats used"
- At capacity (10 emails entered): "All seats filled — you can purchase additional seats in Billing"
- "Send Invites" button calls `inviteOrgMember()` for each email
- Per-email success/failure indicators (checkmark or error with message)
- "Skip" button available — invites are optional, user can do this later
- Failed invites don't block progression

### Step 3: What's New For You

- 4 feature cards in a grid (2x2 on desktop, stacked on mobile):
  - **Team Members** — "Manage your team, assign roles, and control access" → links to `/org/{slug}/admin/members`
  - **API Keys** — "Integrate PropertyIQ data into your own tools and dashboards" → links to `/org/{slug}/admin/api-keys`
  - **Embeddable Widgets** — "Embed scores, metrics, and maps on your website" → links to `/org/{slug}/admin/embeds`
  - **Custom Branding** — "Add your logo and colors to reports and widgets" → links to `/org/{slug}/admin/branding`
- Each card: icon + title + 1-line description + "Set up →" link
- Primary CTA: "Go to Dashboard" → `/org/{slug}/admin`

### Wizard Resume Logic

If user refreshes or returns to `/team/setup` mid-wizard:

- Check if org exists → if yes, skip to Step 2 or 3 based on state
- Step 2 is always available (can invite more people later)
- Step 3 is always available (tour is idempotent)

## Persistent Banner: `OrgSetupBanner`

Appears below the header on all pages when `tier === "enterprise" && hasOrg === false`.

- Full-width, amber/yellow surface color
- Text: "You're on the Enterprise plan — set up your organization to unlock team features, API access, and embeddable widgets."
- CTA button: "Set Up Organization →" → links to `/team/setup`
- **Not dismissible** — disappears only when org is created
- Same z-index and positioning pattern as existing `BetaBanner`

## Seat Tracking

- Enterprise base plan includes **10 seats**
- The `organizations.seat_count` field stores the total seats (base + additional purchased)
- `organization_members` count (status = 'active') tracks seats used
- Seat count is configurable per org (admin can change via billing dashboard)
- The 10-seat base is stored in the `subscription_tiers` table as a feature value, not hardcoded

## Files to Create

| File                                                   | Purpose                                  | Est. Lines |
| ------------------------------------------------------ | ---------------------------------------- | ---------- |
| `lib/data/hooks/useMyOrg.ts`                           | React Query hook wrapping `fetchMyOrg()` | ~25        |
| `components/entitlements/EnterpriseOnboardingGate.tsx` | Provider: redirect + banner logic        | ~60        |
| `components/entitlements/OrgSetupBanner.tsx`           | Persistent top banner                    | ~40        |
| `app/team/setup/page.tsx`                              | Wizard container with step state         | ~80        |
| `app/team/setup/components/OrgNameStep.tsx`            | Step 1: name + slug                      | ~100       |
| `app/team/setup/components/InviteTeamStep.tsx`         | Step 2: email invites + seat counter     | ~120       |
| `app/team/setup/components/FeatureTourStep.tsx`        | Step 3: feature cards                    | ~80        |

## Files to Modify

| File                | Change                                            |
| ------------------- | ------------------------------------------------- |
| `app/layout.tsx`    | Add `EnterpriseOnboardingGate` provider           |
| `app/team/page.tsx` | Already exists — redirect hub (no changes needed) |
| `lib/data/index.ts` | Export `useMyOrg` hook                            |

## Already Exists (Reuse)

- `fetchMyOrg()` — fetcher in `lib/data/fetchers/organizations.ts` (just added)
- `GET /api/org/mine` — backend endpoint (just added)
- `createOrganization()` — fetcher for `POST /api/org`
- `inviteOrgMember()` — fetcher for `POST /api/org/{slug}/members/invite`
- `SeatUsageBar` — component for visual seat tracking
- `BetaBanner` — reference pattern for banner positioning

## Error Handling

| Scenario                          | Behavior                                             |
| --------------------------------- | ---------------------------------------------------- |
| `fetchMyOrg()` fails              | Fail open — no redirect, no banner                   |
| Slug collision on create          | Inline error, suggest `{slug}-1` alternative         |
| Invite email fails                | Per-email error indicator, don't block wizard        |
| User has no auth                  | Redirect to `/auth/sign-in?redirect=%2Fteam%2Fsetup` |
| Org already exists on wizard load | Skip Step 1, show Steps 2-3                          |

## Out of Scope

- Stripe self-serve checkout for Enterprise tier (stays as contact sales + admin provisioning)
- Logo/accent color upload (deferred to org branding admin page)
- Additional seat purchasing (deferred to org billing admin page)
- Org deletion or enterprise tier downgrade workflow
- Automated org creation in webhook (user must go through wizard)

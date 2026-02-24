# Beta Tester Management + Email Invites Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add delete, regenerate link, and email invite capabilities to the admin tester management system.

**Architecture:** All new endpoints are Next.js API routes (same pattern as existing `/api/admin/testers`). Email sending calls Resend API directly from the Next.js API routes using a shared helper — no round-trip to the NestJS backend needed. The `is_active` column already exists for soft-delete, and the betatest page already checks it.

**Tech Stack:** Next.js API routes, Supabase admin client, Resend API, Zod validation

---

### Task 1: Create Email Helper for Beta Invites

**Files:**
- Create: `packages/frontend/app/api/admin/testers/send-invite-email.ts`

**Step 1: Create the invite email helper**

This module sends the beta invite email via Resend API. It reads `RESEND_API_KEY` and `EMAIL_FROM` from environment. In dev (no key), it logs to console.

```typescript
/**
 * Beta Tester Invite Email
 *
 * Sends invite email via Resend API. Falls back to console logging in dev.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Troy <troy@propertyiq.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface InviteEmailParams {
  to: string;
  name: string;
  token: string;
}

function buildInviteHtml(name: string, link: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
      <p style="font-size: 16px; color: #1a1a1a;">Hey ${name},</p>
      <p style="font-size: 16px; color: #1a1a1a; line-height: 1.6;">
        Troy here — I'd love your help testing PropertyIQ, a real estate analytics platform I'm building.
      </p>
      <p style="font-size: 16px; color: #1a1a1a; line-height: 1.6;">
        Click the link below to access the app and submit feedback directly:
      </p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${link}" style="display: inline-block; padding: 14px 32px; background-color: #6B21A8; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Start Testing
        </a>
      </p>
      <p style="font-size: 14px; color: #666; line-height: 1.6;">
        Your feedback link is unique to you — no login needed. Just use it whenever you want to report bugs, suggest features, or share thoughts.
      </p>
      <p style="font-size: 16px; color: #1a1a1a;">
        Thanks for helping make PropertyIQ better!
      </p>
      <p style="font-size: 16px; color: #1a1a1a;">— Troy</p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
      <p style="font-size: 12px; color: #999;">
        If the button doesn't work, copy this link: ${link}
      </p>
    </div>
  `;
}

export async function sendInviteEmail({ to, name, token }: InviteEmailParams): Promise<{ sent: boolean; error?: string }> {
  const link = `${APP_URL}/betatest/${token}`;

  if (!RESEND_API_KEY) {
    console.log(`[DEV] Would send beta invite to ${to}: ${link}`);
    return { sent: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject: "You're invited to beta test PropertyIQ",
      html: buildInviteHtml(name, link),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Resend API error:', errorText);
    return { sent: false, error: `Email failed: ${response.status}` };
  }

  return { sent: true };
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/api/admin/testers/send-invite-email.ts
git commit -m "feat: add beta invite email helper using Resend API"
```

---

### Task 2: Add Tester Delete + Regenerate + Resend API Routes

**Files:**
- Create: `packages/frontend/app/api/admin/testers/[id]/route.ts`
- Create: `packages/frontend/app/api/admin/testers/[id]/regenerate/route.ts`
- Create: `packages/frontend/app/api/admin/testers/[id]/resend/route.ts`

**Step 1: Create the `[id]` route with DELETE (soft-delete) and PATCH (reactivate)**

File: `packages/frontend/app/api/admin/testers/[id]/route.ts`

```typescript
/**
 * Admin Tester [id] API Route
 *
 * DELETE: Soft-delete (deactivate) a tester
 * PATCH: Reactivate a deactivated tester
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('beta_testers')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deactivating tester:', error);
      return NextResponse.json(
        { error: 'Failed to deactivate tester' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tester deactivation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('beta_testers')
      .update({ is_active: true })
      .eq('id', id);

    if (error) {
      console.error('Error reactivating tester:', error);
      return NextResponse.json(
        { error: 'Failed to reactivate tester' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tester reactivation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
```

**Step 2: Create the regenerate route**

File: `packages/frontend/app/api/admin/testers/[id]/regenerate/route.ts`

```typescript
/**
 * Regenerate Tester Token API Route
 *
 * POST: Generate a new token for a tester. Old link stops working.
 * Optionally re-sends invite email if tester has an email address.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendInviteEmail } from '../../send-invite-email';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    // Generate new token via Postgres function
    const { data: tester, error } = await supabase.rpc('regenerate_beta_tester_token', {
      tester_id: id,
    });

    if (error) {
      console.error('Error regenerating token:', error);
      // Fallback: update with JS-generated token
      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const { data: updated, error: updateError } = await supabase
        .from('beta_testers')
        .update({ token: newToken })
        .eq('id', id)
        .select('id, name, email, token')
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to regenerate token' },
          { status: 500 },
        );
      }

      // Send email if tester has email
      let emailSent = false;
      if (updated.email) {
        const result = await sendInviteEmail({
          to: updated.email,
          name: updated.name,
          token: updated.token,
        });
        emailSent = result.sent;
      }

      return NextResponse.json({ success: true, token: updated.token, emailSent });
    }

    // If RPC succeeded, fetch updated tester
    const { data: updated } = await supabase
      .from('beta_testers')
      .select('id, name, email, token')
      .eq('id', id)
      .single();

    let emailSent = false;
    if (updated?.email) {
      const result = await sendInviteEmail({
        to: updated.email,
        name: updated.name,
        token: updated.token,
      });
      emailSent = result.sent;
    }

    return NextResponse.json({ success: true, token: updated?.token, emailSent });
  } catch (error) {
    console.error('Token regeneration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
```

**Step 3: Create the resend route**

File: `packages/frontend/app/api/admin/testers/[id]/resend/route.ts`

```typescript
/**
 * Resend Invite Email API Route
 *
 * POST: Re-send the invite email to a tester using their current token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendInviteEmail } from '../../send-invite-email';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data: tester, error } = await supabase
      .from('beta_testers')
      .select('name, email, token')
      .eq('id', id)
      .single();

    if (error || !tester) {
      return NextResponse.json(
        { error: 'Tester not found' },
        { status: 404 },
      );
    }

    if (!tester.email) {
      return NextResponse.json(
        { error: 'Tester has no email address' },
        { status: 400 },
      );
    }

    const result = await sendInviteEmail({
      to: tester.email,
      name: tester.name,
      token: tester.token,
    });

    if (!result.sent) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend invite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
```

**Step 4: Commit**

```bash
git add packages/frontend/app/api/admin/testers/[id]/
git commit -m "feat: add tester delete, regenerate, and resend API routes"
```

---

### Task 3: Update POST /api/admin/testers to Send Invite Email on Create

**Files:**
- Modify: `packages/frontend/app/api/admin/testers/route.ts`

**Step 1: Add `sendEmail` flag to create schema and send email after insert**

Add `sendEmail` boolean to the Zod schema. After successful insert, if `sendEmail` is true and the tester has an email, call `sendInviteEmail`.

Key changes to the existing POST handler:
- Extend schema: `sendEmail: z.boolean().optional().default(true)`
- After tester insert succeeds, call `sendInviteEmail` if email is present and `sendEmail` is true
- Include `emailSent` in response

**Step 2: Commit**

```bash
git add packages/frontend/app/api/admin/testers/route.ts
git commit -m "feat: send invite email on tester creation"
```

---

### Task 4: Update GET /api/admin/testers to Filter Active/Inactive

**Files:**
- Modify: `packages/frontend/app/api/admin/testers/route.ts`

**Step 1: Update GET to include all testers (active + inactive) so the UI can show both**

The current GET already returns `is_active` in the select. No change needed for the query — all testers are returned. The UI will handle the visual distinction.

**This task is a no-op** — the API already returns all testers with `is_active` field. Skip to Task 5.

---

### Task 5: Rewrite TesterManager Component with Full Management UI

**Files:**
- Modify: `packages/frontend/app/admin/feedback/components/TesterManager.tsx`

**Step 1: Add new state and handlers**

Add to existing component state:
- `sendEmail` boolean (default true, for create form)
- `confirmDeleteId` string | null (for delete confirmation)
- `actionLoading` string | null (tracks which row action is in progress)

Add handler functions:
- `handleDeactivate(id)` — calls `DELETE /api/admin/testers/[id]`, then `onTesterCreated()` to refresh
- `handleReactivate(id)` — calls `PATCH /api/admin/testers/[id]`, then refreshes
- `handleRegenerate(id)` — confirm dialog, calls `POST /api/admin/testers/[id]/regenerate`, refreshes
- `handleResendEmail(id)` — calls `POST /api/admin/testers/[id]/resend`, shows success toast

**Step 2: Update create form**

Add "Send invite email" checkbox below the email input:
- Checked by default
- Disabled + unchecked when email field is empty
- Sends `sendEmail` flag in POST body

Update success banner to show whether email was sent.

Update `handleCreate` to pass `sendEmail` in the POST body and read `emailSent` from response.

**Step 3: Update table**

Add "Status" and "Actions" columns to the table:

- **Status column**: Green "Active" chip or gray "Inactive" chip based on `is_active`
- **Actions column**: Row of icon buttons:
  - Copy Link (existing — keep)
  - Resend Email (envelope icon — only if tester has email and is active)
  - Regenerate Link (refresh icon — only if active, with confirm dialog)
  - Deactivate (trash icon — only if active, with confirm dialog)
  - Reactivate (undo icon — only if inactive)

Inactive tester rows get `opacity-50` styling.

**Step 4: Add confirmation dialog**

Simple inline confirmation for destructive actions (deactivate, regenerate):
- Replace the action buttons row with "Are you sure? [Yes] [Cancel]" when confirmDeleteId matches
- For regenerate: warn "Old link will stop working. A new email will be sent."

**Step 5: Commit**

```bash
git add packages/frontend/app/admin/feedback/components/TesterManager.tsx
git commit -m "feat: add delete, regenerate, resend email to tester management UI"
```

---

### Task 6: Add RESEND_API_KEY and EMAIL_FROM to Environment

**Files:**
- Modify: `packages/frontend/.env.local` (local dev — add placeholder comments)

**Step 1: Add env vars for local testing**

Add to `.env.local`:
```
RESEND_API_KEY=
EMAIL_FROM=Troy <troy@propertyiq.app>
```

Without `RESEND_API_KEY` set, the helper logs to console instead of sending — safe for dev.

**Step 2: Remind user to set in Railway**

Production env vars to set in Railway dashboard:
- `RESEND_API_KEY` — from resend.com after domain verification
- `EMAIL_FROM` — `Troy <troy@propertyiq.app>`
- `NEXT_PUBLIC_APP_URL` — `https://www.propertyiq.app` (already set)

**Step 3: Commit all remaining changes and push**

```bash
git add -A
git commit -m "feat: complete beta tester management with email invites"
git push origin develop
```

---

### Resend Setup Guide (Manual Steps for Admin)

These are NOT code tasks — they're one-time setup steps for Troy:

1. Go to https://resend.com and create a free account
2. In Resend dashboard → Domains → Add Domain → enter `propertyiq.app`
3. Resend will show DNS records to add (MX, TXT, DKIM)
4. In GoDaddy DNS management for `propertyiq.app`, add those records
5. Wait for verification (usually 5-30 minutes)
6. In Resend dashboard → API Keys → Create API Key
7. Copy the key → go to Railway → Frontend service → Variables → add `RESEND_API_KEY=re_xxxxx`
8. Also add `EMAIL_FROM=Troy <troy@propertyiq.app>` in Railway

---

## Task Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Email helper (Resend API) | Create `send-invite-email.ts` |
| 2 | Delete + Regenerate + Resend API routes | Create 3 route files in `[id]/` |
| 3 | Update POST to send email on create | Modify `route.ts` |
| 4 | ~~GET filter~~ (no-op, already works) | — |
| 5 | Rewrite TesterManager UI | Modify `TesterManager.tsx` |
| 6 | Environment setup + push | Env vars + deploy |

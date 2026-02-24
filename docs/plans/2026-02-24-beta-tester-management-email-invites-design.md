# Beta Tester Management + Email Invites

**Date:** 2026-02-24
**Status:** Approved

## Problem

Admin tester management is incomplete — no delete, no link regeneration, and invite links must be manually copied and emailed. Testers need a working production URL, not localhost.

## What We're Building

Enhance admin tester management with three missing features:

1. **Delete testers** — soft delete (set `is_active=false`), preserve feedback history
2. **Regenerate invite links** — new token, old link stops working
3. **Auto-send invite email** — on tester creation and on link regeneration

## Architecture

### Email

Use existing `EmailService` (Resend API) in the NestJS backend. Frontend API routes call the backend email endpoint to send. No new email providers needed.

**Resend setup required:**
1. Create free account at resend.com
2. Verify `propertyiq.app` domain (DNS records in GoDaddy)
3. Add `RESEND_API_KEY` to Railway env vars
4. Set `EMAIL_FROM=Troy <troy@propertyiq.app>` in Railway

### API Changes

All routes are Next.js API routes (same pattern as existing tester CRUD):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/testers` | POST | Create tester (existing) + send invite email |
| `/api/admin/testers/[id]` | DELETE | Soft-delete (`is_active=false`) |
| `/api/admin/testers/[id]/regenerate` | POST | Generate new token + optionally re-send email |
| `/api/admin/testers/[id]/resend` | POST | Re-send invite email with current token |

### Email Template

Casual/personal tone:

- **Subject:** You're invited to beta test PropertyIQ
- **From:** `Troy <troy@propertyiq.app>` (configurable via `EMAIL_FROM`)
- **Body:**

> Hey {name},
>
> Troy here — I'd love your help testing PropertyIQ, a real estate analytics platform I'm building.
>
> Click the link below to access the app and submit feedback directly:
>
> **[Start Testing]({link})**
>
> Your feedback link is unique to you — no login needed. Just use it whenever you want to report bugs, suggest features, or share thoughts.
>
> Thanks for helping make PropertyIQ better!
>
> — Troy

### UI Changes (TesterManager Component)

- **Delete button** per row with confirmation dialog
- **Regenerate link button** per row with confirmation (warns old link stops working)
- **Resend email button** per row (only shown if tester has email)
- **"Send invite email" checkbox** on create form (checked by default, disabled if no email)
- **Inactive testers** shown grayed out with "Reactivate" option

## Current State

| Feature | Status | Location |
|---------|--------|----------|
| Create tester | Exists | `TesterManager.tsx`, `POST /api/admin/testers` |
| List testers | Exists | `TesterManager.tsx`, `GET /api/admin/testers` |
| Copy link | Exists | `TesterManager.tsx` |
| Delete tester | Missing | No endpoint, no UI |
| Regenerate token | Missing | No endpoint, no UI |
| Email on create | Missing | `EmailService` exists but not wired to testers |
| Soft delete support | Partial | `is_active` column exists, not exposed in API/UI |

## Key Files

- **Frontend component:** `packages/frontend/app/admin/feedback/components/TesterManager.tsx`
- **API routes:** `packages/frontend/app/api/admin/testers/route.ts`
- **Email service:** `packages/backend/src/email/email.service.ts`
- **DB schema:** `beta_testers` table with `token`, `is_active`, `email` columns
- **Tester types:** `packages/frontend/app/betatest/types.ts`

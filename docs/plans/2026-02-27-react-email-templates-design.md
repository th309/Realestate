# React Email Template Library Design

## Overview

Replace all inline HTML email strings with a shared React Email template library. Install the official Resend SDK to replace raw `fetch()` calls in both frontend and backend.

## Package Location

`packages/emails/` — new top-level workspace package importable by both `packages/frontend` and `packages/backend`.

## Approach

**Resend SDK with `react` prop** — templates are React components passed directly to `resend.emails.send({ react: <Template /> })`. The SDK handles HTML rendering automatically. This replaces the raw `fetch('https://api.resend.com/emails')` calls currently in both packages.

## Templates (7 total)

### New Templates

| Template           | File                     | Props                           |
| ------------------ | ------------------------ | ------------------------------- |
| Welcome            | `welcome.tsx`            | `name`, `loginUrl`              |
| Email Verification | `email-verification.tsx` | `name`, `verificationUrl`       |
| Password Reset     | `password-reset.tsx`     | `name`, `resetUrl`, `expiresIn` |

### Replacing Existing Inline HTML

| Template                  | File                            | Replaces                                                             |
| ------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| Weekly Digest             | `weekly-digest.tsx`             | `backend/src/email/digest.service.ts` inline HTML                    |
| Beta Invite               | `beta-invite.tsx`               | `frontend/app/api/admin/testers/send-invite-email.ts` inline HTML    |
| Newsletter Confirmation   | `newsletter-confirmation.tsx`   | `frontend/app/api/newsletter/send-confirmation-email.ts` inline HTML |
| Contact Form Notification | `contact-form-notification.tsx` | `backend/src/support/support.service.ts` inline HTML                 |

## Shared Components

Located in `packages/emails/components/`:

- **`layout.tsx`** — branded wrapper: PropertyIQ logo header, footer with address + unsubscribe link + copyright year
- **`button.tsx`** — branded CTA button with consistent styling
- **`heading.tsx`** — consistent heading styles

## Brand Design

- **Colors:** PropertyIQ M3 primary color palette
- **Font:** Roboto via `<Font>` component (Google Fonts)
- **Logo:** PropertyIQ logo in header (PNG, hosted on CDN or static)
- **Footer:** Physical address, unsubscribe link, current year copyright
- **Style:** Clean, professional, matching the app's M3 design language

## Package Structure

```
packages/emails/
  package.json              # @propertyiq/emails workspace package
  tsconfig.json
  emails/
    welcome.tsx
    email-verification.tsx
    password-reset.tsx
    weekly-digest.tsx
    beta-invite.tsx
    newsletter-confirmation.tsx
    contact-form-notification.tsx
    components/
      layout.tsx
      button.tsx
      heading.tsx
    static/
      logo.png
  index.ts                  # Re-exports all templates
```

## Dependencies

```json
{
  "@react-email/components": "latest",
  "react-email": "latest",
  "react": "^19.2.0",
  "resend": "^4.0.0"
}
```

## Integration Changes

### Backend (`packages/backend`)

1. Add `resend` SDK as dependency
2. Refactor `EmailService.sendEmail()` to use `resend.emails.send({ react: <Template /> })` instead of raw fetch
3. Refactor `DigestService` to import `WeeklyDigest` template from `@propertyiq/emails`
4. Refactor `SupportService` contact form email to use `ContactFormNotification` template

### Frontend (`packages/frontend`)

1. Add `resend` SDK as dependency
2. Refactor `send-invite-email.ts` to use `BetaInvite` template
3. Refactor `send-confirmation-email.ts` to use `NewsletterConfirmation` template

### Dev Preview

Add script to root `package.json`:

```json
{
  "scripts": {
    "email:dev": "email dev --dir packages/emails/emails --port 3002"
  }
}
```

Port 3002 to avoid conflicts with frontend (3000) and backend (3001).

## Template Props

### Welcome

```typescript
interface WelcomeEmailProps {
  name: string;
  loginUrl: string;
}
```

### Email Verification

```typescript
interface EmailVerificationProps {
  name: string;
  verificationUrl: string;
}
```

### Password Reset

```typescript
interface PasswordResetProps {
  name: string;
  resetUrl: string;
  expiresIn: string; // e.g., "1 hour"
}
```

### Weekly Digest

```typescript
interface WeeklyDigestProps {
  name: string;
  watchlist: Array<{ name: string; score: number; change: number }>;
  alerts: Array<{ title: string; description: string; triggeredAt: string }>;
  dashboardUrl: string;
}
```

### Beta Invite

```typescript
interface BetaInviteProps {
  name: string;
  testingUrl: string;
  token: string;
}
```

### Newsletter Confirmation

```typescript
interface NewsletterConfirmationProps {
  confirmUrl: string;
}
```

### Contact Form Notification

```typescript
interface ContactFormNotificationProps {
  name: string;
  email: string;
  issueType: string;
  description: string;
}
```

# React Email Template Library — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all inline HTML email strings with a shared React Email template library using the Resend SDK.

**Architecture:** New `packages/emails/` workspace package with React Email components. Both `packages/backend` and `packages/frontend` import templates from it. The Resend SDK replaces all raw `fetch()` calls to the Resend API.

**Tech Stack:** React Email (`@react-email/components`), Resend SDK (`resend`), React 19, TypeScript, Tailwind (via `<Tailwind>` component with `pixelBasedPreset`)

---

## Task 1: Scaffold `packages/emails/` workspace package

**Files:**

- Create: `packages/emails/package.json`
- Create: `packages/emails/tsconfig.json`
- Create: `packages/emails/index.ts`
- Create: `packages/emails/emails/` directory
- Create: `packages/emails/emails/components/` directory
- Create: `packages/emails/emails/static/` directory

**Step 1: Create package.json**

```json
{
  "name": "@propertyiq/emails",
  "version": "0.1.0",
  "private": true,
  "main": "index.ts",
  "scripts": {
    "dev": "email dev --dir emails --port 3002"
  },
  "dependencies": {
    "@react-email/components": "^0.0.36",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "react-email": "^3.0.6",
    "typescript": "^5.7.3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create empty index.ts barrel export**

```typescript
// Templates
export { default as WelcomeEmail } from "./emails/welcome";
export { default as EmailVerification } from "./emails/email-verification";
export { default as PasswordReset } from "./emails/password-reset";
export { default as WeeklyDigest } from "./emails/weekly-digest";
export { default as BetaInvite } from "./emails/beta-invite";
export { default as NewsletterConfirmation } from "./emails/newsletter-confirmation";
export { default as ContactFormNotification } from "./emails/contact-form-notification";

// Types
export type { WelcomeEmailProps } from "./emails/welcome";
export type { EmailVerificationProps } from "./emails/email-verification";
export type { PasswordResetProps } from "./emails/password-reset";
export type { WeeklyDigestProps } from "./emails/weekly-digest";
export type { BetaInviteProps } from "./emails/beta-invite";
export type { NewsletterConfirmationProps } from "./emails/newsletter-confirmation";
export type { ContactFormNotificationProps } from "./emails/contact-form-notification";
```

**Step 4: Add `email:dev` script to root package.json**

In `package.json` (root), add to `"scripts"`:

```json
"email:dev": "npm run dev -w @propertyiq/emails"
```

**Step 5: Run `npm install` from the root to wire up the workspace**

Run: `npm install`
Expected: `packages/emails/node_modules` created, workspace linked

**Step 6: Commit**

```bash
git add packages/emails/package.json packages/emails/tsconfig.json packages/emails/index.ts package.json
git commit -m "feat(emails): scaffold React Email workspace package"
```

---

## Task 2: Build shared layout components

**Files:**

- Create: `packages/emails/emails/components/layout.tsx`
- Create: `packages/emails/emails/components/branded-button.tsx`
- Create: `packages/emails/emails/components/email-heading.tsx`

**Step 1: Create `layout.tsx` — branded wrapper with header/footer**

This wraps every email template. It provides:

- `<Html lang="en">` + `<Tailwind>` with `pixelBasedPreset`
- `<Head>` with Roboto `<Font>`
- PropertyIQ branded header (purple `#6750A4` text logo)
- `<Container>` for content (max-width 600px)
- Footer with address, unsubscribe link, copyright

```tsx
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Font,
  Tailwind,
  pixelBasedPreset,
} from "@react-email/components";

interface LayoutProps {
  preview: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
}

const brandColor = "#6750A4";

export default function Layout({
  preview,
  children,
  unsubscribeUrl,
}: LayoutProps) {
  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                brand: brandColor,
                "brand-light": "#f5f3ff",
              },
            },
          },
        }}
      >
        <Head>
          <Font
            fontFamily="Roboto"
            fallbackFontFamily="Arial"
            webFont={{
              url: "https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.woff2",
              format: "woff2",
            }}
            fontWeight={400}
            fontStyle="normal"
          />
        </Head>
        <Preview>{preview}</Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container
            className="bg-white rounded-xl mx-auto p-0"
            style={{ maxWidth: "600px" }}
          >
            {/* Header */}
            <Section
              className="px-10 pt-8 pb-6"
              style={{ borderBottom: `3px solid ${brandColor}` }}
            >
              <Text
                className="text-2xl font-bold m-0"
                style={{ color: brandColor }}
              >
                PropertyIQ
              </Text>
            </Section>

            {/* Content */}
            <Section className="px-10 py-6">{children}</Section>

            {/* Footer */}
            <Section
              className="px-10 pt-6 pb-8 bg-gray-50"
              style={{ borderTop: "1px solid #e5e5e5" }}
            >
              <Text className="text-xs text-gray-400 m-0 leading-5">
                PropertyIQ Inc. &bull; Austin, TX
              </Text>
              {unsubscribeUrl && (
                <Text className="text-xs text-gray-400 m-0 mt-1">
                  <Link
                    href={unsubscribeUrl}
                    className="text-gray-400 underline"
                  >
                    Unsubscribe
                  </Link>{" "}
                  or{" "}
                  <Link
                    href="https://propertyiq.app/account/notifications"
                    className="text-gray-400 underline"
                  >
                    manage preferences
                  </Link>
                </Text>
              )}
              <Text className="text-xs text-gray-400 m-0 mt-1">
                &copy; {new Date().getFullYear()} PropertyIQ. All rights
                reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

**Step 2: Create `branded-button.tsx`**

```tsx
import { Button } from "@react-email/components";

interface BrandedButtonProps {
  href: string;
  children: React.ReactNode;
}

export default function BrandedButton({ href, children }: BrandedButtonProps) {
  return (
    <Button
      href={href}
      className="bg-brand text-white text-base font-semibold py-3 px-8 rounded-lg box-border no-underline"
      style={{ display: "block", textAlign: "center" }}
    >
      {children}
    </Button>
  );
}
```

**Step 3: Create `email-heading.tsx`**

```tsx
import { Heading } from "@react-email/components";

interface EmailHeadingProps {
  children: React.ReactNode;
}

export default function EmailHeading({ children }: EmailHeadingProps) {
  return (
    <Heading className="text-xl font-bold text-gray-900 m-0 mb-4">
      {children}
    </Heading>
  );
}
```

**Step 4: Commit**

```bash
git add packages/emails/emails/components/
git commit -m "feat(emails): add shared layout, button, and heading components"
```

---

## Task 3: Build new transactional templates (Welcome, Verification, Password Reset)

**Files:**

- Create: `packages/emails/emails/welcome.tsx`
- Create: `packages/emails/emails/email-verification.tsx`
- Create: `packages/emails/emails/password-reset.tsx`

**Step 1: Create `welcome.tsx`**

```tsx
import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface WelcomeEmailProps {
  name: string;
  loginUrl: string;
}

export default function WelcomeEmail({ name, loginUrl }: WelcomeEmailProps) {
  return (
    <Layout preview={`Welcome to PropertyIQ, ${name}!`}>
      <EmailHeading>Welcome to PropertyIQ</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hi {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Thanks for signing up! PropertyIQ gives you real estate market
        analytics, scoring, and insights — all in one place.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Jump in and explore your first market:
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={loginUrl}>Go to Dashboard</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={loginUrl} className="text-brand underline">
          {loginUrl}
        </Link>
      </Text>
    </Layout>
  );
}

WelcomeEmail.PreviewProps = {
  name: "Troy",
  loginUrl: "https://propertyiq.app/dashboard",
} satisfies WelcomeEmailProps;
```

**Step 2: Create `email-verification.tsx`**

```tsx
import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface EmailVerificationProps {
  name: string;
  verificationUrl: string;
}

export default function EmailVerification({
  name,
  verificationUrl,
}: EmailVerificationProps) {
  return (
    <Layout preview="Verify your email address">
      <EmailHeading>Verify your email</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hi {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Please verify your email address by clicking the button below:
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={verificationUrl}>Verify Email</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={verificationUrl} className="text-brand underline">
          {verificationUrl}
        </Link>
      </Text>
    </Layout>
  );
}

EmailVerification.PreviewProps = {
  name: "Troy",
  verificationUrl: "https://propertyiq.app/verify?token=abc123",
} satisfies EmailVerificationProps;
```

**Step 3: Create `password-reset.tsx`**

```tsx
import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface PasswordResetProps {
  name: string;
  resetUrl: string;
  expiresIn: string;
}

export default function PasswordReset({
  name,
  resetUrl,
  expiresIn,
}: PasswordResetProps) {
  return (
    <Layout preview="Reset your PropertyIQ password">
      <EmailHeading>Reset your password</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hi {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        We received a request to reset your password. Click the button below to
        choose a new one. This link expires in {expiresIn}.
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={resetUrl}>Reset Password</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0 mb-4">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={resetUrl} className="text-brand underline">
          {resetUrl}
        </Link>
      </Text>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If you didn&apos;t request a password reset, you can safely ignore this
        email.
      </Text>
    </Layout>
  );
}

PasswordReset.PreviewProps = {
  name: "Troy",
  resetUrl: "https://propertyiq.app/reset-password?token=xyz789",
  expiresIn: "1 hour",
} satisfies PasswordResetProps;
```

**Step 4: Commit**

```bash
git add packages/emails/emails/welcome.tsx packages/emails/emails/email-verification.tsx packages/emails/emails/password-reset.tsx
git commit -m "feat(emails): add welcome, verification, and password reset templates"
```

---

## Task 4: Build replacement templates (Beta Invite, Newsletter Confirmation, Contact Form)

**Files:**

- Create: `packages/emails/emails/beta-invite.tsx`
- Create: `packages/emails/emails/newsletter-confirmation.tsx`
- Create: `packages/emails/emails/contact-form-notification.tsx`

**Step 1: Create `beta-invite.tsx`**

Replaces: `packages/frontend/app/api/admin/testers/send-invite-email.ts` inline HTML.

```tsx
import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";

export interface BetaInviteProps {
  name: string;
  testingUrl: string;
}

export default function BetaInvite({ name, testingUrl }: BetaInviteProps) {
  return (
    <Layout preview="You're invited to beta test PropertyIQ">
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Hey {name},
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Troy here — I&apos;d love your help testing PropertyIQ, a real estate
        analytics platform I&apos;m building.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Click the link below to access the app and submit feedback directly:
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={testingUrl}>Start Testing</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0 mb-4">
        Your feedback link is unique to you — no login needed. Just use it
        whenever you want to report bugs, suggest features, or share thoughts.
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-2">
        Thanks for helping make PropertyIQ better!
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">— Troy</Text>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={testingUrl} className="text-brand underline">
          {testingUrl}
        </Link>
      </Text>
    </Layout>
  );
}

BetaInvite.PreviewProps = {
  name: "Alex",
  testingUrl: "https://propertyiq.app/betatest/abc123",
} satisfies BetaInviteProps;
```

**Step 2: Create `newsletter-confirmation.tsx`**

Replaces: `packages/frontend/app/api/newsletter/send-confirmation-email.ts` inline HTML.

```tsx
import { Text, Section, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface NewsletterConfirmationProps {
  confirmUrl: string;
}

export default function NewsletterConfirmation({
  confirmUrl,
}: NewsletterConfirmationProps) {
  return (
    <Layout preview="Confirm your PropertyIQ newsletter subscription">
      <EmailHeading>Confirm your subscription</EmailHeading>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-4">
        Thanks for signing up for Weekly Market Insights from PropertyIQ!
      </Text>
      <Text className="text-base text-gray-700 leading-6 m-0 mb-6">
        Please confirm your email address by clicking the button below:
      </Text>
      <Section className="text-center mb-6">
        <BrandedButton href={confirmUrl}>Confirm Subscription</BrandedButton>
      </Section>
      <Text className="text-sm text-gray-500 leading-5 m-0 mb-4">
        If you didn&apos;t sign up for this newsletter, you can safely ignore
        this email.
      </Text>
      <Text className="text-sm text-gray-500 leading-5 m-0">
        If the button doesn&apos;t work, copy this link:{" "}
        <Link href={confirmUrl} className="text-brand underline">
          {confirmUrl}
        </Link>
      </Text>
    </Layout>
  );
}

NewsletterConfirmation.PreviewProps = {
  confirmUrl: "https://propertyiq.app/api/newsletter/confirm?token=xyz789",
} satisfies NewsletterConfirmationProps;
```

**Step 3: Create `contact-form-notification.tsx`**

Replaces: `packages/backend/src/support/support.service.ts` inline HTML (lines 54-63).

```tsx
import { Text, Section, Row, Column, Hr } from "@react-email/components";
import Layout from "./components/layout";
import EmailHeading from "./components/email-heading";

export interface ContactFormNotificationProps {
  name: string;
  email: string;
  issueType: string;
  description: string;
}

export default function ContactFormNotification({
  name,
  email,
  issueType,
  description,
}: ContactFormNotificationProps) {
  return (
    <Layout preview={`New contact form: ${issueType}`}>
      <EmailHeading>New Contact Form Submission</EmailHeading>

      <Section className="bg-gray-50 rounded-lg p-4 mb-4">
        <Row>
          <Column className="w-28">
            <Text className="text-sm font-semibold text-gray-600 m-0">
              Name
            </Text>
          </Column>
          <Column>
            <Text className="text-sm text-gray-800 m-0">{name}</Text>
          </Column>
        </Row>
        <Row className="mt-2">
          <Column className="w-28">
            <Text className="text-sm font-semibold text-gray-600 m-0">
              Email
            </Text>
          </Column>
          <Column>
            <Text className="text-sm text-gray-800 m-0">{email}</Text>
          </Column>
        </Row>
        <Row className="mt-2">
          <Column className="w-28">
            <Text className="text-sm font-semibold text-gray-600 m-0">
              Issue Type
            </Text>
          </Column>
          <Column>
            <Text className="text-sm text-gray-800 m-0">{issueType}</Text>
          </Column>
        </Row>
      </Section>

      <Hr className="border-solid border-gray-200 my-4" />

      <Text className="text-sm font-semibold text-gray-600 m-0 mb-2">
        Message
      </Text>
      <Text className="text-sm text-gray-800 leading-6 m-0 whitespace-pre-wrap">
        {description}
      </Text>
    </Layout>
  );
}

ContactFormNotification.PreviewProps = {
  name: "Jane Doe",
  email: "jane@example.com",
  issueType: "Bug Report",
  description:
    "The map is not loading when I select ZIP code level data.\n\nSteps to reproduce:\n1. Go to the map page\n2. Select ZIP code geography\n3. Page stays blank",
} satisfies ContactFormNotificationProps;
```

**Step 4: Commit**

```bash
git add packages/emails/emails/beta-invite.tsx packages/emails/emails/newsletter-confirmation.tsx packages/emails/emails/contact-form-notification.tsx
git commit -m "feat(emails): add beta invite, newsletter confirmation, and contact form templates"
```

---

## Task 5: Build Weekly Digest template

**Files:**

- Create: `packages/emails/emails/weekly-digest.tsx`

This is the most complex template — it has dynamic watchlist and alerts lists. Replaces `DigestService.renderDigestEmail()` (lines 131-219 in `packages/backend/src/email/digest.service.ts`).

**Step 1: Create `weekly-digest.tsx`**

```tsx
import { Text, Section, Row, Column, Hr, Link } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface WeeklyDigestProps {
  name: string;
  watchlist: Array<{
    name: string;
    geoType: string;
    geoId: string;
  }>;
  alerts: Array<{
    marketName: string;
    metricId: string;
    condition: string;
    threshold: number;
    currentValue: number;
  }>;
  dashboardUrl: string;
  preferencesUrl: string;
}

export default function WeeklyDigest({
  name,
  watchlist,
  alerts,
  dashboardUrl,
  preferencesUrl,
}: WeeklyDigestProps) {
  return (
    <Layout
      preview={`Your weekly market digest — ${watchlist.length} markets, ${alerts.length} alerts`}
      unsubscribeUrl={preferencesUrl}
    >
      <Text className="text-sm font-medium text-brand m-0 mb-1">
        Weekly Market Digest
      </Text>
      <EmailHeading>Hi {name}, here&apos;s your weekly update</EmailHeading>

      {/* Watchlist Section */}
      {watchlist.length > 0 && (
        <>
          <Text className="text-base font-semibold text-gray-900 m-0 mt-6 mb-3">
            Your Markets
          </Text>
          {watchlist.map((market, i) => (
            <Section
              key={i}
              className="py-3"
              style={
                i < watchlist.length - 1
                  ? { borderBottom: "1px solid #eee" }
                  : {}
              }
            >
              <Text className="text-sm font-medium text-gray-900 m-0">
                {market.name}
              </Text>
              <Text className="text-xs text-gray-500 m-0 mt-1">
                {market.geoType}
              </Text>
            </Section>
          ))}
        </>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <>
          <Hr className="border-solid border-gray-200 my-4" />
          <Text className="text-base font-semibold text-gray-900 m-0 mb-3">
            Triggered Alerts (Past 7 Days)
          </Text>
          {alerts.map((alert, i) => (
            <Section
              key={i}
              className="py-3"
              style={
                i < alerts.length - 1 ? { borderBottom: "1px solid #eee" } : {}
              }
            >
              <Text className="text-sm font-medium text-gray-900 m-0">
                {alert.marketName}
              </Text>
              <Text className="text-xs text-gray-500 m-0 mt-1">
                {alert.metricId} {alert.condition} {alert.threshold} — Current:{" "}
                {alert.currentValue}
              </Text>
            </Section>
          ))}
        </>
      )}

      {/* CTA */}
      <Section className="text-center mt-8 mb-2">
        <BrandedButton href={dashboardUrl}>View Your Dashboard</BrandedButton>
      </Section>
    </Layout>
  );
}

WeeklyDigest.PreviewProps = {
  name: "Troy",
  watchlist: [
    {
      name: "Austin-Round Rock-Georgetown, TX",
      geoType: "Metro",
      geoId: "12420",
    },
    { name: "Denver-Aurora-Lakewood, CO", geoType: "Metro", geoId: "19740" },
    { name: "78701", geoType: "ZIP", geoId: "78701" },
  ],
  alerts: [
    {
      marketName: "Austin-Round Rock-Georgetown, TX",
      metricId: "home_value",
      condition: "drops below",
      threshold: 400000,
      currentValue: 395200,
    },
  ],
  dashboardUrl: "https://propertyiq.app/dashboard",
  preferencesUrl: "https://propertyiq.app/account/notifications",
} satisfies WeeklyDigestProps;
```

**Step 2: Commit**

```bash
git add packages/emails/emails/weekly-digest.tsx
git commit -m "feat(emails): add weekly digest template with watchlist and alerts"
```

---

## Task 6: Verify templates render in React Email dev server

**Step 1: Install dependencies**

Run from project root:

```bash
npm install
```

**Step 2: Start the React Email dev server**

```bash
npm run email:dev
```

Expected: Dev server starts on `http://localhost:3002` and shows all 7 templates in the sidebar.

**Step 3: Manually check each template in the browser**

Open `http://localhost:3002` and verify:

- All 7 templates render without errors
- Preview text is correct
- Layout header shows "PropertyIQ" in purple
- Footer shows address, copyright
- CTA buttons have correct colors and text
- Dynamic content renders with PreviewProps data

**Step 4: Stop the dev server (Ctrl+C) after verification**

---

## Task 7: Install Resend SDK in backend, refactor EmailService

**Files:**

- Modify: `packages/backend/package.json` — add `resend` dependency
- Modify: `packages/backend/src/email/email.service.ts` — replace raw fetch with Resend SDK
- Modify: `packages/backend/tsconfig.json` — may need `jsx` support for React Email

**Step 1: Add `resend` and `@propertyiq/emails` as dependencies to backend**

```bash
cd packages/backend && npm install resend && cd ../..
```

Also add to `packages/backend/package.json` dependencies:

```json
"@propertyiq/emails": "*"
```

Then run `npm install` from root.

**Step 2: Add JSX support to backend tsconfig if needed**

In `packages/backend/tsconfig.json`, ensure `compilerOptions` has:

```json
"jsx": "react-jsx"
```

**Step 3: Refactor `email.service.ts`**

Replace the raw `fetch()` call with Resend SDK. Keep the dev-mode console fallback, email logging, and preferences methods unchanged.

The new `EmailService` should:

- Initialize `Resend` client in constructor
- Accept either `html: string` (for backward compat) or `react: React.ReactElement` in `SendEmailOptions`
- Pass `react` directly to `resend.emails.send()` when provided, fall back to `html`
- Keep `logEmail()`, `getPreferences()`, `updatePreferences()` untouched

Updated `SendEmailOptions` interface:

```typescript
interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  react?: React.ReactElement;
  userId?: string;
  emailType: string;
  metadata?: Record<string, unknown>;
}
```

Updated `sendEmail()`:

```typescript
import { Resend } from "resend";

// In constructor:
this.resend = this.resendApiKey ? new Resend(this.resendApiKey) : null;

// In sendEmail():
if (this.resend) {
  const { error } = await this.resend.emails.send({
    from: this.fromEmail,
    to: [options.to],
    subject: options.subject,
    react: options.react,
    html: options.react ? undefined : options.html,
  });
  if (error) {
    this.logger.error(`Resend SDK error: ${JSON.stringify(error)}`);
    return false;
  }
} else {
  this.logger.log(
    `[DEV] Would send email to ${options.to}: ${options.subject}`,
  );
}
```

**Step 4: Verify backend compiles**

```bash
npm run build:backend
```

Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add packages/backend/
git commit -m "feat(emails): integrate Resend SDK into backend EmailService"
```

---

## Task 8: Refactor DigestService to use WeeklyDigest template

**Files:**

- Modify: `packages/backend/src/email/digest.service.ts`

**Step 1: Replace `renderDigestEmail()` with React template import**

Remove the entire `renderDigestEmail()` method (lines 131-219). Instead, import `WeeklyDigest` from `@propertyiq/emails` and pass it as `react` prop.

In `sendWeeklyDigests()`, replace:

```typescript
const html = this.renderDigestEmail(digestData);
```

with:

```typescript
import { WeeklyDigest } from "@propertyiq/emails";
import React from "react";

// Map the digest data to template props
const react = React.createElement(WeeklyDigest, {
  name: user.email.split("@")[0], // Best we have without user_profiles.name
  watchlist: digestData.watchlist.map((m) => ({
    name: m.geography_name || m.geography_id,
    geoType: m.geography_type,
    geoId: m.geography_id,
  })),
  alerts: digestData.alerts.map((a) => ({
    marketName: a.alert?.geography_name || "Market",
    metricId: a.alert?.metric_id || "",
    condition: a.alert?.condition || "",
    threshold: a.alert?.threshold || 0,
    currentValue: a.metric_value || 0,
  })),
  dashboardUrl: "https://propertyiq.app/dashboard",
  preferencesUrl: "https://propertyiq.app/account/notifications",
});
```

Then pass `react` instead of `html` to `emailService.sendEmail()`:

```typescript
const success = await this.emailService.sendEmail({
  to: user.email,
  subject: `PropertyIQ Weekly Digest — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
  react,
  userId: user.id,
  emailType: "digest",
  metadata: {
    watchlistCount: digestData.watchlistCount,
    alertCount: digestData.alertCount,
  },
});
```

**Step 2: Verify backend compiles**

```bash
npm run build:backend
```

**Step 3: Commit**

```bash
git add packages/backend/src/email/digest.service.ts
git commit -m "refactor(emails): use WeeklyDigest React template in DigestService"
```

---

## Task 9: Refactor SupportService to use ContactFormNotification template

**Files:**

- Modify: `packages/backend/src/support/support.service.ts`

**Step 1: Replace inline HTML with React template**

Import `ContactFormNotification` from `@propertyiq/emails`. Replace the `sendNotificationEmail()` method's inline HTML with:

```typescript
import { ContactFormNotification } from "@propertyiq/emails";
import React from "react";

// In sendNotificationEmail():
const react = React.createElement(ContactFormNotification, {
  name: senderName,
  email: contactEmail,
  issueType: dto.issueType,
  description: dto.description,
});

const sent = await this.emailService.sendEmail({
  to: "info@propertyiq.app",
  subject,
  react,
  emailType: "contact_form_submission",
  metadata: { senderName, senderEmail: contactEmail, issueType: dto.issueType },
});
```

Remove the `escapeHtml()` method — React Email handles escaping automatically.

**Step 2: Verify backend compiles**

```bash
npm run build:backend
```

**Step 3: Commit**

```bash
git add packages/backend/src/support/support.service.ts
git commit -m "refactor(emails): use ContactFormNotification React template in SupportService"
```

---

## Task 10: Install Resend SDK in frontend, refactor API routes

**Files:**

- Modify: `packages/frontend/package.json` — add `resend` and `@propertyiq/emails`
- Modify: `packages/frontend/app/api/admin/testers/send-invite-email.ts`
- Modify: `packages/frontend/app/api/newsletter/send-confirmation-email.ts`

**Step 1: Add dependencies**

```bash
cd packages/frontend && npm install resend && cd ../..
```

Add `"@propertyiq/emails": "*"` to `packages/frontend/package.json` dependencies. Then `npm install` from root.

**Step 2: Refactor `send-invite-email.ts`**

Replace the entire file. Remove `buildInviteHtml()`, replace raw fetch with Resend SDK:

```typescript
import { Resend } from "resend";
import { BetaInvite } from "@propertyiq/emails";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM = process.env.EMAIL_FROM || "Troy <troy@propertyiq.app>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface InviteEmailParams {
  to: string;
  name: string;
  token: string;
}

export async function sendInviteEmail(
  params: InviteEmailParams,
): Promise<{ sent: boolean; error?: string }> {
  const testingUrl = `${APP_URL}/betatest/${params.token}`;

  if (!resend) {
    console.log(`[DEV] Would send beta invite to ${params.to}: ${testingUrl}`);
    return { sent: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [params.to],
      subject: "You're invited to beta test PropertyIQ",
      react: BetaInvite({ name: params.name, testingUrl }),
    });

    if (error) {
      console.error("Resend SDK error:", error);
      return { sent: false, error: `Email failed: ${error.message}` };
    }

    return { sent: true };
  } catch (error) {
    console.error("Failed to send invite email:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

**Step 3: Refactor `send-confirmation-email.ts`**

Same pattern — replace raw fetch with Resend SDK:

```typescript
import { Resend } from "resend";
import { NewsletterConfirmation } from "@propertyiq/emails";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM =
  process.env.EMAIL_FROM || "PropertyIQ <noreply@propertyiq.app>";

interface ConfirmationEmailParams {
  to: string;
  confirmationUrl: string;
}

export async function sendConfirmationEmail(
  params: ConfirmationEmailParams,
): Promise<{ sent: boolean; error?: string }> {
  if (!resend) {
    console.log(
      `[DEV] Would send newsletter confirmation to ${params.to}: ${params.confirmationUrl}`,
    );
    return { sent: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [params.to],
      subject: "Confirm your PropertyIQ newsletter subscription",
      react: NewsletterConfirmation({ confirmUrl: params.confirmationUrl }),
    });

    if (error) {
      console.error("Resend SDK error (newsletter):", error);
      return { sent: false, error: `Email failed: ${error.message}` };
    }

    return { sent: true };
  } catch (error) {
    console.error("Failed to send newsletter confirmation:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

**Step 4: Verify frontend builds**

```bash
npm run build:frontend
```

**Step 5: Commit**

```bash
git add packages/frontend/
git commit -m "refactor(emails): use Resend SDK and React templates in frontend API routes"
```

---

## Task 11: Send a test email to verify end-to-end

**Step 1: Use the Resend MCP tool to send a test email**

Use the `mcp__resend__send-email` tool with the welcome template rendered to HTML (or send a simple test from one of the refactored paths).

Alternatively, start the dev servers and trigger a beta invite from the admin panel, or a newsletter signup to test the confirmation flow.

**Step 2: Verify email arrives with branded layout**

Check Gmail inbox for:

- PropertyIQ branded header
- Clean Roboto font
- Purple CTA button
- Footer with address and copyright

**Step 3: Final commit if any adjustments needed**

---

## Summary

| Task | What                     | Files                                                 |
| ---- | ------------------------ | ----------------------------------------------------- |
| 1    | Scaffold package         | `packages/emails/` (package.json, tsconfig, index.ts) |
| 2    | Shared components        | `emails/components/` (layout, button, heading)        |
| 3    | New templates            | welcome, verification, password-reset                 |
| 4    | Replacement templates    | beta-invite, newsletter-confirmation, contact-form    |
| 5    | Weekly digest template   | weekly-digest (most complex)                          |
| 6    | Verify dev server        | Start `email:dev`, check all 7 templates              |
| 7    | Backend Resend SDK       | Refactor `EmailService`                               |
| 8    | Backend digest refactor  | Refactor `DigestService`                              |
| 9    | Backend support refactor | Refactor `SupportService`                             |
| 10   | Frontend Resend SDK      | Refactor both API routes                              |
| 11   | End-to-end test          | Send test email, verify branding                      |

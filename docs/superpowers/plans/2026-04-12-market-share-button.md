# Market Share Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken market share button with a full share experience: tracked share links, dynamic OG cards with market metrics, social sharing, email via Resend, and view analytics.

**Architecture:** Extend the existing `SharesService` with a `market_share` content type. Frontend creates a share record on modal open, uses the token URL for all channels. A new `/s/[token]` redirect page serves OG metadata for social crawlers then redirects humans to the market page.

**Tech Stack:** Next.js (App Router, Edge runtime for OG), NestJS (shares + email), Resend (email delivery), `next/og` (image generation), Supabase (share persistence).

**Spec:** `docs/superpowers/specs/2026-04-12-market-share-button-design.md`

**Verification requirement:** All features MUST be verified with live data against real running servers (backend + frontend) before reporting completion. No mock data. The share must create a real record in Supabase, the OG image must render with real market metrics, the redirect page must serve real OG tags, and the email must send via Resend. Open `/market/29460?type=metro&view=investor` in a browser and exercise every share channel.

---

## File Structure

| File                                                                         | Action | Responsibility                                                       |
| ---------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| `packages/backend/src/analytics-persistence/shares.service.ts`               | Modify | Add `market_share` content type + `MarketShareContent` interface     |
| `packages/backend/src/analytics-persistence/shares.controller.ts`            | Modify | Add `POST /analytics/shares/market-email` endpoint                   |
| `packages/backend/src/analytics-persistence/analytics-persistence.module.ts` | Modify | Import `EmailModule`                                                 |
| `packages/frontend/app/api/og/route.tsx`                                     | Modify | Add metric params (homeValue, appreciation, dom, supply) to OG image |
| `packages/frontend/lib/data/fetchers/shares.ts`                              | Create | `createMarketShare()` + `sendMarketShareEmail()` fetchers            |
| `packages/frontend/lib/data/index.ts`                                        | Modify | Export new share fetchers                                            |
| `packages/frontend/app/market/[id]/components/ShareMarketModal.tsx`          | Create | Share modal with all channels + email form                           |
| `packages/frontend/app/market/[id]/components/index.ts`                      | Modify | Export `ShareMarketModal`                                            |
| `packages/frontend/app/market/[id]/MarketDashboard.tsx`                      | Modify | Wire share modal to header button                                    |
| `packages/frontend/app/s/[token]/page.tsx`                                   | Create | Share redirect page with dynamic OG metadata                         |

---

## Task 1: Extend Backend Share Types

**Files:**

- Modify: `packages/backend/src/analytics-persistence/shares.service.ts:12-55`

- [ ] **Step 1: Add `market_share` to `content_type` union**

In `shares.service.ts`, update the `Share` interface `content_type` field:

```typescript
content_type: "query_result" |
  "comparison" |
  "chart" |
  "conversation" |
  "report" |
  "market_share";
```

- [ ] **Step 2: Add `MarketShareContent` to `ShareContent` interface**

Add the `market` field to `ShareContent`:

```typescript
export interface ShareContent {
  query?: string;
  result?: unknown;
  chart_config?: unknown;
  conversation_id?: string;
  geographies?: Array<{
    type: string;
    id: string;
    name?: string;
  }>;
  metrics?: string[];
  date_range?: {
    start: string;
    end: string;
  };
  // Market share fields
  market?: {
    geoLevel: string;
    geoId: string;
    geoName: string;
    score?: number;
    homeValue?: string;
    appreciation?: string;
    dom?: string;
    supply?: string;
    channel?: string;
  };
}
```

- [ ] **Step 3: Update `CreateShareDto` to accept the new content type**

The `content_type` field in `CreateShareDto` references `Share['content_type']`, so it picks up the union change automatically. Verify by reading the type:

```typescript
export interface CreateShareDto {
  title?: string;
  description?: string;
  content_type: Share["content_type"]; // Already includes 'market_share'
  content: ShareContent;
  is_public?: boolean;
  password?: string;
  allowed_emails?: string[];
  expires_in_days?: number;
  max_views?: number;
}
```

No change needed — just verify it compiles.

- [ ] **Step 4: Verify backend compiles**

Run: `cd packages/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/analytics-persistence/shares.service.ts
git commit -m "feat(shares): add market_share content type and MarketShareContent interface"
```

---

## Task 2: Add Market Share Email Endpoint

**Files:**

- Modify: `packages/backend/src/analytics-persistence/shares.controller.ts`
- Modify: `packages/backend/src/analytics-persistence/analytics-persistence.module.ts`

- [ ] **Step 1: Import `EmailModule` in `AnalyticsPersistenceModule`**

In `analytics-persistence.module.ts`, add `EmailModule` to imports:

```typescript
import { EmailModule } from "../email/email.module";

@Module({
  imports: [SupabaseModule, EntitlementsModule, EmailModule],
  // ... rest unchanged
})
export class AnalyticsPersistenceModule {}
```

- [ ] **Step 2: Inject `EmailService` into `SharesController`**

In `shares.controller.ts`, add the import and inject:

```typescript
import { EmailService } from '../email/email.service';

@Controller('analytics/shares')
export class SharesController {
  private readonly logger = new Logger(SharesController.name);

  constructor(
    private readonly sharesService: SharesService,
    private readonly emailService: EmailService,
  ) {}
  // ... existing methods unchanged
```

- [ ] **Step 3: Add the `market-email` endpoint**

Add this method to `SharesController` after the existing `create` method:

```typescript
  /**
   * Send a market share via email
   * POST /api/analytics/shares/market-email
   */
  @UseGuards(JwtAuthGuard)
  @Post('market-email')
  async sendMarketEmail(
    @AuthUserId() userId: string,
    @Body() body: { shareToken: string; recipientEmail: string; message?: string },
  ) {
    this.logger.log(`POST /analytics/shares/market-email for user ${userId}`);

    if (!body.shareToken || !body.recipientEmail) {
      throw new HttpException(
        'shareToken and recipientEmail are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.recipientEmail)) {
      throw new HttpException('Invalid email address', HttpStatus.BAD_REQUEST);
    }

    try {
      const share = await this.sharesService.getByToken(body.shareToken);
      if (!share || share.content_type !== 'market_share') {
        throw new HttpException('Share not found', HttpStatus.NOT_FOUND);
      }

      const market = share.content?.market;
      const geoName = market?.geoName || share.title || 'a market';
      const shareUrl = `${process.env.FRONTEND_URL || 'https://propertyiq.app'}/s/${body.shareToken}`;

      const scoreSection = market?.score != null
        ? `<p style="font-size:18px;color:#3949AB;font-weight:700;">PropertyIQ Score: ${Math.round(market.score)}</p>`
        : '';

      const metricsHtml = [
        market?.homeValue && `<td style="padding:0 16px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#1A237E;">${market.homeValue}</div><div style="font-size:12px;color:#64748b;">Home Value</div></td>`,
        market?.appreciation && `<td style="padding:0 16px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#1A237E;">${market.appreciation}</div><div style="font-size:12px;color:#64748b;">YoY Change</div></td>`,
        market?.dom && `<td style="padding:0 16px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#1A237E;">${market.dom}</div><div style="font-size:12px;color:#64748b;">Days on Mkt</div></td>`,
        market?.supply && `<td style="padding:0 16px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#1A237E;">${market.supply}</div><div style="font-size:12px;color:#64748b;">Supply</div></td>`,
      ].filter(Boolean).join('');

      const messageSection = body.message
        ? `<p style="font-size:14px;color:#475569;background:#f1f5f9;padding:12px 16px;border-radius:8px;margin:16px 0;">"${body.message}"</p>`
        : '';

      const html = `
        <div style="max-width:560px;margin:0 auto;font-family:Roboto,Arial,sans-serif;">
          <div style="background:linear-gradient(145deg,#0f172a,#1e293b);border-radius:12px;padding:32px;color:#f1f5f9;margin-bottom:24px;">
            <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">● PropertyIQ</p>
            <h1 style="font-size:28px;font-weight:800;margin:0 0 4px;color:#f8fafc;">${geoName}</h1>
            <p style="font-size:14px;color:#94a3b8;margin:0;">Market Analysis</p>
            ${scoreSection}
          </div>
          ${metricsHtml ? `<table style="margin:0 auto 24px;"><tr>${metricsHtml}</tr></table>` : ''}
          ${messageSection}
          <a href="${shareUrl}" style="display:block;text-align:center;background:#3949AB;color:#fff;padding:14px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:16px;">View Market Report</a>
          <p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:24px;">Sent via <a href="https://propertyiq.app" style="color:#3949AB;">PropertyIQ</a></p>
        </div>
      `;

      const sent = await this.emailService.sendEmail({
        to: body.recipientEmail,
        subject: `Check out ${geoName} on PropertyIQ`,
        html,
        emailType: 'market_share',
        userId,
        metadata: { shareToken: body.shareToken, geoName },
      });

      if (!sent) {
        throw new HttpException('Failed to send email', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Market email failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
```

**Important:** This `@Post('market-email')` route must be declared BEFORE the `@Get(':id')` route in the controller, otherwise NestJS will interpret `market-email` as a route parameter for `:id`. Move the method above `getById`.

- [ ] **Step 4: Verify backend compiles**

Run: `cd packages/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/analytics-persistence/
git commit -m "feat(shares): add market share email endpoint via Resend"
```

---

## Task 3: Enhance OG Image with Metrics

**Files:**

- Modify: `packages/frontend/app/api/og/route.tsx`

- [ ] **Step 1: Parse new query params**

After the existing `insight` param parsing (around line 48), add:

```typescript
const homeValue = searchParams.get("homeValue");
const appreciation = searchParams.get("appreciation");
const dom = searchParams.get("dom");
const supply = searchParams.get("supply");

const metrics = [
  homeValue && { value: homeValue, label: "Home Value" },
  appreciation && { value: appreciation, label: "YoY Change" },
  dom && { value: dom, label: "Days on Mkt" },
  supply && { value: supply, label: "Supply" },
].filter(Boolean) as Array<{ value: string; label: string }>;
```

- [ ] **Step 2: Add metrics row to the image JSX**

After the score block closing `)}` (around line 194), before the bottom accent line `<div>`, add:

```typescript
      {/* Metrics row */}
      {metrics.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "40px",
            marginTop: score !== null ? "36px" : "24px",
          }}
        >
          {metrics.map((m) => (
            <div
              key={m.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "#f8fafc",
                }}
              >
                {m.value}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 400,
                  color: "#94a3b8",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.05em",
                }}
              >
                {m.label}
              </span>
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 3: Test OG image in browser**

Open in browser: `http://localhost:3000/api/og?title=Lakeland-Winter%20Haven,%20FL&score=72&homeValue=$312K&appreciation=+4.2%25&dom=24%20days&supply=3.2%20mo`

Expected: 1200x630 image with title, score circle, and a row of 4 metrics.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/api/og/route.tsx
git commit -m "feat(og): add market metrics row to OG image card"
```

---

## Task 4: Create Frontend Share Fetchers

**Files:**

- Create: `packages/frontend/lib/data/fetchers/shares.ts`
- Modify: `packages/frontend/lib/data/index.ts`

- [ ] **Step 1: Create the shares fetcher file**

Create `packages/frontend/lib/data/fetchers/shares.ts`:

```typescript
/**
 * SHARE FETCHERS
 *
 * API functions for creating and managing share links.
 */

import { getAuthHeaders } from "./auth-headers";
import { API_URL } from "./base";

export interface CreateMarketShareData {
  geoLevel: string;
  geoId: string;
  geoName: string;
  score?: number;
  homeValue?: string;
  appreciation?: string;
  dom?: string;
  supply?: string;
  channel?: string;
}

export interface MarketShareResult {
  shareToken: string;
  shareUrl: string;
}

/**
 * Create a tracked share link for a market page.
 * Returns the share token and full URL.
 */
export async function createMarketShare(
  data: CreateMarketShareData,
): Promise<MarketShareResult> {
  const authHeaders = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/analytics/shares`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      title: data.geoName,
      description: `Market report for ${data.geoName}`,
      content_type: "market_share",
      content: {
        market: {
          geoLevel: data.geoLevel,
          geoId: data.geoId,
          geoName: data.geoName,
          score: data.score,
          homeValue: data.homeValue,
          appreciation: data.appreciation,
          dom: data.dom,
          supply: data.supply,
          channel: data.channel,
        },
      },
      is_public: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create share: ${response.statusText}`);
  }

  const result = await response.json();
  const token = result.data.share_token;

  return {
    shareToken: token,
    shareUrl: `${window.location.origin}/s/${token}`,
  };
}

/**
 * Send a market share link via email using Resend.
 */
export async function sendMarketShareEmail(data: {
  shareToken: string;
  recipientEmail: string;
  message?: string;
}): Promise<void> {
  const authHeaders = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/analytics/shares/market-email`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to send email");
  }
}
```

- [ ] **Step 2: Export from `lib/data/index.ts`**

Add to the exports in `lib/data/index.ts`, after the Reports section:

```typescript
  // Shares
  createMarketShare,
  sendMarketShareEmail,
  type CreateMarketShareData,
  type MarketShareResult,
```

And add the corresponding re-export line where fetchers are imported (follow the existing pattern in the file).

- [ ] **Step 3: Verify frontend compiles**

Run: `cd packages/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors related to shares.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/lib/data/fetchers/shares.ts packages/frontend/lib/data/index.ts
git commit -m "feat(data): add market share fetcher functions"
```

---

## Task 5: Build the Share Modal

**Files:**

- Create: `packages/frontend/app/market/[id]/components/ShareMarketModal.tsx`
- Modify: `packages/frontend/app/market/[id]/components/index.ts`

- [ ] **Step 1: Create `ShareMarketModal.tsx`**

Create `packages/frontend/app/market/[id]/components/ShareMarketModal.tsx`:

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import {
  X,
  Link,
  Mail,
  Check,
  Download,
  Loader2,
  Send,
} from "lucide-react";
import {
  createMarketShare,
  sendMarketShareEmail,
  type MarketShareResult,
} from "@/lib/data";

interface ShareMarketModalProps {
  open: boolean;
  onClose: () => void;
  geoLevel: string;
  geoId: string;
  geoName: string;
  score?: number;
  homeValue?: string;
  appreciation?: string;
  dom?: string;
  supply?: string;
}

// Social platform configs
const SOCIAL_PLATFORMS = [
  {
    id: "twitter",
    label: "X (Twitter)",
    icon: "𝕏",
    getUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: "f",
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: "in",
    getUrl: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "reddit",
    label: "Reddit",
    icon: "r/",
    getUrl: (url: string, text: string) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
] as const;

export function ShareMarketModal({
  open,
  onClose,
  geoLevel,
  geoId,
  geoName,
  score,
  homeValue,
  appreciation,
  dom,
  supply,
}: ShareMarketModalProps) {
  const [share, setShare] = useState<MarketShareResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create share record when modal opens
  useEffect(() => {
    if (!open || share || isCreating) return;

    setIsCreating(true);
    setError(null);

    createMarketShare({
      geoLevel,
      geoId,
      geoName,
      score,
      homeValue,
      appreciation,
      dom,
      supply,
    })
      .then(setShare)
      .catch((err) => setError(err.message))
      .finally(() => setIsCreating(false));
  }, [open, share, isCreating, geoLevel, geoId, geoName, score, homeValue, appreciation, dom, supply]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setShare(null);
      setCopied(false);
      setShowEmail(false);
      setEmailTo("");
      setEmailMessage("");
      setEmailSending(false);
      setEmailSent(false);
      setEmailError(null);
      setError(null);
    }
  }, [open]);

  const handleCopyLink = useCallback(async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.shareUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = share.shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [share]);

  const handleSocialShare = useCallback(
    (platformId: string) => {
      if (!share) return;
      const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId);
      if (!platform) return;
      const text = `Check out the ${geoName} market on PropertyIQ`;
      const url = platform.getUrl(share.shareUrl, text);
      window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
    },
    [share, geoName],
  );

  const handleDownloadCard = useCallback(async () => {
    const params = new URLSearchParams({ title: geoName });
    if (score != null) params.set("score", String(Math.round(score)));
    if (homeValue) params.set("homeValue", homeValue);
    if (appreciation) params.set("appreciation", appreciation);
    if (dom) params.set("dom", dom);
    if (supply) params.set("supply", supply);

    const ogUrl = `/api/og?${params.toString()}`;
    const response = await fetch(ogUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `propertyiq-${geoName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [geoName, score, homeValue, appreciation, dom, supply]);

  const handleSendEmail = useCallback(async () => {
    if (!share || !emailTo) return;

    setEmailSending(true);
    setEmailError(null);

    try {
      await sendMarketShareEmail({
        shareToken: share.shareToken,
        recipientEmail: emailTo,
        message: emailMessage || undefined,
      });
      setEmailSent(true);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setEmailSending(false);
    }
  }, [share, emailTo, emailMessage]);

  if (!open) return null;

  const ogPreviewParams = new URLSearchParams({ title: geoName });
  if (score != null) ogPreviewParams.set("score", String(Math.round(score)));
  if (homeValue) ogPreviewParams.set("homeValue", homeValue);
  if (appreciation) ogPreviewParams.set("appreciation", appreciation);
  if (dom) ogPreviewParams.set("dom", dom);
  if (supply) ogPreviewParams.set("supply", supply);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-surface rounded-[28px] shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">
              Share this market
            </h2>
            <p className="text-sm text-on-surface-variant">{geoName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container transition-colors"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {/* OG Card Preview */}
        <div className="px-6 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/og?${ogPreviewParams.toString()}`}
            alt={`${geoName} market card`}
            className="w-full rounded-xl border border-outline-variant"
          />
        </div>

        {/* Error state */}
        {error && (
          <div className="px-6 pb-4">
            <p className="text-sm text-error bg-error/10 rounded-xl px-4 py-3">
              Failed to create share link. Please try again.
            </p>
          </div>
        )}

        {/* Loading state */}
        {isCreating && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {/* Share channels */}
        {share && !error && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-3">
              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline-variant hover:bg-surface-container transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Link className="w-5 h-5 text-primary" />
                )}
                <span className="text-sm font-medium text-on-surface">
                  {copied ? "Copied!" : "Copy Link"}
                </span>
              </button>

              {/* Email */}
              <button
                onClick={() => setShowEmail(!showEmail)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                  showEmail
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant hover:bg-surface-container"
                }`}
              >
                <Mail className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-on-surface">
                  Email
                </span>
              </button>

              {/* Social platforms */}
              {SOCIAL_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handleSocialShare(platform.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline-variant hover:bg-surface-container transition-colors"
                >
                  <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-primary">
                    {platform.icon}
                  </span>
                  <span className="text-sm font-medium text-on-surface">
                    {platform.label}
                  </span>
                </button>
              ))}

              {/* Download Card */}
              <button
                onClick={handleDownloadCard}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline-variant hover:bg-surface-container transition-colors col-span-2"
              >
                <Download className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-on-surface">
                  Download Card Image
                </span>
                <span className="text-xs text-on-surface-variant ml-auto">
                  For TikTok / Instagram
                </span>
              </button>
            </div>

            {/* Email form */}
            {showEmail && (
              <div className="mt-4 p-4 rounded-xl bg-surface-container">
                {emailSent ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="w-5 h-5" />
                    <span className="text-sm font-medium">Email sent!</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="Recipient email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface text-sm focus:outline-none focus:border-primary"
                    />
                    <textarea
                      placeholder="Add a message (optional)"
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface text-sm resize-none focus:outline-none focus:border-primary"
                    />
                    {emailError && (
                      <p className="text-xs text-error">{emailError}</p>
                    )}
                    <button
                      onClick={handleSendEmail}
                      disabled={!emailTo || emailSending}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full bg-primary text-on-primary text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {emailSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {emailSending ? "Sending..." : "Send"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from component index**

In `packages/frontend/app/market/[id]/components/index.ts`, add:

```typescript
export { ShareMarketModal } from "./ShareMarketModal";
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd packages/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors related to ShareMarketModal.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/market/[id]/components/ShareMarketModal.tsx packages/frontend/app/market/[id]/components/index.ts
git commit -m "feat(market): add share modal with social, email, and download channels"
```

---

## Task 6: Wire Share Modal to Market Dashboard

**Files:**

- Modify: `packages/frontend/app/market/[id]/MarketDashboard.tsx`

- [ ] **Step 1: Add modal state and replace `handleShareMarket`**

In `MarketDashboard.tsx`, add state for modal visibility:

```typescript
const [shareModalOpen, setShareModalOpen] = useState(false);
```

Remove the existing `handleShareMarket` callback (lines 55-61):

```typescript
// DELETE this block:
const handleShareMarket = useCallback(async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
  } catch {
    // Fallback: silent
  }
}, []);
```

- [ ] **Step 2: Update DashboardHeader `onShare` prop**

Change the `onShare` prop on `DashboardHeader`:

```typescript
onShare={() => setShareModalOpen(true)}
```

- [ ] **Step 3: Add `ShareMarketModal` render**

Import `ShareMarketModal` from `./components` and add the modal render at the end of the return, before the closing `</div>`:

```typescript
import {
  DashboardHeader,
  ViewToggle,
  ScoreColumn,
  MetricCategorySection,
  QuickActions,
  MobileViewToggle,
  DashboardLoadingSpinner,
  DashboardErrorState,
  DashboardGeoGateWall,
  ShareMarketModal,
  PREMIUM_GEO_LEVELS,
} from "./components";
```

And in the JSX, after `</main>`:

```typescript
      <ShareMarketModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        geoLevel={geographyType}
        geoId={geographyId}
        geoName={geography.name}
        score={primaryScore?.score}
        homeValue={displayData["home_value"]?.formattedValue}
        appreciation={
          displayData["home_value"]?.percentChange != null
            ? `${displayData["home_value"].percentChange > 0 ? "+" : ""}${displayData["home_value"].percentChange.toFixed(1)}%`
            : undefined
        }
        dom={displayData["median_dom"]?.formattedValue}
        supply={displayData["months_of_supply"]?.formattedValue}
      />
```

- [ ] **Step 4: Verify frontend compiles**

Run: `cd packages/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/market/[id]/MarketDashboard.tsx
git commit -m "feat(market): wire share modal to dashboard header button"
```

---

## Task 7: Create Share Redirect Page

**Files:**

- Create: `packages/frontend/app/s/[token]/page.tsx`

- [ ] **Step 1: Create the redirect page**

Create `packages/frontend/app/s/[token]/page.tsx`:

```typescript
import { cache } from "react";
import type { Metadata } from "next";
import { ShareRedirectClient } from "./ShareRedirectClient";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://propertyiq.app";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

// cache() deduplicates across generateMetadata + page render in a single request,
// preventing double view-count increments from the access endpoint.
const fetchShareData = cache(async function fetchShareData(token: string) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/analytics/shares/access/${token}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    return json.data;
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const share = await fetchShareData(token);

  if (!share || share.content_type !== "market_share") {
    return { title: "PropertyIQ" };
  }

  const market = share.content?.market;
  const geoName = market?.geoName || share.title || "Market Report";
  const score = market?.score;

  const descriptionParts = [];
  if (score != null) descriptionParts.push(`PropertyIQ Score: ${Math.round(score)}`);
  if (market?.homeValue) descriptionParts.push(`Home Value: ${market.homeValue}`);
  if (market?.appreciation) descriptionParts.push(`YoY: ${market.appreciation}`);
  if (market?.dom) descriptionParts.push(`DOM: ${market.dom}`);
  if (market?.supply) descriptionParts.push(`Supply: ${market.supply}`);
  const description = descriptionParts.join(" · ") || `Market report for ${geoName}`;

  const ogParams = new URLSearchParams({ title: geoName });
  if (score != null) ogParams.set("score", String(Math.round(score)));
  if (market?.homeValue) ogParams.set("homeValue", market.homeValue);
  if (market?.appreciation) ogParams.set("appreciation", market.appreciation);
  if (market?.dom) ogParams.set("dom", market.dom);
  if (market?.supply) ogParams.set("supply", market.supply);

  const ogImageUrl = `${SITE_URL}/api/og?${ogParams.toString()}`;

  return {
    title: `${geoName} Market Report — PropertyIQ`,
    description,
    openGraph: {
      title: `${geoName} Market Report — PropertyIQ`,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${geoName} Market Report — PropertyIQ`,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const share = await fetchShareData(token);

  if (!share) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center max-w-md px-6">
          <div className="w-3 h-3 rounded-full bg-primary mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-on-surface mb-2">
            Link Expired or Not Found
          </h1>
          <p className="text-sm text-on-surface-variant mb-6">
            This share link is no longer available. It may have expired or been
            removed.
          </p>
          <a
            href="/market"
            className="inline-block px-6 py-2.5 rounded-full bg-primary text-on-primary text-sm font-medium"
          >
            Browse Markets
          </a>
        </div>
      </div>
    );
  }

  const market = share.content?.market;
  const redirectUrl = market
    ? `/market/${market.geoId}?type=${market.geoLevel}`
    : "/market";

  return <ShareRedirectClient redirectUrl={redirectUrl} geoName={market?.geoName} />;
}
```

- [ ] **Step 2: Create the client redirect component**

Create `packages/frontend/app/s/[token]/ShareRedirectClient.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ShareRedirectClientProps {
  redirectUrl: string;
  geoName?: string;
}

export function ShareRedirectClient({
  redirectUrl,
  geoName,
}: ShareRedirectClientProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace(redirectUrl);
  }, [router, redirectUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <div className="w-3 h-3 rounded-full bg-primary mx-auto mb-4 animate-pulse" />
        <p className="text-sm text-on-surface-variant">
          Redirecting to {geoName || "market report"}…
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd packages/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/s/
git commit -m "feat(share): add /s/[token] redirect page with dynamic OG metadata"
```

---

## Task 8: Live End-to-End Verification (REQUIRED — no mock data)

**Files:** None — testing only. ALL verification must use live running servers with real Supabase data.

- [ ] **Step 1: Start dev servers**

Start both frontend and backend. Verify backend connects to Supabase (check console for connection logs):

```bash
cd packages/backend && npm run start:dev &
cd packages/frontend && npm run dev &
```

Wait for both to be ready before proceeding.

- [ ] **Step 2: Navigate to a real market page in a browser**

Open in Playwright or a real browser: `http://localhost:3000/market/29460?type=metro&view=investor`

Verify the page loads with **real data** — check that the PIQ score, home value, and other metrics are populated (not "--" or loading forever). If the page doesn't load or shows errors, debug before proceeding.

- [ ] **Step 3: Click Share button and verify modal with live data**

Click the Share button. Verify:

- Modal opens showing the OG card preview with the **actual market name** from the database (e.g., "Lakeland-Winter Haven, FL")
- The card preview shows the **real PIQ score** and **real metric values** from the dashboard
- Share record was created in Supabase — verify by checking backend logs for `Created share for user`
- Grid of share channels renders: Copy Link, Email, X, Facebook, LinkedIn, Reddit, Download Card

- [ ] **Step 4: Test Copy Link with real share token**

Click "Copy Link". Verify:

- Icon changes to green check, text changes to "Copied!"
- Paste from clipboard — must be a URL like `http://localhost:3000/s/<real-token>`
- The token is a real base64url string, not a placeholder

- [ ] **Step 5: Test social share opens correct URL**

Click "X (Twitter)". Verify:

- New window opens to `twitter.com/intent/tweet` with the real share URL pre-filled
- The share URL in the tweet compose window is the `/s/<token>` URL, not the raw market page URL

- [ ] **Step 6: Test Download Card produces real image**

Click "Download Card Image". Verify:

- PNG file downloads
- Open the downloaded image — it must show the **real market name, real score, and real metrics** from the database, not placeholder values

- [ ] **Step 7: Test email sends via Resend**

Click Email, enter a real test email address and an optional message, click Send. Verify:

- Backend logs show `POST /analytics/shares/market-email` request
- Email is actually delivered (check inbox or Resend dashboard)
- Email contains the real market name and a working link
- If `RESEND_API_KEY` is not set locally, backend should log `[DEV] Would send email` — this is acceptable for local dev, but note it in the report

- [ ] **Step 8: Test redirect page with real share token**

Open the share URL from Step 4 in a browser. Verify:

- Brief "Redirecting to..." message appears with the **real market name**
- Page redirects to `/market/29460?type=metro`
- The redirected market page loads with real data

- [ ] **Step 9: Verify OG tags are served with real data**

```bash
curl -s http://localhost:3000/s/<token-from-step-4> | grep -i "og:"
```

Verify:

- `og:title` contains the real market name (e.g., "Lakeland-Winter Haven, FL Market Report")
- `og:description` contains real score and metric values
- `og:image` URL points to `/api/og` with real query params
- Fetch the `og:image` URL directly — verify it returns a valid PNG

- [ ] **Step 10: Verify share record exists in Supabase**

Check the database has a real share record:

```bash
curl -s "http://localhost:3001/api/analytics/shares" -H "Authorization: Bearer <jwt>" | head -50
```

Or check backend logs. Verify:

- `content_type` is `market_share`
- `content.market` contains real geo data matching the market page
- `view_count` incremented after Step 8

- [ ] **Step 11: Commit any fixes discovered during testing**

If any issues found during live testing, fix the root cause (not a band-aid) and commit with a descriptive message. Re-run the failing verification step after fixing.

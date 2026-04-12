# Market Share Button — Design Spec

**Date:** 2026-04-12
**Status:** Draft
**Scope:** Share modal, tracked share links, OG image enhancement, email sharing for `/market/[id]` pages

---

## 1. Overview

Replace the broken share button on market report pages with a full share experience: a modal offering link copying, social media sharing (X, Facebook, LinkedIn, Reddit), card image download (for TikTok/Instagram), and email sharing via Resend. Every share generates a tracked short URL (`/s/[token]`) that serves dynamic OG metadata for rich social previews and counts views before redirecting to the market page.

## 2. Share Flow

1. User clicks Share on any `/market/[id]` page.
2. Share modal opens.
3. User selects a channel.
4. Frontend POSTs to `POST /api/analytics/shares` with `content_type: 'market_share'` and market data payload. Backend returns a `share_token`.
5. The tracked URL `propertyiq.com/s/{token}` is used for all channels.
6. When someone visits `/s/{token}`:
   - Page serves HTML with dynamic OG `<meta>` tags (title, description, og:image pointing to `/api/og`).
   - Backend increments view count via existing `access` endpoint.
   - Client-side JS redirects visitor to `/market/[geoId]?type=[geoLevel]`.
   - Social crawlers (which don't execute JS) read the OG tags and render the rich card.

## 3. OG Image Enhancement

### Existing Route

`/api/og` — Edge function returning 1200x630 PNG via `next/og` `ImageResponse`. Currently accepts `title`, `score`, `insight`.

### New Parameters

| Param          | Example   | Description                 |
| -------------- | --------- | --------------------------- |
| `homeValue`    | `$312K`   | Pre-formatted home value    |
| `appreciation` | `+4.2%`   | Pre-formatted YoY change    |
| `dom`          | `24 days` | Pre-formatted days on mkt   |
| `supply`       | `3.2 mo`  | Pre-formatted months supply |

All values are pre-formatted strings — the OG route renders them as-is with no formatting logic.

### Card Layout

```
┌─────────────────────────────────────────────────┐
│  ● PropertyIQ                                   │
│                                                  │
│  Lakeland-Winter Haven, FL                       │
│  Metro Market Analysis                           │
│                                                  │
│  ┌──────┐                                        │
│  │  72  │  GOOD                                  │
│  └──────┘  PropertyIQ Score                      │
│                                                  │
│  $312K        +4.2%        24 days      3.2 mo   │
│  Home Value   YoY Change   Days on Mkt  Supply   │
│                                                  │
│  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │
└─────────────────────────────────────────────────┘
```

Metrics row renders as four equal columns below the score block. Each column has the value (large, white) and label (smaller, muted).

## 4. Share Modal UI

### Component

`packages/frontend/app/market/[id]/components/ShareMarketModal.tsx`

### Structure

M3 dialog (`rounded-[28px]`, `shadow-lg`) with:

- **Header:** Market name + "Share this market" subtitle
- **OG card preview:** Thumbnail of the generated card (fetched from `/api/og` with params)
- **Channel grid (2 columns):**

| Channel       | Icon     | Behavior                                          |
| ------------- | -------- | ------------------------------------------------- |
| Copy Link     | Link     | Copy tracked URL to clipboard, "Copied!" feedback |
| Email         | Mail     | Expand inline email form                          |
| X (Twitter)   | X logo   | Open `twitter.com/intent/tweet?url=...&text=...`  |
| Facebook      | FB logo  | Open `facebook.com/sharer/sharer.php?u=...`       |
| LinkedIn      | LI logo  | Open `linkedin.com/sharing/share-offsite?url=...` |
| Reddit        | Reddit   | Open `reddit.com/submit?url=...&title=...`        |
| Download Card | Download | Download OG image as PNG (for TikTok/Instagram)   |

- **Email sub-form** (expands when Email is tapped):
  - Recipient email input (required, validated)
  - Optional message textarea
  - Send button
  - Loading/success/error states

### Behavior

- Modal opens → immediately creates share record (POST) → gets token → all channels use that token URL.
- One share record per modal open. The `channel` field records the first channel the user selects.
- Copy Link shows green check + "Copied!" for 2 seconds.
- Social links open in `window.open()` with appropriate dimensions.
- Download Card fetches `/api/og?...` as a blob and triggers download.
- Email posts to `POST /api/shares/market/email`.

## 5. Backend Changes

### 5.1 Extend Share Content Type

In `shares.service.ts`, add `'market_share'` to the `content_type` union:

```typescript
content_type: "query_result" |
  "comparison" |
  "chart" |
  "conversation" |
  "report" |
  "market_share";
```

Extend `ShareContent` interface:

```typescript
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
```

### 5.2 Market Share Email Endpoint

New endpoint: `POST /api/analytics/shares/market-email`

**Request body:**

```typescript
{
  shareToken: string;      // Existing share token
  recipientEmail: string;  // Validated email
  message?: string;        // Optional personal message
  senderName?: string;     // From auth user profile
}
```

**Behavior:**

1. Validates share token exists and is `market_share` type.
2. Sends email via Resend with:
   - Subject: `"Check out {geoName} on PropertyIQ"`
   - HTML body: OG card image (as hosted URL, not attachment), market link, optional message, PropertyIQ branding.
3. Returns success/error.

**Auth:** Requires JWT (only authenticated users can send share emails).

### 5.3 No New Database Migration

The existing `analytics_shares` table already supports the `content` JSONB column and all needed fields (token, view_count, expires_at, etc.). Adding `'market_share'` as a content_type value requires no schema change.

## 6. Frontend Redirect Page

### Route

`packages/frontend/app/s/[token]/page.tsx`

### Server Component Behavior

1. Fetch share record from `GET /api/analytics/shares/access/{token}` (server-side).
2. If not found or expired: render 404-style message.
3. If valid:
   - Export `generateMetadata()` returning dynamic OG tags:
     ```typescript
     title: `${geoName} Market Report — PropertyIQ`
     description: `PropertyIQ Score: ${score}. Home Value: ${homeValue}...`
     openGraph.images: [{ url: `/api/og?title=...&score=...&homeValue=...` }]
     twitter.card: 'summary_large_image'
     ```
   - Render minimal page with client-side redirect via `useEffect` + `router.push()`.
   - Show brief "Redirecting to market report..." message with PropertyIQ branding while redirect happens.

## 7. Frontend Data Layer

### New Fetcher

`packages/frontend/lib/data/fetchers/shares.ts`

```typescript
export async function createMarketShare(data: {
  geoLevel: string;
  geoId: string;
  geoName: string;
  score?: number;
  homeValue?: string;
  appreciation?: string;
  dom?: string;
  supply?: string;
  channel?: string;
}): Promise<{ shareToken: string; shareUrl: string }>;

export async function sendMarketShareEmail(data: {
  shareToken: string;
  recipientEmail: string;
  message?: string;
}): Promise<void>;
```

Export from `lib/data/index.ts`.

## 8. Integration with Market Dashboard

### MarketDashboard.tsx Changes

- Remove `handleShareMarket` callback.
- Add `useState<boolean>` for modal open state.
- Pass `onShare={() => setShareModalOpen(true)}` to `DashboardHeader`.
- Render `<ShareMarketModal>` with market data props (geoName, geoId, geoLevel, score, formatted metric values).

### DashboardHeader.tsx Changes

No changes needed — `onShare` prop already exists and triggers the callback.

### Metric Value Formatting

The modal receives pre-formatted metric strings from the dashboard. The dashboard already has access to the `cards` object from `useMarketSnapshot` which contains formatted values. Extract:

- `homeValue`: from cards, format as `$XXK` or `$X.XM`
- `appreciation`: from cards, format as `+X.X%` or `-X.X%`
- `dom`: from cards, format as `X days`
- `supply`: from cards, format as `X.X mo`

## 9. Error Handling

| Scenario                    | Behavior                                        |
| --------------------------- | ----------------------------------------------- |
| Share creation fails        | Toast error, modal stays open                   |
| Clipboard write fails       | Fallback to `execCommand('copy')`, then toast   |
| Email send fails            | Inline error message in email form              |
| Share token expired/invalid | `/s/[token]` shows "Link expired" page          |
| OG image generation fails   | Falls back to static OG image from brand assets |
| Missing metric data         | Omit that metric from the OG card               |

## 10. Files to Create/Modify

| File                                                       | Action | Purpose                        |
| ---------------------------------------------------------- | ------ | ------------------------------ |
| `frontend/app/market/[id]/components/ShareMarketModal.tsx` | Create | Share modal component          |
| `frontend/app/s/[token]/page.tsx`                          | Create | Redirect page with OG metadata |
| `frontend/app/api/og/route.tsx`                            | Modify | Add metric params to OG image  |
| `frontend/lib/data/fetchers/shares.ts`                     | Create | Share API fetcher functions    |
| `frontend/lib/data/index.ts`                               | Modify | Export new fetchers            |
| `frontend/app/market/[id]/MarketDashboard.tsx`             | Modify | Add modal state + render       |
| `frontend/app/market/[id]/components/index.ts`             | Modify | Export ShareMarketModal        |
| `backend/src/analytics-persistence/shares.service.ts`      | Modify | Add `market_share` type        |
| `backend/src/analytics-persistence/shares.controller.ts`   | Modify | Add market-email endpoint      |

## 11. Out of Scope

- Share analytics dashboard (viewing share stats per user) — future feature
- Password-protected market shares — infrastructure exists but not wired into modal
- Custom short domains (e.g., `piq.link/abc`) — use app domain for now
- Native `navigator.share()` API — could be added later for mobile

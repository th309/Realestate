# Monthly Market Newsletter Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically send a monthly, national (non-personalized) market newsletter to every confirmed `newsletter_signups` subscriber, reusing the existing email sender, Redis lock, and one-click unsubscribe infrastructure.

**Architecture:** A new backend `NewsletterService` cron (1st of month, 13:00 UTC) builds shared national content once — Market to Watch, Top Movers (risers + fallers), Top Markets leaderboard, and the newest 3 blog posts — then sends a new generic `market-newsletter.tsx` template to each confirmed, non-unsubscribed subscriber via `EmailService`. Idempotency and opt-out are tracked with two new `newsletter_signups` columns (`last_newsletter_sent_at`, `unsubscribed_at`). Unsubscribe reuses the existing signed-token flow with a new `newsletter` stream keyed on the subscriber row id.

**Tech Stack:** NestJS 11 (`@nestjs/schedule` cron, DI), Supabase JS (service-role client), React Email (`@propertyiq/emails`), Resend, Jest (backend unit tests).

## Global Constraints

- **Design source of truth:** `docs/superpowers/specs/2026-07-11-monthly-market-newsletter-delivery-design.md`.
- **No personalization:** content is national and identical for every recipient; the template takes no recipient name.
- **Recipients:** `newsletter_signups WHERE confirmed = true AND unsubscribed_at IS NULL`, further filtered to those not already sent this calendar month.
- **Idempotency without an email column:** `email_log` stores only `user_id`/`email_type`/`subject`/`metadata` (no recipient email), so dedup uses `newsletter_signups.last_newsletter_sent_at`, NOT `email_log`.
- **Account-less sends:** `EmailService.sendEmail` `userId` is optional — pass no `userId` for newsletter sends.
- **Cron gating:** every `@Cron` only registers when `process.env.RUN_CRONS === 'true'` (via `cronScheduleImports()`); do not add new env flags.
- **Migration ordering:** new migration filename timestamp MUST be greater than the latest existing (`20260621092257…`); use `20260711120000`. Supabase silently skips out-of-order (backdated) migrations.
- **Unsubscribe compliance:** keep the single first-party `/backend/api/email/unsubscribe` path with `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers; NEVER return 4xx/5xx for a bad token (hurts sender reputation).
- **PIQ score reads:** `propertyiq_scores` view, `score_type = 'propertyiq'`, `geography = 'metro'`; "latest" = most recent `score_date`, "previous" = the prior distinct `score_date`.
- **Brand copy:** momentum labels only, no quality words; the newsletter promises a **monthly** cadence (fix the stale "Weekly Market Insights" copy).
- **Commits:** no `Co-Authored-By`; commit with explicit pathspec on the current branch; verify branch before each commit.

## File Structure

| File                                                                 | Responsibility                                                                      |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `supabase/migrations/20260711120000_newsletter_delivery_columns.sql` | Adds `unsubscribed_at`, `last_newsletter_sent_at` to `newsletter_signups`           |
| `packages/backend/src/email/unsubscribe-token.util.ts` (modify)      | Add `newsletter` to `UnsubscribeStream` + valid-stream set                          |
| `packages/backend/src/email/unsubscribe-token.util.spec.ts` (modify) | Round-trip test for the `newsletter` stream                                         |
| `packages/backend/src/email/email.service.ts` (modify)               | Add `unsubscribeNewsletter(signupId)`                                               |
| `packages/backend/src/email/unsubscribe.controller.ts` (modify)      | Branch on `newsletter` stream → set `unsubscribed_at`; newsletter confirmation copy |
| `packages/backend/src/email/newsletter.types.ts` (create)            | Content payload + score-row types                                                   |
| `packages/backend/src/email/newsletter-selection.ts` (create)        | Pure selection helpers (top movers/markets/blog) — mock-free unit-tested            |
| `packages/backend/src/email/newsletter-selection.spec.ts` (create)   | Unit tests for the pure helpers                                                     |
| `packages/backend/src/email/newsletter-data.service.ts` (create)     | DB/HTTP fetching: subscribers, metro score rows, blog posts; mark-sent              |
| `packages/backend/src/email/newsletter.service.ts` (create)          | `@Cron` orchestration + per-recipient send                                          |
| `packages/backend/src/email/email.module.ts` (modify)                | Register `NewsletterService` + `NewsletterDataService`                              |
| `packages/emails/emails/market-newsletter.tsx` (create)              | Generic non-personalized template                                                   |
| `packages/emails/index.ts` (modify)                                  | Export `MarketNewsletter` + `MarketNewsletterProps`                                 |
| `packages/frontend/app/api/newsletter/confirm/route.ts` (modify)     | "Weekly" → "Monthly" copy                                                           |
| `packages/emails/emails/newsletter-confirmation.tsx` (modify)        | "Weekly" → "Monthly" copy                                                           |

---

### Task 1: Database migration — subscriber delivery columns

**Files:**

- Create: `supabase/migrations/20260711120000_newsletter_delivery_columns.sql`

**Interfaces:**

- Produces: two nullable columns on `newsletter_signups`: `unsubscribed_at TIMESTAMPTZ`, `last_newsletter_sent_at TIMESTAMPTZ`. Consumed by Tasks 3, 4, 6.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260711120000_newsletter_delivery_columns.sql`:

```sql
-- ============================================================================
-- Newsletter Delivery Columns
--
-- Adds delivery/opt-out tracking to newsletter_signups so the monthly market
-- newsletter cron can (a) skip subscribers already sent this month and
-- (b) honor one-click unsubscribes for account-less subscribers.
--
-- Both columns are nullable and backward compatible: existing rows get NULL,
-- meaning "never sent" and "still subscribed".
-- ============================================================================

BEGIN;

ALTER TABLE newsletter_signups
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_newsletter_sent_at TIMESTAMPTZ;

-- Recipient lookup: confirmed, not unsubscribed, ordered by last send.
CREATE INDEX IF NOT EXISTS idx_newsletter_signups_deliverable
  ON newsletter_signups (confirmed, unsubscribed_at, last_newsletter_sent_at);

COMMIT;
```

> Note: the existing `20260414140000_grant_newsletter_signups.sql` already grants
> `SELECT, INSERT, UPDATE ON newsletter_signups TO service_role`; table-level grants
> cover new columns, so no new GRANT is required.

- [ ] **Step 2: Apply the migration to Supabase**

Apply via the Supabase MCP `apply_migration` tool (project `pysflbhpnqwoczyuaaif`, name `newsletter_delivery_columns`) with the SQL above, or `supabase db push` if using the CLI.

- [ ] **Step 3: Verify the columns exist**

Run this query (Supabase MCP `execute_sql`, project `pysflbhpnqwoczyuaaif`):

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'newsletter_signups'
  AND column_name IN ('unsubscribed_at', 'last_newsletter_sent_at')
ORDER BY column_name;
```

Expected: two rows, both `timestamp with time zone`, `is_nullable = YES`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260711120000_newsletter_delivery_columns.sql
git commit -m "feat(newsletter): add delivery + unsubscribe columns to newsletter_signups"
```

---

### Task 2: Add the `newsletter` unsubscribe stream

**Files:**

- Modify: `packages/backend/src/email/unsubscribe-token.util.ts`
- Test: `packages/backend/src/email/unsubscribe-token.util.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `UnsubscribeStream` now includes `'newsletter'`; `verifyUnsubscribeToken` accepts and returns it. For the `newsletter` stream, the token's `userId` field carries the `newsletter_signups.id` (an opaque subject id). Consumed by Tasks 3 and 6.

- [ ] **Step 1: Write the failing test**

Add to `packages/backend/src/email/unsubscribe-token.util.spec.ts`:

```typescript
describe("newsletter stream", () => {
  const secret = "test-secret";

  it("round-trips a newsletter-stream token keyed on the signup row id", () => {
    const signupId = "11111111-2222-3333-4444-555555555555";
    const token = signUnsubscribeToken(signupId, "newsletter", secret);
    const payload = verifyUnsubscribeToken(token, secret);

    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(signupId);
    expect(payload?.stream).toBe("newsletter");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @propertyiq/backend -- unsubscribe-token.util.spec.ts`
Expected: FAIL — the `newsletter` token verifies to `null` because `'newsletter'` is not in `VALID_STREAMS`.

- [ ] **Step 3: Add `newsletter` to the type and valid-stream set**

In `packages/backend/src/email/unsubscribe-token.util.ts`, change the stream type and set:

```typescript
export type UnsubscribeStream = "marketing" | "weekly_digest" | "newsletter";

const VALID_STREAMS: ReadonlySet<string> = new Set<UnsubscribeStream>([
  "marketing",
  "weekly_digest",
  "newsletter",
]);
```

Also update the `UnsubscribeStream` doc comment above the type to note: `newsletter` opts a
`newsletter_signups` subscriber out of the monthly market newsletter (sets
`newsletter_signups.unsubscribed_at`); its token `userId` field carries the subscriber row id,
not a user account id.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace @propertyiq/backend -- unsubscribe-token.util.spec.ts`
Expected: PASS (all cases, including the existing `marketing`/`weekly_digest` tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/email/unsubscribe-token.util.ts packages/backend/src/email/unsubscribe-token.util.spec.ts
git commit -m "feat(newsletter): add newsletter unsubscribe stream to token util"
```

---

### Task 3: Wire the `newsletter` opt-out through EmailService + UnsubscribeController

**Files:**

- Modify: `packages/backend/src/email/email.service.ts`
- Modify: `packages/backend/src/email/unsubscribe.controller.ts`

**Interfaces:**

- Consumes: `unsubscribed_at` column (Task 1); `UnsubscribeStream = 'newsletter'` (Task 2).
- Produces: `EmailService.unsubscribeNewsletter(signupId: string): Promise<boolean>` — sets `newsletter_signups.unsubscribed_at = now()` for the row, returns success. The controller sets it when a `newsletter`-stream token is opted out.

- [ ] **Step 1: Add `unsubscribeNewsletter` to EmailService**

In `packages/backend/src/email/email.service.ts`, add this method to the `EmailService` class (near `updatePreferences`; it uses the already-injected `this.supabase`):

```typescript
/**
 * Opt an account-less newsletter subscriber out of the monthly market
 * newsletter by stamping `unsubscribed_at`. Idempotent; keyed on the
 * `newsletter_signups` row id carried in the unsubscribe token.
 */
async unsubscribeNewsletter(signupId: string): Promise<boolean> {
  const { error } = await this.supabase
    .from('newsletter_signups')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('id', signupId);

  if (error) {
    this.logger.error(
      `Failed to unsubscribe newsletter signup ${signupId}: ${error.message}`,
    );
    return false;
  }
  return true;
}
```

- [ ] **Step 2: Branch the controller's `applyOptOut` on the `newsletter` stream**

In `packages/backend/src/email/unsubscribe.controller.ts`, replace the `updates`/`updatePreferences` block inside `applyOptOut` (currently lines ~103-116) with a stream-aware branch:

```typescript
if (payload.stream === "newsletter") {
  const ok = await this.emailService.unsubscribeNewsletter(payload.userId);
  if (!ok) {
    this.logger.error(
      `Unsubscribe: failed to opt out newsletter signup ${payload.userId}`,
    );
    return null;
  }
  return payload.stream;
}

const updates =
  payload.stream === "weekly_digest"
    ? { weekly_digest: false }
    : { marketing: false };
const result = await this.emailService.updatePreferences(
  payload.userId,
  updates,
);
if (!result) {
  this.logger.error(
    `Unsubscribe: failed to update preferences for user ${payload.userId}`,
  );
  return null;
}
return payload.stream;
```

- [ ] **Step 3: Add newsletter confirmation-page copy**

In the same file, update `confirmationPage(stream)` so the `newsletter` stream shows its own lead. Replace the `lead` ternary with:

```typescript
const lead =
  stream === "weekly_digest"
    ? `You&rsquo;ve been unsubscribed from the PropertyIQ weekly market
           digest. You won&rsquo;t receive the Monday summary going forward.`
    : stream === "newsletter"
      ? `You&rsquo;ve been unsubscribed from the PropertyIQ monthly market
             newsletter. You won&rsquo;t receive the monthly market update going
             forward.`
      : `You&rsquo;ve been unsubscribed from PropertyIQ marketing emails. You
             won&rsquo;t receive onboarding tips, market digests, or promotional
             messages going forward.`;
```

- [ ] **Step 4: Build the backend to verify types compile**

Run: `npm run build --workspace @propertyiq/backend`
Expected: build succeeds with zero errors (fix ALL errors if any surface — a broken build is a broken build).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/email/email.service.ts packages/backend/src/email/unsubscribe.controller.ts
git commit -m "feat(newsletter): route newsletter opt-out to unsubscribed_at"
```

---

### Task 4: Newsletter content — types, pure selection helpers, and data service

**Files:**

- Create: `packages/backend/src/email/newsletter.types.ts`
- Create: `packages/backend/src/email/newsletter-selection.ts`
- Test: `packages/backend/src/email/newsletter-selection.spec.ts`
- Create: `packages/backend/src/email/newsletter-data.service.ts`

**Interfaces:**

- Consumes: `newsletter_signups` columns (Task 1); `propertyiq_scores` view; `geographies` table; `/api/blog/metadata` endpoint; `getEmailLinkBaseUrl` from `./email-link-base`.
- Produces:
  - Types: `MetroScoreRow`, `NewsletterMover`, `NewsletterTopMarket`, `NewsletterBlogPost`, `NewsletterContent`, `NewsletterRecipient`.
  - `selectNewsletterContent(rows: MetroScoreRow[]): { marketToWatch, topMovers, topMarkets }` (pure).
  - `sortRecentPosts(posts: RawBlogPost[], limit: number): NewsletterBlogPost[]` (pure).
  - `NewsletterDataService` with `getMetroScoreRows()`, `getRecentBlogPosts(limit)`, `getConfirmedRecipientsNotSentThisMonth()`, `markNewsletterSent(id)`.

- [ ] **Step 1: Create the types**

Create `packages/backend/src/email/newsletter.types.ts`:

```typescript
/**
 * Types for the monthly market newsletter — national content shared by every
 * recipient (no personalization).
 */

/** A metro's PIQ score at the latest and previous score dates. */
export interface MetroScoreRow {
  regionId: string;
  name: string;
  current: number;
  previous: number | null;
}

export interface NewsletterMover {
  name: string;
  oldScore: number;
  newScore: number;
  change: number;
  direction: "up" | "down";
}

export interface NewsletterTopMarket {
  name: string;
  piqScore: number;
}

export interface NewsletterMarketToWatch {
  name: string;
  reason: string;
}

export interface NewsletterBlogPost {
  title: string;
  description: string;
  url: string;
  date: string;
}

export interface NewsletterContent {
  marketToWatch: NewsletterMarketToWatch | null;
  topMovers: NewsletterMover[];
  topMarkets: NewsletterTopMarket[];
  blogPosts: NewsletterBlogPost[];
}

export interface NewsletterRecipient {
  id: string;
  email: string;
}

/** Raw shape returned by GET /api/blog/metadata (subset we use). */
export interface RawBlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
}
```

- [ ] **Step 2: Write the failing test for the pure selection helpers**

Create `packages/backend/src/email/newsletter-selection.spec.ts`:

```typescript
import {
  selectNewsletterContent,
  sortRecentPosts,
} from "./newsletter-selection";
import { MetroScoreRow, RawBlogPost } from "./newsletter.types";

describe("selectNewsletterContent", () => {
  const rows: MetroScoreRow[] = [
    { regionId: "1", name: "Alpha", current: 90, previous: 80 }, // +10 riser
    { regionId: "2", name: "Bravo", current: 60, previous: 75 }, // -15 faller
    { regionId: "3", name: "Charlie", current: 85, previous: 84 }, // +1
    { regionId: "4", name: "Delta", current: 70, previous: null }, // no prev → excluded from movers
    { regionId: "5", name: "Echo", current: 95, previous: 93 }, // +2, highest score
  ];

  it("picks the biggest riser as market-to-watch", () => {
    const { marketToWatch } = selectNewsletterContent(rows);
    expect(marketToWatch?.name).toBe("Alpha");
    expect(marketToWatch?.reason).toContain("10");
  });

  it("ranks top movers by absolute change, including fallers, excluding rows with no previous", () => {
    const { topMovers } = selectNewsletterContent(rows);
    expect(topMovers.map((m) => m.name)).toEqual([
      "Bravo",
      "Alpha",
      "Echo",
      "Charlie",
    ]);
    expect(topMovers[0].direction).toBe("down");
    expect(topMovers[1].direction).toBe("up");
  });

  it("ranks top markets by current score descending", () => {
    const { topMarkets } = selectNewsletterContent(rows);
    expect(topMarkets[0].name).toBe("Echo");
    expect(topMarkets[0].piqScore).toBe(95);
  });

  it("returns null market-to-watch when nothing is rising", () => {
    const flat: MetroScoreRow[] = [
      { regionId: "1", name: "Alpha", current: 50, previous: 55 },
    ];
    expect(selectNewsletterContent(flat).marketToWatch).toBeNull();
  });
});

describe("sortRecentPosts", () => {
  it("returns the newest N posts as {title, description, url, date}", () => {
    const posts: RawBlogPost[] = [
      { slug: "old", title: "Old", description: "o", date: "2026-01-01" },
      { slug: "new", title: "New", description: "n", date: "2026-06-01" },
      { slug: "mid", title: "Mid", description: "m", date: "2026-03-01" },
    ];
    const result = sortRecentPosts(posts, 2, "https://propertyiq.app");
    expect(result.map((p) => p.title)).toEqual(["New", "Mid"]);
    expect(result[0].url).toBe("https://propertyiq.app/blog/new");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --workspace @propertyiq/backend -- newsletter-selection.spec.ts`
Expected: FAIL with "Cannot find module './newsletter-selection'".

- [ ] **Step 4: Implement the pure helpers**

Create `packages/backend/src/email/newsletter-selection.ts`:

```typescript
import {
  MetroScoreRow,
  NewsletterBlogPost,
  NewsletterContent,
  RawBlogPost,
} from "./newsletter.types";

const TOP_MOVERS = 5;
const TOP_MARKETS = 8;

/**
 * Derive all three national content blocks from one set of metro score rows.
 * Movers require a previous score; market-to-watch is the single biggest riser.
 */
export function selectNewsletterContent(
  rows: MetroScoreRow[],
): Pick<NewsletterContent, "marketToWatch" | "topMovers" | "topMarkets"> {
  const withPrev = rows.filter(
    (r): r is MetroScoreRow & { previous: number } => r.previous != null,
  );

  const movers = withPrev
    .map((r) => {
      const change = Math.round(r.current - r.previous);
      return {
        name: r.name,
        oldScore: Math.round(r.previous),
        newScore: Math.round(r.current),
        change,
        direction: (change >= 0 ? "up" : "down") as "up" | "down",
      };
    })
    .filter((m) => m.change !== 0);

  const topMovers = [...movers]
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, TOP_MOVERS);

  const risers = movers
    .filter((m) => m.change > 0)
    .sort((a, b) => b.change - a.change);
  const best = risers[0] ?? null;
  const marketToWatch = best
    ? {
        name: best.name,
        reason: `PIQ score climbed ${best.change} points this month to ${best.newScore}, signaling improving demand momentum. Worth a spot on your watchlist.`,
      }
    : null;

  const topMarkets = [...rows]
    .sort((a, b) => b.current - a.current)
    .slice(0, TOP_MARKETS)
    .map((r) => ({ name: r.name, piqScore: Math.round(r.current) }));

  return { marketToWatch, topMovers, topMarkets };
}

/** Newest `limit` posts, mapped to the template's blog-post shape. */
export function sortRecentPosts(
  posts: RawBlogPost[],
  limit: number,
  baseUrl: string,
): NewsletterBlogPost[] {
  return [...posts]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit)
    .map((p) => ({
      title: p.title,
      description: p.description,
      url: `${baseUrl.replace(/\/+$/, "")}/blog/${p.slug}`,
      date: p.date,
    }));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace @propertyiq/backend -- newsletter-selection.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Implement the data service**

Create `packages/backend/src/email/newsletter-data.service.ts`:

```typescript
import { Injectable, Logger, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { getEmailLinkBaseUrl } from "./email-link-base";
import { sortRecentPosts } from "./newsletter-selection";
import {
  MetroScoreRow,
  NewsletterBlogPost,
  NewsletterRecipient,
  RawBlogPost,
} from "./newsletter.types";

@Injectable()
export class NewsletterDataService {
  private readonly logger = new Logger(NewsletterDataService.name);
  private readonly appUrl: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
  ) {
    this.appUrl = getEmailLinkBaseUrl(this.config);
  }

  /**
   * Metro PIQ scores at the latest and previous distinct score dates, joined to
   * region names. One fetch powers market-to-watch, top movers, and top markets.
   */
  async getMetroScoreRows(): Promise<MetroScoreRow[]> {
    const { data: dateRows } = await this.supabase
      .from("propertyiq_scores")
      .select("score_date")
      .eq("geography", "metro")
      .eq("score_type", "propertyiq")
      .order("score_date", { ascending: false })
      .limit(200);

    const uniqueDates = [...new Set((dateRows ?? []).map((d) => d.score_date))];
    if (!uniqueDates.length) return [];
    const latestDate = uniqueDates[0];
    const previousDate = uniqueDates[1] ?? null;

    const [{ data: latest }, previousResult] = await Promise.all([
      this.supabase
        .from("propertyiq_scores")
        .select("location_id, score")
        .eq("geography", "metro")
        .eq("score_type", "propertyiq")
        .eq("score_date", latestDate),
      previousDate
        ? this.supabase
            .from("propertyiq_scores")
            .select("location_id, score")
            .eq("geography", "metro")
            .eq("score_type", "propertyiq")
            .eq("score_date", previousDate)
        : Promise.resolve({
            data: [] as { location_id: string; score: number }[],
          }),
    ]);

    const prevMap = new Map<string, number>();
    for (const r of previousResult.data ?? []) {
      if (r.score != null) prevMap.set(r.location_id, Number(r.score));
    }

    const latestRows = (latest ?? []).filter((r) => r.score != null);
    const names = await this.lookupRegionNames(
      latestRows.map((r) => r.location_id),
    );

    return latestRows.map((r) => ({
      regionId: r.location_id,
      name: names.get(r.location_id) || r.location_id,
      current: Number(r.score),
      previous: prevMap.has(r.location_id)
        ? (prevMap.get(r.location_id) as number)
        : null,
    }));
  }

  private async lookupRegionNames(
    regionIds: string[],
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (!regionIds.length) return names;
    const { data } = await this.supabase
      .from("geographies")
      .select("geography_id, name")
      .eq("geography_type", "metro")
      .in("geography_id", regionIds);
    for (const row of data ?? []) names.set(row.geography_id, row.name);
    return names;
  }

  /** Newest `limit` blog posts from the frontend metadata endpoint. */
  async getRecentBlogPosts(limit = 3): Promise<NewsletterBlogPost[]> {
    try {
      const res = await fetch(
        `${this.appUrl.replace(/\/+$/, "")}/api/blog/metadata`,
      );
      if (!res.ok) {
        this.logger.warn(`Blog metadata fetch returned ${res.status}`);
        return [];
      }
      const posts = (await res.json()) as RawBlogPost[];
      return sortRecentPosts(posts, limit, this.appUrl);
    } catch (err) {
      this.logger.warn(`Blog metadata fetch failed: ${String(err)}`);
      return [];
    }
  }

  /**
   * Confirmed, non-unsubscribed subscribers not already sent this calendar month.
   */
  async getConfirmedRecipientsNotSentThisMonth(): Promise<
    NewsletterRecipient[]
  > {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data, error } = await this.supabase
      .from("newsletter_signups")
      .select("id, email, last_newsletter_sent_at")
      .eq("confirmed", true)
      .is("unsubscribed_at", null);

    if (error) {
      this.logger.error(
        `Failed to load newsletter recipients: ${error.message}`,
      );
      return [];
    }

    return (data ?? [])
      .filter(
        (r) =>
          !r.last_newsletter_sent_at ||
          new Date(r.last_newsletter_sent_at) < monthStart,
      )
      .map((r) => ({ id: r.id, email: r.email }));
  }

  async markNewsletterSent(signupId: string): Promise<void> {
    const { error } = await this.supabase
      .from("newsletter_signups")
      .update({ last_newsletter_sent_at: new Date().toISOString() })
      .eq("id", signupId);
    if (error) {
      this.logger.error(
        `Failed to mark newsletter sent for ${signupId}: ${error.message}`,
      );
    }
  }
}
```

- [ ] **Step 7: Build to verify types compile**

Run: `npm run build --workspace @propertyiq/backend`
Expected: build succeeds with zero errors.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/email/newsletter.types.ts packages/backend/src/email/newsletter-selection.ts packages/backend/src/email/newsletter-selection.spec.ts packages/backend/src/email/newsletter-data.service.ts
git commit -m "feat(newsletter): content types, pure selection helpers, and data service"
```

---

### Task 5: `market-newsletter.tsx` email template

**Files:**

- Create: `packages/emails/emails/market-newsletter.tsx`
- Modify: `packages/emails/index.ts`

**Interfaces:**

- Consumes: shared `Layout`, `BrandedButton`, `EmailHeading` from `./components/`; content types (mirrored inline as `MarketNewsletterProps`).
- Produces: `export default MarketNewsletter` + `export type MarketNewsletterProps` — props `{ marketToWatch, topMovers, topMarkets, blogPosts, dashboardUrl, newsletterSignupUrl, unsubscribeUrl }`. Consumed by Task 6.

- [ ] **Step 1: Create the template**

Create `packages/emails/emails/market-newsletter.tsx` (models the structure of `monthly-digest.tsx`, but with no personalization):

```tsx
import { Text, Section, Hr } from "@react-email/components";
import Layout from "./components/layout";
import BrandedButton from "./components/branded-button";
import EmailHeading from "./components/email-heading";

export interface MarketNewsletterProps {
  marketToWatch: { name: string; reason: string } | null;
  topMovers: Array<{
    name: string;
    oldScore: number;
    newScore: number;
    change: number;
    direction: "up" | "down";
  }>;
  topMarkets: Array<{ name: string; piqScore: number }>;
  blogPosts: Array<{
    title: string;
    description: string;
    url: string;
    date: string;
  }>;
  dashboardUrl: string;
  newsletterSignupUrl: string;
  unsubscribeUrl?: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#ca8a04";
  return "#dc2626";
}

function moverArrow(direction: "up" | "down"): string {
  return direction === "up" ? "↑" : "↓";
}

function formatChange(change: number): string {
  return change > 0 ? `+${change}` : String(change);
}

export default function MarketNewsletter({
  marketToWatch,
  topMovers,
  topMarkets,
  blogPosts,
  dashboardUrl,
  newsletterSignupUrl,
  unsubscribeUrl,
}: MarketNewsletterProps) {
  const monthName = new Date().toLocaleString("en-US", { month: "long" });

  return (
    <Layout
      preview={`Your ${monthName} PropertyIQ market update`}
      unsubscribeUrl={unsubscribeUrl ?? newsletterSignupUrl}
    >
      <Text className="text-sm font-medium text-brand m-0 mb-1">
        Monthly Market Newsletter
      </Text>
      <EmailHeading>The {monthName} Market Update</EmailHeading>

      <Text className="text-sm text-gray-600 m-0 mb-6 leading-6">
        The month&apos;s biggest moves across U.S. metro markets, ranked by the
        PropertyIQ Score — our demand-momentum signal.
      </Text>

      {marketToWatch && (
        <Section
          className="p-4 rounded-lg mb-4"
          style={{ backgroundColor: "#f5f3ff" }}
        >
          <Text className="text-sm font-semibold text-brand m-0 mb-2">
            Market to Watch
          </Text>
          <Text className="text-sm font-medium text-gray-900 m-0">
            {marketToWatch.name}
          </Text>
          <Text className="text-xs text-gray-600 m-0 mt-1 leading-5">
            {marketToWatch.reason}
          </Text>
        </Section>
      )}

      {topMovers.length > 0 && (
        <>
          <Hr className="border-solid border-gray-200 my-4" />
          <Text className="text-base font-semibold text-gray-900 m-0 mb-3">
            Top Movers This Month
          </Text>
          {topMovers.map((mover, i) => (
            <Section
              key={i}
              className="py-2"
              style={
                i < topMovers.length - 1
                  ? { borderBottom: "1px solid #eee" }
                  : {}
              }
            >
              <Text className="text-sm text-gray-900 m-0">
                <span
                  style={{
                    color: mover.direction === "up" ? "#16a34a" : "#dc2626",
                    fontWeight: 600,
                  }}
                >
                  {moverArrow(mover.direction)} {formatChange(mover.change)}
                </span>{" "}
                {mover.name}{" "}
                <span className="text-xs text-gray-500">
                  {mover.oldScore} &rarr; {mover.newScore}
                </span>
              </Text>
            </Section>
          ))}
        </>
      )}

      {topMarkets.length > 0 && (
        <>
          <Hr className="border-solid border-gray-200 my-4" />
          <Text className="text-base font-semibold text-gray-900 m-0 mb-3">
            Top Markets Right Now
          </Text>
          {topMarkets.map((market, i) => (
            <Section
              key={i}
              className="py-2"
              style={
                i < topMarkets.length - 1
                  ? { borderBottom: "1px solid #eee" }
                  : {}
              }
            >
              <Text className="text-sm text-gray-900 m-0">
                {i + 1}. {market.name}{" "}
                <span
                  style={{
                    color: scoreColor(market.piqScore),
                    fontWeight: 600,
                  }}
                >
                  PIQ {market.piqScore}
                </span>
              </Text>
            </Section>
          ))}
        </>
      )}

      {blogPosts.length > 0 && (
        <>
          <Hr className="border-solid border-gray-200 my-4" />
          <Text className="text-base font-semibold text-gray-900 m-0 mb-3">
            Latest from the Blog
          </Text>
          {blogPosts.map((post, i) => (
            <Section key={i} className="py-2">
              <Text className="text-sm font-medium m-0">
                <a
                  href={post.url}
                  style={{ color: "#6d28d9", textDecoration: "none" }}
                >
                  {post.title}
                </a>
              </Text>
              <Text className="text-xs text-gray-500 m-0 mt-1 leading-5">
                {post.description}
              </Text>
            </Section>
          ))}
        </>
      )}

      <Section className="text-center mt-8 mb-2">
        <BrandedButton href={dashboardUrl}>Explore the Map</BrandedButton>
      </Section>
    </Layout>
  );
}

MarketNewsletter.PreviewProps = {
  marketToWatch: {
    name: "Huntsville, AL",
    reason:
      "PIQ score climbed 7 points this month to 74, signaling improving demand momentum. Worth a spot on your watchlist.",
  },
  topMovers: [
    {
      name: "Huntsville, AL",
      oldScore: 67,
      newScore: 74,
      change: 7,
      direction: "up",
    },
    {
      name: "Austin-Round Rock, TX",
      oldScore: 71,
      newScore: 63,
      change: -8,
      direction: "down",
    },
    {
      name: "Boise City, ID",
      oldScore: 58,
      newScore: 64,
      change: 6,
      direction: "up",
    },
    {
      name: "Cape Coral, FL",
      oldScore: 62,
      newScore: 57,
      change: -5,
      direction: "down",
    },
    {
      name: "Knoxville, TN",
      oldScore: 70,
      newScore: 74,
      change: 4,
      direction: "up",
    },
  ],
  topMarkets: [
    { name: "San Jose, CA", piqScore: 92 },
    { name: "Seattle, WA", piqScore: 88 },
    { name: "Boston, MA", piqScore: 85 },
  ],
  blogPosts: [
    {
      title: "Best Cash-Flow Markets in 2026",
      description: "Where rents outrun prices this year.",
      url: "https://propertyiq.app/blog/best-cash-flow-real-estate-markets-2026",
      date: "2026-06-01",
    },
  ],
  dashboardUrl: "https://propertyiq.app/map",
  newsletterSignupUrl: "https://propertyiq.app/newsletter",
} satisfies MarketNewsletterProps;
```

- [ ] **Step 2: Export the template and its props**

In `packages/emails/index.ts`, add after the `MonthlyDigest` export (line ~19) and its type export (line ~41):

```typescript
export { default as MarketNewsletter } from "./emails/market-newsletter";
```

```typescript
export type { MarketNewsletterProps } from "./emails/market-newsletter";
```

- [ ] **Step 3: Build the emails package to verify it compiles**

Run: `npm run build --workspace @propertyiq/emails`
Expected: build succeeds. (If the emails package has no `build` script, run `npx tsc --noEmit -p packages/emails` instead.)

- [ ] **Step 4: Commit**

```bash
git add packages/emails/emails/market-newsletter.tsx packages/emails/index.ts
git commit -m "feat(newsletter): generic market-newsletter email template"
```

---

### Task 6: `NewsletterService` cron + module registration

**Files:**

- Create: `packages/backend/src/email/newsletter.service.ts`
- Modify: `packages/backend/src/email/email.module.ts`

**Interfaces:**

- Consumes: `NewsletterDataService` (Task 4); `MarketNewsletter` template (Task 5); `EmailService.sendEmail`; `RedisLockService`; `buildUnsubscribe` (existing) called with `(config, signup.id, 'newsletter')`; `getEmailLinkBaseUrl`.
- Produces: `NewsletterService.sendMonthlyNewsletter()` (the `@Cron` entry) and `sendNewsletterInner()` (the testable body).

- [ ] **Step 1: Create the service**

Create `packages/backend/src/email/newsletter.service.ts`:

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { MarketNewsletter } from "@propertyiq/emails";
import React from "react";
import { EmailService } from "./email.service";
import { NewsletterDataService } from "./newsletter-data.service";
import { RedisLockService } from "../redis/redis-lock.service";
import { getEmailLinkBaseUrl } from "./email-link-base";
import { buildUnsubscribe } from "./unsubscribe-link.util";
import { selectNewsletterContent } from "./newsletter-selection";

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);
  private readonly appUrl: string;

  constructor(
    private readonly emailService: EmailService,
    private readonly data: NewsletterDataService,
    private readonly redis: RedisLockService,
    private readonly config: ConfigService,
  ) {
    this.appUrl = getEmailLinkBaseUrl(this.config);
  }

  // 1st of the month, 13:00 UTC — one hour after the noon monthly digest.
  @Cron("0 13 1 * *")
  async sendMonthlyNewsletter() {
    const locked = await this.redis.acquireLock("cron:market-newsletter", 600);
    if (!locked) {
      this.logger.log(
        "Another instance is processing the newsletter, skipping",
      );
      return;
    }
    try {
      await this.sendNewsletterInner();
    } finally {
      await this.redis.releaseLock("cron:market-newsletter");
    }
  }

  async sendNewsletterInner() {
    this.logger.log("Starting monthly market newsletter...");

    const recipients = await this.data.getConfirmedRecipientsNotSentThisMonth();
    if (!recipients.length) {
      this.logger.log("No newsletter recipients due this month");
      return;
    }

    // Build the national content ONCE — identical for every recipient.
    const scoreRows = await this.data.getMetroScoreRows();
    const { marketToWatch, topMovers, topMarkets } =
      selectNewsletterContent(scoreRows);
    const blogPosts = await this.data.getRecentBlogPosts(3);

    if (!marketToWatch && !topMovers.length && !topMarkets.length) {
      this.logger.error("Newsletter has no market content — aborting send");
      return;
    }

    const monthName = new Date().toLocaleString("en-US", { month: "long" });
    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      try {
        const unsub = buildUnsubscribe(this.config, r.id, "newsletter");
        const react = React.createElement(MarketNewsletter, {
          marketToWatch,
          topMovers,
          topMarkets,
          blogPosts,
          dashboardUrl: `${this.appUrl}/map`,
          newsletterSignupUrl: `${this.appUrl}/newsletter`,
          unsubscribeUrl: unsub?.url,
        });

        const ok = await this.emailService.sendEmail({
          to: r.email,
          subject: `PropertyIQ ${monthName} Market Update`,
          react,
          emailType: "market_newsletter",
          headers: unsub?.headers,
          metadata: {
            topMoverCount: topMovers.length,
            topMarketCount: topMarkets.length,
            blogPostCount: blogPosts.length,
          },
        });

        if (ok) {
          await this.data.markNewsletterSent(r.id);
          sent++;
        } else {
          failed++;
        }
      } catch (err) {
        this.logger.error(`Failed newsletter for ${r.email}:`, err);
        failed++;
      }
    }

    this.logger.log(
      `Monthly newsletter complete. Sent: ${sent}, Failed: ${failed}`,
    );
  }
}
```

- [ ] **Step 2: Register the providers**

In `packages/backend/src/email/email.module.ts`, import and add both services to `providers`:

```typescript
import { NewsletterService } from "./newsletter.service";
import { NewsletterDataService } from "./newsletter-data.service";
```

Add `NewsletterService` and `NewsletterDataService` to the `providers` array (alongside `MonthlyDigestService`, `MonthlyDigestDataService`).

- [ ] **Step 3: Build the backend**

Run: `npm run build --workspace @propertyiq/backend`
Expected: build succeeds with zero errors.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/email/newsletter.service.ts packages/backend/src/email/email.module.ts
git commit -m "feat(newsletter): monthly market newsletter cron + module wiring"
```

---

### Task 7: Fix the "Weekly" → "Monthly" cadence copy

**Files:**

- Modify: `packages/frontend/app/api/newsletter/confirm/route.ts:74`
- Modify: `packages/emails/emails/newsletter-confirmation.tsx`

**Interfaces:** none (copy only).

- [ ] **Step 1: Fix the confirmation page copy**

In `packages/frontend/app/api/newsletter/confirm/route.ts`, change the success message (line 73-74):

```typescript
    message:
      "Your subscription is confirmed! Welcome to Monthly Market Insights.",
```

- [ ] **Step 2: Fix any "weekly" promise in the confirmation email**

In `packages/emails/emails/newsletter-confirmation.tsx`, search for "weekly" (case-insensitive) and change any copy promising a _weekly_ newsletter to _monthly_ (e.g. "weekly market insights" → "monthly market insights"). If no "weekly" text exists, make no change and note it in the commit body.

- [ ] **Step 3: Verify no stale "weekly" newsletter promises remain**

Run: `grep -ri "weekly market" packages/frontend/app/api/newsletter packages/emails/emails/newsletter-confirmation.tsx`
Expected: no matches (or only intentional weekly-digest references unrelated to the newsletter).

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/api/newsletter/confirm/route.ts packages/emails/emails/newsletter-confirmation.tsx
git commit -m "fix(newsletter): align confirmation copy to monthly cadence"
```

---

### Task 8: End-to-end verification against the real database

**Files:** none (verification only). Uses a temporary throwaway script under the scratchpad; do NOT commit it.

**Interfaces:** exercises Tasks 1-7 end-to-end against the live Supabase DB in dev mode (`EmailService` logs "would send" when `RESEND_API_KEY` is unset).

- [ ] **Step 1: Confirm the recipient query returns exactly the confirmed, non-unsubscribed subscribers**

Run (Supabase MCP `execute_sql`, project `pysflbhpnqwoczyuaaif`):

```sql
SELECT email, last_newsletter_sent_at
FROM newsletter_signups
WHERE confirmed = true AND unsubscribed_at IS NULL;
```

Expected: the current confirmed subscribers (5 as of 2026-07-11:
`gustavo@gtcapitalglobal.com`, `gtgroupreal@gmail.com`, `samlanga500@gmail.com`,
`harman22153@gmail.com`, `sarmady.m@gmail.com`). Record the count.

- [ ] **Step 2: Dry-run the send against the real DB**

Start the backend locally in dev mode with cron ownership but no real email dispatch:
`RUN_CRONS=true` and `RESEND_API_KEY` unset (so `EmailService` logs `[DEV] Would send…`).
Trigger `sendNewsletterInner()` once — either by temporarily exposing it through an
existing admin/dev route, or via a throwaway Nest standalone script in the scratchpad
(`C:\Users\troyh\AppData\Local\Temp\claude\...\scratchpad`) that boots `AppModule` and
resolves `NewsletterService`. Do not commit the script.

Expected backend logs:

- `Starting monthly market newsletter...`
- one `[DEV] Would send email to <address>: PropertyIQ <Month> Market Update` per confirmed recipient (matching Step 1's count),
- `Monthly newsletter complete. Sent: <n>, Failed: 0`.

- [ ] **Step 3: Confirm the content blocks populated from real PIQ data**

In the same run, add a temporary log of the built content (or inspect via the script)
and confirm: `marketToWatch` is a real metro name, `topMovers` has up to 5 entries with
both `up` and `down` directions present when the data supports it, `topMarkets` has up
to 8 real metros ordered by descending PIQ, and `blogPosts` has up to 3 real posts with
working `/blog/<slug>` URLs. Remove the temporary logging before finishing.

- [ ] **Step 4: Round-trip a real unsubscribe token**

In the dev process, build a token for one test row and exercise the real controller path:

1. Insert a disposable confirmed test row and capture its `id`:
   ```sql
   INSERT INTO newsletter_signups (email, confirmed, confirmed_at, source)
   VALUES ('newsletter-e2e@example.com', true, now(), 'e2e')
   RETURNING id;
   ```
2. Build its unsubscribe URL with `buildUnsubscribe(config, <id>, 'newsletter')` (log it), then
   `POST` that URL (the one-click path). Expect HTTP 200 with an empty body.
3. Verify the opt-out landed:
   ```sql
   SELECT unsubscribed_at FROM newsletter_signups WHERE email = 'newsletter-e2e@example.com';
   ```
   Expected: `unsubscribed_at` is non-null.
4. Re-run `getConfirmedRecipientsNotSentThisMonth()` (or the Step 1 query) and confirm the
   test row is absent.
5. Clean up:
   ```sql
   DELETE FROM newsletter_signups WHERE email = 'newsletter-e2e@example.com';
   ```

- [ ] **Step 5: Full backend build + test run**

Run: `npm run build --workspace @propertyiq/backend && npm test --workspace @propertyiq/backend -- unsubscribe-token.util.spec.ts newsletter-selection.spec.ts`
Expected: build clean; all unit tests pass.

- [ ] **Step 6: (Optional, recommended) One real render check**

Temporarily set `RESEND_API_KEY` and send one issue to a seeded confirmed address you
control; open it in Gmail (desktop + mobile) and click the footer unsubscribe to confirm
the one-click flow and rendering. Reset the test row's `last_newsletter_sent_at`/`unsubscribed_at`
afterward if you want it to receive the production run.

---

## Self-Review

**Spec coverage:**

- Monthly cron on the 1st → Task 6 (`@Cron('0 13 1 * *')`). ✓
- Four content blocks (Market to Watch, Top Movers incl. fallers, Top Markets, Latest blog) → Task 4 (`selectNewsletterContent`, `getRecentBlogPosts`) + Task 5 (template). ✓
- National, non-personalized, built once → Task 6 (`sendNewsletterInner` builds once, loops). ✓
- Recipients = confirmed AND not unsubscribed AND not sent this month → Task 4 (`getConfirmedRecipientsNotSentThisMonth`). ✓
- Idempotency via `last_newsletter_sent_at` (not `email_log`) → Tasks 1, 4, 6. ✓
- Unsubscribe: extend signed-token flow with `newsletter` stream, set `unsubscribed_at`, keep one-click headers → Tasks 2, 3. ✓
- New columns migration → Task 1. ✓
- Reuse `EmailService`/`RedisLockService`/`buildUnsubscribe` → Task 6. ✓
- Copy alignment weekly→monthly → Task 7. ✓
- Testing: unit (pure helpers, token round-trip) + E2E real DB (no mocks) → Tasks 2, 4, 8. ✓
- First send rides the next 1st, no one-off → no task adds a manual trigger. ✓
- Cron gated behind `RUN_CRONS` → inherited from `cronScheduleImports()` (Global Constraints); `@Cron` only registers when the flag is set. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; Task 7 Step 2 gives an explicit fallback ("if no 'weekly' text exists, make no change and note it"). ✓

**Type consistency:** `selectNewsletterContent` returns `{ marketToWatch, topMovers, topMarkets }` (Task 4) consumed with those exact names in Task 6; `NewsletterMover`/`NewsletterTopMarket` fields (`oldScore`, `newScore`, `change`, `direction`, `piqScore`) match the template props in Task 5; `buildUnsubscribe(config, id, 'newsletter')` matches the existing signature (`userId` param carries the row id) and the `'newsletter'` stream added in Task 2; `unsubscribeNewsletter(signupId)` defined in Task 3 and called in Task 3's controller branch. ✓

**Deviation from spec (noted):** the spec suggested reusing `MonthlyDigestDataService.pickMarketToWatch()`; the plan instead derives all three score blocks from a single `getMetroScoreRows()` fetch via the pure `selectNewsletterContent` helper. This is more efficient (one fetch vs three), fully unit-testable without DB mocks, and avoids coupling the account-less newsletter to the personalized digest service. Behavior for Market to Watch is equivalent (biggest riser + reason string).

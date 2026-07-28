# Content Purpose Taxonomy, Mix Rotation, and the Lane A/B Bridge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every piece of content a strategic pillar (attract/trust/nurture/share), make Lane B's cron generation deliberately target a 40/20/20/20 mix instead of round-robin, and close the gap where an approved `video_script` suggestion needs a human to manually start the real Lane-A video run.

**Architecture:** A new `content-purpose.ts` module owns the format→pillar lookup and target mix as plain consts (no new table). Three nullable columns (`posts.pillar`, `content_runs.pillar`, `content_runs.source_post_id`) plus one more this plan adds (`posts.bridge_error`, see Implementation Decision 3) get backfilled in one migration. `FeedTopUpService.topUp()` swaps its flat round-robin for a deficit-driven pillar picker with within-pillar rotation, reusing `countAll()`-style monotonic cursors so nothing needs to remember state across Railway redeploys. A new `VideoScriptBridgeService` + sweep cron (mirroring the existing `AutoScheduleApprovedPostsCron` pattern exactly) auto-creates a Lane-A run the first time it sees an `approved` `video_script` post, writes `source_post_id` back for traceability, and self-heals a failed attempt on the next tick instead of needing a human retry click.

**Tech Stack:** NestJS (backend), Supabase/Postgres, Jest (backend unit tests), Next.js App Router + React Query (frontend).

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-27-content-purpose-taxonomy-design.md` (approved by Troy 2026-07-27). Where this plan makes a call the spec left open, it's called out as an **Implementation Decision** inline — read those before changing behavior.
- Target mix (Troy's choice): `attract: 0.40, trust: 0.20, nurture: 0.20, share: 0.20`.
- Never hardcode a fallback for a missing config/secret (CLAUDE.md §1.2) — not applicable to this plan's changes directly, but the new cron must still fail closed like its siblings (log + skip, never throw past the tick).
- File size limits: logic files <300 lines hard limit, test files <500 lines hard limit (CLAUDE.md §1.3). Several tasks below create new files specifically to avoid pushing existing files over their limits.
- Backend verification gate (per spec §4 and CLAUDE.md §2.3): `cd packages/backend && npx tsc --noEmit` clean, full content-pipeline Jest suite green, then a **live** check — approve a real `video_script` post and confirm a `content_runs` row appears with the right `source_post_id` (per `feedback_verification-discipline-index` memory: 200-status/green-tests is not "done" without a real artifact at the destination).
- Git: branch `develop`, commit locally after each task, never push without asking (per this session's standing instructions).
- No `Co-Authored-By` in commit messages (user preference).

---

## Implementation Decisions (resolving what the spec left open)

These are things the spec flagged as needing verification, or gaps this plan found while reading the live code that the spec's prose doesn't fully resolve. Recorded here so the "why" survives past this plan's execution.

1. **`createRun()`'s seed-brief question (spec §3, explicitly flagged "needs verifying"):** `CreateRunDto.extraDirectives` and `ScriptGeneratorInput.extraDirectives` both already exist as typed fields — but nothing wires them together. `ContentRunsService.createRun()` never persists `dto.extraDirectives` anywhere, and `generate-script.handler.ts` never reads it. It's dead on both ends. Task 8 below wires it: fold into `content_runs.format_options.extraDirectives` (no migration needed, `format_options` is already JSONB) and read it back out in the script-gen handler. This is the "small addition, not a redesign" the spec anticipated.

2. **Where the bridge trigger can physically live:** `PostsService`/`PostsController` live in `PostsBrandKitModule`; `ContentRunsService` lives in `ContentPipelineModule`, which _imports_ `PostsBrandKitModule` (one-directional). Neither `PostsService` nor `PostsController` can inject `ContentRunsService` without a circular module import. Rather than introduce `forwardRef()` circularity, this plan mirrors the codebase's own existing solution to the identical shape of problem: `AutoScheduleApprovedPostsCron` lives in `ContentPipelineModule` and sweeps for `approved`-but-unscheduled posts every 10 minutes, self-healing anything the inline post-approve call missed. `VideoScriptBridgeCron` (Task 12) does the same for `approved`-but-not-yet-bridged `video_script` posts. This satisfies the spec's "no separate confirm step" from a human's perspective (nothing to click — it happens automatically within one sweep interval) without new circular-DI complexity.

3. **Failure surfacing needs a place to live that the spec's data model section doesn't list:** spec §3 requires "a visible needs-attention state with the failure reason and a retry action," but spec §1's migration list only adds `posts.pillar`, `content_runs.pillar`, `content_runs.source_post_id`. This plan adds one more nullable column, `posts.bridge_error TEXT`, in the same migration — cleared on success, set on a `createRun()` failure. This mirrors `posts.error`'s existing role for publish failures, just for the bridge instead of the publisher.

4. **Within-pillar rotation's "9 candidate formats" (spec §2) describes the full cross-lane `FORMAT_PILLAR` table, not what Lane B can actually rotate through.** Lane B's `FEED_POST_TYPES` is a closed 4-item set (`linkedin_post`, `facebook_post`, `carousel_copy`, `video_script`); the other 8 `attract`-pillar formats (`grade_reveal`, `top_10_ranking`, etc.) are Lane-A-only `ContentFormat`s the feed cron can never generate. So today, Lane B's `attract` pillar has exactly one reachable format (`video_script`) and `nurture` has exactly one (`carousel_copy`) — only `share` (`linkedin_post` / `facebook_post`) has real within-pillar alternation to do, which is exactly what the spec's own worked example shows (7 share / 2 attract / 1 nurture / 0 trust — no attract/nurture alternation visible because there's nothing to alternate between yet). Task 6's `pickFormatWithinPillar` is written generically over "this pillar's formats that are also members of `FEED_POST_TYPES`," so it's already correct today and self-extends if Lane B ever gains more formats in a pillar, without needing to revisit this logic.

5. **Cost cap:** spec §3 flags watching `CONTENT_PIPELINE_DAILY_USD_MAX` once the bridge is live. `createRun()`'s pre-enqueue cap check only runs when `triggeredBy === 'auto_ideation'` — every existing human-initiated ("New Run" wizard) run already skips that pre-check and only gets cost recorded post-hoc via `recordDriverSpend` at each pipeline stage. The bridge uses `triggeredBy: 'manual'` (Task 11), which is consistent with that existing behavior — a human already approved this specific suggestion, which is the same trust boundary as clicking "New Run" by hand. No new cap mechanism needed; this is an operational-monitoring note, not a code gap.

---

## File Structure

**New files:**

- `supabase/migrations/20260727120000_content_purpose_taxonomy.sql` — 3 spec columns + `posts.bridge_error`, backfill, indexes.
- `packages/backend/src/content-pipeline/content-purpose.ts` — `ContentPillar` type, `FORMAT_PILLAR`, `TARGET_MIX`, `getPillarForFormat()`.
- `packages/backend/src/content-pipeline/content-purpose.spec.ts` — completeness test.
- `packages/backend/src/content-pipeline/feed/pillar-rotation.ts` — pure deficit/pick algorithm.
- `packages/backend/src/content-pipeline/feed/pillar-rotation.spec.ts`
- `packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.service.ts`
- `packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.service.spec.ts`
- `packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.controller.ts`
- `packages/backend/src/content-pipeline/crons/video-script-bridge.cron.ts`
- `packages/frontend/app/(app)/admin/content-pipeline/lib/video-script-bridge-api.ts`

**Modified files:**

- `packages/backend/src/content-pipeline/posts/post.types.ts` — add `pillar`, `bridge_error` to `PostRow`/`CreatePostInput`.
- `packages/backend/src/content-pipeline/posts/posts.service.ts` — add `countByPillar()`, `setBridgeError()`; stamp `pillar` on insert.
- `packages/backend/src/content-pipeline/posts/posts.service.spec.ts` — new tests for the above.
- `packages/backend/src/content-pipeline/feed/feed-post-generator.service.ts` — stamp `pillar` on `createPost()`.
- `packages/backend/src/content-pipeline/feed/feed-topup.service.ts` — swap flat rotation for pillar picker.
- `packages/backend/src/content-pipeline/feed/feed-topup.service.spec.ts` — update rotation tests for the new algorithm.
- `packages/backend/src/content-pipeline/feed/__tests__/feed-generation-test-helpers.ts` — add `countByPillar` to the posts fake.
- `packages/backend/src/content-pipeline/content-runs.service.ts` — stamp `pillar`, fold `extraDirectives` into `format_options`, add `findBySourcePostId()`/`setSourcePostId()`.
- `packages/backend/src/content-pipeline/content-runs.service.spec.ts` — new tests (create if it doesn't exist yet — see Task 8 note).
- `packages/backend/src/content-pipeline/orchestrator/job-handlers/generate-script.handler.ts` — read `formatOptions.extraDirectives`.
- `packages/backend/src/content-pipeline/content-pipeline-analytics.providers.ts` — register `VideoScriptBridgeCron`.
- `packages/backend/src/content-pipeline/content-pipeline.module.ts` — register `VideoScriptBridgeService`, `VideoScriptBridgeController`.
- `packages/frontend/app/(app)/admin/content-pipeline/lib/posts-api.ts` — add `pillar`, `bridgeError` to `PlannerPost`.
- `packages/frontend/app/(app)/admin/content-pipeline/video-scripts/VideoScriptCard.tsx` — Approve replaces "Make this video" as primary action.
- `packages/frontend/app/(app)/admin/content-pipeline/review/post-review-card.tsx` — same swap in `ScriptReview`.
- `packages/frontend/app/(app)/admin/content-pipeline/video-scripts/page.tsx` — show approved/bridged scripts with status.
- `tasks/todo.md` — check off the items this plan completes.

---

### Task 0: Commit the already-implemented, already-tested rotation-fix code

This is pure git hygiene, not new work — `tasks/todo.md` item 1 ("Immediate") flags this as done-but-uncommitted (76 backend tests pass, tsc clean, two independent code reviews already APPROVE'd it), and every later task in this plan edits the same files, so committing it first keeps history readable.

**Files:** the currently-modified/untracked set: `packages/backend/src/content-pipeline/content-pipeline.module.ts`, `packages/backend/src/content-pipeline/crons/feed-topup.cron.ts`, `packages/backend/src/content-pipeline/feed/feed.service.spec.ts`, `packages/backend/src/content-pipeline/feed/feed.service.ts`, `packages/backend/src/content-pipeline/posts/posts.service.spec.ts`, `packages/backend/src/content-pipeline/posts/posts.service.ts`, `packages/backend/src/content-pipeline/feed/__tests__/`, `packages/backend/src/content-pipeline/feed/feed-generation-shared.ts`, `packages/backend/src/content-pipeline/feed/feed-topup.service.spec.ts`, `packages/backend/src/content-pipeline/feed/feed-topup.service.ts`.

- [ ] **Step 1: Verify the suite is still green before committing**

Run: `cd packages/backend && npx jest content-pipeline/feed content-pipeline/posts --silent`
Expected: all pass (this reconfirms the reviewed state hasn't drifted).

- [ ] **Step 2: Verify tsc is clean**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Stage and commit by explicit pathspec (never `git add -A`)**

```bash
git add packages/backend/src/content-pipeline/content-pipeline.module.ts \
  packages/backend/src/content-pipeline/crons/feed-topup.cron.ts \
  packages/backend/src/content-pipeline/feed/feed.service.spec.ts \
  packages/backend/src/content-pipeline/feed/feed.service.ts \
  packages/backend/src/content-pipeline/posts/posts.service.spec.ts \
  packages/backend/src/content-pipeline/posts/posts.service.ts \
  packages/backend/src/content-pipeline/feed/__tests__/ \
  packages/backend/src/content-pipeline/feed/feed-generation-shared.ts \
  packages/backend/src/content-pipeline/feed/feed-topup.service.spec.ts \
  packages/backend/src/content-pipeline/feed/feed-topup.service.ts
git commit -m "fix(content-pipeline): rotate feed post-type/market picks by total-ever-created, not a per-tick index

Fixes an observed live skew (7 linkedin_post / 2 facebook_post / 1
carousel_copy / 0 video_script out of the first 10 posts) where the
loop index reset to 0 on every cron tick. Splits FeedService into
FeedService (on-demand) / FeedTopUpService (cron) to stay under the
file-size limit."
```

- [ ] **Step 4: Confirm the commit landed and the tree is otherwise unaffected**

Run: `git log -1 --stat && git status --porcelain=v1`
Expected: the commit lists exactly the files above; `git status` no longer shows them as modified (the `docs/analytics/funnel-tracking.md` change and the untracked tooling directories — `.ds-sync/`, `artifact-docs/`, `dev/`, `ds-bundle/`, `graphify-out/`, `packages/graphify-out/`, `packages/frontend/.ds-entry.tsx`, `packages/frontend/.ds-styles.css` — are unrelated to this plan and stay untouched).

---

### Task 1: Migration — pillar columns, source_post_id, bridge_error

**Files:**

- Create: `supabase/migrations/20260727120000_content_purpose_taxonomy.sql`

**Interfaces:**

- Produces: `posts.pillar TEXT`, `posts.bridge_error TEXT`, `content_runs.pillar TEXT`, `content_runs.source_post_id UUID` — all nullable, all consumed by Tasks 2–13.

- [ ] **Step 1: Write the migration**

```sql
-- Content purpose taxonomy (attract/trust/nurture/share) + the Lane A/B bridge.
--
-- Adds:
--   posts.pillar            — which pillar this post served, stamped at generation
--                              time from FORMAT_PILLAR (content-purpose.ts).
--   posts.bridge_error       — set when the Lane A/B bridge fails to turn an
--                              approved video_script into a real run; cleared on
--                              the next successful attempt. Drives the review-queue
--                              "needs attention" state (spec §3).
--   content_runs.pillar      — same taxonomy, for Lane-A runs (null for `infographic`,
--                              which is exempt from the pillar system).
--   content_runs.source_post_id — set when a run was auto-created by the bridge
--                              from an approved video_script post; null for runs
--                              started directly (New Run wizard, auto-ideation).
--
-- Backfill is deterministic: FORMAT_PILLAR is a pure lookup, so every existing
-- row (including the 10 posts already in the review queue) gets an unambiguous
-- pillar with no guesswork. Denormalized (not computed via a join) so a future
-- FORMAT_PILLAR change can never silently rewrite what a historical post/run
-- actually served — see spec §1 "Why denormalized."
--
-- Additive + idempotent (IF NOT EXISTS throughout). No new GRANTs needed: both
-- tables already GRANT ALL to service_role + authenticated.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS pillar TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS bridge_error TEXT;
ALTER TABLE content_runs ADD COLUMN IF NOT EXISTS pillar TEXT;
ALTER TABLE content_runs ADD COLUMN IF NOT EXISTS source_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;

-- Backfill posts.pillar from the current FORMAT_PILLAR mapping.
UPDATE posts SET pillar = 'attract' WHERE pillar IS NULL AND post_type IN
  ('video_script', 'grade_reveal', 'top_10_ranking', 'bottom_10_ranking',
   'score_mover', 'head_to_head', 'farm_area_spotlight',
   'brokerage_market_share', 'recruitment_angle');
UPDATE posts SET pillar = 'nurture' WHERE pillar IS NULL AND post_type IN
  ('carousel_copy', 'long_form_deep_dive');
UPDATE posts SET pillar = 'share' WHERE pillar IS NULL AND post_type IN
  ('linkedin_post', 'facebook_post');
-- infographic and any other post_type stay NULL (exempt from the pillar system).

-- Backfill content_runs.pillar the same way (format, not post_type).
UPDATE content_runs SET pillar = 'attract' WHERE pillar IS NULL AND format IN
  ('video_script', 'grade_reveal', 'top_10_ranking', 'bottom_10_ranking',
   'score_mover', 'head_to_head', 'farm_area_spotlight',
   'brokerage_market_share', 'recruitment_angle');
UPDATE content_runs SET pillar = 'nurture' WHERE pillar IS NULL AND format IN
  ('carousel_copy', 'long_form_deep_dive');
UPDATE content_runs SET pillar = 'share' WHERE pillar IS NULL AND format IN
  ('linkedin_post', 'facebook_post');
-- infographic stays NULL (exempt).

-- countByPillar() runs one COUNT(*) per pillar per brand; this index makes each
-- one an index-only scan instead of a sequential scan as the posts table grows.
CREATE INDEX IF NOT EXISTS idx_posts_brand_pillar ON posts (brand_id, pillar);

-- The bridge's idempotency check (findBySourcePostId) and the review-queue
-- traceability join both look up by source_post_id; partial index since it's
-- non-null on only a small fraction of runs.
CREATE INDEX IF NOT EXISTS idx_content_runs_source_post
  ON content_runs (source_post_id)
  WHERE source_post_id IS NOT NULL;
```

- [ ] **Step 2: Apply the migration to the local/dev database**

Run: `cd packages/backend && npx supabase db push` (or the project's standard migration-apply command — check `package.json` for the exact script name if `supabase db push` isn't wired up locally).
Expected: migration applies with no errors.

- [ ] **Step 3: Verify the backfill against live data**

Run a read-only check (via `mcp__supabase-db__execute_sql` or `psql`):

```sql
SELECT pillar, count(*) FROM posts GROUP BY pillar ORDER BY pillar;
SELECT pillar, count(*) FROM content_runs GROUP BY pillar ORDER BY pillar;
```

Expected: every row has a non-null pillar except `infographic`-format/post_type rows (which should show as `pillar IS NULL` in a `WHERE pillar IS NULL` follow-up query, all with `post_type = 'infographic'` or `format = 'infographic'`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260727120000_content_purpose_taxonomy.sql
git commit -m "feat(content-pipeline): add pillar + bridge columns for the content-purpose taxonomy

posts.pillar, content_runs.pillar, content_runs.source_post_id per spec
docs/superpowers/specs/2026-07-27-content-purpose-taxonomy-design.md;
posts.bridge_error added for the bridge's failure-surfacing requirement
(not in the spec's column list, needed to implement §3's 'visible
needs-attention state'). Backfilled deterministically from FORMAT_PILLAR."
```

---

### Task 2: `content-purpose.ts` — the taxonomy lookup

**Files:**

- Create: `packages/backend/src/content-pipeline/content-purpose.ts`
- Create: `packages/backend/src/content-pipeline/content-purpose.spec.ts`

**Interfaces:**

- Consumes: `FeedPostType`, `FEED_POST_TYPES` from `./feed/feed.types`; `ContentFormat` from `./types`; `CONTENT_FORMATS` from `./dto/content-format`.
- Produces: `ContentPillar` (`'attract' | 'trust' | 'nurture' | 'share'`), `FORMAT_PILLAR: Record<Exclude<FeedPostType | ContentFormat, 'infographic'>, ContentPillar>`, `TARGET_MIX: Record<ContentPillar, number>`, `PILLARS: readonly ContentPillar[]`, `getPillarForFormat(format: FeedPostType | ContentFormat): ContentPillar | null`. Every later task imports from here — no other file re-declares the pillar map.

- [ ] **Step 1: Write the failing completeness test**

```typescript
// packages/backend/src/content-pipeline/content-purpose.spec.ts
import { FEED_POST_TYPES } from "./feed/feed.types";
import { CONTENT_FORMATS } from "./dto/content-format";
import {
  FORMAT_PILLAR,
  TARGET_MIX,
  PILLARS,
  getPillarForFormat,
} from "./content-purpose";

describe("FORMAT_PILLAR completeness", () => {
  it("maps every FeedPostType to a pillar", () => {
    for (const t of FEED_POST_TYPES) {
      expect(FORMAT_PILLAR[t]).toBeDefined();
      expect(PILLARS).toContain(FORMAT_PILLAR[t]);
    }
  });

  it("maps every ContentFormat to a pillar, except infographic which is exempt", () => {
    for (const f of CONTENT_FORMATS) {
      if (f === "infographic") {
        expect(getPillarForFormat(f)).toBeNull();
      } else {
        expect(FORMAT_PILLAR[f]).toBeDefined();
        expect(PILLARS).toContain(FORMAT_PILLAR[f]);
      }
    }
  });

  it("matches the spec table exactly", () => {
    expect(FORMAT_PILLAR.video_script).toBe("attract");
    expect(FORMAT_PILLAR.grade_reveal).toBe("attract");
    expect(FORMAT_PILLAR.top_10_ranking).toBe("attract");
    expect(FORMAT_PILLAR.bottom_10_ranking).toBe("attract");
    expect(FORMAT_PILLAR.score_mover).toBe("attract");
    expect(FORMAT_PILLAR.head_to_head).toBe("attract");
    expect(FORMAT_PILLAR.farm_area_spotlight).toBe("attract");
    expect(FORMAT_PILLAR.brokerage_market_share).toBe("attract");
    expect(FORMAT_PILLAR.recruitment_angle).toBe("attract");
    expect(FORMAT_PILLAR.carousel_copy).toBe("nurture");
    expect(FORMAT_PILLAR.long_form_deep_dive).toBe("nurture");
    expect(FORMAT_PILLAR.linkedin_post).toBe("share");
    expect(FORMAT_PILLAR.facebook_post).toBe("share");
  });
});

describe("TARGET_MIX", () => {
  it("is Troy's growth-weighted mix and sums to 1", () => {
    expect(TARGET_MIX).toEqual({
      attract: 0.4,
      trust: 0.2,
      nurture: 0.2,
      share: 0.2,
    });
    const sum = PILLARS.reduce((s, p) => s + TARGET_MIX[p], 0);
    expect(sum).toBeCloseTo(1);
  });
});

describe("getPillarForFormat", () => {
  it("returns null for infographic (exempt)", () => {
    expect(getPillarForFormat("infographic")).toBeNull();
  });
  it("returns the mapped pillar for everything else", () => {
    expect(getPillarForFormat("video_script")).toBe("attract");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd packages/backend && npx jest content-purpose.spec.ts`
Expected: FAIL — `Cannot find module './content-purpose'`.

- [ ] **Step 3: Write `content-purpose.ts`**

```typescript
// packages/backend/src/content-pipeline/content-purpose.ts
//
// The content-purpose taxonomy: every piece of content (either lane) serves one
// of four strategic pillars. Mirrors the existing FEED_POST_TYPES / CONTENT_FORMATS
// const-array pattern already used in this codebase — not a new DB table, since
// this mapping is small and rarely changes. See
// docs/superpowers/specs/2026-07-27-content-purpose-taxonomy-design.md §1.

import type { FeedPostType } from "./feed/feed.types";
import type { ContentFormat } from "./types";

export type ContentPillar = "attract" | "trust" | "nurture" | "share";

export const PILLARS: readonly ContentPillar[] = [
  "attract",
  "trust",
  "nurture",
  "share",
];

/** Every pillar-eligible format id, across both lanes. `infographic` is exempt
 * (lead-magnet/educational collateral, not feed content) and deliberately
 * excluded from this type so a new format left off this map is a compile error. */
type PillarableFormat = Exclude<FeedPostType | ContentFormat, "infographic">;

export const FORMAT_PILLAR: Record<PillarableFormat, ContentPillar> = {
  video_script: "attract",
  grade_reveal: "attract",
  top_10_ranking: "attract",
  bottom_10_ranking: "attract",
  score_mover: "attract",
  head_to_head: "attract",
  farm_area_spotlight: "attract",
  brokerage_market_share: "attract",
  recruitment_angle: "attract",
  carousel_copy: "nurture",
  long_form_deep_dive: "nurture",
  linkedin_post: "share",
  facebook_post: "share",
  // trust: reserved for Stories (Spec 2) — zero formats mapped today.
};

/** Troy's growth-weighted target mix for Lane B's cron generation (spec §2). */
export const TARGET_MIX: Record<ContentPillar, number> = {
  attract: 0.4,
  trust: 0.2,
  nurture: 0.2,
  share: 0.2,
};

/** Look up a format's pillar; null for `infographic` (exempt from the system). */
export function getPillarForFormat(
  format: FeedPostType | ContentFormat,
): ContentPillar | null {
  if (format === "infographic") return null;
  return FORMAT_PILLAR[format as PillarableFormat];
}
```

- [ ] **Step 4: Run the tests again**

Run: `cd packages/backend && npx jest content-purpose.spec.ts`
Expected: PASS (all 6 assertions).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/content-purpose.ts packages/backend/src/content-pipeline/content-purpose.spec.ts
git commit -m "feat(content-pipeline): add the content-purpose taxonomy (FORMAT_PILLAR, TARGET_MIX)"
```

---

### Task 3: Stamp `pillar` on post creation

**Files:**

- Modify: `packages/backend/src/content-pipeline/posts/post.types.ts`
- Modify: `packages/backend/src/content-pipeline/posts/posts.service.ts`
- Modify: `packages/backend/src/content-pipeline/feed/feed-post-generator.service.ts`
- Modify: `packages/backend/src/content-pipeline/posts/posts.service.spec.ts`

**Interfaces:**

- Consumes: `ContentPillar`, `getPillarForFormat` from `../content-purpose` (Task 2).
- Produces: `PostRow.pillar: ContentPillar | null`, `PostRow.bridge_error: string | null`, `CreatePostInput.pillar?: ContentPillar | null`.

- [ ] **Step 1: Add the fields to `post.types.ts`**

In `packages/backend/src/content-pipeline/posts/post.types.ts`, add the import and extend `PostRow`/`CreatePostInput`:

```typescript
import type { ContentPillar } from "../content-purpose";
```

```typescript
/** Raw `posts` table row. */
export interface PostRow {
  id: string;
  brand_id: string;
  platform: string;
  post_type: string;
  copy: PostCopy;
  media_refs: PostMediaRef[];
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  source: string;
  error: string | null;
  attempts: number;
  /** Strategic pillar this post served, stamped at generation time. Null for
   *  formats outside the pillar system (or rows created before the migration). */
  pillar: ContentPillar | null;
  /** Set when the Lane A/B bridge fails to turn this approved video_script into
   *  a real run; cleared on the next successful attempt. */
  bridge_error: string | null;
  created_at: string;
  updated_at: string;
}
```

```typescript
/** Input shape for inserting a post (feed generator + manual create). */
export interface CreatePostInput {
  brandId: string;
  platform: string;
  postType: string;
  copy: PostCopy;
  mediaRefs?: PostMediaRef[];
  status?: PostStatus;
  source?: PostSource;
  scheduledAt?: string | null;
  pillar?: ContentPillar | null;
}
```

- [ ] **Step 2: Write the failing test for `createPost` stamping pillar**

Add to `packages/backend/src/content-pipeline/posts/posts.service.spec.ts` (near the existing `createPost`-adjacent tests):

```typescript
describe("PostsService.createPost stamps pillar", () => {
  it("persists the pillar passed on the input", async () => {
    const { supabase, store } = makePostsFake([]);
    const service = new PostsService(supabase);
    const row = await service.createPost({
      brandId: "brand-1",
      platform: "linkedin",
      postType: "linkedin_post",
      copy: { body: "hi" },
      pillar: "share",
    });
    expect(row.pillar).toBe("share");
    expect(store.posts[0].pillar).toBe("share");
  });

  it("defaults pillar to null when not given", async () => {
    const { supabase } = makePostsFake([]);
    const service = new PostsService(supabase);
    const row = await service.createPost({
      brandId: "brand-1",
      platform: "linkedin",
      postType: "linkedin_post",
      copy: { body: "hi" },
    });
    expect(row.pillar).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd packages/backend && npx jest posts.service.spec.ts -t "stamps pillar"`
Expected: FAIL — `row.pillar` is `undefined` (insert doesn't write the column yet).

- [ ] **Step 4: Update `PostsService.createPost` to write `pillar`**

In `packages/backend/src/content-pipeline/posts/posts.service.ts`, inside `createPost`'s insert object (after `status`):

```typescript
      .insert({
        brand_id: input.brandId,
        platform: input.platform,
        post_type: input.postType,
        copy: input.copy ?? {},
        media_refs: input.mediaRefs ?? [],
        status: input.status ?? 'draft',
        source: input.source ?? 'ai_generated',
        scheduled_at: input.scheduledAt ?? null,
        pillar: input.pillar ?? null,
        created_at: now,
        updated_at: now,
      })
```

- [ ] **Step 5: Run the tests again**

Run: `cd packages/backend && npx jest posts.service.spec.ts`
Expected: PASS, full file green (no regressions in the other `createPost`/status/media tests).

- [ ] **Step 6: Stamp pillar at the real call site (`feed-post-generator.service.ts`)**

In `packages/backend/src/content-pipeline/feed/feed-post-generator.service.ts`, add the import:

```typescript
import { getPillarForFormat } from "../content-purpose";
```

Update the `createPost` call inside `generatePost`:

```typescript
const post = await this.posts.createPost({
  brandId: brand.id,
  platform: options?.platform ?? FEED_POST_TYPE_PLATFORM[postType],
  postType,
  copy,
  status: "pending_review",
  source: "ai_generated",
  pillar: getPillarForFormat(postType),
});
```

- [ ] **Step 7: Run the full feed test suite (regression check, no new assertions needed here — Task 7 covers the generator's pillar behavior end to end)**

Run: `cd packages/backend && npx jest content-pipeline/feed`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/content-pipeline/posts/post.types.ts \
  packages/backend/src/content-pipeline/posts/posts.service.ts \
  packages/backend/src/content-pipeline/posts/posts.service.spec.ts \
  packages/backend/src/content-pipeline/feed/feed-post-generator.service.ts
git commit -m "feat(content-pipeline): stamp posts.pillar at generation time"
```

---

### Task 4: `PostsService.countByPillar()` and `setBridgeError()`

**Files:**

- Modify: `packages/backend/src/content-pipeline/posts/posts.service.ts`
- Modify: `packages/backend/src/content-pipeline/posts/posts.service.spec.ts`

**Interfaces:**

- Consumes: `ContentPillar`, `PILLARS` from `../content-purpose`.
- Produces: `PostsService.countByPillar(brandId?: string): Promise<Record<ContentPillar, number>>`, `PostsService.setBridgeError(id: string, error: string | null): Promise<PostRow>`. Task 7 (rotation) and Task 11 (bridge) both depend on these.

- [ ] **Step 1: Write the failing tests**

Add to `packages/backend/src/content-pipeline/posts/posts.service.spec.ts`:

```typescript
describe("PostsService.countByPillar", () => {
  it("returns an exact count per pillar for a brand, defaulting missing pillars to 0", async () => {
    const { supabase } = makePostsFake([
      {
        ...seedPost("draft"),
        id: "p-1",
        brand_id: "brand-1",
        pillar: "attract",
      },
      {
        ...seedPost("draft"),
        id: "p-2",
        brand_id: "brand-1",
        pillar: "attract",
      },
      { ...seedPost("draft"), id: "p-3", brand_id: "brand-1", pillar: "share" },
      {
        ...seedPost("draft"),
        id: "p-4",
        brand_id: "brand-2",
        pillar: "nurture",
      },
    ]);
    const service = new PostsService(supabase);

    const counts = await service.countByPillar("brand-1");
    expect(counts).toEqual({ attract: 2, trust: 0, nurture: 0, share: 1 });
  });

  it("returns all zeros for a brand with no posts", async () => {
    const { supabase } = makePostsFake([]);
    const service = new PostsService(supabase);
    await expect(service.countByPillar("brand-empty")).resolves.toEqual({
      attract: 0,
      trust: 0,
      nurture: 0,
      share: 0,
    });
  });
});

describe("PostsService.setBridgeError", () => {
  it("persists an error message", async () => {
    const { supabase, store } = makePostsFake([seedPost("approved")]);
    const service = new PostsService(supabase);
    const row = await service.setBridgeError(
      "post-1",
      "createRun failed: format not configured",
    );
    expect(row.bridge_error).toBe("createRun failed: format not configured");
    expect(store.posts[0].bridge_error).toBe(
      "createRun failed: format not configured",
    );
  });

  it("clears the error by passing null", async () => {
    const { supabase } = makePostsFake([
      { ...seedPost("approved"), bridge_error: "old failure" },
    ]);
    const service = new PostsService(supabase);
    const row = await service.setBridgeError("post-1", null);
    expect(row.bridge_error).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd packages/backend && npx jest posts.service.spec.ts -t "countByPillar|setBridgeError"`
Expected: FAIL — `service.countByPillar is not a function`.

- [ ] **Step 3: Implement both methods**

In `packages/backend/src/content-pipeline/posts/posts.service.ts`, add the import:

```typescript
import { PILLARS, type ContentPillar } from "../content-purpose";
```

Add after `countAll`:

```typescript
  /**
   * Exact post count per pillar for a brand (four `count: 'exact', head: true`
   * queries — Supabase's JS count API has no GROUP BY). Backs the mix-targeted
   * rotation's deficit calculation (feed/pillar-rotation.ts) and doubles as the
   * within-pillar monotonic cursor, so a brand with no rotation history yet
   * still gets a well-defined (all-zero) starting point.
   */
  async countByPillar(brandId?: string): Promise<Record<ContentPillar, number>> {
    const client = this.supabase.getClient();
    const counts = {} as Record<ContentPillar, number>;
    for (const pillar of PILLARS) {
      let q = client
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('pillar', pillar);
      if (brandId) q = q.eq('brand_id', brandId);
      const { count, error } = await q;
      if (error) throw error;
      counts[pillar] = count ?? 0;
    }
    return counts;
  }
```

Add after `updateMediaRefs` (or any other raw-column-update method — mirrors that method's shape: a direct update outside the status-transition map, since this doesn't change `status`):

```typescript
  /**
   * Record (or clear, with `null`) why the Lane A/B bridge failed to turn this
   * approved video_script post into a real run. Outside the status-transition
   * map on purpose — the post stays `approved`; this only annotates it so the
   * review queue can show a "needs attention" state (spec §3).
   */
  async setBridgeError(id: string, error: string | null): Promise<PostRow> {
    const client = this.supabase.getClient();
    const { data, error: dbError } = await client
      .from('posts')
      .update({ bridge_error: error, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (dbError) throw dbError;
    return data as PostRow;
  }
```

- [ ] **Step 4: Run the tests again**

Run: `cd packages/backend && npx jest posts.service.spec.ts`
Expected: PASS, full file green.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/posts/posts.service.ts packages/backend/src/content-pipeline/posts/posts.service.spec.ts
git commit -m "feat(content-pipeline): add PostsService.countByPillar and setBridgeError"
```

---

### Task 5: Pillar deficit-picker algorithm

**Files:**

- Create: `packages/backend/src/content-pipeline/feed/pillar-rotation.ts`
- Create: `packages/backend/src/content-pipeline/feed/pillar-rotation.spec.ts`

**Interfaces:**

- Consumes: `ContentPillar`, `PILLARS`, `TARGET_MIX`, `FORMAT_PILLAR` from `../content-purpose`; `FEED_POST_TYPES`, `FeedPostType` from `./feed.types`.
- Produces: `LANE_B_AVAILABLE_PILLARS: ReadonlySet<ContentPillar>`, `computeDeficits(counts: Record<ContentPillar, number>): Record<ContentPillar, number>`, `pickPillar(deficits: Record<ContentPillar, number>, available: ReadonlySet<ContentPillar>): ContentPillar`, `pickFormatWithinPillar(pillar: ContentPillar, cursor: number): FeedPostType`. Task 7 wires all four into `FeedTopUpService.topUp()`.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/backend/src/content-pipeline/feed/pillar-rotation.spec.ts
import {
  LANE_B_AVAILABLE_PILLARS,
  computeDeficits,
  pickPillar,
  pickFormatWithinPillar,
} from "./pillar-rotation";

describe("LANE_B_AVAILABLE_PILLARS", () => {
  it("includes attract, nurture, share but not trust (no Lane-B format yet)", () => {
    expect(LANE_B_AVAILABLE_PILLARS.has("attract")).toBe(true);
    expect(LANE_B_AVAILABLE_PILLARS.has("nurture")).toBe(true);
    expect(LANE_B_AVAILABLE_PILLARS.has("share")).toBe(true);
    expect(LANE_B_AVAILABLE_PILLARS.has("trust")).toBe(false);
  });
});

describe("computeDeficits", () => {
  it("bootstraps every pillar to its target share when total is zero", () => {
    const deficits = computeDeficits({
      attract: 0,
      trust: 0,
      nurture: 0,
      share: 0,
    });
    expect(deficits).toEqual({
      attract: 0.4,
      trust: 0.2,
      nurture: 0.2,
      share: 0.2,
    });
  });

  it("matches the spec worked example exactly (10 posts: 7 share/2 attract/1 nurture/0 trust)", () => {
    const deficits = computeDeficits({
      attract: 2,
      trust: 0,
      nurture: 1,
      share: 7,
    });
    expect(deficits.attract).toBeCloseTo(0.4 - 0.2); // +20pp
    expect(deficits.trust).toBeCloseTo(0.2 - 0); // +20pp
    expect(deficits.nurture).toBeCloseTo(0.2 - 0.1); // +10pp
    expect(deficits.share).toBeCloseTo(0.2 - 0.7); // -50pp (was the spec's caught math error: NOT -30pp)
  });
});

describe("pickPillar", () => {
  it("picks the largest deficit among available pillars", () => {
    const deficits = { attract: 0.2, trust: 0.2, nurture: 0.1, share: -0.5 };
    // trust ties attract on paper but has no available Lane-B format — attract wins.
    expect(pickPillar(deficits, LANE_B_AVAILABLE_PILLARS)).toBe("attract");
  });

  it("never returns a pillar outside the available set", () => {
    const deficits = { attract: -1, trust: 0.9, nurture: -1, share: -1 };
    // trust has the huge deficit but zero available formats — must skip it.
    expect(pickPillar(deficits, LANE_B_AVAILABLE_PILLARS)).not.toBe("trust");
  });

  it("is deterministic on an exact tie (first in PILLARS order among available)", () => {
    const deficits = { attract: 0.1, trust: -1, nurture: 0.1, share: -1 };
    expect(pickPillar(deficits, LANE_B_AVAILABLE_PILLARS)).toBe("attract");
  });
});

describe("pickFormatWithinPillar", () => {
  it("rotates between linkedin_post and facebook_post for share", () => {
    expect(pickFormatWithinPillar("share", 0)).toBe("linkedin_post");
    expect(pickFormatWithinPillar("share", 1)).toBe("facebook_post");
    expect(pickFormatWithinPillar("share", 2)).toBe("linkedin_post");
  });

  it("always returns video_script for attract (the only Lane-B attract format today)", () => {
    expect(pickFormatWithinPillar("attract", 0)).toBe("video_script");
    expect(pickFormatWithinPillar("attract", 5)).toBe("video_script");
  });

  it("always returns carousel_copy for nurture (the only Lane-B nurture format today)", () => {
    expect(pickFormatWithinPillar("nurture", 3)).toBe("carousel_copy");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd packages/backend && npx jest pillar-rotation.spec.ts`
Expected: FAIL — `Cannot find module './pillar-rotation'`.

- [ ] **Step 3: Write `pillar-rotation.ts`**

```typescript
// packages/backend/src/content-pipeline/feed/pillar-rotation.ts
//
// The mix-targeted rotation for Lane B (FeedTopUpService.topUp() only — see spec
// §2 "Scope"). Replaces the flat FEED_POST_TYPES[(cursor + i) % length] round-robin
// with a deficit-driven pick: aim for TARGET_MIX, grounded in real historical
// counts (not a synthetic weighted-random, and not an in-memory tracker that
// forgets on every Railway redeploy) so it self-corrects after any gap or pause.

import {
  FORMAT_PILLAR,
  PILLARS,
  TARGET_MIX,
  type ContentPillar,
} from "../content-purpose";
import { FEED_POST_TYPES, type FeedPostType } from "./feed.types";

/** This pillar's formats that Lane B can actually generate (a subset of the
 * full FORMAT_PILLAR table — see plan Implementation Decision 4). */
function laneBFormatsForPillar(pillar: ContentPillar): FeedPostType[] {
  return FEED_POST_TYPES.filter((t) => FORMAT_PILLAR[t] === pillar);
}

/** Pillars with at least one Lane-B-generatable format. `trust` is excluded
 * until Stories (Spec 2) ships a format for it. */
export const LANE_B_AVAILABLE_PILLARS: ReadonlySet<ContentPillar> = new Set(
  PILLARS.filter((p) => laneBFormatsForPillar(p).length > 0),
);

/**
 * How far each pillar is below (positive) or above (negative) its target share
 * of all-time posts. Bootstraps every pillar to its full target share when no
 * posts exist yet (division by zero would otherwise be undefined).
 */
export function computeDeficits(
  counts: Record<ContentPillar, number>,
): Record<ContentPillar, number> {
  const total = PILLARS.reduce((sum, p) => sum + counts[p], 0);
  const deficits = {} as Record<ContentPillar, number>;
  for (const p of PILLARS) {
    deficits[p] = total > 0 ? TARGET_MIX[p] - counts[p] / total : TARGET_MIX[p];
  }
  return deficits;
}

/**
 * The pillar with the largest deficit, restricted to pillars with at least one
 * available format. Ties break deterministically by PILLARS order (attract,
 * trust, nurture, share) so behavior is reproducible in tests and logs.
 */
export function pickPillar(
  deficits: Record<ContentPillar, number>,
  available: ReadonlySet<ContentPillar>,
): ContentPillar {
  let best: ContentPillar | null = null;
  for (const p of PILLARS) {
    if (!available.has(p)) continue;
    if (best === null || deficits[p] > deficits[best]) best = p;
  }
  if (best === null) {
    throw new Error("pickPillar: no available pillar has a Lane-B format");
  }
  return best;
}

/**
 * Round-robin among a pillar's Lane-B formats, offset by `cursor` (the pillar's
 * own all-time post count — see feed-topup.service.ts, which passes
 * counts[pillar] so this reuses the same monotonic-cursor pattern as the
 * cross-pillar fix instead of resetting to 0 every cron tick).
 */
export function pickFormatWithinPillar(
  pillar: ContentPillar,
  cursor: number,
): FeedPostType {
  const formats = laneBFormatsForPillar(pillar);
  return formats[cursor % formats.length];
}
```

- [ ] **Step 4: Run the tests again**

Run: `cd packages/backend && npx jest pillar-rotation.spec.ts`
Expected: PASS, all cases including the worked-example deficit math and the tie-break.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/feed/pillar-rotation.ts packages/backend/src/content-pipeline/feed/pillar-rotation.spec.ts
git commit -m "feat(content-pipeline): add the mix-targeted pillar deficit picker"
```

---

### Task 6: Wire the pillar picker into `FeedTopUpService.topUp()`

**Files:**

- Modify: `packages/backend/src/content-pipeline/feed/feed-topup.service.ts`
- Modify: `packages/backend/src/content-pipeline/feed/feed-topup.service.spec.ts`
- Modify: `packages/backend/src/content-pipeline/feed/__tests__/feed-generation-test-helpers.ts`

**Interfaces:**

- Consumes: `computeDeficits`, `pickPillar`, `pickFormatWithinPillar`, `LANE_B_AVAILABLE_PILLARS` from `./pillar-rotation` (Task 5); `PostsService.countByPillar` (Task 4).
- Produces: `FeedTopUpService.topUp()`'s post-type selection now pillar-driven; market-cursor selection (via `countAll()`) is untouched — spec §2 scopes this to post-type only.

**Implementation Decision (recap):** within one `topUp()` cycle needing `need > 1` posts, this task accumulates the working `counts` object in memory after each pick (incrementing the chosen pillar's count) so a multi-post cycle spreads across pillars by deficit instead of picking the same largest-deficit pillar `need` times in a row. The spec's pseudocode only shows a single pick; this generalizes it to the existing loop.

- [ ] **Step 1: Update the shared test-helper fake to support `countByPillar`**

In `packages/backend/src/content-pipeline/feed/__tests__/feed-generation-test-helpers.ts`, extend `FeedTestOverrides` and the `posts` fake:

```typescript
export type FeedTestOverrides = {
  paused?: boolean;
  pendingCount?: number;
  /** Total posts ever created for the brand (backs the market-cursor rotation). */
  totalCount?: number;
  /** Per-pillar post counts (backs the pillar deficit picker). Defaults to all
   *  zero (bootstrap) when omitted. */
  pillarCounts?: Record<"attract" | "trust" | "nurture" | "share", number>;
  budgetAllowed?: boolean;
  candidates?: number;
  genStatus?: FeedGenerationOutcome["status"];
};
```

```typescript
const posts = {
  listPosts: jest.fn(() => Promise.resolve(pending)),
  countAll: jest.fn(() => Promise.resolve(o.totalCount ?? o.pendingCount ?? 0)),
  countByPillar: jest.fn(() =>
    Promise.resolve(
      o.pillarCounts ?? { attract: 0, trust: 0, nurture: 0, share: 0 },
    ),
  ),
  withSignedMedia: jest.fn((p: unknown) =>
    Promise.resolve({ ...(p as object), mediaUrls: [] }),
  ),
} as unknown as PostsService;
```

- [ ] **Step 2: Write the failing tests for the new pillar-driven picking**

Replace the two existing rotation tests in `packages/backend/src/content-pipeline/feed/feed-topup.service.spec.ts` (`'rotates the post type by total posts ever created...'` and `'does not get stuck on one type...'`) with pillar-aware versions — the old tests asserted flat round-robin across all 4 `FEED_POST_TYPES`, which the new algorithm deliberately does not do (it targets the mix instead):

```typescript
it("picks the pillar with the largest deficit (bootstrap: attract has the biggest target share)", async () => {
  process.env.CONTENT_FEED_TARGET_DRAFTS = "1";
  const { service, generatePost } = build({
    pendingCount: 0,
    pillarCounts: { attract: 0, trust: 0, nurture: 0, share: 0 },
  });
  await service.topUp();
  expect(generatePost.mock.calls[0][2]).toBe("video_script"); // attract's only Lane-B format
});

it("reproduces the spec worked example: share is over target, attract wins the next pick", async () => {
  process.env.CONTENT_FEED_TARGET_DRAFTS = "1";
  const { service, generatePost } = build({
    pendingCount: 0,
    pillarCounts: { attract: 2, trust: 0, nurture: 1, share: 7 },
  });
  await service.topUp();
  expect(generatePost.mock.calls[0][2]).toBe("video_script");
});

it("rotates within a pillar across multiple picks in the same cycle (share: linkedin then facebook)", async () => {
  process.env.CONTENT_FEED_TARGET_DRAFTS = "2";
  // share already meets target exactly, but is the only pillar with >1
  // Lane-B format, so pin the other three pillars far above target to force
  // two consecutive share picks and prove the in-cycle accumulation advances
  // the within-pillar cursor (not just the cross-pillar one).
  const { service, generatePost } = build({
    pendingCount: 0,
    pillarCounts: { attract: 100, trust: 0, nurture: 100, share: 0 },
  });
  await service.topUp();
  expect(generatePost.mock.calls).toHaveLength(2);
  // Both picks land on attract's only format (largest deficit both times,
  // since one attract pick barely dents a 100-post lead) — proves the
  // in-memory count accumulation is being read back on the second iteration
  // rather than recomputing from a stale snapshot.
  expect(generatePost.mock.calls[0][2]).toBe("video_script");
  expect(generatePost.mock.calls[1][2]).toBe("video_script");
});

it("skips trust (no available format) even when it has the largest paper deficit", async () => {
  process.env.CONTENT_FEED_TARGET_DRAFTS = "1";
  const { service, generatePost } = build({
    pendingCount: 0,
    pillarCounts: { attract: 100, trust: 0, nurture: 100, share: 100 },
  });
  await service.topUp();
  // trust's deficit (+20pp off a near-300 total) isn't necessarily the
  // largest here, but this proves trust is never picked regardless: assert
  // the picked type is one of the three available pillars' formats.
  const picked = generatePost.mock.calls[0][2];
  expect([
    "video_script",
    "carousel_copy",
    "linkedin_post",
    "facebook_post",
  ]).toContain(picked);
});
```

Also update the existing candidate-market test (`'delegates one generation per needed draft...'` etc.) if any assert a specific post type from the old flat rotation — check the full spec file for `mock.calls[0][2]` assertions tied to `FEED_POST_TYPES[0]` and adjust the expected value to whatever the bootstrap pillar pick now produces (`'video_script'`, since `attract` has the largest bootstrap deficit of 0.4).

- [ ] **Step 3: Run to confirm the new tests fail**

Run: `cd packages/backend && npx jest feed-topup.service.spec.ts`
Expected: FAIL — `topUp()` still uses `FEED_POST_TYPES[(rotationCursor + i) % FEED_POST_TYPES.length]`, so picks don't match the pillar-driven expectations.

- [ ] **Step 4: Rewrite the picking loop in `feed-topup.service.ts`**

```typescript
import {
  pickCandidateMarkets,
  recordFeedSpend,
} from "./feed-generation-shared";
import { FeedGenerationOutcome } from "./feed.types";
import {
  LANE_B_AVAILABLE_PILLARS,
  computeDeficits,
  pickFormatWithinPillar,
  pickPillar,
} from "./pillar-rotation";
```

(Remove the now-unused `FEED_POST_TYPES` import from `./feed.types` if nothing else in the file references it.)

Replace the body of `topUp()` from the `rotationCursor` line through the generation loop:

```typescript
// Market-pick cursor: unaffected by the pillar taxonomy (spec §2 scopes the
// mix target to post-TYPE selection only). Deliberately NOT pending.length —
// see the comment this replaced, preserved here since the reasoning still
// applies to market picking.
const marketCursor = await this.posts.countAll(brand.id);
const target = this.targetDrafts();
const need = Math.min(target - pending.length, MAX_PER_CYCLE);
if (need <= 0) {
  this.logger.log(
    `feed at target (${pending.length}/${target} pending); nothing to generate`,
  );
  return [];
}

const budget = await this.costCap.canEnqueue(need * EST_USD_PER_POST);
if (!budget.allowed) {
  this.logger.warn(
    `feed top-up skipped: daily budget exhausted (spent $${budget.usdSpent} / cap $${budget.usdCap})`,
  );
  return [
    { postType: "linkedin_post", marketName: "", status: "skipped_budget" },
  ];
}

const candidates = await pickCandidateMarkets(this.contentData);
if (candidates.length === 0) {
  this.logger.warn("feed top-up: no candidate markets available");
  return [];
}

// Working copy of pillar counts, accumulated in memory across this cycle's
// picks (see plan Task 6 note) so a multi-post cycle spreads across pillars
// by deficit instead of dogpiling whichever pillar was furthest behind at
// the start of the cycle.
const pillarCounts = await this.posts.countByPillar(brand.id);

const preamble = await this.stylePreferences.buildGenerationPreamble(brand);
const outcomes: FeedGenerationOutcome[] = [];
let spentUsd = 0;
let spentTokens = 0;

try {
  for (let i = 0; i < need; i++) {
    const deficits = computeDeficits(pillarCounts);
    const pillar = pickPillar(deficits, LANE_B_AVAILABLE_PILLARS);
    const postType = pickFormatWithinPillar(pillar, pillarCounts[pillar]);
    const mover = candidates[(marketCursor + i) % candidates.length];

    if (budget.usdSpent + spentUsd + EST_USD_PER_POST > budget.usdCap) {
      this.logger.warn(
        `feed top-up: budget cap reached mid-cycle (spent ~$${(budget.usdSpent + spentUsd).toFixed(4)} / cap $${budget.usdCap})`,
      );
      outcomes.push({
        postType,
        marketName: mover.canonical_name,
        status: "skipped_budget",
      });
      break;
    }

    const r = await this.generator.generatePost(
      brand,
      preamble,
      postType,
      mover,
      { movers: candidates },
    );
    spentUsd += r.spentUsd;
    spentTokens += r.spentTokens;
    outcomes.push(r.outcome);
    if (r.outcome.status === "inserted") pillarCounts[pillar] += 1;
  }
} finally {
  await recordFeedSpend(this.costCap, this.logger, spentUsd, spentTokens);
}

const inserted = outcomes.filter((o) => o.status === "inserted").length;
this.logger.log(
  `feed top-up: inserted ${inserted}/${need} (spent ~$${spentUsd.toFixed(4)})`,
);
return outcomes;
```

Note the accumulation only advances `pillarCounts[pillar]` when the post actually landed (`status === 'inserted'`) — a lint-failed or errored attempt shouldn't count toward "already served," matching the real `countByPillar()` semantics (which counts persisted rows).

- [ ] **Step 5: Run the tests again**

Run: `cd packages/backend && npx jest feed-topup.service.spec.ts`
Expected: PASS, including the two-in-a-row accumulation test.

- [ ] **Step 6: Run the full content-pipeline suite to catch any other file that imported `FEED_POST_TYPES`-based rotation assumptions**

Run: `cd packages/backend && npx jest content-pipeline`
Expected: PASS. If `feed.service.spec.ts` (the on-demand path, untouched by this task) fails, check whether it happens to assert something about `FEED_POST_TYPES[0]` as a default — `FeedService.generateOnePost`'s `input.postType ?? FEED_POST_TYPES[0]` default is intentionally unchanged (on-demand generation isn't in scope for the mix target per spec §2).

- [ ] **Step 7: `tsc --noEmit` clean**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: no errors (confirms the removed `FEED_POST_TYPES` import, if unused, doesn't leave a dangling reference elsewhere in the file).

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/content-pipeline/feed/feed-topup.service.ts \
  packages/backend/src/content-pipeline/feed/feed-topup.service.spec.ts \
  packages/backend/src/content-pipeline/feed/__tests__/feed-generation-test-helpers.ts
git commit -m "feat(content-pipeline): drive Lane B's cron post-type pick from the pillar deficit, not round-robin"
```

---

### Task 7: `ContentRunsService` additions — pillar stamp, `extraDirectives` wiring, source-post linkage

**Files:**

- Modify: `packages/backend/src/content-pipeline/content-runs.service.ts`
- Create (or extend if it already exists — check first with `Glob content-runs.service.spec.ts`): `packages/backend/src/content-pipeline/content-runs.service.spec.ts`

**Interfaces:**

- Consumes: `getPillarForFormat` from `./content-purpose`.
- Produces: `content_runs.pillar` stamped on every `createRun()`; `dto.extraDirectives` persisted into `format_options.extraDirectives`; `ContentRunsService.findBySourcePostId(postId: string): Promise<{ id: string; status: string } | null>`; `ContentRunsService.setSourcePostId(runId: string, postId: string): Promise<void>`. Task 9 (bridge service) consumes the last two directly.

- [ ] **Step 1: Check whether a spec file already exists for this service**

Run: `Glob packages/backend/src/content-pipeline/content-runs.service.spec.ts` (via the Glob tool, not shell). If it exists, read it first and add to it rather than overwriting. If not, create it fresh following the `makePostsFake`-style pattern from `posts.service.spec.ts` (a hand-rolled Supabase query-builder fake — this codebase does not use a shared mock library for these specs).

- [ ] **Step 2: Write the failing tests**

```typescript
// packages/backend/src/content-pipeline/content-runs.service.spec.ts (new sections
// if the file already exists — do not duplicate an existing test-fake builder)
import { ContentRunsService } from "./content-runs.service";
import { SupabaseService } from "../supabase/supabase.service";
import { RunOrchestratorService } from "./orchestrator/run-orchestrator.service";
import { QueueService } from "./orchestrator/queue.service";
import { ContentDataService } from "./data/content-data.service";
import { RankingResolverService } from "./ranking/ranking-resolver.service";
import { CostCapService } from "./auto-ideation/cost-cap.service";

function makeContentRunsFake(seed: Record<string, unknown>[] = []) {
  const store: { content_runs: Record<string, unknown>[] } = {
    content_runs: [...seed],
  };
  let idCounter = 1;

  function builder(table: "content_runs") {
    let op: "select" | "insert" | "update" = "select";
    const filters: Array<[string, unknown]> = [];
    let insertRow: Record<string, unknown> | null = null;
    let patch: Record<string, unknown> | null = null;

    const match = (rows: Record<string, unknown>[]) =>
      rows.filter((r) => filters.every(([c, v]) => r[c] === v));

    const b = {
      select() {
        return b;
      },
      insert(obj: Record<string, unknown>) {
        op = "insert";
        insertRow = { id: `run-${idCounter++}`, status: "queued", ...obj };
        store[table].push(insertRow);
        return b;
      },
      update(p: Record<string, unknown>) {
        op = "update";
        patch = p;
        return b;
      },
      eq(c: string, v: unknown) {
        filters.push([c, v]);
        return b;
      },
      maybeSingle() {
        if (op === "insert")
          return Promise.resolve({ data: insertRow, error: null });
        if (op === "update") {
          const rows = match(store[table]);
          rows.forEach((r) => Object.assign(r, patch));
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        }
        return Promise.resolve({
          data: match(store[table])[0] ?? null,
          error: null,
        });
      },
      single() {
        return b.maybeSingle();
      },
    };
    return b;
  }

  const supabase = {
    getClient: () => ({ from: (t: "content_runs") => builder(t) }),
  } as unknown as SupabaseService;
  return { supabase, store };
}

function buildService(seed: Record<string, unknown>[] = []) {
  const { supabase, store } = makeContentRunsFake(seed);
  const service = new ContentRunsService(
    supabase,
    {} as RunOrchestratorService,
    {} as QueueService,
    {} as ContentDataService,
    {} as RankingResolverService,
    {} as CostCapService,
  );
  return { service, store };
}

describe("ContentRunsService.findBySourcePostId", () => {
  it("finds the run created from a given post", async () => {
    const { service } = buildService([
      { id: "run-1", status: "queued", source_post_id: "post-1" },
      { id: "run-2", status: "queued", source_post_id: "post-2" },
    ]);
    await expect(service.findBySourcePostId("post-1")).resolves.toEqual({
      id: "run-1",
      status: "queued",
    });
  });

  it("returns null when no run was created from this post", async () => {
    const { service } = buildService([]);
    await expect(service.findBySourcePostId("post-nope")).resolves.toBeNull();
  });
});

describe("ContentRunsService.setSourcePostId", () => {
  it("links a run back to the post that spawned it", async () => {
    const { service, store } = buildService([
      { id: "run-1", status: "queued" },
    ]);
    await service.setSourcePostId("run-1", "post-1");
    expect(store.content_runs[0].source_post_id).toBe("post-1");
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `cd packages/backend && npx jest content-runs.service.spec.ts`
Expected: FAIL — `findBySourcePostId`/`setSourcePostId` don't exist.

- [ ] **Step 4: Add the two new methods to `ContentRunsService`**

In `packages/backend/src/content-pipeline/content-runs.service.ts`, add near `resolveMarket`:

```typescript
  /** Look up the run (if any) the Lane A/B bridge already created for this post
   * — the idempotency check that stops a double-approve or cron-sweep retry
   * from spawning a duplicate video (spec §3 "Idempotency"). */
  async findBySourcePostId(
    postId: string,
  ): Promise<{ id: string; status: string } | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('content_runs')
      .select('id, status')
      .eq('source_post_id', postId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  /** Point a run back at the post that spawned it (Lane A/B bridge traceability,
   * spec §3). Kept as a narrow, separate write rather than a `createRun()`
   * parameter so a public HTTP caller can never set `source_post_id` themselves. */
  async setSourcePostId(runId: string, postId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('content_runs')
      .update({ source_post_id: postId })
      .eq('id', runId);
    if (error) throw error;
  }
```

- [ ] **Step 5: Run the tests again**

Run: `cd packages/backend && npx jest content-runs.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test for pillar stamping + extraDirectives folding**

Add:

```typescript
describe("ContentRunsService.createRun stamps pillar and folds extraDirectives", () => {
  it("stamps the run with the format's pillar", async () => {
    const { service, store } = buildService([]);
    // format_templates / cost-cap / queue calls aren't exercised by this fake —
    // createRun's early-return idempotency path and the direct insert are what
    // this test targets, so stub the remaining collaborators minimally.
    (
      service as unknown as {
        orchestrator: { transitionTo: () => Promise<void> };
      }
    ).orchestrator = { transitionTo: () => Promise.resolve() } as never;
    (
      service as unknown as { queueService: { send: () => Promise<void> } }
    ).queueService = { send: () => Promise.resolve() } as never;
    // format_templates lookup needs its own fake table — see Step 7 note below
    // for why this test is written against the real DB fake extended with a
    // format_templates seed instead of stubbing createRun's internals.
  });
});
```

**Note before writing this test for real:** `createRun()` also queries `format_templates` and calls `this.orchestrator.transitionTo` / `this.queueService.send`. Extend `makeContentRunsFake` to also serve a `format_templates` table (seed one row: `{ format: 'grade_reveal', audience: 'agent', enabled: true, default_approval_mode: 'review', default_tts_provider: 'edge', default_tts_voice_id: 'v1', default_platforms: ['youtube'] }`), and pass real no-op stand-ins for `orchestrator: { transitionTo: jest.fn(() => Promise.resolve()) }` and `queueService: { send: jest.fn(() => Promise.resolve('job-1')) }` as constructor args (both are plain interfaces here, not full NestJS providers, so a plain object satisfies the type). Then:

```typescript
describe("ContentRunsService.createRun stamps pillar and folds extraDirectives", () => {
  function buildFullService() {
    const store: Record<string, Record<string, unknown>[]> = {
      content_runs: [],
      format_templates: [
        {
          format: "grade_reveal",
          audience: "agent",
          enabled: true,
          default_approval_mode: "review",
          default_tts_provider: "edge",
          default_tts_voice_id: "v1",
          default_platforms: ["youtube"],
        },
      ],
    };
    function builder(table: string) {
      let op: "select" | "insert" = "select";
      const filters: Array<[string, unknown]> = [];
      let insertRow: Record<string, unknown> | null = null;
      const match = (rows: Record<string, unknown>[]) =>
        rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      const b = {
        select() {
          return b;
        },
        insert(obj: Record<string, unknown>) {
          op = "insert";
          insertRow = { id: "run-new", status: "queued", ...obj };
          store[table].push(insertRow);
          return b;
        },
        eq(c: string, v: unknown) {
          filters.push([c, v]);
          return b;
        },
        maybeSingle() {
          return Promise.resolve({
            data:
              op === "insert" ? insertRow : (match(store[table])[0] ?? null),
            error: null,
          });
        },
        single() {
          return b.maybeSingle();
        },
      };
      return b;
    }
    const supabase = {
      getClient: () => ({ from: (t: string) => builder(t) }),
    } as unknown as SupabaseService;
    const service = new ContentRunsService(
      supabase,
      {
        transitionTo: jest.fn(() => Promise.resolve()),
      } as unknown as RunOrchestratorService,
      {
        send: jest.fn(() => Promise.resolve("job-1")),
      } as unknown as QueueService,
      {} as ContentDataService,
      {} as RankingResolverService,
      {
        canEnqueue: jest.fn(),
        incrementFormatCount: jest.fn(),
      } as unknown as CostCapService,
    );
    return { service, store };
  }

  it("stamps the run with the format's pillar", async () => {
    const { service, store } = buildFullService();
    await service.createRun({
      format: "grade_reveal",
      marketQuery: "Austin, TX",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    } as never);
    expect(store.content_runs[0].pillar).toBe("attract");
  });

  it("folds extraDirectives into format_options so the script generator can read it", async () => {
    const { service, store } = buildFullService();
    await service.createRun({
      format: "grade_reveal",
      marketQuery: "Austin, TX",
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
      extraDirectives: "Lead with the 12-month momentum angle, not the score.",
    } as never);
    expect(
      (store.content_runs[0].format_options as Record<string, unknown>)
        .extraDirectives,
    ).toBe("Lead with the 12-month momentum angle, not the score.");
  });
});
```

- [ ] **Step 7: Run to confirm failure**

Run: `cd packages/backend && npx jest content-runs.service.spec.ts`
Expected: FAIL — `pillar` and `format_options.extraDirectives` are both `undefined` on the inserted row.

- [ ] **Step 8: Implement the stamping + folding in `createRun()`**

In `packages/backend/src/content-pipeline/content-runs.service.ts`, add the import:

```typescript
import { getPillarForFormat } from "./content-purpose";
```

Update the `formatOptions` construction (just above the insert) to fold in `extraDirectives`:

```typescript
// Persist the operator-approved ranking snapshot under format_options.ranking
// so fetch-data has the markets to render against (skipping the
// single-market resolveMarket lookup that fits other formats). extraDirectives
// rides the same JSONB bag — see generate-script.handler.ts for the read side.
const formatOptions: Record<string, unknown> = {
  ...(dto.formatOptions ?? {}),
  ...(dto.rankingParams ? { ranking: dto.rankingParams } : {}),
  ...(dto.extraDirectives ? { extraDirectives: dto.extraDirectives } : {}),
};
```

Update the insert object to stamp `pillar`:

```typescript
const { data: inserted, error } = await client
  .from("content_runs")
  .insert({
    format: dto.format,
    audience: template.audience,
    market_query: dto.marketQuery,
    approval_mode: dto.approvalMode ?? template.default_approval_mode,
    tts_provider: template.default_tts_provider,
    tts_voice_id: template.default_tts_voice_id,
    selected_platforms: dto.selectedPlatforms ?? template.default_platforms,
    idempotency_key: dto.idempotencyKey,
    batch_id: dto.batchId ?? null,
    format_options: formatOptions,
    pillar: getPillarForFormat(dto.format),
    status: "queued",
    triggered_by: dto.triggeredBy ?? "manual",
  })
  .select("id, status")
  .single();
```

- [ ] **Step 9: Run the tests again**

Run: `cd packages/backend && npx jest content-runs.service.spec.ts`
Expected: PASS.

- [ ] **Step 10: Wire the read side — `generate-script.handler.ts` passes `extraDirectives` to the script generator**

In `packages/backend/src/content-pipeline/orchestrator/job-handlers/generate-script.handler.ts`, extend the local `formatOptions` type and pass the field through:

```typescript
const formatOptions = (run.format_options ?? {}) as {
  windowDays?: number;
  windowLabel?: string;
  priorDate?: string;
  extraDirectives?: string;
  script_repair?: {
    history?: Array<{
      gate: string;
      at?: string;
      violations?: Array<{ quote?: string; issue?: string }>;
    }>;
  };
};
```

```typescript
const result = await this.scriptGen.generate({
  format: run.format,
  audience: run.audience,
  resolvedMarket: run.resolved_geo,
  dataBundle: payload.metadata,
  variantCount: 1,
  ctaText: binding?.cta_text ?? "Get your free Market Snapshot at ",
  videoDurationSeconds: fmt.duration_seconds,
  audioBudgetSeconds,
  wordBudget,
  naturalWpm: fmt.natural_wpm,
  windowLabel: formatOptions.windowLabel,
  extraDirectives: formatOptions.extraDirectives,
  priorFeedback: priorFeedback.length > 0 ? priorFeedback : undefined,
});
```

- [ ] **Step 11: Run the full orchestrator test suite (regression check — no new test required here; this file's existing spec, if any, should still pass with the extra field a harmless addition)**

Run: `cd packages/backend && npx jest orchestrator/job-handlers`
Expected: PASS.

- [ ] **Step 12: `tsc --noEmit` clean**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add packages/backend/src/content-pipeline/content-runs.service.ts \
  packages/backend/src/content-pipeline/content-runs.service.spec.ts \
  packages/backend/src/content-pipeline/orchestrator/job-handlers/generate-script.handler.ts
git commit -m "feat(content-pipeline): stamp content_runs.pillar; wire extraDirectives into script generation

Resolves the spec's open question: CreateRunDto.extraDirectives and
ScriptGeneratorInput.extraDirectives both already existed as typed
fields but nothing connected them. Folds into format_options (already
JSONB, no migration needed) and reads it back in generate-script.handler.ts."
```

---

### Task 8: `VideoScriptBridgeService`

**Files:**

- Create: `packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.service.ts`
- Create: `packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.service.spec.ts`

**Interfaces:**

- Consumes: `ContentRunsService.createRun`, `findBySourcePostId`, `setSourcePostId` (Task 7); `PostsService.getById`, `setBridgeError` (Task 4); `PostRow`, `PostCopy` from `../posts/post.types`.
- Produces: `VideoScriptBridgeService.processApprovedPost(post: PostRow): Promise<BridgeOutcome>` where `BridgeOutcome = { status: 'created' | 'already_exists' | 'not_applicable' | 'failed'; runId?: string; error?: string }`. Task 9 (cron) and Task 10 (controller) both call this one method.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.service.spec.ts
import { VideoScriptBridgeService } from "./video-script-bridge.service";
import { ContentRunsService } from "../content-runs.service";
import { PostsService } from "../posts/posts.service";
import type { PostRow } from "../posts/post.types";

function makePost(overrides: Partial<PostRow> = {}): PostRow {
  return {
    id: "post-1",
    brand_id: "brand-1",
    platform: "youtube",
    post_type: "video_script",
    copy: {
      title: "Austin is heating up",
      hook: "Austin just posted its strongest momentum in 8 months.",
      body: "ZHVI is up 3.2% over 3 months...",
      close: "Watch this one.",
      suggestedFormat: "grade_reveal",
      suggestedMarketQuery: "Austin, TX",
    },
    media_refs: [],
    status: "approved",
    scheduled_at: null,
    published_at: null,
    platform_post_id: null,
    source: "ai_generated",
    error: null,
    attempts: 0,
    pillar: "attract",
    bridge_error: null,
    created_at: "2026-07-27T00:00:00Z",
    updated_at: "2026-07-27T00:00:00Z",
    ...overrides,
  };
}

function build(
  o: {
    existingRun?: { id: string; status: string } | null;
    createRunResult?: { id: string; idempotencyKey: string; status: string };
    createRunError?: Error;
  } = {},
) {
  const setBridgeError = jest.fn(() => Promise.resolve(makePost()));
  const setSourcePostId = jest.fn(() => Promise.resolve(undefined));
  const findBySourcePostId = jest.fn(() =>
    Promise.resolve(o.existingRun ?? null),
  );
  const createRun = jest.fn(() => {
    if (o.createRunError) return Promise.reject(o.createRunError);
    return Promise.resolve(
      o.createRunResult ?? {
        id: "run-new",
        idempotencyKey: "k",
        status: "queued",
      },
    );
  });
  const posts = { setBridgeError } as unknown as PostsService;
  const contentRuns = {
    findBySourcePostId,
    setSourcePostId,
    createRun,
  } as unknown as ContentRunsService;
  const service = new VideoScriptBridgeService(contentRuns, posts);
  return {
    service,
    setBridgeError,
    setSourcePostId,
    findBySourcePostId,
    createRun,
  };
}

describe("VideoScriptBridgeService.processApprovedPost", () => {
  it("is a no-op for a post that is not a video_script", async () => {
    const { service, createRun } = build();
    const outcome = await service.processApprovedPost(
      makePost({ post_type: "linkedin_post" }),
    );
    expect(outcome).toEqual({ status: "not_applicable" });
    expect(createRun).not.toHaveBeenCalled();
  });

  it("is a no-op for a post that is not approved", async () => {
    const { service, createRun } = build();
    const outcome = await service.processApprovedPost(
      makePost({ status: "pending_review" }),
    );
    expect(outcome).toEqual({ status: "not_applicable" });
    expect(createRun).not.toHaveBeenCalled();
  });

  it("is idempotent: skips creation when a run already points at this post", async () => {
    const { service, createRun } = build({
      existingRun: { id: "run-existing", status: "queued" },
    });
    const outcome = await service.processApprovedPost(makePost());
    expect(outcome).toEqual({
      status: "already_exists",
      runId: "run-existing",
    });
    expect(createRun).not.toHaveBeenCalled();
  });

  it("creates a run from the suggestion, links it back, and clears any prior error", async () => {
    const { service, createRun, setSourcePostId, setBridgeError } = build();
    const post = makePost();
    const outcome = await service.processApprovedPost(post);

    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "grade_reveal",
        marketQuery: "Austin, TX",
        triggeredBy: "manual",
        extraDirectives: expect.stringContaining(
          "Austin just posted its strongest momentum",
        ),
      }),
    );
    expect(setSourcePostId).toHaveBeenCalledWith("run-new", "post-1");
    expect(setBridgeError).toHaveBeenCalledWith("post-1", null);
    expect(outcome).toEqual({ status: "created", runId: "run-new" });
  });

  it("surfaces a createRun failure as a visible bridge_error instead of failing silently", async () => {
    const { service, setBridgeError } = build({
      createRunError: new Error("format grade_reveal is disabled"),
    });
    const outcome = await service.processApprovedPost(makePost());
    expect(outcome).toEqual({
      status: "failed",
      error: "format grade_reveal is disabled",
    });
    expect(setBridgeError).toHaveBeenCalledWith(
      "post-1",
      "format grade_reveal is disabled",
    );
  });

  it("falls back to a null suggestedFormat gracefully (createRun itself will reject it — the bridge does not choose a default format)", async () => {
    const { service, createRun } = build();
    await service.processApprovedPost(
      makePost({ copy: { title: "Idea with no format yet" } }),
    );
    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({ format: undefined, marketQuery: undefined }),
    );
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd packages/backend && npx jest video-script-bridge.service.spec.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write `video-script-bridge.service.ts`**

```typescript
// packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.service.ts
//
// The Lane A/B bridge (spec §3): when a video_script suggestion gets approved,
// automatically start the real Lane-A run instead of requiring a human to
// manually walk it through the "New Run" wizard. Lives in ContentPipelineModule
// (not alongside PostsService in PostsBrandKitModule) because it needs
// ContentRunsService, which PostsService/PostsController cannot reach without a
// circular module import — see plan Implementation Decision 2. Triggered by
// VideoScriptBridgeCron's sweep, not an inline call from the approve endpoint.

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ContentRunsService } from "../content-runs.service";
import { PostsService } from "../posts/posts.service";
import type { PostRow } from "../posts/post.types";

export interface BridgeOutcome {
  status: "created" | "already_exists" | "not_applicable" | "failed";
  runId?: string;
  error?: string;
}

@Injectable()
export class VideoScriptBridgeService {
  private readonly logger = new Logger(VideoScriptBridgeService.name);

  constructor(
    private readonly contentRuns: ContentRunsService,
    private readonly posts: PostsService,
  ) {}

  /**
   * Idempotent: safe to call repeatedly for the same post (the cron sweep does,
   * every tick, until it succeeds). Never throws — a failure is recorded on the
   * post via setBridgeError and returned in the outcome, never left silent
   * (spec §3 "Failure handling").
   */
  async processApprovedPost(post: PostRow): Promise<BridgeOutcome> {
    if (post.post_type !== "video_script" || post.status !== "approved") {
      return { status: "not_applicable" };
    }

    const existing = await this.contentRuns.findBySourcePostId(post.id);
    if (existing) {
      return { status: "already_exists", runId: existing.id };
    }

    try {
      const result = await this.contentRuns.createRun({
        format: post.copy.suggestedFormat,
        marketQuery: post.copy.suggestedMarketQuery,
        idempotencyKey: randomUUID(),
        triggeredBy: "manual",
        extraDirectives: this.buildSeedBrief(post),
      } as never);

      if (!result.id) {
        // createRun's 'capped' short-circuit (auto-ideation cost cap) returns
        // an empty id without throwing; the bridge never sets triggeredBy to
        // 'auto_ideation' so this path shouldn't fire, but guard it anyway
        // rather than silently linking a non-existent run.
        throw new Error(
          `createRun returned no run id (status: ${result.status})`,
        );
      }

      await this.contentRuns.setSourcePostId(result.id, post.id);
      await this.posts.setBridgeError(post.id, null);
      this.logger.log(
        `bridged post ${post.id} -> run ${result.id} (format ${post.copy.suggestedFormat ?? "MISSING"})`,
      );
      return { status: "created", runId: result.id };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`bridge failed for post ${post.id}: ${message}`);
      await this.posts.setBridgeError(post.id, message);
      return { status: "failed", error: message };
    }
  }

  /**
   * Fold the suggestion's specific angle (hook/body/close/scene direction) into
   * one directive string so the real script generator doesn't start from a bare
   * format+market with no idea what idea it's supposed to render — this is what
   * the extraDirectives wiring (plan Task 7 / spec Implementation Decision 1)
   * exists for.
   */
  private buildSeedBrief(post: PostRow): string | undefined {
    const { title, hook, body, close, sceneDirection } = post.copy;
    const parts = [
      title && `Working title: ${title}`,
      hook && `Hook: ${hook}`,
      body && `Body: ${body}`,
      close && `Close: ${close}`,
      sceneDirection && `Scene direction: ${sceneDirection}`,
    ].filter((p): p is string => Boolean(p));
    if (parts.length === 0) return undefined;
    return `This run was auto-created from an approved video_script suggestion. Use this specific angle:\n\n${parts.join("\n")}`;
  }
}
```

- [ ] **Step 4: Run the tests again**

Run: `cd packages/backend && npx jest video-script-bridge.service.spec.ts`
Expected: PASS, all 7 cases.

- [ ] **Step 5: `tsc --noEmit` clean**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.service.ts \
  packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.service.spec.ts
git commit -m "feat(content-pipeline): add VideoScriptBridgeService (Lane A/B bridge core)"
```

---

### Task 9: `VideoScriptBridgeCron` + module registration

**Files:**

- Create: `packages/backend/src/content-pipeline/crons/video-script-bridge.cron.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline-analytics.providers.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`

**Interfaces:**

- Consumes: `VideoScriptBridgeService.processApprovedPost` (Task 8); `SupabaseService` for the sweep scan (mirrors `PostAutoSchedulerService.sweep()`'s direct-query pattern, since this cron needs no service-layer abstraction over "select approved video_script posts").

- [ ] **Step 1: Write the cron**

```typescript
// packages/backend/src/content-pipeline/crons/video-script-bridge.cron.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SupabaseService } from "../../supabase/supabase.service";
import { VideoScriptBridgeService } from "../video-script-bridge/video-script-bridge.service";
import type { PostRow } from "../posts/post.types";

/** Most approved-and-unbridged posts one sweep will process, bounding a single tick. */
const SWEEP_BATCH = 50;

/**
 * The Lane A/B bridge's trigger (spec §3): every 2 minutes, turns any approved
 * video_script post that doesn't have a real run yet into one. This IS the "no
 * separate confirm step" from a human's perspective — approving the suggestion
 * is all that's needed; the run appears automatically within one sweep interval.
 * Mirrors AutoScheduleApprovedPostsCron's shape exactly (see plan Implementation
 * Decision 2 for why the trigger is a sweep rather than an inline call from the
 * approve endpoint). Self-healing: a failed attempt just gets retried next tick,
 * same instinct as the publisher's crash-recovery (spec §3).
 *
 * Set CONTENT_PIPELINE_BRIDGE_CRON_DISABLED=true to disable — createRun bills
 * real DeepSeek/TTS/render spend, so this gets the same kill-switch precedent as
 * FeedTopUpCron's CONTENT_FEED_CRON_DISABLED.
 */
@Injectable()
export class VideoScriptBridgeCron {
  private readonly logger = new Logger(VideoScriptBridgeCron.name);
  private running = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly bridge: VideoScriptBridgeService,
  ) {}

  @Cron(CronExpression.EVERY_2_MINUTES)
  async run(): Promise<void> {
    if (process.env.CONTENT_PIPELINE_BRIDGE_CRON_DISABLED === "true") return;
    if (this.running) return;
    this.running = true;
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from("posts")
        .select("*")
        .eq("post_type", "video_script")
        .eq("status", "approved")
        .order("created_at", { ascending: true })
        .limit(SWEEP_BATCH);
      if (error) {
        this.logger.error(`bridge sweep scan failed: ${error.message}`);
        return;
      }

      let created = 0;
      let alreadyLinked = 0;
      let failed = 0;
      for (const row of (data ?? []) as PostRow[]) {
        const outcome = await this.bridge.processApprovedPost(row);
        if (outcome.status === "created") created += 1;
        else if (outcome.status === "already_exists") alreadyLinked += 1;
        else if (outcome.status === "failed") failed += 1;
      }
      if (created > 0 || failed > 0) {
        this.logger.log(
          `bridge sweep: ${created} created, ${alreadyLinked} already linked, ${failed} failed of ${(data ?? []).length} scanned`,
        );
      }
    } catch (err) {
      this.logger.error(`bridge sweep failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
```

- [ ] **Step 2: Register the cron and the service as providers**

In `packages/backend/src/content-pipeline/content-pipeline-analytics.providers.ts`, add the import and array entry:

```typescript
import { VideoScriptBridgeCron } from "./crons/video-script-bridge.cron";
```

```typescript
  FeedTopUpCron,
  AutoScheduleApprovedPostsCron,
  VideoScriptBridgeCron,
];
```

In `packages/backend/src/content-pipeline/content-pipeline.module.ts`, add the import and register `VideoScriptBridgeService` in `providers` (near `FeedService`/`FeedTopUpService`):

```typescript
import { VideoScriptBridgeService } from "./video-script-bridge/video-script-bridge.service";
```

```typescript
    FeedService,
    FeedTopUpService,
    FeedPostGeneratorService,
    VideoScriptBridgeService,
    PostImageRenderService,
    PostVideoCardService,
```

- [ ] **Step 3: `tsc --noEmit` clean (confirms the DI graph resolves — `VideoScriptBridgeCron` and `VideoScriptBridgeService` both find their dependencies with no circular-import errors)**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Boot the backend locally and confirm no NestJS DI resolution error at startup**

Run: `cd packages/backend && npm run start:dev` (or the project's standard local-dev command — check `local-dev-servers` skill / `package.json` if the exact script name differs), watch the boot log.
Expected: `Nest application successfully started` with no `UnknownDependenciesException` for `VideoScriptBridgeCron` or `VideoScriptBridgeService`. Stop the server after confirming (Ctrl+C or kill the background process) — this step is a boot smoke test, not a long-running verification.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/crons/video-script-bridge.cron.ts \
  packages/backend/src/content-pipeline/content-pipeline-analytics.providers.ts \
  packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): add VideoScriptBridgeCron sweep (every 2min, mirrors AutoScheduleApprovedPostsCron)"
```

---

### Task 10: Bridge status + retry endpoints

**Files:**

- Create: `packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`

**Interfaces:**

- Consumes: `PostsService.getById` (existing), `ContentRunsService.findBySourcePostId` (Task 7), `VideoScriptBridgeService.processApprovedPost` (Task 8).
- Produces: `GET /api/admin/content-pipeline/posts/:id/bridge-status` → `{ success: true, data: { status: 'not_applicable' | 'pending' | 'created' | 'failed'; runId?: string; error?: string } }`; `POST /api/admin/content-pipeline/posts/:id/retry-bridge` → same shape, after re-attempting. Task 12 (frontend) is the only consumer.

- [ ] **Step 1: Write the controller (no dedicated spec file — this is a thin wrapper around already-unit-tested service methods; the live verification gate in Task 14 covers it end to end, consistent with how `PostsController` itself has no spec file either)**

```typescript
// packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.controller.ts
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../../common/guards/admin-auth.guard";
import { PostsService } from "../posts/posts.service";
import { ContentRunsService } from "../content-runs.service";
import { VideoScriptBridgeService } from "./video-script-bridge.service";

export interface BridgeStatusResponse {
  status: "not_applicable" | "pending" | "created" | "failed";
  runId?: string;
  error?: string;
}

/**
 * Read + manual-retry surface for the Lane A/B bridge (VideoScriptBridgeCron
 * normally does this automatically every 2 minutes — this controller exists so
 * the review-queue UI can show real-time status and let an operator force an
 * immediate retry instead of waiting out the sweep interval).
 */
@UseGuards(AdminGuard)
@Controller("api/admin/content-pipeline/posts")
export class VideoScriptBridgeController {
  constructor(
    private readonly posts: PostsService,
    private readonly contentRuns: ContentRunsService,
    private readonly bridge: VideoScriptBridgeService,
  ) {}

  @Get(":id/bridge-status")
  async status(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<{ success: true; data: BridgeStatusResponse }> {
    return { success: true, data: await this.resolveStatus(id) };
  }

  @Post(":id/retry-bridge")
  async retry(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<{ success: true; data: BridgeStatusResponse }> {
    const post = await this.posts.getById(id);
    await this.bridge.processApprovedPost(post);
    return { success: true, data: await this.resolveStatus(id) };
  }

  private async resolveStatus(id: string): Promise<BridgeStatusResponse> {
    const post = await this.posts.getById(id);
    if (post.post_type !== "video_script") return { status: "not_applicable" };
    const run = await this.contentRuns.findBySourcePostId(id);
    if (run) return { status: "created", runId: run.id };
    if (post.bridge_error)
      return { status: "failed", error: post.bridge_error };
    return { status: "pending" };
  }
}
```

- [ ] **Step 2: Register the controller**

In `packages/backend/src/content-pipeline/content-pipeline.module.ts`, add the import and register in `controllers` (near `PostGenerateController`):

```typescript
import { VideoScriptBridgeController } from "./video-script-bridge/video-script-bridge.controller";
```

```typescript
    PostGenerateController,
    VideoScriptBridgeController,
    InfographicOptionsController,
```

- [ ] **Step 3: `tsc --noEmit` clean**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test against the running dev backend**

With the backend running locally (`npm run start:dev`), find a real `video_script` post id (or generate one via the existing `/generate` on-demand endpoint) and:

```bash
curl -s http://localhost:3001/api/admin/content-pipeline/posts/<id>/bridge-status
```

Expected: `{"success":true,"data":{"status":"pending"}}` for an unapproved post, or `{"status":"not_applicable"}` if it isn't a `video_script`. (Full end-to-end — approve, see `status: "created"` with a real `runId` — happens in Task 14's verification gate, after the frontend wiring gives a real way to approve one.)

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/video-script-bridge/video-script-bridge.controller.ts \
  packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): add bridge-status and retry-bridge endpoints"
```

---

### Task 11: Frontend — Approve replaces "Make this video" as the primary action

**Files:**

- Modify: `packages/frontend/app/(app)/admin/content-pipeline/lib/posts-api.ts`
- Modify: `packages/frontend/app/(app)/admin/content-pipeline/video-scripts/VideoScriptCard.tsx`
- Modify: `packages/frontend/app/(app)/admin/content-pipeline/review/post-review-card.tsx`

**Interfaces:**

- Consumes: `approvePost` (already exists in `posts-api.ts`, currently unused by these two components).
- Produces: `VideoScriptCard` and `ScriptReview` both gain an `onApprove` action; `PlannerPost.pillar` and `PlannerPost.bridgeError` typed for later use in Task 12.

**Before touching JSX:** this task changes a user-facing interaction (a suggestion card's primary button). Per this project's standing rule, invoke the `frontend-design` skill before finalizing the visual treatment of the new Approve button / status chip — the code below gets the data flow and copy right, but skill guidance should drive the exact M3 styling choices if they diverge from what's written here (which reuses the existing `MockupReview` approve button's exact classes for consistency).

- [ ] **Step 1: Add `pillar`/`bridgeError` to the frontend `PlannerPost` type**

In `packages/frontend/app/(app)/admin/content-pipeline/lib/posts-api.ts`, extend `PlannerPost`:

```typescript
export interface PlannerPost {
  id: string;
  brand_id: string;
  platform: string;
  post_type: string;
  copy: PostCopy;
  media_refs: PostMediaRef[];
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  source: string;
  mediaUrls?: string[];
  error: string | null;
  attempts: number;
  /** Strategic pillar this post served (content-purpose taxonomy). Null for
   *  formats outside the pillar system. */
  pillar: "attract" | "trust" | "nurture" | "share" | null;
  /** Set when the Lane A/B bridge failed to turn this approved video_script
   *  into a real run; null otherwise. */
  bridgeError: string | null;
  created_at: string;
  updated_at: string;
}
```

Note the backend's `PostRow.bridge_error` is snake_case; confirm whether this codebase's fetch layer does snake_case→camelCase mapping anywhere in `fetchAPI`/`fetchAPIRaw` before assuming `bridgeError` arrives pre-mapped — if it does not (most of this file's other fields, e.g. `platform_post_id`, `media_refs`, `scheduled_at`, stay snake_case all the way through), rename this field to `bridge_error: string | null` instead to match the established convention in this exact file, and adjust every reference in Tasks 11-12 accordingly.

- [ ] **Step 2: Update `VideoScriptCard.tsx` — Approve as primary, "Customize in wizard" as secondary**

Replace the props and the action row:

```tsx
export function VideoScriptCard({
  post,
  onApprove,
  onSkip,
  approving = false,
  skipping = false,
}: {
  post: PlannerPost;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
  approving?: boolean;
  skipping?: boolean;
}) {
```

```tsx
<div className="mt-4 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-4">
  {post.status === "approved" ? (
    <BridgeStatusChip postId={post.id} />
  ) : (
    <button
      type="button"
      onClick={() => onApprove(post.id)}
      disabled={approving}
      className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {approving ? "Approving…" : "Approve → send to video"}
    </button>
  )}
  <Link
    href={buildMakeVideoHref(post)}
    className="rounded-full px-3.5 py-2 text-sm font-medium text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-high"
  >
    Customize in wizard
  </Link>
  <button
    type="button"
    onClick={copyScript}
    className="rounded-full px-3.5 py-2 text-sm font-medium text-on-surface transition-colors duration-200 hover:bg-surface-container-high"
  >
    {copied ? "Copied" : "Copy script"}
  </button>
  {post.status !== "approved" && (
    <button
      type="button"
      onClick={() => onSkip(post.id)}
      disabled={skipping}
      className="ml-auto rounded-full px-3.5 py-2 text-sm font-medium text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-high disabled:opacity-50"
    >
      Skip
    </button>
  )}
</div>
```

`BridgeStatusChip` is built in Task 12 (it needs the fetcher created there) — leave it as a forward reference for now; Task 12's Step 1 creates the component this imports.

- [ ] **Step 3: Update `ScriptReview` in `post-review-card.tsx` to receive and use `onApprove`**

`PostReviewCard`'s top-level dispatch currently drops `onApprove`/`approving` when routing to `ScriptReview`. Fix the dispatch:

```tsx
if (isVideoScriptItem(item)) {
  return (
    <ScriptReview
      item={item}
      onApprove={onApprove}
      onSkip={onSkip}
      approving={approving}
      skipping={skipping}
    />
  );
}
```

Update `ScriptReview` itself:

```tsx
function ScriptReview({
  item,
  onApprove,
  onSkip,
  approving,
  skipping,
}: {
  item: QueueItem;
  onApprove: () => void;
  onSkip: () => void;
  approving: boolean;
  skipping: boolean;
}) {
  const script = normalizeVideoScript(item);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <ChipRow item={item} />
      <h2 className="text-xl font-semibold text-on-surface">{script.title}</h2>

      <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-5">
        {script.hook && <ScriptBlock label="Hook" text={script.hook} />}
        {script.body && <ScriptBlock label="Body" text={script.body} />}
        {script.close && <ScriptBlock label="Close" text={script.close} />}
        {script.sceneDirection && (
          <ScriptBlock label="Scene direction" text={script.sceneDirection} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {item.status === "approved" ? (
          <BridgeStatusChip postId={item.id} />
        ) : (
          <button
            type="button"
            onClick={onApprove}
            disabled={approving}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60"
          >
            {approving ? "Approving…" : "Approve → send to video"}
          </button>
        )}
        <Link
          href={buildMakeVideoHref(item)}
          className="rounded-full border border-outline-variant px-6 py-2.5 text-sm font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container-high"
        >
          Customize in wizard
        </Link>
        {item.status !== "approved" && (
          <button
            type="button"
            onClick={onSkip}
            disabled={skipping}
            className="rounded-full border border-outline-variant px-6 py-2.5 text-sm font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container-high disabled:opacity-60"
          >
            {skipping ? "Skipping…" : "Skip"}
          </button>
        )}
        <Link
          href="/admin/content-pipeline/video-scripts"
          className="rounded-full px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/10"
        >
          All video ideas
        </Link>
      </div>
    </div>
  );
}
```

Add the import at the top of `post-review-card.tsx`: `import { BridgeStatusChip } from "../video-scripts/bridge-status-chip";` (created in Task 12).

- [ ] **Step 4: Update `video-scripts/page.tsx`'s render call to pass the new props (its `scripts.map` call currently only passes `onSkip`/`skipping`)**

```tsx
{
  scripts.map((post) => (
    <VideoScriptCard
      key={post.id}
      post={post}
      onApprove={(id) => approveMut.mutate(id)}
      onSkip={(id) => skipMut.mutate(id)}
      approving={approveMut.isPending && approveMut.variables === post.id}
      skipping={skipMut.isPending && skipMut.variables === post.id}
    />
  ));
}
```

Add the `approveMut` mutation next to the existing `skipMut` in the same file:

```tsx
const approveMut = useMutation({
  mutationFn: (id: string) => approvePost(id),
  onSuccess: () => {
    toast.success("Sent to the video pipeline");
    qc.invalidateQueries({ queryKey: VIDEO_SCRIPTS_KEY });
  },
  onError: (e: Error) => toast.error(`Couldn't approve: ${e.message}`),
});
```

And update the import line: `import { fetchPosts, generatePost, approvePost, skipPost } from "../lib/posts-api";`

- [ ] **Step 5: Run the existing frontend tests for these components (regression check — Task 12 adds new assertions once `BridgeStatusChip` exists)**

Run: `cd packages/frontend && npx vitest run content-pipeline --silent`
Expected: existing `ReviewPeekCard.test.tsx` and any `VideoScriptCard`/`post-review-card` tests either pass unchanged or fail only where they asserted the old "Make this video" primary-action text — update those specific assertions to `"Approve → send to video"` / `"Customize in wizard"` as needed, without broadening scope beyond this task's actual change.

- [ ] **Step 6: `tsc --noEmit` clean on the frontend**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: errors only from the still-missing `BridgeStatusChip`/`bridge-status-chip` import (Task 12 creates it) — confirm no other type errors, then proceed to Task 12 before committing (this task and the next are tightly coupled; commit together at the end of Task 12 rather than leaving a broken import mid-history).

---

### Task 12: Frontend — `BridgeStatusChip` + fetchers + video-scripts page "sent to video" section

**Files:**

- Create: `packages/frontend/app/(app)/admin/content-pipeline/lib/video-script-bridge-api.ts`
- Create: `packages/frontend/app/(app)/admin/content-pipeline/video-scripts/bridge-status-chip.tsx`
- Modify: `packages/frontend/app/(app)/admin/content-pipeline/video-scripts/page.tsx`

**Interfaces:**

- Consumes: `GET /posts/:id/bridge-status`, `POST /posts/:id/retry-bridge` (Task 10).
- Produces: `fetchBridgeStatus(postId): Promise<BridgeStatus>`, `retryBridge(postId): Promise<BridgeStatus>`, `<BridgeStatusChip postId={string} />` (used by both Task 11 components).

- [ ] **Step 1: Write the fetcher module**

```typescript
// packages/frontend/app/(app)/admin/content-pipeline/lib/video-script-bridge-api.ts
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export interface BridgeStatus {
  status: "not_applicable" | "pending" | "created" | "failed";
  runId?: string;
  error?: string;
}

async function bridgeAction(
  id: string,
  path: "bridge-status" | "retry-bridge",
  method: "GET" | "POST",
): Promise<BridgeStatus> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/posts/${id}/${path}`,
    { method },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`bridge ${path} failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    success?: boolean;
    data: BridgeStatus;
    error?: string;
  };
  if (json.success === false)
    throw new Error(json.error ?? `bridge ${path} failed`);
  return json.data;
}

/** Current Lane A/B bridge status for an approved video_script post. */
export function fetchBridgeStatus(postId: string): Promise<BridgeStatus> {
  return bridgeAction(postId, "bridge-status", "GET");
}

/** Force an immediate retry instead of waiting for the next cron sweep (~2min). */
export function retryBridge(postId: string): Promise<BridgeStatus> {
  return bridgeAction(postId, "retry-bridge", "POST");
}
```

- [ ] **Step 2: Write `BridgeStatusChip`**

```tsx
// packages/frontend/app/(app)/admin/content-pipeline/video-scripts/bridge-status-chip.tsx
"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBridgeStatus, retryBridge } from "../lib/video-script-bridge-api";

/**
 * Traceability for an approved video_script post (spec §3: "the review-queue UI
 * can show → now rendering as video instead of the post looking finished-but-
 * inert at approved"). Polls briefly since the bridge cron sweeps every 2
 * minutes — a human watching this chip right after approving shouldn't have to
 * manually refresh to see it flip from "Sending to video…" to "Rendering".
 */
export function BridgeStatusChip({ postId }: { postId: string }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["bridge-status", postId],
    queryFn: () => fetchBridgeStatus(postId),
    refetchInterval: (q) =>
      q.state.data?.status === "pending" ? 15_000 : false,
  });
  const retryMut = useMutation({
    mutationFn: () => retryBridge(postId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["bridge-status", postId] }),
  });

  if (!query.data || query.data.status === "not_applicable") return null;

  if (query.data.status === "created") {
    return (
      <Link
        href={`/admin/content-pipeline/runs/${query.data.runId}`}
        className="rounded-full bg-primary-container px-3.5 py-2 text-sm font-medium text-on-primary-container transition-colors duration-200 hover:bg-primary-container/80"
      >
        → Now rendering as video
      </Link>
    );
  }

  if (query.data.status === "failed") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-error/40 bg-error-container/40 px-3.5 py-2 text-sm text-on-surface">
        <span>Couldn&apos;t send to video</span>
        <button
          type="button"
          onClick={() => retryMut.mutate()}
          disabled={retryMut.isPending}
          className="font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-60"
        >
          {retryMut.isPending ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  // pending — waiting for the next sweep.
  return (
    <span className="rounded-full bg-surface-container-high px-3.5 py-2 text-sm text-on-surface-variant">
      Sending to video…
    </span>
  );
}
```

- [ ] **Step 3: Extend `video-scripts/page.tsx` to show approved (bridged/pending/failed) scripts alongside pending suggestions**

Change the query to fetch both statuses and partition client-side:

```tsx
const pendingQuery = useQuery({
  queryKey: VIDEO_SCRIPTS_KEY,
  queryFn: () => fetchPosts({ status: "pending_review", limit: 200 }),
  refetchInterval: 60_000,
});
const approvedQuery = useQuery({
  queryKey: [...VIDEO_SCRIPTS_KEY, "approved"],
  queryFn: () => fetchPosts({ status: "approved", limit: 50 }),
  refetchInterval: 60_000,
});

const scripts = useMemo(
  () =>
    (pendingQuery.data?.posts ?? []).filter(
      (p) => p.post_type === "video_script",
    ),
  [pendingQuery.data],
);
const sentToVideo = useMemo(
  () =>
    (approvedQuery.data?.posts ?? []).filter(
      (p) => p.post_type === "video_script",
    ),
  [approvedQuery.data],
);
```

Add a section below the existing grid (after the closing `)}` of the pending-scripts block, still inside the outer `<div className="mx-auto max-w-6xl space-y-6 p-8">`):

```tsx
{
  sentToVideo.length > 0 && (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-on-surface">Sent to video</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sentToVideo.map((post) => (
          <div
            key={post.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4"
          >
            <p className="truncate text-sm font-medium text-on-surface">
              {post.copy.title || post.copy.hook || "Untitled script"}
            </p>
            <BridgeStatusChip postId={post.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Update the `query.isLoading`/`query.isError` guards to reference `pendingQuery` explicitly (renamed from `query`), and add the `BridgeStatusChip` import.

- [ ] **Step 4: `tsc --noEmit` clean on the frontend (this closes out the dangling import from Task 11 Step 6)**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual browser verification (per CLAUDE.md — UI changes must be checked live, not just type-checked)**

Start the frontend dev server (use the `local-dev-servers` skill if unsure how — port 3000 or the 3100 mobile-preview instance), navigate to `/admin/content-pipeline/video-scripts`, and confirm:

- A pending suggestion shows "Approve → send to video" and "Customize in wizard" (no bare "Make this video" link remains as the sole action).
- Clicking Approve moves the card out of the pending grid and it reappears under "Sent to video" with a status chip.
- The chip starts as "Sending to video…", and — after the next bridge cron tick (or a manual `retry-bridge` curl if waiting 2 minutes isn't practical during dev) — flips to "→ Now rendering as video" linking to the real run detail page.

- [ ] **Step 6: Commit both Task 11 and Task 12 together (they share one working tree state — Task 11 left a dangling import this task resolves)**

```bash
git add packages/frontend/app/\(app\)/admin/content-pipeline/lib/posts-api.ts \
  packages/frontend/app/\(app\)/admin/content-pipeline/lib/video-script-bridge-api.ts \
  packages/frontend/app/\(app\)/admin/content-pipeline/video-scripts/VideoScriptCard.tsx \
  packages/frontend/app/\(app\)/admin/content-pipeline/video-scripts/bridge-status-chip.tsx \
  packages/frontend/app/\(app\)/admin/content-pipeline/video-scripts/page.tsx \
  packages/frontend/app/\(app\)/admin/content-pipeline/review/post-review-card.tsx
git commit -m "feat(content-pipeline): approve replaces manual wizard hand-off for video_script suggestions

Approve is now the primary action (calls the standard approve endpoint,
same as every other post type); the bridge cron auto-creates the real
Lane-A run within ~2 minutes. 'Customize in wizard' stays as a manual
override. New BridgeStatusChip shows pending/rendering/needs-attention
with a retry action, per spec §3's traceability requirement."
```

---

### Task 13: Update `tasks/todo.md`

**Files:**

- Modify: `tasks/todo.md`

- [ ] **Step 1: Check off the items this plan completes**

In the "Immediate (unblocked, ready now)" section, check off both items (the rotation-fix commit from Task 0, and this plan itself). Leave the "Deferred, sequenced" (Stories, Spec 3) and "Identified but not yet actioned" sections untouched — they're explicitly out of scope for this plan.

- [ ] **Step 2: Add a completion note**

Append a short "Review" subsection under the content-pipeline heading summarizing what shipped, mirroring the style of this file's other "Review" sections (e.g. the GEO Top-5 Fixes section) — file paths, test counts, and the live verification result from Task 14, filled in once that task actually runs.

- [ ] **Step 3: Commit**

```bash
git add tasks/todo.md
git commit -m "docs(tasks): check off content-purpose taxonomy work"
```

---

### Task 14: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Backend `tsc --noEmit` clean**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: zero errors. Per `tasks/lessons.md`'s "Build Verification Must Fix ALL Errors" rule — if anything unrelated is also broken, fix it before proceeding; don't dismiss it as pre-existing.

- [ ] **Step 2: Full backend content-pipeline Jest suite green**

Run: `cd packages/backend && npx jest content-pipeline`
Expected: 100% pass, including every spec touched or added across Tasks 1–10 (`content-purpose.spec.ts`, `pillar-rotation.spec.ts`, `feed-topup.service.spec.ts`, `feed.service.spec.ts`, `posts.service.spec.ts`, `content-runs.service.spec.ts`, `video-script-bridge.service.spec.ts`).

- [ ] **Step 3: Frontend `tsc --noEmit` clean**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Live check — a manually-approved video_script post actually produces a content_runs row with the right source_post_id**

Against the running local stack: generate a `video_script` post (via the Video Scripts page's "Suggest one now", or the existing on-demand `/generate` endpoint), approve it through the new Approve button, wait for the bridge cron tick (or call `retry-bridge` to force it immediately), then verify directly against the database:

```sql
SELECT p.id AS post_id, p.status, p.bridge_error, cr.id AS run_id, cr.format, cr.pillar, cr.source_post_id
FROM posts p
LEFT JOIN content_runs cr ON cr.source_post_id = p.id
WHERE p.id = '<the post id>';
```

Expected: exactly one `content_runs` row, `source_post_id` matching the post, `pillar = 'attract'`, `bridge_error IS NULL`. This is the spec's explicit "real artifact at destination" gate (§4) — a green test suite alone does not satisfy it.

- [ ] **Step 5: Confirm the mix rotation is live-correct**

Query the last several Lane-B-generated posts' pillars and eyeball that the distribution is trending toward the target mix rather than repeating one pillar:

```sql
SELECT pillar, count(*) FROM posts
WHERE source = 'ai_generated' AND post_type IN ('linkedin_post','facebook_post','carousel_copy','video_script')
GROUP BY pillar ORDER BY pillar;
```

Expected: no pillar count is wildly disproportionate to `TARGET_MIX` given the sample size (exact matching isn't expected on a small sample — the deficit picker converges over time, it doesn't force an exact ratio every N posts).

- [ ] **Step 6: Record the verification result in `tasks/todo.md`'s Review section (from Task 13)**

Fill in the note left as a placeholder in Task 13 with the actual test counts and the live-check post/run ids observed in Steps 2 and 4.

- [ ] **Step 7: Final commit if Step 6 touched the file, or confirm the tree is clean**

Run: `git status --porcelain=v1`
Expected: clean except for the unrelated pre-existing untracked tooling directories noted in Task 0 Step 4, which this plan never touches.

---

## Self-Review

**Spec coverage:**

- §1 Data model → Tasks 1, 2, 3, 7 (columns, `FORMAT_PILLAR`, stamping on both lanes).
- §2 Mix-targeted rotation → Tasks 4, 5, 6 (`countByPillar`, deficit picker, wiring into `topUp()`, within-pillar rotation).
- §3 Lane A/B bridge (trigger, creation, traceability, idempotency, failure handling) → Tasks 7, 8, 9, 10, 11, 12.
- §4 Rollout & testing (migration, the four required test categories, the verification gate) → Task 1 (migration) and Task 14 (gate); the four test categories map to Task 2 (`FORMAT_PILLAR` completeness), Task 4 (`countByPillar`), Task 5 (deficit-picker bootstrap/tie-break/skip-over), Task 8 (bridge success/failure/idempotency) exactly as spec-named.
- Explicitly-out-of-scope items (Stories, trend-awareness, pillar-performance dashboards) → untouched by this plan, confirmed by absence from the File Structure section.

**Placeholder scan:** no `TBD`/`implement later`/prose-only steps found: every code step above has real code, every test has real assertions, every shell step has a concrete command and an expected result.

**Type consistency check:** `ContentPillar` (Task 2) is the single type used everywhere downstream (Tasks 3, 4, 5, 6, 7, 11 all import it, never redeclare it). `BridgeOutcome`/`BridgeStatus` are two distinct but consistent shapes by design — `BridgeOutcome` (Task 8, backend-internal, richer `status` enum including `'not_applicable'`) vs `BridgeStatus` (Task 10/12, the public HTTP contract) — the controller (Task 10) is exactly where the translation between them happens (`resolveStatus()`), so this isn't an accidental mismatch. `PostRow.pillar`/`PostRow.bridge_error` (Task 3) match the column names from Task 1's migration exactly. `VideoScriptBridgeService`'s constructor order (`ContentRunsService, PostsService`) matches every call site that constructs it directly in tests (Task 8) and DI registration (Task 9) — no positional mismatch.

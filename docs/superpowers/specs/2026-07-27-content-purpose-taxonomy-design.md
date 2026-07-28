# Content Purpose Taxonomy, Mix-Targeted Rotation, and the Lane A/B Bridge

**Status:** Design approved by Troy 2026-07-27, pending implementation plan.
**Author:** Claude (design session with Troy), 2026-07-27.

## Context

Troy laid out a content-strategy framework for the PropertyIQ content pipeline (SocialAuto):

- **Reels** attract new followers (top-of-funnel reach/discovery).
- **Stories** build community, drive sales, and build trust (mid-funnel relationship).
- **Carousels** nurture and educate the current audience (retention/education).
- **Posts** (savable/shareable — quotes, lists, etc.) grow following through saves/shares.

This session's audit of the existing content pipeline found no concept of "purpose" anywhere in the system — generation just rotates through modality types (linkedin*post, facebook_post, carousel_copy, video_script in Lane B; nine video script archetypes in Lane A) with no notion of what each piece of content is strategically \_for*. Separately, the same-day audit found and fixed a rotation bug in the Lane B cron (`feed-topup.cron.ts`): the post-type and candidate-market picks reset their index to `0` on every 30-minute tick, so a typical one-post-per-tick cycle almost always regenerated the same early type — live data showed 7 linkedin_post / 2 facebook_post / 1 carousel_copy / 0 video_script out of the first 10 posts ever generated. That fix (offsetting by `PostsService.countAll(brandId)`, a monotonic cursor) is implemented, tested, and reviewed separately from this spec, and this design reuses its pattern.

This spec covers three things Troy asked to bundle into one project:

1. A **content-purpose taxonomy** (the four pillars above) applied to every format in both lanes.
2. A **mix-targeted rotation** for Lane B so generation deliberately aims for a target ratio across pillars instead of even/round-robin rotation across formats.
3. The **Lane A/B bridge** — closing the gap where an approved Lane-B `video_script` suggestion currently requires a human to manually start the real Lane-A video run, discovered during this same audit as a consequence of pillar mix-targeting: without the bridge, the scheduler will correctly push more "attract" content that is only ever a suggestion, never a real video.

**Explicitly out of scope for this spec** (tracked as separate, sequenced specs — see `tasks/todo.md`):

- **Stories as a new format** (Spec 2) — no format, template, or Late/publish path exists for Stories today; this is a new subsystem, not a retag. The `trust` pillar is reserved in this spec's data model with zero formats mapped to it, so Stories can slot in later with no changes to the scheduler.
- **Trend-awareness** (Spec 3, after Stories) — designing generation to model what's currently trending on social platforms. Needs its own trend-data ingestion (per-platform: TikTok trending sounds/hashtags, Instagram trending audio, X trending topics) and prompt changes. Genuinely separate subsystem from the taxonomy/mix work here; sequenced after Stories per Troy's decision.
- **Pillar-performance analytics dashboards** — the data model here writes `pillar` everywhere needed so this is possible later, but building the reporting UI is deferred: this session's audit also found `content_metrics` is stale (no content published since April 2026), so there's no real data to report on yet. Resolves itself once Lane A/B publishing resumes.

## 1. Data model

**New type:** `ContentPillar = 'attract' | 'trust' | 'nurture' | 'share'`.

**New unified static lookup**, `FORMAT_PILLAR`, covering both lanes' format identifiers in one place (mirrors the existing `FEED_POST_TYPES` / `CONTENT_FORMATS` const-array pattern already used in this codebase — not a new DB table, since `format_templates` is Lane-A-only and this mapping is small and rarely changes):

| Format                                                                                                                                                                     | Lane  | Pillar                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| `video_script`, `grade_reveal`, `top_10_ranking`, `bottom_10_ranking`, `score_mover`, `head_to_head`, `farm_area_spotlight`, `brokerage_market_share`, `recruitment_angle` | B / A | `attract`                                                                                        |
| `carousel_copy`, `long_form_deep_dive`                                                                                                                                     | B / A | `nurture`                                                                                        |
| `linkedin_post`, `facebook_post`                                                                                                                                           | B     | `share`                                                                                          |
| _(none yet — reserved for Stories, Spec 2)_                                                                                                                                | —     | `trust`                                                                                          |
| `infographic`                                                                                                                                                              | A     | _(exempt — lead-magnet/educational collateral, not feed content; not part of the pillar system)_ |

**New columns**, both nullable, backfilled at migration time from `FORMAT_PILLAR` (deterministic, no ambiguity — including the 10 posts already sitting in the review queue today):

- `posts.pillar`
- `content_runs.pillar`
- `content_runs.source_post_id` (nullable FK → `posts.id`) — set when a run was auto-created by the Lane A/B bridge (section 3); null for runs started directly via "New Run" or auto-ideation.

**Why denormalized, not computed via a join:** if `FORMAT_PILLAR` ever changes (e.g. `carousel_copy` gets reassigned from `nurture` to `share`), historical rows must keep recording what pillar they actually served at generation time. Recomputing pillar from the current mapping on every read would silently rewrite history and corrupt future pillar-performance analytics.

## 2. Mix-targeted rotation (Lane B only)

**Target mix** (Troy's choice, growth-weighted): `attract: 40%, trust: 20%, nurture: 20%, share: 20%`.

**Scope:** applies only to `FeedTopUpService.topUp()` (the Lane B cron). Lane A's auto-ideation is trigger-based (fires when a real market event matches a rule, e.g. "PIQ moved +10 MoM") — it is not a quota system, and forcing a mix target onto an event-driven mechanism doesn't make sense. Lane A content still gets `pillar` tagged for analytics; it just doesn't participate in the deficit calculation below.

**New method:** `PostsService.countByPillar(brandId): Promise<Record<ContentPillar, number>>` — four `count: 'exact', head: true` queries (one per pillar; Supabase's JS count API has no `GROUP BY`), same no-rows-fetched pattern as the existing `countAll()`.

**Picking algorithm**, replacing today's `FEED_POST_TYPES[(rotationCursor + i) % FEED_POST_TYPES.length]`:

```
counts = countByPillar(brand.id)
total = sum(counts)
for each pillar with total > 0:
  deficit(pillar) = TARGET_MIX[pillar] - (counts[pillar] / total)
for each pillar with total == 0 (bootstrap):
  deficit(pillar) = TARGET_MIX[pillar]
pick the pillar with the largest deficit AMONG PILLARS THAT HAVE AT LEAST ONE
  AVAILABLE FORMAT (skips `trust` until Stories ships a format for it)
pick a format within that pillar (round-robin among that pillar's formats —
  e.g. `attract` has 9 candidate formats and still needs internal rotation)
```

This is grounded in real historical counts (not a synthetic weighted-random, and not an in-memory tracker that forgets on every Railway redeploy), so it self-corrects after any gap or pause — including the 15-hour idle period already observed in production — without needing to remember anything across restarts. Worked example: 10 posts generated so far (7 share, 2 attract, 1 nurture, 0 trust) → deficits are attract 40%−20%=+20pp, trust 20%−0%=+20pp (skipped, no format), nurture 20%−10%=+10pp, share 20%−70%=−50pp → attract wins (tied with trust on paper, trust is unavailable).

**Within-pillar rotation** (e.g. `attract` has 9 candidate formats) reuses the same monotonic-cursor pattern as the cross-pillar fix — `countAll()` scoped to that pillar's formats, offsetting `(pillarCursor + i) % formatsInPillar.length` — so picking a pillar never reintroduces the original index-reset bug one level down.

## 3. The Lane A/B bridge

**Trigger:** `PostsService.updateStatus()` already enforces the `pending_review → approved` transition map for every post type. When that transition fires for a post with `post_type = 'video_script'`, it triggers Lane-A run creation as part of the same action — approving the suggestion **is** the go-ahead, no separate confirm step.

**Creation:** calls `ContentRunsService.createRun()` seeded with the approved post's `suggestedFormat` (already validated against `CONTENT_FORMATS` at generation time by `coerceVideoScriptCopy`) and `suggestedMarketQuery`. **Open question for the implementation plan:** whether `createRun()` currently accepts a seed brief so the specific angle in the suggestion's hook/body/close actually carries into the real script, or whether Lane A always generates fresh from format+market alone. Needs verifying against the live method signature before implementation; if unsupported today, extending it is a small addition, not a redesign.

**Traceability:** the created run's `source_post_id` points back at the originating post, so the review-queue UI can show "→ now rendering as video" instead of the post looking finished-but-inert at `approved`.

**Idempotency:** before creating a run, check whether one already exists with `source_post_id = post.id`; skip creation if so. Guards against a double-click or retry spawning a duplicate video — same instinct as the publisher's existing crash-recovery and Late's own content-hash dedupe.

**Failure handling:** per the project's standing rule against silently mocking success, a `createRun()` failure must not leave the post silently sitting at `approved` with nothing happening. It surfaces as a visible "needs attention" state with the failure reason and a retry action.

**Known consequence, not fixed by this spec:** because Lane B's only `attract`-pillar format is `video_script` (a suggestion), and the deficit scheduler in section 2 will now correctly keep pushing more of it whenever attract is under target, this design closes the loop so those suggestions become real videos automatically — but it does not change the fact that "attract" content requires a full Lane-A render (script → Gate A/B → TTS → Remotion) before it's real, unlike the lightweight image renders behind `nurture`/`share`. Worth watching the `CONTENT_PIPELINE_DAILY_USD_MAX` daily spend cap once this bridge is live, since approvals now directly trigger the more expensive generation path.

## 4. Rollout & testing

**Migration:** adds `posts.pillar`, `content_runs.pillar`, `content_runs.source_post_id` (all nullable), backfills existing rows from `FORMAT_PILLAR` in the same migration.

**Tests:**

- `FORMAT_PILLAR` completeness — every `ContentFormat` and `FeedPostType` maps to a pillar or is explicitly exempted, so a new format added later can't silently ship unpillared.
- `countByPillar()` — mirrors the existing `countAll()` test pattern (direct test against the fake Supabase builder, not just mocked in a caller's spec).
- Deficit-picker — bootstrap (zero posts), tie-breaking, and the "pillar has no available format" skip-over (trust today).
- Lane A/B bridge — success path, visible failure (not silent), double-approve doesn't double-create a run.

**Verification gate:** backend `tsc --noEmit` clean, full content-pipeline Jest suite green, live check that a manually-approved `video_script` post actually produces a `content_runs` row with the right `source_post_id` before considering this done — per the project's "real artifact at destination" standard, not just green tests.

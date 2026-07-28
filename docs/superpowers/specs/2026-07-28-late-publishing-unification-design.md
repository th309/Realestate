# Late Publishing Unification — Design

**Date:** 2026-07-28
**Status:** Approved design, pending implementation plan
**Owner request:** "There should only be one credential store through Late."

## Problem

The content pipeline has two disjoint publishing stacks with separate credential stores:

|                 | Posts pipeline (review queue)            | Video pipeline (runs)                             |
| --------------- | ---------------------------------------- | ------------------------------------------------- |
| Publisher       | `social-connect` scanner → Late API      | `publish-*` queue handlers → direct platform APIs |
| Credentials     | `platform_connections` (Late, one-click) | `platform_credentials` (per-platform OAuth)       |
| Connected today | Facebook page, LinkedIn company page     | YouTube Shorts, LinkedIn personal                 |

Consequences: connecting Facebook through Late does nothing for video runs; the run wizard shows "Facebook not connected" while the Platforms page shows it connected; four of six direct video drivers have no credentials and have never published. The Platforms admin UI already moved Meta/TikTok/LinkedIn/X connection to the Late wall — the backend publish path never followed.

## Decisions (owner-confirmed)

1. **All publishing goes through Late** — for both pipelines.
2. **YouTube is the sole exception**: it keeps direct OAuth (`platform_credentials`) for publishing and its env-based metrics. It is the only working video path today and Late's YouTube handling is unproven for us.
3. **LinkedIn videos publish to the PropertyIQ_app company page** (the Late connection). The April personal-profile credential retires from publishing; its `platform_credentials` row remains only because the LinkedIn metrics puller still reads it (see non-goals).
4. **Metrics/analytics pulls are non-goals** — the 24h/7d/30d pullers keep their current auth and tables. Any future migration is a separate decision, not a scheduled phase.

## Design

### 1. Late client learns video

`LateClientService.publishPost` currently hardcodes `type: 'image'` for every media item. Change `LatePublishParams.mediaUrls: string[]` to `mediaItems: Array<{ url: string; type: 'image' | 'video' }>` and map the type through to Late's `mediaItems`. The one existing caller (`post-publisher.service.ts`) passes `type: 'image'` explicitly — its request bodies are byte-for-byte identical to today (existing specs pin this).

TikTok video requires Late's `tiktokSettings` consent block. The adapter (below) sends fixed brand defaults — public visibility, comments enabled — defined in a single exported constant so policy changes are one-line.

### 2. One adapter where the two vocabularies meet

New `late-video-publisher.service.ts` in `social-connect` (exported from the module). Responsibilities, in order:

1. Map video-pipeline platform id → Late platform: `instagram_reels → instagram`, `facebook_reels → facebook`, `tiktok → tiktok`, `linkedin → linkedin`. Any `youtube*` id throws immediately ("YouTube publishes via the direct pipeline").
2. Resolve the brand's `platform_connections` row (`provider = 'late'`, `status = 'connected'`). Missing/disconnected → typed error whose message tells the operator to connect on the Platforms page.
3. Publish via `LateClientService.publishPost` with `mediaItems: [{ url: signedVideoUrl, type: 'video' }]`, the run's caption, and `publishNow: true`, `x-request-id` idempotency as the posts pipeline does.
4. Return `{ externalId, externalUrl }`.

This service is the ONLY place the two platform vocabularies touch. Target <200 lines.

### 3. Publish handlers swap engines; the spine does not move

`publish-tiktok`, `publish-instagram`, `publish-facebook`, `publish-linkedin` handlers call the adapter instead of the direct drivers. Everything else in them is unchanged: delete-then-insert idempotency on `platform_posts`, failure-row inserts, `content_run_events`. `external_id` = Late's post id; `external_url` = Late's `platformPostUrl`.

Untouched: orchestrator, queues, `PLATFORM_TO_QUEUE`, `publish-youtube-shorts.handler` (both branches), `platform_posts` schema, hook A/B, performance dashboards, run-detail views.

Deleted (not ported): `tiktok-publisher.ts`, `instagram-reels-publisher.ts`, `facebook-reels-publisher.ts`, `linkedin-publisher.ts` + their specs, their registry/provider entries, and the four platforms' branches in `oauth-urls.ts`, `oauth-handlers.ts`, and `platform-oauth-callback.controller.ts` (`SUPPORTED_PLATFORMS` shrinks to `youtube_shorts`). `platform-publisher.registry.ts` keeps only the two YouTube publishers.

Kept: `platform_credentials` table and service (YouTube rows; plus the dormant LinkedIn metrics token the pullers still read — see non-goals), `platform_app_credentials` (YouTube app creds), `CredentialCrypto` and `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` (also keys OAuth state signing — removing it is a boot hazard).

### 4. Connected-flags unify (fixes the wizard warning)

`PlatformManagerService.getPlatformStatuses()` merges two sources:

- `youtube_shorts` / `youtube_long`: from `platform_credentials` (unchanged, including the long→shorts mirror).
- `tiktok`, `instagram_reels`, `facebook_reels`, `linkedin`: `connected` = Late configured AND a `status='connected'` row exists in `platform_connections` for the mapped platform.

The settings chips (`settings/platform-chips.tsx`) and run-wizard confirm step (`new/confirm-step.tsx`) consume the same endpoint unchanged — once Facebook is connected through Late, its chip goes green and the wizard warning disappears. The `connect`/`disconnect`/app-credentials endpoints reject the four Late-backed platforms with a pointer to the Late wall.

`credential-health-probe.cron` keeps probing YouTube via the registry and additionally alerts on Late connections whose status is not `connected` (existence check via one `platform_connections` query — no Late API call needed).

### 5. Error handling

- Adapter errors land in the handlers' existing failure-row path (`platform_posts` row with `status='failed'` + truncated error), same as today's driver failures.
- `LateNotConfiguredError` (missing `LATE_API_KEY`) → job failure with explicit message; the key is set on Railway backend as of 2026-07-27.
- No-connection errors are permanent failures (no retry), matching the posts pipeline's classification.

### 6. Testing & verification

- New unit specs: adapter id mapping, media typing, connection resolution, tiktokSettings defaults, error mapping.
- Updated handler specs: mock the adapter, assert unchanged `platform_posts` write shapes.
- Characterization: existing `post-publisher` and `late-client` specs must pass unmodified except the mechanical `mediaUrls → mediaItems` param rename at call sites.
- Definition of done includes a live verification run: publish one real short video to Facebook (or LinkedIn) through an actual run in production and confirm it renders on the platform. A green build alone does not close this.

## Non-goals

- Metrics/analytics migration to Late (pullers keep `platform_credentials`/env auth; that store therefore outlives this project in a metrics-only role).
- X/Twitter as a new video target.
- Per-run LinkedIn destination picker (company page only).
- Late scheduling features (video runs keep `publishNow: true`; scheduling stays in our planner).

## Flagged adjacent bug (separate fix, not in this project)

`performance-run-aggregates.queries.ts` queries `content_metrics` by `run_id`/`window` — columns that don't exist (`platform_post_id`/`pulled_at_window` are the real ones), and the error is unchecked, so dashboard views are silently 0 today. Pre-existing; tracked so it doesn't stay invisible.

# Session Handoff — Content Pipeline (SocialAuto) — 2026-07-26

Read this top-to-bottom before touching anything. It is the state of the
Munch-style content-ops build inside `/admin/content-pipeline` as of the end of
the 2026-07-26 session. Plan of record:
`C:\Users\troyh\.claude\plans\i-want-you-to-drifting-hollerith.md` (8-phase
transformation). Lessons: `tasks/lessons.md` (binding). Brand/score language
rules: `CLAUDE.md` §8–9.

**Session note:** partway through this evening's work, four background agents
died simultaneously — an account-wide Claude usage limit (reset 8:30pm ET), not
a retriable error. The user switched the session's default model to Sonnet 5
and said "continue"; the orchestrator finished the remaining work directly
(reading each agent's in-progress files, verifying with real test runs, fixing
what was still broken) rather than re-dispatching agents that would hit the
same limit. See "A New Provider Registered in the Wrong Module…" in
`tasks/lessons.md` for the real DI bug this surfaced and how it was caught.

## Standing directives from Troy (non-negotiable)

1. **Nothing goes to production until Troy says "release".** When he does:
   `npm run release:main -- "<desc>" --push` AND add `PEXELS_API_KEY` to the
   Railway backend service first (value lives in `packages/backend/.env.local`;
   never print it).
2. **Never use underscores in user-facing text** — filenames he sees, titles,
   labels, generated copy. Hyphens or spaces. (Memory:
   `feedback_no-underscores-in-text.md`.)
3. **One task per infographic.** Each generated infographic covers exactly ONE
   thing the site can do. Rule 0 in
   `docs/content-pipeline/infographic-topics/README.md`.
4. **Media alignment constraint:** every Pexels image/video must match the
   message subject (metro content → that metro's skyline; agent content → agent
   tasks). Fail-safe hierarchy: right media → no media → NEVER wrong media.
5. **Deliverables beat ceremony** on sample/demo work: only factual-correctness
   gates pre-ship (real data, no wrong-subject media, no fabricated
   numbers/dates); polish goes in ONE post-hoc pass. See lessons.md 2026-07-26.
6. **Score language:** 1-99 momentum/timing signal, 50 = state average,
   momentum words only, A/B/C/F letters are data-confidence never score grades.
7. **Infographic styles = Troy's six reference looks ONLY**, never freestyled.
   Style descriptors + NO-lists live in
   `packages/backend/src/content-pipeline/infographics/infographic-styles.ts`;
   the picker now shows real thumbnail examples (see SHIPPED below), not text
   chips — see memory `feedback_use-approved-infographic-styles.md`.

## Decisions PARKED — awaiting Troy (do not proceed without him)

- **Template verdict:** keep/change across the ~14 delivered looks (dark daily
  card, cream editorial, white quote-highlight, photo-hero, video-card).
- **Release timing.**
- **Late API key rotation:** `LATE_API_KEY` is provisioned in `.env`/`.env.local`
  but the original key transited a chat — confirm whether the live key is fresh
  or still the exposed one BEFORE any real publish. Also missing from
  `.env.example`.
- **Avatar conflict:** the 8-phase plan's Phase 7 includes HeyGen avatar clones;
  `docs/content-pipeline/design.md:30` explicitly bans synthesized persons
  (faceless = voice-only). Plan is newer; Troy must confirm which rule wins.
- **Phase 7 accounts:** ElevenLabs Starter ($5/mo) + HeyGen PAYG accounts —
  only Troy can create these.
- **collections_preferences migration not applied to the live DB.** The
  preference-learning service (below) works without it — it always reads the
  earliest row per brand, so a race produces an inert extra row rather than
  split likes — but the unique index that closes that race
  (`20260726231500_collections_preferences_unique_brand.sql`) needs the normal
  migration-apply flow. Same for the NEW auto-scheduler's own migration,
  `20260726234500_content_schedule_plans.sql`.

RESOLVED 2026-07-26: **feed auto-photos = ON**, **video-card feed lane =
built**, **infographic lane = built end to end**, **Phase 8 preference
learning = built**, **content auto-scheduler = built** (new feature, not on
any prior backlog — see SHIPPED below).

## What is DONE and verified (all on `develop`, commits below, NOT pushed)

Earlier in the session (all independently code-reviewed, verified live):

- **Template engine** (`packages/backend/src/content-pipeline/post-images/`):
  families dark/cream/white/photo × skeletons
  stat/hook/claim/rows/versus/quote/photo-hero via `SINGLE_VARIANT_REGISTRY`.
  Never-cut-off fit ladder: wrap → `FIT_SCALES` scale step-down → word-safe
  `fitField` → `PostImageOverflowError` at floor (draft survives; regression
  test forces all rungs).
- **Grounding honesty:** multi-market `PostImageGrounding.markets[]`, `asOf`
  derived from the data-period date (never the render clock), momentum chips
  only.
- **Media chain** (`.../media/`): `pexels-media.ts` (photo alt-text alignment
  gate; video slug/tags gate — hardened twice more this session: rejects
  wrong-state and wrong-country matches, requires urban context for city
  matches), `metro-photo.service.ts` (cache-first → curated Wikimedia →
  Pexels populate-once), `download-image.ts` (30s timeout, 15MB cap,
  content-type sniff).
- **Feed auto-photos + video-card lane, feed-wired** (not samples-only
  anymore): metro skyline photos attach to feed posts on the render path;
  the video-card lane is taught into the post media path (video refs now a
  first-class media_refs kind). Commits `31e583d4`, `50181c80`, `f231ce55`,
  `8e394734`, `58fb0032`, `d583fabe`.
- **Live bugs fixed:** studio 500 (skipped backdated migrations re-issued),
  auto-ideation zero-matches (data-anchored RPC windows; 887 metro movers
  live), image 401/503/invisible chain (same-origin streaming endpoint
  `GET /api/admin/content-pipeline/posts/:id/media/:order` + Next proxy
  cookie-session auth in `forward-auth.ts` + ad-blocker root cause).
- **CRITICAL rendering bug fixed** (`37073578`): rendered post-image excerpts
  were built by joining `String.match(/g)` results — a global match doesn't
  have to tile the string, so the join silently dropped an interior span of
  text, producing images that stated a DIFFERENT number than their own caption
  (e.g. "dropped 22.6%" rendered as "6%"). Fixed by slicing to the last
  sentence-boundary INDEX so the excerpt is a prefix by construction — a
  mid-content cut is no longer representable. Three PRE-EXISTING pending_review
  drafts still carry the bad text (`e18cebb7…`, `01422954…`, `5e4ba3cd…`
  Johnstown/Bangor posts) — skip them in review; the feed will regenerate
  clean ones. See lessons.md "Never Build a Text Excerpt by Joining
  Global-Regex Matches."
- **Deliverables** (40+ files): `C:\Users\troyh\Downloads\propertyiq-template-samples\`.
  Six are NOT-approved pending a NotebookLM regen (see below); one
  (`mcp-buyer-consultation-brief.png`, sketch-note style) is final and
  approved.

## SHIPPED this evening — infographic lane, Phase 8, auto-scheduler

Commit trail (all on `develop`, none pushed):
`4299ce85` → `2785cdfa` → `3e842d79` → `4af256f3` → `fd1e3f16` → `f8bd83b3` →
`d583fabe` → `8e394734` → `58fb0032` → `f231ce55` → `50181c80` → `31e583d4` →
`79d6029e` → `37073578` → `229b4bd2` → `f2c02ddb`, plus one final uncommitted
round (write cap + auto-scheduler + module fix — see "committed just now"
below).

- **Infographic lane, end to end.** New Run flow → topic/task/style pickers
  (vetted-gated, one task enforced) → local NotebookLM worker → PNG lands as a
  `pending_review` draft post. Wire key settled at **`infographicParams`**,
  regression-pinned on both sides so it can't silently flip again. Run
  surfaces (status chips, its own 3-stage pipeline track, cancel-not-delete on
  in-flight) all verified in a REAL browser session, not just typechecked —
  format card present, exactly one vetted topic selectable, six tasks, six
  styles, confirm summary correct. Architecture: runs park at `queued` (no
  `format_templates` row, no migration — `createInfographicRun` bypasses the
  video path entirely) → worker claims (`generating_infographic`) → PNG
  delivered → `infographic_ready` (terminal). Worker:
  `packages/backend/scripts/infographic-worker.ts` + its 3-module dir
  (`resolve-claimable-run.ts`, `notebooklm-cli.ts`, `deliver-infographic-post.ts`);
  `--dry-run` prints the prompt without touching nlm/DB; a startup sweep
  recovers rows stuck in `generating_infographic` from a crashed prior run.
- **Style picker shows REAL visual examples**, not text chips (`f2c02ddb`).
  Four of six styles have a genuine thumbnail (WebP, ~135KB total) generated
  from Troy's own approved samples; the two without an exemplar yet (flat
  editorial with US map, glassmorphic bento) show an honest "Example coming"
  placeholder and stay fully selectable — NEVER a borrowed image. Verified
  live in the browser (arrow-key nav, selection state, no horizontal scroll).
- **Failed-post surfacing + copy edit** (`fd1e3f16`, `f8bd83b3`): failures now
  appear on Home ("Needs attention", ahead of the review strip) and in the
  review queue with retry-now / retry-at-time / skip; un-failing a post resets
  `attempts` and clears `error` (5 specs incl. negative cases).
- **Phase 8 preference learning, complete** (`229b4bd2` + an uncommitted
  write-cap follow-up, see below): liking a style reference now genuinely
  steers every feed generation prompt — `collections_preferences` went from a
  dead table (zero consumers) to load-bearing. `FeedService` composes
  `StylePreferenceService.buildGenerationPreamble(brand)` (brand voice + style
  block, always additive) on all three generation paths. `signalWeight` 0-2
  picks the DIRECTIVE strength, never how many refs are included — a fixed
  read-time cap of the newest 5 keeps prompt size predictable regardless of
  how many are liked. TWO separate caps, confirmed by test: a write-time bound
  of 50 (oldest evicted, logged, never silently discards a like) vs. the
  read-time 5 (only the newest reach the prompt). Verified end-to-end against
  REAL Supabase, not mocks.
- **NEW: content auto-scheduler** (built by the orchestrator directly after
  four background agents hit the account usage limit mid-task). The gap Troy
  named ("isn't there supposed to be an auto scheduler, like Munch Studio
  has?") was real: the planner UI and the publish cron both existed, but
  nothing ever assigned a schedule automatically — approved posts sat in the
  unscheduled tray forever unless dragged onto a day by hand. Built to Troy's
  chosen ladder: **(1)** try the post type's own weekly slots this week, **(2)**
  else the next open best-time fallback slot this week, **(3)** else roll into
  next week — up to `horizonWeeks`, nothing ends up unscheduled.
  - `packages/backend/src/content-pipeline/scheduling/`: `eastern-time.ts`
    (ET wall-clock ↔ UTC, byte-identical algorithm to the frontend's
    `planner-tz.ts` so the calendar and the scheduler always agree),
    `weekly-schedule-plan.types.ts` (operator-editable weekly plan + a seeded
    `DEFAULT_WEEKLY_SCHEDULE_PLAN`), `next-slot-resolver.ts` (the pure,
    deterministic ladder — `now` is a parameter, never read from the clock),
    `weekly-schedule-plan.service.ts` (brand-scoped read-through-default
    store), `post-auto-scheduler.service.ts` (idempotent — never
    re-schedules an already-scheduled post, never overrides an operator-set
    time; serialized through a per-process mutex so an approval and a sweep
    tick can't race the same occupancy), `dto/update-weekly-schedule-plan.dto.ts`
    - `weekly-schedule-plan.controller.ts` (PUT/GET `.../schedule-plan/:brandId`).
  - `crons/auto-schedule-approved-posts.cron.ts`: 10-minute safety-net sweep
    for bulk approvals / kill-switch-off periods / anything an earlier
    failure left behind.
  - `PostsController.approve()` now schedules the post inline right after
    approving (best-effort — a scheduling failure never fails the approval
    request itself; the sweep cron retries).
  - Migration: `supabase/migrations/20260726234500_content_schedule_plans.sql`
    — one row per brand, RLS+GRANT matching house convention. **NOT yet
    applied to the live DB** (see Decisions PARKED).
  - Kill switch: `enabled: boolean` per brand, threaded end-to-end; `false`
    returns that brand to pure manual placement, no deploy needed.
  - Two real bugs caught and fixed by review before this shipped: (1) an
    exact-duplicate-slot collision check that silently disabled itself when
    `minGapMinutes: 0` (a legitimate config value) — fixed to make exact-match
    rejection unconditional while keeping the gap rule separately
    configurable down to 0; (2) `video_script` posts (which render no image
    and always fail the publisher) could be configured into a schedule rule
    at the DTO layer even though a `NON_SCHEDULABLE_POST_TYPES` constant
    existed to prevent exactly that — the constant had zero consumers. Fixed
    at the DTO (rejects the type) and defensively inside the resolver itself
    (throws, since it's the one place every call path funnels through).
  - The DST fall-back ambiguous hour (Nov 1, 1:00-1:59 AM occurs twice) is
    DOCUMENTED, not guarded: resolves to the pre-transition/EDT occurrence by
    convention, matching the frontend's identical unguarded behavior. The
    spring-forward GAP (that wall-clock time doesn't exist at all) IS guarded
    — `etWallClockExists` skips it and falls through to the next slot.
  - **Module-wiring bug found and fixed during verification**: a NestJS DI
    bug where `PostAutoSchedulerService` was registered in
    `ContentPipelineModule` but injected into `PostsController`, which
    actually lives in the sibling `PostsBrandKitModule` — Nest module
    encapsulation doesn't hand a parent's providers down to an imported
    child. `tsc --noEmit` was clean and all 653 unit tests passed (none of
    them boot the real Nest DI container); only an actual
    `Test.createTestingModule({ imports: [AppModule] }).compile()` surfaced
    it. Fixed by moving `WeeklySchedulePlanService` +
    `PostAutoSchedulerService` into `PostsBrandKitModule` and exporting them.
    See the new lessons.md entry — this class of bug is invisible to both
    the compiler and this repo's unit-test pattern (hand-built fakes, no
    real DI container).
  - Test coverage: 40 tests across the module (eastern-time DST hard cases,
    the full ladder incl. next-week rollover, exact-collision-at-zero-gap,
    the non-schedulable throw, DTO validation incl. the video_script
    rejection). Plain `npx tsc --noEmit` = 0 across the whole backend; full
    `content-pipeline` suite 653/654 passing (1 pre-existing skip) after
    every change in this section.

STILL REQUIRED before the infographic lane is fully usable end-to-end:

1. ~~Backend restart~~ DONE — endpoint live.
2. ~~Browser pass~~ DONE — verified working in a real signed-in session.
3. ~~`nlm login`~~ DONE — Troy re-authenticated. **Did NOT unblock
   generation** — see below.
4. **First real worker run — BLOCKED on a NotebookLM creation cap**, not auth.
   See `reference_notebooklm-generation-quota-and-download.md` in memory: 8+
   creation attempts across the evening all returned identical
   `RESOURCE_EXHAUSTED`, surviving a re-auth AND a credential clear, while
   reads worked throughout. ~10 artifacts were created on the notebook that
   day. Treat as a daily/rolling cap; the informative next probe is AFTER a
   UTC day boundary. The five sample regens (recruitment, farm-area,
   relocation, market-update, listing-presentation) are parked with
   self-contained runbooks in the session scratchpad (`*-regen-prompt.txt` /
   `*-focus.txt`), fireable cold by any agent once a probe succeeds.
5. **The two schedule-related migrations need applying**:
   `20260726231500_collections_preferences_unique_brand.sql` and
   `20260726234500_content_schedule_plans.sql`. Neither blocks the features
   (both services read-through a sane default without their row), but both
   close a real race window.
6. Not yet exercised live: an actual approval → auto-schedule → publish
   round-trip against the running backend (verified only by unit test +
   a full-app DI compile so far).

## Backlog — items closed this session (all independently code-reviewed)

- ~~#11~~ Module splits: gates, youtube-publish handlers, render-video
  handler, performance analytics, run-actions, the DI provider extraction
  (108 tokens verified 1:1 across three provider files).
- ~~#12~~ recordSpend wired at ALL paid sites via
  `job-handlers/record-driver-spend.ts`.
- ~~#17~~ Launch-race guard in both legacy renderers (`5b1f7ad0`).
- ~~#18~~ `run-actions.service.spec` fixed via `next-pipeline-step-after-review.ts`.
- ~~#9 Phase 8~~ preference learning built and wired (see SHIPPED above) —
  was the last open item; style-refs library + batch generation were already
  complete.

Still open:

- #8 Phase 7: repurpose tools are comingSoon stubs (captions/resize/clips);
  avatar lanes blocked on Troy (accounts + the design.md conflict above).
- Dead code flagged by reviewers (cleanup candidates, not urgent):
  `platform-publisher.registry.ts` ("consumed by: nothing yet"),
  near-duplicate ~90-line blocks in `publish-youtube-shorts.handler.ts`,
  stale doc comment in frontend `insights-api.ts`, legacy direct-OAuth
  plumbing for the 4 non-YouTube platforms.

## Phase map — VERIFIED against code 2026-07-26

| Phase                                    | Verdict                                                                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 GOAL.md + hygiene                      | DONE                                                                                                                                                           |
| 1 Munch-style home                       | DONE                                                                                                                                                           |
| 2 Posts model + brand kit + rolling feed | DONE (copy-edit UI shipped this session too)                                                                                                                   |
| 3 Social connect                         | DONE (Late client + hosted OAuth; YouTube stays direct by design). Gap: real connect E2E pending the Late key decision.                                        |
| 4 Planner                                | DONE. **Auto-slotting gap CLOSED this session** — see the new auto-scheduler above; approved posts now self-schedule instead of needing manual drag-placement. |
| 5 Auto-publish                           | DONE — engine + failed-post surfacing + the new auto-scheduler feeding it. Gap: real scheduled-publish E2E pending the Late key decision.                      |
| 6 Insights                               | DONE.                                                                                                                                                          |
| 7 Presenter/repurpose                    | NOT STARTED — stubs only; blocked on Troy for avatar accounts + the design.md conflict.                                                                        |
| 8 Collections                            | **DONE** — preference learning shipped this session, closing the last gap.                                                                                     |

## Working-method rules that earned their place (short form)

- Multi-agent: ONLY the lead assigns tasks; one owner per module per round;
  verify every "done" report against disk before accepting.
- Backend "tsc clean" means plain `npx tsc --noEmit` — `nest build` and
  `tsconfig.build.json` exclude specs and lie. **`tsc` clean also does NOT
  mean the DI graph resolves** — a provider registered in the wrong NestJS
  module is invisible to both the compiler and to unit tests that hand-build
  fakes (this repo's near-universal pattern). Verify cross-module wiring with
  an actual `Test.createTestingModule({ imports: [AppModule] }).compile()`
  (load real env via dotenv first; delete the scratch spec after — it's
  flaky in CI since it needs real secrets present).
- Supabase migrations backdated below the ledger max are silently skipped —
  new migrations get CURRENT timestamps, and verify in `schema_migrations`.
- media_refs contract is frozen: `storage_path` (never `path`), relative
  same-origin URLs, no persisted signed URLs — now extended to a `video` kind
  for the feed-wired video-card lane.
- NotebookLM: creation has an account/notebook-level quota that lasts HOURS,
  not the CLI's claimed "a few minutes" — serialize creation across agents,
  never run several in parallel discovering the same block. Downloads are
  byte-nondeterministic (same artifact, different bytes per download) — never
  use hash equality as an identity check, only as a stale-file guard.

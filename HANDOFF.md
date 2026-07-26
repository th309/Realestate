# Session Handoff — Content Pipeline (SocialAuto) — 2026-07-26

Read this top-to-bottom before touching anything. It is the state of the
Munch-style content-ops build inside `/admin/content-pipeline` as of the end of
the 2026-07-26 session. Plan of record:
`C:\Users\troyh\.claude\plans\i-want-you-to-drifting-hollerith.md` (8-phase
transformation). Lessons: `tasks/lessons.md` (binding). Brand/score language
rules: `CLAUDE.md` §8–9.

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

RESOLVED 2026-07-26 (evening session): **feed auto-photos = ON** (Troy:
"build the feed wiring") and **video-card feed lane = build** — both queued as
the content-pipeline owner's round 3. **Infographic styles = Troy's six
reference looks ONLY** (see memory `feedback_use-approved-infographic-styles.md`:
explicit VISUAL STYLE descriptor + NO-list + style gate in every generation).

## What is DONE and verified (all on `develop`, pushed)

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
  gate; video slug/tags gate), `metro-photo.service.ts` (cache-first →
  curated Wikimedia → Pexels populate-once), `download-image.ts` (30s timeout,
  15MB cap, content-type sniff).
- **Video-card lane:** `packages/backend/scripts/sample-video-card.ts` — ffmpeg
  composites cached Pexels b-roll + transparent card overlay → 8s 1080x1350
  MP4. Samples-only, NOT feed-wired. Houston/Austin/NYC/LA have no
  city-confident Pexels clips — honestly skipped, needs an alt source later.
- **Live bugs fixed:** studio 500 (skipped backdated migrations re-issued),
  auto-ideation zero-matches (data-anchored RPC windows; 887 metro movers
  live), image 401/503/invisible chain (same-origin streaming endpoint
  `GET /api/admin/content-pipeline/posts/:id/media/:order` + Next proxy
  cookie-session auth in `forward-auth.ts` + ad-blocker root cause).
- **Verification state at close:** plain `npx tsc --noEmit` (backend) = 0
  errors; 56/56 media+post-images tests green; 7/7 prod posts re-rendered
  clean. Frontend tests are local-only (not in CI) — see memory.
- **Deliverables** (38+ files): `C:\Users\troyh\Downloads\propertyiq-template-samples\`.

## IN FLIGHT — task #19: automated single-task infographic pipeline

Goal: automated NotebookLM generation of how-to/use-case infographics, one task
per graphic, consuming ONLY vetted topic docs from
`docs/content-pipeline/infographic-topics/` (first topic doc ready:
`mcp-for-agents.md`; five more are TODO stubs in its README table).

State:

- `notebooklm-mcp-cli` upgraded 0.4.0 → 0.9.4 (`uv tool upgrade
notebooklm-mcp-cli`). Auth VALID on 0.9.4 (`nlm doctor`: 6 notebooks, 29
  cookies, CSRF yes). The running MCP server stays 0.4.0 until Claude Code
  restarts — prefer the CLI (`nlm`) for everything.
- Use `PYTHONIOENCODING=utf-8` on every `nlm` call (Windows console chokes on
  its ✓ glyphs otherwise).
- Notebook: `aeefc5b2-e8a3-4ee9-b41d-b3046c3eca9f`, source `mcp-for-agents.md`
  = source id `7e35c2cc-e94a-428b-af1e-1b3f364eb2eb`. Old six-workflow artifact
  `ec53f9d1-dc6b-4168-a2c8-731e7ba058c9` is SUPERSEDED by the one-task rule —
  ignore it.
- Create syntax (verified via `--help`):
  `nlm infographic create <notebook_id> --style editorial --orientation
portrait --focus "<single task + constraints>" -y --json`, then poll, then
  `nlm download infographic <notebook_id> --id <artifact_id> -o <path>`.

**Download blocker RESOLVED (2026-07-26):** `nlm download infographic
<notebook_id> --id <artifact_id> -o <path>` WORKS on 0.9.4 with valid auth —
it follows the `lh3.googleusercontent.com` → `lh3.google.com` redirect chain
with authenticated cookies and saves a real PNG (verified 6.7MB image/png).
The earlier failures were all 0.4.0-era. Full pipeline is now CLI-automated:
`nlm infographic create … -y --json` → `nlm studio status <nb> --json` (status
"unknown" = still generating; flips to "completed", ~1-2 min) → `nlm download
infographic`. CDP screenshot fallback no longer needed.

Next steps, in order:

1. `nlm infographic create` a fresh single-task graphic — first task: "Find
   your farm area with the PropertyIQ MCP (farm-area analysis)". Constraints in
   the focus prompt: facts ONLY from the source doc; no underscores anywhere;
   footer `propertyiq.app` + "Market-level intelligence. Not property
   valuation."; momentum score language.
2. Poll status; retry `nlm download infographic` on 0.9.4; if it fails,
   diagnose THAT failure (this is the one thing blocking "fix it correctly so
   that this is an automated process").
3. Fact-check the PNG against `mcp-for-agents.md` (image models draw text they
   don't know — Troy's own reference samples contained fabricated text).
4. Copy to `C:\Users\troyh\Downloads\propertyiq-template-samples\` (hyphenated
   filename) and SHOW Troy ("show me the infographic when its done").
5. Then the remaining topic docs: how-to-map, how-to-analyzer, how-to-reports,
   score-explainer, mcp-for-investors — each generating one-task graphics.
6. Style note: Troy's latest approved reference is a cartoon-mascot explainer
   (numbered sections, "DID YOU KNOW?" callouts, cited-sources footer) — adopt
   as a style option alongside editorial/sketch-note.

## Backlog (updated 2026-07-26 evening — most items CLOSED this session)

CLOSED (all independently code-reviewed clean, commits on develop, not pushed):

- ~~#11~~ Module splits done: gates (claim verification), youtube-publish
  handlers, render-video handler (loader + props extraction), performance
  analytics, run-actions (step-resolver), and the DI provider extraction
  (module.ts 330→175; 108 tokens verified 1:1 across three provider files).
- ~~#12~~ recordSpend wired at ALL paid sites via shared
  `job-handlers/record-driver-spend.ts` (generate-script, synthesize-audio,
  time-captions, render-video pass-through). cost_cap_daily no longer
  undercounts TTS/Whisper spend.
- ~~#17~~ Launch-race guard landed in both legacy renderers (commit 5b1f7ad0)
  - a disconnected-listener improvement over the reference pattern.
- ~~#18~~ run-actions.service.spec fixed via extracted
  `next-pipeline-step-after-review.ts` (legitimate design: resume re-verifies
  only when the script changed after the last Gate A verdict).

SHIPPED 2026-07-26 evening (8 commits, every file independently code-reviewed,
tsc 0 errors both packages, 516 backend + 107 frontend tests green, NOT pushed):

- **Infographic lane, end to end.** `4299ce85` New Run flow (Infographic format
  card → topic/task/style pickers, vetted-gated, one task enforced) ·
  `3e842d79` backend lane + local NotebookLM worker · `4af256f3` + `b2d248f3`
  wire key settled at **`infographicParams`** (regression-pinned on BOTH sides:
  backend test rejects a `params` key, frontend spec asserts the wire body) ·
  `da6f9a2b` run surfaces (status chips, 3-stage infographic pipeline track,
  cancel-not-delete on in-flight, polling stops at terminal) · `0c26c068`
  closers (worker stale-claim sweep, options endpoint ships {id,label} only,
  real PNG dimensions from IHDR).
  Architecture: runs park at `queued` → worker claims (`generating_infographic`)
  → PNG lands as a `pending_review` draft post → `infographic_ready` (terminal).
  No `format_templates` row, no migration — createInfographicRun bypasses the
  video path entirely, so an infographic run can never reach the script handler.
  Worker: `packages/backend/scripts/infographic-worker.ts` (+ 3-module dir),
  `--dry-run` prints the prompt without touching nlm/DB.
- **Failed-post surfacing + copy edit** (`fd1e3f16`, `f8bd83b3`): failures now
  appear on Home ("Needs attention", ahead of the review strip) and in the
  review queue with retry-now / retry-at-time / skip; un-failing a post resets
  `attempts` and clears `error` (5 specs incl. negative cases).
- Backlog #11/#12/#17/#18 all closed (see above).

STILL REQUIRED before the infographic lane is usable:

1. **Restart the backend** — the running `:3001` process predates the new
   route and 404s `/api/admin/content-pipeline/infographic-options` (route
   verified registered via Nest metadata). Troy's terminal per house rule.
2. **One browser pass** — nothing in either round was rendered (no dev server
   this session). Worth eyeballing: an in-flight infographic run on the run
   detail page, and its chip on the studio home.
3. **First real worker run** to prove the chain end to end.

OPEN / NEW (verified gaps from the 2026-07-26 phase audit):

- #8 Phase 7: repurpose tools are comingSoon stubs (captions/resize/clips in
  taskCatalog); avatar lanes blocked on Troy (accounts + design.md conflict).
- #9 Phase 8 remainder: `collections_preferences` is a dead table (zero
  consumers) — preference-learning loop unbuilt. Style-refs library + batch
  generation already COMPLETE.
- Dead code flagged by reviewers/scouts (cleanup pass candidates):
  `platform-publisher.registry.ts` ("consumed by: nothing yet"), near-duplicate
  ~90-line blocks in publish-youtube-shorts.handler.ts, stale doc comment in
  frontend `insights-api.ts`, legacy direct-OAuth plumbing for the 4 non-YouTube
  platforms.

## Phase map — VERIFIED against code 2026-07-26 (supersedes "Phases 3–6 not

started", which was badly stale)

| Phase                                    | Verdict                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 GOAL.md + hygiene                      | DONE (GOAL.md at root; coverage copy fixed)                                                                                                                              |
| 1 Munch-style home                       | DONE (StudioGreeting, Create/Repurpose taskCatalog, ReviewStrip, plain-language chips)                                                                                   |
| 2 Posts model + brand kit + rolling feed | DONE (posts table + transitions incl. publishing/attempts; brand-kit feeds generators; 30-min FeedTopUpCron; approve/skip UI). Gap: copy-edit UI.                        |
| 3 Social connect                         | DONE (Late client + hosted OAuth + platform_connections + reconciler + platforms wall; YouTube stays direct by design). Gap: real connect E2E pending key confirmation.  |
| 4 Planner                                | DONE (dnd-kit month/week calendar, best-times, optimistic reschedule; slot firing = EVERY_MINUTE cron, not pg-boss — deliberate).                                        |
| 5 Auto-publish                           | ENGINE DONE (atomic claim, 3 retries, stuck-recovery). Gap: failed-post surfacing (above); real scheduled-publish E2E pending key.                                       |
| 6 Insights                               | DONE (content-insights module, two real metrics pipelines — content_metrics per-platform + analytics_snapshots via Late; insights + performance pages; WeeklyRecapCard). |
| 7 Presenter/repurpose                    | NOT STARTED (stubs only; blocked on Troy for avatars).                                                                                                                   |
| 8 Collections                            | MOSTLY DONE (style-refs library applied via A/B bindings; 500-market batch wizard). Gap: preference learning.                                                            |

## Working-method rules that earned their place (short form)

- Multi-agent: ONLY the lead assigns tasks; one owner per module per round;
  verify every "done" report against disk before accepting (about a third of
  completion reports claimed unlanded work).
- Backend "tsc clean" means plain `npx tsc --noEmit` — `nest build` and
  `tsconfig.build.json` exclude specs and lie.
- Supabase migrations backdated below the ledger max are silently skipped —
  new migrations get CURRENT timestamps, and verify in `schema_migrations`.
- media_refs contract is frozen: `storage_path` (never `path`), relative
  same-origin URLs, no persisted signed URLs.

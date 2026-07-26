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
- **Feed auto-photos on/off:** wiring metro photos into the live feed means ~1
  Pexels call per new metro (then cached in `metro_hero_images`).
- **Release timing.**

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

**Unresolved blocker:** downloading the artifact. Failed so far: MCP
`download_artifact` (0.4.0), raw `lh3.googleusercontent.com` URL (auth-gated,
returns HTML), CDP navigation in the debug Chrome (redirects to app home), and
`nlm download infographic` on 0.9.4 (failed even with valid auth — the exact
failure needs diagnosing; it was NOT re-run after the upgrade completed, so
retry it first). Fallback that WORKS if all else fails: CDP screenshot of the
signed-in debug Chrome (port 9224, profile `%LOCALAPPDATA%\nlm-chrome-profile` —
see `scratchpad/fetch-infographic.js` from this session for the working CDP
pattern; the debug Chrome must be running and signed in).

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

## Backlog (numbered items carried forward)

- #8 Phase 7 presenter/avatar lanes (ElevenLabs voice, HeyGen PAYG, faceless).
- #9 Phase 8 collections/batch generation.
- #11 Module split: one content-pipeline file at 328 lines (over the 300 hard
  limit for logic files).
- #12 Video-path `recordSpend` wiring.
- #17 Legacy renderer launch races: `analyzer-pdf.service.ts:97-99`,
  `puppeteer-lead-magnet-renderer.ts:65-70` (same getBrowser race the
  post-image renderer already guards).
- #18 Pre-existing `run-actions.service.spec` failure (predates this work,
  untouched since 6e169998).
- Deferred: `renderTransparentPng` onto the `PostImageRenderer` interface if
  the video lane ever feed-wires; Late/Zernio API key regeneration (the
  original transited a chat); plan Phases 3–6 (social connect, planner,
  auto-publish, insights) not started.

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

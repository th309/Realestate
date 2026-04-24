# Content Pipeline Deploy State

Operational artifacts and environment checklist for the content-pipeline feature. Updated as items land in staging/production.

Last refresh: **2026-04-23** (in-app OAuth live, videos publishing to @propertyIQ_app end-to-end)

## Applied to Supabase (pysflbhpnqwoczyuaaif)

### Migrations

Applied via `node scripts/apply-content-pipeline-migrations.js` against the pooler (supabase CLI history out of sync with local migrations dir). Fresh-DB setups should use the script; remote is already caught up.

Order applied (voices before formats because of FK):

1. `20260421000100_content_pipeline_core.sql` — content_runs, content_assets, content_run_events, content_run_gates
2. `20260421000200_content_pipeline_distribution.sql` — short_links, platform_posts, content_metrics
3. `20260421000300_content_pipeline_attribution.sql` — lead_magnet_definitions, format_magnet_bindings, signup_attributions, lead_magnet_deliveries
4. `20260421000400_content_pipeline_config.sql` — tts_voices, format_templates, style_references
5. `20260421000600_content_pipeline_seed_voices.sql` — edge-andrew
6. `20260421000500_content_pipeline_seed_formats.sql` — 8 formats, grade_reveal only enabled
7. `20260421000700_content_pipeline_seed_magnets.sql` — market_snapshot_pdf plus grade_reveal binding
8. `20260421010000_pgboss_schema_bootstrap.sql` — pgboss schema for pg-boss queue
9. `20260423000100_content_pipeline_format_pace_columns.sql` — **2026-04-23.** `format_templates.natural_wpm` (default 140, long_form=135) and `audio_buffer_seconds` (default 2, long_form=4). Feeds the ffprobe voice-over cap in `synthesize-audio.handler`.
10. `20260423000200_platform_credentials.sql` — **2026-04-23.** `platform_credentials` table (encrypted refresh_token, account_label, soft-delete via `disconnected_at`, unique partial index `WHERE disconnected_at IS NULL`). Backs the in-app OAuth Connect flow.

Verification summary after apply:

- 15 content-pipeline tables present (was 14 before `platform_credentials` landed)
- pgboss schema present
- 8 format_templates rows (only grade_reveal enabled); grade_reveal tuned to `natural_wpm=98` after calibration against real Edge TTS Andrew renders
- 1 tts_voice (edge-andrew)
- 1 lead_magnet_definition (market_snapshot_pdf)
- 1 format_magnet_binding (grade_reveal to market_snapshot_pdf)

### Storage bucket

Created via Storage REST API on 2026-04-21:

- Name: `content-pipeline`
- Public: false
- Service role access only

Used by: video renders, audio files, thumbnails, lead-magnet PDFs.

## Railway deploy status (2026-04-23)

| Environment | Service  | Latest commit | Status        | URL                                      |
| ----------- | -------- | ------------- | ------------- | ---------------------------------------- |
| production  | backend  | `87076aa3`    | SUCCESS, live | `backend-production-ee4d.up.railway.app` |
| dev         | backend  | `87076aa3`    | SUCCESS, live | `backend-dev-d9ca.up.railway.app`        |
| production  | frontend | `87076aa3`    | SUCCESS, live | `www.propertyiq.app`                     |

Both backend environments return `/api/health = {"status":"healthy", …}` and boot with `pg-boss queue started with 11 queues registered` + `ContentPipelineModule dependencies initialized` + `PlatformOAuthCallbackController` mounted.

**2026-04-23 commit stack** (landed on main + develop, both in sync):

```
87076aa3 chore: .dockerignore touch → force video-template rebuild (watchPatterns gap)
b38e3f8b feat(video-template): Intro as location reveal — MARKET SPOTLIGHT + city + state
6a1ece76 feat(video-template): PIQ shortmark + wordmark in Intro + Outro (replaces drawn circles)
da22a892 feat(video-template): delay voice-over until after BrandBumper (Sequence from={60})
a7f1e67c feat(content-pipeline): location-aware, varied YouTube Shorts hashtags
9d651952 feat(fe): review UI shows propertyiq.app instead of {{SHORT_LINK}}
1cc7aedf chore(video-template): add brand PNG assets under /public/brand/
43f82ab2 feat(video-template): PIQ brand in BrandBumper + green propertyiq.app in BrandOutroCard
e15328ac chore: .dockerignore touch → force Dockerfile.backend rebuild
a6c3eb7a fix(content-pipeline): install ffmpeg (ffprobe ENOENT on prod)
836f532b feat(frontend): /privacy + /terms redirect pages for Google OAuth validator
```

Plus the OAuth implementation merged in earlier on `44c8602f` (13 tasks spanning schema → service → state helper → callback controller → frontend flow).

## Railway env var checklist (backend service)

Status column: `set` when confirmed in Railway, `pending` otherwise.

### Required for P1 runtime

| Variable                              | Prod    | Dev     | Notes                                                                                                                                           |
| ------------------------------------- | ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                   | set     | set     | Used by ScriptGenerator and Gate B judge.                                                                                                       |
| `YOUTUBE_OAUTH_CLIENT_ID`             | set     | set     | App-level, used by in-app OAuth flow + publisher. See `platform-setup/youtube.md`.                                                              |
| `YOUTUBE_OAUTH_CLIENT_SECRET`         | set     | set     | Same source. **Rotate — previously exposed in log.**                                                                                            |
| ~~`YOUTUBE_OAUTH_REFRESH_TOKEN`~~     | ~~set~~ | ~~set~~ | **DEPRECATED 2026-04-23** — publisher now reads from `platform_credentials` table (DB-backed). Env var is dead weight. Safe to delete.          |
| `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` | set     | set     | 32-byte AES-256-GCM key, base64. Used both for refresh-token encryption AND HMAC signing of OAuth state param.                                  |
| `APP_BASE_URL`                        | set     | set     | **Prod must include `https://` prefix** (fixed 2026-04-23 via MCP — previously was the bare hostname which broke the OAuth redirect URI match). |
| `FRONTEND_URL`                        | set     | set     | Where OAuth callback 302s back after storing credentials. Added to dev on 2026-04-23.                                                           |
| `SHORT_LINK_BASE_URL`                 | set     | set     | `https://propertyiq.app` (route lives at `/go/[slug]`).                                                                                         |
| `EDGE_TTS_PYTHON`                     | set     | set     | `/usr/bin/python3` inside the Docker image.                                                                                                     |
| `SUPABASE_DB_URL`                     | set     | set     | Pooler URL for pg-boss.                                                                                                                         |
| `SUPABASE_URL`                        | set     | set     | Existing.                                                                                                                                       |
| `SUPABASE_SERVICE_KEY`                | set     | set     | Existing.                                                                                                                                       |

### Optional (activation tiers)

| Variable                                                                                          | Phase | Purpose                                   |
| ------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------- |
| `OPENAI_API_KEY`                                                                                  | P2    | Whisper captions plus OpenAI TTS fallback |
| `SLACK_ALERT_WEBHOOK_URL`                                                                         | P4    | Reliability alerts                        |
| `ELEVENLABS_API_KEY`                                                                              | P3    | Long-form TTS                             |
| `TIKTOK_CLIENT_KEY` + `_SECRET` + `_OAUTH_REFRESH_TOKEN`                                          | P2    | TikTok publisher                          |
| `META_GRAPH_APP_ID` + `_SECRET`, `META_INSTAGRAM_ACCESS_TOKEN`, `META_FACEBOOK_PAGE_ACCESS_TOKEN` | P2    | IG/FB publishers                          |
| `LINKEDIN_CLIENT_ID` + `_SECRET` + `LINKEDIN_ACCESS_TOKEN`                                        | P2    | LinkedIn publisher                        |

### Tunables (defaults apply if unset)

| Variable                           | Default             | Purpose                                                                           |
| ---------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| `SCRIPT_LLM_MODEL`                 | `claude-sonnet-4-6` | ScriptGenerator model                                                             |
| `GATE_B_JUDGE_MODEL`               | `claude-sonnet-4-6` | LLM judge model                                                                   |
| `GATE_B_MIN_SCORE`                 | `4`                 | Judge threshold                                                                   |
| `CONTENT_PIPELINE_DAILY_USD_MAX`   | `50`                | Combined daily spend cap (P5 enforced)                                            |
| `CONTENT_PIPELINE_GATE_STRICTNESS` | `balanced`          | `relaxed` / `balanced` / `strict`                                                 |
| `CAPTIONS_ENABLED`                 | unset (P2)          | Set to `true` once captions handler wired to short-circuit into `rendering_video` |

## Platform OAuth status

### In-app Connect (2026-04-23)

YouTube Shorts now connects via `/admin/content-pipeline/platforms` → Connect button → Google consent → DB-backed refresh token. No env var editing required to rotate credentials.

Active credential (as of 2026-04-23):

- **Platform:** `youtube_shorts`
- **Account:** `@propertyiq_app` (dedicated channel — not `@troyhouston322` as the old doc said)
- **Stored in:** `platform_credentials` table, encrypted via `CredentialCrypto` (AES-256-GCM)
- **Status:** active (disconnected_at IS NULL)
- **Reconnect flow verified:** disconnect → reconnect creates a fresh active row; prior rows preserved with `disconnected_at` populated for audit.

| Platform          | Phase | Status        | Doc                                                                                                                  |
| ----------------- | ----- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| YouTube Shorts    | P1    | **connected** | `platform-setup/youtube.md` — in-app OAuth live; app in Google "Testing" mode with `@propertyiq_app` as a Test user. |
| TikTok            | P2    | future        | to be added in P2                                                                                                    |
| Instagram Reels   | P2    | future        | to be added in P2                                                                                                    |
| Facebook Reels    | P2    | future        | to be added in P2                                                                                                    |
| LinkedIn          | P2    | future        | to be added in P2                                                                                                    |
| YouTube long-form | P3    | future        | to be added in P3                                                                                                    |

## P1 verification matrix

| Check                            | Status                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend unit tests (jest)        | **123/123 pass** (17 suites; queue.service.spec gated behind `RUN_QUEUE_INTEGRATION`). Includes 17 new tests for `youtube-tags` + 5 for `platform-credentials.service` + 6 for `oauth-state` + 3 updated for DB-backed `youtube-shorts-publisher`.                                                                                  |
| Gate A corpus (20 cases)         | All pass                                                                                                                                                                                                                                                                                                                            |
| Gate B corpus                    | All pass                                                                                                                                                                                                                                                                                                                            |
| Local smoke test E2E             | Green — `scripts/test-content-pipeline-local.ts`, ~49s per run, $0.013 Anthropic cost                                                                                                                                                                                                                                               |
| Formal E2E suite (Task 1.43)     | Specs in `packages/backend/test/e2e/content-pipeline-p1-{happy-path,gate-a-fail,gate-b-fail}.e2e-spec.ts`. Gate A + Gate B tests run in ~20s; happy path is ~60s (real Anthropic + Edge TTS + Remotion). Invoke: `cd packages/backend && npx jest --config ./test/jest-e2e.json --testPathPatterns=content-pipeline-p1 --runInBand` |
| **Prod Connect + publish smoke** | **Green 2026-04-23** — Miami, Chicago, Little Rock runs approved from prod UI, uploaded to `@propertyiq_app` with location-aware hashtags via DB-backed OAuth.                                                                                                                                                                      |
| Railway deploy (prod + dev)      | Live, healthy at commit `87076aa3`                                                                                                                                                                                                                                                                                                  |

## Test accounts

For E2E testing against real platforms and staging publishes:

- [x] **Dedicated YouTube channel: `@propertyiq_app`** (confirmed 2026-04-23 — previously docs said this was blocked on a separate Google account).

## Known gaps and follow-ups

- **Rotate the Google OAuth client secret** — previously exposed in a terminal log (`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`). Tracked but user said "dont worry about the secret for now"; still worth doing before external traffic arrives.
- **Delete `YOUTUBE_OAUTH_REFRESH_TOKEN`** from Railway prod + dev + `packages/backend/.env.local`. Now dead weight with DB-backed OAuth. No functional impact, cleanup only.
- **Write real content** for `/privacy` + `/terms` — currently redirect to `/about/privacy` + `/about/terms`. Legit pages already exist there; redirects work for Google's OAuth validator. No rush.
- **Brand sting placeholder** — `packages/video-template/public/brand-sting.mp3` is a 2s silent MP3. Replace with a real sting in P2.
- **Captions** — skipped in P1; `pipeline-state.ts` routes `rendering_voice → rendering_video` directly unless `CAPTIONS_ENABLED=true` and a handler is wired to the `render-captions` queue. P2 item.
- **Calibration tables** (`src/scoring/calibration/calibration-tables.json`) not in nest-cli `assets` — scoring silently runs uncalibrated in production. Pre-existing, not a P1 item.
- **`packages/frontend/app/auth/sign-up/page.tsx`** is 449 lines, over the 400-line hard limit from CLAUDE.md §1.3. Needs splitting into `SignUpForm`, `SignUpOAuthButtons`, `useSignupSubmission`.
- **Google OAuth signup flow** does not yet call the attribution endpoint. Attribution wiring belongs in `/auth/callback`. Tracked as part of the activation funnel initiative.
- **Short-link rate limit** is in-memory per edge instance. Upgrade to Upstash/Redis before scaling past a single instance for global limits.

### Railway watchPatterns gap (2026-04-23, operator action needed)

The backend service's watch patterns silently skip `/packages/video-template/**` and `/Dockerfile.backend`, so commits that only touch those paths don't trigger a Railway rebuild even though both feed into the backend Docker image. Worked around today by touching `.dockerignore` twice (`e15328ac`, `87076aa3`) to force rebuilds.

**One-time fix — click path in Railway dashboard:**

1. Railway → select the backend service (prod env) → **Settings** → **Source** tab.
2. Under **Watch Paths**, add two entries:
   - `/packages/video-template/**`
   - `/Dockerfile.backend`
3. Save. Repeat on the dev env's backend service.
4. (Optional but symmetric) Frontend service: watch patterns also don't include `/Dockerfile.frontend`; add it there too if edits to that file should auto-rebuild.

After this, future changes to video-template source or either Dockerfile variant will auto-rebuild the backend without needing a `.dockerignore` touch.

(A code-based alternative is a `packages/backend/railway.json` with `build.watchPatterns`, but that requires also pointing the service's **Config Path** to the new file in the dashboard and re-asserting the full build+deploy config — more moving parts than the two clicks above.)

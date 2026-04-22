# Content Pipeline Deploy State

Operational artifacts and environment checklist for the content-pipeline feature. Updated as items land in staging/production.

Last refresh: 2026-04-22 (P1 complete, backend live on prod + dev)

## Applied to Supabase (pysflbhpnqwoczyuaaif)

### Migrations (2026-04-21)

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

Verification summary after apply:

- 14 content-pipeline tables present
- pgboss schema present
- 8 format_templates rows (only grade_reveal enabled)
- 1 tts_voice (edge-andrew)
- 1 lead_magnet_definition (market_snapshot_pdf)
- 1 format_magnet_binding (grade_reveal to market_snapshot_pdf)

### Storage bucket

Created via Storage REST API on 2026-04-21:

- Name: `content-pipeline`
- Public: false
- Service role access only

Used by: video renders, audio files, thumbnails, lead-magnet PDFs.

## Railway deploy status (2026-04-22)

| Environment | Service | Latest deploy | Commit     | Status        | URL                                      |
| ----------- | ------- | ------------- | ---------- | ------------- | ---------------------------------------- |
| production  | backend | `b63c29a4`    | `9f53802f` | SUCCESS, live | `backend-production-ee4d.up.railway.app` |
| dev         | backend | `3d39e352`    | `85598408` | SUCCESS, live | `backend-dev-d9ca.up.railway.app`        |

Both environments have `/api/health` returning `{"status":"healthy", ...}`.

**Boot-time requirements now satisfied (per `reference_nest-build-assets` / `project_content-pipeline` memories):**

- Prompts `.md` files ship to `dist/content-pipeline/prompts/` via `nest-cli.json` assets entry
- `video-template` CLI built in the Dockerfile before `npm run build:backend` (needed for `RemotionCLIRenderer.require.resolve`)
- All content-pipeline env vars present on both prod and dev

Head-of-line commits that got the backend booting after the content-pipeline merge: `8ba94268` (nest-cli assets) → `39c801a0` (Dockerfile video-template build) → `097447ac` (dockerignore touch to trigger watch-pattern rebuild) → `85598408` (lockfile sync for pngjs).

## Railway env var checklist (backend service)

Status column: `set` when confirmed in Railway, `pending` otherwise.

### Required for P1 runtime

| Variable                              | Prod | Dev | Notes                                                                                                                                     |
| ------------------------------------- | ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                   | set  | set | Used by ScriptGenerator and Gate B judge.                                                                                                 |
| `YOUTUBE_OAUTH_CLIENT_ID`             | set  | set | From Google Cloud OAuth client. See `platform-setup/youtube.md`.                                                                          |
| `YOUTUBE_OAUTH_CLIENT_SECRET`         | set  | set | Same source. **Rotate — previously exposed in log.**                                                                                      |
| `YOUTUBE_OAUTH_REFRESH_TOKEN`         | set  | set | From OAuth Playground flow.                                                                                                               |
| `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` | set  | set | 32-byte AES-256-GCM key, base64. Dev shares prod value (matches the already-shared-credentials pattern — rotate per-env if that changes). |
| `SHORT_LINK_BASE_URL`                 | set  | set | `https://propertyiq.app` (route lives at `/go/[slug]`).                                                                                   |
| `EDGE_TTS_PYTHON`                     | set  | set | `/usr/bin/python3` inside the Docker image.                                                                                               |
| `SUPABASE_DB_URL`                     | set  | set | Pooler URL for pg-boss.                                                                                                                   |
| `SUPABASE_URL`                        | set  | set | Existing.                                                                                                                                 |
| `SUPABASE_SERVICE_KEY`                | set  | set | Existing.                                                                                                                                 |

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

## Platform setup

| Platform          | Phase | Status | Doc                                                                                                                          |
| ----------------- | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| YouTube Shorts    | P1    | set    | `platform-setup/youtube.md` — OAuth completed end-to-end 2026-04-22, smoke test returned valid channel for `@troyhouston322` |
| TikTok            | P2    | future | to be added in P2                                                                                                            |
| Instagram Reels   | P2    | future | to be added in P2                                                                                                            |
| Facebook Reels    | P2    | future | to be added in P2                                                                                                            |
| LinkedIn          | P2    | future | to be added in P2                                                                                                            |
| YouTube long-form | P3    | future | to be added in P3                                                                                                            |

## P1 verification matrix

| Check                        | Status                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend unit tests (jest)    | 87/88 pass (queue.service.spec needs live pg-boss DB; not a regression)                                                                                                                                                                                                                                                             |
| Gate A corpus (20 cases)     | All pass                                                                                                                                                                                                                                                                                                                            |
| Gate B corpus                | All pass                                                                                                                                                                                                                                                                                                                            |
| Local smoke test E2E         | Green — `scripts/test-content-pipeline-local.ts`, ~49s per run, $0.013 Anthropic cost                                                                                                                                                                                                                                               |
| Formal E2E suite (Task 1.43) | Specs in `packages/backend/test/e2e/content-pipeline-p1-{happy-path,gate-a-fail,gate-b-fail}.e2e-spec.ts`. Gate A + Gate B tests run in ~20s; happy path is ~60s (real Anthropic + Edge TTS + Remotion). Invoke: `cd packages/backend && npx jest --config ./test/jest-e2e.json --testPathPatterns=content-pipeline-p1 --runInBand` |
| Railway deploy (prod)        | Live, healthy                                                                                                                                                                                                                                                                                                                       |
| Railway deploy (dev)         | Live, healthy                                                                                                                                                                                                                                                                                                                       |

## Test accounts to create

For E2E testing against real platforms and staging publishes:

- [ ] Test YouTube channel (not the production PropertyIQ channel). Blocked on creating a separate Google account — currently YouTube OAuth points at `@troyhouston322` (main channel). P1 E2E suite uses `selectedPlatforms: []` to sidestep this.

## Known gaps and follow-ups

- **Rotate the Google OAuth client secret** — previously exposed in a terminal log (`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`). Tracked but user said "dont worry about the secret for now"; still worth doing before external traffic arrives.
- **Brand sting placeholder** — `packages/video-template/public/brand-sting.mp3` is a 2s silent MP3. Replace with real sting in P2.
- **Captions** — skipped in P1; `pipeline-state.ts` routes `rendering_voice → rendering_video` directly unless `CAPTIONS_ENABLED=true` and a handler is wired to the `render-captions` queue. P2 item.
- **Calibration tables** (`src/scoring/calibration/calibration-tables.json`) not in nest-cli `assets` — scoring silently runs uncalibrated in production. Pre-existing, not a P1 item; tracked for the next pass through nest-cli config.
- **`packages/frontend/app/auth/sign-up/page.tsx`** is 449 lines, over the 400-line hard limit from CLAUDE.md 1.3. Needs splitting into `SignUpForm`, `SignUpOAuthButtons`, `useSignupSubmission`. Tracked as a post-P1 refactor.
- **Google OAuth signup flow** does not yet call the attribution endpoint. Attribution wiring belongs in `/auth/callback`. Tracked as part of the activation funnel initiative.
- **Short-link rate limit** is in-memory per edge instance. Upgrade to Upstash/Redis before scaling past a single instance for global limits.

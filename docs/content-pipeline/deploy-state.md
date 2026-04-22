# Content Pipeline Deploy State

Operational artifacts and environment checklist for the content-pipeline feature. Updated as items land in staging/production.

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

## Railway env var checklist (backend service)

Status column: `set` when confirmed in Railway, `pending` otherwise.

### Required for P1 runtime

| Variable                              | Status  | Notes                                                                                              |
| ------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                   | pending | Same value as local `.env.local`. Used by ScriptGenerator and Gate B judge.                        |
| `YOUTUBE_OAUTH_CLIENT_ID`             | pending | From Google Cloud OAuth client. See `platform-setup/youtube.md`.                                   |
| `YOUTUBE_OAUTH_CLIENT_SECRET`         | pending | Same source.                                                                                       |
| `YOUTUBE_OAUTH_REFRESH_TOKEN`         | pending | From OAuth Playground flow.                                                                        |
| `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` | pending | 32-byte AES-256-GCM key, base64. Generate once, never rotate without re-connecting every platform. |
| `SHORT_LINK_BASE_URL`                 | pending | `https://propertyiq.app` (route lives at `/go/[slug]`).                                            |
| `EDGE_TTS_PYTHON`                     | pending | `/usr/bin/python3` on nixpacks image.                                                              |
| `SUPABASE_DB_URL`                     | pending | Pooler URL for pg-boss.                                                                            |
| `SUPABASE_URL`                        | set     | Existing.                                                                                          |
| `SUPABASE_SERVICE_KEY`                | set     | Existing.                                                                                          |

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

| Variable                           | Default             | Purpose                                |
| ---------------------------------- | ------------------- | -------------------------------------- |
| `SCRIPT_LLM_MODEL`                 | `claude-sonnet-4-6` | ScriptGenerator model                  |
| `GATE_B_JUDGE_MODEL`               | `claude-sonnet-4-6` | LLM judge model                        |
| `GATE_B_MIN_SCORE`                 | `4`                 | Judge threshold                        |
| `CONTENT_PIPELINE_DAILY_USD_MAX`   | `50`                | Combined daily spend cap (P5 enforced) |
| `CONTENT_PIPELINE_GATE_STRICTNESS` | `balanced`          | `relaxed` / `balanced` / `strict`      |

## Platform setup

| Platform          | Phase | Status  | Doc                         |
| ----------------- | ----- | ------- | --------------------------- |
| YouTube Shorts    | P1    | pending | `platform-setup/youtube.md` |
| TikTok            | P2    | future  | to be added in P2           |
| Instagram Reels   | P2    | future  | to be added in P2           |
| Facebook Reels    | P2    | future  | to be added in P2           |
| LinkedIn          | P2    | future  | to be added in P2           |
| YouTube long-form | P3    | future  | to be added in P3           |

## Test accounts to create

For E2E testing (Task 1.43) and staging publishes:

- [ ] Test YouTube channel (not the production PropertyIQ channel)

## Known gaps and follow-ups

- `packages/frontend/app/auth/sign-up/page.tsx` is now 449 lines, over the 400-line hard limit from CLAUDE.md section 1.3. Needs splitting into `SignUpForm`, `SignUpOAuthButtons`, `useSignupSubmission`. Tracked as a post-P1 refactor.
- Google OAuth signup flow does not yet call the attribution endpoint. Attribution wiring belongs in `/auth/callback`. Tracked as part of the activation funnel initiative.
- Short-link rate limit is in-memory per edge instance. Upgrade to Upstash/Redis before scaling past a single instance for global limits.
- Task 1.43 E2E suite still to be written. Requires test YouTube channel plus all Railway env vars above to be set.

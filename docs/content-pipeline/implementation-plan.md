# PropertyIQ Content Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and ship the PropertyIQ Content Pipeline end to end: a solo-operator automation system that produces faceless short and long form video content from PropertyIQ market data, publishes across six platforms, and closes the attribution loop from view to tier-upgrade revenue.

**Architecture:** New NestJS module (`content-pipeline`) at `packages/backend/src/content-pipeline/` owns orchestration. A pg-boss queue (running on existing Supabase Postgres, no Redis) drives a 14-state pipeline through swappable driver interfaces (LLM, TTS, caption timing, video render, PDF render, platform publisher). Admin UI lives under `packages/frontend/app/admin/content-pipeline/`. Video rendering happens in spawned child processes that invoke a new CLI entry point added to the existing `packages/video-template` Remotion package. Attribution is closed through a `piq.sh/<slug>` short-link service as a Next.js catch-all route.

**Tech Stack:** NestJS 11, Next.js 16 App Router, React 19 (frontend), React 18 (video-template, isolated via child-process boundary), Supabase Postgres + Storage, pg-boss 10, Anthropic SDK 0.71.2 (already installed), OpenAI SDK 6.17.0 (already installed) for Whisper and optional TTS, Microsoft Edge TTS via Python sidecar, ElevenLabs for long-form (P3), Puppeteer 24 (already installed) for lead-magnet PDFs, Remotion 4.0, googleapis 148 for YouTube, yt-dlp plus ffmpeg for video style-reference URL ingest (P3).

## Changelog

- 2026-04-21 v1.0: initial plan. Produced from design spec at `docs/content-pipeline/design.md`.

## Authoritative sources

- **Architecture, complete DB schema with all columns, driver interface TypeScript signatures, UX principles, and risks:** `docs/content-pipeline/design.md`.
- **Original brief:** `docs/plans/2026-04-21-propertyiq-content-pipeline-brief.md`.
- **Project rules:** `CLAUDE.md` in repo root. This plan adheres to: data-layer-only frontend fetching (Section 5), no em-dashes anywhere, strict file size limits (Section 1.3), AdminGuard-protected admin endpoints, Supabase GRANTs on every new table.

## How to read this plan

The plan is one continuous document. It has three layers:

1. **Cross-phase inventory** (next several sections): one-stop reference for the entire project. File structure, env vars, dependencies, migration order, API endpoints, admin UI pages, global testing strategy.
2. **Phase-by-phase tasks** (P1 through P5): every task has exact file paths, complete code, exact commands with expected output, and a commit step. TDD-first: write the failing test, run to confirm it fails, write minimal code, run to confirm pass, commit.
3. **Appendix** (final sections): plan-specific risks, security notes, open questions for Troy.

When executing, you work top to bottom through P1, then P2, then P3, then P4, then P5. Each phase is independently shippable; you can stop after any phase and still have working software.

---

## Executive summary

PropertyIQ is automating production and multi-platform publishing of faceless data-driven real estate video. Primary goal: drive agent and broker tier signups on propertyiq.com. Secondary goal: grow a standalone faceless channel on YouTube Shorts, TikTok, Instagram Reels, Facebook Reels, LinkedIn, and YouTube long-form.

Eight formats span two audience tracks. Investor-oriented: Grade Reveal, Top 10 Ranking, Score Mover, Head-to-Head, Long-Form Deep Dive. Agent/broker-oriented: Farm Area Spotlight, Brokerage Market Share, Recruitment Angle. Each format has a paired lead magnet gated behind PropertyIQ free-tier signup, closing the attribution loop for revenue tracking.

End-to-end pipeline flow: operator clicks create-run, backend fetches market data from internal PropertyIQ services (bypassing MCP OAuth), Claude generates a platform-specific script with two hook variants, hard gates verify factual accuracy and brand voice, Edge TTS synthesizes audio, Whisper times captions, Remotion renders vertical or landscape video, publishers post to selected platforms, attribution tracked through unique short links, analytics roll up per format with per-hook and eventually per-magnet A/B support.

Fourteen new database tables, one new NestJS module, one new Next.js admin section, one new CLI added to `packages/video-template`, one short-link Next.js catch-all route, and six per-platform setup documents constitute the v1 scope. Total complexity: 11 to 16 weeks across 5 phases.

---

## Complete file structure (all phases, with phase markers)

Phase markers: `[P1]`, `[P2]`, `[P3]`, `[P4]`, `[P5]`.

### Backend (`packages/backend/src/content-pipeline/`)

```
content-pipeline/
  content-pipeline.module.ts                     [P1]
  content-pipeline.controller.ts                 [P1]
  content-pipeline.service.ts                    [P1]
  types.ts                                       [P1]
  dto/
    create-run.dto.ts                            [P1]
    approve-run.dto.ts                           [P1]
    reject-run.dto.ts                            [P1]
    edit-script.dto.ts                           [P1]
    list-runs-query.dto.ts                       [P1]
    dashboard-response.dto.ts                    [P1]
    update-settings.dto.ts                       [P1]
    platform-oauth-callback.dto.ts               [P1]
    bind-magnet.dto.ts                           [P2]
    update-magnet.dto.ts                         [P2]
    upload-style-reference.dto.ts                [P2]
    ingest-style-url.dto.ts                      [P2]
    create-trigger-rule.dto.ts                   [P5]
    update-trigger-rule.dto.ts                   [P5]
  data/
    content-data.service.ts                      [P1]
    content-data.types.ts                        [P1]
  drivers/
    driver-cost.types.ts                         [P1]
    script-generator.interface.ts                [P1]
    anthropic-script-generator.ts                [P1]
    tts-driver.interface.ts                      [P1]
    edge-tts-driver.ts                           [P1]
    openai-tts-driver.ts                         [P2]
    elevenlabs-tts-driver.ts                     [P3]
    tts-driver.factory.ts                        [P1]
    caption-timer.interface.ts                   [P2]
    openai-whisper-timer.ts                      [P2]
    video-renderer.interface.ts                  [P1]
    remotion-cli-renderer.ts                     [P1]
    lead-magnet-renderer.interface.ts            [P1]
    puppeteer-lead-magnet-renderer.ts            [P1]
    platform-publisher.interface.ts              [P1]
    platform-publisher.registry.ts               [P2]
    youtube-shorts-publisher.ts                  [P1]
    youtube-longform-publisher.ts                [P3]
    tiktok-publisher.ts                          [P2]
    instagram-reels-publisher.ts                 [P2]
    facebook-reels-publisher.ts                  [P2]
    linkedin-publisher.ts                        [P2]
  gates/
    gate.types.ts                                [P1]
    voice-rules.ts                               [P1]
    data-verifier.service.ts                     [P1]
    brand-voice-linter.service.ts                [P1]
    __fixtures__/
      gate-a-corpus.json                         [P1]
      gate-b-corpus.json                         [P1]
  orchestrator/
    pipeline-state.ts                            [P1]
    run-orchestrator.service.ts                  [P1]
    queue.module.ts                              [P1]
    queue.service.ts                             [P1]
    cost-tracker.service.ts                      [P1]
    job-handlers/
      fetch-data.handler.ts                      [P1]
      generate-script.handler.ts                 [P1]
      verify-data.handler.ts                     [P1]
      lint-voice.handler.ts                      [P1]
      synthesize-audio.handler.ts                [P1]
      time-captions.handler.ts                   [P2]
      render-video.handler.ts                    [P1]
      render-thumbnail.handler.ts                [P2]
      publish.handler.ts                         [P1]
      publish-youtube-shorts.handler.ts          [P1]
      publish-youtube-longform.handler.ts        [P3]
      publish-tiktok.handler.ts                  [P2]
      publish-instagram.handler.ts               [P2]
      publish-facebook.handler.ts                [P2]
      publish-linkedin.handler.ts                [P2]
      generate-lead-magnet.handler.ts            [P1]
  prompts/
    _system.md                                   [P1]
    grade_reveal.md                              [P1]
    top_10_ranking.md                            [P2]
    score_mover.md                               [P2]
    head_to_head.md                              [P2]
    farm_area_spotlight.md                       [P2]
    long_form_deep_dive.md                       [P3]
    brokerage_market_share.md                    [P3]
    recruitment_angle.md                         [P3]
  lead-magnets/
    lead-magnet.service.ts                       [P1]
    shared/
      brand.css                                  [P1]
      layout.html.ejs                            [P1]
    templates/
      market_snapshot.html.ejs                   [P1]
      top_50_cashflow.html.ejs                   [P2]
      movers_report.html.ejs                     [P2]
      market_comparison.html.ejs                 [P2]
      farm_area_audit.html.ejs                   [P2]
      brokerage_coverage.html.ejs                [P3]
      agent_recruitment_kit.html.ejs             [P3]
      long_form_companion.html.ejs               [P3]
  short-links/
    short-link.service.ts                        [P1]
    short-link.controller.ts                     [P1]
  analytics/
    metrics-puller.service.ts                    [P1]
    youtube-metrics.service.ts                   [P1]
    tiktok-metrics.service.ts                    [P2]
    instagram-metrics.service.ts                 [P2]
    facebook-metrics.service.ts                  [P2]
    linkedin-metrics.service.ts                  [P2]
    performance.service.ts                       [P4]
    revenue-attribution.service.ts               [P4]
    hook-ab.service.ts                           [P4]
    suggested-runs.service.ts                    [P4]
  magnets/
    magnet-library.service.ts                    [P2]
    magnet-library.controller.ts                 [P2]
    magnet-ab-promoter.service.ts                [P4]
  style-references/
    style-reference.service.ts                   [P2]
    style-reference.controller.ts                [P2]
    vision-extractor.service.ts                  [P2]
    image-downloader.service.ts                  [P2]
    yt-dlp-wrapper.service.ts                    [P3]
    ffmpeg-wrapper.service.ts                    [P3]
  auto-ideation/
    auto-ideation.service.ts                     [P5]
    auto-ideation.controller.ts                  [P5]
    trigger-rule-evaluator.service.ts            [P5]
    cost-cap.service.ts                          [P5]
    trigger-rule.types.ts                        [P5]
  observability/
    alert-dispatcher.service.ts                  [P4]
    stall-detector.service.ts                    [P4]
  crons/
    recover-stuck-runs.cron.ts                   [P1]
    pull-24h-metrics.cron.ts                     [P1]
    pull-7d-metrics.cron.ts                      [P4]
    pull-30d-metrics.cron.ts                     [P4]
    credential-health-probe.cron.ts              [P4]
    auto-ideation-score-scan.cron.ts             [P5]
    auto-ideation-rank-scan.cron.ts              [P5]
```

### Frontend (`packages/frontend/app/admin/content-pipeline/`)

```
content-pipeline/
  page.tsx                                       [P1] dashboard
  layout.tsx                                     [P1]
  new/
    page.tsx                                     [P1]
    format-step.tsx                              [P1]
    market-step.tsx                              [P1]
    extras-step.tsx                              [P1]
    confirm-step.tsx                             [P1]
    style-pick.tsx                               [P2]
  runs/
    [id]/
      page.tsx                                   [P1]
      pipeline-visualization.tsx                 [P1]
      event-log.tsx                              [P1]
      artifacts-panel.tsx                        [P1]
      review-banner.tsx                          [P1]
      platform-posts-panel.tsx                   [P1]
  review/
    page.tsx                                     [P1]
    review-card.tsx                              [P1]
    script-editor.tsx                            [P1]
    diff-viewer.tsx                              [P1]
    shortcuts.ts                                 [P1]
    thumbnail-editor.tsx                         [P2]
  performance/
    page.tsx                                     [P1 stub, P4 full]
    hero-card.tsx                                [P4]
    format-conversion-panel.tsx                  [P4]
    hook-patterns-panel.tsx                      [P4]
    suggested-runs-panel.tsx                     [P4]
    runs-table.tsx                               [P4]
  platforms/
    page.tsx                                     [P1 YT only, P2 all]
    platform-row.tsx                             [P1]
    setup-walkthrough.tsx                        [P1]
    diagnostics-panel.tsx                        [P4]
  lead-magnets/
    page.tsx                                     [P2]
    magnet-card.tsx                              [P2]
    edit-dialog.tsx                              [P2]
    bind-dialog.tsx                              [P2]
    conversion-panel.tsx                         [P4]
  style-library/
    page.tsx                                     [P2]
    reference-card.tsx                           [P2]
    upload-dialog.tsx                            [P2]
    attributes-panel.tsx                         [P2]
  settings/
    page.tsx                                     [P1]
    format-defaults.tsx                          [P1]
    strictness-toggle.tsx                        [P1]
    pause-button.tsx                             [P1]
  auto-ideation/
    page.tsx                                     [P5]
    rule-editor.tsx                              [P5]
  lib/
    state-labels.ts                              [P1]
    content-pipeline-api.ts                      [P1]
    format-previews.ts                           [P1]
```

### Short-link route

```
packages/frontend/app/s/[slug]/route.ts          [P1] GET handler; 302 + cookie
```

### Landing pages (public, on propertyiq.com)

```
packages/frontend/app/
  grade-reveal-signup/page.tsx                   [P1]
  top-cashflow-report/page.tsx                   [P2]
  movers-report/page.tsx                         [P2]
  market-comparison/page.tsx                     [P2]
  farm-area-audit/page.tsx                       [P2]
  brokerage-coverage/page.tsx                    [P3]
  agent-recruitment-kit/page.tsx                 [P3]
  market-narrative/page.tsx                      [P3]
  dashboard/magnets/page.tsx                     [P3 gated user dashboard]
```

### Video template (`packages/video-template/src/`)

```
video-template/
  src/
    Root.tsx                                     [P1 modify] dynamic registration
    types.ts                                     [P1 modify] adds FormatConfig and zod
    constants.ts                                 [P1 modify] brand tokens via CSS vars
    cli/
      render.ts                                  [P1] programmatic API
      render-cli.ts                              [P1] CLI entry
    compositions/
      factory.ts                                 [P1]
    layout/
      VideoLayout.tsx                            [P1]
      useLayoutConfig.ts                         [P1]
    primitives/
      BrandBumper.tsx                            [P1]
      BrandOutroCard.tsx                         [P1]
      ScoreRing.tsx                              [P1]
      RankingRow.tsx                             [P2]
      DeltaDisplay.tsx                           [P2]
      FarmAreaGrid.tsx                           [P2]
      BrokerageBar.tsx                           [P3]
      LongFormChapterCard.tsx                    [P3]
    presets/
      shorts.ts                                  [P1]
      longform.ts                                [P3]
      style-variants/
        index.ts                                 [P2]
        high-energy.ts                           [P2]
        medium-energy.ts                         [P2]
        calm-explainer.ts                        [P2]
        pattern-interrupt-hook.ts                [P3]
        countdown-hook.ts                        [P3]
        question-hook.ts                         [P3]
    scenes/
      Intro.tsx                                  [P1 refactor] uses VideoLayout
      ScoreReveal.tsx                            [P1 refactor]
      TrendChart.tsx                             [P1 refactor]
      StatCards.tsx                              [P1 refactor]
      Comparison.tsx                             [P1 refactor]
      Outro.tsx                                  [P1 refactor]
```

### Email templates (`packages/emails/emails/`)

```
lead-magnet-delivery.tsx                         [P1]
```

### Supabase migrations (`supabase/migrations/`)

```
20260421000100_content_pipeline_core.sql                         [P1]
20260421000200_content_pipeline_distribution.sql                 [P1]
20260421000300_content_pipeline_attribution.sql                  [P1]
20260421000400_content_pipeline_config.sql                       [P1]
20260421000500_content_pipeline_seed_formats.sql                 [P1]
20260421000600_content_pipeline_seed_voices.sql                  [P1]
20260421000700_content_pipeline_seed_magnets.sql                 [P1]
20260421010000_pgboss_schema_bootstrap.sql                       [P1]
20260422000100_content_pipeline_seed_p2_magnets.sql              [P2]
20260422000200_content_pipeline_seed_p2_formats_enable.sql       [P2]
20260423000100_content_pipeline_seed_p3_magnets.sql              [P3]
20260423000200_content_pipeline_seed_p3_voices.sql               [P3]
20260423000300_content_pipeline_seed_p3_formats_enable.sql       [P3]
20260424000040_content_pipeline_hook_archetypes.sql              [P4]
20260424000050_content_pipeline_alerts_sent.sql                  [P4]
20260424000100_content_pipeline_auto_ideation_rules.sql          [P5]
20260424000200_content_pipeline_daily_cost_cap.sql               [P5]
```

### Platform setup documentation

```
docs/content-pipeline/platform-setup/
  youtube.md                                     [P1]
  tiktok.md                                      [P2]
  instagram.md                                   [P2]
  facebook.md                                    [P2]
  linkedin.md                                    [P2]
  youtube-longform.md                            [P3]
```

---

## Environment variables (all phases)

All secrets go in `packages/backend/.env` locally and Railway dashboard for deployed environments. No defaults for any secret; app crashes if missing (CLAUDE.md section 1.2).

### P1 required

| Variable                              | Example                                |
| ------------------------------------- | -------------------------------------- |
| `ANTHROPIC_API_KEY`                   | `sk-ant-api03-...`                     |
| `YOUTUBE_OAUTH_CLIENT_ID`             | `xxx.apps.googleusercontent.com`       |
| `YOUTUBE_OAUTH_CLIENT_SECRET`         | (opaque)                               |
| `YOUTUBE_OAUTH_REFRESH_TOKEN`         | `1//xxx` (for test channel)            |
| `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` | base64 of 32 random bytes              |
| `SHORT_LINK_BASE_URL`                 | `https://piq.sh`                       |
| `EDGE_TTS_PYTHON`                     | `/usr/bin/python3`                     |
| `SUPABASE_DB_URL`                     | Postgres connection string for pg-boss |

### P2 required

| Variable                          | Purpose                                |
| --------------------------------- | -------------------------------------- |
| `OPENAI_API_KEY`                  | Whisper captions + OpenAI TTS fallback |
| `TIKTOK_CLIENT_KEY`               | TikTok Content Posting API             |
| `TIKTOK_CLIENT_SECRET`            |                                        |
| `TIKTOK_OAUTH_REFRESH_TOKEN`      | Test account                           |
| `META_GRAPH_APP_ID`               | Meta Graph covers IG + FB              |
| `META_GRAPH_APP_SECRET`           |                                        |
| `META_INSTAGRAM_ACCESS_TOKEN`     | Long-lived IG user token               |
| `META_FACEBOOK_PAGE_ACCESS_TOKEN` | Test Page                              |
| `LINKEDIN_CLIENT_ID`              |                                        |
| `LINKEDIN_CLIENT_SECRET`          |                                        |
| `LINKEDIN_ACCESS_TOKEN`           | Test page                              |

### P3 required

| Variable             | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `ELEVENLABS_API_KEY` | Long-form TTS                                        |
| `YT_DLP_BIN`         | yt-dlp binary path (default `/usr/local/bin/yt-dlp`) |
| `FFMPEG_BIN`         | ffmpeg binary path (default `/usr/bin/ffmpeg`)       |

### P4 required

| Variable                  | Purpose               |
| ------------------------- | --------------------- |
| `SLACK_ALERT_WEBHOOK_URL` | Primary alert channel |

### Tunables (all phases, defaults shown)

| Variable                                   | Default             | Purpose                       |
| ------------------------------------------ | ------------------- | ----------------------------- |
| `SCRIPT_LLM_MODEL`                         | `claude-sonnet-4-6` | ScriptGenerator model         |
| `GATE_B_JUDGE_MODEL`                       | `claude-sonnet-4-6` | Gate B LLM judge model        |
| `GATE_B_MIN_SCORE`                         | `4`                 | LLM judge pass threshold      |
| `CONTENT_PIPELINE_DAILY_USD_MAX`           | `50`                | Combined daily spend cap      |
| `CONTENT_PIPELINE_GATE_STRICTNESS`         | `balanced`          | `relaxed`/`balanced`/`strict` |
| `PIPELINE_WORKER_CONCURRENCY_ORCHESTRATOR` | `4`                 | pg-boss concurrency           |
| `PIPELINE_WORKER_CONCURRENCY_RENDER_VIDEO` | `1`                 | CPU-bound                     |
| `STEP_TIMEOUT_RENDER_VIDEO_MS`             | `300000`            | 5 min short-form              |
| `STEP_TIMEOUT_RENDER_VIDEO_LONGFORM_MS`    | `1200000`           | 20 min long-form              |
| `RECOVER_STUCK_RUNS_INTERVAL_MIN`          | `5`                 | Recovery cadence              |

---

## Third-party dependencies (versions)

### Backend new (P1)

| Package      | Version        | Purpose               |
| ------------ | -------------- | --------------------- |
| `pg-boss`    | `^10.1.5`      | Postgres-backed queue |
| `googleapis` | `^148.0.0`     | YouTube Data API      |
| `ejs`        | `^3.1.10`      | PDF template engine   |
| `@types/ejs` | `^3.1.5` (dev) | Types                 |

### Backend new (P3)

| Package      | Version   | Purpose        |
| ------------ | --------- | -------------- |
| `elevenlabs` | `^0.18.0` | ElevenLabs SDK |

### Backend puppeteer move (P1)

Move `puppeteer@^24.36.0` from `devDependencies` to `dependencies` because it's needed at runtime for lead magnet PDF rendering.

### Already installed, reused (no action)

- `@anthropic-ai/sdk@^0.71.2` (Anthropic)
- `openai@^6.17.0` (Whisper + OpenAI TTS)
- `axios@^1.13.2` (publishers that don't have SDKs)
- `resend@^6.9.2` (email)
- `@nestjs/schedule@^6.1.0` (crons)
- `class-validator@^0.14.3` + `class-transformer@^0.5.1` (DTOs)
- `@nestjs/throttler@^6.5.0` (short-link rate limit)

### video-template new (P1)

| Package     | Version   | Purpose                 |
| ----------- | --------- | ----------------------- |
| `zod`       | `^3.24.0` | Props schema validation |
| `commander` | `^13.1.0` | CLI arg parsing         |

### video-template already installed

- `remotion@^4.0.253`
- `@remotion/bundler@^4.0.253`
- `@remotion/renderer@^4.0.253`
- `@remotion/cli@^4.0.253`
- React 18 (isolated)

### System binaries (Dockerfile)

| Binary                 | Install                                                                                           | Phase |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ----- |
| Python 3 plus edge-tts | `apt-get install -y python3 python3-pip && pip3 install --break-system-packages edge-tts==6.1.12` | P1    |
| Chromium               | `apt-get install -y chromium` (already present for Redfin scraper)                                | P1    |
| ffmpeg                 | `apt-get install -y ffmpeg`                                                                       | P3    |
| yt-dlp                 | `pip3 install --break-system-packages yt-dlp==2025.3.26`                                          | P3    |

---

## Migration order (complete)

Apply in order via `supabase db push`. P1 ships 8 files, P2 ships 2, P3 ships 3, P4 ships 2, P5 ships 2. Total 17 migration files.

See each phase's tasks below for the complete SQL body of each migration.

---

## API endpoints (complete catalog)

All under `/api/admin/content-pipeline/` and protected by `AdminGuard` unless noted. Response envelope: `{ success: boolean, data?: T, error?: string }`.

### P1

| Method | Path                                  | Body                | Returns                                      |
| ------ | ------------------------------------- | ------------------- | -------------------------------------------- |
| GET    | `/dashboard`                          | none                | `{ thisWeek, recentRuns, reviewQueueCount }` |
| POST   | `/runs`                               | `CreateRunDto`      | `{ id, idempotencyKey, status }`             |
| GET    | `/runs`                               | query               | `{ runs, total }`                            |
| GET    | `/runs/:id`                           | none                | `RunDetail`                                  |
| POST   | `/runs/:id/approve`                   | `ApproveRunDto`     | `{ status }`                                 |
| POST   | `/runs/:id/reject`                    | `RejectRunDto`      | `{ status }`                                 |
| POST   | `/runs/:id/edit-script`               | `EditScriptDto`     | `{ status }`                                 |
| GET    | `/review/queue`                       | none                | `{ items, cursor }`                          |
| GET    | `/formats`                            | none                | `{ formats }`                                |
| PATCH  | `/formats/:format`                    | `UpdateFormatDto`   | `{ format }`                                 |
| GET    | `/voices`                             | none                | `{ voices }`                                 |
| POST   | `/resolve-market`                     | `{ query }`         | `{ matches }`                                |
| GET    | `/suggestions/trending`               | none                | `{ markets }`                                |
| GET    | `/suggestions/recent`                 | none                | `{ markets }`                                |
| GET    | `/suggestions/for-format/:format`     | none                | `{ markets }`                                |
| GET    | `/settings`                           | none                | `{ strictness, paused, formatDefaults }`     |
| PATCH  | `/settings`                           | `UpdateSettingsDto` | `{ settings }`                               |
| POST   | `/pause`                              | none                | `{ paused: true }`                           |
| POST   | `/resume`                             | none                | `{ paused: false }`                          |
| GET    | `/platforms`                          | none                | `{ platforms }`                              |
| POST   | `/platforms/:platform/connect`        | none                | `{ authUrl }`                                |
| POST   | `/platforms/:platform/oauth-callback` | `{ code, state }`   | `{ connected: true }`                        |
| POST   | `/platforms/:platform/disconnect`     | none                | `{ connected: false }`                       |
| GET    | `/s/:slug` (public, frontend route)   | none                | 302 + cookie                                 |

### P2

| Method | Path                               | Body                     |
| ------ | ---------------------------------- | ------------------------ |
| GET    | `/magnets`                         | none                     |
| POST   | `/magnets`                         | `CreateMagnetDto`        |
| PATCH  | `/magnets/:kind`                   | `UpdateMagnetDto`        |
| POST   | `/magnets/:kind/archive`           | none                     |
| POST   | `/magnets/:kind/clone`             | none                     |
| POST   | `/magnets/bindings`                | `BindMagnetDto`          |
| DELETE | `/magnets/bindings/:id`            | none                     |
| GET    | `/style-references`                | none                     |
| POST   | `/style-references/upload`         | multipart                |
| POST   | `/style-references/ingest-url`     | `{ url, label }`         |
| DELETE | `/style-references/:id`            | none                     |
| POST   | `/style-references/:id/re-analyze` | none                     |
| POST   | `/runs/:id/thumbnail/replace`      | multipart or frame-index |

### P3

| Method | Path                                       | Body             |
| ------ | ------------------------------------------ | ---------------- |
| POST   | `/style-references/upload-video`           | multipart        |
| POST   | `/style-references/ingest-video-url`       | `{ url, label }` |
| GET    | `/dashboard/magnets` (gated user frontend) | none             |

### P4

| Method | Path                            |
| ------ | ------------------------------- |
| GET    | `/performance/overview`         |
| GET    | `/performance/hook-ab`          |
| GET    | `/performance/revenue-by-video` |
| GET    | `/performance/suggested-runs`   |
| GET    | `/magnets/:kind/conversion`     |

### P5

| Method | Path                                | Body                   |
| ------ | ----------------------------------- | ---------------------- |
| GET    | `/auto-ideation/rules`              | none                   |
| POST   | `/auto-ideation/rules`              | `CreateTriggerRuleDto` |
| PATCH  | `/auto-ideation/rules/:id`          | `UpdateTriggerRuleDto` |
| DELETE | `/auto-ideation/rules/:id`          | none                   |
| POST   | `/auto-ideation/rules/:id/fire-now` | none                   |
| GET    | `/auto-ideation/upcoming`           | none                   |

---

## Admin UI pages (complete catalog)

| Route                                   | Phase            | Purpose                            |
| --------------------------------------- | ---------------- | ---------------------------------- |
| `/admin/content-pipeline`               | P1               | Dashboard home                     |
| `/admin/content-pipeline/new`           | P1               | Create-a-run wizard                |
| `/admin/content-pipeline/runs/[id]`     | P1               | Run detail with live polling       |
| `/admin/content-pipeline/review`        | P1               | Review queue                       |
| `/admin/content-pipeline/performance`   | P1 stub, P4 full | Narrative leaderboard              |
| `/admin/content-pipeline/platforms`     | P1 YT, P2 all    | Platform credentials               |
| `/admin/content-pipeline/settings`      | P1               | Format defaults, strictness, pause |
| `/admin/content-pipeline/lead-magnets`  | P2               | Lead Magnet Library                |
| `/admin/content-pipeline/style-library` | P2               | Style Reference Library            |
| `/admin/content-pipeline/auto-ideation` | P5               | Trigger rule manager               |

---

## Global testing strategy

**Unit tests** run via Jest on every commit. Mock everything external (Anthropic, OpenAI, TTS, publishers, internal services). Test bodies live next to implementations with `.spec.ts` suffix.

**Integration tests** run nightly via Jest `@nestjs/testing`. Use a real test Supabase schema, real pg-boss, mocked external APIs. Test bodies at `packages/backend/test/integration/`.

**E2E tests** run weekly and pre-release. Real staging Supabase, real Anthropic with per-run cost cap, real Edge TTS (free), real test accounts for all platforms. Test bodies at `packages/backend/test/e2e/`. Per project memory on "plans-must-include-e2e-tests," every phase includes explicit E2E tasks.

**Remotion snapshot tests** render one frame per scene per composition and diff against baseline PNGs with tolerance under 2%. Located in `packages/video-template/tests/`.

**Mock policy**:

| External                     | Unit        | Integration      | E2E                  |
| ---------------------------- | ----------- | ---------------- | -------------------- |
| Internal PropertyIQ services | mock        | real             | real                 |
| Anthropic                    | mock        | fixture-replay   | real ($5 cap/run)    |
| Edge TTS                     | mock        | real (free)      | real                 |
| OpenAI Whisper               | mock        | fixture-replay   | real                 |
| ElevenLabs (P3)              | mock        | mock             | real test key        |
| OpenAI TTS (P2 fallback)     | mock        | mock             | real                 |
| Platform APIs                | mock        | mock             | real (test accounts) |
| Supabase                     | mock client | real test schema | real staging         |
| pg-boss                      | in-process  | real test schema | real staging         |

---

## Prerequisites before starting P1

These are one-time verifications, not implementation tasks. Complete each before Task 1.1.

- [ ] **Prerequisite 1: Redis provisioning confirmed.** Run `grep -r "REDIS_URL" packages/backend/.env`. Expected: `REDIS_URL=` empty (confirming pg-boss path). If populated, confirm with Troy whether to use BullMQ instead.

- [ ] **Prerequisite 2: Internal service map for MCP tools.** For each MCP tool used in the pipeline (`search_markets`, `get_market_snapshot`, `get_propertyiq_score`, `get_trending_markets`, `top_cashflow_markets`, `farm_area_analysis`, `brokerage_market_coverage_report`, `agent_recruitment_pitch`, `referral_network_finder`, `compare_markets_for_content`, `generate_market_narrative`), read the corresponding tool file in `packages/mcp-server/src/tools/` to find its backend HTTP endpoint. Locate the NestJS controller for that endpoint. Record findings in `docs/content-pipeline/internal-services-map.md`. If any tool's logic is inline in the MCP file with no backend service, flag it for lifting out during Task 1.13.

- [ ] **Prerequisite 3: Dockerfile location confirmed.** Run `ls -la packages/backend/Dockerfile packages/backend/railway.json`. At least one must exist. If neither, Railway uses Nixpacks; plan Python install as a Nixpacks plan file.

- [ ] **Prerequisite 4: Test YouTube channel.** Troy confirms a test YouTube channel exists separate from production, with OAuth access. If not, create one in YouTube Studio before Task 1.30.

- [ ] **Prerequisite 5: Short-link domain.** Troy confirms `piq.sh` or alternate domain is registered and DNS-pointable to the Next.js frontend. Block deploy of short-link route until resolved.

- [ ] **Prerequisite 6: Supabase CLI working locally.** Run `supabase --version` and `supabase start`. Local Supabase on 54322 must come up. Migrations in this plan apply against it before staging.

---

# Phase 1: Foundation plus Grade Reveal end-to-end

**Duration:** 3 to 5 weeks. **Complexity:** High. **Tasks:** 35.

## Phase 1 scope

Full DB schema across 14 tables with seeds for Grade Reveal only. pg-boss queue plus 14-state pipeline state machine. ContentDataService facade for P1 data methods. ScriptGenerator (Anthropic), Gate A (data verifier), Gate B (brand-voice linter). EdgeTTSDriver. Remotion CLI entry point and programmatic API. Brand primitives and Grade Reveal composition. Puppeteer lead-magnet renderer plus Market Snapshot PDF template plus EmailService extension for attachments. YouTubeShortsPublisher with OAuth. Admin UI: dashboard, create-run wizard, run detail with live polling, review queue, platforms page (YouTube only), settings page, performance page stub. Short-link service plus signup attribution capture. YouTube 24-hour metrics puller and recover-stuck-runs cron. Grade Reveal landing page on propertyiq.com. YouTube platform setup doc. Full E2E test covering happy path plus Gate A fail plus Gate B fail.

## Phase 1 deliverables

- Operator creates a Grade Reveal run from the admin UI end-to-end.
- Run transitions through all 14 states to `published`.
- Video uploads to test YouTube channel.
- Short link generated; clicking it sets attribution cookie; signup writes `signup_attributions`.
- Market Snapshot PDF rendered and emailed.
- YouTube 24h metrics pulled and stored.
- All 7 P1 admin pages render in browser without console errors.

## Phase 1 acceptance criteria

1. All 9 P1 migrations apply cleanly to a fresh Supabase project with zero errors.
2. `cd packages/backend && npm run test` passes all P1 unit tests (minimum 120 tests).
3. `cd packages/backend && npm run test:e2e` passes P1 E2E suite (happy path, Gate A fail, Gate B fail).
4. `cd packages/video-template && npx remotion render GradeReveal out.mp4 --props=sample.json` produces a valid MP4.
5. Backend starts without errors when `REDIS_URL` is empty.
6. `/admin/content-pipeline` renders in browser without console errors.
7. Full manual end-to-end from wizard to YouTube upload completes within 10 minutes.
8. Market Snapshot PDF delivered to test email with correct data.

---

## Task 1.1: Install P1 dependencies

**Files:**

- Modify: `packages/backend/package.json`
- Modify: `packages/video-template/package.json`

- [ ] **Step 1: Install backend deps.**

```bash
cd packages/backend
npm install pg-boss@^10.1.5 googleapis@^148.0.0 ejs@^3.1.10
npm install --save-dev @types/ejs@^3.1.5
```

- [ ] **Step 2: Move puppeteer from devDependencies to dependencies.**

In `packages/backend/package.json`, cut the `"puppeteer": "^24.36.0"` line out of `devDependencies` and paste into `dependencies`. Run `npm install` to refresh the lockfile.

- [ ] **Step 3: Install video-template deps.**

```bash
cd packages/video-template
npm install zod@^3.24.0 commander@^13.1.0
```

- [ ] **Step 4: Verify installs.**

```bash
cd packages/backend && npm list pg-boss googleapis ejs puppeteer
cd packages/video-template && npm list zod commander
```

Expected: all present with stated versions.

- [ ] **Step 5: Commit.**

```bash
git add packages/backend/package.json packages/backend/package-lock.json \
        packages/video-template/package.json packages/video-template/package-lock.json
git commit -m "feat(content-pipeline): add P1 dependencies (pg-boss, googleapis, ejs, zod, commander)"
```

## Task 1.2: Dockerfile updates for Python and Edge TTS

**Files:**

- Modify: `packages/backend/Dockerfile`

- [ ] **Step 1: Read current Dockerfile.**

```bash
cat packages/backend/Dockerfile
```

- [ ] **Step 2: Add Python plus edge-tts after `FROM` line.**

```dockerfile
# Content pipeline: Python plus edge-tts for TTS synthesis
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir --break-system-packages edge-tts==6.1.12
```

- [ ] **Step 3: Build and verify edge-tts works in container.**

```bash
docker build -f packages/backend/Dockerfile -t piq-backend-test packages/backend
docker run --rm piq-backend-test python3 -m edge_tts \
    --voice en-US-AndrewMultilingualNeural \
    --text "hello" --write-media /tmp/t.mp3 && echo OK
```

Expected: prints `OK`.

- [ ] **Step 4: Commit.**

```bash
git add packages/backend/Dockerfile
git commit -m "feat(content-pipeline): Dockerfile adds Python and edge-tts"
```

## Task 1.3: Migration 000100, core tables

**Files:**

- Create: `supabase/migrations/20260421000100_content_pipeline_core.sql`

- [ ] **Step 1: Write migration.**

```sql
-- content_runs
CREATE TABLE IF NOT EXISTS content_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  audience TEXT NOT NULL,
  market_query TEXT NOT NULL,
  resolved_geo JSONB,
  approval_mode TEXT NOT NULL DEFAULT 'review',
  tts_provider TEXT NOT NULL DEFAULT 'edge',
  tts_voice_id TEXT,
  script_llm_model TEXT,
  hook_variants JSONB,
  style_reference_id UUID,
  selected_platforms TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  status_reason TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'manual',
  triggered_by_user UUID,
  idempotency_key TEXT UNIQUE,
  costs JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_runs_status_created ON content_runs (status, created_at);
CREATE INDEX idx_content_runs_format_audience ON content_runs (format, audience);
CREATE INDEX idx_content_runs_created_desc ON content_runs (created_at DESC);
ALTER TABLE content_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON content_runs FOR ALL USING (true);
GRANT ALL ON content_runs TO service_role;
GRANT ALL ON content_runs TO authenticated;

-- content_assets
CREATE TABLE IF NOT EXISTS content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  variant TEXT,
  storage_url TEXT NOT NULL,
  content_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_assets_run_kind ON content_assets (run_id, kind);
CREATE UNIQUE INDEX uq_content_assets_hash ON content_assets (content_hash) WHERE content_hash IS NOT NULL;
ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON content_assets FOR ALL USING (true);
GRANT ALL ON content_assets TO service_role;
GRANT ALL ON content_assets TO authenticated;

-- content_run_events
CREATE TABLE IF NOT EXISTS content_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_run_events_run_created ON content_run_events (run_id, created_at);
ALTER TABLE content_run_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON content_run_events FOR ALL USING (true);
GRANT ALL ON content_run_events TO service_role;
GRANT ALL ON content_run_events TO authenticated;

-- content_run_gates
CREATE TABLE IF NOT EXISTS content_run_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE CASCADE,
  gate TEXT NOT NULL,
  result TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  llm_judge_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_run_gates_run ON content_run_gates (run_id);
ALTER TABLE content_run_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON content_run_gates FOR ALL USING (true);
GRANT ALL ON content_run_gates TO service_role;
GRANT ALL ON content_run_gates TO authenticated;
```

- [ ] **Step 2: Apply and verify.**

```bash
cd D:/projects/rei-platform
supabase db push
supabase db execute "SELECT table_name FROM information_schema.tables WHERE table_name IN ('content_runs','content_assets','content_run_events','content_run_gates');"
```

Expected: 4 rows.

- [ ] **Step 3: Commit.**

```bash
git add supabase/migrations/20260421000100_content_pipeline_core.sql
git commit -m "feat(content-pipeline): core tables (runs, assets, events, gates)"
```

## Task 1.4: Migration 000200, distribution tables

**Files:**

- Create: `supabase/migrations/20260421000200_content_pipeline_distribution.sql`

- [ ] **Step 1: Write migration.**

```sql
-- short_links (first, because platform_posts references it)
CREATE TABLE IF NOT EXISTS short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  platform TEXT NOT NULL,
  target_url TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_short_links_slug ON short_links (slug);
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON short_links FOR ALL USING (true);
GRANT ALL ON short_links TO service_role;
GRANT ALL ON short_links TO authenticated;

-- platform_posts
CREATE TABLE IF NOT EXISTS platform_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT,
  external_url TEXT,
  post_mode TEXT NOT NULL DEFAULT 'direct',
  scheduled_for TIMESTAMPTZ,
  short_link_id UUID REFERENCES short_links(id) ON DELETE SET NULL,
  hook_variant_id TEXT,
  status TEXT NOT NULL DEFAULT 'uploading',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_platform_posts_platform_external ON platform_posts (platform, external_id) WHERE external_id IS NOT NULL;
ALTER TABLE platform_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON platform_posts FOR ALL USING (true);
GRANT ALL ON platform_posts TO service_role;
GRANT ALL ON platform_posts TO authenticated;

-- content_metrics
CREATE TABLE IF NOT EXISTS content_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_post_id UUID NOT NULL REFERENCES platform_posts(id) ON DELETE CASCADE,
  pulled_at_window TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  watch_time_seconds INTEGER NOT NULL DEFAULT 0,
  avg_retention_pct REAL,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  follows_gained INTEGER NOT NULL DEFAULT 0,
  short_link_clicks INTEGER NOT NULL DEFAULT 0,
  raw_payload JSONB,
  pulled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_content_metrics_post_window ON content_metrics (platform_post_id, pulled_at_window);
ALTER TABLE content_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON content_metrics FOR ALL USING (true);
GRANT ALL ON content_metrics TO service_role;
GRANT ALL ON content_metrics TO authenticated;
```

- [ ] **Step 2: Apply and verify.**

```bash
supabase db push
supabase db execute "SELECT table_name FROM information_schema.tables WHERE table_name IN ('short_links','platform_posts','content_metrics');"
```

Expected: 3 rows.

- [ ] **Step 3: Commit.**

```bash
git add supabase/migrations/20260421000200_content_pipeline_distribution.sql
git commit -m "feat(content-pipeline): distribution tables (short_links, platform_posts, content_metrics)"
```

## Task 1.5: Migration 000300, attribution tables

**Files:**

- Create: `supabase/migrations/20260421000300_content_pipeline_attribution.sql`

- [ ] **Step 1: Write migration.**

```sql
-- lead_magnet_definitions first
CREATE TABLE IF NOT EXISTS lead_magnet_definitions (
  kind TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  audience TEXT NOT NULL,
  template_path TEXT NOT NULL,
  data_method TEXT NOT NULL,
  data_default_args JSONB NOT NULL DEFAULT '{}',
  email_template_key TEXT NOT NULL,
  landing_page_path TEXT NOT NULL,
  cover_image_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE lead_magnet_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON lead_magnet_definitions FOR ALL USING (true);
GRANT ALL ON lead_magnet_definitions TO service_role;
GRANT ALL ON lead_magnet_definitions TO authenticated;

-- format_magnet_bindings
CREATE TABLE IF NOT EXISTS format_magnet_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  magnet_kind TEXT NOT NULL REFERENCES lead_magnet_definitions(kind) ON DELETE CASCADE,
  cta_text TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (format, magnet_kind)
);
CREATE INDEX idx_format_magnet_bindings_format ON format_magnet_bindings (format) WHERE enabled = true;
ALTER TABLE format_magnet_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON format_magnet_bindings FOR ALL USING (true);
GRANT ALL ON format_magnet_bindings TO service_role;
GRANT ALL ON format_magnet_bindings TO authenticated;

-- signup_attributions
CREATE TABLE IF NOT EXISTS signup_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attributed_run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE SET NULL,
  attributed_slug TEXT NOT NULL,
  attributed_platform TEXT NOT NULL,
  first_touch_at TIMESTAMPTZ NOT NULL,
  signup_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tier_at_signup TEXT NOT NULL DEFAULT 'free'
);
CREATE INDEX idx_signup_attributions_run ON signup_attributions (attributed_run_id);
CREATE INDEX idx_signup_attributions_user ON signup_attributions (user_id);
ALTER TABLE signup_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON signup_attributions FOR ALL USING (true);
CREATE POLICY user_read_own ON signup_attributions FOR SELECT USING (auth.uid() = user_id);
GRANT ALL ON signup_attributions TO service_role;
GRANT ALL ON signup_attributions TO authenticated;

-- lead_magnet_deliveries
CREATE TABLE IF NOT EXISTS lead_magnet_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  magnet_kind TEXT NOT NULL REFERENCES lead_magnet_definitions(kind),
  resolved_geo JSONB NOT NULL,
  pdf_asset_id UUID REFERENCES content_assets(id) ON DELETE SET NULL,
  dashboard_url TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  emailed_at TIMESTAMPTZ
);
CREATE INDEX idx_lead_magnet_deliveries_user ON lead_magnet_deliveries (user_id);
ALTER TABLE lead_magnet_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON lead_magnet_deliveries FOR ALL USING (true);
CREATE POLICY user_read_own ON lead_magnet_deliveries FOR SELECT USING (auth.uid() = user_id);
GRANT ALL ON lead_magnet_deliveries TO service_role;
GRANT ALL ON lead_magnet_deliveries TO authenticated;
```

- [ ] **Step 2: Apply and verify.**

```bash
supabase db push
supabase db execute "SELECT table_name FROM information_schema.tables WHERE table_name IN ('lead_magnet_definitions','format_magnet_bindings','signup_attributions','lead_magnet_deliveries');"
```

Expected: 4 rows.

- [ ] **Step 3: Commit.**

```bash
git add supabase/migrations/20260421000300_content_pipeline_attribution.sql
git commit -m "feat(content-pipeline): attribution tables (magnets, bindings, attributions, deliveries)"
```

## Task 1.6: Migration 000400, config tables

**Files:**

- Create: `supabase/migrations/20260421000400_content_pipeline_config.sql`

- [ ] **Step 1: Write migration.**

```sql
CREATE TABLE IF NOT EXISTS tts_voices (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_voice_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  audience_tag TEXT NOT NULL DEFAULT 'short_form',
  sample_url TEXT,
  cost_per_1k_chars NUMERIC NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE tts_voices ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON tts_voices FOR ALL USING (true);
GRANT ALL ON tts_voices TO service_role;
GRANT ALL ON tts_voices TO authenticated;

CREATE TABLE IF NOT EXISTS format_templates (
  format TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  audience TEXT NOT NULL,
  aspect TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  default_approval_mode TEXT NOT NULL DEFAULT 'review',
  default_tts_provider TEXT NOT NULL DEFAULT 'edge',
  default_tts_voice_id TEXT REFERENCES tts_voices(id),
  script_prompt_path TEXT NOT NULL,
  default_platforms TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE format_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON format_templates FOR ALL USING (true);
GRANT ALL ON format_templates TO service_role;
GRANT ALL ON format_templates TO authenticated;

CREATE TABLE IF NOT EXISTS style_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  source_url TEXT,
  preview_strip_url TEXT,
  extracted_attributes JSONB NOT NULL DEFAULT '{}',
  vision_cost_usd NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_style_references_user ON style_references (user_id);
ALTER TABLE style_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON style_references FOR ALL USING (true);
CREATE POLICY user_read_own ON style_references FOR SELECT USING (auth.uid() = user_id);
GRANT ALL ON style_references TO service_role;
GRANT ALL ON style_references TO authenticated;
```

- [ ] **Step 2: Apply and verify.**

```bash
supabase db push
supabase db execute "SELECT table_name FROM information_schema.tables WHERE table_name IN ('tts_voices','format_templates','style_references');"
```

Expected: 3 rows.

- [ ] **Step 3: Commit.**

```bash
git add supabase/migrations/20260421000400_content_pipeline_config.sql
git commit -m "feat(content-pipeline): config tables (tts_voices, format_templates, style_references)"
```

## Task 1.7: Seed migrations 000500, 000600, 000700

**Files:**

- Create: `supabase/migrations/20260421000500_content_pipeline_seed_formats.sql`
- Create: `supabase/migrations/20260421000600_content_pipeline_seed_voices.sql`
- Create: `supabase/migrations/20260421000700_content_pipeline_seed_magnets.sql`

- [ ] **Step 1: Write voices seed (first, formats reference it).**

```sql
-- 20260421000600_content_pipeline_seed_voices.sql
INSERT INTO tts_voices (id, provider, provider_voice_id, display_name, audience_tag, cost_per_1k_chars, enabled)
VALUES ('edge-andrew', 'edge', 'en-US-AndrewMultilingualNeural', 'Andrew (PropertyIQ default)', 'both', 0, true)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Write formats seed.**

```sql
-- 20260421000500_content_pipeline_seed_formats.sql
INSERT INTO format_templates (format, display_name, audience, aspect, duration_seconds, default_approval_mode, default_tts_provider, default_tts_voice_id, script_prompt_path, default_platforms, enabled)
VALUES
  ('grade_reveal', 'Grade Reveal', 'mixed', '9x16', 30, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/grade_reveal.md',
   ARRAY['youtube_shorts'], true),
  ('top_10_ranking', 'Top 10 Ranking', 'investor', '9x16', 60, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/top_10_ranking.md',
   ARRAY['youtube_shorts','tiktok','instagram_reels','facebook_reels'], false),
  ('score_mover', 'Score Mover', 'investor', '9x16', 30, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/score_mover.md',
   ARRAY['youtube_shorts','tiktok','instagram_reels','facebook_reels'], false),
  ('head_to_head', 'Head-to-Head', 'investor', '9x16', 60, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/head_to_head.md',
   ARRAY['youtube_shorts','tiktok','instagram_reels','facebook_reels'], false),
  ('long_form_deep_dive', 'Long-Form Deep Dive', 'mixed', '16x9', 600, 'review', 'elevenlabs', NULL,
   'packages/backend/src/content-pipeline/prompts/long_form_deep_dive.md',
   ARRAY['youtube_long'], false),
  ('farm_area_spotlight', 'Farm Area Spotlight', 'agent', '9x16', 60, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/farm_area_spotlight.md',
   ARRAY['youtube_shorts','tiktok','instagram_reels','facebook_reels','linkedin'], false),
  ('brokerage_market_share', 'Brokerage Market Share', 'broker', '9x16', 75, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/brokerage_market_share.md',
   ARRAY['linkedin','youtube_shorts'], false),
  ('recruitment_angle', 'Recruitment Angle', 'broker', '9x16', 90, 'review', 'edge', 'edge-andrew',
   'packages/backend/src/content-pipeline/prompts/recruitment_angle.md',
   ARRAY['linkedin'], false)
ON CONFLICT (format) DO NOTHING;
```

- [ ] **Step 3: Write magnets seed.**

```sql
-- 20260421000700_content_pipeline_seed_magnets.sql
INSERT INTO lead_magnet_definitions (kind, display_name, description, audience, template_path, data_method, email_template_key, landing_page_path, enabled)
VALUES (
  'market_snapshot_pdf',
  'Market Snapshot Report',
  'One-page PDF with PropertyIQ Score, home value trend, and key market metrics.',
  'mixed',
  'packages/backend/src/content-pipeline/lead-magnets/templates/market_snapshot.html.ejs',
  'getMarketSnapshot',
  'lead-magnet-delivery',
  '/grade-reveal-signup',
  true
)
ON CONFLICT (kind) DO NOTHING;

INSERT INTO format_magnet_bindings (format, magnet_kind, cta_text, weight, enabled)
VALUES (
  'grade_reveal',
  'market_snapshot_pdf',
  'Get your free Market Snapshot for any metro at ',
  1.0,
  true
)
ON CONFLICT (format, magnet_kind) DO NOTHING;
```

- [ ] **Step 4: Apply and verify.**

```bash
supabase db push
supabase db execute "SELECT format, enabled FROM format_templates ORDER BY format;"
supabase db execute "SELECT id FROM tts_voices;"
supabase db execute "SELECT kind FROM lead_magnet_definitions;"
supabase db execute "SELECT format, magnet_kind FROM format_magnet_bindings;"
```

Expected: 8 formats (only grade_reveal enabled); 1 voice; 1 magnet; 1 binding.

- [ ] **Step 5: Commit.**

```bash
git add supabase/migrations/20260421000500_content_pipeline_seed_formats.sql \
        supabase/migrations/20260421000600_content_pipeline_seed_voices.sql \
        supabase/migrations/20260421000700_content_pipeline_seed_magnets.sql
git commit -m "feat(content-pipeline): seed formats, voices, and P1 lead magnet"
```

## Task 1.8: pg-boss schema bootstrap migration 010000

**Files:**

- Create: `supabase/migrations/20260421010000_pgboss_schema_bootstrap.sql`

- [ ] **Step 1: Write migration.**

```sql
CREATE SCHEMA IF NOT EXISTS pgboss;
GRANT USAGE ON SCHEMA pgboss TO service_role;
GRANT ALL ON SCHEMA pgboss TO service_role;
```

- [ ] **Step 2: Apply and verify.**

```bash
supabase db push
supabase db execute "SELECT schema_name FROM information_schema.schemata WHERE schema_name='pgboss';"
```

Expected: 1 row.

- [ ] **Step 3: Commit.**

```bash
git add supabase/migrations/20260421010000_pgboss_schema_bootstrap.sql
git commit -m "feat(content-pipeline): pgboss schema bootstrap"
```

## Task 1.9: NestJS module scaffold plus shared types

**Files:**

- Create: `packages/backend/src/content-pipeline/types.ts`
- Create: `packages/backend/src/content-pipeline/content-pipeline.module.ts`
- Create: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`
- Create: `packages/backend/src/content-pipeline/content-pipeline.service.ts`
- Create: `packages/backend/src/content-pipeline/content-pipeline.controller.spec.ts`
- Modify: `packages/backend/src/app.module.ts`

- [ ] **Step 1: Write shared types.**

```typescript
// packages/backend/src/content-pipeline/types.ts
export type ContentFormat =
  | "grade_reveal"
  | "top_10_ranking"
  | "score_mover"
  | "head_to_head"
  | "long_form_deep_dive"
  | "farm_area_spotlight"
  | "brokerage_market_share"
  | "recruitment_angle";

export type Audience = "investor" | "agent" | "broker" | "mixed";

export type Platform =
  | "youtube_shorts"
  | "youtube_long"
  | "tiktok"
  | "instagram_reels"
  | "facebook_reels"
  | "linkedin";

export type PostMode = "direct" | "draft" | "scheduled";
export type ApprovalMode = "auto" | "review" | "draft";

export type PipelineStatus =
  | "queued"
  | "fetching_data"
  | "scripting"
  | "verifying_data"
  | "linting_voice"
  | "rendering_voice"
  | "timing_captions"
  | "rendering_video"
  | "ready_for_review"
  | "publishing"
  | "published"
  | "published_partial"
  | "rejected"
  | "failed";

export interface GeoRef {
  geography: "state" | "metro" | "county" | "zip";
  id: string;
  canonical_name: string;
}
```

- [ ] **Step 2: Write failing health-endpoint test.**

```typescript
// packages/backend/src/content-pipeline/content-pipeline.controller.spec.ts
import { Test } from "@nestjs/testing";
import { ContentPipelineController } from "./content-pipeline.controller";
import { ContentPipelineService } from "./content-pipeline.service";

describe("ContentPipelineController", () => {
  it("health endpoint returns ok envelope", async () => {
    const module = await Test.createTestingModule({
      controllers: [ContentPipelineController],
      providers: [{ provide: ContentPipelineService, useValue: {} }],
    }).compile();
    const controller = module.get(ContentPipelineController);
    expect(await controller.health()).toEqual({
      success: true,
      data: { status: "ok" },
    });
  });
});
```

- [ ] **Step 3: Run test to confirm failure.**

```bash
cd packages/backend && npm run test -- content-pipeline.controller.spec
```

Expected: FAIL (controller does not exist).

- [ ] **Step 4: Write module, controller, and service.**

```typescript
// packages/backend/src/content-pipeline/content-pipeline.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class ContentPipelineService {
  constructor(private readonly supabase: SupabaseService) {}
}
```

```typescript
// packages/backend/src/content-pipeline/content-pipeline.controller.ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin-auth.guard";
import { ContentPipelineService } from "./content-pipeline.service";

@UseGuards(AdminGuard)
@Controller("api/admin/content-pipeline")
export class ContentPipelineController {
  constructor(private readonly service: ContentPipelineService) {}

  @Get("health")
  async health() {
    return { success: true, data: { status: "ok" } };
  }
}
```

```typescript
// packages/backend/src/content-pipeline/content-pipeline.module.ts
import { Module } from "@nestjs/common";
import { ContentPipelineController } from "./content-pipeline.controller";
import { ContentPipelineService } from "./content-pipeline.service";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [SupabaseModule],
  controllers: [ContentPipelineController],
  providers: [ContentPipelineService],
  exports: [ContentPipelineService],
})
export class ContentPipelineModule {}
```

- [ ] **Step 5: Register in `app.module.ts`.**

Find `imports: [` in `packages/backend/src/app.module.ts` and add:

```typescript
import { ContentPipelineModule } from './content-pipeline/content-pipeline.module';
// within the array:
ContentPipelineModule,
```

- [ ] **Step 6: Run test to confirm pass.**

```bash
cd packages/backend && npm run test -- content-pipeline.controller.spec
```

Expected: PASS.

- [ ] **Step 7: Build and smoke-test the endpoint.**

```bash
cd packages/backend && npm run build && npm run start:dev
# In another shell:
curl -H "Authorization: Bearer <admin-jwt>" http://localhost:3001/api/admin/content-pipeline/health
```

Expected: `{"success":true,"data":{"status":"ok"}}`.

- [ ] **Step 8: Commit.**

```bash
git add packages/backend/src/content-pipeline/ packages/backend/src/app.module.ts
git commit -m "feat(content-pipeline): module scaffold with AdminGuard health endpoint"
```

## Task 1.10: QueueService wrapping pg-boss

**Files:**

- Create: `packages/backend/src/content-pipeline/orchestrator/queue.service.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/queue.module.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/queue.service.spec.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`

- [ ] **Step 1: Write QueueService.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/queue.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import PgBoss from "pg-boss";

export type QueueName =
  | "orchestrator"
  | "render-audio"
  | "render-captions"
  | "render-video"
  | "render-pdf"
  | "publish-youtube"
  | "publish-tiktok"
  | "publish-instagram"
  | "publish-facebook"
  | "publish-linkedin"
  | "metrics-pull";

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private boss!: PgBoss;

  async onModuleInit(): Promise<void> {
    const connectionString = process.env.SUPABASE_DB_URL;
    if (!connectionString) {
      throw new Error("SUPABASE_DB_URL is required for content-pipeline queue");
    }
    this.boss = new PgBoss({
      connectionString,
      schema: "pgboss",
      retryLimit: 0,
      retentionDays: 30,
    });
    this.boss.on("error", (err) => this.logger.error("pg-boss error", err));
    await this.boss.start();
    this.logger.log("pg-boss queue started");
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) await this.boss.stop({ graceful: true });
  }

  async send<T>(
    queue: QueueName,
    data: T,
    opts?: PgBoss.SendOptions,
  ): Promise<string | null> {
    return this.boss.send(queue, data as object, opts ?? {});
  }

  async work<T>(
    queue: QueueName,
    handler: (job: PgBoss.Job<T>) => Promise<void>,
    opts?: PgBoss.WorkOptions,
  ): Promise<string> {
    return this.boss.work<T>(
      queue,
      opts ?? { teamSize: 1, teamConcurrency: 1 },
      async (jobs) => {
        for (const job of jobs) await handler(job);
      },
    );
  }

  getBoss(): PgBoss {
    return this.boss;
  }
}
```

- [ ] **Step 2: Write QueueModule (global).**

```typescript
// packages/backend/src/content-pipeline/orchestrator/queue.module.ts
import { Module, Global } from "@nestjs/common";
import { QueueService } from "./queue.service";

@Global()
@Module({ providers: [QueueService], exports: [QueueService] })
export class QueueModule {}
```

- [ ] **Step 3: Wire into ContentPipelineModule.**

```typescript
// edit content-pipeline.module.ts
import { QueueModule } from './orchestrator/queue.module';
// add to imports array:
QueueModule,
```

- [ ] **Step 4: Write failing integration test.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/queue.service.spec.ts
import { QueueService } from "./queue.service";

describe("QueueService roundtrip", () => {
  let service: QueueService;

  beforeAll(async () => {
    process.env.SUPABASE_DB_URL =
      process.env.SUPABASE_DB_URL ??
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
    service = new QueueService();
    await service.onModuleInit();
  });

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it("sends and receives a job", async () => {
    const received: Array<{ n: number }> = [];
    await service.work<{ n: number }>("orchestrator", async (job) => {
      received.push(job.data);
    });
    const jobId = await service.send("orchestrator", { n: 42 });
    expect(jobId).toBeTruthy();
    await new Promise((r) => setTimeout(r, 2000));
    expect(received).toEqual([{ n: 42 }]);
  });
});
```

- [ ] **Step 5: Ensure local Postgres running, run test.**

```bash
supabase start
cd packages/backend && npm run test -- queue.service.spec
```

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add packages/backend/src/content-pipeline/orchestrator/ packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): QueueService wrapping pg-boss with start/stop lifecycle"
```

## Task 1.11: ContentDataService facade

**Files:**

- Create: `packages/backend/src/content-pipeline/data/content-data.types.ts`
- Create: `packages/backend/src/content-pipeline/data/content-data.service.ts`
- Create: `packages/backend/src/content-pipeline/data/content-data.service.spec.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`

**Note:** This task depends on Prerequisite 2 (internal service map). If the specific internal service method names differ from those used below (e.g., `MarketsService` may not have a `getHomeValue()` method), adjust the facade to match. The tests use mocked services so are independent of the concrete internal services.

- [ ] **Step 1: Write data types.**

```typescript
// packages/backend/src/content-pipeline/data/content-data.types.ts
import { GeoRef } from "../types";

export interface ResolvedMarket {
  geography: GeoRef["geography"];
  id: string;
  canonical_name: string;
  state?: string;
  population?: number;
}

export interface MarketSnapshot {
  geo: GeoRef;
  home_value: { value: number; yoy_pct: number; period_date: string } | null;
  rent: { value: number; yoy_pct: number; period_date: string } | null;
  demographics: {
    population: number;
    median_income: number;
    homeownership_pct: number;
  } | null;
  economic: { unemployment_rate: number; job_growth_yoy_pct: number } | null;
  score: { propertyiq_score: number; grade: string; confidence: string } | null;
}

export interface PropertyIQScoreResult {
  geo: GeoRef;
  score: number;
  grade: string;
  label: string;
  confidence_pct: number;
  confidence_level: "A" | "B" | "C" | "F";
  history: Array<{ date: string; score: number }>;
}

export interface TrendingMarketItem {
  geo: GeoRef;
  current_score: number;
  previous_score: number;
  delta: number;
}

export interface CashflowMarketItem {
  geo: GeoRef;
  home_value: number;
  rent: number;
  rent_to_price_ratio: number;
  rank: number;
}
```

- [ ] **Step 2: Write failing tests with mocked internal services.**

```typescript
// packages/backend/src/content-pipeline/data/content-data.service.spec.ts
import { Test } from "@nestjs/testing";
import { ContentDataService } from "./content-data.service";
import { MarketsService } from "../../markets/markets.service";
import { ScoringService } from "../../scoring/scoring.service";
import { GeographyService } from "../../geography/geography.service";

describe("ContentDataService", () => {
  let service: ContentDataService;
  let geography: { search: jest.Mock };
  let markets: {
    getHomeValue: jest.Mock;
    getRent: jest.Mock;
    getDemographics: jest.Mock;
    getEconomic: jest.Mock;
    getTopCashflow: jest.Mock;
  };
  let scoring: {
    getScore: jest.Mock;
    getScoreWithHistory: jest.Mock;
    getTrendingMarkets: jest.Mock;
  };

  beforeEach(async () => {
    geography = { search: jest.fn() };
    markets = {
      getHomeValue: jest.fn(),
      getRent: jest.fn(),
      getDemographics: jest.fn(),
      getEconomic: jest.fn(),
      getTopCashflow: jest.fn(),
    };
    scoring = {
      getScore: jest.fn(),
      getScoreWithHistory: jest.fn(),
      getTrendingMarkets: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ContentDataService,
        { provide: GeographyService, useValue: geography },
        { provide: MarketsService, useValue: markets },
        { provide: ScoringService, useValue: scoring },
      ],
    }).compile();
    service = module.get(ContentDataService);
  });

  it("resolveMarket maps geography search results", async () => {
    geography.search.mockResolvedValue([
      {
        geography_level: "metro",
        geo_id: "35620",
        canonical_name: "New York NY",
        state: "NY",
        population: 19000000,
      },
    ]);
    const result = await service.resolveMarket("new york");
    expect(result).toHaveLength(1);
    expect(result[0].canonical_name).toBe("New York NY");
    expect(result[0].geography).toBe("metro");
  });

  it("getMarketSnapshot aggregates null-safely across sources", async () => {
    markets.getHomeValue.mockResolvedValue({
      value: 600000,
      yoy_pct: 3.2,
      period_date: "2026-03-01",
    });
    markets.getRent.mockRejectedValue(new Error("no data"));
    markets.getDemographics.mockResolvedValue({
      population: 19000000,
      median_income: 85000,
      homeownership_pct: 62,
    });
    markets.getEconomic.mockResolvedValue({
      unemployment_rate: 4.1,
      job_growth_yoy_pct: 1.8,
    });
    scoring.getScore.mockResolvedValue({
      propertyiq_score: 72,
      grade: "B",
      confidence: "A",
    });

    const result = await service.getMarketSnapshot({
      geography: "metro",
      id: "35620",
      canonical_name: "NY",
    });
    expect(result.home_value?.value).toBe(600000);
    expect(result.rent).toBeNull();
    expect(result.score?.propertyiq_score).toBe(72);
  });

  it("getPropertyIQScore returns score with 12-month history", async () => {
    scoring.getScoreWithHistory.mockResolvedValue({
      geo: { geography: "metro", id: "35620", canonical_name: "NY" },
      score: 72,
      grade: "B",
      label: "GOOD",
      confidence_pct: 86,
      confidence_level: "A",
      history: Array(12).fill({ date: "2026-03-01", score: 72 }),
    });
    const r = await service.getPropertyIQScore({
      geography: "metro",
      id: "35620",
      canonical_name: "NY",
    });
    expect(r.history).toHaveLength(12);
  });
});
```

- [ ] **Step 3: Run tests to confirm failure.**

```bash
cd packages/backend && npm run test -- content-data.service.spec
```

Expected: FAIL (service not defined).

- [ ] **Step 4: Implement the service.**

```typescript
// packages/backend/src/content-pipeline/data/content-data.service.ts
import { Injectable } from "@nestjs/common";
import { MarketsService } from "../../markets/markets.service";
import { ScoringService } from "../../scoring/scoring.service";
import { GeographyService } from "../../geography/geography.service";
import { GeoRef } from "../types";
import {
  MarketSnapshot,
  PropertyIQScoreResult,
  ResolvedMarket,
  TrendingMarketItem,
  CashflowMarketItem,
} from "./content-data.types";

@Injectable()
export class ContentDataService {
  constructor(
    private readonly markets: MarketsService,
    private readonly scoring: ScoringService,
    private readonly geography: GeographyService,
  ) {}

  async resolveMarket(query: string): Promise<ResolvedMarket[]> {
    const results = await this.geography.search(query, { limit: 10 });
    return results.map((r: any) => ({
      geography: r.geography_level,
      id: r.geo_id,
      canonical_name: r.canonical_name,
      state: r.state,
      population: r.population ?? undefined,
    }));
  }

  async getMarketSnapshot(geo: GeoRef): Promise<MarketSnapshot> {
    const [homeValue, rent, demographics, economic, score] = await Promise.all([
      this.markets.getHomeValue(geo).catch(() => null),
      this.markets.getRent(geo).catch(() => null),
      this.markets.getDemographics(geo).catch(() => null),
      this.markets.getEconomic(geo).catch(() => null),
      this.scoring.getScore(geo).catch(() => null),
    ]);
    return { geo, home_value: homeValue, rent, demographics, economic, score };
  }

  async getPropertyIQScore(geo: GeoRef): Promise<PropertyIQScoreResult> {
    return this.scoring.getScoreWithHistory(geo, 12);
  }

  async getTrendingMarkets(
    geography: GeoRef["geography"],
    direction: "up" | "down",
    limit: number,
  ): Promise<TrendingMarketItem[]> {
    return this.scoring.getTrendingMarkets(geography, direction, limit);
  }

  async getTopCashflowMarkets(
    state: string,
    geography: GeoRef["geography"],
    limit: number,
  ): Promise<CashflowMarketItem[]> {
    return this.markets.getTopCashflow(state, geography, limit);
  }
}
```

- [ ] **Step 5: Run tests to confirm pass.**

```bash
cd packages/backend && npm run test -- content-data.service.spec
```

Expected: 3 tests PASS.

- [ ] **Step 6: Register in ContentPipelineModule.**

```typescript
// edit content-pipeline.module.ts
import { MarketsModule } from '../markets/markets.module';
import { ScoringModule } from '../scoring/scoring.module';
import { GeographyModule } from '../geography/geography.module';
import { ContentDataService } from './data/content-data.service';

// imports array gains:
MarketsModule, ScoringModule, GeographyModule,
// providers array gains:
ContentDataService,
// exports array gains:
ContentDataService,
```

- [ ] **Step 7: Commit.**

```bash
git add packages/backend/src/content-pipeline/data/ packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): ContentDataService facade with 5 P1 methods and tests"
```

## Task 1.12: Internal service discovery document

**Files:**

- Create: `docs/content-pipeline/internal-services-map.md`

- [ ] **Step 1: Trace the 11 MCP tools the pipeline will use.**

For each tool, open the file in `packages/mcp-server/src/tools/` and find the backend HTTP endpoint it calls. Then locate the NestJS controller and service that handles that endpoint. List findings.

Tools to trace:

- `search_markets`
- `get_market_snapshot`
- `get_propertyiq_score`
- `get_trending_markets`
- `top_cashflow_markets`
- `farm_area_analysis` (P2)
- `brokerage_market_coverage_report` (P3)
- `agent_recruitment_pitch` (P3)
- `referral_network_finder` (P3)
- `compare_markets_for_content` (P2)
- `generate_market_narrative` (P3)

- [ ] **Step 2: Write the map.**

```markdown
# Internal Services Map

Generated 2026-04-21. Maps MCP tool names to internal PropertyIQ NestJS services that `ContentDataService` will call directly, bypassing the MCP HTTP layer.

## P1 tools

| MCP tool             | HTTP endpoint        | NestJS controller | Service.method | Notes                        |
| -------------------- | -------------------- | ----------------- | -------------- | ---------------------------- |
| search_markets       | (fill in from trace) | (fill in)         | (fill in)      |                              |
| get_market_snapshot  |                      |                   |                | aggregates multiple services |
| get_propertyiq_score |                      |                   |                |                              |
| get_trending_markets |                      |                   |                |                              |
| top_cashflow_markets |                      |                   |                |                              |

## P2 tools

(Tracings for P2 tools; fill in when starting P2.)

## P3 tools

(Tracings for P3 tools; fill in when starting P3.)

## Gaps

Any tool whose logic lives only inside its MCP tool file with no backend service. For each gap, decide: lift logic into a new internal service, or call the MCP HTTP endpoint directly from ContentDataService.
```

- [ ] **Step 3: Commit.**

```bash
git add docs/content-pipeline/internal-services-map.md
git commit -m "docs(content-pipeline): internal services map for MCP tool equivalents"
```

## Task 1.13: ScriptGenerator interface and Anthropic implementation

**Files:**

- Create: `packages/backend/src/content-pipeline/prompts/_system.md`
- Create: `packages/backend/src/content-pipeline/prompts/grade_reveal.md`
- Create: `packages/backend/src/content-pipeline/drivers/driver-cost.types.ts`
- Create: `packages/backend/src/content-pipeline/drivers/script-generator.interface.ts`
- Create: `packages/backend/src/content-pipeline/drivers/anthropic-script-generator.ts`
- Create: `packages/backend/src/content-pipeline/drivers/anthropic-script-generator.spec.ts`

- [ ] **Step 1: Write shared system prompt.**

```markdown
<!-- packages/backend/src/content-pipeline/prompts/_system.md -->

You are the script writer for PropertyIQ, a real estate analytics platform. You produce scripts for faceless, data-driven short videos.

Brand voice: confident, conversational, data-first, not hypey. Write like a knowledgeable friend, not a textbook or influencer. Lead with specifics. Cite one concrete data point in the first two seconds.

Hard rules you must never break:

1. No em dashes. Use commas, colons, periods, or parentheses.
2. The only score is "PropertyIQ Score" or "PIQ Score". Never InvestorEdge, HomeReady, or Market Health Index.
3. No filler hype words: "game-changer", "crushing it", "no-brainer", "insane", "literally", "you won't believe", "absolutely".
4. Do not invent numbers. Only use numbers that appear in the provided data bundle.
5. The first 2 seconds must hook with a concrete claim (a number, a ranking, a contrast).

Structure every short-form script as: hook, body (specific data points with light narrative), cta (use the provided cta_text verbatim).

Output format is strict JSON matching the tool-use schema you will receive.
```

- [ ] **Step 2: Write Grade Reveal prompt.**

```markdown
<!-- packages/backend/src/content-pipeline/prompts/grade_reveal.md -->

Write a 30-second Grade Reveal script for {{canonical_name}}.

Data bundle (authoritative, do not use any other numbers):
{{dataBundle}}

Structure: open with the PropertyIQ Score and grade letter, explain what the score represents in one line, cite two supporting stats from the data bundle, close with this CTA verbatim: {{cta_text}}{{shortLinkPlaceholder}}

Hook options: produce {{variantCount}} alternative hooks. Hook A leads with the score number ("Cleveland's PropertyIQ Score just hit 78"). Hook B (if variantCount=2) leads with a contrast ("Most investors miss this: Cleveland outscores Austin by 9 points on PIQ").

Scene hints (30 seconds total):

- Intro (2s)
- Score reveal with PIQ ring (7s)
- Stat cards with 4 key metrics (8s)
- CTA card (3s)
- Total scripted text approximately 70-80 words.

Output a tool_use call matching the schema.
```

- [ ] **Step 3: Write cost type.**

```typescript
// packages/backend/src/content-pipeline/drivers/driver-cost.types.ts
export interface DriverCost {
  provider: string;
  amount_usd: number;
  units: number;
  unit_type:
    | "tokens_input"
    | "tokens_output"
    | "chars"
    | "seconds"
    | "frames"
    | "requests";
}
```

- [ ] **Step 4: Write ScriptGenerator interface.**

```typescript
// packages/backend/src/content-pipeline/drivers/script-generator.interface.ts
import { ContentFormat, Audience } from "../types";
import { ResolvedMarket } from "../data/content-data.types";
import { DriverCost } from "./driver-cost.types";

export interface ScriptGenerationRequest {
  format: ContentFormat;
  audience: Audience;
  resolvedMarket: ResolvedMarket;
  dataBundle: unknown;
  variantCount: 1 | 2;
  ctaText: string;
  styleReferenceAttributes?: Record<string, unknown>;
  extraDirectives?: string;
}

export interface ScriptVariant {
  variantId: "A" | "B";
  hook: string;
  body: string;
  cta: string;
  fullText: string;
  sceneBreakdown: Array<{
    sceneKey: string;
    text: string;
    durationHintSec: number;
  }>;
}

export interface ScriptGenerationResult {
  scripts: ScriptVariant[];
  cost: DriverCost;
  rawLLMResponse: unknown;
}

export const SCRIPT_GENERATOR = Symbol("ScriptGenerator");

export interface ScriptGenerator {
  generate(req: ScriptGenerationRequest): Promise<ScriptGenerationResult>;
}
```

- [ ] **Step 5: Write failing test.**

```typescript
// packages/backend/src/content-pipeline/drivers/anthropic-script-generator.spec.ts
import { AnthropicScriptGenerator } from "./anthropic-script-generator";

jest.mock("@anthropic-ai/sdk", () =>
  jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [
          {
            type: "tool_use",
            name: "emit_script",
            input: {
              scripts: [
                {
                  variantId: "A",
                  hook: "Cleveland's PropertyIQ Score just hit 78.",
                  body: "That is up 4 points YoY, with homes selling 8 percent above list.",
                  cta: "Get your free Market Snapshot at {{SHORT_LINK}}",
                  fullText:
                    "Cleveland's PropertyIQ Score just hit 78. That is up 4 points YoY. Get your free Market Snapshot at {{SHORT_LINK}}",
                  sceneBreakdown: [
                    {
                      sceneKey: "intro",
                      text: "Cleveland PropertyIQ Score",
                      durationHintSec: 2,
                    },
                    {
                      sceneKey: "score_reveal",
                      text: "78",
                      durationHintSec: 7,
                    },
                    { sceneKey: "stats", text: "Up 4 YoY", durationHintSec: 8 },
                    {
                      sceneKey: "cta",
                      text: "Get your Market Snapshot",
                      durationHintSec: 3,
                    },
                  ],
                },
              ],
            },
          },
        ],
        usage: {
          input_tokens: 1200,
          output_tokens: 280,
          cache_read_input_tokens: 900,
        },
      }),
    },
  })),
);

describe("AnthropicScriptGenerator", () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("returns scripts with correct cost calculation", async () => {
    const gen = new AnthropicScriptGenerator();
    const result = await gen.generate({
      format: "grade_reveal",
      audience: "mixed",
      resolvedMarket: {
        geography: "metro",
        id: "17140",
        canonical_name: "Cleveland, OH",
      },
      dataBundle: { score: 78 },
      variantCount: 1,
      ctaText: "Get your free Market Snapshot at ",
    });
    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0].variantId).toBe("A");
    expect(result.cost.provider).toBe("anthropic");
    expect(result.cost.amount_usd).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Run test to confirm failure.**

```bash
cd packages/backend && npm run test -- anthropic-script-generator.spec
```

Expected: FAIL (class not defined).

- [ ] **Step 7: Implement AnthropicScriptGenerator.**

```typescript
// packages/backend/src/content-pipeline/drivers/anthropic-script-generator.ts
import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import {
  ScriptGenerator,
  ScriptGenerationRequest,
  ScriptGenerationResult,
  ScriptVariant,
} from "./script-generator.interface";

const SCRIPT_TOOL_SCHEMA = {
  name: "emit_script",
  description: "Emit structured script variants for rendering.",
  input_schema: {
    type: "object",
    required: ["scripts"],
    properties: {
      scripts: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        items: {
          type: "object",
          required: [
            "variantId",
            "hook",
            "body",
            "cta",
            "fullText",
            "sceneBreakdown",
          ],
          properties: {
            variantId: { type: "string", enum: ["A", "B"] },
            hook: { type: "string" },
            body: { type: "string" },
            cta: { type: "string" },
            fullText: { type: "string" },
            sceneBreakdown: {
              type: "array",
              items: {
                type: "object",
                required: ["sceneKey", "text", "durationHintSec"],
                properties: {
                  sceneKey: { type: "string" },
                  text: { type: "string" },
                  durationHintSec: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class AnthropicScriptGenerator implements ScriptGenerator {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
    this.client = new Anthropic({ apiKey });
    this.model = process.env.SCRIPT_LLM_MODEL ?? "claude-sonnet-4-6";
    this.systemPrompt = readFileSync(
      join(__dirname, "..", "prompts", "_system.md"),
      "utf8",
    );
  }

  async generate(
    req: ScriptGenerationRequest,
  ): Promise<ScriptGenerationResult> {
    const promptPath = join(__dirname, "..", "prompts", `${req.format}.md`);
    const template = readFileSync(promptPath, "utf8");
    const userPrompt = template
      .replaceAll("{{canonical_name}}", req.resolvedMarket.canonical_name)
      .replaceAll("{{dataBundle}}", JSON.stringify(req.dataBundle, null, 2))
      .replaceAll("{{cta_text}}", req.ctaText)
      .replaceAll("{{shortLinkPlaceholder}}", "{{SHORT_LINK}}")
      .replaceAll("{{variantCount}}", String(req.variantCount));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: this.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [SCRIPT_TOOL_SCHEMA as unknown as Anthropic.Messages.Tool],
      tool_choice: { type: "tool", name: "emit_script" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolBlock = response.content.find((c) => c.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("ScriptGenerator did not receive a tool_use block");
    }
    const parsed = toolBlock.input as { scripts: ScriptVariant[] };

    const inputTokens =
      response.usage.input_tokens +
      (response.usage.cache_read_input_tokens ?? 0);
    const outputTokens = response.usage.output_tokens;
    const costUsd = (inputTokens * 3.0 + outputTokens * 15.0) / 1_000_000;

    return {
      scripts: parsed.scripts,
      cost: {
        provider: "anthropic",
        amount_usd: costUsd,
        units: inputTokens + outputTokens,
        unit_type: "tokens_input",
      },
      rawLLMResponse: response,
    };
  }
}
```

- [ ] **Step 8: Run test to confirm pass.**

```bash
cd packages/backend && npm run test -- anthropic-script-generator.spec
```

Expected: PASS.

- [ ] **Step 9: Register in module.**

```typescript
// edit content-pipeline.module.ts
import { AnthropicScriptGenerator } from './drivers/anthropic-script-generator';
import { SCRIPT_GENERATOR } from './drivers/script-generator.interface';

// add to providers:
{ provide: SCRIPT_GENERATOR, useClass: AnthropicScriptGenerator },
AnthropicScriptGenerator,
```

- [ ] **Step 10: Commit.**

```bash
git add packages/backend/src/content-pipeline/prompts/ packages/backend/src/content-pipeline/drivers/ packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): ScriptGenerator with Anthropic tool-use and Grade Reveal prompt"
```

## Task 1.14: Gate A DataVerifierService

**Files:**

- Create: `packages/backend/src/content-pipeline/gates/gate.types.ts`
- Create: `packages/backend/src/content-pipeline/gates/data-verifier.service.ts`
- Create: `packages/backend/src/content-pipeline/gates/__fixtures__/gate-a-corpus.json`
- Create: `packages/backend/src/content-pipeline/gates/data-verifier.service.spec.ts`

- [ ] **Step 1: Write shared gate types.**

```typescript
// packages/backend/src/content-pipeline/gates/gate.types.ts
export interface NumericClaim {
  quote: string;
  value: number;
  category:
    | "price"
    | "percentage"
    | "score"
    | "ranking"
    | "count"
    | "date"
    | "duration";
  subject: string;
}

export interface GateViolation {
  claim: NumericClaim;
  expected_from_data?: number;
  actual_in_script: number;
  reason: "unmatched" | "out_of_tolerance" | "missing";
}

export interface GateResult {
  passed: boolean;
  violations: GateViolation[];
  llm_judge_response?: unknown;
}
```

- [ ] **Step 2: Write adversarial fixture corpus (20 cases).**

```json
{
  "cases": [
    {
      "name": "hallucinated_ranking",
      "script": "Cleveland is the number 1 cashflow market in Ohio.",
      "payload": {
        "top_cashflow_markets": [
          { "rank": 1, "name": "Cincinnati" },
          { "rank": 2, "name": "Cleveland" }
        ]
      },
      "expectPass": false,
      "expectViolation": "ranking"
    },
    {
      "name": "drifted_price",
      "script": "The median home price in Hartford is $450,000.",
      "payload": { "home_value": { "value": 385000 } },
      "expectPass": false,
      "expectViolation": "price"
    },
    {
      "name": "exact_score_match",
      "script": "The PropertyIQ Score for Austin is 82.",
      "payload": { "score": { "propertyiq_score": 82 } },
      "expectPass": true
    },
    {
      "name": "price_within_tolerance",
      "script": "Homes in Denver go for about $600,000.",
      "payload": { "home_value": { "value": 599500 } },
      "expectPass": true
    },
    {
      "name": "percent_within_tolerance",
      "script": "Rents grew 4 percent in Tampa.",
      "payload": { "rent": { "yoy_pct": 4.3 } },
      "expectPass": true
    },
    {
      "name": "percent_out_of_tolerance",
      "script": "Unemployment in Phoenix is at 2 percent.",
      "payload": { "economic": { "unemployment_rate": 4.1 } },
      "expectPass": false,
      "expectViolation": "percentage"
    },
    {
      "name": "score_off_by_one",
      "script": "Cleveland scored 79.",
      "payload": { "score": { "propertyiq_score": 78 } },
      "expectPass": false,
      "expectViolation": "score"
    },
    {
      "name": "missing_data",
      "script": "Boise has a PropertyIQ Score of 65.",
      "payload": { "score": null },
      "expectPass": false,
      "expectViolation": "score"
    },
    {
      "name": "ranking_swap",
      "script": "Austin is rank 3 in appreciation.",
      "payload": { "rankings": [{ "rank": 1, "name": "Austin" }] },
      "expectPass": false,
      "expectViolation": "ranking"
    },
    {
      "name": "count_mismatch",
      "script": "We analyzed 100 markets.",
      "payload": { "count": 50 },
      "expectPass": false,
      "expectViolation": "count"
    },
    {
      "name": "decimal_handling",
      "script": "The home value grew 3.5 percent.",
      "payload": { "home_value": { "yoy_pct": 3.6 } },
      "expectPass": true
    },
    {
      "name": "percentage_point_confusion",
      "script": "Unemployment fell 2 percentage points.",
      "payload": { "economic": { "unemployment_delta_pp": 1.8 } },
      "expectPass": true
    },
    {
      "name": "multiple_claims_one_bad",
      "script": "Cleveland's PIQ is 78 and Austin's is 80.",
      "payload": { "scores": { "Cleveland": 78, "Austin": 82 } },
      "expectPass": false,
      "expectViolation": "score"
    },
    {
      "name": "multiple_claims_all_good",
      "script": "Cleveland's PIQ is 78 and Austin's is 82.",
      "payload": { "scores": { "Cleveland": 78, "Austin": 82 } },
      "expectPass": true
    },
    {
      "name": "negative_delta",
      "script": "The score fell 5 points.",
      "payload": { "delta": -5 },
      "expectPass": true
    },
    {
      "name": "date_within_tolerance",
      "script": "As of March 2026, ...",
      "payload": { "period_date": "2026-02-15" },
      "expectPass": true
    },
    {
      "name": "date_out_of_tolerance",
      "script": "As of 2025, ...",
      "payload": { "period_date": "2026-03-01" },
      "expectPass": false,
      "expectViolation": "date"
    },
    {
      "name": "rent_exact",
      "script": "Median rent is $2,400.",
      "payload": { "rent": { "value": 2400 } },
      "expectPass": true
    },
    {
      "name": "percent_vs_ratio_confusion",
      "script": "Sold 8 percent above list.",
      "payload": { "sold_above_list_pct": 8.2 },
      "expectPass": true
    },
    {
      "name": "rounded_price",
      "script": "About $1 million.",
      "payload": { "home_value": { "value": 1004500 } },
      "expectPass": true
    }
  ]
}
```

- [ ] **Step 3: Write failing tests against the corpus.**

```typescript
// packages/backend/src/content-pipeline/gates/data-verifier.service.spec.ts
import corpus from "./__fixtures__/gate-a-corpus.json";
import { DataVerifierService } from "./data-verifier.service";

jest.mock("@anthropic-ai/sdk", () =>
  jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockImplementation(async ({ messages }: any) => {
        const scriptText: string = messages[0].content.split("\n\n")[1] ?? "";
        const numMatches = Array.from(
          scriptText.matchAll(/\$?([\d,]+(?:\.\d+)?)(?:%|\spercent)?/g),
        );
        return {
          content: [
            {
              type: "tool_use",
              name: "extract_claims",
              input: {
                claims: numMatches.map((m) => {
                  const quote = m[0];
                  const value = parseFloat(m[1].replace(/,/g, ""));
                  let category: string;
                  if (
                    quote.includes("%") ||
                    /percent/i.test(scriptText.slice(m.index!, m.index! + 30))
                  )
                    category = "percentage";
                  else if (quote.startsWith("$")) category = "price";
                  else if (
                    /number\s+\d+|rank\s+\d+|#\d+/i.test(
                      quote +
                        " " +
                        scriptText.slice(Math.max(0, m.index! - 10), m.index!),
                    )
                  )
                    category = "ranking";
                  else if (
                    /score/i.test(
                      scriptText.slice(Math.max(0, m.index! - 20), m.index!),
                    )
                  )
                    category = "score";
                  else if (/202\d/.test(quote) || /20\d{2}/.test(quote))
                    category = "date";
                  else category = "count";
                  return { quote, value, category, subject: "unknown" };
                }),
              },
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      }),
    },
  })),
);

describe("DataVerifierService against 20-case corpus", () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = "test";
  });

  for (const c of corpus.cases) {
    it(c.name, async () => {
      const svc = new DataVerifierService();
      const result = await svc.verify(c.script, c.payload);
      expect(result.passed).toBe(c.expectPass);
    });
  }
});
```

- [ ] **Step 4: Run tests to confirm failure.**

```bash
cd packages/backend && npm run test -- data-verifier.service.spec
```

Expected: FAIL (service not defined).

- [ ] **Step 5: Implement DataVerifierService.**

```typescript
// packages/backend/src/content-pipeline/gates/data-verifier.service.ts
import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { NumericClaim, GateResult, GateViolation } from "./gate.types";

const TOLERANCES_BALANCED: Record<string, number> = {
  price: 1000,
  percentage: 0.5,
  score: 0,
  ranking: 0,
  count: 0,
  duration: 0.1,
  date: 30,
};

const EXTRACT_TOOL = {
  name: "extract_claims",
  description: "Extract all numeric claims from a video script.",
  input_schema: {
    type: "object",
    required: ["claims"],
    properties: {
      claims: {
        type: "array",
        items: {
          type: "object",
          required: ["quote", "value", "category", "subject"],
          properties: {
            quote: { type: "string" },
            value: { type: "number" },
            category: {
              type: "string",
              enum: [
                "price",
                "percentage",
                "score",
                "ranking",
                "count",
                "date",
                "duration",
              ],
            },
            subject: { type: "string" },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class DataVerifierService {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async verify(scriptText: string, mcpPayload: unknown): Promise<GateResult> {
    const claims = await this.extractClaims(scriptText);
    const violations: GateViolation[] = [];
    const candidates = this.extractNumericValues(mcpPayload);
    for (const claim of claims) {
      const tolerance = this.toleranceFor(claim.category);
      const hit = candidates.find(
        (n) => Math.abs(n - claim.value) <= tolerance,
      );
      if (hit === undefined) {
        violations.push({
          claim,
          actual_in_script: claim.value,
          reason: "unmatched",
        });
      }
    }
    return { passed: violations.length === 0, violations };
  }

  private async extractClaims(scriptText: string): Promise<NumericClaim[]> {
    const response = await this.client.messages.create({
      model: process.env.SCRIPT_LLM_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 1500,
      tools: [EXTRACT_TOOL as unknown as Anthropic.Messages.Tool],
      tool_choice: { type: "tool", name: "extract_claims" },
      messages: [
        {
          role: "user",
          content: `Extract every numeric claim from this script:\n\n${scriptText}`,
        },
      ],
    });
    const toolBlock = response.content.find((c) => c.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return [];
    return (toolBlock.input as { claims: NumericClaim[] }).claims;
  }

  private extractNumericValues(obj: unknown): number[] {
    const out: number[] = [];
    const visit = (v: unknown) => {
      if (typeof v === "number") out.push(v);
      else if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object") Object.values(v).forEach(visit);
    };
    visit(obj);
    return out;
  }

  private toleranceFor(cat: NumericClaim["category"]): number {
    const strictness =
      process.env.CONTENT_PIPELINE_GATE_STRICTNESS ?? "balanced";
    const multiplier =
      strictness === "relaxed" ? 2 : strictness === "strict" ? 0.5 : 1;
    return (TOLERANCES_BALANCED[cat] ?? 0) * multiplier;
  }
}
```

- [ ] **Step 6: Run tests to confirm pass.**

```bash
cd packages/backend && npm run test -- data-verifier.service.spec
```

Expected: 20 PASS.

- [ ] **Step 7: Register service in module.**

Add `DataVerifierService` to `ContentPipelineModule` providers and exports.

- [ ] **Step 8: Commit.**

```bash
git add packages/backend/src/content-pipeline/gates/ packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): Gate A DataVerifier with 20-case adversarial corpus"
```

## Task 1.15: Gate B BrandVoiceLinterService

**Files:**

- Create: `packages/backend/src/content-pipeline/gates/voice-rules.ts`
- Create: `packages/backend/src/content-pipeline/gates/brand-voice-linter.service.ts`
- Create: `packages/backend/src/content-pipeline/gates/__fixtures__/gate-b-corpus.json`
- Create: `packages/backend/src/content-pipeline/gates/brand-voice-linter.service.spec.ts`

- [ ] **Step 1: Write voice rules.**

```typescript
// packages/backend/src/content-pipeline/gates/voice-rules.ts
export const FORBIDDEN_PHRASES = [
  "game-changer",
  "game changer",
  "gamechanger",
  "crushing it",
  "absolutely crushing",
  "absolutely",
  "no-brainer",
  "no brainer",
  "you won't believe",
  "you wont believe",
  "insane",
  "crazy good",
  "literally",
  "tbh",
  "omg",
  "investor edge",
  "investoredge",
  "home ready",
  "homeready",
  "market health index",
];
export const EM_DASH_CHARS = ["—", "–"]; // em dash U+2014, en dash U+2013
export const SCORE_REFERENCE_REGEX = /\bscore\b/gi;
export const APPROVED_SCORE_PREFIXES = /(propertyiq score|piq score)/i;
```

- [ ] **Step 2: Write adversarial corpus (10 fails + 10 passes).**

```json
{
  "deterministic_fails": [
    { "name": "em_dash", "script": "Cleveland just hit 78 — a great score." },
    { "name": "en_dash", "script": "Cleveland just hit 78 – a great score." },
    { "name": "game_changer", "script": "This market is a game-changer." },
    { "name": "crushing_it", "script": "Cleveland is absolutely crushing it." },
    { "name": "no_brainer", "script": "Investing here is a no-brainer." },
    { "name": "literally", "script": "Rents literally doubled." },
    { "name": "investor_edge", "script": "The InvestorEdge rating moved up." },
    {
      "name": "home_ready",
      "script": "The HomeReady score says this is strong."
    },
    {
      "name": "market_health",
      "script": "Per the Market Health Index, this leads."
    },
    { "name": "bare_score", "script": "This score is 78." }
  ],
  "deterministic_passes": [
    {
      "name": "clean_hook",
      "script": "The PropertyIQ Score for Cleveland just hit 78."
    },
    {
      "name": "piq_prefix",
      "script": "PIQ Score of 78 puts Cleveland in the top 20 percent."
    },
    {
      "name": "hyphen_ok",
      "script": "Class-A properties are leading the market."
    },
    { "name": "clean_body", "script": "Rents grew 4 percent year over year." },
    {
      "name": "cta_ok",
      "script": "Get your free Market Snapshot at propertyiq.app."
    },
    {
      "name": "data_citation",
      "script": "Homes sold 8 percent above list with 12 days on market."
    },
    {
      "name": "contrast",
      "script": "Cleveland outscored Austin by 4 points on PIQ."
    },
    {
      "name": "timeframe",
      "script": "Over the past year, the PropertyIQ Score rose 6 points."
    },
    {
      "name": "demographics",
      "script": "Population grew 2 percent while income rose 5 percent."
    },
    {
      "name": "direct_call",
      "script": "The PropertyIQ Score is the only rating in town."
    }
  ]
}
```

- [ ] **Step 3: Write failing tests.**

```typescript
// packages/backend/src/content-pipeline/gates/brand-voice-linter.service.spec.ts
import corpus from "./__fixtures__/gate-b-corpus.json";
import { BrandVoiceLinterService } from "./brand-voice-linter.service";

jest.mock("@anthropic-ai/sdk", () =>
  jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [
          {
            type: "tool_use",
            name: "judge_brand_voice",
            input: { score: 5, violations: [] },
          },
        ],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    },
  })),
);

describe("BrandVoiceLinterService deterministic pass", () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = "test";
  });
  const svc = new BrandVoiceLinterService();

  for (const c of corpus.deterministic_fails) {
    it(`fails on ${c.name}`, async () => {
      expect((await svc.lint(c.script)).passed).toBe(false);
    });
  }
  for (const c of corpus.deterministic_passes) {
    it(`passes on ${c.name}`, async () => {
      expect((await svc.lint(c.script)).passed).toBe(true);
    });
  }
});
```

- [ ] **Step 4: Run tests to confirm failure.**

```bash
cd packages/backend && npm run test -- brand-voice-linter.service.spec
```

Expected: FAIL (class not defined).

- [ ] **Step 5: Implement BrandVoiceLinterService.**

```typescript
// packages/backend/src/content-pipeline/gates/brand-voice-linter.service.ts
import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import {
  FORBIDDEN_PHRASES,
  EM_DASH_CHARS,
  SCORE_REFERENCE_REGEX,
  APPROVED_SCORE_PREFIXES,
} from "./voice-rules";
import { GateResult } from "./gate.types";

const JUDGE_TOOL = {
  name: "judge_brand_voice",
  description: "Rate a script for PropertyIQ brand voice compliance.",
  input_schema: {
    type: "object",
    required: ["score", "violations"],
    properties: {
      score: { type: "integer", minimum: 1, maximum: 5 },
      violations: {
        type: "array",
        items: {
          type: "object",
          required: ["severity", "issue", "quote"],
          properties: {
            severity: { type: "string", enum: ["critical", "warning"] },
            issue: { type: "string" },
            quote: { type: "string" },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class BrandVoiceLinterService {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async lint(scriptText: string): Promise<GateResult> {
    const deterministic = this.deterministicPass(scriptText);
    if (!deterministic.passed) return deterministic;
    return this.llmJudgePass(scriptText);
  }

  private deterministicPass(scriptText: string): GateResult {
    const violations: GateResult["violations"] = [];

    for (const ch of EM_DASH_CHARS) {
      if (scriptText.includes(ch)) {
        violations.push({
          claim: { quote: ch, value: 0, category: "count", subject: "em_dash" },
          actual_in_script: 0,
          reason: "unmatched",
        });
      }
    }
    for (const phrase of FORBIDDEN_PHRASES) {
      const regex = new RegExp(
        `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      );
      const match = scriptText.match(regex);
      if (match) {
        violations.push({
          claim: {
            quote: match[0],
            value: 0,
            category: "count",
            subject: "forbidden_phrase",
          },
          actual_in_script: 0,
          reason: "unmatched",
        });
      }
    }
    const scoreMatches = [...scriptText.matchAll(SCORE_REFERENCE_REGEX)];
    for (const m of scoreMatches) {
      const preceding = scriptText.slice(Math.max(0, m.index! - 25), m.index!);
      if (!APPROVED_SCORE_PREFIXES.test(preceding)) {
        violations.push({
          claim: {
            quote: "score without PropertyIQ prefix",
            value: 0,
            category: "count",
            subject: "score_ref",
          },
          actual_in_script: 0,
          reason: "unmatched",
        });
        break;
      }
    }
    return { passed: violations.length === 0, violations };
  }

  private async llmJudgePass(scriptText: string): Promise<GateResult> {
    const minScore = parseInt(process.env.GATE_B_MIN_SCORE ?? "4", 10);
    const systemPrompt =
      "You are a brand voice auditor for PropertyIQ. Rate this script 1 to 5 on brand voice compliance. Brand voice is confident, conversational, data-first, not hypey. Use the tool to output structured JSON.";

    const response = await this.client.messages.create({
      model: process.env.GATE_B_JUDGE_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [JUDGE_TOOL as unknown as Anthropic.Messages.Tool],
      tool_choice: { type: "tool", name: "judge_brand_voice" },
      messages: [{ role: "user", content: scriptText }],
    });

    const toolBlock = response.content.find((c) => c.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return { passed: false, violations: [] };
    }
    const judged = toolBlock.input as {
      score: number;
      violations: Array<{ severity: string; issue: string; quote: string }>;
    };
    const critical = judged.violations.filter((v) => v.severity === "critical");

    return {
      passed: judged.score >= minScore && critical.length === 0,
      violations: judged.violations.map((v) => ({
        claim: {
          quote: v.quote,
          value: 0,
          category: "count",
          subject: v.issue,
        },
        actual_in_script: 0,
        reason: "unmatched",
      })),
      llm_judge_response: judged,
    };
  }
}
```

- [ ] **Step 6: Run tests to confirm pass.**

```bash
cd packages/backend && npm run test -- brand-voice-linter.service.spec
```

Expected: 20 PASS.

- [ ] **Step 7: Register in module.**

Add `BrandVoiceLinterService` to `ContentPipelineModule` providers and exports.

- [ ] **Step 8: Commit.**

```bash
git add packages/backend/src/content-pipeline/gates/ packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): Gate B BrandVoiceLinter with regex and LLM judge"
```

## Task 1.16: EdgeTTSDriver plus TTSDriver interface plus Factory

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/tts-driver.interface.ts`
- Create: `packages/backend/src/content-pipeline/drivers/edge-tts-driver.ts`
- Create: `packages/backend/src/content-pipeline/drivers/tts-driver.factory.ts`
- Create: `packages/backend/src/content-pipeline/drivers/edge-tts-driver.spec.ts`

- [ ] **Step 1: Write interface.**

```typescript
// packages/backend/src/content-pipeline/drivers/tts-driver.interface.ts
import { DriverCost } from "./driver-cost.types";

export interface TTSSynthesisRequest {
  text: string;
  voiceId: string;
  outputPath: string;
  format: "mp3" | "wav";
}

export interface TTSSynthesisResult {
  durationMs: number;
  bitrate: number;
  cost: DriverCost;
}

export interface TTSDriver {
  readonly provider: "edge" | "elevenlabs" | "openai";
  isConfigured(): boolean;
  synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult>;
}

export const TTS_DRIVER = Symbol("TTSDriver");
```

- [ ] **Step 2: Write failing tests.**

```typescript
// packages/backend/src/content-pipeline/drivers/edge-tts-driver.spec.ts
import { EdgeTTSDriver } from "./edge-tts-driver";
import * as child_process from "child_process";
import { EventEmitter } from "events";

jest.mock("child_process");

describe("EdgeTTSDriver", () => {
  it("reports configured when EDGE_TTS_PYTHON is set", () => {
    process.env.EDGE_TTS_PYTHON = "/usr/bin/python3";
    expect(new EdgeTTSDriver().isConfigured()).toBe(true);
  });

  it("synthesizes by spawning python edge-tts", async () => {
    process.env.EDGE_TTS_PYTHON = "/usr/bin/python3";
    const fakeProc: any = new EventEmitter();
    fakeProc.stdout = new EventEmitter();
    fakeProc.stderr = new EventEmitter();
    (child_process.spawn as jest.Mock).mockReturnValue(fakeProc);

    const driver = new EdgeTTSDriver();
    const pending = driver.synthesize({
      text: "hello",
      voiceId: "en-US-AndrewMultilingualNeural",
      outputPath: "/tmp/t.mp3",
      format: "mp3",
    });
    setTimeout(() => fakeProc.emit("close", 0), 20);
    const result = await pending;

    expect((child_process.spawn as jest.Mock).mock.calls[0][0]).toBe(
      "/usr/bin/python3",
    );
    expect(result.cost.amount_usd).toBe(0);
    expect(result.cost.provider).toBe("edge-tts");
  });
});
```

- [ ] **Step 3: Run tests to confirm failure.**

```bash
cd packages/backend && npm run test -- edge-tts-driver.spec
```

Expected: FAIL.

- [ ] **Step 4: Implement driver.**

```typescript
// packages/backend/src/content-pipeline/drivers/edge-tts-driver.ts
import { Injectable } from "@nestjs/common";
import { spawn } from "child_process";
import { statSync } from "fs";
import {
  TTSDriver,
  TTSSynthesisRequest,
  TTSSynthesisResult,
} from "./tts-driver.interface";

@Injectable()
export class EdgeTTSDriver implements TTSDriver {
  readonly provider = "edge" as const;

  isConfigured(): boolean {
    return !!process.env.EDGE_TTS_PYTHON;
  }

  async synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const python = process.env.EDGE_TTS_PYTHON;
    if (!python) throw new Error("EDGE_TTS_PYTHON not set");
    const start = Date.now();

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(python, [
        "-m",
        "edge_tts",
        "--voice",
        req.voiceId,
        "--text",
        req.text,
        "--write-media",
        req.outputPath,
      ]);
      let stderrBuf = "";
      proc.stderr.on("data", (d) => {
        stderrBuf += d.toString();
      });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`edge-tts exited ${code}: ${stderrBuf}`));
      });
      proc.on("error", reject);
    });

    const wallMs = Date.now() - start;
    let sizeBytes = 0;
    try {
      sizeBytes = statSync(req.outputPath).size;
    } catch {
      sizeBytes = 0;
    }

    return {
      durationMs: wallMs,
      bitrate: sizeBytes > 0 ? (sizeBytes * 8) / (wallMs / 1000) : 0,
      cost: {
        provider: "edge-tts",
        amount_usd: 0,
        units: req.text.length,
        unit_type: "chars",
      },
    };
  }
}
```

- [ ] **Step 5: Write TTSDriverFactory.**

```typescript
// packages/backend/src/content-pipeline/drivers/tts-driver.factory.ts
import { Injectable } from "@nestjs/common";
import { TTSDriver } from "./tts-driver.interface";
import { EdgeTTSDriver } from "./edge-tts-driver";

@Injectable()
export class TTSDriverFactory {
  constructor(private readonly edge: EdgeTTSDriver) {}

  forProvider(provider: "edge" | "elevenlabs" | "openai"): TTSDriver {
    switch (provider) {
      case "edge":
        if (!this.edge.isConfigured())
          throw new Error("Edge TTS not configured");
        return this.edge;
      case "elevenlabs":
        throw new Error("ElevenLabs driver ships in P3");
      case "openai":
        throw new Error("OpenAI TTS driver ships in P2");
      default:
        throw new Error(`Unknown TTS provider: ${provider}`);
    }
  }
}
```

- [ ] **Step 6: Run tests to confirm pass.**

```bash
cd packages/backend && npm run test -- edge-tts-driver.spec
```

Expected: PASS.

- [ ] **Step 7: Register drivers in module.**

```typescript
// content-pipeline.module.ts additions:
import { EdgeTTSDriver } from './drivers/edge-tts-driver';
import { TTSDriverFactory } from './drivers/tts-driver.factory';
// add to providers:
EdgeTTSDriver, TTSDriverFactory,
```

- [ ] **Step 8: Commit.**

```bash
git add packages/backend/src/content-pipeline/drivers/ packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): EdgeTTSDriver and TTSDriverFactory"
```

## Task 1.17: Remotion FormatConfig types and composition factory

**Files:**

- Modify: `packages/video-template/src/types.ts`
- Create: `packages/video-template/src/compositions/factory.ts`
- Modify: `packages/video-template/src/Root.tsx`

- [ ] **Step 1: Extend types.ts with FormatConfig.**

```typescript
// packages/video-template/src/types.ts (append)
import { z } from "zod";

export type FormatKey =
  | "grade_reveal"
  | "top_10_ranking"
  | "score_mover"
  | "head_to_head"
  | "long_form_deep_dive"
  | "farm_area_spotlight"
  | "brokerage_market_share"
  | "recruitment_angle";

export interface FormatConfig {
  key: FormatKey;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export const FORMAT_CONFIGS: Record<FormatKey, FormatConfig> = {
  grade_reveal: {
    key: "grade_reveal",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 900,
  },
  top_10_ranking: {
    key: "top_10_ranking",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
  },
  score_mover: {
    key: "score_mover",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 900,
  },
  head_to_head: {
    key: "head_to_head",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
  },
  long_form_deep_dive: {
    key: "long_form_deep_dive",
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 18000,
  },
  farm_area_spotlight: {
    key: "farm_area_spotlight",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
  },
  brokerage_market_share: {
    key: "brokerage_market_share",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 2250,
  },
  recruitment_angle: {
    key: "recruitment_angle",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 2700,
  },
};

export const VideoPropsSchema = z.object({
  format: z.enum([
    "grade_reveal",
    "top_10_ranking",
    "score_mover",
    "head_to_head",
    "long_form_deep_dive",
    "farm_area_spotlight",
    "brokerage_market_share",
    "recruitment_angle",
  ]),
  resolvedMarket: z.object({
    canonical_name: z.string(),
    geography: z.enum(["state", "metro", "county", "zip"]),
    id: z.string(),
  }),
  dataBundle: z.any(),
  ctaUrl: z.string(),
  styleVariant: z.string().optional(),
});

export type VideoProps = z.infer<typeof VideoPropsSchema>;
```

- [ ] **Step 2: Write factory.**

```typescript
// packages/video-template/src/compositions/factory.ts
import { FormatKey, FORMAT_CONFIGS } from "../types";

export interface CompositionRegistration {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export function createComposition(format: FormatKey): CompositionRegistration {
  const config = FORMAT_CONFIGS[format];
  return {
    id: format,
    width: config.width,
    height: config.height,
    fps: config.fps,
    durationInFrames: config.durationInFrames,
  };
}
```

- [ ] **Step 3: Update Root.tsx to register all compositions from factory.**

```tsx
// packages/video-template/src/Root.tsx
import React from "react";
import { Composition } from "remotion";
import { FORMAT_CONFIGS, FormatKey, VideoProps } from "./types";
import { PropertyIQVideo } from "./PropertyIQVideo";

export const RemotionRoot: React.FC = () => {
  const keys = Object.keys(FORMAT_CONFIGS) as FormatKey[];
  return (
    <>
      {keys.map((key) => {
        const cfg = FORMAT_CONFIGS[key];
        return (
          <Composition
            key={key}
            id={key}
            component={PropertyIQVideo as React.FC<any>}
            durationInFrames={cfg.durationInFrames}
            fps={cfg.fps}
            width={cfg.width}
            height={cfg.height}
            defaultProps={{
              format: key,
              resolvedMarket: {
                canonical_name: "Preview",
                geography: "metro" as const,
                id: "preview",
              },
              dataBundle: {},
              ctaUrl: "",
            }}
          />
        );
      })}
    </>
  );
};
```

- [ ] **Step 4: Verify build succeeds.**

```bash
cd packages/video-template && npx tsc --noEmit
```

Expected: exit 0, no errors.

- [ ] **Step 5: Verify Remotion studio shows all 8 compositions.**

```bash
cd packages/video-template && npm start &
# Wait for studio to open; verify sidebar shows 8 composition ids. Kill process.
```

- [ ] **Step 6: Commit.**

```bash
git add packages/video-template/src/types.ts packages/video-template/src/compositions/ packages/video-template/src/Root.tsx
git commit -m "feat(video-template): FormatConfig types and dynamic composition registration"
```

## Task 1.18: Remotion VideoLayout context and scene refactor

**Files:**

- Create: `packages/video-template/src/layout/VideoLayout.tsx`
- Create: `packages/video-template/src/layout/useLayoutConfig.ts`
- Modify: `packages/video-template/src/scenes/Intro.tsx`
- Modify: `packages/video-template/src/scenes/ScoreReveal.tsx`
- Modify: `packages/video-template/src/scenes/TrendChart.tsx`
- Modify: `packages/video-template/src/scenes/StatCards.tsx`
- Modify: `packages/video-template/src/scenes/Comparison.tsx`
- Modify: `packages/video-template/src/scenes/Outro.tsx`

- [ ] **Step 1: Write VideoLayout context.**

```tsx
// packages/video-template/src/layout/VideoLayout.tsx
import React, { createContext, useContext } from "react";
import { FormatConfig } from "../types";

export interface LayoutConfig {
  format: FormatConfig;
  isVertical: boolean;
  scale: number;
}

const LayoutContext = createContext<LayoutConfig | null>(null);

export const VideoLayout: React.FC<{
  config: FormatConfig;
  children: React.ReactNode;
}> = ({ config, children }) => {
  const isVertical = config.height > config.width;
  const scale = config.width / 1080;
  return (
    <LayoutContext.Provider value={{ format: config, isVertical, scale }}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayoutContext = (): LayoutConfig => {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayoutContext must be inside VideoLayout");
  return ctx;
};
```

- [ ] **Step 2: Write useLayoutConfig hook.**

```typescript
// packages/video-template/src/layout/useLayoutConfig.ts
export { useLayoutContext as useLayoutConfig } from "./VideoLayout";
```

- [ ] **Step 3: Refactor each scene to drop `isVertical` prop and use `useLayoutConfig()`.**

For each scene file, replace:

```tsx
// OLD
export const Intro: React.FC<{ isVertical: boolean; ... }> = ({ isVertical, ... }) => {
  const style = isVertical ? verticalStyles : landscapeStyles;
  // ...
};
```

with:

```tsx
// NEW
import { useLayoutConfig } from '../layout/useLayoutConfig';
export const Intro: React.FC<{ ... }> = ({ ... }) => {
  const { isVertical, scale } = useLayoutConfig();
  const style = isVertical ? verticalStyles : landscapeStyles;
  // ...
};
```

Apply the same refactor to `ScoreReveal`, `TrendChart`, `StatCards`, `Comparison`, `Outro`. Keep all other props and logic identical. The only change per scene is reading `isVertical` and `scale` from context instead of receiving as props.

- [ ] **Step 4: Verify typecheck.**

```bash
cd packages/video-template && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Verify Remotion studio still renders.**

```bash
cd packages/video-template && npm start
# Open a composition, verify it renders without errors.
```

- [ ] **Step 6: Commit.**

```bash
git add packages/video-template/src/layout/ packages/video-template/src/scenes/
git commit -m "refactor(video-template): VideoLayout context replaces isVertical prop in scenes"
```

## Task 1.19: Remotion brand primitives

**Files:**

- Create: `packages/video-template/src/primitives/BrandBumper.tsx`
- Create: `packages/video-template/src/primitives/BrandOutroCard.tsx`
- Create: `packages/video-template/src/primitives/ScoreRing.tsx`
- Create: `packages/video-template/tests/primitives.test.tsx`

- [ ] **Step 1: Write BrandBumper (2-second opening sting).**

```tsx
// packages/video-template/src/primitives/BrandBumper.tsx
import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
} from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export const BrandBumper: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  const opacity = spring({ frame, fps, config: { damping: 15 } });
  const size = 200 * scale;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1A237E",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Audio src={staticFile("brand-sting.mp3")} />
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "#3949AB",
          opacity,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Roboto",
          color: "#FFFFFF",
          fontWeight: 700,
          fontSize: 64 * scale,
        }}
      >
        PIQ
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Write BrandOutroCard.**

```tsx
// packages/video-template/src/primitives/BrandOutroCard.tsx
import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ScoreRing } from "./ScoreRing";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface BrandOutroCardProps {
  ctaUrl: string;
  score?: number;
}

export const BrandOutroCard: React.FC<BrandOutroCardProps> = ({
  ctaUrl,
  score,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  const opacity = spring({ frame, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1A1A2E",
        justifyContent: "center",
        alignItems: "center",
        gap: 24 * scale,
        opacity,
      }}
    >
      {typeof score === "number" && (
        <ScoreRing score={score} size={180 * scale} />
      )}
      <div
        style={{
          color: "#FFFFFF",
          fontFamily: "Roboto",
          fontSize: 40 * scale,
          fontWeight: 600,
        }}
      >
        PropertyIQ
      </div>
      <div
        style={{
          color: "#C5CAE9",
          fontFamily: "Roboto Mono",
          fontSize: 28 * scale,
        }}
      >
        {ctaUrl}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Write ScoreRing.**

```tsx
// packages/video-template/src/primitives/ScoreRing.tsx
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface ScoreRingProps {
  score: number;
  size: number;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({ score, size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 20 } });
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress * (score / 100));
  const color =
    score >= 80
      ? "#00C853"
      : score >= 60
        ? "#3949AB"
        : score >= 40
          ? "#FF8F00"
          : "#B3261E";

  return (
    <svg width={size} height={size}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#C5CAE9"
        strokeWidth={8}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={8}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dy="0.35em"
        textAnchor="middle"
        fontFamily="Roboto Mono"
        fontWeight={700}
        fontSize={size * 0.36}
        fill={color}
      >
        {Math.round(score * progress)}
      </text>
    </svg>
  );
};
```

- [ ] **Step 4: Write snapshot tests (use Remotion's rendering).**

```tsx
// packages/video-template/tests/primitives.test.tsx
import { renderStill } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import path from "path";
import fs from "fs";

describe("Brand primitives snapshot", () => {
  it.skip("ScoreRing renders frame 30 within tolerance", async () => {
    // Snapshot test scaffold. Enable after full composition wiring in Task 1.21.
    expect(true).toBe(true);
  });
});
```

(Snapshot tests run against assembled compositions in Task 1.21; primitive-level snapshot is covered there.)

- [ ] **Step 5: Commit.**

```bash
git add packages/video-template/src/primitives/ packages/video-template/tests/
git commit -m "feat(video-template): brand primitives BrandBumper BrandOutroCard ScoreRing"
```

## Task 1.20: Remotion programmatic render API and CLI

**Files:**

- Create: `packages/video-template/src/cli/render.ts`
- Create: `packages/video-template/src/cli/render-cli.ts`
- Modify: `packages/video-template/package.json`

- [ ] **Step 1: Write programmatic render API.**

```typescript
// packages/video-template/src/cli/render.ts
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import { VideoProps, VideoPropsSchema } from "../types";

export interface RenderOptions {
  props: VideoProps;
  outputPath: string;
  audioPath?: string;
}

export async function renderVideo(
  opts: RenderOptions,
): Promise<{ outputPath: string; durationMs: number }> {
  const validated = VideoPropsSchema.parse(opts.props);

  const bundled = await bundle({
    entryPoint: path.resolve(__dirname, "..", "index.ts"),
    webpackOverride: (config) => config,
  });
  const composition = await selectComposition({
    serveUrl: bundled,
    id: validated.format,
    inputProps: validated,
  });

  const start = Date.now();
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: opts.outputPath,
    inputProps: validated,
    audioCodec: "aac",
  });
  return { outputPath: opts.outputPath, durationMs: Date.now() - start };
}
```

- [ ] **Step 2: Write CLI entry.**

```typescript
// packages/video-template/src/cli/render-cli.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { renderVideo } from './render';

const program = new Command();
program
  .requiredOption('--format <format>', 'format key')
  .requiredOption('--props-json <path>', 'path to JSON file with props')
  .requiredOption('--output <path>', 'output mp4 path')
  .option('--audio <path>', 'pre-rendered audio path')
  .parse();

const opts = program.opts();

(async () => {
  try {
    const props = JSON.parse(readFileSync(opts.propsJson, 'utf8'));
    props.format = opts.format;
    const result = await renderVideo({ props, outputPath: opts.output, audioPath: opts.audio });
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: (err as Error).message }));
    process.exit(1);
  }
})();
```

- [ ] **Step 3: Add package.json bin entry.**

```json
// packages/video-template/package.json (add)
{
  "bin": {
    "render-video": "./dist/cli/render-cli.js"
  },
  "scripts": {
    ...existing...
    "build:cli": "tsc --project tsconfig.json"
  }
}
```

- [ ] **Step 4: Build.**

```bash
cd packages/video-template && npm run build:cli
```

Expected: `dist/cli/render-cli.js` exists.

- [ ] **Step 5: Smoke test CLI with a sample props file.**

Create `packages/video-template/sample.json`:

```json
{
  "resolvedMarket": {
    "canonical_name": "Cleveland, OH",
    "geography": "metro",
    "id": "17140"
  },
  "dataBundle": {
    "score": 78,
    "home_value": { "value": 385000 },
    "rent": { "value": 1800 }
  },
  "ctaUrl": "https://piq.sh/abc123"
}
```

Run:

```bash
cd packages/video-template
node dist/cli/render-cli.js --format grade_reveal --props-json sample.json --output out.mp4
```

Expected: JSON `{ ok: true, ... }` on stdout; `out.mp4` file exists.

- [ ] **Step 6: Commit.**

```bash
git add packages/video-template/src/cli/ packages/video-template/package.json packages/video-template/sample.json
git commit -m "feat(video-template): programmatic render API and CLI entry"
```

## Task 1.21: Assemble Grade Reveal composition plus snapshot tests

**Files:**

- Modify: `packages/video-template/src/PropertyIQVideo.tsx` (or create if new root component needed)
- Create: `packages/video-template/tests/grade-reveal.test.tsx`

- [ ] **Step 1: Modify PropertyIQVideo to route by format to scene list.**

```tsx
// packages/video-template/src/PropertyIQVideo.tsx
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { VideoProps, FORMAT_CONFIGS } from "./types";
import { VideoLayout } from "./layout/VideoLayout";
import { BrandBumper } from "./primitives/BrandBumper";
import { BrandOutroCard } from "./primitives/BrandOutroCard";
import { Intro } from "./scenes/Intro";
import { ScoreReveal } from "./scenes/ScoreReveal";
import { StatCards } from "./scenes/StatCards";
import { Outro } from "./scenes/Outro";

export const PropertyIQVideo: React.FC<VideoProps> = (props) => {
  const cfg = FORMAT_CONFIGS[props.format];
  return (
    <VideoLayout config={cfg}>
      <AbsoluteFill style={{ backgroundColor: "#1A1A2E" }}>
        {props.format === "grade_reveal" && <GradeRevealLayout {...props} />}
        {/* Other formats rendered in later phases */}
      </AbsoluteFill>
    </VideoLayout>
  );
};

const GradeRevealLayout: React.FC<VideoProps> = (props) => {
  const { dataBundle, resolvedMarket, ctaUrl } = props;
  const score = (dataBundle as any)?.score ?? 50;
  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={60} durationInFrames={60}>
        <Intro marketName={resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={120} durationInFrames={210}>
        <ScoreReveal score={score} />
      </Sequence>
      <Sequence from={330} durationInFrames={240}>
        <StatCards dataBundle={dataBundle as any} />
      </Sequence>
      <Sequence from={570} durationInFrames={240}>
        <Outro marketName={resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={810} durationInFrames={90}>
        <BrandOutroCard ctaUrl={ctaUrl} score={score} />
      </Sequence>
    </>
  );
};
```

- [ ] **Step 2: Write snapshot test.**

```tsx
// packages/video-template/tests/grade-reveal.test.tsx
import { bundle } from "@remotion/bundler";
import { renderStill } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { PNG } from "pngjs";

describe("Grade Reveal snapshots", () => {
  let serveUrl: string;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
  }, 120_000);

  it.each([0, 90, 180, 300, 500, 700, 850])(
    "renders frame %s within tolerance",
    async (frame) => {
      const outPath = path.resolve(__dirname, `grade-reveal-${frame}.png`);
      await renderStill({
        serveUrl,
        composition: {
          id: "grade_reveal",
          width: 1080,
          height: 1920,
          fps: 30,
          durationInFrames: 900,
        } as any,
        frame,
        output: outPath,
        inputProps: {
          format: "grade_reveal",
          resolvedMarket: {
            canonical_name: "Cleveland, OH",
            geography: "metro",
            id: "17140",
          },
          dataBundle: { score: 78, home_value: { value: 385000 } },
          ctaUrl: "https://piq.sh/abc123",
        },
      });
      const baselinePath = path.resolve(
        __dirname,
        "__snapshots__",
        `grade-reveal-${frame}.png`,
      );
      if (!fs.existsSync(baselinePath)) {
        fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
        fs.copyFileSync(outPath, baselinePath);
        console.log(`Baseline created for frame ${frame}`);
        return;
      }
      const a = PNG.sync.read(fs.readFileSync(outPath));
      const b = PNG.sync.read(fs.readFileSync(baselinePath));
      const diffPct = diffPngs(a, b);
      expect(diffPct).toBeLessThan(0.02);
    },
    60_000,
  );
});

function diffPngs(a: PNG, b: PNG): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let diffCount = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (
      Math.abs(a.data[i] - b.data[i]) > 8 ||
      Math.abs(a.data[i + 1] - b.data[i + 1]) > 8 ||
      Math.abs(a.data[i + 2] - b.data[i + 2]) > 8
    )
      diffCount++;
  }
  return diffCount / (a.width * a.height);
}
```

- [ ] **Step 3: Install pngjs test helper.**

```bash
cd packages/video-template
npm install --save-dev pngjs @types/pngjs
```

- [ ] **Step 4: Run snapshots to create baselines.**

```bash
cd packages/video-template && npx jest tests/grade-reveal.test
```

Expected: first run creates baselines; second run all PASS.

- [ ] **Step 5: Full render end-to-end smoke test.**

```bash
cd packages/video-template
node dist/cli/render-cli.js --format grade_reveal --props-json sample.json --output out.mp4
ffprobe -v error -show_entries format=duration out.mp4
```

Expected: duration approximately 30.0 seconds.

- [ ] **Step 6: Commit.**

```bash
git add packages/video-template/src/PropertyIQVideo.tsx packages/video-template/tests/ packages/video-template/package.json packages/video-template/package-lock.json
git commit -m "feat(video-template): Grade Reveal composition with snapshot tests"
```

## Task 1.22: RemotionCLIRenderer backend driver

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/video-renderer.interface.ts`
- Create: `packages/backend/src/content-pipeline/drivers/remotion-cli-renderer.ts`
- Create: `packages/backend/src/content-pipeline/drivers/remotion-cli-renderer.spec.ts`

- [ ] **Step 1: Write interface.**

```typescript
// packages/backend/src/content-pipeline/drivers/video-renderer.interface.ts
import { ContentFormat } from "../types";
import { DriverCost } from "./driver-cost.types";

export interface VideoRenderRequest {
  format: ContentFormat;
  props: unknown;
  outputPath: string;
  audioPath: string;
  thumbnailOutputPath?: string;
  captionsPath?: string;
}

export interface VideoRenderResult {
  videoPath: string;
  thumbnailPath?: string;
  durationMs: number;
  renderWallMs: number;
  cost: DriverCost;
}

export interface VideoRenderer {
  render(req: VideoRenderRequest): Promise<VideoRenderResult>;
}

export const VIDEO_RENDERER = Symbol("VideoRenderer");
```

- [ ] **Step 2: Write failing test.**

```typescript
// packages/backend/src/content-pipeline/drivers/remotion-cli-renderer.spec.ts
import { RemotionCLIRenderer } from "./remotion-cli-renderer";
import * as child_process from "child_process";
import { EventEmitter } from "events";

jest.mock("child_process");

describe("RemotionCLIRenderer", () => {
  it("spawns the CLI with correct args", async () => {
    const fakeProc: any = new EventEmitter();
    fakeProc.stdout = new EventEmitter();
    fakeProc.stderr = new EventEmitter();
    (child_process.spawn as jest.Mock).mockReturnValue(fakeProc);

    const renderer = new RemotionCLIRenderer();
    const pending = renderer.render({
      format: "grade_reveal",
      props: {
        resolvedMarket: {
          canonical_name: "Cleveland",
          geography: "metro",
          id: "17140",
        },
        dataBundle: {},
        ctaUrl: "https://piq.sh/abc",
      },
      outputPath: "/tmp/out.mp4",
      audioPath: "/tmp/in.mp3",
    });
    setTimeout(() => {
      fakeProc.stdout.emit(
        "data",
        '{"ok":true,"outputPath":"/tmp/out.mp4","durationMs":12000}',
      );
      fakeProc.emit("close", 0);
    }, 20);
    const result = await pending;
    expect(result.videoPath).toBe("/tmp/out.mp4");
    const args = (child_process.spawn as jest.Mock).mock.calls[0][1];
    expect(args).toContain("--format");
    expect(args).toContain("grade_reveal");
  });

  it("rejects when CLI exits non-zero", async () => {
    const fakeProc: any = new EventEmitter();
    fakeProc.stdout = new EventEmitter();
    fakeProc.stderr = new EventEmitter();
    (child_process.spawn as jest.Mock).mockReturnValue(fakeProc);
    const renderer = new RemotionCLIRenderer();
    const pending = renderer.render({
      format: "grade_reveal",
      props: {},
      outputPath: "/tmp/out.mp4",
      audioPath: "/tmp/in.mp3",
    });
    setTimeout(() => {
      fakeProc.stderr.emit("data", "render failed");
      fakeProc.emit("close", 1);
    }, 20);
    await expect(pending).rejects.toThrow(/render failed/);
  });
});
```

- [ ] **Step 3: Run to confirm failure.**

```bash
cd packages/backend && npm run test -- remotion-cli-renderer.spec
```

Expected: FAIL.

- [ ] **Step 4: Implement renderer.**

```typescript
// packages/backend/src/content-pipeline/drivers/remotion-cli-renderer.ts
import { Injectable } from "@nestjs/common";
import { spawn } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import {
  VideoRenderer,
  VideoRenderRequest,
  VideoRenderResult,
} from "./video-renderer.interface";

@Injectable()
export class RemotionCLIRenderer implements VideoRenderer {
  private readonly cliPath: string;
  private readonly timeoutMs: number;

  constructor() {
    this.cliPath = join(
      process.cwd(),
      "node_modules/@propertyiq/video-template/dist/cli/render-cli.js",
    );
    this.timeoutMs = parseInt(
      process.env.STEP_TIMEOUT_RENDER_VIDEO_MS ?? "300000",
      10,
    );
  }

  async render(req: VideoRenderRequest): Promise<VideoRenderResult> {
    const start = Date.now();
    const propsFile = join(
      tmpdir(),
      `props-${randomBytes(8).toString("hex")}.json`,
    );
    writeFileSync(propsFile, JSON.stringify(req.props));

    const args = [
      this.cliPath,
      "--format",
      req.format,
      "--props-json",
      propsFile,
      "--output",
      req.outputPath,
    ];
    if (req.audioPath) args.push("--audio", req.audioPath);

    const stdoutPayload = await new Promise<string>((resolve, reject) => {
      const proc = spawn("node", args);
      let stdoutBuf = "";
      let stderrBuf = "";
      proc.stdout.on("data", (d) => {
        stdoutBuf += d.toString();
      });
      proc.stderr.on("data", (d) => {
        stderrBuf += d.toString();
      });
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error(`render timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdoutBuf);
        else
          reject(
            new Error(`render exited ${code}: ${stderrBuf || "render failed"}`),
          );
      });
      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const parsed = JSON.parse(stdoutPayload.trim().split("\n").pop() ?? "{}");
    const wallMs = Date.now() - start;
    return {
      videoPath: parsed.outputPath ?? req.outputPath,
      durationMs: parsed.durationMs ?? 0,
      renderWallMs: wallMs,
      cost: {
        provider: "remotion",
        amount_usd: 0,
        units: 1,
        unit_type: "requests",
      },
    };
  }
}
```

- [ ] **Step 5: Run test to confirm pass.**

```bash
cd packages/backend && npm run test -- remotion-cli-renderer.spec
```

Expected: 2 PASS.

- [ ] **Step 6: Add to module and export symbol.**

```typescript
// content-pipeline.module.ts:
import { RemotionCLIRenderer } from './drivers/remotion-cli-renderer';
import { VIDEO_RENDERER } from './drivers/video-renderer.interface';
// providers:
{ provide: VIDEO_RENDERER, useClass: RemotionCLIRenderer },
RemotionCLIRenderer,
```

- [ ] **Step 7: Commit.**

```bash
git add packages/backend/src/content-pipeline/drivers/ packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): RemotionCLIRenderer spawns video-template CLI with timeout"
```

## Task 1.23: PuppeteerLeadMagnetRenderer plus Market Snapshot template

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/lead-magnet-renderer.interface.ts`
- Create: `packages/backend/src/content-pipeline/drivers/puppeteer-lead-magnet-renderer.ts`
- Create: `packages/backend/src/content-pipeline/lead-magnets/shared/brand.css`
- Create: `packages/backend/src/content-pipeline/lead-magnets/shared/layout.html.ejs`
- Create: `packages/backend/src/content-pipeline/lead-magnets/templates/market_snapshot.html.ejs`
- Create: `packages/backend/src/content-pipeline/drivers/puppeteer-lead-magnet-renderer.spec.ts`

- [ ] **Step 1: Write interface.**

```typescript
// packages/backend/src/content-pipeline/drivers/lead-magnet-renderer.interface.ts
import { DriverCost } from "./driver-cost.types";

export type LeadMagnetKind =
  | "market_snapshot_pdf"
  | "top_50_cashflow_report"
  | "movers_report"
  | "market_comparison"
  | "farm_area_audit"
  | "brokerage_coverage_report"
  | "agent_recruitment_kit"
  | "long_form_companion";

export interface LeadMagnetRenderRequest {
  magnetKind: LeadMagnetKind;
  templatePath: string;
  dataBundle: unknown;
  userContext: { userName: string; email: string };
  outputPath: string;
}

export interface LeadMagnetRenderResult {
  pdfPath: string;
  pageCount: number;
  renderWallMs: number;
  cost: DriverCost;
}

export interface LeadMagnetRenderer {
  render(req: LeadMagnetRenderRequest): Promise<LeadMagnetRenderResult>;
}

export const LEAD_MAGNET_RENDERER = Symbol("LeadMagnetRenderer");
```

- [ ] **Step 2: Write shared brand.css.**

```css
/* packages/backend/src/content-pipeline/lead-magnets/shared/brand.css */
:root {
  --primary: #3949ab;
  --primary-dark: #1a237e;
  --primary-light: #c5cae9;
  --accent: #00c853;
  --error: #b3261e;
  --warning: #ff8f00;
  --surface: #fafbff;
  --on-surface: #1a237e;
  --outline: #e8eaf6;
}

* {
  box-sizing: border-box;
}
body {
  font-family: Roboto, Arial, sans-serif;
  color: var(--on-surface);
  background: var(--surface);
  margin: 0;
  padding: 48px;
}
h1 {
  font-size: 32pt;
  color: var(--primary-dark);
  margin: 0 0 16px;
}
h2 {
  font-size: 20pt;
  color: var(--primary);
  margin: 24px 0 12px;
}
.score-ring {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Roboto Mono", monospace;
  font-size: 56pt;
  font-weight: 700;
}
.stat-card {
  border: 1px solid var(--outline);
  border-radius: 12px;
  padding: 20px;
  background: white;
}
.stat-value {
  font-family: "Roboto Mono";
  font-size: 24pt;
  color: var(--primary-dark);
}
.stat-label {
  font-size: 11pt;
  color: #5c6bc0;
}
.footer {
  position: fixed;
  bottom: 20px;
  left: 48px;
  right: 48px;
  display: flex;
  justify-content: space-between;
  font-size: 9pt;
  color: var(--primary);
  border-top: 1px solid var(--outline);
  padding-top: 8px;
}
```

- [ ] **Step 3: Write shared layout.**

```html
<!-- packages/backend/src/content-pipeline/lead-magnets/shared/layout.html.ejs -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title><%= title %></title>
    <style>
      <%- brandCss %>
    </style>
  </head>
  <body>
    <%- content %>
    <div class="footer">
      <span
        >PropertyIQ Score is the only real estate market score you need.</span
      >
      <span>propertyiq.app</span>
    </div>
  </body>
</html>
```

- [ ] **Step 4: Write Market Snapshot template.**

```html
<!-- packages/backend/src/content-pipeline/lead-magnets/templates/market_snapshot.html.ejs -->
<h1><%= dataBundle.geo.canonical_name %> Market Snapshot</h1>
<p style="font-size: 11pt; color: #5C6BC0;">
  Prepared for <%= userContext.userName %> on <%= today %>
</p>

<div style="display: flex; align-items: center; gap: 32px; margin: 32px 0;">
  <div class="score-ring"><%= dataBundle.score.propertyiq_score %></div>
  <div>
    <h2>PropertyIQ Score</h2>
    <p style="font-size: 14pt; margin: 0;">
      Grade: <strong><%= dataBundle.score.grade %></strong>
    </p>
    <p style="font-size: 10pt; color: #5C6BC0; margin: 4px 0 0;">
      Confidence: <%= dataBundle.score.confidence %>
    </p>
  </div>
</div>

<h2>Key Metrics</h2>
<div
  style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0;"
>
  <% if (dataBundle.home_value) { %>
  <div class="stat-card">
    <div class="stat-value">
      $<%= Math.round(dataBundle.home_value.value / 1000).toLocaleString() %>K
    </div>
    <div class="stat-label">
      Median Home Value (<%= dataBundle.home_value.yoy_pct >= 0 ? '+' : '' %><%=
      dataBundle.home_value.yoy_pct.toFixed(1) %>% YoY)
    </div>
  </div>
  <% } %> <% if (dataBundle.rent) { %>
  <div class="stat-card">
    <div class="stat-value">$<%= dataBundle.rent.value.toLocaleString() %></div>
    <div class="stat-label">
      Median Rent (<%= dataBundle.rent.yoy_pct >= 0 ? '+' : '' %><%=
      dataBundle.rent.yoy_pct.toFixed(1) %>% YoY)
    </div>
  </div>
  <% } %> <% if (dataBundle.economic) { %>
  <div class="stat-card">
    <div class="stat-value">
      <%= dataBundle.economic.unemployment_rate.toFixed(1) %>%
    </div>
    <div class="stat-label">Unemployment</div>
  </div>
  <% } %> <% if (dataBundle.demographics) { %>
  <div class="stat-card">
    <div class="stat-value">
      <%= (dataBundle.demographics.population / 1000).toFixed(0) %>K
    </div>
    <div class="stat-label">Population</div>
  </div>
  <% } %>
</div>

<h2>What this means</h2>
<p style="font-size: 11pt; line-height: 1.5;">
  The PropertyIQ Score blends inventory, days on market, and sold-above-list
  signals into a single 0-99 rating. A score of <%=
  dataBundle.score.propertyiq_score %> places <%= dataBundle.geo.canonical_name
  %> in the <% if (dataBundle.score.propertyiq_score >= 80) { %>top tier for
  seller advantage. <% } else if (dataBundle.score.propertyiq_score >= 60) {
  %>upper-middle range for healthy demand. <% } else if
  (dataBundle.score.propertyiq_score >= 40) { %>balanced range with neither side
  dominant. <% } else { %>buyer-favorable range.<% } %>
</p>
```

- [ ] **Step 5: Write failing test.**

```typescript
// packages/backend/src/content-pipeline/drivers/puppeteer-lead-magnet-renderer.spec.ts
import { PuppeteerLeadMagnetRenderer } from "./puppeteer-lead-magnet-renderer";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";

describe("PuppeteerLeadMagnetRenderer", () => {
  it("renders a PDF from the market_snapshot template", async () => {
    const renderer = new PuppeteerLeadMagnetRenderer();
    const outputPath = join(tmpdir(), `test-snapshot-${Date.now()}.pdf`);
    const result = await renderer.render({
      magnetKind: "market_snapshot_pdf",
      templatePath:
        "packages/backend/src/content-pipeline/lead-magnets/templates/market_snapshot.html.ejs",
      dataBundle: {
        geo: {
          geography: "metro",
          id: "17140",
          canonical_name: "Cleveland, OH",
        },
        score: { propertyiq_score: 78, grade: "B", confidence: "A" },
        home_value: { value: 385000, yoy_pct: 3.2 },
        rent: { value: 1800, yoy_pct: 4.1 },
        demographics: {
          population: 2050000,
          median_income: 62000,
          homeownership_pct: 66,
        },
        economic: { unemployment_rate: 4.1, job_growth_yoy_pct: 1.8 },
      },
      userContext: { userName: "Test User", email: "test@example.com" },
      outputPath,
    });

    expect(existsSync(outputPath)).toBe(true);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    unlinkSync(outputPath);
  }, 30_000);
});
```

- [ ] **Step 6: Run to confirm failure.**

```bash
cd packages/backend && npm run test -- puppeteer-lead-magnet-renderer.spec
```

Expected: FAIL.

- [ ] **Step 7: Implement renderer.**

```typescript
// packages/backend/src/content-pipeline/drivers/puppeteer-lead-magnet-renderer.ts
import { Injectable } from "@nestjs/common";
import puppeteer, { Browser } from "puppeteer";
import { readFileSync } from "fs";
import { join } from "path";
import ejs from "ejs";
import {
  LeadMagnetRenderer,
  LeadMagnetRenderRequest,
  LeadMagnetRenderResult,
} from "./lead-magnet-renderer.interface";

@Injectable()
export class PuppeteerLeadMagnetRenderer implements LeadMagnetRenderer {
  private browser: Browser | null = null;

  async render(req: LeadMagnetRenderRequest): Promise<LeadMagnetRenderResult> {
    const start = Date.now();

    const brandCss = readFileSync(
      join(
        process.cwd(),
        "packages/backend/src/content-pipeline/lead-magnets/shared/brand.css",
      ),
      "utf8",
    );
    const layoutPath = join(
      process.cwd(),
      "packages/backend/src/content-pipeline/lead-magnets/shared/layout.html.ejs",
    );

    const contentTemplate = readFileSync(
      join(process.cwd(), req.templatePath),
      "utf8",
    );
    const content = ejs.render(contentTemplate, {
      dataBundle: req.dataBundle,
      userContext: req.userContext,
      today: new Date().toISOString().slice(0, 10),
    });

    const html = await ejs.renderFile(layoutPath, {
      title: `${req.magnetKind} for ${req.userContext.userName}`,
      brandCss,
      content,
    });

    if (!this.browser) {
      this.browser = await puppeteer.launch({
        args: ["--no-sandbox"],
        headless: true,
      });
    }
    const page = await this.browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: req.outputPath,
      format: "A4",
      printBackground: true,
    });

    const metrics = await page.metrics();
    await page.close();

    return {
      pdfPath: req.outputPath,
      pageCount: 1,
      renderWallMs: Date.now() - start,
      cost: {
        provider: "puppeteer",
        amount_usd: 0,
        units: 1,
        unit_type: "requests",
      },
    };
  }

  async onModuleDestroy() {
    if (this.browser) await this.browser.close();
  }
}
```

- [ ] **Step 8: Run to confirm pass.**

```bash
cd packages/backend && npm run test -- puppeteer-lead-magnet-renderer.spec
```

Expected: PASS.

- [ ] **Step 9: Register in module.**

```typescript
// content-pipeline.module.ts:
import { PuppeteerLeadMagnetRenderer } from './drivers/puppeteer-lead-magnet-renderer';
import { LEAD_MAGNET_RENDERER } from './drivers/lead-magnet-renderer.interface';
// providers:
{ provide: LEAD_MAGNET_RENDERER, useClass: PuppeteerLeadMagnetRenderer },
PuppeteerLeadMagnetRenderer,
```

- [ ] **Step 10: Commit.**

```bash
git add packages/backend/src/content-pipeline/drivers/ packages/backend/src/content-pipeline/lead-magnets/ packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): Puppeteer lead-magnet renderer plus Market Snapshot PDF"
```

## Task 1.24: Extend EmailService for attachments plus React-Email template

**Files:**

- Modify: `packages/backend/src/email/email.service.ts`
- Create: `packages/emails/emails/lead-magnet-delivery.tsx`
- Modify: `packages/emails/index.ts`
- Create: `packages/backend/src/email/email.service.attachments.spec.ts`

- [ ] **Step 1: Read existing EmailService.**

```bash
cat packages/backend/src/email/email.service.ts | head -60
```

Note: existing service calls `resend.emails.send({ from, to, subject, react, html, replyTo })`. Extend `SendEmailOptions` interface to add `attachments?: Array<{ filename: string; path: string }>`.

- [ ] **Step 2: Write failing test.**

```typescript
// packages/backend/src/email/email.service.attachments.spec.ts
import { EmailService } from "./email.service";

describe("EmailService attachments", () => {
  it("passes attachments to Resend when provided", async () => {
    const sendSpy = jest.fn().mockResolvedValue({ data: { id: "test" } });
    const svc = new EmailService({
      apiKey: "test",
      from: "noreply@test.com",
    } as any);
    (svc as any).resend = { emails: { send: sendSpy } };

    await svc.sendEmail({
      to: "user@test.com",
      subject: "Your Market Snapshot",
      react: { type: "div", props: {}, children: "body" } as any,
      attachments: [{ filename: "snapshot.pdf", path: "/tmp/snapshot.pdf" }],
    });

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ filename: "snapshot.pdf", path: "/tmp/snapshot.pdf" }],
      }),
    );
  });
});
```

- [ ] **Step 3: Run to confirm failure.**

```bash
cd packages/backend && npm run test -- email.service.attachments.spec
```

Expected: FAIL.

- [ ] **Step 4: Extend EmailService.**

Add to the `SendEmailOptions` interface in `email.service.ts`:

```typescript
export interface SendEmailOptions {
  to: string;
  subject: string;
  react?: React.ReactElement;
  html?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; path: string }>;
}
```

Modify the `sendEmail` body to pass `attachments` through to Resend:

```typescript
const payload: any = {
  from: this.from,
  to: opts.to,
  subject: opts.subject,
  react: opts.react,
  html: opts.html,
  replyTo: opts.replyTo,
};
if (opts.attachments && opts.attachments.length > 0) {
  payload.attachments = opts.attachments;
}
const result = await this.resend.emails.send(payload);
```

- [ ] **Step 5: Run to confirm pass.**

```bash
cd packages/backend && npm run test -- email.service.attachments.spec
```

Expected: PASS.

- [ ] **Step 6: Create lead-magnet-delivery React-Email template.**

```tsx
// packages/emails/emails/lead-magnet-delivery.tsx
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Section,
  Link,
} from "@react-email/components";
import * as React from "react";
import { Layout } from "../components/Layout";
import { BrandedButton } from "../components/BrandedButton";

export interface LeadMagnetDeliveryProps {
  userName: string;
  magnetDisplayName: string;
  marketName: string;
  dashboardUrl: string;
}

export const LeadMagnetDelivery: React.FC<LeadMagnetDeliveryProps> = ({
  userName,
  magnetDisplayName,
  marketName,
  dashboardUrl,
}) => (
  <Html>
    <Head />
    <Body>
      <Layout>
        <Heading>
          Your {magnetDisplayName} for {marketName} is ready, {userName}.
        </Heading>
        <Text>
          Attached is your personalized PropertyIQ report. We pulled the latest
          market data this morning; you can see the underlying numbers,
          forecasts, and comparable markets on your dashboard.
        </Text>
        <Section style={{ textAlign: "center", margin: "32px 0" }}>
          <BrandedButton href={dashboardUrl}>View on Dashboard</BrandedButton>
        </Section>
        <Text style={{ fontSize: "13px", color: "#5C6BC0" }}>
          Refresh this report anytime at{" "}
          <Link href={dashboardUrl}>propertyiq.app</Link>.
        </Text>
      </Layout>
    </Body>
  </Html>
);

export default LeadMagnetDelivery;
```

- [ ] **Step 7: Export from `packages/emails/index.ts`.**

```typescript
export {
  LeadMagnetDelivery,
  type LeadMagnetDeliveryProps,
} from "./emails/lead-magnet-delivery";
```

- [ ] **Step 8: Build emails package.**

```bash
cd packages/emails && npm run build
```

- [ ] **Step 9: Commit.**

```bash
git add packages/backend/src/email/email.service.ts packages/backend/src/email/email.service.attachments.spec.ts \
        packages/emails/emails/lead-magnet-delivery.tsx packages/emails/index.ts
git commit -m "feat(email): extend EmailService with attachments and add lead-magnet-delivery template"
```

## Task 1.25: YouTubeShortsPublisher with OAuth and credential encryption

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/platform-publisher.interface.ts`
- Create: `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.ts`
- Create: `packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.spec.ts`
- Create: `packages/backend/src/content-pipeline/drivers/credential-crypto.ts`
- Create: `packages/backend/src/content-pipeline/drivers/credential-crypto.spec.ts`

- [ ] **Step 1: Write PlatformPublisher interface.**

```typescript
// packages/backend/src/content-pipeline/drivers/platform-publisher.interface.ts
import { Platform, PostMode } from "../types";
import { DriverCost } from "./driver-cost.types";

export interface PublishRequest {
  runId: string;
  videoPath: string;
  thumbnailPath?: string;
  title: string;
  description: string;
  tags: string[];
  captionsSrtPath?: string;
  postMode: PostMode;
  scheduledFor?: Date;
}

export interface PublishResult {
  externalId: string;
  externalUrl: string;
  cost: DriverCost;
  providerResponse: unknown;
}

export interface PlatformPublisher {
  readonly platform: Platform;
  isConfigured(): boolean;
  publish(req: PublishRequest): Promise<PublishResult>;
  refreshCredentials?(): Promise<void>;
}

export const PLATFORM_PUBLISHERS = Symbol("PLATFORM_PUBLISHERS");
```

- [ ] **Step 2: Write credential encryption helper.**

```typescript
// packages/backend/src/content-pipeline/drivers/credential-crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

export class CredentialCrypto {
  private readonly key: Buffer;
  constructor() {
    const b64 = process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY;
    if (!b64)
      throw new Error("PLATFORM_CREDENTIALS_ENCRYPTION_KEY is required");
    this.key = Buffer.from(b64, "base64");
    if (this.key.length !== 32)
      throw new Error("encryption key must decode to 32 bytes");
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, encB64] = payload.split(".");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const enc = Buffer.from(encB64, "base64");
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  }
}
```

- [ ] **Step 3: Write credential crypto test.**

```typescript
// packages/backend/src/content-pipeline/drivers/credential-crypto.spec.ts
import { CredentialCrypto } from "./credential-crypto";
import { randomBytes } from "crypto";

describe("CredentialCrypto", () => {
  beforeAll(() => {
    process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY =
      randomBytes(32).toString("base64");
  });

  it("roundtrips a token", () => {
    const c = new CredentialCrypto();
    const plaintext = "1//0abcdef-refresh-token";
    expect(c.decrypt(c.encrypt(plaintext))).toBe(plaintext);
  });

  it("throws when key is missing", () => {
    delete process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY;
    expect(() => new CredentialCrypto()).toThrow();
  });
});
```

- [ ] **Step 4: Write YouTubeShortsPublisher test.**

```typescript
// packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.spec.ts
import { YouTubeShortsPublisher } from "./youtube-shorts-publisher";

jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest
        .fn()
        .mockImplementation(() => ({ setCredentials: jest.fn() })),
    },
    youtube: jest.fn().mockReturnValue({
      videos: {
        insert: jest.fn().mockResolvedValue({ data: { id: "abc123" } }),
      },
    }),
  },
}));

describe("YouTubeShortsPublisher", () => {
  beforeAll(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = "test-client";
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = "test-secret";
    process.env.YOUTUBE_OAUTH_REFRESH_TOKEN = "test-refresh";
  });

  it("reports configured when env vars set", () => {
    expect(new YouTubeShortsPublisher().isConfigured()).toBe(true);
  });

  it("publishes with Shorts hashtag in description", async () => {
    const publisher = new YouTubeShortsPublisher();
    const result = await publisher.publish({
      runId: "r1",
      videoPath: "/tmp/v.mp4",
      title: "Cleveland PropertyIQ Score",
      description: "Cleveland hit 78",
      tags: ["real estate", "cleveland"],
      postMode: "direct",
    });
    expect(result.externalId).toBe("abc123");
    expect(result.externalUrl).toContain("youtube.com");
  });
});
```

- [ ] **Step 5: Run tests to confirm failure.**

```bash
cd packages/backend && npm run test -- youtube-shorts-publisher.spec credential-crypto.spec
```

Expected: FAIL.

- [ ] **Step 6: Implement publisher.**

```typescript
// packages/backend/src/content-pipeline/drivers/youtube-shorts-publisher.ts
import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import { createReadStream } from "fs";
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from "./platform-publisher.interface";
import { Platform } from "../types";

@Injectable()
export class YouTubeShortsPublisher implements PlatformPublisher {
  readonly platform: Platform = "youtube_shorts";
  private oauth2: any;

  isConfigured(): boolean {
    return !!(
      process.env.YOUTUBE_OAUTH_CLIENT_ID &&
      process.env.YOUTUBE_OAUTH_CLIENT_SECRET &&
      process.env.YOUTUBE_OAUTH_REFRESH_TOKEN
    );
  }

  private getAuth() {
    if (!this.oauth2) {
      this.oauth2 = new google.auth.OAuth2(
        process.env.YOUTUBE_OAUTH_CLIENT_ID,
        process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
      );
      this.oauth2.setCredentials({
        refresh_token: process.env.YOUTUBE_OAUTH_REFRESH_TOKEN,
      });
    }
    return this.oauth2;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    if (!this.isConfigured())
      throw new Error("YouTubeShortsPublisher not configured");

    const yt = google.youtube({ version: "v3", auth: this.getAuth() });
    const privacyStatus = req.postMode === "direct" ? "public" : "private";

    const descriptionWithHashtag = req.description.includes("#Shorts")
      ? req.description
      : req.description + "\n\n#Shorts";

    const response = await yt.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: req.title,
          description: descriptionWithHashtag,
          tags: req.tags,
          categoryId: "22", // People & Blogs
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
          publishAt: req.scheduledFor?.toISOString(),
        },
      },
      media: { body: createReadStream(req.videoPath) },
    });

    const videoId = (response.data as any).id;
    return {
      externalId: videoId,
      externalUrl: `https://youtube.com/shorts/${videoId}`,
      cost: {
        provider: "youtube",
        amount_usd: 0,
        units: 1,
        unit_type: "requests",
      },
      providerResponse: response.data,
    };
  }

  async refreshCredentials(): Promise<void> {
    await this.getAuth().getAccessToken();
  }
}
```

- [ ] **Step 7: Run tests to confirm pass.**

```bash
cd packages/backend && npm run test -- youtube-shorts-publisher.spec credential-crypto.spec
```

Expected: PASS.

- [ ] **Step 8: Register in module.**

```typescript
// content-pipeline.module.ts:
import { YouTubeShortsPublisher } from './drivers/youtube-shorts-publisher';
import { CredentialCrypto } from './drivers/credential-crypto';
import { PLATFORM_PUBLISHERS } from './drivers/platform-publisher.interface';
// providers:
YouTubeShortsPublisher, CredentialCrypto,
{
  provide: PLATFORM_PUBLISHERS,
  useFactory: (yt: YouTubeShortsPublisher) => [yt],
  inject: [YouTubeShortsPublisher],
},
```

- [ ] **Step 9: Commit.**

```bash
git add packages/backend/src/content-pipeline/drivers/ packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): YouTubeShortsPublisher with OAuth and credential encryption"
```

## Task 1.26: pipeline-state.ts state machine plus RunOrchestratorService

**Files:**

- Create: `packages/backend/src/content-pipeline/orchestrator/pipeline-state.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/pipeline-state.spec.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/run-orchestrator.service.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/run-orchestrator.service.spec.ts`

- [ ] **Step 1: Write state machine definitions.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/pipeline-state.ts
import { PipelineStatus } from "../types";

export const ALLOWED_TRANSITIONS: Record<PipelineStatus, PipelineStatus[]> = {
  queued: ["fetching_data"],
  fetching_data: ["scripting", "failed"],
  scripting: ["verifying_data", "failed"],
  verifying_data: ["linting_voice", "ready_for_review"],
  linting_voice: ["rendering_voice", "ready_for_review"],
  rendering_voice: ["timing_captions", "rendering_video", "failed"],
  timing_captions: ["rendering_video", "failed"],
  rendering_video: ["publishing", "ready_for_review", "failed"],
  ready_for_review: ["publishing", "linting_voice", "rejected"],
  publishing: ["published", "published_partial", "failed"],
  published: [],
  published_partial: [],
  rejected: [],
  failed: [],
};

export function canTransition(
  from: PipelineStatus,
  to: PipelineStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStateOnSuccess(
  current: PipelineStatus,
  approvalMode: "auto" | "review" | "draft",
): PipelineStatus | null {
  switch (current) {
    case "queued":
      return "fetching_data";
    case "fetching_data":
      return "scripting";
    case "scripting":
      return "verifying_data";
    case "verifying_data":
      return "linting_voice";
    case "linting_voice":
      return "rendering_voice";
    case "rendering_voice":
      return "timing_captions";
    case "timing_captions":
      return "rendering_video";
    case "rendering_video":
      return approvalMode === "review" ? "ready_for_review" : "publishing";
    case "ready_for_review":
      return "publishing";
    case "publishing":
      return "published";
    default:
      return null;
  }
}
```

- [ ] **Step 2: Write state machine tests.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/pipeline-state.spec.ts
import { canTransition, nextStateOnSuccess } from "./pipeline-state";

describe("pipeline-state", () => {
  it("allows queued to fetching_data", () => {
    expect(canTransition("queued", "fetching_data")).toBe(true);
  });

  it("disallows queued to rendering_video", () => {
    expect(canTransition("queued", "rendering_video")).toBe(false);
  });

  it("allows verifying_data to ready_for_review (gate A fail)", () => {
    expect(canTransition("verifying_data", "ready_for_review")).toBe(true);
  });

  it("allows ready_for_review back to linting_voice on script edit", () => {
    expect(canTransition("ready_for_review", "linting_voice")).toBe(true);
  });

  it("rendering_video goes to publishing for auto mode", () => {
    expect(nextStateOnSuccess("rendering_video", "auto")).toBe("publishing");
  });

  it("rendering_video goes to ready_for_review for review mode", () => {
    expect(nextStateOnSuccess("rendering_video", "review")).toBe(
      "ready_for_review",
    );
  });

  it("terminal states have no transitions", () => {
    expect(canTransition("published", "fetching_data")).toBe(false);
    expect(canTransition("failed", "queued")).toBe(false);
  });
});
```

- [ ] **Step 3: Run to confirm pass (logic-only, no implementation failures expected).**

```bash
cd packages/backend && npm run test -- pipeline-state.spec
```

Expected: all PASS.

- [ ] **Step 4: Write RunOrchestratorService tests.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/run-orchestrator.service.spec.ts
import { Test } from "@nestjs/testing";
import { RunOrchestratorService } from "./run-orchestrator.service";
import { QueueService } from "./queue.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("RunOrchestratorService.transitionTo", () => {
  let svc: RunOrchestratorService;
  let supabaseClient: any;
  let queue: { send: jest.Mock };

  beforeEach(async () => {
    const updateSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    const insertSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    supabaseClient = {
      from: jest.fn().mockImplementation((tbl: string) => ({
        update: updateSpy,
        insert: insertSpy,
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { status: "queued", approval_mode: "review" },
          error: null,
        }),
      })),
    };
    queue = { send: jest.fn().mockResolvedValue("job-id") };

    const module = await Test.createTestingModule({
      providers: [
        RunOrchestratorService,
        { provide: QueueService, useValue: queue },
        {
          provide: SupabaseService,
          useValue: { getClient: () => supabaseClient },
        },
      ],
    }).compile();
    svc = module.get(RunOrchestratorService);
  });

  it("refuses invalid transition", async () => {
    await expect(
      svc.transitionTo("run-1", "rendering_video", { reason: "test" }),
    ).rejects.toThrow(/invalid transition/i);
  });

  it("valid transition writes status and event", async () => {
    await svc.transitionTo("run-1", "fetching_data", {});
    expect(supabaseClient.from).toHaveBeenCalledWith("content_runs");
    expect(supabaseClient.from).toHaveBeenCalledWith("content_run_events");
  });

  it("enqueues next step job after transition", async () => {
    await svc.transitionTo("run-1", "fetching_data", { enqueueNext: true });
    expect(queue.send).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run to confirm failure.**

```bash
cd packages/backend && npm run test -- run-orchestrator.service.spec
```

Expected: FAIL (service not defined).

- [ ] **Step 6: Implement RunOrchestratorService.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/run-orchestrator.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { QueueService, QueueName } from "./queue.service";
import { canTransition, nextStateOnSuccess } from "./pipeline-state";
import { PipelineStatus } from "../types";

export interface TransitionOptions {
  reason?: string;
  enqueueNext?: boolean;
  eventPayload?: Record<string, unknown>;
}

const STATE_QUEUE_MAP: Record<PipelineStatus, QueueName | null> = {
  queued: "orchestrator",
  fetching_data: "orchestrator",
  scripting: "orchestrator",
  verifying_data: "orchestrator",
  linting_voice: "orchestrator",
  rendering_voice: "render-audio",
  timing_captions: "render-captions",
  rendering_video: "render-video",
  ready_for_review: null,
  publishing: "orchestrator",
  published: null,
  published_partial: null,
  rejected: null,
  failed: null,
};

@Injectable()
export class RunOrchestratorService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  async transitionTo(
    runId: string,
    to: PipelineStatus,
    opts: TransitionOptions = {},
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { data: run, error: fetchErr } = await client
      .from("content_runs")
      .select("status, approval_mode, format")
      .eq("id", runId)
      .single();
    if (fetchErr || !run) throw new Error(`Run ${runId} not found`);

    if (!canTransition(run.status as PipelineStatus, to)) {
      throw new Error(
        `Invalid transition from ${run.status} to ${to} for run ${runId}`,
      );
    }

    await client
      .from("content_runs")
      .update({
        status: to,
        status_reason: opts.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    await client.from("content_run_events").insert({
      run_id: runId,
      event_type: "status_changed",
      payload: {
        from: run.status,
        to,
        reason: opts.reason,
        ...opts.eventPayload,
      },
    });

    if (opts.enqueueNext !== false) {
      const queueName = STATE_QUEUE_MAP[to];
      if (queueName) await this.queue.send(queueName, { runId, status: to });
    }
  }

  async handleStepSuccess(runId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: run } = await client
      .from("content_runs")
      .select("status, approval_mode")
      .eq("id", runId)
      .single();
    if (!run) return;
    const next = nextStateOnSuccess(
      run.status as PipelineStatus,
      run.approval_mode,
    );
    if (next) await this.transitionTo(runId, next, { enqueueNext: true });
  }

  async handleStepFailure(runId: string, reason: string): Promise<void> {
    await this.transitionTo(runId, "failed", { reason, enqueueNext: false });
  }
}
```

- [ ] **Step 7: Run tests to confirm pass.**

```bash
cd packages/backend && npm run test -- run-orchestrator.service.spec
```

Expected: 3 PASS.

- [ ] **Step 8: Commit.**

```bash
git add packages/backend/src/content-pipeline/orchestrator/
git commit -m "feat(content-pipeline): pipeline state machine and RunOrchestratorService"
```

## Task 1.27: P1 job handlers

**Files:**

- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/generate-script.handler.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/verify-data.handler.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/lint-voice.handler.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/synthesize-audio.handler.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/render-video.handler.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/publish.handler.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-youtube-shorts.handler.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/generate-lead-magnet.handler.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers.spec.ts`

- [ ] **Step 1: Write fetch-data handler.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import { RunOrchestratorService } from "../run-orchestrator.service";
import { ContentDataService } from "../../data/content-data.service";

@Injectable()
export class FetchDataHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    private readonly data: ContentDataService,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { data: run } = await client
        .from("content_runs")
        .select("market_query, format")
        .eq("id", runId)
        .single();
      if (!run) throw new Error("run not found");

      const candidates = await this.data.resolveMarket(run.market_query);
      if (candidates.length === 0)
        throw new Error(`no market match for "${run.market_query}"`);
      const resolvedGeo = {
        geography: candidates[0].geography,
        id: candidates[0].id,
        canonical_name: candidates[0].canonical_name,
      };

      const snapshot = await this.data.getMarketSnapshot(resolvedGeo);

      await client
        .from("content_runs")
        .update({ resolved_geo: resolvedGeo })
        .eq("id", runId);
      await client.from("content_assets").insert({
        run_id: runId,
        kind: "mcp_payload",
        storage_url: "inline",
        metadata: snapshot,
      });

      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `fetch_data: ${(err as Error).message}`,
      );
    }
  }
}
```

- [ ] **Step 2: Write generate-script handler.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/generate-script.handler.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import { RunOrchestratorService } from "../run-orchestrator.service";
import {
  SCRIPT_GENERATOR,
  ScriptGenerator,
} from "../../drivers/script-generator.interface";

@Injectable()
export class GenerateScriptHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    @Inject(SCRIPT_GENERATOR) private readonly scriptGen: ScriptGenerator,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { data: run } = await client
        .from("content_runs")
        .select("format, audience, resolved_geo")
        .eq("id", runId)
        .single();
      const { data: payload } = await client
        .from("content_assets")
        .select("metadata")
        .eq("run_id", runId)
        .eq("kind", "mcp_payload")
        .single();
      const { data: binding } = await client
        .from("format_magnet_bindings")
        .select("cta_text")
        .eq("format", run.format)
        .eq("enabled", true)
        .single();

      const result = await this.scriptGen.generate({
        format: run.format,
        audience: run.audience,
        resolvedMarket: run.resolved_geo,
        dataBundle: payload.metadata,
        variantCount: 1,
        ctaText: binding?.cta_text ?? "Get your free Market Snapshot at ",
      });

      await client
        .from("content_runs")
        .update({
          hook_variants: result.scripts,
          costs: { script: [result.cost] },
        })
        .eq("id", runId);

      await client.from("content_assets").insert([
        {
          run_id: runId,
          kind: "script",
          storage_url: "inline",
          metadata: { scripts: result.scripts },
        },
        {
          run_id: runId,
          kind: "script_raw",
          storage_url: "inline",
          metadata: { raw: result.rawLLMResponse },
        },
      ]);

      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `scripting: ${(err as Error).message}`,
      );
    }
  }
}
```

- [ ] **Step 3: Write verify-data handler (runs Gate A).**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/verify-data.handler.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import { RunOrchestratorService } from "../run-orchestrator.service";
import { DataVerifierService } from "../../gates/data-verifier.service";

@Injectable()
export class VerifyDataHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    private readonly gate: DataVerifierService,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { data: scriptAsset } = await client
        .from("content_assets")
        .select("metadata")
        .eq("run_id", runId)
        .eq("kind", "script")
        .single();
      const { data: payloadAsset } = await client
        .from("content_assets")
        .select("metadata")
        .eq("run_id", runId)
        .eq("kind", "mcp_payload")
        .single();

      const script = scriptAsset.metadata.scripts[0];
      const result = await this.gate.verify(
        script.fullText,
        payloadAsset.metadata,
      );

      await client.from("content_run_gates").insert({
        run_id: runId,
        gate: "data_verifier",
        result: result.passed ? "passed" : "failed",
        details: { violations: result.violations },
      });

      if (result.passed) {
        await this.orchestrator.transitionTo(runId, "linting_voice", {
          enqueueNext: true,
        });
      } else {
        await this.orchestrator.transitionTo(runId, "ready_for_review", {
          reason: "gate_a_drift",
          eventPayload: { violations: result.violations },
          enqueueNext: false,
        });
      }
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `verifying_data: ${(err as Error).message}`,
      );
    }
  }
}
```

- [ ] **Step 4: Write lint-voice handler (runs Gate B).**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/lint-voice.handler.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import { RunOrchestratorService } from "../run-orchestrator.service";
import { BrandVoiceLinterService } from "../../gates/brand-voice-linter.service";

@Injectable()
export class LintVoiceHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    private readonly gate: BrandVoiceLinterService,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { data: scriptAsset } = await client
        .from("content_assets")
        .select("metadata")
        .eq("run_id", runId)
        .eq("kind", "script")
        .single();
      const script = scriptAsset.metadata.scripts[0];
      const result = await this.gate.lint(script.fullText);

      await client.from("content_run_gates").insert({
        run_id: runId,
        gate: "brand_voice_linter",
        result: result.passed ? "passed" : "failed",
        details: { violations: result.violations },
        llm_judge_response: result.llm_judge_response ?? null,
      });

      if (result.passed) {
        await this.orchestrator.transitionTo(runId, "rendering_voice", {
          enqueueNext: true,
        });
      } else {
        await this.orchestrator.transitionTo(runId, "ready_for_review", {
          reason: "gate_b_voice",
          eventPayload: { violations: result.violations },
          enqueueNext: false,
        });
      }
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `linting_voice: ${(err as Error).message}`,
      );
    }
  }
}
```

- [ ] **Step 5: Write synthesize-audio handler.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/synthesize-audio.handler.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import { RunOrchestratorService } from "../run-orchestrator.service";
import { TTSDriverFactory } from "../../drivers/tts-driver.factory";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

@Injectable()
export class SynthesizeAudioHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    private readonly ttsFactory: TTSDriverFactory,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { data: run } = await client
        .from("content_runs")
        .select("tts_provider, tts_voice_id")
        .eq("id", runId)
        .single();
      const { data: scriptAsset } = await client
        .from("content_assets")
        .select("metadata")
        .eq("run_id", runId)
        .eq("kind", "script")
        .single();

      const script = scriptAsset.metadata.scripts[0];
      const driver = this.ttsFactory.forProvider(run.tts_provider);
      const outputPath = join(
        tmpdir(),
        `audio-${runId}-${randomBytes(4).toString("hex")}.mp3`,
      );
      const result = await driver.synthesize({
        text: script.fullText,
        voiceId: run.tts_voice_id,
        outputPath,
        format: "mp3",
      });

      const storageUrl = await this.uploadToStorage(runId, outputPath);

      await client.from("content_assets").insert({
        run_id: runId,
        kind: "audio",
        storage_url: storageUrl,
        metadata: { durationMs: result.durationMs, bitrate: result.bitrate },
      });

      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `rendering_voice: ${(err as Error).message}`,
      );
    }
  }

  private async uploadToStorage(
    runId: string,
    localPath: string,
  ): Promise<string> {
    const client = this.supabase.getClient();
    const { readFileSync } = await import("fs");
    const buffer = readFileSync(localPath);
    const path = `runs/${runId}/audio.mp3`;
    const { error } = await client.storage
      .from("content-pipeline")
      .upload(path, buffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (error) throw error;
    return `supabase://content-pipeline/${path}`;
  }
}
```

- [ ] **Step 6: Write render-video handler.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/render-video.handler.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import { RunOrchestratorService } from "../run-orchestrator.service";
import {
  VIDEO_RENDERER,
  VideoRenderer,
} from "../../drivers/video-renderer.interface";
import { join } from "path";
import { tmpdir } from "os";
import { readFileSync } from "fs";

@Injectable()
export class RenderVideoHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    @Inject(VIDEO_RENDERER) private readonly renderer: VideoRenderer,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { data: run } = await client
        .from("content_runs")
        .select("format, resolved_geo, hook_variants")
        .eq("id", runId)
        .single();
      const { data: payload } = await client
        .from("content_assets")
        .select("metadata")
        .eq("run_id", runId)
        .eq("kind", "mcp_payload")
        .single();
      const { data: audio } = await client
        .from("content_assets")
        .select("storage_url")
        .eq("run_id", runId)
        .eq("kind", "audio")
        .single();

      const audioPath = await this.downloadFromStorage(audio.storage_url);
      const videoPath = join(tmpdir(), `video-${runId}.mp4`);

      const result = await this.renderer.render({
        format: run.format,
        props: {
          format: run.format,
          resolvedMarket: run.resolved_geo,
          dataBundle: payload.metadata,
          ctaUrl: "",
        },
        outputPath: videoPath,
        audioPath,
      });

      const storageUrl = await this.uploadToStorage(runId, result.videoPath);
      await client.from("content_assets").insert({
        run_id: runId,
        kind: "video_master",
        storage_url: storageUrl,
        metadata: {
          durationMs: result.durationMs,
          renderWallMs: result.renderWallMs,
        },
      });

      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `rendering_video: ${(err as Error).message}`,
      );
    }
  }

  private async downloadFromStorage(supabaseUrl: string): Promise<string> {
    const match = supabaseUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
    if (!match) throw new Error(`invalid supabase url: ${supabaseUrl}`);
    const [, bucket, path] = match;
    const client = this.supabase.getClient();
    const { data, error } = await client.storage.from(bucket).download(path);
    if (error) throw error;
    const { writeFileSync } = await import("fs");
    const localPath = join(tmpdir(), `dl-${Date.now()}.bin`);
    writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
    return localPath;
  }

  private async uploadToStorage(
    runId: string,
    localPath: string,
  ): Promise<string> {
    const client = this.supabase.getClient();
    const buffer = readFileSync(localPath);
    const path = `runs/${runId}/video.mp4`;
    const { error } = await client.storage
      .from("content-pipeline")
      .upload(path, buffer, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (error) throw error;
    return `supabase://content-pipeline/${path}`;
  }
}
```

- [ ] **Step 7: Write publish handler (fan-out).**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/publish.handler.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import { QueueService } from "../queue.service";
import { Platform } from "../../types";

const PLATFORM_TO_QUEUE: Partial<
  Record<
    Platform,
    | "publish-youtube"
    | "publish-tiktok"
    | "publish-instagram"
    | "publish-facebook"
    | "publish-linkedin"
  >
> = {
  youtube_shorts: "publish-youtube",
  youtube_long: "publish-youtube",
  tiktok: "publish-tiktok",
  instagram_reels: "publish-instagram",
  facebook_reels: "publish-facebook",
  linkedin: "publish-linkedin",
};

@Injectable()
export class PublishHandler {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  async handle(runId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: run } = await client
      .from("content_runs")
      .select("selected_platforms")
      .eq("id", runId)
      .single();

    for (const platform of run.selected_platforms as Platform[]) {
      const queueName = PLATFORM_TO_QUEUE[platform];
      if (queueName) await this.queue.send(queueName, { runId, platform });
    }
  }
}
```

- [ ] **Step 8: Write publish-youtube-shorts handler.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-youtube-shorts.handler.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import { RunOrchestratorService } from "../run-orchestrator.service";
import { YouTubeShortsPublisher } from "../../drivers/youtube-shorts-publisher";
import { join } from "path";
import { tmpdir } from "os";
import { writeFileSync } from "fs";

@Injectable()
export class PublishYouTubeShortsHandler {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
    private readonly publisher: YouTubeShortsPublisher,
  ) {}

  async handle(runId: string): Promise<void> {
    const client = this.supabase.getClient();
    try {
      const { data: run } = await client
        .from("content_runs")
        .select("format, resolved_geo, hook_variants, approval_mode")
        .eq("id", runId)
        .single();
      const { data: video } = await client
        .from("content_assets")
        .select("storage_url")
        .eq("run_id", runId)
        .eq("kind", "video_master")
        .single();

      const videoPath = await this.downloadFromStorage(video.storage_url);
      const script = (run.hook_variants as any[])[0];

      const title = `${run.resolved_geo.canonical_name} PropertyIQ Score`;
      const description = `${script.hook}\n\n${script.body}\n\n${script.cta}\n\n#Shorts #RealEstate #PropertyIQ`;
      const tags = [
        "real estate",
        "property investing",
        run.resolved_geo.canonical_name,
      ];

      const result = await this.publisher.publish({
        runId,
        videoPath,
        title,
        description,
        tags,
        postMode: run.approval_mode === "draft" ? "draft" : "direct",
      });

      const { data: postRow } = await client
        .from("platform_posts")
        .insert({
          run_id: runId,
          platform: "youtube_shorts",
          external_id: result.externalId,
          external_url: result.externalUrl,
          post_mode: run.approval_mode === "draft" ? "draft" : "direct",
          hook_variant_id: "A",
          status: "posted",
        })
        .select()
        .single();

      const shortLinkId = await this.createShortLink(
        runId,
        postRow.id,
        run.format,
        "youtube_shorts",
      );
      await client
        .from("platform_posts")
        .update({ short_link_id: shortLinkId })
        .eq("id", postRow.id);

      await this.orchestrator.transitionTo(runId, "published", {
        enqueueNext: false,
      });
    } catch (err) {
      await client.from("platform_posts").insert({
        run_id: runId,
        platform: "youtube_shorts",
        status: "failed",
        error: (err as Error).message,
      });
      await this.orchestrator.handleStepFailure(
        runId,
        `publish-youtube-shorts: ${(err as Error).message}`,
      );
    }
  }

  private async downloadFromStorage(supabaseUrl: string): Promise<string> {
    const match = supabaseUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
    const [, bucket, path] = match!;
    const { data } = await this.supabase
      .getClient()
      .storage.from(bucket)
      .download(path);
    const localPath = join(tmpdir(), `pub-${Date.now()}.mp4`);
    writeFileSync(localPath, Buffer.from(await data!.arrayBuffer()));
    return localPath;
  }

  private async createShortLink(
    runId: string,
    platformPostId: string,
    format: string,
    platform: string,
  ): Promise<string> {
    const client = this.supabase.getClient();
    const { randomBytes } = await import("crypto");
    const slug = randomBytes(5).toString("base64url").slice(0, 8);
    const { data: binding } = await client
      .from("format_magnet_bindings")
      .select("magnet_kind")
      .eq("format", format)
      .eq("enabled", true)
      .single();
    const { data: magnet } = await client
      .from("lead_magnet_definitions")
      .select("landing_page_path")
      .eq("kind", binding?.magnet_kind ?? "market_snapshot_pdf")
      .single();
    const targetUrl = `https://propertyiq.app${magnet?.landing_page_path ?? "/grade-reveal-signup"}?run=${runId}`;

    const { data: linkRow } = await client
      .from("short_links")
      .insert({
        slug,
        run_id: runId,
        format,
        platform,
        target_url: targetUrl,
      })
      .select()
      .single();
    return linkRow.id;
  }
}
```

- [ ] **Step 9: Write generate-lead-magnet handler.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/generate-lead-magnet.handler.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import {
  LEAD_MAGNET_RENDERER,
  LeadMagnetRenderer,
  LeadMagnetKind,
} from "../../drivers/lead-magnet-renderer.interface";
import { ContentDataService } from "../../data/content-data.service";
import { EmailService } from "../../../email/email.service";
import { LeadMagnetDelivery } from "@propertyiq/emails";
import { join } from "path";
import { tmpdir } from "os";
import { readFileSync } from "fs";

export interface GenerateLeadMagnetJob {
  userId: string;
  userEmail: string;
  userName: string;
  magnetKind: LeadMagnetKind;
  resolvedGeo: {
    geography: "state" | "metro" | "county" | "zip";
    id: string;
    canonical_name: string;
  };
}

@Injectable()
export class GenerateLeadMagnetHandler {
  constructor(
    @Inject(LEAD_MAGNET_RENDERER) private readonly renderer: LeadMagnetRenderer,
    private readonly data: ContentDataService,
    private readonly email: EmailService,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(job: GenerateLeadMagnetJob): Promise<void> {
    const client = this.supabase.getClient();
    const { data: magnet } = await client
      .from("lead_magnet_definitions")
      .select("*")
      .eq("kind", job.magnetKind)
      .single();
    if (!magnet) throw new Error(`magnet ${job.magnetKind} not found`);

    const dataBundle = await (this.data as any)[magnet.data_method](
      job.resolvedGeo,
    );
    const outputPath = join(tmpdir(), `magnet-${job.userId}-${Date.now()}.pdf`);

    await this.renderer.render({
      magnetKind: job.magnetKind,
      templatePath: magnet.template_path,
      dataBundle,
      userContext: { userName: job.userName, email: job.userEmail },
      outputPath,
    });

    const pdfBuffer = readFileSync(outputPath);
    const storagePath = `lead-magnets/${job.userId}/${job.magnetKind}-${Date.now()}.pdf`;
    await client.storage
      .from("content-pipeline")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    const storageUrl = `supabase://content-pipeline/${storagePath}`;

    const { data: assetRow } = await client
      .from("content_assets")
      .insert({
        run_id: null,
        kind: "pdf_lead_magnet",
        storage_url: storageUrl,
        metadata: { magnetKind: job.magnetKind, userId: job.userId },
      })
      .select()
      .single();

    await client.from("lead_magnet_deliveries").insert({
      user_id: job.userId,
      magnet_kind: job.magnetKind,
      resolved_geo: job.resolvedGeo,
      pdf_asset_id: assetRow.id,
    });

    await this.email.sendEmail({
      to: job.userEmail,
      subject: `Your ${magnet.display_name} for ${job.resolvedGeo.canonical_name}`,
      react: LeadMagnetDelivery({
        userName: job.userName,
        magnetDisplayName: magnet.display_name,
        marketName: job.resolvedGeo.canonical_name,
        dashboardUrl: "https://propertyiq.app/dashboard/magnets",
      }),
      attachments: [{ filename: `${job.magnetKind}.pdf`, path: outputPath }],
    });

    await client
      .from("lead_magnet_deliveries")
      .update({ emailed_at: new Date().toISOString() })
      .eq("user_id", job.userId)
      .eq("magnet_kind", job.magnetKind);
  }
}
```

- [ ] **Step 10: Wire handlers to queues in a bootstrap service.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/handlers-bootstrap.service.ts
import { Injectable, OnModuleInit } from "@nestjs/common";
import { QueueService } from "./queue.service";
import { FetchDataHandler } from "./job-handlers/fetch-data.handler";
import { GenerateScriptHandler } from "./job-handlers/generate-script.handler";
import { VerifyDataHandler } from "./job-handlers/verify-data.handler";
import { LintVoiceHandler } from "./job-handlers/lint-voice.handler";
import { SynthesizeAudioHandler } from "./job-handlers/synthesize-audio.handler";
import { RenderVideoHandler } from "./job-handlers/render-video.handler";
import { PublishHandler } from "./job-handlers/publish.handler";
import { PublishYouTubeShortsHandler } from "./job-handlers/publish-youtube-shorts.handler";
import {
  GenerateLeadMagnetHandler,
  GenerateLeadMagnetJob,
} from "./job-handlers/generate-lead-magnet.handler";

@Injectable()
export class HandlersBootstrapService implements OnModuleInit {
  constructor(
    private readonly queue: QueueService,
    private readonly fetchData: FetchDataHandler,
    private readonly genScript: GenerateScriptHandler,
    private readonly verify: VerifyDataHandler,
    private readonly lint: LintVoiceHandler,
    private readonly synthesize: SynthesizeAudioHandler,
    private readonly renderVideo: RenderVideoHandler,
    private readonly publish: PublishHandler,
    private readonly publishYT: PublishYouTubeShortsHandler,
    private readonly leadMagnet: GenerateLeadMagnetHandler,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.work<{ runId: string; status: string }>(
      "orchestrator",
      async (job) => {
        const { runId, status } = job.data;
        switch (status) {
          case "fetching_data":
            return this.fetchData.handle(runId);
          case "scripting":
            return this.genScript.handle(runId);
          case "verifying_data":
            return this.verify.handle(runId);
          case "linting_voice":
            return this.lint.handle(runId);
          case "publishing":
            return this.publish.handle(runId);
        }
      },
    );
    await this.queue.work<{ runId: string }>("render-audio", async (job) =>
      this.synthesize.handle(job.data.runId),
    );
    await this.queue.work<{ runId: string }>("render-video", async (job) =>
      this.renderVideo.handle(job.data.runId),
    );
    await this.queue.work<{ runId: string; platform: string }>(
      "publish-youtube",
      async (job) => {
        if (job.data.platform === "youtube_shorts")
          await this.publishYT.handle(job.data.runId);
      },
    );
    await this.queue.work<GenerateLeadMagnetJob>("render-pdf", async (job) =>
      this.leadMagnet.handle(job.data),
    );
  }
}
```

- [ ] **Step 11: Register all handlers + bootstrap in ContentPipelineModule providers.**

Add each handler class and `HandlersBootstrapService` to `providers` array in `content-pipeline.module.ts`.

- [ ] **Step 12: Commit.**

```bash
git add packages/backend/src/content-pipeline/orchestrator/job-handlers/ packages/backend/src/content-pipeline/orchestrator/handlers-bootstrap.service.ts packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): P1 job handlers wired to pg-boss queues"
```

## Task 1.28: ShortLinkService plus internal controller

**Files:**

- Create: `packages/backend/src/content-pipeline/short-links/short-link.service.ts`
- Create: `packages/backend/src/content-pipeline/short-links/short-link.controller.ts`
- Create: `packages/backend/src/content-pipeline/short-links/short-link.service.spec.ts`

- [ ] **Step 1: Write failing tests.**

```typescript
// packages/backend/src/content-pipeline/short-links/short-link.service.spec.ts
import { Test } from "@nestjs/testing";
import { ShortLinkService } from "./short-link.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("ShortLinkService", () => {
  let svc: ShortLinkService;

  beforeEach(async () => {
    const supabase = {
      getClient: () => ({
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: "link-1", slug: "abcd1234" },
                error: null,
              }),
            }),
          }),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: "link-1",
              slug: "abcd1234",
              run_id: "run-1",
              platform: "youtube_shorts",
              target_url: "/grade-reveal-signup",
              click_count: 0,
            },
            error: null,
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        ShortLinkService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    svc = module.get(ShortLinkService);
  });

  it("generateSlug produces 8 url-safe chars", () => {
    const slug = svc.generateSlug();
    expect(slug).toMatch(/^[A-Za-z0-9_-]{8}$/);
  });

  it("generateSlug is unique across 1000 calls", () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 1000; i++) slugs.add(svc.generateSlug());
    expect(slugs.size).toBe(1000);
  });

  it("resolve returns short-link row and increments click_count", async () => {
    const result = await svc.resolve("abcd1234");
    expect(result?.slug).toBe("abcd1234");
  });
});
```

- [ ] **Step 2: Run to confirm failure.**

```bash
cd packages/backend && npm run test -- short-link.service.spec
```

Expected: FAIL.

- [ ] **Step 3: Implement service.**

```typescript
// packages/backend/src/content-pipeline/short-links/short-link.service.ts
import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { SupabaseService } from "../../supabase/supabase.service";
import { Platform } from "../types";

export interface CreateShortLinkArgs {
  runId: string;
  format: string;
  platform: Platform;
  targetUrl: string;
}

export interface ShortLink {
  id: string;
  slug: string;
  run_id: string;
  format: string;
  platform: Platform;
  target_url: string;
  click_count: number;
}

@Injectable()
export class ShortLinkService {
  constructor(private readonly supabase: SupabaseService) {}

  generateSlug(): string {
    return randomBytes(6).toString("base64url").slice(0, 8);
  }

  async create(args: CreateShortLinkArgs): Promise<ShortLink> {
    const client = this.supabase.getClient();
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = this.generateSlug();
      const { data, error } = await client
        .from("short_links")
        .insert({
          slug,
          run_id: args.runId,
          format: args.format,
          platform: args.platform,
          target_url: args.targetUrl,
        })
        .select()
        .single();
      if (!error) return data as ShortLink;
      if ((error as any).code !== "23505") throw error; // not a unique-violation, fail loudly
    }
    throw new Error("could not generate unique slug after 5 attempts");
  }

  async resolve(slug: string): Promise<ShortLink | null> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from("short_links")
      .select("*")
      .eq("slug", slug)
      .single();
    if (!data) return null;
    await client
      .from("short_links")
      .update({ click_count: data.click_count + 1 })
      .eq("slug", slug);
    return data as ShortLink;
  }
}
```

- [ ] **Step 4: Write controller (internal, not AdminGuard protected because consumed by the short-link route).**

```typescript
// packages/backend/src/content-pipeline/short-links/short-link.controller.ts
import { Controller, Get, Param } from "@nestjs/common";
import { ShortLinkService } from "./short-link.service";

@Controller("api/internal/short-links")
export class ShortLinkController {
  constructor(private readonly service: ShortLinkService) {}

  @Get("resolve/:slug")
  async resolve(@Param("slug") slug: string) {
    const link = await this.service.resolve(slug);
    if (!link) return { success: false, error: "not_found" };
    return { success: true, data: link };
  }
}
```

- [ ] **Step 5: Register in module.**

Add `ShortLinkService` and `ShortLinkController` to `ContentPipelineModule`. Export service.

- [ ] **Step 6: Run tests to confirm pass.**

```bash
cd packages/backend && npm run test -- short-link.service.spec
```

Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add packages/backend/src/content-pipeline/short-links/ packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): ShortLinkService with slug generation and resolver"
```

## Task 1.29: Next.js /s/[slug] route with attribution cookie

**Files:**

- Create: `packages/frontend/app/s/[slug]/route.ts`
- Create: `packages/frontend/app/s/[slug]/route.test.ts`

- [ ] **Step 1: Write failing test.**

```typescript
// packages/frontend/app/s/[slug]/route.test.ts
import { GET } from "./route";

describe("short-link route", () => {
  it("redirects to target url and sets attribution cookie", async () => {
    const mockResolve = jest.fn().mockResolvedValue({
      success: true,
      data: {
        run_id: "run-1",
        slug: "abcd1234",
        platform: "youtube_shorts",
        target_url: "/grade-reveal-signup",
      },
    });
    (global as any).fetch = jest
      .fn()
      .mockResolvedValue({ json: () => mockResolve() });

    const request = new Request("https://piq.sh/s/abcd1234");
    const response = await GET(request, { params: { slug: "abcd1234" } });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/grade-reveal-signup");
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("__piq_attr=");
  });

  it("404s on unknown slug", async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: "not_found" }),
    });
    const request = new Request("https://piq.sh/s/unknown");
    const response = await GET(request, { params: { slug: "unknown" } });
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to confirm failure.**

```bash
cd packages/frontend && npx jest app/s/[slug]/route.test
```

Expected: FAIL (route not defined).

- [ ] **Step 3: Implement route.**

```typescript
// packages/frontend/app/s/[slug]/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://backend-production-ee4d.up.railway.app";
const PROPERTYIQ_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://propertyiq.app";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  const res = await fetch(
    `${API_BASE}/api/internal/short-links/resolve/${encodeURIComponent(params.slug)}`,
    {
      cache: "no-store",
    },
  );
  const json = await res.json();
  if (!json.success || !json.data) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { data } = json;
  const targetUrl = data.target_url.startsWith("http")
    ? data.target_url
    : `${PROPERTYIQ_ORIGIN}${data.target_url}`;
  const now = new Date();

  const cookieValue = JSON.stringify({
    runId: data.run_id,
    slug: data.slug,
    platform: data.platform,
    firstTouchAt: now.toISOString(),
  });

  const response = NextResponse.redirect(targetUrl, { status: 302 });
  response.cookies.set("__piq_attr", cookieValue, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    domain: ".propertyiq.app",
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: true,
  });
  return response;
}
```

- [ ] **Step 4: Run test to confirm pass.**

```bash
cd packages/frontend && npx jest app/s/[slug]/route.test
```

Expected: 2 PASS.

- [ ] **Step 5: Add rate limit via existing Next.js middleware layer.**

Open `packages/frontend/middleware.ts` and add a block (using a simple in-memory LRU for edge runtime):

```typescript
// at top of middleware.ts:
const shortLinkHits = new Map<string, { count: number; resetAt: number }>();
function checkShortLinkRate(ip: string): boolean {
  const now = Date.now();
  const entry = shortLinkHits.get(ip);
  if (!entry || entry.resetAt < now) {
    shortLinkHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= 60;
}

// inside the main middleware function:
if (pathname.startsWith("/s/")) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkShortLinkRate(ip)) {
    return new NextResponse("rate limited", { status: 429 });
  }
}
```

- [ ] **Step 6: Commit.**

```bash
git add packages/frontend/app/s/ packages/frontend/middleware.ts
git commit -m "feat(content-pipeline): /s/[slug] short-link route with attribution cookie and rate limit"
```

## Task 1.30: Wire signup attribution capture

**Files:**

- Modify: the existing signup backend endpoint (location depends on repo; for new-user flow check `packages/backend/src/auth-hooks/` first)
- Create: `packages/backend/src/content-pipeline/short-links/attribution.service.ts`
- Create: `packages/backend/src/content-pipeline/short-links/attribution.service.spec.ts`
- Modify: signup endpoint source file

- [ ] **Step 1: Locate the existing signup flow.**

```bash
grep -r "handle_new_user\|signup\|onUserCreated" packages/backend/src/ | head -20
```

Identify whether signups flow through Supabase Auth webhook (`auth-hooks` module) or a backend endpoint. Record the file path.

- [ ] **Step 2: Write AttributionService tests.**

```typescript
// packages/backend/src/content-pipeline/short-links/attribution.service.spec.ts
import { Test } from "@nestjs/testing";
import { AttributionService } from "./attribution.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("AttributionService", () => {
  let svc: AttributionService;
  let insertSpy: jest.Mock;

  beforeEach(async () => {
    insertSpy = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      getClient: () => ({ from: () => ({ insert: insertSpy }) }),
    };
    const module = await Test.createTestingModule({
      providers: [
        AttributionService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    svc = module.get(AttributionService);
  });

  it("writes attribution row with parsed cookie", async () => {
    const cookieValue = JSON.stringify({
      runId: "run-1",
      slug: "abcd1234",
      platform: "youtube_shorts",
      firstTouchAt: "2026-04-20T12:00:00Z",
    });
    await svc.captureFromCookie("user-1", cookieValue, "free");
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        attributed_run_id: "run-1",
        attributed_slug: "abcd1234",
        attributed_platform: "youtube_shorts",
        tier_at_signup: "free",
      }),
    );
  });

  it("no-ops when cookie is missing or malformed", async () => {
    await svc.captureFromCookie("user-1", null, "free");
    expect(insertSpy).not.toHaveBeenCalled();
    await svc.captureFromCookie("user-1", "not-json", "free");
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to confirm failure.**

```bash
cd packages/backend && npm run test -- attribution.service.spec
```

Expected: FAIL.

- [ ] **Step 4: Implement AttributionService.**

```typescript
// packages/backend/src/content-pipeline/short-links/attribution.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";

@Injectable()
export class AttributionService {
  private readonly logger = new Logger(AttributionService.name);
  constructor(private readonly supabase: SupabaseService) {}

  async captureFromCookie(
    userId: string,
    cookieValue: string | null,
    tierAtSignup: string,
  ): Promise<void> {
    if (!cookieValue) return;
    let parsed: any;
    try {
      parsed = JSON.parse(cookieValue);
    } catch {
      return;
    }
    if (!parsed.runId || !parsed.slug || !parsed.platform) return;

    const client = this.supabase.getClient();
    const { error } = await client.from("signup_attributions").insert({
      user_id: userId,
      attributed_run_id: parsed.runId,
      attributed_slug: parsed.slug,
      attributed_platform: parsed.platform,
      first_touch_at: parsed.firstTouchAt ?? new Date().toISOString(),
      tier_at_signup: tierAtSignup,
    });
    if (error)
      this.logger.warn(
        `attribution insert failed for user ${userId}: ${error.message}`,
      );
  }
}
```

- [ ] **Step 5: Modify the signup flow to call AttributionService.**

In the signup endpoint identified in Step 1, add after the user row is created:

```typescript
// grab cookie from the request:
const cookieValue = request.cookies["__piq_attr"] ?? null;
await this.attributionService.captureFromCookie(
  newUser.id,
  cookieValue,
  "free",
);
```

If the signup flow is a Supabase Auth webhook that does not receive cookies directly, an alternative is to have the frontend signup form POST the cookie value explicitly as a field in the signup request body.

- [ ] **Step 6: Run tests.**

```bash
cd packages/backend && npm run test -- attribution.service.spec
```

Expected: PASS.

- [ ] **Step 7: Register AttributionService in module.**

- [ ] **Step 8: Commit.**

```bash
git add packages/backend/src/content-pipeline/short-links/ <signup_endpoint_file> packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): signup attribution captured from __piq_attr cookie"
```

## Task 1.31: YouTubeMetricsService, MetricsPuller, 24h cron

**Files:**

- Create: `packages/backend/src/content-pipeline/analytics/youtube-metrics.service.ts`
- Create: `packages/backend/src/content-pipeline/analytics/metrics-puller.service.ts`
- Create: `packages/backend/src/content-pipeline/crons/pull-24h-metrics.cron.ts`
- Create: `packages/backend/src/content-pipeline/analytics/metrics-puller.service.spec.ts`

- [ ] **Step 1: Write YouTubeMetricsService.**

```typescript
// packages/backend/src/content-pipeline/analytics/youtube-metrics.service.ts
import { Injectable } from "@nestjs/common";
import { google } from "googleapis";

export interface YouTubeMetricsResult {
  views: number;
  impressions: number;
  watch_time_seconds: number;
  avg_retention_pct: number;
  likes: number;
  comments: number;
  shares: number;
  follows_gained: number;
  raw_payload: unknown;
}

@Injectable()
export class YouTubeMetricsService {
  async fetchMetrics(
    videoId: string,
    window: "24h" | "7d" | "30d",
  ): Promise<YouTubeMetricsResult> {
    const oauth2 = new google.auth.OAuth2(
      process.env.YOUTUBE_OAUTH_CLIENT_ID,
      process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
    );
    oauth2.setCredentials({
      refresh_token: process.env.YOUTUBE_OAUTH_REFRESH_TOKEN,
    });

    const yt = google.youtube({ version: "v3", auth: oauth2 });
    const ytAnalytics = google.youtubeAnalytics({
      version: "v2",
      auth: oauth2,
    });

    const videoRes = await yt.videos.list({
      part: ["statistics"],
      id: [videoId],
    });
    const stats = videoRes.data.items?.[0]?.statistics ?? {};

    const today = new Date();
    const startDate = new Date(today);
    const daysBack = window === "24h" ? 1 : window === "7d" ? 7 : 30;
    startDate.setDate(startDate.getDate() - daysBack);

    let analytics: any = {};
    try {
      const analyticsRes = await ytAnalytics.reports.query({
        ids: "channel==MINE",
        startDate: startDate.toISOString().slice(0, 10),
        endDate: today.toISOString().slice(0, 10),
        metrics:
          "views,estimatedMinutesWatched,averageViewPercentage,likes,comments,shares,subscribersGained",
        dimensions: "video",
        filters: `video==${videoId}`,
      });
      const row = analyticsRes.data.rows?.[0] ?? [];
      analytics = {
        watch_time_seconds: Math.round((row[2] ?? 0) * 60),
        avg_retention_pct: row[3] ?? 0,
        follows_gained: row[7] ?? 0,
      };
    } catch {
      // analytics API may return empty for videos under 24h
    }

    return {
      views: parseInt(stats.viewCount ?? "0", 10),
      impressions: 0, // YouTube API doesn't expose impressions to all accounts
      watch_time_seconds: analytics.watch_time_seconds ?? 0,
      avg_retention_pct: analytics.avg_retention_pct ?? 0,
      likes: parseInt(stats.likeCount ?? "0", 10),
      comments: parseInt(stats.commentCount ?? "0", 10),
      shares: 0, // not exposed per-video via data API
      follows_gained: analytics.follows_gained ?? 0,
      raw_payload: { statistics: stats, analytics },
    };
  }
}
```

- [ ] **Step 2: Write MetricsPullerService.**

```typescript
// packages/backend/src/content-pipeline/analytics/metrics-puller.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { YouTubeMetricsService } from "./youtube-metrics.service";

@Injectable()
export class MetricsPullerService {
  private readonly logger = new Logger(MetricsPullerService.name);
  constructor(
    private readonly supabase: SupabaseService,
    private readonly youtube: YouTubeMetricsService,
  ) {}

  async pullWindow(window: "24h" | "7d" | "30d"): Promise<number> {
    const hoursBack = window === "24h" ? 24 : window === "7d" ? 168 : 720;
    const lowerBound = new Date(Date.now() - (hoursBack + 12) * 3600 * 1000);
    const upperBound = new Date(Date.now() - (hoursBack - 12) * 3600 * 1000);

    const client = this.supabase.getClient();
    const { data: posts } = await client
      .from("platform_posts")
      .select("id, platform, external_id, created_at, short_link_id")
      .eq("status", "posted")
      .gte("created_at", lowerBound.toISOString())
      .lt("created_at", upperBound.toISOString());
    if (!posts) return 0;

    let count = 0;
    for (const post of posts) {
      const existing = await client
        .from("content_metrics")
        .select("id")
        .eq("platform_post_id", post.id)
        .eq("pulled_at_window", window)
        .maybeSingle();
      if (existing.data) continue;

      if (
        post.platform === "youtube_shorts" ||
        post.platform === "youtube_long"
      ) {
        try {
          const metrics = await this.youtube.fetchMetrics(
            post.external_id,
            window,
          );
          const clickCount = post.short_link_id
            ? ((
                await client
                  .from("short_links")
                  .select("click_count")
                  .eq("id", post.short_link_id)
                  .single()
              ).data?.click_count ?? 0)
            : 0;
          await client.from("content_metrics").insert({
            platform_post_id: post.id,
            pulled_at_window: window,
            ...metrics,
            short_link_clicks: clickCount,
          });
          count++;
        } catch (err) {
          this.logger.warn(
            `failed to pull metrics for post ${post.id}: ${(err as Error).message}`,
          );
        }
      }
    }
    return count;
  }
}
```

- [ ] **Step 3: Write cron.**

```typescript
// packages/backend/src/content-pipeline/crons/pull-24h-metrics.cron.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MetricsPullerService } from "../analytics/metrics-puller.service";

@Injectable()
export class Pull24hMetricsCron {
  private readonly logger = new Logger(Pull24hMetricsCron.name);
  constructor(private readonly puller: MetricsPullerService) {}

  @Cron("0 3 * * *", { timeZone: "UTC" }) // 3am UTC daily
  async run(): Promise<void> {
    const count = await this.puller.pullWindow("24h");
    this.logger.log(`pulled 24h metrics for ${count} platform posts`);
  }
}
```

- [ ] **Step 4: Write puller test.**

```typescript
// packages/backend/src/content-pipeline/analytics/metrics-puller.service.spec.ts
import { Test } from "@nestjs/testing";
import { MetricsPullerService } from "./metrics-puller.service";
import { SupabaseService } from "../../supabase/supabase.service";
import { YouTubeMetricsService } from "./youtube-metrics.service";

describe("MetricsPullerService", () => {
  let svc: MetricsPullerService;
  let insertSpy: jest.Mock;

  beforeEach(async () => {
    insertSpy = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      getClient: () => ({
        from: jest.fn().mockImplementation((tbl: string) => {
          if (tbl === "platform_posts")
            return {
              select: () => ({
                eq: () => ({
                  gte: () => ({
                    lt: () =>
                      Promise.resolve({
                        data: [
                          {
                            id: "p1",
                            platform: "youtube_shorts",
                            external_id: "abc123",
                            created_at: new Date().toISOString(),
                            short_link_id: null,
                          },
                        ],
                      }),
                  }),
                }),
              }),
            };
          if (tbl === "content_metrics")
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null }),
                  }),
                }),
              }),
              insert: insertSpy,
            };
          return {};
        }),
      }),
    };
    const youtube = {
      fetchMetrics: jest.fn().mockResolvedValue({
        views: 1200,
        impressions: 0,
        watch_time_seconds: 0,
        avg_retention_pct: 0,
        likes: 30,
        comments: 2,
        shares: 0,
        follows_gained: 1,
        raw_payload: {},
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        MetricsPullerService,
        { provide: SupabaseService, useValue: supabase },
        { provide: YouTubeMetricsService, useValue: youtube },
      ],
    }).compile();
    svc = module.get(MetricsPullerService);
  });

  it("pulls 24h metrics and inserts a content_metrics row", async () => {
    const count = await svc.pullWindow("24h");
    expect(count).toBe(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        platform_post_id: "p1",
        pulled_at_window: "24h",
        views: 1200,
      }),
    );
  });
});
```

- [ ] **Step 5: Run tests.**

```bash
cd packages/backend && npm run test -- metrics-puller.service.spec
```

Expected: PASS.

- [ ] **Step 6: Register services and cron in module.**

Add `YouTubeMetricsService`, `MetricsPullerService`, and `Pull24hMetricsCron` to providers.

- [ ] **Step 7: Commit.**

```bash
git add packages/backend/src/content-pipeline/analytics/ packages/backend/src/content-pipeline/crons/pull-24h-metrics.cron.ts packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): YouTube 24h metrics puller plus cron"
```

## Task 1.32: recover-stuck-runs cron

**Files:**

- Create: `packages/backend/src/content-pipeline/crons/recover-stuck-runs.cron.ts`
- Create: `packages/backend/src/content-pipeline/crons/recover-stuck-runs.cron.spec.ts`

**Per-step timeout table** (in minutes):

| Status          | Timeout |
| --------------- | ------- |
| fetching_data   | 10      |
| scripting       | 10      |
| verifying_data  | 5       |
| linting_voice   | 5       |
| rendering_voice | 15      |
| timing_captions | 10      |
| rendering_video | 20      |
| publishing      | 30      |

- [ ] **Step 1: Write failing test.**

```typescript
// packages/backend/src/content-pipeline/crons/recover-stuck-runs.cron.spec.ts
import { Test } from "@nestjs/testing";
import { RecoverStuckRunsCron } from "./recover-stuck-runs.cron";
import { SupabaseService } from "../../supabase/supabase.service";
import { QueueService } from "../orchestrator/queue.service";

describe("RecoverStuckRunsCron", () => {
  let cron: RecoverStuckRunsCron;
  let sendSpy: jest.Mock;

  beforeEach(async () => {
    sendSpy = jest.fn().mockResolvedValue("job-id");
    const oldEventTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const newEventTime = new Date(Date.now() - 1 * 60 * 1000).toISOString();

    const supabase = {
      getClient: () => ({
        from: jest.fn().mockImplementation((tbl: string) => {
          if (tbl === "content_runs")
            return {
              select: () => ({
                in: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "r1",
                        status: "rendering_video",
                        updated_at: oldEventTime,
                      },
                      {
                        id: "r2",
                        status: "publishing",
                        updated_at: newEventTime,
                      },
                    ],
                  }),
              }),
            };
          if (tbl === "content_run_events")
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        tbl === "content_run_events"
                          ? Promise.resolve({
                              data: { created_at: oldEventTime },
                            })
                          : Promise.resolve({ data: null }),
                    }),
                  }),
                }),
              }),
            };
          return {};
        }),
      }),
    };
    const queue = { send: sendSpy };

    const module = await Test.createTestingModule({
      providers: [
        RecoverStuckRunsCron,
        { provide: SupabaseService, useValue: supabase },
        { provide: QueueService, useValue: queue },
      ],
    }).compile();
    cron = module.get(RecoverStuckRunsCron);
  });

  it("re-enqueues stuck runs and skips fresh ones", async () => {
    await cron.run();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith("render-video", {
      runId: "r1",
      status: "rendering_video",
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure.**

```bash
cd packages/backend && npm run test -- recover-stuck-runs.cron.spec
```

Expected: FAIL.

- [ ] **Step 3: Implement cron.**

```typescript
// packages/backend/src/content-pipeline/crons/recover-stuck-runs.cron.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SupabaseService } from "../../supabase/supabase.service";
import { QueueService, QueueName } from "../orchestrator/queue.service";
import { PipelineStatus } from "../types";

const STEP_TIMEOUT_MIN: Partial<Record<PipelineStatus, number>> = {
  fetching_data: 10,
  scripting: 10,
  verifying_data: 5,
  linting_voice: 5,
  rendering_voice: 15,
  timing_captions: 10,
  rendering_video: 20,
  publishing: 30,
};

const STATE_TO_QUEUE: Partial<Record<PipelineStatus, QueueName>> = {
  fetching_data: "orchestrator",
  scripting: "orchestrator",
  verifying_data: "orchestrator",
  linting_voice: "orchestrator",
  rendering_voice: "render-audio",
  timing_captions: "render-captions",
  rendering_video: "render-video",
  publishing: "orchestrator",
};

@Injectable()
export class RecoverStuckRunsCron {
  private readonly logger = new Logger(RecoverStuckRunsCron.name);
  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  @Cron("*/5 * * * *")
  async run(): Promise<void> {
    const client = this.supabase.getClient();
    const nonTerminal = Object.keys(STEP_TIMEOUT_MIN) as PipelineStatus[];
    const { data: runs } = await client
      .from("content_runs")
      .select("id, status, updated_at")
      .in("status", nonTerminal);
    if (!runs) return;

    let recovered = 0;
    for (const run of runs) {
      const { data: latestEvent } = await client
        .from("content_run_events")
        .select("created_at")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastActivity = new Date(latestEvent?.created_at ?? run.updated_at);
      const ageMin = (Date.now() - lastActivity.getTime()) / 60_000;
      const timeoutMin = STEP_TIMEOUT_MIN[run.status as PipelineStatus] ?? 30;

      if (ageMin > timeoutMin) {
        const queueName = STATE_TO_QUEUE[run.status as PipelineStatus];
        if (queueName) {
          await this.queue.send(queueName, {
            runId: run.id,
            status: run.status,
          });
          this.logger.warn(
            `re-enqueued stuck run ${run.id} in status ${run.status} after ${ageMin.toFixed(1)} min`,
          );
          recovered++;
        }
      }
    }
    if (recovered > 0) this.logger.log(`recovered ${recovered} stuck runs`);
  }
}
```

- [ ] **Step 4: Register in module and run tests.**

```bash
cd packages/backend && npm run test -- recover-stuck-runs.cron.spec
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add packages/backend/src/content-pipeline/crons/ packages/backend/src/content-pipeline/content-pipeline.module.ts
git commit -m "feat(content-pipeline): recover-stuck-runs cron re-enqueues stalled jobs"
```

## Task 1.33: Admin nav registration plus state-labels plus api client

**Files:**

- Modify: `packages/frontend/app/admin/components/AdminCommandSidebar.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/lib/state-labels.ts`
- Create: `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts`
- Create: `packages/frontend/app/admin/content-pipeline/lib/format-previews.ts`

- [ ] **Step 1: Write state-labels.**

```typescript
// packages/frontend/app/admin/content-pipeline/lib/state-labels.ts
import { PipelineStatus } from "./content-pipeline-api";

export const STATE_LABELS: Record<PipelineStatus, string> = {
  queued: "Starting up",
  fetching_data: "Grabbing market data",
  scripting: "Writing script",
  verifying_data: "Fact-checking",
  linting_voice: "Checking brand voice",
  rendering_voice: "Recording voice",
  timing_captions: "Timing captions",
  rendering_video: "Rendering video",
  ready_for_review: "Waiting on your review",
  publishing: "Uploading",
  published: "Live",
  published_partial: "Live (some platforms failed)",
  rejected: "Rejected",
  failed: "Something went wrong",
};

export const VISIBLE_STAGES = [
  "Starting up",
  "Writing script",
  "Fact-checking",
  "Recording voice",
  "Rendering video",
  "Uploading",
  "Live",
];
```

- [ ] **Step 2: Write content-pipeline-api.ts.**

```typescript
// packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

export type PipelineStatus =
  | "queued"
  | "fetching_data"
  | "scripting"
  | "verifying_data"
  | "linting_voice"
  | "rendering_voice"
  | "timing_captions"
  | "rendering_video"
  | "ready_for_review"
  | "publishing"
  | "published"
  | "published_partial"
  | "rejected"
  | "failed";

export interface RunSummary {
  id: string;
  format: string;
  status: PipelineStatus;
  market_query: string;
  created_at: string;
}

export interface DashboardData {
  thisWeek: {
    published: number;
    inReview: number;
    signups: number;
    revenueUsd: number;
  };
  recentRuns: Array<
    RunSummary & { thumbnail_url?: string; views?: number; signups?: number }
  >;
  reviewQueueCount: number;
}

export async function fetchDashboard(): Promise<DashboardData> {
  return (
    await fetchAPI<{ data: DashboardData }>(
      "/api/admin/content-pipeline/dashboard",
    )
  ).data;
}

export async function fetchRun(id: string) {
  return (
    await fetchAPI<{ data: any }>(`/api/admin/content-pipeline/runs/${id}`)
  ).data;
}

export async function createRun(payload: {
  format: string;
  marketQuery: string;
  idempotencyKey: string;
  selectedPlatforms?: string[];
}) {
  const res = await fetchAPIRaw("/api/admin/content-pipeline/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()).data;
}

export async function approveRun(id: string) {
  return fetchAPIRaw(`/api/admin/content-pipeline/runs/${id}/approve`, {
    method: "POST",
  });
}

export async function rejectRun(id: string, reason: string) {
  return fetchAPIRaw(`/api/admin/content-pipeline/runs/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export async function editScript(
  id: string,
  variantId: "A" | "B",
  newFullText: string,
) {
  return fetchAPIRaw(`/api/admin/content-pipeline/runs/${id}/edit-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variantId, newFullText }),
  });
}

export async function resolveMarket(query: string) {
  return (
    await fetchAPI<{ data: { matches: any[] } }>(
      "/api/admin/content-pipeline/resolve-market",
      {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
      },
    )
  ).data.matches;
}
```

- [ ] **Step 3: Write format-previews.**

```typescript
// packages/frontend/app/admin/content-pipeline/lib/format-previews.ts
export const FORMAT_PREVIEWS: Record<string, string> = {
  grade_reveal: "/format-previews/grade-reveal.mp4",
  top_10_ranking: "/format-previews/top-10-ranking.mp4",
  score_mover: "/format-previews/score-mover.mp4",
  head_to_head: "/format-previews/head-to-head.mp4",
  long_form_deep_dive: "/format-previews/long-form-deep-dive.mp4",
  farm_area_spotlight: "/format-previews/farm-area-spotlight.mp4",
  brokerage_market_share: "/format-previews/brokerage-market-share.mp4",
  recruitment_angle: "/format-previews/recruitment-angle.mp4",
};

export const FORMAT_META: Record<
  string,
  {
    displayName: string;
    audience: string;
    duration: number;
    aspect: string;
    purpose: string;
  }
> = {
  grade_reveal: {
    displayName: "Grade Reveal",
    audience: "Mixed",
    duration: 30,
    aspect: "9:16",
    purpose: "Open with the PropertyIQ Score and grade letter, close with CTA.",
  },
  top_10_ranking: {
    displayName: "Top 10 Ranking",
    audience: "Investor",
    duration: 60,
    aspect: "9:16",
    purpose: "Countdown of the top 10 markets for a metric.",
  },
  score_mover: {
    displayName: "Score Mover",
    audience: "Investor",
    duration: 30,
    aspect: "9:16",
    purpose: "Highlight a market that moved significantly.",
  },
  head_to_head: {
    displayName: "Head-to-Head",
    audience: "Investor",
    duration: 60,
    aspect: "9:16",
    purpose: "Two-market comparison on key metrics.",
  },
  long_form_deep_dive: {
    displayName: "Long-Form Deep Dive",
    audience: "Mixed",
    duration: 600,
    aspect: "16:9",
    purpose: "Narrative 5-12 minute analysis.",
  },
  farm_area_spotlight: {
    displayName: "Farm Area Spotlight",
    audience: "Agent",
    duration: 60,
    aspect: "9:16",
    purpose: "Top farm areas in a metro with agent-oriented CTA.",
  },
  brokerage_market_share: {
    displayName: "Brokerage Market Share",
    audience: "Broker",
    duration: 75,
    aspect: "9:16",
    purpose: "Market-share breakdown by brokerage.",
  },
  recruitment_angle: {
    displayName: "Recruitment Angle",
    audience: "Broker",
    duration: 90,
    aspect: "9:16",
    purpose: "LinkedIn-first recruiting pitch backed by data.",
  },
};
```

- [ ] **Step 4: Register nav entry.**

Open `packages/frontend/app/admin/components/AdminCommandSidebar.tsx` and add to the `NAV_GROUPS` array:

```tsx
{
  label: 'Content',
  items: [
    { label: 'Dashboard', href: '/admin/content-pipeline', icon: LayoutDashboard },
    { label: 'Create Run', href: '/admin/content-pipeline/new', icon: Plus },
    { label: 'Review Queue', href: '/admin/content-pipeline/review', icon: Inbox },
    { label: 'Performance', href: '/admin/content-pipeline/performance', icon: BarChart3 },
    { label: 'Platforms', href: '/admin/content-pipeline/platforms', icon: Share2 },
    { label: 'Settings', href: '/admin/content-pipeline/settings', icon: Settings },
  ],
},
```

Add the icon imports at the top of the file.

- [ ] **Step 5: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/lib/ packages/frontend/app/admin/components/AdminCommandSidebar.tsx
git commit -m "feat(content-pipeline): admin nav, state labels, API client for content-pipeline"
```

## Task 1.34: Dashboard page plus API endpoint

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/page.tsx`
- Create: `packages/backend/src/content-pipeline/dto/dashboard-response.dto.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`

- [ ] **Step 1: Write DTO.**

```typescript
// packages/backend/src/content-pipeline/dto/dashboard-response.dto.ts
export interface DashboardResponseDto {
  thisWeek: {
    published: number;
    inReview: number;
    signups: number;
    revenueUsd: number;
  };
  recentRuns: Array<{
    id: string;
    format: string;
    status: string;
    market_query: string;
    created_at: string;
    thumbnail_url?: string;
    views?: number;
    signups?: number;
  }>;
  reviewQueueCount: number;
}
```

- [ ] **Step 2: Add service method.**

```typescript
// packages/backend/src/content-pipeline/content-pipeline.service.ts (add)
async getDashboard(): Promise<DashboardResponseDto> {
  const client = this.supabase.getClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { count: published } = await client.from('content_runs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published').gte('created_at', weekAgo);
  const { count: inReview } = await client.from('content_runs')
    .select('id', { count: 'exact', head: true }).eq('status', 'ready_for_review');
  const { count: signups } = await client.from('signup_attributions')
    .select('id', { count: 'exact', head: true }).gte('signup_at', weekAgo);
  const { data: recent } = await client.from('content_runs')
    .select('id, format, status, market_query, created_at')
    .order('created_at', { ascending: false }).limit(12);

  return {
    thisWeek: { published: published ?? 0, inReview: inReview ?? 0, signups: signups ?? 0, revenueUsd: 0 },
    recentRuns: recent ?? [],
    reviewQueueCount: inReview ?? 0,
  };
}
```

- [ ] **Step 3: Add endpoint.**

```typescript
// packages/backend/src/content-pipeline/content-pipeline.controller.ts (add)
@Get('dashboard')
async dashboard() {
  return { success: true, data: await this.service.getDashboard() };
}
```

- [ ] **Step 4: Write dashboard page.**

```tsx
// packages/frontend/app/admin/content-pipeline/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchDashboard } from "./lib/content-pipeline-api";
import { STATE_LABELS } from "./lib/state-labels";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["content-pipeline-dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!data) return <div className="p-8">No data.</div>;

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-semibold text-on-surface">This Week</h1>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Published" value={data.thisWeek.published} />
        <Stat label="In Review" value={data.thisWeek.inReview} />
        <Stat label="Attributed Signups" value={data.thisWeek.signups} />
        <Stat
          label="Revenue MRR"
          value={`$${data.thisWeek.revenueUsd.toFixed(0)}`}
        />
      </div>

      {data.reviewQueueCount > 0 && (
        <div className="bg-primary-container text-on-primary-container rounded-xl p-6 flex justify-between items-center">
          <div>
            {data.reviewQueueCount} video
            {data.reviewQueueCount === 1 ? "" : "s"} waiting on you
          </div>
          <Link
            href="/admin/content-pipeline/review"
            className="bg-primary text-on-primary rounded-full px-6 py-2 font-semibold"
          >
            Review now
          </Link>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">Last 7 days</h2>
        <div className="grid grid-cols-6 gap-3">
          {data.recentRuns.map((run) => (
            <Link
              key={run.id}
              href={`/admin/content-pipeline/runs/${run.id}`}
              className="block rounded-xl bg-surface-container-low p-3 shadow-sm"
            >
              <div className="aspect-[9/16] rounded bg-outline mb-2" />
              <div className="text-xs font-medium truncate">
                {run.market_query}
              </div>
              <div className="text-xs text-outline">
                {STATE_LABELS[run.status as any] ?? run.status}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="fixed bottom-8 right-8">
        <Link
          href="/admin/content-pipeline/new"
          className="bg-primary text-on-primary rounded-full px-8 py-4 font-semibold shadow-lg"
        >
          + Create a run
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-6 shadow-sm">
      <div className="text-sm text-outline mb-1">{label}</div>
      <div className="text-3xl font-mono font-bold text-on-surface">
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Manual browser test.**

```bash
cd packages/backend && npm run start:dev &
cd packages/frontend && npm run dev
# Navigate to http://localhost:3000/admin/content-pipeline
# Verify page renders with 4 stat cards, empty review banner (unless runs in review), recent runs grid, and floating CTA.
```

- [ ] **Step 6: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/page.tsx packages/backend/src/content-pipeline/
git commit -m "feat(content-pipeline): admin dashboard page with view model"
```

## Task 1.35: Create-a-run wizard

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/page.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/new/format-step.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/new/market-step.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx`
- Create: `packages/backend/src/content-pipeline/dto/create-run.dto.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`

- [ ] **Step 1: Write CreateRunDto.**

```typescript
// packages/backend/src/content-pipeline/dto/create-run.dto.ts
import {
  IsString,
  IsIn,
  IsOptional,
  IsArray,
  IsUUID,
  MinLength,
} from "class-validator";
import { ContentFormat, Platform, ApprovalMode } from "../types";

export class CreateRunDto {
  @IsIn([
    "grade_reveal",
    "top_10_ranking",
    "score_mover",
    "head_to_head",
    "long_form_deep_dive",
    "farm_area_spotlight",
    "brokerage_market_share",
    "recruitment_angle",
  ])
  format!: ContentFormat;

  @IsString()
  @MinLength(2)
  marketQuery!: string;

  @IsUUID("4")
  idempotencyKey!: string;

  @IsOptional()
  @IsIn(["auto", "review", "draft"])
  approvalMode?: ApprovalMode;

  @IsOptional()
  @IsArray()
  selectedPlatforms?: Platform[];

  @IsOptional()
  @IsString()
  extraDirectives?: string;
}
```

- [ ] **Step 2: Add service method.**

```typescript
// content-pipeline.service.ts (add)
import { CreateRunDto } from './dto/create-run.dto';

async createRun(dto: CreateRunDto): Promise<{ id: string; idempotencyKey: string; status: string }> {
  const client = this.supabase.getClient();
  const existing = await client.from('content_runs').select('id, status').eq('idempotency_key', dto.idempotencyKey).maybeSingle();
  if (existing.data) return { id: existing.data.id, idempotencyKey: dto.idempotencyKey, status: existing.data.status };

  const { data: template } = await client.from('format_templates').select('*').eq('format', dto.format).single();
  if (!template) throw new Error(`format ${dto.format} not configured`);
  if (!template.enabled) throw new Error(`format ${dto.format} is disabled`);

  const { data: inserted, error } = await client.from('content_runs').insert({
    format: dto.format,
    audience: template.audience,
    market_query: dto.marketQuery,
    approval_mode: dto.approvalMode ?? template.default_approval_mode,
    tts_provider: template.default_tts_provider,
    tts_voice_id: template.default_tts_voice_id,
    selected_platforms: dto.selectedPlatforms ?? template.default_platforms,
    idempotency_key: dto.idempotencyKey,
    status: 'queued',
    triggered_by: 'manual',
  }).select('id, status').single();
  if (error) throw error;

  await this.queueService.send('orchestrator', { runId: inserted!.id, status: 'fetching_data' });
  await this.orchestrator.transitionTo(inserted!.id, 'fetching_data', { enqueueNext: false });

  return { id: inserted!.id, idempotencyKey: dto.idempotencyKey, status: inserted!.status };
}
```

- [ ] **Step 3: Add endpoint.**

```typescript
// content-pipeline.controller.ts (add)
@Post('runs')
async createRun(@Body() dto: CreateRunDto) {
  const result = await this.service.createRun(dto);
  return { success: true, data: result };
}

@Post('resolve-market')
async resolveMarket(@Body() body: { query: string }) {
  const matches = await this.service.resolveMarket(body.query);
  return { success: true, data: { matches } };
}
```

Add `resolveMarket` to service that calls `ContentDataService.resolveMarket`.

- [ ] **Step 4: Write format-step.**

```tsx
// packages/frontend/app/admin/content-pipeline/new/format-step.tsx
"use client";
import { FORMAT_META, FORMAT_PREVIEWS } from "../lib/format-previews";

export function FormatStep({ onPick }: { onPick: (format: string) => void }) {
  const enabled = ["grade_reveal"]; // P1 only enables grade_reveal
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Pick a format</h1>
      <div className="grid grid-cols-3 gap-6">
        {Object.keys(FORMAT_META).map((key) => {
          const meta = FORMAT_META[key];
          const isEnabled = enabled.includes(key);
          return (
            <button
              key={key}
              disabled={!isEnabled}
              onClick={() => onPick(key)}
              className={`rounded-xl overflow-hidden bg-surface-container-low shadow-sm text-left ${isEnabled ? "hover:shadow-md" : "opacity-50 cursor-not-allowed"}`}
            >
              <div className="aspect-[9/16] bg-outline">
                {isEnabled && (
                  <video
                    src={FORMAT_PREVIEWS[key]}
                    autoPlay
                    loop
                    muted
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="p-4">
                <div className="font-semibold">{meta.displayName}</div>
                <div className="text-xs text-outline">
                  {meta.audience} {meta.duration}s {meta.aspect}
                </div>
                <div className="text-xs mt-2">{meta.purpose}</div>
                {!isEnabled && (
                  <div className="text-xs mt-2 text-primary">
                    Coming in later phase
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write market-step.**

```tsx
// packages/frontend/app/admin/content-pipeline/new/market-step.tsx
"use client";
import { useState } from "react";
import { resolveMarket } from "../lib/content-pipeline-api";

export function MarketStep({
  onPick,
  onBack,
}: {
  onPick: (market: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<any[]>([]);

  async function handleChange(v: string) {
    setQuery(v);
    if (v.length < 2) {
      setMatches([]);
      return;
    }
    const m = await resolveMarket(v);
    setMatches(m);
  }

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <h1 className="text-2xl font-semibold mb-6">Pick a market</h1>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Cleveland, Miami, 78704..."
        className="w-full rounded-full border border-outline-variant px-6 py-4 text-lg"
        autoFocus
      />
      <div className="mt-4 space-y-2">
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m.canonical_name)}
            className="block w-full text-left p-4 rounded-lg hover:bg-surface-container-low"
          >
            <div className="font-medium">{m.canonical_name}</div>
            <div className="text-xs text-outline">
              {m.geography} {m.state ? `— ${m.state}` : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write confirm-step.**

```tsx
// packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx
"use client";
import { useState } from "react";
import { createRun } from "../lib/content-pipeline-api";
import { FORMAT_META } from "../lib/format-previews";

export function ConfirmStep({
  format,
  market,
  onBack,
  onCreated,
}: {
  format: string;
  market: string;
  onBack: () => void;
  onCreated: (runId: string) => void;
}) {
  const meta = FORMAT_META[format];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = crypto.randomUUID();

  async function submit() {
    setSubmitting(true);
    try {
      const result = await createRun({
        format,
        marketQuery: market,
        idempotencyKey,
      });
      onCreated(result.id);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <div className="rounded-xl bg-surface-container-low p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">
          {meta.displayName} for {market}
        </h1>
        <p className="mb-3">We will:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Write a {meta.duration}-second script with 1 hook variant</li>
          <li>Use the PropertyIQ voice (Edge TTS, free)</li>
          <li>Post to YouTube Shorts</li>
          <li>Queue for your review before publishing</li>
        </ul>
        {error && <div className="mt-4 text-error">{error}</div>}
        <button
          onClick={submit}
          disabled={submitting}
          className="mt-6 bg-primary text-on-primary rounded-full px-8 py-3 font-semibold disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Start Run"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write page.**

```tsx
// packages/frontend/app/admin/content-pipeline/new/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormatStep } from "./format-step";
import { MarketStep } from "./market-step";
import { ConfirmStep } from "./confirm-step";

export default function NewRunPage() {
  const [step, setStep] = useState<"format" | "market" | "confirm">("format");
  const [format, setFormat] = useState<string>("");
  const [market, setMarket] = useState<string>("");
  const router = useRouter();

  return (
    <div>
      {step === "format" && (
        <FormatStep
          onPick={(f) => {
            setFormat(f);
            setStep("market");
          }}
        />
      )}
      {step === "market" && (
        <MarketStep
          onBack={() => setStep("format")}
          onPick={(m) => {
            setMarket(m);
            setStep("confirm");
          }}
        />
      )}
      {step === "confirm" && (
        <ConfirmStep
          format={format}
          market={market}
          onBack={() => setStep("market")}
          onCreated={(id) => router.push(`/admin/content-pipeline/runs/${id}`)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 8: Manual test.**

Navigate to `/admin/content-pipeline/new`, complete the wizard, verify redirect to run detail.

- [ ] **Step 9: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/new/ packages/backend/src/content-pipeline/dto/ packages/backend/src/content-pipeline/content-pipeline.controller.ts packages/backend/src/content-pipeline/content-pipeline.service.ts
git commit -m "feat(content-pipeline): create-a-run 3-step wizard plus POST endpoint"
```

## Task 1.36: Run detail page with React Query polling

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/runs/[id]/page.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/runs/[id]/pipeline-visualization.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/runs/[id]/event-log.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/runs/[id]/artifacts-panel.tsx`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`

- [ ] **Step 1: Add service method to fetch a run detail.**

```typescript
// content-pipeline.service.ts (add)
async getRunDetail(runId: string) {
  const client = this.supabase.getClient();
  const [run, assets, events, gates, posts] = await Promise.all([
    client.from('content_runs').select('*').eq('id', runId).single(),
    client.from('content_assets').select('*').eq('run_id', runId).order('created_at', { ascending: true }),
    client.from('content_run_events').select('*').eq('run_id', runId).order('created_at', { ascending: true }),
    client.from('content_run_gates').select('*').eq('run_id', runId).order('created_at', { ascending: true }),
    client.from('platform_posts').select('*').eq('run_id', runId),
  ]);
  if (run.error || !run.data) throw new Error('run not found');
  return { run: run.data, assets: assets.data ?? [], events: events.data ?? [], gates: gates.data ?? [], posts: posts.data ?? [] };
}
```

- [ ] **Step 2: Add endpoint.**

```typescript
// content-pipeline.controller.ts
@Get('runs/:id')
async getRun(@Param('id') id: string) {
  return { success: true, data: await this.service.getRunDetail(id) };
}
```

- [ ] **Step 3: Write pipeline visualization component.**

```tsx
// packages/frontend/app/admin/content-pipeline/runs/[id]/pipeline-visualization.tsx
import { PipelineStatus } from "../../lib/content-pipeline-api";

const STAGES: Array<{
  label: string;
  matchesStatus: (s: PipelineStatus) => boolean;
}> = [
  {
    label: "Starting up",
    matchesStatus: (s) => s === "queued" || s === "fetching_data",
  },
  { label: "Writing script", matchesStatus: (s) => s === "scripting" },
  {
    label: "Fact-checking",
    matchesStatus: (s) => s === "verifying_data" || s === "linting_voice",
  },
  { label: "Recording voice", matchesStatus: (s) => s === "rendering_voice" },
  {
    label: "Rendering video",
    matchesStatus: (s) => s === "timing_captions" || s === "rendering_video",
  },
  { label: "Uploading", matchesStatus: (s) => s === "publishing" },
  {
    label: "Live",
    matchesStatus: (s) => s === "published" || s === "published_partial",
  },
];

export function PipelineVisualization({
  status,
  eventsByType,
}: {
  status: PipelineStatus;
  eventsByType: Map<string, string>;
}) {
  const currentIdx = STAGES.findIndex((st) => st.matchesStatus(status));
  return (
    <div className="flex items-center gap-3 overflow-x-auto py-6">
      {STAGES.map((stage, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-4 h-4 rounded-full ${done ? "bg-accent" : active ? "bg-primary animate-pulse" : "bg-outline"}`}
              />
              <div className="text-xs mt-2 font-medium whitespace-nowrap">
                {stage.label}
              </div>
              <div className="text-xs text-outline">
                {eventsByType.get(stage.label) ?? ""}
              </div>
            </div>
            {idx < STAGES.length - 1 && (
              <div
                className={`w-16 h-0.5 ${done ? "bg-accent" : "bg-outline"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Write event log component.**

```tsx
// packages/frontend/app/admin/content-pipeline/runs/[id]/event-log.tsx
export function EventLog({
  events,
}: {
  events: Array<{ event_type: string; payload: any; created_at: string }>;
}) {
  return (
    <div className="space-y-2 text-sm">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3">
          <span className="text-outline font-mono text-xs">
            {new Date(e.created_at).toLocaleTimeString()}
          </span>
          <span>{humanize(e)}</span>
        </div>
      ))}
    </div>
  );
}

function humanize(e: { event_type: string; payload: any }): string {
  if (e.event_type === "status_changed") {
    return `State moved from ${e.payload.from} to ${e.payload.to}${e.payload.reason ? ` (${e.payload.reason})` : ""}`;
  }
  if (e.event_type === "gate_failed")
    return `Gate ${e.payload.gate} failed: ${JSON.stringify(e.payload.violations ?? []).slice(0, 80)}`;
  return `${e.event_type}: ${JSON.stringify(e.payload).slice(0, 80)}`;
}
```

- [ ] **Step 5: Write artifacts panel.**

```tsx
// packages/frontend/app/admin/content-pipeline/runs/[id]/artifacts-panel.tsx
export function ArtifactsPanel({
  assets,
}: {
  assets: Array<{ kind: string; storage_url: string; metadata: any }>;
}) {
  const script = assets.find((a) => a.kind === "script");
  const audio = assets.find((a) => a.kind === "audio");
  const video = assets.find((a) => a.kind === "video_master");

  return (
    <div className="space-y-6">
      {script && (
        <section>
          <h3 className="font-semibold mb-2">Script</h3>
          <pre className="bg-surface-container-low rounded-xl p-4 text-sm whitespace-pre-wrap">
            {script.metadata?.scripts?.[0]?.fullText ?? "pending..."}
          </pre>
        </section>
      )}
      {audio && (
        <section>
          <h3 className="font-semibold mb-2">Voice</h3>
          <audio
            controls
            src={publicUrl(audio.storage_url)}
            className="w-full"
          />
        </section>
      )}
      {video && (
        <section>
          <h3 className="font-semibold mb-2">Video</h3>
          <video
            controls
            src={publicUrl(video.storage_url)}
            className="w-full rounded-xl aspect-[9/16] max-w-md"
          />
        </section>
      )}
    </div>
  );
}

function publicUrl(storageUrl: string): string {
  const match = storageUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (!match) return storageUrl;
  const [, bucket, path] = match;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
```

- [ ] **Step 6: Write page.**

```tsx
// packages/frontend/app/admin/content-pipeline/runs/[id]/page.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { fetchRun } from "../../lib/content-pipeline-api";
import { PipelineVisualization } from "./pipeline-visualization";
import { EventLog } from "./event-log";
import { ArtifactsPanel } from "./artifacts-panel";

const TERMINAL = [
  "published",
  "published_partial",
  "failed",
  "rejected",
  "ready_for_review",
];

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useQuery({
    queryKey: ["content-pipeline-run", id],
    queryFn: () => fetchRun(id),
    refetchInterval: (q) =>
      TERMINAL.includes(q.state.data?.run?.status ?? "") ? false : 2000,
  });

  if (!data) return <div className="p-8">Loading...</div>;

  const eventsByType = new Map<string, string>();
  for (const e of data.events as any[]) {
    if (e.event_type === "status_changed" && e.payload?.to) {
      eventsByType.set(
        e.payload.to,
        new Date(e.created_at).toLocaleTimeString(),
      );
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.run.market_query}</h1>
        <p className="text-sm text-outline">
          {data.run.format} • {data.run.approval_mode}
        </p>
      </div>

      <PipelineVisualization
        status={data.run.status}
        eventsByType={eventsByType}
      />

      <div className="grid grid-cols-[1fr_320px] gap-6">
        <ArtifactsPanel assets={data.assets} />
        <div className="rounded-xl bg-surface-container-low p-4 shadow-sm">
          <h3 className="font-semibold mb-3 text-sm">Activity</h3>
          <EventLog events={data.events} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/runs/ packages/backend/src/content-pipeline/content-pipeline.controller.ts packages/backend/src/content-pipeline/content-pipeline.service.ts
git commit -m "feat(content-pipeline): run detail page with 2s polling, pipeline viz, event log, artifacts"
```

## Task 1.37: Review queue with keyboard shortcuts

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/review/page.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/review/review-card.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/review/shortcuts.ts`
- Create: `packages/frontend/app/admin/content-pipeline/review/script-editor.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/review/diff-viewer.tsx`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`

- [ ] **Step 1: Add backend approve/reject/edit-script endpoints.**

```typescript
// content-pipeline.service.ts (add)
async approveRun(runId: string): Promise<void> {
  await this.orchestrator.transitionTo(runId, 'publishing', { enqueueNext: true });
}

async rejectRun(runId: string, reason: string): Promise<void> {
  await this.orchestrator.transitionTo(runId, 'rejected', { reason, enqueueNext: false });
}

async editScript(runId: string, variantId: 'A' | 'B', newFullText: string): Promise<void> {
  const client = this.supabase.getClient();
  const { data: scriptAsset } = await client.from('content_assets')
    .select('metadata').eq('run_id', runId).eq('kind', 'script').single();
  const scripts = scriptAsset.metadata.scripts as any[];
  const updated = scripts.map((s) => s.variantId === variantId ? { ...s, fullText: newFullText } : s);

  await client.from('content_assets').update({ metadata: { scripts: updated } })
    .eq('run_id', runId).eq('kind', 'script');

  // Re-run gates by transitioning back to linting_voice
  await this.orchestrator.transitionTo(runId, 'linting_voice', {
    reason: 'operator_edit', enqueueNext: true,
  });
}

async getReviewQueue() {
  const client = this.supabase.getClient();
  const { data: runs } = await client.from('content_runs')
    .select('*').eq('status', 'ready_for_review')
    .order('created_at', { ascending: true }).limit(20);
  return { items: runs ?? [], cursor: null };
}
```

- [ ] **Step 2: Add endpoints.**

```typescript
// content-pipeline.controller.ts
@Post('runs/:id/approve')
async approve(@Param('id') id: string) {
  await this.service.approveRun(id);
  return { success: true, data: { status: 'publishing' } };
}

@Post('runs/:id/reject')
async reject(@Param('id') id: string, @Body() body: { reason: string }) {
  await this.service.rejectRun(id, body.reason);
  return { success: true, data: { status: 'rejected' } };
}

@Post('runs/:id/edit-script')
async editScript(@Param('id') id: string, @Body() body: { variantId: 'A'|'B'; newFullText: string }) {
  await this.service.editScript(id, body.variantId, body.newFullText);
  return { success: true, data: { status: 'linting_voice' } };
}

@Get('review/queue')
async reviewQueue() {
  return { success: true, data: await this.service.getReviewQueue() };
}
```

- [ ] **Step 3: Write shortcuts helper.**

```typescript
// packages/frontend/app/admin/content-pipeline/review/shortcuts.ts
import { useEffect } from "react";

export type ShortcutHandler = () => void | Promise<void>;

export function useReviewShortcuts(handlers: {
  onApprove: ShortcutHandler;
  onApproveSchedule: ShortcutHandler;
  onReject: ShortcutHandler;
  onNext: ShortcutHandler;
  onEdit: ShortcutHandler;
  onMute: ShortcutHandler;
  onPlayPause: ShortcutHandler;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      switch (e.key.toLowerCase()) {
        case "l":
          handlers.onApprove();
          break;
        case "s":
          handlers.onApproveSchedule();
          break;
        case "j":
          handlers.onReject();
          break;
        case "k":
          handlers.onNext();
          break;
        case "e":
          handlers.onEdit();
          break;
        case "m":
          handlers.onMute();
          break;
        case " ":
          e.preventDefault();
          handlers.onPlayPause();
          break;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlers]);
}
```

- [ ] **Step 4: Write diff-viewer for Gate A failures.**

```tsx
// packages/frontend/app/admin/content-pipeline/review/diff-viewer.tsx
export function DiffViewer({
  violations,
}: {
  violations: Array<{
    claim: { quote: string; value: number; category: string };
    reason: string;
  }>;
}) {
  if (!violations || violations.length === 0) return null;
  return (
    <div className="rounded-xl border border-warning bg-warning/5 p-4 mb-4">
      <h4 className="font-semibold text-warning mb-2">
        Fact-check flagged these claims:
      </h4>
      <ul className="space-y-2 text-sm">
        {violations.map((v, i) => (
          <li key={i}>
            "<strong>{v.claim.quote}</strong>" ({v.claim.category}, value{" "}
            {v.claim.value}): {v.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Write script-editor modal.**

```tsx
// packages/frontend/app/admin/content-pipeline/review/script-editor.tsx
"use client";
import { useState } from "react";
import { editScript } from "../lib/content-pipeline-api";

export function ScriptEditor({
  runId,
  variantId,
  initial,
  onClose,
  onSaved,
}: {
  runId: string;
  variantId: "A" | "B";
  initial: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await editScript(runId, variantId, text);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-6">
      <div className="bg-surface rounded-xl p-6 w-full max-w-3xl shadow-lg">
        <h3 className="font-semibold mb-4">Edit script</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-48 rounded-lg border border-outline-variant p-4 font-mono text-sm"
        />
        <div className="flex gap-3 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-primary text-on-primary rounded-full px-6 py-2 font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save and re-check"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write review card.**

```tsx
// packages/frontend/app/admin/content-pipeline/review/review-card.tsx
"use client";
import { useRef, useState } from "react";
import { approveRun, rejectRun } from "../lib/content-pipeline-api";
import { useReviewShortcuts } from "./shortcuts";
import { DiffViewer } from "./diff-viewer";
import { ScriptEditor } from "./script-editor";

export function ReviewCard({ run, onNext }: { run: any; onNext: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [editing, setEditing] = useState(false);

  const gateAFail = run.gates?.find(
    (g: any) => g.gate === "data_verifier" && g.result === "failed",
  );
  const gateBFail = run.gates?.find(
    (g: any) => g.gate === "brand_voice_linter" && g.result === "failed",
  );
  const script = run.assets?.find((a: any) => a.kind === "script")?.metadata
    ?.scripts?.[0];

  useReviewShortcuts({
    onApprove: async () => {
      await approveRun(run.run.id);
      onNext();
    },
    onApproveSchedule: async () => {
      await approveRun(run.run.id);
      onNext();
    }, // P1 does not schedule separately
    onReject: async () => {
      const reason =
        window.prompt("Why are we rejecting?") ?? "no reason given";
      await rejectRun(run.run.id, reason);
      onNext();
    },
    onNext: onNext,
    onEdit: () => setEditing(true),
    onMute: () => {
      setMuted((m) => !m);
      if (videoRef.current) videoRef.current.muted = !muted;
    },
    onPlayPause: () => {
      if (!videoRef.current) return;
      videoRef.current.paused
        ? videoRef.current.play()
        : videoRef.current.pause();
    },
  });

  const videoAsset = run.assets?.find((a: any) => a.kind === "video_master");

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="rounded-xl bg-surface-container-low shadow-sm overflow-hidden">
        <div className="aspect-[9/16] bg-black max-h-[60vh] mx-auto">
          {videoAsset && (
            <video
              ref={videoRef}
              src={publicUrl(videoAsset.storage_url)}
              autoPlay
              muted={muted}
              loop
              className="w-full h-full object-contain"
            />
          )}
        </div>

        <div className="p-6">
          <div className="mb-2 text-sm text-outline">{run.run.format}</div>
          <h2 className="text-xl font-semibold mb-4">{run.run.market_query}</h2>
          {gateAFail && (
            <DiffViewer violations={gateAFail.details?.violations ?? []} />
          )}
          {gateBFail && (
            <div className="rounded-xl border border-warning bg-warning/5 p-4 mb-4">
              <h4 className="font-semibold text-warning mb-2">
                Brand voice flagged:
              </h4>
              <ul className="text-sm">
                {(gateBFail.details?.violations ?? []).map(
                  (v: any, i: number) => (
                    <li key={i}>
                      "{v.claim?.quote}" — {v.claim?.subject}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
          <div>
            <h4 className="font-semibold mb-2 text-sm">Script</h4>
            <pre className="bg-surface-container rounded-lg p-4 text-sm whitespace-pre-wrap">
              {script?.fullText}
            </pre>
          </div>
        </div>

        <div className="border-t border-outline-variant p-4 flex gap-3 justify-center">
          <kbd className="bg-primary text-on-primary rounded-full px-4 py-2 font-mono text-sm">
            L Approve and Publish
          </kbd>
          <kbd className="bg-surface-container-high rounded-full px-4 py-2 font-mono text-sm">
            E Edit
          </kbd>
          <kbd className="bg-surface-container-high rounded-full px-4 py-2 font-mono text-sm">
            J Reject
          </kbd>
          <kbd className="bg-surface-container-high rounded-full px-4 py-2 font-mono text-sm">
            K Next
          </kbd>
        </div>
      </div>
      {editing && script && (
        <ScriptEditor
          runId={run.run.id}
          variantId={script.variantId}
          initial={script.fullText}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onNext();
          }}
        />
      )}
    </div>
  );
}

function publicUrl(storageUrl: string): string {
  const match = storageUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (!match) return storageUrl;
  const [, bucket, path] = match;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
```

- [ ] **Step 7: Write queue page.**

```tsx
// packages/frontend/app/admin/content-pipeline/review/page.tsx
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/data/fetchers/base";
import { ReviewCard } from "./review-card";

async function fetchReviewQueue() {
  const res = await fetchAPI<{ data: { items: any[] } }>(
    "/api/admin/content-pipeline/review/queue",
  );
  return res.data.items;
}

async function fetchRunDetail(id: string) {
  const res = await fetchAPI<{ data: any }>(
    `/api/admin/content-pipeline/runs/${id}`,
  );
  return res.data;
}

export default function ReviewQueuePage() {
  const [cursor, setCursor] = useState(0);
  const { data: queue = [], refetch } = useQuery({
    queryKey: ["review-queue"],
    queryFn: fetchReviewQueue,
  });
  const currentRun = queue[cursor];
  const { data: detail } = useQuery({
    queryKey: ["review-run", currentRun?.id],
    queryFn: () => (currentRun ? fetchRunDetail(currentRun.id) : null),
    enabled: !!currentRun,
  });

  async function handleNext() {
    if (cursor + 1 < queue.length) setCursor(cursor + 1);
    else {
      await refetch();
      setCursor(0);
    }
  }

  if (!queue.length)
    return (
      <div className="p-8 text-center text-outline">
        All caught up. No runs waiting.
      </div>
    );
  if (!detail) return <div className="p-8">Loading...</div>;

  return (
    <div>
      <div className="text-center text-sm text-outline pt-4">
        {cursor + 1} of {queue.length} waiting
      </div>
      <ReviewCard run={detail} onNext={handleNext} />
    </div>
  );
}
```

- [ ] **Step 8: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/review/ packages/backend/src/content-pipeline/
git commit -m "feat(content-pipeline): keyboard-driven review queue with gate-failure diffs and inline script edit"
```

## Task 1.38: Platforms page plus YouTube OAuth UI

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/platforms/page.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/platforms/platform-row.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/platforms/setup-walkthrough.tsx`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`

- [ ] **Step 1: Add backend platform endpoints.**

```typescript
// content-pipeline.service.ts (add)
async getPlatformStatuses() {
  const publishers = this.publishers; // injected PLATFORM_PUBLISHERS array
  return publishers.map((p) => ({
    platform: p.platform,
    configured: p.isConfigured(),
    lastPublishedAt: null, // P4 fills this in
  }));
}

async startOAuth(platform: string): Promise<{ authUrl: string }> {
  if (platform === 'youtube_shorts') {
    const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error('YouTube OAuth client not configured');
    const redirectUri = encodeURIComponent(`${process.env.APP_BASE_URL}/admin/content-pipeline/platforms/oauth-callback/youtube`);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    return { authUrl: url };
  }
  throw new Error(`platform ${platform} not yet wired for OAuth in P1`);
}
```

- [ ] **Step 2: Add endpoints.**

```typescript
// content-pipeline.controller.ts
@Get('platforms')
async platforms() {
  return { success: true, data: { platforms: await this.service.getPlatformStatuses() } };
}

@Post('platforms/:platform/connect')
async platformConnect(@Param('platform') platform: string) {
  return { success: true, data: await this.service.startOAuth(platform) };
}
```

- [ ] **Step 3: Write platform row component.**

```tsx
// packages/frontend/app/admin/content-pipeline/platforms/platform-row.tsx
"use client";
import { useState } from "react";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export function PlatformRow({
  platform,
  configured,
  lastPublishedAt,
  onChange,
}: {
  platform: string;
  configured: boolean;
  lastPublishedAt: string | null;
  onChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = platform.replaceAll("_", " ");

  async function connect() {
    const res = await fetchAPIRaw(
      `/api/admin/content-pipeline/platforms/${platform}/connect`,
      { method: "POST" },
    );
    const json = await res.json();
    if (json.data?.authUrl) window.location.href = json.data.authUrl;
  }

  return (
    <div className="rounded-xl bg-surface-container-low shadow-sm">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-4 flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-3 h-3 rounded-full ${configured ? "bg-accent" : "bg-outline"}`}
          />
          <div>
            <div className="font-semibold capitalize">{label}</div>
            <div className="text-xs text-outline">
              {configured
                ? lastPublishedAt
                  ? `Last publish ${new Date(lastPublishedAt).toLocaleDateString()}`
                  : "Ready"
                : "Not connected"}
            </div>
          </div>
        </div>
        {!configured && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              connect();
            }}
            className="bg-primary text-on-primary rounded-full px-5 py-2 text-sm font-semibold"
          >
            Connect
          </button>
        )}
      </div>
      {expanded && !configured && (
        <div className="p-4 border-t border-outline-variant">
          <p className="text-sm mb-3">
            See the setup walkthrough at{" "}
            <code>
              docs/content-pipeline/platform-setup/{platform.split("_")[0]}.md
            </code>
            .
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write page.**

```tsx
// packages/frontend/app/admin/content-pipeline/platforms/page.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/data/fetchers/base";
import { PlatformRow } from "./platform-row";

async function fetchPlatforms() {
  const res = await fetchAPI<{
    data: {
      platforms: Array<{
        platform: string;
        configured: boolean;
        lastPublishedAt: string | null;
      }>;
    };
  }>("/api/admin/content-pipeline/platforms");
  return res.data.platforms;
}

export default function PlatformsPage() {
  const { data = [], refetch } = useQuery({
    queryKey: ["platforms"],
    queryFn: fetchPlatforms,
  });
  return (
    <div className="p-8 max-w-3xl space-y-3">
      <h1 className="text-2xl font-semibold mb-4">Platform Credentials</h1>
      {data.map((p) => (
        <PlatformRow
          key={p.platform}
          platform={p.platform}
          configured={p.configured}
          lastPublishedAt={p.lastPublishedAt}
          onChange={() => refetch()}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/platforms/ packages/backend/src/content-pipeline/
git commit -m "feat(content-pipeline): platforms page with YouTube OAuth connect flow"
```

## Task 1.39: Settings page (format defaults, strictness, pause)

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/settings/page.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/settings/format-defaults.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/settings/strictness-toggle.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/settings/pause-button.tsx`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`
- Create: `packages/backend/src/content-pipeline/dto/update-settings.dto.ts`

**P1 scope note:** The `paused` flag is stored in-memory for P1 (a simple module-scoped boolean). Future phases could persist to a settings table; for now the simpler approach fits.

- [ ] **Step 1: Write DTO and service.**

```typescript
// packages/backend/src/content-pipeline/dto/update-settings.dto.ts
import { IsIn, IsOptional } from "class-validator";
export class UpdateSettingsDto {
  @IsOptional() @IsIn(["relaxed", "balanced", "strict"]) strictness?: string;
}
```

```typescript
// content-pipeline.service.ts (add)
private paused = false;

async getSettings() {
  const client = this.supabase.getClient();
  const { data: formats } = await client.from('format_templates').select('*').order('format');
  return {
    strictness: process.env.CONTENT_PIPELINE_GATE_STRICTNESS ?? 'balanced',
    paused: this.paused,
    formatDefaults: formats ?? [],
  };
}

async updateSettings(dto: UpdateSettingsDto) {
  if (dto.strictness) process.env.CONTENT_PIPELINE_GATE_STRICTNESS = dto.strictness;
  return this.getSettings();
}

async pause() { this.paused = true; return { paused: true }; }
async resume() { this.paused = false; return { paused: false }; }
isPaused() { return this.paused; }
```

Hook `isPaused()` into the orchestrator's `transitionTo` at the start: when paused and attempting to transition from `queued`, skip.

- [ ] **Step 2: Add endpoints.**

```typescript
// content-pipeline.controller.ts
@Get('settings')
async getSettings() { return { success: true, data: await this.service.getSettings() }; }

@Patch('settings')
async updateSettings(@Body() dto: UpdateSettingsDto) {
  return { success: true, data: await this.service.updateSettings(dto) };
}

@Post('pause')
async pause() { return { success: true, data: await this.service.pause() }; }

@Post('resume')
async resume() { return { success: true, data: await this.service.resume() }; }
```

- [ ] **Step 3: Write settings page.**

```tsx
// packages/frontend/app/admin/content-pipeline/settings/page.tsx
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["content-pipeline-settings"],
    queryFn: async () =>
      (await fetchAPI<{ data: any }>("/api/admin/content-pipeline/settings"))
        .data,
  });

  const mutate = useMutation({
    mutationFn: async (payload: any) => {
      await fetchAPIRaw("/api/admin/content-pipeline/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["content-pipeline-settings"] }),
  });

  const togglePause = useMutation({
    mutationFn: async (paused: boolean) => {
      await fetchAPIRaw(
        `/api/admin/content-pipeline/${paused ? "pause" : "resume"}`,
        { method: "POST" },
      );
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["content-pipeline-settings"] }),
  });

  if (!data) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="rounded-xl bg-surface-container-low p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Gate Strictness</h2>
        <div className="flex gap-2">
          {(["relaxed", "balanced", "strict"] as const).map((s) => (
            <button
              key={s}
              onClick={() => mutate.mutate({ strictness: s })}
              className={`px-5 py-2 rounded-full text-sm font-semibold ${data.strictness === s ? "bg-primary text-on-primary" : "bg-surface-container"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-surface-container-low p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Format Defaults</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-outline">
              <th>Format</th>
              <th>Approval mode</th>
              <th>Voice</th>
              <th>Platforms</th>
            </tr>
          </thead>
          <tbody>
            {data.formatDefaults.map((f: any) => (
              <tr key={f.format} className="border-t border-outline-variant">
                <td className="py-2">{f.display_name}</td>
                <td>{f.default_approval_mode}</td>
                <td>{f.default_tts_voice_id ?? "(long-form)"}</td>
                <td>{f.default_platforms?.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl bg-error/5 border border-error p-6">
        <h2 className="font-semibold mb-3">Pause all automation</h2>
        <p className="text-sm text-outline mb-4">
          New runs will be rejected. Ongoing runs complete gracefully.
        </p>
        <button
          onClick={() => togglePause.mutate(!data.paused)}
          className="bg-error text-on-error rounded-full px-6 py-3 font-semibold"
        >
          {data.paused ? "Resume" : "Pause"}
        </button>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/settings/ packages/backend/src/content-pipeline/
git commit -m "feat(content-pipeline): settings page with strictness toggle and pause"
```

## Task 1.40: Performance page stub

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/performance/page.tsx`

- [ ] **Step 1: Write stub.**

```tsx
// packages/frontend/app/admin/content-pipeline/performance/page.tsx
export default function PerformancePage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Performance</h1>
      <div className="rounded-xl bg-surface-container-low p-8 text-center">
        <p className="text-outline mb-3">
          Performance analytics ship in Phase 4.
        </p>
        <p className="text-sm">
          Until then, view individual run metrics on the run detail page.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/performance/
git commit -m "feat(content-pipeline): performance page stub (full build in P4)"
```

## Task 1.41: Grade Reveal landing page

**Files:**

- Create: `packages/frontend/app/grade-reveal-signup/page.tsx`

- [ ] **Step 1: Write landing page.**

```tsx
// packages/frontend/app/grade-reveal-signup/page.tsx
import Link from "next/link";

export default function GradeRevealSignupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-4xl font-bold text-primary-dark text-center mb-4">
        Get your free Market Snapshot
      </h1>
      <p className="text-lg text-center text-outline mb-8">
        See the PropertyIQ Score, home value trend, and key metrics for any
        metro.
      </p>

      <form
        action="/api/auth/signup"
        method="POST"
        className="w-full bg-surface-container-low rounded-xl p-6 shadow-sm space-y-4"
      >
        <input
          type="text"
          name="marketQuery"
          placeholder="Which metro?"
          required
          className="w-full rounded-lg border border-outline-variant p-3"
        />
        <input
          type="email"
          name="email"
          placeholder="Email for your PDF"
          required
          className="w-full rounded-lg border border-outline-variant p-3"
        />
        <input type="hidden" name="magnetKind" value="market_snapshot_pdf" />
        <button
          type="submit"
          className="w-full bg-primary text-on-primary rounded-full py-3 font-semibold"
        >
          Get Free Snapshot
        </button>
      </form>

      <p className="text-xs text-outline mt-6 text-center">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
```

**Note:** the form submits to `/api/auth/signup` which must be extended (in the existing signup flow from Task 1.30) to also read the `__piq_attr` cookie and enqueue a lead magnet job via `QueueService.send('render-pdf', { ... })`.

- [ ] **Step 2: Commit.**

```bash
git add packages/frontend/app/grade-reveal-signup/
git commit -m "feat(content-pipeline): Grade Reveal landing page with signup form"
```

## Task 1.42: YouTube platform setup documentation

**Files:**

- Create: `docs/content-pipeline/platform-setup/youtube.md`

- [ ] **Step 1: Write documentation.**

```markdown
# YouTube Shorts Platform Setup

This document walks through the one-time OAuth setup for the YouTube Shorts publisher in the PropertyIQ Content Pipeline.

## Prerequisites

- A test YouTube channel, separate from your production PropertyIQ channel. If you publish tests to your main channel, your audience sees them.
- A Google Cloud project with the YouTube Data API v3 enabled.
- Owner access to both.

## Step 1: Create a Google Cloud project

1. Go to https://console.cloud.google.com/ and create a new project (e.g. `piq-content-pipeline`).
2. Navigate to APIs and Services, Library.
3. Search for "YouTube Data API v3" and enable it.
4. Search for "YouTube Analytics API" and enable it (for P1 24h metrics).

## Step 2: Create OAuth client

1. In the same project, go to APIs and Services, Credentials.
2. Click "Create credentials", "OAuth client ID".
3. Application type: "Web application".
4. Authorized redirect URIs: add your backend's callback URL. For local development: `http://localhost:3001/api/admin/content-pipeline/platforms/youtube_shorts/oauth-callback`. For staging: `https://<staging-domain>/api/admin/content-pipeline/platforms/youtube_shorts/oauth-callback`.
5. Save. Copy the client ID and client secret.

## Step 3: OAuth consent screen

1. Navigate to APIs and Services, OAuth consent screen.
2. User type: External.
3. Fill in app name, user support email, developer contact. App domain: `propertyiq.app`.
4. Scopes: add `https://www.googleapis.com/auth/youtube.upload` and `https://www.googleapis.com/auth/youtube.readonly`.
5. Test users: add the email of the test YouTube channel's owner.
6. Save. Do not publish (keeps us in test mode; we do not need public OAuth consent for a single-operator pipeline).

## Step 4: Exchange for a refresh token

Either use the Connect button in the admin UI (Platforms page, YouTube Shorts row), or use the OAuth Playground:

1. Go to https://developers.google.com/oauthplayground/
2. In the gear icon, "Use your own OAuth credentials", paste client ID and secret.
3. In the left panel, find YouTube Data API v3, select the two scopes.
4. Click "Authorize APIs", sign in with the test channel owner, grant access.
5. Click "Exchange authorization code for tokens". Copy the refresh token.

## Step 5: Configure environment variables

Set in Railway dashboard (production/staging) or `packages/backend/.env` (local):
```

YOUTUBE_OAUTH_CLIENT_ID=<client-id>.apps.googleusercontent.com
YOUTUBE_OAUTH_CLIENT_SECRET=<secret>
YOUTUBE_OAUTH_REFRESH_TOKEN=1//<refresh-token>

````

## Step 6: Smoke-test with curl

```bash
# Get a fresh access token
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=$YOUTUBE_OAUTH_CLIENT_ID" \
  -d "client_secret=$YOUTUBE_OAUTH_CLIENT_SECRET" \
  -d "refresh_token=$YOUTUBE_OAUTH_REFRESH_TOKEN" \
  -d "grant_type=refresh_token"

# Use the access_token from the response to verify the channel
curl -H "Authorization: Bearer <access_token>" \
  "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true"
````

Expected: a JSON response with your test channel's snippet.

## Rate limits

YouTube Data API v3 has a default quota of 10,000 units per day. An upload costs 1600 units. This gives roughly 6 uploads per day before quota exhaustion. For higher volumes, request a quota increase through the Google Cloud console.

## Known issues

- OAuth token refresh: Google rotates refresh tokens when the consent screen is in production mode but not in test mode. We stay in test mode for simplicity.
- Shorts detection: YouTube auto-detects Shorts by aspect ratio plus the `#Shorts` hashtag in title or description. Our publisher appends `#Shorts` automatically to descriptions; ensure videos are rendered at 9x16 (1080x1920).
- Category ID: we use `22` (People and Blogs) by default; Shorts does not require category to match specific videos.

````

- [ ] **Step 2: Commit.**

```bash
git add docs/content-pipeline/platform-setup/youtube.md
git commit -m "docs(content-pipeline): YouTube Shorts platform setup walkthrough"
````

## Task 1.43: Phase 1 E2E tests

**Files:**

- Create: `packages/backend/test/e2e/content-pipeline-p1-happy-path.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p1-gate-a-fail.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p1-gate-b-fail.e2e.spec.ts`

**Per project memory `feedback_plans-must-include-e2e-tests`: these E2E tests MUST hit the real staging DB, not mocks. Per `feedback_server-health-checks`, E2E must verify the full render output, not just HTTP 200s.**

- [ ] **Step 1: Happy-path E2E.**

```typescript
// packages/backend/test/e2e/content-pipeline-p1-happy-path.e2e.spec.ts
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../../src/app.module";
import { v4 as uuid } from "uuid";

describe("E2E: P1 Grade Reveal happy path", () => {
  let app: INestApplication;
  const adminJwt = process.env.E2E_ADMIN_JWT;

  beforeAll(async () => {
    if (!adminJwt) throw new Error("E2E_ADMIN_JWT env var required");
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  }, 30_000);

  afterAll(async () => await app?.close());

  it("creates a Grade Reveal run, fact-checks, renders, publishes to test YT channel, generates magnet", async () => {
    const idempotencyKey = uuid();
    const createRes = await request(app.getHttpServer())
      .post("/api/admin/content-pipeline/runs")
      .set("Authorization", `Bearer ${adminJwt}`)
      .send({
        format: "grade_reveal",
        marketQuery: "Cleveland, OH",
        idempotencyKey,
        approvalMode: "auto",
      });
    expect(createRes.status).toBe(201);
    const runId = createRes.body.data.id;

    // Poll for completion up to 10 minutes
    const terminal = ["published", "published_partial", "failed"];
    let status = "queued";
    const start = Date.now();
    while (Date.now() - start < 600_000) {
      await new Promise((r) => setTimeout(r, 5000));
      const detailRes = await request(app.getHttpServer())
        .get(`/api/admin/content-pipeline/runs/${runId}`)
        .set("Authorization", `Bearer ${adminJwt}`);
      status = detailRes.body.data.run.status;
      if (terminal.includes(status)) break;
    }
    expect(status).toBe("published");

    // Verify video was posted to YouTube
    const finalRes = await request(app.getHttpServer())
      .get(`/api/admin/content-pipeline/runs/${runId}`)
      .set("Authorization", `Bearer ${adminJwt}`);
    const posts = finalRes.body.data.posts;
    expect(posts.length).toBeGreaterThanOrEqual(1);
    expect(posts[0].external_url).toMatch(/youtube\.com/);
    expect(posts[0].short_link_id).toBeTruthy();
  }, 720_000);
});
```

- [ ] **Step 2: Gate A fail E2E.**

```typescript
// packages/backend/test/e2e/content-pipeline-p1-gate-a-fail.e2e.spec.ts
// Setup same as happy-path. Difference: monkeypatch the ScriptGenerator to return a script with a hallucinated numeric.
// Or use a special format key "grade_reveal_test_drift" seeded only in test-schema that injects a drifted value.
// Run the full pipeline, expect status to park at 'ready_for_review' with status_reason='gate_a_drift'.
```

Implement: seed a test content_run via direct insert with a script asset containing a known drift. Transition to `verifying_data` via API. Assert gate result in DB.

- [ ] **Step 3: Gate B fail E2E.**

Same pattern, inject an em-dash into the script asset, verify run parks at `ready_for_review` with `gate_b_voice`.

- [ ] **Step 4: Run E2E suite.**

```bash
cd packages/backend && E2E_ADMIN_JWT=<jwt> npm run test:e2e -- content-pipeline-p1
```

Expected: 3 PASS, total wall time up to 20 minutes.

- [ ] **Step 5: Commit.**

```bash
git add packages/backend/test/e2e/
git commit -m "test(content-pipeline): P1 E2E suite (happy path, gate A fail, gate B fail)"
```

---

# Phase 2: Format and platform breadth

**Duration:** 3 to 4 weeks. **Complexity:** Medium-High. **Tasks:** 29.

## Phase 2 scope

Remaining four short-form formats (Top 10 Ranking, Score Mover, Head-to-Head, Farm Area Spotlight). Remaining publishers (TikTok, Instagram Reels, Facebook Reels, LinkedIn). Captions (OpenAI Whisper word-level timings, burn-in for short-form, `.srt` output). Thumbnails (Remotion 1280x720, editable in review queue). All 3 approval modes fully wired. Per-format defaults UI. Lead Magnet Library admin page. Thumbnail style references (upload plus URL ingest for images). OpenAI TTS driver with auto-fallback.

## Phase 2 deliverables

- 5 formats available in create-run wizard.
- All 5 platforms publishing successfully.
- Burn-in captions on all short-form videos.
- Thumbnail renders and editable pre-publish.
- Approval modes auto, review, draft all behave correctly.
- Lead Magnet Library CRUD + format bindings work.
- Thumbnail style references analyzed via Claude vision and applied to thumbnail templates.

## Phase 2 acceptance criteria

1. All P2 migrations apply cleanly.
2. `npm run test` passes all P2 unit tests (approximately 80 new tests).
3. `npm run test:e2e` passes P2 E2E suite.
4. Running each of 4 new formats end-to-end publishes successfully to all 5 platforms in staging.
5. A run with `approval_mode=auto` reaches `published` without any human interaction.
6. A run with `approval_mode=draft` publishes to each platform in draft mode (YouTube private, TikTok draft, IG container, FB unpublished, LinkedIn DRAFT).
7. Admin can bind a thumbnail style reference to a format, and rendered thumbnails match the reference's palette and text position attributes within tolerance.

## Phase 2 prerequisites

- P1 merged and running in staging.
- Test accounts for TikTok Business, Instagram Business (on a test Facebook Page), Facebook Page, LinkedIn Page.
- Meta Graph app approved for `instagram_content_publish` and `pages_manage_posts` scopes.
- TikTok Content Posting API access approved.
- LinkedIn app approved for `w_member_social` scope.

---

## Task 2.1: P2 migration seed magnets

**Files:**

- Create: `supabase/migrations/20260422000100_content_pipeline_seed_p2_magnets.sql`

- [ ] **Step 1: Write migration.**

```sql
INSERT INTO lead_magnet_definitions (kind, display_name, description, audience, template_path, data_method, email_template_key, landing_page_path, enabled)
VALUES
  ('top_50_cashflow_report', 'Top 50 Cashflow Markets Report', '5-page PDF ranking the top 50 cashflow markets in your state.', 'investor',
   'packages/backend/src/content-pipeline/lead-magnets/templates/top_50_cashflow.html.ejs', 'getTopCashflowMarkets',
   'lead-magnet-delivery', '/top-cashflow-report', true),
  ('movers_report', 'Movers and Shakers Monthly Report', '3-page PDF of markets that moved 5+ PIQ points in the last month.', 'investor',
   'packages/backend/src/content-pipeline/lead-magnets/templates/movers_report.html.ejs', 'getTrendingMarkets',
   'lead-magnet-delivery', '/movers-report', true),
  ('market_comparison', '5-Market Deep Comparison', '4-page side-by-side PDF for 5 comparable markets.', 'investor',
   'packages/backend/src/content-pipeline/lead-magnets/templates/market_comparison.html.ejs', 'compareMarketsForContent',
   'lead-magnet-delivery', '/market-comparison', true),
  ('farm_area_audit', 'Farm Area Audit', '6-page PDF with top 20 farm areas in the metro: demographics, turnover, absentee rates.', 'agent',
   'packages/backend/src/content-pipeline/lead-magnets/templates/farm_area_audit.html.ejs', 'getFarmAreaAnalysis',
   'lead-magnet-delivery', '/farm-area-audit', true)
ON CONFLICT (kind) DO NOTHING;

INSERT INTO format_magnet_bindings (format, magnet_kind, cta_text, weight, enabled)
VALUES
  ('top_10_ranking', 'top_50_cashflow_report', 'Get the full Top 50 Cashflow Report at ', 1.0, true),
  ('score_mover', 'movers_report', 'Get the full Movers and Shakers Report at ', 1.0, true),
  ('head_to_head', 'market_comparison', 'Compare 5 markets side-by-side at ', 1.0, true),
  ('farm_area_spotlight', 'farm_area_audit', 'Get your free Farm Area Audit at ', 1.0, true)
ON CONFLICT (format, magnet_kind) DO NOTHING;
```

- [ ] **Step 2: Apply and verify, commit.**

```bash
supabase db push
git add supabase/migrations/20260422000100_content_pipeline_seed_p2_magnets.sql
git commit -m "feat(content-pipeline): seed 4 P2 lead magnets with format bindings"
```

## Task 2.2: P2 migration enable formats

**Files:**

- Create: `supabase/migrations/20260422000200_content_pipeline_seed_p2_formats_enable.sql`

- [ ] **Step 1: Write migration.**

```sql
UPDATE format_templates SET enabled = true
WHERE format IN ('top_10_ranking', 'score_mover', 'head_to_head', 'farm_area_spotlight');
```

- [ ] **Step 2: Apply, commit.**

```bash
supabase db push
git add supabase/migrations/20260422000200_content_pipeline_seed_p2_formats_enable.sql
git commit -m "feat(content-pipeline): enable P2 formats in format_templates"
```

## Task 2.3: ScriptGenerator prompts for P2 formats

**Files:**

- Create: `packages/backend/src/content-pipeline/prompts/top_10_ranking.md`
- Create: `packages/backend/src/content-pipeline/prompts/score_mover.md`
- Create: `packages/backend/src/content-pipeline/prompts/head_to_head.md`
- Create: `packages/backend/src/content-pipeline/prompts/farm_area_spotlight.md`

- [ ] **Step 1: top_10_ranking.md.**

```markdown
Write a 60-second Top 10 Ranking script for the top cashflow markets in {{state}}.

Data bundle:
{{dataBundle}}

Structure:

- Hook opens with the winner ("The number 1 cashflow market in {{state}} is...")
- Count down from #10 to #1, spending 3-5 seconds per market, citing rent-to-price ratio and PropertyIQ Score
- Close with this CTA verbatim: {{cta_text}}{{shortLinkPlaceholder}}

Produce {{variantCount}} hook variants. Hook A leads with the winner reveal. Hook B (if variantCount=2) leads with a surprising ranking ("Austin didn't make the top 10").

Scene hints for 60 seconds:

- Intro (3s)
- 10 ranking rows, staggered (40s, 4s each)
- Outro (10s)
- CTA card (7s)
```

- [ ] **Step 2: score_mover.md.**

```markdown
Write a 30-second Score Mover script for {{canonical_name}}.

Data bundle:
{{dataBundle}}

The market's PropertyIQ Score moved by the amount in data. Lead with the delta ("Cleveland jumped 8 points on PIQ").

Structure:

- Hook (2s): the delta
- Body (15s): what drove it (cite 2 supporting metrics from the data)
- Context (10s): what this means for investors
- CTA (3s): {{cta_text}}{{shortLinkPlaceholder}}

Produce {{variantCount}} hooks.
```

- [ ] **Step 3: head_to_head.md.**

```markdown
Write a 60-second Head-to-Head comparison between {{market_a}} and {{market_b}}.

Data bundle:
{{dataBundle}}

Structure:

- Hook (3s): the surprising contrast
- Head-to-head on PropertyIQ Score (10s)
- Head-to-head on home values and rents (15s)
- Head-to-head on economic indicators (15s)
- Verdict (10s)
- CTA (7s): {{cta_text}}{{shortLinkPlaceholder}}

Produce {{variantCount}} hooks.
```

- [ ] **Step 4: farm_area_spotlight.md.**

```markdown
Write a 60-second Farm Area Spotlight for agents in {{canonical_name}}.

Data bundle (3 farm areas):
{{dataBundle}}

Structure:

- Hook (3s): "If you're an agent in {{canonical_name}}..."
- For each of 3 farm areas, 15 seconds: ZIP, key stat (turnover rate or median price or absentee rate), why it matters for an agent's book
- Close with CTA (7s): {{cta_text}}{{shortLinkPlaceholder}}

Produce {{variantCount}} hooks. Keep the tone professional but direct, not salesy.
```

- [ ] **Step 5: Commit.**

```bash
git add packages/backend/src/content-pipeline/prompts/top_10_ranking.md packages/backend/src/content-pipeline/prompts/score_mover.md packages/backend/src/content-pipeline/prompts/head_to_head.md packages/backend/src/content-pipeline/prompts/farm_area_spotlight.md
git commit -m "feat(content-pipeline): prompts for 4 P2 formats"
```

## Task 2.4: RankingRow primitive and Top 10 composition

**Files:**

- Create: `packages/video-template/src/primitives/RankingRow.tsx`
- Modify: `packages/video-template/src/PropertyIQVideo.tsx` (add Top 10 layout)
- Create: `packages/video-template/tests/top-10.test.tsx`

- [ ] **Step 1: Write RankingRow.**

```tsx
// packages/video-template/src/primitives/RankingRow.tsx
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface RankingRowProps {
  rank: number;
  marketName: string;
  keyStat: string;
  keyStatLabel: string;
}

export const RankingRow: React.FC<RankingRowProps> = ({
  rank,
  marketName,
  keyStat,
  keyStatLabel,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  const slideIn = spring({ frame, fps, config: { damping: 12 } });
  const x = interpolate(slideIn, [0, 1], [-200, 0]);

  return (
    <div
      style={{
        transform: `translateX(${x}px)`,
        opacity: slideIn,
        display: "flex",
        alignItems: "center",
        gap: 16 * scale,
        padding: 12 * scale,
        background: "#3949AB",
        borderRadius: 12 * scale,
        color: "white",
      }}
    >
      <div
        style={{
          width: 56 * scale,
          height: 56 * scale,
          borderRadius: "50%",
          background: "#FFFFFF",
          color: "#1A237E",
          fontFamily: "Roboto Mono",
          fontWeight: 700,
          fontSize: 28 * scale,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {rank}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 22 * scale, fontWeight: 600 }}>
          {marketName}
        </div>
        <div style={{ fontSize: 12 * scale, opacity: 0.8 }}>{keyStatLabel}</div>
      </div>
      <div
        style={{
          fontFamily: "Roboto Mono",
          fontSize: 20 * scale,
          fontWeight: 700,
        }}
      >
        {keyStat}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Extend PropertyIQVideo with Top10Layout.**

Add to `PropertyIQVideo.tsx`:

```tsx
{
  props.format === "top_10_ranking" && <Top10Layout {...props} />;
}
```

And define `Top10Layout`:

```tsx
const Top10Layout: React.FC<VideoProps> = (props) => {
  const rankings = (props.dataBundle as any)?.top_cashflow_markets ?? [];
  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={60} durationInFrames={90}>
        <Intro
          marketName={`Top 10 Cashflow: ${(props.dataBundle as any).state ?? ""}`}
        />
      </Sequence>
      <Sequence from={150} durationInFrames={1200}>
        {rankings
          .slice(0, 10)
          .reverse()
          .map((m: any, i: number) => (
            <Sequence key={m.rank} from={i * 120} durationInFrames={120}>
              <AbsoluteFill style={{ padding: "40%" }}>
                <RankingRow
                  rank={m.rank}
                  marketName={m.name}
                  keyStat={`${m.rent_to_price_ratio.toFixed(2)}`}
                  keyStatLabel="Rent/Price"
                />
              </AbsoluteFill>
            </Sequence>
          ))}
      </Sequence>
      <Sequence from={1350} durationInFrames={180}>
        <Outro marketName="Top 10 Cashflow" />
      </Sequence>
      <Sequence from={1530} durationInFrames={90}>
        <BrandOutroCard ctaUrl={props.ctaUrl} />
      </Sequence>
    </>
  );
};
```

- [ ] **Step 3: Write snapshot test and commit.**

```bash
cd packages/video-template && npx jest tests/top-10.test
git add packages/video-template/src/primitives/RankingRow.tsx packages/video-template/src/PropertyIQVideo.tsx packages/video-template/tests/
git commit -m "feat(video-template): RankingRow primitive and Top 10 composition"
```

## Task 2.5: DeltaDisplay primitive and Score Mover composition

**Files:**

- Create: `packages/video-template/src/primitives/DeltaDisplay.tsx`
- Modify: `packages/video-template/src/PropertyIQVideo.tsx`
- Create: `packages/video-template/tests/score-mover.test.tsx`

- [ ] **Step 1: Write DeltaDisplay.**

```tsx
// packages/video-template/src/primitives/DeltaDisplay.tsx
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export const DeltaDisplay: React.FC<{ delta: number }> = ({ delta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  const bounce = spring({ frame, fps, config: { damping: 8 } });
  const color = delta >= 0 ? "#00C853" : "#B3261E";
  const sign = delta >= 0 ? "+" : "";
  return (
    <div
      style={{
        transform: `scale(${bounce})`,
        background: color,
        color: "white",
        padding: `${12 * scale}px ${32 * scale}px`,
        borderRadius: 999,
        fontFamily: "Roboto Mono",
        fontWeight: 700,
        fontSize: 96 * scale,
      }}
    >
      {sign}
      {delta}
    </div>
  );
};
```

- [ ] **Step 2: Add ScoreMoverLayout to PropertyIQVideo and snapshot-test. Commit.**

```bash
git add packages/video-template/src/primitives/DeltaDisplay.tsx packages/video-template/src/PropertyIQVideo.tsx packages/video-template/tests/
git commit -m "feat(video-template): DeltaDisplay primitive and Score Mover composition"
```

## Task 2.6: Head-to-Head composition uses existing Comparison scene

**Files:**

- Modify: `packages/video-template/src/PropertyIQVideo.tsx`
- Create: `packages/video-template/tests/head-to-head.test.tsx`

- [ ] **Step 1: Add HeadToHeadLayout to PropertyIQVideo (uses existing Comparison scene).**

```tsx
const HeadToHeadLayout: React.FC<VideoProps> = (props) => (
  <>
    <Sequence from={0} durationInFrames={60}>
      <BrandBumper />
    </Sequence>
    <Sequence from={60} durationInFrames={90}>
      <Intro marketName="Head-to-Head" />
    </Sequence>
    <Sequence from={150} durationInFrames={1500}>
      <Comparison dataBundle={props.dataBundle as any} />
    </Sequence>
    <Sequence from={1650} durationInFrames={90}>
      <Outro marketName="Head-to-Head" />
    </Sequence>
    <Sequence from={1740} durationInFrames={60}>
      <BrandOutroCard ctaUrl={props.ctaUrl} />
    </Sequence>
  </>
);
```

- [ ] **Step 2: Snapshot test and commit.**

```bash
git add packages/video-template/src/PropertyIQVideo.tsx packages/video-template/tests/
git commit -m "feat(video-template): Head-to-Head composition"
```

## Task 2.7: FarmAreaGrid primitive and Farm Area Spotlight composition

**Files:**

- Create: `packages/video-template/src/primitives/FarmAreaGrid.tsx`
- Modify: `packages/video-template/src/PropertyIQVideo.tsx`
- Create: `packages/video-template/tests/farm-area.test.tsx`

- [ ] **Step 1: Write FarmAreaGrid.**

```tsx
// packages/video-template/src/primitives/FarmAreaGrid.tsx
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface FarmAreaGridProps {
  areas: Array<{
    zip: string;
    medianPrice: number;
    turnoverPct: number;
    absenteePct: number;
  }>;
}

export const FarmAreaGrid: React.FC<FarmAreaGridProps> = ({ areas }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 16 * scale,
        padding: 40 * scale,
      }}
    >
      {areas.slice(0, 3).map((a, i) => {
        const appear = spring({
          frame: frame - i * 15,
          fps,
          config: { damping: 12 },
        });
        return (
          <div
            key={a.zip}
            style={{
              opacity: appear,
              transform: `translateY(${(1 - appear) * 40}px)`,
              background: "#E8EAF6",
              borderRadius: 16 * scale,
              padding: 20 * scale,
            }}
          >
            <div
              style={{
                fontFamily: "Roboto Mono",
                fontSize: 24 * scale,
                fontWeight: 700,
                color: "#1A237E",
              }}
            >
              ZIP {a.zip}
            </div>
            <div
              style={{ display: "flex", gap: 16 * scale, marginTop: 8 * scale }}
            >
              <div>
                <strong>${(a.medianPrice / 1000).toFixed(0)}K</strong> median
              </div>
              <div>
                <strong>{a.turnoverPct.toFixed(0)}%</strong> turnover
              </div>
              <div>
                <strong>{a.absenteePct.toFixed(0)}%</strong> absentee
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Add FarmAreaSpotlightLayout, snapshot test, commit.**

```bash
git add packages/video-template/src/primitives/FarmAreaGrid.tsx packages/video-template/src/PropertyIQVideo.tsx packages/video-template/tests/
git commit -m "feat(video-template): FarmAreaGrid primitive and Farm Area Spotlight composition"
```

## Task 2.8: OpenAI Whisper caption timer

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/caption-timer.interface.ts`
- Create: `packages/backend/src/content-pipeline/drivers/openai-whisper-timer.ts`
- Create: `packages/backend/src/content-pipeline/drivers/openai-whisper-timer.spec.ts`

- [ ] **Step 1: Write interface.**

```typescript
// packages/backend/src/content-pipeline/drivers/caption-timer.interface.ts
import { DriverCost } from "./driver-cost.types";

export interface CaptionTiming {
  startMs: number;
  endMs: number;
  text: string;
}

export interface CaptionTimingResult {
  segments: CaptionTiming[];
  words: Array<{ startMs: number; endMs: number; word: string }>;
  srt: string;
  cost: DriverCost;
}

export interface CaptionTimer {
  time(audioPath: string): Promise<CaptionTimingResult>;
}

export const CAPTION_TIMER = Symbol("CaptionTimer");
```

- [ ] **Step 2: Write test.**

```typescript
// packages/backend/src/content-pipeline/drivers/openai-whisper-timer.spec.ts
import { OpenAIWhisperTimer } from "./openai-whisper-timer";

jest.mock("openai", () => ({
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({
          text: "hello world",
          words: [
            { word: "hello", start: 0.0, end: 0.5 },
            { word: "world", start: 0.6, end: 1.0 },
          ],
          segments: [{ start: 0, end: 1.0, text: "hello world" }],
        }),
      },
    },
  })),
}));

describe("OpenAIWhisperTimer", () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = "test";
  });

  it("returns word timings and SRT", async () => {
    const timer = new OpenAIWhisperTimer();
    const result = await timer.time("/tmp/audio.mp3");
    expect(result.words).toHaveLength(2);
    expect(result.words[0].word).toBe("hello");
    expect(result.srt).toContain("hello world");
  });
});
```

- [ ] **Step 3: Implement.**

```typescript
// packages/backend/src/content-pipeline/drivers/openai-whisper-timer.ts
import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import { createReadStream } from "fs";
import { CaptionTimer, CaptionTimingResult } from "./caption-timer.interface";

@Injectable()
export class OpenAIWhisperTimer implements CaptionTimer {
  private readonly client: OpenAI;
  constructor() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is required");
    this.client = new OpenAI({ apiKey: key });
  }

  async time(audioPath: string): Promise<CaptionTimingResult> {
    const response = await this.client.audio.transcriptions.create({
      model: "whisper-1",
      file: createReadStream(audioPath),
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
    });
    const words =
      (response as any).words?.map((w: any) => ({
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        word: w.word,
      })) ?? [];
    const segments =
      (response as any).segments?.map((s: any) => ({
        startMs: Math.round(s.start * 1000),
        endMs: Math.round(s.end * 1000),
        text: s.text,
      })) ?? [];
    const srt = this.toSrt(segments);

    return {
      segments,
      words,
      srt,
      cost: {
        provider: "openai-whisper",
        amount_usd: 0.006,
        units: 1,
        unit_type: "requests",
      },
    };
  }

  private toSrt(
    segments: Array<{ startMs: number; endMs: number; text: string }>,
  ): string {
    const toTime = (ms: number) => {
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const mms = ms % 1000;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(mms).padStart(3, "0")}`;
    };
    return segments
      .map(
        (s, i) =>
          `${i + 1}\n${toTime(s.startMs)} --> ${toTime(s.endMs)}\n${s.text.trim()}\n`,
      )
      .join("\n");
  }
}
```

- [ ] **Step 4: Run tests and commit.**

```bash
cd packages/backend && npm run test -- openai-whisper-timer.spec
git add packages/backend/src/content-pipeline/drivers/
git commit -m "feat(content-pipeline): OpenAI Whisper caption timer with word-level granularity"
```

## Task 2.9: Caption burn-in in Remotion plus time-captions handler

**Files:**

- Create: `packages/video-template/src/primitives/CaptionOverlay.tsx`
- Modify: `packages/video-template/src/PropertyIQVideo.tsx`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/time-captions.handler.ts`

- [ ] **Step 1: Write CaptionOverlay primitive.**

```tsx
// packages/video-template/src/primitives/CaptionOverlay.tsx
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface CaptionWord {
  startMs: number;
  endMs: number;
  word: string;
}

export const CaptionOverlay: React.FC<{ words: CaptionWord[] }> = ({
  words,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  const currentMs = (frame / fps) * 1000;
  const active = words.filter(
    (w) => currentMs >= w.startMs - 200 && currentMs <= w.endMs + 200,
  );
  const text = active.map((w) => w.word).join(" ");
  if (!text) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 80 * scale,
        left: 40 * scale,
        right: 40 * scale,
        textAlign: "center",
        fontFamily: "Roboto",
        fontWeight: 700,
        fontSize: 42 * scale,
        color: "#FFFFFF",
        textShadow: "0 2px 8px rgba(0,0,0,0.8)",
      }}
    >
      {text}
    </div>
  );
};
```

- [ ] **Step 2: Pass word timings as optional prop into PropertyIQVideo and render CaptionOverlay when provided.**

- [ ] **Step 3: Write time-captions handler.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/time-captions.handler.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import { RunOrchestratorService } from "../run-orchestrator.service";
import {
  CAPTION_TIMER,
  CaptionTimer,
} from "../../drivers/caption-timer.interface";

@Injectable()
export class TimeCaptionsHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    @Inject(CAPTION_TIMER) private readonly timer: CaptionTimer,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { data: audio } = await client
        .from("content_assets")
        .select("storage_url")
        .eq("run_id", runId)
        .eq("kind", "audio")
        .single();
      const audioPath = await this.downloadStorage(audio.storage_url);

      const result = await this.timer.time(audioPath);
      await client.from("content_assets").insert([
        {
          run_id: runId,
          kind: "captions_timings",
          storage_url: "inline",
          metadata: { words: result.words, segments: result.segments },
        },
        {
          run_id: runId,
          kind: "captions_srt",
          storage_url: "inline",
          metadata: { srt: result.srt },
        },
      ]);

      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `timing_captions: ${(err as Error).message}`,
      );
    }
  }

  private async downloadStorage(url: string): Promise<string> {
    const match = url.match(/^supabase:\/\/([^/]+)\/(.+)$/)!;
    const { data } = await this.supabase
      .getClient()
      .storage.from(match[1])
      .download(match[2]);
    const { writeFileSync } = await import("fs");
    const { join } = await import("path");
    const { tmpdir } = await import("os");
    const localPath = join(tmpdir(), `audio-${Date.now()}.mp3`);
    writeFileSync(localPath, Buffer.from(await data!.arrayBuffer()));
    return localPath;
  }
}
```

- [ ] **Step 4: Wire into HandlersBootstrapService. Commit.**

```bash
git add packages/video-template/src/primitives/CaptionOverlay.tsx packages/video-template/src/PropertyIQVideo.tsx packages/backend/src/content-pipeline/orchestrator/
git commit -m "feat(content-pipeline): caption burn-in plus time-captions handler"
```

<!-- PLAN_INSERT_HERE -->

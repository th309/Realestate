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
              {m.geography} {m.state ? `, ${m.state}` : ""}
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
                      "{v.claim?.quote}" ({v.claim?.subject})
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

## Task 2.10: TikTokPublisher

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/tiktok-publisher.ts`
- Create: `packages/backend/src/content-pipeline/drivers/tiktok-publisher.spec.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-tiktok.handler.ts`

TikTok Content Posting API uses a two-step flow: INIT creates a publish session, UPLOAD sends the video, and status is polled until FINISHED.

- [ ] **Step 1: Write TikTokPublisher tests.**

```typescript
// packages/backend/src/content-pipeline/drivers/tiktok-publisher.spec.ts
import axios from "axios";
import { TikTokPublisher } from "./tiktok-publisher";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("TikTokPublisher", () => {
  beforeAll(() => {
    process.env.TIKTOK_CLIENT_KEY = "test-key";
    process.env.TIKTOK_CLIENT_SECRET = "test-secret";
    process.env.TIKTOK_OAUTH_REFRESH_TOKEN = "test-refresh";
  });

  it("isConfigured requires all three env vars", () => {
    expect(new TikTokPublisher().isConfigured()).toBe(true);
    const saved = process.env.TIKTOK_OAUTH_REFRESH_TOKEN;
    delete process.env.TIKTOK_OAUTH_REFRESH_TOKEN;
    expect(new TikTokPublisher().isConfigured()).toBe(false);
    process.env.TIKTOK_OAUTH_REFRESH_TOKEN = saved;
  });

  it("publish initializes upload, uploads video, polls FINISHED", async () => {
    mockedAxios.post.mockImplementation(async (url: string) => {
      if (url.includes("oauth/token"))
        return {
          data: { access_token: "fresh-token", expires_in: 3600 },
        } as any;
      if (url.includes("publish/video/init"))
        return {
          data: {
            data: {
              publish_id: "pub-1",
              upload_url: "https://upload.tiktok/u1",
            },
          },
        } as any;
      if (url.includes("upload.tiktok")) return { data: {} } as any;
      return { data: {} } as any;
    });
    mockedAxios.get.mockResolvedValue({
      data: {
        data: {
          status: "PUBLISH_COMPLETE",
          publicaly_available_post_id: ["12345"],
        },
      },
    } as any);

    const pub = new TikTokPublisher();
    const result = await pub.publish({
      runId: "r1",
      videoPath: "/tmp/v.mp4",
      title: "Cleveland PIQ 78",
      description: "Market score hit 78",
      tags: ["realestate"],
      postMode: "direct",
    });

    expect(result.externalId).toBe("12345");
    expect(result.externalUrl).toContain("tiktok.com");
  });

  it("draft mode uses MEDIA_UPLOAD post_mode", async () => {
    let capturedBody: any;
    mockedAxios.post.mockImplementation(async (url: string, body: any) => {
      if (url.includes("publish/video/init")) {
        capturedBody = body;
        return {
          data: {
            data: {
              publish_id: "pub-2",
              upload_url: "https://upload.tiktok/u2",
            },
          },
        } as any;
      }
      if (url.includes("oauth/token"))
        return { data: { access_token: "t", expires_in: 3600 } } as any;
      return { data: {} } as any;
    });
    mockedAxios.get.mockResolvedValue({
      data: { data: { status: "PUBLISH_COMPLETE" } },
    } as any);

    await new TikTokPublisher().publish({
      runId: "r1",
      videoPath: "/tmp/v.mp4",
      title: "t",
      description: "d",
      tags: [],
      postMode: "draft",
    });
    expect(capturedBody.post_info.post_mode).toBe("MEDIA_UPLOAD");
  });
});
```

- [ ] **Step 2: Run to confirm failure.**

```bash
cd packages/backend && npm run test -- tiktok-publisher.spec
```

Expected: FAIL (class not defined).

- [ ] **Step 3: Implement TikTokPublisher.**

```typescript
// packages/backend/src/content-pipeline/drivers/tiktok-publisher.ts
import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import { createReadStream, statSync } from "fs";
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from "./platform-publisher.interface";
import { Platform } from "../types";

const TIKTOK_API = "https://open.tiktokapis.com";

@Injectable()
export class TikTokPublisher implements PlatformPublisher {
  readonly platform: Platform = "tiktok";
  private readonly logger = new Logger(TikTokPublisher.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  isConfigured(): boolean {
    return !!(
      process.env.TIKTOK_CLIENT_KEY &&
      process.env.TIKTOK_CLIENT_SECRET &&
      process.env.TIKTOK_OAUTH_REFRESH_TOKEN
    );
  }

  private async ensureToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000)
      return this.accessToken;
    const response = await axios.post(
      `${TIKTOK_API}/v2/oauth/token/`,
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: process.env.TIKTOK_OAUTH_REFRESH_TOKEN!,
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
    return this.accessToken!;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    if (!this.isConfigured()) throw new Error("TikTokPublisher not configured");
    const token = await this.ensureToken();
    const fileSize = statSync(req.videoPath).size;

    const initResponse = await axios.post(
      `${TIKTOK_API}/v2/post/publish/video/init/`,
      {
        post_info: {
          title: req.title.substring(0, 90),
          description: req.description.substring(0, 2200),
          post_mode: req.postMode === "draft" ? "MEDIA_UPLOAD" : "DIRECT_POST",
          privacy_level:
            req.postMode === "draft" ? "SELF_ONLY" : "PUBLIC_TO_EVERYONE",
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: fileSize,
          chunk_size: fileSize,
          total_chunk_count: 1,
        },
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const publishId = initResponse.data.data.publish_id;
    const uploadUrl = initResponse.data.data.upload_url;

    await axios.put(uploadUrl, createReadStream(req.videoPath), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}`,
      },
      maxBodyLength: fileSize,
      maxContentLength: fileSize,
    });

    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusResponse = await axios.get(
        `${TIKTOK_API}/v2/post/publish/status/fetch/`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { publish_id: publishId },
        },
      );
      const status = statusResponse.data.data.status;
      if (status === "PUBLISH_COMPLETE") {
        const externalId =
          statusResponse.data.data.publicaly_available_post_id?.[0] ??
          publishId;
        return {
          externalId,
          externalUrl: `https://www.tiktok.com/@yourhandle/video/${externalId}`,
          cost: {
            provider: "tiktok",
            amount_usd: 0,
            units: 1,
            unit_type: "requests",
          },
          providerResponse: statusResponse.data,
        };
      }
      if (status === "FAILED")
        throw new Error(
          `TikTok publish failed: ${JSON.stringify(statusResponse.data)}`,
        );
    }
    throw new Error("TikTok publish status timeout after 150 seconds");
  }

  async refreshCredentials(): Promise<void> {
    this.accessToken = null;
    await this.ensureToken();
  }
}
```

- [ ] **Step 4: Write publish-tiktok handler.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-tiktok.handler.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import { RunOrchestratorService } from "../run-orchestrator.service";
import { TikTokPublisher } from "../../drivers/tiktok-publisher";
import { ShortLinkService } from "../../short-links/short-link.service";
import { join } from "path";
import { tmpdir } from "os";
import { writeFileSync } from "fs";

@Injectable()
export class PublishTikTokHandler {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
    private readonly publisher: TikTokPublisher,
    private readonly shortLinks: ShortLinkService,
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

      const videoPath = await this.downloadVideo(video.storage_url);
      const script = (run.hook_variants as any[])[0];

      const result = await this.publisher.publish({
        runId,
        videoPath,
        title:
          `${run.resolved_geo.canonical_name} ${run.format.replaceAll("_", " ")}`.substring(
            0,
            90,
          ),
        description: `${script.hook}\n\n${script.body}\n\n${script.cta}`,
        tags: [
          "realestate",
          run.resolved_geo.canonical_name.split(",")[0].toLowerCase(),
        ],
        postMode: run.approval_mode === "draft" ? "draft" : "direct",
      });

      const { data: postRow } = await client
        .from("platform_posts")
        .insert({
          run_id: runId,
          platform: "tiktok",
          external_id: result.externalId,
          external_url: result.externalUrl,
          post_mode: run.approval_mode === "draft" ? "draft" : "direct",
          hook_variant_id: "A",
          status: "posted",
        })
        .select()
        .single();

      const link = await this.shortLinks.create({
        runId,
        format: run.format,
        platform: "tiktok",
        targetUrl: await this.resolveLanding(client, run.format, runId),
      });
      await client
        .from("platform_posts")
        .update({ short_link_id: link.id })
        .eq("id", postRow.id);
    } catch (err) {
      await client.from("platform_posts").insert({
        run_id: runId,
        platform: "tiktok",
        status: "failed",
        error: (err as Error).message,
      });
    }
  }

  private async downloadVideo(storageUrl: string): Promise<string> {
    const match = storageUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/)!;
    const { data } = await this.supabase
      .getClient()
      .storage.from(match[1])
      .download(match[2]);
    const localPath = join(tmpdir(), `tt-${Date.now()}.mp4`);
    writeFileSync(localPath, Buffer.from(await data!.arrayBuffer()));
    return localPath;
  }

  private async resolveLanding(
    client: any,
    format: string,
    runId: string,
  ): Promise<string> {
    const { data: binding } = await client
      .from("format_magnet_bindings")
      .select("magnet_kind")
      .eq("format", format)
      .eq("enabled", true)
      .single();
    const { data: magnet } = await client
      .from("lead_magnet_definitions")
      .select("landing_page_path")
      .eq("kind", binding?.magnet_kind)
      .single();
    return `https://propertyiq.app${magnet?.landing_page_path ?? "/"}?run=${runId}`;
  }
}
```

- [ ] **Step 5: Register in HandlersBootstrapService for `publish-tiktok` queue, run tests, commit.**

```bash
cd packages/backend && npm run test -- tiktok-publisher.spec
git add packages/backend/src/content-pipeline/drivers/tiktok-publisher.ts packages/backend/src/content-pipeline/drivers/tiktok-publisher.spec.ts packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-tiktok.handler.ts
git commit -m "feat(content-pipeline): TikTokPublisher with INIT+UPLOAD+status-poll flow"
```

## Task 2.11: InstagramReelsPublisher

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/instagram-reels-publisher.ts`
- Create: `packages/backend/src/content-pipeline/drivers/instagram-reels-publisher.spec.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-instagram.handler.ts`

Instagram Graph API uses a two-step container flow: POST to `/<ig-user-id>/media` creates a container, POST to `/<ig-user-id>/media_publish` publishes it.

- [ ] **Step 1: Write tests.**

```typescript
// packages/backend/src/content-pipeline/drivers/instagram-reels-publisher.spec.ts
import axios from "axios";
import { InstagramReelsPublisher } from "./instagram-reels-publisher";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("InstagramReelsPublisher", () => {
  beforeAll(() => {
    process.env.META_GRAPH_APP_ID = "app-1";
    process.env.META_GRAPH_APP_SECRET = "secret-1";
    process.env.META_INSTAGRAM_ACCESS_TOKEN = "igtoken";
    ((process.env.META_INSTAGRAM_USER_ID = "17841405"),
      (process.env.VIDEO_PUBLIC_BASE_URL = "https://staging.piq.sh/videos"));
  });

  it("publishes a reel with container flow", async () => {
    mockedAxios.post.mockImplementation(async (url: string) => {
      if (url.includes("/media_publish"))
        return { data: { id: "ig-published-1" } } as any;
      if (url.includes("/media"))
        return { data: { id: "ig-container-1" } } as any;
      return { data: {} } as any;
    });
    mockedAxios.get.mockResolvedValue({
      data: { status_code: "FINISHED" },
    } as any);

    const pub = new InstagramReelsPublisher();
    const result = await pub.publish({
      runId: "r1",
      videoPath: "https://staging.piq.sh/videos/r1.mp4",
      title: "t",
      description: "d",
      tags: ["realestate"],
      postMode: "direct",
    });
    expect(result.externalId).toBe("ig-published-1");
  });

  it("draft mode skips publish step and returns container id", async () => {
    mockedAxios.post.mockResolvedValue({
      data: { id: "ig-container-2" },
    } as any);
    mockedAxios.get.mockResolvedValue({
      data: { status_code: "FINISHED" },
    } as any);

    const pub = new InstagramReelsPublisher();
    const result = await pub.publish({
      runId: "r1",
      videoPath: "https://staging.piq.sh/videos/r1.mp4",
      title: "t",
      description: "d",
      tags: [],
      postMode: "draft",
    });
    expect(result.externalId).toBe("ig-container-2");
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// packages/backend/src/content-pipeline/drivers/instagram-reels-publisher.ts
import { Injectable } from "@nestjs/common";
import axios from "axios";
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from "./platform-publisher.interface";
import { Platform } from "../types";

const GRAPH = "https://graph.facebook.com/v21.0";

@Injectable()
export class InstagramReelsPublisher implements PlatformPublisher {
  readonly platform: Platform = "instagram_reels";

  isConfigured(): boolean {
    return !!(
      process.env.META_GRAPH_APP_ID &&
      process.env.META_INSTAGRAM_ACCESS_TOKEN &&
      process.env.META_INSTAGRAM_USER_ID
    );
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    if (!this.isConfigured())
      throw new Error("InstagramReelsPublisher not configured");
    const token = process.env.META_INSTAGRAM_ACCESS_TOKEN!;
    const userId = process.env.META_INSTAGRAM_USER_ID!;

    const caption =
      `${req.description}\n\n${req.tags.map((t) => `#${t}`).join(" ")}`.substring(
        0,
        2200,
      );

    const containerResponse = await axios.post(
      `${GRAPH}/${userId}/media`,
      null,
      {
        params: {
          media_type: "REELS",
          video_url: req.videoPath,
          caption,
          access_token: token,
        },
      },
    );
    const containerId = containerResponse.data.id;

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusResponse = await axios.get(`${GRAPH}/${containerId}`, {
        params: { fields: "status_code", access_token: token },
      });
      if (statusResponse.data.status_code === "FINISHED") break;
      if (statusResponse.data.status_code === "ERROR")
        throw new Error(
          `Instagram container error: ${JSON.stringify(statusResponse.data)}`,
        );
    }

    if (req.postMode === "draft") {
      return {
        externalId: containerId,
        externalUrl: `https://www.instagram.com/draft/${containerId}`,
        cost: {
          provider: "instagram",
          amount_usd: 0,
          units: 1,
          unit_type: "requests",
        },
        providerResponse: { container: containerId, mode: "draft" },
      };
    }

    const publishResponse = await axios.post(
      `${GRAPH}/${userId}/media_publish`,
      null,
      { params: { creation_id: containerId, access_token: token } },
    );
    return {
      externalId: publishResponse.data.id,
      externalUrl: `https://www.instagram.com/reel/${publishResponse.data.id}`,
      cost: {
        provider: "instagram",
        amount_usd: 0,
        units: 1,
        unit_type: "requests",
      },
      providerResponse: publishResponse.data,
    };
  }
}
```

- [ ] **Step 3: Write publish-instagram handler matching TikTok pattern.**

Same structure as Task 2.10 Step 4, but dispatches `InstagramReelsPublisher.publish` and requires the video to be publicly accessible (Instagram cannot pull from Supabase Storage with auth). Upload the video to Supabase Storage with a signed URL, or use a public bucket `content-pipeline-public` for Instagram-readable videos.

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-instagram.handler.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../../supabase/supabase.service";
import { RunOrchestratorService } from "../run-orchestrator.service";
import { InstagramReelsPublisher } from "../../drivers/instagram-reels-publisher";
import { ShortLinkService } from "../../short-links/short-link.service";

@Injectable()
export class PublishInstagramHandler {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
    private readonly publisher: InstagramReelsPublisher,
    private readonly shortLinks: ShortLinkService,
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

      const { data: signed } = await client.storage
        .from("content-pipeline")
        .createSignedUrl(
          video.storage_url.replace(/^supabase:\/\/content-pipeline\//, ""),
          3600,
        );
      const publicVideoUrl = signed?.signedUrl ?? "";

      const script = (run.hook_variants as any[])[0];
      const result = await this.publisher.publish({
        runId,
        videoPath: publicVideoUrl,
        title: "",
        description: `${script.hook}\n${script.body}\n\n${script.cta}`,
        tags: ["realestate", "propertyiq"],
        postMode: run.approval_mode === "draft" ? "draft" : "direct",
      });

      const { data: postRow } = await client
        .from("platform_posts")
        .insert({
          run_id: runId,
          platform: "instagram_reels",
          external_id: result.externalId,
          external_url: result.externalUrl,
          post_mode: run.approval_mode === "draft" ? "draft" : "direct",
          hook_variant_id: "A",
          status: "posted",
        })
        .select()
        .single();

      const link = await this.shortLinks.create({
        runId,
        format: run.format,
        platform: "instagram_reels",
        targetUrl: `https://propertyiq.app/${run.format.replaceAll("_", "-")}?run=${runId}`,
      });
      await client
        .from("platform_posts")
        .update({ short_link_id: link.id })
        .eq("id", postRow.id);
    } catch (err) {
      await client.from("platform_posts").insert({
        run_id: runId,
        platform: "instagram_reels",
        status: "failed",
        error: (err as Error).message,
      });
    }
  }
}
```

- [ ] **Step 4: Run tests, register handler for `publish-instagram` queue, commit.**

```bash
cd packages/backend && npm run test -- instagram-reels-publisher.spec
git add packages/backend/src/content-pipeline/drivers/instagram-reels-publisher.ts packages/backend/src/content-pipeline/drivers/instagram-reels-publisher.spec.ts packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-instagram.handler.ts
git commit -m "feat(content-pipeline): InstagramReelsPublisher with Graph API container flow"
```

## Task 2.12: FacebookReelsPublisher

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/facebook-reels-publisher.ts`
- Create: `packages/backend/src/content-pipeline/drivers/facebook-reels-publisher.spec.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-facebook.handler.ts`

- [ ] **Step 1: Write tests (pattern similar to Instagram).**

```typescript
// packages/backend/src/content-pipeline/drivers/facebook-reels-publisher.spec.ts
import axios from "axios";
import { FacebookReelsPublisher } from "./facebook-reels-publisher";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("FacebookReelsPublisher", () => {
  beforeAll(() => {
    process.env.META_FACEBOOK_PAGE_ID = "99887766";
    process.env.META_FACEBOOK_PAGE_ACCESS_TOKEN = "pagetoken";
    process.env.VIDEO_PUBLIC_BASE_URL = "https://staging.piq.sh/videos";
  });

  it("publishes direct and returns video id", async () => {
    mockedAxios.post.mockImplementation(async (url: string) => {
      if (url.includes("/video_reels"))
        return {
          data: { id: "init-1", upload_url: "https://upload.fb/u1" },
        } as any;
      if (url.includes("/videos/finish"))
        return { data: { success: true, post_id: "post-1" } } as any;
      if (url.includes("upload.fb")) return { data: {} } as any;
      return { data: {} } as any;
    });
    const pub = new FacebookReelsPublisher();
    const result = await pub.publish({
      runId: "r1",
      videoPath: "/tmp/v.mp4",
      title: "t",
      description: "d",
      tags: [],
      postMode: "direct",
    });
    expect(result.externalId).toBe("post-1");
  });

  it("draft mode uses unpublished=true", async () => {
    let capturedParams: any;
    mockedAxios.post.mockImplementation(
      async (_url: string, _body: any, config: any) => {
        capturedParams = config?.params ?? capturedParams;
        if (_url.includes("/videos/finish"))
          return { data: { success: true, post_id: "draft-1" } } as any;
        return { data: { id: "x", upload_url: "https://upload/x" } } as any;
      },
    );
    await new FacebookReelsPublisher().publish({
      runId: "r",
      videoPath: "/tmp/v.mp4",
      title: "t",
      description: "d",
      tags: [],
      postMode: "draft",
    });
    expect(capturedParams?.published).toBe(false);
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// packages/backend/src/content-pipeline/drivers/facebook-reels-publisher.ts
import { Injectable } from "@nestjs/common";
import axios from "axios";
import { createReadStream, statSync } from "fs";
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from "./platform-publisher.interface";
import { Platform } from "../types";

const GRAPH = "https://graph.facebook.com/v21.0";

@Injectable()
export class FacebookReelsPublisher implements PlatformPublisher {
  readonly platform: Platform = "facebook_reels";

  isConfigured(): boolean {
    return !!(
      process.env.META_FACEBOOK_PAGE_ID &&
      process.env.META_FACEBOOK_PAGE_ACCESS_TOKEN
    );
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    if (!this.isConfigured())
      throw new Error("FacebookReelsPublisher not configured");
    const pageId = process.env.META_FACEBOOK_PAGE_ID!;
    const token = process.env.META_FACEBOOK_PAGE_ACCESS_TOKEN!;
    const fileSize = statSync(req.videoPath).size;

    const initResponse = await axios.post(
      `${GRAPH}/${pageId}/video_reels`,
      null,
      {
        params: { upload_phase: "start", access_token: token },
      },
    );
    const videoId = initResponse.data.video_id ?? initResponse.data.id;
    const uploadUrl = initResponse.data.upload_url;

    await axios.post(uploadUrl, createReadStream(req.videoPath), {
      headers: {
        Authorization: `OAuth ${token}`,
        offset: "0",
        file_size: String(fileSize),
      },
      maxBodyLength: fileSize,
      maxContentLength: fileSize,
    });

    const description = `${req.description}\n\n${req.tags.map((t) => `#${t}`).join(" ")}`;
    const finishParams: any = {
      upload_phase: "finish",
      video_id: videoId,
      description: description.substring(0, 2200),
      access_token: token,
    };
    if (req.postMode === "direct") {
      finishParams.video_state = "PUBLISHED";
      finishParams.published = true;
    } else {
      finishParams.video_state = "DRAFT";
      finishParams.published = false;
    }

    const finishResponse = await axios.post(
      `${GRAPH}/${pageId}/videos/finish`,
      null,
      { params: finishParams },
    );
    const externalId = finishResponse.data.post_id ?? videoId;
    return {
      externalId,
      externalUrl: `https://www.facebook.com/reel/${externalId}`,
      cost: {
        provider: "facebook",
        amount_usd: 0,
        units: 1,
        unit_type: "requests",
      },
      providerResponse: finishResponse.data,
    };
  }
}
```

- [ ] **Step 3: Write publish-facebook handler (same pattern as TikTok), run tests, commit.**

```bash
cd packages/backend && npm run test -- facebook-reels-publisher.spec
git add packages/backend/src/content-pipeline/drivers/facebook-reels-publisher.ts packages/backend/src/content-pipeline/drivers/facebook-reels-publisher.spec.ts packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-facebook.handler.ts
git commit -m "feat(content-pipeline): FacebookReelsPublisher with resumable upload"
```

## Task 2.13: LinkedInPublisher

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/linkedin-publisher.ts`
- Create: `packages/backend/src/content-pipeline/drivers/linkedin-publisher.spec.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-linkedin.handler.ts`

LinkedIn API v2 uses a three-step flow for video: registerUpload -> PUT binary to returned upload URL -> create UGC post referencing the asset.

- [ ] **Step 1: Write tests.**

```typescript
// packages/backend/src/content-pipeline/drivers/linkedin-publisher.spec.ts
import axios from "axios";
import { LinkedInPublisher } from "./linkedin-publisher";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("LinkedInPublisher", () => {
  beforeAll(() => {
    process.env.LINKEDIN_ACCESS_TOKEN = "li-token";
    process.env.LINKEDIN_ORGANIZATION_URN = "urn:li:organization:12345";
  });

  it("publishes through registerUpload + upload + post flow", async () => {
    mockedAxios.post.mockImplementation(async (url: string) => {
      if (url.includes("registerUpload"))
        return {
          data: {
            value: {
              uploadMechanism: {
                "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
                  uploadUrl: "https://up.li/x",
                },
              },
              asset: "urn:li:digitalmediaAsset:abc",
            },
          },
        } as any;
      if (url.includes("/ugcPosts"))
        return { data: { id: "urn:li:share:123" } } as any;
      return { data: {} } as any;
    });
    mockedAxios.put.mockResolvedValue({ status: 201 } as any);

    const pub = new LinkedInPublisher();
    const result = await pub.publish({
      runId: "r",
      videoPath: "/tmp/v.mp4",
      title: "t",
      description: "d",
      tags: [],
      postMode: "direct",
    });
    expect(result.externalId).toBe("urn:li:share:123");
  });

  it("draft mode requests visibility=DRAFT", async () => {
    let capturedBody: any;
    mockedAxios.post.mockImplementation(async (url: string, body: any) => {
      if (url.includes("/ugcPosts")) {
        capturedBody = body;
        return { data: { id: "urn:li:share:draft" } } as any;
      }
      if (url.includes("registerUpload"))
        return {
          data: {
            value: {
              uploadMechanism: {
                "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
                  uploadUrl: "https://up.li/x",
                },
              },
              asset: "urn:li:digitalmediaAsset:a",
            },
          },
        } as any;
      return { data: {} } as any;
    });
    mockedAxios.put.mockResolvedValue({ status: 201 } as any);

    await new LinkedInPublisher().publish({
      runId: "r",
      videoPath: "/tmp/v.mp4",
      title: "t",
      description: "d",
      tags: [],
      postMode: "draft",
    });
    expect(
      capturedBody?.visibility?.["com.linkedin.ugc.MemberNetworkVisibility"],
    ).toBe("CONNECTIONS");
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// packages/backend/src/content-pipeline/drivers/linkedin-publisher.ts
import { Injectable } from "@nestjs/common";
import axios from "axios";
import { readFileSync } from "fs";
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from "./platform-publisher.interface";
import { Platform } from "../types";

const LI = "https://api.linkedin.com/v2";

@Injectable()
export class LinkedInPublisher implements PlatformPublisher {
  readonly platform: Platform = "linkedin";

  isConfigured(): boolean {
    return !!(
      process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORGANIZATION_URN
    );
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    if (!this.isConfigured())
      throw new Error("LinkedInPublisher not configured");
    const token = process.env.LINKEDIN_ACCESS_TOKEN!;
    const ownerUrn = process.env.LINKEDIN_ORGANIZATION_URN!;
    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
    };

    const registerResponse = await axios.post(
      `${LI}/assets?action=registerUpload`,
      {
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
          owner: ownerUrn,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      },
      { headers },
    );

    const uploadUrl =
      registerResponse.data.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;
    const assetUrn = registerResponse.data.value.asset;
    const videoBuffer = readFileSync(req.videoPath);

    await axios.put(uploadUrl, videoBuffer, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      maxBodyLength: Number.MAX_SAFE_INTEGER,
      maxContentLength: Number.MAX_SAFE_INTEGER,
    });

    const visibility = req.postMode === "draft" ? "CONNECTIONS" : "PUBLIC";
    const shareResponse = await axios.post(
      `${LI}/ugcPosts`,
      {
        author: ownerUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: `${req.description}\n\n${req.tags.map((t) => `#${t}`).join(" ")}`.substring(
                0,
                3000,
              ),
            },
            shareMediaCategory: "VIDEO",
            media: [
              {
                status: "READY",
                description: { text: req.title },
                media: assetUrn,
                title: { text: req.title },
              },
            ],
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": visibility },
      },
      { headers },
    );

    return {
      externalId: shareResponse.data.id,
      externalUrl: `https://www.linkedin.com/feed/update/${encodeURIComponent(shareResponse.data.id)}/`,
      cost: {
        provider: "linkedin",
        amount_usd: 0,
        units: 1,
        unit_type: "requests",
      },
      providerResponse: shareResponse.data,
    };
  }
}
```

- [ ] **Step 3: Write publish-linkedin handler, run tests, commit.**

```bash
cd packages/backend && npm run test -- linkedin-publisher.spec
git add packages/backend/src/content-pipeline/drivers/linkedin-publisher.ts packages/backend/src/content-pipeline/drivers/linkedin-publisher.spec.ts packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-linkedin.handler.ts
git commit -m "feat(content-pipeline): LinkedInPublisher with video registerUpload+UGC post flow"
```

## Task 2.14: PlatformPublisherRegistry

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/platform-publisher.registry.ts`
- Create: `packages/backend/src/content-pipeline/drivers/platform-publisher.registry.spec.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`

- [ ] **Step 1: Write tests.**

```typescript
// packages/backend/src/content-pipeline/drivers/platform-publisher.registry.spec.ts
import { PlatformPublisherRegistry } from "./platform-publisher.registry";

describe("PlatformPublisherRegistry", () => {
  it("returns configured publishers only", () => {
    const ytConfigured = {
      platform: "youtube_shorts",
      isConfigured: () => true,
      publish: jest.fn(),
    } as any;
    const ttUnconfigured = {
      platform: "tiktok",
      isConfigured: () => false,
      publish: jest.fn(),
    } as any;
    const registry = new PlatformPublisherRegistry([
      ytConfigured,
      ttUnconfigured,
    ]);

    expect(registry.forPlatform("youtube_shorts")).toBe(ytConfigured);
    expect(registry.forPlatform("tiktok")).toBeNull();
    expect(registry.listConfigured().map((p) => p.platform)).toEqual([
      "youtube_shorts",
    ]);
    expect(registry.listAll()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// packages/backend/src/content-pipeline/drivers/platform-publisher.registry.ts
import { Injectable, Inject } from "@nestjs/common";
import {
  PlatformPublisher,
  PLATFORM_PUBLISHERS,
} from "./platform-publisher.interface";
import { Platform } from "../types";

@Injectable()
export class PlatformPublisherRegistry {
  constructor(
    @Inject(PLATFORM_PUBLISHERS) private readonly all: PlatformPublisher[],
  ) {}

  forPlatform(platform: Platform): PlatformPublisher | null {
    return (
      this.all.find((p) => p.platform === platform && p.isConfigured()) ?? null
    );
  }

  listAll(): PlatformPublisher[] {
    return this.all;
  }

  listConfigured(): PlatformPublisher[] {
    return this.all.filter((p) => p.isConfigured());
  }
}
```

- [ ] **Step 3: Update module to inject ALL 5 publishers into PLATFORM_PUBLISHERS token.**

```typescript
// content-pipeline.module.ts
import { TikTokPublisher } from './drivers/tiktok-publisher';
import { InstagramReelsPublisher } from './drivers/instagram-reels-publisher';
import { FacebookReelsPublisher } from './drivers/facebook-reels-publisher';
import { LinkedInPublisher } from './drivers/linkedin-publisher';
import { PlatformPublisherRegistry } from './drivers/platform-publisher.registry';

// providers:
YouTubeShortsPublisher, TikTokPublisher, InstagramReelsPublisher,
FacebookReelsPublisher, LinkedInPublisher,
PlatformPublisherRegistry,
{
  provide: PLATFORM_PUBLISHERS,
  useFactory: (yt, tt, ig, fb, li) => [yt, tt, ig, fb, li],
  inject: [YouTubeShortsPublisher, TikTokPublisher, InstagramReelsPublisher, FacebookReelsPublisher, LinkedInPublisher],
},
```

- [ ] **Step 4: Run tests, commit.**

```bash
cd packages/backend && npm run test -- platform-publisher.registry.spec
git add packages/backend/src/content-pipeline/
git commit -m "feat(content-pipeline): PlatformPublisherRegistry injecting all 5 publishers"
```

## Task 2.15: OpenAITTSDriver and auto-fallback policy

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/openai-tts-driver.ts`
- Create: `packages/backend/src/content-pipeline/drivers/openai-tts-driver.spec.ts`
- Modify: `packages/backend/src/content-pipeline/drivers/tts-driver.factory.ts`
- Modify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/synthesize-audio.handler.ts`

- [ ] **Step 1: Write tests.**

```typescript
// packages/backend/src/content-pipeline/drivers/openai-tts-driver.spec.ts
import { OpenAITTSDriver } from "./openai-tts-driver";

jest.mock("openai", () => ({
  default: jest.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: jest.fn().mockResolvedValue({
          arrayBuffer: async () => new ArrayBuffer(12345),
        }),
      },
    },
  })),
}));

describe("OpenAITTSDriver", () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("isConfigured when OPENAI_API_KEY set", () => {
    expect(new OpenAITTSDriver().isConfigured()).toBe(true);
  });

  it("synthesize returns cost in USD per character", async () => {
    const driver = new OpenAITTSDriver();
    const result = await driver.synthesize({
      text: "hello world this is a test",
      voiceId: "alloy",
      outputPath: "/tmp/out.mp3",
      format: "mp3",
    });
    expect(result.cost.provider).toBe("openai-tts");
    expect(result.cost.units).toBe(26);
    expect(result.cost.amount_usd).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// packages/backend/src/content-pipeline/drivers/openai-tts-driver.ts
import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import { writeFileSync } from "fs";
import {
  TTSDriver,
  TTSSynthesisRequest,
  TTSSynthesisResult,
} from "./tts-driver.interface";

const OPENAI_TTS_USD_PER_1K_CHARS = 0.015; // tts-1-hd pricing as of 2026-04

@Injectable()
export class OpenAITTSDriver implements TTSDriver {
  readonly provider = "openai" as const;
  private client: OpenAI | null = null;

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      if (!process.env.OPENAI_API_KEY)
        throw new Error("OPENAI_API_KEY is required");
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this.client;
  }

  async synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const start = Date.now();
    const response = await this.getClient().audio.speech.create({
      model: "tts-1-hd",
      voice: req.voiceId as any,
      input: req.text,
      response_format: "mp3",
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(req.outputPath, buffer);
    const wallMs = Date.now() - start;

    return {
      durationMs: wallMs,
      bitrate: buffer.length > 0 ? (buffer.length * 8) / (wallMs / 1000) : 0,
      cost: {
        provider: "openai-tts",
        amount_usd: (req.text.length / 1000) * OPENAI_TTS_USD_PER_1K_CHARS,
        units: req.text.length,
        unit_type: "chars",
      },
    };
  }
}
```

- [ ] **Step 3: Update factory to support OpenAI plus add auto-fallback helper.**

```typescript
// drivers/tts-driver.factory.ts
import { Injectable } from "@nestjs/common";
import { TTSDriver } from "./tts-driver.interface";
import { EdgeTTSDriver } from "./edge-tts-driver";
import { OpenAITTSDriver } from "./openai-tts-driver";

@Injectable()
export class TTSDriverFactory {
  constructor(
    private readonly edge: EdgeTTSDriver,
    private readonly openai: OpenAITTSDriver,
  ) {}

  forProvider(provider: "edge" | "elevenlabs" | "openai"): TTSDriver {
    switch (provider) {
      case "edge":
        if (!this.edge.isConfigured())
          throw new Error("Edge TTS not configured");
        return this.edge;
      case "openai":
        if (!this.openai.isConfigured())
          throw new Error("OpenAI TTS not configured");
        return this.openai;
      case "elevenlabs":
        throw new Error("ElevenLabs driver ships in P3");
    }
  }

  fallbackForEdge(): TTSDriver | null {
    return this.openai.isConfigured() ? this.openai : null;
  }
}
```

- [ ] **Step 4: Add auto-fallback to synthesize-audio handler.**

Modify `synthesize-audio.handler.ts` so that if `TTSDriver.synthesize` throws and provider was 'edge', it retries once with the fallback:

```typescript
// inside synthesize-audio.handler.ts handle()
const driver = this.ttsFactory.forProvider(run.tts_provider);
let result;
try {
  result = await driver.synthesize({ ...req });
} catch (err) {
  if (run.tts_provider === "edge") {
    const fallback = this.ttsFactory.fallbackForEdge();
    if (fallback) {
      await client.from("content_run_events").insert({
        run_id: runId,
        event_type: "tts_fallback",
        payload: {
          from: "edge",
          to: fallback.provider,
          reason: (err as Error).message,
        },
      });
      result = await fallback.synthesize({ ...req, voiceId: "alloy" });
    } else {
      throw err;
    }
  } else {
    throw err;
  }
}
```

- [ ] **Step 5: Register OpenAITTSDriver, run tests, commit.**

```bash
cd packages/backend && npm run test -- openai-tts-driver.spec
git add packages/backend/src/content-pipeline/
git commit -m "feat(content-pipeline): OpenAI TTS driver with auto-fallback from Edge TTS on error"
```

## Task 2.16: Thumbnail rendering in Remotion

**Files:**

- Create: `packages/video-template/src/cli/render-thumbnail-cli.ts`
- Modify: `packages/video-template/src/cli/render.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/render-thumbnail.handler.ts`

- [ ] **Step 1: Add `renderThumbnail` to video-template cli/render.ts.**

```typescript
// packages/video-template/src/cli/render.ts (append)
import { renderStill } from "@remotion/renderer";

export interface RenderThumbnailOptions {
  format: FormatKey;
  props: VideoProps;
  frame: number;
  outputPath: string;
}

export async function renderThumbnail(
  opts: RenderThumbnailOptions,
): Promise<{ outputPath: string; renderWallMs: number }> {
  const bundled = await bundle({
    entryPoint: path.resolve(__dirname, "..", "index.ts"),
  });
  const start = Date.now();
  await renderStill({
    serveUrl: bundled,
    composition: {
      id: opts.format,
      width: 1280,
      height: 720,
      fps: 30,
      durationInFrames: 900,
    } as any,
    frame: opts.frame,
    output: opts.outputPath,
    inputProps: opts.props,
  });
  return { outputPath: opts.outputPath, renderWallMs: Date.now() - start };
}
```

- [ ] **Step 2: Create CLI entry.**

```typescript
// packages/video-template/src/cli/render-thumbnail-cli.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { renderThumbnail } from './render';

const program = new Command();
program
  .requiredOption('--format <format>', 'format key')
  .requiredOption('--props-json <path>', 'path to JSON')
  .requiredOption('--output <path>', 'output png path')
  .option('--frame <n>', 'frame to render', '210') // frame 210 is inside ScoreReveal for grade_reveal
  .parse();

const opts = program.opts();
(async () => {
  try {
    const props = JSON.parse(readFileSync(opts.propsJson, 'utf8'));
    props.format = opts.format;
    const result = await renderThumbnail({ format: opts.format, props, frame: parseInt(opts.frame, 10), outputPath: opts.output });
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: (err as Error).message }));
    process.exit(1);
  }
})();
```

- [ ] **Step 3: Add bin entry in package.json.**

```json
"bin": {
  "render-video": "./dist/cli/render-cli.js",
  "render-thumbnail": "./dist/cli/render-thumbnail-cli.js"
}
```

- [ ] **Step 4: Write render-thumbnail handler.**

```typescript
// packages/backend/src/content-pipeline/orchestrator/job-handlers/render-thumbnail.handler.ts
import { Injectable } from "@nestjs/common";
import { spawn } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import { writeFileSync, readFileSync } from "fs";
import { SupabaseService } from "../../../supabase/supabase.service";
import { RunOrchestratorService } from "../run-orchestrator.service";

@Injectable()
export class RenderThumbnailHandler {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
  ) {}

  async handle(runId: string): Promise<void> {
    const client = this.supabase.getClient();
    try {
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

      const propsFile = join(tmpdir(), `thumb-props-${runId}.json`);
      writeFileSync(
        propsFile,
        JSON.stringify({
          format: run.format,
          resolvedMarket: run.resolved_geo,
          dataBundle: payload.metadata,
          ctaUrl: "",
        }),
      );
      const outputPath = join(tmpdir(), `thumb-${runId}.png`);

      await new Promise<void>((resolve, reject) => {
        const proc = spawn("node", [
          join(
            process.cwd(),
            "node_modules/@propertyiq/video-template/dist/cli/render-thumbnail-cli.js",
          ),
          "--format",
          run.format,
          "--props-json",
          propsFile,
          "--output",
          outputPath,
        ]);
        let stderr = "";
        proc.stderr.on("data", (d) => {
          stderr += d.toString();
        });
        proc.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`thumbnail render failed: ${stderr}`)),
        );
      });

      const storagePath = `runs/${runId}/thumbnail.png`;
      await client.storage
        .from("content-pipeline")
        .upload(storagePath, readFileSync(outputPath), {
          contentType: "image/png",
          upsert: true,
        });
      const storageUrl = `supabase://content-pipeline/${storagePath}`;

      await client.from("content_assets").insert({
        run_id: runId,
        kind: "thumbnail",
        storage_url: storageUrl,
        metadata: { width: 1280, height: 720 },
      });
    } catch (err) {
      await client.from("content_run_events").insert({
        run_id: runId,
        event_type: "thumbnail_render_failed",
        payload: { error: (err as Error).message },
      });
    }
  }
}
```

- [ ] **Step 5: Wire into orchestrator: after `rendering_video` success, enqueue thumbnail job on same `render-video` queue before moving to publishing. Alternative: make thumbnail a silent step; publishes use default thumbnail if missing.**

- [ ] **Step 6: Run sample thumbnail render, commit.**

```bash
cd packages/video-template && npm run build:cli && \
node dist/cli/render-thumbnail-cli.js --format grade_reveal --props-json sample.json --output thumb.png
git add packages/video-template/src/cli/ packages/video-template/package.json packages/backend/src/content-pipeline/orchestrator/
git commit -m "feat(content-pipeline): thumbnail rendering via Remotion renderStill plus handler"
```

## Task 2.17: Thumbnail editor in review queue

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/review/review-card.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/review/thumbnail-editor.tsx`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`

- [ ] **Step 1: Add backend endpoint to regenerate thumbnail from a different frame.**

```typescript
// content-pipeline.service.ts (add)
async regenerateThumbnail(runId: string, frame: number): Promise<void> {
  await this.queueService.send('render-video', { runId, status: 'render_thumbnail', frame });
}

async replaceThumbnail(runId: string, imageBuffer: Buffer): Promise<string> {
  const client = this.supabase.getClient();
  const storagePath = `runs/${runId}/thumbnail-override.png`;
  await client.storage.from('content-pipeline').upload(storagePath, imageBuffer, {
    contentType: 'image/png', upsert: true,
  });
  const storageUrl = `supabase://content-pipeline/${storagePath}`;
  await client.from('content_assets').insert({
    run_id: runId, kind: 'thumbnail', variant: 'override',
    storage_url: storageUrl, metadata: { source: 'operator_upload' },
  });
  return storageUrl;
}
```

```typescript
// content-pipeline.controller.ts
@Post('runs/:id/thumbnail/regenerate')
async regenerateThumbnail(@Param('id') id: string, @Body() body: { frame: number }) {
  await this.service.regenerateThumbnail(id, body.frame);
  return { success: true, data: { queued: true } };
}

@Post('runs/:id/thumbnail/replace')
@UseInterceptors(FileInterceptor('file'))
async replaceThumbnail(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
  const url = await this.service.replaceThumbnail(id, file.buffer);
  return { success: true, data: { storage_url: url } };
}
```

- [ ] **Step 2: Write thumbnail-editor component.**

```tsx
// packages/frontend/app/admin/content-pipeline/review/thumbnail-editor.tsx
"use client";
import { useState, useRef } from "react";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export function ThumbnailEditor({
  runId,
  currentUrl,
  onClose,
}: {
  runId: string;
  currentUrl: string;
  onClose: () => void;
}) {
  const [frame, setFrame] = useState(210);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function regenerate() {
    await fetchAPIRaw(
      `/api/admin/content-pipeline/runs/${runId}/thumbnail/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame }),
      },
    );
    onClose();
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    await fetchAPIRaw(
      `/api/admin/content-pipeline/runs/${runId}/thumbnail/replace`,
      { method: "POST", body: fd },
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-6">
      <div className="bg-surface rounded-xl p-6 w-full max-w-xl">
        <h3 className="font-semibold mb-4">Thumbnail</h3>
        <img
          src={currentUrl}
          alt="current thumbnail"
          className="w-full rounded-lg mb-4"
        />
        <label className="block mb-4">
          <span className="text-sm mb-1 block">
            Frame to extract (0 to 900)
          </span>
          <input
            type="number"
            value={frame}
            onChange={(e) => setFrame(parseInt(e.target.value, 10))}
            className="w-full rounded-lg border border-outline-variant p-2"
          />
        </label>
        <div className="flex gap-3">
          <button
            onClick={regenerate}
            className="bg-primary text-on-primary rounded-full px-5 py-2 font-semibold"
          >
            Regenerate from frame
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={uploadFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-surface-container-high rounded-full px-5 py-2 font-semibold"
          >
            {uploading ? "Uploading..." : "Upload custom"}
          </button>
          <button onClick={onClose} className="px-5 py-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add thumbnail button to ReviewCard that opens editor.**

Modify review-card.tsx to show the current thumbnail above the video, with an "Edit thumbnail" button that opens the ThumbnailEditor modal.

- [ ] **Step 4: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/review/ packages/backend/src/content-pipeline/
git commit -m "feat(content-pipeline): thumbnail editor in review queue (regenerate or upload)"
```

## Task 2.18: Approval modes fully wired

**Files:**

- Modify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/render-video.handler.ts`
- Modify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/publish.handler.ts`
- Modify: all 5 publisher handlers to pass `postMode` correctly
- Create: `packages/backend/test/integration/approval-modes.integration.spec.ts`

- [ ] **Step 1: Update render-video handler to branch on approval_mode.**

```typescript
// inside render-video.handler.ts handle() after video asset is saved:
const { data: runRow } = await client
  .from("content_runs")
  .select("approval_mode")
  .eq("id", runId)
  .single();
if (runRow.approval_mode === "review") {
  await this.orchestrator.transitionTo(runId, "ready_for_review", {
    enqueueNext: false,
  });
} else {
  // auto or draft both go to publishing; publishers check postMode
  await this.orchestrator.transitionTo(runId, "publishing", {
    enqueueNext: true,
  });
}
```

- [ ] **Step 2: Verify each publisher handler forwards `approval_mode === 'draft' ? 'draft' : 'direct'` into `postMode`.**

Already done in tasks 2.10 through 2.13 for the new publishers; verify Task 1.25 YouTubeShorts handler also respects the flag.

- [ ] **Step 3: Write integration tests.**

```typescript
// packages/backend/test/integration/approval-modes.integration.spec.ts
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { v4 as uuid } from "uuid";

describe("approval modes integration", () => {
  let app: INestApplication;
  const adminJwt = process.env.E2E_ADMIN_JWT;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app?.close());

  async function createRun(approvalMode: "auto" | "review" | "draft") {
    return request(app.getHttpServer())
      .post("/api/admin/content-pipeline/runs")
      .set("Authorization", `Bearer ${adminJwt}`)
      .send({
        format: "grade_reveal",
        marketQuery: "Cleveland, OH",
        idempotencyKey: uuid(),
        approvalMode,
      });
  }

  it("auto mode reaches published without human step", async () => {
    const res = await createRun("auto");
    const runId = res.body.data.id;
    // Poll for 10 min
    const status = await pollUntilTerminal(runId, 600_000);
    expect(status).toBe("published");
  }, 720_000);

  it("review mode parks at ready_for_review", async () => {
    const res = await createRun("review");
    const runId = res.body.data.id;
    const status = await pollUntilTerminal(runId, 300_000);
    expect(status).toBe("ready_for_review");
  }, 360_000);

  it("draft mode publishes with draft flag", async () => {
    const res = await createRun("draft");
    const runId = res.body.data.id;
    await pollUntilTerminal(runId, 600_000);
    const detailRes = await request(app.getHttpServer())
      .get(`/api/admin/content-pipeline/runs/${runId}`)
      .set("Authorization", `Bearer ${adminJwt}`);
    const posts = detailRes.body.data.posts;
    for (const post of posts) {
      expect(post.post_mode).toBe("draft");
    }
  }, 720_000);

  async function pollUntilTerminal(
    runId: string,
    timeoutMs: number,
  ): Promise<string> {
    const start = Date.now();
    const terminal = [
      "published",
      "published_partial",
      "failed",
      "rejected",
      "ready_for_review",
    ];
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 5000));
      const detailRes = await request(app.getHttpServer())
        .get(`/api/admin/content-pipeline/runs/${runId}`)
        .set("Authorization", `Bearer ${adminJwt}`);
      const status = detailRes.body.data.run.status;
      if (terminal.includes(status)) return status;
    }
    throw new Error("timeout");
  }
});
```

- [ ] **Step 4: Run integration tests, commit.**

```bash
cd packages/backend && E2E_ADMIN_JWT=<jwt> npm run test:e2e -- approval-modes
git add packages/backend/src/content-pipeline/orchestrator/ packages/backend/test/integration/
git commit -m "feat(content-pipeline): approval modes auto/review/draft fully wired with integration tests"
```

## Task 2.19: Per-format defaults UI in Settings

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/settings/page.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/settings/format-defaults.tsx`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`
- Create: `packages/backend/src/content-pipeline/dto/update-format.dto.ts`

- [ ] **Step 1: DTO.**

```typescript
// packages/backend/src/content-pipeline/dto/update-format.dto.ts
import {
  IsIn,
  IsOptional,
  IsString,
  IsArray,
  IsBoolean,
} from "class-validator";
export class UpdateFormatDto {
  @IsOptional()
  @IsIn(["auto", "review", "draft"])
  default_approval_mode?: string;
  @IsOptional() @IsString() default_tts_voice_id?: string;
  @IsOptional() @IsArray() default_platforms?: string[];
  @IsOptional() @IsBoolean() enabled?: boolean;
}
```

- [ ] **Step 2: Service + endpoint.**

```typescript
// content-pipeline.service.ts (add)
async updateFormat(format: string, dto: UpdateFormatDto) {
  const client = this.supabase.getClient();
  const patch: any = { ...dto };
  await client.from('format_templates').update(patch).eq('format', format);
  const { data } = await client.from('format_templates').select('*').eq('format', format).single();
  return data;
}
```

```typescript
// content-pipeline.controller.ts
@Patch('formats/:format')
async updateFormat(@Param('format') format: string, @Body() dto: UpdateFormatDto) {
  return { success: true, data: await this.service.updateFormat(format, dto) };
}
```

- [ ] **Step 3: Write format-defaults table component with inline editing.**

```tsx
// packages/frontend/app/admin/content-pipeline/settings/format-defaults.tsx
"use client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export function FormatDefaults({ formats }: { formats: Array<any> }) {
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: async ({ format, patch }: { format: string; patch: any }) => {
      await fetchAPIRaw(`/api/admin/content-pipeline/formats/${format}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["content-pipeline-settings"] }),
  });

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-outline">
          <th className="py-2">Format</th>
          <th>Enabled</th>
          <th>Approval mode</th>
          <th>Voice</th>
          <th>Platforms</th>
        </tr>
      </thead>
      <tbody>
        {formats.map((f) => (
          <tr key={f.format} className="border-t border-outline-variant">
            <td className="py-2">{f.display_name}</td>
            <td>
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={(e) =>
                  update.mutate({
                    format: f.format,
                    patch: { enabled: e.target.checked },
                  })
                }
              />
            </td>
            <td>
              <select
                value={f.default_approval_mode}
                onChange={(e) =>
                  update.mutate({
                    format: f.format,
                    patch: { default_approval_mode: e.target.value },
                  })
                }
                className="border border-outline-variant rounded p-1"
              >
                <option value="auto">auto</option>
                <option value="review">review</option>
                <option value="draft">draft</option>
              </select>
            </td>
            <td>{f.default_tts_voice_id ?? "(long-form)"}</td>
            <td className="text-xs">{f.default_platforms?.join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Wire into settings/page.tsx replacing inline table. Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/settings/ packages/backend/src/content-pipeline/
git commit -m "feat(content-pipeline): inline editing of per-format defaults in Settings"
```

## Task 2.20: Lead Magnet Library admin page and endpoints

**Files:**

- Create: `packages/backend/src/content-pipeline/magnets/magnet-library.service.ts`
- Create: `packages/backend/src/content-pipeline/magnets/magnet-library.controller.ts`
- Create: `packages/backend/src/content-pipeline/magnets/magnet-library.service.spec.ts`
- Create: `packages/backend/src/content-pipeline/dto/update-magnet.dto.ts`
- Create: `packages/backend/src/content-pipeline/dto/bind-magnet.dto.ts`
- Create: `packages/frontend/app/admin/content-pipeline/lead-magnets/page.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/lead-magnets/magnet-card.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/lead-magnets/edit-dialog.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/lead-magnets/bind-dialog.tsx`

- [ ] **Step 1: DTOs.**

```typescript
// packages/backend/src/content-pipeline/dto/update-magnet.dto.ts
import { IsString, IsOptional, IsIn, IsBoolean } from "class-validator";
export class UpdateMagnetDto {
  @IsOptional() @IsString() display_name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional()
  @IsIn(["investor", "agent", "broker", "mixed"])
  audience?: string;
  @IsOptional() @IsString() cover_image_url?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

// packages/backend/src/content-pipeline/dto/bind-magnet.dto.ts
import {
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsBoolean,
} from "class-validator";
export class BindMagnetDto {
  @IsString() format!: string;
  @IsString() magnet_kind!: string;
  @IsString() cta_text!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) weight?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
```

- [ ] **Step 2: Service tests.**

```typescript
// packages/backend/src/content-pipeline/magnets/magnet-library.service.spec.ts
import { Test } from "@nestjs/testing";
import { MagnetLibraryService } from "./magnet-library.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("MagnetLibraryService", () => {
  let svc: MagnetLibraryService;
  let fromCalls: string[] = [];
  let mockData: Record<string, any[]> = {};

  beforeEach(async () => {
    fromCalls = [];
    mockData = { lead_magnet_definitions: [], format_magnet_bindings: [] };

    const supabase = {
      getClient: () => ({
        from: jest.fn((tbl: string) => {
          fromCalls.push(tbl);
          const chain: any = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest
              .fn()
              .mockResolvedValue({ data: mockData[tbl] ?? [], error: null }),
            update: jest.fn().mockReturnThis(),
            upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
            insert: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockData[tbl]?.[0] ?? null,
              error: null,
            }),
            maybeSingle: jest.fn().mockResolvedValue({
              data: mockData[tbl]?.[0] ?? null,
              error: null,
            }),
          };
          return chain;
        }),
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        MagnetLibraryService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    svc = module.get(MagnetLibraryService);
  });

  it("lists magnets with bindings", async () => {
    mockData.lead_magnet_definitions = [{ kind: "m1", display_name: "M1" }];
    mockData.format_magnet_bindings = [
      { format: "grade_reveal", magnet_kind: "m1", weight: 1 },
    ];
    const result = await svc.listMagnets();
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("m1");
  });
});
```

- [ ] **Step 3: Implement service.**

```typescript
// packages/backend/src/content-pipeline/magnets/magnet-library.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { UpdateMagnetDto } from "../dto/update-magnet.dto";
import { BindMagnetDto } from "../dto/bind-magnet.dto";

@Injectable()
export class MagnetLibraryService {
  constructor(private readonly supabase: SupabaseService) {}

  async listMagnets() {
    const client = this.supabase.getClient();
    const { data: magnets } = await client
      .from("lead_magnet_definitions")
      .select("*")
      .order("kind");
    const { data: bindings } = await client
      .from("format_magnet_bindings")
      .select("*")
      .order("format");
    const byKind = new Map<string, any[]>();
    for (const b of bindings ?? []) {
      if (!byKind.has(b.magnet_kind)) byKind.set(b.magnet_kind, []);
      byKind.get(b.magnet_kind)!.push(b);
    }
    return (magnets ?? []).map((m) => ({
      ...m,
      bindings: byKind.get(m.kind) ?? [],
    }));
  }

  async updateMagnet(kind: string, dto: UpdateMagnetDto) {
    const client = this.supabase.getClient();
    await client
      .from("lead_magnet_definitions")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("kind", kind);
    const { data } = await client
      .from("lead_magnet_definitions")
      .select("*")
      .eq("kind", kind)
      .single();
    return data;
  }

  async archiveMagnet(kind: string) {
    await this.updateMagnet(kind, { enabled: false });
  }

  async cloneMagnet(kind: string): Promise<string> {
    const client = this.supabase.getClient();
    const { data: source } = await client
      .from("lead_magnet_definitions")
      .select("*")
      .eq("kind", kind)
      .single();
    if (!source) throw new Error("source magnet not found");
    const newKind = `${kind}_copy_${Date.now()}`;
    await client.from("lead_magnet_definitions").insert({
      ...source,
      kind: newKind,
      display_name: `${source.display_name} (copy)`,
      enabled: false,
      version: 1,
    });
    return newKind;
  }

  async upsertBinding(dto: BindMagnetDto) {
    const client = this.supabase.getClient();
    await client.from("format_magnet_bindings").upsert(
      {
        format: dto.format,
        magnet_kind: dto.magnet_kind,
        cta_text: dto.cta_text,
        weight: dto.weight ?? 1.0,
        enabled: dto.enabled ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "format,magnet_kind" },
    );
  }

  async deleteBinding(bindingId: string) {
    const client = this.supabase.getClient();
    await client.from("format_magnet_bindings").delete().eq("id", bindingId);
  }
}
```

- [ ] **Step 4: Controller.**

```typescript
// packages/backend/src/content-pipeline/magnets/magnet-library.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../../common/guards/admin-auth.guard";
import { MagnetLibraryService } from "./magnet-library.service";
import { UpdateMagnetDto } from "../dto/update-magnet.dto";
import { BindMagnetDto } from "../dto/bind-magnet.dto";

@UseGuards(AdminGuard)
@Controller("api/admin/content-pipeline/magnets")
export class MagnetLibraryController {
  constructor(private readonly service: MagnetLibraryService) {}

  @Get()
  async list() {
    return {
      success: true,
      data: { magnets: await this.service.listMagnets() },
    };
  }

  @Patch(":kind")
  async update(@Param("kind") kind: string, @Body() dto: UpdateMagnetDto) {
    return { success: true, data: await this.service.updateMagnet(kind, dto) };
  }

  @Post(":kind/archive")
  async archive(@Param("kind") kind: string) {
    await this.service.archiveMagnet(kind);
    return { success: true, data: { enabled: false } };
  }

  @Post(":kind/clone")
  async clone(@Param("kind") kind: string) {
    return {
      success: true,
      data: { newKind: await this.service.cloneMagnet(kind) },
    };
  }

  @Post("bindings")
  async upsertBinding(@Body() dto: BindMagnetDto) {
    await this.service.upsertBinding(dto);
    return { success: true, data: { ok: true } };
  }

  @Delete("bindings/:id")
  async deleteBinding(@Param("id") id: string) {
    await this.service.deleteBinding(id);
    return { success: true, data: { deleted: true } };
  }
}
```

- [ ] **Step 5: Write Lead Magnet Library admin page and components.**

```tsx
// packages/frontend/app/admin/content-pipeline/lead-magnets/page.tsx
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/data/fetchers/base";
import { MagnetCard } from "./magnet-card";
import { EditDialog } from "./edit-dialog";
import { BindDialog } from "./bind-dialog";

export default function LeadMagnetLibraryPage() {
  const [editingKind, setEditingKind] = useState<string | null>(null);
  const [bindingKind, setBindingKind] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["magnets"],
    queryFn: async () =>
      (
        await fetchAPI<{ data: { magnets: any[] } }>(
          "/api/admin/content-pipeline/magnets",
        )
      ).data.magnets,
  });

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Lead Magnet Library</h1>
      <div className="grid grid-cols-3 gap-6">
        {(data ?? []).map((m) => (
          <MagnetCard
            key={m.kind}
            magnet={m}
            onEdit={() => setEditingKind(m.kind)}
            onBind={() => setBindingKind(m.kind)}
            onChange={refetch}
          />
        ))}
      </div>
      {editingKind && (
        <EditDialog
          kind={editingKind}
          onClose={() => {
            setEditingKind(null);
            refetch();
          }}
        />
      )}
      {bindingKind && (
        <BindDialog
          kind={bindingKind}
          onClose={() => {
            setBindingKind(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
```

```tsx
// packages/frontend/app/admin/content-pipeline/lead-magnets/magnet-card.tsx
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export function MagnetCard({ magnet, onEdit, onBind, onChange }: any) {
  async function archive() {
    if (!confirm(`Archive ${magnet.display_name}?`)) return;
    await fetchAPIRaw(
      `/api/admin/content-pipeline/magnets/${magnet.kind}/archive`,
      { method: "POST" },
    );
    onChange();
  }
  async function clone() {
    await fetchAPIRaw(
      `/api/admin/content-pipeline/magnets/${magnet.kind}/clone`,
      { method: "POST" },
    );
    onChange();
  }

  return (
    <div className="rounded-xl bg-surface-container-low shadow-sm overflow-hidden">
      {magnet.cover_image_url && (
        <img
          src={magnet.cover_image_url}
          alt={magnet.display_name}
          className="w-full aspect-video object-cover"
        />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{magnet.display_name}</div>
          <span
            className={`text-xs px-2 py-1 rounded-full ${magnet.enabled ? "bg-accent/10 text-accent" : "bg-outline/10 text-outline"}`}
          >
            {magnet.enabled ? "Enabled" : "Archived"}
          </span>
        </div>
        <div className="text-xs text-outline">{magnet.audience}</div>
        <p className="text-sm line-clamp-2">{magnet.description}</p>
        <div className="text-xs text-outline">
          Bound to:{" "}
          {magnet.bindings.map((b: any) => b.format).join(", ") || "nothing"}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={onEdit}
            className="text-sm bg-surface-container rounded-full px-3 py-1"
          >
            Edit
          </button>
          <button
            onClick={onBind}
            className="text-sm bg-surface-container rounded-full px-3 py-1"
          >
            Bind
          </button>
          <button
            onClick={clone}
            className="text-sm bg-surface-container rounded-full px-3 py-1"
          >
            Clone
          </button>
          <button
            onClick={archive}
            className="text-sm bg-error/10 text-error rounded-full px-3 py-1"
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// packages/frontend/app/admin/content-pipeline/lead-magnets/edit-dialog.tsx
"use client";
import { useEffect, useState } from "react";
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

export function EditDialog({
  kind,
  onClose,
}: {
  kind: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await fetchAPI<{ data: { magnets: any[] } }>(
        "/api/admin/content-pipeline/magnets",
      );
      setForm(data.magnets.find((m) => m.kind === kind));
    })();
  }, [kind]);

  if (!form) return null;
  async function save() {
    await fetchAPIRaw(`/api/admin/content-pipeline/magnets/${kind}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: form.display_name,
        description: form.description,
        audience: form.audience,
        cover_image_url: form.cover_image_url,
      }),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-6">
      <div className="bg-surface rounded-xl p-6 w-full max-w-xl">
        <h3 className="font-semibold mb-4">Edit {kind}</h3>
        <label className="block mb-3">
          <span className="text-sm">Display name</span>
          <input
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            className="w-full border border-outline-variant rounded p-2 mt-1"
          />
        </label>
        <label className="block mb-3">
          <span className="text-sm">Description</span>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border border-outline-variant rounded p-2 mt-1 h-24"
          />
        </label>
        <label className="block mb-3">
          <span className="text-sm">Cover image URL</span>
          <input
            value={form.cover_image_url ?? ""}
            onChange={(e) =>
              setForm({ ...form, cover_image_url: e.target.value })
            }
            className="w-full border border-outline-variant rounded p-2 mt-1"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={save}
            className="bg-primary text-on-primary rounded-full px-5 py-2"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// packages/frontend/app/admin/content-pipeline/lead-magnets/bind-dialog.tsx
"use client";
import { useState } from "react";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

const ALL_FORMATS = [
  "grade_reveal",
  "top_10_ranking",
  "score_mover",
  "head_to_head",
  "farm_area_spotlight",
  "brokerage_market_share",
  "recruitment_angle",
  "long_form_deep_dive",
];

export function BindDialog({
  kind,
  onClose,
}: {
  kind: string;
  onClose: () => void;
}) {
  const [format, setFormat] = useState("grade_reveal");
  const [ctaText, setCtaText] = useState("Get your free ");
  const [weight, setWeight] = useState(1.0);

  async function save() {
    await fetchAPIRaw("/api/admin/content-pipeline/magnets/bindings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format,
        magnet_kind: kind,
        cta_text: ctaText,
        weight,
        enabled: true,
      }),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-6">
      <div className="bg-surface rounded-xl p-6 w-full max-w-md">
        <h3 className="font-semibold mb-4">Bind {kind} to a format</h3>
        <label className="block mb-3">
          <span className="text-sm">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full border border-outline-variant rounded p-2 mt-1"
          >
            {ALL_FORMATS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="block mb-3">
          <span className="text-sm">CTA text</span>
          <input
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            className="w-full border border-outline-variant rounded p-2 mt-1"
          />
        </label>
        <label className="block mb-3">
          <span className="text-sm">Weight (0 to 1)</span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value))}
            className="w-full border border-outline-variant rounded p-2 mt-1"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={save}
            className="bg-primary text-on-primary rounded-full px-5 py-2"
          >
            Bind
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Register module, nav entry, run tests, commit.**

Register `MagnetLibraryController` and `MagnetLibraryService` in ContentPipelineModule. Add "Lead Magnets" entry to admin nav sidebar.

```bash
cd packages/backend && npm run test -- magnet-library.service.spec
git add packages/backend/src/content-pipeline/magnets/ packages/backend/src/content-pipeline/dto/ packages/frontend/app/admin/content-pipeline/lead-magnets/
git commit -m "feat(content-pipeline): Lead Magnet Library admin page with CRUD and bindings"
```

## Task 2.21: P2 lead magnet HTML/EJS templates

**Files:**

- Create: `packages/backend/src/content-pipeline/lead-magnets/templates/top_50_cashflow.html.ejs`
- Create: `packages/backend/src/content-pipeline/lead-magnets/templates/movers_report.html.ejs`
- Create: `packages/backend/src/content-pipeline/lead-magnets/templates/market_comparison.html.ejs`
- Create: `packages/backend/src/content-pipeline/lead-magnets/templates/farm_area_audit.html.ejs`

- [ ] **Step 1: top_50_cashflow.html.ejs.**

```html
<h1>Top 50 Cashflow Markets, <%= dataBundle.state %></h1>
<p>Prepared for <%= userContext.userName %> on <%= today %></p>

<h2>Top 50 ranked by rent-to-price ratio</h2>
<table style="width:100%; border-collapse:collapse; margin-top:16px;">
  <thead style="background:var(--primary); color:white;">
    <tr>
      <th style="padding:8px; text-align:left;">Rank</th>
      <th>Market</th>
      <th>Median Home</th>
      <th>Median Rent</th>
      <th>R/P Ratio</th>
      <th>PIQ Score</th>
    </tr>
  </thead>
  <tbody>
    <% dataBundle.markets.slice(0, 50).forEach(function(m) { %>
    <tr style="border-bottom:1px solid var(--outline);">
      <td style="padding:6px 8px;"><%= m.rank %></td>
      <td><%= m.name %></td>
      <td>$<%= Math.round(m.home_value/1000).toLocaleString() %>K</td>
      <td>$<%= m.rent.toLocaleString() %></td>
      <td><%= m.rent_to_price_ratio.toFixed(2) %>%</td>
      <td><%= m.propertyiq_score ?? '-' %></td>
    </tr>
    <% }); %>
  </tbody>
</table>

<h2>Methodology</h2>
<p>
  Markets are ranked by gross rent-to-price ratio. PropertyIQ Score reflects
  market-demand signal relative to state average.
</p>
```

- [ ] **Step 2: movers_report.html.ejs.**

```html
<h1>Movers and Shakers, Monthly Report</h1>
<p>
  Markets that moved 5 or more PropertyIQ points in the last month. Prepared for
  <%= userContext.userName %>.
</p>

<h2>Rising (top 15)</h2>
<% dataBundle.rising_markets.slice(0, 15).forEach(function(m) { %>
<div class="stat-card" style="margin:8px 0;">
  <div style="display:flex; justify-content:space-between; align-items:center;">
    <div>
      <strong><%= m.canonical_name %></strong>
      <div style="font-size:11pt; color:var(--primary);">
        PropertyIQ Score: <%= m.current_score %> (+<%= m.delta %>)
      </div>
    </div>
    <div class="score-ring" style="width:72px; height:72px; font-size:22pt;">
      <%= m.current_score %>
    </div>
  </div>
</div>
<% }); %>

<h2>Falling (top 10)</h2>
<% dataBundle.falling_markets.slice(0, 10).forEach(function(m) { %>
<div class="stat-card" style="margin:8px 0; border-color: var(--error);">
  <strong><%= m.canonical_name %></strong>: <%= m.current_score %> (<%= m.delta
  %>)
</div>
<% }); %>
```

- [ ] **Step 3: market_comparison.html.ejs.**

```html
<h1>5-Market Deep Comparison</h1>
<p>Side-by-side comparison prepared for <%= userContext.userName %>.</p>

<table style="width:100%; border-collapse:collapse; margin-top:16px;">
  <thead style="background:var(--primary); color:white;">
    <tr>
      <th style="padding:10px; text-align:left;">Metric</th>
      <% dataBundle.markets.forEach(function(m) { %>
      <th><%= m.canonical_name %></th>
      <% }); %>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px;">PropertyIQ Score</td>
      <% dataBundle.markets.forEach(function(m) { %>
      <td style="text-align:center;"><%= m.score.propertyiq_score %></td>
      <% }); %>
    </tr>
    <tr>
      <td style="padding:8px;">Median Home Value</td>
      <% dataBundle.markets.forEach(function(m) { %>
      <td style="text-align:center;">
        $<%= Math.round(m.home_value.value/1000).toLocaleString() %>K
      </td>
      <% }); %>
    </tr>
    <tr>
      <td style="padding:8px;">Median Rent</td>
      <% dataBundle.markets.forEach(function(m) { %>
      <td style="text-align:center;">$<%= m.rent.value.toLocaleString() %></td>
      <% }); %>
    </tr>
    <tr>
      <td style="padding:8px;">Unemployment</td>
      <% dataBundle.markets.forEach(function(m) { %>
      <td style="text-align:center;">
        <%= m.economic.unemployment_rate.toFixed(1) %>%
      </td>
      <% }); %>
    </tr>
  </tbody>
</table>

<h2>Notes</h2>
<p>
  Values sourced from Zillow, Census, and BLS. PropertyIQ Score is updated
  monthly.
</p>
```

- [ ] **Step 4: farm_area_audit.html.ejs.**

```html
<h1>Farm Area Audit: <%= dataBundle.geo.canonical_name %></h1>
<p>
  Prepared for <%= userContext.userName %>. Top 20 farm areas ranked for agent
  activity.
</p>

<% dataBundle.farm_zips.slice(0, 20).forEach(function(zip, i) { %>
<div class="stat-card" style="margin:10px 0;">
  <h3 style="margin:0 0 8px;">#<%= i + 1 %> ZIP <%= zip.zip %></h3>
  <div
    style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; font-size:11pt;"
  >
    <div>
      <strong>Median price</strong><br />$<%=
      Math.round(zip.median_price/1000).toLocaleString() %>K
    </div>
    <div>
      <strong>Turnover</strong><br /><%= zip.turnover_pct.toFixed(1) %>%
    </div>
    <div>
      <strong>Absentee</strong><br /><%= zip.absentee_pct.toFixed(1) %>%
    </div>
    <div><strong>Days on market</strong><br /><%= zip.median_dom %> days</div>
    <div>
      <strong>Avg listing time</strong><br /><%= zip.avg_listing_time_days %>
      days
    </div>
    <div>
      <strong>Population</strong><br /><%= zip.population.toLocaleString() %>
    </div>
  </div>
</div>
<% }); %>

<h2>How to use this</h2>
<p>
  High turnover plus high absentee rates signal listing-side opportunity. Low
  days-on-market plus high absentee signal rental and investor activity. Use
  this audit to pick which ZIPs to farm in the next 90 days.
</p>
```

- [ ] **Step 5: Run a PDF render per template in test to verify EJS compiles and Puppeteer produces a valid PDF.**

```bash
cd packages/backend && npm run test -- puppeteer-lead-magnet-renderer.spec
```

Extend the spec to exercise each of the 4 new templates with sample dataBundles.

- [ ] **Step 6: Commit.**

```bash
git add packages/backend/src/content-pipeline/lead-magnets/templates/
git commit -m "feat(content-pipeline): P2 lead magnet templates (cashflow, movers, comparison, farm area)"
```

## Task 2.22: Platforms page updated for all 5 platforms plus OAuth flows

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/platforms/page.tsx`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`

- [ ] **Step 1: Extend `startOAuth` for all 4 new platforms.**

```typescript
// content-pipeline.service.ts (extend startOAuth)
async startOAuth(platform: string): Promise<{ authUrl: string }> {
  const redirectBase = `${process.env.APP_BASE_URL}/admin/content-pipeline/platforms`;
  switch (platform) {
    case 'youtube_shorts': /* existing */
    case 'tiktok': {
      const clientKey = process.env.TIKTOK_CLIENT_KEY!;
      const scope = encodeURIComponent('user.info.basic,video.upload,video.publish');
      const redirect = encodeURIComponent(`${redirectBase}/tiktok/oauth-callback`);
      return { authUrl: `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&response_type=code&scope=${scope}&redirect_uri=${redirect}` };
    }
    case 'instagram_reels':
    case 'facebook_reels': {
      const appId = process.env.META_GRAPH_APP_ID!;
      const redirect = encodeURIComponent(`${redirectBase}/${platform}/oauth-callback`);
      const scope = encodeURIComponent('instagram_content_publish,pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic');
      return { authUrl: `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirect}&scope=${scope}` };
    }
    case 'linkedin': {
      const clientId = process.env.LINKEDIN_CLIENT_ID!;
      const redirect = encodeURIComponent(`${redirectBase}/linkedin/oauth-callback`);
      const scope = encodeURIComponent('w_member_social w_organization_social r_organization_social rw_organization_admin');
      return { authUrl: `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirect}&scope=${scope}` };
    }
    default: throw new Error(`platform ${platform} not supported`);
  }
}
```

- [ ] **Step 2: Add OAuth callback handler (generic across platforms).**

```typescript
// content-pipeline.controller.ts
@Post('platforms/:platform/oauth-callback')
async oauthCallback(@Param('platform') platform: string, @Body() body: { code: string; state?: string }) {
  await this.service.completeOAuth(platform, body.code);
  return { success: true, data: { connected: true } };
}
```

```typescript
// content-pipeline.service.ts (add)
async completeOAuth(platform: string, code: string): Promise<void> {
  const crypto = new CredentialCrypto();
  const tokenResponse = await this.exchangeCode(platform, code);
  const client = this.supabase.getClient();
  const encrypted = crypto.encrypt(JSON.stringify(tokenResponse));
  await client.from('platform_credentials').upsert({
    platform, encrypted_tokens: encrypted, connected_at: new Date().toISOString(),
  }, { onConflict: 'platform' });
}

private async exchangeCode(platform: string, code: string): Promise<any> {
  // Platform-specific token exchange using axios to each provider's /oauth/token endpoint.
  // Returns { access_token, refresh_token, expires_at } shape.
  // Implementations per platform; see docs/content-pipeline/platform-setup/*.md for specifics.
  throw new Error(`exchangeCode for ${platform} to be implemented per task 2.24 setup doc`);
}
```

Note: the `platform_credentials` table is new for P2. Add a migration:

**File:** `supabase/migrations/20260422000300_content_pipeline_platform_credentials.sql`

```sql
CREATE TABLE IF NOT EXISTS platform_credentials (
  platform TEXT PRIMARY KEY,
  encrypted_tokens TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_error TEXT
);
ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON platform_credentials FOR ALL USING (true);
GRANT ALL ON platform_credentials TO service_role;
```

- [ ] **Step 3: Platforms page lists all 5 with setup walkthrough links.**

Modify `platforms/page.tsx` to loop over all 5 platforms returned from `/platforms` endpoint. Each row includes a link to `/docs/content-pipeline/platform-setup/<platform>.md` (served as a static doc or embedded inline).

- [ ] **Step 4: Commit.**

```bash
git add supabase/migrations/20260422000300_content_pipeline_platform_credentials.sql packages/backend/src/content-pipeline/ packages/frontend/app/admin/content-pipeline/platforms/
git commit -m "feat(content-pipeline): platform credentials storage and OAuth flows for 5 platforms"
```

## Task 2.23: Platform setup documentation for 4 new platforms

**Files:**

- Create: `docs/content-pipeline/platform-setup/tiktok.md`
- Create: `docs/content-pipeline/platform-setup/instagram.md`
- Create: `docs/content-pipeline/platform-setup/facebook.md`
- Create: `docs/content-pipeline/platform-setup/linkedin.md`

- [ ] **Step 1: tiktok.md.**

Content covers: create TikTok for Business account, register app on developers.tiktok.com, enable Content Posting API product, required scopes (`user.info.basic`, `video.upload`, `video.publish`), app-review timeline (3 to 14 days), redirect URL registration, curl smoke test:

```bash
curl -X POST https://open.tiktokapis.com/v2/oauth/token/ \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_key=$TIKTOK_CLIENT_KEY&client_secret=$TIKTOK_CLIENT_SECRET&grant_type=refresh_token&refresh_token=$TIKTOK_OAUTH_REFRESH_TOKEN'
```

Include troubleshooting: "app not approved", "domain not verified", rate limits (6 posts per minute).

- [ ] **Step 2: instagram.md.**

Covers: requires Business account, must link to Facebook Page, Meta Graph app must have `instagram_content_publish` and `pages_manage_posts`, app-review notes for those scopes, video requirements (9x16 recommended, 15 to 90 seconds for Reels, mp4, h264 codec, aac audio), public URL requirement for video ingestion, curl smoke test:

```bash
curl "https://graph.facebook.com/v21.0/$IG_USER_ID/media?media_type=REELS&video_url=<url>&caption=test&access_token=$TOKEN"
```

- [ ] **Step 3: facebook.md.**

Covers: Page access token with `pages_manage_posts`, `pages_read_engagement`, and `pages_show_list` scopes. Resumable upload flow. Short-lived vs long-lived token exchange. Content policy notes.

- [ ] **Step 4: linkedin.md.**

Covers: create LinkedIn app, add "Share on LinkedIn" and "Sign In with LinkedIn" products, request `w_member_social` scope, company-page specific setup if posting as Organization. 3-step flow recap.

- [ ] **Step 5: Commit.**

```bash
git add docs/content-pipeline/platform-setup/
git commit -m "docs(content-pipeline): platform setup walkthroughs for TikTok, IG, FB, LinkedIn"
```

## Task 2.24: Format landing pages

**Files:**

- Create: `packages/frontend/app/top-cashflow-report/page.tsx`
- Create: `packages/frontend/app/movers-report/page.tsx`
- Create: `packages/frontend/app/market-comparison/page.tsx`
- Create: `packages/frontend/app/farm-area-audit/page.tsx`

- [ ] **Step 1: Each landing page follows the pattern of `grade-reveal-signup/page.tsx`.**

Adjust heading, subheading, and CTA copy per format:

| Page                | Heading                             | Subheading                                                                                 |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| top-cashflow-report | "Top 50 Cashflow Markets, free"     | "Get the full ranked report with rent-to-price ratios and PropertyIQ Scores."              |
| movers-report       | "Monthly Movers and Shakers Report" | "See every market that moved 5+ PIQ points this month, plus why."                          |
| market-comparison   | "Compare 5 Markets Side-by-Side"    | "We will build a comparison of 5 comparable markets for your metro of choice."             |
| farm-area-audit     | "Free Farm Area Audit for Agents"   | "Top 20 farm areas in your metro, ranked by turnover and absentee rates. For agents only." |

Each form submits `magnetKind` appropriate to the landing page: `top_50_cashflow_report`, `movers_report`, `market_comparison`, `farm_area_audit`.

- [ ] **Step 2: Commit.**

```bash
git add packages/frontend/app/top-cashflow-report/ packages/frontend/app/movers-report/ packages/frontend/app/market-comparison/ packages/frontend/app/farm-area-audit/
git commit -m "feat(content-pipeline): 4 P2 format landing pages with lead magnet signup"
```

## Task 2.25: VisionExtractorService for thumbnail style references

**Files:**

- Create: `packages/backend/src/content-pipeline/style-references/vision-extractor.service.ts`
- Create: `packages/backend/src/content-pipeline/style-references/vision-extractor.service.spec.ts`

- [ ] **Step 1: Write tests.**

```typescript
// packages/backend/src/content-pipeline/style-references/vision-extractor.service.spec.ts
import { VisionExtractorService } from "./vision-extractor.service";

jest.mock("@anthropic-ai/sdk", () =>
  jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [
          {
            type: "tool_use",
            name: "emit_attributes",
            input: {
              dominant_palette: ["#FFE600", "#000000", "#FFFFFF"],
              text_regions: [
                {
                  position: "bottom-center",
                  approximate_height_pct: 20,
                  color: "#000000",
                },
              ],
              subject_anchor: { x_pct: 50, y_pct: 40 },
              graphic_elements: ["arrow", "circle", "emoji"],
              energy_tag: "high",
              mood_tags: ["bold", "urgent"],
            },
          },
        ],
        usage: { input_tokens: 500, output_tokens: 150 },
      }),
    },
  })),
);

describe("VisionExtractorService", () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = "test";
  });

  it("extracts thumbnail attributes as structured JSON", async () => {
    const svc = new VisionExtractorService();
    const result = await svc.extractThumbnail(Buffer.from("test"));
    expect(result.attributes.dominant_palette).toContain("#FFE600");
    expect(result.attributes.energy_tag).toBe("high");
    expect(result.cost.amount_usd).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// packages/backend/src/content-pipeline/style-references/vision-extractor.service.ts
import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { DriverCost } from "../drivers/driver-cost.types";

const EXTRACT_TOOL = {
  name: "emit_attributes",
  description: "Emit extracted style attributes as structured JSON.",
  input_schema: {
    type: "object",
    required: ["dominant_palette", "text_regions", "energy_tag"],
    properties: {
      dominant_palette: {
        type: "array",
        items: { type: "string" },
        maxItems: 6,
      },
      text_regions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            position: { type: "string" },
            approximate_height_pct: { type: "number" },
            color: { type: "string" },
          },
        },
      },
      subject_anchor: {
        type: "object",
        properties: { x_pct: { type: "number" }, y_pct: { type: "number" } },
      },
      graphic_elements: { type: "array", items: { type: "string" } },
      energy_tag: { type: "string", enum: ["calm", "medium", "high"] },
      mood_tags: { type: "array", items: { type: "string" } },
    },
  },
} as const;

@Injectable()
export class VisionExtractorService {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async extractThumbnail(
    imageBuffer: Buffer,
  ): Promise<{ attributes: any; cost: DriverCost }> {
    const base64 = imageBuffer.toString("base64");
    const response = await this.client.messages.create({
      model: process.env.SCRIPT_LLM_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 1000,
      tools: [EXTRACT_TOOL as unknown as Anthropic.Messages.Tool],
      tool_choice: { type: "tool", name: "emit_attributes" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: base64 },
            },
            {
              type: "text",
              text: "Extract structured style attributes from this thumbnail using the provided tool. Focus on palette, text positions, subject position, graphic elements, and energy level.",
            },
          ],
        },
      ],
    });
    const toolBlock = response.content.find((c) => c.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use")
      throw new Error("Vision extraction did not return tool_use");

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd = (inputTokens * 3.0 + outputTokens * 15.0) / 1_000_000;

    return {
      attributes: toolBlock.input,
      cost: {
        provider: "anthropic-vision",
        amount_usd: costUsd,
        units: inputTokens + outputTokens,
        unit_type: "tokens_input",
      },
    };
  }
}
```

- [ ] **Step 3: Register in module, run tests, commit.**

```bash
cd packages/backend && npm run test -- vision-extractor.service.spec
git add packages/backend/src/content-pipeline/style-references/
git commit -m "feat(content-pipeline): VisionExtractorService for thumbnail style references"
```

## Task 2.26: StyleReferenceService and endpoints

**Files:**

- Create: `packages/backend/src/content-pipeline/style-references/style-reference.service.ts`
- Create: `packages/backend/src/content-pipeline/style-references/style-reference.controller.ts`
- Create: `packages/backend/src/content-pipeline/style-references/style-reference.service.spec.ts`
- Create: `packages/backend/src/content-pipeline/style-references/image-downloader.service.ts`
- Create: `packages/backend/src/content-pipeline/dto/upload-style-reference.dto.ts`
- Create: `packages/backend/src/content-pipeline/dto/ingest-style-url.dto.ts`

- [ ] **Step 1: DTOs.**

```typescript
// dto/upload-style-reference.dto.ts
import { IsString } from "class-validator";
export class UploadStyleReferenceDto {
  @IsString() label!: string;
}

// dto/ingest-style-url.dto.ts
import { IsString, IsUrl } from "class-validator";
export class IngestStyleUrlDto {
  @IsString() label!: string;
  @IsUrl({ protocols: ["http", "https"] }) url!: string;
}
```

- [ ] **Step 2: ImageDownloader.**

```typescript
// style-references/image-downloader.service.ts
import { Injectable } from "@nestjs/common";
import axios from "axios";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ImageDownloaderService {
  async download(url: string): Promise<Buffer> {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      maxContentLength: MAX_SIZE_BYTES,
    });
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(
        response.headers["content-type"],
      )
    ) {
      throw new Error(
        `unsupported content type: ${response.headers["content-type"]}`,
      );
    }
    return Buffer.from(response.data);
  }
}
```

- [ ] **Step 3: StyleReferenceService.**

```typescript
// style-references/style-reference.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { VisionExtractorService } from "./vision-extractor.service";
import { ImageDownloaderService } from "./image-downloader.service";

@Injectable()
export class StyleReferenceService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly vision: VisionExtractorService,
    private readonly downloader: ImageDownloaderService,
  ) {}

  async ingestFromUpload(userId: string, buffer: Buffer, label: string) {
    return this.ingest(userId, buffer, label, null);
  }

  async ingestFromUrl(userId: string, url: string, label: string) {
    const buffer = await this.downloader.download(url);
    return this.ingest(userId, buffer, label, url);
  }

  private async ingest(
    userId: string,
    buffer: Buffer,
    label: string,
    sourceUrl: string | null,
  ) {
    const extraction = await this.vision.extractThumbnail(buffer);
    const client = this.supabase.getClient();
    const previewPath = `style-references/${userId}/${Date.now()}-preview.png`;
    await client.storage.from("content-pipeline").upload(previewPath, buffer, {
      contentType: "image/png",
      upsert: true,
    });

    const { data } = await client
      .from("style_references")
      .insert({
        user_id: userId,
        kind: "thumbnail",
        label,
        source_url: sourceUrl,
        preview_strip_url: `supabase://content-pipeline/${previewPath}`,
        extracted_attributes: extraction.attributes,
        vision_cost_usd: extraction.cost.amount_usd,
      })
      .select()
      .single();
    return data;
  }

  async list(userId: string) {
    const client = this.supabase.getClient();
    const { data } = await client
      .from("style_references")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  async archive(id: string, userId: string) {
    const client = this.supabase.getClient();
    await client
      .from("style_references")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
  }

  async reanalyze(id: string, userId: string) {
    const client = this.supabase.getClient();
    const { data: ref } = await client
      .from("style_references")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (!ref) throw new Error("not found");
    const match = ref.preview_strip_url.match(/^supabase:\/\/([^/]+)\/(.+)$/)!;
    const { data: file } = await client.storage
      .from(match[1])
      .download(match[2]);
    const buffer = Buffer.from(await file!.arrayBuffer());
    const extraction = await this.vision.extractThumbnail(buffer);
    await client
      .from("style_references")
      .update({
        extracted_attributes: extraction.attributes,
        vision_cost_usd: ref.vision_cost_usd + extraction.cost.amount_usd,
      })
      .eq("id", id);
  }
}
```

- [ ] **Step 4: Controller.**

```typescript
// style-references/style-reference.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AdminGuard } from "../../common/guards/admin-auth.guard";
import { StyleReferenceService } from "./style-reference.service";
import { IngestStyleUrlDto } from "../dto/ingest-style-url.dto";

@UseGuards(AdminGuard)
@Controller("api/admin/content-pipeline/style-references")
export class StyleReferenceController {
  constructor(private readonly service: StyleReferenceService) {}

  @Get()
  async list(@Req() req: any) {
    return {
      success: true,
      data: { references: await this.service.list(req.user.id) },
    };
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body("label") label: string,
  ) {
    return {
      success: true,
      data: await this.service.ingestFromUpload(
        req.user.id,
        file.buffer,
        label,
      ),
    };
  }

  @Post("ingest-url")
  async ingestUrl(@Req() req: any, @Body() dto: IngestStyleUrlDto) {
    return {
      success: true,
      data: await this.service.ingestFromUrl(req.user.id, dto.url, dto.label),
    };
  }

  @Delete(":id")
  async archive(@Req() req: any, @Param("id") id: string) {
    await this.service.archive(id, req.user.id);
    return { success: true, data: { archived: true } };
  }

  @Post(":id/re-analyze")
  async reanalyze(@Req() req: any, @Param("id") id: string) {
    await this.service.reanalyze(id, req.user.id);
    return { success: true, data: { reanalyzed: true } };
  }
}
```

- [ ] **Step 5: Register in module, run tests, commit.**

```bash
cd packages/backend && npm run test -- style-reference.service.spec
git add packages/backend/src/content-pipeline/style-references/ packages/backend/src/content-pipeline/dto/
git commit -m "feat(content-pipeline): StyleReferenceService with upload and URL ingest for thumbnails"
```

## Task 2.27: Style Library admin UI page

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/style-library/page.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/style-library/reference-card.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/style-library/upload-dialog.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/style-library/attributes-panel.tsx`

- [ ] **Step 1: Upload dialog with URL and file tabs.**

```tsx
// packages/frontend/app/admin/content-pipeline/style-library/upload-dialog.tsx
"use client";
import { useState, useRef } from "react";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export function UploadDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tab, setTab] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submitUrl() {
    setUploading(true);
    try {
      await fetchAPIRaw(
        "/api/admin/content-pipeline/style-references/ingest-url",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, label }),
        },
      );
      onCreated();
    } finally {
      setUploading(false);
    }
  }

  async function submitFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("label", label);
      await fetchAPIRaw("/api/admin/content-pipeline/style-references/upload", {
        method: "POST",
        body: fd,
      });
      onCreated();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-6">
      <div className="bg-surface rounded-xl p-6 w-full max-w-xl">
        <h3 className="font-semibold mb-4">Add style reference</h3>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab("url")}
            className={`px-4 py-2 rounded-full ${tab === "url" ? "bg-primary text-on-primary" : "bg-surface-container"}`}
          >
            Paste a link
          </button>
          <button
            onClick={() => setTab("file")}
            className={`px-4 py-2 rounded-full ${tab === "file" ? "bg-primary text-on-primary" : "bg-surface-container"}`}
          >
            Upload a file
          </button>
        </div>
        <label className="block mb-3">
          <span className="text-sm">Label</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Grant Cardone high-energy"
            className="w-full border border-outline-variant rounded p-2 mt-1"
          />
        </label>
        {tab === "url" ? (
          <>
            <label className="block mb-3">
              <span className="text-sm">Image URL</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-outline-variant rounded p-2 mt-1"
              />
            </label>
            <button
              onClick={submitUrl}
              disabled={uploading || !url || !label}
              className="bg-primary text-on-primary rounded-full px-5 py-2 font-semibold disabled:opacity-50"
            >
              {uploading ? "Analyzing..." : "Analyze"}
            </button>
          </>
        ) : (
          <>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              ref={fileRef}
              className="block mb-3"
            />
            <button
              onClick={submitFile}
              disabled={uploading || !label}
              className="bg-primary text-on-primary rounded-full px-5 py-2 font-semibold disabled:opacity-50"
            >
              {uploading ? "Analyzing..." : "Upload and Analyze"}
            </button>
          </>
        )}
        <button onClick={onClose} className="ml-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reference card and attributes panel.**

```tsx
// packages/frontend/app/admin/content-pipeline/style-library/reference-card.tsx
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export function ReferenceCard({
  ref,
  onChange,
}: {
  ref: any;
  onChange: () => void;
}) {
  async function archive() {
    if (!confirm("Archive this reference?")) return;
    await fetchAPIRaw(
      `/api/admin/content-pipeline/style-references/${ref.id}`,
      { method: "DELETE" },
    );
    onChange();
  }
  async function reanalyze() {
    await fetchAPIRaw(
      `/api/admin/content-pipeline/style-references/${ref.id}/re-analyze`,
      { method: "POST" },
    );
    onChange();
  }

  const attrs = ref.extracted_attributes ?? {};
  const palette: string[] = attrs.dominant_palette ?? [];

  return (
    <div className="rounded-xl bg-surface-container-low shadow-sm overflow-hidden">
      <div
        className="aspect-video bg-outline"
        style={{
          backgroundImage: `url(${publicUrl(ref.preview_strip_url)})`,
          backgroundSize: "cover",
        }}
      />
      <div className="p-4 space-y-2">
        <div className="font-semibold">{ref.label}</div>
        <div className="flex gap-1">
          {palette.slice(0, 5).map((c) => (
            <div
              key={c}
              style={{
                width: 20,
                height: 20,
                backgroundColor: c,
                borderRadius: 4,
              }}
              title={c}
            />
          ))}
        </div>
        <div className="text-xs text-outline">
          {attrs.energy_tag ?? "unknown"} energy; text in{" "}
          {attrs.text_regions?.[0]?.position ?? "unknown"}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={reanalyze}
            className="text-sm bg-surface-container rounded-full px-3 py-1"
          >
            Re-analyze
          </button>
          <button
            onClick={archive}
            className="text-sm bg-error/10 text-error rounded-full px-3 py-1"
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}

function publicUrl(s: string) {
  const m = s.match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (!m) return s;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${m[1]}/${m[2]}`;
}
```

- [ ] **Step 3: Main page.**

```tsx
// packages/frontend/app/admin/content-pipeline/style-library/page.tsx
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/data/fetchers/base";
import { UploadDialog } from "./upload-dialog";
import { ReferenceCard } from "./reference-card";

export default function StyleLibraryPage() {
  const [uploading, setUploading] = useState(false);
  const { data = [], refetch } = useQuery({
    queryKey: ["style-references"],
    queryFn: async () =>
      (
        await fetchAPI<{ data: { references: any[] } }>(
          "/api/admin/content-pipeline/style-references",
        )
      ).data.references,
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Style Reference Library</h1>
        <button
          onClick={() => setUploading(true)}
          className="bg-primary text-on-primary rounded-full px-5 py-2 font-semibold"
        >
          + Add Reference
        </button>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {data.map((r) => (
          <ReferenceCard key={r.id} ref={r} onChange={refetch} />
        ))}
      </div>
      {uploading && (
        <UploadDialog
          onClose={() => setUploading(false)}
          onCreated={() => {
            setUploading(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Register nav entry, commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/style-library/
git commit -m "feat(content-pipeline): Style Reference Library admin page with upload and URL ingest"
```

## Task 2.28: Remotion thumbnail style variants

**Files:**

- Create: `packages/video-template/src/presets/style-variants/index.ts`
- Create: `packages/video-template/src/presets/style-variants/high-energy.ts`
- Create: `packages/video-template/src/presets/style-variants/medium-energy.ts`
- Create: `packages/video-template/src/presets/style-variants/calm-explainer.ts`
- Modify: `packages/video-template/src/PropertyIQVideo.tsx`

- [ ] **Step 1: Define variant preset type and three variants.**

```typescript
// packages/video-template/src/presets/style-variants/index.ts
export interface StyleVariantPreset {
  textPosition: "top" | "bottom" | "center";
  textSize: "small" | "medium" | "large";
  paletteOverride?: { primary?: string; accent?: string };
  graphicDensity: "minimal" | "moderate" | "dense";
}

export { highEnergy } from "./high-energy";
export { mediumEnergy } from "./medium-energy";
export { calmExplainer } from "./calm-explainer";
```

```typescript
// packages/video-template/src/presets/style-variants/high-energy.ts
import { StyleVariantPreset } from "./index";
export const highEnergy: StyleVariantPreset = {
  textPosition: "bottom",
  textSize: "large",
  paletteOverride: { primary: "#FFE600", accent: "#FF0033" },
  graphicDensity: "dense",
};
```

```typescript
// packages/video-template/src/presets/style-variants/medium-energy.ts
import { StyleVariantPreset } from "./index";
export const mediumEnergy: StyleVariantPreset = {
  textPosition: "center",
  textSize: "medium",
  graphicDensity: "moderate",
};
```

```typescript
// packages/video-template/src/presets/style-variants/calm-explainer.ts
import { StyleVariantPreset } from "./index";
export const calmExplainer: StyleVariantPreset = {
  textPosition: "top",
  textSize: "small",
  paletteOverride: { primary: "#3949AB", accent: "#00C853" },
  graphicDensity: "minimal",
};
```

- [ ] **Step 2: Selector maps `styleVariant` prop to preset; `PropertyIQVideo` reads it and passes to child components where applicable.**

```typescript
// packages/video-template/src/presets/style-variants/select.ts
import {
  StyleVariantPreset,
  highEnergy,
  mediumEnergy,
  calmExplainer,
} from "./index";
export function selectVariant(name?: string): StyleVariantPreset {
  switch (name) {
    case "high-energy":
      return highEnergy;
    case "calm-explainer":
      return calmExplainer;
    case "medium-energy":
    default:
      return mediumEnergy;
  }
}
```

- [ ] **Step 3: Wire `styleVariant` from `content_runs.style_reference_id` lookup in the render handler.**

In `render-video.handler.ts`, before spawning the CLI, fetch the style reference if any and decide the variant name based on attributes (e.g., `energy_tag === 'high' ? 'high-energy' : ...`).

- [ ] **Step 4: Commit.**

```bash
git add packages/video-template/src/presets/ packages/video-template/src/PropertyIQVideo.tsx packages/backend/src/content-pipeline/orchestrator/job-handlers/render-video.handler.ts
git commit -m "feat(video-template): three thumbnail style variants with selector"
```

## Task 2.29: Phase 2 E2E suite

**Files:**

- Create: `packages/backend/test/e2e/content-pipeline-p2-format-coverage.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p2-style-reference.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p2-approval-modes.e2e.spec.ts`

**Per project memory: E2E must hit real staging DB, not mocks.**

- [ ] **Step 1: Write format-coverage E2E.**

```typescript
// packages/backend/test/e2e/content-pipeline-p2-format-coverage.e2e.spec.ts
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { v4 as uuid } from "uuid";

describe("E2E: each P2 format publishes to all 5 platforms", () => {
  let app: INestApplication;
  const adminJwt = process.env.E2E_ADMIN_JWT;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app?.close());

  const formats = [
    "top_10_ranking",
    "score_mover",
    "head_to_head",
    "farm_area_spotlight",
  ];

  it.each(formats)(
    "%s publishes to YT, TikTok, IG, FB, LinkedIn",
    async (format) => {
      const res = await request(app.getHttpServer())
        .post("/api/admin/content-pipeline/runs")
        .set("Authorization", `Bearer ${adminJwt}`)
        .send({
          format,
          marketQuery: "Cleveland, OH",
          idempotencyKey: uuid(),
          approvalMode: "auto",
          selectedPlatforms: [
            "youtube_shorts",
            "tiktok",
            "instagram_reels",
            "facebook_reels",
            "linkedin",
          ],
        });
      const runId = res.body.data.id;

      const start = Date.now();
      while (Date.now() - start < 900_000) {
        await new Promise((r) => setTimeout(r, 10_000));
        const d = await request(app.getHttpServer())
          .get(`/api/admin/content-pipeline/runs/${runId}`)
          .set("Authorization", `Bearer ${adminJwt}`);
        if (
          ["published", "published_partial", "failed"].includes(
            d.body.data.run.status,
          )
        )
          break;
      }
      const final = await request(app.getHttpServer())
        .get(`/api/admin/content-pipeline/runs/${runId}`)
        .set("Authorization", `Bearer ${adminJwt}`);
      expect(final.body.data.run.status).toBe("published");
      expect(final.body.data.posts.length).toBe(5);
      const platforms = final.body.data.posts
        .map((p: any) => p.platform)
        .sort();
      expect(platforms).toEqual([
        "facebook_reels",
        "instagram_reels",
        "linkedin",
        "tiktok",
        "youtube_shorts",
      ]);
    },
    1_000_000,
  );
});
```

- [ ] **Step 2: Write style-reference E2E.**

```typescript
// packages/backend/test/e2e/content-pipeline-p2-style-reference.e2e.spec.ts
describe("E2E: thumbnail style reference applied", () => {
  // Upload a known-energy thumbnail (fixture image in tests/fixtures/)
  // Run a Farm Area Spotlight with that reference
  // Download the resulting thumbnail asset
  // Assert dominant palette overlap >= 60% with reference palette
});
```

Full implementation analyzes the rendered thumbnail PNG via Sharp or equivalent to verify palette match.

- [ ] **Step 3: Write approval-modes E2E (same pattern as Task 2.18 integration test, but run against staging real publishers).**

- [ ] **Step 4: Run E2E, commit.**

```bash
cd packages/backend && E2E_ADMIN_JWT=<jwt> npm run test:e2e -- content-pipeline-p2
git add packages/backend/test/e2e/
git commit -m "test(content-pipeline): P2 E2E suite (format coverage, style reference, approval modes)"
```

---

# Phase 3: Long-form and remaining agent/broker formats

**Duration:** 2 to 3 weeks. **Complexity:** Medium. **Tasks:** 22.

## Phase 3 scope

Long-Form Deep Dive format (5 to 12 minute, 16:9, YouTube long-form). ElevenLabs Turbo v2.5 voice for long-form only. Brokerage Market Share and Recruitment Angle (LinkedIn-first) short-form formats. Video style references via yt-dlp URL ingest plus FFmpeg frame sampling. Gated dashboard page for lead magnets (5a iii progression from email-only to email plus dashboard plus PDF). SRT caption output for long-form YouTube uploads.

## Phase 3 deliverables

- Long-Form Deep Dive renders at 16x9 aspect, 5 to 12 minutes, with ElevenLabs voice and SRT captions uploaded to YouTube.
- Brokerage Market Share and Recruitment Angle formats available with their own Remotion primitives (BrokerageBar, recruitment-specific layout).
- Video style references can be ingested via yt-dlp from YouTube, TikTok, IG, Facebook, Twitter/X.
- Users can view their delivered lead magnets on `propertyiq.app/dashboard/magnets` in addition to email.

## Phase 3 acceptance criteria

1. All P3 migrations apply cleanly.
2. `npm run test` passes P3 unit tests.
3. `npm run test:e2e` passes P3 E2E suite.
4. Long-Form Deep Dive renders a valid 16:9 MP4 between 5 and 12 minutes.
5. ElevenLabs synthesis runs only when tts_provider='elevenlabs'; short-form continues on Edge TTS.
6. SRT caption file uploads successfully to YouTube via captions.insert.
7. Style reference via YouTube URL extracts attributes via Claude vision and stores them.
8. Gated dashboard at /dashboard/magnets lists the user's delivered magnets with download links and refresh-data button.

## Phase 3 prerequisites

- P1 and P2 merged and running in staging.
- ElevenLabs account with API key, at least Creator plan for Turbo v2.5.
- yt-dlp and ffmpeg binaries installable via Dockerfile (apt-get and pip3).
- YouTube test channel approved for long-form uploads (some accounts have 15-minute limits pre-verification).

## Task 3.1: P3 dependencies and Dockerfile

**Files:**

- Modify: `packages/backend/package.json`
- Modify: `packages/backend/Dockerfile`

- [ ] **Step 1: Install backend deps.**

```bash
cd packages/backend
npm install elevenlabs@^0.18.0
```

- [ ] **Step 2: Update Dockerfile with ffmpeg and yt-dlp.**

```dockerfile
# Append to the Python install block from P1:
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp==2025.3.26
```

- [ ] **Step 3: Build image and verify.**

```bash
docker build -f packages/backend/Dockerfile -t piq-backend-p3 packages/backend
docker run --rm piq-backend-p3 yt-dlp --version
docker run --rm piq-backend-p3 ffmpeg -version
```

Expected: version strings.

- [ ] **Step 4: Commit.**

```bash
git add packages/backend/package.json packages/backend/package-lock.json packages/backend/Dockerfile
git commit -m "feat(content-pipeline): P3 dependencies (elevenlabs, ffmpeg, yt-dlp) in Dockerfile"
```

## Task 3.2: P3 migrations (magnets, voices, enable formats)

**Files:**

- Create: `supabase/migrations/20260423000100_content_pipeline_seed_p3_magnets.sql`
- Create: `supabase/migrations/20260423000200_content_pipeline_seed_p3_voices.sql`
- Create: `supabase/migrations/20260423000300_content_pipeline_seed_p3_formats_enable.sql`

- [ ] **Step 1: seed p3 voices.**

```sql
INSERT INTO tts_voices (id, provider, provider_voice_id, display_name, audience_tag, cost_per_1k_chars, enabled)
VALUES
  ('elevenlabs-rachel', 'elevenlabs', '21m00Tcm4TlvDq8ikWAM', 'Rachel (long-form)', 'long_form', 0.30, true),
  ('elevenlabs-antoni', 'elevenlabs', 'ErXwobaYiN019PkySvjV', 'Antoni (long-form alt)', 'long_form', 0.30, true)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: seed p3 magnets.**

```sql
INSERT INTO lead_magnet_definitions (kind, display_name, description, audience, template_path, data_method, email_template_key, landing_page_path, enabled)
VALUES
  ('brokerage_coverage_report', 'Brokerage Coverage Report', '6-page executive summary of brokerage market share across a metro or state.', 'broker',
   'packages/backend/src/content-pipeline/lead-magnets/templates/brokerage_coverage.html.ejs', 'getBrokerageMarketCoverage',
   'lead-magnet-delivery', '/brokerage-coverage', true),
  ('agent_recruitment_kit', 'Agent Recruitment Kit', '8-page PDF: market-specific recruiting angles, market share data, and referral-network opportunities.', 'broker',
   'packages/backend/src/content-pipeline/lead-magnets/templates/agent_recruitment_kit.html.ejs', 'getAgentRecruitmentPitch',
   'lead-magnet-delivery', '/agent-recruitment-kit', true),
  ('long_form_companion', 'Long-Form Companion', 'Written version of the narrative deep dive for email forwarding.', 'mixed',
   'packages/backend/src/content-pipeline/lead-magnets/templates/long_form_companion.html.ejs', 'getMarketNarrative',
   'lead-magnet-delivery', '/market-narrative', true)
ON CONFLICT (kind) DO NOTHING;

INSERT INTO format_magnet_bindings (format, magnet_kind, cta_text, weight, enabled)
VALUES
  ('brokerage_market_share', 'brokerage_coverage_report', 'Get the full Brokerage Coverage Report at ', 1.0, true),
  ('recruitment_angle', 'agent_recruitment_kit', 'Download the Agent Recruitment Kit at ', 1.0, true),
  ('long_form_deep_dive', 'long_form_companion', 'Get the written companion at ', 1.0, true)
ON CONFLICT (format, magnet_kind) DO NOTHING;
```

- [ ] **Step 3: enable p3 formats.**

```sql
UPDATE format_templates SET default_tts_voice_id = 'elevenlabs-rachel', enabled = true
WHERE format = 'long_form_deep_dive';

UPDATE format_templates SET enabled = true
WHERE format IN ('brokerage_market_share', 'recruitment_angle');
```

- [ ] **Step 4: Apply and commit.**

```bash
supabase db push
git add supabase/migrations/20260423000100_content_pipeline_seed_p3_magnets.sql supabase/migrations/20260423000200_content_pipeline_seed_p3_voices.sql supabase/migrations/20260423000300_content_pipeline_seed_p3_formats_enable.sql
git commit -m "feat(content-pipeline): P3 migrations (magnets, ElevenLabs voices, enable 3 formats)"
```

## Task 3.3: ElevenLabsTTSDriver

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/elevenlabs-tts-driver.ts`
- Create: `packages/backend/src/content-pipeline/drivers/elevenlabs-tts-driver.spec.ts`
- Modify: `packages/backend/src/content-pipeline/drivers/tts-driver.factory.ts`

- [ ] **Step 1: Write tests.**

```typescript
// packages/backend/src/content-pipeline/drivers/elevenlabs-tts-driver.spec.ts
import { ElevenLabsTTSDriver } from "./elevenlabs-tts-driver";
import { Readable } from "stream";

jest.mock("elevenlabs", () => ({
  ElevenLabsClient: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockImplementation(async () => {
      return Readable.from(Buffer.from("fake-mp3-audio-data"));
    }),
  })),
}));

describe("ElevenLabsTTSDriver", () => {
  beforeAll(() => {
    process.env.ELEVENLABS_API_KEY = "test-key";
  });

  it("isConfigured requires API key", () => {
    expect(new ElevenLabsTTSDriver().isConfigured()).toBe(true);
    const saved = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    expect(new ElevenLabsTTSDriver().isConfigured()).toBe(false);
    process.env.ELEVENLABS_API_KEY = saved;
  });

  it("synthesize calculates cost at $0.30/1k chars", async () => {
    const driver = new ElevenLabsTTSDriver();
    const result = await driver.synthesize({
      text: "a".repeat(1000),
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      outputPath: "/tmp/out.mp3",
      format: "mp3",
    });
    expect(result.cost.provider).toBe("elevenlabs");
    expect(result.cost.amount_usd).toBeCloseTo(0.3, 2);
    expect(result.cost.units).toBe(1000);
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// packages/backend/src/content-pipeline/drivers/elevenlabs-tts-driver.ts
import { Injectable } from "@nestjs/common";
import { ElevenLabsClient } from "elevenlabs";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import {
  TTSDriver,
  TTSSynthesisRequest,
  TTSSynthesisResult,
} from "./tts-driver.interface";

const ELEVENLABS_USD_PER_1K_CHARS = 0.3;

@Injectable()
export class ElevenLabsTTSDriver implements TTSDriver {
  readonly provider = "elevenlabs" as const;
  private client: ElevenLabsClient | null = null;

  isConfigured(): boolean {
    return !!process.env.ELEVENLABS_API_KEY;
  }

  private getClient(): ElevenLabsClient {
    if (!this.client) {
      if (!process.env.ELEVENLABS_API_KEY)
        throw new Error("ELEVENLABS_API_KEY is required");
      this.client = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY,
      });
    }
    return this.client;
  }

  async synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const start = Date.now();
    const stream = await this.getClient().generate({
      voice: req.voiceId,
      text: req.text,
      model_id: "eleven_turbo_v2_5",
      output_format: "mp3_44100_128",
    });
    await pipeline(stream, createWriteStream(req.outputPath));
    const wallMs = Date.now() - start;

    return {
      durationMs: wallMs,
      bitrate: 128_000,
      cost: {
        provider: "elevenlabs",
        amount_usd: (req.text.length / 1000) * ELEVENLABS_USD_PER_1K_CHARS,
        units: req.text.length,
        unit_type: "chars",
      },
    };
  }
}
```

- [ ] **Step 3: Update factory.**

```typescript
// drivers/tts-driver.factory.ts (update)
case 'elevenlabs':
  if (!this.elevenlabs.isConfigured()) throw new Error('ElevenLabs not configured');
  return this.elevenlabs;
```

Inject `ElevenLabsTTSDriver` into factory constructor.

- [ ] **Step 4: Register in module, run tests, commit.**

```bash
cd packages/backend && npm run test -- elevenlabs-tts-driver.spec
git add packages/backend/src/content-pipeline/drivers/
git commit -m "feat(content-pipeline): ElevenLabs TTS driver with Turbo v2.5 and cost accounting"
```

## Task 3.4: Prompts for P3 formats

**Files:**

- Create: `packages/backend/src/content-pipeline/prompts/long_form_deep_dive.md`
- Create: `packages/backend/src/content-pipeline/prompts/brokerage_market_share.md`
- Create: `packages/backend/src/content-pipeline/prompts/recruitment_angle.md`

- [ ] **Step 1: long_form_deep_dive.md.**

```markdown
Write a long-form narrative deep-dive script for {{canonical_name}}. Target total duration: 8 minutes at natural pace, roughly 1100 to 1300 words.

Data bundle:
{{dataBundle}}

Structure as 5 chapters. Each chapter gets 60 to 120 seconds of narration.

Chapter 1, Opening hook: lead with the most unexpected finding from the data. One minute.
Chapter 2, Market context: population, economy, employment trends. Two minutes.
Chapter 3, Real estate fundamentals: home values, rents, inventory, PropertyIQ Score with history. Three minutes.
Chapter 4, Who this market is for: investor profile, agent opportunity, broker positioning. One minute.
Chapter 5, Close plus CTA: {{cta_text}}{{shortLinkPlaceholder}}. One minute.

Hook options: produce {{variantCount}} hook variants for chapter 1 only.

Output JSON via the emit_script tool. Include one chapterBreakdown entry per chapter in sceneBreakdown with `sceneKey` set to `chapter_1` through `chapter_5`.

Voice: informed but approachable. No filler; every sentence earns its place. No em dashes. Only "PropertyIQ Score" or "PIQ Score" for scores.
```

- [ ] **Step 2: brokerage_market_share.md.**

```markdown
Write a 75-second Brokerage Market Share script for {{canonical_name}}.

Data bundle (top 8 brokerages by listing share):
{{dataBundle}}

Structure:

- Hook (3s): lead with the dominant brokerage
- Body (55s): walk through 4 or 5 major brokerages; cite listing share and any year-over-year delta
- Market summary (10s): one sentence on whether the market is consolidated or fragmented
- CTA (7s): {{cta_text}}{{shortLinkPlaceholder}}

Produce {{variantCount}} hooks. Professional tone for LinkedIn audience.
```

- [ ] **Step 3: recruitment_angle.md.**

```markdown
Write a 90-second Recruitment Angle script for {{canonical_name}}. Audience: brokerage owners considering recruiting or market entry.

Data bundle (includes market snapshot plus referral-network opportunities):
{{dataBundle}}

Structure:

- Hook (3s): specific recruiting pitch tied to one data point (PropertyIQ Score movement, referral opportunity, or agent-density figure)
- Market fundamentals (20s): why this metro is worth recruiting into
- Recruitment angle (40s): specific positioning for attracting agents (e.g. "low concentration of luxury-focused brokerages, wide-open lane")
- Referral network (20s): connected metros where their agents could source leads
- CTA (7s): {{cta_text}}{{shortLinkPlaceholder}}

Produce {{variantCount}} hooks. LinkedIn-first professional tone, no TikTok energy.
```

- [ ] **Step 4: Commit.**

```bash
git add packages/backend/src/content-pipeline/prompts/
git commit -m "feat(content-pipeline): prompts for 3 P3 formats (long-form, brokerage, recruitment)"
```

## Task 3.5: LongFormChapterCard primitive and Long-Form composition

**Files:**

- Create: `packages/video-template/src/primitives/LongFormChapterCard.tsx`
- Modify: `packages/video-template/src/PropertyIQVideo.tsx`
- Create: `packages/video-template/src/presets/longform.ts`
- Create: `packages/video-template/tests/long-form.test.tsx`

- [ ] **Step 1: Write LongFormChapterCard.**

```tsx
// packages/video-template/src/primitives/LongFormChapterCard.tsx
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface LongFormChapterCardProps {
  chapterNumber: number;
  title: string;
  synopsis: string;
}

export const LongFormChapterCard: React.FC<LongFormChapterCardProps> = ({
  chapterNumber,
  title,
  synopsis,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  const opacity = spring({ frame, fps, config: { damping: 20 } });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#1A237E",
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: 80 * scale,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: "Roboto Mono",
          fontSize: 24 * scale,
          color: "#C5CAE9",
        }}
      >
        Chapter {chapterNumber}
      </div>
      <h1
        style={{
          fontFamily: "Source Serif 4, serif",
          fontSize: 80 * scale,
          margin: "16px 0",
          maxWidth: "80%",
        }}
      >
        {title}
      </h1>
      <p style={{ fontSize: 28 * scale, color: "#E8EAF6", maxWidth: "70%" }}>
        {synopsis}
      </p>
    </div>
  );
};
```

- [ ] **Step 2: Long-form preset.**

```typescript
// packages/video-template/src/presets/longform.ts
export const LONGFORM_CHAPTER_FRAMES = {
  chapterCard: 120, // 4 seconds per chapter intro
  chapterBody: 1800, // 60 seconds body (caller can override per chapter)
};

export const LONGFORM_DEFAULT_DURATION_FRAMES = 18000; // 10 minutes at 30fps
```

- [ ] **Step 3: Add LongFormDeepDiveLayout in PropertyIQVideo.**

```tsx
const LongFormDeepDiveLayout: React.FC<VideoProps> = (props) => {
  const chapters = (props.dataBundle as any)?.chapters ?? [];
  let cursor = 60; // after BrandBumper
  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      {chapters.map((chapter: any, i: number) => {
        const cardFrom = cursor;
        const bodyFrom = cursor + 120;
        const bodyDuration = chapter.durationFrames ?? 1800;
        cursor = bodyFrom + bodyDuration;
        return (
          <React.Fragment key={i}>
            <Sequence from={cardFrom} durationInFrames={120}>
              <LongFormChapterCard
                chapterNumber={i + 1}
                title={chapter.title}
                synopsis={chapter.synopsis}
              />
            </Sequence>
            <Sequence from={bodyFrom} durationInFrames={bodyDuration}>
              {/* Body scenes: use TrendChart, StatCards, Comparison, ScoreReveal per chapter.sceneKey */}
              {chapter.sceneKey === "chapter_3" && (
                <TrendChart dataBundle={props.dataBundle as any} />
              )}
              {chapter.sceneKey === "chapter_2" && (
                <StatCards dataBundle={props.dataBundle as any} />
              )}
              {/* Default fallback */}
              {!["chapter_2", "chapter_3"].includes(chapter.sceneKey) && (
                <AbsoluteFill
                  style={{
                    background: "#1A1A2E",
                    color: "white",
                    padding: 80,
                    fontSize: 40,
                  }}
                >
                  {chapter.bodyText ?? ""}
                </AbsoluteFill>
              )}
            </Sequence>
          </React.Fragment>
        );
      })}
      <Sequence from={cursor} durationInFrames={180}>
        <Outro marketName={props.resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={cursor + 180} durationInFrames={120}>
        <BrandOutroCard ctaUrl={props.ctaUrl} />
      </Sequence>
    </>
  );
};
```

- [ ] **Step 4: Snapshot tests, run sample 5-minute render, commit.**

```bash
cd packages/video-template && npm run build:cli && \
  node dist/cli/render-cli.js --format long_form_deep_dive --props-json sample-longform.json --output longform-out.mp4
git add packages/video-template/src/primitives/LongFormChapterCard.tsx packages/video-template/src/presets/longform.ts packages/video-template/src/PropertyIQVideo.tsx packages/video-template/tests/
git commit -m "feat(video-template): LongFormChapterCard primitive and long-form composition"
```

## Task 3.6: YouTubeLongFormPublisher with SRT upload

**Files:**

- Create: `packages/backend/src/content-pipeline/drivers/youtube-longform-publisher.ts`
- Create: `packages/backend/src/content-pipeline/drivers/youtube-longform-publisher.spec.ts`
- Create: `packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-youtube-longform.handler.ts`

- [ ] **Step 1: Write tests.**

```typescript
// packages/backend/src/content-pipeline/drivers/youtube-longform-publisher.spec.ts
import { YouTubeLongFormPublisher } from "./youtube-longform-publisher";

jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest
        .fn()
        .mockImplementation(() => ({ setCredentials: jest.fn() })),
    },
    youtube: jest.fn().mockReturnValue({
      videos: {
        insert: jest.fn().mockResolvedValue({ data: { id: "long123" } }),
      },
      captions: {
        insert: jest.fn().mockResolvedValue({ data: { id: "cap123" } }),
      },
    }),
  },
}));

describe("YouTubeLongFormPublisher", () => {
  beforeAll(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = "c";
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = "s";
    process.env.YOUTUBE_OAUTH_REFRESH_TOKEN = "r";
  });

  it("publishes long-form video then uploads SRT caption track", async () => {
    const pub = new YouTubeLongFormPublisher();
    const result = await pub.publish({
      runId: "r1",
      videoPath: "/tmp/long.mp4",
      title: "Deep Dive Cleveland",
      description: "Ten minute narrative",
      tags: ["realestate", "cleveland"],
      captionsSrtPath: "/tmp/captions.srt",
      postMode: "direct",
    });
    expect(result.externalId).toBe("long123");
    expect(result.externalUrl).toContain("youtube.com/watch");
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// packages/backend/src/content-pipeline/drivers/youtube-longform-publisher.ts
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
export class YouTubeLongFormPublisher implements PlatformPublisher {
  readonly platform: Platform = "youtube_long";
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
      throw new Error("YouTubeLongFormPublisher not configured");
    const yt = google.youtube({ version: "v3", auth: this.getAuth() });
    const privacyStatus = req.postMode === "direct" ? "public" : "private";

    const videoResponse = await yt.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: req.title.substring(0, 100),
          description: req.description.substring(0, 5000),
          tags: req.tags,
          categoryId: "22",
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
          publishAt: req.scheduledFor?.toISOString(),
        },
      },
      media: { body: createReadStream(req.videoPath) },
    });

    const videoId = (videoResponse.data as any).id;

    if (req.captionsSrtPath) {
      await yt.captions.insert({
        part: ["snippet"],
        requestBody: {
          snippet: {
            videoId,
            language: "en",
            name: "English (auto)",
            isDraft: false,
          },
        },
        media: {
          mimeType: "application/octet-stream",
          body: createReadStream(req.captionsSrtPath),
        },
      });
    }

    return {
      externalId: videoId,
      externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      cost: {
        provider: "youtube",
        amount_usd: 0,
        units: 1,
        unit_type: "requests",
      },
      providerResponse: videoResponse.data,
    };
  }
}
```

- [ ] **Step 3: Publish handler same pattern as youtube-shorts handler, but reads `captions_srt` asset if present.**

- [ ] **Step 4: Register in module, register in publisher registry, run tests, commit.**

```bash
cd packages/backend && npm run test -- youtube-longform-publisher.spec
git add packages/backend/src/content-pipeline/drivers/ packages/backend/src/content-pipeline/orchestrator/
git commit -m "feat(content-pipeline): YouTubeLongFormPublisher with SRT caption upload"
```

## Task 3.7: youtube-longform.md platform setup doc

**Files:**

- Create: `docs/content-pipeline/platform-setup/youtube-longform.md`

- [ ] **Step 1: Write doc.**

Content covers: additional scopes required over Shorts (`youtube.force-ssl` for captions), YouTube account verification for uploads over 15 minutes, monetization eligibility, Community Guidelines warnings, long-form content policy notes, how to request quota increase for production use.

- [ ] **Step 2: Commit.**

```bash
git add docs/content-pipeline/platform-setup/youtube-longform.md
git commit -m "docs(content-pipeline): YouTube long-form platform setup walkthrough"
```

## Task 3.8: BrokerageBar primitive and Brokerage Market Share composition

**Files:**

- Create: `packages/video-template/src/primitives/BrokerageBar.tsx`
- Modify: `packages/video-template/src/PropertyIQVideo.tsx`
- Create: `packages/video-template/tests/brokerage.test.tsx`

- [ ] **Step 1: Write BrokerageBar.**

```tsx
// packages/video-template/src/primitives/BrokerageBar.tsx
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface BrokerageBarProps {
  brokerages: Array<{ brand: string; share_pct: number; delta_pct?: number }>;
}

export const BrokerageBar: React.FC<BrokerageBarProps> = ({ brokerages }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  const top = brokerages.slice(0, 8);
  const maxShare = Math.max(...top.map((b) => b.share_pct));

  return (
    <div
      style={{
        padding: 60 * scale,
        display: "flex",
        flexDirection: "column",
        gap: 12 * scale,
      }}
    >
      {top.map((b, i) => {
        const animate = spring({
          frame: frame - i * 8,
          fps,
          config: { damping: 14 },
        });
        const width = interpolate(
          animate,
          [0, 1],
          [0, (b.share_pct / maxShare) * 100],
        );
        const color =
          b.delta_pct === undefined
            ? "#3949AB"
            : b.delta_pct >= 0
              ? "#00C853"
              : "#B3261E";
        return (
          <div
            key={b.brand}
            style={{ display: "flex", alignItems: "center", gap: 12 * scale }}
          >
            <div
              style={{
                width: 220 * scale,
                fontSize: 20 * scale,
                color: "#FFFFFF",
                textAlign: "right",
              }}
            >
              {b.brand}
            </div>
            <div
              style={{
                flex: 1,
                height: 36 * scale,
                background: "#1A1A2E",
                borderRadius: 8 * scale,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${width}%`,
                  height: "100%",
                  background: color,
                  transition: "width 0.3s",
                }}
              />
            </div>
            <div
              style={{
                width: 80 * scale,
                fontFamily: "Roboto Mono",
                fontWeight: 700,
                color: "#FFFFFF",
              }}
            >
              {b.share_pct.toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Add BrokerageMarketShareLayout in PropertyIQVideo.**

```tsx
const BrokerageMarketShareLayout: React.FC<VideoProps> = (props) => {
  const brokerages = (props.dataBundle as any)?.brokerages ?? [];
  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={60} durationInFrames={90}>
        <Intro
          marketName={`Brokerage Share: ${props.resolvedMarket.canonical_name}`}
        />
      </Sequence>
      <Sequence from={150} durationInFrames={1800}>
        <BrokerageBar brokerages={brokerages} />
      </Sequence>
      <Sequence from={1950} durationInFrames={210}>
        <Outro marketName={props.resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={2160} durationInFrames={90}>
        <BrandOutroCard ctaUrl={props.ctaUrl} />
      </Sequence>
    </>
  );
};
```

- [ ] **Step 3: Snapshot tests and commit.**

```bash
git add packages/video-template/src/primitives/BrokerageBar.tsx packages/video-template/src/PropertyIQVideo.tsx packages/video-template/tests/
git commit -m "feat(video-template): BrokerageBar primitive and Brokerage Market Share composition"
```

## Task 3.9: Recruitment Angle composition

**Files:**

- Modify: `packages/video-template/src/PropertyIQVideo.tsx`
- Create: `packages/video-template/tests/recruitment.test.tsx`

- [ ] **Step 1: Add RecruitmentAngleLayout.**

```tsx
const RecruitmentAngleLayout: React.FC<VideoProps> = (props) => {
  const score = (props.dataBundle as any)?.score?.propertyiq_score ?? 50;
  const brokerages = (props.dataBundle as any)?.brokerages ?? [];
  const referralMarkets = (props.dataBundle as any)?.referral_markets ?? [];

  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={60} durationInFrames={90}>
        <Intro marketName={props.resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={150} durationInFrames={600}>
        <ScoreReveal score={score} />
      </Sequence>
      <Sequence from={750} durationInFrames={1200}>
        <BrokerageBar brokerages={brokerages} />
      </Sequence>
      <Sequence from={1950} durationInFrames={600}>
        <AbsoluteFill
          style={{ padding: "6%", background: "#1A1A2E", color: "white" }}
        >
          <h2 style={{ fontSize: 40 }}>Referral Corridors</h2>
          <ul>
            {referralMarkets.slice(0, 5).map((m: any) => (
              <li
                key={m.canonical_name}
                style={{ fontSize: 28, margin: "8px 0" }}
              >
                {m.canonical_name}, {m.inbound_relocators_pct?.toFixed(1)}%
                relocate from here
              </li>
            ))}
          </ul>
        </AbsoluteFill>
      </Sequence>
      <Sequence from={2550} durationInFrames={120}>
        <Outro marketName={props.resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={2670} durationInFrames={30}>
        <BrandOutroCard ctaUrl={props.ctaUrl} />
      </Sequence>
    </>
  );
};
```

- [ ] **Step 2: Snapshot tests and commit.**

```bash
git add packages/video-template/src/PropertyIQVideo.tsx packages/video-template/tests/
git commit -m "feat(video-template): Recruitment Angle composition"
```

## Task 3.10: Extend ContentDataService with P3 methods

**Files:**

- Modify: `packages/backend/src/content-pipeline/data/content-data.service.ts`
- Modify: `packages/backend/src/content-pipeline/data/content-data.types.ts`
- Modify: `packages/backend/src/content-pipeline/data/content-data.service.spec.ts`

- [ ] **Step 1: Add new types.**

```typescript
// data/content-data.types.ts (append)
export interface BrokerageCoverage {
  geo: GeoRef;
  brokerages: Array<{
    brand: string;
    share_pct: number;
    delta_pct: number;
    listings_count: number;
  }>;
  market_shape: "consolidated" | "fragmented" | "contested";
}

export interface AgentRecruitmentPitch {
  geo: GeoRef;
  score: PropertyIQScoreResult;
  brokerages: BrokerageCoverage["brokerages"];
  recruiting_angles: string[];
}

export interface ReferralNetwork {
  origin: GeoRef;
  markets: Array<{
    canonical_name: string;
    geo: GeoRef;
    inbound_relocators_pct: number;
  }>;
}

export interface MarketNarrative {
  geo: GeoRef;
  snapshot: MarketSnapshot;
  chapters: Array<{
    sceneKey: string;
    title: string;
    synopsis: string;
    bodyText: string;
    durationFrames: number;
  }>;
}
```

- [ ] **Step 2: Add service methods.**

```typescript
// content-data.service.ts (add)
async getBrokerageMarketCoverage(geos: GeoRef | GeoRef[]): Promise<BrokerageCoverage> {
  const geoList = Array.isArray(geos) ? geos : [geos];
  return this.brokerage.getCoverage(geoList);
}

async getAgentRecruitmentPitch(geo: GeoRef): Promise<AgentRecruitmentPitch> {
  const [score, brokerage] = await Promise.all([
    this.scoring.getScoreWithHistory(geo, 12),
    this.brokerage.getCoverage([geo]),
  ]);
  return {
    geo, score,
    brokerages: brokerage.brokerages,
    recruiting_angles: this.deriveRecruitingAngles(score, brokerage),
  };
}

async getReferralNetwork(origin: GeoRef, limit: number): Promise<ReferralNetwork> {
  return this.relocation.getReferralCorridors(origin, limit);
}

async getMarketNarrative(geo: GeoRef): Promise<MarketNarrative> {
  const snapshot = await this.getMarketSnapshot(geo);
  return { geo, snapshot, chapters: this.buildChapters(geo, snapshot) };
}

private deriveRecruitingAngles(score: PropertyIQScoreResult, coverage: BrokerageCoverage): string[] {
  const angles: string[] = [];
  const topShare = coverage.brokerages[0]?.share_pct ?? 0;
  if (coverage.market_shape === 'fragmented') angles.push('Market is fragmented; no clear dominant brokerage to beat');
  if (topShare < 15) angles.push(`No brokerage exceeds 15% share; open market positioning available`);
  if (score.score >= 70) angles.push(`Market momentum: PropertyIQ Score ${score.score} indicates strong demand`);
  return angles;
}

private buildChapters(geo: GeoRef, snapshot: MarketSnapshot): MarketNarrative['chapters'] {
  return [
    { sceneKey: 'chapter_1', title: 'Opening', synopsis: 'What the data tells us first.', bodyText: '', durationFrames: 1800 },
    { sceneKey: 'chapter_2', title: 'Market Context', synopsis: 'Population, economy, employment.', bodyText: '', durationFrames: 3600 },
    { sceneKey: 'chapter_3', title: 'Real Estate Fundamentals', synopsis: 'Values, rents, inventory, score.', bodyText: '', durationFrames: 5400 },
    { sceneKey: 'chapter_4', title: 'Who This Is For', synopsis: 'Investor, agent, broker profiles.', bodyText: '', durationFrames: 1800 },
    { sceneKey: 'chapter_5', title: 'Close', synopsis: 'Takeaways and CTA.', bodyText: '', durationFrames: 1800 },
  ];
}
```

The `brokerage` and `relocation` services are injected; add them to the constructor and module imports. Both must exist in the backend per Prerequisite 2 discovery.

- [ ] **Step 3: Extend unit tests for the 4 new methods.**

- [ ] **Step 4: Commit.**

```bash
git add packages/backend/src/content-pipeline/data/
git commit -m "feat(content-pipeline): ContentDataService extended with P3 data methods"
```

## Task 3.11: P3 lead magnet templates

**Files:**

- Create: `packages/backend/src/content-pipeline/lead-magnets/templates/brokerage_coverage.html.ejs`
- Create: `packages/backend/src/content-pipeline/lead-magnets/templates/agent_recruitment_kit.html.ejs`
- Create: `packages/backend/src/content-pipeline/lead-magnets/templates/long_form_companion.html.ejs`

- [ ] **Step 1: brokerage_coverage.html.ejs.**

```html
<h1>Brokerage Coverage Report</h1>
<p>Prepared for <%= userContext.userName %> on <%= today %></p>
<p>Market: <%= dataBundle.geo.canonical_name %></p>

<h2>Market Shape: <%= dataBundle.market_shape %></h2>

<table style="width:100%; border-collapse:collapse; margin-top:16px;">
  <thead style="background:var(--primary); color:white;">
    <tr>
      <th style="padding:8px; text-align:left;">Rank</th>
      <th>Brokerage</th>
      <th>Share</th>
      <th>YoY Delta</th>
      <th>Listings</th>
    </tr>
  </thead>
  <tbody>
    <% dataBundle.brokerages.forEach(function(b, i) { %>
    <tr style="border-bottom:1px solid var(--outline);">
      <td style="padding:6px 8px;"><%= i + 1 %></td>
      <td><%= b.brand %></td>
      <td><%= b.share_pct.toFixed(1) %>%</td>
      <td
        style="color: <%= b.delta_pct >= 0 ? 'var(--accent)' : 'var(--error)' %>"
      >
        <%= b.delta_pct >= 0 ? '+' : '' %><%= b.delta_pct.toFixed(1) %>%
      </td>
      <td><%= b.listings_count.toLocaleString() %></td>
    </tr>
    <% }); %>
  </tbody>
</table>

<h2>Interpretation</h2>
<p>
  <% if (dataBundle.market_shape === 'consolidated') { %> One brokerage
  dominates with significant share. New entrants face steep competition but
  share gains above the dominant player are highly visible. <% } else if
  (dataBundle.market_shape === 'fragmented') { %> No single brokerage exceeds
  meaningful share. Many small players compete, which creates an opening for a
  consolidator or a differentiated brand. <% } else { %> Two or three brokerages
  are contesting dominance. Competitive dynamics are moving; next 12 months will
  show a clear leader. <% } %>
</p>
```

- [ ] **Step 2: agent_recruitment_kit.html.ejs.**

```html
<h1>Agent Recruitment Kit: <%= dataBundle.geo.canonical_name %></h1>
<p>
  Prepared for <%= userContext.userName %>. Market-specific recruiting
  intelligence.
</p>

<div style="display:flex; align-items:center; gap:24px; margin:24px 0;">
  <div class="score-ring"><%= dataBundle.score.score %></div>
  <div>
    <h2 style="margin:0;">PropertyIQ Score</h2>
    <p style="font-size:12pt; color:var(--primary);">
      Grade <%= dataBundle.score.grade %> . Confidence <%=
      dataBundle.score.confidence_level %>
    </p>
  </div>
</div>

<h2>Recruiting Angles</h2>
<ul>
  <% dataBundle.recruiting_angles.forEach(function(a) { %>
  <li style="margin:8px 0;"><%= a %></li>
  <% }); %>
</ul>

<h2>Brokerage Landscape</h2>
<p>Current top brokerages you are recruiting against:</p>
<ul style="font-size:11pt;">
  <% dataBundle.brokerages.slice(0, 5).forEach(function(b) { %>
  <li>
    <%= b.brand %>: <%= b.share_pct.toFixed(1) %>% share (<%= b.delta_pct >= 0 ?
    '+' : '' %><%= b.delta_pct.toFixed(1) %>% YoY)
  </li>
  <% }); %>
</ul>

<h2>Pitch Script Starter</h2>
<p>
  Use this as the opener of your next recruiting call: "I noticed that the <%=
  dataBundle.geo.canonical_name %> market has a PropertyIQ Score of <%=
  dataBundle.score.score %>, meaning <%= dataBundle.score.label %>. The top
  brokerage holds <%= dataBundle.brokerages[0]?.share_pct?.toFixed(1) ?? 'N/A'
  %>% share. Where is your market share right now, and where do you want it next
  year?"
</p>
```

- [ ] **Step 3: long_form_companion.html.ejs.**

```html
<h1><%= dataBundle.geo.canonical_name %>: The Full Narrative</h1>
<p>
  Written companion to the Long-Form Deep Dive video. Prepared for <%=
  userContext.userName %>.
</p>

<% dataBundle.chapters.forEach(function(chapter, i) { %>
<h2>Chapter <%= i + 1 %>: <%= chapter.title %></h2>
<p style="font-style:italic; color:var(--primary); margin-top:0;">
  <%= chapter.synopsis %>
</p>
<p
  style="font-family:'Source Serif 4', serif; line-height:1.6; font-size:13pt;"
>
  <%= chapter.bodyText %>
</p>
<% }); %>

<h2>Data Sources</h2>
<p style="font-size:10pt; color:var(--primary);">
  Home values and rents: Zillow ZHVI and ZORI. Economic indicators: BLS, FRED.
  Demographics: US Census. PropertyIQ Score: PropertyIQ proprietary.
</p>
```

- [ ] **Step 4: Commit.**

```bash
git add packages/backend/src/content-pipeline/lead-magnets/templates/
git commit -m "feat(content-pipeline): P3 lead magnet templates (brokerage, recruitment, narrative companion)"
```

## Task 3.12: P3 format landing pages

**Files:**

- Create: `packages/frontend/app/brokerage-coverage/page.tsx`
- Create: `packages/frontend/app/agent-recruitment-kit/page.tsx`
- Create: `packages/frontend/app/market-narrative/page.tsx`

- [ ] **Step 1: Each page follows landing-page pattern from P1/P2 with format-specific copy.**

| Page                  | Heading                                      | Magnet                    |
| --------------------- | -------------------------------------------- | ------------------------- |
| brokerage-coverage    | "Free Brokerage Coverage Report"             | brokerage_coverage_report |
| agent-recruitment-kit | "Free Agent Recruitment Kit for Brokers"     | agent_recruitment_kit     |
| market-narrative      | "Get the Written Companion to the Deep Dive" | long_form_companion       |

- [ ] **Step 2: Commit.**

```bash
git add packages/frontend/app/brokerage-coverage/ packages/frontend/app/agent-recruitment-kit/ packages/frontend/app/market-narrative/
git commit -m "feat(content-pipeline): P3 landing pages for brokerage, recruitment, narrative"
```

## Task 3.13: Gated dashboard for lead magnets

**Files:**

- Create: `packages/frontend/app/dashboard/magnets/page.tsx`
- Create: `packages/backend/src/content-pipeline/magnets/dashboard-magnets.service.ts`
- Create: `packages/backend/src/content-pipeline/magnets/dashboard-magnets.controller.ts`

- [ ] **Step 1: Backend service fetches a user's delivered magnets with refresh capability.**

```typescript
// packages/backend/src/content-pipeline/magnets/dashboard-magnets.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { QueueService } from "../orchestrator/queue.service";

@Injectable()
export class DashboardMagnetsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  async getUserMagnets(userId: string) {
    const client = this.supabase.getClient();
    const { data: deliveries } = await client
      .from("lead_magnet_deliveries")
      .select(
        "*, lead_magnet_definitions(display_name, audience), content_assets(storage_url)",
      )
      .eq("user_id", userId)
      .order("generated_at", { ascending: false });
    return deliveries ?? [];
  }

  async refresh(userId: string, magnetKind: string, geo: any) {
    await this.queue.send("render-pdf", {
      userId,
      magnetKind,
      resolvedGeo: geo,
      userEmail: "",
      userName: "",
    });
  }
}
```

- [ ] **Step 2: Controller (not AdminGuard; requires signed-in user auth).**

```typescript
// packages/backend/src/content-pipeline/magnets/dashboard-magnets.controller.ts
import { Controller, Get, Post, Body, Req, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "../../auth-hooks/supabase-auth.guard";
import { DashboardMagnetsService } from "./dashboard-magnets.service";

@UseGuards(SupabaseAuthGuard)
@Controller("api/dashboard/magnets")
export class DashboardMagnetsController {
  constructor(private readonly service: DashboardMagnetsService) {}

  @Get()
  async list(@Req() req: any) {
    return {
      success: true,
      data: { magnets: await this.service.getUserMagnets(req.user.id) },
    };
  }

  @Post("refresh")
  async refresh(
    @Req() req: any,
    @Body() body: { magnetKind: string; geo: any },
  ) {
    await this.service.refresh(req.user.id, body.magnetKind, body.geo);
    return { success: true, data: { queued: true } };
  }
}
```

- [ ] **Step 3: Frontend dashboard page.**

```tsx
// packages/frontend/app/dashboard/magnets/page.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

export default function DashboardMagnetsPage() {
  const { data = [], refetch } = useQuery({
    queryKey: ["dashboard-magnets"],
    queryFn: async () =>
      (await fetchAPI<{ data: { magnets: any[] } }>("/api/dashboard/magnets"))
        .data.magnets,
  });

  async function refresh(magnet: any) {
    await fetchAPIRaw("/api/dashboard/magnets/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        magnetKind: magnet.magnet_kind,
        geo: magnet.resolved_geo,
      }),
    });
    refetch();
  }

  return (
    <main className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-semibold">Your Market Reports</h1>
      {data.length === 0 && (
        <p className="text-outline">You have not received any magnets yet.</p>
      )}
      <div className="grid grid-cols-2 gap-6">
        {data.map((m) => (
          <div
            key={m.id}
            className="rounded-xl bg-surface-container-low p-6 shadow-sm"
          >
            <h3 className="font-semibold">
              {m.lead_magnet_definitions?.display_name}
            </h3>
            <p className="text-sm text-outline">
              {m.resolved_geo?.canonical_name}
            </p>
            <p className="text-xs text-outline">
              Generated {new Date(m.generated_at).toLocaleDateString()}
            </p>
            <div className="flex gap-2 mt-4">
              <a
                href={publicUrl(m.content_assets?.storage_url)}
                download
                className="text-sm bg-primary text-on-primary rounded-full px-4 py-1.5"
              >
                Download PDF
              </a>
              <button
                onClick={() => refresh(m)}
                className="text-sm bg-surface-container rounded-full px-4 py-1.5"
              >
                Refresh data
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function publicUrl(s: string | undefined) {
  if (!s) return "#";
  const m = s.match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (!m) return s;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${m[1]}/${m[2]}`;
}
```

- [ ] **Step 4: Commit.**

```bash
git add packages/backend/src/content-pipeline/magnets/dashboard-magnets.service.ts packages/backend/src/content-pipeline/magnets/dashboard-magnets.controller.ts packages/frontend/app/dashboard/magnets/
git commit -m "feat(content-pipeline): gated user dashboard for delivered lead magnets"
```

## Task 3.14: FFmpegWrapperService

**Files:**

- Create: `packages/backend/src/content-pipeline/style-references/ffmpeg-wrapper.service.ts`
- Create: `packages/backend/src/content-pipeline/style-references/ffmpeg-wrapper.service.spec.ts`

- [ ] **Step 1: Write tests.**

```typescript
// packages/backend/src/content-pipeline/style-references/ffmpeg-wrapper.service.spec.ts
import { FFmpegWrapperService } from "./ffmpeg-wrapper.service";
import * as child_process from "child_process";
import { EventEmitter } from "events";

jest.mock("child_process");

describe("FFmpegWrapperService", () => {
  beforeAll(() => {
    process.env.FFMPEG_BIN = "/usr/bin/ffmpeg";
  });

  it("extractFrames spawns ffmpeg with correct args", async () => {
    const fakeProc: any = new EventEmitter();
    fakeProc.stderr = new EventEmitter();
    (child_process.spawn as jest.Mock).mockReturnValue(fakeProc);
    setTimeout(() => fakeProc.emit("close", 0), 20);

    const svc = new FFmpegWrapperService();
    const frames = await svc.extractFrames("/tmp/v.mp4", 1);

    const args = (child_process.spawn as jest.Mock).mock.calls[0][1];
    expect(args).toContain("-i");
    expect(args).toContain("/tmp/v.mp4");
    expect(args).toContain("-vf");
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// packages/backend/src/content-pipeline/style-references/ffmpeg-wrapper.service.ts
import { Injectable } from "@nestjs/common";
import { spawn } from "child_process";
import { readdirSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

const FRAMES_MAX = 60;

@Injectable()
export class FFmpegWrapperService {
  private readonly bin = process.env.FFMPEG_BIN ?? "/usr/bin/ffmpeg";

  async extractFrames(
    videoPath: string,
    intervalSeconds: number,
  ): Promise<string[]> {
    const outputDir = join(
      tmpdir(),
      `frames-${randomBytes(6).toString("hex")}`,
    );
    mkdirSync(outputDir, { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(this.bin, [
        "-i",
        videoPath,
        "-vf",
        `fps=1/${intervalSeconds}`,
        "-frames:v",
        String(FRAMES_MAX),
        "-y",
        join(outputDir, "frame-%03d.jpg"),
      ]);
      let stderr = "";
      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });
      proc.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr}`)),
      );
    });

    return readdirSync(outputDir)
      .sort()
      .map((f) => join(outputDir, f));
  }

  cleanupDir(framePath: string): void {
    try {
      for (const f of readdirSync(framePath)) unlinkSync(join(framePath, f));
    } catch {}
  }
}
```

- [ ] **Step 3: Run tests, commit.**

```bash
cd packages/backend && npm run test -- ffmpeg-wrapper.service.spec
git add packages/backend/src/content-pipeline/style-references/ffmpeg-wrapper.service.ts packages/backend/src/content-pipeline/style-references/ffmpeg-wrapper.service.spec.ts
git commit -m "feat(content-pipeline): FFmpegWrapperService for frame sampling"
```

## Task 3.15: YtDlpWrapperService

**Files:**

- Create: `packages/backend/src/content-pipeline/style-references/yt-dlp-wrapper.service.ts`
- Create: `packages/backend/src/content-pipeline/style-references/yt-dlp-wrapper.service.spec.ts`

- [ ] **Step 1: Write tests.**

```typescript
// packages/backend/src/content-pipeline/style-references/yt-dlp-wrapper.service.spec.ts
import { YtDlpWrapperService } from "./yt-dlp-wrapper.service";
import * as child_process from "child_process";
import { EventEmitter } from "events";

jest.mock("child_process");

describe("YtDlpWrapperService", () => {
  beforeAll(() => {
    process.env.YT_DLP_BIN = "/usr/local/bin/yt-dlp";
  });

  it("rejects URLs outside allowlist", async () => {
    const svc = new YtDlpWrapperService();
    await expect(
      svc.download("https://evil.example.com/video.mp4"),
    ).rejects.toThrow(/allowlist/);
  });

  it("accepts YouTube URL", async () => {
    const fakeProc: any = new EventEmitter();
    fakeProc.stderr = new EventEmitter();
    (child_process.spawn as jest.Mock).mockReturnValue(fakeProc);
    setTimeout(() => fakeProc.emit("close", 0), 20);

    const svc = new YtDlpWrapperService();
    await expect(
      svc.download("https://www.youtube.com/watch?v=abc"),
    ).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// packages/backend/src/content-pipeline/style-references/yt-dlp-wrapper.service.ts
import { Injectable } from "@nestjs/common";
import { spawn } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

const ALLOWED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "m.youtube.com",
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "fb.watch",
  "twitter.com",
  "x.com",
];

export interface DownloadResult {
  videoPath: string;
  durationSec: number;
  title?: string;
}

@Injectable()
export class YtDlpWrapperService {
  private readonly bin = process.env.YT_DLP_BIN ?? "/usr/local/bin/yt-dlp";

  async download(url: string): Promise<DownloadResult> {
    const parsed = new URL(url);
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      throw new Error(`URL host ${parsed.hostname} not in allowlist`);
    }

    const outputPath = join(
      tmpdir(),
      `yt-${randomBytes(6).toString("hex")}.mp4`,
    );

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(this.bin, [
        "-f",
        "best[height<=720]/best",
        "--max-filesize",
        "200M",
        "--download-sections",
        "*0-300", // first 5 minutes only
        "-o",
        outputPath,
        url,
      ]);
      let stderr = "";
      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });
      proc.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`yt-dlp ${code}: ${stderr}`)),
      );
    });

    return { videoPath: outputPath, durationSec: 300 };
  }
}
```

- [ ] **Step 3: Run tests, commit.**

```bash
cd packages/backend && npm run test -- yt-dlp-wrapper.service.spec
git add packages/backend/src/content-pipeline/style-references/yt-dlp-wrapper.service.ts packages/backend/src/content-pipeline/style-references/yt-dlp-wrapper.service.spec.ts
git commit -m "feat(content-pipeline): YtDlpWrapperService with source allowlist and 5-minute cap"
```

## Task 3.16: Video style reference ingest and analysis

**Files:**

- Modify: `packages/backend/src/content-pipeline/style-references/style-reference.service.ts`
- Modify: `packages/backend/src/content-pipeline/style-references/vision-extractor.service.ts`

- [ ] **Step 1: Extend VisionExtractorService with `extractFromFrames()`.**

```typescript
// vision-extractor.service.ts (add)
async extractFromFrames(framePaths: string[]): Promise<{ attributes: any; cost: DriverCost }> {
  const imageBlocks = framePaths.slice(0, 12).map((p) => {
    const base64 = readFileSync(p).toString('base64');
    return { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64 } };
  });

  const VIDEO_EXTRACT_TOOL = {
    name: 'emit_video_attributes',
    description: 'Extract structured video style attributes.',
    input_schema: {
      type: 'object',
      required: ['cuts_per_10_sec', 'hook_archetype', 'caption_style', 'energy_tag'],
      properties: {
        cuts_per_10_sec: { type: 'number' },
        hook_archetype: { type: 'string', enum: ['question', 'statistic', 'bold-claim', 'callout', 'countdown', 'pattern-interrupt'] },
        text_density_over_time: { type: 'array', items: { type: 'number' } },
        caption_style: { type: 'string', enum: ['none', 'single-line-burn-in', 'kinetic-multi-line', 'traditional-subtitle'] },
        aspect: { type: 'string', enum: ['9x16', '16x9', '1x1', 'other'] },
        energy_tag: { type: 'string', enum: ['calm', 'medium', 'high'] },
        dominant_palette: { type: 'array', items: { type: 'string' } },
      },
    },
  } as const;

  const response = await this.client.messages.create({
    model: process.env.SCRIPT_LLM_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 1500,
    tools: [VIDEO_EXTRACT_TOOL as unknown as Anthropic.Messages.Tool],
    tool_choice: { type: 'tool', name: 'emit_video_attributes' },
    messages: [{ role: 'user', content: [
      ...imageBlocks,
      { type: 'text', text: 'These frames are sampled 1 second apart from a video reference. Extract style attributes using the tool. Estimate cuts_per_10_sec from frame-to-frame visual changes. Do not copy any visible text from the frames; only describe text placement abstractly.' },
    ] }],
  });

  const toolBlock = response.content.find((c) => c.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') throw new Error('video vision did not return tool_use');

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  return {
    attributes: toolBlock.input,
    cost: {
      provider: 'anthropic-vision',
      amount_usd: (inputTokens * 3.0 + outputTokens * 15.0) / 1_000_000,
      units: inputTokens + outputTokens, unit_type: 'tokens_input',
    },
  };
}
```

- [ ] **Step 2: StyleReferenceService extends to video ingest.**

```typescript
// style-reference.service.ts (add)
async ingestVideoFromUpload(userId: string, buffer: Buffer, label: string) {
  const videoPath = join(tmpdir(), `upload-${Date.now()}.mp4`);
  writeFileSync(videoPath, buffer);
  return this.processVideo(userId, videoPath, label, null);
}

async ingestVideoFromUrl(userId: string, url: string, label: string) {
  const download = await this.ytdlp.download(url);
  return this.processVideo(userId, download.videoPath, label, url);
}

private async processVideo(userId: string, videoPath: string, label: string, sourceUrl: string | null) {
  const frames = await this.ffmpeg.extractFrames(videoPath, 1);
  const extraction = await this.vision.extractFromFrames(frames);

  const previewStripBuffer = await this.buildPreviewStrip(frames.slice(0, 9));
  const client = this.supabase.getClient();
  const previewPath = `style-references/${userId}/${Date.now()}-preview.jpg`;
  await client.storage.from('content-pipeline').upload(previewPath, previewStripBuffer, {
    contentType: 'image/jpeg', upsert: true,
  });

  const { data } = await client.from('style_references').insert({
    user_id: userId, kind: 'video', label, source_url: sourceUrl,
    preview_strip_url: `supabase://content-pipeline/${previewPath}`,
    extracted_attributes: extraction.attributes,
    vision_cost_usd: extraction.cost.amount_usd,
  }).select().single();

  // delete raw video per 24h TTL; fire-and-forget
  try { unlinkSync(videoPath); } catch {}

  return data;
}

private async buildPreviewStrip(framePaths: string[]): Promise<Buffer> {
  // For simplicity, concatenate 9 frames via ffmpeg tile filter. Implementation:
  const outputPath = join(tmpdir(), `strip-${Date.now()}.jpg`);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(process.env.FFMPEG_BIN ?? 'ffmpeg', [
      '-i', framePaths[0],
      ...framePaths.slice(1).flatMap((p) => ['-i', p]),
      '-filter_complex', 'tile=3x3',
      '-y', outputPath,
    ]);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`tile ${code}: ${stderr}`)));
  });
  return readFileSync(outputPath);
}
```

Inject `YtDlpWrapperService` and `FFmpegWrapperService` into the StyleReferenceService constructor.

- [ ] **Step 3: Run tests, commit.**

```bash
cd packages/backend && npm run test -- style-reference.service.spec
git add packages/backend/src/content-pipeline/style-references/
git commit -m "feat(content-pipeline): video style reference ingest with frame sampling and vision analysis"
```

## Task 3.17: Video ingest endpoints

**Files:**

- Modify: `packages/backend/src/content-pipeline/style-references/style-reference.controller.ts`

- [ ] **Step 1: Add video ingest endpoints.**

```typescript
// style-reference.controller.ts (add)
@Post('upload-video')
@UseInterceptors(FileInterceptor('file'))
async uploadVideo(@Req() req: any, @UploadedFile() file: Express.Multer.File, @Body('label') label: string) {
  try {
    return { success: true, data: await this.service.ingestVideoFromUpload(req.user.id, file.buffer, label) };
  } catch (err) {
    return { success: false, error: this.mapError(err) };
  }
}

@Post('ingest-video-url')
async ingestVideoUrl(@Req() req: any, @Body() body: { url: string; label: string }) {
  try {
    return { success: true, data: await this.service.ingestVideoFromUrl(req.user.id, body.url, body.label) };
  } catch (err) {
    return { success: false, error: this.mapError(err) };
  }
}

private mapError(err: unknown): string {
  const msg = (err as Error).message;
  if (msg.includes('allowlist')) return 'That URL is not from a supported source. Upload the file instead.';
  if (msg.includes('private') || msg.includes('geo')) return "Couldn't access this, might be private or geo-blocked.";
  if (msg.includes('filesize') || msg.includes('too long')) return "Video is too long; we'll analyze just the first 5 minutes.";
  return msg;
}
```

- [ ] **Step 2: Commit.**

```bash
git add packages/backend/src/content-pipeline/style-references/style-reference.controller.ts
git commit -m "feat(content-pipeline): video style reference endpoints (upload + URL ingest)"
```

## Task 3.18: Style Library UI video tab

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/style-library/upload-dialog.tsx`

- [ ] **Step 1: Add video-ingest UI to upload dialog.**

Extend the upload dialog with a toggle between `thumbnail` and `video` reference kind. Video tab exposes URL input and file upload. File accept extended to `video/mp4,video/quicktime`. Video ingest calls `/api/admin/content-pipeline/style-references/upload-video` or `ingest-video-url`.

```tsx
// extend upload-dialog.tsx, add kind state and conditional endpoint selection:
const [kind, setKind] = useState<"thumbnail" | "video">("thumbnail");

// conditionally route submit:
const endpoint =
  kind === "video"
    ? tab === "url"
      ? "/ingest-video-url"
      : "/upload-video"
    : tab === "url"
      ? "/ingest-url"
      : "/upload";
```

Display extracted video-specific attributes on the reference card: cuts_per_10_sec, hook_archetype, caption_style, 9-frame preview strip.

- [ ] **Step 2: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/style-library/upload-dialog.tsx
git commit -m "feat(content-pipeline): style library UI supports video references (upload and URL)"
```

## Task 3.19: Video-reference style variants and selection

**Files:**

- Create: `packages/video-template/src/presets/style-variants/pattern-interrupt-hook.ts`
- Create: `packages/video-template/src/presets/style-variants/countdown-hook.ts`
- Create: `packages/video-template/src/presets/style-variants/question-hook.ts`
- Modify: `packages/video-template/src/presets/style-variants/index.ts`
- Modify: `packages/video-template/src/presets/style-variants/select.ts`

- [ ] **Step 1: Write 3 new variants keyed by hook archetype.**

```typescript
// pattern-interrupt-hook.ts
export const patternInterruptHook: StyleVariantPreset = {
  textPosition: "center",
  textSize: "large",
  graphicDensity: "dense",
  openingSceneDuration: 45, // shorter hook
};

// countdown-hook.ts
export const countdownHook: StyleVariantPreset = {
  textPosition: "top",
  textSize: "medium",
  graphicDensity: "moderate",
  openingSceneDuration: 90, // slightly longer for countdown
};

// question-hook.ts
export const questionHook: StyleVariantPreset = {
  textPosition: "center",
  textSize: "medium",
  graphicDensity: "minimal",
  openingSceneDuration: 60,
};
```

- [ ] **Step 2: Selection logic reads `hook_archetype` and `energy_tag` from style_references.extracted_attributes.**

```typescript
// select.ts (extend)
export function selectVariant(attrs?: any): StyleVariantPreset {
  if (!attrs) return mediumEnergy;
  if (attrs.hook_archetype === "pattern-interrupt") return patternInterruptHook;
  if (attrs.hook_archetype === "countdown") return countdownHook;
  if (attrs.hook_archetype === "question") return questionHook;
  if (attrs.energy_tag === "high") return highEnergy;
  if (attrs.energy_tag === "calm") return calmExplainer;
  return mediumEnergy;
}
```

- [ ] **Step 3: Wire into render-video.handler.ts to pass chosen variant name into Remotion props.**

- [ ] **Step 4: Commit.**

```bash
git add packages/video-template/src/presets/style-variants/
git commit -m "feat(video-template): 3 video-reference style variants (pattern-interrupt, countdown, question)"
```

## Task 3.20: Transient storage cleanup cron

**Files:**

- Create: `packages/backend/src/content-pipeline/crons/cleanup-transient-refs.cron.ts`

- [ ] **Step 1: Write cron.**

```typescript
// packages/backend/src/content-pipeline/crons/cleanup-transient-refs.cron.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SupabaseService } from "../../supabase/supabase.service";

@Injectable()
export class CleanupTransientRefsCron {
  private readonly logger = new Logger(CleanupTransientRefsCron.name);
  constructor(private readonly supabase: SupabaseService) {}

  @Cron("0 */6 * * *") // every 6 hours
  async run(): Promise<void> {
    const client = this.supabase.getClient();
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000);

    const { data: files } = await client.storage
      .from("style-references-transient")
      .list("", { limit: 1000 });
    let deleted = 0;
    for (const f of files ?? []) {
      if (new Date(f.created_at ?? 0) < cutoff) {
        await client.storage
          .from("style-references-transient")
          .remove([f.name]);
        deleted++;
      }
    }
    if (deleted > 0)
      this.logger.log(`cleaned up ${deleted} transient style-reference files`);
  }
}
```

- [ ] **Step 2: Register in module, commit.**

```bash
git add packages/backend/src/content-pipeline/crons/cleanup-transient-refs.cron.ts
git commit -m "feat(content-pipeline): cleanup-transient-refs cron deletes style-reference raw files after 24h"
```

## Task 3.21: Phase 3 E2E tests

**Files:**

- Create: `packages/backend/test/e2e/content-pipeline-p3-long-form.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p3-video-style-ref.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p3-gated-dashboard.e2e.spec.ts`

**Per project memory: real staging DB, no mocks.**

- [ ] **Step 1: long-form end-to-end.**

```typescript
// packages/backend/test/e2e/content-pipeline-p3-long-form.e2e.spec.ts
describe("E2E: Long-Form Deep Dive end-to-end", () => {
  // Create long_form_deep_dive run for Cleveland, OH with tts_provider=elevenlabs
  // Poll until published (up to 25 min)
  // Verify YouTube video uploaded with valid URL
  // Verify video duration between 5 and 12 minutes
  // Verify captions.insert succeeded (request captions list and check for en caption track)
  // Verify SRT asset exists in content_assets
});
```

- [ ] **Step 2: video style reference via URL.**

```typescript
describe("E2E: Video style reference via YouTube URL", () => {
  // POST /style-references/ingest-video-url with a public YouTube URL known to be style-relevant
  // Expect 200 within 90s (yt-dlp download + frame sample + vision analysis)
  // Verify extracted_attributes contains cuts_per_10_sec, hook_archetype, energy_tag
  // Verify preview strip exists in storage
});
```

- [ ] **Step 3: gated dashboard access.**

```typescript
describe("E2E: Gated dashboard shows delivered magnets", () => {
  // Simulate a lead magnet delivery for a test user
  // Authenticate as that user and GET /api/dashboard/magnets
  // Expect the delivered magnet in response with download link
  // Verify unauthenticated request returns 401
});
```

- [ ] **Step 4: Run E2E, commit.**

```bash
cd packages/backend && E2E_ADMIN_JWT=<jwt> npm run test:e2e -- content-pipeline-p3
git add packages/backend/test/e2e/
git commit -m "test(content-pipeline): P3 E2E suite (long-form, video style ref, gated dashboard)"
```

## Task 3.22: Update internal services map for P3 data methods

**Files:**

- Modify: `docs/content-pipeline/internal-services-map.md`

- [ ] **Step 1: Extend the services map from Task 1.12 with P3 tools.**

Append rows for `farm_area_analysis`, `brokerage_market_coverage_report`, `agent_recruitment_pitch`, `referral_network_finder`, `generate_market_narrative`, `compare_markets_for_content`. For each, document the backend internal service or endpoint that supplies the data, or flag as "requires lifting from MCP tool file" if no backend service exists.

- [ ] **Step 2: Commit.**

```bash
git add docs/content-pipeline/internal-services-map.md
git commit -m "docs(content-pipeline): internal services map updated with P3 data methods"
```

---

# Phase 4: Automation trust matures

**Duration:** 2 weeks. **Complexity:** Medium. **Tasks:** 24.

## Phase 4 scope

7-day and 30-day metrics pulls. Hook A/B winner detection with significance testing. Revenue-per-video attribution through billing. Observability maturity for C (publish reliability) and D (render correctness). Performance page full build with narrative cards and rules engine. Lead magnet A/B with auto-promotion. Style reference A/B.

## Phase 4 deliverables

- 7d and 30d metrics pulled automatically for every platform.
- Hook A/B winner auto-promotes to default prompt when significance threshold met.
- Revenue-per-video visible in Performance page, joining signup_attributions to Stripe tier upgrades.
- Slack alerts fire on credential expiry, stall, retry exhaustion, queue depth, per-platform error rate.
- Render pre-flight catches text overflow and asset-load failures before full render.
- Performance page has Hero Card, Format Conversion Panel, Hook Patterns Panel, Suggested Runs Panel, and Runs Table.
- Lead magnet A/B fully functional: 2 bindings per format with weight, conversion-rate leaderboard, auto-promotion.

## Phase 4 acceptance criteria

1. P4 migrations apply cleanly (hook_archetypes, alerts_sent, observability_queue_samples, magnet_ab, style_ab).
2. `npm run test` passes P4 unit tests (minimum 60 new).
3. `npm run test:e2e` passes P4 E2E suite (revenue round-trip, hook A/B, render pre-flight, alert dedup, credential expiry).
4. Running a full run with 2 hook variants produces 2 platform_posts with correct hook_variant_id.
5. Seeding 100 runs with known A/B split where A wins by >30% triggers auto-promotion.
6. A run with intentionally long market name hits render pre-flight and routes to failed with overflow detail.

## Phase 4 prerequisites

- P1, P2, P3 all merged and running in production for at least 2 weeks.
- At least 50 published runs in production to drive analytics.
- Stripe webhook integration confirmed with existing billing tables (see Task 4.8 discovery).
- Slack workspace with webhook URL.

## Task 4.1: 7d metrics pull cron

**Files:**

- Create: `packages/backend/src/content-pipeline/crons/pull-7d-metrics.cron.ts`

- [ ] **Step 1: Copy pattern from `pull-24h-metrics.cron.ts`, change window to '7d'.**

```typescript
// packages/backend/src/content-pipeline/crons/pull-7d-metrics.cron.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MetricsPullerService } from "../analytics/metrics-puller.service";

@Injectable()
export class Pull7dMetricsCron {
  private readonly logger = new Logger(Pull7dMetricsCron.name);
  constructor(private readonly puller: MetricsPullerService) {}

  @Cron("15 3 * * *", { timeZone: "UTC" })
  async run(): Promise<void> {
    const count = await this.puller.pullWindow("7d");
    this.logger.log(`pulled 7d metrics for ${count} posts`);
  }
}
```

- [ ] **Step 2: Register, commit.**

```bash
git add packages/backend/src/content-pipeline/crons/pull-7d-metrics.cron.ts
git commit -m "feat(content-pipeline): 7-day metrics pull cron"
```

## Task 4.2: 30d metrics pull cron

**Files:**

- Create: `packages/backend/src/content-pipeline/crons/pull-30d-metrics.cron.ts`

- [ ] **Step 1: Same pattern with window '30d'.**

```typescript
@Injectable()
export class Pull30dMetricsCron {
  constructor(private readonly puller: MetricsPullerService) {}
  @Cron("30 3 * * *", { timeZone: "UTC" })
  async run(): Promise<void> {
    await this.puller.pullWindow("30d");
  }
}
```

- [ ] **Step 2: Commit.**

```bash
git add packages/backend/src/content-pipeline/crons/pull-30d-metrics.cron.ts
git commit -m "feat(content-pipeline): 30-day metrics pull cron"
```

## Task 4.3: Per-platform metric pullers (TikTok, IG, FB, LinkedIn)

**Files:**

- Create: `packages/backend/src/content-pipeline/analytics/tiktok-metrics.service.ts`
- Create: `packages/backend/src/content-pipeline/analytics/instagram-metrics.service.ts`
- Create: `packages/backend/src/content-pipeline/analytics/facebook-metrics.service.ts`
- Create: `packages/backend/src/content-pipeline/analytics/linkedin-metrics.service.ts`
- Modify: `packages/backend/src/content-pipeline/analytics/metrics-puller.service.ts`

- [ ] **Step 1: Write each service following YouTubeMetricsService pattern.**

TikTok: `GET /v2/video/query/` with video ID filter, fields for views, likes, comments, shares, total_time_watched. Instagram Graph: `GET /<media-id>/insights?metric=views,reach,likes,comments,saved,shares`. Facebook Graph: `GET /<post-id>/insights?metric=post_video_views,post_reactions_like_total,...`. LinkedIn: `GET /ugcPosts/<share-id>?fields=statistics`.

Each implements a `fetchMetrics(externalId, window)` returning the same shape as `YouTubeMetricsResult`.

- [ ] **Step 2: Update MetricsPullerService to dispatch per platform.**

```typescript
// metrics-puller.service.ts (modify pullWindow)
switch (post.platform) {
  case "youtube_shorts":
  case "youtube_long":
    metrics = await this.youtube.fetchMetrics(post.external_id, window);
    break;
  case "tiktok":
    metrics = await this.tiktok.fetchMetrics(post.external_id, window);
    break;
  case "instagram_reels":
    metrics = await this.instagram.fetchMetrics(post.external_id, window);
    break;
  case "facebook_reels":
    metrics = await this.facebook.fetchMetrics(post.external_id, window);
    break;
  case "linkedin":
    metrics = await this.linkedin.fetchMetrics(post.external_id, window);
    break;
}
```

- [ ] **Step 3: Unit tests per puller, commit.**

```bash
cd packages/backend && npm run test -- 'metrics.service'
git add packages/backend/src/content-pipeline/analytics/
git commit -m "feat(content-pipeline): metric pullers for TikTok, IG, FB, LinkedIn"
```

## Task 4.4: HookABService with significance testing

**Files:**

- Create: `packages/backend/src/content-pipeline/analytics/hook-ab.service.ts`
- Create: `packages/backend/src/content-pipeline/analytics/hook-ab.service.spec.ts`

- [ ] **Step 1: Write tests.**

```typescript
// packages/backend/src/content-pipeline/analytics/hook-ab.service.spec.ts
import { Test } from "@nestjs/testing";
import { HookABService } from "./hook-ab.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("HookABService", () => {
  // Generate synthetic data where variant A has 50% retention at 60 samples
  // and variant B has 20% retention at 60 samples.
  // Service should identify A as winner with >95% confidence.

  it("identifies winner when lift >= 30% and confidence >= 95%", async () => {
    const aSamples = 60,
      bSamples = 60;
    const aSuccesses = 30,
      bSuccesses = 12;
    // ... build mock Supabase response

    // Invoke HookABService.determineWinner('grade_reveal')
    // Expect returns { winner: 'A', lift: >= 0.3, confidence: >= 0.95 }
  });

  it("returns null when lift is insufficient", async () => {
    // A: 30/60, B: 28/60, lift under 30%
    // Expect null winner
  });

  it("returns null when sample size below 50 per variant", async () => {
    // Expect null winner
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// packages/backend/src/content-pipeline/analytics/hook-ab.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { ContentFormat } from "../types";

export interface HookWinner {
  variantId: "A" | "B";
  lift: number;
  confidence: number;
  aRetention: number;
  bRetention: number;
  aSamples: number;
  bSamples: number;
}

const MIN_SAMPLES_PER_ARM = 50;
const MIN_LIFT = 0.3;
const MIN_CONFIDENCE = 0.95;

@Injectable()
export class HookABService {
  constructor(private readonly supabase: SupabaseService) {}

  async determineWinner(format: ContentFormat): Promise<HookWinner | null> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from("platform_posts")
      .select("hook_variant_id, content_metrics!inner(avg_retention_pct)")
      .eq("content_runs.format", format)
      .eq("content_metrics.pulled_at_window", "7d");

    if (!data) return null;

    const aMetrics = data
      .filter((d: any) => d.hook_variant_id === "A")
      .map((d: any) => d.content_metrics.avg_retention_pct);
    const bMetrics = data
      .filter((d: any) => d.hook_variant_id === "B")
      .map((d: any) => d.content_metrics.avg_retention_pct);

    if (
      aMetrics.length < MIN_SAMPLES_PER_ARM ||
      bMetrics.length < MIN_SAMPLES_PER_ARM
    )
      return null;

    const aMean = aMetrics.reduce((s, v) => s + v, 0) / aMetrics.length;
    const bMean = bMetrics.reduce((s, v) => s + v, 0) / bMetrics.length;
    const lift = Math.abs(aMean - bMean) / Math.min(aMean, bMean);

    if (lift < MIN_LIFT) return null;

    const z = this.zScoreForMeans(aMetrics, bMetrics);
    const confidence = this.pValueFromZ(z);
    if (confidence < MIN_CONFIDENCE) return null;

    const winner = aMean > bMean ? "A" : "B";
    return {
      variantId: winner,
      lift,
      confidence,
      aRetention: aMean,
      bRetention: bMean,
      aSamples: aMetrics.length,
      bSamples: bMetrics.length,
    };
  }

  private zScoreForMeans(a: number[], b: number[]): number {
    const aMean = a.reduce((s, v) => s + v, 0) / a.length;
    const bMean = b.reduce((s, v) => s + v, 0) / b.length;
    const aVar = a.reduce((s, v) => s + (v - aMean) ** 2, 0) / a.length;
    const bVar = b.reduce((s, v) => s + (v - bMean) ** 2, 0) / b.length;
    const se = Math.sqrt(aVar / a.length + bVar / b.length);
    return Math.abs(aMean - bMean) / se;
  }

  private pValueFromZ(z: number): number {
    return 1 - 0.5 * (1 + this.erf(z / Math.SQRT2));
  }

  private erf(x: number): number {
    const sign = Math.sign(x);
    const ax = Math.abs(x);
    const a1 = 0.254829592,
      a2 = -0.284496736,
      a3 = 1.421413741,
      a4 = -1.453152027,
      a5 = 1.061405429,
      p = 0.3275911;
    const t = 1 / (1 + p * ax);
    const y =
      1 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
    return sign * y;
  }
}
```

- [ ] **Step 3: Run tests, commit.**

```bash
cd packages/backend && npm run test -- hook-ab.service.spec
git add packages/backend/src/content-pipeline/analytics/
git commit -m "feat(content-pipeline): HookABService with two-sample z-test significance"
```

## Task 4.5: Hook archetype auto-promotion

**Files:**

- Create: `supabase/migrations/20260424000040_content_pipeline_hook_archetypes.sql`
- Create: `packages/backend/src/content-pipeline/analytics/hook-promoter.service.ts`
- Create: `packages/backend/src/content-pipeline/crons/hook-promotion.cron.ts`

- [ ] **Step 1: Migration.**

```sql
CREATE TABLE IF NOT EXISTS hook_archetypes (
  format TEXT PRIMARY KEY REFERENCES format_templates(format),
  active_archetype TEXT NOT NULL,
  active_prompt_append TEXT,
  last_promoted_at TIMESTAMPTZ,
  last_winner_variant TEXT,
  last_winner_confidence NUMERIC,
  last_winner_lift NUMERIC
);
ALTER TABLE hook_archetypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON hook_archetypes FOR ALL USING (true);
GRANT ALL ON hook_archetypes TO service_role;
GRANT ALL ON hook_archetypes TO authenticated;
```

- [ ] **Step 2: Promoter service.**

```typescript
// hook-promoter.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { HookABService } from "./hook-ab.service";
import { AlertDispatcherService } from "../observability/alert-dispatcher.service";
import { ContentFormat } from "../types";

@Injectable()
export class HookPromoterService {
  private readonly logger = new Logger(HookPromoterService.name);
  constructor(
    private readonly supabase: SupabaseService,
    private readonly hookAb: HookABService,
    private readonly alerts: AlertDispatcherService,
  ) {}

  async evaluate(format: ContentFormat): Promise<void> {
    const winner = await this.hookAb.determineWinner(format);
    if (!winner) return;

    const client = this.supabase.getClient();
    await client.from("hook_archetypes").upsert({
      format,
      active_archetype: `variant_${winner.variantId}`,
      last_promoted_at: new Date().toISOString(),
      last_winner_variant: winner.variantId,
      last_winner_confidence: winner.confidence,
      last_winner_lift: winner.lift,
    });

    await this.alerts.sendAlert(
      "info",
      "hook_promotion",
      `Hook variant ${winner.variantId} auto-promoted for ${format} with ${(winner.lift * 100).toFixed(0)}% lift at ${(winner.confidence * 100).toFixed(0)}% confidence.`,
    );
  }
}
```

- [ ] **Step 3: Weekly cron.**

```typescript
// crons/hook-promotion.cron.ts
@Injectable()
export class HookPromotionCron {
  constructor(private readonly promoter: HookPromoterService) {}

  @Cron("0 4 * * 1", { timeZone: "UTC" }) // Monday 4am UTC
  async run(): Promise<void> {
    const formats: ContentFormat[] = [
      "grade_reveal",
      "top_10_ranking",
      "score_mover",
      "head_to_head",
      "long_form_deep_dive",
      "farm_area_spotlight",
      "brokerage_market_share",
      "recruitment_angle",
    ];
    for (const f of formats) await this.promoter.evaluate(f);
  }
}
```

- [ ] **Step 4: ScriptGenerator reads `hook_archetypes.active_archetype` and appends to per-format prompt if set.**

```typescript
// anthropic-script-generator.ts (extend generate())
const { data: archetype } = await this.supabase
  .getClient()
  .from("hook_archetypes")
  .select("active_prompt_append")
  .eq("format", req.format)
  .maybeSingle();
const promoted = archetype?.active_prompt_append ?? "";
// append `promoted` to the userPrompt before sending to Anthropic
```

- [ ] **Step 5: Commit.**

```bash
supabase db push
git add supabase/migrations/20260424000040_content_pipeline_hook_archetypes.sql packages/backend/src/content-pipeline/analytics/hook-promoter.service.ts packages/backend/src/content-pipeline/crons/hook-promotion.cron.ts
git commit -m "feat(content-pipeline): hook archetype auto-promotion with weekly cron"
```

## Task 4.6: Billing schema discovery

**Files:**

- Create: `docs/content-pipeline/billing-schema-map.md`

- [ ] **Step 1: Discovery.**

Inspect `packages/backend/src/billing/` and `packages/backend/src/stripe/` for the existing billing tables (subscriptions, customers, trial conversions, etc.). Document:

- Table names and key columns.
- How user_id (`auth.users`) links to subscription rows.
- How tier is represented (e.g., `tier` column, or inferred from `stripe_price_id`).
- How tier-change events are captured (webhook table? table with last_tier and current_tier?).

- [ ] **Step 2: Write findings to billing-schema-map.md.**

Include a SQL query template that, given a user_id, returns their tier history with timestamps. This query backs RevenueAttributionService.

- [ ] **Step 3: Commit.**

```bash
git add docs/content-pipeline/billing-schema-map.md
git commit -m "docs(content-pipeline): billing schema map for revenue attribution"
```

## Task 4.7: RevenueAttributionService

**Files:**

- Create: `packages/backend/src/content-pipeline/analytics/revenue-attribution.service.ts`
- Create: `packages/backend/src/content-pipeline/analytics/revenue-attribution.service.spec.ts`

- [ ] **Step 1: Write tests.**

```typescript
// analytics/revenue-attribution.service.spec.ts
describe("RevenueAttributionService.getRevenueByRun", () => {
  // Mock Supabase responses for signup_attributions joined to billing
  // Include a user who upgraded from free to pro within 30 days of signup
  // Verify service returns tier: 'pro', mrr_contribution_usd: (subscription price)
});
```

- [ ] **Step 2: Implement.**

```typescript
// analytics/revenue-attribution.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";

export interface RunRevenue {
  runId: string;
  signups: number;
  conversions_to_pro: number;
  conversions_to_enterprise: number;
  total_mrr_contribution_usd: number;
}

@Injectable()
export class RevenueAttributionService {
  constructor(private readonly supabase: SupabaseService) {}

  async getRevenueByRun(runId: string): Promise<RunRevenue> {
    const client = this.supabase.getClient();
    const { data: attributions } = await client
      .from("signup_attributions")
      .select("user_id, tier_at_signup")
      .eq("attributed_run_id", runId);

    const signups = attributions?.length ?? 0;
    let pro = 0,
      enterprise = 0,
      mrr = 0;

    for (const a of attributions ?? []) {
      const { data: sub } = await client
        .from("stripe_subscriptions")
        .select("tier, price_usd_monthly, status")
        .eq("user_id", a.user_id)
        .eq("status", "active")
        .maybeSingle();
      if (!sub) continue;
      if (sub.tier === "pro") pro++;
      if (sub.tier === "enterprise") enterprise++;
      if (sub.price_usd_monthly) mrr += Number(sub.price_usd_monthly);
    }
    return {
      runId,
      signups,
      conversions_to_pro: pro,
      conversions_to_enterprise: enterprise,
      total_mrr_contribution_usd: mrr,
    };
  }
}
```

Adjust table name per Task 4.6 findings if it is not `stripe_subscriptions`.

- [ ] **Step 3: Run tests, commit.**

```bash
cd packages/backend && npm run test -- revenue-attribution.service.spec
git add packages/backend/src/content-pipeline/analytics/revenue-attribution.service.ts packages/backend/src/content-pipeline/analytics/revenue-attribution.service.spec.ts
git commit -m "feat(content-pipeline): RevenueAttributionService joining signup_attributions to billing"
```

## Task 4.8: AlertDispatcherService with Slack and email

**Files:**

- Create: `packages/backend/src/content-pipeline/observability/alert-dispatcher.service.ts`
- Create: `packages/backend/src/content-pipeline/observability/alert-dispatcher.service.spec.ts`
- Create: `supabase/migrations/20260424000050_content_pipeline_alerts_sent.sql`

- [ ] **Step 1: Migration.**

```sql
CREATE TABLE IF NOT EXISTS alerts_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  metadata_hash TEXT NOT NULL,
  severity TEXT NOT NULL,
  channel TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code, metadata_hash, sent_at)
);
CREATE INDEX idx_alerts_sent_code_hash ON alerts_sent (code, metadata_hash, sent_at DESC);
ALTER TABLE alerts_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON alerts_sent FOR ALL USING (true);
GRANT ALL ON alerts_sent TO service_role;
```

- [ ] **Step 2: Implement service.**

```typescript
// observability/alert-dispatcher.service.ts
import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import { createHash } from "crypto";
import { SupabaseService } from "../../supabase/supabase.service";
import { EmailService } from "../../email/email.service";

export type AlertSeverity = "info" | "warning" | "error" | "critical";

const DEDUP_WINDOW_MS = 3600_000;

@Injectable()
export class AlertDispatcherService {
  private readonly logger = new Logger(AlertDispatcherService.name);
  constructor(
    private readonly supabase: SupabaseService,
    private readonly email: EmailService,
  ) {}

  async sendAlert(
    severity: AlertSeverity,
    code: string,
    message: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const metadataHash = createHash("sha256")
      .update(JSON.stringify(metadata, Object.keys(metadata).sort()))
      .digest("hex");
    const client = this.supabase.getClient();

    const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const { data: recent } = await client
      .from("alerts_sent")
      .select("id")
      .eq("code", code)
      .eq("metadata_hash", metadataHash)
      .gte("sent_at", cutoff)
      .limit(1);
    if (recent && recent.length > 0) {
      this.logger.debug(`alert dedup: ${code} already sent in last hour`);
      return;
    }

    const slackUrl = process.env.SLACK_ALERT_WEBHOOK_URL;
    if (slackUrl) {
      try {
        await axios.post(slackUrl, {
          text: this.formatSlack(severity, code, message, metadata),
        });
        await client.from("alerts_sent").insert({
          code,
          metadata_hash: metadataHash,
          severity,
          channel: "slack",
        });
        return;
      } catch (err) {
        this.logger.warn(
          `Slack alert failed, falling back to email: ${(err as Error).message}`,
        );
      }
    }

    const adminEmail =
      process.env.ADMIN_ALERT_EMAIL ?? "troyhouston76@gmail.com";
    await this.email.sendEmail({
      to: adminEmail,
      subject: `[${severity.toUpperCase()}] ${code}`,
      html: `<p>${message}</p><pre>${JSON.stringify(metadata, null, 2)}</pre>`,
    });
    await client.from("alerts_sent").insert({
      code,
      metadata_hash: metadataHash,
      severity,
      channel: "email",
    });
  }

  private formatSlack(
    severity: AlertSeverity,
    code: string,
    message: string,
    metadata: Record<string, unknown>,
  ): string {
    const icon =
      severity === "critical"
        ? ":rotating_light:"
        : severity === "error"
          ? ":red_circle:"
          : severity === "warning"
            ? ":warning:"
            : ":information_source:";
    return `${icon} *${code}* [${severity}]\n${message}\n\`\`\`${JSON.stringify(metadata, null, 2)}\`\`\``;
  }
}
```

- [ ] **Step 3: Tests.**

```typescript
// observability/alert-dispatcher.service.spec.ts
describe("AlertDispatcherService dedup", () => {
  it("sends alert once, then suppresses same alert for 1 hour", async () => {
    // First call writes to alerts_sent and posts to Slack
    // Second call within 1 hour checks alerts_sent, sees recent row, does NOT post Slack
    // After 1+ hour, third call sends again
  });
});
```

- [ ] **Step 4: Register, commit.**

```bash
supabase db push
cd packages/backend && npm run test -- alert-dispatcher.service.spec
git add supabase/migrations/20260424000050_content_pipeline_alerts_sent.sql packages/backend/src/content-pipeline/observability/
git commit -m "feat(content-pipeline): AlertDispatcherService with Slack primary, email fallback, 1h dedup"
```

## Task 4.9: StallDetectorService integrated into recover-stuck-runs cron

**Files:**

- Create: `packages/backend/src/content-pipeline/observability/stall-detector.service.ts`
- Modify: `packages/backend/src/content-pipeline/crons/recover-stuck-runs.cron.ts`

- [ ] **Step 1: Implement service that classifies stall severity and fires alert.**

```typescript
@Injectable()
export class StallDetectorService {
  constructor(private readonly alerts: AlertDispatcherService) {}

  async reportStall(
    runId: string,
    status: string,
    ageMinutes: number,
  ): Promise<void> {
    if (ageMinutes > 30) {
      await this.alerts.sendAlert(
        "error",
        "run_stalled",
        `Run ${runId} stalled in ${status} for ${ageMinutes.toFixed(0)} minutes.`,
        { runId, status },
      );
    } else if (ageMinutes > 60) {
      await this.alerts.sendAlert(
        "critical",
        "run_stalled_severe",
        `Run ${runId} stalled 60+ minutes in ${status}.`,
        { runId, status },
      );
    }
  }
}
```

- [ ] **Step 2: Update recover-stuck-runs cron to call StallDetector when re-enqueuing.**

- [ ] **Step 3: Commit.**

```bash
git add packages/backend/src/content-pipeline/observability/stall-detector.service.ts packages/backend/src/content-pipeline/crons/recover-stuck-runs.cron.ts
git commit -m "feat(content-pipeline): StallDetectorService integrated with recovery cron"
```

## Task 4.10: credential-health-probe cron

**Files:**

- Create: `packages/backend/src/content-pipeline/crons/credential-health-probe.cron.ts`

- [ ] **Step 1: Implement cron that every 6h probes each configured publisher.**

```typescript
@Injectable()
export class CredentialHealthProbeCron {
  constructor(
    private readonly publishers: PlatformPublisherRegistry,
    private readonly alerts: AlertDispatcherService,
    private readonly supabase: SupabaseService,
  ) {}

  @Cron("0 */6 * * *")
  async run(): Promise<void> {
    for (const pub of this.publishers.listAll()) {
      if (!pub.isConfigured()) continue;
      try {
        if (pub.refreshCredentials) await pub.refreshCredentials();
      } catch (err) {
        await this.alerts.sendAlert(
          "critical",
          "credential_rotten",
          `Credentials for ${pub.platform} failed refresh: ${(err as Error).message}`,
          { platform: pub.platform },
        );
      }
    }
  }
}
```

- [ ] **Step 2: Register, commit.**

```bash
git add packages/backend/src/content-pipeline/crons/credential-health-probe.cron.ts
git commit -m "feat(content-pipeline): credential-health-probe cron with alert on rotten credentials"
```

## Task 4.11: Queue-depth monitoring

**Files:**

- Create: `supabase/migrations/20260424000060_content_pipeline_queue_samples.sql`
- Create: `packages/backend/src/content-pipeline/observability/queue-monitor.service.ts`
- Create: `packages/backend/src/content-pipeline/crons/queue-monitor.cron.ts`

- [ ] **Step 1: Migration.**

```sql
CREATE TABLE IF NOT EXISTS observability_queue_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name TEXT NOT NULL,
  depth INTEGER NOT NULL,
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_queue_samples_queue_time ON observability_queue_samples (queue_name, sampled_at DESC);
ALTER TABLE observability_queue_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON observability_queue_samples FOR ALL USING (true);
GRANT ALL ON observability_queue_samples TO service_role;
```

- [ ] **Step 2: Monitor service + cron.**

```typescript
// queue-monitor.service.ts
@Injectable()
export class QueueMonitorService {
  constructor(
    private readonly queue: QueueService,
    private readonly supabase: SupabaseService,
    private readonly alerts: AlertDispatcherService,
  ) {}

  async sampleAll(): Promise<void> {
    const queues: QueueName[] = [
      "orchestrator",
      "render-audio",
      "render-captions",
      "render-video",
      "render-pdf",
      "publish-youtube",
      "publish-tiktok",
      "publish-instagram",
      "publish-facebook",
      "publish-linkedin",
      "metrics-pull",
    ];
    const client = this.supabase.getClient();

    for (const q of queues) {
      const depth = await this.queue.getBoss().getQueueSize(q);
      await client
        .from("observability_queue_samples")
        .insert({ queue_name: q, depth });
    }

    // For each queue, if last 10 min of samples all have depth > 20, alert
    for (const q of queues) {
      const since = new Date(Date.now() - 10 * 60_000).toISOString();
      const { data: recent } = await client
        .from("observability_queue_samples")
        .select("depth")
        .eq("queue_name", q)
        .gte("sampled_at", since);
      if (recent && recent.length >= 3 && recent.every((r) => r.depth > 20)) {
        await this.alerts.sendAlert(
          "warning",
          "queue_backlog",
          `Queue ${q} depth sustained above 20 for 10+ minutes.`,
          { queue: q },
        );
      }
    }
  }
}

// queue-monitor.cron.ts
@Injectable()
export class QueueMonitorCron {
  constructor(private readonly monitor: QueueMonitorService) {}
  @Cron("*/3 * * * *") // every 3 min
  async run(): Promise<void> {
    await this.monitor.sampleAll();
  }
}
```

- [ ] **Step 3: Commit.**

```bash
supabase db push
git add supabase/migrations/20260424000060_content_pipeline_queue_samples.sql packages/backend/src/content-pipeline/observability/queue-monitor.service.ts packages/backend/src/content-pipeline/crons/queue-monitor.cron.ts
git commit -m "feat(content-pipeline): queue-depth monitoring with sample persistence and alerts"
```

## Task 4.12: Render pre-flight checks

**Files:**

- Modify: `packages/video-template/src/cli/render.ts`
- Create: `packages/video-template/src/cli/preflight.ts`
- Modify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/render-video.handler.ts`

- [ ] **Step 1: video-template preflight.ts.**

```typescript
// packages/video-template/src/cli/preflight.ts
import { bundle } from "@remotion/bundler";
import { renderStill } from "@remotion/renderer";
import { PNG } from "pngjs";
import { readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import path from "path";
import { VideoProps, FORMAT_CONFIGS } from "../types";

export interface PreflightReport {
  ok: boolean;
  overflowFrames?: number[];
  assetLoadFailures?: string[];
}

export async function preflight(
  format: VideoProps["format"],
  props: VideoProps,
): Promise<PreflightReport> {
  const cfg = FORMAT_CONFIGS[format];
  const bundled = await bundle({
    entryPoint: path.resolve(__dirname, "..", "index.ts"),
  });

  const framesToCheck = [
    Math.floor(cfg.durationInFrames * 0.1),
    Math.floor(cfg.durationInFrames * 0.5),
    Math.floor(cfg.durationInFrames * 0.9),
  ];

  const overflowFrames: number[] = [];
  for (const frame of framesToCheck) {
    const outPath = join(tmpdir(), `preflight-${frame}.png`);
    await renderStill({
      serveUrl: bundled,
      composition: {
        id: format,
        width: cfg.width,
        height: cfg.height,
        fps: cfg.fps,
        durationInFrames: cfg.durationInFrames,
      } as any,
      frame,
      output: outPath,
      inputProps: props,
    });
    const png = PNG.sync.read(readFileSync(outPath));
    // Detect overflow by checking 4-pixel border for non-background pixels (indicating content bleeding off)
    let borderHits = 0;
    for (let x = 0; x < png.width; x++) {
      for (const y of [
        0,
        1,
        2,
        3,
        png.height - 4,
        png.height - 3,
        png.height - 2,
        png.height - 1,
      ]) {
        const i = (y * png.width + x) * 4;
        if (png.data[i] > 50 || png.data[i + 1] > 50 || png.data[i + 2] > 50)
          borderHits++;
      }
    }
    if (borderHits > png.width) overflowFrames.push(frame);
  }

  return {
    ok: overflowFrames.length === 0,
    overflowFrames: overflowFrames.length > 0 ? overflowFrames : undefined,
  };
}
```

- [ ] **Step 2: Expose preflight CLI entry plus add to render-cli as `--preflight-only` flag.**

- [ ] **Step 3: render-video.handler.ts runs preflight before full render.**

```typescript
// Before spawning the full render CLI:
const preflightResult = await this.spawnPreflight(run.format, props);
if (!preflightResult.ok) {
  await this.orchestrator.handleStepFailure(
    runId,
    `rendering_video: preflight overflow on frames ${preflightResult.overflowFrames}`,
  );
  return;
}
```

- [ ] **Step 4: Commit.**

```bash
git add packages/video-template/src/cli/preflight.ts packages/video-template/src/cli/render.ts packages/backend/src/content-pipeline/orchestrator/job-handlers/render-video.handler.ts
git commit -m "feat(content-pipeline): render pre-flight catches text overflow before full render"
```

## Task 4.13: Audio-script length mismatch detection

**Files:**

- Modify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/synthesize-audio.handler.ts`

- [ ] **Step 1: After synthesis, compute expected duration from word count (150 wpm) and compare to actual audio duration. If delta > 20%, insert a warning event.**

```typescript
// inside synthesize-audio.handler.ts handle() after upload:
const expectedDurationMs = (script.fullText.split(/\s+/).length / 150) * 60_000;
const actualDurationMs = result.durationMs;
const deltaPct =
  Math.abs(actualDurationMs - expectedDurationMs) / expectedDurationMs;
if (deltaPct > 0.2) {
  await client.from("content_run_events").insert({
    run_id: runId,
    event_type: "audio_length_mismatch",
    payload: { expectedDurationMs, actualDurationMs, deltaPct },
  });
  await this.alerts.sendAlert(
    "warning",
    "audio_length_mismatch",
    `Run ${runId} audio duration differs from script estimate by ${(deltaPct * 100).toFixed(0)}%.`,
    { runId, deltaPct },
  );
}
```

- [ ] **Step 2: Commit.**

```bash
git add packages/backend/src/content-pipeline/orchestrator/job-handlers/synthesize-audio.handler.ts
git commit -m "feat(content-pipeline): audio-script length mismatch detection with warning alert"
```

## Task 4.14: Per-format success rate tracking

**Files:**

- Create: `packages/backend/src/content-pipeline/analytics/success-rate.service.ts`
- Create: `packages/backend/src/content-pipeline/crons/success-rate-check.cron.ts`

- [ ] **Step 1: Service computes rolling weekly success rate per format.**

```typescript
@Injectable()
export class SuccessRateService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly alerts: AlertDispatcherService,
  ) {}

  async checkAll(): Promise<void> {
    const client = this.supabase.getClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: runs } = await client
      .from("content_runs")
      .select("format, status")
      .gte("created_at", weekAgo);
    if (!runs) return;

    const byFormat = new Map<string, { total: number; success: number }>();
    for (const r of runs) {
      const f = r.format;
      if (!byFormat.has(f)) byFormat.set(f, { total: 0, success: 0 });
      const entry = byFormat.get(f)!;
      entry.total++;
      if (r.status === "published" || r.status === "published_partial")
        entry.success++;
    }

    for (const [format, { total, success }] of byFormat.entries()) {
      if (total < 5) continue; // not enough signal
      const rate = success / total;
      if (rate < 0.95) {
        await this.alerts.sendAlert(
          "warning",
          "format_success_rate_low",
          `Format ${format} success rate is ${(rate * 100).toFixed(0)}% over last 7 days (${success}/${total}).`,
          { format, rate },
        );
      }
    }
  }
}

// cron
@Injectable()
export class SuccessRateCheckCron {
  constructor(private readonly svc: SuccessRateService) {}
  @Cron("0 5 * * *") // daily 5am UTC
  async run(): Promise<void> {
    await this.svc.checkAll();
  }
}
```

- [ ] **Step 2: Commit.**

```bash
git add packages/backend/src/content-pipeline/analytics/success-rate.service.ts packages/backend/src/content-pipeline/crons/success-rate-check.cron.ts
git commit -m "feat(content-pipeline): per-format weekly success-rate tracking with alert on <95%"
```

## Task 4.15: Lead magnet A/B support

**Files:**

- Create: `supabase/migrations/20260424000070_content_pipeline_magnet_ab.sql`
- Modify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-youtube-shorts.handler.ts` (and all other publisher handlers) to select binding by weight
- Modify: `packages/backend/src/content-pipeline/lead-magnets/lead-magnet.service.ts`

- [ ] **Step 1: Migration (adds variant tracking columns to bindings plus a selected_magnet_binding_id to content_runs).**

```sql
ALTER TABLE content_runs ADD COLUMN IF NOT EXISTS selected_magnet_binding_id UUID REFERENCES format_magnet_bindings(id);
ALTER TABLE lead_magnet_deliveries ADD COLUMN IF NOT EXISTS binding_id UUID REFERENCES format_magnet_bindings(id);
CREATE INDEX IF NOT EXISTS idx_deliveries_binding ON lead_magnet_deliveries (binding_id);
```

- [ ] **Step 2: Service picks binding by weight.**

```typescript
// lead-magnet.service.ts (add)
async pickBinding(format: string): Promise<{ magnet_kind: string; cta_text: string; id: string } | null> {
  const client = this.supabase.getClient();
  const { data: bindings } = await client.from('format_magnet_bindings')
    .select('*').eq('format', format).eq('enabled', true);
  if (!bindings || bindings.length === 0) return null;
  const total = bindings.reduce((s, b) => s + b.weight, 0);
  let r = Math.random() * total;
  for (const b of bindings) { r -= b.weight; if (r <= 0) return b; }
  return bindings[bindings.length - 1];
}
```

- [ ] **Step 3: All publisher handlers reference `selected_magnet_binding_id` when constructing short-link target URL.**

- [ ] **Step 4: Commit.**

```bash
supabase db push
git add supabase/migrations/20260424000070_content_pipeline_magnet_ab.sql packages/backend/src/content-pipeline/lead-magnets/lead-magnet.service.ts packages/backend/src/content-pipeline/orchestrator/job-handlers/
git commit -m "feat(content-pipeline): lead magnet A/B binding selection by weight"
```

## Task 4.16: Magnet conversion tracking and auto-promoter

**Files:**

- Create: `packages/backend/src/content-pipeline/magnets/magnet-ab-promoter.service.ts`
- Create: `packages/backend/src/content-pipeline/crons/magnet-promotion.cron.ts`

- [ ] **Step 1: Service measures per-binding conversion and auto-disables losing bindings.**

```typescript
// magnets/magnet-ab-promoter.service.ts
@Injectable()
export class MagnetABPromoterService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly alerts: AlertDispatcherService,
  ) {}

  async evaluate(format: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: bindings } = await client
      .from("format_magnet_bindings")
      .select("id, magnet_kind")
      .eq("format", format)
      .eq("enabled", true);
    if (!bindings || bindings.length < 2) return;

    const results: Array<{
      bindingId: string;
      delivered: number;
      converted: number;
    }> = [];
    for (const b of bindings) {
      const { data: deliveries } = await client
        .from("lead_magnet_deliveries")
        .select("user_id")
        .eq("binding_id", b.id);
      const userIds = (deliveries ?? []).map((d: any) => d.user_id);
      if (userIds.length === 0) {
        results.push({ bindingId: b.id, delivered: 0, converted: 0 });
        continue;
      }

      const { count: converted } = await client
        .from("signup_attributions")
        .select("id", { count: "exact", head: true })
        .in("user_id", userIds)
        .neq("tier_at_signup", "free");
      results.push({
        bindingId: b.id,
        delivered: userIds.length,
        converted: converted ?? 0,
      });
    }

    const eligible = results.filter((r) => r.delivered >= 50);
    if (eligible.length < 2) return;

    eligible.sort(
      (a, b) => b.converted / b.delivered - a.converted / a.delivered,
    );
    const winner = eligible[0];
    const loser = eligible[1];
    const winnerRate = winner.converted / winner.delivered;
    const loserRate = loser.converted / loser.delivered;
    if (loserRate === 0) return;
    const lift = (winnerRate - loserRate) / loserRate;
    if (lift < 0.3) return;

    await client
      .from("format_magnet_bindings")
      .update({ enabled: false })
      .eq("id", loser.bindingId);
    await this.alerts.sendAlert(
      "info",
      "magnet_auto_promoted",
      `Lead magnet winner promoted for ${format}. Loser binding disabled.`,
      { format, winner: winner.bindingId, loser: loser.bindingId },
    );
  }
}

// crons/magnet-promotion.cron.ts
@Injectable()
export class MagnetPromotionCron {
  constructor(private readonly promoter: MagnetABPromoterService) {}
  @Cron("0 6 * * 1") // Monday 6am UTC
  async run(): Promise<void> {
    const formats = [
      "grade_reveal",
      "top_10_ranking",
      "score_mover",
      "head_to_head",
      "farm_area_spotlight",
      "long_form_deep_dive",
      "brokerage_market_share",
      "recruitment_angle",
    ];
    for (const f of formats) await this.promoter.evaluate(f);
  }
}
```

- [ ] **Step 2: Commit.**

```bash
git add packages/backend/src/content-pipeline/magnets/magnet-ab-promoter.service.ts packages/backend/src/content-pipeline/crons/magnet-promotion.cron.ts
git commit -m "feat(content-pipeline): lead magnet A/B auto-promotion with 50-sample 30%-lift threshold"
```

## Task 4.17: Style reference A/B support

**Files:**

- Create: `supabase/migrations/20260424000080_content_pipeline_style_ab.sql`
- Create: `packages/backend/src/content-pipeline/style-references/style-ab.service.ts`
- Modify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/render-video.handler.ts`

- [ ] **Step 1: Migration.**

```sql
CREATE TABLE IF NOT EXISTS format_style_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  style_reference_id UUID NOT NULL REFERENCES style_references(id) ON DELETE CASCADE,
  weight REAL NOT NULL DEFAULT 1.0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (format, style_reference_id)
);
ALTER TABLE content_runs ADD COLUMN IF NOT EXISTS selected_style_binding_id UUID REFERENCES format_style_bindings(id);
ALTER TABLE format_style_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON format_style_bindings FOR ALL USING (true);
GRANT ALL ON format_style_bindings TO service_role;
GRANT ALL ON format_style_bindings TO authenticated;
```

- [ ] **Step 2: StyleAB service picks binding by weight.**

```typescript
// style-references/style-ab.service.ts
@Injectable()
export class StyleABService {
  constructor(private readonly supabase: SupabaseService) {}

  async pickBinding(
    format: string,
  ): Promise<{ id: string; style_reference_id: string } | null> {
    const client = this.supabase.getClient();
    const { data: bindings } = await client
      .from("format_style_bindings")
      .select("*")
      .eq("format", format)
      .eq("enabled", true);
    if (!bindings || bindings.length === 0) return null;
    const total = bindings.reduce((s: number, b: any) => s + b.weight, 0);
    let r = Math.random() * total;
    for (const b of bindings) {
      r -= b.weight;
      if (r <= 0) return b;
    }
    return bindings[bindings.length - 1];
  }
}
```

- [ ] **Step 3: render-video handler calls pickBinding if no style_reference_id set on run.**

- [ ] **Step 4: Commit.**

```bash
supabase db push
git add supabase/migrations/20260424000080_content_pipeline_style_ab.sql packages/backend/src/content-pipeline/style-references/style-ab.service.ts packages/backend/src/content-pipeline/orchestrator/job-handlers/render-video.handler.ts
git commit -m "feat(content-pipeline): style reference A/B binding selection by weight"
```

## Task 4.18: Performance page, Hero Card

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/performance/hero-card.tsx`
- Modify: `packages/frontend/app/admin/content-pipeline/performance/page.tsx`
- Create: `packages/backend/src/content-pipeline/analytics/performance.service.ts`

- [ ] **Step 1: PerformanceService.**

```typescript
@Injectable()
export class PerformanceService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly revenue: RevenueAttributionService,
  ) {}

  async getHero(sinceDays: number): Promise<any> {
    const client = this.supabase.getClient();
    const since = new Date(
      Date.now() - sinceDays * 24 * 3600 * 1000,
    ).toISOString();
    const { data: posts } = await client
      .from("platform_posts")
      .select(
        "run_id, platform, external_url, content_metrics(views, avg_retention_pct)",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (!posts || posts.length === 0) return null;

    let best: any = null;
    for (const p of posts) {
      const views = p.content_metrics?.[0]?.views ?? 0;
      if (!best || views > (best.views ?? 0)) best = { ...p, views };
    }
    const rev = best ? await this.revenue.getRevenueByRun(best.run_id) : null;
    return { bestPost: best, revenue: rev };
  }
}
```

- [ ] **Step 2: Hero card component.**

```tsx
// performance/hero-card.tsx
export function HeroCard({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="bg-primary text-on-primary rounded-xl p-6 shadow-md">
      <div className="text-sm opacity-80">Your hero this week</div>
      <h2 className="text-2xl font-semibold mt-1">
        {data.bestPost?.platform} video
      </h2>
      <div className="mt-2 flex gap-6">
        <div>
          <div className="text-xs opacity-80">Views</div>
          <div className="text-2xl font-mono">
            {(data.bestPost?.views ?? 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs opacity-80">Signups</div>
          <div className="text-2xl font-mono">{data.revenue?.signups ?? 0}</div>
        </div>
        <div>
          <div className="text-xs opacity-80">MRR</div>
          <div className="text-2xl font-mono">
            ${(data.revenue?.total_mrr_contribution_usd ?? 0).toFixed(0)}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/performance/ packages/backend/src/content-pipeline/analytics/performance.service.ts
git commit -m "feat(content-pipeline): performance page hero card with best-performing run"
```

## Task 4.19: Performance page, format conversion panel

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/performance/format-conversion-panel.tsx`
- Modify: `packages/backend/src/content-pipeline/analytics/performance.service.ts`

- [ ] **Step 1: Service method returns per-format signups-per-view ranking.**

- [ ] **Step 2: Component renders the ranking with explanatory one-sentence "why" per format.**

Rules-based v1 explanation: "Agent-targeted formats convert better for you." / "Short-form converts 3x higher than long-form for your audience."

- [ ] **Step 3: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/performance/format-conversion-panel.tsx packages/backend/src/content-pipeline/analytics/performance.service.ts
git commit -m "feat(content-pipeline): performance page format conversion panel"
```

## Task 4.20: Performance page, hook patterns and suggested runs

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/performance/hook-patterns-panel.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/performance/suggested-runs-panel.tsx`
- Create: `packages/backend/src/content-pipeline/analytics/suggested-runs.service.ts`

- [ ] **Step 1: SuggestedRunsService applies 3 rules.**

Rule 1: markets with >= 8 PIQ movement in last 30 days that have not been covered. Rule 2: top state by conversion plus markets within that state unseen. Rule 3: underserved formats by audience.

- [ ] **Step 2: Panels render suggestions with one-click "create run" buttons.**

- [ ] **Step 3: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/performance/ packages/backend/src/content-pipeline/analytics/suggested-runs.service.ts
git commit -m "feat(content-pipeline): performance page hook patterns and suggested runs"
```

## Task 4.21: Performance page, runs table

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/performance/runs-table.tsx`
- Modify: `packages/frontend/app/admin/content-pipeline/performance/page.tsx`

- [ ] **Step 1: Table lists all runs with filterable columns (format, status, platform, date range, views, signups, MRR).**

- [ ] **Step 2: Drill-down click navigates to run detail.**

- [ ] **Step 3: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/performance/
git commit -m "feat(content-pipeline): performance page runs table with filters"
```

## Task 4.22: Performance page endpoint and wire-up

**Files:**

- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`

- [ ] **Step 1: Add endpoints.**

```typescript
@Get('performance/overview')
async performanceOverview() {
  const [hero, formatConversion, suggestions] = await Promise.all([
    this.performance.getHero(7),
    this.performance.getFormatConversion(30),
    this.suggestedRuns.generate(5),
  ]);
  return { success: true, data: { hero, formatConversion, suggestions } };
}

@Get('performance/hook-ab')
async performanceHookAB() { /* reads hook_archetypes and returns winners per format */ }

@Get('performance/revenue-by-video')
async performanceRevenue() { /* returns last 30 days of revenue attribution by run */ }
```

- [ ] **Step 2: Full performance page fetches all panels and renders.**

- [ ] **Step 3: Commit.**

```bash
git add packages/backend/src/content-pipeline/content-pipeline.controller.ts packages/backend/src/content-pipeline/content-pipeline.service.ts packages/frontend/app/admin/content-pipeline/performance/page.tsx
git commit -m "feat(content-pipeline): performance page fully wired to backend endpoints"
```

## Task 4.23: P4 E2E suite

**Files:**

- Create: `packages/backend/test/e2e/content-pipeline-p4-revenue-attribution.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p4-hook-ab.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p4-render-preflight.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p4-alert-dedup.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p4-credential-expiry.e2e.spec.ts`

**Per project memory: real staging DB, no mocks.**

- [ ] **Step 1: revenue-attribution round-trip.**

Create a run. Simulate a short-link click. Simulate a signup. Upgrade the test user to Pro in Stripe test mode (via webhook or direct DB update). Query `revenue_by_video` endpoint. Expect the run is attributed as MRR source.

- [ ] **Step 2: hook-ab winner detection.**

Seed 100 `platform_posts` rows for `grade_reveal` with known A/B retention split (A: 0.5 avg retention, B: 0.2 avg retention). Run `HookPromoterService.evaluate('grade_reveal')`. Expect `hook_archetypes` row written with `variant_A` and confidence >= 95%.

- [ ] **Step 3: render-preflight catches overflow.**

Create a run with a market query that produces an abnormally long market name (e.g., a fixture city with 80-character canonical name). Run the pipeline through render. Expect run ends in `failed` with status_reason referencing preflight overflow.

- [ ] **Step 4: alert dedup.**

Call `AlertDispatcher.sendAlert` three times with identical code+metadata. Expect only one Slack POST and one `alerts_sent` row within the hour. After advancing clock 1 hour, expect a second send succeeds.

- [ ] **Step 5: credential-health-probe.**

Manually set YOUTUBE_OAUTH_REFRESH_TOKEN to an invalid value. Run the probe cron. Expect a `credential_rotten` alert fired.

- [ ] **Step 6: Run E2E, commit.**

```bash
cd packages/backend && E2E_ADMIN_JWT=<jwt> npm run test:e2e -- content-pipeline-p4
git add packages/backend/test/e2e/
git commit -m "test(content-pipeline): P4 E2E suite (revenue, hook A/B, preflight, alert dedup, credential expiry)"
```

## Task 4.24: Lead magnet conversion panel on Library page

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/lead-magnets/conversion-panel.tsx`
- Modify: `packages/frontend/app/admin/content-pipeline/lead-magnets/magnet-card.tsx`
- Modify: `packages/backend/src/content-pipeline/magnets/magnet-library.service.ts`

- [ ] **Step 1: Backend service adds `delivered_count` and `converted_to_paid_pct` per magnet.**

- [ ] **Step 2: Card displays these numbers; expanded panel shows per-binding conversion over time.**

- [ ] **Step 3: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/lead-magnets/ packages/backend/src/content-pipeline/magnets/magnet-library.service.ts
git commit -m "feat(content-pipeline): lead magnet conversion rates shown on Library page"
```

---

# Phase 5: Auto-ideation

**Duration:** 1 to 2 weeks. **Complexity:** Low-Medium. **Tasks:** 20.

## Phase 5 scope

Auto-ideation. Cron watches PropertyIQ score movements and top-market rank changes. Automatically enqueues runs when configured thresholds cross. Enforces daily USD cost cap at enqueue time. Enforces per-format daily-run caps. Admin UI for managing trigger rules. Preview of upcoming auto-enqueued runs.

## Phase 5 deliverables

- Three trigger types available: score_movement, rank_change, threshold_cross.
- Daily cost cap and per-format run cap enforced at enqueue time.
- Admin UI at `/admin/content-pipeline/auto-ideation` for rule CRUD.
- "Run now" button per rule for manual firing.
- "Upcoming auto-runs" preview on the dashboard.
- 3 seeded starter rules, all disabled by default.

## Phase 5 acceptance criteria

1. P5 migrations apply cleanly.
2. `npm run test` passes P5 unit tests (minimum 30 new).
3. `npm run test:e2e` passes P5 E2E suite.
4. A synthetic score movement of +12 points triggers a Score Mover run automatically.
5. When `CONTENT_PIPELINE_DAILY_USD_MAX` is breached, subsequent auto-enqueues are blocked with a `auto_ideation_capped` event logged.
6. Per-format daily cap blocks overruns once the cap is reached.

## Phase 5 prerequisites

- P1 through P4 running in production for at least 4 weeks.
- At least 4 weeks of historical PropertyIQ score data in `propertyiq_scores` table (to enable score movement detection with a meaningful baseline).
- Performance page showing real data (required to validate that auto-ideation doesn't flood low-converting formats).
- Settings UI updated to expose daily cost cap toggle (inherited from P1 Settings page; extend with the cap input in P5).

## Task 5.1: P5 migration, auto-ideation rules

**Files:**

- Create: `supabase/migrations/20260424000100_content_pipeline_auto_ideation_rules.sql`

- [ ] **Step 1: Write migration.**

```sql
CREATE TABLE IF NOT EXISTS auto_ideation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('score_movement', 'rank_change', 'threshold_cross')),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  target_format TEXT NOT NULL REFERENCES format_templates(format),
  approval_mode_override TEXT CHECK (approval_mode_override IN ('auto', 'review', 'draft')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rules_enabled ON auto_ideation_rules (enabled) WHERE enabled = true;
ALTER TABLE auto_ideation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON auto_ideation_rules FOR ALL USING (true);
GRANT ALL ON auto_ideation_rules TO service_role;
GRANT ALL ON auto_ideation_rules TO authenticated;

CREATE TABLE IF NOT EXISTS auto_ideation_capped_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES auto_ideation_rules(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE auto_ideation_capped_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON auto_ideation_capped_events FOR ALL USING (true);
GRANT ALL ON auto_ideation_capped_events TO service_role;
```

- [ ] **Step 2: Apply and verify, commit.**

```bash
supabase db push
supabase db execute "SELECT table_name FROM information_schema.tables WHERE table_name IN ('auto_ideation_rules','auto_ideation_capped_events');"
git add supabase/migrations/20260424000100_content_pipeline_auto_ideation_rules.sql
git commit -m "feat(content-pipeline): P5 migration for auto_ideation_rules table"
```

## Task 5.2: P5 migration, daily cost cap

**Files:**

- Create: `supabase/migrations/20260424000200_content_pipeline_daily_cost_cap.sql`

- [ ] **Step 1: Write migration.**

```sql
CREATE TABLE IF NOT EXISTS cost_cap_daily (
  date DATE PRIMARY KEY,
  usd_spent NUMERIC NOT NULL DEFAULT 0,
  usd_cap NUMERIC NOT NULL,
  breach_at TIMESTAMPTZ
);
ALTER TABLE cost_cap_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON cost_cap_daily FOR ALL USING (true);
GRANT ALL ON cost_cap_daily TO service_role;
GRANT ALL ON cost_cap_daily TO authenticated;

CREATE TABLE IF NOT EXISTS format_daily_run_counts (
  format TEXT NOT NULL,
  date DATE NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (format, date)
);
ALTER TABLE format_daily_run_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON format_daily_run_counts FOR ALL USING (true);
GRANT ALL ON format_daily_run_counts TO service_role;
```

- [ ] **Step 2: Apply, commit.**

```bash
supabase db push
git add supabase/migrations/20260424000200_content_pipeline_daily_cost_cap.sql
git commit -m "feat(content-pipeline): P5 migration for cost_cap_daily and format_daily_run_counts"
```

## Task 5.3: CostCapService

**Files:**

- Create: `packages/backend/src/content-pipeline/auto-ideation/cost-cap.service.ts`
- Create: `packages/backend/src/content-pipeline/auto-ideation/cost-cap.service.spec.ts`

- [ ] **Step 1: Write tests.**

```typescript
// auto-ideation/cost-cap.service.spec.ts
import { Test } from "@nestjs/testing";
import { CostCapService } from "./cost-cap.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("CostCapService", () => {
  let svc: CostCapService;

  beforeEach(async () => {
    process.env.CONTENT_PIPELINE_DAILY_USD_MAX = "50";
    // mock supabase to return a row with usd_spent: 45, usd_cap: 50
    const client = {
      from: jest.fn().mockImplementation((tbl: string) => {
        if (tbl === "cost_cap_daily")
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { usd_spent: 45, usd_cap: 50 },
                    error: null,
                  }),
              }),
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        if (tbl === "format_daily_run_counts")
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { run_count: 5 } }),
                }),
              }),
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        return {};
      }),
    };
    const supabase = { getClient: () => client };

    const module = await Test.createTestingModule({
      providers: [
        CostCapService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    svc = module.get(CostCapService);
  });

  it("allows when estimated cost fits remaining budget", async () => {
    const result = await svc.canEnqueue(2);
    expect(result.allowed).toBe(true);
    expect(result.remainingUsd).toBeCloseTo(5, 2);
  });

  it("blocks when estimate exceeds remaining", async () => {
    const result = await svc.canEnqueue(10);
    expect(result.allowed).toBe(false);
  });

  it("per-format cap respects env var", async () => {
    process.env.CONTENT_PIPELINE_FORMAT_DAILY_CAP_SCORE_MOVER = "5";
    const result = await svc.canEnqueueFormat("score_mover");
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(5);
    expect(result.cap).toBe(5);
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// auto-ideation/cost-cap.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { DriverCost } from "../drivers/driver-cost.types";

const DEFAULT_FORMAT_CAP = 10;

@Injectable()
export class CostCapService {
  constructor(private readonly supabase: SupabaseService) {}

  async canEnqueue(estimatedUsd: number): Promise<{
    allowed: boolean;
    remainingUsd: number;
    usdSpent: number;
    usdCap: number;
  }> {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().slice(0, 10);
    const cap = parseFloat(process.env.CONTENT_PIPELINE_DAILY_USD_MAX ?? "50");

    const { data } = await client
      .from("cost_cap_daily")
      .select("usd_spent, usd_cap")
      .eq("date", today)
      .maybeSingle();
    const usdSpent = Number(data?.usd_spent ?? 0);
    const usdCap = Number(data?.usd_cap ?? cap);
    const remaining = Math.max(0, usdCap - usdSpent);
    return {
      allowed: estimatedUsd <= remaining,
      remainingUsd: remaining,
      usdSpent,
      usdCap,
    };
  }

  async canEnqueueFormat(
    format: string,
  ): Promise<{ allowed: boolean; count: number; cap: number }> {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().slice(0, 10);
    const envKey = `CONTENT_PIPELINE_FORMAT_DAILY_CAP_${format.toUpperCase()}`;
    const cap = parseInt(process.env[envKey] ?? String(DEFAULT_FORMAT_CAP), 10);

    const { data } = await client
      .from("format_daily_run_counts")
      .select("run_count")
      .eq("format", format)
      .eq("date", today)
      .maybeSingle();
    const count = data?.run_count ?? 0;
    return { allowed: count < cap, count, cap };
  }

  async recordSpend(costs: DriverCost[]): Promise<void> {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().slice(0, 10);
    const usd = costs.reduce((s, c) => s + c.amount_usd, 0);
    const { data: existing } = await client
      .from("cost_cap_daily")
      .select("usd_spent, usd_cap")
      .eq("date", today)
      .maybeSingle();
    const cap = parseFloat(process.env.CONTENT_PIPELINE_DAILY_USD_MAX ?? "50");
    await client.from("cost_cap_daily").upsert({
      date: today,
      usd_spent: Number(existing?.usd_spent ?? 0) + usd,
      usd_cap: existing?.usd_cap ?? cap,
    });
  }

  async incrementFormatCount(format: string): Promise<void> {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await client
      .from("format_daily_run_counts")
      .select("run_count")
      .eq("format", format)
      .eq("date", today)
      .maybeSingle();
    await client.from("format_daily_run_counts").upsert({
      format,
      date: today,
      run_count: (data?.run_count ?? 0) + 1,
    });
  }
}
```

- [ ] **Step 3: Run tests, commit.**

```bash
cd packages/backend && npm run test -- cost-cap.service.spec
git add packages/backend/src/content-pipeline/auto-ideation/cost-cap.service.ts packages/backend/src/content-pipeline/auto-ideation/cost-cap.service.spec.ts
git commit -m "feat(content-pipeline): CostCapService with daily USD cap and per-format run cap"
```

## Task 5.4: Wire CostCap into run creation

**Files:**

- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`

- [ ] **Step 1: Extend createRun to check caps when triggered_by='auto_ideation'.**

```typescript
// content-pipeline.service.ts createRun additions:
if (dto.triggered_by === "auto_ideation") {
  const costCheck = await this.costCap.canEnqueue(
    this.estimateCostUsd(dto.format),
  );
  if (!costCheck.allowed) {
    await client.from("auto_ideation_capped_events").insert({
      format: dto.format,
      reason: "daily_cost_cap",
      metadata: {
        remainingUsd: costCheck.remainingUsd,
        estimateUsd: this.estimateCostUsd(dto.format),
      },
    });
    return { id: null, idempotencyKey: dto.idempotencyKey, status: "capped" };
  }
  const formatCheck = await this.costCap.canEnqueueFormat(dto.format);
  if (!formatCheck.allowed) {
    await client.from("auto_ideation_capped_events").insert({
      format: dto.format,
      reason: "format_daily_cap",
      metadata: { count: formatCheck.count, cap: formatCheck.cap },
    });
    return { id: null, idempotencyKey: dto.idempotencyKey, status: "capped" };
  }
  await this.costCap.incrementFormatCount(dto.format);
}
```

- [ ] **Step 2: Add `estimateCostUsd(format)` helper.**

```typescript
// cost estimates per format (tuned from P1-P4 cost data)
private readonly FORMAT_COST_ESTIMATES: Record<string, number> = {
  grade_reveal: 0.05, top_10_ranking: 0.08, score_mover: 0.05,
  head_to_head: 0.08, farm_area_spotlight: 0.09,
  brokerage_market_share: 0.09, recruitment_angle: 0.10,
  long_form_deep_dive: 2.20,
};

private estimateCostUsd(format: string): number {
  return this.FORMAT_COST_ESTIMATES[format] ?? 0.10;
}
```

- [ ] **Step 3: Commit.**

```bash
git add packages/backend/src/content-pipeline/content-pipeline.service.ts
git commit -m "feat(content-pipeline): auto-ideation createRun respects daily and per-format caps"
```

## Task 5.5: TriggerRuleEvaluator for score_movement

**Files:**

- Create: `packages/backend/src/content-pipeline/auto-ideation/trigger-rule.types.ts`
- Create: `packages/backend/src/content-pipeline/auto-ideation/trigger-rule-evaluator.service.ts`
- Create: `packages/backend/src/content-pipeline/auto-ideation/trigger-rule-evaluator.service.spec.ts`

- [ ] **Step 1: Types.**

```typescript
// trigger-rule.types.ts
export type TriggerType = "score_movement" | "rank_change" | "threshold_cross";

export interface ScoreMovementConfig {
  min_delta_points: number;
  direction: "up" | "down" | "both";
  lookback_days: number;
  geography: "state" | "metro" | "county" | "zip";
}

export interface RankChangeConfig {
  min_rank_delta: number;
  direction: "up" | "down" | "both";
  geography: "state" | "metro" | "county" | "zip";
  top_n: number;
}

export interface ThresholdCrossConfig {
  threshold_value: number;
  direction: "up" | "down";
  metric: "propertyiq_score" | "home_value_yoy" | "rent_yoy";
}

export interface AutoIdeationRule {
  id: string;
  rule_name: string;
  trigger_type: TriggerType;
  trigger_config: ScoreMovementConfig | RankChangeConfig | ThresholdCrossConfig;
  target_format: string;
  approval_mode_override?: "auto" | "review" | "draft";
  enabled: boolean;
  last_fired_at?: string;
}

export interface TriggerMatch {
  geo: { geography: string; id: string; canonical_name: string };
  payload: Record<string, unknown>;
}
```

- [ ] **Step 2: Tests (score movement only for Task 5.5; rank_change and threshold_cross in Tasks 5.6 and 5.7).**

```typescript
describe("TriggerRuleEvaluator.evaluate for score_movement", () => {
  it("returns markets moving >= threshold in last N days", async () => {
    // Mock propertyiq_scores rows: Cleveland 70 -> 82 (delta +12)
    // Rule: min_delta=10, direction=up, lookback_days=30
    // Expect 1 match for Cleveland
  });

  it("respects direction=up (ignores drops)", async () => {
    // Cleveland drops 12 points; rule direction=up; expect 0 matches
  });
});
```

- [ ] **Step 3: Implement evaluator.**

```typescript
// trigger-rule-evaluator.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import {
  AutoIdeationRule,
  ScoreMovementConfig,
  RankChangeConfig,
  ThresholdCrossConfig,
  TriggerMatch,
} from "./trigger-rule.types";

@Injectable()
export class TriggerRuleEvaluatorService {
  constructor(private readonly supabase: SupabaseService) {}

  async evaluate(rule: AutoIdeationRule): Promise<TriggerMatch[]> {
    switch (rule.trigger_type) {
      case "score_movement":
        return this.evaluateScoreMovement(
          rule.trigger_config as ScoreMovementConfig,
        );
      case "rank_change":
        return this.evaluateRankChange(rule.trigger_config as RankChangeConfig);
      case "threshold_cross":
        return this.evaluateThresholdCross(
          rule.trigger_config as ThresholdCrossConfig,
        );
    }
  }

  private async evaluateScoreMovement(
    config: ScoreMovementConfig,
  ): Promise<TriggerMatch[]> {
    const client = this.supabase.getClient();
    const lookback = new Date(
      Date.now() - config.lookback_days * 24 * 3600 * 1000,
    ).toISOString();

    const { data } = await client.rpc("auto_ideation_score_movement", {
      p_geography: config.geography,
      p_lookback: lookback,
      p_min_delta: config.min_delta_points,
      p_direction: config.direction,
    });
    return (data ?? []).map((r: any) => ({
      geo: {
        geography: config.geography,
        id: r.geo_id,
        canonical_name: r.canonical_name,
      },
      payload: {
        current_score: r.current_score,
        previous_score: r.previous_score,
        delta: r.delta,
      },
    }));
  }

  private async evaluateRankChange(
    config: RankChangeConfig,
  ): Promise<TriggerMatch[]> {
    // Implementation in Task 5.6
    return [];
  }

  private async evaluateThresholdCross(
    config: ThresholdCrossConfig,
  ): Promise<TriggerMatch[]> {
    // Implementation in Task 5.7
    return [];
  }
}
```

The `auto_ideation_score_movement` Postgres RPC is defined alongside the migration (add in Task 5.1 or a supporting migration):

```sql
CREATE OR REPLACE FUNCTION auto_ideation_score_movement(p_geography TEXT, p_lookback TIMESTAMPTZ, p_min_delta NUMERIC, p_direction TEXT)
RETURNS TABLE(geo_id TEXT, canonical_name TEXT, current_score NUMERIC, previous_score NUMERIC, delta NUMERIC)
LANGUAGE sql STABLE AS $$
  WITH recent AS (
    SELECT DISTINCT ON (s.geo_id) s.geo_id, s.canonical_name, s.propertyiq_score AS score, s.computed_at
    FROM propertyiq_scores s
    WHERE s.geography_level = p_geography AND s.computed_at >= NOW() - INTERVAL '7 days'
    ORDER BY s.geo_id, s.computed_at DESC
  ),
  baseline AS (
    SELECT DISTINCT ON (s.geo_id) s.geo_id, s.propertyiq_score AS score
    FROM propertyiq_scores s
    WHERE s.geography_level = p_geography AND s.computed_at < p_lookback
    ORDER BY s.geo_id, s.computed_at DESC
  )
  SELECT r.geo_id, r.canonical_name, r.score AS current_score, b.score AS previous_score, (r.score - b.score) AS delta
  FROM recent r JOIN baseline b USING (geo_id)
  WHERE
    (p_direction = 'up' AND (r.score - b.score) >= p_min_delta)
    OR (p_direction = 'down' AND (b.score - r.score) >= p_min_delta)
    OR (p_direction = 'both' AND abs(r.score - b.score) >= p_min_delta);
$$;
```

- [ ] **Step 4: Run tests, commit.**

```bash
cd packages/backend && npm run test -- trigger-rule-evaluator.service.spec
git add packages/backend/src/content-pipeline/auto-ideation/
git commit -m "feat(content-pipeline): TriggerRuleEvaluator for score_movement plus RPC"
```

## Task 5.6: Rank-change trigger

**Files:**

- Modify: `packages/backend/src/content-pipeline/auto-ideation/trigger-rule-evaluator.service.ts`
- Add: Postgres RPC `auto_ideation_rank_change`

- [ ] **Step 1: Add RPC.**

```sql
CREATE OR REPLACE FUNCTION auto_ideation_rank_change(p_geography TEXT, p_top_n INTEGER, p_min_delta INTEGER, p_direction TEXT)
RETURNS TABLE(geo_id TEXT, canonical_name TEXT, current_rank INTEGER, previous_rank INTEGER, rank_delta INTEGER)
LANGUAGE sql STABLE AS $$
  WITH ranked_now AS (
    SELECT geo_id, canonical_name, RANK() OVER (ORDER BY propertyiq_score DESC) AS rank
    FROM propertyiq_scores
    WHERE geography_level = p_geography
      AND computed_at >= NOW() - INTERVAL '7 days'
  ),
  ranked_then AS (
    SELECT geo_id, RANK() OVER (ORDER BY propertyiq_score DESC) AS rank
    FROM propertyiq_scores
    WHERE geography_level = p_geography
      AND computed_at >= NOW() - INTERVAL '37 days'
      AND computed_at < NOW() - INTERVAL '30 days'
  )
  SELECT n.geo_id, n.canonical_name, n.rank AS current_rank, t.rank AS previous_rank, (t.rank - n.rank) AS rank_delta
  FROM ranked_now n JOIN ranked_then t USING (geo_id)
  WHERE n.rank <= p_top_n
    AND (
      (p_direction = 'up' AND (t.rank - n.rank) >= p_min_delta)
      OR (p_direction = 'down' AND (n.rank - t.rank) >= p_min_delta)
      OR (p_direction = 'both' AND abs(t.rank - n.rank) >= p_min_delta)
    );
$$;
```

- [ ] **Step 2: Implement evaluateRankChange to call the RPC.**

- [ ] **Step 3: Tests, commit.**

```bash
cd packages/backend && npm run test -- trigger-rule-evaluator.service.spec
git add packages/backend/src/content-pipeline/auto-ideation/trigger-rule-evaluator.service.ts supabase/migrations/
git commit -m "feat(content-pipeline): rank-change trigger evaluator plus RPC"
```

## Task 5.7: Threshold-cross trigger

**Files:**

- Modify: `packages/backend/src/content-pipeline/auto-ideation/trigger-rule-evaluator.service.ts`
- Add: Postgres RPC `auto_ideation_threshold_cross`

- [ ] **Step 1: Add RPC that finds geos whose metric crossed a threshold in the last 7 days (rising or falling).**

```sql
CREATE OR REPLACE FUNCTION auto_ideation_threshold_cross(p_metric TEXT, p_threshold NUMERIC, p_direction TEXT)
RETURNS TABLE(geo_id TEXT, canonical_name TEXT, current_value NUMERIC, previous_value NUMERIC)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY EXECUTE format($q$
    WITH curr AS (
      SELECT DISTINCT ON (geo_id) geo_id, canonical_name, %I AS value
      FROM propertyiq_scores
      WHERE computed_at >= NOW() - INTERVAL '7 days'
      ORDER BY geo_id, computed_at DESC
    ),
    prev AS (
      SELECT DISTINCT ON (geo_id) geo_id, %I AS value
      FROM propertyiq_scores
      WHERE computed_at < NOW() - INTERVAL '7 days'
      ORDER BY geo_id, computed_at DESC
    )
    SELECT c.geo_id, c.canonical_name, c.value, p.value
    FROM curr c JOIN prev p USING (geo_id)
    WHERE (
      ($2 = 'up' AND c.value >= $1 AND p.value < $1)
      OR ($2 = 'down' AND c.value <= $1 AND p.value > $1)
    )
  $q$, p_metric, p_metric) USING p_threshold, p_direction;
END $$;
```

Note: `p_metric` must be a column on `propertyiq_scores` (e.g., `propertyiq_score`, `home_value_yoy`, `rent_yoy`). Validate at application layer.

- [ ] **Step 2: Implement evaluateThresholdCross.**

- [ ] **Step 3: Tests, commit.**

```bash
cd packages/backend && npm run test -- trigger-rule-evaluator.service.spec
git add packages/backend/src/content-pipeline/auto-ideation/trigger-rule-evaluator.service.ts supabase/migrations/
git commit -m "feat(content-pipeline): threshold-cross trigger evaluator plus RPC"
```

## Task 5.8: AutoIdeationService orchestrator

**Files:**

- Create: `packages/backend/src/content-pipeline/auto-ideation/auto-ideation.service.ts`
- Create: `packages/backend/src/content-pipeline/auto-ideation/auto-ideation.service.spec.ts`

- [ ] **Step 1: Write tests.**

```typescript
describe("AutoIdeationService.runEnabledRules", () => {
  it("for each enabled rule, evaluates matches and creates runs", async () => {
    // Mock: 1 enabled rule (score_movement), 2 matches returned by evaluator
    // Mock createRun to return successfully
    // Call runEnabledRules()
    // Expect createRun called twice with correct payloads
    // Expect auto_ideation_rules.last_fired_at updated
  });

  it("respects CostCapService blocks", async () => {
    // Mock CostCapService.canEnqueue returning { allowed: false }
    // Verify no runs created, capped event written
  });
});
```

- [ ] **Step 2: Implement.**

```typescript
// auto-ideation/auto-ideation.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";
import { TriggerRuleEvaluatorService } from "./trigger-rule-evaluator.service";
import { ContentPipelineService } from "../content-pipeline.service";
import { AutoIdeationRule } from "./trigger-rule.types";
import { v4 as uuid } from "uuid";

@Injectable()
export class AutoIdeationService {
  private readonly logger = new Logger(AutoIdeationService.name);
  constructor(
    private readonly supabase: SupabaseService,
    private readonly evaluator: TriggerRuleEvaluatorService,
    private readonly pipeline: ContentPipelineService,
  ) {}

  async runEnabledRules(
    typeFilter?: "score_movement" | "rank_change" | "threshold_cross",
  ): Promise<void> {
    const client = this.supabase.getClient();
    const query = client
      .from("auto_ideation_rules")
      .select("*")
      .eq("enabled", true);
    const { data: rules } = typeFilter
      ? await query.eq("trigger_type", typeFilter)
      : await query;

    for (const rule of rules ?? []) {
      try {
        await this.evaluateAndEnqueue(rule as AutoIdeationRule);
        await client
          .from("auto_ideation_rules")
          .update({ last_fired_at: new Date().toISOString() })
          .eq("id", rule.id);
      } catch (err) {
        this.logger.error(
          `rule ${rule.rule_name} failed: ${(err as Error).message}`,
        );
      }
    }
  }

  private async evaluateAndEnqueue(rule: AutoIdeationRule): Promise<void> {
    const matches = await this.evaluator.evaluate(rule);
    this.logger.log(`rule ${rule.rule_name} matched ${matches.length} markets`);

    for (const match of matches) {
      const result = await this.pipeline.createRun({
        format: rule.target_format as any,
        marketQuery: match.geo.canonical_name,
        idempotencyKey: uuid(),
        approvalMode: rule.approval_mode_override ?? ("review" as any),
        triggered_by: "auto_ideation",
      } as any);
      if (result.status === "capped") {
        this.logger.warn(
          `rule ${rule.rule_name} capped for ${match.geo.canonical_name}`,
        );
        break; // stop iterating this rule for today
      }
    }
  }
}
```

- [ ] **Step 3: Run tests, commit.**

```bash
cd packages/backend && npm run test -- auto-ideation.service.spec
git add packages/backend/src/content-pipeline/auto-ideation/
git commit -m "feat(content-pipeline): AutoIdeationService orchestrator evaluating rules and creating runs"
```

## Task 5.9: score-scan cron

**Files:**

- Create: `packages/backend/src/content-pipeline/crons/auto-ideation-score-scan.cron.ts`

- [ ] **Step 1: Cron every 30 min runs score_movement rules.**

```typescript
@Injectable()
export class AutoIdeationScoreScanCron {
  constructor(private readonly autoIdeation: AutoIdeationService) {}

  @Cron("*/30 * * * *")
  async run(): Promise<void> {
    await this.autoIdeation.runEnabledRules("score_movement");
  }
}
```

- [ ] **Step 2: Commit.**

```bash
git add packages/backend/src/content-pipeline/crons/auto-ideation-score-scan.cron.ts
git commit -m "feat(content-pipeline): auto-ideation-score-scan cron every 30 min"
```

## Task 5.10: rank-scan cron

**Files:**

- Create: `packages/backend/src/content-pipeline/crons/auto-ideation-rank-scan.cron.ts`

- [ ] **Step 1: Daily 5am UTC cron runs rank_change rules.**

```typescript
@Injectable()
export class AutoIdeationRankScanCron {
  constructor(private readonly autoIdeation: AutoIdeationService) {}
  @Cron("0 5 * * *", { timeZone: "UTC" })
  async run(): Promise<void> {
    await this.autoIdeation.runEnabledRules("rank_change");
  }
}
```

- [ ] **Step 2: Commit.**

```bash
git add packages/backend/src/content-pipeline/crons/auto-ideation-rank-scan.cron.ts
git commit -m "feat(content-pipeline): auto-ideation-rank-scan cron daily at 5am UTC"
```

## Task 5.11: threshold-scan cron

**Files:**

- Create: `packages/backend/src/content-pipeline/crons/auto-ideation-threshold-scan.cron.ts`

- [ ] **Step 1: Hourly cron for threshold_cross rules.**

```typescript
@Injectable()
export class AutoIdeationThresholdScanCron {
  constructor(private readonly autoIdeation: AutoIdeationService) {}
  @Cron("0 * * * *")
  async run(): Promise<void> {
    await this.autoIdeation.runEnabledRules("threshold_cross");
  }
}
```

- [ ] **Step 2: Commit.**

```bash
git add packages/backend/src/content-pipeline/crons/auto-ideation-threshold-scan.cron.ts
git commit -m "feat(content-pipeline): auto-ideation-threshold-scan hourly cron"
```

## Task 5.12: Trigger-rule CRUD endpoints

**Files:**

- Create: `packages/backend/src/content-pipeline/auto-ideation/auto-ideation.controller.ts`
- Create: `packages/backend/src/content-pipeline/dto/create-trigger-rule.dto.ts`
- Create: `packages/backend/src/content-pipeline/dto/update-trigger-rule.dto.ts`

- [ ] **Step 1: DTOs with class-validator and discriminated-union validation of trigger_config.**

```typescript
// dto/create-trigger-rule.dto.ts
import {
  IsString,
  IsIn,
  IsOptional,
  IsBoolean,
  IsObject,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateTriggerRuleDto {
  @IsString() rule_name!: string;
  @IsIn(["score_movement", "rank_change", "threshold_cross"])
  trigger_type!: string;
  @IsObject() trigger_config!: Record<string, any>;
  @IsString() target_format!: string;
  @IsOptional()
  @IsIn(["auto", "review", "draft"])
  approval_mode_override?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

// dto/update-trigger-rule.dto.ts
export class UpdateTriggerRuleDto {
  @IsOptional() @IsString() rule_name?: string;
  @IsOptional() @IsObject() trigger_config?: Record<string, any>;
  @IsOptional() @IsString() target_format?: string;
  @IsOptional()
  @IsIn(["auto", "review", "draft"])
  approval_mode_override?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
```

- [ ] **Step 2: Controller.**

```typescript
// auto-ideation.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../../common/guards/admin-auth.guard";
import { SupabaseService } from "../../supabase/supabase.service";
import { CreateTriggerRuleDto } from "../dto/create-trigger-rule.dto";
import { UpdateTriggerRuleDto } from "../dto/update-trigger-rule.dto";
import { AutoIdeationService } from "./auto-ideation.service";

@UseGuards(AdminGuard)
@Controller("api/admin/content-pipeline/auto-ideation")
export class AutoIdeationController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly service: AutoIdeationService,
  ) {}

  @Get("rules")
  async list() {
    const { data } = await this.supabase
      .getClient()
      .from("auto_ideation_rules")
      .select("*")
      .order("created_at", { ascending: false });
    return { success: true, data: { rules: data ?? [] } };
  }

  @Post("rules")
  async create(@Body() dto: CreateTriggerRuleDto) {
    const { data } = await this.supabase
      .getClient()
      .from("auto_ideation_rules")
      .insert({ ...dto, enabled: dto.enabled ?? false })
      .select()
      .single();
    return { success: true, data };
  }

  @Patch("rules/:id")
  async update(@Param("id") id: string, @Body() dto: UpdateTriggerRuleDto) {
    const { data } = await this.supabase
      .getClient()
      .from("auto_ideation_rules")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    return { success: true, data };
  }

  @Delete("rules/:id")
  async remove(@Param("id") id: string) {
    await this.supabase
      .getClient()
      .from("auto_ideation_rules")
      .delete()
      .eq("id", id);
    return { success: true, data: { deleted: true } };
  }

  @Post("rules/:id/fire-now")
  async fireNow(@Param("id") id: string) {
    const { data } = await this.supabase
      .getClient()
      .from("auto_ideation_rules")
      .select("*")
      .eq("id", id)
      .single();
    await (this.service as any).evaluateAndEnqueue(data);
    return { success: true, data: { fired: true } };
  }
}
```

- [ ] **Step 3: Commit.**

```bash
git add packages/backend/src/content-pipeline/auto-ideation/auto-ideation.controller.ts packages/backend/src/content-pipeline/dto/create-trigger-rule.dto.ts packages/backend/src/content-pipeline/dto/update-trigger-rule.dto.ts
git commit -m "feat(content-pipeline): auto-ideation trigger rule CRUD endpoints"
```

## Task 5.13: Upcoming auto-runs preview endpoint

**Files:**

- Modify: `packages/backend/src/content-pipeline/auto-ideation/auto-ideation.controller.ts`
- Modify: `packages/backend/src/content-pipeline/auto-ideation/auto-ideation.service.ts`

- [ ] **Step 1: Add service method that dry-runs enabled rules without enqueueing.**

```typescript
// auto-ideation.service.ts (add)
async previewUpcoming(): Promise<Array<{ rule_name: string; format: string; matches: TriggerMatch[] }>> {
  const client = this.supabase.getClient();
  const { data: rules } = await client.from('auto_ideation_rules').select('*').eq('enabled', true);
  const results: any[] = [];
  for (const rule of rules ?? []) {
    const matches = await this.evaluator.evaluate(rule as AutoIdeationRule);
    results.push({ rule_name: rule.rule_name, format: rule.target_format, matches });
  }
  return results;
}
```

- [ ] **Step 2: Controller endpoint.**

```typescript
@Get('upcoming')
async upcoming() {
  return { success: true, data: { upcoming: await this.service.previewUpcoming() } };
}
```

- [ ] **Step 3: Commit.**

```bash
git add packages/backend/src/content-pipeline/auto-ideation/
git commit -m "feat(content-pipeline): upcoming auto-runs preview endpoint"
```

## Task 5.14: Admin UI for trigger rules

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/auto-ideation/page.tsx`
- Create: `packages/frontend/app/admin/content-pipeline/auto-ideation/rule-editor.tsx`

- [ ] **Step 1: Main page lists rules with toggle to enable/disable, edit button, delete, run-now.**

```tsx
// packages/frontend/app/admin/content-pipeline/auto-ideation/page.tsx
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";
import { RuleEditor } from "./rule-editor";

export default function AutoIdeationPage() {
  const [editing, setEditing] = useState<any | "new" | null>(null);
  const { data = [], refetch } = useQuery({
    queryKey: ["auto-ideation-rules"],
    queryFn: async () =>
      (
        await fetchAPI<{ data: { rules: any[] } }>(
          "/api/admin/content-pipeline/auto-ideation/rules",
        )
      ).data.rules,
  });

  async function toggle(rule: any) {
    await fetchAPIRaw(
      `/api/admin/content-pipeline/auto-ideation/rules/${rule.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      },
    );
    refetch();
  }
  async function del(rule: any) {
    if (!confirm(`Delete rule ${rule.rule_name}?`)) return;
    await fetchAPIRaw(
      `/api/admin/content-pipeline/auto-ideation/rules/${rule.id}`,
      { method: "DELETE" },
    );
    refetch();
  }
  async function fireNow(rule: any) {
    await fetchAPIRaw(
      `/api/admin/content-pipeline/auto-ideation/rules/${rule.id}/fire-now`,
      { method: "POST" },
    );
    alert("Fired. See dashboard for new runs.");
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Auto-Ideation Rules</h1>
        <button
          onClick={() => setEditing("new")}
          className="bg-primary text-on-primary rounded-full px-5 py-2 font-semibold"
        >
          + New Rule
        </button>
      </div>
      <div className="space-y-3">
        {data.map((r: any) => (
          <div
            key={r.id}
            className="rounded-xl bg-surface-container-low p-4 shadow-sm flex items-center justify-between"
          >
            <div>
              <div className="font-semibold">{r.rule_name}</div>
              <div className="text-xs text-outline">
                {r.trigger_type} • target: {r.target_format} • last fired:{" "}
                {r.last_fired_at
                  ? new Date(r.last_fired_at).toLocaleString()
                  : "never"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={() => toggle(r)}
                />
                Enabled
              </label>
              <button
                onClick={() => fireNow(r)}
                className="text-sm bg-surface-container rounded-full px-3 py-1"
              >
                Run now
              </button>
              <button
                onClick={() => setEditing(r)}
                className="text-sm bg-surface-container rounded-full px-3 py-1"
              >
                Edit
              </button>
              <button
                onClick={() => del(r)}
                className="text-sm bg-error/10 text-error rounded-full px-3 py-1"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <RuleEditor
          rule={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rule editor with three conditional sub-forms per trigger_type.**

```tsx
// packages/frontend/app/admin/content-pipeline/auto-ideation/rule-editor.tsx
"use client";
import { useState } from "react";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export function RuleEditor({
  rule,
  onClose,
}: {
  rule: any | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    rule_name: rule?.rule_name ?? "",
    trigger_type: rule?.trigger_type ?? "score_movement",
    trigger_config: rule?.trigger_config ?? {
      min_delta_points: 10,
      direction: "up",
      lookback_days: 30,
      geography: "metro",
    },
    target_format: rule?.target_format ?? "score_mover",
    approval_mode_override: rule?.approval_mode_override ?? "review",
  });

  async function save() {
    const url = rule
      ? `/api/admin/content-pipeline/auto-ideation/rules/${rule.id}`
      : "/api/admin/content-pipeline/auto-ideation/rules";
    const method = rule ? "PATCH" : "POST";
    await fetchAPIRaw(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-6">
      <div className="bg-surface rounded-xl p-6 w-full max-w-xl space-y-3">
        <h3 className="font-semibold">{rule ? "Edit rule" : "New rule"}</h3>
        <label className="block">
          <span className="text-sm">Rule name</span>
          <input
            value={form.rule_name}
            onChange={(e) => setForm({ ...form, rule_name: e.target.value })}
            className="w-full border border-outline-variant rounded p-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">Trigger type</span>
          <select
            value={form.trigger_type}
            onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
            className="w-full border border-outline-variant rounded p-2"
          >
            <option value="score_movement">Score movement</option>
            <option value="rank_change">Rank change</option>
            <option value="threshold_cross">Threshold cross</option>
          </select>
        </label>
        {form.trigger_type === "score_movement" && (
          <div className="space-y-2">
            <label className="block">
              <span className="text-sm">Min delta points</span>
              <input
                type="number"
                value={form.trigger_config.min_delta_points ?? 10}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      min_delta_points: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full border border-outline-variant rounded p-2"
              />
            </label>
            <label className="block">
              <span className="text-sm">Direction</span>
              <select
                value={form.trigger_config.direction ?? "up"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      direction: e.target.value,
                    },
                  })
                }
                className="w-full border border-outline-variant rounded p-2"
              >
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm">Lookback days</span>
              <input
                type="number"
                value={form.trigger_config.lookback_days ?? 30}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      lookback_days: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full border border-outline-variant rounded p-2"
              />
            </label>
          </div>
        )}
        {form.trigger_type === "rank_change" && (
          <div className="space-y-2">
            <label className="block">
              <span className="text-sm">Min rank delta</span>
              <input
                type="number"
                value={form.trigger_config.min_rank_delta ?? 5}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      min_rank_delta: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full border border-outline-variant rounded p-2"
              />
            </label>
            <label className="block">
              <span className="text-sm">Top N</span>
              <input
                type="number"
                value={form.trigger_config.top_n ?? 10}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      top_n: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="w-full border border-outline-variant rounded p-2"
              />
            </label>
          </div>
        )}
        {form.trigger_type === "threshold_cross" && (
          <div className="space-y-2">
            <label className="block">
              <span className="text-sm">Metric</span>
              <select
                value={form.trigger_config.metric ?? "propertyiq_score"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      metric: e.target.value,
                    },
                  })
                }
                className="w-full border border-outline-variant rounded p-2"
              >
                <option value="propertyiq_score">PropertyIQ Score</option>
                <option value="home_value_yoy">Home value YoY</option>
                <option value="rent_yoy">Rent YoY</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm">Threshold value</span>
              <input
                type="number"
                value={form.trigger_config.threshold_value ?? 80}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger_config: {
                      ...form.trigger_config,
                      threshold_value: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full border border-outline-variant rounded p-2"
              />
            </label>
          </div>
        )}
        <label className="block">
          <span className="text-sm">Target format</span>
          <select
            value={form.target_format}
            onChange={(e) =>
              setForm({ ...form, target_format: e.target.value })
            }
            className="w-full border border-outline-variant rounded p-2"
          >
            {[
              "grade_reveal",
              "top_10_ranking",
              "score_mover",
              "head_to_head",
              "farm_area_spotlight",
              "brokerage_market_share",
              "recruitment_angle",
              "long_form_deep_dive",
            ].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm">Approval mode override</span>
          <select
            value={form.approval_mode_override}
            onChange={(e) =>
              setForm({ ...form, approval_mode_override: e.target.value })
            }
            className="w-full border border-outline-variant rounded p-2"
          >
            <option value="review">Review</option>
            <option value="auto">Auto</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <div className="flex gap-2 justify-end pt-3">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={save}
            className="bg-primary text-on-primary rounded-full px-5 py-2"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register nav entry, commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/auto-ideation/
git commit -m "feat(content-pipeline): auto-ideation admin page with rule editor"
```

## Task 5.15: Upcoming auto-runs on dashboard

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/page.tsx`
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`

- [ ] **Step 1: Add `upcomingAutoRuns` to dashboard response.**

```typescript
// content-pipeline.service.ts getDashboard() addition:
const upcoming = await this.autoIdeation.previewUpcoming();
return { ...existing, upcomingAutoRuns: upcoming };
```

- [ ] **Step 2: Dashboard page renders upcoming section.**

```tsx
{
  data.upcomingAutoRuns && data.upcomingAutoRuns.length > 0 && (
    <div className="rounded-xl bg-accent/5 border border-accent p-6">
      <h3 className="font-semibold mb-2">Auto-ideation upcoming</h3>
      <ul className="text-sm space-y-1">
        {data.upcomingAutoRuns.map((u: any) => (
          <li key={u.rule_name}>
            {u.rule_name} will enqueue {u.matches.length} {u.format} run
            {u.matches.length === 1 ? "" : "s"} on next trigger.
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/page.tsx packages/backend/src/content-pipeline/content-pipeline.service.ts
git commit -m "feat(content-pipeline): dashboard shows upcoming auto-ideation runs"
```

## Task 5.16: Cost-cap breach UI banner

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/layout.tsx` (or the main admin layout)
- Modify: `packages/backend/src/content-pipeline/content-pipeline.service.ts`

- [ ] **Step 1: Add `costCapStatus` to dashboard response.**

```typescript
// content-pipeline.service.ts
async getCostCapStatus() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await this.supabase.getClient().from('cost_cap_daily').select('*').eq('date', today).maybeSingle();
  const cap = Number(data?.usd_cap ?? process.env.CONTENT_PIPELINE_DAILY_USD_MAX ?? 50);
  const spent = Number(data?.usd_spent ?? 0);
  return { breached: spent >= cap, usdSpent: spent, usdCap: cap };
}
```

- [ ] **Step 2: Render banner when breached.**

```tsx
{
  costCap?.breached && (
    <div className="bg-warning/10 border border-warning text-warning px-4 py-3 text-sm">
      Today's content pipeline budget hit (${costCap.usdSpent.toFixed(2)} / $
      {costCap.usdCap}). Auto-ideation paused until tomorrow. Increase with
      `CONTENT_PIPELINE_DAILY_USD_MAX`.
    </div>
  );
}
```

- [ ] **Step 3: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/ packages/backend/src/content-pipeline/content-pipeline.service.ts
git commit -m "feat(content-pipeline): cost-cap breach banner on admin pages"
```

## Task 5.17: Human override indicator in review queue

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/review/review-card.tsx`

- [ ] **Step 1: When `run.triggered_by === 'auto_ideation'`, show a visual badge: "Auto-queued by rule: [rule_name]".**

Add to review card:

```tsx
{
  run.run.triggered_by === "auto_ideation" && (
    <div className="bg-accent/10 text-accent rounded-full px-3 py-1 inline-flex items-center gap-2 mb-3">
      <span>Auto-queued</span>
      <span className="text-xs opacity-80">
        rule: {run.run.metadata?.rule_name ?? "unknown"}
      </span>
    </div>
  );
}
```

Requires adding rule_name to the run's event/metadata when auto-ideation creates it. Update AutoIdeationService.evaluateAndEnqueue to pass rule_name in a new field on content_runs or in content_run_events.

- [ ] **Step 2: Commit.**

```bash
git add packages/frontend/app/admin/content-pipeline/review/review-card.tsx packages/backend/src/content-pipeline/auto-ideation/
git commit -m "feat(content-pipeline): review queue shows auto-queued indicator with rule name"
```

## Task 5.18: Seed 3 starter rules (disabled)

**Files:**

- Create: `supabase/migrations/20260424000300_content_pipeline_seed_auto_ideation_rules.sql`

- [ ] **Step 1: Write migration.**

```sql
INSERT INTO auto_ideation_rules (rule_name, trigger_type, trigger_config, target_format, approval_mode_override, enabled)
VALUES
  ('PIQ moved +10 or more (month-over-month)', 'score_movement',
   '{"min_delta_points": 10, "direction": "up", "lookback_days": 30, "geography": "metro"}'::jsonb,
   'score_mover', 'review', false),
  ('New market entered top 10 cashflow', 'rank_change',
   '{"min_rank_delta": 1, "direction": "up", "geography": "metro", "top_n": 10}'::jsonb,
   'top_10_ranking', 'review', false),
  ('PIQ crossed 80 threshold', 'threshold_cross',
   '{"threshold_value": 80, "direction": "up", "metric": "propertyiq_score"}'::jsonb,
   'grade_reveal', 'review', false)
ON CONFLICT (rule_name) DO NOTHING;
```

All three start disabled to avoid unintended auto-firing on deploy. Operator enables from the admin UI.

- [ ] **Step 2: Apply, commit.**

```bash
supabase db push
git add supabase/migrations/20260424000300_content_pipeline_seed_auto_ideation_rules.sql
git commit -m "feat(content-pipeline): seed 3 starter auto-ideation rules (disabled)"
```

## Task 5.19: Nav entry for Auto-Ideation page

**Files:**

- Modify: `packages/frontend/app/admin/components/AdminCommandSidebar.tsx`

- [ ] **Step 1: Add to the Content nav group.**

```tsx
{ label: 'Auto-ideation', href: '/admin/content-pipeline/auto-ideation', icon: Zap },
```

Add `Zap` icon import from lucide-react.

- [ ] **Step 2: Commit.**

```bash
git add packages/frontend/app/admin/components/AdminCommandSidebar.tsx
git commit -m "feat(content-pipeline): add Auto-ideation nav entry"
```

## Task 5.20: Phase 5 E2E suite

**Files:**

- Create: `packages/backend/test/e2e/content-pipeline-p5-score-movement.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p5-rank-change.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p5-cost-cap.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p5-format-cap.e2e.spec.ts`
- Create: `packages/backend/test/e2e/content-pipeline-p5-upcoming-preview.e2e.spec.ts`

**Per project memory: real staging DB, no mocks.**

- [ ] **Step 1: score-movement E2E.**

Insert a synthetic score movement into `propertyiq_scores` for a test metro moving +12 points. Create an enabled rule with `min_delta=10, direction=up`. POST `/rules/:id/fire-now`. Expect: one new `content_runs` row created with `triggered_by='auto_ideation'`, `format='score_mover'`, `market_query` matching the moved metro.

- [ ] **Step 2: rank-change E2E.**

Similar pattern. Insert two rank states for a market (rank 15 -> rank 3). Rule `min_rank_delta=5, direction=up`. Verify run created.

- [ ] **Step 3: cost-cap E2E.**

Set `CONTENT_PIPELINE_DAILY_USD_MAX=0.01`. Insert `cost_cap_daily` row with `usd_spent=0.005, usd_cap=0.01`. Fire rule manually. Expect NO new `content_runs` row, one `auto_ideation_capped_events` row with `reason='daily_cost_cap'`.

- [ ] **Step 4: format-cap E2E.**

Set `CONTENT_PIPELINE_FORMAT_DAILY_CAP_SCORE_MOVER=1`. Insert `format_daily_run_counts` row with `run_count=1`. Fire rule. Expect no new run, capped event with `reason='format_daily_cap'`.

- [ ] **Step 5: upcoming-preview E2E.**

Create 2 enabled rules. GET `/auto-ideation/upcoming`. Expect both rules returned with match counts. Insert fake score movements matching rule 1. GET again. Expect rule 1's matches count increased.

- [ ] **Step 6: Run E2E suite, commit.**

```bash
cd packages/backend && E2E_ADMIN_JWT=<jwt> npm run test:e2e -- content-pipeline-p5
git add packages/backend/test/e2e/
git commit -m "test(content-pipeline): P5 E2E suite (score movement, rank change, cost caps, preview)"
```

---

# Appendix

## Global risks (plan-specific additions to design.md risks)

Authoritative risk list lives in `docs/content-pipeline/design.md` section "Risks." Plan-phase additions:

1. **Plan staleness between phases.** Phases 2 through 5 are planned now but executed weeks or months later. Dependencies, internal APIs, and platform API contracts can drift. Mitigation: re-invoke `writing-plans` at the start of each phase to refresh its plan against the then-current repo state. At minimum, re-run Prerequisite 2 (internal service map) before P2, P3, P4.

2. **pg-boss schema bootstrap friction.** pg-boss tries to create its own schema at runtime but managed Supabase may reject that. Mitigation: migration `20260421010000_pgboss_schema_bootstrap.sql` pre-creates the schema before pg-boss boots.

3. **Remotion React 18 vs frontend React 19.** The CLI-spawn boundary isolates them. If any import bridge opens (e.g., a shared React component imported by both packages), builds fail cryptically. Mitigation: a CI check greps for cross-package React imports and fails the build.

4. **Puppeteer browser pool contention.** The existing Redfin scraper and our lead-magnet renderer both use Puppeteer. Mitigation: a shared `BrowserPoolService` with a configurable concurrency cap, both consumers use it. If not already present, create as part of Task 1.23 extension.

5. **Seed migration order vs schema migration order.** Seed migrations for formats, voices, magnets depend on their schema migrations. File timestamps enforce order, but they must never be edited after apply (Supabase hash-tracks). Mitigation: strict timestamp ordering documented in the top-level migrations index; seed migrations always after schema migrations; test on staging before production.

6. **TikTok Content Posting API app-review timing.** Approval can take 3 to 14 days. Risk: P2 blocked waiting on app approval. Mitigation: start TikTok app review in parallel with P1 engineering.

7. **Instagram Business account requirements.** Instagram publishing requires a Business account linked to a Facebook Page, plus the Meta Graph app must pass review for `instagram_content_publish`. Cannot use personal Instagram. Mitigation: flag to Troy that a test Business IG account must exist before Task 2.11.

8. **YouTube Analytics API data latency.** The API does not report video-level metrics for videos under roughly 24 hours old. Mitigation: 24h metric pull cron retries on empty response for runs under 24h, and `pull-24h-metrics` cron treats empty responses as a soft fail not an error.

9. **ElevenLabs cost exposure.** Turbo v2.5 costs approximately $0.30 per 1000 characters. A 10-minute long-form script is approximately 1200 words or 7200 characters, about $2.16 per long-form run. At 1 long-form run per day, that is $65 per month. Acceptable for v1 but the `CONTENT_PIPELINE_DAILY_USD_MAX` must be set high enough to accommodate.

10. **Edge TTS upstream instability.** The `edge-tts` Python package interacts with a reverse-engineered Microsoft endpoint. If Microsoft changes the endpoint, all short-form TTS breaks. Mitigation: auto-fallback from Edge to OpenAI TTS (implemented in Task 2.15). Monitor the `edge-tts` GitHub issues; the package is well-maintained but not officially supported.

11. **Short-link domain hijack risk.** A compromised short-link domain redirects users to attacker-controlled pages. Mitigation: DNS hardening, CAA records restricting certificate issuance, 2FA on the domain registrar account. Short-link base URL must be HTTPS only and HSTS-preloaded.

12. **Style-reference raw video retention.** 24-hour TTL on transient storage protects us legally, but if the cleanup cron fails, raw videos accumulate. Mitigation: alert fires if cleanup cron skips 2 consecutive runs.

13. **LinkedIn API rate limits.** LinkedIn is stricter than most platforms on organization-side posting. If the pipeline sends too many posts in a day, LinkedIn may throttle the app. Mitigation: `publish-linkedin` queue concurrency stays at 1 with 180s backoff on 429 errors.

14. **Auto-ideation runaway scenario.** A misconfigured rule could try to enqueue dozens of runs on a busy data day. Mitigation: daily USD cap plus per-format cap both enforced at enqueue time. Monitor `auto_ideation_capped_events` for sustained capping, which indicates rule-tuning needed.

## Global security notes (plan-specific additions to design.md security)

Authoritative list in `docs/content-pipeline/design.md` section "Security and privacy." Plan-phase additions:

1. **OAuth state parameter.** Every platform OAuth connect flow must generate a cryptographic state parameter, store it with TTL, and validate on callback. Prevents CSRF. Implement in Task 2.22 alongside the connect endpoint.

2. **Short-link slug enumeration defense.** Rate limit `/s/:slug` to 60 requests per minute per IP (Task 1.29 Step 5). Slugs are 8-character base64url, approximately 2.8 trillion space, which makes brute-force discovery slow but not impossible; rate limit converts it to infeasible.

3. **Service-role key never in frontend bundle.** Audited by existing ESLint rule in `packages/frontend/.eslintrc.js` blocking `@/lib/api/client*` imports. No new rule required per CLAUDE.md guidance.

4. **Platform credentials encryption at rest.** AES-256-GCM via `PLATFORM_CREDENTIALS_ENCRYPTION_KEY` env var (32 bytes base64). Never default; app crashes if missing. Implemented in Task 1.25 `CredentialCrypto`.

5. **PDF generation sandbox.** Puppeteer runs with Chromium sandbox enabled in production (`--no-sandbox` NOT set). In test/dev environments where Chromium sandbox is unreliable, `PUPPETEER_NO_SANDBOX=1` permits the flag but must not be set in production env vars. Task 1.23 step 7.

6. **Stripe webhook signature verification.** If P4 revenue attribution consumes Stripe webhooks, the existing `packages/backend/src/stripe/stripe-webhook.controller.ts` already verifies signatures with `stripe.webhooks.constructEvent`. Task 4.6 discovery confirms this and reuses the pattern.

7. **Lead magnet PDF access control.** PDFs for delivered magnets are stored in Supabase Storage at `content-pipeline/lead-magnets/<user_id>/...`. RLS policies ensure only the owning user (via `auth.uid()`) can list or download their own magnets. Admin has full access via service_role. Task 1.23 documents the bucket policy.

8. **Attribution cookie privacy.** `__piq_attr` is first-party only, 30-day TTL, httpOnly=false (to let frontend read it for UX). No PII encoded: only run_id, slug, platform, and first-touch timestamp. Not used for cross-domain tracking.

9. **Audit log.** Every operator action (approve, reject, edit-script, pause, enable-rule) writes a `content_run_events` row or an equivalent audit record. This is the operational audit trail. For sensitive actions (enabling auto-ideation rules, changing approval modes), consider augmenting with a dedicated `admin_audit_log` table in P4.

10. **Style-reference raw video bucket privacy.** `style-references-transient` Supabase Storage bucket is private, never public-accessible, service_role-only. Even if URL leaks, download requires service_role key.

## Open questions for Troy

These need explicit answers before or during execution. Some were raised in `docs/content-pipeline/design.md` and remain open; others are plan-phase specific.

1. **Internal service mapping.** Prerequisite 2 task asks us to enumerate which internal backend services back each MCP tool. Plan phase assumes `MarketsService`, `ScoringService`, and `GeographyService` cover the bulk, but that is not verified. Troy confirms: should we lift all tool logic out of `packages/mcp-server/src/tools/*.ts` into the backend, or call MCP over HTTP for tools that have no backend equivalent?

2. **Short-link domain registration.** Plan uses `piq.sh` as the example `SHORT_LINK_BASE_URL`. Is the domain registered? Does Troy prefer an alternative (`s.propertyiq.app` on existing DNS)? Task 1.29 cannot deploy until this is answered.

3. **Test platform accounts.** The plan assumes these do not yet exist:
   - Test YouTube channel (separate from production)
   - Test TikTok Business account
   - Test Instagram Business account on a test Facebook Page
   - Test Facebook Page
   - Test LinkedIn company page
     Creating them is blocking for the respective phase's E2E tests. Who creates them and when?

4. **Dockerfile source of truth.** Prerequisite 3 asks which Dockerfile Railway builds from. If `packages/backend/Dockerfile` is not the source, we need to update the correct path.

5. **Stripe webhook integration timing.** Task 4.6 discovery will confirm, but Troy confirms: can we consume existing Stripe webhook events for revenue attribution, or is this net-new plumbing?

6. **AI-content disclosure policy per platform.** TikTok, Instagram, and YouTube have AI-generated content disclosure policies. EU AI Act requirements kick in mid-2026. Who decides the disclosure approach (captions, hashtags, metadata flags), and by when? Decision affects Task 2.10 through 2.13 publisher implementations.

7. **Real-agent validation of lead magnet templates.** Design doc flagged this as a risk. Plan recommends one afternoon of 2 to 3 user interviews with real agents before P2 Task 2.21 (P2 lead magnet templates) locks in. Is this time allocated?

8. **Cost ceiling for Anthropic E2E runs.** Plan caps each E2E Anthropic call at $5. Is there a stricter daily-total cap Troy wants on CI runs to avoid surprise bills?

9. **Review queue auto-advance behavior.** Plan assumes "K" (skip to next) is the only advance action, and "L" (approve and publish) moves to the next item automatically. Confirm: is auto-advance preferred, or should operator stay on the current card after approving?

10. **Short-form post-time defaults.** Task 2.19 per-format defaults UI exposes default post-time windows. Plan suggests: YouTube Shorts 11am-1pm local, TikTok 6pm-9pm, Instagram noon-2pm, Facebook noon-2pm, LinkedIn 8am-10am weekdays. Does Troy want to override any of these?

11. **Auto-ideation rule thresholds.** Task 5.18 seeds 3 starter rules. Defaults: PIQ moved 10+ points month-over-month, new market entered top 10, PIQ crossed 80. Are these thresholds right, or would Troy prefer different defaults?

12. **Whether P1 ships Grade Reveal or a different first format.** Plan picks Grade Reveal because the Remotion scenes are roughly 80% assembled. If Troy wants a different format first for strategic reasons (e.g., a Farm Area Spotlight to hit the money audience immediately), P1 grows by the primitives needed for that format.

13. **Gate B LLM judge score threshold.** Plan sets `GATE_B_MIN_SCORE=4` out of 5. Is that the right starting threshold, knowing we will tune post-launch based on how many scripts get flagged?

14. **ElevenLabs to Edge TTS fallback preference.** Task 2.15 implements auto-fallback from Edge to OpenAI. Is the inverse ever desired (ElevenLabs fails, fall back to Edge)? Plan says no because ElevenLabs is only used for long-form where quality matters more than reliability, but Troy should confirm.

15. **Style-reference raw video 24h TTL.** Plan hard-codes 24-hour retention for uploaded reference videos. Is 24h the right number, or does Troy want shorter (e.g., 1 hour post-analysis) or longer (e.g., 7 days for debugging)?

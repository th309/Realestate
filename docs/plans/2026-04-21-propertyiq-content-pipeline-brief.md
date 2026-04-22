# PropertyIQ Content Pipeline: Implementation Planning Brief

## Your task

Before writing any code, produce a detailed implementation plan for the faceless content automation system described below. Output the plan as `docs/content-pipeline/implementation-plan.md` in this repo. Do not implement yet. After I review the plan and give approval, we will execute it in phases.

## First, explore this repo

Before writing the plan, inspect:

1. `package.json` files across the monorepo to confirm current framework and dependency versions.
2. Existing admin UI patterns in the Next.js app: routing conventions, auth, layout, component library, state management.
3. Existing API patterns in the NestJS app: module structure, services, DTOs, guards, pipes, error handling.
4. How we currently call the MCP server at `https://mcp.propertyiq.app/mcp` from code (if at all).
5. Supabase schema: existing tables, RLS patterns, migration tooling.
6. Any existing job queue infrastructure (BullMQ, Graphile Worker, Supabase Queues, etc.).
7. Design system: brand tokens, shadcn components, typography.
8. CI/CD, Railway deployment config, env var management.

Your plan must match these existing patterns. Do not propose parallel abstractions where one already exists.

## The product

PropertyIQ generates data-driven real estate content (market scores, rankings, trends, comparisons). We are automating the publishing of that content as faceless video across four vertical platforms (YouTube Shorts, TikTok, Instagram Reels, Facebook Reels) and one horizontal platform (YouTube long-form).

Operator (me) triggers runs from the PropertyIQ admin UI. Backend fetches live data from the MCP server, generates a platform-specific script, synthesizes voice, renders video in Remotion, and distributes per the approval mode selected for that run.

## Five content formats (v1)

| Format | Length | Aspect | Data source |
|---|---|---|---|
| Grade Reveal | 30 sec | 9:16 | `get_market_snapshot`, `get_propertyiq_score` |
| Top 10 Ranking | 60 sec | 9:16 | `top_cashflow_markets`, `get_top_markets` |
| Score Mover | 30 sec | 9:16 | `get_trending_markets` |
| Head-to-Head | 60 sec | 9:16 | `compare_markets_for_content` |
| Long-Form Deep Dive | 5 to 12 min | 16:9 | `generate_market_narrative`, `brokerage_market_coverage_report` |

Always use city or market names; let `search_markets` resolve internal geography IDs. Never call MCP tools with raw IDs directly.

## Architecture directives

- Workflow UI lives in the existing Next.js admin pages. Do not create a separate app.
- Backend runs as endpoints in the existing NestJS API. Do not create a new service.
- Video rendering uses Remotion, server-side on Railway.
- All multi-step work runs as async jobs with tracked status (queued, fetching_data, scripting, rendering_voice, rendering_video, ready_for_review, publishing, published, failed). Operator watches live status in the admin UI.
- Render outputs stored in Supabase Storage (or S3 if already in use).
- Remotion templates are composable. Build shared primitives first (`<DataCard>`, `<RankingRow>`, `<MarketMap>`, `<ScoreBar>`, `<TrendArrow>`, `<BrandFrame>`) and assemble each of the 5 formats from them. Do not write 5 monolithic templates.

## TTS provider abstraction (important)

Build a pluggable TTS interface. V1 ships with three implementations:

1. **Microsoft Edge TTS** — default, free, unlimited. Integrate via the `edge-tts` package (Node or Python sidecar, whichever fits the stack). Default voice: `en-US-AndrewMultilingualNeural`. Expose voice choice in the admin UI.
2. **ElevenLabs** — premium option. Turbo v2.5 model. Activated when `ELEVENLABS_API_KEY` is set.
3. **OpenAI TTS** — alternative option. Model `tts-1-hd`. Activated when `OPENAI_API_KEY` is set.

Operator selects the provider per run in the admin UI. Default is Edge TTS. Log per-run TTS cost (even if zero) for future reporting.

## Approval modes (all three required)

Per-run selection, also configurable as per-format defaults:

1. **Fully auto.** Render, caption, post to all selected platforms immediately or on schedule. No human step.
2. **Review queue.** Render stops. Operator reviews video, captions, copy, thumbnail. Clicks Approve and Publish.
3. **Draft only.** Render. Push to each platform as a draft (YouTube private, TikTok draft, Instagram container, Facebook unpublished post). Operator finalizes on the platform itself.

Default for first 30 days of operation: Review queue. After that, operator toggles per-format defaults.

## Platform publishers

Build a `PlatformPublisher` interface with four implementations:

1. **YouTube Data API v3** — Shorts and long-form uploads, thumbnails, scheduling, captions (`.srt`).
2. **TikTok Content Posting API** — direct-post and draft modes.
3. **Instagram Graph API** — Reels via Business or Creator account.
4. **Facebook Graph API** — Reels on Pages.

**Credentials status in this repo: mixed.** Some platforms are already configured, others are not. Detect which are set via env vars. Skip missing platforms gracefully with a clear UI indicator ("TikTok: not configured, click to set up"). Include setup documentation in `docs/content-pipeline/platform-setup/{platform}.md` for each platform covering OAuth flow, required scopes, app review notes, and curl-level test calls.

## LLM for script generation

Use Claude via the Anthropic API by default. Model: whatever Sonnet tier is current (check `@anthropic-ai/sdk` docs during exploration). Allow override via env var `SCRIPT_LLM_MODEL`.

Prompts are template-per-format, stored in `packages/content-pipeline/prompts/`. A shared system prompt enforces brand voice:

- Never use em dashes.
- PropertyIQ Score is the only score. Do not reference InvestorEdge, HomeReady, or Market Health Index.
- Confident, data-driven, non-hypey tone. No "crushing it" or "game-changer" language.
- Always cite a specific data point in the hook.
- First 2 seconds must hook (short-form only).

## Captions

Burn-in captions required for all short-form. Generate timestamps with Whisper (OpenAI API) against the synthesized audio, render as Remotion text layers styled to brand. For long-form, also output a `.srt` file for YouTube upload (do not burn in).

## Thumbnails

Remotion template outputs 1280x720 PNG thumbnails using brand tokens. One per video. Editable in the review queue before publish.

## Analytics loopback

Pull metrics from each platform at 24h, 7d, 30d intervals post-publish. Store in Supabase. Admin UI shows a per-run performance panel and a per-format leaderboard (best-performing by views, retention, follow conversion).

## Auto-ideation (Phase 5, design only)

Cron watches PropertyIQ score movements and top-market rank changes. Triggers content runs automatically when thresholds cross (example: any market moving more than 10 points month-over-month triggers a Score Mover run). Plan the event schema and trigger rules, but do not build it in v1.

## Brand tokens

- Primary: `#3949AB`
- Dark: `#1A237E`
- Accent green: `#00C853`
- Dark surface: `#1A1A2E`
- Typography: match the existing PropertyIQ web font stack.

## What the plan document must contain

Your `docs/content-pipeline/implementation-plan.md` must include:

1. **Executive summary.** Half a page. What is being built, how it fits the existing stack, total estimated complexity.
2. **Architecture diagram** in Mermaid. Services, queues, storage, external APIs, data flow.
3. **Module and file structure.** Every new file and directory, matching existing monorepo conventions.
4. **Database schema.** Supabase tables with columns, types, indexes, RLS policies. Include at minimum: `content_runs`, `content_assets`, `platform_posts`, `content_metrics`, `format_templates`, `tts_voices`, `approval_mode_defaults`. Add others as needed.
5. **API endpoints.** Every admin-facing and internal endpoint. Method, path, request body, response body, auth requirements.
6. **Admin UI pages.** Routes, what each page displays, interaction flows. Cover: dashboard, create-run wizard, review queue, run detail, published runs, analytics, platform credentials, format defaults.
7. **Job queue design.** Queue names, job types, full state machine (including error and retry paths), backoff policy, idempotency approach.
8. **Remotion template structure.** Shared primitives list. Component tree per format. Data prop shape per format.
9. **TTS provider interface** plus the three concrete implementations. Method signatures, error handling, cost tracking.
10. **Platform publisher interface** plus four concrete implementations. Credential detection, rate limits, retry behavior, draft vs direct-post differences per platform.
11. **Environment variables.** Full list with required/optional flag, purpose, example value format.
12. **Third-party dependencies.** Packages to install with versions. Note cost implications (ElevenLabs, Anthropic, OpenAI Whisper usage).
13. **Supabase migrations.** SQL migration files in order. Include RLS.
14. **Phase breakdown.** Five phases, each with scope, deliverables, acceptance criteria, rough complexity rating:
    - **P1.** Scaffolding plus Grade Reveal end-to-end with Edge TTS and manual upload. Admin UI shows create-run and review-queue pages for this one format only.
    - **P2.** Remaining three short-form formats plus all four platform publishers. Approval modes fully functional.
    - **P3.** Long-form Deep Dive format plus captions plus thumbnails (including thumbnail editor in review queue).
    - **P4.** Analytics loopback, performance panels, format leaderboard, approval-mode defaults polish.
    - **P5.** Auto-ideation cron and trigger rules (design already in plan, now built).
15. **Testing strategy.** Unit, integration, e2e. What to mock (platform APIs in tests), what to hit real (MCP server in staging).
16. **Risks and open questions.** Explicit list of what I need to confirm or decide before or during execution.
17. **Security and privacy notes.** Credential handling, Supabase RLS approach, PII considerations (there should be almost none since we deal with public market data, but confirm).

## Constraints and non-goals

- No em dashes anywhere in code, comments, docs, UI copy, or generated content. Use commas, colons, periods, or parentheses.
- PropertyIQ Score is the only score. No InvestorEdge, HomeReady, or Market Health Index references.
- Never call MCP geography endpoints with raw IDs. Always search by name first.
- Do not write feature code in this pass. Plan only. Exploration code (reading files, running `--dry-run` commands to inspect tools) is fine.
- Do not propose new hosting or infrastructure outside the existing stack (Railway + Supabase).
- Keep the TTS, LLM, and platform publisher interfaces strict. Providers must swap without touching orchestration.
- Do not add authentication to the admin UI beyond what already exists. Reuse the current admin guard.

## When you are done

1. Write the plan to `docs/content-pipeline/implementation-plan.md`.
2. Include a changelog block at the top of the file with today's date and your version.
3. At the end of the plan file, include an "Open questions for Troy" section with anything you hit during exploration that needs my input.
4. Reply in chat with: a three-paragraph summary of the plan, the total number of new files you estimate, and the top three risks you flagged.
5. Wait for my approval before writing any feature code.

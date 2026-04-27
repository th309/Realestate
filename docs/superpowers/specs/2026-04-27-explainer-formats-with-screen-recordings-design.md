# Explainer Formats (Screen-Recording Backed) — Design

**Status:** Approved (2026-04-27)

## Goal

Add “PropertyIQ explainer videos” as **first-class automated** content-pipeline formats, where each explainer format renders a **screen recording** (base layer) with PropertyIQ overlays (text/branding), plus optional voiceover audio and caption timing.

The operator can use:

- **Per-format default clip** (recommended baseline)
- **Per-run override clip** (for updated product UI captures, A/B variants, etc.)

## Non-goals / scope boundaries

- No new pipeline stages beyond existing `render-video` and `render-thumbnail`.
- No changes outside:
  - `packages/backend/src/content-pipeline/**`
  - `packages/video-template/**`
  - and (if necessary for tests/build) only directly-related files.
- No attempt to recreate the explainer “shot list” editing workflow (Premiere/Descript). This is automated render only.

## Background / source doc

Explainer concepts and VO scripts originate from `docs/content-pipeline/propertyiq_explainer_videos.md`.

## High-level architecture

1. Operator creates a run with an explainer `format` and market context (if needed).
2. Script generation produces VO text (prompt per explainer format).
3. TTS synthesizes audio (`audioUrl`) and (when available) word timings (`captionWords`) which drive captions.
4. Render step invokes `@propertyiq/video-template` CLI (Remotion) with JSON props:
   - `format`
   - `audioUrl` (optional)
   - `captionWords` (optional)
   - `screenRecordUrl` (+ optional trim window)
5. Remotion composition uses `<Video src={screenRecordUrl} />` as the base, then overlays:
   - brand bumper/outro
   - headline cards / text beats
   - captions overlay (optional)

## Data model / contracts

### New formats (backend + video-template)

Add new format keys (exact set is intentionally small and maps 1:1 to the explainer doc):

- `explainer_what_is_propertyiq_60`
- `explainer_mcp_demo_90`
- `explainer_listing_prep_75`
- `explainer_investor_score_markets_75`
- `explainer_site_walkthrough_150`

These must be added consistently to:

- Backend `ContentFormat` union (`packages/backend/src/content-pipeline/types.ts`)
- Video-template `FormatKey` union and `FORMAT_CONFIGS` (`packages/video-template/src/types.ts`)
- Backend format duration mirror `FORMAT_DURATIONS_IN_FRAMES` (`packages/backend/src/content-pipeline/format-durations.ts`)
- Backend DTO allow-list (`packages/backend/src/content-pipeline/dto/create-run.dto.ts`)

### Explainer props shape (video-template)

Extend the **single-market** video props schema to support screen recording playback:

- `screenRecordUrl: string` (required for explainer formats)
- `screenRecordTrim?: { startMs: number; endMs: number }` (optional)

Notes:

- We keep this in the single-market branch because explainer videos are not ranking-shaped.
- If an explainer format does not need a market, we still pass a dummy `resolvedMarket` for schema compatibility (or we widen schema in a later iteration). In this iteration, prefer minimal change by keeping `resolvedMarket` required for all single-market formats.

### Defaults vs overrides

We need a place to store per-format default clip URL and default trim window. Two acceptable storage options:

**Option A (recommended for speed):** DB-backed defaults
- Table: `content_pipeline_format_defaults`
- Keyed by `format`
- Fields: `default_screen_record_url`, `default_trim_start_ms`, `default_trim_end_ms`, `updated_at`

**Option B (code config):** constants map in backend
- `FORMAT_SCREEN_RECORD_DEFAULTS: Partial<Record<ContentFormat, ...>>`

This project already uses DB for many admin-managed values; DB-backed defaults keep clip updates out of deploys. Use Option A unless it forces schema changes out of scope.

Per-run override lives in `formatOptions` (existing DTO plumbing) as:
- `formatOptions.explainer.screenRecordUrl` (+ optional trim)

Resolution rule:

1. If run has override → use it
2. Else if defaults exist → use default
3. Else → fail fast at render step with a clear error (no silent fallback)

## Rendering behavior (video-template)

Add a new layout, e.g. `ExplainerLayout`, that:

- Renders screen record `<Video>` full-bleed
- Adds a subtle dark scrim/vignette for legibility
- Supports “Apple keynote” text beat overlays (from explainer doc tone)
- Reuses existing primitives where possible (BrandBumper/BrandOutroCard/CornerBug/HookHeadline etc.)

## Security / RMF notes

- Validate `screenRecordUrl` as a URL in the renderer props schema (Zod) to prevent arbitrary filesystem paths.
- If clips are hosted in Supabase Storage, prefer signed URLs or bucket rules appropriate for internal tooling (admin-only). Do not expose service keys to the client.
- Fail fast if required env vars are missing (no secret defaults).

## Testing strategy (minimal)

- Backend:
  - Unit tests for format allow-list / duration map coverage (existing patterns)
  - Render handler test that explainer formats include `screenRecordUrl` in props passed to renderer
- Video-template:
  - Zod schema tests: explainer format requires `screenRecordUrl`
  - Smoke render test is optional; focus on typecheck + jest

## Acceptance criteria

- Operator can create a run using one of the explainer formats.
- Render step succeeds when a default or override screen recording URL is present.
- Render step fails with clear error if no screen recording is available.
- `npm run build:backend` and `npm run build:cli -w @propertyiq/video-template` pass.
- `npm test -w backend -- content-pipeline` and `npm test -w @propertyiq/video-template` pass.


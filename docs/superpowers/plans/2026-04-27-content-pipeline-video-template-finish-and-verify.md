# Content Pipeline + Video Template Finish & Verify — Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish and verify the in-flight `content-pipeline` + `@propertyiq/video-template` work so the NestJS pipeline can generate scripts, synthesize audio (with caption timing), render Remotion video/thumbnail via CLI, and publish, with unit tests + typechecks proving correctness.

**Architecture:** The backend `ContentPipelineModule` orchestrates run state transitions and queue workers (pg-boss) that call handler classes. Handlers depend on stable driver interfaces (`ScriptGenerator`, `TTSDriver`, `VideoRenderer`, publishers). Rendering is executed out-of-process via the `@propertyiq/video-template` CLI (`dist/cli/render-cli.js`) which parses props JSON and calls `renderVideo()`. Ranking formats additionally rely on word-level caption timing flowing from TTS (native word boundaries or Whisper) into the Remotion ranking layout timing math.

**Tech Stack:** NestJS 11, TypeScript, Jest, pg-boss workers, Anthropic SDK (script), Edge TTS/Azure/OpenAI (voice), Remotion (renderer), Node workspaces.

---

## Scope boundaries (do not expand)

Only touch code that is directly part of the current change-set:

- **Backend content pipeline**: `packages/backend/src/content-pipeline/**`
  - DI wiring: `content-pipeline.module.ts`
  - Orchestrator: `orchestrator/*` (state machine, queue, handlers, script repair)
  - Drivers: `drivers/*` (Anthropic script gen, TTS drivers, Remotion CLI renderer, publishers)
  - Gates: `gates/*` (brand voice linting, voice rules)
  - Ranking: `ranking/*` (resolver, queries, display metadata, prompts)
- **Video template package**: `packages/video-template/**`
  - Layouts/primitives/types used by CLI render path
- **Scripts** (only if they are part of the current change-set): `scripts/dev-start.sh`, `scripts/run-events.sh`

Explicit non-goals:

- No new product features, no new endpoints beyond what already exists in `content-pipeline`.
- No refactors outside these directories.
- No changes to the frontend web app unless a backend contract mismatch forces it (stop and re-plan if that happens).

---

## Integration points to re-check (high risk seams)

### Backend DI + interface tokens

- `SCRIPT_GENERATOR` token → bound to `AnthropicScriptGenerator` (`drivers/script-generator.interface.ts`, `drivers/anthropic-script-generator.ts`, `content-pipeline.module.ts`)
- `VIDEO_RENDERER` token → bound to `RemotionCLIRenderer` (`drivers/video-renderer.interface.ts`, `drivers/remotion-cli-renderer.ts`, `content-pipeline.module.ts`)
- `CAPTION_TIMER` token → bound to `OpenAIWhisperTimer` (`drivers/caption-timer.interface.ts`, `drivers/openai-whisper-timer.ts`, `content-pipeline.module.ts`)
- `PLATFORM_PUBLISHERS` token → factory list of publishers (`drivers/platform-publisher.interface.ts`, `drivers/*-publisher.ts`, `content-pipeline.module.ts`)
- Worker subscription bootstrap: `HandlersBootstrapService.onModuleInit()` must map every orchestrator status/queue to the correct handler (and must not silently drop statuses).

### Orchestrator state machine ↔ handlers ↔ queues

- Status progression: `orchestrator/pipeline-state.ts` and `orchestrator/run-orchestrator.service.ts`
- Queue routing: `STATE_QUEUE_MAP` in `run-orchestrator.service.ts`
- Worker subscriptions: `orchestrator/handlers-bootstrap.service.ts`
- Special-case logic: ranking formats force captions timing step regardless of `CAPTIONS_ENABLED` (see `pipeline-state.ts`).

### TTS + caption timing chain (ranking requires this)

- `drivers/tts-driver.interface.ts` emits optional `wordTimings` for native word boundaries.
- `orchestrator/job-handlers/synthesize-audio.handler.ts` (plus `synthesize-audio-chain.ts`) must:
  - pick driver chain in intended priority order (primary + fallbacks)
  - persist `captions_timings` asset when native/shadow timings exist
  - leave timings absent only when Whisper transcription is intended downstream
- `drivers/edge-tts-driver.ts` must stay safe on Windows length limits / timeouts.

### Remotion renderer ↔ video-template CLI contract

- Backend spawns: `drivers/remotion-cli-renderer.ts` uses `require.resolve('@propertyiq/video-template/dist/cli/render-cli.js')` and sets subprocess `cwd` to the package root so Remotion’s browser cache is found.
- CLI contract: `packages/video-template/src/cli/render-cli.ts` requires:
  - `--format <format>`
  - `--props-json <path>`
  - `--output <path>`
  - reads JSON from `propsJson`, injects `{ format: opts.format }`, calls `renderVideo({ props, outputPath })`, and prints final JSON line.

### Ranking timing in template (captionWords → reveal frames)

- Layout: `packages/video-template/src/layouts/Top10Layout.tsx`
- Timing math: `packages/video-template/src/layouts/top10-timing.ts` (`computeRankingTiming()`)
- Verify the backend emits `captionWords` in the expected shape (word/startMs/endMs) and that “Number N” anchoring is reliable.

---

## Hermeneutic circle checkpoints (explicit “stop and re-evaluate whole system”)

- **Checkpoint HC-0 (before edits):** Confirm which subsystems are actually in play by re-reading `packages/backend/src/content-pipeline/content-pipeline.module.ts` and `packages/video-template/package.json` and ensuring the DI + CLI integration is intentional.
- **Checkpoint HC-1 (after any backend change):** Re-run backend typecheck/build so Nest DI wiring, symbols, and imports are validated as a whole.
- **Checkpoint HC-2 (after any video-template change):** Re-run video-template TypeScript build and jest tests so CLI output contract stays intact.
- **Checkpoint HC-3 (before “done”):** Run the minimal verification checklist end-to-end and only then consider the work finished.

---

## Task 1: Freeze scope + capture a single “source of truth” checklist

**Files:**
- Verify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`
- Verify: `packages/backend/src/content-pipeline/orchestrator/handlers-bootstrap.service.ts`
- Verify: `packages/backend/src/content-pipeline/orchestrator/pipeline-state.ts`
- Verify: `packages/backend/src/content-pipeline/orchestrator/run-orchestrator.service.ts`
- Verify: `packages/backend/src/content-pipeline/drivers/remotion-cli-renderer.ts`
- Verify: `packages/video-template/src/cli/render-cli.ts`

- [ ] **Step 1: Write down the “expected pipeline contract” (no code yet)**
  - Expected statuses and queues (from `STATE_QUEUE_MAP` + `HandlersBootstrapService`)
  - Expected driver bindings (from `content-pipeline.module.ts`)
  - Expected CLI flags + output JSON line format (from `render-cli.ts`)

- [ ] **Step 2: Hermeneutic checkpoint HC-0**
  - If anything looks accidental (e.g., multiple competing render entrypoints, or missing status in switch), stop and fix plan before changing code.

---

## Task 2: Validate NestJS DI wiring and handler coverage

**Files:**
- Verify/Modify: `packages/backend/src/content-pipeline/content-pipeline.module.ts`
- Verify/Modify: `packages/backend/src/content-pipeline/orchestrator/handlers-bootstrap.service.ts`
- Verify/Modify: `packages/backend/src/content-pipeline/orchestrator/run-orchestrator.service.ts`
- Verify/Modify: `packages/backend/src/content-pipeline/orchestrator/pipeline-state.ts`
- Test: `packages/backend/src/content-pipeline/orchestrator/pipeline-state.spec.ts`

- [ ] **Step 1: Ensure every non-terminal status has exactly one executable path**
  - `nextStateOnSuccess()` must only return statuses that are subscribed by workers (or intentionally terminal/manual).
  - `HandlersBootstrapService` must handle every `orchestrator` queue status it can receive (`fetching_data`, `scripting`, `verifying_data`, `linting_voice`, `publishing`).

- [ ] **Step 2: Add/adjust a unit test that proves the mapping**

```ts
// In pipeline-state.spec.ts (pattern)
// Assert: ranking formats always transition rendering_voice -> timing_captions
expect(nextStateOnSuccess('rendering_voice', 'auto', 'top_10_ranking')).toBe('timing_captions');
// Assert: non-ranking formats respect CAPTIONS_ENABLED or default path
```

- [ ] **Step 3: Hermeneutic checkpoint HC-1**
  - Run backend typecheck/build (see verification checklist) and ensure there are no new compilation/DI issues.

---

## Task 3: Verify ranking resolver API + DTO validation remains strict

**Files:**
- Verify: `packages/backend/src/content-pipeline/ranking/ranking-resolver.controller.ts`
- Verify: `packages/backend/src/content-pipeline/ranking/dto/resolve-ranking.dto.ts`
- Test: `packages/backend/src/content-pipeline/ranking/ranking-resolver.controller.spec.ts`

- [ ] **Step 1: Confirm AdminGuard is applied and DTO validation is enforced**
  - Controller is `@UseGuards(AdminGuard)` and uses `@Body()` DTO.

- [ ] **Step 2: Ensure controller response shape matches frontend convention**
  - It should be `{ success: true, data: result }` (already present; don’t change unless broken).

- [ ] **Step 3: Run the controller spec**
  - This should prove the endpoint wiring and response shape.

---

## Task 4: Verify TTS fallback + native caption timing persistence

**Files:**
- Verify/Modify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/synthesize-audio.handler.ts`
- Verify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/synthesize-audio-chain.ts`
- Verify: `packages/backend/src/content-pipeline/drivers/tts-driver.interface.ts`
- Verify: `packages/backend/src/content-pipeline/drivers/edge-tts-driver.ts`
- Test: `packages/backend/src/content-pipeline/orchestrator/job-handlers/synthesize-audio.handler.spec.ts` (if present) or add targeted unit test nearest existing patterns

- [ ] **Step 1: Confirm fallback chain behavior is observable**
  - When falling back, `tts_fallback` event is written to `content_run_events`.

- [ ] **Step 2: Confirm captions timing persistence rules**
  - If `wordTimings` exists (Edge native) → write `content_assets(kind='captions_timings')`.
  - If Azure synthesized audio (no native boundaries) → attempt Edge shadow capture → write timings if obtained.
  - If OpenAI path → do not write timings (so Whisper step runs).

- [ ] **Step 3: Hermeneutic checkpoint HC-1**
  - Re-run backend unit tests + build.

---

## Task 5: Verify Remotion CLI renderer ↔ video-template CLI contract

**Files:**
- Verify/Modify: `packages/backend/src/content-pipeline/drivers/remotion-cli-renderer.ts`
- Verify/Modify: `packages/video-template/src/cli/render-cli.ts`
- Verify: `packages/video-template/src/cli/render.ts`
- Verify: `packages/video-template/src/types.ts`

- [ ] **Step 1: Verify backend spawn arguments match CLI options**
  - Backend must pass `--props-json` (kebab case) and CLI must read `opts.propsJson` (commander camel-cases).

- [ ] **Step 2: Ensure renderer parses CLI stdout robustly**
  - Renderer reads the final line JSON: `stdoutPayload.trim().split('\n').pop()`.
  - If CLI logs extra lines, they must not break the final JSON line.

- [ ] **Step 3: Ensure the subprocess cwd points to the package root**
  - This is required for Remotion’s browser cache lookup (`node_modules/.remotion`).

- [ ] **Step 4: Hermeneutic checkpoint HC-2**
  - Re-run video-template build/test (see verification checklist).

---

## Task 6: Verify ranking layout timing math is unit-testable and correct

**Files:**
- Verify: `packages/video-template/src/layouts/top10-timing.ts`
- (Optional) Test/Create: `packages/video-template/src/layouts/top10-timing.test.ts` (or colocated jest test file in an existing test location used by this package)

- [ ] **Step 1: Add a deterministic unit test for `computeRankingTiming()`**

```ts
import { computeRankingTiming, FPS, AUDIO_OFFSET_FRAMES } from "./top10-timing";

test("computeRankingTiming anchors row starts to 'Number' words", () => {
  const captionWords = [
    { word: "Number", startMs: 1000, endMs: 1100 },
    { word: "10", startMs: 1100, endMs: 1200 },
    { word: "Number", startMs: 5000, endMs: 5100 },
    { word: "9", startMs: 5100, endMs: 5200 },
  ];
  const timing = computeRankingTiming(2, captionWords);
  expect(timing.rowStartFrames[0]).toBe(AUDIO_OFFSET_FRAMES + Math.round((1000 * FPS) / 1000));
  expect(timing.rowStartFrames[1]).toBe(AUDIO_OFFSET_FRAMES + Math.round((5000 * FPS) / 1000));
});
```

- [ ] **Step 2: Ensure fallback spacing path is sane**
  - If captionWords are missing, it should still produce monotonically increasing frames with a hook window, rows, and outro.

- [ ] **Step 3: Hermeneutic checkpoint HC-2**
  - Run `npm test -w @propertyiq/video-template`.

---

## Minimal verification checklist (unit tests + typecheck/build)

Run these from repo root.

- [ ] **Backend unit tests (content-pipeline focus)**
  - Run: `npm test -w backend -- content-pipeline`
  - Expected: PASS

- [ ] **Backend typecheck/build**
  - Run: `npm run build:backend`
  - Expected: PASS (no TS errors)

- [ ] **Video-template unit tests**
  - Run: `npm test -w @propertyiq/video-template`
  - Expected: PASS

- [ ] **Video-template TypeScript build (CLI output present)**
  - Run: `npm run build:cli -w @propertyiq/video-template`
  - Expected: PASS, and `packages/video-template/dist/cli/render-cli.js` exists.

- [ ] **Hermeneutic checkpoint HC-3 (final)**
  - If any verification fails, fix the failure **within scope** and re-run the full checklist.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-04-27-content-pipeline-video-template-finish-and-verify.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks (REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`)
2. **Inline Execution** — execute tasks in this session with checkpoints (REQUIRED SUB-SKILL: `superpowers:executing-plans`)


# Content pipeline: edit the script at every stage (2026-07-29)

**Symptom (Troy):** "on /admin/content-pipeline/video-scripts when videos are suggested, I should
have the ability to edit the script at every stage. like the run page, I can see it go through all
the steps, but if it fails due to word length, I cant edit it there."

**Root cause — it is not word length, and the editor is structurally unreachable.**

There is no word-count validation anywhere in the pipeline. `wordBudget`
(`generate-script.handler.ts:39-43`) is prompt guidance only; nothing checks the returned count. The
hard constraint is a **post-synthesis audio-duration probe** —
`enforce-audio-budget.ts:32`, `if (audioDurationMs <= audioBudgetMs) return false`. On overflow it
burns `SCRIPT_REPAIR_MAX_REPAIRS` (default 2) LLM repairs, then throws → `handleStepFailure` →
status **`failed`**.

That is the whole bug. The review queue only returns `ready_for_review` runs
(`content-pipeline-queries.service.ts:261`), and `ScriptEditor` is rendered only inside `ReviewCard`
(`review-card.tsx:265-276`). A `failed` run can reach neither.

| Escalation                   | Lands at           | Editable today |
| ---------------------------- | ------------------ | -------------- |
| Gate A drift                 | `ready_for_review` | ✅             |
| Gate B voice exhausted       | `ready_for_review` | ✅             |
| **Audio overflow exhausted** | **`failed`**       | ❌             |

Audio overflow is the only repair-exhausted path that dead-ends instead of asking the operator.

**Latent bug found en route.** `run-actions.service.ts:138-151` writes the script asset _before_
calling `transitionTo`. On a `failed` run `ALLOWED_TRANSITIONS.failed = ['queued']`, so the
transition throws — after the write has landed. The edit persists, the caller gets a 500, and the run
stays `failed`. Guard must move ahead of the write.

**Chosen approach (Troy, 2026-07-29): save + restart from fact-check, at every stage.** Editing is
always allowed and always re-enters at `verifying_data`; in-flight work is discarded. Rejected:
apply-at-next-stop (run can publish superseded copy), lock-during-render (the failure case is
exactly when you most want to edit), save-then-choose (a decision every single time).

**Deviation, flagged:** `publishing` is the one non-terminal status left read-only — posting is
irreversible and a restart mid-publish risks double-posting.

**Architectural move.** `editScript` today fuses _save_ and _advance_; the fused transition is what
rejects every status except `ready_for_review`. Splitting the write from the transition is what makes
"every stage" possible, and it retires the write-then-throw bug as a side effect.

## Plan

### Backend

- [ ] **B1 — `script_revision` epoch guard.** Migration adding `content_runs.script_revision int not
null default 0`. Bumped on every script write. Each job handler captures it on entry and
      re-checks before its terminal write; a stale step logs `stale_step_discarded` and returns
      instead of transitioning. **Without this the chosen option is broken**: a zombie
      `rendering_voice` worker finishing after a restart attempts `verifying_data → rendering_video`,
      which `ALLOWED_TRANSITIONS` rejects, and `handleStepFailure` drives the restarted run to
      `failed`.
- [x] **B2 — widen `ALLOWED_TRANSITIONS`.** Added `→ verifying_data` from `scripting`,
      `linting_voice`, `rendering_voice`, `timing_captions`, `rendering_video`, and **`failed`** (the
      edge that unblocks the reported bug), plus a `verifying_data` self-edge for editing while
      fact-check runs. `queued`/`fetching_data` deliberately excluded — no script asset exists that
      early. `publishing` excluded — irreversible.
- [x] **B3 — reorder + guard `editScript`.** Status guard now runs before the write, so the
      write-then-500 bug is gone. Added `SCRIPT_EDITABLE_STATES`; illegal states raise
      `BadRequestException` (`edit_script_invalid_state`), unknown variants raise
      `edit_script_unknown_variant`, and the bare `Error('script asset not found')` became a
      `NotFoundException`. `{ nextStatus }` shape preserved; `ready_for_review` keeps the historic
      gate-aware resolver, every other stage restarts at `verifying_data`.
- [x] **B4 — kill the stale duplicate.** `editScript` now writes `content_runs.hook_variants`
      alongside the asset metadata, and bumps `script_revision` in the same statement.
- [x] **B5 — expose the budget.** `getRunDetail` returns a `scriptBudget` block
      (`capSeconds`, `durationSeconds`, `audioBufferSeconds`, `naturalWpm`) derived exactly as
      `synthesize-audio.handler.ts:50-51` derives it. `null` for infographic runs, which have no
      `format_templates` row.
- [x] **B6 — §1.3 splits forced by the above.** `run-actions.service.ts` hit 332 lines →
      `deleteRun` extracted to `run-delete.service.ts` (delegating wrapper kept, `DeleteRunResult`
      re-exported so importers are untouched). `content-pipeline-queries.service.ts` hit 316 →
      `getFormatSampleVideos` extracted to `format-sample-videos.ts` as a plain function, matching
      the existing `asset-signing.ts` pattern.

**Backend verification:** `npx tsc --noEmit` clean; `jest src/content-pipeline` → 93 suites, 798
passed, 1 skipped, 0 failed. Migration written but **NOT applied** — pending Troy's go-ahead.

### Frontend

- [x] **F1 — `lib/script-budget.ts`.** Implemented rather than left blocked, so the meter could
      ship. `estimateSpeechSeconds` weights tokens by SPOKEN length via `spokenWordCost()`: one word
      per digit plus one each for "point" / "dollars" / "percent" / magnitude suffix. `"34.2%"` costs
      5, `"$1,240"` costs 5, against 1 for a plain word — a flat word count under-reports worst on
      exactly the data-dense lines most likely to overflow. `naturalWpm` is taken at face value and
      no padding is hidden in the estimate; the meter reports its own margin instead. **To retune,
      change `spokenWordCost` — it is the single lever and it is unit-tested.**
      16 unit tests pass, including the load-bearing one: a script under its word budget that
      overflows on inserted pauses alone.
- [x] **F1a — relocated `segmentNarration()`.** Now lives at
      `packages/video-template/src/narration/narration-segmenter.ts`, exported as
      `@propertyiq/video-template/narration`. The backend keeps a re-export shim at the original path
      so its importers and colocated spec are untouched, and `@propertyiq/video-template` was added
      to backend deps. `build:libs` already builds this package before both backend and web, so no CI
      change was needed.
      ⚠️ Backend imports it by **dist path**, not the `./narration` subpath: backend compiles with
      `moduleResolution: node`, which predates `exports`. That matches the existing convention noted
      in video-template's package.json (the `./dist/*` wildcard is load-bearing for the renderer).
      The frontend, on bundler resolution, uses the clean subpath.
- [x] **F2 — `runs/[id]/script-panel.tsx`.** Inline editor on the run page, editable at every status
      in `EDITABLE_STATES` (mirrors the backend set). Binds RAW `fullText`, never
      `displayScriptText()` output, so the `{{SHORT_LINK}}` template survives a save. Esc discards,
      Cmd/Ctrl-Enter saves, dirty state gates the button, and the restart consequence is stated on
      the control rather than discovered after. Read-only states explain themselves via
      `lockReason()`. The duplicate read-only `<pre>` was removed from `artifacts-panel.tsx`.
- [x] **F3 — budget meter.** `runs/[id]/script-budget-meter.tsx`. The track is the video's real
      duration; speech fills solid, inserted pauses fill at 50% (they are exact, speech is not), the
      buffer zone is striped, and the cap is a hairline. Roboto Mono tabular figures. Reports
      "Xs spare" or "Xs over" and names itself an estimate.
- [x] **F4 — `useEditScript` hook.** Added to `use-run-mutations.ts` with invalidation of both key
      namespaces and a toast. Both editors now route through it — the review-queue modal
      (`review/script-editor.tsx`) was calling the API bare, so its saves refreshed nothing.
- [x] **F5 — typed `fetchRun`.** New `lib/run-detail-types.ts` (`RunDetail`, `RunRow`,
      `ContentAsset`, `ScriptVariant`, `RunGate`, `RunEvent`, `RunScriptBudget`) plus a
      `findScriptVariant()` helper, re-exported through `content-pipeline-api.ts`. Immediately caught
      a latent bug the `any` was hiding: `ArtifactsPanel` declared `storage_url: string` when the
      column is nullable.
- [x] **F6 — video-scripts page editing.** Done. New `video-script-edits.ts` (the normalize-inverse,
      pure) + `VideoScriptEditor.tsx` (inline, modeled on `post-copy-editor.tsx`), wired into
      `VideoScriptCard` and reusing `useUpdatePostCopy`. All four existing actions preserved;
      `buildMakeVideoHref` derives from the edited copy. 22 new unit tests, 46 passing across the
      surface.

      The inverse is pinned by one invariant — `apply(copy, toVideoScriptEdits(copy))` deep-equals
      `copy` — because the copy PATCH replaces the whole JSONB rather than merging. Without it, a
      legacy `{hook, body, cta}` row would be silently converted to the structured shape just by
      being saved. Only changed fields are written; `close` writes back to the key it came from.

      **Two pre-existing landmines found in `update-post.dto.ts`, worth fixing separately:**
      (1) `cta` caps at 500 but `close` at 2200 — same concept, different limits; the editor now
      computes its cap from the key the save will write. (2) `durationSeconds` (`@IsInt @Min(5)
      @Max(600)`) and `suggestedFormat` (`@IsIn(CONTENT_FORMATS)`) are validated on PATCH but NOT on
      insert (`generation-guards.ts` only checks non-blank), so a model-generated fractional duration
      makes EVERY subsequent save 400 with an error the operator cannot act on. Worked around by
      dropping/rounding those invisible metadata fields on save; the insert-side validation gap
      remains open.

      Not browser-verified — types, lint and unit tests only.

- [x] **F7 — fix `PipelineVisualization`.** Both live bugs on the exact screen in question are
      fixed. `Stage.matchesStatus` predicates became `Stage.statuses` arrays, so the same list both
      matches the status and resolves the stage's timestamp — `eventsByType.get(stage.label)` was
      looking up human labels ("Writing script") in a map keyed by raw status ("scripting"), so no
      stage timestamp had ever rendered. And halted runs (`ready_for_review` / `failed` / `rejected`
      / `cancelled`) matched no stage at all, so `currentIdx === -1` drew every dot inert — a run
      that had rendered video and was awaiting review looked identical to one that never started.
      `resolveProgress()` now recovers the halt position from the event history and tones the dot
      error/amber with a terminal chip instead of pulsing it. Frontend `tsc --noEmit` clean.

### Review findings folded in

Adversarial review of the backend changes surfaced three defects, all real:

- [x] **Non-atomic `script_revision` bump (WARNING).** The JS-side read-modify-write meant two
      concurrent edits — a double-clicked save, two tabs — both read the same value and wrote the
      same successor, collapsing two edits into one revision. An in-flight handler holding the
      pre-edit value would then compare EQUAL and fail to discard itself: the guard silently defeated
      in exactly the case it exists for. Replaced with an `increment_script_revision(uuid)` SQL
      function in the migration.
- [x] **Guard-to-transition window (WARNING).** `transitionTo` re-reads and re-validates status at
      the end, by which point the asset write has already committed — a worker advancing the run
      mid-edit would persist the edit and then throw. Added a status re-read immediately before the
      writes, raising `edit_script_status_moved` instead.
- [x] **`resolveProgress` ordered by stage index, not chronology (WARNING).** My own bug, and one
      created by this very feature: now that an edit can send a run backwards, "furthest stage
      reached" and "where it halted" are different things. A run that reached `rendering_video`, was
      edited back to fact-check, then failed at voice lint would show its dot on "Rendering video".
      Fixed by passing ordered `statusHistory` and walking it backwards.

- [x] **Publish is not idempotent (CRITICAL — FIXED).** `PublishHandler` now reads
      `platform_posts` for `status='posted'` rows, routes only the platforms not already live,
      records a `publish_skipped_already_live` event, and transitions straight to `published` when
      every selected platform is already out (fanning out to nothing would have stranded the run in
      `publishing` with no worker). 4 new tests; the spec harness became table-aware. This closes the
      pre-existing `retryRun` exposure too, not just the new edit path. Original finding: `PublishHandler` fans out to per-platform
      queues and each handler independently drives the run's terminal status: TikTok succeeding calls
      `transitionTo('published')` while a sibling failing calls `handleStepFailure` → `failed`. So a
      `failed` run can hold LIVE posts. Re-running publish (via the new `failed → verifying_data`
      edge, or the pre-existing `retryRun`) republishes to platforms that already went live. No
      publish handler checks for an existing `status='posted'` row — they only delete a prior
      same-platform row. Root fix: have `PublishHandler` skip platforms already posted, and transition
      straight to `published` when every platform is already live (otherwise it fans out to nothing
      and the run wedges in `publishing`). This also closes the pre-existing `retryRun` exposure.
      **Deferred only to avoid colliding with the in-flight handler agent editing the same files.**

### Second review round — frontend

- [x] **`{{SHORT_LINK}}` under-costed (CRITICAL).** The meter measured the STORED text, where the
      token counts as one word. `synthesize-audio.handler.ts` substitutes it for "Property IQ dot
      app" — four spoken words — before synthesis, so every script with a call to action (nearly all
      of them) under-reported by ~1.3s. The meter could show spare time on a script that overflows,
      defeating the feature's whole purpose. Fixed by adding `toSpokenText()` to the shared narration
      module; the backend handler now uses it too, so the literal exists once.
- [x] **Flash-to-stale after save (CRITICAL).** `setDraft(null)` ran before the invalidated query
      refetched, so the textarea and meter rendered the OLD script for a full round trip after a
      successful save. Now patches the cached `RunDetail` synchronously via `setQueryData` first —
      the same pattern `video-scripts/page.tsx` already used.
- [x] **Estimator gaps.** `spokenWordCost` now splits hyphen/slash compounds ("3-bed" = 2 words) and
      charges ratios for their spoken connector ("1:4" = 3). Tests extended from 16 to 22, covering
      the cases the first suite only restated: SHORT_LINK, full CTA lines, hyphens, ratios, years,
      ZIPs.
- [x] **Empty-script save guard.** `dirty` went true the moment the textarea was cleared, so "Save
      and restart" could submit an empty script. Now requires `text.trim()`.
- [x] **`{{SHORT_LINK}}` looked broken in the editor.** Editors must bind raw text or the template is
      destroyed on save, but that made the placeholder look like a bug next to read-only panes
      showing the rendered URL. The panel now explains the token when it is present.
- [x] **Overclaiming docstring in `video-script-edits.ts`.** The round-trip identity holds for the
      five editor-exposed text fields, not the whole object — `dropUnsavableMetadata` runs
      unconditionally. The suite's own test disproved the blanket wording. Narrowed.

### Third review round — handlers

- [x] **Publish idempotency read failed OPEN (CRITICAL).** My own bug, and the wrong instinct
      applied in the wrong place. supabase-js resolves `{ data: null, error }` rather than throwing,
      so a transient read failure left `alreadyLive` empty and re-dispatched every platform —
      reproducing the double-post the check exists to prevent, precisely in the DB-flakiness case
      where a retry is most likely. Now checks `error` and throws.
      The distinction to hold onto: the `script_revision` guard fails OPEN because a missed check
      only reproduces old behaviour; this one must fail CLOSED because the side effect is an
      irreversible post to a public feed. Same codebase, opposite correct stance. Test added.
- [x] **Stale invariant in the `PublishHandler` docblock.** It claimed one `published` exit; this
      work added a second. Both are safe (each fires from `publishing`, excluded from
      `SCRIPT_EDITABLE_STATES`), but the guard system here is comment-driven, so the claim was
      updated rather than left to mislead the next editor.

**Verified correct under adversarial review** (recording so it is not re-litigated): the fail-open
logic uses `typeof revision === 'number'`, so revision `0` — the real starting value for every
existing row — is never conflated with "unknown"; all 12 guards sit before their first irreversible
write; `time-captions` and `publish-youtube-shorts` both guard on BOTH of their paths; the
`youtube_shorts` / `youtube_long` distinction survives the already-live check because it compares
exact Platform strings.

### Fourth review round — a regression I introduced, then fixed

- [x] **Wrapping `PublishHandler` in try/catch broke partial fan-out (CRITICAL, self-inflicted).**
      Making the handler report through `handleStepFailure` was right for errors BEFORE the dispatch
      loop and wrong for errors inside it. If `queue.send` failed on platform k of N, jobs 1..k-1
      were already enqueued and would post for real — but the run was now marked `failed` first, so
      each sibling's `transitionTo('published')` became illegal, and it would record its own
      SUCCESSFUL post as a `status:'failed'` row and then throw into pg-boss. One queue hiccup would
      corrupt the audit trail for every platform that actually published, and reintroduce the exact
      escaping-throw bug this work set out to close — in all five per-platform handlers at once.
      Fixed by extracting `dispatch()`: if anything was enqueued, the in-flight siblings keep
      ownership of the terminal status (as before the wrap) and only the undispatched platforms are
      recorded, via a `publish_dispatch_incomplete` event. If nothing was enqueued there is no
      conflict and the error propagates so the run fails properly.
      **`published_partial` is NOT the fix** despite fitting the name — it is terminal too, so it
      breaks the siblings' transition identically. Noted in the code so it is not "corrected" later.
- [x] **Double-fault erased the diagnosis.** `handleStepFailure` can itself throw (its internal
      re-read can fail for the same reason we are in the catch). The original error is now logged
      before the hand-off, so the real cause survives even when the status write does not.
- [x] **Partial dispatch had zero test coverage** — every `queueSend` mock resolved. Added
      `failSendAfter` to the harness and three tests: partial dispatch does not fail the run,
      the undispatched platforms are recorded, and a total dispatch failure still does.

### Fifth round — the design fix (Troy's call: reconciler cron)

Five rounds of patching one file was the signal that the bug was structural, not local: **nobody
owned the run's terminal status during fan-out.** Five handlers raced for it and whoever won was
guessing. Both behaviours shipped along the way were wrong in different directions — failing the run
corrupted the audit trail of platforms that HAD published; swallowing let a platform vanish silently
into a dead-end `published`. Fixed by making the race not matter:

- [x] **`settlePublished()` helper** — all six terminal-transition sites across the five per-platform
      handlers now route through it. A rejected transition after a SUCCESSFUL post is absorbed and
      logged, not treated as a publish failure. Only invalid-transition rejections are swallowed; a
      missing run or failed write still propagates. This closes the whole class, including the
      pre-existing cancel-mid-publish variant that needed no queue failure at all. 5 unit tests.
- [x] **`ReconcilePublishGapsCron`** — every 5 min, finds runs settled within 24h whose
      `selected_platforms` contains a platform with NO `platform_posts` row, and re-dispatches it.
      **Attempted vs dropped is the load-bearing distinction:** a platform that was tried and failed
      has a `status='failed'` row, so it is left alone — without that the cron would retry genuine
      failures every five minutes for a day. Double-posting stays blocked by the existing
      `alreadyLive` check plus `settlePublished`. 6 unit tests.
- [x] **Two WARNINGs from the same round.** `(err as Error).message` sat OUTSIDE the nested
      try/catch that was supposed to contain it, so a nullish rejection would have escaped and failed
      the run — the exact outcome the swallow prevents. Now `err instanceof Error ? ... : String(err)`
      in both spots. And a test I had described as pinning the fix actually passes against the old
      code too; relabelled in place as a forward guard rather than deleted.

**No state-machine change was needed** — `published` stays terminal, so nothing that relies on that
had to be audited. That was the reason to prefer reconciliation over adding a `published → publishing`
edge.

### Sixth round — two CRITICALs in the reconciler itself

Both real, both fixed. The first I predicted when dispatching the review; the second I did not see.

- [x] **The cron could DOUBLE-POST (CRITICAL).** Absence of a `platform_posts` row cannot distinguish
      "never dispatched" from "dispatched and still uploading". A YouTube upload running longer than
      the 5-minute cron interval would be re-dispatched, and nothing downstream catches it — the cron
      enqueues the per-platform queue DIRECTLY, bypassing PublishHandler's `alreadyLive` guard
      entirely, and no per-platform handler checks for an existing post before publishing. Both jobs
      would post live video, and because each does delete-then-insert, the DB would show ONE row: the
      duplicate is invisible in the data and only visible on the channel.
      Fixed with a settled-quiet period — a run must have been terminal for 30 minutes before a
      missing row counts as dropped. Not an arbitrary number: it is this codebase's existing
      definition of "a publish step this old is no longer running"
      (`STEP_TIMEOUT_MIN.publishing` in recover-stuck-runs.cron.ts).
      **Residual risk, stated in the code rather than hidden:** a job still uploading >30 min after
      its run went terminal could still be re-dispatched. Closing that fully needs a dispatch-time
      claim row, which requires every handler to reliably clear its own claim — and the YouTube
      handler still does not delete before insert, so the claim would leak. Blocked on that fix.
- [x] **The cron would fire publish jobs at runs that never rendered a video (CRITICAL).** `failed`
      is reachable from EVERY pre-publishing stage, and `selected_platforms` is set at run creation —
      so a run that died during `scripting` presents as a total dispatch gap. The cron would have
      queued real publish jobs for each selected platform; each would fail on a missing
      `video_master`, fabricate a publish attempt in the event timeline of a run that never got near
      publishing, and then throw `Invalid transition from failed to failed` uncaught into pg-boss.
      Fixed by requiring at least one existing `platform_posts` row: a partial dispatch by definition
      has siblings, and zero rows means publishing never started. A total dispatch failure is not
      this cron's job — PublishHandler rethrows there, so the run fails properly and `retryRun` is
      the recovery.
- [x] **Unbounded event writes.** A platform with no `PLATFORM_TO_QUEUE` mapping can never produce a
      row, so it read as a permanent gap and would have logged an event every 5 minutes for 24 hours.
      Excluded from the gap set.
- [x] **Contract test for the error-message match.** `settlePublished` recognises the rejection by
      string prefix, so a reword of `run-orchestrator.service.ts:71-75` would silently defeat it with
      no test failing — every losing handler would go back to recording its own successful post as a
      failure. Added a test asserting against the real message construction.
- [x] **§1.3 breach I caused.** `publish-youtube-shorts.handler.ts` hit 301/300 — from my script's
      multi-line call formatting, not new logic. The call fits on one line at 73 chars; collapsed
      across all five handlers, now 291. Prettier clean.

### Seventh round — no CRITICALs; three test/telemetry warnings fixed

Production code came back clean. Two things I was unsure about were verified rather than assumed:
`content_runs.updated_at` is written ONLY by `RunOrchestratorService.transitionTo` (no other writer,
no DB trigger — swept every `.update()` on the table), so the quiet period cannot be starved; and the
zero-row blind spot is not reachable.

- [x] **Event written even when every send failed.** Nothing enqueued means no `platform_posts` row
      appears, so the run presents the identical gap next pass — up to ~288 events over 24h all
      claiming a redispatch that never happened. Same repeat-forever shape as the unmapped-platform
      case, different trigger. Now gated on at least one successful send, and the payload records
      what was actually enqueued (`redispatched`) rather than what was merely identified (`gaps`).
- [x] **The 30-minute quiet filter had no test.** The mock accepted `.lte(...)` without inspecting
      its arguments, so the suite would have passed against a build using the wrong column, the wrong
      operator, or a miscalculated threshold — i.e. the fix for the double-post CRITICAL was
      unproven. The harness now captures the filter arguments and a test pins column, operator and
      threshold, plus that the 24h window is on `created_at` and not confused with it.
- [x] **My "contract test" wasn't one.** It hardcoded a copy of today's error message, so a reword of
      the real throw site would leave it passing with a stale copy — exactly the drift it claimed to
      prevent. Rewritten to construct a real `RunOrchestratorService` with a mocked client returning
      a terminal status, assert it genuinely rejects (so the test cannot pass vacuously), and feed
      the actual thrown error into `settlePublished`.

### Flagged, NOT fixed — deliberate scope calls

- [ ] **`publish-youtube-shorts.handler.ts` lacks the delete-before-insert its four siblings have.**
      tiktok/instagram/facebook/linkedin each delete any prior row for their own `(run_id, platform)`
      before inserting, "so a retry doesn't leave duplicates that confuse the analytics rollup".
      YouTube inserts unconditionally, so a failed-then-retried publish leaves a stale
      `status:'failed'` row beside the new `status:'posted'` one. It does NOT break the new
      idempotency check (which filters on `status='posted'`), but it surfaces duplicate rows in
      run-detail. Not fixed because the file is at 294/300 and adding the delete breaches §1.3,
      which forces the split below first.
- [ ] **Split `publish-youtube-shorts.handler.ts` (294/300).** Two near-duplicate ~120-line lanes
      (`handleYouTubeShorts` / `handleYouTubeLong`) that build title/description/tags and do the
      platform_posts + short-link dance almost identically. Also near the limit:
      `synthesize-audio.handler.ts` 292, `render-video.handler.ts` 290. Deliberately not done here —
      refactoring an irreversible publish path with no integration coverage is not something to do
      as a side effect of a script-editing feature.
- [ ] **A `posted` row for a post since deleted on the platform blocks republishing forever**, with
      no force-republish path. Conservative and silent. Acceptable today; worth a deliberate override
      if it ever bites.

### Second bug class found while wiring the guard

Worth recording because I originally described only half the failure. `transitionTo` callers
(verify-data, lint-voice, publishers) throw on an illegal transition and get driven to `failed` —
that was the known case. But `handleStepSuccess` callers (generate-script, synthesize-audio,
time-captions, render-video) never throw: it re-reads current status, and
`nextStateOnSuccess('verifying_data')` returns `linting_voice`, a **legal** edge. Those would have
silently walked the restarted run PAST the fact-check the edit was meant to trigger, after clobbering
its assets. Both classes are guarded now.

### Out of scope (noted, not doing)

- `new/copy-step.tsx` + `copy-state.ts` are complete, tested, and **unmounted** — `new/page.tsx` has
  no `step === "copy"` branch, so `product_demo_*` formats render a blank div, and `createRun`'s DTO
  has no field to carry edited copy (`whitelist: true` strips undeclared keys). Separate fix.
- Variant B is unreachable: `variantCount: 1` is hardcoded (`generate-script.handler.ts:107`) while
  the `edit-script` DTO still accepts `'B'`, where it would silently no-op.
- `displayScriptText` rewrites `{{SHORT_LINK}}` → `propertyiq.app` for display only. Editors must
  bind raw `fullText` or the placeholder is destroyed on save.

---

# /admin/analytics: bot exclusion is live but invisible — three-state classification (2026-07-29)

**Symptom (Troy):** "Work was done yesterday to clean up the data and exclude bots. I'm not seeing that."

**Root cause — the filtering shipped and works; it has nothing to filter.** Verified against prod:

| Check                  | Result                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| Read paths filter bots | ✅ 19 × `.eq('is_bot', false)` across 8 services                   |
| Migrations applied     | ✅ both `is_bot` columns present                                   |
| Ingestion classifying  | ✅ first flagged row `2026-07-28 21:59:18Z`                        |
| Last 30 days           | 48,228 sessions, **70 flagged (0.15%)**                            |
| Since deploy (~14h)    | 766 sessions, 73 UA-flagged, **607 more with zero human evidence** |

Two causes, both of which the original commit predicted in its own comments:

1. **Forward-only + `default false`.** `is_bot` overloads `false` to mean both "checked, human" and
   "never checked." The 30-day window is ~99.85% pre-classification rows, so `.eq('is_bot', false)`
   passes all of history through as human. Migration comment says it outright: pre-2026-07-28 rows
   are "unclassified, not verified-human."
2. **UA-only classifier misses the dominant crawler.** `bot-detection.ts:101-106` calls this exact
   shot. Today's largest cohort — **534 sessions, Chrome/Linux/desktop, no referrer, 0.28s avg,
   exactly 1.00 pages, 6 heartbeats across all 534** — is `is_bot = false`.
3. **No UI signal at all.** The only frontend changes were `JourneysTab.tsx` + `OutboundDestinationsTable.tsx`.
   Nothing on the page says bots are being excluded, so even correct filtering would be invisible.

**Chosen approach (Troy, 2026-07-29): options 1 + 3 + 4 combined.** These compose rather than
conflict. The behavioral rule (1) is only trustworthy _after_ the 5s early heartbeat went live, so
pre-deploy ambiguous rows go to `NULL` (3) instead of being falsely labeled bot. The dashboard still
drops to real size immediately, because the default `human` segment excludes `NULL` — the excluded
mass is just labeled honestly.

**Evidence rule — v4 (any one ⇒ human):** `heartbeat_count > 1`, `duration_seconds > 5`,
`page_count > 1`, `user_id IS NOT NULL`, `converted`, or the session emitted an event matching the
**deliberate-interaction allow-list**
(`click|submit|attempt|search|toggle|select|download|export|share|signup_start|otp_`).

> **Three earlier versions were wrong — each caught by measurement, not review.** The spread between
> them is 35,000 sessions, so the rule _is_ the deliverable; everything else is plumbing.
>
> - **v2 — "emitted any non-pageview event"** re-admitted **32,305 crawler sessions**. Bots emit
>   plenty of events; they just don't emit _intentional_ ones.
> - **v1 — `feature_events_count > 0` / `had_frustration_event`** — silently contaminated. Of sessions
>   we _know_ are bots, **582 emit `feature.score_view`** and **550 emit `seo.conversion_bar_shown`**;
>   both auto-fire on render, as does `frustration.error_shown`. Any crawler hitting `/markets/*`
>   incremented `feature_events_count`, so v1 laundered it into "human."
> - **v3 — `duration_seconds > 0` / `heartbeat_count > 0`** — the subtlest and worst. The duration
>   histogram spikes to **2,019 sessions at exactly 5 seconds**, against neighbours of 30–107. That is
>   `EARLY_HEARTBEAT_MS = 5000` firing once and the client vanishing. Of those 2,019, **1** is
>   multi-page and **1** is logged in. The early heartbeat was added specifically so duration would
>   separate humans from crawlers — but crawlers block on network-idle, which takes longer than 5s, so
>   they fire it too. v3 would have declared ~2,019 crawlers human, i.e. **70% of its own "human"
>   cohort**.
>
> Two load-bearing distinctions: **auto-fired telemetry vs. deliberate interaction** (not event
> category), and **surviving past the first ping vs. merely reaching it**.
>
> **`max_scroll_depth` is unusable** — 0 on every row in 30 days. Scroll tracking is another
> never-written field, the same defect class the last commit fixed. Do not put it in the rule.

**Load-bearing constant:** `EARLY_HEARTBEAT_DEPLOYED_AT = 2026-07-28 21:59:18Z`. Before it, a real
visitor leaving inside the 30s heartbeat window recorded 0 duration and is genuinely indistinguishable
from a crawler. After it, absence of a ping is real evidence.

## Purpose (Troy, 2026-07-29)

> "Clearly identify where our real human traffic is coming from, what they are doing here, and why
> they are leaving. We need to convert users."

That is the goal. Bot filtering is not the deliverable — it is the precondition for the three
questions being answerable at all. **The answers below were computable the moment rule v4 existed, so
the plan below is deliberately re-sequenced: act on what we already know first, build dashboard
plumbing second.**

### What the clean data already says (30 days to 2026-07-29, rule v4, n=772)

**1. Where real humans come from — 772 sessions, ≈26/day.**

| Source                | Human sessions | Avg pages | Logged in | Converted |
| --------------------- | -------------: | --------: | --------: | --------: |
| Direct / no referrer  |        **579** |      3.92 |        80 |         1 |
| Google                |         **94** |      2.43 |         8 |         0 |
| Facebook (4 variants) |         **44** | 2.6 – 6.2 |         0 |         0 |
| Bing                  |             18 |      5.61 |         2 |         0 |
| DuckDuckGo            |             14 |      4.36 |         0 |         0 |
| localhost (us)        |              5 |     14.60 |         5 |         0 |

**2. What they do.** Engaged sessions concentrate on `/`, `/analyzer`, `/map`, `/screener`,
`/reports`. Logged-in users go deep — `/analyzer` exits average **9.5 pages**, `/screener` **10.3**,
`/market` **13.6**. The product retains the people who reach it.

**3. Why they leave — `/auth/sign-up` is the single largest exit page.**

| Exit page       | Sessions ending here | Avg pages before exit | Logged in |
| --------------- | -------------------: | --------------------: | --------: |
| `/auth/sign-up` |               **62** |               **1.5** |     **1** |
| `/`             |                   57 |                   4.3 |         6 |
| `/analyzer`     |                   44 |                   9.5 |        30 |
| `/map`          |                   39 |                   4.9 |         9 |

62 sessions arrive at the signup form, spend 1.5 pages, and leave. Against the funnel — **75
`signup_start` → 8 `signup_complete`, an 89% abandon rate inside the form** — this confirms the
leak is the form itself, not traffic quality and not the funnel above it.

### The uncomfortable implication

**Traffic is the binding constraint, not conversion.** At 26 human sessions/day, fixing the form from
11% to a strong 40% completion moves signups from 8/month to ~29/month. Real, but it does not change
the business by itself.

And organic is barely functioning: **488 impressions and 28 clicks in 30 days** across 77 blog posts
and thousands of programmatic `/markets/*` pages. The 26,032 "Google organic sessions" that made SEO
look healthy were **99.9% crawlers** — the bot problem was actively masking an SEO problem.

Two under-exploited signals worth naming:

- **Facebook is the most engaged external source** (5.1–6.2 pages/session, beating Google's 2.43) and
  has produced **zero** conversions. Highest intent, no capture.
- **75% of real traffic is "direct"** with only 80 logged-in sessions. That bucket is doing too much
  work and is mostly unattributed — 6.6 exists to break it up.

### Re-sequencing

Given the purpose, the original phase order optimised the wrong thing. Revised priority:

1. **P0 — Fix the signup form.** Highest-confidence, highest-value, already-diagnosed, and needs
   **none** of the plumbing below. Track separately; the instrumentation from `6885741e` already
   emits a rejection reason on every failure, so the abandon cause is likely already in the data.
2. **P1 — Phases 1-3** (three-state classification + backfill). Makes every number trustworthy and is
   the precondition for measuring whether the P0 fix worked.
3. **P2 — Phase 6** (traffic-source truth + Search Console). Answers "where do they come from" and
   turns the SEO problem from invisible to measurable.
4. **P3 — Phases 4, 5, 7** (UA capture, crawler naming, dashboard UI). Valuable, not urgent.

### P0 detail — the signup form: email or Google? _Currently unanswerable._

Asked directly (Troy, 2026-07-29): are the abandonments on the email/password path or the Google one?
**Neither can be attributed yet**, for three structural reasons — all worth fixing before any form
redesign, or the redesign will be guesswork:

1. **`signup_start` carries no method.** All 75 events are `(no method)`; it fires on form _view_,
   before a path is chosen. The top of the funnel is un-splittable by construction.
2. **OAuth completion was structurally invisible until 2026-07-28.** The apparent 7-email / 1-oauth
   split is an artifact of the bug `6885741e` fixed, not user behaviour — that commit documents real
   Google signups that recorded nothing, and the sole oauth row is dated the day of the fix.
3. **The new instrumentation has ~14h of data.** Since deploy: 2 `signup_start`, 1 `signup_complete`,
   and **zero** google `click`/`error`/`blocked`, zero email rejection reasons, zero outbound events.
   At ≈26 human sessions/day it has not had a chance to accumulate.

**What is visible:** the drop is at the first step, not spread through the form —
**63 of 75 sessions never submitted anything on either path.** That is equally consistent with
"clicked Google and it failed" and "looked at the form and left," which is exactly the ambiguity
`6885741e` set out to close. Separately, **12 `pending_confirmation` → 7 `otp_verified`** means 5
people requested the confirmation email and never returned through it — real friction on the email
path, independent of the form, and expected given autoconfirm is off in prod.

- [x] **P0.1 Split the email path from the Google path** — DONE 2026-07-29.
      **Redesigned during implementation:** "add `method` to `signup_start`" is not implementable —
      that event fires from a mount effect (`page.tsx:57`), before any path exists to name. The real
      gap is asymmetry: the Google path already announces itself via `signup_oauth_click`, while the
      email path emitted nothing between "form rendered" and "form submitted."
      New `conversion.signup_email_engaged` (`lib/analytics/signup-path-engagement.ts`) fires once per
      form mount on first touch of any credential field, carrying `{ field }`. Latched deliberately —
      it hooks onChange, so without the latch one abandoned signup emits an event per keystroke and
      inflates the stage it was added to measure. TDD: 4 tests written first, watched fail on
      assertions, then implemented. 41/41 analytics tests green, `tsc --noEmit` clean.
      **The 63 now split three ways:** `signup_email_engaged` (typed, gave up) ·
      `signup_oauth_click` (chose Google) · neither (pure bounce).
- [x] **P0.2 Google button events confirmed firing in prod** — DONE 2026-07-29. Clicked the live
      button with ToS unchecked; `conversion.signup_oauth_blocked`
      `{reason: "tos_not_accepted", provider: "google", variant: "B"}` landed in `user_events`.
      Whole chain verified: button → handler → `trackEvent` → `flush` → same-origin proxy → backend →
      DB. **The zero rows were "no traffic," not "still broken."** Backend has no event allow-list
      (`event-ingestion.service.ts:87` validates only category/action/session_id), so new event names
      pass through without backend work. Test rows (3 events + 1 session) deleted afterwards so the
      75-event funnel is not skewed.
- [x] **P0.3 Confirmation-email follow-through** — DONE 2026-07-29. Investigating first changed the
      diagnosis: **the 12→7 "gap" is substantially an artifact.**

      **Finding A — `signup_pending_confirmation` fires when no signup happened.** 5 such events on
      2026-07-12 against exactly ONE new `auth.users` row that day; identical 5-vs-1 on 2026-06-18.
      Cause is a fall-through at `page.tsx:148`: the already-registered guard reads
      `user && (user.identities?.length ?? 0) === 0`, so a response of
      `{error: null, session: null, user: null}` — which `AuthContext.signUp` returns verbatim via
      `user: data?.user ?? null` — is falsy there and drops into the branch announcing "we sent you a
      code." Nothing was created and no code was sent. Also a real UX bug: the visitor is shown a
      code-entry screen and waits for an email that will never arrive.
      **Fixed** with `signup-result.ts` — `classifySignupResult()` returns a closed union
      (`error | autoconfirmed | no_user | already_registered | awaiting_otp`), making `no_user` a
      state the caller must handle rather than the default. 7 tests, TDD.

      **Finding B — the 8 "never entered a code" sessions are two different populations.**
      2026-07-12 (4 sessions): duration 0, one page, distinct visitor ids, two of them 1.5s apart,
      mixed Windows/Linux, all landing straight on `/auth/sign-up` with no referrer — automated form
      submission. 2026-06-18 (4 sessions): durations 178s / 271s / 298s / 299s — real people who sat
      on the code screen for 3-5 minutes and entered nothing.

      **Finding C — the failure branches were silent.** `_attempt`, `_verified`, `_resent` existed;
      rejection, lockout and resend-failure emitted nothing, so "entered a wrong code" and "closed
      the tab" were identical in the data, and zero `_resent` across 90 days could not be read as
      either "nobody needed one" or "resend is broken." **Added** `_failed {attempt}`,
      `_exhausted {attempts}`, `_resend_failed {reason}` with `classifyResendError()` keeping raw
      provider strings out of the shared store. 4 tests, TDD; 11 pre-existing OtpCodeForm tests green.

      Verified: 69/69 tests across 6 files, `tsc --noEmit` 0 errors, eslint clean.

- [ ] **P0.5 Re-measure the OTP funnel after ~2 weeks of corrected data.** The current 23-session
      history mixes bot submissions, phantom pending-confirmations and real users; it is not a
      baseline. Do not tune copy against it.
- [ ] **P0.4 Only then redesign the form.** Wait for P0.1-P0.2 to produce ~2 weeks of split data;
      at 26 sessions/day, changing the form now means never learning which path was broken.

## Phase 1 — Three-state classification, centralized

- [ ] **1.1 Migration: `is_bot` → nullable** on `user_sessions` and `user_events`.
      `true` = automated · `false` = evidence-backed human · `NULL` = unclassified.
      Add partial indexes for the `is_bot IS NULL` case alongside the existing `= false` ones.
- [ ] **1.2 New `traffic-classification.ts`** — `TrafficSegment = 'human' | 'bot' | 'unclassified' | 'all'`,
      `DEFAULT_TRAFFIC_SEGMENT = 'human'`, and `applyTrafficFilter(query, segment)` using `.is()`
      (not `.eq()`, which cannot express the NULL case).
- [ ] **1.3 Replace all 19 `.eq('is_bot', false)` call sites** with `applyTrafficFilter(...)` across
      `overview-data-fetcher`, `conversion-analytics`, `journey-analytics`, `journey-outbound-queries`,
      `retention-analytics`, `acquisition-session-queries`, `daily-rollup`.
- [ ] **1.4 Add `traffic?: TrafficSegment` to `AnalyticsFilters`** (`user-analytics.types.ts:55`) and
      thread it from the frontend filter bar.

## Phase 2 — Backfill history on evidence

- [ ] **2.1 Migration: classify `user_sessions`.** Order matters — human evidence first, then the
      behavioral rule _only_ at/after the deploy constant, then everything else pre-deploy → `NULL`.
- [ ] **2.2 Propagate to `user_events`** via `session_id` join (events carry no duration/heartbeat of
      their own, so the session verdict is the only sound source).
- [ ] **2.3 Verify** against the acceptance gates below — run G2/G3/G4 immediately after the backfill
      transaction, in the same session, before anything else touches the tables.

## Phase 3 — Go-forward behavioral classification

- [ ] **3.1 Insert writes `true` or `NULL`, never `false`.** A session cannot be behaviorally
      classified at insert — duration is 0 by definition — so `session-manager.service.ts:77` should
      set `true` on a bot UA and `NULL` otherwise.
- [ ] **3.2 Promote to human on heartbeat.** `updateHeartbeat()` already fires on every ping; a ping
      _is_ the human evidence, so it flips `NULL → false` in real time.
- [ ] **3.3 Demote stale no-evidence sessions** in the existing `daily-rollup.service.ts` sweep:
      `NULL` + older than ~10 min + no human evidence ⇒ `true`.

## Phase 4 — Store the User-Agent, then tighten the rule

- [ ] **4.1 Migration: `user_sessions.user_agent varchar(512)`.** Already capped at 512 in
      `event-ingestion.controller.ts:47`, currently scanned-then-discarded.
- [ ] **4.2 Persist it** through `upsertSession` (insert path only; session-invariant).
- [ ] **4.3 After ~24h of capture,** query the UA distribution of the dead cohort and tighten
      `KNOWN_BOT_UA_SUBSTRINGS` with a precise rule for the Chrome/Linux/desktop crawler.

## Phase 5 — Name the crawlers (_"which bots are crawling?"_)

Crawler volume is real SEO/GEO signal — the original migration said so explicitly and chose
store-and-flag over drop-at-ingestion for exactly this reason. Knowing GPTBot and ClaudeBot reach the
programmatic `/markets/*` surface is a business answer, not a data-hygiene one.

- [ ] **5.1 Add `bot_name varchar(64)`** to `user_sessions`, derived from the same UA at ingestion.
      Families: Googlebot · Bingbot · GPTBot · ClaudeBot · PerplexityBot · CCBot · Bytespider ·
      AhrefsBot · SemrushBot · DataForSeo · headless-automation · other-declared.
- [ ] **5.2 Refactor `bot-detection.ts`** from a `string[]` of substrings to
      `{ pattern, name }[]`, so classification and attribution come from one table and cannot drift.
      `classifyAsBot()` keeps its boolean signature; add `identifyBot(): string | null`.
- [ ] **5.3 Crawler panel** in `/admin/analytics` — bot name × sessions × top landing pages × trend.
      Answers "is GPTBot indexing our market pages?" directly.
- [ ] **5.4 Bucket honestly.** Two cohorts cannot be named and must not be silently merged with the
      named ones: - **`unidentified-automation`** — the dominant Chrome/Linux/desktop cohort. It spoofs an
      ordinary UA, so we can count it but not name it. - **`referrer-spoofed`** — see 6.2. Claims a Google referrer that Search Console disproves. - Naming a bot requires reverse-DNS on the IP (how Google says to verify Googlebot), and we do
      not store IPs. Out of scope; the honest ceiling is "self-declared bots by name, the rest by
      count."

## Phase 6 — Traffic-source truth (_"more specific sources; can we get the search term?"_)

**Search terms cannot come from the referrer — proven, not assumed.** 0 of 26,032 Google referrers in
the last 30 days carry a query string; every one is a bare `https://www.google.com/`. Google has
stripped the term since the 2011 "not provided" switch. The **only** legitimate source is Search
Console, and we already have working scripted access to it.

**Two independent defects found while checking this:**

1. **The 8-channel classifier shipped but history was never backfilled** — the same forward-only
   pattern as `is_bot`. `referrer-classification.ts` correctly resolves `ai` / `search` / `social` /
   `email` / `referral` / `internal` / `utm` / `direct`, but stored data says otherwise:

   | `entry_type` | pre-deploy | post-deploy |
   | ------------ | ---------: | ----------: |
   | `organic`    |     26,323 |           1 |
   | `direct`     |     20,796 |         728 |
   | `search`     |      **0** |          48 |

   Every historical row still carries the legacy binary `organic` bucket — the exact conflation the
   new module was written to fix. Unlike `is_bot`, this **is** cleanly backfillable: `referrer_domain`
   is stored on every row, so the channel can simply be recomputed. AI referrals (claude.ai) are
   currently buried inside "organic" and would surface immediately.

2. **The referrer is crawler-controlled and is being trusted verbatim.** Search Console reports
   **28 clicks / 488 impressions / 25 distinct queries** for the same 30 days in which our own tables
   claim **26,032 Google organic sessions** — a 930× gap. Even after bot rule v3, 1,840 survive, still
   ~65× more than Google says it sent. A bare `www.google.com` referrer is therefore one of the
   strongest bot signals in the dataset, not a trustworthy source attribution.

- [ ] **6.1 Backfill `entry_type`** for all history by recomputing `classifyReferrer()` from the
      stored `referrer_domain`. Port the host lists to SQL, or run a one-shot Node script against the
      shared module so the two cannot diverge — preferred, since the module is already pure and
      dependency-free by design.
- [ ] **6.2 Treat a bare search-engine referrer with no human evidence as `referrer-spoofed`,** not as
      organic search. Validate the surviving count against Search Console clicks, which is the only
      bot-free measure of Google traffic we have.
- [ ] **6.3 Ingest Search Console into the dashboard.** New `search_console_queries` table
      (`date, query, page, clicks, impressions, ctr, position`), populated by a daily job wrapping the
      existing `scripts/analytics/search-console.js` (verified working: 25 queries / 28 clicks /
      488 impressions for 2026-06-29 → 07-28).
- [ ] **6.4 "Search queries" panel** on `/admin/analytics`, joined to landing pages via the GSC `page`
      dimension — "these queries brought people to this page."
- [ ] **6.5 Label the limits in the UI.** GSC lags ~2-3 days, samples, and withholds rare queries for
      privacy, so its clicks will never tie out exactly to session counts. State it on the panel
      rather than letting the mismatch read as a bug.
- [ ] **6.6 Split `direct`.** 21,523 sessions is the second-largest bucket and is currently a
      catch-all for "no referrer," which includes genuine direct navigation, stripped referrers, and
      crawlers. At minimum separate `direct` (human evidence present) from `no-referrer-automation`.

## Phase 7 — Make it visible (this is the actual reported symptom)

- [ ] **7.1 Traffic segment selector** in the analytics filter bar, defaulting to Human.
- [ ] **7.2 Show what was excluded** — human / unclassified / bot counts on the overview, so the
      filtering is legible instead of silent.
- [ ] **7.3 Sources panel reads in real channels** — search / ai / social / referral / direct, with
      AI assistants broken out rather than folded into organic.

## What success looks like

**The one-sentence test:** Troy opens `/admin/analytics`, and the 30-day visitor count reads ≈2,900
instead of 48,234 — while all 8 signups are still there.

Everything below is measured against the 30-day window as of 2026-07-29. Numbers are projections
from the live tables under rule v3; the backfill must reproduce them within rounding.

### G1 — The headline numbers move (Phase 2)

| Metric                  | Before              | After (target, rule v4) |
| ----------------------- | ------------------- | ----------------------- |
| Sessions, human segment | 48,243              | **772** (−98.4%)        |
| Sessions, bot segment   | 70                  | **773**                 |
| Sessions, unclassified  | 0                   | **46,698**              |
| Signup conversion rate  | 8 / 48,243 ≈ 0.017% | **8 / 772 ≈ 1.04%**     |
| Sessions per visitor    | 1.001               | **1.180** ✅            |
| Avg pages, human        | 1.00                | **> 2.0**               |

The last two rows are the honest-signal checks, and they are the reason to trust v4 over v3. Before:
980 sessions from 979 distinct visitors — nobody ever returns, which is only true of crawlers. Under
v4 the human cohort returns at 1.18 sessions/visitor and 262 of 772 are multi-page. A rule that
leaves sessions-per-visitor at ~1.00 has not worked, whatever the volume says.

**1.04% visit→signup is a believable SaaS number.** 0.017% was measuring crawlers.

### G2 — Hard invariants (each MUST return 0 rows)

These are the "did we hide a real person" gates. Any non-zero result reverts the backfill.

- [ ] **G2.1** No session with `converted = true` is classified bot or unclassified.
- [ ] **G2.2** No session with `user_id IS NOT NULL` is classified bot or unclassified.
- [ ] **G2.3** No session that emitted a deliberate-interaction event is classified bot.
- [ ] **G2.4** No session with `heartbeat_count > 0` or `duration_seconds > 0` is classified bot.
- [ ] **G2.5** Row counts conserved: `human + bot + unclassified = total` on both tables, and total is
      unchanged from the pre-backfill count. Nothing was deleted.
- [ ] **G2.6** No `user_events` row disagrees with its parent session's verdict.

### G3 — The funnel survives intact (Phase 2)

Measured above; the backfill must not change a single one of these counts in the human segment:

| Event                         | 30-day count | Must survive |
| ----------------------------- | -----------: | -----------: |
| `signup_start`                |           75 |           75 |
| `signup_otp_attempt`          |           14 |           14 |
| `signup_pending_confirmation` |           12 |           12 |
| `signup_complete`             |            8 |            8 |
| `signup_otp_verified`         |            7 |            7 |
| `pricing_cta_click`           |            6 |            6 |

The known in-form leak (75 starts → 8 completes) must still be visible afterwards. If the backfill
flattens the funnel, it destroyed the very signal this work exists to expose.

### G4 — Go-forward classification actually classifies (Phase 3)

- [ ] **G4.1** 24h after deploy, unclassified share of _new_ sessions is < 5% — sessions get a verdict,
      they don't pile up in limbo.
- [ ] **G4.2** New human sessions have a non-zero average duration. Today's human segment averages
      0.28s, which is not a human number.
- [ ] **G4.3** A real browser session (Troy loading the site, waiting >5s) lands as `is_bot = false`
      within one heartbeat. Verify by session id, not in aggregate.
- [ ] **G4.4** The daily-rollup sweep is idempotent — a second run changes 0 rows.

### G5 — Crawlers are named, not just counted (Phase 5)

- [ ] **G5.1** The crawler panel names at least the self-declaring families present in the data, each
      with session counts and top landing pages.
- [ ] **G5.2** The AI-crawler question is answerable without writing SQL: "did GPTBot / ClaudeBot /
      PerplexityBot hit `/markets/*` this month, and how often?"
- [ ] **G5.3** `unidentified-automation` is shown as its own bucket with an explicit caption, never
      merged into a named family and never silently dropped. Expect it to be the largest bucket —
      that is the honest answer, not a failure.
- [ ] **G5.4** `classifyAsBot()` and `identifyBot()` read from one table; adding a crawler is a
      one-line change and cannot make the two disagree. Covered by a test.

### G6 — Traffic sources are specific and defensible (Phase 6)

- [ ] **G6.1** `entry_type = 'organic'` is **gone** from the 30-day window — 26,323 rows redistributed
      into `search` / `ai` / `social` / `referral` / `internal`. A remaining `organic` row means the
      backfill missed it.
- [ ] **G6.2** AI referrals are visible as their own channel. claude.ai's 14 sessions currently sit
      inside "organic"; after backfill they read as `ai`.
- [ ] **G6.3** Recomputed channels match the live classifier exactly — run `classifyReferrer()` over a
      sample of backfilled rows and diff. Zero mismatches, or the SQL port drifted from the module.
- [ ] **G6.4 Google reconciles with Search Console.** Human-segment Google `search` sessions land
      within the same order of magnitude as GSC clicks (28 for 2026-06-29 → 07-28), not 26,032 and not
      1,840. This is the single strongest external check available, because GSC cannot be spoofed by a
      crawler setting a referrer header.
- [ ] **G6.5** The search-queries panel renders real terms from GSC ("property iq", "propertyiq
      search", "home prices forecast"), joined to the landing pages they drove.
- [ ] **G6.6** The panel states GSC's lag/sampling/privacy limits, so the permanent mismatch with
      session counts reads as expected rather than broken.
- [ ] **G6.7** No search term is ever sourced from a referrer. If any code path claims to extract `q=`
      from a referrer URL, it is wrong by construction — the data proves the parameter is not there.

### G7 — It is visible (Phase 7) — _the originally reported symptom_

- [ ] **G7.1** The filter bar has a traffic selector, defaulting to Human.
- [ ] **G7.2** The overview states what was excluded, e.g. "2,862 human · 730 bot · 44,643 unclassified",
      so the number on screen is self-explaining.
- [ ] **G7.3** Switching to All reproduces the old inflated numbers — proof the filter is doing the work
      and no data was destroyed.
- [ ] **G7.4** Verified in the browser against live data, not from a 200 response or a passing test.

### G8 — Not-broken checks

- [ ] **G8.1** `npx tsc --noEmit` clean in backend (plain tsc — `nest build` excludes specs).
- [ ] **G8.2** `bot-detection.spec.ts`, `session-manager.service.spec.ts`,
      `journey-analytics.service.spec.ts` updated and passing.
- [ ] **G8.3** Every analytics tab renders without an empty panel that was populated before. An empty
      panel is the exact failure mode of the last round — indistinguishable from "no data yet."
- [ ] **G8.4** No dashboard query regressed to a full scan; the partial indexes still apply.

### Explicit non-goals

Not in scope, so absence is not failure: recovering true visitor counts for pre-deploy history (the
evidence does not exist — that traffic stays unclassified forever), reconciling with GA4, and
back-correcting the daily rollup tables already written from bot-inflated inputs.

---

**Risk:** analytics-only, no user-facing surface, no new tables (so no GRANT work). Reversible — the
backfill sets a flag, never deletes rows. Tests to update: `bot-detection.spec.ts`,
`session-manager.service.spec.ts`, `journey-analytics.service.spec.ts`.

**Before Phase 2 runs:** snapshot the current classification so the backfill is revertible —
`create table user_sessions_isbot_backup_20260729 as select session_id, is_bot from user_sessions;`
and the same for `user_events` (id, is_bot). Restoring is then a single join-update.

---

# Google OAuth consent screen: show PropertyIQ, not the Supabase host (2026-07-28)

**Problem:** Users signing in with Google see `Sign in to pysflbhpnqwoczyuaaif.supabase.co`.

**Cause:** Google renders the consent identity from the OAuth client's _verified brand_. With no
brand verification it falls back to printing the raw `redirect_uri` host — today
`https://pysflbhpnqwoczyuaaif.supabase.co/auth/v1/callback`. Brand verification requires proving
ownership of the authorized domain, and nobody but Supabase can prove ownership of `supabase.co`.
So the callback host must move onto `propertyiq.app` **before** branding can ever take effect.
Setting the App name alone is a dead end.

**Chosen fix (Troy, 2026-07-28):** Supabase Custom Domain (`auth.propertyiq.app`) + Google brand
verification. Rejected alternative: Google Identity Services + `signInWithIdToken` — free, but
re-plumbs the signup path just repaired in `6885741e`, and still needs brand verification anyway.

**Why this is low-risk:** no local JWT verification anywhere — every auth check goes through
`supabase.auth.getUser(token)` (`packages/backend/src/common/guards/jwt-auth.guard.ts:53`,
`optional-jwt-auth.guard.ts:34`, `packages/backend/src/analyzer/grade.controller.ts:71`). No pinned
issuer, so the issuer change from `*.supabase.co` to `auth.propertyiq.app` is inert.

## Sequence (order is load-bearing)

- [x] **1. Enable the Custom Domain add-on** — _Troy_ — DONE 2026-07-28
      https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/addons
      Variant `cd_default`, $10/mo fixed, prorated. Reversible via
      `DELETE /v1/projects/{ref}/billing/addons/cd_default`.
      (Claude is blocked from billing mutations by the permission classifier.)

- [x] **2. Register the hostname** — _Claude_ — DONE 2026-07-28
      `supabase domains create --project-ref pysflbhpnqwoczyuaaif --custom-hostname auth.propertyiq.app`
      then `domains reverify` to mint the DCV record. Cert is `dv`/`txt` from the Google CA; origin
      bound to `pysflbhpnqwoczyuaaif.supabase.co`. State: `2_initiated` / ssl `pending_validation`.

- [x] **3. Add DNS records in Cloudflare** — _Troy_ — DONE 2026-07-28, both resolve publicly.
      Grey-cloud confirmed: the DoH answer exposes the CNAME target rather than masking it behind
      proxy IPs. (Local nslookup returned nothing — the VPN resolver at 103.86.96.100 lies; always
      verify DNS here via `cloudflare-dns.com/dns-query`, not the system resolver.)

      | Type  | Name                   | Value                               | Proxy |
      | ----- | ---------------------- | ----------------------------------- | ----- |
      | CNAME | `auth`                 | `pysflbhpnqwoczyuaaif.supabase.co.` | **DNS only (grey cloud)** |
      | TXT   | `_acme-challenge.auth` | `TAeaA1ZAwRSNUlWArO1pjUsdJrK-2sBMUMsmdXLuxEA` | n/a |

      ⚠️ **Grey cloud, not orange.** Proxying makes Cloudflare terminate TLS with its own cert, so
      Supabase's managed cert is never presented and the hostname health check can fail. Not stated
      in Supabase's docs — this is the standard Cloudflare + managed-cert interaction, so confirm
      empirically at step 4 rather than trusting it blind.
      ⚠️ Cloudflare appends the zone automatically — enter `auth`, not `auth.propertyiq.app`.
      `auth.propertyiq.app` currently returns no address records, so no conflict expected.

- [~] **4. Verify DNS + cert issuance** — _Claude_ — DNS verified; cert issuing.
  `supabase domains reverify --project-ref pysflbhpnqwoczyuaaif`
  Cloudflare hostname `active` (DNS satisfied); ssl `pending_validation` with the DCV record at
  `processing` — Google CA has picked up the challenge. No `verification_errors`, no
  `validation_errors`, and **no CAA record** on the apex to block Google Trust Services, so
  there is nothing to fix — it just needs time. Do not re-`create` the hostname to "retry"; that
  re-mints the TXT value and invalidates the record already in DNS.

- [x] **5. Pre-authorize the new callback in Google** — _Troy_ — DONE 2026-07-28, **via a client migration**

      **Unplanned but mandatory detour.** The OAuth client Supabase was using
      (`777921019984-fv6iocd…`) lives in a Google Cloud project Troy has **no access to**
      (`resourcemanager.projects.get` missing; owning account unknown/unrecoverable). That blocks
      far more than this step: brand verification is configured on the consent screen of the project
      that **owns the client**, so branding could never have been submitted for it. The client had
      to move, or the whole plan dead-ends at the bare domain.

      **Migration performed:** new Web client `PropertyIQ Auth (Supabase)` =
      `1036757309323-tt88facqimuin1rqf0c98unihcd613tp.apps.googleusercontent.com` created in
      `propertyiq-488415` (a project Troy owns), with **both** callbacks registered up front:
      `https://pysflbhpnqwoczyuaaif.supabase.co/auth/v1/callback` and
      `https://auth.propertyiq.app/auth/v1/callback`. Credentials set via the Supabase dashboard by
      Troy (secret never entered the transcript).

      **Why this was safe for existing users:** Google's `sub` claim is unique per *Google Account*
      and never reused — it is NOT scoped per OAuth client or per Cloud project
      (developers.google.com/identity/openid-connect/openid-connect). So all 12 existing
      `auth.identities` google rows re-match on the new client; no orphans, no duplicates.
      (Counts at migration: 12 google identities, 24 email, first google link 2026-04-06.)

      **Verified live, not assumed:** `GET /auth/v1/authorize?provider=google` now emits the new
      `client_id` with the old `redirect_uri`, and Google returns its normal sign-in page rather than
      `redirect_uri_mismatch` / `invalid_client` — i.e. production sign-in never broke during the swap.

      ⚠️ **DO NOT strip the YouTube scopes.** (This corrects earlier guidance written here before the
      client was traced.) `propertyiq-488415` also holds the `Youtube test` client
      `1036757309323-8iib4bn3…` — which is **live production**, not an abandoned experiment: it is
      `YOUTUBE_OAUTH_CLIENT_ID` for `content-pipeline/drivers/youtube-longform-publisher.ts`, with
      `youtube.upload` + `youtube.readonly` and a working `YOUTUBE_OAUTH_REFRESH_TOKEN` deployed on
      Railway backend. Removing those scopes breaks long-form publishing. Same project number as the
      auth client, so they share one consent screen — unavoidable, not a mess to clean up.

      The "Your app requires verification" banner on the Audience page is **expected and harmless**:
      restricted scopes are granted only by Troy authorizing his own channel (OAuth user cap reads
      1/100 and will not move), while sign-in users request only `email` + `profile` and get the
      brand-verified screen. Verification would only be required if CUSTOMERS ever connected their
      own YouTube accounts — multi-tenant restricted-scope use, which triggers a third-party
      security assessment.

      🚨 **Never click "Back to testing" on the Audience page.** Testing mode expires refresh tokens
      after 7 days, silently killing `YOUTUBE_OAUTH_REFRESH_TOKEN` and breaking long-form publishing.
      "In production" is load-bearing for that token, not cosmetic.

- [x] **6. Activate** — _Claude_ — DONE 2026-07-28, status `5_services_reconfigured`.

      **The stall and how it cleared.** `ssl` sat at `pending_validation` / record `processing` for
      ~45 min. Ruled out, with evidence, before touching anything: no CAA on the apex OR on the
      CNAME target (RFC 8659 makes the CA follow the alias, so `supabase.co` mattered too); TXT
      byte-identical and visible from BOTH `dns.google` and `cloudflare-dns.com`; zone on Cloudflare
      NS. Nothing was misconfigured — it was pure Cloudflare/Google queue latency, and a repeat
      `domains reverify` cleared it. **Do not "fix" this by re-running `domains create`** — that
      re-mints the TXT value and invalidates the record already in DNS, resetting the clock.

      ⚠️ **Norton MITM makes local TLS checks lie here.** `openssl s_client` against the custom
      domain returns a cert issued by "Norton Web/Mail Shield Root", not the real one, so a local
      handshake proves nothing about public validity. Use `WebFetch` (fetches server-side, outside
      this machine) as the independent check — it returned HTTP 400 with no TLS error, proving the
      cert was publicly valid while Supabase's API still reported `pending_validation`.

      **Pre-flight before activating** (worth repeating on any future cutover): built the Google
      authorize URL by hand for BOTH redirect URIs and confirmed each returned the normal sign-in
      page rather than `redirect_uri_mismatch`. Proves the new callback is registered instead of
      trusting that it was saved.

- [x] **7. Point the frontend at the custom domain** — _Claude_ — DONE 2026-07-28. Shipped as
      `8abffe89`, released `1f0b3571` (§2.6 sync check = 0). Railway `frontend`
      `NEXT_PUBLIC_SUPABASE_URL` = `https://auth.propertyiq.app`; prod 200 in 0.85s after redeploy.
      **Gate used before flipping the var:** polled the LIVE `Content-Security-Policy` response
      header on `www.propertyiq.app` until it actually contained `auth.propertyiq.app` (9 checks,
      ~4 min) rather than assuming the deploy had finished. Reuse that gate for any env change with
      a code prerequisite. Adding the host rather than replacing `*.supabase.co` is also what made
      the rollout safe mid-flight — both origins were permitted the whole time.

      🚨 **HARD ORDERING: the CSP change must be DEPLOYED before the Railway var flips.**
      `packages/frontend/next.config.mjs:327` allowlists `https://*.supabase.co` +
      `wss://*.supabase.co` in `connect-src` / `img-src` / `media-src`. `auth.propertyiq.app` is NOT
      covered by that wildcard, so flipping `NEXT_PUBLIC_SUPABASE_URL` first would have had the
      browser block EVERY Supabase REST/auth/Realtime call — a total production outage, not just
      sign-in, and visible only in prod since the header is set at the edge. The wildcard is what
      hid the dependency: it silently covered every project ref, so it never read as hardcoded.
      Custom domain ADDED alongside `*.supabase.co` (not replacing it) because backend + mcp-server
      deliberately stay on the original host and may still mint storage URLs there.

      Also fixed: `packages/frontend/app/sw.ts` storage matcher keyed on
      `hostname.endsWith(".supabase.co")`. A custom domain moves storage off that suffix entirely,
      dropping those requests into `defaultCache` and resurrecting the documented opaque-response →
      `copyResponse` throw → synthesized 503 → offline-banner bug. Now derived from
      `NEXT_PUBLIC_SUPABASE_URL`, wrapped in try/catch because a throw at SW module scope aborts
      service-worker installation outright.

      Railway `frontend` → `NEXT_PUBLIC_SUPABASE_URL` = `https://auth.propertyiq.app`, redeploy.
      Leave `backend` (`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`) and `mcp-server` (`SUPABASE_URL`)
      on the original host: server-to-server, never user-visible, and pinning them limits blast
      radius if the custom domain has a cert hiccup. Both hosts are interchangeable per docs —
      confirm cross-host token validation at step 9.
      `SUPABASE_DB_URL` is the direct Postgres host (`db.*.supabase.co`); custom domains do not
      cover it. Do not touch.

- [x] **8. Branding + brand verification** — _Troy_ — DONE 2026-07-28, **already verified**.
      App name `PropertyIQ`, PIQ logo, support email set on `propertyiq-488415`; Google reports
      "Your branding has been verified and is being shown to users." The expected multi-day
      verification wait never materialised — an accidental payoff of the step-5 client migration,
      since the destination project was already brand-verified. This is why the fix landed the same
      night rather than days later, and it also moots the YouTube-scope warning above (verification
      already cleared, nothing to strip).

      **PRIMARY GOAL ACHIEVED — verified on Google's live response, not inferred:**
      consent HTML went from `pysflbhpnqwoczyuaaif.supabase.co` ×10 / `auth.propertyiq.app` ×0
      to `auth.propertyiq.app` ×10 / `pysflbhpnqwoczyuaaif.supabase.co` ×0, with `PropertyIQ` ×4
      throughout. Both entry hosts emit `redirect_uri: https://auth.propertyiq.app/auth/v1/callback`.
      Note this needed NO frontend deploy: GoTrue derives the callback from the project's external
      URL, so activation alone flipped it. Step 7 is polish, not the fix.

- [x] **8b. Remove the stale redirect URI** — _Troy_ — DONE 2026-07-29. Verified by probing BOTH URIs
      directly against Google: `auth.propertyiq.app` → normal sign-in page; the old
      `pysflbhpnqwoczyuaaif.supabase.co` → `redirect_uri_mismatch` / Error 400. Inverted results
      would have meant the wrong row was deleted, so probe both, never just the survivor. Live flow
      unaffected. **The rollback is now gone** — a custom-domain revert would additionally require
      re-adding the old URI in Google first.
      Drop `https://pysflbhpnqwoczyuaaif.supabase.co/auth/v1/callback` from the Google client. Kept
      deliberately until now: it is the rollback path, and it must be gone before any FUTURE
      verification submission because Google requires every redirect URI to sit under an authorized
      domain you can prove ownership of — which `supabase.co` never can be.

- [x] **9. Verify end-to-end** — _Claude_ — DONE 2026-07-28. **Real user, not synthetic:** the same
      person whose screenshot opened this task re-ran sign-in and saw "Sign in to PropertyIQ" with
      the PIQ logo and zero Supabase hash. Server side, `auth.users` shows a NEW google user with
      `created_at = last_sign_in_at = identity.last_sign_in_at = 2026-07-28 22:57:31Z` — full round
      trip (consent → callback → user row → identity link → session).
      **GA4 confirms the analytics path:** `sign_up` ×3 on 2026-07-28, ALL with
      `customEvent:method = oauth` — the `6885741e` repair survived the client migration, which was
      the single largest regression risk in this change.

## Verification checkpoints

| After step | Must be true                                                  |
| ---------- | ------------------------------------------------------------- |
| 4          | `supabase domains get` reports the hostname verified          |
| 6          | Consent screen shows `auth.propertyiq.app`; sign-in completes |
| 7          | Frontend sign-in works; backend API calls still authorize     |
| 8          | Consent screen shows `PropertyIQ` + logo                      |
| 9          | `signup_complete` / `method=oauth` present in analytics       |

## Rollback

Steps 2–4 are inert until activation. After step 6, `supabase domains delete` reverts to the
`*.supabase.co` host; the Google client still carries the old redirect URI (step 5 keeps it), so
sign-in survives the revert. Step 7 reverts by restoring the Railway var and redeploying.

---

# Remotion Composition Upgrade — Motion, Tokens, Audio Mix (2026-07-28)

Directive: upgrade all active Remotion compositions (Reels/Shorts pipeline) to the brand
motion language + a real audio mix, as shared reusable utilities (not per-composition
fixes), then document the standards in the video pipeline SKILL.md. Branch `develop`
(commit locally; never push without ask).

## Plan

### Phase 0 — Discovery

- [x] Locate Remotion project root, all active compositions, current animation patterns (`packages/video-template`, 9 compositions, 13 bespoke springs + ~30 raw linear interpolates)
- [x] Locate Edge TTS narration path, audio insertion, existing assets, SKILL.md (backend driver chain, one-blob synthesis, zero mix assets, `Skills/youtube-production/SKILL.md`)

### Phase 1 — Shared motion system

- [x] Motion utility module `src/motion/` (SPRINGS presets, M3 EASINGS, STAGGER_FRAMES=4, hooks)
- [x] `<AnimatedEntrance>` wrapper: spring-in + 1.05→1.0 settle + index-based stagger
- [x] Signature motif: `ScoreRing` dial spin-up (counter spring + endpoint glow pulse) adopted by ScoreReveal, Comparison, BrandOutroCard
- [x] Audit complete: no raw linear interpolate remains on visible motion; surviving interpolates all carry EASINGS curves
- [x] Stagger applied wherever siblings animate (stat cards, ranking rows, comparison columns, farm grid)

### Phase 2 — Brand token enforcement

- [x] `src/styles/tokens.ts` (PALETTE, 1.75px borders, 8% fills, tabular-nums, chart rules); COLORS + style-variants rewired onto it; zero hex literals in components
- [x] Fonts self-hosted (`public/fonts/` variable woff2 + `loadBrandFonts()` with delayRender) — Railway render container has no Roboto
- [x] Asymmetric layout pass (ScoreReveal off-center dial + overlapping momentum pill, StatCards hero mosaic, Intro lower-third) + MeshBackground depth (blooms + grain) mounted per-layout
- [x] TrendChart rebuilt to Robinhood spec: line draw-in with exact tip tracking, endpoint glow pulse, range pills, scripted scrub, no gridlines (dashed 50 baseline only)

### Phase 3 — Audio production

- [x] `src/audio/` — AudioMix (music bed + room tone + narration + SFX), sidechain duck from captionWords (attack 8f / release 20f / hold 600ms)
- [x] SFX cues frame-locked to layout beat tables (`sfx-cues.ts` imports the same beats layouts render from); deterministic WAV asset generator (replace with licensed files, same names)
- [x] Loudness: narration loudnorm'd backend-side to -16 LUFS; all in-comp gains from AUDIO_LEVELS
- [x] TTS segmentation (backend): sentence-split clips + 200-500ms pauses + ffmpeg concat + loudnorm; per-segment word-timing offsets (drift resets each boundary); ffmpeg-absent → exact legacy fallback. 690 content-pipeline tests green, tsc clean.

### Phase 4 — Documentation + verification

- [x] SKILL.md updated: Step 6 (segmented pipeline TTS), Step 7b (template exists + REQUIRED composition standards), coverage-copy fix
- [x] Verification: build:cli clean; backend plain tsc clean; content-pipeline jest 690 passed / 1 pre-existing skip; snapshot baselines regenerated (55 PNGs, 8 suites / 60 tests) and determinism proven on a second full run
- [x] Review section below

### Pre-existing bugs found & fixed along the way

- Brokerage/recruitment narration desync: beats scaled the 2s bumper to 5-6s while narration always starts at frame 60 — bumper now fixed at 60f (`NARRATION_START_FRAME`), content beats stretch to fill
- Intro/Outro exit fades anchored to unscaled frames → scenes went invisible mid-slot in scaled formats + HeadToHead (`durationInFrames` props added)
- Outro "Explore 400+ scored markets" retired raw coverage count → countless copy; SKILL.md "40,000 markets" → sanctioned 900+/3,000+/29,000+ phrasing
- ScoreReveal/Comparison badges rendered legacy quality-word `grade` from the bundle → momentum ladder (CLAUDE.md §9)
- Edge TTS Windows cmdline-length latent bug sidestepped by short per-segment texts
- Dead code deleted: RankingRow, MetricValue, DeltaDisplay, compositions/factory.ts; package.json render script ids fixed (grade_reveal → grade-reveal)

## Review

Shipped on `develop` (local only, NOT pushed): `89b18147` (video-template) +
`4d93313b` (backend TTS) + docs commit. Four §1.6 review passes ran; every
CRITICAL/WARNING was fixed and re-verified (narration-over-bumper desync in
scaled formats; audio-vs-wall-clock bitrate domain mix; DOM.Iterable tsconfig
lib for FontFaceSet).

Architecture notes for future sessions:

- One timing source per family: layouts AND sfx cues read the same beat
  tables (`grade-reveal-beats.ts`, `SCORE_MOVER_BEATS`, `FARM_AREA_BEATS`,
  `computeRankingTiming`) — never hardcode a cue frame.
- `NARRATION_START_FRAME` (60) is a backend contract (audio budget =
  duration − 2s buffer). Opening bumpers must stay 60 frames in every format.
- Audio assets are generated (deterministic script); drop licensed
  replacements onto the same filenames in `public/audio/`.
- Snapshot baselines re-mint automatically when deleted; always run the
  suite twice (mint + determinism) after motion changes.
- Standards documented as REQUIRED in `Skills/youtube-production/SKILL.md`
  Step 7b — point future composition work there first.

Known limits (deliberate): head_to_head/long-form/rankings get bespoke cue
plans only where their beat tables allowed; other formats fall back to
scene-change bookends. Inserted TTS pauses (~0.3s/sentence) count against
the audio budget — `silence_ms` in `synthesize_audio_done` makes overflow
attributable; `SENTENCE_BREAK_MS` is the single tuning knob if repair-loop
rates rise. A real rendered-video listen/watch on a live run is the one
check no test covers — do it on the next pipeline run.

---

# Content Pipeline (SocialAuto) — Purpose Taxonomy + Mix Rotation + Lane A/B Bridge (2026-07-27)

Full design: `docs/superpowers/specs/2026-07-27-content-purpose-taxonomy-design.md` (approved by Troy 2026-07-27, session with Claude). Branch `develop` (commit locally; never push without ask).

## Immediate (unblocked, ready now)

- [ ] Commit the already-implemented, already-tested feed rotation bug fix (`FeedService` split into `FeedService`/`FeedTopUpService`, `PostsService.countAll()`, offsets both post-type and candidate-market selection by a monotonic cursor instead of resetting to 0 every cron tick — fixes the observed 7 linkedin_post/2 facebook_post/1 carousel_copy/0 video_script skew). 76 backend tests pass, tsc clean, two independent code reviews (APPROVE). NOT yet committed as of 2026-07-27.
- [ ] Write an implementation plan for the taxonomy/mix/bridge design (next step after Troy reviews the spec doc) via the writing-plans skill.

## Deferred, sequenced (Troy's explicit ordering, 2026-07-27)

- [ ] **Spec 2 — Stories as a new content format.** No format/template/Late-publish path exists today; the `trust` pillar is reserved with zero formats mapped to it in Spec 1's data model so this slots in later without scheduler changes. Open unknown to resolve when this spec starts: does Late's real API even support publishing to IG/FB Stories (not modeled anywhere in `late-client.types.ts` today, feed-post-only).
- [ ] **Spec 3 — Trend-awareness in generation** (after Spec 2). Model what's currently trending per platform (TikTok trending sounds/hashtags, Instagram trending audio, X trending topics) and feed that into generation prompts. Needs its own trend-data ingestion pipeline — genuinely separate subsystem, not a prompt tweak.

## Identified but not yet actioned (from the 2026-07-27 content-pipeline audit — do not lose these)

- [ ] **Infographics lane is structurally blocked, not just under-automated.** NotebookLM has no service-account/programmatic auth path (`create-infographic-run.ts:20-24`) — can never run server-side as-is; would need a different generation engine entirely (e.g. repurpose the post-image Puppeteer stack). Separately, only 1 of 6 topics in `infographic-topics.ts` is `vetted:true` — the other 5 can't generate even via the manual local worker today.
- [ ] **Archetype router needs Troy's actual editorial policy.** `archetype-router.service.ts:17-33` is an intentional stub with a sane fallback (picks by `median_view_count` per format, else null) — not broken, just missing a real rotation/curation policy decision.
- [ ] **TikTok publish path bug** (found 2026-07-27, deprioritized in favor of content-creation work): `late-client.service.ts:205-210` — TikTok photo/carousel posts need `tiktokSettings` consent flags that aren't sent; will fail visibly on any TikTok image post once TikTok is connected via Late.
- [ ] **Only Facebook connected via Late** as of 2026-07-25 — Instagram/TikTok/LinkedIn/X all need Connect clicked in `/admin/content-pipeline/platforms`, each requiring Troy's own login to that network.
- [ ] Analytics/Insights is stale (`content_metrics`: 5 rows, all `views:0`, latest `pulled_at` 2026-04-27) because nothing's published since April — not a bug, resolves itself once Lane A/B publishing resumes. No action needed unless it's still flat after this project ships.

---

# Deferred: /markets/ SEO pages — remove mislabeled "Data confidence" badge (2026-07-26)

Fold into the next monthly /markets/ pages update (user decision 2026-07-26 — do NOT ship standalone).

- [ ] Remove the letter badge from `packages/frontend/app/(public)/markets/components/MarketStatsBlock.tsx` (badge block ~lines 107-115 + now-unused `gradeClasses`). It renders `data.grade` labeled "Data confidence" — but `grade` is the score itself on an academic scale (`scoreToGrade(score)`, `formula-weights.ts:187`), NOT confidence. Live proof: Sierra Vista metro 43420 = score 23 / grade F / confidence 100 / confidence_level A.
- [ ] Also drop `grade` from the snapshot passthrough for this surface (`processScores` in `packages/backend/src/market-snapshot/market-snapshot-assembler.helper.ts:189`, `market-snapshot.types.ts`, `MarketStatsData.grade` in `lib/data/fetchers/market-stats.ts`) so the academic score-letter can't be mislabeled again (CLAUDE.md §9: no quality-letter framing of the score; confidence is the only letter).
- [ ] Note: SEO pages ISR-cache 24h + Redis snapshot cache — badge disappears on next revalidation after deploy.

---

# PWA / Phone-App Build — 2026-07-12

Branch `worktree-PWA` (user-requested worktree). Full analysis + plan: `docs/plans/2026-07-12-propertyiq-phone-app-analysis-and-plan.md`.

## Phase 1 — Standalone correctness core (P0)

- [x] **1.1** History-API back handling (9 modals/sheets wired, desktop-gated RightDetailPanel) — 9dc8a1ec + dcdf8be9, re-reviewed ✅
- [x] **1.2** Skeleton screens matching final dimensions (map/market/graphs loaders + MetricCard/StatCard/ScoreWidget) — 27f22bc4, reviewed ✅ (follow-up: GraphsPageV2 internal spinners)
- [ ] **1.3** Serwist SW foundation (next.config wrapper, app/sw.ts, NO auto-skipWaiting) + update toast ("New version available, tap to refresh")
- [ ] **1.4** Branded `/offline` page (M3)
- [ ] **1.5** Middleware `/sw.js` matcher exclusion

## Phase 2 — Install experience

- [x] **2.1** Manifest completeness (id, shortcuts, maskable icon, display_override, categories) — 52e7b686, reviewed ✅
- [x] **2.2** appleWebApp block + black-translucent status bar — dc9394a0, reviewed ✅ (header `pt-safe-standalone` class = controller integration, pending)
- [x] **2.3** iOS splash screens (8-device sharp matrix, 759KB) — dc9394a0, reviewed ✅
- [x] **2.4** Install prompt UX (value-moment banner, iOS instructions, "Get the app", appinstalled→GA) — d376dff5 + 4b7fe98f, re-reviewed ✅ (mount = controller integration, pending)

## Phase 3 — Native feel + navigation

- [x] **3.1** Bottom tab bar (M3, always on mobile, reuse header-nav-data) — 1e773f58, reviewed ✅ (mount = controller integration, pending)
- [x] **3.2** Touch CSS resets + **3.4** safe-area utils + **3.5** dvh migration (12 pages) — d376dff5, reviewed ✅
- [ ] **3.3** 44px touch targets · **3.4** safe-area sweep · **3.5** dvh migration
- [ ] **3.6** Haptics · **3.7** dynamic theme-color · **3.8** View Transitions
- [x] **3.9** Hover→touch fallbacks (ConfidenceDisplay, RichTooltip, MetricTooltip, base Tooltip) — 911c8334+ceb07881+e2c6a6e6, approved ✅ · **3.10** keyboard occlusion — `interactiveWidget` shipped in 2.2 (dc9394a0)

## Phase 4 — Offline + caching (WAVE 2, merged direct to develop 2026-07-12)

- [x] **4.1** SW SWR on /backend GETs (controller-verified public allowlist + private/no-store backstop + sign-out purge) — 22b40fb2+411e83d2, reviewed ✅ · **4.2** RQ persister (IndexedDB, mutation-dehydration blocked, sign-out purge) — 829a2510+78c4d428, reviewed ✅
- [x] **4.3** CachedDataBadge (market header + report viewer) · **4.4** GeoJSON CacheFirst — 8ca43300/22b40fb2, reviewed ✅
- [x] **4.5** useOnlineStatus + OfflineBanner (mounted a70e71aa, z-fix c729c173) + map honest-failure · **4.6** /map first-load −56% (923→405KB gzip) + bundle analyzer — 8ca43300/5e369e78/346a50f9, reviewed ✅

### Wave-2 extras (same day)

- [x] Anon report-generate showed PRO paywall instead of "Sign up free" (conversion bug, pre-existing) — e00d3351, e2e-proven ✅
- [x] GraphsPageV2 spinners → skeletons — 93e6987c+4858d04f ✅ · SW snackbar dismiss + nav offset — 485bb2bf ✅ · Skeleton.tsx split (skeleton-parts/, case-collision resolved) — 51c45a9f..695a543b ✅ · useDismissableOpen extraction + confidence testids — 556603da ✅

### Follow-up tickets (final wave-2 review, deduped)

**Soon:** star-threshold mismatch (getStarCount 90/80/70/55 vs e2e fixture 90/70/55/40 — 2 e2e asserts can't pass); CI blind to ALL TypeScript errors (`ignoreBuildErrors:true` + eslint-only CI + Linux runners — the skeleton case-collision proved it); Playwright setup-project auth fixtures broken (enterprise + P1-signoff login timeout).
**Someday:** delete dead report path (ReportViewerRefined/SectionRenderer/orphaned chart sections — recharts lazy-load was a no-op on it; also clears legacy investoredge/homeready refs); remove dead deps docx+pptxgenjs; formatRelativeTimeShort dedup (3 copies); useMapLayers 333>300 split; Tooltip.tsx 4-export split; GraphsPageV2 924-line split; InstallBanner×snackbar bottom overlap; SW snackbar exit-fade; SW score-prefix anchoring; skeleton shim TS1149→TS1261 comment; SR-only race-mode labels.

## Phase 5 — Auth hardening, capabilities, stores

- [x] **5.1** OTP password reset · **5.2** magic-link code alternative · **5.3** standalone-aware auth UX — 80c3a5ad + 84d678c1 (backend hook emails now carry the code; Supabase dashboard edit NOT needed — templates unused), reviewed ✅ (GATES: live signup-chain e2e pre-merge; visual email check post-deploy)
- [x] **5.5** Push + Badging (WAVE 3, direct on develop 2026-07-12) — `PushModule` (subscriptions table, DTO length caps, 10-per-user cap w/ LRU eviction, chunked fan-out) 65287238+466fc095; frontend SW push/notificationclick handlers + `use-push-subscription` hook + `PushOptInPrompt` mounted in-context bb664db9+92e14f01; App Badging API — backend `getUnreadCount()` → `badgeCount` on both alert-fire paths (alert-processor + threshold-alert services), SW `setAppBadge()` on push receipt, `/alerts` page `clearAppBadge()` on view. Backend push/alerts Jest (43 tests) + frontend PWA push Vitest (66 tests) + `tsc --noEmit` all verified green.
- [ ] **5.4** Web Share API · **5.6** Play TWA ($25 gate) · **5.7** iOS store (DEFER)

### Wave-3 extras (same day, bugs surfaced while wiring push into alerts)

- [x] `createAlert`/`updateAlert` writing against stale `user_alerts` columns — c1e080b5 · alert read/filter using DTO field names instead of live schema — 5f591875 · unread-count bug + orphaned alert UI never mounted — 42cf0c32 · geography+value threaded through MetricCard's alert bell — 1a28b204
- [x] Weekly digest silently emptying its alerts section (`42703` from live-column-alias mismatch) + surfaced query errors — ca6367c9
- [x] Confidence-star e2e fixture threshold mismatch (fixture now delegates to component's own `getStarCount`, SSOT) — 6d835b4d
- [x] Dead `ReportViewerRefined` report path + unused docx/pptxgenjs deps deleted — bd9b3108 · `Tooltip.tsx` + `useMapLayers` file-size splits — b84973b2 · `typecheck-frontend` CI gate added — b2734076 · e2e setup-fixture auth timeout hardening — b0a99aca

**Not yet done:** 16 commits sitting local-only on `develop` — not pushed to `origin/develop`, not released to `main`.

## Review

**FINAL VERDICT: READY-TO-MERGE** (whole-branch review, 2 rounds). 20 commits on `worktree-PWA`. Every task individually spec+quality reviewed (5 fix rounds total across 1.1/1.3/2.4/3.9/final). Verification: prod build green ×3; 14/14 live Playwright chrome checks @390×844; SW offline E2E (real offline nav → branded page, /backend uncached); full vitest 1289 passed, 24 fails all pre-existing (triaged: 54 env-gated files + 5 stale tour mocks — zero wave-caused); collision fixes live-proven.

**Highest-value catches by the review loop:** (1) /offline was never in the SW precache (manifest freezes pre-prerender) — offline fallback was dead until fixed; (2) first-install surprise reload (clientsClaim + ungated controlling); (3) Supabase dashboard templates are a NO-OP — OTP codes now injected in the backend Resend hook (recovery + magic-link); (4) four bottom-bar collisions with the new nav on money pages; (5) tap-inside-tooltip self-close across 4 components.

**Remaining gates (user-visible):** run live `tests/e2e/signup-chain.spec.ts` against the worktree stack pre-merge (auth refactor guard); visual smoke of reset/magic-link emails post-deploy; real-device install checks (Android WebAPK, iPhone A2HS).

**Follow-up tickets:** /graphs breadcrumb+footer residual scroll + /reports/builder header overflow (pre-existing); SW snackbar dismiss + nav overlap; Skeleton.tsx split; middleware.ts over-limit; GraphsPageV2 internal spinners; dead wave animation; orphaned confidence-\* e2e testids; useDismissableOpen extraction; Playwright in CI; StickyScoreBar forced-mount test; confirm landing-v2 intentionally omits sticky bar; landing-experiment code cleanup once LANDING_EXPERIMENT=on bakes.

---

# GEO Top-5 Fixes — 2026-07-08 (from GEO-ANALYSIS.md)

Branch `develop` (commit locally; never push without ask).

## Plan

- [x] **G1** Claim contradictions FIXED: ValuePropsSection body → transparent 4-signal formula copy; /about ×5 ML-claim rewrites + "production data systems"; milestone "models trained"→"formula built"; JsonLd featureList → COVERAGE_COPY.sentence; layout.tsx root meta description → COVERAGE_COPY.sentence (was raw 935/3,137/29,417).
- [x] **G2** llms.txt: new `scripts/generate-llms-txt.ts` + `scripts/lib/llms-txt-template.ts` (fail-closed, COVERAGE_COPY-sourced, live pricing); `seo:generate-llms` npm script chained into `seo:rebuild-slugs`; post-import-refresh.yml commits the files; both files regenerated ($39 Pro / $149 Enterprise from live API — "Team $99" never existed in DB). BONUS stale-$29 fixes: PersonalizedPaywall CTA (price dropped), PlanComparisonCards (wired usePricingTiers), account-page e2e assertions. Homepage JsonLd offers now pricing-live via new `fetchPaidTierOffers` (ISR 1h, tag piq-pricing) — omits paid offers on fetch failure.
- [x] **G3** Market FAQ: `build-market-faqs.ts` (5 momentum-framed Q&As, 128-162 words, null-gated) + `MarketFaqSection.tsx` (FAQPage JSON-LD, ≥3 gate) on metro/county/zip pages; score labels extracted to `score-labels.ts` (re-exported from ScoreDisplay, 33/33 tests pass).
- [x] **G4** SSR narrative: backend `getCachedInsight` + `cachedOnly` param (never generates — cost guardrail verified by review); frontend `fetchCachedInsight` (ISR, null-safe) → metro page → `initialInsight` prop; client fetch disabled when server-provided. + DTO-audit fixes: geoLevel/type/archetype/blog-type allowlist validation on ALL insights endpoints (2 pre-existing CRITICALs closed).
- [x] **G5** Entity: sameAs → real LinkedIn (`/company/propertyiq-app/`) + YouTube + Facebook (user-provided); removed uncontrolled `@propertyiq` twitter creator handle; safeJsonLdString escape helper (JsonLd + OrganizationJsonLd). MANUAL follow-ups for user: Wikidata item, Reddit presence, Search Console reindex of stale snippets, claim FB vanity URL.
- [~] **G6** Verify: backend tsc ✓; frontend tsc ✓ (×2); frontend vitest score-labels ✓; production build: Turbopack (Next 16.1.6) fails locally resolving `@propertyiq/analyzer-core` (Windows/Turbopack quirk — Node resolves it fine, dist rebuilt, Railway Linux builds unaffected); webpack build running as cross-check; then no-JS HTML render check on :3100.

## Review

All 5 GEO issues implemented; ~14 code-review/security/DTO/data-layer validation passes across the surface, all findings fixed (dangling import, raw counts in root meta, ML phrasing, 2 pre-existing controller CRITICALs, JSON-LD `</script>` escape). Coupling note (user to confirm): `seo:generate-llms` appended to `seo:rebuild-slugs` chain means a pricing-API outage fail-closes the monthly slug rebuild step.

---

# Mobile + cross-platform tour/reports fixes — 2026-06-20

Root causes confirmed via parallel Explore agents + direct file reads. Six bugs.
Branch `develop` (commit locally; never push without ask). All UI follows M3 brand
(CLAUDE.md §8): semantic tokens only, no hardcoded hex; Roboto / Roboto Mono /
Source Serif 4. Verify each LIVE at mobile viewport 375×812 (no mocks).

## Bug inventory & root cause

1. **(mobile) Persona boxes too big, text unreadable, must scroll, stray "For you" badge**
   - `tour/components/PersonaCard.tsx`, `PersonaCards.tsx` — `p-5`, `text-xs` tag/bullets, low-contrast `text-on-surface-variant`; tall vertical cards w/ bullets+button → 3 don't fit one mobile screen. `priority` renders a tertiary "For you" badge on the agent card.
2. **(mobile, CRITICAL) Homebuyer shown agent "listing presentation / farming" finale**
   - `backend/.../listing-presentation-narrative.service.ts:20` SYSTEM_PROMPT hardcoded "for a real estate agent"; persona only in user prompt. Finale + sections identical for all personas. **DECISION (user): build 3 fully distinct finales.**
3. **(mobile) Typed text in inputs unreadable (should be black/on-surface)**
   - `tour/components/InlineSignupForm.tsx:101,111` + `MarketPickerStep.tsx:73` missing `text-on-surface`; MarketPicker also hardcodes `bg-white`. `onboarding/QuizStep.tsx:284` already correct (reference).
4. **(mobile) Finale "compare vs peers" shows 3 cards but no numbers**
   - `backend/markets/peers.service.ts` returns only `{name, score, householdCount}` — no price/growth/DOM/sold-above. `tour/.../listing-sections/adapt-sections.ts:116,193` passes raw through; `Peers.tsx:54-57` reads non-existent fields → blank.
5. **(mobile + web) Tour finale re-runs on browser Back**
   - `tour/components/Step4Aha.tsx:42-54` fires a React Query _mutation_ every mount when `isIdle && persona && market`; `mutation.data` never persisted → regenerates on back-nav.
6. **(mobile + web) /reports comparison: hard to read on mobile + collapses to first market**
   - `ReportViewer.tsx:239-244` routes non-v2 comparisons to `ComparisonHeroShowdown.tsx` which `.slice(0,2)`, hardcodes a 2-up `VS` grid, and reads DEAD legacy scores (`homeready_score`/`investoredge`) → comparison markets show "No Score". User: even 2 is unreadable on mobile. Needs live PropertyIQ score + N markets + mobile-first layout. (`comparison_v2`/`ComparisonHero.tsx` already handles 3+ — evaluate routing all comparisons there.)

## Finale specs (#2 — user chose "fully distinct")

- **AgentFinale** = current listing-presentation (verdict + 10 sections + branded/share CTA). Keep.
- **HomebuyerFinale** — "Should you buy in {market}?" Hero: buyer verdict + affordability headline (median price, est. monthly payment). Sections: Can you afford it · 12-mo forecast (your equity) · Rent vs buy break-even · Lifestyle/jobs/who's moving in · Similar markets · How competitive (DOM, % over ask). CTA: get pre-approved / target neighborhoods / save.
- **InvestorFinale** — "Is {market} a good investment?" Hero: demand signal + investor verdict + cash-flow/appreciation snapshot. Sections: Cash flow (yield) · Appreciation forecast · Rent trends · Comparable cashflow markets · Demand drivers (migration/employment) · Deal analyzer. CTA: analyze an address / top cashflow markets / save.
- Backend: per-persona narrative SYSTEM_PROMPT. Frontend: route `Step4Aha` → finale by `session.persona`.

## T6 redesign (user spec 2026-06-20, REVISED after live review)

FINAL requirements (user was clear after seeing v1 fall short):

1. Like-geo restriction — DONE + verified live (first pick locks metro/county/zip).
2. SUMMARY at top must SYNTHESIZE the comparison in PROSE (AI: "Denver leads on
   momentum, Austin is most affordable, Phoenix…") — NOT a wall of metric cards.
3. Each market's TAB = a FULL report, as deep as an individual single-market
   report. Requires BACKEND change: fetch full data set + generate an AI narrative
   for EVERY comparison market (today comp markets only get score+metrics+history
   → shallow). Reversal of the earlier "data-driven, no backend" choice; user
   accepts longer/costlier generation (N full reports + 1 synthesis per report).
4. TABS: frozen/sticky (don't scroll away so switching is easy); SHORT labels
   (lead city, e.g. "Austin-Round Rock-San Marcos, TX" → "Austin") — NO overflow.
5. Mobile AND web (v1 was shallow on both).

STATUS 2026-06-21: Per-market FULL reports WORK (user confirmed full reports for
both Chicago + Austin in the tabs; Market Pulse shows news from both). Frontend
(synthetic per-market report → single-market template) + backend fork (per-market
narrative + data + per-comparison news) = DONE, tsc clean, NOT committed.
REMAINING = the cross-market SYNTHESIS only (report.ai_narrative): it's fed the
PRIMARY's data for the comparison slot, so the AI says "only one market / metrics
repeat the primary" and can't actually compare; news/indicators primary-only;
verdict_and_actions empty. Diagnosing now (agent), then fix + regenerate.

SYNTHESIS-QUALITY fixes (user, after seeing the rendered synthesis): 6. Head-to-head + economic indicators in the synthesis use ONLY the primary geo's
news/indicators → must incorporate ALL markets' news + economic indicators
(backend now fetches per-comparison news, so feed all markets into the
comparison narrative template vars + prompt). 7. The comparison "Verdict & actions" section must NEVER render "insufficient
data" — always produce a real verdict + actions (robust generation + a
deterministic non-stub fallback).
(These live in the comparison narrative path — buildNarrativeTemplateVars + the
comparison prompt + V2 verdict/actions section. Handle in the backend pass AFTER
the fork lands; do not edit that code in parallel with the fork.)

v1 (shipped to working tree, NOT committed): ComparisonReportV3 + summary cards +
thin data-driven deep-dive + marketBundles defensive score accessor. The score
accessor + geo-restriction + routing/wiring are KEEPERS; the summary + deep-dive
get rebuilt for depth + synthesis. Backend (reports-orchestrator/narrative) must
generate per-comparison-market full data+narrative + a comparison-summary.
Investigations running: frontend section reuse + data gaps; backend gen flow.

## Tasks (sequence: quick wins → big builds)

- [x] **T1** #1 Persona cards — DONE + verified @375: "For you" badge removed; mobile-compact horizontal cards (3 fit one screen, no scroll); bold high-contrast titles + chevron affordance; richer desktop card preserved; fixed pre-existing "Continue as an" grammar bug.
- [x] **T3** #3 Inputs — DONE + verified @375 (typed "Austin, TX" renders dark): `text-on-surface` added to InlineSignupForm ×2 + MarketPickerStep; MarketPicker `bg-white`→`bg-surface`. Both onboarding inputs already correct.
- [x] **T5** #5 Finale persistence — DONE + verified. New `tour/lib/reportCache.ts` (sessionStorage, keyed persona+geoId); `Step4Aha` restores on mount + persists on success, gated so it never races/re-fires; cache cleared on `?resume=fresh`/reset. 22 tour tests pass incl. new persistence test. Live: seeded cache → finale renders from cache, ZERO network POST. NOTE: live full-generation blocked by anon 1/IP/24h 429; restore mechanism verified live, write-on-success unit-tested.
- [x] **T4** #4 Peer numbers — DONE + verified live. New `ListingPresentationPeersService.buildPeers` enriches peers via MetricResolutionService; `adaptPeers` formats them; peer cards show name + scoreLabel + median price + 12-mo growth + days-on-market + sale-to-list. ROOT CAUSE also found+fixed: orchestrator used unregistered IDs `dom_median`/`pct_sold_above_list`/`sale_to_list_ratio` (always null) → corrected to `days_on_market`/`sale_to_list` in both peers AND source market-now (+ adapter METRIC_FORMAT + Peers "Sale-to-list" relabel). Added ref-guard in Step4Aha so the generation fires once (dev StrictMode was double-firing → 429). Backend tsc clean; 86 frontend tests pass. Live (Phoenix): all 4 peer metrics + market-now DOM/sale-to-list render real numbers.
- [~] **T6** #6 Comparison — BUILT + typechecks + logic-tested; authed LIVE render pending. (1) Like-geo restriction live in `MarketSelector` (page.tsx): first market locks the level via `filterByGeoLevel` + dropdown filter + add guard. (2) New comparison view replaces the dead-legacy-score sections: `ComparisonReportV3` = `ComparisonSummaryV3` (all markets compared, live PropertyIQ score + metrics + winner, mobile-first cards) + per-market `PillTabs` -> `MarketDeepDivePanel` (score + 3 drivers + trajectory sparkline + metrics grid). `marketBundles.ts` defensively reads the live score from BOTH nestings (primary `scores.propertyiq` cleaned vs comparison `scores.scores.propertyiq` raw) so no market shows "No Score". Wired via templates/index.ts (`comparison` template = single ComparisonReportV3) + ReportViewer routes all comparisons there. Frontend tsc clean (only pre-existing .next-verify artifact error); 4 ComparisonReportV3 tests pass (both nestings resolve, winner, tabs, fallback). PENDING: authed live /reports render @375 with 2 & 3 markets — blocked by Playwright profile lock (headed mobile-preview window) + auth. Pre-existing file-size debt noted: page.tsx 1104 / ReportViewer 477 (both over 400; not split here).

  (original scope notes:) SCOPE CLARIFIED via investigation. The active `comparison` template uses `ComparisonHero` (already handles N markets) — `ComparisonHeroShowdown`'s `.slice(0,2)` is DEAD CODE (not in any template; red herring). REAL root cause: ALL comparison sections (ComparisonHero, HeadToHeadScoreStory, ComponentShowdown, MarketStrengths, ComparisonVerdict) read DEAD legacy scores `report.homeready_score`/`investoredge_score` + `comp.scores.homeready/investoredge` → every market shows "No Score" (looks like only-first-market). LIVE score = `report.propertyiq_score` + `comparisons[geoId].scores.propertyiq.score`. FIX = migrate those reads to PropertyIQ + mobile-readability pass on the comparison sections (tables/gauges). Then verify @375 with 2 & 3 markets.

- [x] **T2** #2 Three distinct persona finales — DONE + verified live (Phoenix, all 3 personas, single 201 each). Shared `finale/FinaleScaffold.tsx` (config-driven: section order + hero eyebrow/label + AI-strategy voice); `ListingPresentation` refactored to a thin Agent config (tests still pass); new `HomebuyerFinale` (affordability/forecast-forward, "For Homebuyers", "Your buying strategy") + `InvestorFinale` (cash-flow/appreciation-forward, "For Investors", "Your investment strategy"); `ReportHero`/`AiStrategy` got optional persona props; `Step4Aha` routes by `session.persona`. Backend persona narrative confirmed: buyer verdict is buyer-voiced, investor verdict investor-voiced, NO agent/farming framing. 53 finale tests pass. NOTE: InlineSignupForm CTA copy ("share with your client") is still agent-leaning — minor follow-up, separate from the finale.

## Verification

- Build clean with `NEXT_DIST_DIR=.next-verify` (never clobber dev `.next`).
- Live render @375×812 for every UI task; real data, no mocks. Mobile + desktop for #5/#6.

## Review

(filled as tasks complete)

---

# Trial Walkthrough — Feedback Fixes (2026-06-18)

Source: user's manual 14-day trial walk. Branch: `develop` (commit locally; never push without ask).
Standards: production-ready, no workarounds; verify LIVE in browser (no mocks).

## Decisions (locked)

- **D1 Score movers** → quick repoint now (emails → `/screener` current-score sort); full movers feature DEFERRED to a follow-up phase.
- **D2 Feature guidance** → lightweight checklist nudges (reuse `updateChecklistTask` / onboarding checklist); keep anti-haunting fix intact.
- **D3 Day-7 reframe** → trial-aware framing (what your Pro trial unlocks + what reverts to free).
- **Unsubscribe** → build FULL compliant flow now (public one-click + List-Unsubscribe headers + physical address).
- **T1 dev email escape** → skip.
- **Physical address (from ToS):** `Republic Registered Agent LLC, 20 S Charles St, Ste 403, Baltimore, MD 21201`.

## DONE (verified compile; ready to commit)

- [x] **B2a** day-3 copy: "filter on the map" → Screener (`scoreMin=70`); template CTA + fallback → `screenerUrl`.
- [x] **B2b** day-5 movers links → `/screener?sortBy=score&sortOrder=desc`; copy reworded to "Open the Screener / current rankings".
- [x] **B2c** day-7 reframed trial-aware: new heading/intro, `trialNote`, CTA "Keep Pro Access", benefit emoji 🔒→✓.
- [x] **B1 (part b)** standalone signup redirect → `/tour?resume=fresh` (wipes stale `piq_tour`; callback `?phase=celebrate` left untouched). Emails package `tsc --noEmit` = clean.

## IN PROGRESS (parallel implementation)

- [ ] **Unsubscribe vertical (full compliant)** — backend token util + public GET/POST controller; `email.service` `headers` support + `List-Unsubscribe`/`List-Unsubscribe-Post`; wire lifecycle/marketing senders; register controller; frontend public `/unsubscribed` confirmation page; `layout.tsx` footer = unsubscribe link (tokenized) + physical address.
- [ ] **B3 entitlement cold-load retry** — `api.ts` + `EntitlementsContext.tsx`: bounded backoff retry on transient fetch failure so an authed user is never stranded on `free`. (Backend proven correct: returns `pro` for active trial, cache-bypassed.)
- [ ] **B1 (part a)** tour user-scoping — `useTourSession.ts`: tag stored session with userId; clear/reset when authed user differs (robust beyond the signup-redirect fix).

## TODO (next phase)

- [ ] **D2 feature-discovery nudges** — frontend-design skill; dismissible nudges for un-tried Pro features via existing onboarding checklist.
- [ ] **Movers feature (deferred)** — Screener score-delta over 1mo/90d/120d/180d/1yr/3yr (up & down). Separate phase.

## Verification gate (per task, before commit)

Build (affected packages) + live browser check against running stack (no mocks): tour fresh signup → persona picker; entitlements show Pro for active trial; unsubscribe one-click sets `email_preferences.marketing=false` without login; emails render correct links.

## Review — SHIPPED on develop (all verified; not pushed)

- `c78319eb` **B2** email day-3/5 → `/screener`; day-7 trial-aware.
- `8540a515` **B1b** standalone signup → `/tour?resume=fresh`.
- `9598848a` **B1a** tour state user-scoped. Live: `/tour?resume=fresh` renders the persona picker (not a stale finale).
- `ac64633c` **B3** entitlements cold-load retry (4 attempts, fail-closed, aborts not retried). 63 frontend tests pass; backend returns Pro for active trial.
- `bf8b2bed` **Unsubscribe (full compliant)** — HMAC token + public one-click controller + `List-Unsubscribe`/`-Post` headers on all lifecycle/marketing senders + CAN-SPAM footer address. Stream-aware. Live: POST upserts `email_preferences.weekly_digest=false` with NO login; GET renders branded page. `/backend` proxy GET+POST + public reachability confirmed.

Verification: backend+frontend `tsc` clean; 11 backend + 63 frontend tests pass; unsubscribe + tour verified live. §1.6 reviews clean; two findings folded in (token-length cap, stream-aware opt-out). Non-blocking: `engagement-trigger.ts` 301 lines (1 over).

## Remaining

- [x] **D2 feature-discovery nudge** — `6dbd12f1` (NOT pushed). Dismissible M3 sidebar card surfacing un-tried Pro features for trial/pro users, computed from existing `usage_stats`+`onboarding_checklist`, dismissal persisted via `dismissed_beacons`. tsc clean; 6 unit tests pass; live-confirmed inputs (test5 active-trial → "Generate report" + "Screen markets"). Discovery: the beacon coachmark system is dormant (no `data-beacon` anchors exist anywhere).
- [ ] **Movers feature (deferred)** — design spec committed by user (`f0305b40`).
- [ ] Push — D2 (`6dbd12f1`) is committed but unpushed; prior batch already pushed.
- [ ] Release `develop`→`main` per CLAUDE.md §2.6 — user's call.

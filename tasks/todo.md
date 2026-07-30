# /admin/analytics rebuild — SHIPPED 2026-07-30 (`a4d23c66`)

Started as "bot exclusion isn't visible" and became a rebuild: the page was wrong
in three independent ways, only one of which was bots. Full detail is in the
commit body of `1319e25c` and the audit trail below it; this is the residue.

**Before → after, 30-day window:** 997 "visitors" → **687 people** (plus 1,612
bots, 46,012 unclassified, 109 internal). Sessions/visitor 1.001 → 1.180,
pages/session 1.2 → 3.75, conversion 0.0% → 1.15%, MRR $39 → $0 (the $39 had
never been billed).

**What was actually wrong**, in case it recurs elsewhere in the codebase:

1. **Row-cap truncation.** `.select()` without `.range()` silently caps at 1,000
   rows. Seven sites, including the daily rollup — whose truncated output was
   persisted and exported to Parquet.
2. **Overloaded states.** `is_bot = false` meant both "checked, human" and "never
   checked". Now three-state, plus a separate `is_internal`.
3. **Dead references.** Seven cases of plumbing built and never connected —
   funnel stages matching events never emitted, a selected column that does not
   exist, `EXCLUDED_EMAILS` shipped empty, `previous_page_path` promoted but
   never backfilled, `email` typed but never populated.
4. **Fabricated numbers.** LTV from a hardcoded churn constant; MRR from an
   entitlement flag admin grants set rather than a billing fact.

## Still open

- [ ] **Annual billing overstates MRR** — 17% for Pro ($39 charged monthly vs
      $33.25 monthly-equivalent), 79% for Enterprise. Nothing on `user_profiles`
      records the billing interval; `billing_period_start`/`end` exist in the
      schema but no code path writes them. Currently zero exposure because
      nobody is billed — a live trap the moment someone subscribes annually.
- [ ] **Five older migration files grant EXECUTE without revoking**
      (`20260730001652`, `001852`, `002205`, `003128`, `005122`). Fresh
      environments still end locked down, because `012131` and `012747` each run
      a wholesale revoke loop over `analytics\_%`. Editing them would
      reintroduce the file-vs-registered-version drift just cleaned up, so this
      is a decision, not a bug.
- [ ] **Signup path attribution needs ~2 weeks of traffic.** `signup_email_engaged`
      and `signup_oauth_click` only started collecting on this deploy. At ~23
      people/day, the email-vs-Google split for the 63-of-75 who abandon is not
      readable before roughly 2026-08-13. Do not redesign the form against the
      current numbers.
- [ ] **`sankey-layout.ts` is at 298 of its 300-line limit.** The scale/height
      solver is the natural extraction when it next changes.
- [ ] **`session-manager.service.ts` is 274 lines** after two extractions.
      Insert-path / update-path / heartbeat are the seams.

## Verify after deploy

Load `/admin/analytics`: unique visitors should read ~687, not 997, and the line
under the segment control should show all four buckets. Still 997 means the
frontend build did not pick up.

---

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


---

# Deferred: /markets/ SEO pages — remove mislabeled "Data confidence" badge (2026-07-26)

Fold into the next monthly /markets/ pages update (user decision 2026-07-26 — do NOT ship standalone).

- [ ] Remove the letter badge from `packages/frontend/app/(public)/markets/components/MarketStatsBlock.tsx` (badge block ~lines 107-115 + now-unused `gradeClasses`). It renders `data.grade` labeled "Data confidence" — but `grade` is the score itself on an academic scale (`scoreToGrade(score)`, `formula-weights.ts:187`), NOT confidence. Live proof: Sierra Vista metro 43420 = score 23 / grade F / confidence 100 / confidence_level A.
- [ ] Also drop `grade` from the snapshot passthrough for this surface (`processScores` in `packages/backend/src/market-snapshot/market-snapshot-assembler.helper.ts:189`, `market-snapshot.types.ts`, `MarketStatsData.grade` in `lib/data/fetchers/market-stats.ts`) so the academic score-letter can't be mislabeled again (CLAUDE.md §9: no quality-letter framing of the score; confidence is the only letter).
- [ ] Note: SEO pages ISR-cache 24h + Redis snapshot cache — badge disappears on next revalidation after deploy.

---


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

-- content_runs.script_revision — epoch guard for operator script edits.
--
-- WHY
-- Operators can now edit a run's script at any stage, and saving restarts the
-- run from fact-check (verifying_data). That creates a zombie-worker race: a
-- render-audio or render-video job already in flight keeps running, finishes
-- against the OLD script, and then attempts its normal onward transition.
--
-- Concretely, without a guard: edit during rendering_voice -> run moves to
-- verifying_data -> the old audio worker finishes and calls
-- transitionTo(rendering_video). ALLOWED_TRANSITIONS.verifying_data does not
-- permit rendering_video, so transitionTo throws, handleStepFailure catches it,
-- and the freshly-restarted run is driven to 'failed'. The operator's fix would
-- appear to kill the run.
--
-- HOW IT IS USED
-- Bumped on every script write. Each job handler captures the value when it
-- starts and re-checks it immediately before its terminal write; if the value
-- moved, the step is stale and returns without transitioning (logging a
-- stale_step_discarded event) instead of clobbering the restarted run.
--
-- Additive and backfill-free: existing rows get 0, and the first edit moves
-- them to 1. In-flight runs at deploy time captured no revision, so they simply
-- behave as they do today.

ALTER TABLE content_runs
  ADD COLUMN IF NOT EXISTS script_revision INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN content_runs.script_revision IS
  'Incremented on every operator script edit. Job handlers capture this on entry and discard their result if it changed mid-step, so a restart cannot be clobbered by a worker still running against the previous script.';

-- Atomic increment. A JS-side read-modify-write (SELECT then UPDATE with +1)
-- silently defeats the guard: two concurrent edits — a double-clicked save, or
-- two tabs — both read the same value and both write the same successor, so two
-- distinct edits collapse into one revision and an in-flight handler holding the
-- pre-edit value would compare equal and NOT discard itself. The whole point of
-- the column is lost in exactly the case it exists for, so the increment has to
-- happen in the database.
CREATE OR REPLACE FUNCTION increment_script_revision(p_run_id UUID)
RETURNS INTEGER
LANGUAGE sql
AS $$
  UPDATE content_runs
     SET script_revision = script_revision + 1
   WHERE id = p_run_id
  RETURNING script_revision;
$$;

COMMENT ON FUNCTION increment_script_revision(UUID) IS
  'Atomically bump content_runs.script_revision and return the new value. Used by RunActionsService.editScript.';

GRANT EXECUTE ON FUNCTION increment_script_revision(UUID) TO service_role;

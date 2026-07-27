// packages/backend/src/content-pipeline/next-pipeline-step-after-review.ts
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * After human review (`ready_for_review`), whether the next automated step
 * should re-run Gate A or proceed to voice lint — keyed off the latest
 * data_verifier outcome (not `status_reason`, which changes on later edits).
 *
 * When Gate A last failed, whether to re-verify depends on the script having
 * actually changed since that verdict. Gate A is deterministic against a fixed
 * script + payload, so re-running it on an untouched script only reproduces
 * the same failure and bounces the run straight back to `ready_for_review` —
 * the operator could never continue past a gate failure. An explicit edit
 * always invalidates the verdict; a plain resume only does when something else
 * moved the script first.
 */
export async function resolveNextPipelineStepAfterReview(
  client: SupabaseClient,
  runId: string,
  options?: { mode?: 'resume' | 'edit_script' },
): Promise<'verifying_data' | 'linting_voice'> {
  const { data: lastVerifier } = await client
    .from('content_run_gates')
    .select('result, created_at')
    .eq('run_id', runId)
    .eq('gate', 'data_verifier')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastVerifier?.result !== 'failed') return 'linting_voice';
  if (options?.mode === 'edit_script') return 'verifying_data';

  const { data: scriptAsset } = await client
    .from('content_assets')
    .select('updated_at')
    .eq('run_id', runId)
    .eq('kind', 'script')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const scriptUpdatedAt = scriptAsset?.updated_at as string | undefined;
  if (!scriptUpdatedAt) return 'linting_voice';
  return new Date(scriptUpdatedAt).getTime() >
    new Date(lastVerifier.created_at as string).getTime()
    ? 'verifying_data'
    : 'linting_voice';
}

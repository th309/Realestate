// packages/backend/src/content-pipeline/orchestrator/job-handlers/long-form-render-plan-loader.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildLongFormRenderPlan } from '../../render/long-form-render-plan';

/**
 * Long-form deep dives get a scene-by-scene render plan derived from the
 * script plus caption timings. Returns null whenever the run lacks the inputs
 * that plan needs, so the caller falls back to the plain composition.
 */
export async function loadLongFormRenderPlan(
  client: SupabaseClient,
  runId: string,
  captionWords: Array<{ startMs: number; endMs: number; word: string }>,
): Promise<ReturnType<typeof buildLongFormRenderPlan> | null> {
  const { data: scriptRows } = await client
    .from('content_assets')
    .select('metadata')
    .eq('run_id', runId)
    .eq('kind', 'script')
    .order('created_at', { ascending: false })
    .limit(1);
  const scriptsRaw = scriptRows?.[0]?.metadata?.scripts;
  const script = Array.isArray(scriptsRaw) ? scriptsRaw[0] : undefined;
  const fullText =
    script && typeof script.fullText === 'string' ? script.fullText : '';
  const sceneBreakdown = script?.sceneBreakdown;
  if (
    fullText.length === 0 ||
    !Array.isArray(sceneBreakdown) ||
    sceneBreakdown.length < 5
  ) {
    return null;
  }
  return buildLongFormRenderPlan({
    fullText,
    sceneBreakdown: sceneBreakdown as Array<{
      sceneKey: string;
      text: string;
    }>,
    captionWords,
  });
}

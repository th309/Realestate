/**
 * Report persistence + progress-tracking writes.
 *
 * Both functions write to the `reports` table: `updateGenerationStage` for
 * real-time SSE progress polling, `persistCompletedReport` for the final
 * status='ready' write. Extracted from the orchestrator; behavior unchanged.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Update the report row with a generation stage for real-time progress tracking.
 * The frontend connects via SSE to poll these values and show pipeline progress.
 */
export async function updateGenerationStage(
  supabase: SupabaseClient,
  reportId: string,
  stage: string,
  detail?: string,
): Promise<void> {
  await supabase
    .from('reports')
    .update({
      generation_stage: stage,
      generation_stage_detail: detail ?? null,
    })
    .eq('id', reportId);
}

/**
 * Persist the completed report row (status='ready') with populated data, AI
 * narratives, score snapshot, and timing metadata. Throws on DB error so the
 * caller can mark the report failed.
 */
export async function persistCompletedReport(
  supabase: SupabaseClient,
  reportId: string,
  populatedData: any,
  aiNarratives: Record<string, any>,
  scores: any,
  generationTime: number,
): Promise<void> {
  // Extract model name from narratives metadata (set by ReportAiService/v2)
  const aiModelUsed = (aiNarratives as any).__model_used || 'unknown';
  // Clean metadata key before persisting to DB
  delete (aiNarratives as any).__model_used;

  const { error: updateError } = await supabase
    .from('reports')
    .update({
      status: 'ready',
      populated_data: populatedData,
      ai_narrative: aiNarratives,
      ai_model_used: aiModelUsed,
      homeready_score:
        scores?.scores.homeready?.score != null
          ? Math.round(scores.scores.homeready.score)
          : null,
      investoredge_score:
        scores?.scores.investoredge?.score != null
          ? Math.round(scores.scores.investoredge.score)
          : null,
      scores_snapshot: scores,
      generation_completed_at: new Date().toISOString(),
      generation_time_ms: generationTime,
      data_as_of_date: new Date().toISOString().split('T')[0],
      confidence_level: populatedData.data_coverage?.is_limited
        ? 'moderate'
        : 'high',
    })
    .eq('id', reportId);

  if (updateError) {
    throw updateError;
  }
}

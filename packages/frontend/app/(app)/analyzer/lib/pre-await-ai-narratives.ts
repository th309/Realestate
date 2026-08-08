import { fetchBatchedAiInsights, type AiInsightPayload } from "@/lib/data";
import type { AnalyzerSnapshotExtras } from "./build-analyzer-snapshot";

/**
 * Resolve the batched AI narratives and fold them into the render extras,
 * so a published artifact captures real prose instead of the
 * "Generating verdict…" placeholders the live page shows while streaming.
 *
 * Belongs to the PUBLISH path only (Share / PDF). A plain Save must never
 * reach this — firing an LLM batch call on every Save (and on every Notes
 * "Save") is what the builder split exists to prevent, and `saveDealState`
 * has no field for a narrative to land in anyway.
 *
 * Failures are non-fatal: the artifact publishes with whatever narratives
 * were already captured rather than blocking the user's share on the model.
 */
export async function preAwaitAiNarratives(
  extras: AnalyzerSnapshotExtras | undefined,
  payload: AiInsightPayload | null | undefined,
): Promise<AnalyzerSnapshotExtras> {
  const base = extras ?? {};
  if (!payload) return base;

  try {
    const batch = await fetchBatchedAiInsights(payload);
    return {
      ...base,
      aiNarratives: {
        recommendation_analysis: batch?.recommendation_analysis?.text ?? null,
        projection: batch?.projection?.text ?? null,
        expense_waterfall: batch?.expense_waterfall?.text ?? null,
        sensitivity: batch?.sensitivity?.text ?? null,
        comps: batch?.comps?.text ?? null,
        after_tax: batch?.after_tax?.text ?? null,
      },
    };
  } catch {
    return base;
  }
}

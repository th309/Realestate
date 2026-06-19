/**
 * Market-insight cache invalidation.
 *
 * AI narratives are cached in `market_insights` with a 30-day TTL keyed on
 * (region_id, geo_level, insight_type). Nothing previously expired them when the
 * score pipeline rescored, so a rescore silently desynced every cached narrative
 * from its score (e.g. a narrative citing "86/100" while the live score was 4).
 *
 * A full rescore moves the latest score for EVERY region, so every currently-valid
 * cached insight is potentially stale. We soft-expire them (set expires_at to now)
 * rather than delete: it is reversible, and `InsightsService.getInsight` regenerates
 * lazily against the fresh score on the next view (real AI, or the deterministic
 * fallback). Keeping this as a standalone helper (not a method on InsightsService)
 * lets the slim scoring CLI call it with just a Supabase client — no DI chain.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Soft-expire all currently-valid cached market insights so they regenerate
 * against freshly-computed scores. Throws on a Supabase error; the scoring CLI
 * calls this inside a best-effort try/catch so a failure never aborts the run.
 */
export async function invalidateMarketInsightsCache(
  supabase: SupabaseClient,
): Promise<{ invalidated: number }> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('market_insights')
    .update({ expires_at: nowIso })
    .gt('expires_at', nowIso)
    .select('id');

  if (error) {
    throw new Error(`market_insights invalidation failed: ${error.message}`);
  }

  return { invalidated: data?.length ?? 0 };
}

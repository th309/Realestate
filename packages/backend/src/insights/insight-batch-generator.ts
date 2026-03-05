/**
 * Insight Batch Generator
 *
 * Handles batch generation of insights for all regions at a geography level.
 * Extracted from InsightsService to keep file sizes under the 300-line limit.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { InsightContext, InsightType } from './insights.types';

/** Concurrency limit for parallel AI calls during batch generation */
const BATCH_CONCURRENCY = 5;

/** Cache duration: 30 days in milliseconds */
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Insight types generated during batch runs */
const BATCH_INSIGHT_TYPES: InsightType[] = ['market_take', 'score_explanation'];

const logger = new Logger('InsightBatchGenerator');

/**
 * Generate insights for all scored regions at a given geography level.
 *
 * Uses a semaphore pattern to limit concurrent AI calls. Generates
 * market_take and score_explanation for each region.
 */
export async function generateBatchInsights(
  geoLevel: string,
  supabase: SupabaseClient,
  aiModel: string,
  buildContext: (regionId: string, geoLevel: string) => Promise<InsightContext>,
  generateInsight: (
    context: InsightContext,
    insightType: InsightType,
  ) => Promise<string>,
): Promise<{ generated: number; failed: number; duration_ms: number }> {
  const start = Date.now();

  const { data: regions } = await supabase
    .from('propertyiq_scores')
    .select('location_id')
    .eq('geography', geoLevel);

  if (!regions || regions.length === 0) {
    return { generated: 0, failed: 0, duration_ms: Date.now() - start };
  }

  const uniqueRegions = [...new Set(regions.map((r) => r.location_id))];
  logger.log(
    `Batch insight generation: ${uniqueRegions.length} regions at ${geoLevel}`,
  );

  let running = 0;
  let generated = 0;
  let failed = 0;

  for (let idx = 0; idx < uniqueRegions.length; idx++) {
    const region = uniqueRegions[idx];

    while (running >= BATCH_CONCURRENCY) {
      await new Promise((r) => setTimeout(r, 100));
    }
    running++;

    (async () => {
      try {
        const context = await buildContext(region, geoLevel);
        for (const type of BATCH_INSIGHT_TYPES) {
          const content = await generateInsight(context, type);
          await supabase.from('market_insights').upsert(
            {
              region_id: region,
              geo_level: geoLevel,
              insight_type: type,
              archetype_id: '__none__',
              content,
              model: aiModel,
              generated_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
            },
            {
              onConflict: 'region_id,geo_level,insight_type,archetype_id',
            },
          );
          generated++;
        }
      } catch (err) {
        logger.error(`Failed to generate insights for ${region}: ${err}`);
        failed++;
      } finally {
        running--;
      }
    })();

    if ((idx + 1) % 50 === 0) {
      logger.log(
        `Batch progress: ${idx + 1}/${uniqueRegions.length} dispatched, ` +
          `${generated} generated, ${failed} failed`,
      );
    }
  }

  // Wait for all in-flight tasks to finish
  while (running > 0) {
    await new Promise((r) => setTimeout(r, 100));
  }

  const duration_ms = Date.now() - start;
  logger.log(
    `Batch complete: ${generated} generated, ${failed} failed in ${duration_ms}ms`,
  );
  return { generated, failed, duration_ms };
}

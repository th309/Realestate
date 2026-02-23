/**
 * Scans recent negative-sentiment news for high-severity events.
 * Markets with 2+ such articles in 24 hours get emergency briefing refresh.
 */

import { Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { BriefingGeneratorService } from './briefing-generator.service';
import { DEFAULT_NATIONAL_BENCHMARKS } from './market-intelligence.types';

const logger = new Logger('HighSeverityDetector');

const HIGH_SEVERITY_PATTERN =
  /disaster|layoffs?|closure|bankruptcy|flood|hurricane|fire|crash|collapse|crisis/i;

interface HighSeverityMarket {
  geography_id: string;
  geography_type: string;
  geography_name: string;
}

/** Find markets with 2+ negative high-severity articles in the last 24 hours. */
export async function detectHighSeverityMarkets(
  supabase: SupabaseService,
): Promise<HighSeverityMarket[]> {
  const client = supabase.getClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentNegative } = await client
    .from('market_news')
    .select('geography_ids, headline, summary')
    .eq('sentiment', 'negative')
    .gte('published_at', oneDayAgo);

  if (!recentNegative?.length) return [];

  const geoCount = new Map<string, number>();

  for (const article of recentNegative) {
    const text = `${article.headline} ${article.summary}`;
    if (!HIGH_SEVERITY_PATTERN.test(text)) continue;

    for (const geoId of (article.geography_ids || [])) {
      geoCount.set(geoId, (geoCount.get(geoId) || 0) + 1);
    }
  }

  return [...geoCount.entries()]
    .filter(([, count]) => count >= 2)
    .map(([geoId]) => ({
      geography_id: geoId,
      geography_type: 'metro',
      geography_name: geoId,
    }));
}

/** Detect high-severity markets and trigger emergency briefing refresh for each. */
export async function triggerHighSeverityBriefingRefresh(
  supabase: SupabaseService,
  briefingGenerator: BriefingGeneratorService,
): Promise<void> {
  const markets = await detectHighSeverityMarkets(supabase);
  if (markets.length === 0) return;

  logger.warn(
    `Detected ${markets.length} market(s) with high-severity news — triggering emergency briefing refresh`,
  );

  for (const market of markets) {
    briefingGenerator
      .generateBriefing(
        market.geography_id,
        market.geography_type as 'metro' | 'county',
        market.geography_name,
        DEFAULT_NATIONAL_BENCHMARKS,
      )
      .then(() =>
        logger.log(`Emergency briefing refreshed for ${market.geography_id}`),
      )
      .catch((err) =>
        logger.warn(
          `Emergency briefing failed for ${market.geography_id}: ${err.message}`,
        ),
      );
  }
}

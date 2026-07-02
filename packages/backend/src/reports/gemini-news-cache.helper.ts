/**
 * Gemini News Scout — Supabase cache read/write (I/O)
 *
 * Extracted from gemini-news.service.ts for file-size compliance.
 * The Supabase service is passed explicitly instead of `this`.
 */

import { SupabaseService } from '../supabase/supabase.service';
import type { NewsScoutResult } from './gemini-news.types';

export async function getCachedNews(
  supabase: SupabaseService,
  geographyId: string,
  geographyType: string,
): Promise<NewsScoutResult | null> {
  const client = supabase.getClient();
  const { data } = await client
    .from('report_news_cache')
    .select('news_data')
    .eq('geography_id', geographyId)
    .eq('geography_type', geographyType)
    .gt('expires_at', new Date().toISOString())
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  return data?.news_data as NewsScoutResult | null;
}

export async function cacheNewsResult(
  supabase: SupabaseService,
  result: NewsScoutResult,
  cacheTtlHours: number,
): Promise<void> {
  const client = supabase.getClient();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + cacheTtlHours);

  await client.from('report_news_cache').upsert(
    {
      geography_id: result.geography_id,
      geography_type: result.geography_type,
      geography_name: result.geography_name,
      news_data: result,
      fetched_at: result.scout_metadata.search_timestamp,
      expires_at: expiresAt.toISOString(),
      model_used: result.scout_metadata.model_used,
      local_news_count: result.local_news.length,
      indicators_count: result.economic_indicators.length,
      signals_count: result.market_signals.length,
    },
    { onConflict: 'geography_id,geography_type' },
  );
}

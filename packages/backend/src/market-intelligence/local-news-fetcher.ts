/**
 * Local News Fetcher
 *
 * Fetches location-specific real estate news from Google News RSS.
 * Google News RSS is free, requires no API key, and supports search queries.
 *
 * URL format:
 *   https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en
 *
 * Designed for batch processing: fetches news for many geographies in
 * configurable batches with delays to respect rate limits.
 */

import { Logger } from '@nestjs/common';
import Parser from 'rss-parser';
import { SupabaseClient } from '@supabase/supabase-js';

const logger = new Logger('LocalNewsFetcher');

/** Geography record from the database */
export interface GeographyTarget {
  geography_id: string;
  name: string;
  name_short: string | null;
  cbsa_name: string | null;
  geography_type: 'metro' | 'county';
  state_code: string | null;
}

/** Article fetched from Google News RSS with its source geography */
export interface LocalNewsArticle {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  sourceGeographyId: string;
  sourceGeographyType: 'metro' | 'county';
  sourceGeographyName: string;
}

/**
 * Build a Google News RSS search URL for a geography.
 *
 * Strategy by geography type:
 *
 * **Metros** — use CBSA city names to cast a wide net. Strips the state
 *   suffix and replaces dashes with spaces so Google treats each city as
 *   a keyword. Examples:
 *     "Dallas-Fort Worth-Arlington, TX" → "Dallas Fort Worth Arlington TX real estate market"
 *     "New York-Newark-Jersey City, NY-NJ" → "New York Newark Jersey City NY real estate market"
 *
 * **Counties** — use `name_short` + `state_code` for precise local results.
 *     "Los Angeles County, CA" → "Los Angeles County CA real estate market"
 */
function buildGoogleNewsUrl(geo: GeographyTarget): string {
  let searchName: string;
  let state: string;

  if (geo.geography_type === 'metro') {
    // Use CBSA name: "Dallas-Fort Worth-Arlington, TX" → cities + state
    const cbsa = geo.cbsa_name || geo.name;
    const [cityPart, statePart] = cbsa.split(',').map(s => s.trim());
    searchName = cityPart.replace(/-/g, ' ');
    // Take first state only for multi-state metros ("NY-NJ" → "NY")
    state = (statePart || '').split('-')[0].trim();
  } else {
    // Counties: use short name + state_code
    searchName = geo.name_short || geo.name.split(',')[0].trim();
    state = geo.state_code || '';
  }

  const query = encodeURIComponent(`${searchName} ${state} real estate market`.trim());
  return `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
}

/** Sleep helper for batch delays */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch local real estate news for a list of geographies.
 *
 * Processes in batches with configurable size and delay.
 * Each geography gets 1 Google News RSS query returning ~5-10 recent articles.
 *
 * @param geographies - List of metros/counties to fetch news for
 * @param batchSize - How many geographies to fetch in parallel per batch
 * @param batchDelayMs - Delay between batches to avoid rate limiting
 * @param maxArticlesPerGeo - Max articles to keep per geography (prevents flooding)
 */
export async function fetchLocalNews(
  geographies: GeographyTarget[],
  batchSize = 10,
  batchDelayMs = 2000,
  maxArticlesPerGeo = 5,
): Promise<LocalNewsArticle[]> {
  const parser = new Parser({ timeout: 10_000 });
  const allArticles: LocalNewsArticle[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < geographies.length; i += batchSize) {
    const batch = geographies.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (geo) => {
        const url = buildGoogleNewsUrl(geo);
        try {
          const parsed = await parser.parseURL(url);
          const articles: LocalNewsArticle[] = (parsed.items || [])
            .filter((item) => item.link && item.title)
            .slice(0, maxArticlesPerGeo)
            .map((item) => ({
              title: item.title!,
              description: item.contentSnippet || item.content || null,
              url: item.link!,
              publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
              sourceGeographyId: geo.geography_id,
              sourceGeographyType: geo.geography_type,
              sourceGeographyName: geo.name,
            }));
          return articles;
        } catch (err: any) {
          logger.debug(`Google News RSS failed for "${geo.name}": ${err.message}`);
          return [];
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.length > 0) successCount++;
        else failCount++;
        allArticles.push(...result.value);
      } else {
        failCount++;
      }
    }

    // Delay between batches (skip after last batch)
    if (i + batchSize < geographies.length) {
      await sleep(batchDelayMs);
    }
  }

  logger.log(
    `Local news fetch complete: ${allArticles.length} articles from ` +
    `${successCount} geographies (${failCount} failed/empty)`,
  );

  return allArticles;
}

/**
 * Load target geographies (metros + counties) from the database,
 * sorted by population descending so we prioritize the largest markets.
 */
export async function loadTargetGeographies(
  client: SupabaseClient,
  maxMetros: number,
  maxCounties: number,
): Promise<GeographyTarget[]> {
  const targets: GeographyTarget[] = [];

  const { data: metros } = await client
    .from('geographies')
    .select('geography_id, name, name_short, cbsa_name, geography_type, state_code')
    .eq('geography_type', 'metro')
    .not('population', 'is', null)
    .order('population', { ascending: false })
    .limit(maxMetros);

  if (metros) targets.push(...metros as GeographyTarget[]);

  const { data: counties } = await client
    .from('geographies')
    .select('geography_id, name, name_short, cbsa_name, geography_type, state_code')
    .eq('geography_type', 'county')
    .not('population', 'is', null)
    .order('population', { ascending: false })
    .limit(maxCounties);

  if (counties) targets.push(...counties as GeographyTarget[]);

  logger.log(
    `Loaded ${targets.length} target geographies ` +
    `(${metros?.length ?? 0} metros, ${counties?.length ?? 0} counties)`,
  );
  return targets;
}

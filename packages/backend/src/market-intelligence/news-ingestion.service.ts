/**
 * News Ingestion Service
 *
 * Fetches real estate news articles from a configurable News API provider,
 * geo-tags them against known metro areas, classifies via LLM (summary,
 * tags, sentiment), and stores in the `market_news` table.
 *
 * Designed for resilience: individual article failures are counted as errors
 * but never crash the pipeline. LLM failures fall back to sensible defaults.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AppConfigService } from '../config/app-config.service';
import { GeoTaggerService, GeoTagResult } from './geo-tagger.service';
import { BriefingGeneratorService } from './briefing-generator.service';
import { classifyArticle } from './news-classification.helpers';
import { DEFAULT_NATIONAL_BENCHMARKS } from './market-intelligence.types';

/** Counts returned after an ingestion run */
export interface IngestionResult {
  ingested: number;
  skipped: number;
  errors: number;
}

/** Shape of a single article from the NewsAPI response */
interface NewsApiArticle {
  title: string | null;
  description: string | null;
  url: string;
  source: { name: string } | null;
  publishedAt: string;
}

/** Shape of the NewsAPI /v2/everything response */
interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

const NEWSAPI_BASE_URL = 'https://newsapi.org/v2/everything';
const NEWSAPI_QUERY = '"real estate" OR "housing market" OR "home prices"';

@Injectable()
export class NewsIngestionService {
  private readonly logger = new Logger(NewsIngestionService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly appConfig: AppConfigService,
    private readonly geoTagger: GeoTaggerService,
    private readonly briefingGenerator: BriefingGeneratorService,
  ) {}

  /**
   * Ingest the latest real estate news articles.
   * Returns counts of ingested, skipped (duplicate), and errored articles.
   */
  async ingestLatestNews(): Promise<IngestionResult> {
    const result: IngestionResult = { ingested: 0, skipped: 0, errors: 0 };

    // 1. Fetch articles from News API
    const articles = await this.fetchFromNewsApi();
    if (articles.length === 0) return result;

    // 2. Deduplicate against existing URLs
    const urls = articles.map(a => a.url).filter(Boolean);
    const existingUrls = await this.findExistingUrls(urls);

    // 3. Process each article
    for (const article of articles) {
      if (!article.url || !article.title) {
        result.errors++;
        continue;
      }

      if (existingUrls.has(article.url)) {
        result.skipped++;
        continue;
      }

      try {
        await this.processAndStoreArticle(article);
        result.ingested++;
      } catch (err) {
        this.logger.warn(`Failed to process article "${article.title}": ${err.message}`);
        result.errors++;
      }
    }

    this.logger.log(
      `News ingestion complete: ${result.ingested} ingested, ` +
      `${result.skipped} skipped, ${result.errors} errors`,
    );

    // Fire-and-forget: detect high-severity markets and trigger emergency briefing refresh.
    // Detached promise so it never slows down the ingestion return path.
    this.triggerHighSeverityBriefingRefresh()
      .catch((err) => this.logger.warn(`High-severity briefing refresh failed: ${err.message}`));

    return result;
  }

  // -- High-Severity Market Detection & Emergency Briefing Refresh ----------

  /** Regex matching keywords that indicate a high-severity event for a market */
  private static readonly HIGH_SEVERITY_PATTERN =
    /disaster|layoffs?|closure|bankruptcy|flood|hurricane|fire|crash|collapse|crisis/i;

  /**
   * Query `market_news` for markets with 2+ negative-sentiment, high-severity
   * articles in the last 24 hours. These markets need an emergency briefing refresh.
   */
  private async detectHighSeverityMarkets(): Promise<
    Array<{ geography_id: string; geography_type: string; geography_name: string }>
  > {
    const client = this.supabase.getClient();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentNegative } = await client
      .from('market_news')
      .select('geography_ids, headline, summary')
      .eq('sentiment', 'negative')
      .gte('published_at', oneDayAgo);

    if (!recentNegative?.length) return [];

    // Count negative articles per geography that contain high-severity keywords
    const geoCount = new Map<string, number>();

    for (const article of recentNegative) {
      const text = `${article.headline} ${article.summary}`;
      if (!NewsIngestionService.HIGH_SEVERITY_PATTERN.test(text)) continue;

      for (const geoId of (article.geography_ids || [])) {
        geoCount.set(geoId, (geoCount.get(geoId) || 0) + 1);
      }
    }

    // Return markets with 2+ high-severity articles
    return [...geoCount.entries()]
      .filter(([, count]) => count >= 2)
      .map(([geoId]) => ({
        geography_id: geoId,
        geography_type: 'metro',
        geography_name: geoId, // Best effort; name resolved by briefing generator
      }));
  }

  /**
   * Detect high-severity markets and trigger an emergency briefing refresh
   * for each one. Each generation is fire-and-forget so individual failures
   * do not block the others.
   */
  private async triggerHighSeverityBriefingRefresh(): Promise<void> {
    const markets = await this.detectHighSeverityMarkets();
    if (markets.length === 0) return;

    this.logger.warn(
      `Detected ${markets.length} market(s) with high-severity news — triggering emergency briefing refresh`,
    );

    for (const market of markets) {
      this.briefingGenerator
        .generateBriefing(
          market.geography_id,
          market.geography_type as 'metro' | 'county',
          market.geography_name,
          DEFAULT_NATIONAL_BENCHMARKS,
        )
        .then(() =>
          this.logger.log(`Emergency briefing refreshed for ${market.geography_id}`),
        )
        .catch((err) =>
          this.logger.warn(
            `Emergency briefing failed for ${market.geography_id}: ${err.message}`,
          ),
        );
    }
  }

  // -- News API Fetch -------------------------------------------------------

  /** Fetch articles from the configured News API provider */
  private async fetchFromNewsApi(): Promise<NewsApiArticle[]> {
    try {
      const [provider, apiKey] = await Promise.all([
        this.appConfig.get('NEWS_API_PROVIDER', 'newsapi'),
        this.appConfig.get('NEWS_API_KEY'),
      ]);

      if (!apiKey) {
        this.logger.warn('NEWS_API_KEY not configured, skipping news ingestion');
        return [];
      }

      if (provider !== 'newsapi') {
        this.logger.warn(`Unsupported news provider "${provider}", only "newsapi" supported`);
        return [];
      }

      const url = `${NEWSAPI_BASE_URL}?q=${encodeURIComponent(NEWSAPI_QUERY)}` +
        `&language=en&sortBy=publishedAt&pageSize=100&apiKey=${apiKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        this.logger.error(`News API returned ${response.status}: ${response.statusText}`);
        return [];
      }

      const body: NewsApiResponse = await response.json();
      if (body.status !== 'ok' || !body.articles) {
        this.logger.error('News API returned non-ok status or no articles');
        return [];
      }

      return body.articles;
    } catch (err) {
      this.logger.error(`News API fetch failed: ${err.message}`);
      return [];
    }
  }

  // -- Deduplication --------------------------------------------------------

  /** Find which of the given URLs already exist in market_news */
  private async findExistingUrls(urls: string[]): Promise<Set<string>> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('market_news')
        .select('url')
        .in('url', urls);

      if (error || !data) return new Set();
      return new Set(data.map((row: { url: string }) => row.url));
    } catch (err) {
      this.logger.warn(`Dedup query failed: ${err.message}`);
      return new Set();
    }
  }

  // -- Article Processing ---------------------------------------------------

  /** Geo-tag, classify via LLM, and insert a single article */
  private async processAndStoreArticle(article: NewsApiArticle): Promise<void> {
    const headline = article.title ?? '';
    const description = article.description ?? '';
    const sourceName = article.source?.name ?? 'Unknown';

    // Geo-tag
    const geoTags = await this.geoTagger.tagArticle(headline, description);

    // LLM classification (with fallback)
    const classification = await classifyArticle(headline, description, this.appConfig);

    // Build row and insert
    const geographyIds = geoTags.map(t => t.geography_id);
    const maxConfidence = geoTags.length > 0
      ? Math.max(...geoTags.map(t => t.confidence))
      : 0;

    const client = this.supabase.getClient();
    const { error } = await client.from('market_news').insert({
      url: article.url,
      headline,
      source_name: sourceName,
      published_at: article.publishedAt,
      summary: classification.summary,
      tags: classification.tags,
      sentiment: classification.sentiment,
      geography_ids: geographyIds,
      geography_type: geographyIds.length > 0 ? 'metro' : null,
      geo_tag_confidence: maxConfidence,
      raw_description: description,
      ingested_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Supabase insert failed: ${error.message}`);
    }
  }
}

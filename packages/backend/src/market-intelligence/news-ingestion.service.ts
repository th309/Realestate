/**
 * News Ingestion Service
 *
 * Two-tier ingestion pipeline:
 * 1. National feeds (HousingWire, NAR, Zillow, etc.) — general market news
 * 2. Local feeds (Google News RSS per metro/county) — location-specific news
 *
 * No API key required — uses publicly available RSS feeds.
 *
 * Designed for resilience: individual article failures are counted as errors
 * but never crash the pipeline. LLM failures fall back to sensible defaults.
 */

import { Injectable, Logger } from '@nestjs/common';
import Parser from 'rss-parser';
import { SupabaseService } from '../supabase/supabase.service';
import { AppConfigService } from '../config/app-config.service';
import { GeoTaggerService } from './geo-tagger.service';
import { BriefingGeneratorService } from './briefing-generator.service';
import { classifyArticle } from './news-classification.helpers';
import { fetchLocalNews, loadTargetGeographies } from './local-news-fetcher';
import { triggerHighSeverityBriefingRefresh } from './high-severity-detector';

/** Counts returned after an ingestion run */
export interface IngestionResult {
  ingested: number;
  skipped: number;
  errors: number;
}

/** Normalized article shape from any source (RSS or API) */
interface NewsArticle {
  title: string | null;
  description: string | null;
  url: string;
  source: { name: string } | null;
  publishedAt: string;
}

/** Free RSS feeds for real estate news — no API key needed */
const DEFAULT_RSS_FEEDS: Array<{ url: string; name: string }> = [
  // National industry news
  { url: 'https://www.housingwire.com/feed/', name: 'HousingWire' },
  { url: 'https://www.mortgagenewsdaily.com/rss/news', name: 'Mortgage News Daily' },
  { url: 'https://www.cnbc.com/id/10000115/device/rss/rss.html', name: 'CNBC Real Estate' },
  // Zillow housing research (mediaroom press releases)
  { url: 'https://zillow.mediaroom.com/press-releases?pagetemplate=rss&category=816', name: 'Zillow Research' },
  { url: 'https://zillow.mediaroom.com/press-releases?pagetemplate=rss', name: 'Zillow Press' },
  // NAR via Google News (nar.realtor decommissioned their RSS feeds)
  { url: 'https://news.google.com/rss/search?q=National+Association+of+Realtors+housing+market&hl=en-US&gl=US&ceid=US:en', name: 'NAR (Google News)' },
  // Market data & analysis
  { url: 'https://www.redfin.com/news/feed/', name: 'Redfin' },
  { url: 'https://www.realtor.com/news/feed/', name: 'Realtor.com' },
  // Investor-focused
  { url: 'https://www.biggerpockets.com/blog/feed', name: 'BiggerPockets' },
];

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
   *
   * Two-tier pipeline:
   * 1. National RSS feeds — general market news (HousingWire, CNBC, etc.)
   * 2. Local Google News RSS — per-metro and per-county real estate news
   *
   * Returns counts of ingested, skipped (duplicate), and errored articles.
   */
  async ingestLatestNews(): Promise<IngestionResult> {
    const result: IngestionResult = { ingested: 0, skipped: 0, errors: 0 };

    // 1. Fetch national articles from curated RSS feeds
    const nationalArticles = await this.fetchFromRssFeeds();

    // 2. Fetch local articles from Google News RSS per geography
    const localArticles = await this.fetchLocalArticles();

    // 3. Merge both streams into a unified article list
    const articles = [...nationalArticles, ...localArticles];
    if (articles.length === 0) return result;

    // 4. Deduplicate against existing URLs AND headlines in the database
    //    (batched to avoid Supabase .in() query size limits)
    const existingUrls = await this.findExistingUrlsBatched(articles);
    const existingHeadlines = await this.findExistingHeadlines(articles);

    // 5. Also deduplicate within the current batch (Google News may return
    //    the same article for multiple geographies)
    const seenUrls = new Set<string>();
    const seenHeadlines = new Set<string>();

    // 6. Process each article — dedup BEFORE expensive LLM classification
    for (const article of articles) {
      if (!article.url || !article.title) {
        result.errors++;
        continue;
      }

      const normalizedHeadline = article.title.trim().toLowerCase();

      // Skip if URL or headline already exists in DB or current batch
      if (
        existingUrls.has(article.url) ||
        seenUrls.has(article.url) ||
        existingHeadlines.has(normalizedHeadline) ||
        seenHeadlines.has(normalizedHeadline)
      ) {
        result.skipped++;
        continue;
      }
      seenUrls.add(article.url);
      seenHeadlines.add(normalizedHeadline);

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
    triggerHighSeverityBriefingRefresh(this.supabase, this.briefingGenerator)
      .catch((err) => this.logger.warn(`High-severity briefing refresh failed: ${err.message}`));

    return result;
  }

  // -- Local News Fetch (Google News RSS per geography) ---------------------

  /**
   * Fetch local real estate news for top metros and counties.
   * Reads batch settings from AppConfigService, delegates to local-news-fetcher.
   */
  private async fetchLocalArticles(): Promise<NewsArticle[]> {
    try {
      const [maxMetros, maxCounties, batchSize, batchDelay] = await Promise.all([
        this.appConfig.getNumber('QUINN_MAX_METROS', 900),
        this.appConfig.getNumber('QUINN_MAX_COUNTIES', 500),
        this.appConfig.getNumber('QUINN_BRIEFING_BATCH_SIZE', 10),
        this.appConfig.getNumber('QUINN_BRIEFING_BATCH_DELAY_MS', 2000),
      ]);

      const client = this.supabase.getClient();
      const geographies = await loadTargetGeographies(client, maxMetros, maxCounties);
      if (geographies.length === 0) {
        this.logger.warn('No geographies found for local news fetch');
        return [];
      }

      this.logger.log(
        `Fetching local news for ${geographies.length} geographies (batch size ${batchSize})`,
      );

      const localArticles = await fetchLocalNews(geographies, batchSize, batchDelay);

      // Convert LocalNewsArticle → NewsArticle with pre-set geography info
      return localArticles.map((la) => ({
        title: la.title,
        description: la.description,
        url: la.url,
        source: { name: 'Google News' },
        publishedAt: la.publishedAt,
        _preTaggedGeo: {
          id: la.sourceGeographyId,
          type: la.sourceGeographyType,
          name: la.sourceGeographyName,
        },
      } as NewsArticle & { _preTaggedGeo: { id: string; type: string; name: string } }));
    } catch (err: any) {
      this.logger.warn(`Local news fetch failed: ${err.message}`);
      return [];
    }
  }

  // -- RSS Feed Fetch -------------------------------------------------------

  /** Fetch articles from all configured RSS feeds in parallel */
  private async fetchFromRssFeeds(): Promise<NewsArticle[]> {
    const parser = new Parser({ timeout: 15_000 });
    const allArticles: NewsArticle[] = [];

    const feedResults = await Promise.allSettled(
      DEFAULT_RSS_FEEDS.map(async (feed) => {
        try {
          const parsed = await parser.parseURL(feed.url);
          const articles: NewsArticle[] = (parsed.items || [])
            .filter((item) => item.link && item.title)
            .map((item) => ({
              title: item.title ?? null,
              description: item.contentSnippet || item.content || item.summary || null,
              url: item.link!,
              source: { name: feed.name },
              publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
            }));
          this.logger.log(`Fetched ${articles.length} articles from ${feed.name}`);
          return articles;
        } catch (err: any) {
          this.logger.warn(`RSS feed "${feed.name}" failed: ${err.message}`);
          return [];
        }
      }),
    );

    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      }
    }

    this.logger.log(`Total articles fetched from RSS feeds: ${allArticles.length}`);
    return allArticles;
  }

  // -- Deduplication --------------------------------------------------------

  /**
   * Batched URL dedup — queries in chunks of 200 to stay within
   * Supabase/PostgREST query size limits.
   */
  private async findExistingUrlsBatched(articles: NewsArticle[]): Promise<Set<string>> {
    const urls = [...new Set(articles.map(a => a.url).filter(Boolean))];
    const existing = new Set<string>();
    const client = this.supabase.getClient();
    const CHUNK_SIZE = 200;

    for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
      try {
        const chunk = urls.slice(i, i + CHUNK_SIZE);
        const { data, error } = await client
          .from('market_news')
          .select('url')
          .in('url', chunk);
        if (!error && data) {
          data.forEach((row: { url: string }) => existing.add(row.url));
        }
      } catch (err) {
        this.logger.warn(`URL dedup batch failed: ${err.message}`);
      }
    }

    this.logger.log(`URL dedup: ${existing.size} of ${urls.length} unique URLs already in DB`);
    return existing;
  }

  /**
   * Headline dedup — catches the same article from different sources
   * (e.g., Google News redirect URL vs direct CNBC URL).
   * Only checks recent articles (last 7 days) to limit query size.
   */
  private async findExistingHeadlines(articles: NewsArticle[]): Promise<Set<string>> {
    try {
      const client = this.supabase.getClient();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data, error } = await client
        .from('market_news')
        .select('headline')
        .gte('published_at', sevenDaysAgo);

      if (error || !data) return new Set();
      const headlines = new Set(
        data.map((row: { headline: string }) => row.headline.trim().toLowerCase()),
      );
      this.logger.log(`Headline dedup: ${headlines.size} existing headlines loaded`);
      return headlines;
    } catch (err) {
      this.logger.warn(`Headline dedup failed: ${err.message}`);
      return new Set();
    }
  }

  // -- Article Processing ---------------------------------------------------

  /** Geo-tag, classify via LLM, and insert a single article */
  private async processAndStoreArticle(article: NewsArticle): Promise<void> {
    const headline = article.title ?? '';
    const description = article.description ?? '';
    const sourceName = article.source?.name ?? 'Unknown';

    // Check if article was pre-tagged from local news fetch
    const preTagged = (article as any)._preTaggedGeo as
      | { id: string; type: string; name: string }
      | undefined;

    let geographyIds: string[];
    let geoType: string | null;
    let geoConfidence: number;

    if (preTagged) {
      // Local article — geography is already known from the search query
      geographyIds = [preTagged.id];
      geoType = preTagged.type;
      geoConfidence = 1.0;
    } else {
      // National article — run geo-tagger to detect location
      const geoTags = await this.geoTagger.tagArticle(headline, description);
      geographyIds = geoTags.map(t => t.geography_id);
      geoType = geographyIds.length > 0 ? 'metro' : null;
      geoConfidence = geoTags.length > 0
        ? Math.max(...geoTags.map(t => t.confidence))
        : 0;
    }

    // LLM classification (with fallback)
    const classification = await classifyArticle(headline, description, this.appConfig);

    const client = this.supabase.getClient();
    const { error } = await client.from('market_news').upsert(
      {
        url: article.url,
        headline,
        source_name: sourceName,
        published_at: article.publishedAt,
        summary: classification.summary,
        tags: classification.tags,
        sentiment: classification.sentiment,
        geography_ids: geographyIds,
        geography_type: geoType,
        geo_tag_confidence: geoConfidence,
        raw_description: description,
        ingested_at: new Date().toISOString(),
      },
      { onConflict: 'url', ignoreDuplicates: true },
    );

    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }
  }
}

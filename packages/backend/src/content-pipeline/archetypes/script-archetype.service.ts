import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { SupabaseService } from '../../supabase/supabase.service';
import { YouTubeDiscoveryService } from './youtube-discovery.service';
import { TranscriptFetcherService } from './transcript-fetcher.service';
import {
  ArchetypeClusteringService,
  type BuiltCluster,
} from './archetype-clustering.service';

const DEFAULT_QUERIES = [
  'real estate market analysis',
  'best cities to invest in real estate',
  'housing market crash 2026',
  'top markets for cashflow',
  'best cities to buy rental property',
  'where to invest in real estate',
];

const PROMPT_SYNTHESIS_MODEL = 'gpt-4o-mini';

interface ArchetypeRefreshResult {
  refreshRunId: string;
  videosDiscovered: number;
  transcriptsFetched: number;
  clustersBuilt: number;
  archetypesPromoted: number;
  totalCostUsd: number;
}

/**
 * End-to-end orchestrator for the archetype pipeline:
 *   discovery (YouTubeDiscoveryService) → transcripts (TranscriptFetcherService)
 *   → embeddings + clustering (ArchetypeClusteringService) → promotion
 *
 * Promotion: each cluster that survives the size threshold is summarized
 * by GPT-4o-mini into a `script_archetypes` row with prompt_template
 * + display_name + description. The wizard (Task 2.34) reads this table.
 */
@Injectable()
export class ScriptArchetypeService {
  private readonly logger = new Logger(ScriptArchetypeService.name);
  private synthesisClient: OpenAI | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly discovery: YouTubeDiscoveryService,
    private readonly transcripts: TranscriptFetcherService,
    private readonly clustering: ArchetypeClusteringService,
  ) {}

  private getSynthesisClient(): OpenAI {
    if (!this.synthesisClient) {
      if (!process.env.OPENAI_API_KEY)
        throw new Error('OPENAI_API_KEY required for archetype promotion');
      this.synthesisClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.synthesisClient;
  }

  async refresh(args?: {
    queries?: string[];
    topN?: number;
  }): Promise<ArchetypeRefreshResult> {
    const client = this.supabase.getClient();
    const { data: runRow, error: runErr } = await client
      .from('archetype_refresh_runs')
      .insert({ status: 'running', started_at: new Date().toISOString() })
      .select('id')
      .single();
    if (runErr || !runRow)
      throw runErr ?? new Error('failed to create refresh row');
    const refreshRunId = runRow.id as string;
    let totalCostUsd = 0;

    try {
      const queries = args?.queries ?? DEFAULT_QUERIES;
      const topN = args?.topN ?? 100;

      // 1. discovery
      const videos = await this.discovery.discover({ queries, topN });
      // Cache discovered video metadata into transcript_cache so we can
      // join view_count → cluster medianViewCount later.
      for (const v of videos) {
        await client.from('transcript_cache').upsert(
          {
            video_id: v.videoId,
            channel_id: v.channelId,
            channel_title: v.channelTitle,
            title: v.title,
            description: v.description,
            view_count: v.viewCount,
            like_count: v.likeCount,
            comment_count: v.commentCount,
            published_at: v.publishedAt,
            duration_seconds: v.durationSeconds,
          },
          { onConflict: 'video_id' },
        );
      }
      this.logger.log(`[ARCHETYPE] discovery complete videos=${videos.length}`);

      // 2. transcripts (skip already-cached)
      let transcriptsFetched = 0;
      for (const v of videos) {
        const r = await this.transcripts.fetchAndCache(v.videoId);
        if (r.transcript) transcriptsFetched++;
      }
      this.logger.log(
        `[ARCHETYPE] transcripts complete cached=${transcriptsFetched}/${videos.length}`,
      );

      // 3. embed + cluster
      const embedRes = await this.clustering.embedMissing(
        videos.map((v) => v.videoId),
      );
      totalCostUsd += embedRes.cost_usd;
      const clusters = await this.clustering.cluster(
        videos.map((v) => v.videoId),
      );
      this.logger.log(
        `[ARCHETYPE] clustering complete clusters=${clusters.length}`,
      );

      // Persist clusters
      for (const c of clusters) {
        await client.from('archetype_clusters').insert({
          cluster_label: 'pending',
          centroid_embedding: c.centroid,
          member_video_ids: c.members,
          member_count: c.members.length,
          median_view_count: c.medianViewCount,
          refresh_run_id: refreshRunId,
        });
      }

      // 4. promote — synthesize an archetype for each cluster
      let promoted = 0;
      for (const c of clusters) {
        const promotion = await this.promoteCluster(c, refreshRunId);
        if (promotion) {
          promoted++;
          totalCostUsd += promotion.cost_usd;
        }
      }

      const finishPatch = {
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        videos_discovered: videos.length,
        transcripts_fetched: transcriptsFetched,
        clusters_built: clusters.length,
        archetypes_promoted: promoted,
        total_cost_usd: totalCostUsd,
      };
      await client
        .from('archetype_refresh_runs')
        .update(finishPatch)
        .eq('id', refreshRunId);

      return {
        refreshRunId,
        videosDiscovered: videos.length,
        transcriptsFetched,
        clustersBuilt: clusters.length,
        archetypesPromoted: promoted,
        totalCostUsd,
      };
    } catch (err) {
      const message = (err as Error).message.slice(0, 500);
      await client
        .from('archetype_refresh_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: message,
          total_cost_usd: totalCostUsd,
        })
        .eq('id', refreshRunId);
      throw err;
    }
  }

  /** Synthesize an archetype row from a cluster via GPT-4o-mini. */
  private async promoteCluster(
    cluster: BuiltCluster,
    refreshRunId: string,
  ): Promise<{ cost_usd: number } | null> {
    const client = this.supabase.getClient();
    const { data: rows } = await client
      .from('transcript_cache')
      .select('title, transcript')
      .in('video_id', cluster.members)
      .limit(8);
    const samples = (rows ?? []) as Array<{
      title: string;
      transcript: string | null;
    }>;
    const sampleBlock = samples
      .map(
        (s, i) =>
          `EXAMPLE ${i + 1}\nTITLE: ${s.title}\nTRANSCRIPT: ${(s.transcript ?? '').slice(0, 800)}`,
      )
      .join('\n\n---\n\n');

    const prompt = `These are ${samples.length} top-performing real estate YouTube video transcripts that share a similar script structure. Identify the structure and produce a reusable archetype.

${sampleBlock}

Return ONLY a JSON object:
{
  "slug": "short_snake_case_id (max 30 chars)",
  "display_name": "Human-readable name (max 60 chars)",
  "description": "1-2 sentence description of when to use this archetype",
  "format_affinity": ["one or more of: grade_reveal, top_10_ranking, score_mover, head_to_head, long_form_deep_dive, farm_area_spotlight, brokerage_market_share, recruitment_angle"],
  "prompt_template": "A reusable prompt scaffold. Use {{market_name}} {{score}} {{cta}} placeholders where the script generator should substitute run-specific data. Capture hook patterns, body structure, and CTA style. 3-6 sentences."
}`;

    let cost = 0;
    let parsed: {
      slug: string;
      display_name: string;
      description: string;
      format_affinity: string[];
      prompt_template: string;
    } | null = null;
    try {
      const res = await this.getSynthesisClient().chat.completions.create({
        model: PROMPT_SYNTHESIS_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      });
      const raw = res.choices[0]?.message?.content?.trim() ?? '';
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
      // gpt-4o-mini: $0.15 / 1M input, $0.60 / 1M output. Rough estimate.
      const inToks = res.usage?.prompt_tokens ?? 0;
      const outToks = res.usage?.completion_tokens ?? 0;
      cost = (inToks / 1_000_000) * 0.15 + (outToks / 1_000_000) * 0.6;
    } catch (err) {
      this.logger.warn(
        `[ARCHETYPE] promote synthesis failed: ${(err as Error).message.slice(0, 120)}`,
      );
      return null;
    }
    if (!parsed) return null;

    await client.from('script_archetypes').upsert(
      {
        slug: parsed.slug,
        display_name: parsed.display_name,
        description: parsed.description,
        format_affinity: parsed.format_affinity,
        prompt_template: parsed.prompt_template,
        example_video_ids: cluster.members.slice(0, 5),
        median_view_count: cluster.medianViewCount,
        member_count: cluster.members.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' },
    );
    // Tag the cluster with the resolved label.
    await client
      .from('archetype_clusters')
      .update({ cluster_label: parsed.display_name })
      .eq('refresh_run_id', refreshRunId)
      .contains('member_video_ids', cluster.members);

    return { cost_usd: cost };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { SupabaseService } from '../../supabase/supabase.service';

const EMBEDDING_MODEL = 'text-embedding-3-small';
// $0.02 per 1M tokens (OpenAI text-embedding-3-small, verified 2026-04).
const EMBEDDING_USD_PER_1M_TOKENS = 0.02;
const SIMILARITY_THRESHOLD = 0.78;

interface CachedTranscript {
  video_id: string;
  transcript: string;
  view_count: number | null;
  embedding: number[] | null;
}

export interface BuiltCluster {
  members: string[];
  centroid: number[];
  medianViewCount: number;
}

/**
 * Embeds cached transcripts and groups them into clusters via single-link
 * cosine-similarity agglomeration. Cheap (~$0.0002 per 1k transcripts on
 * text-embedding-3-small) and good enough for this use case — picking a
 * handful of distinct script archetypes from ~500 candidate videos.
 *
 * Embeddings are cached in `transcript_cache.embedding` so subsequent
 * refresh runs only embed the deltas.
 */
@Injectable()
export class ArchetypeClusteringService {
  private readonly logger = new Logger(ArchetypeClusteringService.name);
  private client: OpenAI | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      if (!process.env.OPENAI_API_KEY)
        throw new Error('OPENAI_API_KEY required for clustering');
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this.client;
  }

  /**
   * Embed any cached transcripts that are missing embeddings. Returns
   * the approximate cost in USD for the embedding calls.
   */
  async embedMissing(videoIds: string[]): Promise<{ cost_usd: number }> {
    if (videoIds.length === 0) return { cost_usd: 0 };
    const client = this.supabase.getClient();
    const { data } = await client
      .from('transcript_cache')
      .select('video_id, transcript, embedding')
      .in('video_id', videoIds)
      .not('transcript', 'is', null);
    const rows = (data ?? []) as Array<{
      video_id: string;
      transcript: string;
      embedding: number[] | null;
    }>;
    const toEmbed = rows.filter((r) => !r.embedding && r.transcript);
    if (toEmbed.length === 0) return { cost_usd: 0 };

    let totalTokens = 0;
    // Embed in batches of 100 to stay under request body limits.
    for (let i = 0; i < toEmbed.length; i += 100) {
      const batch = toEmbed.slice(i, i + 100);
      const inputs = batch.map((r) => r.transcript.slice(0, 8000));
      const res = await this.getClient().embeddings.create({
        model: EMBEDDING_MODEL,
        input: inputs,
      });
      totalTokens += res.usage?.total_tokens ?? 0;
      for (let j = 0; j < batch.length; j++) {
        const v = res.data[j].embedding;
        await client
          .from('transcript_cache')
          .update({ embedding: v, embedding_model: EMBEDDING_MODEL })
          .eq('video_id', batch[j].video_id);
      }
    }
    const cost = (totalTokens / 1_000_000) * EMBEDDING_USD_PER_1M_TOKENS;
    this.logger.log(
      `[CLUSTER] embedded ${toEmbed.length} transcripts tokens=${totalTokens} cost=$${cost.toFixed(4)}`,
    );
    return { cost_usd: cost };
  }

  /**
   * Single-link agglomerative clustering by cosine similarity. Returns
   * clusters that pass the similarity threshold AND have ≥3 members
   * (smaller clusters are noise).
   */
  async cluster(videoIds: string[]): Promise<BuiltCluster[]> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('transcript_cache')
      .select('video_id, embedding, view_count')
      .in('video_id', videoIds)
      .not('embedding', 'is', null);
    const items = (data ?? []) as CachedTranscript[];
    const valid = items.filter((i) => i.embedding && i.embedding.length > 0);
    if (valid.length < 3) return [];

    const groups: number[][] = [];
    const assigned = new Set<number>();
    for (let i = 0; i < valid.length; i++) {
      if (assigned.has(i)) continue;
      const group = [i];
      assigned.add(i);
      for (let j = i + 1; j < valid.length; j++) {
        if (assigned.has(j)) continue;
        const sim = cosine(valid[i].embedding!, valid[j].embedding!);
        if (sim >= SIMILARITY_THRESHOLD) {
          group.push(j);
          assigned.add(j);
        }
      }
      if (group.length >= 3) groups.push(group);
    }

    return groups.map((indices) => {
      const members = indices.map((i) => valid[i]);
      const centroid = mean(members.map((m) => m.embedding!));
      const sortedViews = members
        .map((m) => m.view_count ?? 0)
        .sort((a, b) => a - b);
      const median = sortedViews[Math.floor(sortedViews.length / 2)];
      return {
        members: members.map((m) => m.video_id),
        centroid,
        medianViewCount: median,
      };
    });
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function mean(vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const out = new Array<number>(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) out[i] += v[i];
  return out.map((x) => x / vectors.length);
}

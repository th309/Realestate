import { SupabaseClient } from '@supabase/supabase-js';
import { getAssetSignedUrl } from './asset-signing';

/** Newest run scanned per lookup — bounds the query as the run table grows. */
const RECENT_RUNS_SCANNED = 200;

/** States whose runs are considered to have produced a showable video. */
const SHOWABLE_STATES = [
  'published',
  'published_partial',
  'ready_for_review',
] as const;

export interface FormatSampleVideo {
  runId: string;
  marketName: string;
  videoUrl: string | null;
}

/**
 * For each format, return a signed URL to the most recent successful run's
 * video_master so the /new wizard's format picker can show what the format
 * ACTUALLY produces today (instead of the static MP4 baked into
 * /public/format-previews/ at P1 time).
 *
 * Picks the newest run in published / published_partial / ready_for_review
 * state per format. Returns null for any format that hasn't produced a video
 * yet — caller falls back to the static MP4.
 *
 * Split out of ContentPipelineQueriesService (CLAUDE.md §1.3); it needs only a
 * client, so it stays a plain function like its sibling `asset-signing.ts`.
 */
export async function getFormatSampleVideos(
  client: SupabaseClient,
): Promise<Record<string, FormatSampleVideo>> {
  const { data: runs } = await client
    .from('content_runs')
    .select('id, format, market_query, status, created_at')
    .in('status', SHOWABLE_STATES as unknown as string[])
    .order('created_at', { ascending: false })
    .limit(RECENT_RUNS_SCANNED);
  if (!runs || runs.length === 0) return {};

  const newestPerFormat = new Map<
    string,
    { id: string; marketQuery: string }
  >();
  for (const r of runs) {
    const format = r.format as string;
    if (!newestPerFormat.has(format)) {
      newestPerFormat.set(format, {
        id: r.id as string,
        marketQuery: (r.market_query as string) ?? 'Unknown',
      });
    }
  }

  const result: Record<string, FormatSampleVideo> = {};
  await Promise.all(
    Array.from(newestPerFormat.entries()).map(async ([format, run]) => {
      const signed = await getAssetSignedUrl(client, run.id, 'video_master');
      result[format] = {
        runId: run.id,
        marketName: run.marketQuery,
        videoUrl: signed?.url ?? null,
      };
    }),
  );
  return result;
}

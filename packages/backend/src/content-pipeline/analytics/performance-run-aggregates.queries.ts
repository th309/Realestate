// packages/backend/src/content-pipeline/analytics/performance-run-aggregates.queries.ts
/**
 * Per-run rollups behind the content-performance dashboard. Each function
 * takes a batch of run ids and returns a map keyed by run id, so the callers
 * can fan out with Promise.all and stitch the results together per format,
 * per run, or into a single average.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { RevenueAttributionService } from './revenue-attribution.service';

export async function fetchViewsByRun(
  client: SupabaseClient,
  runIds: string[],
  window: '7d' | '30d',
): Promise<Record<string, number>> {
  if (runIds.length === 0) return {};
  const { data } = await client
    .from('content_metrics')
    .select('run_id, views')
    .in('run_id', runIds)
    .eq('window', window);
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const runId = String(row.run_id);
    out[runId] = (out[runId] ?? 0) + Number(row.views ?? 0);
  }
  return out;
}

export async function fetchSignupsByRun(
  client: SupabaseClient,
  runIds: string[],
  windowDays: number,
): Promise<Record<string, number>> {
  if (runIds.length === 0) return {};
  const sinceIso = new Date(
    Date.now() - windowDays * 24 * 3600 * 1000,
  ).toISOString();
  const { data } = await client
    .from('signup_attributions')
    .select('content_run_id')
    .in('content_run_id', runIds)
    .gte('signup_at', sinceIso);
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const runId = String(row.content_run_id);
    out[runId] = (out[runId] ?? 0) + 1;
  }
  return out;
}

/** Revenue attribution is per-run and may fail independently; a failed lookup contributes 0. */
export async function fetchMrrByRun(
  revenue: RevenueAttributionService,
  runIds: string[],
): Promise<Record<string, number>> {
  if (runIds.length === 0) return {};
  const out: Record<string, number> = {};
  await Promise.all(
    runIds.map(async (runId) => {
      try {
        const rev = await revenue.getRevenueByRun(runId);
        out[runId] = Number(rev.total_mrr_contribution_usd ?? 0);
      } catch {
        out[runId] = 0;
      }
    }),
  );
  return out;
}

export async function fetchPostsByRun(
  client: SupabaseClient,
  runIds: string[],
): Promise<Record<string, number>> {
  if (runIds.length === 0) return {};
  const { data } = await client
    .from('platform_posts')
    .select('run_id')
    .in('run_id', runIds);
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const runId = String(row.run_id);
    out[runId] = (out[runId] ?? 0) + 1;
  }
  return out;
}

export async function fetchPlatformsByRun(
  client: SupabaseClient,
  runIds: string[],
): Promise<Record<string, string[]>> {
  if (runIds.length === 0) return {};
  const { data } = await client
    .from('platform_posts')
    .select('run_id, platform')
    .in('run_id', runIds);
  const out: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const runId = String(row.run_id);
    const platform = String(row.platform ?? '');
    if (!platform) continue;
    out[runId] = out[runId] ?? [];
    if (!out[runId].includes(platform)) out[runId].push(platform);
  }
  return out;
}

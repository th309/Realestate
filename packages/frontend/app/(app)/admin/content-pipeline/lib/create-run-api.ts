/**
 * Run creation — the single POST that starts a pipeline run, plus the
 * per-format params it can carry.
 *
 * Split out of `content-pipeline-api.ts` to keep that file under the 300-line
 * hard limit (CLAUDE §1.3). That file re-exports everything here, so existing
 * `from "../lib/content-pipeline-api"` imports keep resolving unchanged.
 */
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export interface RankingRunParams {
  format: "top_10_ranking" | "bottom_10_ranking";
  metric: { id: string };
  geo_level: "metro" | "county" | "zip";
  scope: { type: "national" | "state" | "metro"; id: string | null };
  resolved_markets: Array<{
    rank: number;
    region_id: string;
    region_name: string;
    state: string | null;
    value: number;
    value_formatted: string;
  }>;
}

export interface CreateRunFormatOptions {
  windowDays?: 30 | 90 | 180 | 365;
  /** Long-form metro hero: id from bundled `metro-hero-options.json`. */
  heroImageOptionId?: string;
  /** Phase 3: video style reference id (Style Library). */
  styleReferenceId?: string;
}

/**
 * Infographic runs name exactly ONE numbered task from ONE vetted topic doc —
 * the one-task-per-graphic product rule, expressed in the payload.
 */
export interface InfographicRunParams {
  topic_slug: string;
  task_number: number;
  style_id: string;
}

export async function createRun(payload: {
  format: string;
  marketQuery: string;
  idempotencyKey: string;
  approvalMode?: "auto" | "review" | "draft";
  selectedPlatforms?: string[];
  rankingParams?: RankingRunParams;
  /**
   * Infographic runs send their topic/task/style here. The key matches the
   * backend's CreateRunDto field and sits alongside `rankingParams` — the
   * global validation pipe runs `whitelist: true`, so a key the DTO doesn't
   * declare is stripped before the handler sees it and the run is rejected
   * for missing params it was actually sent.
   */
  infographicParams?: InfographicRunParams;
  formatOptions?: CreateRunFormatOptions;
}) {
  const res = await fetchAPIRaw("/api/admin/content-pipeline/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "createRun failed");
  return json.data;
}

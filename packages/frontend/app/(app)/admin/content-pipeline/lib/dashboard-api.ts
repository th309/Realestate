/**
 * The studio home's read model: the dashboard fetch and the run-summary shape
 * it returns. Split out of `content-pipeline-api.ts` to keep that file under
 * the 300-line hard limit (CLAUDE §1.3); it re-exports everything here, so
 * existing `from "../lib/content-pipeline-api"` imports keep resolving.
 */
import { fetchAPI } from "@/lib/data/fetchers/base";
import type { PipelineStatus } from "./content-pipeline-api";

export interface RunSummary {
  id: string;
  format: string;
  status: PipelineStatus;
  market_query: string;
  created_at: string;
  thumbnail_url?: string;
  has_video?: boolean;
  views?: number;
  signups?: number;
}

export interface DashboardData {
  thisWeek: {
    published: number;
    inReview: number;
    signups: number;
    revenueUsd: number;
  };
  recentRuns: RunSummary[];
  reviewQueueCount: number;
  upcomingAutoRuns?: Array<{
    rule_name: string;
    format: string;
    /** Opaque here — no frontend surface reads the match rows yet. */
    matches: unknown[];
  }>;
  costCapStatus?: { breached: boolean; usdSpent: number; usdCap: number };
}

export async function fetchDashboard(
  opts: { batchId?: string } = {},
): Promise<DashboardData> {
  const path = opts.batchId
    ? `/api/admin/content-pipeline/dashboard?batchId=${encodeURIComponent(opts.batchId)}`
    : "/api/admin/content-pipeline/dashboard";
  const res = await fetchAPI<{ data: DashboardData }>(path);
  return res.data;
}

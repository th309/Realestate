/**
 * Typed wrappers around @/lib/data for the content-pipeline insights endpoints
 * (social analytics: reach / engagement / follower growth over a 30-day window
 * vs the prior 30 days). Built against the frozen contract; the backend fills
 * it in later. Follows the sibling *-api.ts pattern (fetchAPI + { success, data }).
 */
import { fetchAPI } from "@/lib/data/fetchers/base";

export interface InsightsWindow {
  from: string;
  to: string;
}

export interface InsightsTotals {
  reach: number;
  engagement: number;
  followersDelta: number;
  posts: number;
}

export interface PlatformInsight {
  platform: string;
  reach: number;
  engagement: number;
  posts: number;
}

export interface InsightsOverview {
  window: InsightsWindow;
  prior: InsightsWindow;
  totals: InsightsTotals;
  priorTotals: InsightsTotals;
  perPlatform: PlatformInsight[];
}

export interface InsightPost {
  postId: string;
  platform: string;
  postType: string;
  publishedAt: string;
  permalink: string | null;
  reach: number;
  engagement: number;
  hook: string | null;
}

/** Reach/engagement/follower totals for the last `days`, plus the prior window. */
export async function fetchInsightsOverview(
  days = 30,
): Promise<InsightsOverview> {
  const res = await fetchAPI<{ data: InsightsOverview }>(
    `/api/admin/content-pipeline/insights/overview?days=${days}`,
  );
  return res.data;
}

/** Per-post performance for the last `days`, newest first. */
export async function fetchInsightsPosts(
  days = 30,
  limit = 50,
): Promise<InsightPost[]> {
  const res = await fetchAPI<{ data: { posts: InsightPost[] } }>(
    `/api/admin/content-pipeline/insights/posts?days=${days}&limit=${limit}`,
  );
  return res.data.posts;
}

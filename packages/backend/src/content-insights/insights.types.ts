/**
 * Content-pipeline social insights contract — mirrors the FROZEN frontend shapes
 * in app/(app)/admin/content-pipeline/lib/insights-api.ts EXACTLY. Do not rename
 * fields here without changing the frontend (and vice versa).
 *
 * NOTE: distinct from src/insights/ (AI market-narrative insights) — different
 * feature, different module (ContentInsightsModule).
 */

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

/** Raw `analytics_snapshots` row (Phase 2 migration shape). */
export interface AnalyticsSnapshotRow {
  post_id: string | null;
  brand_id: string;
  platform: string;
  reach: number | null;
  engagement: number | null;
  followers_delta: number | null;
  captured_at: string;
}

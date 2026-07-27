// packages/backend/src/content-pipeline/analytics/performance.types.ts
export interface PerformanceHeroCard {
  sinceDays: number;
  publishedRuns: number;
  avgViews7d: number | null;
  avgSignups7d: number | null;
  avgMrr7dUsd: number | null;
}

export interface FormatConversionRow {
  format: string;
  runs: number;
  posts: number;
  views7d: number;
  signups7d: number;
  mrr7dUsd: number;
  signupsPer1kViews: number | null;
}

export interface HookPatternRow {
  format: string;
  winnerVariantId: 'A' | 'B';
  confidence: number;
  lift: number;
  aMeanRetention: number;
  bMeanRetention: number;
  aSamples: number;
  bSamples: number;
  lastPromotedAt: string | null;
}

export interface PerformanceRunRow {
  id: string;
  created_at: string;
  format: string;
  status: string;
  market_query: string;
  views_7d: number;
  signups_7d: number;
  mrr_7d_usd: number;
  platforms: string[];
}

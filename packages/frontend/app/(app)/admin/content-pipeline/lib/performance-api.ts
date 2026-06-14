import { fetchAPI } from "@/lib/data/fetchers/base";

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
  winnerVariantId: "A" | "B";
  confidence: number;
  lift: number;
  lastPromotedAt: string | null;
}

export interface SuggestedRun {
  title: string;
  reason: string;
  createPayload: {
    format: string;
    marketQuery: string;
    approvalMode?: "auto" | "review" | "draft";
  };
}

export interface PerformanceOverviewResponse {
  hero: PerformanceHeroCard;
  formatConversion: FormatConversionRow[];
  hookPatterns: HookPatternRow[];
  suggestedRuns: SuggestedRun[];
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

export async function fetchPerformanceOverview(opts?: { sinceDays?: number }) {
  const qs =
    opts?.sinceDays != null ? `?sinceDays=${encodeURIComponent(opts.sinceDays)}` : "";
  const res = await fetchAPI<{ data: PerformanceOverviewResponse }>(
    `/api/admin/content-pipeline/performance/overview${qs}`,
  );
  return res.data;
}

export async function fetchPerformanceRuns(opts?: {
  sinceDays?: number;
  format?: string;
  sort?: "created_at" | "views_7d" | "signups_7d" | "mrr_7d";
  dir?: "asc" | "desc";
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.sinceDays != null) params.set("sinceDays", String(opts.sinceDays));
  if (opts?.format) params.set("format", opts.format);
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.dir) params.set("dir", opts.dir);
  if (opts?.limit != null) params.set("limit", String(opts.limit));

  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetchAPI<{ data: { rows: PerformanceRunRow[] } }>(
    `/api/admin/content-pipeline/performance/runs${qs}`,
  );
  return res.data.rows;
}


/**
 * Typed wrappers around @/lib/data for content-pipeline admin endpoints.
 * All calls go through the canonical fetch layer.
 */
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

export type PipelineStatus =
  | "queued"
  | "fetching_data"
  | "scripting"
  | "verifying_data"
  | "linting_voice"
  | "rendering_voice"
  | "timing_captions"
  | "rendering_video"
  | "ready_for_review"
  | "publishing"
  | "published"
  | "published_partial"
  | "rejected"
  | "failed";

export type ContentFormat =
  | "grade_reveal"
  | "top_10_ranking"
  | "score_mover"
  | "head_to_head"
  | "long_form_deep_dive"
  | "farm_area_spotlight"
  | "brokerage_market_share"
  | "recruitment_angle";

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
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetchAPI<{ data: DashboardData }>(
    "/api/admin/content-pipeline/dashboard",
  );
  return res.data;
}

export async function fetchRun(id: string) {
  const res = await fetchAPI<{ data: any }>(
    `/api/admin/content-pipeline/runs/${id}`,
  );
  return res.data;
}

export async function createRun(payload: {
  format: string;
  marketQuery: string;
  idempotencyKey: string;
  approvalMode?: "auto" | "review" | "draft";
  selectedPlatforms?: string[];
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

export async function approveRun(id: string) {
  return fetchAPIRaw(`/api/admin/content-pipeline/runs/${id}/approve`, {
    method: "POST",
  });
}

export async function rejectRun(id: string, reason: string) {
  return fetchAPIRaw(`/api/admin/content-pipeline/runs/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export async function retryRun(id: string) {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/runs/${id}/retry`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`retryRun failed: ${res.status} ${body}`);
  }
  return (await res.json()) as { success: boolean; data: { status: string } };
}

export async function editScript(
  id: string,
  variantId: "A" | "B",
  newFullText: string,
) {
  return fetchAPIRaw(`/api/admin/content-pipeline/runs/${id}/edit-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variantId, newFullText }),
  });
}

export async function resolveMarket(query: string) {
  const res = await fetchAPIRaw("/api/admin/content-pipeline/resolve-market", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`resolveMarket failed: ${res.status}`);
  const json = (await res.json()) as { data: { matches: any[] } };
  return json.data.matches;
}

export async function fetchAssetSignedUrl(
  runId: string,
  kind: "video_master" | "audio",
): Promise<{ url: string; kind: string } | null> {
  const res = await fetchAPI<{
    data: { url: string; kind: string } | null;
  }>(
    `/api/admin/content-pipeline/runs/${runId}/asset-url?kind=${encodeURIComponent(kind)}`,
  );
  return res.data;
}

export async function fetchReviewQueue() {
  const res = await fetchAPI<{ data: { items: any[] } }>(
    "/api/admin/content-pipeline/review/queue",
  );
  return res.data.items;
}

export async function fetchPlatforms() {
  const res = await fetchAPI<{
    data: {
      platforms: Array<{
        platform: string;
        configured: boolean;
        lastPublishedAt: string | null;
      }>;
    };
  }>("/api/admin/content-pipeline/platforms");
  return res.data.platforms;
}

export async function connectPlatform(platform: string) {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/platforms/${platform}/connect`,
    { method: "POST" },
  );
  const json = await res.json();
  return json.data;
}

export async function fetchSettings() {
  const res = await fetchAPI<{ data: any }>(
    "/api/admin/content-pipeline/settings",
  );
  return res.data;
}

export async function updateSettings(patch: { strictness?: string }) {
  return fetchAPIRaw("/api/admin/content-pipeline/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function pausePipeline() {
  return fetchAPIRaw("/api/admin/content-pipeline/pause", { method: "POST" });
}

export async function resumePipeline() {
  return fetchAPIRaw("/api/admin/content-pipeline/resume", { method: "POST" });
}

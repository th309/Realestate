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
  | "failed"
  | "cancelled";

export type ContentFormat =
  | "grade_reveal"
  | "top_10_ranking"
  | "bottom_10_ranking"
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

export async function fetchDashboard(
  opts: { batchId?: string } = {},
): Promise<DashboardData> {
  const path = opts.batchId
    ? `/api/admin/content-pipeline/dashboard?batchId=${encodeURIComponent(opts.batchId)}`
    : "/api/admin/content-pipeline/dashboard";
  const res = await fetchAPI<{ data: DashboardData }>(path);
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

export async function cancelRun(id: string, reason?: string) {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/runs/${id}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`cancelRun failed: ${res.status} ${body}`);
  }
  return (await res.json()) as { success: boolean; data: { status: string } };
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
  kind: "video_master" | "audio" | "thumbnail",
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

export interface AppCredentialStatus {
  configured: boolean;
  source: "database" | "env" | null;
  lastFour: string | null;
  updatedAt: string | null;
  notes: string | null;
  /** OAuth callback URI computed by the backend from its own APP_BASE_URL. */
  redirectUri: string | null;
}

export interface PlatformStatus {
  platform: string;
  configured: boolean;
  supported: boolean;
  accountLabel: string | null;
  connectedAt: string | null;
  lastPublishedAt: string | null;
  appCredentials: AppCredentialStatus;
}

export async function fetchPlatforms(): Promise<PlatformStatus[]> {
  const res = await fetchAPI<{
    data: {
      platforms: PlatformStatus[];
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

export async function disconnectPlatform(
  platform: string,
): Promise<{ disconnected: string }> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/platforms/${platform}/credentials`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Disconnect failed (${res.status}): ${body}`);
  }
  const parsed = (await res.json()) as { data: { disconnected: string } };
  return parsed.data;
}

// Settings + voices + format-default fetchers live in `settings-api.ts`
// (extracted to keep this file under the 300-line hard limit).

/**
 * Render a stored script for display. Scripts are stored with the
 * `{{SHORT_LINK}}` template placeholder (swapped to the spoken phrase
 * "Property IQ dot app" at TTS synthesis time, and to the visible URL
 * "propertyiq.app" in the video composition). For operator-facing
 * display, swap to the URL form so the review UI matches what viewers
 * see on screen. The stored template is untouched.
 */
export function displayScriptText(
  text: string | null | undefined,
  fallback = "(no script)",
): string {
  if (!text) return fallback;
  return text.replace(/\{\{SHORT_LINK\}\}/g, "propertyiq.app");
}

/**
 * Typed wrappers around @/lib/data for content-pipeline admin endpoints.
 * All calls go through the canonical fetch layer.
 */
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";
import type { RunDetail } from "./run-detail-types";

// The run-detail read model lives in `run-detail-types.ts` (extracted to keep
// this file under the 300-line hard limit) and is re-exported here.
export type {
  RunDetail,
  RunRow,
  RunEvent,
  RunGate,
  ContentAsset,
  ScriptVariant,
  RunScriptBudget,
} from "./run-detail-types";
export { findScriptVariant } from "./run-detail-types";

export type PipelineStatus =
  | "queued"
  | "fetching_data"
  | "scripting"
  | "verifying_data"
  | "linting_voice"
  | "rendering_voice"
  | "timing_captions"
  | "rendering_video"
  // Infographic lane only — driven by the local NotebookLM worker, not a
  // backend queue. `infographic_ready` is terminal success: the finished PNG
  // waits for review as a draft POST, not as a run, which is why it is
  // deliberately not `ready_for_review` (that status offers a resume action
  // that would push the run into the video pipeline).
  | "generating_infographic"
  | "infographic_ready"
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

// The dashboard read model (RunSummary, DashboardData, fetchDashboard) lives in
// `dashboard-api.ts` (extracted to keep this file under the 300-line hard
// limit) and is re-exported at the bottom of this file.

export async function fetchRun(id: string): Promise<RunDetail> {
  const res = await fetchAPI<{ data: RunDetail }>(
    `/api/admin/content-pipeline/runs/${id}`,
  );
  return res.data;
}

// Run creation lives in `create-run-api.ts` (extracted to keep this file under
// the 300-line hard limit) and is re-exported at the bottom of this file.

export async function approveRun(id: string): Promise<void> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/runs/${id}/approve`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`approveRun failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
  };
  if (json.success === false)
    throw new Error(json.error ?? "approveRun failed");
}

export async function rejectRun(id: string, reason: string): Promise<void> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/runs/${id}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`rejectRun failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
  };
  if (json.success === false) throw new Error(json.error ?? "rejectRun failed");
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

/** Curated skyline shots for long-form metro hero — `preview_url` is safe for `<img>`. */
export interface MetroHeroOption {
  id: string;
  label: string;
  license_note?: string;
  preview_url: string;
}

export async function fetchMetroHeroOptions(
  cbsaCode: string,
): Promise<MetroHeroOption[]> {
  const res = await fetchAPI<{
    success?: boolean;
    data: { options: MetroHeroOption[] };
  }>(
    `/api/admin/content-pipeline/metro-hero-options/${encodeURIComponent(cbsaCode)}`,
  );
  return res.data.options ?? [];
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
  /** Shares OAuth with this platform (e.g. long-form uses Shorts token). */
  mirrorsPlatform?: string | null;
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

// Ranking fetchers live in `ranking-api.ts` (extracted to keep this file under 300-line hard limit).
export {
  type ResolveRankingArgs,
  type RankingEntry,
  type ResolveRankingResponse,
  resolveRanking,
} from "./ranking-api";

export {
  editScript,
  continuePipelineFromReview,
} from "./script-edit-and-resume-api";

// Run creation fetchers live in `create-run-api.ts` (extracted to keep this file
// under the 300-line hard limit).
export {
  type RankingRunParams,
  type CreateRunFormatOptions,
  type InfographicRunParams,
  createRun,
} from "./create-run-api";

// Dashboard read model lives in `dashboard-api.ts` (same reason).
export {
  type RunSummary,
  type DashboardData,
  fetchDashboard,
} from "./dashboard-api";

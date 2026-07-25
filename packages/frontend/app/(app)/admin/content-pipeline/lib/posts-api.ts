/**
 * Typed wrappers around @/lib/data for the generalized `posts` model
 * (api/admin/content-pipeline/posts). Mirrors the sibling *-api.ts pattern:
 * fetchAPI/fetchAPIRaw + the { success, data } envelope. The planner reads
 * scheduled/approved posts and reschedules by setting scheduled_at.
 */
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

export type PostStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "scheduled"
  | "published"
  | "failed"
  | "skipped";

export interface PostCopy {
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string[];
  [key: string]: unknown;
}

/** A `posts` row, as returned by the admin posts API. */
export interface PlannerPost {
  id: string;
  brand_id: string;
  platform: string;
  post_type: string;
  copy: PostCopy;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  source: string;
}

export interface PostsListResult {
  posts: PlannerPost[];
  counts: Record<string, number>;
}

/**
 * List posts, optionally filtered by a single status (the API takes one
 * status at a time) and/or brand. Returns rows plus per-status counts.
 */
export async function fetchPosts(
  opts: { status?: PostStatus; brandId?: string; limit?: number } = {},
): Promise<PostsListResult> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.brandId) params.set("brandId", opts.brandId);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const path = `/api/admin/content-pipeline/posts${qs ? `?${qs}` : ""}`;
  const res = await fetchAPI<{ data: PostsListResult }>(path);
  return res.data;
}

/**
 * Reschedule a post to a new instant. Sends the canonical scheduled state so
 * this both reschedules an already-scheduled post and schedules an approved
 * one (approved -> scheduled is a valid transition; same-status is a no-op that
 * still updates scheduled_at). `scheduledAtIso` must be a UTC ISO8601 string.
 */
export async function reschedulePost(
  id: string,
  scheduledAtIso: string,
): Promise<PlannerPost> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/posts/${id}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "scheduled",
        scheduledAt: scheduledAtIso,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`reschedule failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    success?: boolean;
    data: PlannerPost;
    error?: string;
  };
  if (json.success === false) {
    throw new Error(json.error ?? "reschedule failed");
  }
  return json.data;
}

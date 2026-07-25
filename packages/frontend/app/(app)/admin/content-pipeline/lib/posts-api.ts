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
  | "publishing"
  | "published"
  | "failed"
  | "skipped";

export interface PostCopy {
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string[];
  /** Carousel slides / multi-part copy. */
  slides?: Array<{ heading?: string; body?: string }>;
  [key: string]: unknown;
}

export interface PostMediaRef {
  kind: string;
  url?: string;
  storage_path?: string;
  [key: string]: unknown;
}

/** A `posts` row, as returned by the admin posts API. */
export interface PlannerPost {
  id: string;
  brand_id: string;
  platform: string;
  post_type: string;
  copy: PostCopy;
  media_refs: PostMediaRef[];
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  source: string;
  /**
   * Server-resolved signed URLs (1h TTL) for this post's rendered media, in
   * slide order — `mediaUrls[0]` is the cover/first slide. Absent on posts with
   * no rendered image (e.g. copy-only drafts). Distinct from `media_refs`,
   * which are the raw storage references the server signs from.
   */
  mediaUrls?: string[];
  /** Failure reason — present for the `failed` status the planner renders. */
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostsListResult {
  posts: PlannerPost[];
  counts: Record<string, number>;
}

export interface FetchPostsOptions {
  status?: PostStatus;
  brandId?: string;
  limit?: number;
  /** Calendar window — the server-side scheduled_at range filter (frozen
   *  contract). ISO8601. */
  scheduledFrom?: string;
  scheduledTo?: string;
  orderBy?: "created_at" | "scheduled_at";
}

/**
 * List posts, optionally filtered by a single status and/or a scheduled_at
 * window. The server owns the date-range filter (scheduledFrom / scheduledTo /
 * orderBy) and returns only in-window rows; the planner's client-side day
 * bucketing is display grouping over that result, not a data filter.
 */
export async function fetchPosts(
  opts: FetchPostsOptions = {},
): Promise<PostsListResult> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.brandId) params.set("brandId", opts.brandId);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.scheduledFrom) params.set("scheduledFrom", opts.scheduledFrom);
  if (opts.scheduledTo) params.set("scheduledTo", opts.scheduledTo);
  if (opts.orderBy) params.set("orderBy", opts.orderBy);
  const qs = params.toString();
  const path = `/api/admin/content-pipeline/posts${qs ? `?${qs}` : ""}`;
  const res = await fetchAPI<{ data: PostsListResult }>(path);
  return res.data;
}

/** The three post kinds the guided create-post flow can generate. */
export type GeneratePostType = "image_post" | "carousel" | "from_topic";

/** Platforms the create-post flow targets (one per generated post). */
export type GeneratePostPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "x";

export interface GeneratePostInput {
  type: GeneratePostType;
  platform: GeneratePostPlatform;
  /** Free-text idea — only for `from_topic` (server caps length). */
  topic?: string;
  /** Market to ground the post in — for `image_post` / `carousel`. */
  marketQuery?: string;
}

/**
 * Generate a single post from the guided create-post flow. Synchronous on the
 * server (DeepSeek copy + image render, ~15s) — the created post lands in the
 * review feed as `pending_review` and is returned here so the flow can preview
 * it immediately. Follows the sibling POST idiom: fetchAPIRaw + { success, data }.
 */
export async function generatePost(
  input: GeneratePostInput,
): Promise<PlannerPost> {
  const res = await fetchAPIRaw("/api/admin/content-pipeline/posts/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`generatePost failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    success?: boolean;
    data: PlannerPost;
    error?: string;
  };
  if (json.success === false) {
    throw new Error(json.error ?? "generatePost failed");
  }
  return json.data;
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

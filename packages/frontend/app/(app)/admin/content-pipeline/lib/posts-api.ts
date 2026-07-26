/**
 * Typed wrappers around @/lib/data for the generalized `posts` model
 * (api/admin/content-pipeline/posts). Mirrors the sibling *-api.ts pattern:
 * fetchAPI/fetchAPIRaw + the { success, data } envelope. The planner reads
 * scheduled/approved posts and reschedules by setting scheduled_at.
 */
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

/**
 * Publish attempts the backend publisher spends before it stops retrying a
 * post. Mirrors MAX_PUBLISH_ATTEMPTS in the backend's post-publisher helpers —
 * the frontend can't import across packages, so this is a deliberate copy.
 */
export const MAX_PUBLISH_ATTEMPTS = 3;

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
  /**
   * Structured video_script fields (backend adds these to video_script copy).
   * Older rows only have hook/body/cta — the Video Scripts page falls back
   * (title ← hook, no scene-direction block). See `video-script-copy.ts`.
   */
  title?: string;
  close?: string;
  sceneDirection?: string;
  durationSeconds?: number;
  /** Prefill for the "Make this video" handoff into the run wizard. */
  suggestedFormat?: string;
  suggestedMarketQuery?: string;
  [key: string]: unknown;
}

export interface PostMediaRef {
  kind: string;
  url?: string;
  storage_path?: string;
  bucket?: string;
  /** Intrinsic pixel size — used to reserve aspect-ratio boxes (no layout shift). */
  width?: number;
  height?: number;
  /** Carousel sequence index. */
  order?: number;
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
  /** Publish attempts spent so far. The publisher stops at MAX_PUBLISH_ATTEMPTS. */
  attempts: number;
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

// Post generation lives in `generate-post-api.ts` (extracted to keep this file
// under the 300-line hard limit) and is re-exported at the bottom of this file.

/**
 * POST a lifecycle action to a post's dedicated endpoint and return the updated
 * row. Shared idiom: fetchAPIRaw + { success, data }.
 */
async function postLifecycleAction(
  id: string,
  action: "approve" | "skip",
): Promise<PlannerPost> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/posts/${id}/${action}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`post ${action} failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    success?: boolean;
    data: PlannerPost;
    error?: string;
  };
  if (json.success === false) {
    throw new Error(json.error ?? `post ${action} failed`);
  }
  return json.data;
}

/** Approve a pending post (pending_review -> approved). */
export function approvePost(id: string): Promise<PlannerPost> {
  return postLifecycleAction(id, "approve");
}

/**
 * Skip a post (any non-terminal state -> skipped). Dismisses a draft or
 * suggestion from the review feed / Video Scripts page.
 */
export function skipPost(id: string): Promise<PlannerPost> {
  return postLifecycleAction(id, "skip");
}

/**
 * The copy fields the backend's edit endpoint accepts. Anything outside this
 * list is dropped by the validation whitelist — and because the PATCH replaces
 * the whole `copy` JSONB rather than merging, a dropped key is gone from the
 * row. So a save always sends this exact surface, carrying through the fields
 * the editor doesn't expose.
 */
const EDITABLE_COPY_KEYS = [
  "hook",
  "body",
  "cta",
  "hashtags",
  "slides",
  "title",
  "close",
  "sceneDirection",
  "durationSeconds",
  "suggestedFormat",
  "suggestedMarketQuery",
] as const;

/** Narrow a post's copy to the fields the edit endpoint will keep. */
export function toEditableCopy(copy: PostCopy): PostCopy {
  const out: Record<string, unknown> = {};
  for (const key of EDITABLE_COPY_KEYS) {
    const value = copy[key];
    if (value !== undefined) out[key] = value;
  }
  return out as PostCopy;
}

/** Save edited copy. The backend rejects edits once a post is published. */
export async function updatePostCopy(
  id: string,
  copy: PostCopy,
): Promise<PlannerPost> {
  const res = await fetchAPIRaw(
    `/api/admin/content-pipeline/posts/${id}/copy`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copy: toEditableCopy(copy) }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`copy edit failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    success?: boolean;
    data: PlannerPost;
    error?: string;
  };
  if (json.success === false) throw new Error(json.error ?? "copy edit failed");
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

// Generation fetchers live in `generate-post-api.ts` (extracted to keep this
// file under the 300-line hard limit).
export {
  type GeneratePostType,
  type GeneratePostPlatform,
  type GeneratePostInput,
  generatePost,
} from "./generate-post-api";

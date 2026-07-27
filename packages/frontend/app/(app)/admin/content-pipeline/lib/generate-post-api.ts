/**
 * Post generation — the guided create-post flow's single POST, split out of
 * `posts-api.ts` to keep that file under the 300-line hard limit (CLAUDE §1.3).
 * `posts-api.ts` re-exports everything here, so existing
 * `from "../lib/posts-api"` imports keep resolving unchanged.
 */
import { fetchAPIRaw } from "@/lib/data/fetchers/base";
import type { PlannerPost } from "./posts-api";

/**
 * Post kinds the generate endpoint can produce. The guided create-post flow
 * uses the first three; `video_script` is generated only by the Video Scripts
 * page's "Suggest one now" (no platform pick — the server routes it to YouTube).
 */
export type GeneratePostType =
  | "image_post"
  | "carousel"
  | "from_topic"
  | "video_script";

/** Platforms the create-post flow targets (one per generated post). */
export type GeneratePostPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "x";

export interface GeneratePostInput {
  type: GeneratePostType;
  /** Chosen in the create-post flow; omitted for `video_script` suggestions. */
  platform?: GeneratePostPlatform;
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

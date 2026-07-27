import { describe, it, expect } from "vitest";
import type { QueueItem } from "../../lib/queue-navigator";
import type { PlannerPost } from "../../lib/posts-api";
import {
  failedPostToQueueItem,
  isFailedPostItem,
  isPostReviewItem,
  isVideoScriptItem,
  prettyPostType,
  reviewItemTitle,
} from "../review-item";

const run: QueueItem = {
  id: "r1",
  market_query: "Austin, TX",
  format: "grade_reveal",
  status: "ready_for_review",
};
const imagePost: QueueItem = {
  id: "p1",
  kind: "post",
  post_type: "image_post",
  platform: "instagram",
  status: "pending_review",
  copy: { hook: "Austin just flipped" },
  mediaUrls: ["https://cdn.test/a.png"],
};
const scriptPost: QueueItem = {
  id: "p2",
  kind: "post",
  post_type: "video_script",
  platform: "youtube",
  status: "pending_review",
  copy: { hook: "Why renters are buying" },
};

describe("isPostReviewItem", () => {
  it("true only for kind:'post'; missing kind is a run (back-compat)", () => {
    expect(isPostReviewItem(imagePost)).toBe(true);
    expect(isPostReviewItem(scriptPost)).toBe(true);
    expect(isPostReviewItem(run)).toBe(false);
    expect(isPostReviewItem({ id: "x", post_type: "image_post" })).toBe(false);
  });
});

describe("isVideoScriptItem", () => {
  it("true only for a video_script post", () => {
    expect(isVideoScriptItem(scriptPost)).toBe(true);
    expect(isVideoScriptItem(imagePost)).toBe(false);
    expect(isVideoScriptItem(run)).toBe(false);
  });
});

describe("isFailedPostItem", () => {
  it("true only for a post that failed to publish", () => {
    expect(isFailedPostItem({ ...imagePost, status: "failed" })).toBe(true);
    expect(isFailedPostItem(imagePost)).toBe(false);
    // A failed RUN is not a failed post — it takes the run review path.
    expect(isFailedPostItem({ ...run, status: "failed" })).toBe(false);
  });
});

describe("failedPostToQueueItem", () => {
  const failedPost: PlannerPost = {
    id: "p9",
    brand_id: "b1",
    platform: "instagram",
    post_type: "image_post",
    copy: { hook: "Austin just flipped" },
    media_refs: [],
    status: "failed",
    scheduled_at: "2026-07-24T13:00:00.000Z",
    published_at: null,
    platform_post_id: null,
    source: "ai_generated",
    mediaUrls: ["https://cdn.test/a.png"],
    error: "media_type unsupported",
    attempts: 3,
    created_at: "2026-07-23T10:00:00.000Z",
    updated_at: "2026-07-24T13:01:00.000Z",
  };

  it("projects a failed post onto a queue item the review card can render", () => {
    const item = failedPostToQueueItem(failedPost);
    expect(item).toEqual({
      id: "p9",
      kind: "post",
      status: "failed",
      post_type: "image_post",
      platform: "instagram",
      copy: { hook: "Austin just flipped" },
      mediaUrls: ["https://cdn.test/a.png"],
      created_at: "2026-07-23T10:00:00.000Z",
      error: "media_type unsupported",
      attempts: 3,
    });
  });

  it("carries the failure reason and attempt count the card reads back", () => {
    const item = failedPostToQueueItem(failedPost);
    expect(isFailedPostItem(item)).toBe(true);
    expect(item.error).toBe("media_type unsupported");
    expect(item.attempts).toBe(3);
  });
});

describe("prettyPostType", () => {
  it("title-cases the underscored type", () => {
    expect(prettyPostType("image_post")).toBe("Image Post");
    expect(prettyPostType("video_script")).toBe("Video Script");
    expect(prettyPostType(undefined)).toBe("Post");
  });
});

describe("reviewItemTitle", () => {
  it("runs use market_query; posts use hook then post-type", () => {
    expect(reviewItemTitle(run)).toBe("Austin, TX");
    expect(reviewItemTitle(imagePost)).toBe("Austin just flipped");
    expect(
      reviewItemTitle({ id: "p3", kind: "post", post_type: "carousel" }),
    ).toBe("Carousel");
    expect(reviewItemTitle(undefined)).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import type { QueueItem } from "../../lib/queue-navigator";
import {
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

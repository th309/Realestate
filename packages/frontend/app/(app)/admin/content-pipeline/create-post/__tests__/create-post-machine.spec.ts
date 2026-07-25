import { describe, it, expect } from "vitest";
import {
  buildGeneratePayload,
  canGenerate,
  isGroundingComplete,
  usesTopicGrounding,
  TOPIC_MAX_LENGTH,
  type CreatePostState,
} from "../create-post-machine";

describe("usesTopicGrounding", () => {
  it("from_topic is grounded by free text", () => {
    expect(usesTopicGrounding("from_topic")).toBe(true);
  });
  it("image_post and carousel are grounded by a market", () => {
    expect(usesTopicGrounding("image_post")).toBe(false);
    expect(usesTopicGrounding("carousel")).toBe(false);
  });
});

describe("isGroundingComplete", () => {
  it("market types need a non-empty market query", () => {
    expect(isGroundingComplete({ type: "image_post", marketQuery: "" })).toBe(
      false,
    );
    expect(
      isGroundingComplete({ type: "image_post", marketQuery: "   " }),
    ).toBe(false);
    expect(
      isGroundingComplete({ type: "carousel", marketQuery: "Austin, TX" }),
    ).toBe(true);
  });

  it("from_topic needs non-empty topic within the length cap", () => {
    expect(isGroundingComplete({ type: "from_topic", topic: "" })).toBe(false);
    expect(
      isGroundingComplete({ type: "from_topic", topic: "rates are falling" }),
    ).toBe(true);
    expect(
      isGroundingComplete({
        type: "from_topic",
        topic: "x".repeat(TOPIC_MAX_LENGTH + 1),
      }),
    ).toBe(false);
  });
});

describe("canGenerate", () => {
  it("requires both grounding and a platform", () => {
    const grounded: CreatePostState = {
      type: "image_post",
      marketQuery: "Miami, FL",
    };
    expect(canGenerate(grounded)).toBe(false);
    expect(canGenerate({ ...grounded, platform: "instagram" })).toBe(true);
  });
});

describe("buildGeneratePayload", () => {
  it("image_post → marketQuery payload, no topic field", () => {
    const payload = buildGeneratePayload({
      type: "image_post",
      marketQuery: "  Cleveland, OH  ",
      topic: "ignored",
      platform: "facebook",
    });
    expect(payload).toEqual({
      type: "image_post",
      platform: "facebook",
      marketQuery: "Cleveland, OH",
    });
    expect(payload).not.toHaveProperty("topic");
  });

  it("carousel → marketQuery payload", () => {
    expect(
      buildGeneratePayload({
        type: "carousel",
        marketQuery: "Phoenix, AZ",
        platform: "tiktok",
      }),
    ).toEqual({
      type: "carousel",
      platform: "tiktok",
      marketQuery: "Phoenix, AZ",
    });
  });

  it("from_topic → trimmed topic payload, no marketQuery field", () => {
    const payload = buildGeneratePayload({
      type: "from_topic",
      topic: "  why renters are buying  ",
      marketQuery: "ignored",
      platform: "linkedin",
    });
    expect(payload).toEqual({
      type: "from_topic",
      platform: "linkedin",
      topic: "why renters are buying",
    });
    expect(payload).not.toHaveProperty("marketQuery");
  });

  it("returns null when incomplete (missing platform)", () => {
    expect(
      buildGeneratePayload({ type: "image_post", marketQuery: "Denver, CO" }),
    ).toBeNull();
  });

  it("returns null when grounding is missing", () => {
    expect(
      buildGeneratePayload({ type: "from_topic", platform: "x", topic: "" }),
    ).toBeNull();
  });
});

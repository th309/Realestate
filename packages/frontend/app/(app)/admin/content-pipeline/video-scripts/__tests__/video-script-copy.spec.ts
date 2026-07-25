import { describe, it, expect } from "vitest";
import type { PlannerPost } from "../../lib/posts-api";
import {
  isValidRunFormat,
  normalizeVideoScript,
  buildMakeVideoHref,
  scriptToPlainText,
} from "../video-script-copy";

function makePost(
  copy: PlannerPost["copy"],
  platform = "youtube",
): PlannerPost {
  return {
    id: "p1",
    brand_id: "b1",
    platform,
    post_type: "video_script",
    copy,
    media_refs: [],
    status: "pending_review",
    scheduled_at: null,
    published_at: null,
    platform_post_id: null,
    source: "ai_generated",
    error: null,
    created_at: "",
    updated_at: "",
  };
}

describe("isValidRunFormat", () => {
  it("accepts the 9 wizard formats and rejects others", () => {
    expect(isValidRunFormat("grade_reveal")).toBe(true);
    expect(isValidRunFormat("top_10_ranking")).toBe(true);
    expect(isValidRunFormat("image_post")).toBe(false);
    expect(isValidRunFormat(undefined)).toBe(false);
  });
});

describe("normalizeVideoScript", () => {
  it("maps the structured shape through", () => {
    const s = normalizeVideoScript(
      makePost({
        title: "Austin is cooling",
        hook: "Austin just flipped",
        body: "Prices down 4%.",
        close: "Follow for more",
        sceneDirection: "Skyline b-roll",
        durationSeconds: 45.6,
        suggestedFormat: "score_mover",
        suggestedMarketQuery: "Austin, TX",
      }),
    );
    expect(s.title).toBe("Austin is cooling");
    expect(s.close).toBe("Follow for more");
    expect(s.sceneDirection).toBe("Skyline b-roll");
    expect(s.durationSeconds).toBe(46);
    expect(s.suggestedFormat).toBe("score_mover");
    expect(s.suggestedMarketQuery).toBe("Austin, TX");
  });

  it("falls back for legacy {hook, body, cta} rows", () => {
    const s = normalizeVideoScript(
      makePost({ hook: "Big news", body: "Details", cta: "Subscribe" }),
    );
    expect(s.title).toBe("Big news"); // title <- hook
    expect(s.close).toBe("Subscribe"); // close <- cta
    expect(s.sceneDirection).toBeNull();
    expect(s.suggestedFormat).toBeNull();
    expect(s.durationSeconds).toBeNull();
  });

  it("drops an invalid suggestedFormat and defaults platform", () => {
    const s = normalizeVideoScript(
      makePost({ hook: "x", suggestedFormat: "not_a_format" }, ""),
    );
    expect(s.suggestedFormat).toBeNull();
    expect(s.platform).toBe("youtube");
  });
});

describe("buildMakeVideoHref", () => {
  it("prefills format and market when valid", () => {
    const href = buildMakeVideoHref(
      makePost({
        hook: "x",
        suggestedFormat: "grade_reveal",
        suggestedMarketQuery: "Miami, FL",
      }),
    );
    expect(href).toBe(
      "/admin/content-pipeline/new?format=grade_reveal&market=Miami%2C+FL",
    );
  });

  it("omits an invalid format but keeps the market", () => {
    const href = buildMakeVideoHref(
      makePost({
        hook: "x",
        suggestedFormat: "bad",
        suggestedMarketQuery: "Reno",
      }),
    );
    expect(href).toBe("/admin/content-pipeline/new?market=Reno");
  });

  it("returns the bare wizard path with no prefill", () => {
    expect(buildMakeVideoHref(makePost({ hook: "x" }))).toBe(
      "/admin/content-pipeline/new",
    );
  });
});

describe("scriptToPlainText", () => {
  it("flattens the readable parts", () => {
    const text = scriptToPlainText(
      normalizeVideoScript(
        makePost({
          title: "T",
          hook: "H",
          body: "B",
          close: "C",
          sceneDirection: "S",
        }),
      ),
    );
    expect(text).toContain("T");
    expect(text).toContain("Hook: H");
    expect(text).toContain("B");
    expect(text).toContain("Close: C");
    expect(text).toContain("Scene: S");
  });
});

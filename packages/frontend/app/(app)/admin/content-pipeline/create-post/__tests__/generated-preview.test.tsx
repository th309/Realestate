import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GeneratedPreview } from "../generated-preview";
import type { PlannerPost } from "../../lib/posts-api";

function makePost(mediaUrls: string[]): PlannerPost {
  return {
    id: "p1",
    brand_id: "b1",
    platform: "instagram",
    post_type: mediaUrls.length > 1 ? "carousel" : "image_post",
    copy: { hook: "Austin just flipped" },
    media_refs: [],
    status: "pending_review",
    scheduled_at: null,
    published_at: null,
    platform_post_id: null,
    source: "ai_generated",
    mediaUrls,
    error: null,
    attempts: 0,
    created_at: "",
    updated_at: "",
  };
}

describe("GeneratedPreview mockup pager", () => {
  it("renders the created mockup through SlideImage", () => {
    render(
      <GeneratedPreview
        post={makePost(["https://cdn.test/a.png"])}
        onReset={() => {}}
        onRegenerate={() => {}}
      />,
    );
    // SlideImage labels a single-image post "Image" and uses it as alt.
    expect(screen.getByAltText("Image")).toHaveAttribute(
      "src",
      "https://cdn.test/a.png",
    );
  });

  it("paging past a failed slide clears the error (delegated to key={current})", () => {
    render(
      <GeneratedPreview
        post={makePost(["https://cdn.test/1.png", "https://cdn.test/2.png"])}
        onReset={() => {}}
        onRegenerate={() => {}}
      />,
    );

    fireEvent.error(screen.getByAltText("Slide 1"));
    expect(screen.getByText("Slide 1 failed to load.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));

    // The next slide is a fresh element — no lingering failed state.
    expect(
      screen.queryByText("Slide 1 failed to load."),
    ).not.toBeInTheDocument();
    expect(screen.getByAltText("Slide 2")).toHaveAttribute(
      "src",
      "https://cdn.test/2.png",
    );
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewPeekCard } from "../ReviewPeekCard";
import type { QueueItem } from "../../../lib/queue-navigator";

describe("ReviewPeekCard discriminates the mixed queue", () => {
  it("run item → thumbnail row, market title, ?run= link", () => {
    const run: QueueItem = {
      id: "r1",
      market_query: "Austin, TX",
      format: "grade_reveal",
      status: "ready_for_review",
    };
    const { container } = render(<ReviewPeekCard item={run} />);
    expect(container.querySelector("a")?.getAttribute("href")).toContain(
      "?run=r1",
    );
    expect(screen.getByText("Austin, TX")).toBeInTheDocument();
  });

  it("image post → mockup card, hook title, post status chip, ?post= link", () => {
    const post: QueueItem = {
      id: "p1",
      kind: "post",
      post_type: "facebook_post",
      platform: "facebook",
      status: "pending_review",
      copy: { hook: "Austin just flipped" },
      mediaUrls: ["https://cdn.test/a.png"],
    };
    const { container } = render(<ReviewPeekCard item={post} />);
    // Links to the post (never ?run=, which would trigger a run-detail fetch).
    const href = container.querySelector("a")?.getAttribute("href");
    expect(href).toContain("?post=p1");
    expect(href).not.toContain("?run=");
    // Uses the copy hook as the title, not the run "Untitled" fallback.
    expect(screen.getByText("Austin just flipped")).toBeInTheDocument();
    // Post-lifecycle status vocabulary, not the pipeline "Closed" fallback.
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.queryByText("Closed")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.test/a.png",
    );
  });

  it("video_script post → points to the Video Scripts page", () => {
    const script: QueueItem = {
      id: "p2",
      kind: "post",
      post_type: "video_script",
      status: "pending_review",
      copy: { hook: "Why renters are buying" },
    };
    const { container } = render(<ReviewPeekCard item={script} />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/admin/content-pipeline/video-scripts",
    );
    expect(screen.getByText("Why renters are buying")).toBeInTheDocument();
    expect(screen.getByText("Video idea")).toBeInTheDocument();
  });
});

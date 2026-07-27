import { describe, it, expect } from "vitest";
import { pipelineStateToStatusChip } from "../StatusChip";
import type { PipelineStatus } from "../../../lib/content-pipeline-api";

/**
 * The mapper's `default` branch returns "Closed"/muted, so a status nobody adds
 * a case for doesn't render blank — it renders WRONG, quietly retiring a run
 * that is still working. These tests pin the lanes that fall outside the video
 * pipeline, where that failure is easiest to miss.
 */
describe("pipelineStateToStatusChip covers the infographic lane", () => {
  it("reads generating_infographic as live work, not as closed", () => {
    expect(pipelineStateToStatusChip("generating_infographic")).toEqual({
      label: "Generating graphic",
      tone: "generating",
    });
  });

  it("reads infographic_ready as finished, and NOT as a review request", () => {
    const chip = pipelineStateToStatusChip("infographic_ready");
    expect(chip).toEqual({ label: "Graphic ready", tone: "ready" });
    // The PNG is reviewed as a draft post, so tagging the run "review" would
    // double-count the same work in the queue.
    expect(chip.tone).not.toBe("review");
  });

  it("never silently retires a status by falling through to the default", () => {
    const notClosed: PipelineStatus[] = [
      "queued",
      "fetching_data",
      "scripting",
      "verifying_data",
      "linting_voice",
      "rendering_voice",
      "timing_captions",
      "rendering_video",
      "generating_infographic",
      "infographic_ready",
      "ready_for_review",
      "publishing",
      "published",
      "published_partial",
      "failed",
    ];
    for (const status of notClosed) {
      expect(pipelineStateToStatusChip(status).label).not.toBe("Closed");
    }
  });

  it("still closes the states that really are closed", () => {
    expect(pipelineStateToStatusChip("rejected").label).toBe("Closed");
    expect(pipelineStateToStatusChip("cancelled").label).toBe("Closed");
    expect(pipelineStateToStatusChip(undefined).label).toBe("Closed");
  });
});

/**
 * Pipeline status label mapping.
 *
 * Maps the backend's 14 states to 6 user-friendly labels for the admin UI.
 * See docs/content-pipeline/design.md UX principle 5 for rationale.
 */
import type { PipelineStatus } from "./content-pipeline-api";

export const STATE_LABELS: Record<PipelineStatus, string> = {
  queued: "Starting up",
  fetching_data: "Grabbing market data",
  scripting: "Writing script",
  verifying_data: "Fact-checking",
  linting_voice: "Checking brand voice",
  rendering_voice: "Recording voice",
  timing_captions: "Timing captions",
  rendering_video: "Rendering video",
  ready_for_review: "Waiting on your review",
  publishing: "Uploading",
  published: "Live",
  published_partial: "Live (some platforms failed)",
  rejected: "Rejected",
  failed: "Something went wrong",
};

export const VISIBLE_STAGES = [
  "Starting up",
  "Writing script",
  "Fact-checking",
  "Recording voice",
  "Rendering video",
  "Uploading",
  "Live",
];

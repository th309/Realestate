/**
 * Pure helpers for the Video Scripts page. Video_script posts come in two copy
 * shapes: the newer structured one ({title, hook, body, close, sceneDirection,
 * durationSeconds, suggestedFormat, suggestedMarketQuery}) and older rows with
 * only {hook, body, cta}. Everything here normalizes across both and builds the
 * "Make this video" handoff into the run wizard — kept React-free so it's unit
 * testable.
 */
import type { PostCopy } from "../lib/posts-api";
import { isValidRunFormat } from "../lib/format-previews";

/**
 * Minimal shape the normalizers need — satisfied by both a full PlannerPost and
 * a review-queue post item. Widened from PlannerPost so review items (which
 * aren't full posts) can be passed without an adapter.
 */
export interface VideoScriptSource {
  copy?: PostCopy | null;
  platform?: string | null;
}

// Re-exported so existing consumers/tests keep importing it from here; the
// canonical definition lives with FORMAT_META in lib/format-previews.ts.
export { isValidRunFormat };

export interface NormalizedVideoScript {
  title: string;
  hook: string | null;
  body: string | null;
  close: string | null;
  sceneDirection: string | null;
  durationSeconds: number | null;
  /** Only set when it's one of the wizard's 9 formats. */
  suggestedFormat: string | null;
  suggestedMarketQuery: string | null;
  platform: string;
}

function firstNonEmpty(...values: Array<unknown>): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

/** Normalize a video_script post's copy across the structured and legacy shapes. */
export function normalizeVideoScript(
  post: VideoScriptSource,
): NormalizedVideoScript {
  const copy = post.copy ?? {};
  const suggestedFormat = isValidRunFormat(copy.suggestedFormat)
    ? (copy.suggestedFormat ?? null)
    : null;
  return {
    // title ← explicit title, else the hook, else a stable placeholder.
    title: firstNonEmpty(copy.title, copy.hook) ?? "Untitled script",
    hook: firstNonEmpty(copy.hook),
    body: firstNonEmpty(copy.body),
    close: firstNonEmpty(copy.close, copy.cta),
    sceneDirection: firstNonEmpty(copy.sceneDirection),
    durationSeconds:
      typeof copy.durationSeconds === "number" && copy.durationSeconds > 0
        ? Math.round(copy.durationSeconds)
        : null,
    suggestedFormat,
    suggestedMarketQuery: firstNonEmpty(copy.suggestedMarketQuery),
    platform: post.platform || "youtube",
  };
}

/**
 * Build the "Make this video" href into the run wizard, prefilling the format
 * and market when the script suggests them. Invalid/absent format is simply
 * omitted so the wizard lands on the format step unselected.
 */
export function buildMakeVideoHref(post: VideoScriptSource): string {
  const script = normalizeVideoScript(post);
  const params = new URLSearchParams();
  if (script.suggestedFormat) params.set("format", script.suggestedFormat);
  if (script.suggestedMarketQuery)
    params.set("market", script.suggestedMarketQuery);
  const qs = params.toString();
  return `/admin/content-pipeline/new${qs ? `?${qs}` : ""}`;
}

/** Flatten a normalized script to plain text for the copy-to-clipboard action. */
export function scriptToPlainText(script: NormalizedVideoScript): string {
  return [
    script.title,
    script.hook && `Hook: ${script.hook}`,
    script.body,
    script.close && `Close: ${script.close}`,
    script.sceneDirection && `Scene: ${script.sceneDirection}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

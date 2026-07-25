import type { GeneratePostType } from "../lib/posts-api";

const NOUN: Record<GeneratePostType, string> = {
  image_post: "image post",
  carousel: "carousel",
  from_topic: "post",
};

/**
 * Honest in-progress state for the synchronous generate call (~15s of DeepSeek
 * copy + image render). No fake progress bar — a live spinner and a truthful
 * estimate, because the operator is waiting on a real round-trip.
 */
export function GeneratingView({ type }: { type: GeneratePostType }) {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low px-6 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary-container border-t-primary"
        aria-hidden
      />
      <div>
        <p className="text-base font-semibold text-on-surface">
          Writing and rendering your {NOUN[type]}
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">
          Drafting the copy and rendering the image — about 15 seconds.
        </p>
      </div>
    </div>
  );
}

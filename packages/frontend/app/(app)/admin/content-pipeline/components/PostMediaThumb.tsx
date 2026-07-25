/**
 * Image thumbnail for a post's rendered media, shared by every surface that
 * lists posts (planner cards, the home review strip, the review-queue ribbon).
 * Renders the first slide with `object-cover`; a carousel (more than one slide)
 * gets a "×N" count chip. Returns `null` when there's no media so callers can
 * fall back to their own placeholder — it never draws an empty box itself.
 *
 * Sizing is the caller's job (pass it via `className`); this owns the crop,
 * rounding, lazy-load, and the slide-count chip.
 */
export function PostMediaThumb({
  urls,
  count,
  alt = "",
  className = "",
  rounded = "rounded-lg",
}: {
  /** Signed media URLs in slide order; `urls[0]` is the cover. */
  urls?: string[] | null;
  /** Slide count override — defaults to `urls.length`. */
  count?: number;
  alt?: string;
  /** Sizing/aspect classes for the frame (e.g. `h-16 w-12 shrink-0`). */
  className?: string;
  /** Corner rounding — override to match the host card. */
  rounded?: string;
}) {
  const first = urls?.[0];
  if (!first) return null;

  const slideCount = count ?? urls?.length ?? 1;
  const isCarousel = slideCount > 1;

  return (
    <div
      className={`relative overflow-hidden bg-surface-container-high ${rounded} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={first}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      {isCarousel && (
        <span
          className="absolute right-1 top-1 rounded-full bg-on-surface/70 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-surface backdrop-blur-sm"
          aria-label={`${slideCount} slides`}
        >
          ×{slideCount}
        </span>
      )}
    </div>
  );
}

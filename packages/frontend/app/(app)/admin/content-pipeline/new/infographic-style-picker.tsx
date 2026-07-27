"use client";

import type { InfographicStyle } from "../lib/infographic-options-api";

/**
 * Style cards for the infographic step.
 *
 * A style name on its own ("Sketch note", "Glassmorphic bento") does not tell an
 * operator what they are about to get, so each card shows a real graphic that was
 * generated in that style and checked against it.
 *
 * Two styles have not been generated yet. They show an honest placeholder rather
 * than borrow another style's picture — the wrong picture would mislead the
 * operator about the output — and they stay selectable, because a missing sample
 * is not a missing style.
 *
 * The previews are style samples, not content: the text inside them is illegible
 * at this size by design. What distinguishes the looks — palette, illustration
 * mode, panel treatment, headline weight — all reads at thumbnail size.
 */

/** Style id → sample render. A missing entry means "no sample generated yet". */
const STYLE_PREVIEWS: Record<string, string> = {
  "flat-editorial": "/infographic-style-previews/flat-editorial.webp",
  "clean-modern-flat": "/infographic-style-previews/clean-modern-flat.webp",
  "sketch-note": "/infographic-style-previews/sketch-note.webp",
  "cartoon-mascot": "/infographic-style-previews/cartoon-mascot.webp",
};

export function InfographicStylePicker({
  styles,
  selected,
  onPick,
}: {
  styles: InfographicStyle[];
  selected: string;
  onPick: (styleId: string) => void;
}) {
  const anyAwaitingSample = styles.some((style) => !STYLE_PREVIEWS[style.id]);

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold mb-2">Which style?</h2>
      <p className="mb-3 text-xs text-on-surface-variant">
        Each preview is a real graphic drawn in that style.
        {anyAwaitingSample
          ? " Styles still awaiting a sample can be picked as normal."
          : ""}
      </p>
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Style"
      >
        {styles.map((style) => (
          <StyleCard
            key={style.id}
            style={style}
            previewSrc={STYLE_PREVIEWS[style.id]}
            active={selected === style.id}
            onPick={() => onPick(style.id)}
          />
        ))}
      </div>
    </section>
  );
}

function StyleCard({
  style,
  previewSrc,
  active,
  onPick,
}: {
  style: InfographicStyle;
  previewSrc?: string;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <label className="cursor-pointer">
      {/* A real radio, so the group keeps native arrow-key navigation. */}
      <input
        type="radio"
        name="infographic-style"
        value={style.id}
        checked={active}
        onChange={onPick}
        className="peer sr-only"
      />
      <span
        className={`block overflow-hidden rounded-xl border-2 transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary ${
          active
            ? "border-primary bg-primary-container"
            : "border-outline-variant bg-surface hover:bg-surface-container-low"
        }`}
      >
        <span className="relative block aspect-[4/5] bg-surface-container-high">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={`${style.label} style example`}
              loading="lazy"
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-on-surface-variant">
              Example coming
            </span>
          )}
          {active && <SelectedCheck />}
        </span>
        <span
          className={`block px-3 py-2 text-xs font-semibold ${
            active ? "text-on-primary-container" : "text-on-surface"
          }`}
        >
          {style.label}
        </span>
      </span>
    </label>
  );
}

/** Selection marker on the preview itself, where the eye already is. */
function SelectedCheck() {
  return (
    <span
      aria-hidden
      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        <path d="m4 10.5 4 4 8-9" />
      </svg>
    </span>
  );
}

"use client";

export type ReviewTab = "script" | "gates" | "thumbnail";

const ITEMS: Array<{ id: ReviewTab; label: string }> = [
  { id: "script", label: "Script" },
  { id: "gates", label: "Gates" },
  { id: "thumbnail", label: "Thumbnail" },
];

/**
 * M3-style segmented tabs for the review-card right pane. Active tab gets
 * a 2px primary indicator under the label and an elevated surface tone.
 * The `badges` prop lets the caller surface a `!` chip on Gates when the
 * data verifier or brand voice linter found violations.
 */
export function ReviewTabs({
  tab,
  onChange,
  badges,
}: {
  tab: ReviewTab;
  onChange: (t: ReviewTab) => void;
  badges: Partial<Record<ReviewTab, string>>;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 px-3 pt-3 border-b border-outline-variant"
    >
      {ITEMS.map((it) => {
        const active = it.id === tab;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(it.id)}
            className={`relative px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors duration-200 ${
              active
                ? "text-on-surface bg-surface-container-high"
                : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
            }`}
          >
            {it.label}
            {badges[it.id] && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-error text-on-error text-[10px] font-bold">
                {badges[it.id]}
              </span>
            )}
            {active && (
              <span
                className="absolute inset-x-3 bottom-0 h-0.5 bg-primary rounded-full"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

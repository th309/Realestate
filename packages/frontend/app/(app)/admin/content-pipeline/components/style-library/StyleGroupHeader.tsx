"use client";

/**
 * Section header for one style group: the style name plus the single
 * "use for generation" star. Starring a group saves every reference in it
 * (image + sample video) so the generator gets both the look and the motion;
 * unstarring clears them all.
 */
export function StyleGroupHeader({
  name,
  isSteering,
  busy,
  onToggle,
}: {
  name: string;
  isSteering: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">
        {name}
      </h2>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={isSteering}
        aria-label={
          isSteering
            ? `Stop using ${name} for generation`
            : `Use ${name} for generation`
        }
        title={
          isSteering
            ? "Stop using this style for generation"
            : "Use this style for generation"
        }
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm disabled:opacity-60 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          isSteering
            ? "bg-primary text-on-primary hover:bg-primary/90"
            : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
        }`}
      >
        <StarIcon filled={isSteering} />
        {isSteering ? "Steering generation" : "Use style"}
      </button>
    </div>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  );
}

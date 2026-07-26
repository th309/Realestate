"use client";

import type { StyleReference } from "../../lib/style-refs-api";

/**
 * One style reference in the library grid. The save toggle is the
 * preference-learning entry point: a saved reference is described to the
 * generator in every prompt, so a saved card is marked plainly rather than
 * subtly.
 */
export function ReferenceCard({
  reference,
  isSaved,
  onToggleSaved,
  onReExtract,
  onDelete,
  isSaving,
  isReExtracting,
}: {
  reference: StyleReference;
  isSaved: boolean;
  onToggleSaved: () => void;
  onReExtract: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isReExtracting: boolean;
}) {
  const palette = reference.extracted_attributes.palette ?? [];
  return (
    <div
      className={`rounded-2xl bg-surface-container-low overflow-hidden shadow-sm flex flex-col transition-shadow duration-200 ${
        isSaved ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="relative">
        {reference.source_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reference.source_url}
            alt={reference.label}
            className="w-full h-40 object-cover bg-on-surface/10"
          />
        ) : (
          <div className="w-full h-40 bg-surface-container flex items-center justify-center text-on-surface-variant text-xs">
            (no image)
          </div>
        )}
        <SaveToggle
          isSaved={isSaved}
          busy={isSaving}
          onClick={onToggleSaved}
          label={reference.label}
        />
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-on-surface truncate">
            {reference.label}
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
            {reference.kind}
          </span>
        </div>

        {palette.length > 0 ? (
          <div className="flex gap-1">
            {palette.slice(0, 6).map((c, i) => (
              <span
                key={i}
                title={c}
                className="block flex-1 h-6 rounded-md border border-outline-variant"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-on-surface-variant italic">
            No palette extracted yet. Try Re-extract.
          </p>
        )}

        {reference.extracted_attributes.summary && (
          <p className="text-xs text-on-surface-variant line-clamp-3">
            {reference.extracted_attributes.summary}
          </p>
        )}

        {isSaved && (
          <p className="text-[11px] font-medium text-primary">
            Steering generation
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2 text-[11px] text-on-surface-variant">
          <span>
            ${reference.vision_cost_usd?.toFixed(4) ?? "0"} ·{" "}
            {new Date(reference.created_at).toLocaleDateString()}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onReExtract}
              disabled={isReExtracting}
              className="text-primary text-xs font-medium hover:bg-primary/8 rounded-full px-2 py-1 disabled:opacity-50 transition-colors duration-200"
            >
              {isReExtracting ? "Extracting…" : "Re-extract"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-error text-xs font-medium hover:bg-error/10 rounded-full px-2 py-1 transition-colors duration-200"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveToggle({
  isSaved,
  busy,
  onClick,
  label,
}: {
  isSaved: boolean;
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={isSaved}
      title={
        isSaved
          ? "Stop using this style for generation"
          : "Use this style for generation"
      }
      aria-label={
        isSaved
          ? `Stop using ${label} for generation`
          : `Use ${label} for generation`
      }
      className={`absolute top-2 right-2 h-10 w-10 rounded-full shadow-sm inline-flex items-center justify-center disabled:opacity-60 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        isSaved
          ? "bg-primary text-on-primary hover:bg-primary/90"
          : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
      }`}
    >
      <StarIcon filled={isSaved} />
    </button>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
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

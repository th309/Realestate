"use client";

import type { StyleReference } from "../../lib/style-refs-api";

/**
 * One style reference in the library grid. Preference-learning (the "use for
 * generation" star) lives on the style-group header, not the card — a style
 * is steered as a whole (image + sample video together).
 */
export function ReferenceCard({
  reference,
  isSaved,
  onReExtract,
  onDelete,
  isReExtracting,
}: {
  reference: StyleReference;
  isSaved: boolean;
  onReExtract: () => void;
  onDelete: () => void;
  isReExtracting: boolean;
}) {
  // dominant_palette (video path) predates backend sanitization for older
  // rows — guard the shape so one malformed reference can't crash the grid.
  const rawPalette =
    reference.extracted_attributes.palette ??
    reference.extracted_attributes.dominant_palette;
  const palette = Array.isArray(rawPalette)
    ? rawPalette.filter((c): c is string => typeof c === "string")
    : [];
  // Backend list() signs stored previews to https URLs. Prefer the mirrored
  // preview (CSP-clean, survives dead source links); fall back to source_url
  // only when it is itself a renderable http image URL.
  const previewSrc = reference.preview_strip_url?.startsWith("http")
    ? reference.preview_strip_url
    : reference.source_url;
  return (
    <div
      className={`rounded-2xl bg-surface-container-low overflow-hidden shadow-sm flex flex-col transition-shadow duration-200 ${
        isSaved ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="relative">
        {previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt={reference.label}
            className="w-full h-40 object-cover bg-on-surface/10"
          />
        ) : (
          <div className="w-full h-40 bg-surface-container flex items-center justify-center text-on-surface-variant text-xs">
            (no image)
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        {isSaved && (
          <span className="sr-only">
            {reference.label}: included in generation
          </span>
        )}
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

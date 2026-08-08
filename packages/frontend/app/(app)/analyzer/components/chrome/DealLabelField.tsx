"use client";

/**
 * Inline rename for a saved deal — replaces the static "Deal Analyzer"
 * heading once `dealId` exists (see `AnalyzerHeader`).
 *
 * `label` was hardcoded null before this, so every saved analysis was
 * identified only by its address — unusable once an investor is comparing
 * two scenarios on the same street. maxLength matches AnalysisSnapshotDto's
 * `@MaxLength(120)` so the field cannot compose a payload the API rejects.
 */
export function DealLabelField({
  label,
  fallback,
  onChange,
}: {
  label: string | null;
  fallback: string;
  onChange: (next: string) => void;
}) {
  return (
    <input
      type="text"
      value={label ?? ""}
      placeholder={fallback}
      maxLength={120}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Deal name"
      className="w-full max-w-md rounded-[9px] border border-transparent bg-transparent px-2 py-1 text-[23px] font-bold leading-tight tracking-[-0.02em] text-piq-ink transition-colors duration-200 hover:border-piq-line focus:border-piq-indigo focus:outline-none"
    />
  );
}

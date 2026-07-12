"use client";

interface AdvancedAssumptionsProps {
  /** Opens the Customize drawer (Assumptions tab). Renders the row only when provided. */
  onCustomizeClick?: () => void;
}

/**
 * Single link row into the Customize drawer, which now owns every tunable
 * assumption (tax, reserves, growth, closing costs) plus grading thresholds,
 * weights, and auto-kill rules. Previously this component held all of those
 * fields inline behind a collapsible "Advanced assumptions" dropdown; they
 * moved into `CustomizeThresholdsDrawer/AssumptionsTab.tsx` so the drawer is
 * the single home for assumptions + criteria (HOA — the one field with no
 * account-level default — was promoted into InputPanel's main grid instead).
 */
export function AdvancedAssumptions({
  onCustomizeClick,
}: AdvancedAssumptionsProps) {
  if (!onCustomizeClick) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant px-3 py-2.5 mt-2">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-on-surface">
          Assumptions &amp; criteria
        </span>
        <span className="block text-xs text-on-surface-variant">
          Tax, reserves, growth, and auto-kill rules
        </span>
      </span>
      <button
        type="button"
        onClick={onCustomizeClick}
        data-testid="autokill-grading-customize"
        className="shrink-0 rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold text-primary transition-colors duration-200 hover:bg-surface-container"
      >
        Edit criteria
      </button>
    </div>
  );
}

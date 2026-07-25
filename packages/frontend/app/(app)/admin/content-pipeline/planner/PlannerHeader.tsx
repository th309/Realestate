/**
 * Planner header — title, Week/Month toggle, and time navigation (prev, Today,
 * next) with the current range label. Timezone note makes the Eastern-Time
 * basis explicit so times are never ambiguous.
 */
import { weekRangeLabel, monthLabel } from "./planner-tz";

export type PlannerView = "week" | "month";

export function PlannerHeader({
  view,
  anchorKey,
  onViewChange,
  onPrev,
  onNext,
  onToday,
}: {
  view: PlannerView;
  anchorKey: string;
  onViewChange: (view: PlannerView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const rangeLabel =
    view === "week" ? weekRangeLabel(anchorKey) : monthLabel(anchorKey);

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold text-on-surface">Planner</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          What&apos;s going out and when — times shown in Eastern (ET).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-outline-variant p-0.5">
          {(["week", "month"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onViewChange(option)}
              aria-pressed={view === option}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                view === option
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label={view === "week" ? "Previous week" : "Previous month"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={onToday}
            className="rounded-full border border-outline-variant bg-surface px-3.5 py-1.5 text-sm font-medium text-on-surface transition-colors duration-200 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label={view === "week" ? "Next week" : "Next month"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            ›
          </button>
        </div>

        <span className="min-w-[10rem] text-right font-mono text-sm tabular-nums text-on-surface">
          {rangeLabel}
        </span>
      </div>
    </header>
  );
}

/**
 * Compact 30d-vs-prior delta badge: a momentum arrow + percent, colored by
 * direction (grow-is-good → green up / red down / neutral flat). Brand rule:
 * tertiary = growth, error = decline.
 */
import { computeDelta } from "./insights-format";

const DIRECTION_STYLE = {
  up: {
    arrow: "↑",
    cls: "bg-tertiary-container/50 text-on-tertiary-container",
  },
  down: { arrow: "↓", cls: "bg-error-container/50 text-on-error-container" },
  flat: {
    arrow: "→",
    cls: "bg-surface-container-high text-on-surface-variant",
  },
} as const;

export function DeltaBadge({
  current,
  prior,
  className = "",
}: {
  current: number;
  prior: number;
  className?: string;
}) {
  const { direction, label } = computeDelta(current, prior);
  const style = DIRECTION_STYLE[direction];

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${style.cls} ${className}`}
    >
      <span aria-hidden>{style.arrow}</span>
      <span>{label}</span>
      <span className="sr-only">
        {direction === "up"
          ? "up"
          : direction === "down"
            ? "down"
            : "unchanged"}{" "}
        versus prior 30 days
      </span>
    </span>
  );
}

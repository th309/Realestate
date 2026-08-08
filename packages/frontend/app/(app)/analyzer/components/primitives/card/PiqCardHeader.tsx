import type { ReactNode } from "react";
import { LABEL_CLASS, TONE, type PiqTone } from "./card-tones";

interface PiqCardHeaderProps {
  /** 25px rounded tile holding the section's icon, tinted by `tone`. */
  icon: ReactNode;
  tone: PiqTone;
  title: string;
  /** Right-rail micro-label — "Monthly", "Balanced", "Single lever". */
  label?: string;
  /** Trailing controls (refresh, range picker) shown after the label. */
  actions?: ReactNode;
  /** Makes the whole bar a disclosure toggle for collapsible sections. */
  onToggle?: () => void;
  open?: boolean;
}

/**
 * The mockup's `.sh` — every analyzer card opens with this bar: a tinted icon
 * tile, a 14px near-black title, and an optional uppercase label pinned right.
 *
 * The bar is what makes a column of cards scannable, so the icon tile carries
 * the section's tone rather than being decorative: red verdict, indigo cash,
 * violet grading, amber levers, teal market. A chevron replaces nothing — for
 * collapsible sections the whole bar is the control, and the chevron sits
 * before the title as an affordance.
 */
export function PiqCardHeader({
  icon,
  tone,
  title,
  label,
  actions,
  onToggle,
  open = true,
}: PiqCardHeaderProps) {
  const inner = (
    <>
      <span
        aria-hidden
        className={`grid h-[25px] w-[25px] flex-none place-items-center rounded-[9px] text-[13px] ${TONE[tone].tile}`}
      >
        {icon}
      </span>
      <h3 className="min-w-0 flex-1 truncate text-sm font-bold leading-tight tracking-[-0.02em] text-piq-ink">
        {title}
      </h3>
      {label && (
        <span className={`${LABEL_CLASS} whitespace-nowrap`}>{label}</span>
      )}
    </>
  );

  if (!onToggle) {
    return (
      <div className="flex items-center gap-2.5 border-b border-piq-line px-4 py-3.5">
        {inner}
        {actions}
      </div>
    );
  }

  return (
    <div className="flex items-center border-b border-piq-line">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-piq-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-piq-indigo"
      >
        <span
          data-section-chevron
          aria-hidden
          className="-mr-1 w-2.5 flex-none text-[10px] text-piq-muted"
        >
          {open ? "▾" : "▸"}
        </span>
        {inner}
      </button>
      {actions && <div className="flex items-center pr-3">{actions}</div>}
    </div>
  );
}

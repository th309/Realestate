import type { ReactNode } from "react";

interface PiqCardProps {
  children: ReactNode;
  /** Accent hairline across the top edge — the mockup's verdict treatment. */
  topAccent?: string;
  /**
   * Fill the grid row's height so a two-up pair ends on one line. The card
   * becomes a flex column; give whichever child should absorb the slack a
   * `flex-1` (for a section card that is the chart body, not the header or
   * the insight strip).
   */
  fullHeight?: boolean;
  className?: string;
  id?: string;
}

/**
 * The analyzer's card shell: white surface, 1px indigo-grey rule, 14px radius
 * and the two-layer lift — the mockup's `.card`.
 *
 * 14px is not one of Tailwind's defaults (it falls between `rounded-xl` at 12
 * and `rounded-2xl` at 16), which is why it ships as its own `rounded-piq`
 * token. The difference is small per card and obvious down a column of twelve.
 */
export function PiqCard({
  children,
  topAccent,
  fullHeight = false,
  className = "",
  id,
}: PiqCardProps) {
  return (
    <div
      id={id}
      className={`relative overflow-hidden rounded-piq border border-piq-line bg-piq-surface shadow-piq ${
        fullHeight ? "flex h-full flex-col" : ""
      } ${className}`}
    >
      {topAccent && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: topAccent }}
        />
      )}
      {children}
    </div>
  );
}

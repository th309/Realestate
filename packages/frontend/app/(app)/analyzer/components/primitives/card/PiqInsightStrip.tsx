import type { ReactNode } from "react";
import { LightbulbIcon } from "../LightbulbIcon";

interface PiqInsightStripProps {
  children: ReactNode;
  /**
   * `insight` is the AI read on the section — indigo, italic, a lightbulb.
   * `caution` is a data-quality note the reader must not skim past, so it
   * takes the amber container and drops the italic.
   */
  variant?: "insight" | "caution";
  icon?: ReactNode;
}

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/**
 * The mockup's `.ai` — a full-bleed strip along the foot of a card carrying
 * the narrative that explains the figures above it.
 *
 * It is deliberately not a floating callout inside the card's padding: running
 * edge to edge under a top rule reads as a footnote to the whole card, which
 * is what it is. Render it as the last child of `PiqCard`, outside any padded
 * body wrapper.
 */
export function PiqInsightStrip({
  children,
  variant = "insight",
  icon,
}: PiqInsightStripProps) {
  const isCaution = variant === "caution";
  return (
    <div
      data-insight-strip={variant}
      className={`flex gap-2.5 border-t border-piq-line px-4 py-3.5 text-[12.5px] leading-[1.6] text-piq-body ${
        isCaution
          ? "bg-piq-amber-soft"
          : "bg-piq-indigo-soft [&_p]:italic [&>div]:italic"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex-none ${isCaution ? "text-piq-amber" : "text-piq-indigo"}`}
      >
        {icon ?? (isCaution ? <AlertIcon /> : <LightbulbIcon />)}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

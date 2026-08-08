import { TriangleAlert } from "lucide-react";
import type { AutoKillFlag } from "@propertyiq/analyzer-core";

interface AutoKillBannerProps {
  autoKills: AutoKillFlag[];
  /** Renders a top-right "Edit criteria" button that opens the Auto-Kill settings. */
  onEditCriteria?: () => void;
}

/**
 * The one block on the page that is not a card: a red-bordered alert on the
 * red container fill, sitting above the verdict.
 *
 * It deliberately breaks the card rhythm — everything else in the column is
 * white on canvas with a hairline, so the filled red panel is the only thing
 * that reads as an interruption rather than a section. That is the whole job:
 * this deal tripped a rule the user set, and they should see it before they
 * read the grade.
 */
export function AutoKillBanner({
  autoKills,
  onEditCriteria,
}: AutoKillBannerProps) {
  if (autoKills.length === 0) return null;

  return (
    <div
      data-auto-kill-banner
      role="alert"
      aria-live="polite"
      className="rounded-piq border border-piq-red bg-piq-red-soft px-[18px] py-4"
    >
      <div className="flex items-center gap-2.5">
        <TriangleAlert
          size={17}
          strokeWidth={2}
          aria-hidden
          className="flex-none text-piq-red"
        />
        <h3
          data-auto-kill-heading
          className="flex-1 text-[14.5px] font-bold tracking-[-0.02em] text-piq-red"
        >
          Auto-kill triggered
        </h3>
        {onEditCriteria && (
          <button
            type="button"
            onClick={onEditCriteria}
            aria-label="Edit auto-kill criteria"
            data-testid="autokill-edit-criteria"
            className="shrink-0 rounded-full border border-piq-red px-3 py-[5px] text-[11.5px] font-bold text-piq-red transition-colors duration-200 hover:bg-piq-red/10"
          >
            Edit criteria
          </button>
        )}
      </div>
      <ul className="mb-2.5 mt-2.5 list-disc pl-[19px] text-[13.5px] text-piq-ink">
        {autoKills.map((k) => (
          <li key={k.code} data-auto-kill-item data-code={k.code}>
            {k.message}
          </li>
        ))}
      </ul>
      <p data-auto-kill-subtext className="text-[12.5px] text-piq-body">
        This deal failed an auto-kill check. Override only if you understand the
        risk.
      </p>
    </div>
  );
}

import type { AutoKillFlag } from "@propertyiq/analyzer-core";

interface AutoKillBannerProps {
  autoKills: AutoKillFlag[];
  /** Renders a top-right "Edit criteria" button that opens the Auto-Kill settings. */
  onEditCriteria?: () => void;
}

function WarningIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className="inline-block mr-2"
    >
      <path
        d="M9 1.5 L17 16 L1 16 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <line
        x1="9"
        x2="9"
        y1="7"
        y2="11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="9" cy="13.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

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
      className="rounded-xl p-4"
      style={{
        border: "1.75px solid #E53935",
        background: "rgba(229,57,53,0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          data-auto-kill-heading
          className="text-base font-bold flex items-center"
          style={{ color: "#E53935" }}
        >
          <WarningIcon />
          Auto-Kill Triggered
        </h3>
        {onEditCriteria && (
          <button
            type="button"
            onClick={onEditCriteria}
            aria-label="Edit auto-kill criteria"
            data-testid="autokill-edit-criteria"
            className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-200 hover:bg-[rgba(229,57,53,0.12)]"
            style={{ color: "#E53935", borderColor: "#E53935" }}
          >
            Edit criteria
          </button>
        )}
      </div>
      <ul className="mt-2 list-disc pl-6 text-sm text-on-surface">
        {autoKills.map((k) => (
          <li key={k.code} data-auto-kill-item data-code={k.code}>
            {k.message}
          </li>
        ))}
      </ul>
      <p
        data-auto-kill-subtext
        className="text-sm text-on-surface-variant mt-2"
      >
        This deal failed an auto-kill check. Override only if you understand the
        risk.
      </p>
    </div>
  );
}

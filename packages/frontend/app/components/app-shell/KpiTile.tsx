import type { ReactNode } from "react";

type Accent = "primary" | "tertiary" | "warning" | "error" | "secondary";
type Tone = "neutral" | "positive" | "negative";

const STRIPE: Record<Accent, string> = {
  primary: "border-l-primary",
  secondary: "border-l-secondary",
  tertiary: "border-l-tertiary",
  warning: "border-l-warning",
  error: "border-l-error",
};

const DOT: Record<Accent, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  warning: "bg-warning",
  error: "bg-error",
};

const TONE: Record<Tone, string> = {
  neutral: "text-on-surface",
  positive: "text-tertiary",
  negative: "text-error",
};

/**
 * The repeated metric unit for the authed tools. The accent stripe carries the
 * health signal; the caption says what the metric actually is, so a tile reads
 * "NOI / debt service" rather than a bare "DSCR".
 */
export function KpiTile({
  label,
  value,
  caption,
  accent = "primary",
  tone = "neutral",
  showDot = false,
  delta,
  footer,
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: Accent;
  tone?: Tone;
  /** Colour swatch beside the label, keying the tile to a chart series. */
  showDot?: boolean;
  /** Trend chip rendered on the value's baseline. */
  delta?: ReactNode;
  /** Sparkline or other footer content below the caption. */
  footer?: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1 rounded-xl border border-l-[3px] border-outline-variant ${STRIPE[accent]} bg-surface p-4 shadow-sm`}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface-variant">
        {showDot ? (
          <span
            aria-hidden
            className={`size-[7px] flex-none rounded-full ${DOT[accent]}`}
          />
        ) : null}
        <span className="truncate">{label}</span>
      </span>
      <span className="flex flex-wrap items-baseline gap-2">
        <span
          className={`font-mono text-2xl font-medium tracking-tight tabular-nums ${TONE[tone]}`}
        >
          {value}
        </span>
        {delta}
      </span>
      {caption ? (
        <span className="text-[11px] leading-snug text-on-surface-variant">
          {caption}
        </span>
      ) : null}
      {footer ? <span className="mt-1 block">{footer}</span> : null}
    </div>
  );
}

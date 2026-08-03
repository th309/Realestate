type Accent = "primary" | "tertiary" | "warning" | "error";
type Tone = "neutral" | "positive" | "negative";

const STRIPE: Record<Accent, string> = {
  primary: "border-l-primary",
  tertiary: "border-l-tertiary",
  warning: "border-l-warning",
  error: "border-l-error",
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
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: Accent;
  tone?: Tone;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border border-l-[3px] border-outline-variant ${STRIPE[accent]} bg-surface p-4 shadow-sm`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface-variant">
        {label}
      </span>
      <span
        className={`font-mono text-2xl font-medium tracking-tight tabular-nums ${TONE[tone]}`}
      >
        {value}
      </span>
      {caption ? (
        <span className="text-[11px] text-on-surface-variant">{caption}</span>
      ) : null}
    </div>
  );
}

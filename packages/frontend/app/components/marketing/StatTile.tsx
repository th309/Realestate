type Accent = "primary" | "tertiary" | "warning" | "error";

const STRIPE: Record<Accent, string> = {
  primary: "border-l-primary",
  tertiary: "border-l-tertiary",
  warning: "border-l-warning",
  error: "border-l-error",
};

/**
 * The repeated metric unit: uppercase micro-label, monospace value, caption
 * saying what the metric actually is. The accent stripe carries the health
 * signal so the value does not have to be colour-coded.
 */
export function StatTile({
  label,
  value,
  caption,
  accent = "primary",
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: Accent;
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-xl border border-l-[3px] border-outline-variant ${STRIPE[accent]} bg-surface p-5 shadow-sm`}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-on-surface-variant">
        {label}
      </span>
      <span className="font-mono text-2xl font-medium tracking-tight tabular-nums text-on-surface">
        {value}
      </span>
      {caption ? (
        <span className="text-xs text-on-surface-variant">{caption}</span>
      ) : null}
    </div>
  );
}

import { formatMetricValue } from "@/lib/data";

interface MomentumSignalsSectionProps {
  metroName: string;
  zScores: Record<string, number>;
}

const SIGNALS: {
  key: string;
  label: string;
  format: "percent" | "days";
  /**
   * `z_scores` JSONB holds the 4 RAW PropertyIQ Score input values (per
   * CLAUDE.md §9): zhvi_yoy / zhvi_mom_3m / price_reduced_share are FRACTIONS
   * (e.g. 0.031), median_days_on_market is already in days. formatMetricValue's
   * "percent" case does `value.toFixed(1) + "%"` with no internal scaling — it
   * expects a pre-scaled value (3.1, not 0.031) — verified against the same x100
   * scale applied to these exact z_scores keys in RECEIPT_DEFS
   * (lib/data/fetchers/market-stats.ts). So percent signals scale by 100 here;
   * the days signal does not.
   */
  scale: number;
  direction: string;
}[] = [
  {
    key: "zhvi_yoy",
    label: "12-Month Price Momentum",
    format: "percent",
    scale: 100,
    direction: "Higher signals firming demand",
  },
  {
    key: "zhvi_mom_3m",
    label: "3-Month Price Momentum",
    format: "percent",
    scale: 100,
    direction: "Higher signals firming demand",
  },
  {
    key: "median_days_on_market",
    label: "Median Days on Market",
    format: "days",
    scale: 1,
    direction: "Lower signals firming demand",
  },
  {
    key: "price_reduced_share",
    label: "Share of Listings With Price Cuts",
    format: "percent",
    scale: 100,
    direction: "Lower signals firming demand",
  },
];

/** The four PropertyIQ Score inputs, server-rendered from z_scores raw values. */
export function MomentumSignalsSection({
  metroName,
  zScores,
}: MomentumSignalsSectionProps) {
  const rows = SIGNALS.filter((s) => typeof zScores[s.key] === "number");
  if (rows.length === 0) return null;

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-xl font-medium text-on-surface mb-6">
        What Drives the {metroName} Outlook
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((s) => (
          <div
            key={s.key}
            className="rounded-xl border border-outline-variant p-5"
          >
            <div className="text-sm text-on-surface-variant">{s.label}</div>
            <div className="mt-1 text-2xl font-medium text-on-surface font-mono">
              {formatMetricValue(zScores[s.key] * s.scale, s.format)}
            </div>
            <div className="mt-1 text-xs text-on-surface-variant">
              {s.direction}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

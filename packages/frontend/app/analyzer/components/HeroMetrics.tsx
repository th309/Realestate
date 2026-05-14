"use client";

import { formatMetricValue } from "@/lib/data";

interface Props {
  capRatePct: number | null;
  cocPct: number | null;
  cashflowMonthly: number | null;
  dscr: number | null;
}

function metricColor(v: number | null, positiveIsGood = true): string {
  if (v == null) return "bg-surface-container-high text-on-surface-variant";
  const good = positiveIsGood ? v > 0 : v < 0;
  return good ? "bg-tertiary text-on-tertiary" : "bg-error text-on-error";
}

function Tile({
  label,
  value,
  format,
  color,
}: {
  label: string;
  value: number | null;
  format: "percent" | "currency" | "number";
  color: string;
}) {
  return (
    <div className={`flex-1 rounded-xl p-4 text-center ${color}`}>
      <div className="text-xs opacity-85 uppercase">{label}</div>
      <div className="font-mono text-3xl font-bold mt-1">
        {value == null ? "—" : formatMetricValue(value, format)}
      </div>
    </div>
  );
}

export default function HeroMetrics({
  capRatePct,
  cocPct,
  cashflowMonthly,
  dscr,
}: Props) {
  return (
    <div className="flex gap-3">
      <Tile
        label="Cap rate"
        value={capRatePct}
        format="percent"
        color={metricColor(capRatePct)}
      />
      <Tile
        label="Cash-on-cash"
        value={cocPct}
        format="percent"
        color={metricColor(cocPct)}
      />
      <Tile
        label="Cashflow / mo"
        value={cashflowMonthly}
        format="currency"
        color={metricColor(cashflowMonthly)}
      />
      <Tile
        label="DSCR"
        value={dscr}
        format="number"
        color={
          dscr != null && dscr >= 1.2
            ? "bg-tertiary text-on-tertiary"
            : "bg-surface-container-high text-on-surface"
        }
      />
    </div>
  );
}

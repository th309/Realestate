"use client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

export interface KPITileProps {
  label: string;
  value: string; // already formatted
  delta?: { pct: number; direction: "up" | "down" } | null;
  sparkline?: number[];
}

export function KPITile({ label, value, delta, sparkline }: KPITileProps) {
  const deltaSign = delta?.direction === "up" ? "+" : "−";
  const deltaColor =
    delta?.direction === "up"
      ? "text-[var(--md-tertiary)]"
      : "text-[var(--md-error)]";

  return (
    <div
      data-kpi-tile
      className="rounded-xl bg-surface-container-low p-4 flex flex-col gap-1"
    >
      <div className="text-xs uppercase font-semibold text-on-surface-variant tracking-wider">
        {label}
      </div>
      <div className="font-mono text-2xl font-bold text-on-surface">
        {value}
      </div>
      {delta && (
        <div data-kpi-delta className={`text-xs font-mono ${deltaColor}`}>
          {deltaSign}
          {Math.abs(delta.pct).toFixed(1)}%
        </div>
      )}
      {sparkline && sparkline.length > 1 && (
        <div data-kpi-sparkline className="h-7 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline.map((v, i) => ({ i, v }))}>
              <Line
                type="monotone"
                dataKey="v"
                stroke="var(--md-primary)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

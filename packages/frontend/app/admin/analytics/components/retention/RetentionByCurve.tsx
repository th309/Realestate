/**
 * RetentionByCurve
 *
 * Line chart showing one retention curve per subscription tier.
 * X axis = weeks since signup, Y axis = retention percentage (0-100).
 * Uses Recharts with consistent M3 design tokens.
 */

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TierCurve {
  tier: string;
  curve: number[];
}

interface RetentionByCurveProps {
  retentionCurves: TierCurve[];
}

const TIER_COLORS: Record<string, string> = {
  free: "#3949AB",
  pro: "#10b981",
  enterprise: "#f59e0b",
  trial: "#5C6BC0",
};

function getTierColor(tier: string, index: number): string {
  const fallbacks = ["#3949AB", "#10b981", "#f59e0b", "#ef4444", "#5C6BC0"];
  return TIER_COLORS[tier.toLowerCase()] ?? fallbacks[index % fallbacks.length];
}

function buildChartData(
  curves: TierCurve[],
): Record<string, number | string>[] {
  if (curves.length === 0) return [];

  const maxWeeks = Math.max(...curves.map((c) => c.curve.length));
  return Array.from({ length: maxWeeks }, (_, weekIndex) => {
    const point: Record<string, number | string> = {
      week: `Wk${weekIndex}`,
    };
    for (const { tier, curve } of curves) {
      if (curve[weekIndex] !== undefined) {
        point[tier] = Math.round(curve[weekIndex] * 10) / 10;
      }
    }
    return point;
  });
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function RetentionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-container-high border border-outline-variant rounded-lg p-3 shadow-lg text-xs">
      <p className="font-medium text-on-surface mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4"
        >
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-on-surface-variant capitalize">
              {entry.name}
            </span>
          </span>
          <span className="font-medium text-on-surface">{entry.value}%</span>
        </div>
      ))}
    </div>
  );
}

export function RetentionByCurve({ retentionCurves }: RetentionByCurveProps) {
  const chartData = buildChartData(retentionCurves);

  return (
    <div className="bg-surface-container rounded-xl p-6">
      <h3 className="text-base font-medium text-on-surface mb-4">
        Retention Curves by Tier
      </h3>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-on-surface-variant text-sm">
          No retention curve data available.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-outline-variant, #e2e8f0)"
              opacity={0.5}
            />
            <XAxis
              dataKey="week"
              tick={{
                fontSize: 11,
                fill: "var(--color-on-surface-variant, #64748b)",
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{
                fontSize: 11,
                fill: "var(--color-on-surface-variant, #64748b)",
              }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <Tooltip content={<RetentionTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              formatter={(value) => (
                <span className="capitalize text-on-surface-variant">
                  {value}
                </span>
              )}
            />
            {retentionCurves.map(({ tier }, index) => (
              <Line
                key={tier}
                type="monotone"
                dataKey={tier}
                stroke={getTierColor(tier, index)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

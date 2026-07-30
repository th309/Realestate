/**
 * SessionDurationDist
 *
 * Bar chart of the session-duration histogram.
 *
 * The buckets are asymmetric on purpose, and the boundaries are owned by SQL
 * (supabase/migrations/20260729213000_analytics_journeys.sql) — this list only
 * mirrors them for display order. Two instrumentation artifacts drive the
 * choice: an early heartbeat fires ONCE at exactly 5 seconds, parking ~2,000
 * sessions on that single value, and ~94% of sessions sit at 0 because they
 * never heartbeated at all, meaning unmeasured rather than zero-length. Both get
 * their own bucket. The previous `<30s` bar merged them with real short visits
 * into one column that was ~97% "we never measured this".
 */

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DurationBucket } from "@/lib/data/fetchers/admin-analytics.types";

interface SessionDurationDistProps {
  buckets: DurationBucket[];
}

const BUCKET_ORDER = [
  "0s",
  "1-4s",
  "5s",
  "6-29s",
  "30s-2m",
  "2-5m",
  "5-10m",
  "10m+",
];

/** Buckets that measure instrumentation, not attention. */
const ARTIFACT_NOTES: Record<string, string> = {
  "0s": "Never sent a heartbeat — duration unmeasured, not zero",
  "5s": "The first heartbeat fires at exactly 5s",
};

function orderBuckets(buckets: DurationBucket[]): DurationBucket[] {
  return BUCKET_ORDER.map(
    (label) =>
      buckets.find((b) => b.bucket === label) ?? { bucket: label, count: 0 },
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  total: number;
}

function CustomTooltip({ active, payload, label, total }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const count = payload[0].value;
  const share = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  const note = label ? ARTIFACT_NOTES[label] : undefined;

  return (
    <div className="bg-surface-container-high border border-outline-variant rounded-xl px-3 py-2 shadow-lg text-xs max-w-[220px]">
      <p className="font-medium text-on-surface mb-1">{label}</p>
      <p className="tabular-nums text-on-surface-variant">
        {count.toLocaleString()} sessions ({share}%)
      </p>
      {note && (
        <p className="mt-1 text-on-surface-variant opacity-80">{note}</p>
      )}
    </div>
  );
}

export function SessionDurationDist({ buckets }: SessionDurationDistProps) {
  const orderedBuckets = orderBuckets(buckets);
  const total = orderedBuckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-on-surface">
          Session Duration Distribution
        </h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          How long users spend per session
        </p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={orderedBuckets}
          margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(var(--color-outline-variant), 0.4)"
            vertical={false}
          />
          <XAxis
            dataKey="bucket"
            // interval={0} forces every label to render. Recharts otherwise
            // drops labels that would overlap, and the two it would drop first
            // are the ones that carry the meaning here.
            interval={0}
            tick={{ fontSize: 10, fill: "var(--color-on-surface-variant)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-on-surface-variant)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
          />
          <Tooltip
            content={<CustomTooltip total={total} />}
            cursor={{ fill: "rgba(var(--color-on-surface), 0.05)" }}
          />
          <Bar
            dataKey="count"
            fill="var(--color-primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={64}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/50">
        <span className="text-xs text-on-surface-variant">Total sessions</span>
        <span className="text-xs font-medium tabular-nums text-on-surface">
          {total.toLocaleString()}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-on-surface-variant">
        <span className="font-medium">0s</span> means no heartbeat ever fired —
        the duration is unmeasured, not zero.{" "}
        <span className="font-medium">5s</span> is the first heartbeat, so it is
        a single instrumented instant rather than a range.
      </p>
    </div>
  );
}

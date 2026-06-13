// Pure server component — values land in initial HTML for crawler visibility.
// No 'use client', no hooks, no imports from app/components/scoring/* (those are client).
import { formatMetricValue } from "@/lib/data";
import type {
  MarketStatsData,
  MarketStatField,
  ScoreReceipt,
} from "@/lib/data";
import { StatSparkline } from "./StatSparkline";

const SOURCE_LABEL: Record<string, string> = {
  zillow: "Zillow",
  realtor: "Realtor.com",
  redfin: "Redfin",
  census: "U.S. Census",
  economic: "FRED",
  calculated: "PropertyIQ",
};

function gradeClasses(grade: string | null): string {
  switch ((grade ?? "").charAt(0)) {
    case "A":
      return "bg-green-600 text-white";
    case "B":
      return "bg-emerald-600 text-white";
    case "C":
      return "bg-yellow-600 text-white";
    case "D":
      return "bg-orange-600 text-white";
    default:
      return "bg-red-600 text-white";
  }
}

function fmtField(f: MarketStatField): string {
  if (f.value === null) return "—";
  if (f.metricId === "home_value_yoy")
    return `${f.value > 0 ? "+" : ""}${f.value.toFixed(1)}%`;
  return formatMetricValue(
    f.value,
    f.metricId === "days_on_market"
      ? "days"
      : f.metricId === "rent_index" || f.metricId === "home_value"
        ? "currency"
        : "number",
  );
}

function fmtReceipt(r: ScoreReceipt): string {
  if (r.value === null) return "—";
  if (r.format === "days") return `${Math.round(r.value)} days`;
  return `${r.value > 0 ? "+" : ""}${r.value.toFixed(1)}%`;
}

function monthYear(date: string | null): string {
  if (!date) return "n/a";
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function MarketStatsBlock({
  data,
  geoName,
}: {
  data: MarketStatsData;
  geoName: string;
}) {
  const { headline, receipts } = data;
  const sources = Array.from(
    new Set(
      [
        headline.medianPrice.source,
        headline.rent.source,
        headline.daysOnMarket.source,
        headline.yoy.source,
      ].filter(Boolean) as string[],
    ),
  ).map((s) => SOURCE_LABEL[s] ?? s);

  return (
    <section
      className="max-w-4xl mx-auto px-4 pt-8"
      aria-label={`${geoName} market statistics`}
    >
      <div className="rounded-xl border border-outline-variant bg-surface-container-low shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant">
          <h2 className="text-base font-medium text-on-surface">
            {geoName} market data
          </h2>
          {data.score !== null && (
            <span className="text-sm text-on-surface-variant">
              PropertyIQ Score{" "}
              <span className="font-mono font-semibold text-on-surface">
                {data.score}
              </span>
              {data.grade && (
                <span
                  className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${gradeClasses(data.grade)}`}
                >
                  {data.grade}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Headline stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-outline-variant">
          {[
            headline.medianPrice,
            headline.rent,
            headline.daysOnMarket,
            headline.yoy,
          ].map((f) => (
            <div key={f.metricId} className="p-4">
              <div className="text-xs text-on-surface-variant">{f.label}</div>
              <div className="text-lg font-mono font-semibold text-on-surface">
                {fmtField(f)}
              </div>
              {f.metricId === "home_value" && data.sparkline.length >= 2 && (
                <StatSparkline
                  data={data.sparkline}
                  className="mt-1 text-primary"
                />
              )}
            </div>
          ))}
        </div>

        {/* Score receipts */}
        <div
          data-testid="score-receipts"
          className="border-t border-outline-variant px-5 py-3"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-on-surface-variant mb-2">
            What drives the score
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {receipts.map((r) => (
              <span key={r.key} className="text-on-surface-variant">
                {r.label}:{" "}
                <span className="font-mono text-on-surface">
                  {fmtReceipt(r)}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Freshness + attribution */}
        <div className="border-t border-outline-variant px-5 py-2 text-xs text-on-surface-variant/70">
          Data through {monthYear(data.latestDate)} · Source:{" "}
          {sources.join(", ") || "PropertyIQ"}
        </div>
      </div>
    </section>
  );
}

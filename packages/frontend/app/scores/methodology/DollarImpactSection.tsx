import { DollarSign } from "lucide-react";
import { METRO_DECILE_3Y, MEDIAN_METRO_HOME } from "../decile-data";

// Derived from the single source of truth (../decile-data) so the methodology
// dollar table and the /scores decile table can never drift. Each decile's
// dollar gain = median home x its 3-year total return; vs50 is relative to the
// score-50 decile.
const gainFor = (totalReturn: number) =>
  Math.round((MEDIAN_METRO_HOME * totalReturn) / 100);

const GAIN_AT_50 = gainFor(
  METRO_DECILE_3Y.find((d) => d.score === 50)!.totalReturn,
);

const THREE_YEAR_ROWS = METRO_DECILE_3Y.map((d) => {
  const gain = gainFor(d.totalReturn);
  return {
    score: d.score,
    excess: d.meanExcess,
    gain,
    vs50: gain - GAIN_AT_50,
  };
});

const SPREAD_100_VS_10 =
  gainFor(METRO_DECILE_3Y.find((d) => d.score === 100)!.totalReturn) -
  gainFor(METRO_DECILE_3Y.find((d) => d.score === 10)!.totalReturn);

const COLUMNS = [
  { key: "score", label: "Score", align: "text-left" as const },
  { key: "excess", label: "Excess vs State", align: "text-right" as const },
  { key: "gain", label: "Dollar Gain", align: "text-right" as const },
  { key: "vs50", label: "vs Score 50", align: "text-right" as const },
];

function fmt(n: number, prefix = "$") {
  return prefix + Math.abs(n).toLocaleString("en-US");
}

function sign(n: number) {
  return n > 0 ? "+" : n < 0 ? "-" : "";
}

function ImpactTable({
  title,
  rows,
  spread,
}: {
  title: string;
  rows: typeof THREE_YEAR_ROWS;
  spread: number;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-on-surface mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`py-2 px-3 font-medium text-on-surface-variant ${col.align}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isHighlight = row.score === 100 || row.score === 10;
              return (
                <tr
                  key={row.score}
                  className={`border-b border-outline-variant/50 ${isHighlight ? "bg-primary-container/20 font-medium" : ""}`}
                >
                  <td className="py-2 px-3 font-mono">{row.score}</td>
                  <td
                    className={`py-2 px-3 text-right font-mono ${row.excess >= 0 ? "text-primary" : "text-error"}`}
                  >
                    {sign(row.excess)}
                    {Math.abs(row.excess).toFixed(2)}%
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    {fmt(row.gain)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-mono ${row.vs50 > 0 ? "text-primary" : row.vs50 < 0 ? "text-error" : "text-on-surface-variant"}`}
                  >
                    {row.vs50 === 0
                      ? "$0"
                      : `${sign(row.vs50)}${fmt(row.vs50)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 p-3 bg-primary-container/30 rounded-xl border border-primary/20">
        <p className="text-sm font-medium text-on-surface">
          Score 100 vs Score 10:{" "}
          <span className="text-primary font-bold">+{fmt(spread)}</span>{" "}
          difference on the same $252K purchase.
        </p>
      </div>
    </div>
  );
}

export function DollarImpactSection() {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <DollarSign className="w-5 h-5 text-primary" />
        </div>
        <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
          Dollar Impact
        </p>
      </div>
      <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
        The Cost of Choosing Wrong
      </h2>
      <p className="text-on-surface-variant mt-2 max-w-2xl">
        Based on a median metro home value of $251,629 (Zillow ZHVI, April 2026)
        and an average state 3-year cumulative return of about 14%. Every score
        point translates to real dollars gained or lost.
      </p>

      <div className="mt-8 max-w-2xl">
        <ImpactTable
          title="3-Year Dollar Impact"
          rows={THREE_YEAR_ROWS}
          spread={SPREAD_100_VS_10}
        />
      </div>
    </section>
  );
}

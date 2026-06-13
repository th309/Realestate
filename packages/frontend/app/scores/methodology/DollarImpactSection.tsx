import { DollarSign } from "lucide-react";

// Per-decile mean returns from the PropertyIQ metro score backtest (2001-2023),
// excess vs state. Dollars on the median metro home ($251,629, Zillow ZHVI Apr 2026).
// "excess" and "totalReturn" are cumulative over the horizon; gain = appreciation $.
const THREE_YEAR_ROWS = [
  {
    score: 10,
    excess: -4.36,
    totalReturn: 6.91,
    homeValue: 269_013,
    gain: 17_384,
    vs50: -16_688,
  },
  {
    score: 20,
    excess: -2.49,
    totalReturn: 9.59,
    homeValue: 275_760,
    gain: 24_131,
    vs50: -9_941,
  },
  {
    score: 30,
    excess: -1.93,
    totalReturn: 11.05,
    homeValue: 279_422,
    gain: 27_793,
    vs50: -6_279,
  },
  {
    score: 40,
    excess: -1.2,
    totalReturn: 12.46,
    homeValue: 282_984,
    gain: 31_355,
    vs50: -2_717,
  },
  {
    score: 50,
    excess: -0.73,
    totalReturn: 13.54,
    homeValue: 285_701,
    gain: 34_072,
    vs50: 0,
  },
  {
    score: 60,
    excess: -0.34,
    totalReturn: 14.82,
    homeValue: 288_916,
    gain: 37_287,
    vs50: 3_215,
  },
  {
    score: 70,
    excess: -0.11,
    totalReturn: 16.37,
    homeValue: 292_816,
    gain: 41_187,
    vs50: 7_115,
  },
  {
    score: 80,
    excess: -0.18,
    totalReturn: 17.82,
    homeValue: 296_471,
    gain: 44_842,
    vs50: 10_770,
  },
  {
    score: 90,
    excess: 0.49,
    totalReturn: 19.65,
    homeValue: 301_064,
    gain: 49_435,
    vs50: 15_363,
  },
  {
    score: 100,
    excess: 1.93,
    totalReturn: 22.14,
    homeValue: 307_336,
    gain: 55_707,
    vs50: 21_635,
  },
];

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
          spread={38_323}
        />
      </div>
    </section>
  );
}

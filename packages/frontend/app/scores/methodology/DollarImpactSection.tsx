import { DollarSign } from "lucide-react";

const ONE_YEAR_ROWS = [
  {
    score: 10,
    excess: -2.11,
    totalReturn: 3.87,
    homeValue: 254_860,
    gain: 9_499,
    vs50: -4_808,
  },
  {
    score: 20,
    excess: -1.26,
    totalReturn: 4.72,
    homeValue: 256_947,
    gain: 11_586,
    vs50: -2_721,
  },
  {
    score: 30,
    excess: -0.84,
    totalReturn: 5.14,
    homeValue: 257_978,
    gain: 12_617,
    vs50: -1_690,
  },
  {
    score: 40,
    excess: -0.47,
    totalReturn: 5.51,
    homeValue: 258_887,
    gain: 13_526,
    vs50: -781,
  },
  {
    score: 50,
    excess: -0.15,
    totalReturn: 5.83,
    homeValue: 259_668,
    gain: 14_307,
    vs50: 0,
  },
  {
    score: 60,
    excess: 0.07,
    totalReturn: 6.05,
    homeValue: 260_207,
    gain: 14_846,
    vs50: 539,
  },
  {
    score: 70,
    excess: 0.23,
    totalReturn: 6.21,
    homeValue: 260_600,
    gain: 15_239,
    vs50: 932,
  },
  {
    score: 80,
    excess: 0.53,
    totalReturn: 6.51,
    homeValue: 261_336,
    gain: 15_975,
    vs50: 1_668,
  },
  {
    score: 90,
    excess: 1.03,
    totalReturn: 7.01,
    homeValue: 262_563,
    gain: 17_202,
    vs50: 2_895,
  },
  {
    score: 100,
    excess: 1.64,
    totalReturn: 7.62,
    homeValue: 264_059,
    gain: 18_698,
    vs50: 4_391,
  },
];

const THREE_YEAR_ROWS = [
  {
    score: 10,
    excess: -5.66,
    totalReturn: 14.84,
    homeValue: 281_797,
    gain: 36_436,
    vs50: -13_196,
  },
  {
    score: 20,
    excess: -3.34,
    totalReturn: 17.16,
    homeValue: 287_490,
    gain: 42_129,
    vs50: -7_503,
  },
  {
    score: 30,
    excess: -2.04,
    totalReturn: 18.46,
    homeValue: 298_679,
    gain: 45_318,
    vs50: -4_314,
  },
  {
    score: 40,
    excess: -1.2,
    totalReturn: 19.3,
    homeValue: 292_736,
    gain: 47_375,
    vs50: -2_257,
  },
  {
    score: 50,
    excess: -0.28,
    totalReturn: 20.22,
    homeValue: 294_993,
    gain: 49_632,
    vs50: 0,
  },
  {
    score: 60,
    excess: 0.31,
    totalReturn: 20.81,
    homeValue: 296_439,
    gain: 51_078,
    vs50: 1_446,
  },
  {
    score: 70,
    excess: 1.17,
    totalReturn: 21.67,
    homeValue: 298_550,
    gain: 53_189,
    vs50: 3_557,
  },
  {
    score: 80,
    excess: 1.87,
    totalReturn: 22.37,
    homeValue: 300_267,
    gain: 54_906,
    vs50: 5_274,
  },
  {
    score: 90,
    excess: 3.05,
    totalReturn: 23.55,
    homeValue: 303_163,
    gain: 57_802,
    vs50: 8_170,
  },
  {
    score: 100,
    excess: 4.28,
    totalReturn: 24.78,
    homeValue: 306_181,
    gain: 60_820,
    vs50: 11_188,
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
  rows: typeof ONE_YEAR_ROWS;
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
          difference on the same $245K purchase.
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
        Based on a median metro home value of $245,361 (Zillow ZHVI, February
        2026) and an average state 3-year cumulative return of 20.50%. Every
        score point translates to real dollars gained or lost.
      </p>

      <div className="mt-8 grid gap-12 lg:grid-cols-2">
        <ImpactTable
          title="1-Year Dollar Impact"
          rows={ONE_YEAR_ROWS}
          spread={9_199}
        />
        <ImpactTable
          title="3-Year Dollar Impact"
          rows={THREE_YEAR_ROWS}
          spread={24_384}
        />
      </div>
    </section>
  );
}

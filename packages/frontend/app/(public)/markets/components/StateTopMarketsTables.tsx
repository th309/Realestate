// Pure server component — renders server-side for crawler visibility.
// No 'use client', no hooks. Caller passes slug-mapped RankingRow[] so hrefs
// resolve to /markets/<slug> and /markets/county/<slug> respectively.
import Link from "next/link";
import type { RankingRow } from "@/lib/data";

function gradeText(grade: string): string {
  return grade || "—";
}

function Table({
  title,
  rows,
  hrefBase,
}: {
  title: string;
  rows: RankingRow[];
  hrefBase: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="flex-1 min-w-[280px]">
      <h3 className="text-base font-medium text-on-surface mb-3">{title}</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-on-surface-variant border-b border-outline-variant">
            <th className="py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-2 font-medium">Market</th>
            <th className="py-2 pr-2 font-medium text-right">Score</th>
            <th className="py-2 font-medium text-right">Grade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-outline-variant/50">
              <td className="py-2 pr-2 text-on-surface-variant font-mono">
                {i + 1}
              </td>
              <td className="py-2 pr-2">
                <Link
                  href={`${hrefBase}/${r.id}`}
                  className="text-primary hover:underline"
                >
                  {r.name}
                </Link>
              </td>
              <td className="py-2 pr-2 text-right font-mono text-on-surface">
                {Math.round(r.score)}
              </td>
              <td className="py-2 text-right font-mono text-on-surface-variant">
                {gradeText(r.grade)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StateTopMarketsTables({
  stateName,
  metros,
  counties,
  metroHrefBase,
  countyHrefBase,
}: {
  stateName: string;
  metros: RankingRow[];
  counties: RankingRow[];
  metroHrefBase: string;
  countyHrefBase: string;
}) {
  if (!metros.length && !counties.length) return null;
  return (
    <section
      className="w-full max-w-4xl mx-auto px-4 py-8"
      aria-label={`Top ${stateName} markets by PropertyIQ Score`}
    >
      <h2 className="text-xl font-medium text-on-surface mb-4">
        Top {stateName} markets by PropertyIQ Score
      </h2>
      <div className="flex flex-wrap gap-8">
        <Table title="Top metros" rows={metros} hrefBase={metroHrefBase} />
        <Table title="Top counties" rows={counties} hrefBase={countyHrefBase} />
      </div>
    </section>
  );
}

/**
 * Head-to-Head Comparison Table
 *
 * PropertyIQ vs leading competitor comparison using publicly available data.
 * Server component — static comparison data.
 */

import { CheckCircle, X } from 'lucide-react';

interface ComparisonRow {
  dimension: string;
  propertyiq: string;
  competitor: string;
  winner: 'propertyiq' | 'competitor' | 'tie';
}

const ROWS: ComparisonRow[] = [
  {
    dimension: 'Best-window correlation',
    propertyiq: '\u03C1 = 0.80 (Mar 2024, 250K+)',
    competitor: 'r = 0.79 (Apr 2024, 250K+)',
    winner: 'propertyiq',
  },
  {
    dimension: 'Same-window match (Apr 2024)',
    propertyiq: '\u03C1 = 0.76 (250K+)',
    competitor: 'r = 0.79 (250K+)',
    winner: 'competitor',
  },
  {
    dimension: 'Validation windows tested',
    propertyiq: '24 consecutive months',
    competitor: '1 cherry-picked window',
    winner: 'propertyiq',
  },
  {
    dimension: 'Geography coverage',
    propertyiq: '860 metros + 3K counties + 25K ZIPs',
    competitor: '~380 metros',
    winner: 'propertyiq',
  },
  {
    dimension: 'Quintile dollar impact',
    propertyiq: '$11,978/yr per home',
    competitor: 'Not published',
    winner: 'propertyiq',
  },
  {
    dimension: 'Bottom quintile warning',
    propertyiq: 'Yes: -0.23% = actual loss',
    competitor: 'No',
    winner: 'propertyiq',
  },
  {
    dimension: 'Walk-forward cross-validation',
    propertyiq: 'Yes (no look-ahead bias)',
    competitor: 'No',
    winner: 'propertyiq',
  },
  {
    dimension: 'Bootstrap significance testing',
    propertyiq: 'Yes (95% CI excludes zero)',
    competitor: 'No',
    winner: 'propertyiq',
  },
  {
    dimension: 'Price',
    propertyiq: '$29/mo',
    competitor: '$399/yr',
    winner: 'propertyiq',
  },
];

function WinnerBadge({ winner }: { winner: ComparisonRow['winner'] }) {
  if (winner === 'tie') return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      <CheckCircle className="w-3.5 h-3.5 text-primary" />
    </span>
  );
}

export function HeadToHead() {
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Side-by-Side
      </p>
      <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
        PropertyIQ vs. the Competition
      </h2>
      <p className="text-on-surface-variant mt-2 max-w-2xl">
        Using the leading competitor&apos;s own published numbers from their forecast page.
      </p>

      <div className="mt-8 rounded-2xl border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container">
                <th className="text-left px-4 py-3 font-medium text-on-surface-variant w-[35%]">
                  Dimension
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary bg-primary/[0.04] w-[32.5%]">
                  PropertyIQ
                </th>
                <th className="text-left px-4 py-3 font-medium text-on-surface-variant w-[32.5%]">
                  Leading Competitor
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.dimension}
                  className={i % 2 === 0 ? 'bg-surface' : 'bg-surface-container-lowest'}
                >
                  <td className="px-4 py-3 text-on-surface font-medium">{row.dimension}</td>
                  <td className="px-4 py-3 bg-primary/[0.04]">
                    <span className="flex items-center gap-1.5">
                      {row.winner === 'propertyiq' && <WinnerBadge winner={row.winner} />}
                      <span className={row.winner === 'propertyiq' ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}>
                        {row.propertyiq}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      {row.winner === 'competitor' && <WinnerBadge winner={row.winner} />}
                      <span className={row.winner === 'competitor' ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}>
                        {row.competitor}
                      </span>
                      {row.competitor === 'No' || row.competitor === 'Not published' ? (
                        <X className="w-3.5 h-3.5 text-error/50" />
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-on-surface-variant mt-3 italic">
        Competitor data sourced from publicly available forecast pages (accessed February 2026).
        PropertyIQ uses Spearman &rho; (rank correlation); competitor uses Pearson r (linear correlation).
      </p>
    </section>
  );
}

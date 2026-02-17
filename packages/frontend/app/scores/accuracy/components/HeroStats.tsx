/**
 * Hero Stats Section
 *
 * Five stat cards showing key validation metrics.
 * Server component — renders immediately as static HTML.
 */

import { TrendingUp, DollarSign, Calendar, CheckCircle, MapPin } from 'lucide-react';

const STATS = [
  {
    icon: TrendingUp,
    value: '0.80',
    label: 'Peak rank correlation (Spearman \u03C1)',
    sublabel: 'Beats the leading competitor\u2019s best of 0.79',
  },
  {
    icon: DollarSign,
    value: '$11,978',
    label: 'Dollar advantage per home per year',
    sublabel: 'Top vs bottom quintile',
  },
  {
    icon: Calendar,
    value: '24',
    label: 'Consecutive monthly validation windows',
    sublabel: 'vs the competition\u2019s 1 cherry-picked window',
  },
  {
    icon: CheckCircle,
    value: '100%',
    label: 'Perfect quintile monotonicity',
    sublabel: 'Higher score = higher return, every time',
  },
  {
    icon: MapPin,
    value: '28,610+',
    label: 'Markets scored and tracked',
    sublabel: 'Metros, counties, and ZIP codes',
  },
];

export function HeroStats() {
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Forecast Accuracy
      </p>
      <h1 className="text-3xl md:text-4xl font-[var(--font-source-serif)] text-on-surface mt-2">
        0.80 Correlation. 24 Months.{' '}
        <span className="text-primary">Zero Cherry-Picking.</span>
      </h1>
      <p className="text-on-surface-variant mt-3 max-w-3xl text-base leading-relaxed">
        Our best window beats the leading competitor (&rho;=0.80 vs r=0.79). But we don&apos;t stop at one
        window &mdash; we validate across 24 consecutive months, 860+ metros, and 28,000+ markets.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-8">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.value}
              className="bg-surface-container rounded-2xl p-4 border border-outline-variant"
            >
              <div className="p-2 bg-primary-container rounded-xl text-on-primary-container w-fit">
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-on-surface mt-3">{stat.value}</p>
              <p className="text-xs text-on-surface-variant mt-1 leading-snug">{stat.label}</p>
              {stat.sublabel && (
                <p className="text-[10px] text-on-surface-variant/70 mt-0.5">{stat.sublabel}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

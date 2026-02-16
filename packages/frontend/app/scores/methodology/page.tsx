import fs from 'fs';
import path from 'path';
import { DollarSign, Briefcase, Target, Database, TrendingUp, Shield, CheckCircle, FileText } from 'lucide-react';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Methodology — How PropertyIQ Scores Predict Market Performance',
  description: 'Walk-forward validated across 5 years of market data. See the statistical proof behind PropertyIQ Scores.',
};

const STATS = [
  { icon: DollarSign, value: '$27,100', label: 'More equity on a typical home over 3 years' },
  { icon: Briefcase, value: '$81,300', label: 'Extra appreciation on a 3-property portfolio (3yr)' },
  { icon: Target, value: '100%', label: 'Predictive accuracy across all test periods' },
  { icon: Database, value: '1.1M+', label: 'Location-period observations validated' },
];

const QUINTILES = [
  { label: 'Q1 (Bottom 20%)', range: '0–20', return: -1.92, width: 10 },
  { label: 'Q2', range: '21–40', return: -0.53, width: 25 },
  { label: 'Q3', range: '41–60', return: 0.14, width: 40 },
  { label: 'Q4', range: '61–80', return: 0.69, width: 65 },
  { label: 'Q5 (Top 20%)', range: '80–100', return: 1.15, width: 100 },
];

const KEY_FINDINGS = [
  {
    icon: Shield,
    iconClass: 'bg-secondary/10 p-2 rounded-xl text-secondary w-fit',
    title: 'Zero Sign Flips',
    description:
      'Model features maintained consistent direction across every walk-forward validation window. Zero instability across all geographies.',
  },
  {
    icon: TrendingUp,
    iconClass: 'bg-primary/10 p-2 rounded-xl text-primary w-fit',
    title: 'Consistent Across Geographies',
    description:
      'Predictive at metro, county, and ZIP code levels. Works everywhere, not just cherry-picked markets.',
  },
  {
    icon: CheckCircle,
    iconClass: 'bg-tertiary/10 p-2 rounded-xl text-tertiary w-fit',
    title: 'v2.0: Major Improvements',
    description:
      'Up to 1,600% improvement in county-level prediction accuracy versus v1.0. Fixed critical InvestorEdge sign inversion at metro level.',
  },
];

export default function MethodologyPage() {
  const reportPath = path.join(process.cwd(), '..', '..', 'docs', 'audits', '2026-02-13-v2-validation-report.md');
  const reportContent = fs.readFileSync(reportPath, 'utf-8');

  return (
    <div className="mt-12 space-y-16">
      {/* Header */}
      <section>
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: 'Scores', href: '/scores' }, { label: 'Methodology' }]}
          title="The Proof Behind PropertyIQ Scores"
          description="Walk-forward validated across 5 years of market data"
          icon={<Target className="w-5 h-5" />}
        />
      </section>

      {/* Marketing Stats */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.value}
                className="bg-surface-container rounded-2xl p-5 border border-outline-variant"
              >
                <div className="p-2 bg-primary-container rounded-xl text-on-primary-container w-fit">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-on-surface mt-3">{stat.value}</p>
                <p className="text-sm text-on-surface-variant mt-1">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quintile Comparison */}
      <section>
        <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
          Performance By Score Quintile
        </p>
        <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
          How Scores Predict Returns
        </h2>
        <p className="text-on-surface-variant mt-2 max-w-2xl">
          Metro HomeReady scores, based on 21,620 in-sample observations. Higher scores consistently
          predict higher home price appreciation.
        </p>

        <div className="mt-8 space-y-3">
          {QUINTILES.map((q) => (
            <div key={q.label} className="flex items-center gap-4">
              <div className="w-32 text-sm text-on-surface-variant shrink-0">{q.label}</div>
              <div className="flex-1 h-8 bg-surface-container rounded-lg overflow-hidden">
                <div
                  className={`h-full rounded-lg ${q.return >= 0 ? 'bg-primary/30' : 'bg-error/30'}`}
                  style={{ width: `${q.width}%` }}
                />
              </div>
              <div
                className={`w-20 text-sm font-semibold text-right ${q.return >= 0 ? 'text-primary' : 'text-error'}`}
              >
                {q.return >= 0 ? '+' : ''}
                {q.return.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-primary-container/30 rounded-xl border border-primary/20">
          <p className="text-sm font-medium text-on-surface">
            Top-20% scored markets returned{' '}
            <span className="text-primary font-bold">142% more equity</span> than bottom-20% scored
            markets over 3 years.
          </p>
        </div>
      </section>

      {/* Key Findings */}
      <section>
        <div className="grid md:grid-cols-2 gap-4">
          {KEY_FINDINGS.map((finding) => {
            const Icon = finding.icon;
            return (
              <div
                key={finding.title}
                className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant"
              >
                <div className={finding.iconClass}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-on-surface mt-3">{finding.title}</h3>
                <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                  {finding.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Technical Validation Report */}
      <section id="technical-report" className="mt-16">
        <div className="border-t border-outline-variant pt-12">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
              Technical Validation Report
            </p>
          </div>
          <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
            Walk-forward elastic net cross-validation with bootstrap significance testing
          </h2>
          <p className="text-sm text-on-surface-variant mt-2 mb-8">
            Full methodology and results from our v2.0 scoring model validation, covering December 2020 through December 2025.
          </p>
          <MarkdownRenderer content={reportContent} />
        </div>
      </section>
    </div>
  );
}

/**
 * Methodology Footer
 *
 * Brief explainer of validation methodology with link to full report.
 * Server component.
 */

import Link from 'next/link';
import { FileText, ArrowRight } from 'lucide-react';

const METHODS = [
  {
    title: 'Walk-Forward Cross-Validation',
    description:
      'Four overlapping train/test windows (2020\u20132025) ensure the model never sees future data. No look-ahead bias.',
  },
  {
    title: 'Excess Return Measurement',
    description:
      'Returns measured as excess over state benchmarks, isolating local alpha from broad market beta.',
  },
  {
    title: 'Bootstrap Significance Testing',
    description:
      '1,000 bootstrap samples per window. 95% confidence intervals exclude zero for all primary coefficients.',
  },
  {
    title: 'Elastic Net Regularization',
    description:
      'L1/L2 penalty prevents overfitting across 40+ features. Coefficients are stable and interpretable.',
  },
];

export function MethodologyFooter() {
  return (
    <section>
      <div className="border-t border-outline-variant pt-12">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
            How We Validate
          </p>
        </div>

        <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
          Rigorous, Transparent, Reproducible
        </h2>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {METHODS.map((method) => (
            <div
              key={method.title}
              className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant"
            >
              <h3 className="text-sm font-semibold text-on-surface">{method.title}</h3>
              <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                {method.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Link
            href="/scores/methodology"
            className="inline-flex items-center gap-2 text-primary font-medium hover:underline text-sm"
          >
            Read the full technical validation report
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

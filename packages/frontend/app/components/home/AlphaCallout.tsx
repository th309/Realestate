'use client';

import { TrendingUp } from 'lucide-react';
import { useInView } from './hooks/useInView';

export function AlphaCallout() {
  const [setRef, inView] = useInView();

  return (
    <section
      ref={setRef}
      className="py-5 lg:py-7 px-6"
      aria-labelledby="alpha-heading"
    >
      <div
        className="max-w-3xl mx-auto rounded-2xl bg-primary-container/30 border border-primary/10 p-8 md:p-12"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* Icon + Eyebrow */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-[0.15em]">
            The Harder Problem
          </span>
        </div>

        {/* Headline */}
        <h2
          id="alpha-heading"
          className="text-2xl md:text-3xl lg:text-[2.1rem] font-bold text-on-surface tracking-tight leading-tight mb-6 font-[family-name:var(--font-source-serif)]"
        >
          We Don&apos;t Predict &ldquo;Florida Will Be Hot.&rdquo;
          <br />
          We Predict <span className="text-primary">Which</span> Florida Metro Will Beat the Others.
        </h2>

        {/* Body */}
        <div className="space-y-4 text-base text-on-surface-variant leading-relaxed mb-8">
          <p>
            Most forecast models predict raw appreciation. Will home prices go up or down?
            That&apos;s <strong className="text-on-surface">beta</strong>. It&apos;s easy and not very useful.
            Every model gets &ldquo;Sun Belt is growing&rdquo; right.
          </p>
          <p>
            PropertyIQ scores predict{' '}
            <strong className="text-on-surface">excess returns above regional benchmarks</strong>.
            That&apos;s <em className="text-on-surface">alpha</em>. Given two metros in the same state,
            which one will <em>outperform</em>? That&apos;s the question worth $11,978 per year.
          </p>
        </div>

        {/* Beta vs Alpha cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Beta */}
          <div className="rounded-xl border border-outline-variant/40 bg-surface p-5">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-[0.12em]">
              Beta (What Others Predict)
            </span>
            <p className="mt-2 text-sm font-semibold text-on-surface">
              &ldquo;Tampa will appreciate 5% this year&rdquo;
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Raw appreciation. Everyone knows this.
            </p>
          </div>

          {/* Alpha */}
          <div className="rounded-xl border border-primary/20 bg-primary-container/40 p-5">
            <span className="text-[11px] font-semibold text-primary uppercase tracking-[0.12em]">
              Alpha (What PropertyIQ Predicts)
            </span>
            <p className="mt-2 text-sm font-semibold text-on-surface">
              &ldquo;Tampa will beat other FL metros by 2.3pp&rdquo;
            </p>
            <p className="mt-1 text-xs text-primary flex items-center gap-1">
              <span aria-hidden="true">&rarr;</span> This is the $11,978 insight.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

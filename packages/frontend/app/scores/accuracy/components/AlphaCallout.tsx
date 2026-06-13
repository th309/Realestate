/**
 * Alpha vs Beta Callout
 *
 * Prominent section surfacing the key differentiator:
 * PropertyIQ ranks markets by their demand signal relative to the state
 * average (alpha), rather than forecasting raw appreciation (beta). The score
 * is a within-state ranking, not a magnitude forecast — copy reflects that.
 */

import { TrendingUp, ArrowRight } from "lucide-react";

export function AlphaCallout() {
  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/[0.06] to-primary/[0.02]">
      <div className="px-8 py-10 md:px-12 md:py-12">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex shrink-0 p-3 bg-primary/10 rounded-xl">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-4 max-w-3xl">
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
              The Harder Problem
            </p>
            <h2 className="text-2xl md:text-3xl font-[var(--font-source-serif)] text-on-surface leading-snug">
              We Don&rsquo;t Predict &ldquo;Florida Will Be Hot.&rdquo;
              <br className="hidden md:block" />
              We Rank{" "}
              <em className="text-primary not-italic font-bold">Which</em>{" "}
              Florida Markets Beat Their State Average.
            </h2>
            <div className="space-y-3 text-on-surface-variant">
              <p>
                Most forecast models predict raw appreciation &mdash; will home
                prices go up or down? That&rsquo;s{" "}
                <strong className="text-on-surface">beta</strong>. It&rsquo;s
                easy and not very useful. Every model gets &ldquo;Sun Belt is
                growing&rdquo; right.
              </p>
              <p>
                PropertyIQ scores rank every market against its{" "}
                <strong className="text-on-surface">state average</strong>{" "}
                &mdash; which ones are running hotter, which are lagging. That
                relative read is{" "}
                <strong className="text-on-surface">alpha</strong>, and
                historically the gap between the top-tier and bottom-tier
                markets in a state has been worth about $3,550 per year per
                home. We rank the direction; we don&rsquo;t forecast the exact
                number.
              </p>
            </div>

            {/* Alpha vs Beta visual comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-surface-container/60 rounded-xl px-5 py-4 border border-outline-variant">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                  Beta (What Others Predict)
                </p>
                <p className="text-sm text-on-surface-variant">
                  &ldquo;Tampa will appreciate 5% this year&rdquo;
                </p>
                <p className="text-xs text-on-surface-variant/60 mt-1">
                  Raw appreciation. Everyone knows this.
                </p>
              </div>
              <div className="bg-primary/[0.08] rounded-xl px-5 py-4 border-2 border-primary/20">
                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                  Alpha (What PropertyIQ Ranks)
                </p>
                <p className="text-sm text-on-surface">
                  &ldquo;Tampa ranks in Florida&rsquo;s top tier&rdquo;
                </p>
                <div className="flex items-start gap-1.5 mt-1">
                  <ArrowRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-primary font-medium">
                    Historically a +1.4pp/yr edge over bottom-tier FL markets
                    &mdash; about $3,550 on a $252K home.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

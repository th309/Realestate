import { TrendingUp, ShieldCheck, BarChart3 } from "lucide-react";

/** "How to Use the PropertyIQ Score" section — interpreting scores and confidence. */
export function HowToUseScoresSection() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-medium text-on-surface mb-8">
          How to Use the PropertyIQ Score
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-surface-container-low rounded-xl shadow-sm p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-on-surface" />
              <h3 className="text-base font-medium text-on-surface">
                High Score (80+)
              </h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Markets scoring 80 or above have historically outperformed their
              state benchmark by a meaningful margin. These metros show strong
              demand signals: rising home values, fast sales, and few price
              cuts. Historically, top-scored markets have beaten their state
              about 56% of the time over 3-year horizons.
            </p>
          </div>

          <div className="bg-surface-container-low rounded-xl shadow-sm p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-5 h-5 text-on-surface" />
              <h3 className="text-base font-medium text-on-surface">
                Low Score (Below 40)
              </h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Markets below 40 have historically underperformed their state
              benchmark. Weak demand signals — flat or falling values, slow
              sales, and frequent price cuts — suggest caution. Bottom-scored
              markets have beaten their state only about 37% of the time. Use
              low scores as a guardrail when evaluating markets.
            </p>
          </div>

          <div className="bg-surface-container-low rounded-xl shadow-sm p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-on-surface" />
              <h3 className="text-base font-medium text-on-surface">
                Confidence (A-F)
              </h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Every score includes a confidence grade reflecting data quality
              and coverage. A/B confidence means robust data across all four
              input signals. C/F confidence means data gaps exist — treat the
              score directionally rather than precisely. Always supplement
              low-confidence scores with local market knowledge.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** "How We Build the Score" methodology overview section. */
export function MethodologyOverviewSection() {
  return (
    <section className="py-16 px-4 bg-surface-container-low">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-medium text-on-surface mb-6">
          How We Build the Score
        </h2>
        <p className="text-on-surface-variant leading-relaxed mb-6">
          The PropertyIQ Score uses four signals — 12- and 3-month Zillow price
          momentum, Realtor.com median days on market, and the share of listings
          with price cuts — chosen because they are the most predictive signals
          of future home price appreciation. We tested dozens of candidate
          signals; these four survived rigorous out-of-sample validation; more
          metrics added noise, not signal.
        </p>
        <p className="text-on-surface-variant leading-relaxed mb-6">
          Each signal is z-score normalized within its geography level for its
          time period, removing scale differences. The combined signal is then
          mapped to a 1-99 percentile where 50 equals the state average. This
          approach is transparent, reproducible, and validated across 935 metros
          over more than two decades of data, positive in every validated year —
          higher-scored metros outperformed lower-scored metros on average.
        </p>
        <div className="flex flex-wrap gap-4">
          <a
            href="/scores/methodology"
            className="text-primary hover:text-primary/80 font-medium text-sm underline underline-offset-4"
          >
            Read Full Methodology
          </a>
          <a
            href="/scores/accuracy"
            className="text-primary hover:text-primary/80 font-medium text-sm underline underline-offset-4"
          >
            See Accuracy Results
          </a>
          <a
            href="/map"
            className="text-primary hover:text-primary/80 font-medium text-sm underline underline-offset-4"
          >
            Explore Scored Markets on the Map
          </a>
        </div>
      </div>
    </section>
  );
}

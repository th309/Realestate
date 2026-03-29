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
              demand signals: homes selling above list price, fast days on
              market, and tight supply. Historically, top-quintile markets beat
              the state 56% of the time over 1-year horizons.
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
              benchmark. Weak demand signals — homes selling below list, long
              days on market, excess supply — suggest caution. Bottom-quintile
              markets beat the state only 39% of the time. Use low scores as a
              guardrail when evaluating markets.
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
              and coverage. A/B confidence means robust data across all three
              input metrics. C/F confidence means data gaps exist — treat the
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
          The PropertyIQ Score uses three Redfin metrics — % Sold Above List,
          Median Days on Market, and Months of Supply — chosen because they are
          the most predictive signals of future home price appreciation. We
          tested 40+ features from Zillow, Census, FRED, BLS, and Redfin. These
          three survived rigorous out-of-sample validation; more metrics added
          noise, not signal.
        </p>
        <p className="text-on-surface-variant leading-relaxed mb-6">
          Each metric is z-score normalized against the national distribution
          for its time period, removing scale differences. The composite z-score
          is then mapped to a 1-99 percentile where 50 equals the state average.
          This approach is transparent, reproducible, and validated across 746
          metros over 13 years of data with 100% year hit rate — every single
          year, higher-scored metros outperformed lower-scored metros on
          average.
        </p>
        <div className="flex gap-4">
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
        </div>
      </div>
    </section>
  );
}

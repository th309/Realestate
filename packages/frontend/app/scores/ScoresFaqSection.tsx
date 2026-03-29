const FAQ_ITEMS = [
  {
    q: "How often is the PropertyIQ Score updated?",
    a: "The score is recalculated monthly as new Redfin data arrives. The three input metrics — % Sold Above List, Median Days on Market, and Months of Supply — update monthly. Each refresh incorporates the latest available data.",
  },
  {
    q: "What data sources power the score?",
    a: "The PropertyIQ Score is built on three Redfin metrics: % Sold Above List, Median Days on Market, and Months of Supply. We tested 40+ features from Zillow, Census, FRED, BLS, and Redfin — these three are the most predictive of future home price appreciation in out-of-sample testing.",
  },
  {
    q: "How accurate is the PropertyIQ Score?",
    a: "The score has a 100% year hit rate across 13 years of backtesting: every single year, higher-scored metros outperformed lower-scored metros on average. Top-quintile markets (Score 80+) beat the state 56% of the time, while bottom-quintile markets (Score 20) beat the state only 39% of the time. The gap between top and bottom quintile translates to roughly $18,100 in equity difference on a typical home over 3 years.",
  },
  {
    q: "Why only 3 metrics?",
    a: "We tested 40+ features across multiple data sources. These 3 Redfin metrics are the most predictive of future returns in rigorous out-of-sample testing. More metrics didn't improve performance — they added noise. Simpler models generalize better, and these three capture the core demand-supply dynamics that drive home price appreciation.",
  },
  {
    q: "Can I trust scores for smaller markets?",
    a: "Each score comes with a confidence rating (A through F) that indicates data quality and coverage. Markets with A or B confidence have robust data across all three input metrics. Markets with C or F confidence have data gaps, and their scores should be used directionally rather than as precise predictions. We always recommend supplementing score data with local market knowledge.",
  },
  {
    q: "How many markets does PropertyIQ cover?",
    a: "PropertyIQ scores 746 metropolitan statistical areas (MSAs), covering the vast majority of the U.S. housing market. Coverage is focused at the metro level where data density supports reliable scoring. The validation dataset spans 13 years of historical data.",
  },
];

/** FAQ JSON-LD structured data for scores page. */
export function ScoresFaqJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ITEMS.map((faq) => ({
            "@type": "Question",
            name: faq.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.a,
            },
          })),
        }),
      }}
    />
  );
}

/** Expandable FAQ section for the scores page. */
export function ScoresFaqSection() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-medium text-on-surface mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          {FAQ_ITEMS.map((faq, i) => (
            <details
              key={i}
              className="group border border-outline-variant rounded-xl"
            >
              <summary className="flex items-center justify-between p-5 cursor-pointer text-on-surface font-medium">
                {faq.q}
                <svg
                  className="w-5 h-5 text-on-surface-variant group-open:rotate-180 transition-transform"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <p className="px-5 pb-5 text-on-surface-variant leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: "What is a real estate market score?",
    a: "A real estate market score is a single number that measures how strong a housing market is relative to others. The PropertyIQ Score ranks markets from 1 to 99 based on demand signals — % Sold Above List, Median Days on Market, and Months of Supply. A score of 50 equals the state average; higher scores indicate markets outperforming their peers. It helps investors and homebuyers quickly compare thousands of markets without analyzing dozens of data points manually.",
  },
  {
    q: "How can I predict housing market performance?",
    a: "The most reliable way to predict housing market performance is to track leading demand indicators rather than lagging price data. The PropertyIQ Score combines three proven predictors — how often homes sell above asking, how fast they sell, and how much inventory is available. In 13 years of backtesting across 746 metros, these three signals predicted which markets would outperform every single year. You can check any market's score for free on PropertyIQ.",
  },
  {
    q: "How often is the PropertyIQ Score updated?",
    a: "The score is recalculated monthly as new housing data arrives. The three input metrics — % Sold Above List, Median Days on Market, and Months of Supply — update monthly. Each refresh incorporates the latest available data.",
  },
  {
    q: "What data sources power the score?",
    a: "The PropertyIQ Score is built on three housing metrics: % Sold Above List, Median Days on Market, and Months of Supply. We tested 40+ features from Zillow, Census, FRED, BLS, and housing — these three are the most predictive of future home price appreciation in out-of-sample testing.",
  },
  {
    q: "How accurate is the PropertyIQ Score?",
    a: "The score has a 100% year hit rate across 13 years of backtesting: every single year, higher-scored metros outperformed lower-scored metros on average. Top-quintile markets (Score 80+) beat the state 56% of the time, while bottom-quintile markets (Score 20) beat the state only 39% of the time. At the extremes, choosing a score-100 market over a score-10 market translates to roughly $24,384 in extra equity on a typical home over 3 years.",
  },
  {
    q: "Why only 3 metrics?",
    a: "We tested 40+ features across multiple data sources. These 3 housing metrics are the most predictive of future returns in rigorous out-of-sample testing. More metrics didn't improve performance — they added noise. Simpler models generalize better, and these three capture the core demand-supply dynamics that drive home price appreciation.",
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

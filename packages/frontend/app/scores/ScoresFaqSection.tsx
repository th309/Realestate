const FAQ_ITEMS = [
  {
    q: "How often are PropertyIQ Scores updated?",
    a: "Scores are recalculated monthly as new data arrives from our 7 data sources. Housing metrics from Zillow and Realtor.com update monthly, while economic indicators from FRED and BLS update on their respective schedules. Each score refresh incorporates the latest available data across all sources.",
  },
  {
    q: "What data sources power the scores?",
    a: "PropertyIQ integrates data from Zillow (home values, rents, inventory), Realtor.com (listings, days on market), Redfin (sale prices, competition), U.S. Census Bureau (demographics, income), FRED (mortgage rates, GDP), BLS (unemployment), and BEA (regional economics). Over 90 individual metrics feed into the scoring models.",
  },
  {
    q: "How accurate are PropertyIQ Scores?",
    a: "Our scores achieve a 0.37 out-of-sample Information Coefficient at the metro level, validated across four non-overlapping time windows from 2018 to 2023. Top-quintile markets outperformed bottom-quintile markets by 5.55 percentage points annually. See our accuracy page for detailed validation results.",
  },
  {
    q: "What is the difference between HomeReady and InvestorEdge scores?",
    a: "HomeReady focuses on home value appreciation potential — ideal for homebuyers and homeowner-investors concerned primarily with equity growth. InvestorEdge measures total return including rental yield, appreciation, and market stability — designed for buy-and-hold rental property investors who need both cash flow and appreciation.",
  },
  {
    q: "Can I trust scores for smaller markets?",
    a: "Each score comes with a confidence rating (A through F) that indicates data quality and coverage. Markets with A or B confidence have robust data across all indicators. Markets with C or F confidence have data gaps, and their scores should be used directionally rather than as precise predictions. We always recommend supplementing score data with local market knowledge.",
  },
  {
    q: "How many markets does PropertyIQ cover?",
    a: "PropertyIQ scores 924 metropolitan statistical areas (MSAs), 3,100+ counties, and 33,000+ ZIP codes across the United States. Coverage varies by geography level — metro-level scores have the deepest data coverage, while ZIP-level scores may have lower confidence in areas with sparse data.",
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

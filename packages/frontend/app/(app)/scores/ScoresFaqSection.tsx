const FAQ_ITEMS = [
  {
    q: "What is a real estate market score?",
    a: "A real estate market score is a single number that measures how strong a housing market is relative to others. The PropertyIQ Score ranks markets from 1 to 99 based on four demand signals — how fast home values have grown over the last year, how fast they've grown over the last 3 months, how quickly homes are selling (days on market), and whether sellers are cutting their asking prices. A score of 50 equals the state average; higher scores indicate markets outperforming their peers. It helps investors and homebuyers quickly compare thousands of markets without analyzing dozens of data points manually.",
  },
  {
    q: "How can I predict housing market performance?",
    a: "The most reliable way to predict housing market performance is to track leading demand signals rather than lagging price data. The PropertyIQ Score combines four proven indicators — price growth over the past year, price growth over the last 3 months, how fast homes sell, and whether sellers are cutting prices. Across more than two decades of monthly backtesting, higher-scored markets outperformed lower-scored markets in every year tested. You can check any market's score for free on PropertyIQ.",
  },
  {
    q: "How often is the PropertyIQ Score updated?",
    a: "The score is recalculated monthly as new housing data arrives. The four input signals — price growth over the last year, price growth over the last 3 months, days on market, and the share of listings with price cuts — update monthly. Each refresh incorporates the latest available data.",
  },
  {
    q: "What data sources power the score?",
    a: "The PropertyIQ Score is built on four housing signals: price growth over the last year and the last 3 months (from Zillow's home value index), plus how fast homes sell (days on market) and the share of sellers cutting prices (both from Realtor.com listing data). We tested 40+ features across Zillow, Realtor.com, Census, FRED, and BLS — these four are the most predictive of future home price appreciation in out-of-sample testing.",
  },
  {
    q: "How accurate is the PropertyIQ Score?",
    a: "Across more than two decades of monthly backtesting, higher-scored markets outperformed lower-scored markets in essentially every year, at metro, county, and ZIP level. Comparing equally-priced homes in the same state, a top-band market has historically added roughly $18,400 more equity than a bottom-band market over 3 years at metro level, and around $24,000 at ZIP level — where investors actually pick neighborhoods. These are historical averages across thousands of markets, not guarantees about any single property.",
  },
  {
    q: "Why only 4 signals?",
    a: "We tested 40+ features across multiple data sources. These four housing signals are the most predictive of future returns in rigorous out-of-sample testing. They carry equal weight and no fitted parameters, so there is almost nothing to overfit. More metrics didn't improve performance — they added noise. Simpler models generalize better, and these four capture the price-momentum and demand dynamics that drive home price appreciation.",
  },
  {
    q: "Can I trust scores for smaller markets?",
    a: "Each score comes with a confidence rating (A through F) that reflects how many of the four input signals are available for that market and how fresh the data is. Markets with A or B confidence have all four inputs covered; markets with C or F confidence are missing some inputs (for example, scored on price momentum alone), and their scores should be used directionally rather than as precise predictions. We always recommend supplementing score data with local market knowledge.",
  },
  {
    q: "How many markets does PropertyIQ cover?",
    a: "PropertyIQ scores housing markets at three levels — roughly 865 metro areas, 3,073 counties, and over 26,000 ZIP codes in the validation window — covering the vast majority of the U.S. housing market. The validation dataset spans more than two decades of monthly history.",
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

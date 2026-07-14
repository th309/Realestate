import type { Faq } from "@/lib/seo/faq-json-ld";

export interface BuildStateFaqsInput {
  stateName: string;
  metroCount: number;
  countyCount: number;
  topMetroName: string | null;
}

/**
 * Builds the FAQ set for a state market directory page
 * (/markets/state/[state]). Distinct in scope from the top-level /markets
 * directory FAQ: every question here is scoped to this one state's own
 * tracked markets, its own PropertyIQ Score calibration, and its own
 * top-ranked metro, not sitewide totals.
 *
 * Always returns 4 unconditional questions (state name, counts, and data
 * sourcing don't depend on live ranking data); a 5th top-metro question is
 * appended only when this state has at least one ranked metro from
 * fetchRankings.
 */
export function buildStateFaqs({
  stateName,
  metroCount,
  countyCount,
  topMetroName,
}: BuildStateFaqsInput): Faq[] {
  const faqs: Faq[] = [
    {
      question: `How many housing markets does PropertyIQ track in ${stateName}?`,
      answer: `PropertyIQ currently tracks ${metroCount} metro area${metroCount === 1 ? "" : "s"} and ${countyCount} count${countyCount === 1 ? "y" : "ies"} in ${stateName}, each with its own PropertyIQ Score, home value trend, and days on market reading, refreshed monthly.`,
    },
    {
      question: `What does a PropertyIQ Score of 50 mean for a ${stateName} market?`,
      answer: `A score of 50 marks ${stateName}'s own state average demand momentum. PropertyIQ computes scores nationally across every US market, then calibrates the scale so a ${stateName} market is read against ${stateName}'s own typical momentum rather than the national average. A market scoring above 50 is positioned to outperform the ${stateName} average over the next three years, while one below 50 is positioned to lag it.`,
    },
    {
      question: `Where can I find ZIP code level housing data for ${stateName}?`,
      answer: `Every metro area and county listed on this page links through to its own ZIP codes, and each ZIP has its own market page with home value, rent, and days on market data. Start from a ${stateName} metro or county below, then drill into ZIP codes for the most localized data available.`,
    },
    {
      question: `What data sources does PropertyIQ use for ${stateName} market data, and how often is it updated?`,
      answer: `PropertyIQ ingests fresh data every month from Zillow home values, Realtor.com days on market and price cut activity, Redfin, the US Census Bureau, FRED, the Bureau of Labor Statistics, and the Bureau of Economic Analysis. Every metro, county, and ZIP page for ${stateName} shows a last updated date, and PropertyIQ Scores are recomputed monthly once that new source data lands.`,
    },
  ];

  if (topMetroName) {
    faqs.push({
      question: `Which ${stateName} metro area has the strongest housing demand right now?`,
      answer: `As of the latest monthly refresh, ${topMetroName} has the highest PropertyIQ Score among ${stateName} metro areas, indicating the strongest demand momentum in the state relative to its own history. Rankings shift month to month as new home value, days on market, and price cut data arrives, so check back after each monthly update.`,
    });
  }

  return faqs;
}

// packages/frontend/app/(app)/about/about-faqs.ts
//
// Page-specific FAQ content for /about. Every answer is grounded in the
// mission, team, timeline, and data-source copy already written in
// about/page.tsx, plus the shared coverage constants in validation-claims.ts.
import type { Faq } from "@/lib/seo/faq-json-ld";
import { COVERAGE_COPY, V4_CLAIMS } from "@/lib/data/validation-claims";

export const ABOUT_FAQS: Faq[] = [
  {
    question: "Where does PropertyIQ get its housing and economic data from?",
    answer:
      "PropertyIQ aggregates data from trusted public and private sources: Realtor.com and Zillow for listing and home-value data, the U.S. Census Bureau for demographics, and the Bureau of Labor Statistics, Bureau of Economic Analysis, and Federal Reserve (FRED) for economic indicators. Metrics are updated monthly, and the full list of sources is published on the data sources page.",
  },
  {
    question: "Is PropertyIQ affiliated with Zillow, Realtor.com, or Redfin?",
    answer:
      "No. PropertyIQ is an independent analytics platform that aggregates publicly available real estate and government data; it is not owned by or affiliated with Zillow, Realtor.com, Redfin, or any other company.",
  },
  {
    question: "When was PropertyIQ founded and who built it?",
    answer:
      "PropertyIQ was founded in 2024 by Troy H, MBA, and is built and maintained by its founder. He started it after seeing how scattered and contradictory real estate data made it hard to see the full market picture without hours of manual research. PropertyIQ is independent: it is not owned by a listing portal, brokerage, or lender, so no one can pay to have a market scored higher. The first scoring formula was built and validated in early 2025, and the platform reached public beta in 2026.",
  },
  {
    question: "What is the PropertyIQ Score and how was it validated?",
    answer: `The PropertyIQ Score is a single 1 to 99 market score that predicts how a market will perform versus its state over the next 3 years. A score of 50 means the market is tracking its state average. It was validated out of sample against more than two decades of historical price data, reaching a ${V4_CLAIMS.ic3Y} information coefficient at the metro level over a 3-year horizon and staying positive in every validated year. PropertyIQ publishes these accuracy metrics openly, a level of transparency the company says most competitors do not offer.`,
  },
  {
    question: "How has PropertyIQ's market coverage grown over time?",
    answer: `PropertyIQ now covers ${COVERAGE_COPY.metros} US metros, ${COVERAGE_COPY.counties} counties, and ${COVERAGE_COPY.zips} ZIP codes, spanning everything from major cities to small towns. That coverage reached its current scale in late 2025, building on the scoring formula validated earlier that year. Every metric behind these markets is updated monthly so scores and data stay current.`,
  },
  {
    question:
      "What makes PropertyIQ different from other real estate data platforms?",
    answer:
      "Most real estate platforms show what already happened; PropertyIQ is built to predict what will happen next, using a transparent scoring formula tested against actual market outcomes. The platform combines interactive maps down to the ZIP code level, market analytics for tracking trends, and a drag-and-drop report builder in one place. It also publishes its full methodology and data sources so users can see exactly how scores are calculated and verified.",
  },
];

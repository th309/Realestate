// packages/frontend/app/components/home/homeFaqs.ts
//
// Page-specific FAQ content for the homepage. Every answer is grounded in
// the shared coverage constants in validation-claims.ts, the score momentum
// labels in score-labels.ts, and the actual persona/integration copy already
// written in UseCasesSection.tsx and AIIntegrationsSection.tsx.
import type { Faq } from "@/lib/seo/faq-json-ld";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";

export const HOME_FAQS: Faq[] = [
  {
    question: "What is PropertyIQ and how does it help me pick a market?",
    answer: `PropertyIQ is a real estate market intelligence platform that scores housing markets from 1 to 99 based on demand momentum, then calibrates the scale so 50 equals each market's own state average. Instead of manually comparing dozens of raw statistics, you get one number per market, backed by the four underlying signals, to quickly compare where demand is strengthening or cooling.`,
  },
  {
    question: "How many markets does PropertyIQ cover?",
    answer: `PropertyIQ scores ${COVERAGE_COPY.sentence}, with monthly refreshes as new source data arrives. Coverage is deepest at the metro level and expands over time as more counties and ZIP codes accumulate enough history to score reliably.`,
  },
  {
    question: "Who is PropertyIQ built for?",
    answer: `PropertyIQ is built for three groups working in real estate: investors comparing markets before committing capital, agents who want a market score and AI-generated narrative to bring into listing presentations, and syndicators underwriting deals with monthly-updated cap rate estimates, rent data, and market timing signals. Every group works from the same underlying PropertyIQ Score, scored down to the metro, county, and ZIP level, applied to whichever markets they are evaluating.`,
  },
  {
    question: "Does PropertyIQ work inside Claude or ChatGPT?",
    answer: `Yes. PropertyIQ connects into Claude and ChatGPT through its MCP integration, so monthly-updated PropertyIQ scores, rent trends, and market forecasts are available without leaving the AI assistant you already use. More integrations beyond Claude and ChatGPT are planned.`,
  },
  {
    question:
      "What does a high or low PropertyIQ score mean for a first-time homebuyer?",
    answer: `A PropertyIQ score describes which direction demand is moving in a market, not whether it is a good or bad place to live. A score of 60 or higher, labeled FIRMING, RISING, STRONG, or VERY STRONG, means momentum is accelerating; the 50s are STEADY and in line with the rest of the state; and anything below 40, labeled WEAK or VERY WEAK, means momentum is cooling, with the 40s (EASING) marking the pullback in between. For a first-time buyer, treat it as a timing signal to weigh alongside your own budget and lifestyle needs, not a verdict on the market's quality.`,
  },
];

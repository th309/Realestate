// packages/frontend/app/(public)/compare/compare-index-faqs.ts
//
// Page-specific FAQ content for the /compare hub (roundup of real estate
// market analysis tools). Every claim about ranking criteria or named
// competitor tools is grounded in packages/frontend/lib/data/comparisons/roundup.ts
// — ROUNDUP_CRITERIA and ROUNDUP_TOOLS. Do not invent a competitor name or
// ranking reason that isn't in that file.

import type { Faq } from "@/lib/seo/faq-json-ld";

export const COMPARE_INDEX_FAQS: Faq[] = [
  {
    question:
      "What real estate market analysis tools does PropertyIQ compare itself to?",
    answer:
      "This page ranks PropertyIQ against other real estate market analysis and investing tools using a consistent set of criteria, with a detailed side-by-side comparison page for each one covering features, pricing, and where each tool wins.",
  },
  {
    question:
      "What criteria does PropertyIQ use to rank the tools on this page?",
    answer:
      "The ranking weighs five criteria: data granularity from metro level down to ZIP code, data freshness, scoring transparency and validation, breadth of workflow from market screening through deal analysis, and price. Every tool on the page, including PropertyIQ itself, is scored against the same five criteria.",
  },
  {
    question: "Since PropertyIQ built this page, is the ranking biased?",
    answer:
      "PropertyIQ is one of the tools being ranked and is ranked first on the stated criteria, which is worth knowing going in. The page discloses PropertyIQ's real gaps directly alongside the ranking: no short term rental data, no native mobile app yet, and no community or forums, areas where tools like Reventure App and PropStream are stronger. Off market lead generation is called out as another gap PropertyIQ does not fill.",
  },
  {
    question: "How does PropertyIQ compare to Reventure App?",
    answer:
      "Reventure App is ranked second, best for macro forecasting and mobile use, with polished iOS and Android apps and a large, engaged audience. Its Forecast Score does not disclose its weights and has no public backtest, and the brand carries a persistent bearish narrative bias, which is why PropertyIQ ranks ahead on scoring transparency and validation. A detailed side-by-side comparison page covers the differences in full.",
  },
  {
    question: "Does PropertyIQ replace a deal analysis tool like DealCheck?",
    answer:
      "Not entirely. DealCheck is ranked third and is the deal math benchmark, taking a property address to a full underwrite in under a minute, but it has no market level intelligence, so it cannot tell you whether the ZIP itself is a good bet. PropertyIQ closes that gap with a validated market score plus a built in deal analyzer that carries a screened market straight into a property level analysis, which is why the two pair naturally rather than compete head on.",
  },
  {
    question: "How often is this comparison page updated?",
    answer:
      "Competitor facts on this page were confirmed as part of a June 2026 deep dive into each tool's pricing, features, and public claims. The page also displays its own last updated date, currently June 2026, in the byline just below the headline so readers can see how current the ranking is.",
  },
];

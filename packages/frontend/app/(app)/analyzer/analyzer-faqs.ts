// packages/frontend/app/(app)/analyzer/analyzer-faqs.ts
//
// Page-specific FAQ content for /analyzer. Every answer is grounded in the
// actual formulas in packages/analyzer-core/src (rental.ts, flip.ts,
// brrrr.ts) and the data-fetch wiring in
// app/(app)/analyzer/lib/use-analyzer-state.ts, not invented figures.
import type { Faq } from "@/lib/seo/faq-json-ld";

export const ANALYZER_FAQS: Faq[] = [
  {
    question: "What does the PropertyIQ Deal Analyzer calculate?",
    answer:
      "Enter any property address and the Deal Analyzer estimates cap rate, monthly cashflow, and BRRRR (buy, rehab, rent, refinance, repeat) viability from your purchase price, rent, and financing assumptions, then layers in PropertyIQ's market-level context for that property's ZIP code and metro so you can see the deal alongside local demand momentum. It runs the same core underwriting for both residential deals and 5-plus unit commercial multifamily properties, adjusting vacancy, management fees, and loan sizing (DSCR versus LTV) to match the property type you select.",
  },
  {
    question: "Can I analyze any property address, or only listed properties?",
    answer:
      "You can analyze any U.S. property address, not just active listings. Enter it directly via the address search or pass it as a URL parameter, and the analyzer pulls property and market data to run the numbers. This includes commercial multifamily properties, since selecting 5 or more units in the property type toggle switches the underwriting to a DSCR-sized loan and cap rate valuation instead of the standard residential math.",
  },
  {
    question: "How does the analyzer calculate cap rate and monthly cashflow?",
    answer:
      "Cap rate is net operating income divided by purchase price, where NOI subtracts a default 5 percent vacancy allowance plus operating expenses, property tax, insurance, HOA dues, and a default 8 percent of rent each for maintenance and property management, from gross annual rent. Monthly cashflow takes that same NOI and subtracts the estimated mortgage payment calculated from your purchase price, down payment percentage, interest rate, and loan term. Both figures recalculate instantly as you adjust price, rent, or financing assumptions in the input panel.",
  },
  {
    question:
      "What is the 70% rule and how does the Deal Analyzer apply it to a flip?",
    answer:
      "For the fix and flip strategy, the analyzer computes a maximum allowable offer using the standard 70% rule: 70 percent of the property's after-repair value (ARV) minus your rehab budget. It also shows a wholetail maximum offer using an 80 percent of ARV threshold for buyers planning to resell without a full renovation, and separately projects profit and ROI by subtracting selling costs (default 7 percent of ARV), purchase price, and rehab budget from the ARV.",
  },
  {
    question: "How does the analyzer score BRRRR viability?",
    answer:
      "BRRRR viability is scored from 0 to 10 using two weighted components: how much of your total cash invested gets recouped when refinancing at a default 75 percent loan-to-value of the after-repair value, weighted 60 percent, and your projected post-refinance monthly cashflow, which earns full credit once it reaches $250 a month, weighted 40 percent. That score maps to a rating of Poor, Weak, OK, Strong, or Excellent shown alongside the refinance cash-out amount and how much cash stays trapped in the deal.",
  },
  {
    question:
      "Where does the Deal Analyzer get its property, rent, and market data?",
    answer:
      "Property details, comparable sales, and an automated valuation come from a RentCast lookup triggered by the address search, which also prefills purchase price, estimated rent, taxes, insurance, and HOA dues. If you haven't set an after-repair value yourself, the analyzer suggests one automatically as the RentCast valuation plus 15 percent. Local market context, including the area's PropertyIQ Score and market heat, is pulled separately from PropertyIQ's own market data using the property's ZIP code.",
  },
  {
    question: "Can I save or share my analysis?",
    answer:
      "Saving an analysis and generating a shareable link or PDF report requires a Pro account; the Share and PDF buttons in the header prompt a sign-in with Pro instead of producing a link on a free account. Any notes you add are saved along with the snapshot, so a shared link or exported PDF reflects the same numbers and notes you were viewing.",
  },
];

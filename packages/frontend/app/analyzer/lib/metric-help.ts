/**
 * Per-metric help content for the ScoreBreakdownTable's ? icons.
 *
 * Keyed by the metric's wire `key` (matches MetricResult.key from
 * analyzer-core). When the user clicks the ? next to a metric label, the
 * MetricHelpButton popover renders the entry below.
 *
 * Standards/benchmarks here mirror the BALANCED preset thresholds (the
 * default rubric). Conservative/Aggressive presets use stricter or looser
 * cutoffs but the directional meaning of each grade is unchanged, so the
 * benchmark copy stays preset-agnostic.
 */

export interface MetricHelp {
  /** Display title in the popover header. */
  title: string;
  /** One-sentence plain-English definition. */
  definition: string;
  /** Optional formula in human-readable form (LaTeX-ish OK, but plain text reads better in a popover). */
  formula?: string;
  /** Why an investor cares — the actionable angle. */
  whyItMatters: string;
  /** Industry standards / what makes a good vs bad number, in 1-2 lines. */
  standards: string;
}

export const METRIC_HELP: Record<string, MetricHelp> = {
  // --- Buy & Hold ---------------------------------------------------------
  cashOnCash: {
    title: "Cash-on-Cash Return",
    definition:
      "Year-one pretax cash flow divided by the total cash you actually put into the deal.",
    formula: "(Annual NOI − Annual Debt Service) ÷ Total Cash Invested",
    whyItMatters:
      "It tells you the percentage return your DOWN PAYMENT and closing costs are earning each year, ignoring appreciation and principal paydown. The cleanest measure of 'is my cash working hard?' for a rental.",
    standards:
      "Industry benchmark: 8% is solid for a stabilized rental, 10%+ is strong, 12%+ is exceptional. Below 6% means your cash is barely outperforming a high-yield savings account once you account for the work.",
  },
  dscr: {
    title: "Debt Service Coverage Ratio (DSCR)",
    definition:
      "Net Operating Income divided by annual debt service — how many times the rental income covers the mortgage payment.",
    formula: "Annual NOI ÷ (Monthly P&I × 12)",
    whyItMatters:
      "Lenders use DSCR to underwrite investment loans — most require ≥1.20 to fund, ≥1.25 for non-recourse. Below 1.00 means rent doesn't cover debt service even before opex/vacancy.",
    standards:
      "1.40+ is comfortable cushion against rate shocks and vacancy. 1.20-1.40 is typical lender-acceptable. Below 1.15 is a stress red flag — one bad month and you're feeding the deal.",
  },
  cashFlowPerDoor: {
    title: "Cash Flow per Door",
    definition:
      "Monthly pretax cash flow divided by the number of rental units in the property.",
    formula: "(Monthly Rent − Vacancy − Opex − Debt Service) ÷ Doors",
    whyItMatters:
      "Normalizes cash flow across property sizes. A duplex netting $500/month total is meaningfully worse than a single-family doing $400/door. Also a clean management benchmark — if PM fees plus a turnover eat your CF, the deal is fragile.",
    standards:
      "Common rules of thumb: $200/door is the floor for residential SFH/duplex, $300/door is good, $400+/door is great. Lower targets are sometimes acceptable on large multifamily where economies of scale dominate.",
  },
  capRate: {
    title: "Capitalization Rate (Cap Rate)",
    definition:
      "Net Operating Income divided by purchase price — the unlevered yield on the property.",
    formula: "Annual NOI ÷ Purchase Price",
    whyItMatters:
      "Cap rate strips out financing and is THE primary metric commercial appraisers and lenders use to value income property. It's also the cleanest way to compare a rental to a competing asset like a bond or REIT.",
    standards:
      "Varies wildly by market. 5-6% is normal in coastal/appreciation markets, 7-8% in stable mid-tier metros, 9%+ typical in cash-flow Midwest/South. Compare to the local 10-year Treasury yield: cap rate at or below T10 = pure appreciation play.",
  },
  breakEvenOccupancy: {
    title: "Break-Even Occupancy",
    definition:
      "The fraction of full-rent collection you need to cover operating expenses plus debt service. Lower is better.",
    formula: "(Annual Opex + Annual Debt Service) ÷ Annual Gross Rent",
    whyItMatters:
      "Tells you how much vacancy the deal can absorb before you're writing checks to feed the mortgage. The mirror image of margin of safety: 85% break-even means 15% of rent can vanish before pain.",
    standards:
      "75% or below is a deal with real cushion. 80-85% is typical and acceptable. Above 90% means a single bad tenant or one month vacant puts the deal cash-negative — fragile.",
  },

  // --- Fix & Flip ---------------------------------------------------------
  purchase_margin: {
    title: "Purchase Margin (ARV)",
    definition:
      "How far below the 70% rule line you actually bought — the headroom between (ARV − rehab) and your purchase price.",
    formula: "(ARV − Contingency-Adjusted Rehab − Purchase Price) ÷ ARV",
    whyItMatters:
      "The classic 70% rule says purchase + rehab ≤ 70% of ARV; the 30% buffer covers closing costs, holding costs, financing, selling costs (~7% of ARV), and profit. This metric is your buffer in percentage terms. Positive = headroom, negative = you overpaid relative to a typical flip's cost stack.",
    standards:
      "33%+ margin means you bought below the textbook 70% line — strong flip. 25-33% is the 70-75% range, workable. 20-25% is 75-80% rule territory, marginal — only safe with disciplined rehab and short hold. Below 20% you're betting on ARV upside.",
  },
  net_profit_margin: {
    title: "Net Profit Margin",
    definition:
      "Net profit after all costs (purchase, rehab, closing, holding, financing, selling) divided by ARV.",
    formula: "(ARV − Total Project Costs) ÷ ARV",
    whyItMatters:
      "The single best portability metric across deals. A $50k profit on a $250k flip (20%) is fundamentally different from $50k on a $750k flip (6.7%) — the latter is barely covering risk. Margin tells you how much room for error the deal has.",
    standards:
      "20%+ is institutional-grade flip territory. 15-20% is normal for an experienced operator. 10-15% is marginal — you need the project to go nearly perfectly. Under 10% leaves no room for cost overruns or market drift.",
  },
  cash_on_cash_roi: {
    title: "Cash-on-Cash ROI (Flip)",
    definition:
      "Net profit divided by the total cash the operator put up at risk (down payment + rehab OOP + points + closing).",
    formula: "Net Profit ÷ Total Cash Invested",
    whyItMatters:
      "Tells you the absolute return on the dollars you actually risked, not the bank's money. A flip with great margin% but 100% of the deal financed via hard money gives you smaller dollar profit per dollar of YOUR cash exposure.",
    standards:
      "30%+ is a strong flip return over 4-6 months. 20-30% is typical. 15-20% is marginal — barely beats a stock portfolio when you adjust for the labor and risk. Under 15% is hard to justify vs passive alternatives.",
  },
  annualized_roi: {
    title: "Annualized ROI",
    definition:
      "Cash-on-cash ROI extrapolated to a 12-month basis based on your hold period. Captures both margin AND velocity.",
    formula: "Cash-on-Cash ROI × (12 ÷ Hold Months)",
    whyItMatters:
      "A 20% return in 4 months annualizes to 60%; the same 20% over 12 months is just 20%. Two flips with identical margin can be very different businesses — annualized ROI is the apples-to-apples comparison.",
    standards:
      "60%+ annualized is exceptional (high margin, short hold). 40-60% is strong. 25-40% is typical. Under 25% means the deal is either thin-margin or slow-turning — investigate which.",
  },
  net_profit_dollar: {
    title: "Net Profit ($)",
    definition:
      "Absolute dollar profit after every cost, including realtor commissions on the sale.",
    formula: "ARV − Total Project Costs",
    whyItMatters:
      "Percentages mislead on small deals. A 25% margin on a $80k ARV is just $20k — after taxes, holding stress, and contractor headaches, that's barely worth the operational headache. Dollars matter more than ratios at the small end.",
    standards:
      "$50k+ net is the threshold most operators want for a 4-6 month flip. $35-50k is acceptable on a faster hold. $20-35k is marginal. Below $10k almost never worth the operational risk vs alternatives.",
  },

  // --- BRRRR --------------------------------------------------------------
  cash_left_in_deal: {
    title: "Cash Left in Deal (Post-Refi)",
    definition:
      "How much of the operator's cash is STILL stuck in the property after the cash-out refinance. Lower is better.",
    formula: "Total Cash Invested − Cash Returned at Refi",
    whyItMatters:
      "The whole BRRRR thesis is 'recycle your cash into the next deal.' If $30k stays trapped here, that's $30k unavailable for the next acquisition — the strategy degrades into a slow rental. Zero cash left = infinite return = repeat with the same dollar.",
    standards:
      "$0 (full capital recovery) is the textbook BRRRR target — Grade A. Under $5k is still very strong. $15k stuck starts to feel like a slow flip. $30k+ left in deal means the BRRRR didn't really work; you have a rental with a fat down payment.",
  },
  all_in_to_arv_ratio: {
    title: "All-In to ARV Ratio",
    definition:
      "Total cost to bring the property to refi-ready (purchase + closing + rehab + carry + financing) divided by ARV. Lower is better.",
    formula: "(Purchase + Closing + Rehab + Hold Carry + Acq. Financing) ÷ ARV",
    whyItMatters:
      "This is the canonical BRRRR 75% rule — at 75% all-in, a standard 75% LTV cash-out refi pulls 100% of your cash back. Above 75%, equity stays trapped; below 75%, you might even refi out MORE than you put in.",
    standards:
      "70% is the textbook target — Grade A — and gives you a 5-point cushion against an appraisal miss. 75% is the breakeven where 75%-LTV refi recovers your basis. 80%+ means you're guaranteeing trapped capital regardless of refi terms.",
  },
  post_refi_dscr: {
    title: "Post-Refi DSCR",
    definition:
      "Debt service coverage ratio AFTER the cash-out refinance — the new, larger loan must still cover with the rental income.",
    formula: "Annual NOI ÷ (New Refi P&I × 12)",
    whyItMatters:
      "BRRRR's tension: a higher refi LTV pulls more cash back, but balloons the loan and crushes DSCR. Most cash-out refi lenders require DSCR ≥ 1.20 (often 1.25) at the new loan amount or they won't fund the refi at all. Without the refi, BRRRR doesn't BRRRR.",
    standards:
      "1.40+ gives a real cushion against rate shocks and vacancy — Grade A. 1.25 is typical lender minimum. Below 1.15 means many lenders won't refi the deal at all; check refi guidelines BEFORE you buy.",
  },
  post_refi_cash_flow_per_door: {
    title: "Post-Refi Cash Flow per Door",
    definition:
      "Monthly pretax cash flow per unit AFTER the cash-out refi loan replaces the hard-money / acquisition financing.",
    formula: "(Monthly Rent − Vacancy − Opex − New Debt Service) ÷ Doors",
    whyItMatters:
      "BRRRR's stabilized state. Pre-refi cash flow is irrelevant — you're operating on the new loan from month one of the long-term hold. If the post-refi cash flow is negative, the entire strategy fails on month-one of phase 4.",
    standards:
      "$300/door is the residential benchmark — Grade A. $200 is acceptable. $0 means the deal pays you nothing month to month — only equity build matters. Negative = the BRRRR shouldn't refi at the targeted LTV.",
  },
  time_to_refinance_months: {
    title: "Time to Refinance (Seasoning)",
    definition:
      "Months from purchase close to the day you can pull the cash-out refi.",
    formula: "Rehab Months + Seasoning Months",
    whyItMatters:
      "Each month is hard-money interest, taxes, insurance, and utilities draining cash. Most lenders require 6 months of seasoning at the new appraised value — that's a hard floor. Beyond that, every extra month is BRRRR velocity lost.",
    standards:
      "6 months is the seasoning sweet spot at most cash-out refi lenders — Grade A. 9-12 months is acceptable. 18+ months means the deal is functioning as a slow flip with a refi at the end — likely better executed as a flip outright.",
  },
};

/** Lookup helper that's null-safe for unknown keys (e.g., legacy metrics or new ones not yet documented). */
export function getMetricHelp(key: string): MetricHelp | null {
  return METRIC_HELP[key] ?? null;
}

export type SectionId =
  | 'header_verdict'
  | 'recommendation_analysis'
  | 'projection'
  | 'expense_waterfall'
  | 'sensitivity'
  | 'comps'
  | 'market_context'
  | 'after_tax';

const PROMPTS: Record<SectionId, string> = {
  header_verdict:
    'Write a 1-2 sentence buy/negotiate/pass verdict for this deal. Cite the strongest number from the data and the biggest risk to verify. Format: "[VERDICT]. [Reasoning citing specific number]. [One risk to verify before offering]."',
  recommendation_analysis:
    'Write 3 to 5 conversational sentences that explain the grade in depth, framed for the strategy named in the STRATEGY block above. Buy and hold deals stand on monthly cashflow, DSCR, and long-term wealth. Fix and flip deals stand on net profit after all costs, ARV, and holding period. BRRRR deals stand on the refinance outcome, cashflow after refi, and equity left in the property. Lead with the metrics that matter for THIS strategy, not a generic checklist. Cover three things in order. First, why this letter grade for a strategy of this type: if there is an auto-disqualification, name what it actually means in plain English for this strategy (for a fix and flip, "negative cashflow" is irrelevant; for a buy and hold, an ARV miss is irrelevant), and cite the specific number that triggered it; otherwise call out the one or two strategy-relevant metrics that dragged the GPA down with their values. Second, the single highest-impact lever the investor could pull to lift the grade, chosen from the levers listed in the STRATEGY block, with the specific whole-dollar amount or percentage from the upgrade-path data when present. Third, how the PIQ Score frames this market for this strategy, using the most stable geography that resolved in the PIQ SCORE BY GEOGRAPHY block above (lead with Metro if it resolved, otherwise County, otherwise ZIP). The score is relative to the state: 50 means the state average, 70 plus is good, 80 plus is great, 90 plus is excellent. If the ZIP score diverges from Metro or County by 15 plus points, briefly call out the micro-market gap. Do not treat the ZIP score as gospel on its own, it is noisy. Speak directly to the investor. Money: whole dollars only, no cents. Every sentence must end on a complete thought. If you cannot finish a sentence with the space remaining, stop at the previous sentence rather than leaving a fragment like "the price needs to drop to $".',
  projection:
    'Write 1 sentence interpreting the 30-year wealth projection. Mention which component (principal paydown / appreciation / cumulative cashflow) drives the most value over the horizon.',
  expense_waterfall:
    'Write 1 sentence on what is eating the most rent. If debt service exceeds 60% of gross rent, flag it explicitly.',
  sensitivity:
    "Identify the top 1-2 inputs from the tornado that the deal is most sensitive to. State what that means for the investor's risk and what to verify before offering.",
  comps:
    'Compare the deal on two dimensions: (a) price-per-sqft vs the sales comps and (b) underwritten monthly rent vs the rental comps. Cite specific comp values from each list. If the subject sits outside the comp range, say so explicitly (e.g., "below all sales comps") rather than picking a percentile label.',
  market_context:
    'In 1 to 2 sentences, judge whether this market is a tailwind or headwind for the deal. Follow the PIQ SCORE BY GEOGRAPHY block above: lead with the most stable score, cite one supporting signal (market heat, rent index, migration if present), and call out a 15-plus-point ZIP divergence if it exists.',
  after_tax:
    'Highlight the after-tax cashflow improvement from depreciation and mortgage-interest deductions, as a percentage of pre-tax cashflow.',
};

export function getSectionPrompt(sectionId: SectionId): string {
  return PROMPTS[sectionId];
}

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
    'Write 3 to 5 conversational sentences that explain the grade in depth. Cover three things in order. First, why this letter grade: if there is an auto-disqualification, name what it actually means in plain English and cite the specific number that triggered it; otherwise call out the one or two metrics that dragged the GPA down with their values. Second, the single highest-impact way the investor could lift the grade, with the specific dollar amount or percentage from the upgrade-path data when present. Third, how the PIQ Score frames this market, remembering the score is relative to the state (50 means the state average, 70 plus is good, 80 plus is great, 90 plus is excellent). Speak directly to the investor. Keep numbers exact.',
  projection:
    'Write 1 sentence interpreting the 30-year wealth projection. Mention which component (principal paydown / appreciation / cumulative cashflow) drives the most value over the horizon.',
  expense_waterfall:
    'Write 1 sentence on what is eating the most rent. If debt service exceeds 60% of gross rent, flag it explicitly.',
  sensitivity:
    "Identify the top 1-2 inputs from the tornado that the deal is most sensitive to. State what that means for the investor's risk and what to verify before offering.",
  comps:
    'Compare the deal on two dimensions: (a) price-per-sqft vs the sales comps and (b) underwritten monthly rent vs the rental comps. Cite specific comp values from each list. If the subject sits outside the comp range, say so explicitly (e.g., "below all sales comps") rather than picking a percentile label.',
  market_context:
    'In 1 sentence, interpret the PIQ Score for this geography (remember: 50 = state average, 70+ good, 80+ great, 90+ excellent — the score measures outperformance vs the state, not nationally). State whether this market is a tailwind or headwind for the deal and cite one supporting market signal (market heat, rent index, or migration if available).',
  after_tax:
    'Highlight the after-tax cashflow improvement from depreciation and mortgage-interest deductions, as a percentage of pre-tax cashflow.',
};

export function getSectionPrompt(sectionId: SectionId): string {
  return PROMPTS[sectionId];
}

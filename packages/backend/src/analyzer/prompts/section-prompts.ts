export type SectionId =
  | 'header_verdict'
  | 'projection'
  | 'expense_waterfall'
  | 'sensitivity'
  | 'comps'
  | 'market_context'
  | 'after_tax';

const PROMPTS: Record<SectionId, string> = {
  header_verdict:
    'Write a 1-2 sentence buy/negotiate/pass verdict for this deal. Cite the strongest number from the data and the biggest risk to verify. Format: "[VERDICT]. [Reasoning citing specific number]. [One risk to verify before offering]."',
  projection:
    'Write 1 sentence interpreting the 30-year wealth projection. Mention which component (principal paydown / appreciation / cumulative cashflow) drives the most value over the horizon.',
  expense_waterfall:
    'Write 1 sentence on what is eating the most rent. If debt service exceeds 60% of gross rent, flag it explicitly.',
  sensitivity:
    "Identify the top 1-2 inputs from the tornado that the deal is most sensitive to. State what that means for the investor's risk and what to verify before offering.",
  comps:
    "Compare the deal's price-per-square-foot to the comp distribution. If the deal is above the 75th percentile of comps, flag the negotiation opportunity. If below the 25th, note the implied upside.",
  market_context:
    'Write 1 sentence on whether this market is a tailwind or headwind for this deal. Cite the PIQ Score and net migration explicitly.',
  after_tax:
    'Highlight the after-tax cashflow improvement from depreciation and mortgage-interest deductions, as a percentage of pre-tax cashflow.',
};

export function getSectionPrompt(sectionId: SectionId): string {
  return PROMPTS[sectionId];
}

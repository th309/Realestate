export type SectionId =
  | 'header_verdict'
  | 'recommendation_analysis'
  | 'projection'
  | 'expense_waterfall'
  | 'sensitivity'
  | 'comps'
  | 'market_context'
  | 'after_tax';

/** Section IDs handled by the batched annotator. `header_verdict` is excluded
 *  because it streams via SSE on its own endpoint, and `market_context` is
 *  excluded because it runs per-geography from inside MarketContextSection. */
export type BatchedSectionId = Exclude<
  SectionId,
  'header_verdict' | 'market_context'
>;

export const BATCHED_SECTION_IDS: readonly BatchedSectionId[] = [
  'recommendation_analysis',
  'projection',
  'expense_waterfall',
  'sensitivity',
  'comps',
  'after_tax',
] as const;

const PROMPTS: Record<SectionId, string> = {
  header_verdict:
    'Write a 1-2 sentence buy/negotiate/pass verdict for this deal. Cite the strongest number from the data and the biggest risk to verify. Format: "[VERDICT]. [Reasoning citing specific number]. [One risk to verify before offering]."',
  recommendation_analysis:
    'Write 3 to 5 conversational sentences that explain the grade in depth, framed for the strategy named in the STRATEGY block above. Buy and hold deals stand on monthly cashflow, DSCR, and long-term wealth. Fix and flip deals stand on net profit after all costs, ARV, and holding period. BRRRR deals stand on the refinance outcome, cashflow after refi, and equity left in the property. Lead with the metrics that matter for THIS strategy, not a generic checklist. Cover three things in order. First, why this letter grade for a strategy of this type: if there is an auto-disqualification, name what it actually means in plain English for this strategy (for a fix and flip, "negative cashflow" is irrelevant; for a buy and hold, an ARV miss is irrelevant), and cite the specific number that triggered it; otherwise call out the one or two strategy-relevant metrics that dragged the GPA down with their values. Second, the single highest-impact lever the investor could pull to lift the grade, chosen from the levers listed in the STRATEGY block, with the specific whole-dollar amount or percentage from the upgrade-path data when present. Third, how the PIQ Score frames this market for this strategy, using the most stable geography listed in the PIQ SCORE BY GEOGRAPHY block above (lead with Metro if listed, otherwise County, otherwise ZIP). CRITICAL: if the PIQ SCORE BY GEOGRAPHY block above contains any level (Metro, County, or ZIP), the geography HAS resolved and you MUST use those scores. Never write "the market context is unknown" or "did not resolve to any geography" or "no Metro, County, or ZIP score" when the block lists scores. The MARKET CONTEXT block\'s "Geography resolved to: unknown" line refers to a different (per-geo lookup) signal and is irrelevant to the PIQ score reading — treat the PIQ SCORE BY GEOGRAPHY block as authoritative for which geographies have data. The score is relative to the state: 50 means the state average, 70 plus is good, 80 plus is great, 90 plus is excellent. Above 50 signals a HIGHER chance of out-performing the state benchmark over the next 1-3 years; below 50 signals a HIGHER chance of under-performing. NEVER cite a specific percentage of over-performance or under-performance — phrases like "outperforms the state by X%", "X percent excess return", or "X percent above state average" are forbidden. The PIQ Score is a probability signal, not a return forecast. Phrase it as a higher or lower chance of out-performing or under-performing the state average. If the ZIP score diverges from Metro or County by 15 plus points, briefly call out the micro-market gap. Do not treat the ZIP score as gospel on its own, it is noisy. Speak directly to the investor. Money: whole dollars only, no cents. Every sentence must end on a complete thought. If you cannot finish a sentence with the space remaining, stop at the previous sentence rather than leaving a fragment like "the price needs to drop to $".' +
    ' If a USER GOAL block is provided (one of: cash flow, long-term wealth, fast cash, recycle capital), explicitly tie the recommendation to that goal. Name the goal in plain English in the first sentence and judge the deal against that goal\'s primary metric: cash flow → monthly cashflow and cash-on-cash return; long-term wealth → 30-year wealth projection and equity buildup; fast cash → net profit and time-to-cash; recycle capital → cash left in the deal after refinance and how quickly the original down payment comes back. The lever you recommend should be the one that most moves the needle for THIS goal, not a generic grade-lift. If the deal\'s grade is decent but it does not actually serve the stated goal (e.g., a B-grade buy-and-hold that produces $80/month of cashflow when the goal is "maximize cash flow"), say so directly and recommend a different deal shape or a different strategy.',
  projection:
    'Write 2 sentences interpreting the 30-year wealth projection using the 30-YEAR WEALTH PROJECTION block above. Cite the actual final equity figure and identify which of the three components (principal paydown, appreciation, cumulative cash flow) contributes the most dollars over the horizon, citing the component figures. Then give a one-clause assessment of the long-term wealth-building outlook. Whole dollars only, no cents. If the projection block is absent, say the projection is unavailable rather than inventing numbers.',
  expense_waterfall:
    'Write 1 sentence on what is eating the most rent. If debt service exceeds 60% of gross rent, flag it explicitly.',
  sensitivity:
    "Identify the top 1-2 inputs from the tornado that the deal is most sensitive to. State what that means for the investor's risk and what to verify before offering.",
  comps:
    'Compare the deal on two dimensions: (a) price-per-sqft vs the sales comps and (b) underwritten monthly rent vs the rental comps. Cite specific comp values from each list. If the subject sits outside the comp range, say so explicitly (e.g., "below all sales comps") rather than picking a percentile label.',
  market_context:
    'In 1 to 2 sentences, judge whether this market is a tailwind or headwind for the deal. Follow the PIQ SCORE BY GEOGRAPHY block above: lead with the most stable score, cite one supporting signal (market heat, rent index, migration if present), and call out a 15-plus-point ZIP divergence if it exists. Frame the PIQ Score as a higher or lower CHANCE of out-performing or under-performing the state average — never cite a specific percentage of excess return or under-performance.',
  after_tax:
    'Highlight the after-tax cashflow improvement from depreciation and mortgage-interest deductions, as a percentage of pre-tax cashflow.',
};

export function getSectionPrompt(sectionId: SectionId): string {
  return PROMPTS[sectionId];
}

/**
 * Build the SECTION TASKS block used by the batched annotator. Each section's
 * existing prompt is preserved verbatim so we do not regress narrative quality
 * (which has been bit by ad-hoc rewrites before — see PROMPT_REVISION v3
 * rollback). The model is instructed to return a JSON object keyed by section.
 */
export function buildBatchedSectionTasks(): string {
  const lines: string[] = [];
  lines.push(
    "Return ONLY a JSON object with one key per section listed below. The value at each key is the section's annotation as a single JSON string.",
    'STRICT JSON rules: (1) no prose outside the JSON; (2) no markdown code fences; (3) no extra keys; (4) every section listed below MUST appear as a key; (5) string values must be valid JSON — any literal newline inside a value MUST be encoded as \\n; (6) double-quotes inside a value MUST be escaped as \\"; (7) the output must parse with JSON.parse() on the first try.',
    '',
    'JSON shape (all keys required):',
    '{',
    BATCHED_SECTION_IDS.map((id) => `  "${id}": "<annotation>"`).join(',\n'),
    '}',
    '',
    "SECTION TASKS (follow each task's length and content brief for its own annotation):",
  );
  for (const id of BATCHED_SECTION_IDS) {
    lines.push(`[${id}]`, PROMPTS[id], '');
  }
  return lines.join('\n');
}

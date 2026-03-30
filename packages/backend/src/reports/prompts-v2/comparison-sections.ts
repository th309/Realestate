/**
 * Comparison Report V2 Sections
 *
 * 4 sections for side-by-side market comparison reports. Uses
 * comparison_markets template variable which contains metrics and
 * scores for each comparison geography.
 */

import type { NarrativePromptConfig } from '../narrative-prompt-shared';

export const COMPARISON_V2_SECTIONS: Record<string, NarrativePromptConfig> = {
  executive_verdict: {
    prompt_template: `You are writing the opening verdict for a market comparison report.

Primary market: {{geography_name}} ({{geography_type}})
User type: {{user_type}}

## Primary Market Scores
- PropertyIQ Score: {{propertyiq_score}}/100 ({{propertyiq_grade}})
- Market phase: {{market_phase}}

## Comparison Markets
{{#each comparison_markets}}
- {{name}}: Score {{scores.overall}}/100 | ZHVI {{metrics.zhvi}} | YoY {{metrics.zhvi_yoy}}%
{{/each}}

{{#if winner_name}}
## Priority-Weighted Winner: {{winner_name}}
Reasons: {{#each winner_reasons}}- {{this}}{{/each}}
{{/if}}

## Reader Priorities
{{priorities_formatted}}

Write 2-4 sentences declaring which market wins and why. This must be a VERDICT, not a summary of scores. If the winner is close, say so — but still pick one.

Frame the verdict through the reader's priorities. If they care about affordability, lead with the price/income comparison. If they care about growth, lead with appreciation trajectories.

Rules:
- Must name a winner (or explicitly declare a tie with conditions)
- Must reference at least 2 specific comparative data points
- Must connect to reader's stated priorities
- No generic "both markets have strengths" hedging`,
    max_tokens: 400,
    output_format: 'text',
  },

  head_to_head: {
    prompt_template: `You are writing the detailed head-to-head comparison for a market comparison report.

{{#if outline}}
## Report Outline (maintain coherence with other sections)
{{outline}}
{{/if}}

Primary market: {{geography_name}}
User type: {{user_type}}

## Primary Market Data
- ZHVI: {{zhvi}} | YoY: {{zhvi_yoy}}% | 3Y CAGR: {{zhvi_3y_cagr}}%
- ZORI: {{zori}} | YoY: {{zori_yoy}}%
- Days on market: {{days_on_market}} | Months of supply: {{months_of_supply}}
- Price cuts: {{price_cut_pct}}% | Sale-to-list: {{sale_to_list_ratio}}%
- Median income: {{median_household_income}} | Unemployment: {{unemployment_rate}}%
- Population growth: {{population_growth_yoy}}% | Net migration: {{net_migration}}
- Market phase: {{market_phase}}
- Monthly payment: {{monthly_payment_estimate}}
- DTI: {{dti_at_median_income}}
{{#if net_yield_estimate}}- Net yield: {{net_yield_estimate}}{{/if}}
{{#if cash_on_cash_estimate}}- Cash-on-cash: {{cash_on_cash_estimate}}{{/if}}

## Primary Market Scores
- PropertyIQ Score: {{propertyiq_score}}/100 ({{propertyiq_grade}})

## Comparison Markets
{{#each comparison_markets}}
### {{name}}
- Scores: {{scores}}
- Metrics: {{metrics}}
{{/each}}

## Reader Priorities
{{priorities_formatted}}

{{#if news_context}}
## Market Intelligence
{{news_context}}
{{/if}}

Write 6-8 paragraphs comparing the markets across these dimensions:

1. **Affordability & Value** — Price levels, income ratios, monthly payment reality. Which market gives more house per dollar? Where does income stretch further?

2. **Market Dynamics** — Speed, competition, negotiation leverage. Where can buyers/investors get better deals right now?

3. **Economic Foundation** — Job growth, population trends, economic diversification. Which market has stronger fundamentals supporting long-term value?

4. **Risk Profile** — Volatility, concentration risk, historical drawdowns. Which market lets you sleep better at night?

5. **Investment Returns** — Yield comparison, cash flow potential, total return trajectory. Which market is the better capital deployment?

CRITICAL: Do NOT write 5 separate mini-reports. COMPARE the markets directly in every paragraph. Use phrases like "while {{geography_name}} offers X, [comparison market] counters with Y." The reader should understand the trade-offs, not just the individual profiles.

Weight the analysis toward the reader's stated priorities. If they prioritize growth, spend more time on appreciation trajectories than current affordability.

Rules:
- Every paragraph must directly compare at least 2 markets
- Use specific numbers from each market — never "Market A is more affordable"
- Acknowledge trade-offs — no market wins on every dimension
- If news is relevant to the comparison, use it as a differentiator`,
    max_tokens: 4000,
    output_format: 'text',
  },

  scenario_analysis: {
    prompt_template: `You are writing forward-looking scenarios for each market in a comparison report.

{{#if outline}}
## Report Outline
{{outline}}
{{/if}}

Primary market: {{geography_name}}
- ZHVI YoY: {{zhvi_yoy}}% | Forecast: {{zhvf_1yr_pct}}%
- Appreciation trajectory: {{appreciation_trajectory}}
- Market phase: {{market_phase}}
- Downside scenario: {{downside_scenario}}

## Comparison Markets
{{#each comparison_markets}}
### {{name}}
- Metrics: {{metrics}}
- Scores: {{scores}}
{{/each}}

For each market (primary + comparisons), write 1-2 paragraphs covering:

1. **Base Case (60% probability)** — Most likely path over 12 months given current trends
2. **Bull Case (20%)** — What goes right and the upside scenario
3. **Bear Case (20%)** — What goes wrong and the downside scenario

Then write a final paragraph: "If I had to deploy capital in exactly one of these markets today, it would be [X] because [specific reason tied to scenarios]."

Rules:
- Each scenario must reference specific current metrics as the starting point
- Quantify outcomes where possible (price change %, rent growth %, yield impact)
- Scenarios must be differentiated — don't give every market the same bear case
- The final recommendation must be decisive`,
    max_tokens: 1500,
    output_format: 'text',
  },

  verdict_and_actions: {
    prompt_template: `You are writing the final verdict for a market comparison report.

{{#if outline}}
## Report Outline (conclude consistently)
{{outline}}
{{/if}}

{{#if winner_name}}Priority-weighted winner: {{winner_name}}{{/if}}
Reader priorities: {{priorities_formatted}}
User type: {{user_type}}

## Markets Compared
- {{geography_name}}: Score {{overall_score}}/100, Phase {{market_phase}}
{{#each comparison_markets}}
- {{name}}: Score {{scores.overall}}/100
{{/each}}

Write in TWO parts:

**PART 1: Final Verdict (2-3 paragraphs)**
Declare the winner with conviction. Explain the decision through the lens of the reader's priorities. Address the runner-up — what would need to change for it to win instead?

If markets are genuinely close (within 5 points), explain which TYPE of buyer/investor each market serves better rather than forcing a winner.

**PART 2: Market-Specific Actions (as JSON)**
After the verdict, output:

ACTION_ITEMS_JSON:
[
  {"market": "market name", "action": "specific action", "detail": "why and how", "urgency": "now|soon|watch"},
  {"market": "market name", "action": "specific action", "detail": "why and how", "urgency": "now|soon|watch"}
]

Include at least one action per market compared (2-4 total). Actions should reflect the verdict — the winner gets "now" urgency actions, others get "watch" or conditional actions.

Rules:
- Must declare a winner or explicitly explain why it's a tie
- Actions must be market-specific, not generic
- Reference at least 3 comparative data points in the verdict`,
    max_tokens: 2000,
    output_format: 'text',
  },
};

/** Ordered section IDs for comparison v2 reports. */
export const COMPARISON_V2_SECTION_ORDER = [
  'executive_verdict',
  'head_to_head',
  'scenario_analysis',
  'verdict_and_actions',
] as const;

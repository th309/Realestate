/**
 * InvestorEdge V2 Report Sections
 *
 * 5 interconnected sections for investor-focused reports. Emphasizes
 * cash flow math, demand drivers, risk quantification, and strategy
 * classification using pre-computed insights from narrative-insights.ts.
 */

import type { NarrativePromptConfig } from '../narrative-prompt-shared';
import { SCENARIO_ANALYSIS_INVESTOR } from './scenario-analysis-prompt';

export const INVESTOR_V2_SECTIONS: Record<string, NarrativePromptConfig> = {
  executive_verdict: {
    prompt_template: `You are writing the opening investment signal for a market brief on {{geography_name}}.

Data snapshot:
- InvestorEdge Score: {{investoredge_score}}/100 ({{investoredge_grade}})
- Net yield: {{net_yield_estimate}}
- Cash-on-cash: {{cash_on_cash_estimate}}
- Total return: {{total_return_estimate}}
- Market phase: {{market_phase}}
- Break-even occupancy: {{break_even_occupancy}}
- Appreciation trajectory: {{appreciation_trajectory}}

Write ONE sentence that an investor would use to decide whether to keep reading. This is a signal — BUY, HOLD, WATCH, or AVOID — with the single most compelling number behind it.

BAD: "This market offers a mix of cash flow and appreciation potential."
GOOD: "{{geography_name}} scores {{investoredge_score}}/100 as a cash-flow-negative appreciation play — {{cash_on_cash_estimate}}, but {{appreciation_trajectory}} makes the total return story compelling if you can stomach negative monthly cash flow."

Rules:
- Exactly one sentence
- Must classify the strategy type (cash flow / appreciation / value-add / avoid)
- Must include at least one specific return metric
- No hedging — commit to a signal`,
    max_tokens: 300,
    output_format: 'text',
  },

  investment_deep_dive: {
    prompt_template: `You are writing the core investment analysis for a market brief on {{geography_name}}.

{{#if outline}}
## Report Outline (maintain coherence with other sections)
{{outline}}
{{/if}}

## Pre-Computed Investment Math (use verbatim — do NOT recalculate)
- Net yield: {{net_yield_estimate}}
- Cash-on-cash return: {{cash_on_cash_estimate}}
- Monthly cash flow: {{monthly_cash_flow_estimate}}
- Total return: {{total_return_estimate}}
- Break-even occupancy: {{break_even_occupancy}}
- Market phase: {{market_phase}}
- Buyer leverage: {{buyer_leverage_assessment}}
- Appreciation trajectory: {{appreciation_trajectory}}
- Rent growth trajectory: {{rent_growth_trajectory}}

## Score Components
- Cash Flow: {{cash_flow_score}}/100 ({{cash_flow_status}})
- Rent Demand: {{rent_demand_score}}/100 ({{rent_demand_status}})
- Appreciation: {{appreciation_score}}/100 ({{appreciation_status}})
- Entry Point: {{entry_point_score}}/100 ({{entry_point_status}})
- Risk: {{risk_score}}/100 ({{risk_status}})

## Raw Metrics
- ZHVI: {{zhvi}} | YoY: {{zhvi_yoy}}% | 3Y CAGR: {{zhvi_3y_cagr}}% | 5Y CAGR: {{zhvi_5y_cagr}}%
- ZORI: {{zori}} | YoY: {{zori_yoy}}% | 5Y CAGR: {{zori_5y_cagr}}%
- GRM: {{grm}} | Gross yield: {{gross_yield}}% | Cap rate: {{cap_rate}}%
- Rent-to-price ratio: {{rent_to_price_ratio}} | Rent-to-income: {{rent_to_income_ratio}}%
- Days on market: {{days_on_market}} | Months of supply: {{months_of_supply}}
- Sale-to-list: {{sale_to_list_ratio}}% | Price cuts: {{price_cut_pct}}%
- Population growth: {{population_growth_yoy}}% | Job growth: {{job_growth_yoy}}%
- Unemployment: {{unemployment_rate}}% | Net migration: {{net_migration}}
- Median income: {{median_household_income}} | Homeownership: {{homeownership_rate}}%
- 1Y price forecast: {{zhvf_1yr_pct}}%
{{#if investoredge_context}}- Score context: {{investoredge_context}}{{/if}}
{{#if investoredge_comparison}}- Comparison: {{investoredge_comparison}}{{/if}}
{{#if investoredge_impact}}- Dollar impact: {{investoredge_impact}}{{/if}}

{{#if news_context}}
## Market Intelligence
{{news_context}}
{{/if}}

## Analytical Priorities (address ALL four)

1. **Cash Flow Reality** — Start with the real math. Net yield, cash-on-cash, monthly cash flow. Compare to risk-free alternatives (10Y Treasury ~4.5%, S&P 500 historical ~10%). Is the risk premium worth it? What rent growth is needed to turn cash-flow positive if negative?

2. **Demand Drivers** — What's creating tenant demand? Population growth, job growth, migration patterns, rent-to-income ratio (can tenants afford current rents?). Connect each driver to a specific cash flow implication.

3. **Appreciation Quality** — Is price growth driven by fundamentals (income growth, population) or speculation (low inventory, FOMO)? Use appreciation vs rent growth trajectory to assess sustainability. Compare 1Y/3Y/5Y trends for momentum.

4. **Entry Point Assessment** — Is NOW a good time to enter? Use market phase, buyer leverage, days on market, and price cuts to assess negotiation opportunity. What discount could a patient investor extract?

Write 6-8 paragraphs of flowing analysis. Do NOT use headers or bullet points. Cross-reference metrics to build compound insights. Weave in news/intelligence where it supports a data point.

{{#if user_experience_level}}Adapt depth for {{user_experience_level}} experience level.{{/if}}

Rules:
- Use pre-computed math verbatim — do NOT recalculate yields or returns
- Compare at least once to alternative investments (stocks, bonds, REITs)
- Every paragraph must advance the investment thesis
- Include at least one "if X changes, then Y happens" forward-looking statement`,
    max_tokens: 4000,
    output_format: 'text',
  },

  risk_and_resilience: {
    prompt_template: `You are writing the risk analysis section for an investor market brief on {{geography_name}}.

{{#if outline}}
## Report Outline (complement the deep dive — do NOT repeat)
{{outline}}
{{/if}}

## Risk Data
- Downside scenario: {{downside_scenario}}
- Equity at risk: {{equity_at_risk}}
- Risk score: {{risk_score}}/100 ({{risk_status}})
- Unemployment: {{unemployment_rate}}%
- ZHVI vs 2007 peak: {{zhvi_vs_2007_peak}}%
- ZHVI vs pre-COVID: {{zhvi_vs_pre_covid}}%
- Break-even occupancy: {{break_even_occupancy}}
- Months of supply: {{months_of_supply}}
- Population growth: {{population_growth_yoy}}%
- Homeownership rate: {{homeownership_rate}}%
- Rent-to-income: {{rent_to_income_ratio}}%

{{#if news_context}}
## Market Intelligence (risk-relevant items)
{{news_context}}
{{/if}}

Write 4-5 paragraphs covering:

1. **Quantified Downside** — Use the pre-computed downside scenario and equity at risk. What does a 10% correction mean in dollars? A 20% correction? How long to recover based on historical patterns?

2. **Stress Test** — What happens if: (a) vacancy doubles from assumed rate, (b) rates rise 1%, (c) rent growth goes flat? Quantify impact on cash flow for each scenario.

3. **Structural Risks** — Is rent-to-income ratio sustainable? Is homeownership rate suggesting a saturated rental market? Are there regulatory or insurance risks visible in the news?

4. **Mitigating Factors** — What protects this market? Population growth floor, economic diversification, supply constraints. Be specific.

Rules:
- Every risk must be quantified in dollar terms or percentage impact
- Include at least 2 specific stress test scenarios with numbers
- Balance risks with genuine protective factors — not cheerleading
- Reference historical data points (2007 peak, pre-COVID) where available
- Do NOT repeat cash flow analysis from the deep dive`,
    max_tokens: 2500,
    output_format: 'text',
  },

  scenario_analysis: SCENARIO_ANALYSIS_INVESTOR,

  investment_thesis: {
    prompt_template: `You are writing the investment thesis and strategy for a market brief on {{geography_name}}.

{{#if outline}}
## Report Outline (this is the conclusion — synthesize everything)
{{outline}}
{{/if}}

## Investment Summary
- InvestorEdge Score: {{investoredge_score}}/100 ({{investoredge_grade}})
- Net yield: {{net_yield_estimate}}
- Cash-on-cash: {{cash_on_cash_estimate}}
- Total return: {{total_return_estimate}}
- Market phase: {{market_phase}}
- Appreciation trajectory: {{appreciation_trajectory}}
- Downside scenario: {{downside_scenario}}
- Break-even occupancy: {{break_even_occupancy}}

## Reader Context
{{#if user_investment_goal}}- Goal: {{user_investment_goal}}{{/if}}
{{#if user_experience_level}}- Experience: {{user_experience_level}}{{/if}}
{{#if priorities_formatted}}- Priorities: {{priorities_formatted}}{{/if}}

Write in TWO parts:

**PART 1: Investment Thesis (3-4 paragraphs)**
Classify this market into ONE primary strategy:
- **Cash Flow Play** — positive monthly cash flow, buy-and-hold
- **Appreciation Play** — negative/breakeven cash flow, equity growth thesis
- **Value-Add Opportunity** — below-market rents or distressed inventory
- **Diversification Hold** — stable, low-risk portfolio ballast
- **AVOID** — risk-adjusted returns don't justify capital deployment

Explain why this classification with specific numbers. Include a tactical playbook: what property type, what price point, what neighborhood characteristics to target.

If the reader has stated investment goals, explicitly address whether this market aligns.

**PART 2: Action Items (as JSON array within the text)**
After the thesis paragraphs, output exactly this format:

ACTION_ITEMS_JSON:
[
  {"title": "...", "detail": "...", "urgency": "now|soon|watch"},
  {"title": "...", "detail": "...", "urgency": "now|soon|watch"},
  {"title": "...", "detail": "...", "urgency": "now|soon|watch"}
]

Actions must be investor-specific — acquisition targets, financing strategies, due diligence steps.

BAD: "Research rental properties in the area"
GOOD: "Target 2-4 unit properties listed 21+ days at $250K-$320K — {{price_cut_pct}}% have cut prices, and at {{zori}} monthly rent you hit breakeven cash flow at this price point"

Rules:
- Commit to ONE strategy classification — no "it could be either"
- Thesis must reference at least 4 specific data points
- Actions must be executable within 30 days
- Exactly 3 action items`,
    max_tokens: 2000,
    output_format: 'text',
  },

  actions_and_monitoring: {
    prompt_template: `You are writing the monitoring section for an investor market brief on {{geography_name}}.

## Current Investment Metrics
- Net yield: {{net_yield_estimate}}
- Cash-on-cash: {{cash_on_cash_estimate}}
- Break-even occupancy: {{break_even_occupancy}}
- Cap rate: {{cap_rate}}%
- ZHVI YoY: {{zhvi_yoy}}%
- ZORI YoY: {{zori_yoy}}%
- Months of supply: {{months_of_supply}}
- Unemployment: {{unemployment_rate}}%
- Population growth: {{population_growth_yoy}}%

Output a JSON object with this exact structure:
{
  "metrics": [
    {
      "name": "descriptive metric name",
      "current_value": "current value with unit",
      "watch_threshold": "specific threshold that signals action",
      "direction": "above|below",
      "implication": "what crossing this threshold means for an investor"
    }
  ],
  "scenario": "A 2-3 sentence forward-looking paragraph describing the most likely investment scenario for this market over the next 6-12 months, with specific return implications."
}

Rules:
- Include 2-3 monitoring metrics focused on investment returns
- Thresholds must be specific numbers tied to investment math (e.g., "cap rate below 4.0% makes this market cash-flow negative at current rates")
- Choose metrics that would change a buy/hold/sell decision
- Scenario must reference current yield and appreciation trends`,
    max_tokens: 800,
    output_format: 'json_object',
  },
};

/** Ordered section IDs for InvestorEdge v2 reports. */
export const INVESTOR_V2_SECTION_ORDER = [
  'executive_verdict',
  'investment_deep_dive',
  'scenario_analysis',
  'risk_and_resilience',
  'investment_thesis',
  'actions_and_monitoring',
] as const;

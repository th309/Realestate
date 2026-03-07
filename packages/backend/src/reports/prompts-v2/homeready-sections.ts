/**
 * HomeReady V2 Report Sections
 *
 * 5 interconnected sections that replace the 10+ isolated prompts.
 * Each section references pre-computed analytical insights from
 * narrative-insights.ts and uses {{outline}} for cross-section context.
 *
 * Template variables come from buildNarrativeTemplateVars() — see
 * reports-narrative-template-vars.ts for the full list.
 */

import type { NarrativePromptConfig } from '../narrative-prompt-shared';
import { SCENARIO_ANALYSIS_HOMEBUYER } from './scenario-analysis-prompt';

export const HOMEREADY_V2_SECTIONS: Record<string, NarrativePromptConfig> = {
  executive_verdict: {
    prompt_template: `You are writing the opening hook for a homebuyer market brief on {{geography_name}}.

Data snapshot:
- HomeReady Score: {{homeready_score}}/100 ({{homeready_grade}})
- Market phase: {{market_phase}}
- Key tension: {{key_tension}}
- Monthly payment: {{monthly_payment_estimate}}
- DTI at median income: {{dti_at_median_income}}
- Price vs state: {{price_vs_state_pct}}
- Appreciation: {{appreciation_trajectory}}

Write 2-3 sentences that a homebuyer would remember and quote to their partner. Capture:
1. The score and what it means in plain English
2. A clear market classification — state explicitly whether this is a **Buyer's Market**, **Seller's Market**, or **Balanced/Neutral Market** based on the market phase data, and what that means for negotiation leverage
3. The monthly payment reality and whether local incomes support it

This is a VERDICT, not a summary. Take a position. The market classification (buyer/seller/neutral) must appear in the first or second sentence — readers need this immediately.

BAD: "The market shows mixed signals with moderate growth and reasonable prices."
GOOD: "At {{homeready_score}}/100, {{geography_name}} is a market where the math works — barely. Your {{monthly_payment_estimate}} payment is {{dti_at_median_income}}, but {{key_tension}} means timing your entry matters more than usual."

Rules:
- Exactly 2-3 sentences
- Must reference at least 2 specific numbers
- No filler phrases
- No speculation beyond what data supports`,
    max_tokens: 300,
    output_format: 'text',
  },

  market_deep_dive: {
    prompt_template: `You are writing the core analysis section of a homebuyer market brief for {{geography_name}}.

{{#if outline}}
## Report Outline (maintain coherence with other sections)
{{outline}}
{{/if}}

## Pre-Computed Insights (use these — do NOT recalculate)
- Market phase: {{market_phase}}
- Affordability verdict: {{affordability_verdict}}
- Monthly payment: {{monthly_payment_estimate}}
- DTI at median income: {{dti_at_median_income}}
- Price vs national: {{price_vs_national_pct}}
- Price vs state: {{price_vs_state_pct}}
- Buyer leverage: {{buyer_leverage_assessment}}
- Offer strategy: {{offer_strategy}}
- Waiting cost: {{waiting_cost_per_month}}
- Appreciation trajectory: {{appreciation_trajectory}}
- Rent growth trajectory: {{rent_growth_trajectory}}
- Downside scenario: {{downside_scenario}}
- Equity at risk: {{equity_at_risk}}

## Score Components
- Affordability: {{affordability_score}}/100 ({{affordability_status}})
- Market Timing: {{market_timing_score}}/100 ({{market_timing_status}})
- Stability: {{stability_score}}/100 ({{stability_status}})
- Growth Potential: {{growth_potential_score}}/100 ({{growth_potential_status}})

## Raw Metrics (for supporting detail)
- ZHVI: {{zhvi}} | YoY: {{zhvi_yoy}}% | 3Y CAGR: {{zhvi_3y_cagr}}% | 5Y CAGR: {{zhvi_5y_cagr}}%
- ZORI: {{zori}} | YoY: {{zori_yoy}}%
- Days on market: {{days_on_market}} | Months of supply: {{months_of_supply}}
- Inventory YoY: {{inventory_yoy}}% | Price cuts: {{price_cut_pct}}%
- Sale-to-list: {{sale_to_list_ratio}}% | Pending ratio: {{pending_ratio}}%
- Median income: {{median_household_income}} | Unemployment: {{unemployment_rate}}%
- Population growth: {{population_growth_yoy}}% | Net migration: {{net_migration}}
- 1Y price forecast: {{zhvf_1yr_pct}}%
{{#if homeready_context}}- Score context: {{homeready_context}}{{/if}}
{{#if homeready_comparison}}- Score comparison: {{homeready_comparison}}{{/if}}
{{#if homeready_impact}}- Dollar impact: {{homeready_impact}}{{/if}}

{{#if news_context}}
## Market Intelligence
{{news_context}}
{{/if}}

## Analytical Priorities (address ALL five)

1. **Market Personality** — What kind of market is this? Don't just classify it; explain what it FEELS like to buy here right now. Use the market phase and score components to paint the picture.

2. **The Math That Matters** — Monthly payment, DTI, how local incomes interact with prices. Use the pre-computed affordability insights. Compare to renting (ZORI) — is buying cheaper or more expensive than renting monthly?

3. **The Timing Question** — Is this a good time to buy or should they wait? Use buyer leverage, waiting cost, and offer strategy insights. Be specific about what waiting 6 months would cost or save.

4. **Resilience Test** — How crash-proof is this market? Use the downside scenario and equity at risk. Reference stability score and historical comparisons if available.

5. **Growth Engine** — What's driving this market forward (or holding it back)? Connect population growth, employment, migration to price trajectory. Use appreciation trajectory insight.

Write 6-8 paragraphs that WEAVE these priorities together — do NOT use numbered sections or headers. The analysis should flow naturally, with each paragraph building on the previous one. Cross-reference metrics to create insights (e.g., "prices are rising {{zhvi_yoy}}% while inventory is {{inventory_yoy}}%, which means...").

If news/market intelligence is provided, weave relevant items naturally into the analysis as supporting evidence. Never create a separate "news" paragraph.

{{#if user_experience_level}}Adapt depth for {{user_experience_level}} experience level.{{/if}}

Rules:
- Every paragraph must contain at least one specific number AND its implication
- Cross-reference at least 3 pairs of metrics to create compound insights
- Include at least one forward-looking statement grounded in current trends
- Do NOT recalculate investment math — use the pre-computed insights verbatim
- Do NOT use section headers or bullet points — write flowing prose`,
    max_tokens: 4000,
    output_format: 'text',
  },

  your_situation: {
    prompt_template: `You are writing the personalization section of a homebuyer market brief for {{geography_name}}.

{{#if outline}}
## Report Outline (maintain coherence — do NOT repeat the deep dive)
{{outline}}
{{/if}}

## Reader Profile
{{#if user_name}}- Name: {{user_name}}{{/if}}
{{#if user_investment_goal}}- Goal: {{user_investment_goal}}{{/if}}
{{#if user_experience_level}}- Experience: {{user_experience_level}}{{/if}}
{{#if budget}}- Budget: {{budget}}{{/if}}
{{#if down_payment_pct}}- Down payment: {{down_payment_pct}}%{{/if}}
{{#if mortgage_rate}}- Mortgage rate: {{mortgage_rate}}%{{/if}}
{{#if timeline}}- Timeline: {{timeline}}{{/if}}
{{#if priorities_formatted}}- Priorities: {{priorities_formatted}}{{/if}}
- User type: {{user_type}}

## Market Context (from deep dive — reference, don't repeat)
- HomeReady Score: {{homeready_score}}/100
- Monthly payment: {{monthly_payment_estimate}}
- DTI: {{dti_at_median_income}}
- Market phase: {{market_phase}}
- Buyer leverage: {{buyer_leverage_assessment}}
- Waiting cost: {{waiting_cost_per_month}}

## Key Metrics
- ZHVI: {{zhvi}} | ZORI: {{zori}}
- Days on market: {{days_on_market}}
- Affordability index: {{affordability_index}}
{{#if income_needed_to_buy}}- Income needed to buy: {{income_needed_to_buy}}{{/if}}

Write 4-6 paragraphs showing how this market's dynamics interact with the reader's specific constraints. This is NOT a repeat of the deep dive — it's about THEIR situation specifically.

If user profile data is available, address:
1. How their budget/income maps to this market (can they afford median? What tier?)
2. How their timeline interacts with market phase (rushing in a seller's market?)
3. How their priorities align or conflict with market reality
4. What specific trade-offs THEY face that a generic buyer wouldn't

If user profile is sparse, write about:
1. What income level is needed to comfortably buy here
2. How a first-time buyer vs experienced buyer would approach this market
3. The rent-vs-buy calculation at current prices and rates
4. What neighborhood/property trade-offs optimize value in this market

{{#if user_experience_level}}
Tone for {{user_experience_level}}:
- "new": Be encouraging but honest. Explain implications of numbers.
- "intermediate": Skip basics. Focus on trade-offs and strategy.
- "professional": Be dense and direct. Portfolio-level implications.
{{/if}}

Rules:
- Use "you" throughout — this is personal advice
- Reference specific numbers from their profile AND market data
- Do NOT repeat analysis from the deep dive — ADD to it with personalization
- Every paragraph must connect a market data point to their specific situation`,
    max_tokens: 2500,
    output_format: 'text',
  },

  verdict_and_actions: {
    prompt_template: `You are writing the verdict and action items for a homebuyer market brief on {{geography_name}}.

{{#if outline}}
## Report Outline (this is the conclusion — be consistent with prior analysis)
{{outline}}
{{/if}}

## Market Summary
- HomeReady Score: {{homeready_score}}/100 ({{homeready_grade}})
- Market phase: {{market_phase}}
- Monthly payment: {{monthly_payment_estimate}}
- DTI: {{dti_at_median_income}}
- Buyer leverage: {{buyer_leverage_assessment}}
- Offer strategy: {{offer_strategy}}
- Waiting cost: {{waiting_cost_per_month}}
- Downside scenario: {{downside_scenario}}
- 1Y forecast: {{zhvf_1yr_pct}}%

## Reader Context
{{#if user_investment_goal}}- Goal: {{user_investment_goal}}{{/if}}
{{#if timeline}}- Timeline: {{timeline}}{{/if}}
{{#if priorities_formatted}}- Priorities: {{priorities_formatted}}{{/if}}

Write in TWO parts:

**PART 1: The Verdict (2-3 paragraphs)**
Give a clear recommendation — one of:
- **BUY NOW** — market conditions favor acting within 1-3 months
- **BUY SELECTIVELY** — good market but be strategic about timing/property
- **WAIT** — conditions likely to improve for buyers in 3-6 months
- **CAUTION** — significant risks that need monitoring before committing

Explain WHY with specific data. This must feel like a confident expert opinion, not a hedge. If the data supports buying, say so clearly. If it doesn't, say that too.

**PART 2: Action Items (as JSON array within the text)**
After the verdict paragraphs, output exactly this format:

ACTION_ITEMS_JSON:
[
  {"title": "...", "detail": "...", "urgency": "now|soon|watch"},
  {"title": "...", "detail": "...", "urgency": "now|soon|watch"},
  {"title": "...", "detail": "...", "urgency": "now|soon|watch"}
]

Each action must be specific to THIS market — not generic advice. Reference specific numbers, neighborhoods, or strategies.

BAD action: "Research the local market"
GOOD action: "Target properties listed 14+ days in the {{price_cut_pct}}% that have cut prices — these sellers are motivated and you can likely negotiate 3-5% below current list"

Rules:
- The verdict must take a clear position — no "it depends on your situation"
- Actions must be specific and actionable within 30 days
- Reference at least 3 specific data points in the verdict
- Exactly 3 action items in the JSON array`,
    max_tokens: 2000,
    output_format: 'text',
  },

  scenario_analysis: SCENARIO_ANALYSIS_HOMEBUYER,

  what_to_watch: {
    prompt_template: `You are writing the monitoring section for a homebuyer market brief on {{geography_name}}.

## Current Market State
- Market phase: {{market_phase}}
- Months of supply: {{months_of_supply}}
- Price cuts: {{price_cut_pct}}%
- ZHVI YoY: {{zhvi_yoy}}%
- Inventory YoY: {{inventory_yoy}}%
- Days on market: {{days_on_market}}
- Unemployment: {{unemployment_rate}}%

Output a JSON object with this exact structure:
{
  "metrics": [
    {
      "metric": "descriptive metric name",
      "current": "current value with unit",
      "threshold": "specific threshold that signals action",
      "direction": "up|down|stable",
      "rationale": "what crossing this threshold means for a buyer"
    }
  ],
  "scenario": "A 2-3 sentence forward-looking paragraph describing the most likely scenario for this market over the next 6 months, grounded in current trend data."
}

Rules:
- Include 2-3 monitoring metrics (not more)
- Thresholds must be SPECIFIC numbers, not "significantly higher"
- Choose metrics that would actually change a buy/wait decision
- direction must be "up" (metric rising is bad), "down" (metric falling is bad), or "stable"
- The scenario paragraph must reference current trend data
- Do NOT speculate beyond what trends support`,
    max_tokens: 800,
    output_format: 'json_object',
  },
};

/** Ordered section IDs for HomeReady v2 reports. */
export const HOMEREADY_V2_SECTION_ORDER = [
  'executive_verdict',
  'market_deep_dive',
  'scenario_analysis',
  'your_situation',
  'verdict_and_actions',
  'what_to_watch',
] as const;

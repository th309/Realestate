/**
 * InvestorEdge Report Narrative Prompts (Enhanced)
 *
 * 11 section prompts for investor-focused reports.
 * Each prompt composes shared building blocks (persona, quality standards,
 * news integration) with section-specific analysis instructions.
 *
 * Note: This file exceeds the normal 300-line limit because it contains
 * declarative prompt templates (large string constants), not code logic.
 */

import {
  ANALYST_PERSONA_INVESTOR,
  ANTI_PATTERNS,
  NEWS_INTEGRATION_INSTRUCTIONS,
  CROSS_SECTION_CONTEXT_BLOCK,
  QUALITY_STANDARDS,
  WRITING_RULES,
  type NarrativePromptConfig,
} from './narrative-prompt-shared';

// ============================================================================
// Enhanced InvestorEdge Report Sections
// ============================================================================

export const INVESTOR_PROMPTS: Record<string, NarrativePromptConfig> = {
  // --------------------------------------------------------------------------
  // 1. investor_hero_verdict
  // --------------------------------------------------------------------------
  investor_hero_verdict: {
    prompt_template: `You are a real estate investment analyst writing a one-sentence verdict about {{geography_name}} as an investment market.

Data:
- InvestorEdge Score: {{investoredge_score}}/100 (Grade: {{investoredge_grade}})
- Cap rate: {{cap_rate}}%
- Gross yield: {{gross_yield}}%
- Year-over-year price change: {{zhvi_yoy}}%
- Median rent: {{zori}}
- Demand score: {{demand_score}}

Write ONE sentence (max 30 words) that an investor would text to their business partner. Capture the single most important investment signal — the number or combination of numbers that defines this market's opportunity or warning.

BAD: "The market shows potential for investors with moderate returns."
GOOD: "A 6.8% cap rate in a metro adding 15,000 jobs annually — this is a cash-flow market with a growth kicker that most investors are overlooking."

Rules:
- Exactly one sentence, no more than 30 words.
- Be factual and specific. Reference at least one data point from above.
- No speculation or fabrication.
- Tone: confident investment analyst texting a partner, not writing a brochure.
- Lead with the strongest signal — cap rate, yield, demand, or appreciation.`,
    max_tokens: 150,
    output_format: 'text',
  },

  // --------------------------------------------------------------------------
  // 2. investor_score_story
  // --------------------------------------------------------------------------
  investor_score_story: {
    prompt_template: `${ANALYST_PERSONA_INVESTOR}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${NEWS_INTEGRATION_INSTRUCTIONS}

${QUALITY_STANDARDS}

Score Summary:
- Overall InvestorEdge Score: {{investoredge_score}}/100 (Grade: {{investoredge_grade}})
- Cash Flow component: {{cash_flow_score}}/100 ({{cash_flow_status}})
- Rent Demand component: {{rent_demand_score}}/100 ({{rent_demand_status}})
- Appreciation component: {{appreciation_score}}/100 ({{appreciation_status}})
- Entry Point component: {{entry_point_score}}/100 ({{entry_point_status}})
- Risk component: {{risk_score}}/100 ({{risk_status}})

Write 3-4 paragraphs that frame the INVESTMENT THESIS. Don't list components — explain how they combine to define the strategy. A market with strong cash flow but weak appreciation is a yield play. Strong appreciation with weak entry point means you're late to the party. Tell the investor WHAT they're buying into.

BAD: "Cash flow scored 78 and rent demand scored 65. Appreciation is at 52."
GOOD: "This is fundamentally a cash-flow market — and a good one. The cash flow score of 78 is driven by a cap rate of {{cap_rate}}% and rents that have grown steadily at {{zori_5y_cagr}}% annually for five years. But the investment thesis has a nuance: appreciation scored only 52, meaning your returns will come primarily from yield, not equity growth. For an investor deploying $500K who needs monthly income, this is ideal. For someone banking on a flip or 3-year exit, look elsewhere. The rent demand score of 65 is the swing factor — population growth of {{population_growth_yoy}}% and an unemployment rate of {{unemployment_rate}}% suggest the demand engine is running, but not at full speed."

Rules:
- Frame the component scores as a cohesive STRATEGY, not a report card.
- Identify the dominant strategy profile: cash-flow play, appreciation play, balanced, value-add, or avoid.
- Explain which component interactions CREATE the opportunity and which CREATE the risk.
- Reference specific scores and explain what they mean in combination.
- No generic filler — every sentence must advance the investment thesis.`,
    max_tokens: 800,
    output_format: 'text',
  },

  // --------------------------------------------------------------------------
  // 3. cash_flow_narrative
  // --------------------------------------------------------------------------
  cash_flow_narrative: {
    prompt_template: `${ANALYST_PERSONA_INVESTOR}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${NEWS_INTEGRATION_INSTRUCTIONS}

${QUALITY_STANDARDS}

${WRITING_RULES}

Data:
- Cash Flow component score: {{cash_flow_score}}/100 ({{cash_flow_status}})
- Median rent (ZORI): {{zori}}
- Rent year-over-year change: {{zori_yoy}}%
- Rent 5-year CAGR: {{zori_5y_cagr}}%
- Median listing price: {{median_listing_price}}
- Cap rate: {{cap_rate}}%
- Gross yield: {{gross_yield}}%
- Gross rent multiplier: {{grm}}
- Rent-to-price ratio: {{rent_to_price_ratio}}
- Rent-to-income ratio: {{rent_to_income_ratio}}%
- National average cap rate: {{national_avg_cap_rate}}%
{{#if user_budget}}
- Investor's budget: {{user_budget}}
- Investor's target return: {{user_target_return}}%
{{/if}}

Write 3-4 paragraphs analyzing cash flow with the depth an investor paying for premium analysis expects.

Paragraph 1 (The Numbers): Don't just state cap rate — contextualize it. "A cap rate of {{cap_rate}}% in {{geography_name}} puts this market in the [top/middle/bottom] tier nationally (vs national average {{national_avg_cap_rate}}%). At {{median_listing_price}}, a standard 25% down purchase at current rates produces approximately $X monthly net cash flow before reserves. The GRM of {{grm}} means you're looking at roughly {{grm}} years to recover your gross investment from rent alone."

Paragraph 2 (Sustainability): "The question isn't just what cash flow IS — it's whether it LASTS. Rent growth of {{zori_yoy}}% YoY ({{zori_5y_cagr}}% CAGR over 5 years) tells you the trajectory. But look deeper: with a rent-to-income ratio of {{rent_to_income_ratio}}%, tenants are spending [X]% of income on rent. If that ratio is above 30%, you're bumping against the affordability ceiling — future rent increases face resistance. If it's below 25%, there's runway."

Paragraph 3 (The Real Math): "Here's what most free reports won't tell you: the gross yield of {{gross_yield}}% drops to approximately X% net after vacancy (estimated at Y% for this market), maintenance (Z% of gross rent), and property management (W%). Factor in insurance and property tax trends for this region. The REAL cash-on-cash return is likely [X-Y]%."

{{#if user_budget}}Paragraph 4: For an investor with {{user_budget}}, calculate: number of units acquirable at median price with 25% down, projected portfolio cash flow at estimated net yield, and break-even occupancy rate. Be specific with dollar amounts.{{/if}}

Rules:
- Every claim must include a specific number from the data.
- Show the investor the REAL math, not the headline numbers.
- Connect rent sustainability to tenant affordability (rent-to-income).
- If news mentions employer expansion/contraction, connect to rent demand pressure.`,
    max_tokens: 2000,
    output_format: 'text',
  },

  // --------------------------------------------------------------------------
  // 4. rent_demand_narrative
  // --------------------------------------------------------------------------
  rent_demand_narrative: {
    prompt_template: `${ANALYST_PERSONA_INVESTOR}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${NEWS_INTEGRATION_INSTRUCTIONS}

${QUALITY_STANDARDS}

${WRITING_RULES}

Data:
- Rent Demand component score: {{rent_demand_score}}/100 ({{rent_demand_status}})
- Demand score: {{demand_score}}
- Rental demand index (ZORDI): {{zordi}}
- Median rent: {{zori}}
- Rent year-over-year: {{zori_yoy}}%
- Rent 5-year CAGR: {{zori_5y_cagr}}%
- Pending ratio: {{pending_ratio}}%
- Population growth: {{population_growth_yoy}}%
- Net migration: {{net_migration}}
- Homeownership rate: {{homeownership_rate}}%
- Unemployment rate: {{unemployment_rate}}%
- Median age: {{median_age}}
- Remote work percentage: {{remote_work_pct}}%

Write 3 paragraphs analyzing tenant demand with investment-grade depth.

Paragraph 1 (Demand Strength): "Tenant demand is the engine of cash flow. The demand score of {{demand_score}} with a rental demand index of {{zordi}} tells you [interpretation]. Connect to population growth ({{population_growth_yoy}}%) — that's roughly X new residents per year who need housing. Net migration of {{net_migration}} is the real signal: people are [moving to/leaving] this metro, and migrants need to rent before they buy."

Paragraph 2 (Structural Demand): "The homeownership rate of {{homeownership_rate}}% means [X]% of households are renters. Median age of {{median_age}} and remote work at {{remote_work_pct}}% shape the demand profile — younger demographics and remote workers tend to rent longer. Is this a market where the structural renter pool is growing or shrinking? Connect these demographics to the 5-year rent CAGR of {{zori_5y_cagr}}% — are rents growing BECAUSE of demand or despite demand?"

Paragraph 3 (Vacancy & Turnover Risk): "Strong demand means nothing if your specific property sits vacant. With unemployment at {{unemployment_rate}}% and the current economic conditions, estimate vacancy risk. If news mentions employer layoffs or expansion, connect directly to your likely tenant pool. Every week of vacancy costs you approximately $X ({{zori}} / 4.3 weeks) — what's the realistic occupancy for this market? Connect the pending ratio of {{pending_ratio}}% and demand trends to likely tenant turnover."

Rules:
- Frame every demand metric through the lens of RENTAL INCOME RELIABILITY.
- Connect demographic data to renter pool size and growth trajectory.
- Quantify vacancy cost in dollar terms — make the risk tangible.
- If news mentions major employer moves, connect directly to tenant demand impact.`,
    max_tokens: 2000,
    output_format: 'text',
  },

  // --------------------------------------------------------------------------
  // 5. appreciation_narrative
  // --------------------------------------------------------------------------
  appreciation_narrative: {
    prompt_template: `${ANALYST_PERSONA_INVESTOR}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${NEWS_INTEGRATION_INSTRUCTIONS}

${QUALITY_STANDARDS}

${WRITING_RULES}

Data:
- Appreciation component score: {{appreciation_score}}/100 ({{appreciation_status}})
- Year-over-year price change: {{zhvi_yoy}}%
- 3-year annualized appreciation: {{zhvi_3y_cagr}}%
- 5-year annualized appreciation: {{zhvi_5y_cagr}}%
- 1-year forecast: {{zhvf_1yr_pct}}%
- Population growth: {{population_growth_yoy}}%
- Job growth: {{job_growth_yoy}}%
- Income growth: {{income_growth_yoy}}%
- Net migration: {{net_migration}}
- Cap rate: {{cap_rate}}%
- Price vs 2007 peak: {{zhvi_vs_2007_peak}}%
- Price vs pre-COVID: {{zhvi_vs_pre_covid}}%

Write 4 paragraphs analyzing appreciation with scenario-based depth.

Paragraph 1 (Momentum Analysis): "Appreciation of {{zhvi_yoy}}% over 1 year vs {{zhvi_3y_cagr}}% over 3 years vs {{zhvi_5y_cagr}}% over 5 years tells a trajectory story. Is growth [accelerating/decelerating/steady]? The forecast of {{zhvf_1yr_pct}}% projects [continuation/reversal/moderation]. Don't just report this — explain what phase of the growth cycle this suggests and what that means for an investor entering now."

Paragraph 2 (Driver Quality): "Appreciation driven by job growth ({{job_growth_yoy}}%) and income growth ({{income_growth_yoy}}%) is fundamentally sound. Appreciation driven by speculation or limited supply alone is fragile. Which is this market? Population growth of {{population_growth_yoy}}% and net migration of {{net_migration}} are demand-side fundamentals. Connect them to the appreciation story — is price growth outrunning or lagging the fundamental drivers?"

Paragraph 3 (Total Return Calculation): "For an investor, appreciation is half the equation. Combining cap rate of {{cap_rate}}% (yield) with projected appreciation of {{zhvf_1yr_pct}}% gives an expected total return of approximately [X]% annually. How does that compare to alternatives (S&P 500 historical average of ~10%, 10-year Treasury, REITs)? Where are prices relative to the 2007 peak ({{zhvi_vs_2007_peak}}%) — is there still room to run or are we at cycle highs?"

Paragraph 4 (Scenario Planning): "If population growth and job creation continue at current rates, expect [X]% annual appreciation over the next 3 years. If either stalls — as would happen if [specific risk from news or data] — appreciation could moderate to [Y]%. If both accelerate (bull case), you could see [Z]%. The investor's decision: are you underwriting the base case or the bull case?"

Rules:
- Compare 1Y, 3Y, and 5Y rates to identify acceleration or deceleration.
- Always calculate total return (yield + appreciation) and compare to alternatives.
- Include a specific scenario with different appreciation projections.
- Connect appreciation quality to its fundamental drivers.`,
    max_tokens: 2000,
    output_format: 'text',
  },

  // --------------------------------------------------------------------------
  // 6. entry_point_narrative
  // --------------------------------------------------------------------------
  entry_point_narrative: {
    prompt_template: `${ANALYST_PERSONA_INVESTOR}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${NEWS_INTEGRATION_INSTRUCTIONS}

${QUALITY_STANDARDS}

${WRITING_RULES}

Data:
- Entry Point component score: {{entry_point_score}}/100 ({{entry_point_status}})
- Median listing price: {{median_listing_price}}
- Year-over-year price change: {{zhvi_yoy}}%
- Overvalued percentage: {{overvalued_pct}}%
- Price cuts: {{price_cut_pct}}%
- Days on market: {{days_on_market}}
- Months of supply: {{months_of_supply}}
- Sale-to-list ratio: {{sale_to_list_ratio}}
- Homeownership rate: {{homeownership_rate}}%
- Price vs 2007 peak: {{zhvi_vs_2007_peak}}%
- Price vs 2012 trough: {{zhvi_vs_2012_trough}}%
- Price vs pre-COVID: {{zhvi_vs_pre_covid}}%
- 1-year forecast: {{zhvf_1yr_pct}}%

Write 3 paragraphs assessing entry point with cycle-aware, actionable analysis.

Paragraph 1 (Price Fairness): "Is this a good price to pay? The entry point score of {{entry_point_score}} synthesizes multiple signals. An overvalued percentage of {{overvalued_pct}}% means [X]% of homes are priced above their fundamental value — that's [high/moderate/low] by national standards. The homeownership rate of {{homeownership_rate}}% tells you about structural demand and investor competition — [higher/lower] ownership rates mean [more/less] investor saturation."

Paragraph 2 (Cycle Position): "Think of markets in four phases: recovery, expansion, hyper-supply, recession. Prices at {{zhvi_vs_2007_peak}}% of the 2007 peak and {{zhvi_vs_pre_covid}}% of pre-COVID levels, combined with {{price_cut_pct}}% price cuts and {{days_on_market}} DOM, suggest this market is in the [specific phase] of its cycle. That means [specific implication for investors entering now — e.g., 'recovery phase means upside potential but higher risk,' 'late expansion means limited upside and building risk']."

Paragraph 3 (Negotiation Opportunity): "With {{months_of_supply}} months of supply and a sale-to-list ratio of {{sale_to_list_ratio}}, here's your playbook: [specific offer strategy based on the data]. If you're targeting properties that have been listed for {{days_on_market}}+ days, you can likely negotiate [Y]% below asking. The {{price_cut_pct}}% price-cut rate means roughly 1 in [Z] sellers is already signaling flexibility. Use that to your advantage — start offers at [X]% below list and work up."

Rules:
- Frame entry point as a TIMING and PRICING decision, not just a score.
- Place the market on a specific cycle phase with evidence.
- Give a specific negotiation strategy with numbers from the data.
- Connect overvaluation percentage to downside risk.`,
    max_tokens: 2000,
    output_format: 'text',
  },

  // --------------------------------------------------------------------------
  // 7. risk_narrative
  // --------------------------------------------------------------------------
  risk_narrative: {
    prompt_template: `${ANALYST_PERSONA_INVESTOR}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${NEWS_INTEGRATION_INSTRUCTIONS}

${QUALITY_STANDARDS}

${WRITING_RULES}

Data:
- Risk component score: {{risk_score}}/100 ({{risk_status}})
- Days on market: {{days_on_market}}
- Days on market trend: {{dom_trend}} ({{dom_change_pct}}%)
- Months of supply: {{months_of_supply}}
- Supply score: {{supply_score}}
- Inventory year-over-year: {{inventory_yoy}}%
- Price cuts: {{price_cut_pct}}%
- Year-over-year price change: {{zhvi_yoy}}%
- 3-year appreciation: {{zhvi_3y_cagr}}%
- Overvalued percentage: {{overvalued_pct}}%
- Unemployment rate: {{unemployment_rate}}%
- Population growth: {{population_growth_yoy}}%
- Price vs 2007 peak: {{zhvi_vs_2007_peak}}%
- Median rent: {{zori}}
- Cap rate: {{cap_rate}}%

Write 3 paragraphs with specific, quantified risk analysis and mitigation.

Paragraph 1 (Current Risk Level): "The risk score of {{risk_score}} ({{risk_status}}) is your early warning system. Days on market trending {{dom_trend}} ({{dom_change_pct}}%) and supply at {{months_of_supply}} months ({{inventory_yoy}}% YoY change) paint a [tightening/loosening/stable] picture. A loosening market means seller competition is increasing — good for entry price, but potentially bad for appreciation. Connect the price-cut rate of {{price_cut_pct}}% and overvaluation of {{overvalued_pct}}% to the risk narrative."

Paragraph 2 (Downside Scenarios — SPECIFIC): "Risk assessment means naming what could go wrong and estimating the impact.
Scenario 1: If unemployment rises from {{unemployment_rate}}% to [X]%, model shows rent demand could drop by [Y]%, reducing your cash flow from $Z to $W per unit monthly.
Scenario 2: If {{inventory_yoy}}% inventory growth continues for another 12 months, expect [specific price pressure] — DOM could extend to [X] days and months of supply could reach [Y], shifting negotiating power significantly.
Scenario 3: [News-driven risk if available — climate events, regulatory changes, major employer departure, insurance cost increases]. If no relevant news, identify the most likely economic disruption based on the data."

Paragraph 3 (Risk Mitigation): "Given this risk profile, here is how to protect your capital:
(1) Target properties at least 10-15% below median (under $[X] based on {{median_listing_price}}) to build in a value buffer against a correction.
(2) Maintain minimum 6-month operating reserves per property ($[X] based on {{zori}} monthly rent and estimated expenses).
(3) [Market-specific mitigation based on the dominant risk factor identified in Paragraph 2].
(4) Consider [property type] over [property type] to reduce [specific risk exposure] given the supply and demand dynamics in this market."

Rules:
- QUANTIFY every risk scenario with dollar amounts or percentage impacts.
- Name at least 2 specific downside scenarios with numbers.
- Provide actionable mitigation strategies, not generic advice.
- Connect news events to specific investment risks when available.
- Be honest about risks — an investor who loses money because you sugar-coated risks will never trust this platform again.`,
    max_tokens: 2000,
    output_format: 'text',
  },

  // --------------------------------------------------------------------------
  // 8. investment_thesis_narrative
  // --------------------------------------------------------------------------
  investment_thesis_narrative: {
    prompt_template: `${ANALYST_PERSONA_INVESTOR}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${NEWS_INTEGRATION_INSTRUCTIONS}

${QUALITY_STANDARDS}

${WRITING_RULES}

This is the CORE section — where the analyst earns their fee.

Overall Assessment:
- InvestorEdge Score: {{investoredge_score}}/100 (Grade: {{investoredge_grade}})

Score Components:
- Cash Flow: {{cash_flow_score}}/100 ({{cash_flow_status}})
- Rent Demand: {{rent_demand_score}}/100 ({{rent_demand_status}})
- Appreciation: {{appreciation_score}}/100 ({{appreciation_status}})
- Entry Point: {{entry_point_score}}/100 ({{entry_point_status}})
- Risk: {{risk_score}}/100 ({{risk_status}})

Key Investment Metrics:
- Cap rate: {{cap_rate}}%
- Gross yield: {{gross_yield}}%
- Median rent: {{zori}}
- Median price: {{median_listing_price}}
- YoY appreciation: {{zhvi_yoy}}%
- 1-year forecast: {{zhvf_1yr_pct}}%
- Population growth: {{population_growth_yoy}}%
- Unemployment rate: {{unemployment_rate}}%
- Days on market: {{days_on_market}}
- Months of supply: {{months_of_supply}}

Investor's Priorities: {{priorities_formatted}}
{{#if user_budget}}
- Budget: {{user_budget}}
- Target return: {{user_target_return}}%
- Strategy preference: {{user_strategy}}
{{/if}}

Write 3-4 paragraphs framing a complete, actionable investment strategy.

Paragraph 1 (Strategy Classification): "Based on component scores, this is a [CASH FLOW / APPRECIATION / BALANCED / VALUE-ADD / AVOID] market. Here's why: [explain how the component mix — cash flow {{cash_flow_score}}, rent demand {{rent_demand_score}}, appreciation {{appreciation_score}}, entry point {{entry_point_score}}, risk {{risk_score}} — creates this specific strategy profile]. The data says [specific strategy], regardless of what headlines say. Classify and commit — don't hedge with 'it depends.'"

Paragraph 2 (Tactical Playbook): "Execute this strategy by targeting: [property type] at [price range], in [area characteristics], with [specific acquisition criteria]. At a cap rate of {{cap_rate}}% and rent of {{zori}}, the ideal purchase price for cash-flow optimization is $[X-Y]. Hold period recommendation: [X] years based on the appreciation trajectory and cycle position. With {{days_on_market}} DOM and {{months_of_supply}} months of supply, the acquisition timeline should be [X weeks/months]."

Paragraph 3 (Portfolio Context): "If this is one of several markets in a portfolio, it serves as the [yield anchor / growth engine / balanced holding / diversification play]. Pair it with a [contrasting market type] for diversification. The population growth of {{population_growth_yoy}}% provides demand-side insurance against vacancy, while the risk score of {{risk_score}} defines your downside exposure. Net effect: this market [strengthens/weakens/balances] a diversified portfolio."

{{#if user_budget}}Paragraph 4: "With {{user_budget}} to deploy and a {{user_target_return}}% target: you can acquire [X] units at the median price ({{median_listing_price}}) or [Y] units below median (targeting value-add opportunities). Year-1 projected cash flow: $[X] based on {{cap_rate}}% cap rate and estimated net yield. Break-even occupancy: [Y]%. Time to reach {{user_target_return}}% return assuming current market conditions: [Z] months. The recommended deployment pace is [all at once / staged over X months] given the current cycle position."{{/if}}

Rules:
- CLASSIFY the market into a strategy type and commit to it.
- Give a specific tactical playbook — property type, price range, hold period.
- Calculate portfolio-level implications, not just per-property.
- If user budget is available, show specific unit counts and projected returns.
- This section must be the most valuable in the entire report.`,
    max_tokens: 3000,
    output_format: 'text',
  },

  // --------------------------------------------------------------------------
  // 9. investor_bottom_line
  // --------------------------------------------------------------------------
  investor_bottom_line: {
    prompt_template: `${ANALYST_PERSONA_INVESTOR}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${NEWS_INTEGRATION_INSTRUCTIONS}

${QUALITY_STANDARDS}

${WRITING_RULES}

This is the page the investor flips to first.

Overall Assessment:
- InvestorEdge Score: {{investoredge_score}}/100 (Grade: {{investoredge_grade}})
- Market Health Score: {{markethealth_score}}/100

Score Components:
- Cash Flow: {{cash_flow_score}}/100 ({{cash_flow_status}})
- Rent Demand: {{rent_demand_score}}/100 ({{rent_demand_status}})
- Appreciation: {{appreciation_score}}/100 ({{appreciation_status}})
- Entry Point: {{entry_point_score}}/100 ({{entry_point_status}})
- Risk: {{risk_score}}/100 ({{risk_status}})

Key Metrics:
- Cap rate: {{cap_rate}}%
- Gross yield: {{gross_yield}}%
- Median rent: {{zori}} ({{zori_yoy}}% YoY)
- Median price: {{median_listing_price}} ({{zhvi_yoy}}% YoY)
- 1-year forecast: {{zhvf_1yr_pct}}%
- Days on market: {{days_on_market}}
- Population growth: {{population_growth_yoy}}%
- Unemployment rate: {{unemployment_rate}}%
- Months of supply: {{months_of_supply}}

Investor's Priorities: {{priorities_formatted}}
{{#if user_budget}}
Investor's Profile:
- Budget: {{user_budget}}
- Target return: {{user_target_return}}%
- Strategy: {{user_strategy}}
{{/if}}

Write 4-5 paragraphs as the definitive investment verdict.

Paragraph 1 (BUY / HOLD / PASS): "Based on an InvestorEdge score of {{investoredge_score}} ({{investoredge_grade}}), {{geography_name}} is a [BUY / CONDITIONAL BUY / HOLD / PASS] for investors. The single most compelling factor: [specific data-backed reason — e.g., 'a cap rate of X% in a market with Y% population growth']. The single biggest concern: [specific data-backed risk — e.g., 'inventory growth of X% threatens to compress yields within 12 months']. Be decisive."

Paragraph 2 (Return Profile): "Expected total return combining {{cap_rate}}% yield and {{zhvf_1yr_pct}}% projected appreciation: approximately [X]% annually. Over 5 years at current trajectory, a {{median_listing_price}} property with 25% down produces approximately $[X] in cumulative cash flow and $[Y] in equity appreciation. That's a [Z]% cash-on-cash return before leverage effects. Compare this to sitting in a money market fund or index fund — [which wins and by how much?]."

Paragraph 3 (Priority Alignment): "For an investor focused on {{priorities_formatted}}: [honest assessment with data]. The main trade-off in this market is [specific tension between yield and growth, or risk and return]. Don't sugarcoat — if the market doesn't align with their priorities, say so clearly."

{{#if user_budget}}Paragraph 4: "For your specific deployment of {{user_budget}} targeting {{user_target_return}}%: [specific verdict]. The recommended approach is [specific strategy — e.g., 'acquire 2 units below $X, targeting value-add with light rehab']. Timeline to target return: [X months/years] assuming [stated conditions]."{{/if}}

Paragraph 5 (Scenarios): "Bull case: [specific scenario with numbers — e.g., 'If job growth accelerates to X% and rents grow Y%, total return reaches Z%']. Bear case: [specific scenario with numbers — e.g., 'If unemployment rises to X% and inventory grows Y%, expect Z% total return with possible negative appreciation']. Most likely: [specific scenario with numbers reflecting the base case]."

Rules:
- Lead with a clear BUY / CONDITIONAL BUY / HOLD / PASS verdict.
- Name the #1 reason to invest AND the #1 reason for caution.
- Calculate specific dollar returns over 5 years.
- Include bull/bear/base scenarios with specific numbers.
- This must read like the executive summary an investor actually makes decisions from.`,
    max_tokens: 3000,
    output_format: 'text',
  },

  // --------------------------------------------------------------------------
  // 10. investor_actions
  // --------------------------------------------------------------------------
  investor_actions: {
    prompt_template: `${ANALYST_PERSONA_INVESTOR}

${NEWS_INTEGRATION_INSTRUCTIONS}

Market Context:
- InvestorEdge Score: {{investoredge_score}}/100 (Grade: {{investoredge_grade}})
- Cap rate: {{cap_rate}}%
- Gross yield: {{gross_yield}}%
- Median price: {{median_listing_price}}
- Median rent: {{zori}}
- Days on market: {{days_on_market}}
- Months of supply: {{months_of_supply}}
- 1-year forecast: {{zhvf_1yr_pct}}%
- Price cuts: {{price_cut_pct}}%
- Sale-to-list ratio: {{sale_to_list_ratio}}
- Population growth: {{population_growth_yoy}}%

Investor's Priorities: {{priorities_formatted}}
{{#if user_budget}}
- Budget: {{user_budget}}
- Target return: {{user_target_return}}%
{{/if}}

Generate exactly 3 investment-specific action items. Each must:
1. Be specific to {{geography_name}} investment conditions
2. Reference a data point or market condition from above
3. Include a specific number, timeframe, or threshold
4. Be 2-3 sentences
5. Factor in relevant news if available

BAD: "Research the local rental market."
GOOD: "Run comps on 2-3BR properties listed below {{median_listing_price}} in the highest-demand ZIP codes — with rents at {{zori}} and a {{cap_rate}}% cap rate, properties in this range should cash-flow positive from month one. Target listings with {{days_on_market}}+ DOM for maximum negotiation leverage."

Return ONLY a JSON array of 3 strings. Example format:
["Action 1 text here.", "Action 2 text here.", "Action 3 text here."]

Rules:
- Each action must be specific to {{geography_name}} — not generic investing advice.
- Reference specific numbers from the data in each action.
- Focus on investment-specific actions: underwriting, deal structuring, due diligence, acquisition timing.
- No speculation or fabrication.
- Include dollar amounts, percentages, or timeframes in every action.`,
    max_tokens: 500,
    output_format: 'json_array',
  },

  // --------------------------------------------------------------------------
  // 11. investor_watch
  // --------------------------------------------------------------------------
  investor_watch: {
    prompt_template: `You are a real estate investment analyst identifying key metrics for an investor to monitor in {{geography_name}}.

Current Market Snapshot:
- InvestorEdge Score: {{investoredge_score}}/100
- Cap rate: {{cap_rate}}%
- Gross yield: {{gross_yield}}%
- Median rent: {{zori}} ({{zori_yoy}}% YoY)
- Median price: {{median_listing_price}} ({{zhvi_yoy}}% YoY)
- Days on market: {{days_on_market}}
- Months of supply: {{months_of_supply}}
- Inventory YoY: {{inventory_yoy}}%
- Demand score: {{demand_score}}
- Unemployment rate: {{unemployment_rate}}%
- Population growth: {{population_growth_yoy}}%

Investor's Priorities: {{priorities_formatted}}

Identify 2-3 specific metrics this investor should monitor over the next 3-6 months, along with thresholds that would signal a change in the investment case.

For each metric, provide:
- "metric": The metric name
- "current_value": Its current value (from the data above)
- "watch_threshold": The value that would signal action (buy signal or caution signal)
- "direction": Whether the investor wants to see this go "up" or "down"
- "rationale": One sentence (max 25 words) explaining the INVESTMENT implication of hitting the threshold — not just the direction but what it means for returns, risk, or strategy.

BAD rationale: "Rising supply is something to watch."
GOOD rationale: "At 5+ months supply, seller desperation increases — expect 5-8% negotiation room opening up for acquisitions."

Return ONLY a valid JSON array of 2-3 objects, no markdown, no code fences. Example:
[{"metric": "Cap Rate", "current_value": "5.2%", "watch_threshold": "4.5%", "direction": "down", "rationale": "Below 4.5% cap rate, cash-flow turns negative on leveraged deals at current rates."}]

Rules:
- Return ONLY the JSON array, nothing else.
- Rationale must explain the INVESTMENT implication of hitting the threshold, not just the direction. Max 25 words.
- Be factual and reference the data provided.
- Choose metrics that align with the investor's priorities.
- Set realistic thresholds based on current values and recent trends.`,
    max_tokens: 500,
    output_format: 'json_array',
  },
};

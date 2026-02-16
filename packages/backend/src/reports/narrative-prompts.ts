/**
 * Per-Section Narrative Prompt Templates
 *
 * Defines structured prompt templates for each report section.
 * Each template receives context variables ({{variable}}) and produces
 * section-specific AI narratives grounded in real data.
 *
 * Supports conditional blocks: {{#if variable}}...{{/if}}
 * Used by ReportsService.generateSectionNarratives()
 */

// ============================================================================
// Types
// ============================================================================

export interface NarrativePromptConfig {
  /** Template with {{variable}} placeholders and optional {{#if var}}...{{/if}} blocks */
  prompt_template: string;
  /** Maximum tokens for the AI response */
  max_tokens: number;
  /** Output format: plain text, JSON array, or JSON object */
  output_format: 'text' | 'json_array' | 'json_object';
}

// ============================================================================
// HomeReady Report Sections
// ============================================================================

const HOMEREADY_PROMPTS: Record<string, NarrativePromptConfig> = {
  hero_verdict: {
    prompt_template: `You are a real estate analyst writing a one-sentence verdict about the housing market in {{geography_name}}.

Data:
- HomeReady Score: {{homeready_score}}/100 (Grade: {{homeready_grade}})
- Median listing price: {{median_listing_price}}
- Year-over-year price change: {{zhvi_yoy}}%
- Days on market: {{days_on_market}}
- Market heat index: {{hotness_score}}

Write ONE compelling, specific sentence that captures the essence of this market for a homebuyer right now. Reference at least one data point. Do not use generic phrases like "a mixed bag" or "something for everyone."

Rules:
- Exactly one sentence, no more than 25 words.
- Be factual and specific. Reference a number from the data.
- No speculation or fabrication.
- Tone: confident expert analyst.`,
    max_tokens: 100,
    output_format: 'text',
  },

  score_story: {
    prompt_template: `You are a real estate analyst explaining a HomeReady score for {{geography_name}}.

Score Summary:
- Overall HomeReady Score: {{homeready_score}}/100 (Grade: {{homeready_grade}})
- Affordability component: {{affordability_score}}/100 ({{affordability_status}})
- Market Timing component: {{market_timing_score}}/100 ({{market_timing_status}})
- Stability component: {{stability_score}}/100 ({{stability_status}})
- Growth Potential component: {{growth_potential_score}}/100 ({{growth_potential_status}})

Write 2-3 sentences that connect the score components into a coherent story. Explain which components are driving the overall score up or down, and what that means for a homebuyer.

Rules:
- Be factual. Reference specific component scores.
- Explain the interplay between components (e.g., "While affordability is strong at X, market timing suggests...").
- No speculation or fabrication.
- Write in the voice of an expert real estate analyst.
- Keep language clear and accessible to homebuyers.`,
    max_tokens: 200,
    output_format: 'text',
  },

  affordability_narrative: {
    prompt_template: `You are a real estate analyst writing about affordability in {{geography_name}} for a homebuyer.

Data:
- Affordability component score: {{affordability_score}}/100 ({{affordability_status}})
- Median listing price: {{median_listing_price}}
- Year-over-year price change: {{zhvi_yoy}}%
- Median household income: {{median_income}}
- Affordability index: {{affordability_index}}
- Income needed to buy: {{income_needed_to_buy}}
- National median price: {{national_median_price}}
- State median price: {{state_median_price}}
- Price trend (6 months): {{zhvi_trend}} ({{zhvi_change_pct}}%)
{{#if user_income}}
- Buyer's household income: {{user_income}}
- Buyer's down payment: {{user_down_payment}}
- Buyer's target price range: {{user_budget}}
{{/if}}

Write 2-3 paragraphs interpreting the affordability data.

Paragraph 1: Interpret the affordability component score in the context of current prices and incomes. What does a score of {{affordability_score}} mean practically for someone looking to buy here? Reference the price-to-income relationship.

Paragraph 2: Compare to national and state benchmarks. Is this market more or less affordable than the national median ({{national_median_price}}) and state median ({{state_median_price}})? What does the trend tell us about where affordability is heading?

{{#if user_income}}Paragraph 3: Personalized assessment for this buyer. With an income of {{user_income}} and down payment of {{user_down_payment}}, how does this buyer's purchasing power align with the market? What price range is realistic? Are they above or below the income needed to buy ({{income_needed_to_buy}})?{{/if}}

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Write in the voice of an expert real estate analyst.
- Keep language clear and accessible to homebuyers.
- If a data point is "N/A", acknowledge the gap and focus on available data.`,
    max_tokens: 400,
    output_format: 'text',
  },

  market_timing_narrative: {
    prompt_template: `You are a real estate analyst writing about market timing in {{geography_name}} for a homebuyer.

Data:
- Market Timing component score: {{market_timing_score}}/100 ({{market_timing_status}})
- Days on market: {{days_on_market}}
- Months of supply: {{months_of_supply}}
- Demand score: {{demand_score}}
- Market heat index: {{hotness_score}}
- Pending ratio: {{pending_ratio}}%
- Price cuts: {{price_cut_pct}}% of listings
- Inventory year-over-year: {{inventory_yoy}}%
- Sale-to-list ratio: {{sale_to_list_ratio}}
- Home value forecast (1 year): {{zhvf_1yr_pct}}%

Market Balance Context:
- Buyer's market threshold: >6 months supply, >15% price cuts
- Balanced market: 4-6 months supply, 10-15% price cuts
- Seller's market threshold: <4 months supply, <10% price cuts

Write 2-3 paragraphs analyzing market timing.

Paragraph 1: Characterize the current market as a buyer's, seller's, or balanced market using the data. How quickly are homes selling? Is there competition (pending ratio, demand score) or slack (price cuts, days on market)?

Paragraph 2: Assess the timing window. Based on inventory trends ({{inventory_yoy}}% YoY), the 1-year forecast ({{zhvf_1yr_pct}}%), and current momentum, is conditions likely to become more or less favorable for buyers in the coming months? Should a buyer act now or wait?

Paragraph 3: Provide tactical guidance. Given days on market of {{days_on_market}} and price cuts at {{price_cut_pct}}%, what negotiating leverage do buyers have? How should they approach offers?

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Write in the voice of an expert real estate analyst.
- Keep language clear and accessible to homebuyers.`,
    max_tokens: 400,
    output_format: 'text',
  },

  stability_narrative: {
    prompt_template: `You are a real estate analyst writing about market stability and predictability in {{geography_name}} for a homebuyer.

Data:
- Stability component score: {{stability_score}}/100 ({{stability_status}})
- Days on market: {{days_on_market}}
- Days on market trend (6 months): {{dom_trend}} ({{dom_change_pct}}%)
- Price reduced share: {{price_cut_pct}}%
- Months of supply: {{months_of_supply}}
- Inventory year-over-year change: {{inventory_yoy}}%
- Year-over-year price change: {{zhvi_yoy}}%
- 3-year annualized appreciation: {{zhvi_3y_cagr}}%
- 5-year annualized appreciation: {{zhvi_5y_cagr}}%
- Price vs 2007 peak: {{zhvi_vs_2007_peak}}%
- Price vs pre-COVID (2020): {{zhvi_vs_pre_covid}}%

Write 2-3 paragraphs analyzing market stability and predictability.

Paragraph 1: Interpret the stability score. A stable market means predictable pricing, consistent transaction volume, and low volatility. With a stability score of {{stability_score}}/100, how predictable is this market? Reference days on market consistency and price cut frequency.

Paragraph 2: Analyze historical consistency. Compare the 1-year ({{zhvi_yoy}}%), 3-year ({{zhvi_3y_cagr}}%), and 5-year ({{zhvi_5y_cagr}}%) appreciation rates. Is growth consistent or volatile? How does the current price level compare to historical benchmarks (2007 peak, pre-COVID)?

Paragraph 3: Assess risk factors for a homebuyer. What does the stability profile mean for someone buying a home here? Is there risk of significant value loss? How resilient has this market been through past downturns?

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Write in the voice of an expert real estate analyst.
- Keep language clear and accessible to homebuyers.`,
    max_tokens: 400,
    output_format: 'text',
  },

  growth_potential_narrative: {
    prompt_template: `You are a real estate analyst writing about growth potential in {{geography_name}} for a homebuyer.

Data:
- Growth Potential component score: {{growth_potential_score}}/100 ({{growth_potential_status}})
- Population: {{population}}
- Population growth (YoY): {{population_growth_yoy}}%
- Unemployment rate: {{unemployment_rate}}%
- Job growth (YoY): {{job_growth_yoy}}%
- Income growth (YoY): {{income_growth_yoy}}%
- Net migration: {{net_migration}}
- Year-over-year price change: {{zhvi_yoy}}%
- 3-year annualized appreciation: {{zhvi_3y_cagr}}%
- 5-year annualized appreciation: {{zhvi_5y_cagr}}%
- 1-year price forecast: {{zhvf_1yr_pct}}%
- Remote work percentage: {{remote_work_pct}}%

Write 2-3 paragraphs analyzing growth potential and appreciation drivers.

Paragraph 1: Assess the economic fundamentals driving growth. Population trends ({{population_growth_yoy}}%), employment ({{unemployment_rate}}% unemployment, {{job_growth_yoy}}% job growth), and income growth ({{income_growth_yoy}}%) are the foundation of housing demand. What do these numbers say about future demand?

Paragraph 2: Evaluate appreciation sustainability. The market has appreciated {{zhvi_yoy}}% over the past year and {{zhvi_5y_cagr}}% annually over 5 years. Is this pace sustainable given the underlying economic drivers? What does the 1-year forecast of {{zhvf_1yr_pct}}% suggest?

Paragraph 3: Connect growth drivers to a homebuyer's equity prospects. For someone buying now, what does the growth potential score of {{growth_potential_score}}/100 imply about likely home equity gains over 3-5 years? What are the key drivers to watch?

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Write in the voice of an expert real estate analyst.
- Keep language clear and accessible to homebuyers.`,
    max_tokens: 400,
    output_format: 'text',
  },

  priorities_narrative: {
    prompt_template: `You are a real estate analyst writing a personalized priorities analysis for a homebuyer considering {{geography_name}}.

Buyer's Priorities (ordered by importance):
{{priorities_formatted}}

Score Components:
- Affordability: {{affordability_score}}/100 ({{affordability_status}})
- Market Timing: {{market_timing_score}}/100 ({{market_timing_status}})
- Stability: {{stability_score}}/100 ({{stability_status}})
- Growth Potential: {{growth_potential_score}}/100 ({{growth_potential_status}})

Key Market Data:
- HomeReady Score: {{homeready_score}}/100
- Median listing price: {{median_listing_price}}
- Days on market: {{days_on_market}}
- Year-over-year price change: {{zhvi_yoy}}%
- 1-year forecast: {{zhvf_1yr_pct}}%
- Cap rate: {{cap_rate}}%
{{#if user_income}}
- Buyer's income: {{user_income}}
- Buyer's down payment: {{user_down_payment}}
- Buyer's timeline: {{user_timeline}}
{{/if}}

Write 2-3 paragraphs reframing the market analysis through the lens of this buyer's specific priorities.

Paragraph 1: Address the buyer's top priority directly. How does {{geography_name}} score on what matters most to them? Be specific with data.

Paragraph 2: Address the remaining priorities. Are there trade-offs? Does the market deliver on some priorities but fall short on others? Be honest about weaknesses.

{{#if user_income}}Paragraph 3: Given the buyer's specific financial situation (income of {{user_income}}, down payment of {{user_down_payment}}) and timeline ({{user_timeline}}), how well does this market align with their goals?{{/if}}

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Directly address the buyer's stated priorities - do not discuss irrelevant topics.
- Write in the voice of an expert real estate analyst.
- Be honest about trade-offs rather than overly optimistic.`,
    max_tokens: 400,
    output_format: 'text',
  },

  bottom_line_narrative: {
    prompt_template: `You are a real estate analyst writing the executive summary and bottom line for a HomeReady report on {{geography_name}}.

Overall Assessment:
- HomeReady Score: {{homeready_score}}/100 (Grade: {{homeready_grade}})
- Market Health Score: {{markethealth_score}}/100

Score Components:
- Affordability: {{affordability_score}}/100 ({{affordability_status}})
- Market Timing: {{market_timing_score}}/100 ({{market_timing_status}})
- Stability: {{stability_score}}/100 ({{stability_status}})
- Growth Potential: {{growth_potential_score}}/100 ({{growth_potential_status}})

Key Metrics:
- Median listing price: {{median_listing_price}}
- Year-over-year price change: {{zhvi_yoy}}%
- 1-year forecast: {{zhvf_1yr_pct}}%
- Days on market: {{days_on_market}}
- Months of supply: {{months_of_supply}}
- Price cuts: {{price_cut_pct}}%
- Population growth: {{population_growth_yoy}}%
- Unemployment rate: {{unemployment_rate}}%

Buyer's Priorities: {{priorities_formatted}}
{{#if user_income}}
Buyer's Profile:
- Income: {{user_income}}
- Down payment: {{user_down_payment}}
- Timeline: {{user_timeline}}
{{/if}}

Write 3-4 paragraphs as an executive synthesis.

Paragraph 1: Lead with the verdict. Based on a HomeReady score of {{homeready_score}}/100 (grade {{homeready_grade}}), clearly state whether this is a good time and place to buy. Reference the strongest and weakest components.

Paragraph 2: Summarize the key dynamics. What are the 2-3 most important things a buyer needs to know about this market right now? Reference specific data.

Paragraph 3: Address the buyer's priorities. Given their priorities of {{priorities_formatted}}, how well does this market deliver? What are the main trade-offs?

{{#if user_income}}Paragraph 4: Personalized conclusion. For a buyer with {{user_income}} income and {{user_down_payment}} down payment on a {{user_timeline}} timeline, what is the actionable recommendation?{{/if}}

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Write in the voice of an expert real estate analyst.
- Be decisive - state a clear recommendation, not wishy-washy hedging.
- Keep language clear and accessible to homebuyers.`,
    max_tokens: 500,
    output_format: 'text',
  },

  bottom_line_actions: {
    prompt_template: `You are a real estate analyst providing actionable next steps for a homebuyer considering {{geography_name}}.

Market Context:
- HomeReady Score: {{homeready_score}}/100 (Grade: {{homeready_grade}})
- Market type: {{market_timing_status}} market timing
- Days on market: {{days_on_market}}
- Price cuts: {{price_cut_pct}}%
- 1-year forecast: {{zhvf_1yr_pct}}%
- Months of supply: {{months_of_supply}}

Buyer's Priorities: {{priorities_formatted}}
{{#if user_income}}
Buyer's Profile:
- Income: {{user_income}}
- Down payment: {{user_down_payment}}
- Timeline: {{user_timeline}}
{{/if}}

Generate exactly 3 specific, actionable next steps for this buyer. Each action should:
1. Be concrete and specific to this market (not generic advice)
2. Reference data points or market conditions that inform the recommendation
3. Include a timeframe or specific threshold when applicable
4. Be 1-2 sentences

Return ONLY a JSON array of 3 strings. Example format:
["Action 1 text here.", "Action 2 text here.", "Action 3 text here."]

Rules:
- Be factual and grounded in the data above.
- Each action must be specific to {{geography_name}}, not generic homebuying advice.
- Tailor actions to the buyer's priorities when possible.
- No speculation or fabrication.`,
    max_tokens: 300,
    output_format: 'json_array',
  },

  bottom_line_watch: {
    prompt_template: `You are a real estate analyst identifying key metrics for a homebuyer to monitor in {{geography_name}}.

Current Market Snapshot:
- HomeReady Score: {{homeready_score}}/100
- Days on market: {{days_on_market}}
- Months of supply: {{months_of_supply}}
- Price cuts: {{price_cut_pct}}%
- Inventory YoY change: {{inventory_yoy}}%
- Year-over-year price change: {{zhvi_yoy}}%
- 1-year forecast: {{zhvf_1yr_pct}}%
- Demand score: {{demand_score}}

Buyer's Priorities: {{priorities_formatted}}

Identify 2-3 specific metrics this buyer should monitor over the next 3-6 months, along with thresholds that would signal a change in market conditions.

For each metric, provide:
- "metric": The metric name
- "current_value": Its current value (from the data above)
- "watch_threshold": The value that would signal action (buy signal or caution signal)
- "direction": Whether the buyer wants to see this go "up" or "down"
- "rationale": One sentence explaining why this metric matters for their priorities

Return ONLY a JSON array of 2-3 objects. Example:
[{"metric": "Months of Supply", "current_value": "3.2", "watch_threshold": "4.5", "direction": "up", "rationale": "Rising supply would give buyers more negotiating leverage."}]

Rules:
- Be factual and reference the data provided.
- Choose metrics that align with the buyer's priorities.
- Set realistic thresholds based on current values.
- No speculation or fabrication.`,
    max_tokens: 300,
    output_format: 'json_array',
  },
};

// ============================================================================
// InvestorEdge Report Sections
// ============================================================================

const INVESTOR_PROMPTS: Record<string, NarrativePromptConfig> = {
  investor_hero_verdict: {
    prompt_template: `You are a real estate investment analyst writing a one-sentence verdict about {{geography_name}} as an investment market.

Data:
- InvestorEdge Score: {{investoredge_score}}/100 (Grade: {{investoredge_grade}})
- Cap rate: {{cap_rate}}%
- Gross yield: {{gross_yield}}%
- Year-over-year price change: {{zhvi_yoy}}%
- Median rent: {{zori}}
- Demand score: {{demand_score}}

Write ONE compelling, specific sentence that captures the investment opportunity (or lack thereof) in this market. Reference at least one data point.

Rules:
- Exactly one sentence, no more than 25 words.
- Be factual and specific. Reference a number from the data.
- No speculation or fabrication.
- Tone: confident investment analyst.`,
    max_tokens: 100,
    output_format: 'text',
  },

  investor_score_story: {
    prompt_template: `You are a real estate investment analyst explaining an InvestorEdge score for {{geography_name}}.

Score Summary:
- Overall InvestorEdge Score: {{investoredge_score}}/100 (Grade: {{investoredge_grade}})
- Cash Flow component: {{cash_flow_score}}/100 ({{cash_flow_status}})
- Rent Demand component: {{rent_demand_score}}/100 ({{rent_demand_status}})
- Appreciation component: {{appreciation_score}}/100 ({{appreciation_status}})
- Entry Point component: {{entry_point_score}}/100 ({{entry_point_status}})
- Risk component: {{risk_score}}/100 ({{risk_status}})

Write 2-3 sentences that connect the score components into a coherent investment thesis. Explain which components create opportunity and which signal caution.

Rules:
- Be factual. Reference specific component scores.
- Explain how components interact (e.g., "Strong cash flow at X combined with moderate appreciation at Y suggests a yield-focused strategy...").
- No speculation or fabrication.
- Write in the voice of an expert investment analyst.`,
    max_tokens: 200,
    output_format: 'text',
  },

  cash_flow_narrative: {
    prompt_template: `You are a real estate investment analyst writing about cash flow potential in {{geography_name}}.

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

Write 2-3 paragraphs analyzing cash flow reality and sustainability.

Paragraph 1: Assess current cash flow fundamentals. With a cap rate of {{cap_rate}}% and gross yield of {{gross_yield}}%, how does this market deliver for income-focused investors? Compare to the national average. A GRM of {{grm}} means it takes roughly {{grm}} years of gross rent to pay the purchase price.

Paragraph 2: Evaluate cash flow sustainability. Rents have grown {{zori_yoy}}% year-over-year and {{zori_5y_cagr}}% annually over 5 years. With a rent-to-income ratio of {{rent_to_income_ratio}}%, is there room for further rent growth or are tenants stretched? What does the rent-to-price ratio tell us?

{{#if user_budget}}Paragraph 3: For an investor with a {{user_budget}} budget targeting {{user_target_return}}% returns, assess whether this market can deliver. What price point within the market might optimize cash flow?{{/if}}

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Write in the voice of an expert investment analyst.
- Focus on numbers that investors care about: cap rates, yields, cash-on-cash potential.`,
    max_tokens: 400,
    output_format: 'text',
  },

  rent_demand_narrative: {
    prompt_template: `You are a real estate investment analyst writing about tenant demand and rent growth in {{geography_name}}.

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

Write 2-3 paragraphs analyzing tenant demand and rent growth prospects.

Paragraph 1: Assess current tenant demand strength. With a demand score of {{demand_score}} and rental demand index of {{zordi}}, how strong is renter demand? Reference population growth ({{population_growth_yoy}}%) and migration ({{net_migration}}) as demand drivers.

Paragraph 2: Evaluate rent growth trajectory. Rents at {{zori}} have grown {{zori_yoy}}% YoY. Given the homeownership rate of {{homeownership_rate}}% and demographic profile (median age {{median_age}}), is the renter pool growing or shrinking? What does this mean for future rent growth?

Paragraph 3: Assess vacancy and turnover risk. Based on demand strength, job market conditions ({{unemployment_rate}}% unemployment), and population dynamics, how reliable is rental income in this market? What is the likely occupancy outlook?

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Write in the voice of an expert investment analyst.
- Focus on factors that drive occupancy and rent growth.`,
    max_tokens: 400,
    output_format: 'text',
  },

  appreciation_narrative: {
    prompt_template: `You are a real estate investment analyst writing about appreciation potential and total return in {{geography_name}}.

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

Write 2-3 paragraphs analyzing growth drivers and total return potential.

Paragraph 1: Assess appreciation momentum. The market has delivered {{zhvi_yoy}}% over 1 year, {{zhvi_3y_cagr}}% annualized over 3 years, and {{zhvi_5y_cagr}}% over 5 years. The 1-year forecast projects {{zhvf_1yr_pct}}%. Is appreciation accelerating, decelerating, or steady?

Paragraph 2: Evaluate the fundamental drivers of appreciation. Population growth ({{population_growth_yoy}}%), job growth ({{job_growth_yoy}}%), income growth ({{income_growth_yoy}}%), and net migration ({{net_migration}}) are the engines of housing demand. Are these engines running strong or weakening?

Paragraph 3: Calculate total return potential. Combining a cap rate of {{cap_rate}}% with projected appreciation of approximately {{zhvf_1yr_pct}}%, what is the expected total return? How does this compare to alternative investments? Where does price sit relative to historical benchmarks ({{zhvi_vs_2007_peak}}% vs 2007 peak)?

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Write in the voice of an expert investment analyst.
- Frame appreciation in terms of total return alongside yield.`,
    max_tokens: 400,
    output_format: 'text',
  },

  entry_point_narrative: {
    prompt_template: `You are a real estate investment analyst writing about entry point assessment and cycle positioning in {{geography_name}}.

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

Write 2-3 paragraphs assessing cycle positioning and price fairness.

Paragraph 1: Assess the current entry point. With an entry point score of {{entry_point_score}}/100, is pricing favorable for investors? The overvalued indicator at {{overvalued_pct}}% and the homeownership rate at {{homeownership_rate}}% provide context. Are prices stretched or reasonable relative to fundamentals?

Paragraph 2: Evaluate cycle positioning. Prices are {{zhvi_vs_2007_peak}}% relative to the 2007 peak and {{zhvi_vs_pre_covid}}% relative to pre-COVID levels. With {{price_cut_pct}}% of listings seeing price reductions and days on market at {{days_on_market}}, where are we in the market cycle? Is this early, mid, or late cycle?

Paragraph 3: Assess negotiation opportunity. With months of supply at {{months_of_supply}}, a sale-to-list ratio of {{sale_to_list_ratio}}, and {{price_cut_pct}}% price cuts, how much negotiating room exists? What purchase strategy maximizes value at this point in the cycle?

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Write in the voice of an expert investment analyst.
- Help the investor understand whether now is a good time to deploy capital.`,
    max_tokens: 400,
    output_format: 'text',
  },

  risk_narrative: {
    prompt_template: `You are a real estate investment analyst writing about downside scenarios and risk factors in {{geography_name}}.

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

Write 2-3 paragraphs analyzing risk factors and downside scenarios.

Paragraph 1: Assess current risk levels. With a risk score of {{risk_score}}/100 ({{risk_status}}), what are the primary risk factors? Days on market trending {{dom_trend}} ({{dom_change_pct}}%) and supply dynamics ({{months_of_supply}} months, {{inventory_yoy}}% YoY) indicate whether conditions are tightening or loosening.

Paragraph 2: Identify specific downside scenarios. What could go wrong? Consider: rising supply could pressure rents and prices; economic softening ({{unemployment_rate}}% unemployment) could reduce demand; overvaluation ({{overvalued_pct}}%) could mean a correction. Quantify the potential impact where possible.

Paragraph 3: Provide risk mitigation guidance. Given the risk profile, what strategies should an investor use to protect against downside? Should they build in larger reserves, target different property types, or structure deals differently?

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Write in the voice of an expert investment analyst.
- Be honest about risks rather than minimizing them.
- Focus on actionable risk management, not fear-mongering.`,
    max_tokens: 400,
    output_format: 'text',
  },

  investment_thesis_narrative: {
    prompt_template: `You are a real estate investment analyst writing a strategy-specific investment thesis for {{geography_name}}.

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

Investor's Priorities: {{priorities_formatted}}
{{#if user_budget}}
- Budget: {{user_budget}}
- Target return: {{user_target_return}}%
- Strategy preference: {{user_strategy}}
{{/if}}

Write 2-3 paragraphs framing a specific investment strategy for this market.

Paragraph 1: Based on the component scores, identify the optimal investment strategy. Is this a cash-flow market (strong cash flow + rent demand), an appreciation play (strong appreciation + entry point), or a balanced opportunity? Match the thesis to what the data supports.

Paragraph 2: Detail the tactical approach. Given the cap rate of {{cap_rate}}%, rent of {{zori}}, and pricing at {{median_listing_price}}, what property type, price point, and holding period optimizes returns? How should the investor structure acquisitions?

{{#if user_budget}}Paragraph 3: Personalized strategy for an investor with a {{user_budget}} budget and {{user_target_return}}% target. How many units could they acquire? What is the projected year-1 cash flow? Does the market support their preferred strategy of {{user_strategy}}?{{/if}}

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Write in the voice of an expert investment analyst.
- Be specific about strategy recommendations, not vague.`,
    max_tokens: 400,
    output_format: 'text',
  },

  investor_bottom_line: {
    prompt_template: `You are a real estate investment analyst writing the investment verdict for {{geography_name}}.

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

Investor's Priorities: {{priorities_formatted}}
{{#if user_budget}}
Investor's Profile:
- Budget: {{user_budget}}
- Target return: {{user_target_return}}%
- Strategy: {{user_strategy}}
{{/if}}

Write 3-4 paragraphs as an investment verdict synthesis.

Paragraph 1: Lead with the investment verdict. Based on an InvestorEdge score of {{investoredge_score}}/100, clearly state whether this is a buy, hold, or pass for investors. What is the single most compelling reason to invest or stay away?

Paragraph 2: Summarize the return profile. Expected total return combining yield ({{cap_rate}}% cap rate) and appreciation ({{zhvf_1yr_pct}}% forecast). What are the 2-3 key factors that make or break the investment case?

Paragraph 3: Address the investor's priorities. For someone focused on {{priorities_formatted}}, how does this market deliver? What are the main trade-offs between yield and growth?

{{#if user_budget}}Paragraph 4: Personalized verdict. For a {{user_budget}} investor targeting {{user_target_return}}%, is this market a match? What is the recommended deployment strategy?{{/if}}

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Be decisive. State a clear buy/hold/pass recommendation.
- Write in the voice of an expert investment analyst.`,
    max_tokens: 500,
    output_format: 'text',
  },

  investor_actions: {
    prompt_template: `You are a real estate investment analyst providing actionable next steps for an investor evaluating {{geography_name}}.

Market Context:
- InvestorEdge Score: {{investoredge_score}}/100 (Grade: {{investoredge_grade}})
- Cap rate: {{cap_rate}}%
- Median price: {{median_listing_price}}
- Median rent: {{zori}}
- Days on market: {{days_on_market}}
- 1-year forecast: {{zhvf_1yr_pct}}%
- Months of supply: {{months_of_supply}}

Investor's Priorities: {{priorities_formatted}}
{{#if user_budget}}
- Budget: {{user_budget}}
- Target return: {{user_target_return}}%
{{/if}}

Generate exactly 3 specific, actionable next steps for this investor. Each action should:
1. Be concrete and specific to this market's investment conditions
2. Reference data points that inform the recommendation
3. Include specific numbers or thresholds when applicable
4. Be 1-2 sentences

Return ONLY a JSON array of 3 strings. Example format:
["Action 1 text here.", "Action 2 text here.", "Action 3 text here."]

Rules:
- Be factual and grounded in the data above.
- Each action must be specific to {{geography_name}} investment conditions.
- Focus on investment-specific actions (underwriting, due diligence, deal structuring), not generic advice.
- No speculation or fabrication.`,
    max_tokens: 300,
    output_format: 'json_array',
  },

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

Investor's Priorities: {{priorities_formatted}}

Identify 2-3 specific metrics this investor should monitor over the next 3-6 months, along with thresholds that would signal a change in the investment case.

For each metric, provide:
- "metric": The metric name
- "current_value": Its current value
- "watch_threshold": The value that would signal action
- "direction": Whether the investor wants to see this go "up" or "down"
- "rationale": One sentence explaining why this metric matters for the investment thesis

Return ONLY a JSON array of 2-3 objects. Example:
[{"metric": "Cap Rate", "current_value": "5.2%", "watch_threshold": "4.5%", "direction": "down", "rationale": "A falling cap rate signals price compression that would reduce yield below target returns."}]

Rules:
- Be factual and reference the data provided.
- Choose metrics that align with the investor's priorities.
- Set realistic thresholds based on current values and trends.
- No speculation or fabrication.`,
    max_tokens: 300,
    output_format: 'json_array',
  },
};

// ============================================================================
// Comparison Report Sections
// ============================================================================

const COMPARISON_PROMPTS: Record<string, NarrativePromptConfig> = {
  comparison_verdict: {
    prompt_template: `You are a real estate analyst writing a comparison verdict between markets for a {{user_type}}.

Markets Compared:
{{comparison_summary}}

Overall Scores:
{{comparison_scores}}

Winner: {{winner_name}} (based on priority-weighted analysis)

User's Priorities: {{priorities_formatted}}

Write 2-3 paragraphs synthesizing the comparison.

Paragraph 1: State the overall verdict clearly. {{winner_name}} wins the comparison based on the user's priorities of {{priorities_formatted}}. What is the margin of victory? Is it a clear winner or a close call?

Paragraph 2: Acknowledge the runner-up's strengths. No market is perfect - what does the losing market do better? Are there scenarios or priority sets where the other market would win?

Paragraph 3: Context and caveats. What external factors (market cycle, economic conditions, personal circumstances) could change the recommendation? What should the user investigate further?

Rules:
- Be factual. Reference specific scores and data.
- No speculation or fabrication.
- Be balanced but decisive - clearly state the winner while acknowledging trade-offs.
- Write in the voice of an expert real estate analyst.`,
    max_tokens: 400,
    output_format: 'text',
  },

  component_comparison: {
    prompt_template: `You are a real estate analyst providing a component-by-component comparison for a {{user_type}}.

Markets:
{{comparison_component_data}}

Write 2-3 paragraphs comparing the markets on each score component.

Paragraph 1: Identify where the biggest gaps exist between markets. Which components show the largest score differences? What drives those gaps?

Paragraph 2: Identify where markets are similar. Which components are essentially tied? What does that mean for the comparison?

Paragraph 3: Explain how the component mix creates different investment/buying profiles. Market A might be a "stability play" while Market B is a "growth bet." Characterize each market's profile based on component strengths.

Rules:
- Be factual. Reference specific component scores.
- No speculation or fabrication.
- Use specific numbers to support every comparison point.
- Write in the voice of an expert real estate analyst.`,
    max_tokens: 400,
    output_format: 'text',
  },

  priority_analysis: {
    prompt_template: `You are a real estate analyst explaining how the user's priorities determined the winner in a market comparison.

Winner: {{winner_name}}
User Type: {{user_type}}

Priority Analysis:
{{priority_analysis_data}}

User's Priorities (in order): {{priorities_formatted}}

Write 1-2 paragraphs explaining how the user's specific priorities led to this winner.

Paragraph 1: Walk through each priority. For their #1 priority, which market won and by how much? Repeat for priorities #2 and #3. Show how the weighting (3x for #1, 2x for #2, 1x for #3) affected the outcome.

Paragraph 2: Explain what would change the result. If the user had different priorities, would the winner change? Which alternative priority set would flip the outcome?

Rules:
- Be factual. Reference specific priority scores and metrics.
- No speculation or fabrication.
- Help the user understand that the recommendation is driven by THEIR priorities.
- Write in the voice of an expert real estate analyst.`,
    max_tokens: 300,
    output_format: 'text',
  },
};

// ============================================================================
// Combined Export
// ============================================================================

/**
 * All narrative prompt configurations keyed by section ID.
 * Used by ReportsService.generateSectionNarratives() to produce
 * per-section AI narratives.
 */
export const NARRATIVE_PROMPTS: Record<string, NarrativePromptConfig> = {
  ...HOMEREADY_PROMPTS,
  ...INVESTOR_PROMPTS,
  ...COMPARISON_PROMPTS,
};

/**
 * Section IDs grouped by report type for selective generation.
 */
export const SECTIONS_BY_REPORT_TYPE = {
  homeready: [
    'hero_verdict',
    'score_story',
    'affordability_narrative',
    'market_timing_narrative',
    'stability_narrative',
    'growth_potential_narrative',
    'priorities_narrative',
    'bottom_line_narrative',
    'bottom_line_actions',
    'bottom_line_watch',
  ],
  investoredge: [
    'investor_hero_verdict',
    'investor_score_story',
    'cash_flow_narrative',
    'rent_demand_narrative',
    'appreciation_narrative',
    'entry_point_narrative',
    'risk_narrative',
    'investment_thesis_narrative',
    'investor_bottom_line',
    'investor_actions',
    'investor_watch',
  ],
  comparison: [
    'comparison_verdict',
    'component_comparison',
    'priority_analysis',
  ],
} as const;

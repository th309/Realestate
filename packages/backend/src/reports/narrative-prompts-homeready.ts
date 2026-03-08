/**
 * HomeReady Report Narrative Prompts (Enhanced)
 *
 * 10 section prompts for homebuyer-focused reports.
 * Each prompt composes shared building blocks (persona, quality standards,
 * news integration) with section-specific analysis instructions.
 *
 * Note: This file exceeds the normal 300-line limit because it contains
 * declarative prompt templates (large string constants), not code logic.
 */

import {
  ANALYST_PERSONA_HOMEBUYER,
  ANTI_PATTERNS,
  NEWS_INTEGRATION_INSTRUCTIONS,
  CROSS_SECTION_CONTEXT_BLOCK,
  QUALITY_STANDARDS,
  WRITING_RULES,
  type NarrativePromptConfig,
} from './narrative-prompt-shared';

export const HOMEREADY_PROMPTS: Record<string, NarrativePromptConfig> = {
  hero_verdict: {
    prompt_template: `You are a senior real estate analyst writing a one-sentence verdict about the housing market in {{geography_name}}.

Data:
- HomeReady Score: {{homeready_score}}/100 (Grade: {{homeready_grade}})
- Median listing price: {{median_listing_price}}
- Year-over-year price change: {{zhvi_yoy}}%
- Days on market: {{days_on_market}}
- Market heat index: {{hotness_score}}
- Overall Score: {{overall_score}}/100 ({{overall_grade}})
- Strongest component: {{strongest_component}} ({{strongest_score}}/100)
- Weakest component: {{weakest_component}} ({{weakest_score}}/100)

Write ONE sentence (max 30 words) that a homebuyer would remember and quote to their spouse. It should capture the single most important thing about this market RIGHT NOW. Not a summary — a verdict.

BAD: "The market shows mixed signals with moderate growth."
GOOD: "At $302,000 with homes selling in 18 days, this is a seller's market that punishes hesitation — but rising inventory hints at a window opening."

Rules:
- Exactly one sentence, no more than 30 words.
- Be factual and specific. Reference at least one number from the data.
- No generic filler phrases like "a mixed bag," "something for everyone," or "shows promise."
- No speculation or fabrication.
- Tone: confident expert analyst delivering a verdict, not a summary.`,
    max_tokens: 150,
    output_format: 'text',
  },

  score_story: {
    prompt_template: `${ANALYST_PERSONA_HOMEBUYER}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${QUALITY_STANDARDS}

${NEWS_INTEGRATION_INSTRUCTIONS}

Score Summary:
- Overall HomeReady Score: {{homeready_score}}/100 (Grade: {{homeready_grade}})
- Affordability component: {{affordability_score}}/100 ({{affordability_status}})
- Market Timing component: {{market_timing_score}}/100 ({{market_timing_status}})
- Stability component: {{stability_score}}/100 ({{stability_status}})
- Growth Potential component: {{growth_potential_score}}/100 ({{growth_potential_status}})
- Strongest component: {{strongest_component}} ({{strongest_score}}/100)
- Weakest component: {{weakest_component}} ({{weakest_score}}/100)
- Key market tension: {{key_tension}}

Write 3-4 paragraphs that tell the STORY behind the score. Don't just list components — explain how they interact to create this market's personality. A market with high affordability but low stability tells a different story than one with the reverse.

BAD: "The affordability score is 82, which is strong. Market timing scored 45, indicating a seller's market. Stability is at 71."
GOOD: "This market's personality is defined by a tension: it's one of the more affordable metros in the region (affordability at 82), but that affordability comes with a catch — you're buying into a seller's market where homes move fast and negotiating leverage is limited (market timing at 45). The silver lining? Once you're in, the stability score of 71 suggests your investment is well-protected — this market has shown consistent, if unspectacular, appreciation without the boom-bust cycles that plague faster-growing metros."

If news/market intelligence is provided, reference what's DRIVING the score components — employer moves, development, policy changes.

Rules:
- Tell a story, not a list. Connect the components into a narrative arc.
- Identify the defining tension or harmony between components.
- Reference specific component scores as evidence, not as the point.
- If the score is above 80, explain what makes this market special. If below 50, be honest about why.
- No speculation or fabrication.`,
    max_tokens: 800,
    output_format: 'text',
  },

  affordability_narrative: {
    prompt_template: `${ANALYST_PERSONA_HOMEBUYER}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${QUALITY_STANDARDS}

${WRITING_RULES}

${NEWS_INTEGRATION_INSTRUCTIONS}

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
- Overall Score: {{overall_score}}/100 ({{overall_grade}})
- Strongest component: {{strongest_component}} ({{strongest_score}}/100)
- Weakest component: {{weakest_component}} ({{weakest_score}}/100)
- Key market tension: {{key_tension}}
{{#if user_income}}
- Buyer's household income: {{user_income}}
- Buyer's down payment: {{user_down_payment}}
- Buyer's target price range: {{user_budget}}
{{/if}}

Write 3-4 paragraphs interpreting the affordability data.

Paragraph 1 (The Reality Check): Don't just say "the median price is X." Calculate what this means: What monthly payment does {{median_listing_price}} translate to at current rates? How does that compare to {{median_income}}? What percentage of local households can actually afford to buy here? Frame affordability as a lived experience, not an abstract index.

Paragraph 2 (The Trend Story): Affordability is not static. Connect the price trend ({{zhvi_yoy}}% YoY) to income growth (if available). Is the gap widening or narrowing? Compare to national ({{national_median_price}}) and state ({{state_median_price}}) benchmarks — but explain what the comparison means, don't just state it.

Paragraph 3 (The Scenario): Include one forward-looking scenario: "If current appreciation of {{zhvi_yoy}}% continues and mortgage rates [stay/rise/fall], a household at the median income will [gain/lose] purchasing power over the next 12 months." Be specific with the math.

{{#if user_income}}Paragraph 4 (Your Situation): This is the $500 section — where the reader feels the report was written for THEM. With income of {{user_income}} and down payment of {{user_down_payment}}, calculate their monthly payment, their DTI ratio, and whether they're above or below the income needed to buy ({{income_needed_to_buy}}). Don't just compare numbers — tell them what it means: "You're in a strong position to..." or "You'll need to stretch to..."{{/if}}

BAD: "The median price is $425,000, which is above the national average of $380,000. The affordability index is 95."
GOOD: "At $425,000, the typical home here requires about $2,850/month in mortgage payments (assuming 20% down at current rates) — that's 34% of the median household income of $98,000. Translation: the median household is right at the edge of conventional lending guidelines, leaving almost no cushion for property taxes, insurance, or the unexpected $15,000 HVAC replacement."

Rules:
- Frame every number as a lived experience or a decision-relevant insight.
- If a data point is "N/A", acknowledge the gap and focus on available data.
- No speculation or fabrication.`,
    max_tokens: 2000,
    output_format: 'text',
  },

  market_timing_narrative: {
    prompt_template: `${ANALYST_PERSONA_HOMEBUYER}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${QUALITY_STANDARDS}

${WRITING_RULES}

${NEWS_INTEGRATION_INSTRUCTIONS}

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
- Overall Score: {{overall_score}}/100 ({{overall_grade}})
- Strongest component: {{strongest_component}} ({{strongest_score}}/100)
- Weakest component: {{weakest_component}} ({{weakest_score}}/100)
- Key market tension: {{key_tension}}
- User profile: {{user_goal_summary}}

Market Classification: {{market_type}}
Market Balance Context:
- Buyer's market threshold: >6 months supply, >15% price cuts
- Balanced market: 4-6 months supply, 10-15% price cuts
- Seller's market threshold: <4 months supply, <10% price cuts

Write 4 paragraphs analyzing market timing.

Paragraph 1 (Market Type): This is a {{market_type}}. State this classification clearly in the opening sentence. Then quantify what it means: with {{months_of_supply}} months of supply and {{price_cut_pct}}% price cuts, tell the buyer exactly what they'll face: "Expect to compete with X other offers" or "You have room to negotiate — one in five sellers is already cutting prices." Connect demand score, pending ratio, and days on market into a cohesive picture.

Paragraph 2 (The Timing Window): This is where you earn the $500. Use the inventory trend ({{inventory_yoy}}%), forecast ({{zhvf_1yr_pct}}%), and current momentum to assess: Is the window opening, closing, or stable? "Inventory is rising {{inventory_yoy}}% year-over-year, which means the competitive pressure you'd face today will likely ease by [timeframe]. But the forecast of {{zhvf_1yr_pct}}% appreciation means waiting costs approximately $X per month in price appreciation."

Paragraph 3 (Tactical Advice): Give specific, actionable guidance: offer strategy (what percentage of list price to offer given sale-to-list of {{sale_to_list_ratio}}), contingency advice (can you afford inspection contingencies in this market?), and timing (which months/seasons are best for this market based on DOM trends).

Paragraph 4 (Scenario): "If rates drop 50bps in the next 6 months, expect [specific impact on this market]. If rates rise, [specific impact]." Ground scenarios in this market's data.

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Connect multiple data points into each insight — don't treat metrics in isolation.
- If a data point is "N/A", acknowledge the gap and focus on available data.`,
    max_tokens: 2000,
    output_format: 'text',
  },

  stability_narrative: {
    prompt_template: `${ANALYST_PERSONA_HOMEBUYER}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${QUALITY_STANDARDS}

${WRITING_RULES}

${NEWS_INTEGRATION_INSTRUCTIONS}

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
- Overall Score: {{overall_score}}/100 ({{overall_grade}})
- Strongest component: {{strongest_component}} ({{strongest_score}}/100)
- Weakest component: {{weakest_component}} ({{weakest_score}}/100)
- Key market tension: {{key_tension}}
- User profile: {{user_goal_summary}}

Write 3 paragraphs analyzing market stability and predictability.

Paragraph 1 (Predictability Assessment): Frame stability as the "sleep at night" factor. A stability score of {{stability_score}} means... Connect DOM consistency, price cut frequency, and appreciation volatility into a story about how predictable this market is. A buyer needs to know: if I buy here, will the value be roughly the same or higher in 3 years, or could I be underwater?

Paragraph 2 (Historical Resilience): This is the "stress test" paragraph. How did this market handle 2007-2012? ({{zhvi_vs_2007_peak}}% vs peak). How about COVID? ({{zhvi_vs_pre_covid}}% vs pre-COVID). Compare 1Y/3Y/5Y appreciation rates — if they're consistent, that's stability. If they vary wildly, that's volatility. Name it.

Paragraph 3 (Risk Factors): What could destabilize this market? Be specific: employer concentration, climate exposure, insurance costs, regulatory changes. If news mentions any of these, weave them in. End with: "For a homebuyer planning to hold for [5-7 years], the stability profile suggests [specific assessment of value protection]."

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Frame stability through the lens of a homebuyer's biggest fear: losing equity.
- If a data point is "N/A", acknowledge the gap and focus on available data.`,
    max_tokens: 2000,
    output_format: 'text',
  },

  growth_potential_narrative: {
    prompt_template: `${ANALYST_PERSONA_HOMEBUYER}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${QUALITY_STANDARDS}

${WRITING_RULES}

${NEWS_INTEGRATION_INSTRUCTIONS}

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
- Median listing price: {{median_listing_price}}
- Overall Score: {{overall_score}}/100 ({{overall_grade}})
- Strongest component: {{strongest_component}} ({{strongest_score}}/100)
- Weakest component: {{weakest_component}} ({{weakest_score}}/100)
- Key market tension: {{key_tension}}
- User profile: {{user_goal_summary}}

Write 3 paragraphs analyzing growth potential and appreciation drivers.

Paragraph 1 (Economic Engine): Don't just list economic metrics — tell the story of what's driving this economy. Population growth of {{population_growth_yoy}}% means X new residents per year needing housing. Job growth of {{job_growth_yoy}}% in a market with {{unemployment_rate}}% unemployment means [tight/loose] labor market. Net migration of {{net_migration}} tells you whether people are voting with their feet.

Paragraph 2 (Appreciation Quality): Not all appreciation is equal. Compare 1Y ({{zhvi_yoy}}%), 3Y ({{zhvi_3y_cagr}}%), and 5Y ({{zhvi_5y_cagr}}%) rates. Is appreciation accelerating, steady, or decelerating? Is it driven by fundamentals (income growth, population) or speculation? The forecast of {{zhvf_1yr_pct}}% should be contextualized against the drivers.

Paragraph 3 (Your Equity Outlook): For someone buying at {{median_listing_price}}, a growth score of {{growth_potential_score}} implies approximately $X in equity gain over 3 years and $Y over 5 years based on historical rates. What are the key drivers to watch that could accelerate or slow this? If news mentions employer expansion, infrastructure, or demographic shifts, connect them to equity outlook.

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Translate abstract growth metrics into dollar amounts of equity for the buyer.
- If a data point is "N/A", acknowledge the gap and focus on available data.`,
    max_tokens: 2000,
    output_format: 'text',
  },

  priorities_narrative: {
    prompt_template: `${ANALYST_PERSONA_HOMEBUYER}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${QUALITY_STANDARDS}

${WRITING_RULES}

${NEWS_INTEGRATION_INSTRUCTIONS}

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
- Overall Score: {{overall_score}}/100 ({{overall_grade}})
- Strongest component: {{strongest_component}} ({{strongest_score}}/100)
- Weakest component: {{weakest_component}} ({{weakest_score}}/100)
- Key market tension: {{key_tension}}
{{#if user_income}}
- Buyer's income: {{user_income}}
- Buyer's down payment: {{user_down_payment}}
- Buyer's timeline: {{user_timeline}}
{{/if}}

This section is the PERSONALIZATION centerpiece. The reader chose their priorities — now show them you listened.

Paragraph 1: Their #1 priority gets a deep dive. Don't just say "affordability scores 82." Say "You told us affordability matters most, and this market delivers: at {{median_listing_price}}, you're looking at a market that's [X]% below the state median, where a household at your income level can comfortably qualify for [X-Y price range]. The affordability component score of {{affordability_score}} puts this in the top [X]% of metros we track."

Paragraph 2: Address ALL remaining priorities with honest assessment of trade-offs. "The trade-off for this affordability is [specific weakness]. Your second priority of [X] scores [Y], which means [specific implication]."

{{#if user_income}}Paragraph 3: Tie priorities to their financial situation. "Given your income of {{user_income}} and {{user_timeline}} timeline, this market's priority alignment means [specific recommendation]."{{/if}}

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Directly address the buyer's stated priorities — do not discuss irrelevant topics.
- Be honest about trade-offs rather than overly optimistic.
- Make the reader feel this section was written specifically for them, not copy-pasted.`,
    max_tokens: 2000,
    output_format: 'text',
  },

  bottom_line_narrative: {
    prompt_template: `${ANALYST_PERSONA_HOMEBUYER}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${QUALITY_STANDARDS}

${WRITING_RULES}

${NEWS_INTEGRATION_INSTRUCTIONS}

Overall Assessment:
- HomeReady Score: {{homeready_score}}/100 (Grade: {{homeready_grade}})
- Market Health Score: {{markethealth_score}}/100

Score Components:
- Affordability: {{affordability_score}}/100 ({{affordability_status}})
- Market Timing: {{market_timing_score}}/100 ({{market_timing_status}})
- Stability: {{stability_score}}/100 ({{stability_status}})
- Growth Potential: {{growth_potential_score}}/100 ({{growth_potential_status}})
- Strongest component: {{strongest_component}} ({{strongest_score}}/100)
- Weakest component: {{weakest_component}} ({{weakest_score}}/100)
- Key market tension: {{key_tension}}

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
- User profile: {{user_goal_summary}}
{{/if}}

This is the section the reader skips to first. It must be DEFINITIVE, SPECIFIC, and ACTIONABLE.

Paragraph 1 (The Verdict): Lead with a clear YES/NO/WAIT recommendation. "With a HomeReady score of {{homeready_score}} ({{homeready_grade}}), {{geography_name}} is a [strong/moderate/weak] buy right now. The market's strongest suit is {{strongest_component}} at {{strongest_score}}, which means [specific benefit]. The main concern is {{weakest_component}} at {{weakest_score}}, which means [specific risk]."

Paragraph 2 (The 3 Things): "The three most important things you need to know about this market right now: (1) [Specific finding with data]... (2) [Specific finding with data]... (3) [Specific finding with data]..." Each point should connect multiple data points and include news context if available.

Paragraph 3 (Priority Alignment): Reframe the verdict through the buyer's priorities. Be honest about misalignment.

{{#if user_income}}Paragraph 4 (Your Decision): "For you specifically — with {{user_income}} income, {{user_down_payment}} down, and a {{user_timeline}} timeline — here's what I'd recommend: [specific actionable advice]. The math: [monthly payment estimate, DTI ratio, cushion analysis]."{{/if}}

Paragraph 5 (Scenario): One best-case and one worst-case scenario, each grounded in specific data trends and news. "Best case: if [specific trend] continues, you're looking at [specific outcome]. Worst case: if [specific risk] materializes, expect [specific impact]."

Rules:
- Be factual. Reference specific numbers from the data above.
- No speculation or fabrication.
- Be decisive — state a clear recommendation, not wishy-washy hedging.
- This is the executive synthesis. Every sentence must earn its place.
- If the data says "don't buy here," say it plainly.`,
    max_tokens: 3000,
    output_format: 'text',
  },

  bottom_line_actions: {
    prompt_template: `${ANALYST_PERSONA_HOMEBUYER}

${ANTI_PATTERNS}

Market Context:
- HomeReady Score: {{homeready_score}}/100 (Grade: {{homeready_grade}})
- Market type: {{market_timing_status}} market timing
- Days on market: {{days_on_market}}
- Price cuts: {{price_cut_pct}}%
- 1-year forecast: {{zhvf_1yr_pct}}%
- Months of supply: {{months_of_supply}}
- Sale-to-list ratio: {{sale_to_list_ratio}}
- Median listing price: {{median_listing_price}}
- Overall Score: {{overall_score}}/100 ({{overall_grade}})
- Strongest component: {{strongest_component}} ({{strongest_score}}/100)
- Weakest component: {{weakest_component}} ({{weakest_score}}/100)
- Key market tension: {{key_tension}}

Buyer's Priorities: {{priorities_formatted}}
{{#if user_income}}
Buyer's Profile:
- Income: {{user_income}}
- Down payment: {{user_down_payment}}
- Timeline: {{user_timeline}}
- User profile: {{user_goal_summary}}
{{/if}}

Generate exactly 3 specific, actionable next steps. Each action must:
1. Be specific to {{geography_name}} market conditions — not generic homebuying advice
2. Reference a data point or market condition that drives the recommendation
3. Include a specific timeframe, threshold, or number
4. Be 2-3 sentences (not 1)
5. If news mentions a relevant development (new construction, policy change, rate trend), factor it into the action

BAD: "Get pre-approved for a mortgage."
GOOD: "Get pre-approved NOW and target listings at $380K-$420K — with homes selling in {{days_on_market}} days and only {{price_cut_pct}}% seeing price cuts, you need to move fast. Lock your rate within 30 days; the Fed's latest signal suggests rates may tick up in Q2."

Return ONLY a JSON array of 3 strings. Example format:
["Action 1 text here. More detail.", "Action 2 text here. More detail.", "Action 3 text here. More detail."]

Rules:
- Be factual and grounded in the data above.
- Each action must be specific to {{geography_name}}, not generic homebuying advice.
- Tailor actions to the buyer's priorities when possible.
- No speculation or fabrication.`,
    max_tokens: 500,
    output_format: 'json_array',
  },

  bottom_line_watch: {
    prompt_template: `You are a senior real estate analyst identifying key metrics for a homebuyer to monitor in {{geography_name}}.

Current Market Snapshot:
- HomeReady Score: {{homeready_score}}/100
- Days on market: {{days_on_market}}
- Months of supply: {{months_of_supply}}
- Price cuts: {{price_cut_pct}}%
- Inventory YoY change: {{inventory_yoy}}%
- Year-over-year price change: {{zhvi_yoy}}%
- 1-year forecast: {{zhvf_1yr_pct}}%
- Demand score: {{demand_score}}
- Overall Score: {{overall_score}}/100 ({{overall_grade}})
- Strongest component: {{strongest_component}} ({{strongest_score}}/100)
- Weakest component: {{weakest_component}} ({{weakest_score}}/100)

Buyer's Priorities: {{priorities_formatted}}

Identify 2-3 specific metrics this buyer should monitor over the next 3-6 months, along with thresholds that would signal a change in market conditions.

For each metric, provide:
- "metric": The metric name
- "current_value": Its current value (from the data above)
- "watch_threshold": The value that would signal action (buy signal or caution signal)
- "direction": Whether the buyer wants to see this go "up" or "down"
- "rationale": One sentence (max 25 words) explaining WHY this threshold matters for the buyer's decision, not just what direction to watch

BAD rationale: "Rising supply is good for buyers."
GOOD rationale: "At 5+ months supply, sellers lose leverage and you can negotiate inspection contingencies back into offers."

Return ONLY a valid JSON array of 2-3 objects, no markdown, no code fences. Example:
[{"metric": "Months of Supply", "current_value": "3.2", "watch_threshold": "4.5", "direction": "up", "rationale": "At 4.5+ months, buyer leverage increases enough to negotiate 3-5% below list price."}]

Rules:
- Return ONLY the JSON array, nothing else.
- Keep rationale to ONE sentence (under 25 words) that explains WHY the threshold matters.
- Be factual and reference the data provided.
- Choose metrics that align with the buyer's priorities.
- Set realistic thresholds based on current values.`,
    max_tokens: 500,
    output_format: 'json_array',
  },
};

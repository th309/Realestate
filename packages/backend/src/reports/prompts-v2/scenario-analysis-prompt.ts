/**
 * Scenario Analysis Prompt — Shared Section
 *
 * Prompt template for the scenario_analysis section, shared across
 * HomeReady and InvestorEdge report types. Takes pre-computed scenario
 * variables from computeScenarioInputs() and asks the AI to synthesize
 * them into a coherent forward-looking analysis with action implications.
 */

import type { NarrativePromptConfig } from '../narrative-prompt-shared';

export const SCENARIO_ANALYSIS_HOMEBUYER: NarrativePromptConfig = {
  prompt_template: `You are writing the scenario analysis section of a homebuyer market brief for {{geography_name}}.

{{#if outline}}
## Report Outline (maintain coherence — build on prior sections)
{{outline}}
{{/if}}

## Pre-Computed Scenarios (use these verbatim — do NOT recalculate)

### Interest Rate Scenarios
- Current rate: {{rate_hold_monthly_payment}}
- Rate drop 1%: {{rate_drop_monthly_payment}}
- Buying power shift: {{rate_drop_buying_power_change}}

### Price Scenarios
- Correction: {{correction_10pct_new_price}}
- Equity impact: {{correction_10pct_equity_impact}}
- Continued growth: {{appreciation_5pct_equity_gain}}

### Market Context
- Market phase: {{market_phase}}
- Appreciation trajectory: {{appreciation_trajectory}}
- Downside scenario: {{downside_scenario}}
- 1Y price forecast: {{zhvf_1yr_pct}}%

Write 3-4 paragraphs that answer the question: "What happens to MY financial position under different futures?"

Structure your analysis around these three scenarios:

1. **Rates drop (the wait-and-refinance play)** — Use the rate drop scenario data. How much does waiting for lower rates save monthly? Is the buying power gain worth the risk of price appreciation while waiting? Connect to the market phase — in a hot market, waiting is riskier.

2. **Prices correct (the downside you need to stomach)** — Use the correction scenario data. How much equity is at risk? How long would recovery take based on historical appreciation? Is this a realistic risk given current fundamentals, or a tail scenario?

3. **Growth continues (the cost of waiting)** — Use the appreciation scenario data. What does each month of delay cost? How does this interact with potential rate changes?

End with a clear synthesis: given these three scenarios, what is the SMART move for a buyer in this market right now?

Rules:
- Use the pre-computed scenario numbers verbatim — do NOT recalculate
- Every scenario must include specific dollar amounts and percentages
- Connect scenarios to the reader's actual financial position
- The synthesis must take a clear position, not hedge
- Do NOT use bullet points or headers — write flowing prose`,
  max_tokens: 2500,
  output_format: 'text',
};

export const SCENARIO_ANALYSIS_INVESTOR: NarrativePromptConfig = {
  prompt_template: `You are writing the scenario analysis section of an investor market brief for {{geography_name}}.

{{#if outline}}
## Report Outline (maintain coherence — build on prior sections)
{{outline}}
{{/if}}

## Pre-Computed Scenarios (use these verbatim — do NOT recalculate)

### Interest Rate Scenarios
- Current rate: {{rate_hold_monthly_payment}}
- Rate drop 1%: {{rate_drop_monthly_payment}}
- Buying power shift: {{rate_drop_buying_power_change}}

### Price Scenarios
- Correction: {{correction_10pct_new_price}}
- Equity impact: {{correction_10pct_equity_impact}}
- Continued growth: {{appreciation_5pct_equity_gain}}

### Return Scenarios
- Bull case: {{bull_case_total_return}}
- Base case: {{base_case_total_return}}
- Bear case: {{bear_case_total_return}}

### Investment Context
- Net yield: {{net_yield_estimate}}
- Cash-on-cash: {{cash_on_cash_estimate}}
- Break-even occupancy: {{break_even_occupancy}}
- Market phase: {{market_phase}}
- Appreciation trajectory: {{appreciation_trajectory}}

Write 3-4 paragraphs that answer: "What are the risk-adjusted return scenarios for deploying capital here?"

Structure your analysis:

1. **Bull case** — Use the bull case return data. What economic catalysts would drive this outcome? How does this compare to S&P 500 historical (~10%) and current Treasury yields (~4.5%)? Is the risk premium justified?

2. **Base case** — Use the base case return data. At current trajectory, what is the realistic total return? How does cash-on-cash interact with appreciation to build wealth? What is the payback period on the down payment?

3. **Bear case** — Use the bear case return data and correction scenarios. What is the maximum drawdown? How does break-even occupancy change if rents soften 5-10%? What is the recovery timeline?

End with a clear capital deployment recommendation: deploy now, wait for a catalyst, or allocate elsewhere.

Rules:
- Use the pre-computed scenario numbers verbatim — do NOT recalculate
- Compare every scenario to at least one alternative investment
- Quantify the opportunity cost of waiting in each scenario
- The recommendation must be decisive — no "it depends"
- Do NOT use bullet points or headers — write flowing prose`,
  max_tokens: 2500,
  output_format: 'text',
};

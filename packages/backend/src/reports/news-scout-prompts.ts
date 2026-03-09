/**
 * News Scout - Prompt templates for news scouting API calls.
 *
 * Provider-agnostic prompts that work with any AI model.
 * Extracted to keep file sizes under 300 lines per CLAUDE.md Section 1.3.
 */

// -----------------------------------------------------------------------------
// LOCAL NEWS PROMPT
// -----------------------------------------------------------------------------

/**
 * Build the comprehensive scout prompt for local news scouting.
 */
export function buildScoutPrompt(
  geographyName: string,
  state: string,
  geographyType: string,
  lookbackDays: number,
  maxItems: number,
): string {
  const locationContext =
    geographyType === 'zip'
      ? `the ${geographyName} ZIP code area in ${state}`
      : geographyType === 'county'
        ? `${geographyName} County, ${state}`
        : `the ${geographyName} metropolitan area`;

  return `You are a real estate market research analyst. Provide the most recent and impactful news, economic indicators, and market signals affecting the real estate market in ${locationContext}.

Focus on the last ${lookbackDays} days across: employer/jobs news, housing development, policy changes, infrastructure projects, climate/insurance events, and market reports.

If information specific to "${geographyName}" is limited, broaden to the surrounding region, county, or state level. There is ALWAYS relevant state-level and national real estate news — include it. For smaller markets, regional economic trends (university enrollment, major employers, agricultural economy, state policy changes) are especially important.

Provide the top ${maxItems} most impactful items.

## OUTPUT FORMAT (JSON)

\`\`\`json
{
  "local_news": [
    {
      "headline": "Headline text",
      "summary": "2-3 sentence summary",
      "source": "Publication name",
      "url": null,
      "published_date": "2026-01-15",
      "relevance": "high|medium|low",
      "category": "employer_expansion|employer_layoffs|development_residential|etc",
      "sentiment": "positive|negative|neutral",
      "impact_on_real_estate": "How this affects housing demand/prices"
    }
  ],
  "economic_indicators": [
    {
      "indicator_name": "Unemployment Rate",
      "geography_level": "local|state|national",
      "current_value": "3.2%",
      "previous_value": "3.5%",
      "change_description": "Decreased 0.3 points",
      "release_date": "2026-01-10",
      "source": "BLS",
      "source_url": null,
      "impact_on_housing": "positive|negative|neutral",
      "impact_explanation": "Lower unemployment supports housing demand"
    }
  ],
  "market_signals": [
    {
      "signal_type": "bullish|bearish|neutral",
      "headline": "Signal headline",
      "description": "What this signal means",
      "source": "Source name",
      "source_url": null,
      "confidence": "high|medium|low"
    }
  ]
}
\`\`\`

## CATEGORY VALUES
- Employer: employer_expansion, employer_hiring, employer_layoffs, employer_relocation, employer_new_facility
- Development: development_residential, development_commercial, development_industrial
- Policy: policy_zoning, policy_taxes, policy_housing, policy_short_term
- Infrastructure: infrastructure_transit, infrastructure_roads, infrastructure_utilities, infrastructure_airport
- Climate: climate_disaster, climate_risk, climate_insurance
- Community: crime_trends, education_schools, education_university, healthcare
- Market: market_report, market_investment, demographic_migration, demographic_growth

## GUIDELINES
1. Quality over quantity - max ${maxItems} news items
2. Use actual publication dates when known
3. Only report factual news and trends, no speculation
4. JSON string values must be plain text only — no HTML tags or markup
5. Return ONLY the JSON object, no additional text

Compile results for ${locationContext}:`;
}

// -----------------------------------------------------------------------------
// NATIONAL CONTEXT PROMPT
// -----------------------------------------------------------------------------

/**
 * Build the prompt for fetching national economic context.
 */
export function buildNationalContextPrompt(): string {
  return `Provide the most recent national economic and housing data affecting US real estate:

1. Federal Reserve interest rate decisions or commentary (most recent)
2. Current mortgage rate trends (30-year fixed)
3. National housing market conditions (inventory, prices, sales)
4. Overall economic outlook

Return as JSON only:
{
  "fed_rate_news": "Summary of most recent Fed decision or commentary",
  "mortgage_rate_trend": "Current 30-year rate and recent trend",
  "national_housing_news": ["2-3 relevant national headlines"],
  "economic_outlook": "1-2 sentence summary"
}`;
}

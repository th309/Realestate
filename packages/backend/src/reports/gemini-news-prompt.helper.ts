/**
 * Gemini News Scout — prompt construction (pure)
 *
 * Extracted from gemini-news.service.ts for file-size compliance.
 * String content is preserved exactly; do not "clean up" the prompt.
 */

/**
 * Build the comprehensive scout prompt
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

  return `You are a real estate market research analyst. Search for recent news, economic indicators, and market signals that could impact the real estate market in ${locationContext}.

## SEARCH FOCUS (Last ${lookbackDays} days)

### 1. EMPLOYER & JOBS NEWS (High Impact)
- Company expansions, new headquarters, hiring announcements
- New manufacturing plants, data centers, distribution centers
- Layoffs, plant closures, companies leaving
- Search: "${geographyName} ${state} jobs hiring", "${geographyName} company expansion", "${geographyName} layoffs"

### 2. DEVELOPMENT NEWS
- New housing developments, apartments, townhomes
- Commercial projects, mixed-use developments
- Industrial/warehouse facilities
- Search: "${geographyName} housing development", "${geographyName} apartments construction"

### 3. POLICY & REGULATION
- Zoning changes, rent control, property tax changes
- Housing policy, ADU laws, short-term rental rules
- Search: "${geographyName} zoning", "${geographyName} property tax", "${geographyName} housing policy"

### 4. INFRASTRUCTURE
- Transit expansions, highway projects, airport improvements
- Search: "${geographyName} transit", "${geographyName} infrastructure"

### 5. CLIMATE & ENVIRONMENT
- Recent weather events, flood zones, wildfire risk, insurance issues
- Search: "${geographyName} flood", "${geographyName} insurance"

### 6. ECONOMIC INDICATORS
- Unemployment rate, job growth, building permits
- Search: "${state} unemployment", "${geographyName} job growth"

### 7. MARKET SIGNALS
- Real estate market reports, investor activity, migration trends
- Search: "${geographyName} real estate market", "${geographyName} housing market"

## OUTPUT FORMAT (JSON)

\`\`\`json
{
  "local_news": [
    {
      "headline": "Exact headline",
      "summary": "2-3 sentence summary",
      "source": "Publication name",
      "url": "https://...",
      "published_date": "2025-01-15",
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
      "release_date": "2025-01-10",
      "source": "BLS",
      "source_url": "https://...",
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
      "source_url": "https://...",
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
2. Include source URLs when available
3. Use actual publication dates
4. Only report factual news, no speculation

Search and compile results for ${locationContext}:`;
}

/**
 * News Enhancement for Report Narratives
 *
 * Builds section-specific news context and instructions for AI narrative prompts.
 * Each report section gets news filtered to its relevant categories, plus
 * section-specific instructions for how to incorporate the news.
 *
 * Extracted from ClaudeService to keep file sizes manageable.
 */

/** News categories relevant to each report section. */
const SECTION_NEWS_CATEGORIES: Record<string, string[]> = {
  hero_verdict: [], // Gets signal summary only, no full news
  score_story: [
    'market_report',
    'market_investment',
    'employer_expansion',
    'employer_layoffs',
  ],
  affordability_narrative: [
    'employer_hiring',
    'employer_expansion',
    'employer_layoffs',
    'policy_housing',
    'policy_taxes',
    'development_residential',
    'demographic_migration',
    'demographic_growth',
  ],
  market_timing_narrative: [
    'market_report',
    'market_investment',
    'development_residential',
    'development_commercial',
    'policy_zoning',
    'policy_housing',
  ],
  stability_narrative: [
    'climate_disaster',
    'climate_risk',
    'climate_insurance',
    'policy_taxes',
    'policy_zoning',
    'market_report',
  ],
  growth_potential_narrative: [
    'employer_expansion',
    'employer_hiring',
    'employer_new_facility',
    'employer_relocation',
    'infrastructure_transit',
    'infrastructure_roads',
    'infrastructure_airport',
    'development_commercial',
    'development_industrial',
    'demographic_migration',
    'demographic_growth',
    'education_university',
  ],
  bottom_line_narrative: [], // Gets all high-relevance news
  bottom_line_actions: [], // Gets signal summary only
};

/**
 * Build section-specific news enhancement from raw news data.
 * Filters news items by category relevance to the section.
 */
export function buildNewsEnhancementForSection(
  context: Record<string, any>,
  sectionId: string,
): string | null {
  const newsItems: any[] = context.raw_news_items || [];
  const indicators: any[] = context.raw_economic_indicators || [];
  const signals: any[] = context.raw_market_signals || [];
  const signalSummary: string | null = context.market_signal_summary || null;
  const nationalContext: any = context.raw_national_context || null;

  if (
    newsItems.length === 0 &&
    indicators.length === 0 &&
    signals.length === 0
  ) {
    return null;
  }

  const parts: string[] = [];
  parts.push('\n\n---\nMARKET INTELLIGENCE\n');

  // Filter news by section-relevant categories
  const relevantCategories = SECTION_NEWS_CATEGORIES[sectionId];
  let filteredNews: any[];

  if (!relevantCategories || relevantCategories.length === 0) {
    if (sectionId === 'bottom_line_narrative') {
      filteredNews = newsItems
        .filter((n: any) => n.relevance === 'high')
        .slice(0, 5);
    } else {
      filteredNews = [];
    }
  } else {
    filteredNews = newsItems
      .filter((n: any) => relevantCategories.includes(n.category))
      .slice(0, 4);
    if (filteredNews.length === 0) {
      filteredNews = newsItems
        .filter((n: any) => n.relevance === 'high')
        .slice(0, 3);
    }
  }

  if (filteredNews.length > 0) {
    parts.push('## RELEVANT NEWS\n');
    for (const item of filteredNews) {
      parts.push(`**${item.headline}** (${item.source})`);
      parts.push(`${item.summary}`);
      parts.push(
        `Impact: ${item.impact_on_real_estate} | Sentiment: ${item.sentiment}\n`,
      );
    }
  }

  // Economic indicators - only for affordability, growth, bottom_line sections
  const economicSections = [
    'affordability_narrative',
    'growth_potential_narrative',
    'bottom_line_narrative',
    'score_story',
  ];
  if (economicSections.includes(sectionId) && indicators.length > 0) {
    parts.push('\n## ECONOMIC INDICATORS\n');
    for (const ind of indicators.slice(0, 4)) {
      parts.push(
        `**${ind.indicator_name}** (${ind.geography_level}): ${ind.current_value}`,
      );
      parts.push(
        `${ind.change_description} — Housing impact: ${ind.impact_on_housing}\n`,
      );
    }
  }

  // Market signals - include for all sections
  if (signals.length > 0 && signalSummary) {
    parts.push(`\n## MARKET SIGNALS: ${signalSummary}\n`);
    for (const signal of signals.slice(0, 3)) {
      const arrow =
        signal.signal_type === 'bullish'
          ? '↑'
          : signal.signal_type === 'bearish'
            ? '↓'
            : '→';
      parts.push(`${arrow} **${signal.headline}**: ${signal.description}`);
    }
  }

  // National context - only for stability, bottom_line, market_timing
  const nationalSections = [
    'stability_narrative',
    'bottom_line_narrative',
    'market_timing_narrative',
  ];
  if (nationalSections.includes(sectionId) && nationalContext) {
    parts.push('\n## NATIONAL CONTEXT\n');
    if (nationalContext.fed_rate_news)
      parts.push(`Fed: ${nationalContext.fed_rate_news}`);
    if (nationalContext.mortgage_rate_trend)
      parts.push(`Mortgages: ${nationalContext.mortgage_rate_trend}`);
    if (nationalContext.economic_outlook)
      parts.push(`Outlook: ${nationalContext.economic_outlook}`);
  }

  parts.push('\n---\n');

  // Only return if we actually have content beyond the header/footer
  if (parts.length <= 2) return null;
  return parts.join('');
}

/** Get section-specific instructions for incorporating news context */
export function getNewsInstructionsForSection(sectionId: string): string {
  const instructions: Record<string, string> = {
    hero_verdict: `If market signals are provided, let them influence the tone of your verdict.`,

    score_story: `
IMPORTANT: Connect the news and economic data above to the score components. Explain what real-world events are DRIVING the numbers — employer moves affecting demand, development impacting supply, policy changes shifting affordability. Make the score feel alive with current events.`,

    affordability_narrative: `
IMPORTANT: Use the news above to explain WHY affordability is where it is. Connect employer hiring/layoffs to income trends, housing policy changes to price dynamics, new development to supply-side relief. The reader should understand what forces are actively shaping affordability in this market.`,

    market_timing_narrative: `
IMPORTANT: Reference the news above to explain the current market timing signals. New development projects affect future inventory. Policy changes shift demand. Connect each timing indicator to a real-world cause when possible. Help the reader understand not just WHAT the market is doing, but WHY.`,

    stability_narrative: `
IMPORTANT: Use national context (Fed policy, mortgage rates) and local news (climate events, policy changes) to explain stability risks and strengths. Connect market volatility to real events. If there are climate risks or insurance issues, these directly affect market stability.`,

    growth_potential_narrative: `
IMPORTANT: This section MUST connect growth metrics to their drivers. Use employer expansion, infrastructure projects, and migration news to explain population growth. Use development projects and economic indicators to project where the market is heading. Every growth stat should have a "because" rooted in real events.`,

    bottom_line_narrative: `
IMPORTANT: Synthesize the most impactful news into your overall verdict. The reader wants to know: given current events and trends, is now a good time? Reference the strongest signals — positive AND negative — that should influence their decision.`,

    bottom_line_actions: `
IMPORTANT: Make action items NEWS-AWARE. If mortgage rates are trending a certain way, factor that in. If there's new development coming, mention timing around it. Actions should feel current and specific to this moment in the market.`,

    investment_thesis: `
IMPORTANT: Factor news into the investment case — employer moves affect rental demand, development impacts supply competition, infrastructure shifts desirability. Cite specific developments.`,

    risk_factors: `
IMPORTANT: Include news-based risks alongside data-driven risks — layoffs, new supply, climate events, policy changes. Be specific.`,

    why_winner_won: `
IMPORTANT: Generate exactly 3 compelling reasons. Reference news/developments that support the advantage if relevant. Output as a JSON array of 3 strings.`,

    final_recommendation: `
IMPORTANT: Be decisive. Factor in any relevant news that affects the decision. Include 2-3 specific next steps.`,

    comparison_overview: `
IMPORTANT: Reference the user's priorities. Use specific data points. Keep tone objective but helpful.`,
  };

  const defaultInstruction = `
IMPORTANT: If any of the market intelligence above is relevant, incorporate it naturally. Reference specific developments, employers, or events that support your points. Explain what is DRIVING the metrics, not just what the metrics show.`;

  return instructions[sectionId] || defaultInstruction;
}

/**
 * Enhance a prompt with section-specific news context and contradiction-avoidance instructions
 */
export function enhancePromptWithNews(
  basePrompt: string,
  context: Record<string, any>,
  sectionId: string,
): string {
  const newsEnhancement = buildNewsEnhancementForSection(context, sectionId);
  if (!newsEnhancement) {
    return basePrompt;
  }

  const newsInstructions = getNewsInstructionsForSection(sectionId);

  return `${basePrompt}
${newsEnhancement}
${newsInstructions}

IMPORTANT — AVOIDING CONTRADICTIONS:
- For Realtor.com metrics (days on market, active listings, median listing price, inventory, pending ratio, price cuts) and Zillow metrics (home values, rent): the "Data:" section above is AUTHORITATIVE. Always use those exact values. News articles may reference different geography levels (metro vs ZIP) or older time periods for these same metrics — do NOT substitute news-sourced values for them.
- For economic data, development projects, job openings, infrastructure investments, policy changes, and other information NOT in the Data section: news is a valid and valuable source. You may cite these freely.
- If a news article mentions a Realtor/Zillow metric that differs from the Data section (e.g., area-wide median vs ZIP-level median), explicitly note the geographic distinction rather than presenting the news number as the local value.`;
}

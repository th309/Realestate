// ============================================================================
// PROPERTYIQ - REPORT GENERATION WITH GEMINI NEWS INTEGRATION
// ============================================================================
// Example of how to integrate the Gemini news scout into report generation
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { 
  getOrScoutNews, 
  formatNewsForPrompt, 
  summarizeSignals,
  NewsScoutResult 
} from './gemini-news-scout';

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

interface Geography {
  id: string;
  type: 'metro' | 'county' | 'zip';
  name: string;
  state: string;
}

interface ReportGenerationInput {
  templateSlug: string;
  geography: Geography;
  comparisonGeographies?: Geography[];
  userInputs?: Record<string, any>;
  userId: string;
}

interface MarketData {
  current: Record<string, number | string | null>;
  historical: Record<string, { date: string; value: number }[]>;
  benchmarks: {
    national?: Record<string, number>;
    state?: Record<string, number>;
  };
  scores: {
    homeready?: { score: number; components?: Record<string, number> };
    investoredge?: { score: number; components?: Record<string, number> };
  };
}

// -----------------------------------------------------------------------------
// MAIN REPORT GENERATION FUNCTION
// -----------------------------------------------------------------------------

export async function generateReport(input: ReportGenerationInput): Promise<string> {
  const { templateSlug, geography, comparisonGeographies, userInputs, userId } = input;

  console.log(`Generating ${templateSlug} report for ${geography.name}...`);

  // 1. Load the template
  const template = await loadTemplate(templateSlug);
  if (!template) {
    throw new Error(`Template '${templateSlug}' not found`);
  }

  // 2. Check user's subscription tier
  await validateUserAccess(userId, template.tier_required);

  // 3. Create report instance in pending state
  const reportId = await createReportInstance(template, geography, userInputs, userId);

  try {
    // 4. Fetch structured market data (Zillow, FRED, etc.)
    const marketData = await fetchMarketData(
      geography,
      template.config.data_requirements
    );

    // 5. Scout news via Gemini (if template requires it)
    let newsData: NewsScoutResult | null = null;
    if (template.config.data_requirements.include_news) {
      console.log(`Scouting news for ${geography.name}...`);
      newsData = await getOrScoutNews(
        geography.id,
        geography.type,
        geography.name,
        geography.state,
        {
          includeNationalContext: true,
          maxNewsItems: template.config.data_requirements.news_limit || 10
        }
      );
      console.log(`Found ${newsData.local_news.length} news items, ${newsData.market_signals.length} market signals`);
    }

    // 6. Generate AI narratives with Claude
    const narratives = await generateNarratives(
      template.config.ai_config,
      geography,
      marketData,
      newsData
    );

    // 7. Assemble and save the report
    await finalizeReport(reportId, marketData, newsData, narratives);

    console.log(`Report ${reportId} generated successfully`);
    return reportId;

  } catch (error) {
    // Mark report as failed
    await supabase
      .from('report_instances')
      .update({ 
        status: 'failed', 
        error_message: error.message 
      })
      .eq('id', reportId);
    
    throw error;
  }
}

// -----------------------------------------------------------------------------
// TEMPLATE LOADING
// -----------------------------------------------------------------------------

async function loadTemplate(slug: string) {
  const { data, error } = await supabase
    .from('report_templates')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('Failed to load template:', error);
    return null;
  }

  return data;
}

// -----------------------------------------------------------------------------
// AI NARRATIVE GENERATION WITH NEWS CONTEXT
// -----------------------------------------------------------------------------

async function generateNarratives(
  aiConfig: any,
  geography: Geography,
  marketData: MarketData,
  newsData: NewsScoutResult | null
): Promise<Record<string, string | string[] | object>> {
  const narratives: Record<string, any> = {};

  // Format news context for prompts
  const newsContext = newsData 
    ? formatNewsForPrompt(newsData, {
        maxNewsItems: 5,
        includeIndicators: true,
        includeSignals: true,
        includeNational: true
      })
    : 'No recent news available for this market.';

  // Get market signal summary
  const signalSummary = newsData 
    ? summarizeSignals(newsData)
    : null;

  for (const section of aiConfig.narrative_sections) {
    console.log(`Generating narrative: ${section.id}...`);

    // Build the prompt with all context
    const prompt = buildNarrativePrompt(
      section,
      geography,
      marketData,
      newsContext,
      signalSummary
    );

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: section.max_tokens || 500,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Parse based on expected output format
        if (section.output_format === 'json_array') {
          narratives[section.id] = parseJsonArray(content.text);
        } else if (section.output_format === 'json_object') {
          narratives[section.id] = parseJsonObject(content.text);
        } else {
          narratives[section.id] = content.text;
        }
      }
    } catch (error) {
      console.error(`Failed to generate ${section.id}:`, error);
      narratives[section.id] = `Unable to generate ${section.id} at this time.`;
    }
  }

  return narratives;
}

function buildNarrativePrompt(
  section: any,
  geography: Geography,
  marketData: MarketData,
  newsContext: string,
  signalSummary: any
): string {
  // Start with the template's prompt
  let prompt = section.prompt_template;

  // Replace geography placeholders
  prompt = prompt.replace(/\{\{geography_name\}\}/g, geography.name);
  prompt = prompt.replace(/\{\{geography_type\}\}/g, geography.type);
  prompt = prompt.replace(/\{\{state\}\}/g, geography.state);

  // Replace market data placeholders
  for (const [key, value] of Object.entries(marketData.current)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    prompt = prompt.replace(placeholder, formatValue(value));
  }

  // Replace score placeholders
  if (marketData.scores.homeready) {
    prompt = prompt.replace(/\{\{homeready_score\}\}/g, String(marketData.scores.homeready.score));
  }
  if (marketData.scores.investoredge) {
    prompt = prompt.replace(/\{\{investoredge_score\}\}/g, String(marketData.scores.investoredge.score));
  }

  // Add news context
  prompt = prompt.replace(/\{\{news_context\}\}/g, newsContext);

  // Add signal summary if available
  if (signalSummary) {
    prompt = prompt.replace(
      /\{\{market_signal_summary\}\}/g,
      `Overall market signal: ${signalSummary.overall.toUpperCase()} (${signalSummary.bullish_count} bullish, ${signalSummary.bearish_count} bearish signals)`
    );
  }

  // Add instructions for incorporating news
  if (newsContext && newsContext !== 'No recent news available for this market.') {
    prompt += `

IMPORTANT: Incorporate relevant news and market signals into your analysis where appropriate. Reference specific headlines or indicators that support your points. If the news context contains information that contradicts the market data, acknowledge the nuance.`;
  }

  return prompt;
}

// -----------------------------------------------------------------------------
// EXAMPLE: MARKET SNAPSHOT NARRATIVE WITH NEWS
// -----------------------------------------------------------------------------

async function generateMarketSnapshotSummary(
  geography: Geography,
  marketData: MarketData,
  newsData: NewsScoutResult | null
): Promise<string> {
  const signalSummary = newsData ? summarizeSignals(newsData) : null;
  const newsContext = newsData ? formatNewsForPrompt(newsData, { maxNewsItems: 3 }) : '';

  const prompt = `
You are PropertyIQ's market analyst. Generate a concise 3-5 sentence market summary for ${geography.name}, ${geography.state}.

## CURRENT MARKET DATA

- Home Value (ZHVI): $${marketData.current.zhvi?.toLocaleString()} (${marketData.current.zhvi_yoy}% YoY)
- Typical Rent (ZORI): $${marketData.current.zori?.toLocaleString()}/mo (${marketData.current.zori_yoy}% YoY)
- Market Heat Index: ${marketData.current.market_heat_index}/100
- Days to Pending: ${marketData.current.days_to_pending} days
- For-Sale Inventory: ${marketData.current.for_sale_inventory?.toLocaleString()} homes (${marketData.current.inventory_yoy}% YoY)
- 1-Year Price Forecast: ${marketData.current.zhvf_1yr_pct}%

## PROPERTYIQ SCORES

- HomeReady Score: ${marketData.scores.homeready?.score || 'N/A'}/100
- InvestorEdge Score: ${marketData.scores.investoredge?.score || 'N/A'}/100

${newsContext ? `## RECENT NEWS & MARKET SIGNALS\n\n${newsContext}` : ''}

${signalSummary ? `\nOverall Market Signal: ${signalSummary.overall.toUpperCase()}` : ''}

## INSTRUCTIONS

Write a summary that:
1. Opens with whether this is a buyer's, seller's, or balanced market
2. Highlights 1-2 key market drivers (use specific numbers)
3. If relevant news exists, weave in ONE key news item that supports or adds context to the data
4. Ends with a brief forward-looking statement

Keep it analytical, confident, and jargon-free. Do not use bullet points.
`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }]
  });

  const content = response.content[0];
  return content.type === 'text' ? content.text : '';
}

// -----------------------------------------------------------------------------
// EXAMPLE: INVESTMENT THESIS WITH NEWS
// -----------------------------------------------------------------------------

async function generateInvestmentThesis(
  geography: Geography,
  marketData: MarketData,
  newsData: NewsScoutResult | null
): Promise<{ verdict: string; thesis: string }> {
  const signalSummary = newsData ? summarizeSignals(newsData) : null;
  
  // Filter for investment-relevant news
  const investmentNews = newsData?.local_news.filter(
    n => ['employer', 'development', 'policy'].includes(n.category) && n.relevance !== 'low'
  ) || [];

  const prompt = `
You are an investment analyst evaluating ${geography.name}, ${geography.state} for rental property investment.

## INVESTMENT METRICS

- InvestorEdge Score: ${marketData.scores.investoredge?.score || 'N/A'}/100
- Gross Rent Multiplier: ${marketData.current.gross_rent_multiplier}
- Rent/Price Ratio: ${marketData.current.rent_to_price_ratio}%
- Cap Rate (Estimated): ${marketData.current.cap_rate_proxy}%
- Rental Demand (ZORDI): ${marketData.current.zordi}
- 5-Year Appreciation: ${marketData.current.zhvi_5y_cagr}%
- Risk Score: ${marketData.scores.investoredge?.components?.risk || 'N/A'}/100

## MARKET CONDITIONS

- Inventory YoY: ${marketData.current.inventory_yoy}%
- Days on Market: ${marketData.current.days_to_pending} days
- Price Cut %: ${marketData.current.price_cut_pct}%
- Population Growth: ${marketData.current.population_growth_yoy}%
- Job Growth: ${marketData.current.job_growth_yoy}%

${investmentNews.length > 0 ? `
## RELEVANT NEWS FOR INVESTORS

${investmentNews.slice(0, 3).map(n => `- **${n.headline}**: ${n.impact_on_real_estate}`).join('\n')}
` : ''}

${signalSummary ? `
## MARKET SIGNALS

Overall: ${signalSummary.overall.toUpperCase()}
- Bullish signals: ${signalSummary.bullish_count}
- Bearish signals: ${signalSummary.bearish_count}
${signalSummary.high_confidence_signals.length > 0 ? 
  `High confidence: ${signalSummary.high_confidence_signals.map(s => s.headline).join(', ')}` : ''}
` : ''}

## TASK

1. Provide an investment verdict: Strong Buy, Buy, Hold, Caution, or Avoid
2. Write a 3-4 paragraph investment thesis covering:
   - Bull case (why invest here)
   - Bear case (key risks)
   - How recent news/signals affect the thesis
   - Recommended strategy (cash flow vs appreciation focus)

Return as JSON:
{
  "verdict": "Strong Buy|Buy|Hold|Caution|Avoid",
  "thesis": "Your 3-4 paragraph analysis..."
}
`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }]
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return parseJsonObject(content.text) as { verdict: string; thesis: string };
  }

  return { verdict: 'Hold', thesis: 'Unable to generate thesis.' };
}

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

async function validateUserAccess(userId: string, tierRequired: string): Promise<void> {
  // Implementation: Check user's subscription tier
  // Throw error if insufficient access
}

async function createReportInstance(
  template: any,
  geography: Geography,
  userInputs: any,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('report_instances')
    .insert({
      template_id: template.id,
      template_version: template.version,
      user_id: userId,
      primary_geography_id: geography.id,
      primary_geography_type: geography.type,
      primary_geography_name: geography.name,
      user_inputs: userInputs || {},
      populated_data: {},
      status: 'generating'
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function fetchMarketData(
  geography: Geography,
  dataRequirements: any
): Promise<MarketData> {
  // Implementation: Fetch from your market_data tables
  // This is a placeholder
  return {
    current: {},
    historical: {},
    benchmarks: {},
    scores: {}
  };
}

async function finalizeReport(
  reportId: string,
  marketData: MarketData,
  newsData: NewsScoutResult | null,
  narratives: Record<string, any>
): Promise<void> {
  const { error } = await supabase
    .from('report_instances')
    .update({
      populated_data: {
        ...marketData,
        news: newsData
      },
      ai_narratives: narratives,
      homeready_score: marketData.scores.homeready?.score,
      investoredge_score: marketData.scores.investoredge?.score,
      status: 'ready',
      data_as_of_date: new Date().toISOString().split('T')[0]
    })
    .eq('id', reportId);

  if (error) throw error;
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return String(value);
}

function parseJsonArray(text: string): string[] {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(text: string): object {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  } catch {
    return {};
  }
}

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------

export {
  generateReport,
  generateMarketSnapshotSummary,
  generateInvestmentThesis
};

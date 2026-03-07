/**
 * Prompt Builders for ClaudeService
 *
 * Pure functions that construct prompts for various AI generation tasks:
 * - Conversation system prompts
 * - Investment analysis prompts
 * - Comparison report prompts (why winner won, final recommendation)
 *
 * Extracted from ClaudeService to keep file sizes under the 300-line limit.
 */

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  affordability: 'Affordability',
  appreciation: 'Appreciation Potential',
  job_market: 'Job Market Strength',
  market_timing: 'Market Timing',
  lifestyle: 'Lifestyle Factors',
  cash_flow: 'Cash Flow',
  tenant_demand: 'Tenant Demand',
  entry_price: 'Entry Price',
  stability: 'Market Stability',
};

export function formatPriorityList(priorities: string[]): string {
  return priorities.map((p) => PRIORITY_LABELS[p] || p).join(', ');
}

export function buildConversationSystemPrompt(
  report: any,
  newsContext?: string,
): string {
  const userType = report.user_type || 'homebuyer';
  const heroScore = userType === 'investor' ? 'InvestorEdge' : 'HomeReady';
  const geoName = report.primary_geography_name || 'the selected market';
  const audience =
    userType === 'investor'
      ? 'real estate investors'
      : 'homebuyers and renters';
  const focus =
    userType === 'investor'
      ? 'investment decisions (cash flow, appreciation, risk)'
      : 'homebuying decisions (affordability, timing, neighborhoods)';
  const score =
    userType === 'investor'
      ? report.investoredge_score
      : report.homeready_score;

  let prompt = `You are an expert real estate market analyst for PropertyIQ, helping ${audience} make informed decisions.

You are discussing a ${report.template?.name || 'Market'} report for ${geoName}.

Key Market Data:
- ${heroScore} Score: ${score}/100
- Geography Type: ${report.primary_geography_type}
${report.scores_snapshot ? `- Market Scores: ${JSON.stringify(report.scores_snapshot)}` : ''}`;

  if (
    newsContext &&
    newsContext !== 'No recent news available for this market.'
  ) {
    prompt += `\n\nRecent Local News & Market Intelligence:\n${newsContext}`;
  }

  prompt += `

Guidelines:
1. Be helpful, concise, and data-driven
2. Focus on ${focus}
3. Reference specific data points from the report
4. When relevant, incorporate recent local news to provide timely, contextual insights
5. Acknowledge limitations when asked about unavailable data
6. Provide actionable recommendations
7. Keep responses under 300 words unless more detail is requested

When using news context:
- Reference specific developments, employers, or events when they support your analysis
- Explain how recent news might impact the user's decision
- Be balanced - consider both positive and negative news implications
- Don't force news into every response - only use it when genuinely relevant to the question`;

  return prompt;
}

export function buildConversationMessages(
  history: ConversationMessage[],
  currentMessage: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const msg of history.slice(-20)) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: 'user', content: currentMessage });
  return messages;
}

export function buildInvestmentPrompt(
  geographyName: string,
  metrics: Record<string, any>,
  userInputs: Record<string, any>,
  newsContext?: string,
): string {
  let prompt = `Analyze this real estate investment opportunity in ${geographyName}.

Market Metrics:
${JSON.stringify(metrics, null, 2)}

User Investment Parameters:
${JSON.stringify(userInputs, null, 2)}`;

  if (
    newsContext &&
    newsContext !== 'No recent news available for this market.'
  ) {
    prompt += `\n\nRecent Local News & Market Intelligence:\n${newsContext}`;
  }

  prompt += `

Provide a concise investment analysis covering:
1. Cash flow potential
2. Appreciation outlook
3. Risk factors${newsContext ? ' (include any news-related risks)' : ''}
4. Entry point assessment
5. Recommendation

${
  newsContext
    ? `When relevant, incorporate recent news into your analysis. For example:
- How might employer expansions/layoffs affect rental demand?
- What impact could new development projects have on supply?
- Are there policy changes that could affect investment returns?
Reference specific news items that strengthen or weaken the investment case.

`
    : ''
}Write a thorough analysis of 600-1000 words and be specific with numbers.`;

  return prompt;
}

export function buildWhyWinnerWonPrompt(context: {
  winner_name: string;
  priorities: string[];
  priority_weighted_winner: any;
  user_type: string;
}): string {
  return `You are analyzing a market comparison report. The user is a ${context.user_type} who prioritized: ${formatPriorityList(context.priorities)}.

The winner is ${context.winner_name}.

Priority analysis results:
${JSON.stringify(context.priority_weighted_winner.priorityScores, null, 2)}

Generate exactly 3 compelling, specific reasons why ${context.winner_name} is the best choice for this user. Each reason should:
1. Directly tie to one of the user's priorities
2. Include specific metric comparisons when available
3. Be 1-2 sentences maximum

Return ONLY a JSON array of 3 strings, no other text. Example format:
["Reason 1", "Reason 2", "Reason 3"]`;
}

export function buildFinalRecommendationPrompt(context: {
  winner_name: string;
  priorities: string[];
  user_type: string;
  user_inputs?: Record<string, any>;
  priority_weighted_winner: any;
  news_context?: string;
}): string {
  const userContext =
    context.user_type === 'homebuyer'
      ? 'homebuyer looking for a place to live'
      : 'real estate investor seeking returns';

  let prompt = `You are a real estate expert providing a final recommendation to a ${userContext}.

Their top priorities are: ${formatPriorityList(context.priorities)}

Based on comprehensive analysis, ${context.winner_name} is the recommended market because:
${context.priority_weighted_winner.reasons.join('\n')}

${context.user_inputs?.budget ? `Budget: ${context.user_inputs.budget}` : ''}
${context.user_inputs?.timeline ? `Timeline: ${context.user_inputs.timeline}` : ''}`;

  if (
    context.news_context &&
    context.news_context !== 'No recent news available for this market.'
  ) {
    prompt += `\n\nRecent market developments to consider:\n${context.news_context.slice(0, 500)}`;
  }

  prompt += `

Write a personalized final recommendation in 2-3 paragraphs that:
1. Clearly states the recommended market and why it aligns with their priorities
2. Acknowledges any trade-offs or considerations
3. Provides 2-3 specific next steps they should take

Be warm but professional. Use "you" to address the user directly.`;

  return prompt;
}

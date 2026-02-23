/**
 * Analytics Chat Prompt Builders
 *
 * Pure functions that construct the various prompt sections sent to the LLM.
 * No class, no `this` - all data is passed as arguments.
 */

import { ChatMessage } from './analytics-chat.types';

/**
 * Build the user profile section of the system prompt.
 * Contains stable user information that rarely changes within a session.
 */
export function buildUserProfilePrompt(
  userMode: 'homebuyer' | 'investor',
  userPreferences?: Record<string, unknown>,
): string {
  const modeDescription = userMode === 'homebuyer'
    ? 'HomeReady (Homebuyer/Renter)'
    : 'InvestorEdge (Investor)';

  const primaryScore = userMode === 'homebuyer' ? 'homeready_score' : 'investoredge_score';

  const profileSections: string[] = [];

  profileSections.push(`User Mode: ${modeDescription}`);
  profileSections.push(`Primary Score: ${primaryScore}`);
  profileSections.push(`Default Score for Queries: Use ${primaryScore} unless user specifies otherwise`);

  // Geographic preferences
  if (userPreferences?.location) {
    profileSections.push(`\nGEOGRAPHIC PREFERENCES:`);
    profileSections.push(`- Home Location: ${userPreferences.location}`);
    profileSections.push(`- When user asks for "local markets" or "my area", prioritize this location`);
  }
  if (userPreferences?.preferredStates && Array.isArray(userPreferences.preferredStates)) {
    profileSections.push(`- Preferred States: ${(userPreferences.preferredStates as string[]).join(', ')}`);
    profileSections.push(`- Consider these states when providing recommendations`);
  }

  // Financial preferences
  if (userPreferences?.budget || userPreferences?.priceRange) {
    profileSections.push(`\nFINANCIAL PREFERENCES:`);
    if (userPreferences?.budget) {
      profileSections.push(`- Budget: ${userPreferences.budget}`);
    }
    if (userPreferences?.priceRange) {
      profileSections.push(`- Price Range: ${userPreferences.priceRange}`);
    }
  }

  // Investment preferences (for investors)
  if (userMode === 'investor') {
    profileSections.push(`\nINVESTMENT PREFERENCES:`);
    if (userPreferences?.investmentStrategy) {
      profileSections.push(`- Strategy: ${userPreferences.investmentStrategy}`);
    }
    if (userPreferences?.riskTolerance) {
      profileSections.push(`- Risk Tolerance: ${userPreferences.riskTolerance}`);
    }
    if (userPreferences?.timeHorizon) {
      profileSections.push(`- Time Horizon: ${userPreferences.timeHorizon}`);
    }
    if (userPreferences?.propertyTypes && Array.isArray(userPreferences.propertyTypes)) {
      profileSections.push(`- Property Types: ${(userPreferences.propertyTypes as string[]).join(', ')}`);
    }
  }

  // Homebuyer preferences
  if (userMode === 'homebuyer') {
    profileSections.push(`\nHOMEBUYER PREFERENCES:`);
    if (userPreferences?.householdSize) {
      profileSections.push(`- Household Size: ${userPreferences.householdSize}`);
    }
    if (userPreferences?.priorities && Array.isArray(userPreferences.priorities)) {
      profileSections.push(`- Priorities: ${(userPreferences.priorities as string[]).join(', ')}`);
    }
  }

  // Saved searches / watchlist
  if (userPreferences?.watchlist && Array.isArray(userPreferences.watchlist)) {
    profileSections.push(`\nWATCHLIST:`);
    (userPreferences.watchlist as any[]).forEach((item: any) => {
      profileSections.push(`- ${item.name || item.geography_name} (${item.geography_type})`);
    });
    profileSections.push(`- Consider these markets when providing recommendations`);
  }

  return `
═══════════════════════════════════════════════════════════════════
USER PROFILE
═══════════════════════════════════════════════════════════════════

${profileSections.join('\n')}

IMPORTANT:
- Use this profile to personalize responses and default assumptions
- When user asks general queries without specifying location, consider their preferences
- When choosing which score to use by default, use the Primary Score above
- This profile persists across the conversation session
`;
}

/**
 * Build dynamic context sent per-query (session-only, not cached).
 * Only includes information that changes frequently (conversation history).
 * When the latest user message refers to "those/them/from that list", include
 * more of the previous assistant reply so "those" is unambiguous.
 */
export function buildDynamicContext(
  conversationHistory: ChatMessage[],
): string {
  const recentHistory = conversationHistory.slice(-4);
  const lastMsg = recentHistory[recentHistory.length - 1];
  const lastIsUser = lastMsg?.role === 'user';
  const lastContent = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  const followUpRef = /\b(?:out of those|of those|from that list|among those|which of those|which of these|of these)\b/i.test(lastContent);

  const historyContext = recentHistory.length > 0
    ? recentHistory
      .map((msg) => {
        const content = typeof msg.content === 'string' ? msg.content.substring(0, 150) : '[Tool usage]';
        return `${msg.role}: ${content}`;
      })
      .join('\n')
    : 'First query in conversation';

  let refBlock = '';
  if (followUpRef && lastIsUser && conversationHistory.length >= 2) {
    const prevAssistant = [...conversationHistory].reverse().find((m) => m.role === 'assistant');
    if (prevAssistant && typeof prevAssistant.content === 'string') {
      const excerpt = prevAssistant.content.substring(0, 800);
      refBlock = `\n\nREFERENCE (what "those" / "that list" refers to — from your previous reply):\n${excerpt}${prevAssistant.content.length > 800 ? '...' : ''}\n\n`;
    }
  }

  return `RECENT CONVERSATION HISTORY:
${historyContext}${refBlock}
USER QUERY:`;
}

/**
 * Build the full system prompt with Quinn's behavioral rules, tool guide, and formatting rules.
 */
export function buildSystemPrompt(context?: Record<string, any>): string {
  let prompt = `You are Quinn, PropertyIQ's real estate analytics assistant. Answer concisely using the right tools.

## CRITICAL RULES - FOLLOW EXACTLY

1. **NEVER EXPLORE** - Don't call get_available_filters, describe_database_table, or get_database_summary first
   - Just call the action tool directly
   - If it fails, THEN try alternatives

2. **ASK ABOUT GEOGRAPHY LEVEL** when the query could apply to multiple levels:
   - PropertyIQ has data for: metro (MSA), county, ZIP code, and state levels
   - For broad queries like "hot markets", "best places to invest", "top performers":
     * If user doesn't specify, ASK: "Would you like me to analyze metros (major metropolitan areas), counties, ZIP codes, or states?"
     * Explain briefly: metros=large urban areas, counties=local markets, ZIPs=neighborhood-level, states=broad regional trends
   - If user specifies a level (e.g., "top counties"), use that directly
   - Default to metro ONLY when user explicitly says "metros" or "MSAs" or for questions about specific named metros

3. **"Hot markets" or "Top markets" → ASK about geography level first, THEN get_rankings**
   - ASK the user which geography level they want
   - get_rankings supports: geography_type="metro", "county", "zip", or "state"
   - Returns COMPLETE data (names, scores, appreciation)

4. **PropertyIQ Scores → get_rankings ONLY**
   - NEVER query_database_table on propertyiq_scores
   - ALWAYS get_rankings, analyze_data, compare_to_benchmark

5. **Raw Data → query_database_table**
   - Zillow: zhvi, zri, inventory
   - Realtor: hotness_rank, median_listing_price
   - Census: population, median_income

6. **Efficiency: 1-2 tool calls maximum for simple queries**

## GEOGRAPHY LEVEL GUIDE

| Level | Best For | Example |
|-------|----------|---------|
| metro | Major urban markets, MSA comparisons | "Austin-Round Rock, TX" |
| county | Local market analysis, suburban areas | "Travis County, TX" |
| zip | Neighborhood-level precision | "Austin, TX 78701" |
| state | Broad regional trends | "Texas" |

## COMMON QUERIES

**"Find hot markets"** → First ASK which geography level, then get_rankings(geography_type=USER_CHOICE, score_type="investoredge", limit=10)

**"Top Texas metros"** → get_rankings(geography_type="metro", score_type="investoredge", states=["TX"], limit=10)

**"Best counties for investment"** → get_rankings(geography_type="county", score_type="investoredge", limit=10)

**"Realtor hotness"** → query_database_table(table_name="realtor_metro", columns=["geography_name","hotness_rank"], order_by={"hotness_rank":"asc"}, limit=10)

**"Austin home prices"** → query_database_table(table_name="zillow_metro", filters={"geography_name":{"like":"%Austin%"}})

## METRIC MAPPINGS
- "home price" → zhvi (Zillow) or median_listing_price (Realtor)
- "rent" → zri (Zillow)
- "hottest markets" → hotness_rank (Realtor, lower=better) OR investoredge_score (PropertyIQ, higher=better)
- "unemployment" → unemployment_rate (Economic)
- "population" → population (Census)

## TOOL CATEGORIES
**Score Tools**: get_rankings, analyze_data, compare_to_benchmark, get_time_series, filter_geographies
**Database Tools**: query_database_table, describe_database_table, aggregate_database, search_database
**ML Tools**: run_regression, get_feature_importance, cluster_markets, optimize_weights
**Other**: find_similar_geographies, compare_to_neighbors

## FORMATTING RULES (CRITICAL - READ CAREFULLY)

1. **NEVER use markdown symbols in responses**:
   - NO bold (**text**), headers (##), bullets (-), asterisks (*)
   - Plain conversational text ONLY
   - The UI will render tool results as interactive charts/tables

2. **Let tool results do the talking**:
   - When showing rankings → call get_rankings and say "Here are the results:"
   - When showing comparisons → call compare_to_benchmark and say "Here's the comparison:"
   - Keep text to 2-3 sentences, let visual data speak for itself

3. **Response structure for ranking queries**:
   - Brief intro (1 sentence) → call get_rankings → "Here are the top markets:" → DONE
   - DO NOT list results in text - the UI will render them as a table/chart

4. **Data presentation rules**:
   - ALWAYS use geography_name ("Austin-Round Rock, TX"), NEVER geography_id ("47340")
   - Format percentages: "4.8%" not "0.048"
   - Include state: "Phoenix-Mesa-Scottsdale, AZ" or "Phoenix (AZ)"
   - Tool results contain complete data - don't duplicate in text

5. **Keep responses SHORT**:
   - Simple queries: 1-2 sentences max + tool call
   - Complex queries: 2-3 sentences max + tool calls
   - NEVER write paragraphs explaining data that's already in tool results

## RESPONSE STYLE
- Ultra-concise: 2-3 sentences maximum
- Call tools, let visual data render
- If data not found, suggest alternatives in 1 sentence
- ALWAYS ask about geography level for broad market queries (1 sentence question)
- **ACCURACY**:
  - NEVER invent numbers. If data is missing in the tool output, say "I don't have that data".
  - Trust the tool output matching user geographic level exactly.
  - If a number looks like a decimal (e.g. 0.05), treat it as 5%. If it looks like a whole number (e.g. 5.0), treat it as 5%. Use context.

## VISUALIZATION PRIORITY (CRITICAL)
- If the user asks for a LIST, RANKING, CHART, or COMPARISON, you **MUST** call the corresponding tool to trigger the UI widget.
- **EVEN IF** you know the answer from the injected context (Data Digest), you **MUST STILL CALL THE TOOL**.
- The text answer alone is **INSUFFICIENT**. The UI widget is required.
- Example: User asks "Top markets in Texas". Context says "Top market is Kingsville". You MUST still call \`get_rankings\` to show the full list in a table.`;

  // Add context if provided (e.g., focused on specific geography)
  if (context?.geographyType && context?.geographyId) {
    prompt += `\n\nCURRENT CONTEXT: The user is focused on ${context.geographyName || context.geographyId} (${context.geographyType}). Relate analysis to this market when relevant.`;
  }

  return prompt;
}

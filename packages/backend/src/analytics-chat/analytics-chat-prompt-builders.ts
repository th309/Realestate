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
  const isHomebuyer = userMode === 'homebuyer';
  const modeDescription = isHomebuyer ? 'HomeReady (Homebuyer/Renter)' : 'InvestorEdge (Investor)';
  const primaryScore = isHomebuyer ? 'homeready_score' : 'investoredge_score';
  const prefs = userPreferences;

  const sections: string[] = [
    `User Mode: ${modeDescription}`,
    `Primary Score: ${primaryScore}`,
    `Default Score for Queries: Use ${primaryScore} unless user specifies otherwise`,
  ];

  if (prefs?.location) {
    sections.push(`\nGEOGRAPHIC PREFERENCES:`);
    sections.push(`- Home Location: ${prefs.location}`);
    sections.push(`- When user asks for "local markets" or "my area", prioritize this location`);
  }
  if (Array.isArray(prefs?.preferredStates)) {
    sections.push(`- Preferred States: ${(prefs.preferredStates as string[]).join(', ')}`);
    sections.push(`- Consider these states when providing recommendations`);
  }

  if (prefs?.budget || prefs?.priceRange) {
    sections.push(`\nFINANCIAL PREFERENCES:`);
    if (prefs.budget) sections.push(`- Budget: ${prefs.budget}`);
    if (prefs.priceRange) sections.push(`- Price Range: ${prefs.priceRange}`);
  }

  if (!isHomebuyer) {
    sections.push(`\nINVESTMENT PREFERENCES:`);
    if (prefs?.investmentStrategy) sections.push(`- Strategy: ${prefs.investmentStrategy}`);
    if (prefs?.riskTolerance) sections.push(`- Risk Tolerance: ${prefs.riskTolerance}`);
    if (prefs?.timeHorizon) sections.push(`- Time Horizon: ${prefs.timeHorizon}`);
    if (Array.isArray(prefs?.propertyTypes)) {
      sections.push(`- Property Types: ${(prefs.propertyTypes as string[]).join(', ')}`);
    }
  }

  if (isHomebuyer) {
    sections.push(`\nHOMEBUYER PREFERENCES:`);
    if (prefs?.householdSize) sections.push(`- Household Size: ${prefs.householdSize}`);
    if (Array.isArray(prefs?.priorities)) {
      sections.push(`- Priorities: ${(prefs.priorities as string[]).join(', ')}`);
    }
  }

  if (Array.isArray(prefs?.watchlist)) {
    sections.push(`\nWATCHLIST:`);
    for (const item of prefs.watchlist as any[]) {
      sections.push(`- ${item.name || item.geography_name} (${item.geography_type})`);
    }
    sections.push(`- Consider these markets when providing recommendations`);
  }

  return `
═══════════════════════════════════════════════════════════════════
USER PROFILE
═══════════════════════════════════════════════════════════════════

${sections.join('\n')}

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


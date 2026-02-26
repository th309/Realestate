import type { ParsedRecommendation } from "./parseRecommendations";

/**
 * Build a structured prompt for pasting into Claude Code.
 * Includes the recommendation details and full insight report context.
 */
export function buildImplementPrompt(
  rec: ParsedRecommendation,
  insightMarkdown: string,
): string {
  return `Use the brainstorming skill to design and implement this recommendation from a PropertyIQ AI marketing insight report.

## Recommendation
- **Title:** ${rec.title}
- **Category:** ${rec.category}
- **Priority:** ${rec.priority}
- **Action Type:** ${rec.action_type}

## Recommendation Details
${rec.content}

## Full Insight Report
${insightMarkdown}`;
}

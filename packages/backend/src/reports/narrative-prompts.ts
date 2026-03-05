/**
 * Per-Section Narrative Prompt Templates
 *
 * Re-exports enhanced prompt configurations from report-type-specific files.
 * Comparison prompts are defined here since they're only 3 sections.
 *
 * Each template receives context variables ({{variable}}) and produces
 * section-specific AI narratives grounded in real data.
 *
 * Supports conditional blocks: {{#if variable}}...{{/if}}
 * Used by ClaudeService.generateNarratives()
 */

import {
  ANALYST_PERSONA_HOMEBUYER,
  ANTI_PATTERNS,
  NEWS_INTEGRATION_INSTRUCTIONS,
  CROSS_SECTION_CONTEXT_BLOCK,
  QUALITY_STANDARDS,
  WRITING_RULES,
} from './narrative-prompt-shared';
import { HOMEREADY_PROMPTS } from './narrative-prompts-homeready';
import { INVESTOR_PROMPTS } from './narrative-prompts-investor';

// ============================================================================
// Types (re-exported from shared to maintain backward compatibility)
// ============================================================================

import type { NarrativePromptConfig } from './narrative-prompt-shared';
export type { NarrativePromptConfig };

// ============================================================================
// Comparison Report Sections (Enhanced)
// ============================================================================

const COMPARISON_PROMPTS: Record<string, NarrativePromptConfig> = {
  comparison_verdict: {
    prompt_template: `${ANALYST_PERSONA_HOMEBUYER}

${CROSS_SECTION_CONTEXT_BLOCK}

${ANTI_PATTERNS}

${NEWS_INTEGRATION_INSTRUCTIONS}

${QUALITY_STANDARDS}

${WRITING_RULES}

You are writing a comparison verdict between markets for a {{user_type}}.

Markets Compared:
{{comparison_summary}}

Overall Scores:
{{comparison_scores}}

Winner: {{winner_name}} (based on priority-weighted analysis)

User's Priorities: {{priorities_formatted}}

Write 3-5 paragraphs synthesizing the comparison. This is the section the reader cares about most.

Paragraph 1 (The Verdict): State the winner clearly and why. "For a {{user_type}} prioritizing {{priorities_formatted}}, {{winner_name}} is the stronger choice — and it's [not even close / a close call]. The margin comes down to [specific component/metric difference]." Don't just say who won — explain why the difference matters.

Paragraph 2 (The Winner's Edge): What specifically makes the winner better? Reference 2-3 data points that drove the decision. Connect them to the user's priorities. "Your top priority of [X] is where {{winner_name}} really separates itself: [specific data comparison]."

Paragraph 3 (The Runner-Up's Case): Be fair. No market is all bad. "Where [runner-up] actually beats {{winner_name}}: [specific strengths]. If your priorities were [different priorities], the recommendation would flip."

Paragraph 4 (The Context): What external factors (market cycle, economic conditions, news events) could change this recommendation in 6-12 months? What should the reader monitor?

Paragraph 5 (The Decision Framework): "If [specific condition], choose {{winner_name}}. If [different condition], reconsider [runner-up]. The deciding factor for most people will be [specific trade-off]."

BAD: "Both markets have their strengths and weaknesses. Market A scores higher overall."
GOOD: "For a first-time buyer prioritizing affordability, Tampa wins decisively — at $342,000 vs Denver's $548,000, the monthly payment difference of $1,200 isn't just a number, it's the difference between a comfortable 25% DTI and a stretched 35% DTI on a $95K income. Denver fights back on growth potential (score 81 vs Tampa's 62), and if you're buying with a 10-year horizon, Denver's stronger appreciation history could close the gap. But for someone who needs to buy within 12 months on a moderate income, Tampa is the pragmatic choice."`,
    max_tokens: 2000,
    output_format: 'text',
  },

  component_comparison: {
    prompt_template: `${ANALYST_PERSONA_HOMEBUYER}

${ANTI_PATTERNS}

${QUALITY_STANDARDS}

${WRITING_RULES}

You are providing a component-by-component comparison for a {{user_type}}.

Markets:
{{comparison_component_data}}

Write 3-4 paragraphs comparing the markets on each score component.

Paragraph 1 (Biggest Gaps): "The largest gap between these markets is in [component]: [Market A] scores [X] vs [Market B]'s [Y] — a [Z]-point difference that shows up as [specific real-world impact]. This matters because [connection to buyer/investor decision]."

Paragraph 2 (Where They're Even): "On [component(s)], these markets are essentially tied at [X] vs [Y]. What that means: [specific implication — e.g., you won't gain or lose on stability no matter which you choose]."

Paragraph 3 (Market Personalities): "These component profiles tell a story: [Market A] is a [archetype — 'affordable sleeper,' 'growth rocket,' 'steady Eddie,' etc.] while [Market B] is a [different archetype]. For a {{user_type}}, that translates to [specific contrast in experience]."

Paragraph 4 (The Hidden Insight): "What the components don't show but the data implies: [cross-metric insight that emerges from comparing both markets — e.g., 'Both markets score similarly on affordability, but Market A achieves it through lower prices while Market B achieves it through higher incomes — meaning Market B's affordability is more durable']."

Reference specific component scores and explain what the DIFFERENCES mean, not just what the numbers are.`,
    max_tokens: 2000,
    output_format: 'text',
  },

  priority_analysis: {
    prompt_template: `${ANALYST_PERSONA_HOMEBUYER}

${ANTI_PATTERNS}

${QUALITY_STANDARDS}

You are explaining how the user's priorities determined the winner in a market comparison.

Winner: {{winner_name}}
User Type: {{user_type}}

Priority Analysis:
{{priority_analysis_data}}

User's Priorities (in order): {{priorities_formatted}}

Write 2-3 paragraphs explaining how their specific priorities shaped this recommendation.

Paragraph 1 (Priority Walkthrough): "Your #1 priority — [priority name] — is where the decision was made. [Market A] scored [X] vs [Market B]'s [Y], and because this was weighted 3x in the analysis, it accounts for roughly [Z]% of the final difference. Your #2 priority of [name] [reinforced/partially offset] this: [specific scores]. Your #3 priority of [name] was [a tiebreaker/irrelevant given the gap above]."

Paragraph 2 (What Would Change It): "If you had prioritized [different priority] over [current #1], [other market] would win because [specific reason with data]. This isn't hypothetical — if your situation changes (e.g., you get a raise and affordability matters less), revisit the comparison."

Paragraph 3 (Confidence Assessment): "How confident should you be in this result? The winner leads on [X of Y] priority categories. If the margin is razor-thin, be cautious — a small data update could flip the result. If it's decisive, you can move forward confidently."`,
    max_tokens: 2000,
    output_format: 'text',
  },
};

// ============================================================================
// Combined Export
// ============================================================================

export const NARRATIVE_PROMPTS: Record<string, NarrativePromptConfig> = {
  ...HOMEREADY_PROMPTS,
  ...INVESTOR_PROMPTS,
  ...COMPARISON_PROMPTS,
};

export const SECTIONS_BY_REPORT_TYPE = {
  homeready: [
    'hero_verdict',
    'score_story',
    'affordability_narrative',
    'market_timing_narrative',
    'stability_narrative',
    'growth_potential_narrative',
    'priorities_narrative',
    'bottom_line_narrative',
    'bottom_line_actions',
    'bottom_line_watch',
  ],
  investoredge: [
    'investor_hero_verdict',
    'investor_score_story',
    'cash_flow_narrative',
    'rent_demand_narrative',
    'appreciation_narrative',
    'entry_point_narrative',
    'risk_narrative',
    'investment_thesis_narrative',
    'investor_bottom_line',
    'investor_actions',
    'investor_watch',
  ],
  comparison: [
    'comparison_verdict',
    'component_comparison',
    'priority_analysis',
  ],
} as const;

/**
 * Custom Report V2 — Outline & Section Builder
 *
 * Custom reports use a hybrid approach: the outline pass generates
 * dynamic section definitions (JSON), which are then combined with
 * the fixed sections (executive_summary, scenario_analysis) to form
 * the full section map for Pass 2.
 */

import { Logger } from '@nestjs/common';
import {
  CUSTOM_REPORT_FIXED_SECTIONS,
  buildCustomSectionPrompt,
} from './prompts-v2';
import type { CustomSectionDefinition } from './prompts-v2';
import type { NarrativePromptConfig } from './narrative-prompt-shared';

const logger = new Logger('ReportGenerationV2Custom');

const CUSTOM_FIXED_ORDER = ['executive_summary', 'scenario_analysis'] as const;

/**
 * Build the outline prompt for custom reports.
 * Asks the AI to return both a narrative outline AND a JSON section plan.
 */
export function buildCustomOutlinePrompt(context: Record<string, any>): string {
  const question =
    context.custom_question ||
    context.user_goal_summary ||
    'General market analysis';

  return `You are planning a custom market analysis report for ${context.geography_name || 'a market'}.

## The User's Question
${question}

## Available Data
- ZHVI: ${context.zhvi || 'N/A'} | YoY: ${context.zhvi_yoy || 'N/A'}%
- ZORI: ${context.zori || 'N/A'} | YoY: ${context.zori_yoy || 'N/A'}%
- Days on market: ${context.days_on_market || 'N/A'}
- Market phase: ${context.market_phase || 'N/A'}
- Median income: ${context.median_household_income || 'N/A'}
- Unemployment: ${context.unemployment_rate || 'N/A'}%
- PropertyIQ Score: ${context.propertyiq_score || context.homeready_score || 'N/A'}/100
- Forecast: ${context.zhvf_1yr_pct || 'N/A'}%

## Your Task

First, output:
TITLE: A compelling report title that captures the key finding for this question (max 20 words).
SUBTITLE: One sentence expanding on the title.

Then produce two things:

### 1. Narrative Outline (150-200 words)
The story arc for this report: what the reader will learn, key insights, and how sections connect.

### 2. Dynamic Sections (JSON)
After the outline, output a JSON block defining 2-3 analysis sections tailored to the question.
Each section should focus on a distinct analytical angle.

\`\`\`json
[
  {
    "id": "snake_case_id",
    "title": "Human Readable Title",
    "analysis_focus": "What this section should analyze in detail",
    "relevant_vars": ["zhvi", "zhvi_yoy", "market_phase"],
    "suggested_tokens": 1500
  }
]
\`\`\`

Rules:
- Section IDs must be unique snake_case strings
- Each section must address a different facet of the user's question
- relevant_vars should reference actual template variable names from the data above
- suggested_tokens between 1000-2000 per section`;
}

/**
 * Parse dynamic section definitions from the outline response.
 * Extracts the JSON block containing CustomSectionDefinition[].
 */
function parseDynamicSections(outline: string): CustomSectionDefinition[] {
  const jsonMatch = outline.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    logger.warn('[v2-custom] No JSON section block found in outline');
    return [];
  }

  try {
    const sections = JSON.parse(jsonMatch[1].trim());
    if (!Array.isArray(sections)) return [];
    return sections.filter(
      (s: any) => s.id && s.title && s.analysis_focus,
    ) as CustomSectionDefinition[];
  } catch (error: any) {
    logger.error(`[v2-custom] Failed to parse section JSON: ${error.message}`);
    return [];
  }
}

/**
 * Build the full sections config for a custom report by combining
 * fixed sections with dynamically generated ones from the outline.
 */
export function buildCustomSectionsFromOutline(
  outline: string,
  context: Record<string, any>,
): {
  sectionIds: readonly string[];
  sectionsMap: Record<string, NarrativePromptConfig>;
} {
  const dynamicDefs = parseDynamicSections(outline);
  const customQuestion =
    context.custom_question || context.user_goal_summary || '';

  // Build section map: executive_summary + dynamic sections + scenario_analysis
  const sectionsMap: Record<string, NarrativePromptConfig> = {
    ...CUSTOM_REPORT_FIXED_SECTIONS,
  };

  const dynamicIds: string[] = [];
  for (const def of dynamicDefs) {
    sectionsMap[def.id] = buildCustomSectionPrompt(def, {
      customQuestion,
    });
    dynamicIds.push(def.id);
  }

  const sectionIds = ['executive_summary', ...dynamicIds, 'scenario_analysis'];

  logger.log(
    `[v2-custom] Built ${sectionIds.length} sections (${dynamicIds.length} dynamic)`,
  );

  return { sectionIds, sectionsMap };
}

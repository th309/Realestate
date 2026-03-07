/**
 * V2 Report Prompt Sections — Public API
 *
 * Re-exports all v2 prompt sections and provides a mapping from
 * report type to section configuration.
 */

export {
  REPORT_SYSTEM_PROMPT_HOMEBUYER,
  REPORT_SYSTEM_PROMPT_INVESTOR,
  REPORT_SYSTEM_PROMPT_CUSTOM,
} from './system-prompt';

export {
  HOMEREADY_V2_SECTIONS,
  HOMEREADY_V2_SECTION_ORDER,
} from './homeready-sections';

export {
  INVESTOR_V2_SECTIONS,
  INVESTOR_V2_SECTIONS as INVESTOREDGE_V2_SECTIONS,
  INVESTOR_V2_SECTION_ORDER,
} from './investor-sections';

export {
  COMPARISON_V2_SECTIONS,
  COMPARISON_V2_SECTION_ORDER,
} from './comparison-sections';

export {
  CUSTOM_REPORT_FIXED_SECTIONS,
  buildCustomSectionPrompt,
  type CustomSectionDefinition,
} from './custom-report-sections';

export {
  SCENARIO_ANALYSIS_HOMEBUYER,
  SCENARIO_ANALYSIS_INVESTOR,
} from './scenario-analysis-prompt';

import type { NarrativePromptConfig } from '../narrative-prompt-shared';

import {
  REPORT_SYSTEM_PROMPT_HOMEBUYER,
  REPORT_SYSTEM_PROMPT_INVESTOR,
  REPORT_SYSTEM_PROMPT_CUSTOM,
} from './system-prompt';
import { HOMEREADY_V2_SECTIONS } from './homeready-sections';
import { INVESTOR_V2_SECTIONS } from './investor-sections';
import { COMPARISON_V2_SECTIONS } from './comparison-sections';

/**
 * Returns the appropriate system prompt for a given report type.
 */
export function getSystemPromptForReportType(reportType: string): string {
  switch (reportType) {
    case 'investor':
    case 'investoredge':
      return REPORT_SYSTEM_PROMPT_INVESTOR;
    case 'custom':
      return REPORT_SYSTEM_PROMPT_CUSTOM;
    case 'homeready':
    default:
      return REPORT_SYSTEM_PROMPT_HOMEBUYER;
  }
}

/**
 * Maps report type to its v2 section prompts.
 *
 * - homeready / investor / comparison: static section maps
 * - custom: uses 'dynamic' — fixed sections + outline-generated sections
 */
export const V2_SECTIONS_BY_REPORT_TYPE: Record<
  string,
  Record<string, NarrativePromptConfig> | 'dynamic'
> = {
  homeready: HOMEREADY_V2_SECTIONS,
  investor: INVESTOR_V2_SECTIONS,
  investoredge: INVESTOR_V2_SECTIONS,
  comparison: COMPARISON_V2_SECTIONS,
  custom: 'dynamic',
};

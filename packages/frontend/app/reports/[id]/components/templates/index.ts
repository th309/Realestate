/**
 * Report Template Registry
 *
 * Maps report types to their section components.
 * Each template defines the sections that should be rendered and their order.
 */

import type { ComponentType } from 'react';
import type { ReportInstance } from '../../../types';

// Homebuyer sections
import {
  ExecutiveSummary,
  ScoreDeepDive,
  AffordabilityAnalysis,
  MarketConditions,
  RisksAndConsiderations,
  NextSteps,
} from '../sections/homebuyer';

// Investor sections
import {
  InvestmentThesis,
  CashFlowAnalysis,
  AppreciationOutlook,
  GrowthCatalysts,
  RiskAssessment,
} from '../sections/investor';

// Agent sections
import {
  MarketPulse,
  PriceTrends,
  SupplyDemand,
  TalkingPoints,
} from '../sections/agent';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Props interface for section components */
export interface SectionComponentProps {
  report: ReportInstance;
}

/** A section component with its configuration */
export interface TemplateSection {
  /** React component to render this section */
  component: ComponentType<SectionComponentProps>;
  /** Unique identifier for this section within the template */
  id: string;
}

/** A report template definition */
export interface ReportTemplateDefinition {
  /** Display name for the template */
  name: string;
  /** Brief description of the template's purpose */
  description: string;
  /** Ordered list of sections to render */
  sections: TemplateSection[];
}

/** Available report template types */
export type ReportTemplateType = 'homeready' | 'investoredge' | 'market_snapshot';

// -----------------------------------------------------------------------------
// Template Definitions
// -----------------------------------------------------------------------------

export const REPORT_TEMPLATES: Record<ReportTemplateType, ReportTemplateDefinition> = {
  homeready: {
    name: 'HomeReady Report',
    description: 'Comprehensive homebuyer analysis',
    sections: [
      { component: ExecutiveSummary, id: 'executive-summary' },
      { component: ScoreDeepDive, id: 'score-deep-dive' },
      { component: AffordabilityAnalysis, id: 'affordability' },
      { component: MarketConditions, id: 'market-conditions' },
      { component: RisksAndConsiderations, id: 'risks' },
      { component: NextSteps, id: 'next-steps' },
    ],
  },
  investoredge: {
    name: 'InvestorEdge Report',
    description: 'Investment opportunity analysis',
    sections: [
      { component: InvestmentThesis, id: 'investment-thesis' },
      { component: CashFlowAnalysis, id: 'cash-flow' },
      { component: AppreciationOutlook, id: 'appreciation' },
      { component: GrowthCatalysts, id: 'growth-catalysts' },
      { component: RiskAssessment, id: 'risk-assessment' },
    ],
  },
  market_snapshot: {
    name: 'Market Snapshot',
    description: 'Agent market briefing',
    sections: [
      { component: MarketPulse, id: 'market-pulse' },
      { component: PriceTrends, id: 'price-trends' },
      { component: SupplyDemand, id: 'supply-demand' },
      { component: TalkingPoints, id: 'talking-points' },
    ],
  },
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get a template definition by report type
 *
 * @param reportType - The type of report template to retrieve
 * @returns The template definition or undefined if not found
 *
 * @example
 * ```ts
 * const template = getTemplate('homeready');
 * if (template) {
 *   template.sections.forEach(({ component: Section, id }) => {
 *     // Render each section
 *   });
 * }
 * ```
 */
export function getTemplate(reportType: string): ReportTemplateDefinition | undefined {
  return REPORT_TEMPLATES[reportType as ReportTemplateType];
}

/**
 * Check if a template type is valid
 *
 * @param reportType - The type to check
 * @returns True if the type is a valid template type
 */
export function isValidTemplateType(reportType: string): reportType is ReportTemplateType {
  return reportType in REPORT_TEMPLATES;
}

/**
 * Get all available template types
 *
 * @returns Array of available template type keys
 */
export function getTemplateTypes(): ReportTemplateType[] {
  return Object.keys(REPORT_TEMPLATES) as ReportTemplateType[];
}

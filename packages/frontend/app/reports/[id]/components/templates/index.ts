/**
 * Report Template Registry
 *
 * Maps report types to their section components.
 * Each template defines the sections that should be rendered and their order.
 *
 * ## Error Handling
 *
 * When rendering sections, wrap each section component in a `SectionErrorBoundary`
 * to prevent individual section failures from crashing the entire report.
 *
 * @example
 * ```tsx
 * import { SectionErrorBoundary } from '../SectionErrorBoundary';
 * import { getTemplate } from './templates';
 *
 * function ReportRenderer({ report }: { report: ReportInstance }) {
 *   const template = getTemplate(report.template_type);
 *   if (!template) return <NotFound />;
 *
 *   return (
 *     <div className="report-container">
 *       {template.sections.map(({ component: Section, id }) => (
 *         <SectionErrorBoundary key={id} sectionId={id}>
 *           <Section report={report} />
 *         </SectionErrorBoundary>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * The error boundary will:
 * - Catch JavaScript errors in section components
 * - Display a graceful fallback UI instead of crashing
 * - Log the error for debugging
 * - Allow the rest of the report to continue rendering
 */

import type { ComponentType } from 'react';
import type { ReportInstance } from '../../../types';

// Homebuyer sections (redesigned)
import {
  Hero,
  ScoreStory,
  AffordabilityDeepDive,
  MarketTimingDeepDive,
  StabilityDeepDive,
  GrowthPotentialDeepDive,
  YourPriorities,
  BottomLine,
} from '../sections/homebuyer';

// Investor sections (redesigned)
import {
  InvestorHero,
  InvestorScoreStory,
  CashFlowDeepDive,
  RentDemandDeepDive,
  AppreciationDeepDive,
  EntryPointDeepDive,
  RiskDeepDive,
  InvestmentThesisSection,
  ProFormaSnapshot,
  InvestorBottomLine,
} from '../sections/investor';

// Agent sections (legacy + redesigned)
import {
  MarketPulse,
  PriceTrends,
  SupplyDemand,
  TalkingPoints,
  ClientOverview,
  ClientPriceValue,
  ClientMarketConditions,
  ClientMeaning,
  AgentBranding,
  PrepQuickStats,
  PrepTalkingPoints,
  PrepObjectionHandlers,
  PrepCompetitiveContext,
  PrepNewsSignals,
} from '../sections/agent';

// Shared sections
import { MarketPulse as SharedMarketPulse } from '../sections/shared';

// Comparison sections (redesigned)
import {
  ComparisonHero,
  HeadToHeadScoreStory,
  ComponentShowdown,
  PriorityWeightedAnalysis,
  MarketStrengths,
  ComparisonVerdict,
} from '../sections/comparison';

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
export type ReportTemplateType = 'homeready' | 'investoredge' | 'market_snapshot' | 'market_snapshot_client' | 'market_snapshot_prep' | 'comparison';

// -----------------------------------------------------------------------------
// Template Definitions
// -----------------------------------------------------------------------------

export const REPORT_TEMPLATES: Record<ReportTemplateType, ReportTemplateDefinition> = {
  homeready: {
    name: 'HomeReady Report',
    description: 'Comprehensive homebuyer analysis with score-driven narrative',
    sections: [
      { component: Hero, id: 'hero' },
      { component: ScoreStory, id: 'score-story' },
      { component: AffordabilityDeepDive, id: 'affordability-deep-dive' },
      { component: MarketTimingDeepDive, id: 'market-timing-deep-dive' },
      { component: StabilityDeepDive, id: 'stability-deep-dive' },
      { component: GrowthPotentialDeepDive, id: 'growth-potential-deep-dive' },
      { component: YourPriorities, id: 'your-priorities' },
      { component: BottomLine, id: 'bottom-line' },
      { component: SharedMarketPulse, id: 'market-pulse' },
    ],
  },
  investoredge: {
    name: 'InvestorEdge Report',
    description: 'Score-driven investment opportunity analysis',
    sections: [
      { component: InvestorHero, id: 'investor-hero' },
      { component: InvestorScoreStory, id: 'investor-score-story' },
      { component: CashFlowDeepDive, id: 'cash-flow' },
      { component: RentDemandDeepDive, id: 'rent-demand' },
      { component: AppreciationDeepDive, id: 'appreciation' },
      { component: EntryPointDeepDive, id: 'entry-point' },
      { component: RiskDeepDive, id: 'risk' },
      { component: InvestmentThesisSection, id: 'investment-thesis' },
      { component: ProFormaSnapshot, id: 'pro-forma' },
      { component: InvestorBottomLine, id: 'investor-bottom-line' },
      { component: SharedMarketPulse, id: 'market-pulse' },
    ],
  },
  market_snapshot: {
    name: 'Market Snapshot',
    description: 'Agent market briefing (legacy)',
    sections: [
      { component: MarketPulse, id: 'market-pulse' },
      { component: PriceTrends, id: 'price-trends' },
      { component: SupplyDemand, id: 'supply-demand' },
      { component: TalkingPoints, id: 'talking-points' },
    ],
  },
  market_snapshot_client: {
    name: 'Client Market Report',
    description: 'Clean, shareable market overview for clients',
    sections: [
      { component: ClientOverview, id: 'client-overview' },
      { component: ClientPriceValue, id: 'client-price' },
      { component: ClientMarketConditions, id: 'client-conditions' },
      { component: ClientMeaning, id: 'client-meaning' },
      { component: AgentBranding, id: 'agent-branding' },
    ],
  },
  market_snapshot_prep: {
    name: 'Agent Prep View',
    description: 'Dense internal briefing for agent preparation',
    sections: [
      { component: PrepQuickStats, id: 'prep-stats' },
      { component: PrepTalkingPoints, id: 'prep-talking-points' },
      { component: PrepObjectionHandlers, id: 'prep-objections' },
      { component: PrepCompetitiveContext, id: 'prep-competitive' },
      { component: PrepNewsSignals, id: 'prep-signals' },
    ],
  },
  comparison: {
    name: 'Market Comparison',
    description: 'Score-driven side-by-side market comparison',
    sections: [
      { component: ComparisonHero, id: 'comparison-hero' },
      { component: HeadToHeadScoreStory, id: 'head-to-head' },
      { component: ComponentShowdown, id: 'component-showdown' },
      { component: PriorityWeightedAnalysis, id: 'priority-analysis' },
      { component: MarketStrengths, id: 'market-strengths' },
      { component: ComparisonVerdict, id: 'comparison-verdict' },
      { component: SharedMarketPulse, id: 'market-pulse' },
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

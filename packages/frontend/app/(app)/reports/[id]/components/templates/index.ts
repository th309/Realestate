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

import type { ComponentType } from "react";
import type { ReportInstance } from "../../../types";

// Agent sections (redesigned)
import {
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
} from "../sections/agent";

// Comparison report (summary comparing all markets + per-market deep-dive tabs).
// Replaces the old bespoke comparison sections that read dead legacy scores.
import { ComparisonReportV3 } from "../sections/comparison/ComparisonReportV3";

// V2 template definitions (report prompting v2 — kept in separate file for size)
import { V2_REPORT_TEMPLATES } from "./v2Templates";

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

/** Available report template types (includes v2 variants for new narrative format) */
export type ReportTemplateType =
  | "market_snapshot_client"
  | "market_snapshot_prep"
  | "comparison"
  | "homeready_v2"
  | "investoredge_v2"
  | "comparison_v2"
  | "custom_research_v2";

// -----------------------------------------------------------------------------
// Template Definitions
// -----------------------------------------------------------------------------

export const REPORT_TEMPLATES: Record<
  ReportTemplateType,
  ReportTemplateDefinition
> = {
  homeready_v2: V2_REPORT_TEMPLATES.homeready_v2,
  investoredge_v2: V2_REPORT_TEMPLATES.investoredge_v2,
  comparison_v2: V2_REPORT_TEMPLATES.comparison_v2,
  custom_research_v2: V2_REPORT_TEMPLATES.custom_research_v2,
  market_snapshot_client: {
    name: "Client Market Report",
    description: "Clean, shareable market overview for clients",
    sections: [
      { component: ClientOverview, id: "client-overview" },
      { component: ClientPriceValue, id: "client-price" },
      { component: ClientMarketConditions, id: "client-conditions" },
      { component: ClientMeaning, id: "client-meaning" },
      { component: AgentBranding, id: "agent-branding" },
    ],
  },
  market_snapshot_prep: {
    name: "Agent Prep View",
    description: "Dense internal briefing for agent preparation",
    sections: [
      { component: PrepQuickStats, id: "prep-stats" },
      { component: PrepTalkingPoints, id: "prep-talking-points" },
      { component: PrepObjectionHandlers, id: "prep-objections" },
      { component: PrepCompetitiveContext, id: "prep-competitive" },
      { component: PrepNewsSignals, id: "prep-signals" },
    ],
  },
  comparison: {
    name: "Market Comparison",
    description: "Summary comparing all markets + per-market deep-dive tabs",
    sections: [{ component: ComparisonReportV3, id: "comparison" }],
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
export function getTemplate(
  reportType: string,
): ReportTemplateDefinition | undefined {
  return (
    REPORT_TEMPLATES[reportType as ReportTemplateType] ??
    V2_REPORT_TEMPLATES[reportType]
  );
}

/**
 * Check if a template type is valid
 *
 * @param reportType - The type to check
 * @returns True if the type is a valid template type
 */
export function isValidTemplateType(
  reportType: string,
): reportType is ReportTemplateType {
  return reportType in REPORT_TEMPLATES || reportType in V2_REPORT_TEMPLATES;
}

/**
 * Get all available template types
 *
 * @returns Array of available template type keys
 */
export function getTemplateTypes(): ReportTemplateType[] {
  return Object.keys(REPORT_TEMPLATES) as ReportTemplateType[];
}

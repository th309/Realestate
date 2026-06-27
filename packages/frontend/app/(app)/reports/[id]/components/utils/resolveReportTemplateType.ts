import type { ReportWithTemplate } from "../types";
import type { UserType, ReportInstance } from "../../../types";
import type { ReportTemplateType } from "../templates";
import { isV2Narrative } from "../sections/v2";

export interface ResolvedReportTemplate {
  templateType: ReportTemplateType;
  isAgentReport: boolean;
}

/**
 * Determine which template a report should render with, plus whether it is an
 * agent (market-snapshot) report. Extracted verbatim from ReportViewer so the
 * selection rules live in one testable place.
 */
export function resolveReportTemplateType(
  report: ReportWithTemplate,
  agentViewMode: "client" | "prep",
): ResolvedReportTemplate {
  const userType = report.user_type as UserType;
  const reportInstance = report as unknown as ReportInstance;

  // Determine template based on report type first, then user type
  const reportType = report.template?.config?.report_type;
  const isAgentReport =
    report.user_type === "agent" || reportType === "snapshot";
  const useV2 = isV2Narrative(reportInstance);
  let templateType: ReportTemplateType;

  const isCustomReport =
    (reportType as string) === "custom" ||
    (report as any).template_slug === "custom_research" ||
    report.template?.slug === "custom_research";

  if (
    reportType === "comparison" &&
    report.comparison_geographies &&
    report.comparison_geographies.length > 0
  ) {
    // All comparison reports (v2 or legacy narrative) use the rebuilt comparison
    // view: a summary across all markets + per-market deep-dive tabs, reading the
    // live PropertyIQ score. The old comparison/comparison_v2 section templates
    // are retired for new renders.
    templateType = "comparison";
  } else if (isAgentReport) {
    templateType =
      agentViewMode === "prep"
        ? "market_snapshot_prep"
        : "market_snapshot_client";
  } else if (isCustomReport && useV2) {
    templateType = "custom_research_v2";
  } else if (userType === "investor") {
    templateType = "investoredge_v2";
  } else {
    templateType = "homeready_v2";
  }

  return { templateType, isAgentReport };
}

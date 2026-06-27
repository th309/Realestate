"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, FileText, AlertTriangle } from "lucide-react";
import { BrandingProvider } from "./components/BrandingProvider";
import { ReportWithTemplate } from "./components/types";
import { ReportInstance } from "../types";
import { ConversationPanel } from "./ConversationPanel";
import { SectionErrorBoundary } from "./components/SectionErrorBoundary";
import { getTemplate } from "./components/templates";
import { PersonalizationPanel } from "./components/PersonalizationPanel";
import { usePersonalization } from "./hooks/usePersonalization";
import { GeneratingState } from "./components/GeneratingState";
import { formatSectionName } from "./components/utils/sectionDisplay";
import { resolveReportTemplateType } from "./components/utils/resolveReportTemplateType";
import { ReportHeader } from "./components/ReportHeader";
import { ReportHeroSection } from "./components/ReportHeroSection";
import { AgentViewModeToggle } from "./components/AgentViewModeToggle";
import { ReportFooter } from "./components/ReportFooter";
import { normalizeReport } from "./components/utils/normalizeReport";
import { fetchReport as fetchReportAPI, fetchSampleReport } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics/tracker";
import "../styles/report-theme.css";

const POLL_INTERVAL = 2000;

interface ReportViewerProps {
  reportId: string;
  isSample?: boolean;
}

async function fetchReportById(
  reportId: string,
  userId: string,
  isSample?: boolean,
): Promise<ReportWithTemplate | null> {
  const data = isSample
    ? await fetchSampleReport<ReportWithTemplate>()
    : await fetchReportAPI<ReportWithTemplate>(reportId, { userId });
  return data ? normalizeReport(data) : null;
}

export function ReportViewer({ reportId, isSample }: ReportViewerProps) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [report, setReport] = useState<ReportWithTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);

  const [agentViewMode, setAgentViewMode] = useState<"client" | "prep">(
    "client",
  );

  // Personalization hook — must be called unconditionally (before any early returns)
  const medianPrice = report
    ? (((report as unknown as ReportInstance).populated_data as any)?.current
        ?.zhvi ??
      ((report as unknown as ReportInstance).populated_data as any)?.current
        ?.home_value ??
      null)
    : null;
  const handleNarrativesUpdated = useCallback(
    (narrative: Record<string, string | string[]>) => {
      setReport((prev) => {
        if (!prev) return prev;
        // Merge updated narratives into existing ai_narrative, casting for type compatibility
        const merged = { ...prev.ai_narrative } as Record<string, any>;
        for (const [key, value] of Object.entries(narrative)) {
          merged[key] = value;
        }
        return { ...prev, ai_narrative: merged };
      });
    },
    [],
  );
  const personalization = usePersonalization(
    reportId,
    report
      ? ((report as unknown as ReportInstance).user_inputs as any)
      : undefined,
    typeof medianPrice === "number" ? medianPrice : null,
    handleNarrativesUpdated,
  );

  // Track report view once on initial load
  const reportViewFired = React.useRef(false);
  useEffect(() => {
    if (
      !reportViewFired.current &&
      !loading &&
      report &&
      report.status !== "generating"
    ) {
      reportViewFired.current = true;
      trackEvent("feature.report_view", {
        report_id: reportId,
        report_type: report.user_type,
        geography: report.primary_geography_name,
      });
    }
  }, [loading, report, reportId]);

  const pollReport = useCallback(async () => {
    try {
      const data = await fetchReportById(reportId, userId, isSample);
      if (data) {
        setReport(data);
        if (data.status === "generating") {
          return true;
        }
      }
      return false;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch report");
      return false;
    }
  }, [reportId]);

  useEffect(() => {
    let pollTimer: NodeJS.Timeout | null = null;

    const startPolling = async () => {
      const data = await fetchReportById(reportId, userId, isSample);
      setLoading(false);

      if (data) {
        setReport(data);
        if (data.status === "generating") {
          const poll = async () => {
            const shouldContinue = await pollReport();
            if (shouldContinue) {
              pollTimer = setTimeout(poll, POLL_INTERVAL);
            }
          };
          pollTimer = setTimeout(poll, POLL_INTERVAL);
        }
      }
    };

    startPolling().catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to fetch report");
      setLoading(false);
    });

    return () => {
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [reportId, pollReport]);

  // Loading State
  if (loading) {
    return (
      <div className="report-page min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--report-navy)]/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[var(--report-navy)] animate-spin" />
          </div>
          <p className="report-body">Loading report...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !report) {
    return (
      <div className="report-page min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--report-error-bg)] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-[var(--report-error)]" />
          </div>
          <h2 className="report-heading-md mb-2">Report not found</h2>
          <p className="report-body mb-6">
            {error || "The requested report could not be loaded."}
          </p>
          <Link href="/reports" className="report-btn-primary">
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  // Generating State
  if (report.status === "generating") {
    return <GeneratingState report={report} />;
  }

  // Failed State
  if (report.status === "failed") {
    return (
      <div className="report-page min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--report-error-bg)] flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-[var(--report-error)]" />
          </div>
          <h2 className="report-heading-md mb-2">Generation Failed</h2>
          <p className="report-body mb-6">
            {report.error_message ||
              "An unexpected error occurred while generating your report."}
          </p>
          <Link href="/reports" className="report-btn-primary">
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  const reportInstance = report as unknown as ReportInstance;

  const { templateType, isAgentReport } = resolveReportTemplateType(
    report,
    agentViewMode,
  );

  const template = getTemplate(templateType);
  const templateSections = template?.sections || [];

  return (
    <div className="report-page min-h-screen">
      {/* Header */}
      <ReportHeader
        report={report}
        templateType={templateType}
        templateSections={templateSections}
        showConversation={showConversation}
        setShowConversation={setShowConversation}
        formatSectionName={formatSectionName}
      />

      {/* Personalization Panel - only show for non-agent reports */}
      {!isAgentReport && (
        <PersonalizationPanel
          inputs={personalization.inputs}
          setInput={
            personalization.setInput as (key: string, value: any) => void
          }
          dirty={personalization.dirty}
          reset={personalization.reset}
          regenerating={personalization.regenerating}
          userType={report.user_type}
        />
      )}

      {/* Agent Mode Toggle */}
      {isAgentReport && (
        <AgentViewModeToggle
          agentViewMode={agentViewMode}
          setAgentViewMode={setAgentViewMode}
        />
      )}

      {/* Main Content */}
      <div className="flex">
        <main className={`flex-1 ${showConversation ? "lg:pr-[400px]" : ""}`}>
          {/* Report Hero - skip for redesigned templates since their Hero/Overview sections handle it */}
          <ReportHeroSection
            report={report}
            templateType={templateType}
            templateSections={templateSections}
          />

          {/* Report Body */}
          <div className="max-w-4xl mx-auto px-6 py-10">
            {/* Dynamic Sections - Using New Template System */}
            <BrandingProvider>
              {templateSections.map(({ component: Section, id }, index) => (
                <section
                  key={id}
                  id={id}
                  className={`${id === "hero" || id === "investor-hero" || id === "comparison-hero" || id === "client-overview" ? "mb-0" : "mb-10"} report-animate-in`}
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <SectionErrorBoundary sectionId={id}>
                    <Section report={reportInstance} />
                  </SectionErrorBoundary>
                </section>
              ))}
            </BrandingProvider>

            {/* Report Footer */}
            <ReportFooter report={report} />
          </div>
        </main>

        {/* Conversation Panel */}
        {showConversation && (
          <ConversationPanel
            reportId={reportId}
            reportTitle={report.title}
            onClose={() => setShowConversation(false)}
          />
        )}
      </div>
    </div>
  );
}

export default ReportViewer;

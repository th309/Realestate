"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Share2, MessageSquare } from "lucide-react";
import { ReportWithTemplate } from "./types";
import { PDFExportButton } from "../export/PDFExport";
import { ReportTemplateType } from "./templates";
import { ShareReportModal } from "./ShareReportModal";
import { BrandedReportHeader } from "./BrandedReportHeader";
import { useReportBranding } from "../../hooks/useReportBranding";

interface TemplateSectionRef {
  id: string;
}

interface ReportHeaderProps {
  report: ReportWithTemplate;
  templateType: ReportTemplateType;
  templateSections: TemplateSectionRef[];
  showConversation: boolean;
  setShowConversation: (show: boolean) => void;
  formatSectionName: (sectionId: string) => string;
}

export function ReportHeader({
  report,
  templateType,
  templateSections,
  showConversation,
  setShowConversation,
  formatSectionName,
}: ReportHeaderProps) {
  const router = useRouter();
  const [showShareModal, setShowShareModal] = useState(false);
  const { branding: orgBranding } = useReportBranding(
    report.organization_id ?? null,
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Render branded header when org branding is available
  if (orgBranding) {
    return (
      <>
        <BrandedReportHeader
          branding={orgBranding}
          reportTitle={report.title}
          geographyName={report.primary_geography_name}
          reportDate={new Date(report.created_at).toLocaleDateString()}
          onBack={() => router.push("/reports")}
          onShare={() => setShowShareModal(true)}
          onPrint={handlePrint}
        />
        <ShareReportModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          reportId={report.id}
          reportTitle={report.title}
          userId={report.user_id}
          existingShareToken={report.share_token}
          reportData={null}
          onPrint={handlePrint}
          onExportPdf={handlePrint}
        />
      </>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-[var(--report-cream)] border-b border-[rgba(27,46,74,0.08)] backdrop-blur-sm report-no-print">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/reports" className="report-btn-ghost">
              <ArrowLeft className="w-4 h-4" />
              Back to Reports
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConversation(!showConversation)}
                className={`report-btn-ghost ${showConversation ? "bg-[var(--report-navy)] text-white hover:bg-[var(--report-navy-light)]" : ""}`}
                title="Ask AI about this report"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>

              <button
                onClick={() => setShowShareModal(true)}
                className="report-btn-ghost"
                title="Share & Export"
              >
                <Share2 className="w-4 h-4" />
              </button>

              <PDFExportButton
                title={report.title}
                marketName={report.primary_geography_name}
                score={
                  report.homeready_score ??
                  report.investoredge_score ??
                  (report as any).markethealth_score
                }
                scoreLabel="PropertyIQ Score"
                grade={
                  (report.scores_snapshot as any)?.homeready_grade ??
                  (report.scores_snapshot as any)?.investoredge_grade ??
                  (report.scores_snapshot as any)?.markethealth_grade
                }
                generatedDate={new Date(report.created_at).toLocaleDateString()}
                dataAsOfDate={report.data_as_of_date || "N/A"}
                aiModel={report.ai_model_used}
                sections={templateSections.map((s) => ({
                  id: s.id,
                  name: formatSectionName(s.id),
                }))}
                templateType={templateType}
              />
            </div>
          </div>
        </div>
      </header>

      <ShareReportModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        reportId={report.id}
        reportTitle={report.title}
        userId={report.user_id}
        existingShareToken={report.share_token}
        reportData={null}
        onPrint={handlePrint}
        onExportPdf={handlePrint}
      />
    </>
  );
}

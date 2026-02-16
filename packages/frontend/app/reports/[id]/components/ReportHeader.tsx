import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Share2, MessageSquare, Printer } from 'lucide-react';
import { ReportWithTemplate } from './types';
import { PDFExportButton } from '../export/PDFExport';
import { ReportTemplateType } from './templates';

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
  return (
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
              className={`report-btn-ghost ${showConversation ? 'bg-[var(--report-navy)] text-white hover:bg-[var(--report-navy-light)]' : ''}`}
              title="Ask AI about this report"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>
            <button className="report-btn-ghost" title="Share report">
              <Share2 className="w-4 h-4" />
            </button>
            <button className="report-btn-ghost" title="Print report">
              <Printer className="w-4 h-4" />
            </button>
            <PDFExportButton
              title={report.title}
              marketName={report.primary_geography_name}
              score={report.homeready_score ?? report.investoredge_score ?? (report as any).markethealth_score}
              scoreLabel={
                templateType.includes('investoredge') ? 'InvestorEdge Score' :
                templateType.includes('market_snapshot') ? 'MarketHealth Score' :
                'HomeReady Score'
              }
              grade={(report.scores_snapshot as any)?.homeready_grade ?? (report.scores_snapshot as any)?.investoredge_grade ?? (report.scores_snapshot as any)?.markethealth_grade}
              generatedDate={new Date(report.created_at).toLocaleDateString()}
              dataAsOfDate={report.data_as_of_date || 'N/A'}
              aiModel={report.ai_model_used}
              sections={templateSections.map(s => ({ id: s.id, name: formatSectionName(s.id) }))}
              templateType={templateType}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

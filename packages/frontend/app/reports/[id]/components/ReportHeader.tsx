import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Share2, MessageSquare, Printer, Check, Link2, Loader2 } from 'lucide-react';
import { ReportWithTemplate } from './types';
import { PDFExportButton } from '../export/PDFExport';
import { ReportTemplateType } from './templates';
import { createReportShareLink } from '@/lib/data';

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
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleCopyLink = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      // If the report already has a share token, reuse it; otherwise create one
      let token = report.share_token;
      if (!token) {
        token = await createReportShareLink(report.id, report.user_id);
      }
      const shareUrl = `${window.location.origin}/shared/report/${token}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowShareMenu(false);
      }, 1500);
    } catch {
      // Fallback: copy the current page URL
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowShareMenu(false);
      }, 1500);
    } finally {
      setSharing(false);
    }
  }, [report.id, report.user_id, report.share_token, sharing]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

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

            {/* Share button with dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="report-btn-ghost"
                title="Share report"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {showShareMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-[rgba(27,46,74,0.1)] py-1 min-w-[180px]">
                    <button
                      onClick={handleCopyLink}
                      disabled={sharing}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--report-stone)] hover:bg-[var(--report-cream)] transition-colors disabled:opacity-50"
                    >
                      {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : copied ? <Check className="w-4 h-4 text-green-600" /> : <Link2 className="w-4 h-4" />}
                      {sharing ? 'Creating link...' : copied ? 'Copied!' : 'Copy share link'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <button onClick={handlePrint} className="report-btn-ghost" title="Print report">
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

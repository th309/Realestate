'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  FileText,
  MapPin,
  Calendar,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { BrandingProvider } from './components/BrandingProvider';
import { ReportWithTemplate } from './components/types';
import { UserType, ReportInstance } from '../types';
import { ConversationPanel } from './ConversationPanel';
import { SectionErrorBoundary } from './components/SectionErrorBoundary';
import { getTemplate, ReportTemplateType } from './components/templates';
import { PersonalizationPanel } from './components/PersonalizationPanel';
import { usePersonalization } from './hooks/usePersonalization';
import { GeneratingState, GENERATION_STEPS } from './components/GeneratingState';
import { SectionIcon, formatSectionName } from './components/utils/sectionDisplay';
import { ReportHeader } from './components/ReportHeader';
import { ReportFooter } from './components/ReportFooter';
import { normalizeReport } from './components/utils/normalizeReport';
import { fetchReport as fetchReportAPI } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import '../styles/report-theme.css';

const POLL_INTERVAL = 2000;

interface ReportViewerProps {
  reportId: string;
}

async function fetchReport(reportId: string, userId: string): Promise<ReportWithTemplate | null> {
  const data = await fetchReportAPI<ReportWithTemplate>(reportId, { userId });
  return data ? normalizeReport(data) : null;
}

export function ReportViewer({ reportId }: ReportViewerProps) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [report, setReport] = useState<ReportWithTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [agentViewMode, setAgentViewMode] = useState<'client' | 'prep'>('client');

  // Personalization hook — must be called unconditionally (before any early returns)
  const medianPrice = report
    ? ((report as unknown as ReportInstance).populated_data as any)?.current?.zhvi ??
      ((report as unknown as ReportInstance).populated_data as any)?.current?.home_value ?? null
    : null;
  const handleNarrativesUpdated = useCallback((narrative: Record<string, string | string[]>) => {
    setReport(prev => {
      if (!prev) return prev;
      // Merge updated narratives into existing ai_narrative, casting for type compatibility
      const merged = { ...prev.ai_narrative } as Record<string, any>;
      for (const [key, value] of Object.entries(narrative)) {
        merged[key] = value;
      }
      return { ...prev, ai_narrative: merged };
    });
  }, []);
  const personalization = usePersonalization(
    reportId,
    report ? (report as unknown as ReportInstance).user_inputs as any : undefined,
    typeof medianPrice === 'number' ? medianPrice : null,
    handleNarrativesUpdated,
  );

  const pollReport = useCallback(async () => {
    try {
      const data = await fetchReport(reportId, userId);
      if (data) {
        setReport(data);
        if (data.status === 'generating') {
          // Progress through steps but stay on the last one (don't cycle back)
          setGenerationStep((prev) => Math.min(prev + 1, GENERATION_STEPS.length - 1));
          return true;
        }
      }
      return false;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch report');
      return false;
    }
  }, [reportId]);

  useEffect(() => {
    let pollTimer: NodeJS.Timeout | null = null;

    const startPolling = async () => {
      const data = await fetchReport(reportId, userId);
      setLoading(false);

      if (data) {
        setReport(data);
        if (data.status === 'generating') {
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
      setError(e instanceof Error ? e.message : 'Failed to fetch report');
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
          <p className="report-body mb-6">{error || 'The requested report could not be loaded.'}</p>
          <Link href="/reports" className="report-btn-primary">
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  // Generating State
  if (report.status === 'generating') {
    return <GeneratingState report={report} step={generationStep} />;
  }

  // Failed State
  if (report.status === 'failed') {
    return (
      <div className="report-page min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--report-error-bg)] flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-[var(--report-error)]" />
          </div>
          <h2 className="report-heading-md mb-2">Generation Failed</h2>
          <p className="report-body mb-6">
            {report.error_message || 'An unexpected error occurred while generating your report.'}
          </p>
          <Link href="/reports" className="report-btn-primary">
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  const userType = report.user_type as UserType;

  // Determine template based on report type first, then user type
  const reportType = report.template?.config?.report_type;
  const isAgentReport = report.user_type === 'agent' || reportType === 'snapshot';
  let templateType: ReportTemplateType;

  if (reportType === 'comparison' && report.comparison_geographies && report.comparison_geographies.length > 0) {
    templateType = 'comparison';
  } else if (isAgentReport) {
    templateType = agentViewMode === 'prep' ? 'market_snapshot_prep' : 'market_snapshot_client';
  } else if (userType === 'investor') {
    templateType = 'investoredge';
  } else {
    templateType = 'homeready';
  }

  const template = getTemplate(templateType);
  const templateSections = template?.sections || [];

  // Convert report to ReportInstance for new section components
  const reportInstance = report as unknown as ReportInstance;

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
          setInput={personalization.setInput as (key: string, value: any) => void}
          dirty={personalization.dirty}
          reset={personalization.reset}
          regenerating={personalization.regenerating}
          userType={report.user_type}
        />
      )}

      {/* Agent Mode Toggle */}
      {isAgentReport && (
        <div className="bg-white border-b border-[rgba(27,46,74,0.08)] report-no-print">
          <div className="max-w-6xl mx-auto px-6 py-3">
            <div className="flex items-center justify-center gap-1 p-1 rounded-lg bg-[var(--report-cream)] w-fit mx-auto">
              <button
                onClick={() => setAgentViewMode('client')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  agentViewMode === 'client'
                    ? 'bg-white text-[var(--report-navy)] shadow-sm'
                    : 'text-[var(--report-stone)] hover:text-[var(--report-navy)]'
                }`}
              >
                Client View
              </button>
              <button
                onClick={() => setAgentViewMode('prep')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  agentViewMode === 'prep'
                    ? 'bg-white text-[var(--report-navy)] shadow-sm'
                    : 'text-[var(--report-stone)] hover:text-[var(--report-navy)]'
                }`}
              >
                Agent Prep
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex">
        <main className={`flex-1 ${showConversation ? 'lg:pr-[400px]' : ''}`}>
          {/* Report Hero - skip for redesigned templates since their Hero/Overview sections handle it */}
          {templateType !== 'homeready' && templateType !== 'investoredge' && templateType !== 'comparison' && templateType !== 'market_snapshot_client' && templateType !== 'market_snapshot_prep' && (
            <div className="bg-white border-b border-[rgba(27,46,74,0.06)]">
              <div className="max-w-4xl mx-auto px-6 py-10">
                <div className="report-animate-in">
                  {/* Report Type Badge */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="report-badge report-badge-ready">
                      {report.template?.name || 'Market Report'}
                    </span>
                    <span className="text-xs text-[var(--report-stone-light)]">
                      Generated {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title */}
                  <h1 className="text-3xl md:text-4xl font-semibold text-[var(--report-navy)] tracking-tight mb-4" style={{ fontFamily: 'var(--report-font-display)' }}>
                    {report.title}
                  </h1>

                  {/* Meta Row */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--report-stone)]">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[var(--report-stone-light)]" />
                      <span>{report.primary_geography_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[var(--report-stone-light)]" />
                      <span>Data as of {report.data_as_of_date}</span>
                    </div>
                    {report.ai_model_used && (
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[var(--report-stone-light)]" />
                        <span>AI-Enhanced</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Limited Data Coverage Notice */}
                {(report.populated_data as any)?.data_coverage?.is_limited && (() => {
                  const dc = (report.populated_data as any).data_coverage;
                  return (
                    <div
                      className="mt-6 rounded-xl p-4 report-animate-in"
                      style={{
                        backgroundColor: 'rgba(234, 179, 8, 0.08)',
                        border: '1px solid rgba(234, 179, 8, 0.2)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-[var(--report-navy)] mb-1">
                            Limited Data Coverage
                          </p>
                          <p className="text-sm text-[var(--report-stone)]">
                            {report.primary_geography_name} is a smaller market with limited data from some sources.
                            {' '}This report uses {dc.coverage_pct}% of our standard metrics
                            {dc.missing_categories?.length > 0 && (
                              <> &mdash; missing: {dc.missing_categories.join(', ')}</>
                            )}.
                            {' '}Some sections may use proxy data or Census estimates where primary sources are unavailable.
                            {dc.parent_msa_name && (
                              <> This area is part of the <strong>{dc.parent_msa_name}</strong> metro area, which has fuller data coverage.</>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Table of Contents */}
                {templateSections.length > 1 && (
                  <nav className="mt-8 p-5 report-card report-animate-in report-animate-in-delay-1">
                    <h3 className="report-label mb-3">In this report</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {templateSections.map((section) => (
                        <a
                          key={section.id}
                          href={`#${section.id}`}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--report-stone)] hover:bg-[var(--report-cream)] hover:text-[var(--report-navy)] transition-colors"
                        >
                          <SectionIcon sectionId={section.id} />
                          <span className="truncate">{formatSectionName(section.id)}</span>
                        </a>
                      ))}
                    </div>
                  </nav>
                )}
              </div>
            </div>
          )}

          {/* Report Body */}
          <div className="max-w-4xl mx-auto px-6 py-10">

            {/* Dynamic Sections - Using New Template System */}
            <BrandingProvider>
              {templateSections.map(({ component: Section, id }, index) => (
                <section
                  key={id}
                  id={id}
                  className={`${id === 'hero' || id === 'investor-hero' || id === 'comparison-hero' || id === 'client-overview' ? 'mb-0' : 'mb-10'} report-animate-in`}
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
          <ConversationPanel reportId={reportId} reportTitle={report.title} onClose={() => setShowConversation(false)} />
        )}
      </div>
    </div>
  );
}

export default ReportViewer;

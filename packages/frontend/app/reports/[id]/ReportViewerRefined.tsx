'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Share2,
  MessageSquare,
  Loader2,
  FileText,
  TrendingUp,
  Newspaper,
  MapPin,
  Calendar,
  Printer,
  Sparkles,
  BarChart3,
  Home,
  Users,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { BrandingProvider } from './components/BrandingProvider';
import { PageRenderer } from './components/SectionRenderer';
import { ReportWithTemplate } from './components/types';
import { ConversationPanel } from './ConversationPanel';
import '../styles/report-theme.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const POLL_INTERVAL = 2000;

interface ReportViewerRefinedProps {
  reportId: string;
}

async function fetchReport(reportId: string): Promise<ReportWithTemplate | null> {
  const userId = '4003d650-6a5e-4419-98d5-cf5374e1885d';

  const response = await fetch(`${API_URL}/api/reports/${reportId}`, {
    headers: {
      'x-user-id': userId,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch report: ${response.statusText}`);
  }

  return response.json();
}

const GENERATION_STEPS = [
  { id: 'scores', label: 'Calculating market scores', icon: TrendingUp, description: 'Analyzing market health indicators' },
  { id: 'news', label: 'Gathering market signals', icon: Newspaper, description: 'Collecting recent market data' },
  { id: 'ai', label: 'Generating AI analysis', icon: Sparkles, description: 'Creating personalized insights' },
];

export function ReportViewerRefined({ reportId }: ReportViewerRefinedProps) {
  const [report, setReport] = useState<ReportWithTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const pollReport = useCallback(async () => {
    try {
      const data = await fetchReport(reportId);
      if (data) {
        setReport(data);
        if (data.status === 'generating') {
          setGenerationStep((prev) => (prev + 1) % GENERATION_STEPS.length);
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
      const data = await fetchReport(reportId);
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

  const pages = report.template?.config?.pages || [];

  return (
    <div className="report-page min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--report-cream)] border-b border-[rgba(27,46,74,0.08)] backdrop-blur-sm report-no-print">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/reports"
              className="report-btn-ghost"
            >
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
              <button className="report-btn-primary" title="Download PDF">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        <main className={`flex-1 ${showConversation ? 'lg:pr-[400px]' : ''}`}>
          {/* Report Hero */}
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
                <h1 className="text-3xl md:text-4xl font-semibold text-[var(--report-navy)] font-['Source_Serif_4',serif] tracking-tight mb-4">
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

              {/* Table of Contents */}
              {pages.length > 1 && (
                <nav className="mt-8 p-5 report-card report-animate-in report-animate-in-delay-1">
                  <h3 className="report-label mb-3">In this report</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {pages.filter(p => p.name && p.name !== 'Cover').map((page, i) => (
                      <a
                        key={page.id || i}
                        href={`#${page.id || `section-${i}`}`}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--report-stone)] hover:bg-[var(--report-cream)] hover:text-[var(--report-navy)] transition-colors"
                      >
                        <PageIcon pageName={page.name || ''} />
                        <span className="truncate">{page.name}</span>
                      </a>
                    ))}
                  </div>
                </nav>
              )}
            </div>
          </div>

          {/* Report Body */}
          <div className="max-w-4xl mx-auto px-6 py-10">

            {/* Dynamic Sections */}
            <BrandingProvider>
              {pages.map((page, pageIndex) => (
                <section
                  key={page.id || pageIndex}
                  id={page.id || `section-${pageIndex}`}
                  className="mb-10 report-animate-in"
                  style={{ animationDelay: `${(pageIndex + 3) * 100}ms` }}
                >
                  {page.name && page.name !== 'Cover' && (
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-[var(--report-cream)] flex items-center justify-center">
                        <PageIcon pageName={page.name} />
                      </div>
                      <div>
                        <h2 className="report-heading-md">{page.name}</h2>
                      </div>
                    </div>
                  )}
                  <div className="space-y-5">
                    <PageRenderer page={page} report={report} />
                  </div>
                </section>
              ))}
            </BrandingProvider>

            {/* Report Footer */}
            <footer className="mt-16 pt-8 border-t border-[rgba(27,46,74,0.08)]">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--report-navy)] flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-[var(--report-navy)]">PropertyIQ</span>
                </div>
                <p className="report-body-sm mb-2">
                  AI-powered real estate market intelligence
                </p>
                <p className="text-xs text-[var(--report-stone-light)]">
                  Report generated on {new Date(report.created_at).toLocaleDateString()} ·
                  Data as of {report.data_as_of_date} ·
                  {report.ai_model_used && ` AI Model: ${report.ai_model_used}`}
                </p>
              </div>
            </footer>
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

// Generating State Component
function GeneratingState({ report, step }: { report: ReportWithTemplate; step: number }) {
  const currentStep = GENERATION_STEPS[step];

  return (
    <div className="report-page min-h-screen flex items-center justify-center">
      <div className="text-center max-w-lg px-6">
        {/* Animated Loader */}
        <div className="relative mb-10">
          <div className="w-28 h-28 mx-auto rounded-full bg-[var(--report-cream-dark)] flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-inner">
              <Loader2 className="w-10 h-10 text-[var(--report-navy)] animate-spin" />
            </div>
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white px-4 py-1.5 rounded-full shadow-md border border-[rgba(27,46,74,0.08)]">
            <span className="text-sm font-medium text-[var(--report-navy)]">
              Step {step + 1} of {GENERATION_STEPS.length}
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="report-heading-lg mb-2">Generating Your Report</h2>
        <p className="report-body mb-8">{report.primary_geography_name}</p>

        {/* Progress Steps */}
        <div className="report-card p-5 text-left">
          {GENERATION_STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = index === step;
            const isComplete = index < step;

            return (
              <div
                key={s.id}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                  isActive ? 'bg-[var(--report-cream)]' : ''
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isComplete
                      ? 'bg-[var(--report-success)] text-white'
                      : isActive
                      ? 'bg-[var(--report-navy)] text-white'
                      : 'bg-[var(--report-cream-dark)] text-[var(--report-stone-light)]'
                  }`}
                >
                  {isComplete ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      isActive ? 'text-[var(--report-navy)]' : 'text-[var(--report-stone)]'
                    }`}
                  >
                    {s.label}
                  </p>
                  <p className="text-xs text-[var(--report-stone-light)]">{s.description}</p>
                </div>
                {isActive && (
                  <Loader2 className="w-5 h-5 text-[var(--report-navy)] animate-spin" />
                )}
              </div>
            );
          })}
        </div>

        <p className="report-body-sm mt-6">This usually takes 10-30 seconds</p>
      </div>
    </div>
  );
}

// Page Icon Helper
function PageIcon({ pageName }: { pageName: string }) {
  const iconClass = 'w-4 h-4 text-[var(--report-navy)]';
  const name = pageName.toLowerCase();

  if (name.includes('afford')) return <DollarSign className={iconClass} />;
  if (name.includes('migrat')) return <Users className={iconClass} />;
  if (name.includes('demo')) return <Users className={iconClass} />;
  if (name.includes('economic')) return <BarChart3 className={iconClass} />;
  if (name.includes('story') || name.includes('narrative')) return <FileText className={iconClass} />;
  if (name.includes('home') || name.includes('personal')) return <Home className={iconClass} />;

  return <FileText className={iconClass} />;
}

export default ReportViewerRefined;

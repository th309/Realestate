'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ReportCover } from './ReportCover';
import { ConversationPanel } from './ConversationPanel';
import { HeroScoreSection } from './sections/HeroScoreSection';
import { NewsSection } from './sections/NewsSection';
import { NarrativeSection } from './sections/NarrativeSection';
import { ReportInstance, UserType } from '../types';
import { ArrowLeft, Download, Share2, MessageSquare, Loader2, FileText, TrendingUp, Newspaper } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const POLL_INTERVAL = 2000; // Poll every 2 seconds while generating

interface ReportViewerProps {
  reportId: string;
}

// Fetch report from backend API
async function fetchReport(reportId: string): Promise<ReportInstance | null> {
  // TODO: Replace with actual user ID from auth context
  const userId = '4003d650-6a5e-4419-98d5-cf5374e1885d';

  const response = await fetch(`${API_URL}/api/reports/${reportId}`, {
    headers: {
      'x-user-id': userId,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch report: ${response.statusText}`);
  }

  const report = await response.json();
  return report;
}

// Generation progress steps
const GENERATION_STEPS = [
  { id: 'scores', label: 'Calculating market scores', icon: TrendingUp },
  { id: 'news', label: 'Gathering market news & signals', icon: Newspaper },
  { id: 'ai', label: 'Generating AI analysis', icon: FileText },
];

export function ReportViewer({ reportId }: ReportViewerProps) {
  const [report, setReport] = useState<ReportInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  // Poll for report completion
  const pollReport = useCallback(async () => {
    try {
      const data = await fetchReport(reportId);
      if (data) {
        setReport(data);
        // If still generating, continue polling
        if (data.status === 'generating') {
          // Animate through steps
          setGenerationStep((prev) => (prev + 1) % GENERATION_STEPS.length);
          return true; // Continue polling
        }
      }
      return false; // Stop polling
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

        // If generating, start polling
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

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-error mb-4">{error || 'Report not found'}</p>
          <Link
            href="/reports"
            className="text-primary hover:underline inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  // Show generating state with progress
  if (report.status === 'generating') {
    const currentStep = GENERATION_STEPS[generationStep];
    const StepIcon = currentStep.icon;

    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          {/* Animated icon */}
          <div className="relative mb-8">
            <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-surface px-3 py-1 rounded-full border border-outline-variant">
              <StepIcon className="w-5 h-5 text-primary inline-block mr-1.5" />
              <span className="text-sm text-on-surface-variant">{generationStep + 1}/3</span>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-on-surface mb-2">
            Generating Your Report
          </h2>
          <p className="text-on-surface-variant mb-6">
            {report.primary_geography_name}
          </p>

          {/* Progress steps */}
          <div className="space-y-3 text-left bg-surface-container rounded-2xl p-4">
            {GENERATION_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === generationStep;
              const isComplete = index < generationStep;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
                    isActive ? 'bg-primary/10' : ''
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isComplete
                        ? 'bg-primary text-on-primary'
                        : isActive
                        ? 'bg-primary/20 text-primary'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {isComplete ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={`text-sm ${
                      isActive ? 'text-on-surface font-medium' : 'text-on-surface-variant'
                    }`}
                  >
                    {step.label}
                  </span>
                  {isActive && (
                    <Loader2 className="w-4 h-4 text-primary animate-spin ml-auto" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Tip */}
          <p className="text-xs text-on-surface-variant mt-6">
            This usually takes 10-30 seconds
          </p>
        </div>
      </div>
    );
  }

  // Show failed state
  if (report.status === 'failed') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto bg-error/10 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-error" />
          </div>
          <h2 className="text-xl font-semibold text-on-surface mb-2">
            Report Generation Failed
          </h2>
          <p className="text-on-surface-variant mb-2">
            {report.error_message || 'An unexpected error occurred while generating your report.'}
          </p>
          <p className="text-sm text-on-surface-variant mb-6">
            Please try again or contact support if the issue persists.
          </p>
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  const userType = report.user_type as UserType;
  const heroScore =
    userType === 'investor' ? report.investoredge_score : report.homeready_score;
  const heroScoreType = userType === 'investor' ? 'InvestorEdge' : 'HomeReady';

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-outline-variant">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/reports"
              className="text-on-surface-variant hover:text-on-surface inline-flex items-center gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Reports
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConversation(!showConversation)}
                className={`p-2 rounded-full transition-colors ${
                  showConversation
                    ? 'bg-primary text-on-primary'
                    : 'hover:bg-surface-container text-on-surface-variant'
                }`}
                title="Ask AI about this report"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
              <button
                className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant"
                title="Share report"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant"
                title="Download PDF"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Report Content */}
        <main className={`flex-1 ${showConversation ? 'lg:pr-96' : ''}`}>
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-8">
            {/* Cover Section */}
            <ReportCover report={report} />

            {/* Hero Score Section */}
            <HeroScoreSection
              score={heroScore || 0}
              scoreType={heroScoreType}
              userType={userType}
              details={
                userType === 'investor'
                  ? report.scores_snapshot?.investoredge_details
                  : report.scores_snapshot?.homeready_details
              }
              narrative={report.ai_narrative?.market_summary}
            />

            {/* AI Narrative Sections */}
            {report.ai_narrative?.trend_observations && (
              <NarrativeSection
                title="Key Trends"
                content={report.ai_narrative.trend_observations}
              />
            )}

            {report.ai_narrative?.affordability_analysis && (
              <NarrativeSection
                title="Affordability Analysis"
                content={report.ai_narrative.affordability_analysis}
              />
            )}

            {/* Market News Section */}
            {report.populated_data?.realtime?.news && (
              <NewsSection
                news={report.populated_data.realtime.news}
                sentiment={report.populated_data.realtime.sentiment}
                fetchedAt={report.populated_data.realtime.fetched_at}
              />
            )}

            {/* Footer */}
            <footer className="pt-8 border-t border-outline-variant text-center">
              <p className="text-xs text-on-surface-variant">
                Report generated on{' '}
                {new Date(report.created_at).toLocaleDateString()} | Data as of{' '}
                {report.data_as_of_date} | AI Model: {report.ai_model_used}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                PropertyIQ by REI Platform
              </p>
            </footer>
          </div>
        </main>

        {/* Conversation Sidebar */}
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

'use client';

import React, { useState, useEffect } from 'react';
import { ReportCover } from './ReportCover';
import { ConversationPanel } from './ConversationPanel';
import { HeroScoreSection } from './sections/HeroScoreSection';
import { NewsSection } from './sections/NewsSection';
import { NarrativeSection } from './sections/NarrativeSection';
import { ReportInstance, UserType } from '../types';
import { ArrowLeft, Download, Share2, MessageSquare } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

export function ReportViewer({ reportId }: ReportViewerProps) {
  const [report, setReport] = useState<ReportInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);

  useEffect(() => {
    fetchReport(reportId)
      .then(setReport)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [reportId]);

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

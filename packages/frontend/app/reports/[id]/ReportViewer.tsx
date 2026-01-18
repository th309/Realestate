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

interface ReportViewerProps {
  reportId: string;
}

// Mock fetch - replace with actual API call
async function fetchReport(reportId: string): Promise<ReportInstance | null> {
  // Simulate API delay
  await new Promise((r) => setTimeout(r, 800));

  // Mock report data
  return {
    id: reportId,
    user_id: 'user-123',
    template_id: 'tmpl-1',
    template_version: 1,
    report_type: 'market_snapshot',
    title: 'Phoenix-Mesa-Chandler, AZ - Market Snapshot',
    user_type: 'homebuyer',
    primary_geography_id: '38060',
    primary_geography_type: 'metro',
    primary_geography_name: 'Phoenix-Mesa-Chandler, AZ',
    status: 'ready',
    homeready_score: 72,
    investoredge_score: 68,
    scores_snapshot: {
      homeready_score: 72,
      homeready_details: {
        affordability: 65,
        stability: 78,
        value: 70,
        competition: 75,
      },
      investoredge_score: 68,
      investoredge_details: {
        cash_flow: 62,
        appreciation: 74,
        risk: 70,
        liquidity: 66,
      },
    },
    populated_data: {
      realtime: {
        news: [
          {
            headline: 'Phoenix Housing Inventory Rises 15% Year-Over-Year',
            summary: 'The Phoenix metro area sees continued inventory growth...',
            source: 'Arizona Republic',
            category: 'housing',
            relevance_score: 0.92,
          },
          {
            headline: 'Tech Companies Continue Arizona Expansion',
            summary: 'Major tech employers announce new facilities in the Valley...',
            source: 'Phoenix Business Journal',
            category: 'economy',
            relevance_score: 0.85,
          },
        ],
        sentiment: {
          sentiment: 'neutral',
          confidence: 0.75,
          summary: 'Market shows balanced conditions with improving inventory.',
          factors: ['Rising inventory', 'Stable prices', 'Strong job growth'],
        },
        fetched_at: new Date().toISOString(),
      },
    },
    ai_narrative: {
      market_summary:
        'Phoenix remains one of the most dynamic housing markets in the Southwest. After significant price corrections in 2023, the market has stabilized with improving affordability metrics. The HomeReady Score of 72 indicates favorable conditions for homebuyers, particularly due to rising inventory levels and moderating price growth.',
      trend_observations:
        'Key trends include: (1) Inventory up 15% YoY providing more options for buyers, (2) Median days on market increasing to 45 days, (3) Price growth moderating to 3-4% annually, and (4) Strong employment fundamentals supporting demand.',
      affordability_analysis:
        'With a median home price of $445,000 and median household income of $72,000, the price-to-income ratio of 6.2x is slightly elevated but improving. First-time buyers may find opportunities in suburban submarkets.',
    },
    ai_model_used: 'claude-sonnet-4-20250514',
    data_as_of_date: new Date().toISOString().split('T')[0],
    confidence_level: 'high',
    created_at: new Date().toISOString(),
  };
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

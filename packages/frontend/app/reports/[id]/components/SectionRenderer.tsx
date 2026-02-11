'use client';

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { SectionFallback, SectionError } from './SectionFallback';
import { SectionProps, ReportWithTemplate } from './types';
import { ReportSection } from '../../types';
import { BrandingConfig } from './BrandingProvider';

// Import existing sections
import { HeroScoreSection } from '../sections/HeroScoreSection';
import { NarrativeSection } from '../sections/NarrativeSection';
import { NewsSection } from '../sections/NewsSection';

// Wrapper components to adapt existing sections to SectionProps interface
function ScoreGaugeDualWrapper({ section, report }: SectionProps) {
  const userType = report.user_type;
  const heroScore = userType === 'investor'
    ? report.investoredge_score
    : report.homeready_score;
  const heroScoreType = userType === 'investor' ? 'InvestorEdge' : 'HomeReady';
  const details = userType === 'investor'
    ? report.scores_snapshot?.investoredge_details
    : report.scores_snapshot?.homeready_details;

  return (
    <HeroScoreSection
      score={heroScore || 0}
      scoreType={heroScoreType}
      userType={userType}
      details={details}
      narrative={report.ai_narrative?.market_summary}
    />
  );
}

function AiNarrativeWrapper({ section, report }: SectionProps) {
  const narrativeKey = section.config?.narrative_id || 'market_summary';
  const content = report.ai_narrative?.[narrativeKey];
  const title = section.config?.title || 'Analysis';

  if (!content) return null;

  return <NarrativeSection title={title} content={content} />;
}

function MarketNewsWrapper({ section, report }: SectionProps) {
  const news = report.populated_data?.realtime?.news;
  const sentiment = report.populated_data?.realtime?.sentiment;
  const fetchedAt = report.populated_data?.realtime?.fetched_at;

  if (!news) return null;

  return <NewsSection news={news} sentiment={sentiment} fetchedAt={fetchedAt} />;
}

// Report Title Section
function ReportTitleSection({ section, report, branding }: SectionProps) {
  return (
    <div className="text-center py-8">
      {branding?.logoUrl && (
        <img
          src={branding.logoUrl}
          alt={branding.companyName}
          className="h-12 mx-auto mb-4"
        />
      )}
      <h1 className="text-3xl font-bold text-on-surface mb-2">
        {report.title}
      </h1>
      <p className="text-on-surface-variant">
        {report.primary_geography_name}
      </p>
    </div>
  );
}

// Report Metadata Section
function ReportMetadataSection({ section, report }: SectionProps) {
  return (
    <div className="flex flex-wrap gap-4 justify-center text-sm text-on-surface-variant">
      <span>Generated: {new Date(report.created_at).toLocaleDateString()}</span>
      {report.data_as_of_date && (
        <span>Data as of: {report.data_as_of_date}</span>
      )}
      {report.ai_model_used && (
        <span>AI Model: {report.ai_model_used}</span>
      )}
    </div>
  );
}

// Map section types to components
const SECTION_COMPONENTS: Record<string, React.ComponentType<SectionProps>> = {
  // Core sections
  report_title: ReportTitleSection,
  report_metadata: ReportMetadataSection,
  score_gauge_dual: ScoreGaugeDualWrapper,
  score_gauge_single: ScoreGaugeDualWrapper, // Reuse for now
  ai_narrative: AiNarrativeWrapper,

  // Will map to NewsSection when template uses it
  market_news: MarketNewsWrapper,
};

interface SectionRendererProps {
  section: ReportSection;
  report: ReportWithTemplate;
  branding?: BrandingConfig;
}

/**
 * Renders a single report section based on its type
 * Falls back gracefully if component doesn't exist
 */
export function SectionRenderer({ section, report, branding }: SectionRendererProps) {
  const Component = SECTION_COMPONENTS[section.type];

  // Log section errors for debugging
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error(`[Report ${report.id}] Section "${section.type}" failed:`, error);
    console.error('Component stack:', errorInfo.componentStack);
  };

  if (!Component) {
    return <SectionFallback sectionType={section.type} />;
  }

  return (
    <ErrorBoundary
      fallback={<SectionError sectionType={section.type} />}
      onError={handleError}
    >
      <div data-testid={`section-${section.type}`}>
        <Component section={section} report={report} branding={branding} />
      </div>
    </ErrorBoundary>
  );
}

/**
 * Renders all sections for a report page
 */
export function PageRenderer({
  page,
  report,
  branding
}: {
  page: { name: string; sections: ReportSection[] };
  report: ReportWithTemplate;
  branding?: BrandingConfig;
}) {
  return (
    <div className="report-page space-y-6">
      {page.sections.map((section, index) => (
        <SectionRenderer
          key={`${section.id || section.type}-${index}`}
          section={section}
          report={report}
          branding={branding}
        />
      ))}
    </div>
  );
}

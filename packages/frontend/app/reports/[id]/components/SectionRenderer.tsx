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

// Import new section components
import { MetricGrid } from './sections/MetricGrid';
import { MetricDetail } from './sections/MetricDetail';
import { MetricHighlight } from './sections/MetricHighlight';
import { MetricComparison } from './sections/MetricComparison';
import { TextBlock } from './sections/TextBlock';
import { StatusBadge } from './sections/StatusBadge';
import { FactBox } from './sections/FactBox';
import { ChartSingle } from './sections/ChartSingle';
import { ChartGrid } from './sections/ChartGrid';
import { ComparisonChartGrid } from './sections/ComparisonChartGrid';
import { ScoreGaugeSingle } from './sections/ScoreGaugeSingle';
import { ScoreBreakdown } from './sections/ScoreBreakdown';
import { MarketVerdictBar } from './sections/MarketVerdictBar';
import { InvestmentVerdict } from './sections/InvestmentVerdict';
import { ComparisonHeader } from './sections/ComparisonHeader';
import { ComparisonTable } from './sections/ComparisonTable';
import { ComparisonRadar } from './sections/ComparisonRadar';
import { WinnerBadges } from './sections/WinnerBadges';
import { ProsConsTable } from './sections/ProsConsTable';
import { StrengthsRisks } from './sections/StrengthsRisks';
import { AffordabilityGapVisual } from './sections/AffordabilityGapVisual';
import { SavingsCalculator } from './sections/SavingsCalculator';
import { PersonalAffordability } from './sections/PersonalAffordability';
import { BudgetBreakdown } from './sections/BudgetBreakdown';
import { SavingsTimeline } from './sections/SavingsTimeline';
import { AlternativeAreas } from './sections/AlternativeAreas';
import { MigrationSankey } from './sections/MigrationSankey';
import { RankedList } from './sections/RankedList';
import { CycleIndicator } from './sections/CycleIndicator';
import { CycleDiagram } from './sections/CycleDiagram';
import { IndicatorDashboard } from './sections/IndicatorDashboard';
import { PercentileRank } from './sections/PercentileRank';
import { ProFormaAssumptions } from './sections/ProFormaAssumptions';
import { ProFormaCashFlow } from './sections/ProFormaCashFlow';
import { ProFormaReturns } from './sections/ProFormaReturns';
import { ProFormaSensitivity } from './sections/ProFormaSensitivity';
import { ScenarioCard } from './sections/ScenarioCard';
import { ScenarioChart } from './sections/ScenarioChart';
import { ForecastDisplay } from './sections/ForecastDisplay';

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
  ai_narrative: AiNarrativeWrapper,
  market_news: MarketNewsWrapper,

  // Metric sections
  metric_grid: MetricGrid,
  metric_detail: MetricDetail,
  metric_highlight: MetricHighlight,
  metric_comparison: MetricComparison,
  text_block: TextBlock,
  status_badge: StatusBadge,
  fact_box: FactBox,

  // Chart sections
  chart_single: ChartSingle,
  chart_grid: ChartGrid,
  comparison_chart_grid: ComparisonChartGrid,

  // Score sections
  score_gauge_single: ScoreGaugeSingle,
  score_breakdown: ScoreBreakdown,
  market_verdict_bar: MarketVerdictBar,
  investment_verdict: InvestmentVerdict,

  // Comparison sections
  comparison_header: ComparisonHeader,
  comparison_table: ComparisonTable,
  comparison_radar: ComparisonRadar,
  winner_badges: WinnerBadges,
  pros_cons_table: ProsConsTable,
  strengths_risks: StrengthsRisks,

  // Affordability sections
  affordability_gap_visual: AffordabilityGapVisual,
  savings_calculator: SavingsCalculator,
  personal_affordability: PersonalAffordability,
  budget_breakdown: BudgetBreakdown,
  savings_timeline: SavingsTimeline,
  alternative_areas: AlternativeAreas,

  // Migration sections
  migration_sankey: MigrationSankey,
  ranked_list: RankedList,

  // Cycle/Indicator sections
  cycle_indicator: CycleIndicator,
  cycle_diagram: CycleDiagram,
  indicator_dashboard: IndicatorDashboard,
  percentile_rank: PercentileRank,
  percentile_bands: PercentileRank, // Alias

  // Pro Forma sections
  pro_forma_assumptions: ProFormaAssumptions,
  pro_forma_cash_flow: ProFormaCashFlow,
  pro_forma_returns: ProFormaReturns,
  pro_forma_sensitivity: ProFormaSensitivity,

  // Scenario/Forecast sections
  scenario_card: ScenarioCard,
  scenario_chart: ScenarioChart,
  forecast_display: ForecastDisplay,
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

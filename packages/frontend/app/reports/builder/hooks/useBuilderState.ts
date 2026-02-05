'use client';

import { useState, useCallback, useMemo } from 'react';
import type { SectionType, ReportSection, Geography, UserType } from '../../types';

export interface BuilderSection extends ReportSection {
  name?: string;
  description?: string;
}

export interface BuilderState {
  // Report metadata
  title: string;
  userType: UserType;
  geography: Geography | null;

  // Sections
  sections: BuilderSection[];
  selectedSectionId: string | null;

  // UI state
  isDirty: boolean;
  isSaving: boolean;
}

const initialState: BuilderState = {
  title: 'Custom Report',
  userType: 'homebuyer',
  geography: null,
  sections: [],
  selectedSectionId: null,
  isDirty: false,
  isSaving: false,
};

// Section templates for the library
export const SECTION_TEMPLATES: Record<SectionType, { name: string; description: string; defaultConfig: Record<string, unknown> }> = {
  report_title: {
    name: 'Report Title',
    description: 'Large title header for your report',
    defaultConfig: { variant: 'hero' },
  },
  report_metadata: {
    name: 'Report Info',
    description: 'Date, author, and report details',
    defaultConfig: {},
  },
  score_gauge_single: {
    name: 'Score Gauge',
    description: 'Single market score visualization',
    defaultConfig: { scoreType: 'homeready', showComponents: false },
  },
  score_gauge_dual: {
    name: 'Dual Score Gauge',
    description: 'Compare two scores side by side',
    defaultConfig: {},
  },
  metric_grid: {
    name: 'Key Metrics Grid',
    description: 'Grid of important market metrics',
    defaultConfig: { columns: 3, metrics: ['median_price', 'price_change_yoy', 'days_on_market'] },
  },
  metric_detail: {
    name: 'Metric Detail',
    description: 'Deep dive into a single metric',
    defaultConfig: { metric: 'median_price', showChart: true },
  },
  metric_highlight: {
    name: 'Metric Highlight',
    description: 'Highlight a key metric prominently',
    defaultConfig: { metric: 'median_price', variant: 'large' },
  },
  metric_comparison: {
    name: 'Metric Comparison',
    description: 'Compare metrics across geographies',
    defaultConfig: { metrics: ['median_price', 'price_change_yoy'] },
  },
  chart_single: {
    name: 'Single Chart',
    description: 'Time series chart for one metric',
    defaultConfig: { metric: 'median_price', chartType: 'area' },
  },
  chart_grid: {
    name: 'Chart Grid',
    description: 'Multiple charts in a grid layout',
    defaultConfig: { columns: 2 },
  },
  comparison_chart_grid: {
    name: 'Comparison Charts',
    description: 'Compare multiple markets on charts',
    defaultConfig: {},
  },
  comparison_table: {
    name: 'Comparison Table',
    description: 'Side-by-side market comparison',
    defaultConfig: { showRankings: true },
  },
  comparison_radar: {
    name: 'Radar Chart',
    description: 'Multi-dimensional comparison',
    defaultConfig: {},
  },
  comparison_header: {
    name: 'Comparison Header',
    description: 'Header showing compared markets',
    defaultConfig: {},
  },
  ai_narrative: {
    name: 'AI Analysis',
    description: 'AI-generated market insights',
    defaultConfig: { maxTokens: 500 },
  },
  market_verdict_bar: {
    name: 'Market Verdict',
    description: 'Overall market assessment bar',
    defaultConfig: {},
  },
  winner_badges: {
    name: 'Winner Badges',
    description: 'Show winning market categories',
    defaultConfig: {},
  },
  pros_cons_table: {
    name: 'Pros & Cons',
    description: 'Market advantages and disadvantages',
    defaultConfig: {},
  },
  strengths_risks: {
    name: 'Strengths & Risks',
    description: 'Market strength and risk analysis',
    defaultConfig: {},
  },
  score_breakdown: {
    name: 'Score Breakdown',
    description: 'Detailed score component analysis',
    defaultConfig: {},
  },
  investment_verdict: {
    name: 'Investment Verdict',
    description: 'Investment recommendation summary',
    defaultConfig: {},
  },
  fact_box: {
    name: 'Fact Box',
    description: 'Key facts callout box',
    defaultConfig: {},
  },
  ranked_list: {
    name: 'Ranked List',
    description: 'Ranked list of items',
    defaultConfig: { items: 5 },
  },
  indicator_dashboard: {
    name: 'Indicators Dashboard',
    description: 'Overview of market indicators',
    defaultConfig: {},
  },
  indicator_deep_dive: {
    name: 'Indicator Deep Dive',
    description: 'Detailed indicator analysis',
    defaultConfig: {},
  },
  indicator_summary_table: {
    name: 'Indicator Summary',
    description: 'Summary table of indicators',
    defaultConfig: {},
  },
  stress_indicator: {
    name: 'Stress Indicator',
    description: 'Market stress level gauge',
    defaultConfig: {},
  },
  stress_summary: {
    name: 'Stress Summary',
    description: 'Summary of stress factors',
    defaultConfig: {},
  },
  cycle_indicator: {
    name: 'Cycle Indicator',
    description: 'Market cycle position indicator',
    defaultConfig: {},
  },
  cycle_diagram: {
    name: 'Cycle Diagram',
    description: 'Visual cycle position diagram',
    defaultConfig: {},
  },
  percentile_bands: {
    name: 'Percentile Bands',
    description: 'Metric percentile visualization',
    defaultConfig: {},
  },
  percentile_rank: {
    name: 'Percentile Rank',
    description: 'Market ranking by percentile',
    defaultConfig: {},
  },
  scenario_card: {
    name: 'Scenario Card',
    description: 'Scenario analysis card',
    defaultConfig: {},
  },
  scenario_chart: {
    name: 'Scenario Chart',
    description: 'Chart showing scenarios',
    defaultConfig: {},
  },
  forecast_display: {
    name: 'Forecast Display',
    description: 'Market forecast visualization',
    defaultConfig: {},
  },
  affordability_gap_visual: {
    name: 'Affordability Gap',
    description: 'Income vs price gap visual',
    defaultConfig: {},
  },
  savings_calculator: {
    name: 'Savings Calculator',
    description: 'Down payment savings calculator',
    defaultConfig: {},
  },
  personal_affordability: {
    name: 'Personal Affordability',
    description: 'Personalized affordability analysis',
    defaultConfig: {},
  },
  budget_breakdown: {
    name: 'Budget Breakdown',
    description: 'Monthly payment breakdown',
    defaultConfig: {},
  },
  savings_timeline: {
    name: 'Savings Timeline',
    description: 'Timeline to save for purchase',
    defaultConfig: {},
  },
  alternative_areas: {
    name: 'Alternative Areas',
    description: 'Suggested alternative markets',
    defaultConfig: { count: 3 },
  },
  migration_sankey: {
    name: 'Migration Flow',
    description: 'Population migration flow chart',
    defaultConfig: {},
  },
  pro_forma_assumptions: {
    name: 'Pro Forma Assumptions',
    description: 'Investment assumptions table',
    defaultConfig: {},
  },
  pro_forma_cash_flow: {
    name: 'Cash Flow Analysis',
    description: 'Monthly cash flow breakdown',
    defaultConfig: {},
  },
  pro_forma_returns: {
    name: 'Returns Summary',
    description: 'Investment returns overview',
    defaultConfig: {},
  },
  pro_forma_sensitivity: {
    name: 'Sensitivity Analysis',
    description: 'Returns sensitivity to variables',
    defaultConfig: {},
  },
  text_block: {
    name: 'Text Block',
    description: 'Custom text content',
    defaultConfig: { content: '' },
  },
  status_badge: {
    name: 'Status Badge',
    description: 'Status indicator badge',
    defaultConfig: {},
  },
};

// Group sections by category
export const SECTION_CATEGORIES = [
  {
    id: 'header',
    name: 'Header & Title',
    sections: ['report_title', 'report_metadata'] as SectionType[],
  },
  {
    id: 'scores',
    name: 'Scores & Gauges',
    sections: ['score_gauge_single', 'score_gauge_dual', 'score_breakdown'] as SectionType[],
  },
  {
    id: 'metrics',
    name: 'Metrics & Data',
    sections: ['metric_grid', 'metric_detail', 'metric_highlight', 'metric_comparison'] as SectionType[],
  },
  {
    id: 'charts',
    name: 'Charts & Visualizations',
    sections: ['chart_single', 'chart_grid', 'comparison_chart_grid', 'comparison_radar'] as SectionType[],
  },
  {
    id: 'comparison',
    name: 'Comparison',
    sections: ['comparison_header', 'comparison_table', 'winner_badges', 'market_verdict_bar'] as SectionType[],
  },
  {
    id: 'analysis',
    name: 'Analysis & Insights',
    sections: ['ai_narrative', 'pros_cons_table', 'strengths_risks', 'investment_verdict', 'fact_box', 'ranked_list'] as SectionType[],
  },
  {
    id: 'indicators',
    name: 'Market Indicators',
    sections: ['indicator_dashboard', 'indicator_deep_dive', 'indicator_summary_table', 'stress_indicator', 'stress_summary'] as SectionType[],
  },
  {
    id: 'cycle',
    name: 'Market Cycle',
    sections: ['cycle_indicator', 'cycle_diagram', 'percentile_bands', 'percentile_rank'] as SectionType[],
  },
  {
    id: 'scenarios',
    name: 'Scenarios & Forecasts',
    sections: ['scenario_card', 'scenario_chart', 'forecast_display'] as SectionType[],
  },
  {
    id: 'affordability',
    name: 'Affordability',
    sections: ['affordability_gap_visual', 'savings_calculator', 'personal_affordability', 'budget_breakdown', 'savings_timeline', 'alternative_areas'] as SectionType[],
  },
  {
    id: 'migration',
    name: 'Migration & Demographics',
    sections: ['migration_sankey'] as SectionType[],
  },
  {
    id: 'investment',
    name: 'Investment Analysis',
    sections: ['pro_forma_assumptions', 'pro_forma_cash_flow', 'pro_forma_returns', 'pro_forma_sensitivity'] as SectionType[],
  },
  {
    id: 'content',
    name: 'Custom Content',
    sections: ['text_block', 'status_badge'] as SectionType[],
  },
];

export interface UseBuilderStateReturn extends BuilderState {
  // Metadata actions
  setTitle: (title: string) => void;
  setUserType: (type: UserType) => void;
  setGeography: (geo: Geography | null) => void;

  // Section actions
  addSection: (type: SectionType) => void;
  removeSection: (id: string) => void;
  moveSection: (fromIndex: number, toIndex: number) => void;
  duplicateSection: (id: string) => void;
  updateSectionConfig: (id: string, config: Record<string, unknown>) => void;
  selectSection: (id: string | null) => void;
  reorderSections: (newOrder: string[]) => void;

  // Builder actions
  clearCanvas: () => void;
  loadFromTemplate: (sections: BuilderSection[]) => void;

  // Computed
  selectedSection: BuilderSection | null;
}

let sectionIdCounter = 0;
function generateSectionId(): string {
  return `section-${Date.now()}-${++sectionIdCounter}`;
}

export function useBuilderState(): UseBuilderStateReturn {
  const [state, setState] = useState<BuilderState>(initialState);

  // Metadata actions
  const setTitle = useCallback((title: string) => {
    setState((prev) => ({ ...prev, title, isDirty: true }));
  }, []);

  const setUserType = useCallback((userType: UserType) => {
    setState((prev) => ({ ...prev, userType, isDirty: true }));
  }, []);

  const setGeography = useCallback((geography: Geography | null) => {
    setState((prev) => ({ ...prev, geography, isDirty: true }));
  }, []);

  // Section actions
  const addSection = useCallback((type: SectionType) => {
    const template = SECTION_TEMPLATES[type];
    const newSection: BuilderSection = {
      id: generateSectionId(),
      type,
      config: { ...template.defaultConfig },
      name: template.name,
      description: template.description,
    };
    setState((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
      selectedSectionId: newSection.id,
      isDirty: true,
    }));
  }, []);

  const removeSection = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== id),
      selectedSectionId: prev.selectedSectionId === id ? null : prev.selectedSectionId,
      isDirty: true,
    }));
  }, []);

  const moveSection = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      const newSections = [...prev.sections];
      const [removed] = newSections.splice(fromIndex, 1);
      newSections.splice(toIndex, 0, removed);
      return { ...prev, sections: newSections, isDirty: true };
    });
  }, []);

  const duplicateSection = useCallback((id: string) => {
    setState((prev) => {
      const sectionIndex = prev.sections.findIndex((s) => s.id === id);
      if (sectionIndex === -1) return prev;

      const original = prev.sections[sectionIndex];
      const duplicate: BuilderSection = {
        ...original,
        id: generateSectionId(),
        config: { ...original.config },
      };

      const newSections = [...prev.sections];
      newSections.splice(sectionIndex + 1, 0, duplicate);

      return {
        ...prev,
        sections: newSections,
        selectedSectionId: duplicate.id,
        isDirty: true,
      };
    });
  }, []);

  const updateSectionConfig = useCallback((id: string, config: Record<string, unknown>) => {
    setState((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === id ? { ...s, config: { ...s.config, ...config } } : s
      ),
      isDirty: true,
    }));
  }, []);

  const selectSection = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, selectedSectionId: id }));
  }, []);

  const reorderSections = useCallback((newOrder: string[]) => {
    setState((prev) => {
      const sectionMap = new Map(prev.sections.map((s) => [s.id, s]));
      const reordered = newOrder
        .map((id) => sectionMap.get(id))
        .filter((s): s is BuilderSection => s !== undefined);
      return { ...prev, sections: reordered, isDirty: true };
    });
  }, []);

  // Builder actions
  const clearCanvas = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sections: [],
      selectedSectionId: null,
      isDirty: true,
    }));
  }, []);

  const loadFromTemplate = useCallback((sections: BuilderSection[]) => {
    setState((prev) => ({
      ...prev,
      sections: sections.map((s) => ({
        ...s,
        id: generateSectionId(),
      })),
      selectedSectionId: null,
      isDirty: true,
    }));
  }, []);

  // Computed
  const selectedSection = useMemo(
    () => state.sections.find((s) => s.id === state.selectedSectionId) ?? null,
    [state.sections, state.selectedSectionId]
  );

  return {
    ...state,
    setTitle,
    setUserType,
    setGeography,
    addSection,
    removeSection,
    moveSection,
    duplicateSection,
    updateSectionConfig,
    selectSection,
    reorderSections,
    clearCanvas,
    loadFromTemplate,
    selectedSection,
  };
}

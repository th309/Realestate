# Reports Dynamic Section Rendering Design

**Date:** 2026-02-10
**Status:** Approved
**Author:** Claude (Brainstorming Session)

## Overview

This design document outlines the architecture for dynamically rendering report sections based on template configuration. The system will support 30+ section types across 5 report templates, with graceful fallbacks, white-label support, and per-section error handling.

## Problem Statement

The current reports page shows template configuration (Cover, Affordability Dashboard, etc.) but doesn't actually render those sections. We need a dynamic section rendering system that:

1. Reads template config from the report response
2. Renders the appropriate component for each section type
3. Handles missing or failed sections gracefully
4. Supports white-labeling for enterprise accounts

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rendering approach | Full dynamic (30+ section types) | Maximum flexibility, template-driven |
| Missing sections | Graceful fallback with "Coming soon" | Better UX than blank gaps |
| Renderer pattern | Simple switch/map | Maintainable, type-safe, no magic |
| Data passing | Pass entire report to sections | Sections pick what they need, avoids prop drilling |
| Template config source | Already in report response | Backend includes `template.config` |
| Build order | Template order (snapshot → comparison → investment → affordability → cycle) | Most common first |

## Architecture

### Component Hierarchy

```
ReportViewer
├── ReportHeader (branding, title)
├── ReportContent
│   ├── PageRenderer (for each page in config)
│   │   ├── SectionRenderer (for each section)
│   │   │   ├── ErrorBoundary
│   │   │   └── [Specific Section Component]
│   │   └── PageBreak (for PDF)
│   └── ReportFooter (branding, page numbers)
└── ReportActions (download, share)
```

### SectionRenderer

The core component that maps section types to components:

```typescript
// app/reports/[id]/components/SectionRenderer.tsx

import { ErrorBoundary } from './ErrorBoundary';
import { SectionFallback } from './SectionFallback';

// Section component imports
import { ReportTitle } from './sections/ReportTitle';
import { ScoreGaugeDual } from './sections/ScoreGaugeDual';
import { MetricGrid } from './sections/MetricGrid';
import { AiNarrative } from './sections/AiNarrative';
import { ChartGrid } from './sections/ChartGrid';
// ... more imports

const SECTION_COMPONENTS: Record<string, React.ComponentType<SectionProps>> = {
  // Snapshot template sections
  report_title: ReportTitle,
  score_gauge_dual: ScoreGaugeDual,
  report_metadata: ReportMetadata,
  market_verdict_bar: MarketVerdictBar,
  metric_grid: MetricGrid,
  ai_narrative: AiNarrative,
  fact_box: FactBox,
  chart_grid: ChartGrid,

  // Comparison template sections
  comparison_header: ComparisonHeader,
  comparison_table: ComparisonTable,
  radar_comparison: RadarComparison,
  winner_summary: WinnerSummary,

  // Investment template sections
  investment_scorecard: InvestmentScorecard,
  cashflow_projection: CashflowProjection,
  roi_breakdown: RoiBreakdown,
  risk_assessment: RiskAssessment,

  // Affordability template sections
  affordability_dashboard: AffordabilityDashboard,
  income_requirements: IncomeRequirements,
  migration_patterns: MigrationPatterns,
  cost_of_living: CostOfLiving,

  // Cycle template sections
  cycle_indicator: CycleIndicator,
  historical_cycles: HistoricalCycles,
  timing_recommendation: TimingRecommendation,
};

interface SectionRendererProps {
  section: TemplateSection;
  report: Report;
  branding?: BrandingConfig;
}

export function SectionRenderer({ section, report, branding }: SectionRendererProps) {
  const Component = SECTION_COMPONENTS[section.type];

  if (!Component) {
    return <SectionFallback sectionType={section.type} />;
  }

  return (
    <ErrorBoundary
      fallback={<SectionError sectionType={section.type} />}
      onError={(error) => logSectionError(section.type, error, report.id)}
    >
      <Component
        section={section}
        report={report}
        branding={branding}
      />
    </ErrorBoundary>
  );
}
```

### Type Definitions

```typescript
// app/reports/types.ts

export interface TemplateSection {
  type: string;
  title?: string;
  config?: Record<string, unknown>;
}

export interface TemplatePage {
  name: string;
  sections: TemplateSection[];
}

export interface TemplateConfig {
  pages: TemplatePage[];
}

export interface Report {
  id: string;
  title: string;
  geography: Geography;
  template: {
    slug: string;
    name: string;
    icon: string;
    config: TemplateConfig;
  };
  data: ReportData;
  generated_at: string;
}

export interface SectionProps {
  section: TemplateSection;
  report: Report;
  branding?: BrandingConfig;
}

export interface BrandingConfig {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  fontFamily?: string;
  headerStyle?: 'minimal' | 'full';
  footerText?: string;
  watermark?: boolean;
}
```

### White-Label Support

Enterprise accounts can customize report appearance:

```typescript
// app/reports/[id]/components/BrandingProvider.tsx

import { createContext, useContext } from 'react';

const BrandingContext = createContext<BrandingConfig | null>(null);

export function BrandingProvider({ children, branding }: {
  children: React.ReactNode;
  branding?: BrandingConfig;
}) {
  const defaultBranding: BrandingConfig = {
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    companyName: 'PropertyIQ',
  };

  return (
    <BrandingContext.Provider value={branding || defaultBranding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
```

Section components use branding via the hook:

```typescript
export function ReportTitle({ section, report }: SectionProps) {
  const branding = useBranding();

  return (
    <div style={{ color: branding?.primaryColor }}>
      {branding?.logoUrl && <img src={branding.logoUrl} alt={branding.companyName} />}
      <h1>{report.title}</h1>
    </div>
  );
}
```

### Error Handling

Per-section error boundaries prevent cascade failures:

```typescript
// app/reports/[id]/components/ErrorBoundary.tsx

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError?: (error: Error) => void;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

Fallback UI for missing sections:

```typescript
// app/reports/[id]/components/SectionFallback.tsx

export function SectionFallback({ sectionType }: { sectionType: string }) {
  return (
    <div className="p-6 border border-dashed border-gray-300 rounded-lg bg-gray-50">
      <p className="text-gray-500 text-center">
        <span className="font-medium">{formatSectionName(sectionType)}</span>
        <br />
        Coming soon
      </p>
    </div>
  );
}

export function SectionError({ sectionType }: { sectionType: string }) {
  return (
    <div className="p-6 border border-red-200 rounded-lg bg-red-50">
      <p className="text-red-600 text-center">
        Unable to load {formatSectionName(sectionType)}
        <button onClick={() => window.location.reload()} className="underline ml-2">
          Retry
        </button>
      </p>
    </div>
  );
}
```

## Page Rendering

```typescript
// app/reports/[id]/components/PageRenderer.tsx

export function PageRenderer({ page, report, branding }: {
  page: TemplatePage;
  report: Report;
  branding?: BrandingConfig;
}) {
  return (
    <div className="report-page">
      <h2 className="text-xl font-semibold mb-4">{page.name}</h2>
      <div className="space-y-6">
        {page.sections.map((section, index) => (
          <SectionRenderer
            key={`${section.type}-${index}`}
            section={section}
            report={report}
            branding={branding}
          />
        ))}
      </div>
    </div>
  );
}
```

## Testing & Error Handling

### Testing Strategy (Real Data)

1. **Integration Tests** - Hit actual API endpoints with test user credentials
2. **E2E Tests with Playwright** - Generate real reports, verify section rendering
3. **Staging Environment** - Pre-seeded database with real production-like data
4. **Manual QA** - Visual verification of all section types

### Test Approach

```typescript
// e2e/reports.spec.ts

test('renders all sections for snapshot report', async ({ page }) => {
  // Navigate to a real report
  await page.goto('/reports/[real-report-id]');

  // Verify key sections render
  await expect(page.getByTestId('section-report_title')).toBeVisible();
  await expect(page.getByTestId('section-score_gauge_dual')).toBeVisible();
  await expect(page.getByTestId('section-metric_grid')).toBeVisible();
});

test('handles section errors gracefully', async ({ page }) => {
  // Trigger error by manipulating network
  await page.route('**/api/reports/*', route => {
    const response = route.request().postDataJSON();
    // Corrupt one section's data
    response.data.metrics = null;
    route.fulfill({ json: response });
  });

  await page.goto('/reports/[real-report-id]');

  // Error section shows fallback, others still render
  await expect(page.getByText('Unable to load')).toBeVisible();
  await expect(page.getByTestId('section-report_title')).toBeVisible();
});
```

### Error Logging

```typescript
function logSectionError(sectionType: string, error: Error, reportId: string) {
  console.error(`[Report ${reportId}] Section "${sectionType}" failed:`, error);

  // Send to monitoring (if configured)
  if (typeof window !== 'undefined' && window.analytics) {
    window.analytics.track('report_section_error', {
      sectionType,
      reportId,
      errorMessage: error.message,
    });
  }
}
```

## Implementation Phases

### Phase 1: Snapshot Template (Core)
- `report_title`
- `score_gauge_dual`
- `report_metadata`
- `market_verdict_bar`
- `metric_grid`
- `ai_narrative`
- `fact_box`
- `chart_grid`

### Phase 2: Comparison Template
- `comparison_header`
- `comparison_table`
- `radar_comparison`
- `winner_summary`

### Phase 3: Investment Template
- `investment_scorecard`
- `cashflow_projection`
- `roi_breakdown`
- `risk_assessment`

### Phase 4: Affordability Template
- `affordability_dashboard`
- `income_requirements`
- `migration_patterns`
- `cost_of_living`

### Phase 5: Cycle Template
- `cycle_indicator`
- `historical_cycles`
- `timing_recommendation`

## File Structure

```
app/reports/[id]/
├── page.tsx                    # Report viewer page
├── components/
│   ├── ReportViewer.tsx        # Main container
│   ├── PageRenderer.tsx        # Renders a page with sections
│   ├── SectionRenderer.tsx     # Maps type → component
│   ├── ErrorBoundary.tsx       # Per-section error handling
│   ├── SectionFallback.tsx     # "Coming soon" placeholder
│   ├── BrandingProvider.tsx    # White-label context
│   └── sections/
│       ├── ReportTitle.tsx
│       ├── ScoreGaugeDual.tsx
│       ├── MetricGrid.tsx
│       ├── AiNarrative.tsx
│       ├── ChartGrid.tsx
│       ├── ComparisonTable.tsx
│       ├── MigrationPatterns.tsx
│       └── ... (30+ section components)
├── types.ts                    # TypeScript interfaces
└── utils.ts                    # Helper functions
```

## Success Criteria

1. All template sections render based on config
2. Missing section types show "Coming soon" fallback
3. Failed sections don't crash the page
4. White-label branding applies consistently
5. E2E tests pass with real data
6. Page load time under 2 seconds for average report

## Next Steps

1. Create `SectionRenderer` and `ErrorBoundary` infrastructure
2. Implement Phase 1 sections (snapshot template)
3. Add Playwright E2E tests for section rendering
4. Implement remaining phases
5. Add white-label support for enterprise accounts

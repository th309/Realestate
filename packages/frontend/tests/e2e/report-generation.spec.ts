/**
 * Report Generation E2E Tests
 *
 * Tests the full report viewer flow for all template types:
 * - HomeReady Report (homebuyer)
 * - InvestorEdge Report (investor)
 * - Comparison Report
 * - Market Snapshot (client + prep modes)
 *
 * Also tests:
 * - Personalization panel interaction
 * - PDF export trigger
 * - Section error boundaries
 */

import { test, expect, Page } from '@playwright/test';

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_HOMEREADY_REPORT = {
  id: 'test-homeready-001',
  title: 'HomeReady Report: Austin, TX',
  status: 'completed',
  user_type: 'homebuyer',
  primary_geography_id: 'cbsa-12420',
  primary_geography_name: 'Austin, TX',
  created_at: '2026-02-15T12:00:00Z',
  data_as_of_date: '2026-02-01',
  ai_model_used: 'claude-sonnet-4-5-20250929',
  homeready_score: 72,
  scores_snapshot: {
    homeready_score: 72,
    homeready_grade: 'B+',
    homeready_components: [
      { component: 'affordability', score: 65, status: 'moderate', weight: 0.3, z_score: 0.4 },
      { component: 'market_timing', score: 78, status: 'strong', weight: 0.25, z_score: 0.8 },
      { component: 'stability', score: 70, status: 'moderate', weight: 0.25, z_score: 0.6 },
      { component: 'growth_potential', score: 80, status: 'strong', weight: 0.2, z_score: 0.9 },
    ],
  },
  populated_data: {
    current: {
      zhvi: 450000,
      median_income: 75000,
      days_on_market: 28,
      for_sale_inventory: 1250,
      hotness_score: 72,
      home_value_yoy: 0.052,
      price_per_sqft: 285,
      price_reduced_share: 0.18,
      population_growth: 0.025,
    },
    historical: {},
  },
  ai_narrative: {
    score_story: 'Austin shows strong overall market health with particular strength in growth potential.',
    affordability_narrative: 'The Austin market presents moderate affordability challenges.',
    market_timing_narrative: 'Current market timing conditions favor buyers.',
    stability_narrative: 'Market stability is moderate with consistent fundamentals.',
    growth_potential_narrative: 'Strong growth potential driven by population and job growth.',
    bottom_line_narrative: 'Austin represents a solid opportunity for homebuyers.',
    bottom_line_actions: ['Monitor interest rate trends', 'Focus on emerging neighborhoods', 'Consider pre-approval'],
  },
  user_inputs: {
    priorities: ['affordability', 'growth'],
  },
  template: {
    name: 'HomeReady Report',
    config: { report_type: 'snapshot' },
  },
  comparison_geographies: [],
};

const MOCK_INVESTOR_REPORT = {
  ...MOCK_HOMEREADY_REPORT,
  id: 'test-investor-001',
  title: 'InvestorEdge Report: Austin, TX',
  user_type: 'investor',
  investoredge_score: 68,
  homeready_score: null,
  scores_snapshot: {
    investoredge_score: 68,
    investoredge_grade: 'B',
    investoredge_components: [
      { component: 'cash_flow', score: 55, status: 'moderate', weight: 0.25, z_score: 0.2 },
      { component: 'rent_demand', score: 72, status: 'strong', weight: 0.2, z_score: 0.7 },
      { component: 'appreciation', score: 78, status: 'strong', weight: 0.2, z_score: 0.8 },
      { component: 'entry_point', score: 60, status: 'moderate', weight: 0.2, z_score: 0.3 },
      { component: 'risk', score: 70, status: 'moderate', weight: 0.15, z_score: 0.6 },
    ],
  },
  user_inputs: {
    investment_strategy: 'buy_and_hold',
    investment_budget: 500000,
  },
};

const MOCK_COMPARISON_REPORT = {
  ...MOCK_HOMEREADY_REPORT,
  id: 'test-comparison-001',
  title: 'Market Comparison: Austin vs Dallas',
  template: { name: 'Market Comparison', config: { report_type: 'comparison' } },
  comparison_geographies: [
    { id: 'cbsa-19100', name: 'Dallas, TX', geo_level: 'cbsa' },
  ],
  populated_data: {
    ...MOCK_HOMEREADY_REPORT.populated_data,
    comparisons: {
      'cbsa-19100': {
        geography: { id: 'cbsa-19100', name: 'Dallas, TX' },
        current: {
          zhvi: 380000,
          median_income: 70000,
          days_on_market: 35,
          hotness_score: 65,
        },
        scores: {
          homeready: 67,
          homeready_components: [
            { component: 'affordability', score: 70, status: 'moderate', weight: 0.3, z_score: 0.6 },
            { component: 'market_timing', score: 65, status: 'moderate', weight: 0.25, z_score: 0.5 },
            { component: 'stability', score: 68, status: 'moderate', weight: 0.25, z_score: 0.55 },
            { component: 'growth_potential', score: 62, status: 'moderate', weight: 0.2, z_score: 0.35 },
          ],
        },
      },
    },
  },
};

const MOCK_AGENT_REPORT = {
  ...MOCK_HOMEREADY_REPORT,
  id: 'test-agent-001',
  title: 'Market Snapshot: Austin, TX',
  user_type: 'agent',
  template: { name: 'Market Snapshot', config: { report_type: 'snapshot' } },
  markethealth_score: 74,
  scores_snapshot: {
    markethealth_score: 74,
    markethealth_grade: 'B+',
    markethealth_components: [],
  },
};

// ============================================================================
// Helpers
// ============================================================================

async function mockReportAPI(page: Page, report: object) {
  await page.route('**/api/reports/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(report),
    });
  });
}

async function navigateToReport(page: Page, reportId: string) {
  await page.goto(`/reports/${reportId}`);
  await page.waitForLoadState('networkidle');
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Report Viewer', () => {

  test.describe('HomeReady Report', () => {
    test('renders all sections', async ({ page }) => {
      await mockReportAPI(page, MOCK_HOMEREADY_REPORT);
      await navigateToReport(page, MOCK_HOMEREADY_REPORT.id);

      // Hero section should render with score
      await expect(page.locator('#hero')).toBeVisible();
      await expect(page.getByText('72')).toBeVisible();
      await expect(page.getByText('Austin, TX')).toBeVisible();

      // Score story section
      await expect(page.locator('#score-story')).toBeVisible();

      // Deep dive sections
      await expect(page.locator('#affordability-deep-dive')).toBeVisible();
      await expect(page.locator('#market-timing-deep-dive')).toBeVisible();
      await expect(page.locator('#stability-deep-dive')).toBeVisible();
      await expect(page.locator('#growth-potential-deep-dive')).toBeVisible();

      // Bottom line
      await expect(page.locator('#bottom-line')).toBeVisible();

      // Market pulse (shared)
      await expect(page.locator('#market-pulse')).toBeVisible();
    });

    test('displays score components in score story', async ({ page }) => {
      await mockReportAPI(page, MOCK_HOMEREADY_REPORT);
      await navigateToReport(page, MOCK_HOMEREADY_REPORT.id);

      await expect(page.locator('#score-story')).toBeVisible();
      // Should show all 4 components
      await expect(page.getByText('Affordability')).toBeVisible();
      await expect(page.getByText('Market Timing')).toBeVisible();
      await expect(page.getByText('Stability')).toBeVisible();
      await expect(page.getByText('Growth Potential')).toBeVisible();
    });

    test('shows AI narratives', async ({ page }) => {
      await mockReportAPI(page, MOCK_HOMEREADY_REPORT);
      await navigateToReport(page, MOCK_HOMEREADY_REPORT.id);

      // AI narrative content should appear
      await expect(page.getByText(/Austin shows strong overall/)).toBeVisible();
    });

    test('renders personalization panel', async ({ page }) => {
      await mockReportAPI(page, MOCK_HOMEREADY_REPORT);
      await navigateToReport(page, MOCK_HOMEREADY_REPORT.id);

      // Personalization toggle should be visible
      await expect(page.getByText('Personalize This Report')).toBeVisible();

      // Click to expand
      await page.getByText('Personalize This Report').click();

      // Should show priority selector
      await expect(page.getByText('Your Priorities')).toBeVisible();
      await expect(page.getByText('Annual Income')).toBeVisible();
    });

    test('shows user priorities section when priorities exist', async ({ page }) => {
      await mockReportAPI(page, MOCK_HOMEREADY_REPORT);
      await navigateToReport(page, MOCK_HOMEREADY_REPORT.id);

      await expect(page.locator('#your-priorities')).toBeVisible();
    });

    test('personalization panel updates on input change', async ({ page }) => {
      await mockReportAPI(page, MOCK_HOMEREADY_REPORT);
      await navigateToReport(page, MOCK_HOMEREADY_REPORT.id);

      // Open the personalization panel
      await page.getByText('Personalize This Report').click();
      await expect(page.getByText('Annual Income')).toBeVisible();

      // Find the income input and change its value
      const incomeInput = page.getByLabel('Annual Income');
      await incomeInput.fill('120000');

      // A "Modified" badge should appear indicating personalization is active
      await expect(page.getByText('Modified')).toBeVisible();
    });
  });

  test.describe('InvestorEdge Report', () => {
    test('renders all investor sections', async ({ page }) => {
      await mockReportAPI(page, MOCK_INVESTOR_REPORT);
      await navigateToReport(page, MOCK_INVESTOR_REPORT.id);

      await expect(page.locator('#investor-hero')).toBeVisible();
      await expect(page.locator('#investor-score-story')).toBeVisible();
      await expect(page.locator('#cash-flow')).toBeVisible();
      await expect(page.locator('#rent-demand')).toBeVisible();
      await expect(page.locator('#appreciation')).toBeVisible();
      await expect(page.locator('#entry-point')).toBeVisible();
      await expect(page.locator('#risk')).toBeVisible();
      await expect(page.locator('#investor-bottom-line')).toBeVisible();
    });

    test('displays investor score', async ({ page }) => {
      await mockReportAPI(page, MOCK_INVESTOR_REPORT);
      await navigateToReport(page, MOCK_INVESTOR_REPORT.id);

      await expect(page.getByText('68')).toBeVisible();
    });
  });

  test.describe('Comparison Report', () => {
    test('renders comparison sections with both markets', async ({ page }) => {
      await mockReportAPI(page, MOCK_COMPARISON_REPORT);
      await navigateToReport(page, MOCK_COMPARISON_REPORT.id);

      await expect(page.locator('#comparison-hero')).toBeVisible();
      await expect(page.locator('#head-to-head')).toBeVisible();
      await expect(page.locator('#component-showdown')).toBeVisible();
      await expect(page.locator('#market-strengths')).toBeVisible();
      await expect(page.locator('#comparison-verdict')).toBeVisible();

      // Both market names should appear
      await expect(page.getByText('Austin, TX')).toBeVisible();
      await expect(page.getByText('Dallas, TX')).toBeVisible();
    });

    test('displays priority-analysis section', async ({ page }) => {
      await mockReportAPI(page, MOCK_COMPARISON_REPORT);
      await navigateToReport(page, MOCK_COMPARISON_REPORT.id);

      // Priority analysis section should be visible in comparison reports
      await expect(page.locator('#priority-analysis')).toBeVisible();
    });
  });

  test.describe('Market Snapshot (Agent)', () => {
    test('renders client view by default', async ({ page }) => {
      await mockReportAPI(page, MOCK_AGENT_REPORT);
      await navigateToReport(page, MOCK_AGENT_REPORT.id);

      // Mode toggle should be visible
      await expect(page.getByText('Client View')).toBeVisible();
      await expect(page.getByText('Agent Prep')).toBeVisible();

      // Client sections should render
      await expect(page.locator('#client-overview')).toBeVisible();
      await expect(page.locator('#client-price')).toBeVisible();
      await expect(page.locator('#client-conditions')).toBeVisible();
      await expect(page.locator('#client-meaning')).toBeVisible();
    });

    test('switches to prep view on toggle', async ({ page }) => {
      await mockReportAPI(page, MOCK_AGENT_REPORT);
      await navigateToReport(page, MOCK_AGENT_REPORT.id);

      // Switch to prep mode
      await page.getByText('Agent Prep').click();

      // Prep sections should render
      await expect(page.locator('#prep-stats')).toBeVisible();
      await expect(page.locator('#prep-talking-points')).toBeVisible();
      await expect(page.locator('#prep-objections')).toBeVisible();
      await expect(page.locator('#prep-competitive')).toBeVisible();
      await expect(page.locator('#prep-signals')).toBeVisible();
    });

    test('does not show personalization panel for agent reports', async ({ page }) => {
      await mockReportAPI(page, MOCK_AGENT_REPORT);
      await navigateToReport(page, MOCK_AGENT_REPORT.id);

      await expect(page.getByText('Personalize This Report')).not.toBeVisible();
    });
  });

  test.describe('PDF Export', () => {
    test('download button is present', async ({ page }) => {
      await mockReportAPI(page, MOCK_HOMEREADY_REPORT);
      await navigateToReport(page, MOCK_HOMEREADY_REPORT.id);

      await expect(page.getByTitle('Download PDF')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('shows error state for missing report', async ({ page }) => {
      await page.route('**/api/reports/**', (route) => {
        route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      });
      await navigateToReport(page, 'nonexistent-id');

      await expect(page.getByText('Report not found')).toBeVisible();
    });

    test('shows generating state', async ({ page }) => {
      await mockReportAPI(page, { ...MOCK_HOMEREADY_REPORT, status: 'generating' });
      await navigateToReport(page, MOCK_HOMEREADY_REPORT.id);

      await expect(page.getByText('Generating Your Report')).toBeVisible();
    });
  });
});

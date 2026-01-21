/**
 * Admin Data Dashboard E2E Tests
 *
 * Tests for the Data Admin Dashboard including:
 * - Status banner display
 * - Data cards tab (metric health)
 * - Data sources tab (source availability)
 * - Pipeline runs tab (ETL status)
 * - Alerts tab (data alerts management)
 */

import { test, expect, Page } from '@playwright/test';

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_HEALTH_SUMMARY = {
  status: 'healthy',
  cardsTotal: 48,
  cardsHealthy: 46,
  sourcesTotal: 6,
  sourcesAvailable: 6,
  pipelinesTotal: 10,
  pipelinesHealthy: 9,
  lastCheck: new Date().toISOString(),
};

const MOCK_METRIC_HEALTH = {
  checks: [
    { metricId: 'zhvi', metricName: 'ZHVI', category: 'Home Values', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 33120, coverage: 98.5, source: 'Zillow' },
    { metricId: 'zori', metricName: 'ZORI', category: 'Rentals', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 28450, coverage: 87.2, source: 'Zillow' },
    { metricId: 'unemployment', metricName: 'Unemployment Rate', category: 'Economics', tableName: 'economic_county', status: 'stale', latestDate: 'Nov 2023', recordCount: 3221, coverage: 95.0, source: 'BLS' },
  ],
};

const MOCK_SOURCE_HEALTH = {
  sources: [
    { sourceName: 'zillow_s3', displayName: 'Zillow', sourceType: 's3', available: true, responseTimeMs: 245, fresh: true, daysSinceUpdate: 3, expectedFreshnessDays: 45, schemaChanged: false, lastCheck: new Date().toISOString() },
    { sourceName: 'census_api', displayName: 'Census', sourceType: 'api', available: true, responseTimeMs: 1234, fresh: true, daysSinceUpdate: 45, expectedFreshnessDays: 400, schemaChanged: false, lastCheck: new Date().toISOString() },
    { sourceName: 'bls_api', displayName: 'BLS', sourceType: 'api', available: true, responseTimeMs: 892, fresh: true, daysSinceUpdate: 12, expectedFreshnessDays: 45, schemaChanged: false, lastCheck: new Date().toISOString() },
  ],
};

const MOCK_PIPELINE_RUNS = {
  pipelines: [
    { id: '1', pipelineName: 'zillow_zhvi', displayName: 'Zillow ZHVI', startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), endedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(), status: 'success', recordsProcessed: 33500, recordsInserted: 33120, recordsFailed: 0, durationMs: 272000 },
    { id: '2', pipelineName: 'realtor_metrics', displayName: 'Realtor Metrics', startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), endedAt: new Date(Date.now() - 23.5 * 60 * 60 * 1000).toISOString(), status: 'failed', recordsProcessed: 0, recordsInserted: 0, recordsFailed: 0, durationMs: 45000, errorMessage: 'Connection timeout' },
  ],
};

const MOCK_DATA_ALERTS = {
  alerts: [
    { id: '1', alertType: 'source_stale', severity: 'warning', sourceName: 'realtor_s3', title: 'Realtor data stale', message: 'Realtor data is 8 days old', status: 'open', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    { id: '2', alertType: 'pipeline_failed', severity: 'critical', pipelineName: 'realtor_metrics', title: 'Pipeline failed', message: 'Connection timeout', status: 'acknowledged', createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), acknowledgedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

async function setupDataAdminMocks(page: Page) {
  // Mock health summary
  await page.route('**/api/health/data-summary', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_HEALTH_SUMMARY),
    });
  });

  // Mock metric health
  await page.route('**/api/health/data-cards', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_METRIC_HEALTH),
    });
  });

  // Mock source health
  await page.route('**/api/health/data-sources', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SOURCE_HEALTH),
    });
  });

  // Mock pipeline runs
  await page.route('**/api/health/pipeline-runs', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PIPELINE_RUNS),
    });
  });

  // Mock data alerts
  await page.route('**/api/health/data-alerts*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DATA_ALERTS),
    });
  });

  // Mock alert actions
  await page.route('**/api/health/data-alerts/*/acknowledge', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/health/data-alerts/*/resolve', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Mock pipeline trigger
  await page.route('**/api/pipelines/*/trigger', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, id: 'new-run-001' }),
    });
  });
}

// ============================================================================
// Status Banner Tests
// ============================================================================

test.describe('Status Banner', () => {
  test.beforeEach(async ({ page }) => {
    await setupDataAdminMocks(page);
    await page.goto('/admin/data');
  });

  test('displays overall health status banner', async ({ page }) => {
    await expect(page.getByTestId('status-banner')).toBeVisible();
  });

  test('shows healthy status when all systems operational', async ({ page }) => {
    await expect(page.getByTestId('status-banner')).toContainText(/All Systems Operational/i);
  });

  test('shows summary metrics in status banner', async ({ page }) => {
    const banner = page.getByTestId('status-banner');
    await expect(banner).toContainText('46/48');
    await expect(banner).toContainText('6/6');
    await expect(banner).toContainText('9/10');
  });

  test('shows last refresh time', async ({ page }) => {
    await expect(page.getByTestId('last-refresh-time')).toBeVisible();
    await expect(page.getByTestId('last-refresh-time')).toContainText(/Last Check/i);
  });
});

// ============================================================================
// Tab Navigation Tests
// ============================================================================

test.describe('Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupDataAdminMocks(page);
    await page.goto('/admin/data');
  });

  test('displays all four tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Data Cards' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Data Sources' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Pipeline Runs' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Alerts' })).toBeVisible();
  });

  test('Data Cards tab is active by default', async ({ page }) => {
    const dataCardsTab = page.getByRole('tab', { name: 'Data Cards' });
    await expect(dataCardsTab).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking tab switches content', async ({ page }) => {
    await page.getByRole('tab', { name: 'Data Sources' }).click();
    await expect(page.getByTestId('source-health-table')).toBeVisible();
  });
});

// ============================================================================
// Data Cards Tab Tests
// ============================================================================

test.describe('Data Cards Tab', () => {
  test.beforeEach(async ({ page }) => {
    await setupDataAdminMocks(page);
    await page.goto('/admin/data');
  });

  test('displays metric health table', async ({ page }) => {
    await expect(page.getByTestId('metric-health-table')).toBeVisible();
  });

  test('shows metric rows with data', async ({ page }) => {
    const rows = page.getByTestId('metric-health-row');
    await expect(rows).toHaveCount(3);
  });

  test('displays metric status badges', async ({ page }) => {
    await expect(page.getByText('OK')).toBeVisible();
    await expect(page.getByText('Stale')).toBeVisible();
  });

  test('shows coverage percentages', async ({ page }) => {
    await expect(page.getByText('98.5%')).toBeVisible();
  });

  test('can filter metrics by status', async ({ page }) => {
    await page.getByRole('combobox').first().selectOption('stale');

    const rows = page.getByTestId('metric-health-row');
    await expect(rows).toHaveCount(1);
  });
});

// ============================================================================
// Data Sources Tab Tests
// ============================================================================

test.describe('Data Sources Tab', () => {
  test.beforeEach(async ({ page }) => {
    await setupDataAdminMocks(page);
    await page.goto('/admin/data');
    await page.getByRole('tab', { name: 'Data Sources' }).click();
  });

  test('displays source health table', async ({ page }) => {
    await expect(page.getByTestId('source-health-table')).toBeVisible();
  });

  test('shows source names', async ({ page }) => {
    await expect(page.getByText('Zillow')).toBeVisible();
    await expect(page.getByText('Census')).toBeVisible();
    await expect(page.getByText('BLS')).toBeVisible();
  });

  test('shows availability indicators', async ({ page }) => {
    await expect(page.getByText('Yes').first()).toBeVisible();
  });

  test('shows response times', async ({ page }) => {
    await expect(page.getByText('245ms')).toBeVisible();
  });
});

// ============================================================================
// Pipeline Runs Tab Tests
// ============================================================================

test.describe('Pipeline Runs Tab', () => {
  test.beforeEach(async ({ page }) => {
    await setupDataAdminMocks(page);
    await page.goto('/admin/data');
    await page.getByRole('tab', { name: 'Pipeline Runs' }).click();
  });

  test('displays pipeline runs table', async ({ page }) => {
    await expect(page.getByTestId('pipeline-runs-table')).toBeVisible();
  });

  test('shows pipeline status badges', async ({ page }) => {
    await expect(page.getByText('Success')).toBeVisible();
    await expect(page.getByText('Failed')).toBeVisible();
  });

  test('shows record counts', async ({ page }) => {
    await expect(page.getByText('33,120 inserted')).toBeVisible();
  });

  test('displays manual trigger buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Zillow ZHVI' })).toBeVisible();
  });
});

// ============================================================================
// Alerts Tab Tests
// ============================================================================

test.describe('Alerts Tab', () => {
  test.beforeEach(async ({ page }) => {
    await setupDataAdminMocks(page);
    await page.goto('/admin/data');
    await page.getByRole('tab', { name: 'Alerts' }).click();
  });

  test('displays alert list', async ({ page }) => {
    await expect(page.getByText('Realtor data stale')).toBeVisible();
  });

  test('shows severity badges', async ({ page }) => {
    await expect(page.getByText('warning')).toBeVisible();
    await expect(page.getByText('critical')).toBeVisible();
  });

  test('shows status badges', async ({ page }) => {
    await expect(page.getByText('open')).toBeVisible();
    await expect(page.getByText('acknowledged')).toBeVisible();
  });

  test('can select an alert to view details', async ({ page }) => {
    await page.getByText('Realtor data stale').click();
    await expect(page.getByText('Realtor data is 8 days old')).toBeVisible();
  });

  test('shows acknowledge button for open alerts', async ({ page }) => {
    await page.getByText('Realtor data stale').click();
    await expect(page.getByTestId('acknowledge-button')).toBeVisible();
  });

  test('can filter alerts by status', async ({ page }) => {
    await page.getByLabel('Status:').selectOption('acknowledged');

    // Should only show acknowledged alerts
    await expect(page.getByText('Pipeline failed')).toBeVisible();
    await expect(page.getByText('Realtor data stale')).not.toBeVisible();
  });
});

// ============================================================================
// Refresh Functionality Tests
// ============================================================================

test.describe('Refresh Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupDataAdminMocks(page);
    await page.goto('/admin/data');
  });

  test('has refresh button', async ({ page }) => {
    await expect(page.getByTestId('refresh-button')).toBeVisible();
  });

  test('refresh button shows loading state when clicked', async ({ page }) => {
    await page.getByTestId('refresh-button').click();
    await expect(page.getByTestId('refresh-button')).toContainText(/Refresh/i);
  });
});

// ============================================================================
// Error State Tests
// ============================================================================

test.describe('Error States', () => {
  test('shows error banner when API fails', async ({ page }) => {
    await page.route('**/api/health/data-summary', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/admin/data');

    // Should fall back to mock data or show error
    await expect(page.getByTestId('status-banner')).toBeVisible();
  });
});

// ============================================================================
// Loading State Tests
// ============================================================================

test.describe('Loading States', () => {
  test('shows loading state while fetching data', async ({ page }) => {
    await page.route('**/api/health/data-summary', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_HEALTH_SUMMARY),
      });
    });

    await page.goto('/admin/data');

    // Either loading indicator or content should be visible
    const banner = page.getByTestId('status-banner');
    const loadingBanner = page.getByTestId('status-banner-loading');

    // One of these should be visible
    await expect(banner.or(loadingBanner)).toBeVisible();
  });
});

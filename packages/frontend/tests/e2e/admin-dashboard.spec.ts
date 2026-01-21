/**
 * Admin Dashboard E2E Tests
 *
 * Tests for the PropertyIQ Admin Dashboard including:
 * - Dashboard access control (admin only)
 * - Confidence matrix display
 * - Backtest execution
 * - Alert management
 * - Formula version management
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import {
  MOCK_CONFIDENCE_MATRIX,
  MOCK_BACKTEST_RESULT,
  MOCK_ALERTS,
} from '../fixtures/mock-api-responses';

// ============================================================================
// Test Configuration
// ============================================================================

const adminAuthFile = path.join(__dirname, '../fixtures/.auth/admin-user.json');

// ============================================================================
// Helper Functions
// ============================================================================

async function setupAdminMocks(page: Page) {
  // Mock admin profile
  await page.route('**/api/user/profile', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'admin-user-001',
          email: 'admin@propertyiq.com',
          tier: 'enterprise',
          role: 'admin',
          name: 'Admin User',
        },
      }),
    });
  });

  // Mock confidence matrix
  await page.route('**/api/admin/confidence-matrix', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CONFIDENCE_MATRIX),
    });
  });

  // Mock alerts
  await page.route('**/api/admin/alerts*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ALERTS),
    });
  });

  // Mock formula versions
  await page.route('**/api/admin/formula-versions', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          versions: [
            { version: '1.2.0', status: 'active', createdAt: '2024-01-10T00:00:00Z' },
            { version: '1.1.0', status: 'archived', createdAt: '2023-10-01T00:00:00Z' },
            { version: '1.0.0', status: 'archived', createdAt: '2023-06-15T00:00:00Z' },
          ],
          activeVersion: '1.2.0',
        },
      }),
    });
  });

  // Mock backtest history
  await page.route('**/api/admin/backtests*', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            backtests: [
              MOCK_BACKTEST_RESULT.data,
              {
                ...MOCK_BACKTEST_RESULT.data,
                id: 'bt-2024-01-14-001',
                startedAt: '2024-01-14T08:00:00Z',
                completedAt: '2024-01-14T08:05:00Z',
              },
            ],
          },
        }),
      });
    } else if (route.request().method() === 'POST') {
      // Backtest trigger
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'bt-2024-01-15-002',
            status: 'running',
            startedAt: new Date().toISOString(),
          },
        }),
      });
    }
  });
}

async function setupNonAdminMocks(page: Page) {
  await page.route('**/api/user/profile', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'regular-user-001',
          email: 'user@test.com',
          tier: 'pro',
          role: 'user',
          name: 'Regular User',
        },
      }),
    });
  });
}

// ============================================================================
// Admin Access Control Tests
// ============================================================================

test.describe('Admin Access Control', () => {
  test('admin user can access admin dashboard', async ({ page }) => {
    await setupAdminMocks(page);

    await page.goto('/admin');

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByTestId('admin-dashboard')).toBeVisible();
  });

  test('non-admin user is redirected from admin dashboard', async ({ page }) => {
    await setupNonAdminMocks(page);

    await page.goto('/admin');

    // Should redirect to home or show access denied
    await expect(page).not.toHaveURL(/\/admin$/);

    const accessDenied = page.getByTestId('access-denied');
    const redirected = !page.url().includes('/admin');

    expect(await accessDenied.isVisible().catch(() => false) || redirected).toBe(true);
  });

  test('admin link visible in navigation for admin users', async ({ page }) => {
    await setupAdminMocks(page);

    await page.goto('/');

    const adminLink = page.getByTestId('nav-admin-link');
    await expect(adminLink).toBeVisible();
  });

  test('admin link hidden in navigation for non-admin users', async ({ page }) => {
    await setupNonAdminMocks(page);

    await page.goto('/');

    const adminLink = page.getByTestId('nav-admin-link');
    await expect(adminLink).not.toBeVisible();
  });
});

// ============================================================================
// Dashboard Layout Tests
// ============================================================================

test.describe('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMocks(page);
    await page.goto('/admin');
  });

  test('displays all dashboard tabs', async ({ page }) => {
    await expect(page.getByTestId('tab-overview')).toBeVisible();
    await expect(page.getByTestId('tab-confidence')).toBeVisible();
    await expect(page.getByTestId('tab-backtests')).toBeVisible();
    await expect(page.getByTestId('tab-alerts')).toBeVisible();
    await expect(page.getByTestId('tab-formulas')).toBeVisible();
  });

  test('overview tab is active by default', async ({ page }) => {
    const overviewTab = page.getByTestId('tab-overview');
    await expect(overviewTab).toHaveAttribute('data-active', 'true');
  });

  test('clicking tab switches content', async ({ page }) => {
    // Click confidence tab
    await page.getByTestId('tab-confidence').click();

    await expect(page.getByTestId('confidence-matrix-panel')).toBeVisible();
    await expect(page.getByTestId('overview-panel')).not.toBeVisible();
  });

  test('displays summary cards on overview', async ({ page }) => {
    await expect(page.getByTestId('summary-card-scores')).toBeVisible();
    await expect(page.getByTestId('summary-card-confidence')).toBeVisible();
    await expect(page.getByTestId('summary-card-alerts')).toBeVisible();
    await expect(page.getByTestId('summary-card-backtests')).toBeVisible();
  });
});

// ============================================================================
// Confidence Matrix Tests
// ============================================================================

test.describe('Confidence Matrix', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMocks(page);
    await page.goto('/admin');
    await page.getByTestId('tab-confidence').click();
  });

  test('displays confidence matrix table', async ({ page }) => {
    await expect(page.getByTestId('confidence-matrix-table')).toBeVisible();
  });

  test('matrix has correct row count (3 score types × 4 geo types)', async ({ page }) => {
    const rows = page.getByTestId('confidence-matrix-row');
    await expect(rows).toHaveCount(12);
  });

  test('matrix cells show correct confidence values', async ({ page }) => {
    // Market Health - State should show 92%
    const marketHealthStateCell = page.getByTestId('confidence-cell-market_health-state');
    await expect(marketHealthStateCell).toContainText('92');
  });

  test('matrix cells show status indicators', async ({ page }) => {
    // Healthy status (green)
    const healthyCell = page.getByTestId('confidence-cell-market_health-state');
    await expect(healthyCell.getByTestId('status-indicator')).toHaveClass(/healthy|green/);

    // Monitor status (amber)
    const monitorCell = page.getByTestId('confidence-cell-market_health-county');
    await expect(monitorCell.getByTestId('status-indicator')).toHaveClass(/monitor|amber/);

    // Review status (red)
    const reviewCell = page.getByTestId('confidence-cell-homeready-county');
    await expect(reviewCell.getByTestId('status-indicator')).toHaveClass(/review|red/);
  });

  test('clicking cell shows detail panel', async ({ page }) => {
    await page.getByTestId('confidence-cell-market_health-metro').click();

    const detailPanel = page.getByTestId('confidence-detail-panel');
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel).toContainText('Market Health');
    await expect(detailPanel).toContainText('Metro');
  });

  test('detail panel shows R² and sample count', async ({ page }) => {
    await page.getByTestId('confidence-cell-market_health-metro').click();

    const detailPanel = page.getByTestId('confidence-detail-panel');
    await expect(detailPanel.getByTestId('detail-r-squared')).toContainText('0.72');
    await expect(detailPanel.getByTestId('detail-sample-count')).toContainText('384');
  });

  test('confidence trend chart renders', async ({ page }) => {
    await page.getByTestId('confidence-cell-market_health-metro').click();

    const trendChart = page.getByTestId('confidence-trend-chart');
    await expect(trendChart).toBeVisible();
  });
});

// ============================================================================
// Backtest Execution Tests
// ============================================================================

test.describe('Backtest Execution', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMocks(page);
    await page.goto('/admin');
    await page.getByTestId('tab-backtests').click();
  });

  test('displays backtest history', async ({ page }) => {
    await expect(page.getByTestId('backtest-history-table')).toBeVisible();
    const rows = page.getByTestId('backtest-history-row');
    await expect(rows).toHaveCount(2);
  });

  test('can trigger new backtest', async ({ page }) => {
    await page.getByTestId('run-backtest-button').click();

    // Modal should appear
    await expect(page.getByTestId('backtest-config-modal')).toBeVisible();
  });

  test('backtest config modal has score type selector', async ({ page }) => {
    await page.getByTestId('run-backtest-button').click();

    await expect(page.getByTestId('backtest-score-type-select')).toBeVisible();
    await page.getByTestId('backtest-score-type-select').click();

    await expect(page.getByTestId('option-market_health')).toBeVisible();
    await expect(page.getByTestId('option-homeready')).toBeVisible();
    await expect(page.getByTestId('option-investoredge')).toBeVisible();
  });

  test('backtest config modal has geography type selector', async ({ page }) => {
    await page.getByTestId('run-backtest-button').click();

    await expect(page.getByTestId('backtest-geo-type-select')).toBeVisible();
  });

  test('starting backtest shows progress indicator', async ({ page }) => {
    await page.getByTestId('run-backtest-button').click();

    await page.getByTestId('backtest-score-type-select').click();
    await page.getByTestId('option-market_health').click();

    await page.getByTestId('backtest-geo-type-select').click();
    await page.getByTestId('option-metro').click();

    await page.getByTestId('start-backtest-button').click();

    // Progress indicator should appear
    await expect(page.getByTestId('backtest-progress-indicator')).toBeVisible();
  });

  test('backtest results display after completion', async ({ page }) => {
    // Mock a completed backtest
    await page.route('**/api/admin/backtests/*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BACKTEST_RESULT),
      });
    });

    // Click on a completed backtest in history
    await page.getByTestId('backtest-history-row').first().click();

    const resultsPanel = page.getByTestId('backtest-results-panel');
    await expect(resultsPanel).toBeVisible();
    await expect(resultsPanel.getByTestId('result-r-squared')).toContainText('0.72');
    await expect(resultsPanel.getByTestId('result-confidence')).toContainText('88');
  });

  test('backtest history shows duration', async ({ page }) => {
    const firstRow = page.getByTestId('backtest-history-row').first();
    await expect(firstRow.getByTestId('backtest-duration')).toContainText(/5.*min|332.*sec/);
  });
});

// ============================================================================
// Alert Management Tests
// ============================================================================

test.describe('Alert Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMocks(page);
    await page.goto('/admin');
    await page.getByTestId('tab-alerts').click();
  });

  test('displays alert list', async ({ page }) => {
    await expect(page.getByTestId('alerts-list')).toBeVisible();
  });

  test('shows alert count badges', async ({ page }) => {
    const openBadge = page.getByTestId('alert-count-open');
    const acknowledgedBadge = page.getByTestId('alert-count-acknowledged');

    await expect(openBadge).toContainText('1');
    await expect(acknowledgedBadge).toContainText('1');
  });

  test('displays alert severity indicator', async ({ page }) => {
    const alerts = page.getByTestId('alert-item');
    const firstAlert = alerts.first();

    const severityIndicator = firstAlert.getByTestId('alert-severity');
    await expect(severityIndicator).toHaveClass(/warning|critical/);
  });

  test('can acknowledge open alert', async ({ page }) => {
    await page.route('**/api/admin/alerts/*/acknowledge', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const openAlert = page.getByTestId('alert-item').filter({ hasText: 'open' }).first();
    await openAlert.getByTestId('acknowledge-button').click();

    // Confirm dialog
    await page.getByTestId('confirm-acknowledge').click();

    // Should show success message
    await expect(page.getByTestId('alert-success-message')).toBeVisible();
  });

  test('can resolve acknowledged alert', async ({ page }) => {
    await page.route('**/api/admin/alerts/*/resolve', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const acknowledgedAlert = page.getByTestId('alert-item').filter({ hasText: 'acknowledged' }).first();
    await acknowledgedAlert.getByTestId('resolve-button').click();

    // Resolution notes modal
    await expect(page.getByTestId('resolution-modal')).toBeVisible();
    await page.getByTestId('resolution-notes-input').fill('Issue investigated and resolved');
    await page.getByTestId('submit-resolution').click();

    await expect(page.getByTestId('alert-success-message')).toBeVisible();
  });

  test('can dismiss alert as false positive', async ({ page }) => {
    await page.route('**/api/admin/alerts/*/dismiss', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const alert = page.getByTestId('alert-item').first();
    await alert.getByTestId('dismiss-button').click();

    // Confirm dialog
    await page.getByTestId('dismiss-reason-input').fill('False positive - data lag');
    await page.getByTestId('confirm-dismiss').click();

    await expect(page.getByTestId('alert-success-message')).toBeVisible();
  });

  test('alert detail shows diagnostic signals', async ({ page }) => {
    await page.getByTestId('alert-item').first().click();

    const detailPanel = page.getByTestId('alert-detail-panel');
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel.getByTestId('diagnostic-signals')).toBeVisible();
  });

  test('alert detail shows recommended actions', async ({ page }) => {
    await page.getByTestId('alert-item').first().click();

    const detailPanel = page.getByTestId('alert-detail-panel');
    await expect(detailPanel.getByTestId('recommended-actions')).toBeVisible();
  });

  test('can filter alerts by severity', async ({ page }) => {
    await page.getByTestId('severity-filter').click();
    await page.getByTestId('filter-critical').click();

    const alerts = page.getByTestId('alert-item');
    const count = await alerts.count();

    // Should only show critical alerts
    for (let i = 0; i < count; i++) {
      const alert = alerts.nth(i);
      await expect(alert.getByTestId('alert-severity')).toHaveClass(/critical/);
    }
  });

  test('can filter alerts by score type', async ({ page }) => {
    await page.getByTestId('score-type-filter').click();
    await page.getByTestId('filter-homeready').click();

    const alerts = page.getByTestId('alert-item');
    const count = await alerts.count();

    for (let i = 0; i < count; i++) {
      const alert = alerts.nth(i);
      await expect(alert).toContainText(/HomeReady/i);
    }
  });
});

// ============================================================================
// Formula Version Management Tests
// ============================================================================

test.describe('Formula Version Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMocks(page);
    await page.goto('/admin');
    await page.getByTestId('tab-formulas').click();
  });

  test('displays formula version list', async ({ page }) => {
    await expect(page.getByTestId('formula-versions-list')).toBeVisible();
  });

  test('shows active version indicator', async ({ page }) => {
    const activeVersion = page.getByTestId('formula-version-1.2.0');
    await expect(activeVersion.getByTestId('active-indicator')).toBeVisible();
  });

  test('shows version status badges', async ({ page }) => {
    const activeVersion = page.getByTestId('formula-version-1.2.0');
    await expect(activeVersion.getByTestId('status-badge')).toContainText('active');

    const archivedVersion = page.getByTestId('formula-version-1.1.0');
    await expect(archivedVersion.getByTestId('status-badge')).toContainText('archived');
  });

  test('can view version details', async ({ page }) => {
    await page.getByTestId('formula-version-1.2.0').click();

    const detailPanel = page.getByTestId('formula-detail-panel');
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel).toContainText('1.2.0');
  });

  test('version details show weights configuration', async ({ page }) => {
    await page.getByTestId('formula-version-1.2.0').click();

    const detailPanel = page.getByTestId('formula-detail-panel');
    await expect(detailPanel.getByTestId('weights-table')).toBeVisible();
  });

  test('can compare two versions', async ({ page }) => {
    // Select first version
    await page.getByTestId('formula-version-1.2.0').getByTestId('compare-checkbox').check();

    // Select second version
    await page.getByTestId('formula-version-1.1.0').getByTestId('compare-checkbox').check();

    // Click compare button
    await page.getByTestId('compare-versions-button').click();

    // Comparison view should show
    await expect(page.getByTestId('version-comparison-panel')).toBeVisible();
    await expect(page.getByTestId('comparison-diff')).toBeVisible();
  });
});

// ============================================================================
// Dashboard Loading and Error States
// ============================================================================

test.describe('Dashboard Loading and Error States', () => {
  test('shows loading state while fetching data', async ({ page }) => {
    await page.route('**/api/admin/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    await setupAdminMocks(page);
    await page.goto('/admin');

    await expect(page.getByTestId('dashboard-loading')).toBeVisible();
  });

  test('shows error state on API failure', async ({ page }) => {
    await page.route('**/api/admin/confidence-matrix', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Internal server error' }),
      });
    });

    // Keep other mocks working
    await page.route('**/api/user/profile', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'admin-001', email: 'admin@test.com', role: 'admin' },
        }),
      });
    });

    await page.goto('/admin');
    await page.getByTestId('tab-confidence').click();

    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByTestId('retry-button')).toBeVisible();
  });

  test('retry button reloads data', async ({ page }) => {
    let callCount = 0;

    await page.route('**/api/admin/confidence-matrix', (route) => {
      callCount++;
      if (callCount === 1) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Temporary error' }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_CONFIDENCE_MATRIX),
        });
      }
    });

    await setupAdminMocks(page);
    await page.goto('/admin');
    await page.getByTestId('tab-confidence').click();

    // Wait for error
    await expect(page.getByTestId('error-message')).toBeVisible();

    // Retry
    await page.getByTestId('retry-button').click();

    // Should now show matrix
    await expect(page.getByTestId('confidence-matrix-table')).toBeVisible();
  });
});

// ============================================================================
// Dashboard Refresh and Real-time Updates
// ============================================================================

test.describe('Dashboard Refresh', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMocks(page);
  });

  test('manual refresh button updates data', async ({ page }) => {
    let fetchCount = 0;

    await page.route('**/api/admin/confidence-matrix', (route) => {
      fetchCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CONFIDENCE_MATRIX),
      });
    });

    await page.goto('/admin');
    await page.getByTestId('tab-confidence').click();

    const initialFetchCount = fetchCount;

    await page.getByTestId('refresh-button').click();

    // Should have fetched again
    expect(fetchCount).toBeGreaterThan(initialFetchCount);
  });

  test('last updated timestamp is displayed', async ({ page }) => {
    await page.goto('/admin');
    await page.getByTestId('tab-confidence').click();

    await expect(page.getByTestId('last-updated-timestamp')).toBeVisible();
  });
});

// ============================================================================
// Responsive Design Tests
// ============================================================================

test.describe('Dashboard Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMocks(page);
  });

  test('tabs collapse to dropdown on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/admin');

    // Tabs should be in a dropdown menu
    await expect(page.getByTestId('tabs-dropdown')).toBeVisible();
    await expect(page.getByTestId('tab-overview')).not.toBeVisible();

    // Open dropdown
    await page.getByTestId('tabs-dropdown').click();
    await expect(page.getByTestId('dropdown-tab-confidence')).toBeVisible();
  });

  test('confidence matrix scrolls horizontally on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/admin');

    await page.getByTestId('tabs-dropdown').click();
    await page.getByTestId('dropdown-tab-confidence').click();

    const matrixContainer = page.getByTestId('confidence-matrix-container');
    await expect(matrixContainer).toHaveClass(/overflow-x-auto|scroll/);
  });
});

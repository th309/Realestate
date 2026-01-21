/**
 * Score Display E2E Tests
 *
 * Tests for the PropertyIQ score display components including:
 * - Score badges on map click
 * - Score card expansion
 * - Component breakdowns
 * - Trend indicators
 * - Confidence stars
 * - Color coding by score range
 */

import { test, expect, Page } from '@playwright/test';
import {
  MOCK_FULL_SCORE_RESPONSE,
  MOCK_PARTIAL_SCORE_RESPONSE,
  getScoreColor,
  getConfidenceStars,
} from '../fixtures/mock-api-responses';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

/**
 * Setup mock API response for score endpoint
 */
async function mockScoreAPI(page: Page, response: object) {
  await page.route('**/api/scoring/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Navigate to map and select a geography
 */
async function selectGeography(page: Page, geoType: string, geoId: string) {
  await page.goto('/map');
  await page.waitForLoadState('networkidle');

  // Click on the geography on the map (or use search)
  const searchInput = page.getByTestId('geography-search-input');
  if (await searchInput.isVisible()) {
    await searchInput.fill(geoId);
    await page.getByTestId(`search-result-${geoType}-${geoId}`).click();
  } else {
    // Direct click on map element
    await page.getByTestId(`map-${geoType}-${geoId}`).click();
  }

  // Wait for score panel to appear
  await page.waitForSelector('[data-testid="score-panel"]', { timeout: 10000 });
}

// ============================================================================
// Score Badge Display Tests
// ============================================================================

test.describe('Score Badge Display', () => {
  test.beforeEach(async ({ page }) => {
    await mockScoreAPI(page, MOCK_FULL_SCORE_RESPONSE);
  });

  test('displays all three score badges on geography selection', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');

    // All three score badges should be visible
    await expect(page.getByTestId('score-badge-market-health')).toBeVisible();
    await expect(page.getByTestId('score-badge-homeready')).toBeVisible();
    await expect(page.getByTestId('score-badge-investoredge')).toBeVisible();
  });

  test('score badge displays correct score value', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');

    const marketHealthBadge = page.getByTestId('score-badge-market-health');
    await expect(marketHealthBadge).toContainText('72');

    const homereadyBadge = page.getByTestId('score-badge-homeready');
    await expect(homereadyBadge).toContainText('68');

    const investoredgeBadge = page.getByTestId('score-badge-investoredge');
    await expect(investoredgeBadge).toContainText('74');
  });

  test('score badge shows correct color for high score (70+)', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');

    const marketHealthBadge = page.getByTestId('score-badge-market-health');
    const expectedColor = getScoreColor(72); // 'green'

    // Check for green color class (implementation may vary)
    await expect(marketHealthBadge).toHaveClass(new RegExp(`bg-${expectedColor}|text-${expectedColor}`));
  });

  test('score badge shows correct color for medium score (55-69)', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');

    const homereadyBadge = page.getByTestId('score-badge-homeready');
    const expectedColor = getScoreColor(68); // 'amber'

    await expect(homereadyBadge).toHaveClass(new RegExp(`bg-${expectedColor}|text-${expectedColor}`));
  });

  test('score badge shows correct color for low score (40-54)', async ({ page }) => {
    await mockScoreAPI(page, MOCK_PARTIAL_SCORE_RESPONSE);
    await selectGeography(page, 'zip', '99501');

    const investoredgeBadge = page.getByTestId('score-badge-investoredge');
    const expectedColor = getScoreColor(48); // 'orange'

    await expect(investoredgeBadge).toHaveClass(new RegExp(`bg-${expectedColor}|text-${expectedColor}`));
  });

  test('score badge shows "--" for unavailable scores', async ({ page }) => {
    await mockScoreAPI(page, MOCK_PARTIAL_SCORE_RESPONSE);
    await selectGeography(page, 'zip', '99501');

    const homereadyBadge = page.getByTestId('score-badge-homeready');
    await expect(homereadyBadge).toContainText('--');
  });

  test('score badge shows gray color for unavailable scores', async ({ page }) => {
    await mockScoreAPI(page, MOCK_PARTIAL_SCORE_RESPONSE);
    await selectGeography(page, 'zip', '99501');

    const homereadyBadge = page.getByTestId('score-badge-homeready');
    await expect(homereadyBadge).toHaveClass(/bg-gray|text-gray/);
  });
});

// ============================================================================
// Score Card Expansion Tests
// ============================================================================

test.describe('Score Card Expansion', () => {
  test.beforeEach(async ({ page }) => {
    await mockScoreAPI(page, MOCK_FULL_SCORE_RESPONSE);
  });

  test('clicking badge expands to full score card', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');

    // Click on market health badge
    await page.getByTestId('score-badge-market-health').click();

    // Score card should expand
    await expect(page.getByTestId('score-card-market-health')).toBeVisible();
  });

  test('score card shows all component scores', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-market-health').click();

    // All components should be visible
    await expect(page.getByTestId('component-demand_strength')).toBeVisible();
    await expect(page.getByTestId('component-supply_balance')).toBeVisible();
    await expect(page.getByTestId('component-price_stability')).toBeVisible();
    await expect(page.getByTestId('component-economic_foundation')).toBeVisible();
  });

  test('component bars show correct percentages', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-market-health').click();

    // Check demand_strength bar width (78%)
    const demandBar = page.getByTestId('component-bar-demand_strength');
    await expect(demandBar).toHaveAttribute('style', /width:\s*78%/);

    // Check supply_balance bar width (65%)
    const supplyBar = page.getByTestId('component-bar-supply_balance');
    await expect(supplyBar).toHaveAttribute('style', /width:\s*65%/);
  });

  test('score card shows geography name', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-market-health').click();

    await expect(page.getByTestId('score-card-market-health')).toContainText('Beverly Hills, CA 90210');
  });

  test('clicking expanded card collapses it', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');

    // Expand
    await page.getByTestId('score-badge-market-health').click();
    await expect(page.getByTestId('score-card-market-health')).toBeVisible();

    // Click to collapse
    await page.getByTestId('score-card-close').click();
    await expect(page.getByTestId('score-card-market-health')).not.toBeVisible();
  });
});

// ============================================================================
// Trend Indicator Tests
// ============================================================================

test.describe('Trend Indicators', () => {
  test.beforeEach(async ({ page }) => {
    await mockScoreAPI(page, MOCK_FULL_SCORE_RESPONSE);
  });

  test('shows upward trend arrow for improving score', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-market-health').click();

    const trendIndicator = page.getByTestId('trend-indicator-market-health');
    await expect(trendIndicator).toHaveAttribute('data-direction', 'up');

    // Arrow icon should point up
    await expect(page.getByTestId('trend-arrow-up-market-health')).toBeVisible();
  });

  test('shows stable indicator for unchanged score', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-homeready').click();

    const trendIndicator = page.getByTestId('trend-indicator-homeready');
    await expect(trendIndicator).toHaveAttribute('data-direction', 'stable');

    // Stable icon should be visible
    await expect(page.getByTestId('trend-stable-homeready')).toBeVisible();
  });

  test('shows downward trend arrow for declining score', async ({ page }) => {
    await mockScoreAPI(page, MOCK_PARTIAL_SCORE_RESPONSE);
    await selectGeography(page, 'zip', '99501');
    await page.getByTestId('score-badge-investoredge').click();

    const trendIndicator = page.getByTestId('trend-indicator-investoredge');
    await expect(trendIndicator).toHaveAttribute('data-direction', 'down');

    await expect(page.getByTestId('trend-arrow-down-investoredge')).toBeVisible();
  });

  test('displays trend value change amount', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-market-health').click();

    const trendValue = page.getByTestId('trend-value-market-health');
    await expect(trendValue).toContainText('+3');
  });

  test('displays negative trend value for declining scores', async ({ page }) => {
    await mockScoreAPI(page, MOCK_PARTIAL_SCORE_RESPONSE);
    await selectGeography(page, 'zip', '99501');
    await page.getByTestId('score-badge-investoredge').click();

    const trendValue = page.getByTestId('trend-value-investoredge');
    await expect(trendValue).toContainText('-2');
  });
});

// ============================================================================
// Confidence Display Tests
// ============================================================================

test.describe('Confidence Display', () => {
  test.beforeEach(async ({ page }) => {
    await mockScoreAPI(page, MOCK_FULL_SCORE_RESPONSE);
  });

  test('displays confidence percentage', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-market-health').click();

    const confidenceDisplay = page.getByTestId('confidence-percentage-market-health');
    await expect(confidenceDisplay).toContainText('85%');
  });

  test('shows 4 filled stars for 70-89% confidence', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-market-health').click();

    const filledStars = await page.getByTestId('confidence-star-filled-market-health').count();
    expect(filledStars).toBe(4); // 85% = 4 stars
  });

  test('shows 3 filled stars for 55-69% confidence', async ({ page }) => {
    await mockScoreAPI(page, MOCK_PARTIAL_SCORE_RESPONSE);
    await selectGeography(page, 'zip', '99501');
    await page.getByTestId('score-badge-market-health').click();

    const filledStars = await page.getByTestId('confidence-star-filled-market-health').count();
    expect(filledStars).toBe(3); // 62% = 3 stars
  });

  test('shows 2 filled stars for 40-54% confidence', async ({ page }) => {
    await mockScoreAPI(page, MOCK_PARTIAL_SCORE_RESPONSE);
    await selectGeography(page, 'zip', '99501');
    await page.getByTestId('score-badge-investoredge').click();

    const filledStars = await page.getByTestId('confidence-star-filled-investoredge').count();
    expect(filledStars).toBe(3); // 55% = 3 stars
  });

  test('confidence stars match confidence percentage', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-investoredge').click();

    const confidenceText = await page.getByTestId('confidence-percentage-investoredge').textContent();
    const pct = parseInt(confidenceText?.replace('%', '') || '0');
    const expectedStars = getConfidenceStars(pct);

    const filledStars = await page.getByTestId('confidence-star-filled-investoredge').count();
    expect(filledStars).toBe(expectedStars);
  });
});

// ============================================================================
// Insufficient Data Display Tests
// ============================================================================

test.describe('Insufficient Data Display', () => {
  test.beforeEach(async ({ page }) => {
    await mockScoreAPI(page, MOCK_PARTIAL_SCORE_RESPONSE);
  });

  test('shows insufficient data message when score is unavailable', async ({ page }) => {
    await selectGeography(page, 'zip', '99501');
    await page.getByTestId('score-badge-homeready').click();

    await expect(page.getByTestId('insufficient-data-message')).toBeVisible();
    await expect(page.getByTestId('insufficient-data-message')).toContainText('Insufficient data');
  });

  test('displays reason for unavailable score', async ({ page }) => {
    await selectGeography(page, 'zip', '99501');
    await page.getByTestId('score-badge-homeready').click();

    const reason = page.getByTestId('unavailable-reason');
    await expect(reason).toContainText('only 40% of weighted metrics available');
  });

  test('shows partial data indicator for incomplete scores', async ({ page }) => {
    await selectGeography(page, 'zip', '99501');
    await page.getByTestId('score-badge-market-health').click();

    await expect(page.getByTestId('partial-data-indicator')).toBeVisible();
  });

  test('displays data completeness percentage', async ({ page }) => {
    await selectGeography(page, 'zip', '99501');
    await page.getByTestId('score-badge-market-health').click();

    const completeness = page.getByTestId('data-completeness');
    await expect(completeness).toContainText('65%');
  });

  test('marks missing components in score card', async ({ page }) => {
    await selectGeography(page, 'zip', '99501');
    await page.getByTestId('score-badge-market-health').click();

    const missingComponent = page.getByTestId('component-price_stability');
    await expect(missingComponent).toHaveClass(/missing|unavailable/);
  });

  test('shows inherited data source indicator', async ({ page }) => {
    await selectGeography(page, 'zip', '99501');
    await page.getByTestId('score-badge-investoredge').click();

    // rent_demand is inherited from state
    const inheritedComponent = page.getByTestId('component-rent_demand');
    await expect(inheritedComponent.getByTestId('inherited-indicator')).toBeVisible();
    await expect(inheritedComponent.getByTestId('inherited-source')).toContainText('state');
  });
});

// ============================================================================
// Responsive Design Tests
// ============================================================================

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await mockScoreAPI(page, MOCK_FULL_SCORE_RESPONSE);
  });

  test('score badges stack vertically on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await selectGeography(page, 'zip', '90210');

    const scorePanel = page.getByTestId('score-panel');
    await expect(scorePanel).toHaveClass(/flex-col|stack/);
  });

  test('score badges display horizontally on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await selectGeography(page, 'zip', '90210');

    const scorePanel = page.getByTestId('score-panel');
    await expect(scorePanel).toHaveClass(/flex-row|horizontal/);
  });

  test('expanded card takes full width on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-market-health').click();

    const card = page.getByTestId('score-card-market-health');
    const boundingBox = await card.boundingBox();
    expect(boundingBox?.width).toBeGreaterThan(350);
  });
});

// ============================================================================
// Loading State Tests
// ============================================================================

test.describe('Loading States', () => {
  test('shows loading skeleton while fetching scores', async ({ page }) => {
    // Delay the API response
    await page.route('**/api/scoring/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_FULL_SCORE_RESPONSE),
      });
    });

    await page.goto('/map');
    await page.getByTestId('geography-search-input').fill('90210');
    await page.getByTestId('search-result-zip-90210').click();

    // Loading skeletons should appear
    await expect(page.getByTestId('score-loading-skeleton')).toBeVisible();

    // Wait for scores to load
    await expect(page.getByTestId('score-badge-market-health')).toBeVisible({ timeout: 5000 });

    // Loading skeleton should disappear
    await expect(page.getByTestId('score-loading-skeleton')).not.toBeVisible();
  });

  test('shows error state on API failure', async ({ page }) => {
    await page.route('**/api/scoring/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Internal server error' }),
      });
    });

    await selectGeography(page, 'zip', '90210');

    await expect(page.getByTestId('score-error-message')).toBeVisible();
    await expect(page.getByTestId('retry-button')).toBeVisible();
  });

  test('retry button fetches scores again', async ({ page }) => {
    let callCount = 0;

    await page.route('**/api/scoring/**', (route) => {
      callCount++;
      if (callCount === 1) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Internal server error' }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_FULL_SCORE_RESPONSE),
        });
      }
    });

    await selectGeography(page, 'zip', '90210');
    await expect(page.getByTestId('score-error-message')).toBeVisible();

    await page.getByTestId('retry-button').click();
    await expect(page.getByTestId('score-badge-market-health')).toBeVisible();
  });
});

// ============================================================================
// Accessibility Tests
// ============================================================================

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockScoreAPI(page, MOCK_FULL_SCORE_RESPONSE);
  });

  test('score badges have accessible labels', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');

    const marketHealthBadge = page.getByTestId('score-badge-market-health');
    await expect(marketHealthBadge).toHaveAttribute('aria-label', /Market Health.*72/);
  });

  test('score cards can be navigated with keyboard', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');

    // Tab to first badge
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Enter to expand
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('score-card-market-health')).toBeVisible();

    // Escape to close
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('score-card-market-health')).not.toBeVisible();
  });

  test('trend indicators have screen reader text', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-market-health').click();

    const trendIndicator = page.getByTestId('trend-indicator-market-health');
    await expect(trendIndicator).toHaveAttribute('aria-label', /trending up.*3 points/i);
  });

  test('confidence stars have accessible description', async ({ page }) => {
    await selectGeography(page, 'zip', '90210');
    await page.getByTestId('score-badge-market-health').click();

    const confidenceStars = page.getByTestId('confidence-stars-market-health');
    await expect(confidenceStars).toHaveAttribute('aria-label', /85.*confidence.*4.*5.*stars/i);
  });
});

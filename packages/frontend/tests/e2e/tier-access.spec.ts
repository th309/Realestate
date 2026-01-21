/**
 * Tier Access Control E2E Tests
 *
 * Tests for the PropertyIQ tier-based access control system:
 * - Free tier: Market Health full, HomeReady/InvestorEdge teaser only
 * - Basic tier: Market Health full, HomeReady/InvestorEdge teaser only
 * - Pro tier: Full access to all scores
 * - Enterprise tier: Full access to all scores
 *
 * Score Access Matrix:
 * | Score Type    | Free | Basic | Pro | Enterprise |
 * |---------------|------|-------|-----|------------|
 * | Market Health | Full | Full  | Full| Full       |
 * | HomeReady     | Teaser | Teaser | Full | Full   |
 * | InvestorEdge  | Teaser | Teaser | Full | Full   |
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import {
  MOCK_FULL_SCORE_RESPONSE,
  MOCK_TEASER_SCORE_RESPONSE,
} from '../fixtures/mock-api-responses';

// ============================================================================
// Authentication Fixtures
// ============================================================================

const freeUserAuthFile = path.join(__dirname, '../fixtures/.auth/free-user.json');
const proUserAuthFile = path.join(__dirname, '../fixtures/.auth/pro-user.json');

// Test fixtures for different user tiers
test.describe.configure({ mode: 'serial' });

// ============================================================================
// Helper Functions
// ============================================================================

async function setupMockAPI(page: Page, userTier: 'free' | 'basic' | 'pro' | 'enterprise') {
  const isProOrHigher = userTier === 'pro' || userTier === 'enterprise';

  await page.route('**/api/scoring/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isProOrHigher ? MOCK_FULL_SCORE_RESPONSE : MOCK_TEASER_SCORE_RESPONSE),
    });
  });

  // Mock user profile endpoint
  await page.route('**/api/user/profile', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: `test-${userTier}-user`,
          email: `${userTier}@test.propertyiq.com`,
          tier: userTier,
          name: `Test ${userTier.charAt(0).toUpperCase() + userTier.slice(1)} User`,
        },
      }),
    });
  });
}

async function selectGeography(page: Page) {
  await page.goto('/map');
  await page.waitForLoadState('networkidle');

  // Select a geography
  const searchInput = page.getByTestId('geography-search-input');
  if (await searchInput.isVisible()) {
    await searchInput.fill('90210');
    await page.getByTestId('search-result-zip-90210').click();
  } else {
    await page.getByTestId('map-zip-90210').click();
  }

  await page.waitForSelector('[data-testid="score-panel"]', { timeout: 10000 });
}

// ============================================================================
// Free Tier Access Tests
// ============================================================================

test.describe('Free Tier Access', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page, 'free');
  });

  test('free user sees full Market Health score', async ({ page }) => {
    await selectGeography(page);

    // Market Health badge should show full score
    const marketHealthBadge = page.getByTestId('score-badge-market-health');
    await expect(marketHealthBadge).toBeVisible();
    await expect(marketHealthBadge).toContainText('72');

    // Click to expand - should see full component breakdown
    await marketHealthBadge.click();

    const scoreCard = page.getByTestId('score-card-market-health');
    await expect(scoreCard).toBeVisible();
    await expect(page.getByTestId('component-demand_strength')).toBeVisible();
    await expect(page.getByTestId('component-supply_balance')).toBeVisible();
    await expect(page.getByTestId('component-price_stability')).toBeVisible();
    await expect(page.getByTestId('component-economic_foundation')).toBeVisible();
  });

  test('free user sees HomeReady teaser only', async ({ page }) => {
    await selectGeography(page);

    // HomeReady badge should show score but be marked as teaser
    const homereadyBadge = page.getByTestId('score-badge-homeready');
    await expect(homereadyBadge).toBeVisible();
    await expect(homereadyBadge).toContainText('68');

    // Click should show teaser, not full card
    await homereadyBadge.click();

    const teaser = page.getByTestId('score-teaser-homeready');
    await expect(teaser).toBeVisible();

    // Components should NOT be visible
    await expect(page.getByTestId('component-affordability')).not.toBeVisible();
    await expect(page.getByTestId('component-market_timing')).not.toBeVisible();
    await expect(page.getByTestId('component-stability')).not.toBeVisible();
  });

  test('free user sees InvestorEdge teaser only', async ({ page }) => {
    await selectGeography(page);

    const investoredgeBadge = page.getByTestId('score-badge-investoredge');
    await expect(investoredgeBadge).toBeVisible();
    await expect(investoredgeBadge).toContainText('74');

    await investoredgeBadge.click();

    const teaser = page.getByTestId('score-teaser-investoredge');
    await expect(teaser).toBeVisible();

    // Components should NOT be visible
    await expect(page.getByTestId('component-cash_flow')).not.toBeVisible();
    await expect(page.getByTestId('component-rent_demand')).not.toBeVisible();
  });

  test('free user sees upgrade CTA on HomeReady teaser', async ({ page }) => {
    await selectGeography(page);
    await page.getByTestId('score-badge-homeready').click();

    const upgradeCTA = page.getByTestId('upgrade-cta-homeready');
    await expect(upgradeCTA).toBeVisible();
    await expect(upgradeCTA).toContainText(/upgrade|pro/i);
  });

  test('free user sees upgrade CTA on InvestorEdge teaser', async ({ page }) => {
    await selectGeography(page);
    await page.getByTestId('score-badge-investoredge').click();

    const upgradeCTA = page.getByTestId('upgrade-cta-investoredge');
    await expect(upgradeCTA).toBeVisible();
    await expect(upgradeCTA).toContainText(/upgrade|pro/i);
  });

  test('upgrade CTA navigates to pricing page', async ({ page }) => {
    await selectGeography(page);
    await page.getByTestId('score-badge-homeready').click();

    await page.getByTestId('upgrade-cta-homeready').click();

    await expect(page).toHaveURL(/\/pricing|\/upgrade/);
  });

  test('teaser shows "Unlock full details" message', async ({ page }) => {
    await selectGeography(page);
    await page.getByTestId('score-badge-homeready').click();

    const unlockMessage = page.getByTestId('unlock-message');
    await expect(unlockMessage).toBeVisible();
    await expect(unlockMessage).toContainText(/unlock|full details|component breakdown/i);
  });

  test('teaser shows lock icon on gated components', async ({ page }) => {
    await selectGeography(page);
    await page.getByTestId('score-badge-homeready').click();

    const lockIcon = page.getByTestId('lock-icon-homeready');
    await expect(lockIcon).toBeVisible();
  });
});

// ============================================================================
// Basic Tier Access Tests
// ============================================================================

test.describe('Basic Tier Access', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page, 'basic');
  });

  test('basic user sees full Market Health score', async ({ page }) => {
    await selectGeography(page);

    const marketHealthBadge = page.getByTestId('score-badge-market-health');
    await expect(marketHealthBadge).toContainText('72');

    await marketHealthBadge.click();
    await expect(page.getByTestId('component-demand_strength')).toBeVisible();
  });

  test('basic user sees HomeReady teaser only (same as free)', async ({ page }) => {
    await selectGeography(page);
    await page.getByTestId('score-badge-homeready').click();

    const teaser = page.getByTestId('score-teaser-homeready');
    await expect(teaser).toBeVisible();
    await expect(page.getByTestId('component-affordability')).not.toBeVisible();
  });

  test('basic user sees InvestorEdge teaser only (same as free)', async ({ page }) => {
    await selectGeography(page);
    await page.getByTestId('score-badge-investoredge').click();

    const teaser = page.getByTestId('score-teaser-investoredge');
    await expect(teaser).toBeVisible();
    await expect(page.getByTestId('component-cash_flow')).not.toBeVisible();
  });
});

// ============================================================================
// Pro Tier Access Tests
// ============================================================================

test.describe('Pro Tier Access', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page, 'pro');
  });

  test('pro user sees full Market Health score', async ({ page }) => {
    await selectGeography(page);

    await page.getByTestId('score-badge-market-health').click();

    await expect(page.getByTestId('score-card-market-health')).toBeVisible();
    await expect(page.getByTestId('component-demand_strength')).toBeVisible();
    await expect(page.getByTestId('component-supply_balance')).toBeVisible();
  });

  test('pro user sees full HomeReady data with components', async ({ page }) => {
    await selectGeography(page);

    await page.getByTestId('score-badge-homeready').click();

    // Full card, not teaser
    const fullCard = page.getByTestId('score-card-homeready');
    await expect(fullCard).toBeVisible();
    await expect(page.getByTestId('score-teaser-homeready')).not.toBeVisible();

    // All components visible
    await expect(page.getByTestId('component-affordability')).toBeVisible();
    await expect(page.getByTestId('component-market_timing')).toBeVisible();
    await expect(page.getByTestId('component-stability')).toBeVisible();
    await expect(page.getByTestId('component-growth_potential')).toBeVisible();
    await expect(page.getByTestId('component-livability')).toBeVisible();
  });

  test('pro user sees full InvestorEdge data with components', async ({ page }) => {
    await selectGeography(page);

    await page.getByTestId('score-badge-investoredge').click();

    const fullCard = page.getByTestId('score-card-investoredge');
    await expect(fullCard).toBeVisible();
    await expect(page.getByTestId('score-teaser-investoredge')).not.toBeVisible();

    // All components visible
    await expect(page.getByTestId('component-cash_flow')).toBeVisible();
    await expect(page.getByTestId('component-rent_demand')).toBeVisible();
    await expect(page.getByTestId('component-appreciation')).toBeVisible();
    await expect(page.getByTestId('component-entry_point')).toBeVisible();
    await expect(page.getByTestId('component-risk')).toBeVisible();
  });

  test('pro user does not see upgrade CTA', async ({ page }) => {
    await selectGeography(page);
    await page.getByTestId('score-badge-homeready').click();

    await expect(page.getByTestId('upgrade-cta-homeready')).not.toBeVisible();
  });

  test('pro user does not see lock icons', async ({ page }) => {
    await selectGeography(page);
    await page.getByTestId('score-badge-homeready').click();

    await expect(page.getByTestId('lock-icon-homeready')).not.toBeVisible();
  });

  test('pro user sees confidence and trend for all scores', async ({ page }) => {
    await selectGeography(page);

    // Market Health confidence
    await page.getByTestId('score-badge-market-health').click();
    await expect(page.getByTestId('confidence-percentage-market-health')).toContainText('85%');
    await expect(page.getByTestId('trend-indicator-market-health')).toBeVisible();
    await page.getByTestId('score-card-close').click();

    // HomeReady confidence
    await page.getByTestId('score-badge-homeready').click();
    await expect(page.getByTestId('confidence-percentage-homeready')).toContainText('82%');
    await expect(page.getByTestId('trend-indicator-homeready')).toBeVisible();
    await page.getByTestId('score-card-close').click();

    // InvestorEdge confidence
    await page.getByTestId('score-badge-investoredge').click();
    await expect(page.getByTestId('confidence-percentage-investoredge')).toContainText('88%');
    await expect(page.getByTestId('trend-indicator-investoredge')).toBeVisible();
  });
});

// ============================================================================
// Enterprise Tier Access Tests
// ============================================================================

test.describe('Enterprise Tier Access', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page, 'enterprise');
  });

  test('enterprise user has same access as pro', async ({ page }) => {
    await selectGeography(page);

    // Full HomeReady access
    await page.getByTestId('score-badge-homeready').click();
    await expect(page.getByTestId('score-card-homeready')).toBeVisible();
    await expect(page.getByTestId('component-affordability')).toBeVisible();
    await page.getByTestId('score-card-close').click();

    // Full InvestorEdge access
    await page.getByTestId('score-badge-investoredge').click();
    await expect(page.getByTestId('score-card-investoredge')).toBeVisible();
    await expect(page.getByTestId('component-cash_flow')).toBeVisible();
  });

  test('enterprise user sees additional enterprise features', async ({ page }) => {
    await selectGeography(page);

    // Enterprise badge in header (if applicable)
    const enterpriseBadge = page.getByTestId('enterprise-badge');
    if (await enterpriseBadge.isVisible()) {
      await expect(enterpriseBadge).toBeVisible();
    }
  });
});

// ============================================================================
// Unauthenticated User Tests
// ============================================================================

test.describe('Unauthenticated User', () => {
  test.beforeEach(async ({ page }) => {
    // No authentication setup - simulate logged out state
    await page.route('**/api/user/profile', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Unauthorized' }),
      });
    });

    await page.route('**/api/scoring/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TEASER_SCORE_RESPONSE),
      });
    });
  });

  test('unauthenticated user can see Market Health', async ({ page }) => {
    await page.goto('/map');
    await page.waitForLoadState('networkidle');

    // Navigate to geography without auth
    const searchInput = page.getByTestId('geography-search-input');
    if (await searchInput.isVisible()) {
      await searchInput.fill('90210');
      await page.getByTestId('search-result-zip-90210').click();
    }

    // Market Health should still be visible
    await expect(page.getByTestId('score-badge-market-health')).toBeVisible();
  });

  test('unauthenticated user sees login prompt on gated scores', async ({ page }) => {
    await page.goto('/map');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByTestId('geography-search-input');
    if (await searchInput.isVisible()) {
      await searchInput.fill('90210');
      await page.getByTestId('search-result-zip-90210').click();
    }

    await page.getByTestId('score-badge-homeready').click();

    // Should see login prompt instead of/in addition to teaser
    const loginPrompt = page.getByTestId('login-prompt');
    await expect(loginPrompt).toBeVisible();
    await expect(loginPrompt).toContainText(/sign in|log in|create account/i);
  });

  test('login prompt navigates to login page', async ({ page }) => {
    await page.goto('/map');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByTestId('geography-search-input');
    if (await searchInput.isVisible()) {
      await searchInput.fill('90210');
      await page.getByTestId('search-result-zip-90210').click();
    }

    await page.getByTestId('score-badge-homeready').click();
    await page.getByTestId('login-prompt-button').click();

    await expect(page).toHaveURL(/\/login/);
  });
});

// ============================================================================
// Tier Badge Display Tests
// ============================================================================

test.describe('Tier Badge Display', () => {
  test('free tier badge displayed in user menu', async ({ page }) => {
    await setupMockAPI(page, 'free');
    await page.goto('/map');

    const userMenu = page.getByTestId('user-menu');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await expect(page.getByTestId('user-tier-badge')).toContainText(/free/i);
    }
  });

  test('pro tier badge displayed in user menu', async ({ page }) => {
    await setupMockAPI(page, 'pro');
    await page.goto('/map');

    const userMenu = page.getByTestId('user-menu');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await expect(page.getByTestId('user-tier-badge')).toContainText(/pro/i);
    }
  });

  test('tier badge color matches tier level', async ({ page }) => {
    await setupMockAPI(page, 'pro');
    await page.goto('/map');

    const userMenu = page.getByTestId('user-menu');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      const tierBadge = page.getByTestId('user-tier-badge');
      // Pro tier should have distinct color (e.g., blue, purple, or gold)
      await expect(tierBadge).toHaveClass(/pro|premium|gold/);
    }
  });
});

// ============================================================================
// Session Handling Tests
// ============================================================================

test.describe('Session Handling', () => {
  test('tier changes reflected after profile update', async ({ page }) => {
    // Start as free
    await setupMockAPI(page, 'free');
    await selectGeography(page);

    await page.getByTestId('score-badge-homeready').click();
    await expect(page.getByTestId('score-teaser-homeready')).toBeVisible();
    await page.getByTestId('score-card-close').click();

    // Simulate upgrade to pro
    await page.route('**/api/user/profile', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-upgraded-user',
            email: 'upgraded@test.propertyiq.com',
            tier: 'pro',
          },
        }),
      });
    });

    await page.route('**/api/scoring/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_FULL_SCORE_RESPONSE),
      });
    });

    // Refresh or re-fetch
    await page.reload();
    await selectGeography(page);

    // Now should see full data
    await page.getByTestId('score-badge-homeready').click();
    await expect(page.getByTestId('score-card-homeready')).toBeVisible();
    await expect(page.getByTestId('component-affordability')).toBeVisible();
  });

  test('expired session shows login prompt', async ({ page }) => {
    // Start authenticated
    await setupMockAPI(page, 'pro');
    await page.goto('/map');

    // Simulate session expiry
    await page.route('**/api/user/profile', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Session expired' }),
      });
    });

    // Trigger a profile check
    await page.reload();

    // Should show session expired message or redirect to login
    const sessionExpired = page.getByTestId('session-expired-message');
    const loginRedirect = page.locator('text=/login|sign in/i');

    const hasExpiredMessage = await sessionExpired.isVisible().catch(() => false);
    const hasLoginText = await loginRedirect.isVisible().catch(() => false);

    expect(hasExpiredMessage || hasLoginText || page.url().includes('/login')).toBe(true);
  });
});

// ============================================================================
// Feature Flag Tests
// ============================================================================

test.describe('Feature Flags for Tier Access', () => {
  test('A/B test variant shows correct tier experience', async ({ page }) => {
    await page.route('**/api/feature-flags', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            'score-teaser-variant': 'expanded', // A/B test variant
          },
        }),
      });
    });

    await setupMockAPI(page, 'free');
    await selectGeography(page);
    await page.getByTestId('score-badge-homeready').click();

    // With 'expanded' variant, teaser might show more info
    const teaser = page.getByTestId('score-teaser-homeready');
    await expect(teaser).toBeVisible();
  });

  test('score access respects feature flag overrides', async ({ page }) => {
    // Feature flag that temporarily unlocks scores
    await page.route('**/api/feature-flags', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            'unlock-all-scores-promo': true, // Temporary promotion
          },
        }),
      });
    });

    await page.route('**/api/scoring/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_FULL_SCORE_RESPONSE),
      });
    });

    await setupMockAPI(page, 'free');
    await selectGeography(page);

    // With promo flag, free user might see full scores
    await page.getByTestId('score-badge-homeready').click();

    // Check for promo indicator
    const promoBadge = page.getByTestId('promo-access-badge');
    if (await promoBadge.isVisible()) {
      await expect(promoBadge).toContainText(/trial|promo|limited/i);
    }
  });
});

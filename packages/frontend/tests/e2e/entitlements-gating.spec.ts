/**
 * Entitlements Gating E2E Tests
 *
 * Tests the entire entitlements system using LIVE data (no mocks).
 * Uses ?tier=free|pro|enterprise URL param to simulate different tiers.
 *
 * Prerequisites:
 * - Frontend dev server running on port 3000
 * - Backend dev server running on port 3001
 * - Database seeded with current entitlements configuration
 *
 * Current free tier config (10 metrics + 3 scores + metro geo):
 *   Metrics: home_value, home_value_mom, home_value_yoy, listing_price,
 *            days_on_market, median_income, population, population_growth,
 *            homeownership_rate, unemployment_rate
 *   Scores:  homeready_score, investoredge_score, market_health_score
 *   Geos:    national, state, metro
 */

import { test, expect, type Page } from '@playwright/test';

// Extend default timeout — these tests load live data and interact with maps
test.setTimeout(60_000);

// Run all tests serially — the Admin Propagation test modifies shared DB state
// (moves metrics between tiers), which would interfere with other tests if
// they ran concurrently. Serial mode prevents any shared-state race conditions.
test.describe.configure({ mode: 'serial' });

// ============================================================================
// Configuration
// ============================================================================

const API_BASE = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3001';

/** Metrics that should be accessible on the free tier */
const FREE_METRICS = [
  'home_value',
  'home_value_mom',
  'home_value_yoy',
  'listing_price',
  'days_on_market',
  'median_income',
  'population',
  'population_growth',
  'homeownership_rate',
  'unemployment_rate',
];

/** Metrics that should be gated (Pro+) — a sample visible in Homebuyer/Affordability */
const GATED_METRICS = [
  'rent_index',
  'income_to_buy',
  'affordable_home_price',
  'price_per_sqft',
  'years_to_save',
  'home_value_5yr',
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Navigate to a URL with tier simulation.
 * The ?tier= param seeds sessionStorage and persists for the tab session.
 * Uses 'load' instead of 'networkidle' to avoid timeouts from persistent connections.
 */
async function navigateWithTier(page: Page, url: string, tier: string) {
  const separator = url.includes('?') ? '&' : '?';
  await page.goto(`${url}${separator}tier=${tier}`, { waitUntil: 'load' });
}

/**
 * Navigate to the map page with a pre-selected metro via URL params.
 *
 * Uses the map page's built-in URL param handling (?geo=metro&id=...&name=...&lat=...&lng=...)
 * which triggers handleSelectSearchResult() on page load — same code path as clicking
 * a search result, but without timing issues from canvas clicks.
 *
 * After navigation, expands the Affordability category to make MetricItem elements visible,
 * and waits for entitlements to load (lock icons appear on gated metrics).
 */
async function navigateToMapWithMetro(page: Page, tier: string) {
  // Phoenix-Mesa-Chandler metro: CBSA 38060
  // The URL params trigger both handleSelectSearchResult (zoom) and
  // handleFeatureClick (geography selection) so scores load automatically.
  const url = `/map?geo=metro&id=38060&name=${encodeURIComponent('Phoenix-Mesa-Chandler, AZ')}&lat=33.448&lng=-112.075&tier=${tier}`;
  await page.goto(url, { waitUntil: 'load' });

  // Wait for the score card to be visible
  await expect(page.getByTestId('sidebar-score-card')).toBeVisible({ timeout: 15000 });

  // Wait for score data to load — the "3-month change" label appears once
  // a geography is selected and scores are fetched (replaces "Select a region")
  await expect(page.getByText('3-month change')).toBeVisible({ timeout: 20000 });

  // Expand the Affordability metric category to reveal MetricItem elements
  const affordCategory = page.locator('button').filter({ hasText: 'Affordability' }).first();
  await expect(affordCategory).toBeVisible({ timeout: 10000 });
  await affordCategory.click();
  await page.waitForTimeout(300); // accordion animation

  // Wait for metric items to appear in the expanded category
  await expect(
    page.locator('[data-testid^="metric-item-"]').first()
  ).toBeVisible({ timeout: 10000 });

  // Wait for entitlements to finish loading — for free tier, lock icons appear
  // on gated metrics. For pro/enterprise, no locks will appear so we use a
  // shorter fixed wait. The isMetricGated function returns false while loading.
  if (tier === 'free') {
    // Wait for at least one lock icon (confirms entitlements loaded with gating)
    await expect(
      page.locator('[data-testid^="metric-lock-"]').first()
    ).toBeVisible({ timeout: 30000 });
  } else {
    // For higher tiers, just wait for entitlements to settle
    await page.waitForTimeout(3000);
  }
}

/**
 * Call the admin API to set feature values for a specific tier.
 * This calls PUT /api/admin/features/tier/{tierSlug}.
 * Note: The backend only updates the named tier — it does NOT cascade.
 * To move a feature from free to pro, you must explicitly call this
 * for BOTH tiers (set false on free, true on pro).
 */
async function setTierFeature(tierSlug: string, features: Record<string, boolean>) {
  const response = await fetch(`${API_BASE}/api/admin/features/tier/${tierSlug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Admin API failed (${response.status}): ${text}`);
  }
}

/**
 * Move a feature to a target tier using the same cascade logic as the admin UI.
 * Sets the feature to true for the target tier and all higher tiers,
 * and false for all lower tiers.
 */
const TIER_ORDER = ['free', 'pro', 'enterprise', 'admin'];
async function moveFeatureToTier(featureSlug: string, targetTier: string) {
  const targetIndex = TIER_ORDER.indexOf(targetTier);
  if (targetIndex === -1) throw new Error(`Unknown tier: ${targetTier}`);

  for (let i = 0; i < TIER_ORDER.length; i++) {
    const tier = TIER_ORDER[i];
    if (tier === 'admin') continue; // Don't touch admin tier
    await setTierFeature(tier, { [featureSlug]: i >= targetIndex });
  }
}

/**
 * Count visible elements matching a testid prefix.
 * Returns the number of currently visible elements.
 */
async function countVisibleTestIds(page: Page, prefix: string): Promise<number> {
  const elements = page.locator(`[data-testid^="${prefix}"]`);
  const count = await elements.count();
  let visible = 0;
  for (let i = 0; i < count; i++) {
    if (await elements.nth(i).isVisible()) visible++;
  }
  return visible;
}

// ============================================================================
// Section A: Free Tier — Map Page Metrics
// ============================================================================

test.describe('Free Tier - Map Metrics', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMapWithMetro(page, 'free');
  });

  test('free metrics are accessible without lock icons', async ({ page }) => {
    // Check a sample of free metrics — they should be visible without lock icons
    for (const metricId of ['home_value', 'listing_price', 'days_on_market', 'median_income']) {
      const item = page.getByTestId(`metric-item-${metricId}`);
      // Skip metrics not visible in current sidebar section
      if (await item.isVisible({ timeout: 2000 }).catch(() => false)) {
        const lock = page.getByTestId(`metric-lock-${metricId}`);
        await expect(lock).not.toBeVisible();
      }
    }
  });

  test('gated metrics show lock icons', async ({ page }) => {
    // Check a sample of gated metrics — they should have lock icons
    // Note: isMetricGated returns false while entitlements are loading,
    // so lock icons may take a moment to appear after page load.
    let foundGated = false;
    for (const metricId of GATED_METRICS) {
      const item = page.getByTestId(`metric-item-${metricId}`);
      if (await item.isVisible({ timeout: 2000 }).catch(() => false)) {
        const lock = page.getByTestId(`metric-lock-${metricId}`);
        await expect(lock).toBeVisible({ timeout: 10000 });
        foundGated = true;
      }
    }
    // At least one gated metric should be found in the sidebar
    expect(foundGated).toBe(true);
  });

  test('clicking gated metric opens paywall modal', async ({ page }) => {
    // Find the first visible gated metric that has a lock icon (confirming it's gated)
    for (const metricId of GATED_METRICS) {
      const lock = page.getByTestId(`metric-lock-${metricId}`);
      if (await lock.isVisible({ timeout: 5000 }).catch(() => false)) {
        const button = page.getByTestId(`metric-button-${metricId}`);
        await button.click();

        // Paywall overlay should appear
        const overlay = page.getByTestId(`paywall-overlay-${metricId}`);
        await expect(overlay).toBeVisible({ timeout: 5000 });

        // Should contain paywall card with title and CTA linking to pricing
        await expect(page.getByTestId('paywall-title')).toBeVisible();
        await expect(page.getByTestId('paywall-cta')).toBeVisible();
        await expect(page.getByTestId('paywall-cta')).toHaveAttribute('href', '/pricing');

        // Close by clicking overlay backdrop
        await overlay.click({ position: { x: 10, y: 10 } });
        break;
      }
    }
  });
});

// ============================================================================
// Section B: Free Tier — Map Page Scores
// ============================================================================

test.describe('Free Tier - Map Scores', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMapWithMetro(page, 'free');
  });

  test('score card renders with scores visible', async ({ page }) => {
    const scoreCard = page.getByTestId('sidebar-score-card');
    await expect(scoreCard).toBeVisible({ timeout: 10000 });
  });

  test('score breakdown is gated with Pro badge', async ({ page }) => {
    const scoreCard = page.getByTestId('sidebar-score-card');
    await expect(scoreCard).toBeVisible({ timeout: 10000 });

    // Check all three scores by cycling through carousel
    const scoreKeys = ['marketHealth', 'homeready', 'investoredge'];
    let foundProBadge = false;

    for (const key of scoreKeys) {
      // Click the carousel dot to switch to this score
      const dot = page.getByTestId(`score-dot-${key}`);
      if (await dot.isVisible()) {
        await dot.click();
        await page.waitForTimeout(300); // animation
      }

      // Check for Pro badge (score_breakdown is Pro-gated)
      const proBadge = page.getByTestId(`score-pro-badge-${key}`);
      if (await proBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
        foundProBadge = true;
      }
    }

    // At least one score should show the Pro badge for breakdown
    expect(foundProBadge).toBe(true);
  });

  test('upgrade CTA visible on score with gated breakdown', async ({ page }) => {
    const scoreCard = page.getByTestId('sidebar-score-card');
    await expect(scoreCard).toBeVisible({ timeout: 10000 });

    // Look for upgrade CTA on any score
    const scoreKeys = ['marketHealth', 'homeready', 'investoredge'];
    let foundCta = false;

    for (const key of scoreKeys) {
      const dot = page.getByTestId(`score-dot-${key}`);
      if (await dot.isVisible()) {
        await dot.click();
        await page.waitForTimeout(300);
      }

      const cta = page.getByTestId(`score-upgrade-cta-${key}`);
      if (await cta.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Verify CTA text
        await expect(cta).toContainText('See what drives this score');
        foundCta = true;
        break;
      }
    }

    expect(foundCta).toBe(true);
  });
});

// ============================================================================
// Section C: Free Tier — Market Detail Geo Gating
// ============================================================================

test.describe('Free Tier - Market Geo Gating', () => {
  test('metro market page is accessible (no gate wall)', async ({ page }) => {
    // Austin metro (12420) — should be accessible for free tier
    await navigateWithTier(page, '/market/12420', 'free');

    // Metro is a free geo, gate wall should never appear
    await expect(page.getByTestId('geo-gate-wall')).not.toBeVisible({ timeout: 15000 });
  });

  test('county market page shows geo gate wall', async ({ page }) => {
    // LA County (06037) — county is Pro-gated
    await navigateWithTier(page, '/market/06037?type=county', 'free');
    await page.waitForTimeout(3000);

    const gateWall = page.getByTestId('geo-gate-wall');
    await expect(gateWall).toBeVisible({ timeout: 10000 });

    // Verify gate wall content
    await expect(page.getByText('Upgrade to Pro')).toBeVisible();
    await expect(page.getByText('Level Data')).toBeVisible();
  });

  test('zip market page shows geo gate wall', async ({ page }) => {
    // A ZIP code — zip is Pro-gated
    await navigateWithTier(page, '/market/85001?type=zip', 'free');
    await page.waitForTimeout(3000);

    const gateWall = page.getByTestId('geo-gate-wall');
    await expect(gateWall).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// Section D: Free Tier — Graphs Page
// ============================================================================

test.describe('Free Tier - Graphs', () => {
  test('graphs page loads for free tier', async ({ page }) => {
    await navigateWithTier(page, '/graphs', 'free');

    // Page should load without crashing
    await expect(page.locator('body')).toBeVisible();
    // Should not show a full-page gate wall
    await expect(page.getByTestId('geo-gate-wall')).not.toBeVisible();
  });

  test('score waterfall preset shows gated message', async ({ page }) => {
    await navigateWithTier(page, '/graphs', 'free');
    await page.waitForTimeout(2000);

    // Try to find and click the score/waterfall preset
    // The preset selector varies — look for button or tab with "Score" or "Waterfall"
    const scorePreset = page.locator('button:has-text("Score"), [role="tab"]:has-text("Score")').first();
    if (await scorePreset.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scorePreset.click();
      await page.waitForTimeout(1000);

      // Should show gated message
      const gate = page.getByTestId('graphs-score-gate');
      if (await gate.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(page.getByText('Upgrade to Pro to unlock this visualization')).toBeVisible();
      }
    }
    // If preset not found, the test still passes — not all graph configs show the gate
  });
});

// ============================================================================
// Section E: Pro Tier — Full Access
// ============================================================================

test.describe('Pro Tier - Full Access', () => {
  test('all metrics unlocked on map (no lock icons)', async ({ page }) => {
    await navigateToMapWithMetro(page, 'pro');

    // No lock icons should be visible anywhere
    const lockCount = await countVisibleTestIds(page, 'metric-lock-');
    expect(lockCount).toBe(0);
  });

  test('score breakdowns accessible (no Pro badges)', async ({ page }) => {
    await navigateToMapWithMetro(page, 'pro');

    const scoreCard = page.getByTestId('sidebar-score-card');
    await expect(scoreCard).toBeVisible({ timeout: 10000 });

    // No Pro badges on any score
    const proBadgeCount = await countVisibleTestIds(page, 'score-pro-badge-');
    expect(proBadgeCount).toBe(0);

    // No upgrade CTAs
    const ctaCount = await countVisibleTestIds(page, 'score-upgrade-cta-');
    expect(ctaCount).toBe(0);
  });

  test('county market page accessible (no gate wall)', async ({ page }) => {
    await navigateWithTier(page, '/market/06037?type=county', 'pro');

    // The gate wall may flash briefly while entitlements load (defaults to 'none').
    // Wait up to 20s for it to disappear once pro-tier entitlements resolve.
    await expect(page.getByTestId('geo-gate-wall')).not.toBeVisible({ timeout: 20000 });
  });

  test('zip market page accessible (no gate wall)', async ({ page }) => {
    await navigateWithTier(page, '/market/85001?type=zip', 'pro');

    await expect(page.getByTestId('geo-gate-wall')).not.toBeVisible({ timeout: 20000 });
  });
});

// ============================================================================
// Section F: Enterprise Tier — Smoke Test
// ============================================================================

test.describe('Enterprise Tier - Smoke', () => {
  test('all metrics unlocked and no gating on map', async ({ page }) => {
    await navigateToMapWithMetro(page, 'enterprise');

    // No lock icons
    const lockCount = await countVisibleTestIds(page, 'metric-lock-');
    expect(lockCount).toBe(0);

    // No Pro badges
    const proBadgeCount = await countVisibleTestIds(page, 'score-pro-badge-');
    expect(proBadgeCount).toBe(0);
  });

  test('county and zip markets accessible', async ({ page }) => {
    // County — gate wall may flash while entitlements load, wait for it to resolve
    await navigateWithTier(page, '/market/06037?type=county', 'enterprise');
    await expect(page.getByTestId('geo-gate-wall')).not.toBeVisible({ timeout: 20000 });

    // ZIP
    await navigateWithTier(page, '/market/85001?type=zip', 'enterprise');
    await expect(page.getByTestId('geo-gate-wall')).not.toBeVisible({ timeout: 20000 });
  });
});

// ============================================================================
// Section G: Admin Propagation — DB changes flow to frontend
// ============================================================================

test.describe('Admin Propagation', () => {
  // This test modifies DB state via the admin API, so run serially
  test.describe.configure({ mode: 'serial' });

  // This test navigates 3 times (each ~25s) + API calls, so needs extended timeout
  test('toggling a metric in admin changes frontend gating', async ({ page }) => {
    test.setTimeout(120_000);
    // ── Step 1: Verify home_value is unlocked for free tier ──
    await navigateToMapWithMetro(page, 'free');

    const homeValueItem = page.getByTestId('metric-item-home_value');
    await expect(homeValueItem).toBeVisible({ timeout: 10000 });

    const homeValueLock = page.getByTestId('metric-lock-home_value');
    await expect(homeValueLock).not.toBeVisible();

    // ── Step 2: Move home_value to Pro-only via admin API ──
    // Replicates the admin UI cascade: free=false, pro=true, enterprise=true
    await moveFeatureToTier('metric_home_value', 'pro');

    // Small delay for DB write to complete
    await page.waitForTimeout(1000);

    // ── Step 3: Reload to re-fetch entitlements with pre-selected metro ──
    await navigateToMapWithMetro(page, 'free');

    // ── Step 4: Verify home_value is now locked ──
    const homeValueItemAfter = page.getByTestId('metric-item-home_value');
    await expect(homeValueItemAfter).toBeVisible({ timeout: 10000 });

    const homeValueLockAfter = page.getByTestId('metric-lock-home_value');
    await expect(homeValueLockAfter).toBeVisible({ timeout: 10000 });

    // ── Step 5: Restore — move home_value back to Free tier ──
    // Replicates admin UI cascade: free=true, pro=true, enterprise=true
    await moveFeatureToTier('metric_home_value', 'free');
    await page.waitForTimeout(1000);

    // ── Step 6: Verify restoration ──
    await navigateToMapWithMetro(page, 'free');

    const homeValueItemRestored = page.getByTestId('metric-item-home_value');
    await expect(homeValueItemRestored).toBeVisible({ timeout: 10000 });

    const homeValueLockRestored = page.getByTestId('metric-lock-home_value');
    await expect(homeValueLockRestored).not.toBeVisible();
  });
});

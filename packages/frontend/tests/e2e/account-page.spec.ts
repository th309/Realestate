/**
 * Account Page Per-Tier E2E Tests
 *
 * Tests the /account page tabs (Profile, Subscription, Activity, Support)
 * across all four tiers using the ?tier= URL param to simulate entitlements.
 *
 * Prerequisites:
 * - Frontend dev server running on port 3000
 * - Backend dev server running on port 3001
 * - Tier simulation active (reads ?tier= param from URL)
 */

import { test, expect, type Page } from '@playwright/test';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Navigate to a URL with tier simulation.
 * Uses 'load' instead of 'networkidle' to avoid timeouts from persistent connections.
 */
async function navigateWithTier(page: Page, url: string, tier: string) {
  const separator = url.includes('?') ? '&' : '?';
  await page.goto(`${url}${separator}tier=${tier}`, { waitUntil: 'load' });
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Account Page - Per Tier', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  // --------------------------------------------------------------------------
  // Per-Tier Tab Rendering
  // --------------------------------------------------------------------------

  for (const tier of ['free', 'pro', 'enterprise', 'admin'] as const) {
    test.describe(`${tier} tier`, () => {
      test(`Profile tab renders for ${tier}`, async ({ page }) => {
        await navigateWithTier(page, '/account?tab=profile', tier);

        // Profile tab has three sections: Personal Information, Security, Account Actions
        await expect(
          page.getByText(/personal info/i).first()
        ).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(/security/i).first()).toBeVisible();
        await expect(
          page.getByText(/account actions/i).first()
        ).toBeVisible();

        // Display name field should be visible
        await expect(page.getByText(/display name/i).first()).toBeVisible();

        // Connected accounts section should be visible
        await expect(
          page.getByText(/connected accounts/i).first()
        ).toBeVisible();
      });

      test(`Subscription tab shows correct plan for ${tier}`, async ({
        page,
      }) => {
        await navigateWithTier(page, '/account?tab=subscription', tier);

        // Verify tier label appears in the Current Plan card
        const tierLabel =
          tier === 'admin'
            ? 'Admin'
            : tier.charAt(0).toUpperCase() + tier.slice(1);
        await expect(page.getByText(tierLabel).first()).toBeVisible({
          timeout: 15_000,
        });

        // Free tier should show "Upgrade to Pro" CTA in the Actions section
        if (tier === 'free') {
          await expect(
            page.getByText(/upgrade to pro/i).first()
          ).toBeVisible();
        }

        // Paid tiers should show "Manage Subscription" button
        if (tier === 'pro' || tier === 'enterprise') {
          await expect(
            page.getByText(/manage subscription/i).first()
          ).toBeVisible();
        }
      });

      test(`Subscription tab shows usage meters for ${tier}`, async ({
        page,
      }) => {
        await navigateWithTier(page, '/account?tab=subscription', tier);

        // Usage section heading
        await expect(page.getByText('Usage').first()).toBeVisible({
          timeout: 15_000,
        });

        // Should have meter labels
        await expect(
          page.getByText(/reports this month/i).first()
        ).toBeVisible();
        await expect(
          page.getByText(/saved markets/i).first()
        ).toBeVisible();
      });

      test(`Activity tab renders for ${tier}`, async ({ page }) => {
        await navigateWithTier(page, '/account?tab=activity', tier);

        // Saved Markets section always visible
        await expect(
          page.getByText(/saved markets/i).first()
        ).toBeVisible({ timeout: 15_000 });

        // Email Notifications section always visible
        await expect(
          page.getByText(/email notifications/i).first()
        ).toBeVisible();

        // For free tier, alerts section shows gating message
        if (tier === 'free') {
          await expect(
            page.getByText(/alerts are a pro feature/i).first()
          ).toBeVisible();
          await expect(
            page.getByText(/upgrade to pro/i).first()
          ).toBeVisible();
        }
      });

      test(`Support tab form renders for ${tier}`, async ({ page }) => {
        await navigateWithTier(page, '/account?tab=support', tier);

        // Contact Support heading
        await expect(
          page.getByText(/contact support/i).first()
        ).toBeVisible({ timeout: 15_000 });

        // Issue type select
        await expect(
          page.getByText(/issue type/i).first()
        ).toBeVisible();

        // Description textarea
        await expect(page.locator('textarea').first()).toBeVisible();

        // Submit button
        await expect(
          page.getByRole('button', { name: /submit/i })
        ).toBeVisible();
      });
    });
  }

  // --------------------------------------------------------------------------
  // Tab Navigation
  // --------------------------------------------------------------------------

  test.describe('Tab Navigation', () => {
    test('default tab is profile', async ({ page }) => {
      await navigateWithTier(page, '/account', 'free');
      // Profile tab content should be visible by default
      await expect(
        page.getByText(/personal info/i).first()
      ).toBeVisible({ timeout: 15_000 });
    });

    test('tab switching updates URL', async ({ page }) => {
      await navigateWithTier(page, '/account', 'pro');

      // Wait for page to load
      await expect(
        page.getByText(/personal info/i).first()
      ).toBeVisible({ timeout: 15_000 });

      // Click Subscription tab
      const subscriptionTab = page
        .locator('button')
        .filter({ hasText: /^Subscription$/ })
        .first();
      await subscriptionTab.click();
      await expect(page).toHaveURL(/tab=subscription/);

      // Click Activity tab
      const activityTab = page
        .locator('button')
        .filter({ hasText: /^Activity$/ })
        .first();
      await activityTab.click();
      await expect(page).toHaveURL(/tab=activity/);

      // Click Support tab
      const supportTab = page
        .locator('button')
        .filter({ hasText: /^Support$/ })
        .first();
      await supportTab.click();
      await expect(page).toHaveURL(/tab=support/);

      // Click Profile tab to return
      const profileTab = page
        .locator('button')
        .filter({ hasText: /^Profile$/ })
        .first();
      await profileTab.click();
      await expect(page).toHaveURL(/tab=profile/);
    });

    test('direct URL with tab param works', async ({ page }) => {
      await navigateWithTier(page, '/account?tab=support', 'pro');
      // Support content should render directly
      await expect(
        page.getByText(/contact support/i).first()
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  // --------------------------------------------------------------------------
  // Plan Comparison
  // --------------------------------------------------------------------------

  test.describe('Plan Comparison', () => {
    test('shows plan comparison cards on subscription tab', async ({
      page,
    }) => {
      await navigateWithTier(page, '/account?tab=subscription', 'free');

      // Compare Plans section
      await expect(
        page.getByText(/compare plans/i).first()
      ).toBeVisible({ timeout: 15_000 });

      // Three plan cards with prices: Free ($0), Pro ($29), Enterprise ($99)
      await expect(page.getByText('$0').first()).toBeVisible();
      await expect(page.getByText('$29').first()).toBeVisible();
      await expect(page.getByText('$99').first()).toBeVisible();
    });

    test('current plan is highlighted', async ({ page }) => {
      await navigateWithTier(page, '/account?tab=subscription', 'pro');

      await expect(
        page.getByText(/compare plans/i).first()
      ).toBeVisible({ timeout: 15_000 });

      // The "Current" badge should appear on the Pro plan card
      await expect(page.getByText('Current').first()).toBeVisible();
    });
  });

  // --------------------------------------------------------------------------
  // Old Route Redirects
  // --------------------------------------------------------------------------

  test.describe('Old Route Redirects', () => {
    test('/account/billing redirects to /account?tab=subscription', async ({
      page,
    }) => {
      // The billing page uses next/navigation redirect() which is a server redirect
      await page.goto('/account/billing');
      await page.waitForURL(/\/account\?tab=subscription/, {
        timeout: 10_000,
      });
    });

    test('/account/notifications redirects to /account?tab=activity', async ({
      page,
    }) => {
      await page.goto('/account/notifications');
      await page.waitForURL(/\/account\?tab=activity/, { timeout: 10_000 });
    });
  });
});

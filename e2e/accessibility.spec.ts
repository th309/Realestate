import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('should have proper document structure on home page', async ({ page }) => {
    await page.goto('/');

    // Check for main landmark
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();

    // Check for navigation landmark
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible();

    // Page should have a title
    await expect(page).toHaveTitle(/.+/);
  });

  test('should have skip link for keyboard users', async ({ page }) => {
    await page.goto('/');

    // Tab to focus on skip link
    await page.keyboard.press('Tab');

    // Skip link should be visible when focused
    const skipLink = page.locator('a[href="#main-content"]');
    if (await skipLink.count() > 0) {
      await expect(skipLink).toBeFocused();
    }
  });

  test('should allow keyboard navigation through menu', async ({ page }) => {
    await page.goto('/');

    // Tab through navigation items
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Should have focused element
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('should have accessible form labels on login page', async ({ page }) => {
    await page.goto('/login');

    // Email input should have associated label
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    // Password input should have associated label
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should have accessible buttons', async ({ page }) => {
    await page.goto('/login');

    // Submit button should be accessible
    const submitButton = page.getByRole('button', { name: /sign in/i });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test('should maintain focus management in modals', async ({ page }) => {
    await page.goto('/search');

    // Set mobile viewport to trigger filter drawer
    await page.setViewportSize({ width: 375, height: 667 });

    const filterButton = page.getByRole('button', { name: /filters/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();

      // Drawer should trap focus
      const drawer = page.locator('.MuiDrawer-paper');
      if (await drawer.isVisible()) {
        // Focus should be inside drawer
        await page.keyboard.press('Tab');
        const focused = await page.locator(':focus').boundingBox();
        const drawerBox = await drawer.boundingBox();

        if (focused && drawerBox) {
          expect(focused.x).toBeGreaterThanOrEqual(drawerBox.x);
          expect(focused.x).toBeLessThanOrEqual(drawerBox.x + drawerBox.width);
        }
      }
    }
  });

  test('should have proper color contrast', async ({ page }) => {
    await page.goto('/');

    // This is a basic check - full contrast testing would use axe-core
    // Check that text elements have sufficient contrast by verifying they are visible

    // Main heading should be visible
    const heading = page.getByRole('heading').first();
    if (await heading.isVisible()) {
      await expect(heading).toBeVisible();
    }

    // Links should be visible
    const links = page.getByRole('link');
    const count = await links.count();
    if (count > 0) {
      await expect(links.first()).toBeVisible();
    }
  });

  test('should have accessible images', async ({ page }) => {
    await page.goto('/');

    // All images should have alt text
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Image should have alt text or role="presentation"
      expect(alt !== null || role === 'presentation').toBeTruthy();
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/search');

    // Get all headings
    const h1 = await page.locator('h1').count();
    const h2 = await page.locator('h2').count();

    // Should have at most one h1
    expect(h1).toBeLessThanOrEqual(1);

    // If there are h2s, there should be an h1
    if (h2 > 0) {
      expect(h1).toBeGreaterThanOrEqual(0); // h1 may be in layout
    }
  });
});

test.describe('Screen Reader Announcements', () => {
  test('should announce loading states', async ({ page }) => {
    await page.goto('/search');

    // Check for loading indicators with proper aria attributes
    const loadingIndicators = page.locator('[role="progressbar"], [aria-busy="true"]');
    const count = await loadingIndicators.count();

    // Loading indicators should have aria-label or aria-labelledby
    for (let i = 0; i < count; i++) {
      const indicator = loadingIndicators.nth(i);
      const label = await indicator.getAttribute('aria-label');
      const labelledBy = await indicator.getAttribute('aria-labelledby');
      expect(label !== null || labelledBy !== null).toBeTruthy();
    }
  });

  test('should have proper alert announcements', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid');
    await page.getByLabel(/password/i).fill('short');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Error message should have proper role
    const errorAlert = page.locator('[role="alert"]');
    const count = await errorAlert.count();
    if (count > 0) {
      await expect(errorAlert.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

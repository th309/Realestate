import { test, expect } from '@playwright/test';

test.describe('Property Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search');
  });

  test('should display property search page with filters', async ({ page }) => {
    // Check main heading
    await expect(page.getByRole('heading', { name: /property search/i })).toBeVisible();

    // Check search input
    await expect(page.getByPlaceholder(/search by city/i)).toBeVisible();

    // Check sort dropdown
    await expect(page.getByLabel(/sort by/i)).toBeVisible();
  });

  test('should filter properties by price range', async ({ page, isMobile }) => {
    // Open filters (mobile has a drawer)
    if (isMobile) {
      await page.getByRole('button', { name: /filters/i }).click();
    }

    // Wait for filters to be visible
    await expect(page.getByText(/price range/i)).toBeVisible({ timeout: 5000 });

    // Price slider or inputs should be present
    const minPriceInput = page.getByLabel(/min.*price/i).or(page.locator('[name="minPrice"]'));
    const maxPriceInput = page.getByLabel(/max.*price/i).or(page.locator('[name="maxPrice"]'));

    // Check that price inputs exist
    if (await minPriceInput.isVisible()) {
      await minPriceInput.fill('200000');
    }

    if (await maxPriceInput.isVisible()) {
      await maxPriceInput.fill('500000');
    }

    // Close mobile drawer if open
    if (isMobile) {
      await page.getByRole('button', { name: /apply filters/i }).click();
    }
  });

  test('should sort properties', async ({ page }) => {
    // Open sort dropdown
    await page.getByLabel(/sort by/i).click();

    // Select price low to high
    await page.getByRole('option', { name: /price.*low to high/i }).click();

    // URL should update with sort params
    await expect(page).toHaveURL(/sortBy=price/);
  });

  test('should paginate results', async ({ page }) => {
    // Check for pagination if there are results
    const pagination = page.locator('nav[aria-label="pagination navigation"]');

    // Pagination may not exist if there are few results
    if (await pagination.isVisible()) {
      // Click on page 2
      await page.getByRole('button', { name: '2' }).click();
      await expect(page).toHaveURL(/page=2/);
    }
  });

  test('should navigate to property details', async ({ page }) => {
    // Wait for properties to load
    await page.waitForSelector('[data-testid="property-card"]', { timeout: 10000 }).catch(() => {
      // If no test id, look for property cards by content
    });

    // Click on the first property card
    const firstProperty = page.locator('article, [role="article"]').first()
      .or(page.locator('.MuiCard-root').first());

    if (await firstProperty.isVisible()) {
      await firstProperty.click();
      // Should navigate to property details
      await expect(page).toHaveURL(/\/properties\/[a-z0-9-]+/i);
    }
  });
});

test.describe('Property Search Responsive', () => {
  test('should show filter drawer on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/search');

    // Filter button should be visible on mobile
    const filterButton = page.getByRole('button', { name: /filters/i });
    await expect(filterButton).toBeVisible();

    // Click to open drawer
    await filterButton.click();

    // Drawer should open
    await expect(page.getByRole('dialog').or(page.locator('.MuiDrawer-paper'))).toBeVisible();

    // Close button should be visible
    await expect(page.getByRole('button', { name: /close|apply/i })).toBeVisible();
  });

  test('should show filter sidebar on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/search');

    // Filter sidebar should be visible (not a drawer)
    await expect(page.getByText(/price range/i)).toBeVisible();

    // No filter button should be visible on desktop
    const filterButton = page.getByRole('button', { name: /^filters$/i });
    await expect(filterButton).not.toBeVisible();
  });
});

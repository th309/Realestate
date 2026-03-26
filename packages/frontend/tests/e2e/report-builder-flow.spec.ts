/**
 * Report Builder Flow — Live E2E Tests
 *
 * Tests the report creation and viewing flow end-to-end using a real
 * enterprise user session. No report generation is triggered — only
 * UI flow and navigation are verified.
 *
 * Prerequisites:
 * - Frontend dev server running on port 3000
 * - Backend dev server running on port 3001
 * - Enterprise user auth fixture present at tests/fixtures/.auth/enterprise-user.json
 */

import { test, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../fixtures/.auth/enterprise-user.json");

test.describe("Report Builder Flow — Live E2E", () => {
  test.use({ storageState: authFile });
  test.setTimeout(60000); // Reports take time to generate

  // --------------------------------------------------------------------------
  // Reports List Page
  // --------------------------------------------------------------------------

  test("reports list page loads with heading and content", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    // The page heading is rendered inside DashboardRefined's header section
    await expect(page.getByRole("heading", { name: /market reports/i })).toBeVisible();

    // Either a report history grid is visible OR the empty state message appears.
    // The empty state renders "No reports yet" inside ReportHistoryRefined.
    const reportCards = page.locator(".report-card-elevated");
    const emptyState = page.getByText("No reports yet");

    const hasCards = await reportCards.count() > 0;
    if (hasCards) {
      await expect(reportCards.first()).toBeVisible();
    } else {
      await expect(emptyState).toBeVisible();
    }
  });

  // --------------------------------------------------------------------------
  // Report Builder (Wizard)
  // --------------------------------------------------------------------------

  test("report builder page loads with wizard UI", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    // The builder wizard is embedded in the /reports page under DashboardRefined.
    // It renders a "Create New Report" section heading and a step indicator.
    await expect(page.getByRole("heading", { name: /create new report/i })).toBeVisible();

    // Step 1 of the wizard asks for user type and template selection
    await expect(page.getByText(/what brings you here today/i)).toBeVisible();

    // The template selection label appears once templates have loaded
    await expect(page.getByText(/select a report template/i)).toBeVisible({ timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // Template (Report Type) Selection
  // --------------------------------------------------------------------------

  test("report type options are visible and one can be selected", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    // Wait for templates to finish loading from the API / defaults
    await expect(page.getByText(/select a report template/i)).toBeVisible({ timeout: 10000 });

    // At minimum the Market Snapshot template is always present (free tier, default)
    const marketSnapshotButton = page.getByRole("button", { name: /market snapshot/i }).first();
    await expect(marketSnapshotButton).toBeVisible();

    // Click to select it
    await marketSnapshotButton.click();

    // After selection the button receives the selected visual state
    // (bg-primary-container border border-primary). We verify the continue
    // button becomes enabled as a proxy for a valid selection.
    const continueButton = page.getByRole("button", { name: /continue/i });
    await expect(continueButton).toBeVisible();
    await expect(continueButton).not.toBeDisabled();
  });

  // --------------------------------------------------------------------------
  // Geography Selection
  // --------------------------------------------------------------------------

  test("can navigate to geography step and search for a location", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    // Wait for templates to load then select Market Snapshot (always accessible)
    await expect(page.getByText(/select a report template/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /market snapshot/i }).first().click();

    // Advance to step 2 (geography)
    await page.getByRole("button", { name: /continue/i }).click();

    // Geography step renders a search input
    const searchInput = page.getByPlaceholder(/enter a state, metro, county, or zip/i);
    await expect(searchInput).toBeVisible();

    // Type a location to trigger search
    await searchInput.fill("Austin");

    // Search results should appear (the dropdown opens)
    const resultsDropdown = page.locator("[data-testid='search-results'], [class*='search-results'], [class*='SearchWidget']").first();

    // Alternatively look for any result item that contains "Austin"
    const austinResult = page.getByText(/austin/i).nth(1); // nth(1) skips the input value itself
    await expect(austinResult).toBeVisible({ timeout: 10000 });
  });

  test("selected geography appears as the primary selection", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    // Select a template
    await expect(page.getByText(/select a report template/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /market snapshot/i }).first().click();

    // Advance to geography step
    await page.getByRole("button", { name: /continue/i }).click();

    const searchInput = page.getByPlaceholder(/enter a state, metro, county, or zip/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Austin");

    // Wait for a result and click it — pick the first result that mentions Austin
    const firstAustinResult = page
      .getByRole("option", { name: /austin/i })
      .or(page.locator("li, [role='listitem'], [class*='result']").filter({ hasText: /austin/i }))
      .first();
    await expect(firstAustinResult).toBeVisible({ timeout: 10000 });
    await firstAustinResult.click();

    // After selection the primary selection card appears showing the geography name
    await expect(page.getByText(/primary selection/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/austin/i)).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Report History
  // --------------------------------------------------------------------------

  test("report history section is visible on the reports page", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    // The Recent Reports heading is always rendered
    await expect(page.getByRole("heading", { name: /recent reports/i })).toBeVisible();

    // Either reports appear or the empty state — both are acceptable outcomes
    const hasReports = await page.locator(".report-card-elevated").count() > 0;
    const hasEmptyState = await page.getByText("No reports yet").isVisible();

    expect(hasReports || hasEmptyState).toBe(true);
  });

  test.describe("when existing reports are present", () => {
    test("at least one report card shows geography name and creation date", async ({ page }) => {
      await page.goto("/reports");
      await page.waitForLoadState("networkidle");

      const reportCards = page.locator(".report-card-elevated");
      const count = await reportCards.count();

      if (count === 0) {
        test.skip(true, "No existing reports — skipping report card verification");
        return;
      }

      const firstCard = reportCards.first();
      await expect(firstCard).toBeVisible();

      // Each card renders a MapPin icon followed by the geography name
      // and a Clock icon followed by a relative date string
      const geographyText = firstCard.locator("svg ~ span, [class*='truncate']").first();
      await expect(geographyText).toBeVisible();

      // The footer of each card contains a Clock icon and date text
      await expect(firstCard.getByText(/today|yesterday|\d+ days? ago|\d+ weeks? ago|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i)).toBeVisible();
    });

    test("clicking a report card navigates to the report viewer", async ({ page }) => {
      await page.goto("/reports");
      await page.waitForLoadState("networkidle");

      const reportCards = page.locator(".report-card-elevated");
      const count = await reportCards.count();

      if (count === 0) {
        test.skip(true, "No existing reports — skipping report viewer navigation test");
        return;
      }

      // Click the first report card (it is a Next.js <Link> wrapping the card)
      await reportCards.first().click();

      // The viewer URL matches /reports/<uuid>
      await expect(page).toHaveURL(/\/reports\/[^/]+$/, { timeout: 15000 });

      // The report viewer renders one of three states:
      // 1. The report hero with a title (ready status)
      // 2. The "Generating Your Report" state (generating status)
      // 3. An error state with "Report not found" (error)
      const reportTitle = page.locator("h1").first();
      const generatingState = page.getByText(/generating your report/i);
      const errorState = page.getByText(/report not found/i);

      await expect(
        reportTitle.or(generatingState).or(errorState)
      ).toBeVisible({ timeout: 20000 });
    });

    test("report viewer header includes navigation and action buttons", async ({ page }) => {
      await page.goto("/reports");
      await page.waitForLoadState("networkidle");

      const reportCards = page.locator(".report-card-elevated");
      const count = await reportCards.count();

      if (count === 0) {
        test.skip(true, "No existing reports — skipping report viewer header test");
        return;
      }

      await reportCards.first().click();
      await expect(page).toHaveURL(/\/reports\/[^/]+$/, { timeout: 15000 });

      // Wait for the viewer to settle — skip if stuck in generating/error state
      const isGenerating = await page.getByText(/generating your report/i).isVisible().catch(() => false);
      const isError = await page.getByText(/report not found/i).isVisible().catch(() => false);

      if (isGenerating || isError) {
        test.skip(true, "Report is generating or errored — skipping header button check");
        return;
      }

      // The sticky header contains Back to Reports link, Ask AI, Share, Print, Download
      await expect(page.getByRole("link", { name: /back to reports/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("button", { name: /download/i })).toBeVisible();
    });
  });
});

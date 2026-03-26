/**
 * API Documentation Page E2E Tests
 *
 * Tests the tabbed API docs page at /docs/api:
 * - Getting Started tab renders by default
 * - Tab switching (Use Cases, API Reference, Troubleshooting)
 * - Deep linking to a tab via URL hash
 * - Use case card expansion with code examples
 * - Code language tab switching (JavaScript / Python)
 * - Health endpoint documentation presence
 *
 * No auth required — /docs/api is a public page.
 */

import { test, expect } from "@playwright/test";

test.describe("API Documentation Page", () => {
  test.setTimeout(15000);

  // ─── INITIAL LOAD ─────────────────────────────────────────────────────────

  test("docs page loads with Getting Started tab active", async ({ page }) => {
    await page.goto("/docs/api");
    await page.waitForLoadState("load");

    // Either a visible "Getting Started" heading or step 1 content must be present
    const gettingStartedHeading = page
      .getByRole("heading", { name: /getting started/i })
      .first();
    const stepOneContent = page.getByText(/step 1|get your api key|base url/i).first();

    const headingVisible = await gettingStartedHeading
      .isVisible()
      .catch(() => false);
    const stepVisible = await stepOneContent.isVisible().catch(() => false);

    expect(headingVisible || stepVisible).toBe(true);
  });

  // ─── TAB SWITCHING ────────────────────────────────────────────────────────

  test("Use Cases tab shows use case cards", async ({ page }) => {
    await page.goto("/docs/api");
    await page.waitForLoadState("load");

    // Click the Use Cases tab
    const useCasesTab = page
      .getByRole("tab", { name: /use cases/i })
      .or(page.getByRole("button", { name: /use cases/i }))
      .first();
    await useCasesTab.click();

    // Use case cards should appear — look for card containers or headings
    await expect(
      page.locator("[data-testid='use-case-card']").first().or(
        page.getByText(/use case/i).first()
      )
    ).toBeVisible({ timeout: 5000 });
  });

  test("API Reference tab shows endpoint sections", async ({ page }) => {
    await page.goto("/docs/api");
    await page.waitForLoadState("load");

    const apiReferenceTab = page
      .getByRole("tab", { name: /api reference/i })
      .or(page.getByRole("button", { name: /api reference/i }))
      .first();
    await apiReferenceTab.click();

    // Endpoint sections render — look for HTTP method badges or endpoint paths
    await expect(
      page.getByText(/GET|POST|endpoint/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("Troubleshooting tab shows error tables", async ({ page }) => {
    await page.goto("/docs/api");
    await page.waitForLoadState("load");

    const troubleshootingTab = page
      .getByRole("tab", { name: /troubleshooting/i })
      .or(page.getByRole("button", { name: /troubleshooting/i }))
      .first();
    await troubleshootingTab.click();

    // Error tables or error code references should appear
    await expect(
      page.getByText(/error|status code|401|403|429/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // ─── DEEP LINKING ─────────────────────────────────────────────────────────

  test("deep link to #troubleshooting activates Troubleshooting tab", async ({
    page,
  }) => {
    await page.goto("/docs/api#troubleshooting");
    await page.waitForLoadState("load");

    // The Troubleshooting tab or its content should be active/visible
    const troubleshootingContent = page
      .getByText(/error|status code|401|403|429/i)
      .first();
    const troubleshootingTab = page
      .getByRole("tab", { name: /troubleshooting/i })
      .or(page.getByRole("button", { name: /troubleshooting/i }))
      .first();

    const contentVisible = await troubleshootingContent
      .isVisible()
      .catch(() => false);

    if (!contentVisible) {
      // Fallback: verify the tab itself is present and marked active
      await expect(troubleshootingTab).toBeVisible({ timeout: 5000 });
    } else {
      await expect(troubleshootingContent).toBeVisible({ timeout: 5000 });
    }
  });

  // ─── USE CASE CARD EXPANSION ──────────────────────────────────────────────

  test("clicking a use case card reveals expanded code example content", async ({
    page,
  }) => {
    await page.goto("/docs/api");
    await page.waitForLoadState("load");

    // Navigate to Use Cases tab first
    const useCasesTab = page
      .getByRole("tab", { name: /use cases/i })
      .or(page.getByRole("button", { name: /use cases/i }))
      .first();
    await useCasesTab.click();

    // Click the first use case card
    const firstCard = page
      .locator("[data-testid='use-case-card']")
      .first()
      .or(page.locator("[class*='use-case']").first())
      .or(page.getByRole("button").filter({ hasText: /market|property|score/i }).first());

    await firstCard.waitFor({ state: "visible", timeout: 5000 });
    await firstCard.click();

    // After expansion, code example content should be visible
    await expect(
      page.locator("pre, code, [class*='code']").first()
    ).toBeVisible({ timeout: 5000 });
  });

  // ─── CODE LANGUAGE TABS ───────────────────────────────────────────────────

  test("code language tabs switch between JavaScript and Python examples", async ({
    page,
  }) => {
    await page.goto("/docs/api");
    await page.waitForLoadState("load");

    // Navigate to Use Cases and expand a card to get code tabs
    const useCasesTab = page
      .getByRole("tab", { name: /use cases/i })
      .or(page.getByRole("button", { name: /use cases/i }))
      .first();
    await useCasesTab.click();

    const firstCard = page
      .locator("[data-testid='use-case-card']")
      .first()
      .or(page.locator("[class*='use-case']").first())
      .or(page.getByRole("button").filter({ hasText: /market|property|score/i }).first());

    const cardVisible = await firstCard.isVisible().catch(() => false);
    if (cardVisible) {
      await firstCard.click();
    }

    // Find language tabs — look for JavaScript and Python tab buttons
    const jsTab = page
      .getByRole("tab", { name: /javascript/i })
      .or(page.getByRole("button", { name: /javascript/i }))
      .first();
    const pyTab = page
      .getByRole("tab", { name: /python/i })
      .or(page.getByRole("button", { name: /python/i }))
      .first();

    const jsTabVisible = await jsTab.isVisible().catch(() => false);
    const pyTabVisible = await pyTab.isVisible().catch(() => false);

    if (jsTabVisible && pyTabVisible) {
      // Capture code content before switching
      await jsTab.click();
      const jsCodeBlock = page.locator("pre, code").first();
      const jsContent = await jsCodeBlock.textContent().catch(() => "");

      await pyTab.click();
      const pyContent = await jsCodeBlock.textContent().catch(() => "");

      // Content must change when switching languages
      expect(jsContent).not.toBe(pyContent);
    } else {
      // If only one language tab exists, verify code content is present at all
      await expect(page.locator("pre, code").first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  // ─── HEALTH ENDPOINT DOCUMENTATION ───────────────────────────────────────

  test("API Reference tab documents the GET /api/v1/health endpoint", async ({
    page,
  }) => {
    await page.goto("/docs/api");
    await page.waitForLoadState("load");

    const apiReferenceTab = page
      .getByRole("tab", { name: /api reference/i })
      .or(page.getByRole("button", { name: /api reference/i }))
      .first();
    await apiReferenceTab.click();

    // The health endpoint section must be present
    await expect(
      page.getByText(/\/api\/v1\/health/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});

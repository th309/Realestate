/**
 * Enterprise Org Admin — Live Production E2E Tests
 * NO MOCKS. Hits the real production site.
 */
import { test, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../fixtures/.auth/enterprise-user.json");

test.describe("Enterprise Org Admin — Live E2E", () => {
  test.use({ storageState: authFile });
  test.setTimeout(30000);

  const ORG_SLUG = "test-broker2";
  const BASE = `/org/${ORG_SLUG}/admin`;

  // Helper: main content area (excludes sidebar)
  const main = (page: any) => page.locator("main");

  // ─── DASHBOARD ──────────────────────────────────────

  test("dashboard loads with cards and settings", async ({ page }) => {
    await page.goto(BASE);
    await expect(
      main(page).getByRole("heading", { name: "MEMBERS", exact: true }),
    ).toBeVisible({
      timeout: 20000,
    });
    await expect(main(page).getByText("ORGANIZATION SETTINGS")).toBeVisible();
  });

  // ─── MEMBERS ────────────────────────────────────────

  test("members page renders header and invite button", async ({ page }) => {
    await page.goto(`${BASE}/members`);
    await expect(
      main(page).getByRole("heading", { name: /Members/i }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      page.getByRole("button", { name: /invite member/i }),
    ).toBeVisible();
  });

  test("invite dialog has name fields", async ({ page }) => {
    await page.goto(`${BASE}/members`);
    await page
      .getByRole("button", { name: /invite member/i })
      .click({ timeout: 20000 });
    await expect(page.getByPlaceholder(/first name/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByPlaceholder(/last name/i)).toBeVisible();
  });

  // ─── BILLING ────────────────────────────────────────

  test("billing page renders", async ({ page }) => {
    await page.goto(`${BASE}/billing`);
    await expect(
      page.getByRole("button", { name: /manage billing|set up billing/i }),
    ).toBeVisible({ timeout: 20000 });
  });

  // ─── BRANDING ───────────────────────────────────────

  test("branding page renders", async ({ page }) => {
    await page.goto(`${BASE}/branding`);
    await expect(
      main(page).getByRole("heading", { name: "Branding", exact: true }),
    ).toBeVisible({ timeout: 20000 });
  });

  test("branding has phone field", async ({ page }) => {
    await page.goto(`${BASE}/branding`);
    await expect(page.locator('input[type="tel"]')).toBeVisible({
      timeout: 20000,
    });
  });

  test("branding has font selection", async ({ page }) => {
    await page.goto(`${BASE}/branding`);
    await expect(page.locator("select").first()).toBeVisible({
      timeout: 20000,
    });
  });

  test("branding has custom domain", async ({ page }) => {
    await page.goto(`${BASE}/branding`);
    await expect(page.getByText(/custom domain/i).first()).toBeVisible({
      timeout: 20000,
    });
  });

  // ─── API KEYS ───────────────────────────────────────

  test("api keys page renders", async ({ page }) => {
    await page.goto(`${BASE}/api-keys`);
    await expect(
      main(page).getByRole("heading", { name: /API Keys/i }),
    ).toBeVisible({ timeout: 20000 });
  });

  // ─── EMBEDS ─────────────────────────────────────────

  test("embeds page renders", async ({ page }) => {
    await page.goto(`${BASE}/embeds`);
    await expect(
      main(page).getByRole("heading", { name: /Embed/i }),
    ).toBeVisible({ timeout: 20000 });
  });

  // ─── AUDIT LOG ──────────────────────────────────────

  test("audit page renders with filters", async ({ page }) => {
    await page.goto(`${BASE}/audit`);
    await expect(page.locator("select").first()).toBeVisible({
      timeout: 20000,
    });
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  // ─── NAVIGATION SWEEP ──────────────────────────────

  test("all 7 admin pages load without crash", async ({ page }) => {
    const urls = [
      BASE,
      `${BASE}/members`,
      `${BASE}/billing`,
      `${BASE}/branding`,
      `${BASE}/api-keys`,
      `${BASE}/embeds`,
      `${BASE}/audit`,
    ];
    const crashes: string[] = [];
    for (const url of urls) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const globalError = page.locator('text="An unexpected error occurred."');
      if (await globalError.isVisible({ timeout: 2000 }).catch(() => false)) {
        crashes.push(url);
      }
    }
    expect(crashes).toEqual([]);
  });
});

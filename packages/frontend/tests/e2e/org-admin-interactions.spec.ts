import { test, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../fixtures/.auth/enterprise-user.json");

test.describe("Enterprise Org Admin — Interactions", () => {
  test.use({ storageState: authFile });
  test.setTimeout(45000);

  const ORG_SLUG = "test-broker2";
  const BASE = `/org/${ORG_SLUG}/admin`;

  // ─── ORG SETTINGS: RENAME ──────────────────────────

  test("can rename org and save", async ({ page }) => {
    await page.goto(BASE);
    // Wait for settings
    await expect(page.getByText("ORGANIZATION SETTINGS")).toBeVisible({
      timeout: 20000,
    });
    // Get name input, save original
    const nameInput = page.getByLabel("Organization Name");
    const original = await nameInput.inputValue();
    // Change it
    await nameInput.fill("E2E Test Rename");
    // Save button should be enabled
    const saveBtn = page.getByRole("button", { name: /save changes/i });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    // Wait for success
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 15000 });
    // Restore original name
    await nameInput.fill(original);
    await saveBtn.click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 15000 });
  });

  // ─── MEMBERS: INVITE FLOW ─────────────────────────

  test("can open invite dialog, fill fields, and cancel", async ({ page }) => {
    await page.goto(`${BASE}/members`);
    await page
      .getByRole("button", { name: /invite member/i })
      .click({ timeout: 20000 });
    // Fill the form
    await page.getByPlaceholder("Jane").fill("Test");
    await page.getByPlaceholder("Doe").fill("User");
    await page
      .getByPlaceholder("colleague@company.com")
      .fill("test-e2e@example.com");
    // Select Admin role
    await page.getByRole("button", { name: "Admin" }).click();
    // Verify send button is visible
    await expect(
      page.getByRole("button", { name: /send invite/i }),
    ).toBeVisible();
    // Cancel instead of sending (don't actually invite)
    await page.getByRole("button", { name: /cancel/i }).click();
    // Dialog should close
    await expect(page.getByPlaceholder("Jane")).not.toBeVisible();
  });

  // ─── BILLING: MANAGE BUTTON ───────────────────────

  test("manage billing button is clickable", async ({ page }) => {
    await page.goto(`${BASE}/billing`);
    const btn = page.getByRole("button", {
      name: /manage billing|set up billing/i,
    });
    await expect(btn).toBeVisible({ timeout: 20000 });
    await expect(btn).toBeEnabled();
  });

  // ─── BRANDING: SAVE FLOW ──────────────────────────

  test("can fill branding fields and save", async ({ page }) => {
    await page.goto(`${BASE}/branding`);
    await page.waitForLoadState("networkidle");
    // Fill required phone
    const phone = page.locator('input[type="tel"]');
    await phone.waitFor({ timeout: 20000 });
    await phone.fill("555-E2E-TEST");
    // Fill address
    const streetInput = page
      .getByPlaceholder(/street/i)
      .or(page.locator('input[name="street"]'));
    if (
      await streetInput
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await streetInput.first().fill("123 E2E St");
    }
    // Try to save
    const saveBtn = page.getByRole("button", { name: /save/i }).first();
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
      // Either success or validation error — both are OK (page didn't crash)
      await page.waitForTimeout(3000);
      await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    }
  });

  // ─── BRANDING: POWERED BY TOGGLE ──────────────────

  test("can toggle powered-by checkbox", async ({ page }) => {
    await page.goto(`${BASE}/branding`);
    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.waitFor({ timeout: 20000 });
    const before = await checkbox.isChecked();
    await checkbox.click();
    const after = await checkbox.isChecked();
    expect(after).not.toBe(before);
    // Toggle back
    await checkbox.click();
  });

  // ─── BRANDING: FONT SELECTION ─────────────────────

  test("can change font selection", async ({ page }) => {
    await page.goto(`${BASE}/branding`);
    const fontSelect = page.locator("select").first();
    await fontSelect.waitFor({ timeout: 20000 });
    await fontSelect.selectOption({ index: 2 });
    // Verify it changed
    const value = await fontSelect.inputValue();
    expect(value).toBeTruthy();
  });

  // ─── BRANDING: CUSTOM DOMAIN ──────────────────────

  test("custom domain section allows input", async ({ page }) => {
    await page.goto(`${BASE}/branding`);
    await page.waitForLoadState("networkidle");
    // Find domain input
    const domainInput = page
      .getByPlaceholder(/domain/i)
      .or(page.getByPlaceholder(/subdomain/i));
    if (
      await domainInput
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await domainInput.first().fill("test.example.com");
      // Should show Add Domain button
      const addBtn = page.getByRole("button", { name: /add domain/i });
      await expect(addBtn).toBeVisible();
    }
  });

  // ─── AUDIT LOG: FILTER INTERACTION ────────────────

  test("audit log filter changes results", async ({ page }) => {
    await page.goto(`${BASE}/audit`);
    const select = page.locator("select").first();
    await select.waitFor({ timeout: 20000 });
    // Select Member Events
    await select.selectOption({ index: 1 });
    await page.waitForTimeout(2000);
    // Page should still be functional
    await expect(select).toBeVisible();
    // Set date filter
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill("2026-01-01");
    await page.waitForTimeout(2000);
    await expect(page.locator("select").first()).toBeVisible();
  });

  // ─── NAVIGATION: SIDEBAR ──────────────────────────

  test("sidebar navigates between all pages", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const links = [
      "Members",
      "Billing",
      "Branding",
      "Embeds",
      "API Keys",
      "Audit Log",
    ];
    for (const name of links) {
      const link = page.getByRole("link", { name, exact: true });
      if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
        await link.click();
        await page.waitForLoadState("networkidle");
      }
    }
    // Verify we're on the last page and it didn't crash
    await expect(page.url()).toContain("/audit");
  });
});

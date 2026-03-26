/**
 * Account Settings E2E Tests
 *
 * Tests the /account page for an enterprise org member, covering:
 * - Hero banner with display name and tier badge
 * - Org billing message (replaces Manage Billing button for org members)
 * - Personal info, preferences, security, and notifications sections
 *
 * Prerequisites:
 * - Frontend dev server running on port 3000
 * - Enterprise user auth fixture at tests/fixtures/.auth/enterprise-user.json
 */

import { test, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../fixtures/.auth/enterprise-user.json");

test.describe("Account Settings — Enterprise Org Member", () => {
  test.use({ storageState: authFile });
  test.setTimeout(20000);

  // ─── HERO BANNER ────────────────────────────────────────────────────────────

  test("account page loads with hero banner showing display name and tier badge", async ({
    page,
  }) => {
    await page.goto("/account");

    // Page should finish loading — wait for the hero banner to appear.
    // The HeroBanner renders the user's display name and tier label.
    // The enterprise tier badge label is "ENTERPRISE".
    await expect(page.getByText("ENTERPRISE").first()).toBeVisible({
      timeout: 15000,
    });

    // The hero banner also shows a member-since date, confirming it rendered
    await expect(page.getByText(/member since/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  // ─── ORG MEMBER BILLING MESSAGE ─────────────────────────────────────────────

  test("org member sees org-managed billing message instead of Manage Billing button", async ({
    page,
  }) => {
    await page.goto("/account");

    // For enterprise users who belong to an org, the account page shows:
    // "Your subscription is managed by your organization."
    // The PlanUsageSection (with its Manage Billing button) is hidden.
    await expect(
      page.getByText(/managed by your organization/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // Confirm the regular "Manage Billing" / "Manage Subscription" button
    // is NOT shown (billing is handled at org level)
    await expect(
      page.getByRole("button", { name: /manage billing|manage subscription/i }),
    ).not.toBeVisible();
  });

  // ─── PERSONAL INFORMATION ───────────────────────────────────────────────────

  test("personal info section is visible with name and email fields", async ({
    page,
  }) => {
    await page.goto("/account");

    // PersonalInfoSection heading
    await expect(page.getByText(/personal info/i).first()).toBeVisible({
      timeout: 15000,
    });

    // The section renders editable fields — display name and email
    await expect(page.getByText(/display name/i).first()).toBeVisible({
      timeout: 15000,
    });

    await expect(page.getByText(/email/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  // ─── PREFERENCES ────────────────────────────────────────────────────────────

  test("preferences section is visible", async ({ page }) => {
    await page.goto("/account");

    // PreferencesSection renders with a "Preferences" heading
    await expect(page.getByText(/preferences/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  // ─── SECURITY SECTION ───────────────────────────────────────────────────────

  test("account security section is visible", async ({ page }) => {
    await page.goto("/account");

    // AccountSecuritySection renders with "Security" or "Account & Security"
    // heading — match either variant
    await expect(page.getByText(/security/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  // ─── NOTIFICATIONS SECTION ──────────────────────────────────────────────────

  test("notifications section is visible", async ({ page }) => {
    await page.goto("/account");

    // NotificationsSection heading
    await expect(page.getByText(/notifications/i).first()).toBeVisible({
      timeout: 15000,
    });
  });
});

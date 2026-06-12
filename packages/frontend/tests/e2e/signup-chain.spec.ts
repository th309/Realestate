/**
 * Signup Chain E2E — backlog item #1 (email path; Google OAuth deferred).
 *
 * Drives LIVE pages (no mocks). The "completes email signup" test creates a
 * REAL auth user with a unique disposable email and deletes it afterward.
 *
 * Prereqs: frontend on :3000, backend on :3001, .env.test with
 * NEXT_PUBLIC_SUPABASE_URL + a service/secret key.
 */
import { test, expect } from "@playwright/test";
import {
  findUserIdByEmail,
  hasSignupCompleteEvent,
  deleteUser,
  getSignupOtp,
} from "./helpers/supabase-admin";

test.describe("Signup chain", () => {
  test.setTimeout(90_000);

  // ---- Fix A: ToS no longer silently disables ----
  test("sign-up buttons are enabled with ToS unchecked and show an inline error", async ({
    page,
  }) => {
    await page.goto("/auth/sign-up");
    const createBtn = page.getByRole("button", { name: /create account/i });
    await expect(createBtn).toBeEnabled();
    await page.getByLabel(/^email$/i).fill("not-submitted@example.com");
    await page.locator("#password").fill("StrongPass1");
    await page.locator("#confirm-password").fill("StrongPass1");
    await createBtn.click();
    await expect(
      page.getByText(/must accept the terms of service/i),
    ).toBeVisible();
  });

  // ---- Fix B/C: pricing anonymous ----
  test("anonymous Free card says Sign up free, not Current Plan", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await expect(
      page.getByRole("link", { name: /sign up free/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/current plan/i)).toHaveCount(0);
  });

  test("anonymous Pro CTA routes to sign-up", async ({ page }) => {
    await page.goto("/pricing");
    // Bottom CTA uses the pricing A/B copy; match the Pro card button instead.
    await page
      .getByRole("button", { name: /get pro|go pro|upgrade|start/i })
      .first()
      .click();
    await page.waitForURL(/\/auth\/sign-up/, { timeout: 10_000 });
  });

  // ---- Fix D: report dead-end ----
  test("anonymous report generate shows a signup CTA, not a dead-end", async ({
    page,
  }) => {
    await page.goto("/reports");
    // Select a market via the builder's search widget.
    await page.getByRole("heading", { name: /select your market/i }).waitFor();
    const search = page.getByPlaceholder(/search/i).first();
    await search.click();
    await search.fill("Austin");
    await page
      .getByText(/Austin/i)
      .first()
      .click();
    await page.getByRole("button", { name: /generate report/i }).click();
    await expect(page.getByText(/sign up free to generate your/i)).toBeVisible({
      timeout: 10_000,
    });
    const cta = page.getByRole("link", { name: /sign up free/i });
    await expect(cta).toHaveAttribute(
      "href",
      /\/auth\/sign-up\?redirect=.*reports/,
    );
    // No dead-end error string anywhere.
    await expect(page.getByText(/you must be signed in/i)).toHaveCount(0);
  });

  // ---- Email signup happy path + DB assertions (creates + deletes a real user) ----
  test("email signup completes via OTP and logs signup_complete", async ({
    page,
  }) => {
    const email = `piq-e2e-${Date.now()}@example.com`;
    const password = `Zq9${Date.now()}Lr`;
    try {
      await page.goto("/auth/sign-up");
      await page.getByLabel(/^email$/i).fill(email);
      await page.locator("#password").fill(password);
      await page.locator("#confirm-password").fill(password);
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: /create account/i }).click();

      // OTP entry screen
      await expect(
        page.getByRole("heading", { name: /enter your code/i }),
      ).toBeVisible({ timeout: 20_000 });

      // Read a valid code (re-mints for the existing unconfirmed user).
      const otp = await getSignupOtp(email, password);
      expect(otp).toMatch(/^\d{6}$/);
      await page.locator('input[autocomplete="one-time-code"]').fill(otp);
      await page.getByRole("button", { name: /^verify$/i }).click();

      // Lands in the app (tour/map, or pricing if a checkout intent existed).
      await page.waitForURL(/\/(tour|map|pricing)/, { timeout: 25_000 });

      const userId = await findUserIdByEmail(email);
      expect(userId).toBeTruthy();
      await expect
        .poll(() => hasSignupCompleteEvent(userId as string), {
          timeout: 30_000,
        })
        .toBe(true);
    } finally {
      const id = await findUserIdByEmail(email);
      if (id) await deleteUser(id);
    }
  });

  test("wrong OTP shows an inline error", async ({ page }) => {
    const email = `piq-e2e-${Date.now()}@example.com`;
    const password = `Zq9${Date.now()}Lr`;
    try {
      await page.goto("/auth/sign-up");
      await page.getByLabel(/^email$/i).fill(email);
      await page.locator("#password").fill(password);
      await page.locator("#confirm-password").fill(password);
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: /create account/i }).click();
      await expect(
        page.getByRole("heading", { name: /enter your code/i }),
      ).toBeVisible({ timeout: 20_000 });

      // Derive a guaranteed-wrong 6-digit code from the real one (avoids the
      // ~1-in-1,000,000 chance a hardcoded "000000" is actually valid).
      const real = await getSignupOtp(email, password);
      const wrong = real === "000000" ? "111111" : "000000";
      await page.locator('input[autocomplete="one-time-code"]').fill(wrong);
      await page.getByRole("button", { name: /^verify$/i }).click();
      await expect(page.getByText(/didn't match/i)).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      const id = await findUserIdByEmail(email);
      if (id) await deleteUser(id);
    }
  });
});

/**
 * E2E — auto-kill criteria settings round-trip against the REAL backend + DB.
 *
 * Proves the full feature loop end-to-end (no mocks):
 *   1. A deal that trips the DSCR floor auto-kill renders the banner.
 *   2. The banner's "Edit criteria" button deep-links to the drawer's
 *      Auto-Kill tab; disabling the DSCR floor rule + Save issues a real PUT
 *      /api/analyzer/thresholds/:strategy to the real Supabase (authenticated).
 *   3. On reload the backend resolves the saved setting into grading, so the
 *      DSCR kill line is gone.
 *   4. The setting persists: reopening the drawer via the second entry point
 *      (Advanced Assumptions → "⚙ Auto-kill & grading criteria") shows the
 *      DSCR switch still off.
 *
 * Runtime notes:
 *  - Desktop chromium only. Invoke with `--project=chromium`; the analyzer
 *    input panel lives inside a mobile sheet on mobile-chrome, so the
 *    Advanced-Assumptions entry point differs there.
 *  - baseURL is pinned to the LOCAL dev stack here (not the repo default, which
 *    `.env.test` points at production). This test mutates per-user threshold
 *    state and needs the local backend to resolve the saved settings, so it
 *    must run against :3000 + :3001 + the shared cloud Supabase. The committed
 *    enterprise-user auth fixture is a localhost session, matching this.
 *  - Run without the `setup` project dependency (`--no-deps`) so it reuses the
 *    existing localhost session instead of re-authenticating.
 *
 * The account's saved thresholds are REAL DB state — afterEach unconditionally
 * resets them so a failed assertion can't leave the DSCR rule disabled.
 */

import { test, expect, type Page } from "@playwright/test";
import path from "path";

// Same enterprise fixture analyzer.spec.ts uses — enterprise tier clears the
// analyzer Pro gate and carries a JWT so thresholds GET/PUT/DELETE hit the DB.
const enterpriseUserAuthFile = path.join(
  __dirname,
  "../fixtures/.auth/enterprise-user.json",
);

// 123 S Market St, Frederick MD reliably trips the DSCR floor auto-kill
// (DSCR ≈ 0.35) once RentCast data populates.
const ANALYZER_URL =
  "/analyzer?address=123%20S%20Market%20St%2C%20Frederick%2C%20MD%2021701";

/**
 * Ensure the deal is loaded and gradable with the DSCR auto-kill visible.
 * The ?address= deep link auto-fetches RentCast on load; if the cache has
 * expired the deal loads without comps, so fetch once and wait again.
 */
async function ensureDscrAutoKill(page: Page): Promise<void> {
  await expect(page.locator("[data-grading-result-panel]")).toBeVisible({
    timeout: 30_000,
  });
  const dscrKill = page.locator(
    '[data-auto-kill-item][data-code="DSCR_BELOW_1"]',
  );
  if ((await dscrKill.count()) === 0) {
    const fetchBtn = page
      .getByRole("button", { name: /Fetch property \+ comps from RentCast/i })
      .first();
    if (await fetchBtn.isVisible().catch(() => false)) {
      await fetchBtn.click();
    }
  }
  await expect(dscrKill.first()).toBeVisible({ timeout: 30_000 });
}

/**
 * The dev-only DevToolbar is a fixed z-50 bottom bar that overlaps the drawer
 * footer and intercepts pointer events on Save / Reset. Remove any current
 * instance and inject a persistent <head> style so any re-rendered instance
 * stays hidden. Call after every navigation (goto / reload) before touching
 * the drawer footer.
 */
async function killDevToolbar(page: Page): Promise<void> {
  await page.evaluate(() => {
    document
      .querySelectorAll('[data-testid="dev-toolbar"]')
      .forEach((el) => el.remove());
    if (!document.getElementById("kill-devtoolbar")) {
      const style = document.createElement("style");
      style.id = "kill-devtoolbar";
      style.textContent =
        '[data-testid="dev-toolbar"]{display:none !important;pointer-events:none !important}';
      document.head.appendChild(style);
    }
  });
}

test.describe("auto-kill criteria settings (real backend + DB)", () => {
  test.use({
    storageState: enterpriseUserAuthFile,
    baseURL: "http://localhost:3000",
  });

  // Restore engine defaults for the account no matter how the test exits, so a
  // failed run can't leave the DSCR floor rule disabled in the shared DB.
  test.afterEach(async ({ page }) => {
    try {
      await page.goto(ANALYZER_URL);
      await page
        .locator("[data-input-panel]")
        .first()
        .waitFor({ timeout: 20_000 });
      await killDevToolbar(page);
      // "Assumptions & criteria → Edit criteria" row is always visible in the
      // input panel (the old Advanced Assumptions dropdown is gone).
      await page
        .getByTestId("autokill-grading-customize")
        .first()
        .click({ timeout: 10_000 });
      const drawer = page.getByTestId("customize-thresholds-drawer");
      await drawer.getByTestId("reset-all-button").click({ timeout: 10_000 });
      await expect(drawer.getByTestId("save-banner-success")).toBeVisible({
        timeout: 10_000,
      });
    } catch {
      // Cleanup is best-effort; never fail the run on a cleanup hiccup.
    }
  });

  test("disable DSCR rule → save → regrade drops the DSCR kill → persists", async ({
    page,
  }) => {
    await page.goto(ANALYZER_URL);
    await killDevToolbar(page);

    // Deal loads with the DSCR auto-kill visible.
    await ensureDscrAutoKill(page);

    // Banner button opens the drawer directly on the Auto-Kill tab.
    await page.getByTestId("autokill-edit-criteria").click();
    const drawer = page.getByTestId("customize-thresholds-drawer");
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("tab", { name: "Auto-Kill", selected: true }),
    ).toBeVisible();

    // Disable the DSCR floor rule (accessible name is "DSCR floor rule"),
    // driving it OFF deterministically regardless of starting state.
    const dscrSwitch = drawer.getByRole("switch", { name: /DSCR floor/i });
    await expect(dscrSwitch).toBeVisible();
    if ((await dscrSwitch.getAttribute("aria-checked")) === "true") {
      await dscrSwitch.click();
    }
    await expect(dscrSwitch).toHaveAttribute("aria-checked", "false");

    // Save — real PUT to the real DB — and wait for the success banner.
    await drawer.getByTestId("save-button").click();
    await expect(drawer.getByTestId("save-banner-success")).toBeVisible({
      timeout: 15_000,
    });
    // Close. Right after a save the drawer can still read as dirty while the
    // react-query refetch is in flight, in which case the close click shows a
    // discard-confirm strip — the save already succeeded, so discarding the
    // (identical) draft is safe and deterministic.
    await drawer.getByRole("button", { name: /close drawer/i }).click();
    const discard = drawer.getByRole("button", { name: /^discard$/i });
    if (await discard.isVisible().catch(() => false)) {
      await discard.click();
    }
    await expect(drawer).toHaveCount(0);

    // Regrade: reload re-fires the grade with the saved setting applied
    // server-side — the DSCR kill line must be gone.
    await page.reload();
    await killDevToolbar(page);
    await expect(page.locator("[data-grading-result-panel]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.locator('[data-auto-kill-item][data-code="DSCR_BELOW_1"]'),
    ).toHaveCount(0, { timeout: 15_000 });

    // Persisted: reopen the drawer via the second entry point ("Assumptions &
    // criteria → Edit criteria" row, which opens on the Assumptions tab), hop
    // to the Auto-Kill tab, and confirm the switch is still off.
    await page.getByTestId("autokill-grading-customize").first().click();
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("tab", { name: "Assumptions", selected: true }),
    ).toBeVisible();
    await drawer.getByRole("tab", { name: "Auto-Kill" }).click();
    await expect(
      drawer.getByRole("switch", { name: /DSCR floor/i }),
    ).toHaveAttribute("aria-checked", "false");
  });
});

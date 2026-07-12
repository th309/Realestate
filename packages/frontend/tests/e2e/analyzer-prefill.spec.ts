/**
 * E2E tests for the address-prefill feature in the Deal Analyzer (backlog #5).
 *
 * When the user selects an address from AddressAutocomplete, the backend
 * returns an AnalyzerPrefillBundle and the frontend applies it to every
 * input field + renders a FieldProvenance stamp (source · as of · grade).
 * Insurance and vacancy are estimates; they show the literal "Estimate" text
 * rather than a real source + date.
 *
 * Spec: docs/superpowers/specs/2026-06-14-address-prefilled-analyzer-design.md §12
 *
 * Layout notes (same as analyzer.spec.ts):
 *  - InputPanel lives in a sticky <aside> on desktop and inside the FAB
 *    drawer on mobile. Both copies may be in the DOM at the same time.
 *  - Scope provenance / field assertions to `aside` to pin to the
 *    desktop-visible copy and avoid strict-mode violations.
 *  - Use `.first()` wherever a selector might match both copies.
 *  - Desktop chromium only (same reasoning as analyzer.spec.ts).
 */

import { test, expect } from "@playwright/test";
import path from "path";

const enterpriseUserAuthFile = path.join(
  __dirname,
  "../fixtures/.auth/enterprise-user.json",
);

// ---------------------------------------------------------------------------
// 1. Anonymous / free-tier prefill + stamps
// ---------------------------------------------------------------------------
test.describe("/analyzer address-prefill (no auth)", () => {
  test("selecting an address prefills rent and shows provenance stamps", async ({
    page,
  }) => {
    await page.goto("/analyzer");

    // The empty-state copy is the user-facing entry message (§12 AC).
    await expect(
      page.getByText(/2-minute analysis, zero spreadsheet/i),
    ).toBeVisible();

    // Drive the address autocomplete with a real Austin address.
    await page
      .getByRole("textbox", { name: /Address search/i })
      .fill("2502 E 5th St Austin");
    await page
      .getByText(/Austin, TX/)
      .first()
      .click();

    // Monthly Rent (rentMonthly) must be prefilled — input should be non-empty.
    // NumField renders the value via formatDisplay (toLocaleString), so we
    // check that the input value is not empty rather than a specific number.
    const rentInput = page
      .locator("aside")
      .getByRole("textbox", { name: /Monthly Rent/i });
    await expect(rentInput).not.toHaveValue("");

    // A FieldProvenance stamp should appear for at least the rent field.
    // For geo-layer data the stamp reads "source · as of YYYY-MM-DD".
    await expect(
      page.locator("aside").getByText(/as of/i).first(),
    ).toBeVisible();

    // ConfidenceDisplay emits aria-label="<level> confidence: <pct>%" on its
    // trigger button (a real <button> as of the touch-fallback fix, so the
    // accessible role is "button", not "img").
    await expect(
      page
        .locator("aside")
        .getByRole("button", { name: /confidence:/i })
        .first(),
    ).toBeVisible();

    // Insurance is always an estimate (0.55%/yr × price, no third-party source).
    // The FieldProvenance renders the literal text "Estimate" (italic, muted).
    await expect(
      page.locator("aside").getByText("Estimate").first(),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. API-match assertion: UI rent == prefill bundle value
// ---------------------------------------------------------------------------
test.describe("/analyzer address-prefill — API data match (no auth)", () => {
  test("rent input matches /api/analyzer/prefill bundle value for ZIP 78702", async ({
    page,
    request,
  }) => {
    // Fetch the prefill bundle directly to get the canonical rent value.
    const res = await request.get("/api/analyzer/prefill?zip=78702");
    expect(res.ok()).toBeTruthy();
    const bundle = await res.json();
    const apiRentValue: number | null = bundle?.fields?.rentMonthly?.value;
    // If the API returned no value the prefill feature has nothing to assert —
    // skip gracefully rather than giving a false pass.
    test.skip(
      apiRentValue == null,
      "API returned no rentMonthly for 78702 — live stack may lack data",
    );

    await page.goto("/analyzer");
    // Type a 78702 address so the autocomplete resolves to that ZIP.
    await page
      .getByRole("textbox", { name: /Address search/i })
      .fill("2502 E 5th St Austin");
    await page
      .getByText(/Austin, TX/)
      .first()
      .click();

    const rentInput = page
      .locator("aside")
      .getByRole("textbox", { name: /Monthly Rent/i });
    await expect(rentInput).not.toHaveValue("");

    // NumField.formatDisplay uses toLocaleString("en-US") for integers and
    // applies comma-grouping for thousands. Normalise both sides by stripping
    // non-numeric characters before comparing.
    const displayedValue = await rentInput.inputValue();
    const displayedNumeric = Number(displayedValue.replace(/[^\d.]/g, ""));
    expect(displayedNumeric).toBe(apiRentValue);
  });
});

// ---------------------------------------------------------------------------
// 3. Divergence flag: manual override at 2× triggers warning
// ---------------------------------------------------------------------------
test.describe("/analyzer address-prefill — divergence flag (no auth)", () => {
  test("overriding rent by 2× shows divergence note", async ({ page }) => {
    await page.goto("/analyzer");
    await page
      .getByRole("textbox", { name: /Address search/i })
      .fill("2502 E 5th St Austin");
    await page
      .getByText(/Austin, TX/)
      .first()
      .click();

    const rentInput = page
      .locator("aside")
      .getByRole("textbox", { name: /Monthly Rent/i });
    await expect(rentInput).not.toHaveValue("");

    // Read the prefilled value and compute a 2× override.
    const prefillDisplay = await rentInput.inputValue();
    const prefillNumeric = Number(prefillDisplay.replace(/[^\d.]/g, ""));
    // Guard: if prefill is 0 / empty the divergence check won't fire.
    test.skip(
      !prefillNumeric || prefillNumeric <= 0,
      "prefill rent is 0 or unavailable — cannot test divergence",
    );

    const override = Math.round(prefillNumeric * 2);
    // Clear the field and type the 2× value.
    await rentInput.fill(String(override));
    // Blur to trigger the onChange handler.
    await rentInput.press("Tab");

    // FieldProvenance renders the divergence note when |new − baseline|/baseline > 0.30.
    // The text is: "{N}× the market value" (data source) or "{N}× the estimate".
    await expect(
      page
        .locator("aside")
        .getByText(/×\s+the\s+(market value|estimate)/i)
        .first(),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. All-tiers render check
// ---------------------------------------------------------------------------
test.describe("/analyzer address-prefill — anonymous render check", () => {
  test("anonymous user sees entry copy on /analyzer (no crash)", async ({
    page,
  }) => {
    await page.goto("/analyzer");
    // The feature ships the empty-state entry message for all tiers.
    await expect(
      page.getByText(/2-minute analysis, zero spreadsheet/i),
    ).toBeVisible();
  });
});

test.describe("/analyzer address-prefill — Pro/Enterprise stamps", () => {
  // This describe uses the enterprise storage state (satisfies Pro gate).
  test.use({ storageState: enterpriseUserAuthFile });

  test("Pro user sees provenance stamp after address selection", async ({
    page,
  }) => {
    await page.goto("/analyzer");
    await page
      .getByRole("textbox", { name: /Address search/i })
      .fill("2502 E 5th St Austin");
    await page
      .getByText(/Austin, TX/)
      .first()
      .click();

    // For Pro the parcel layer (RentCast) runs — tax should be real data.
    // The FieldProvenance span for a data field renders: "{source} · as of {date}"
    // RentCast is the source label defined in the backend prefill bundle.
    //
    // NOTE: this assertion requires live RentCast quota and a valid Pro user
    // session in the test environment. If RentCast quota is exhausted the
    // backend silently falls back to the geo layer and the source label will
    // NOT be "RentCast". The test is therefore written as a soft-check that
    // the stamp is present and contains *some* source text; it does not hard-
    // assert "RentCast" to avoid flakiness in quota-constrained environments.
    await expect(
      page.locator("aside").getByText(/as of/i).first(),
    ).toBeVisible();

    // Confidence grade chip must be present (aria-label from ConfidenceDisplay,
    // rendered as a real <button> so it's role="button" not role="img").
    await expect(
      page
        .locator("aside")
        .getByRole("button", { name: /confidence:/i })
        .first(),
    ).toBeVisible();
  });
});

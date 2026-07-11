import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MomentumSignalsSection } from "./MomentumSignalsSection";

describe("MomentumSignalsSection", () => {
  it("scales percent signals by 100, days by 1, and renders formatted values", () => {
    const zScores = {
      zhvi_yoy: 0.031,
      zhvi_mom_3m: 0.012,
      median_days_on_market: 48,
      price_reduced_share: 0.18,
    };

    const { container } = render(
      <MomentumSignalsSection metroName="Austin, TX" zScores={zScores} />,
    );

    const text = container.textContent || "";

    // Verify scaled percent values (fraction × 100)
    // 0.031 * 100 = 3.1 → "+3.1%"
    // 0.012 * 100 = 1.2 → "+1.2%"
    // 0.18 * 100 = 18.0 → "+18.0%"
    expect(text).toContain("+3.1%");
    expect(text).toContain("+1.2%");
    expect(text).toContain("+18.0%");

    // Verify days value (no scaling)
    // 48 * 1 = 48 → "48 days"
    expect(text).toContain("48 days");

    // Guard against missing or double scaling
    expect(text).not.toContain("0.0%"); // Would indicate unscaled percent
    expect(text).not.toContain("4800"); // Would indicate double scaling of days
  });

  it("omits rows with missing numeric keys, rendering only available signals", () => {
    const zScores = {
      zhvi_yoy: 0.05,
      // Other keys missing or undefined
    };

    const { container } = render(
      <MomentumSignalsSection metroName="Denver, CO" zScores={zScores} />,
    );

    const text = container.textContent || "";

    // Should render the one available signal
    // 0.05 * 100 = 5.0 → "+5.0%"
    expect(text).toContain("+5.0%");

    // Should have exactly one signal card (plus heading)
    const cards = container.querySelectorAll(
      "div.rounded-xl.border.border-outline-variant",
    );
    expect(cards).toHaveLength(1);
  });

  it("returns null and renders nothing when no valid numeric keys are present", () => {
    const zScores = {}; // Empty

    const { container } = render(
      <MomentumSignalsSection metroName="Seattle, WA" zScores={zScores} />,
    );

    // Component should return null, so container should be empty
    expect(container.firstChild).toBeNull();
  });

  it("filters out non-numeric values and only renders numeric signals", () => {
    const zScores = {
      zhvi_yoy: 0.02,
      zhvi_mom_3m: undefined,
      median_days_on_market: null,
      price_reduced_share: "not a number", // Non-numeric, will be filtered
    } as Record<string, any>;

    const { container } = render(
      <MomentumSignalsSection metroName="Phoenix, AZ" zScores={zScores} />,
    );

    const text = container.textContent || "";

    // Should only render the numeric zhvi_yoy signal
    // 0.02 * 100 = 2.0 → "+2.0%"
    expect(text).toContain("+2.0%");

    // Should have exactly one signal card
    const cards = container.querySelectorAll(
      "div.rounded-xl.border.border-outline-variant",
    );
    expect(cards).toHaveLength(1);
  });

  it("includes the metro name in the section heading", () => {
    const zScores = {
      zhvi_yoy: 0.01,
    };

    const { container } = render(
      <MomentumSignalsSection metroName="Miami, FL" zScores={zScores} />,
    );

    const text = container.textContent || "";
    expect(text).toContain("What Drives the Miami, FL Outlook");
  });
});

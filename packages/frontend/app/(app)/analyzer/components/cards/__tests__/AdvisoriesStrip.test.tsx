import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { AdvisoryResult } from "@propertyiq/analyzer-core";
import { AdvisoriesStrip } from "../AdvisoriesStrip";

const advisories: AdvisoryResult[] = [
  { key: "one_percent_rule", label: "1% Rule", value: 0.011, status: "pass" },
  { key: "grm", label: "GRM", value: 9.0, status: "marginal" },
  { key: "opex_ratio", label: "OpEx Ratio", value: 0.55, status: "fail" },
];

describe("AdvisoriesStrip", () => {
  it("renders one pill per advisory", () => {
    const { container } = render(<AdvisoriesStrip advisories={advisories} />);
    expect(container.querySelectorAll("[data-advisory-pill]").length).toBe(3);
  });

  it("reflects status in aria-label and data-status", () => {
    const { container } = render(<AdvisoriesStrip advisories={advisories} />);
    const pills = container.querySelectorAll("[data-advisory-pill]");
    expect(pills[0].getAttribute("data-status")).toBe("pass");
    expect(pills[0].getAttribute("aria-label")).toContain("status: pass");
    expect(pills[1].getAttribute("data-status")).toBe("marginal");
    expect(pills[1].getAttribute("aria-label")).toContain("status: marginal");
    expect(pills[2].getAttribute("data-status")).toBe("fail");
    expect(pills[2].getAttribute("aria-label")).toContain("status: fail");
  });

  it("formats 1% rule as percent with 2 decimals", () => {
    const { container } = render(<AdvisoriesStrip advisories={advisories} />);
    const onePct = container.querySelector(
      '[data-advisory-key="one_percent_rule"]',
    );
    expect(onePct?.textContent).toContain("1.10%");
  });

  it("formats GRM with 1 decimal and opex as integer percent", () => {
    const { container } = render(<AdvisoriesStrip advisories={advisories} />);
    const grm = container.querySelector('[data-advisory-key="grm"]');
    const opex = container.querySelector('[data-advisory-key="opex_ratio"]');
    expect(grm?.textContent).toContain("9.0");
    expect(opex?.textContent).toContain("55%");
  });
});

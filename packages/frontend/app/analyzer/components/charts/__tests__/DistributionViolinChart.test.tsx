import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DistributionViolinChart } from "../DistributionViolinChart";

describe("DistributionViolinChart", () => {
  const values = Array.from({ length: 50 }, () => 200 + Math.random() * 100);

  it("renders violin shape paths (non-degenerate)", () => {
    const { container } = render(
      <DistributionViolinChart values={values} yourValue={250} />,
    );
    const paths = container.querySelectorAll("path[data-violin-shape]");
    expect(paths.length).toBeGreaterThanOrEqual(1);
    paths.forEach((p) =>
      expect(p.getAttribute("d")?.length).toBeGreaterThan(20),
    );
  });

  it("renders your-value marker line", () => {
    const { container } = render(
      <DistributionViolinChart values={values} yourValue={250} />,
    );
    expect(container.querySelector("line[data-your-value]")).toBeTruthy();
  });
});

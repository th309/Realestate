import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiStrip } from "../KpiStrip";

describe("KpiStrip", () => {
  it("renders the five KPI labels", () => {
    const agg = {
      price: [400000, 420000],
      rent: [1800, 1850],
      inventory: [10000, 11000],
      dom: [40, 38],
      score: [55, 57],
    };
    render(<KpiStrip agg={agg} monthIndex={1} windowStart={0} />);
    [
      "Median value",
      "Median rent",
      "Active listings",
      "Avg days on mkt",
      "Avg PIQ score",
    ].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
  });
});

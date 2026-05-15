import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ScoreRingChart } from "../ScoreRingChart";

describe("ScoreRingChart", () => {
  it("renders bg + score arcs", () => {
    const { container } = render(<ScoreRingChart score={75} />);
    expect(container.querySelector("path[data-score-bg]")).toBeTruthy();
    expect(container.querySelector("path[data-score-value]")).toBeTruthy();
  });

  it("renders one breakdown arc per spec", () => {
    const { container } = render(
      <ScoreRingChart
        score={75}
        breakdown={[
          { label: "Cashflow", weight: 0.4, color: "primary" },
          { label: "Appreciation", weight: 0.3, color: "positive" },
          { label: "Risk", weight: 0.3, color: "caution" },
        ]}
      />,
    );
    expect(
      container.querySelectorAll("path[data-score-breakdown]").length,
    ).toBe(3);
  });

  it("displays the score number", () => {
    const { getByText } = render(<ScoreRingChart score={82} />);
    expect(getByText("82")).toBeTruthy();
  });
});

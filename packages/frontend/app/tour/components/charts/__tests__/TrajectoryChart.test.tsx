import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TrajectoryChart } from "../TrajectoryChart";

const target = {
  label: "Charlotte",
  values: [100, 105, 110, 115, 120],
  color: "var(--md-primary)",
};
const metro = {
  label: "Charlotte Metro",
  values: [98, 102, 104, 108, 112],
  color: "var(--md-tertiary)",
};

describe("TrajectoryChart", () => {
  it("renders one polyline per series", () => {
    const { container } = render(<TrajectoryChart series={[target, metro]} />);
    expect(container.querySelectorAll("polyline").length).toBe(2);
  });

  it("renders the empty state when series is empty", () => {
    const { getByText } = render(<TrajectoryChart series={[]} />);
    expect(getByText(/limited data/i)).toBeInTheDocument();
  });

  it("renders the empty state when first series has no values", () => {
    const { getByText } = render(
      <TrajectoryChart
        series={[{ label: "X", values: [], color: "var(--md-primary)" }]}
      />,
    );
    expect(getByText(/limited data/i)).toBeInTheDocument();
  });

  it("renders the legend with each series label", () => {
    const { getByText } = render(<TrajectoryChart series={[target, metro]} />);
    expect(getByText("Charlotte")).toBeInTheDocument();
    expect(getByText("Charlotte Metro")).toBeInTheDocument();
  });

  it("renders gridlines (3 dashed horizontal lines)", () => {
    const { container } = render(<TrajectoryChart series={[target]} />);
    const lines = container.querySelectorAll("line[stroke-dasharray]");
    expect(lines.length).toBe(3);
  });

  it("uses semantic colors — gridlines do not hardcode hex", () => {
    const { container } = render(<TrajectoryChart series={[target]} />);
    const html = container.innerHTML;
    // The hardcoded #E0E0E0 from the plan should NOT appear
    expect(html).not.toMatch(/#E0E0E0/i);
  });
});

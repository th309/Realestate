import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Trajectory } from "../Trajectory";

vi.mock("../../charts/TrajectoryChart", () => ({
  TrajectoryChart: (props: {
    series: { label: string; values: number[]; color: string }[];
  }) => (
    <div
      data-testid="trajectory-chart"
      data-series-count={props.series.length}
      data-labels={props.series.map((s) => s.label).join("|")}
    />
  ),
}));

const series = [
  { label: "Charlotte", values: [100, 105, 110], yoy: 8.5 },
  { label: "Charlotte Metro", values: [98, 102, 106], yoy: 6.2 },
  { label: "North Carolina", values: [99, 100, 102], yoy: 4.1 },
];

describe("Trajectory", () => {
  it("renders limited-data branch", () => {
    render(<Trajectory series={[]} limitedData={true} />);
    expect(screen.getByText(/trajectory unavailable/i)).toBeInTheDocument();
  });

  it("falls back to the limited branch when series is empty", () => {
    render(<Trajectory series={[]} limitedData={false} />);
    expect(screen.getByText(/trajectory unavailable/i)).toBeInTheDocument();
  });

  it("renders one chart line per series with yoy-formatted labels", () => {
    render(<Trajectory series={series} limitedData={false} />);
    const chart = screen.getByTestId("trajectory-chart");
    expect(chart.getAttribute("data-series-count")).toBe("3");
    expect(chart.getAttribute("data-labels")).toContain("Charlotte (+8.5%)");
  });
});

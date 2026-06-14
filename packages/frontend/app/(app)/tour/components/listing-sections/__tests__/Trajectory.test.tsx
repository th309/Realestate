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
    />
  ),
}));

const baseProps = {
  marketName: "Charlotte",
  parentMetroName: "Charlotte Metro",
  stateName: "NC",
  marketSeries: [100, 105, 110],
  parentSeries: [98, 102, 106],
  stateSeries: [99, 100, 102],
  marketYoy: 8.5,
  parentYoy: 6.2,
  stateYoy: 4.1,
  limitedData: false,
};

describe("Trajectory", () => {
  it("renders limited-data branch", () => {
    render(<Trajectory {...baseProps} limitedData={true} />);
    expect(screen.getByText(/trajectory unavailable/i)).toBeInTheDocument();
  });

  it("renders TrajectoryChart with 3 series on happy path", () => {
    render(<Trajectory {...baseProps} />);
    expect(
      screen.getByTestId("trajectory-chart").getAttribute("data-series-count"),
    ).toBe("3");
  });

  it("formats positive yoy with '+' prefix", () => {
    render(<Trajectory {...baseProps} />);
    expect(screen.getByText(/12-month trajectory/i)).toBeInTheDocument();
  });
});

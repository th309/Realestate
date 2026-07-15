import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const useTimeSeriesData = vi.fn((..._args: unknown[]) => ({
  data: [
    { date: "2021-01-01", value: 400000 },
    { date: "2022-01-01", value: 455000 },
  ],
  isLoading: false,
  error: null,
}));
vi.mock("@/lib/data", () => ({
  useTimeSeriesData: (...args: unknown[]) => useTimeSeriesData(...args),
}));
// Stub the heavy D3 chart; surface the props we assert on.
vi.mock("@/app/graphs/components/AnimatedTimeSeriesChart", () => ({
  AnimatedTimeSeriesChart: (props: {
    metricId: string;
    primaryData: unknown[];
  }) => (
    <div
      data-testid="ts-chart"
      data-metric={props.metricId}
      data-points={props.primaryData.length}
    />
  ),
}));

import { MarketPrimaryChart } from "../MarketPrimaryChart";

describe("MarketPrimaryChart", () => {
  it("renders the chart for the selected metric with fetched points", () => {
    render(
      <MarketPrimaryChart
        geoType="metro"
        geoId="12420"
        marketName="Austin, TX"
        metricId="home_value"
      />,
    );
    const chart = screen.getByTestId("ts-chart");
    expect(chart.getAttribute("data-metric")).toBe("home_value");
    expect(chart.getAttribute("data-points")).toBe("2");
  });

  it("defaults to the 5Y timeframe (60 months) for the data hook", () => {
    render(
      <MarketPrimaryChart
        geoType="metro"
        geoId="12420"
        marketName="Austin, TX"
        metricId="home_value"
      />,
    );
    const lastCall = useTimeSeriesData.mock.calls.at(-1)!;
    expect(lastCall[0]).toBe("home_value");
    expect(lastCall[3]).toEqual({ historyMonths: 60 });
  });

  it("re-requests a shorter window when the 1Y timeframe pill is clicked", () => {
    render(
      <MarketPrimaryChart
        geoType="metro"
        geoId="12420"
        marketName="Austin, TX"
        metricId="home_value"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "1Y" }));
    const lastCall = useTimeSeriesData.mock.calls.at(-1)!;
    expect(lastCall[3]).toEqual({ historyMonths: 12 });
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const useTimeSeriesData = vi.fn((..._args: unknown[]) => ({
  data: [
    { date: "2021-01-01", value: 400000 },
    { date: "2022-01-01", value: 455000 },
  ],
  isLoading: false,
  error: null as string | null,
  gated: false,
  tierRequired: undefined as string | undefined,
}));
const metricHasTimeSeries = vi.fn((_id: string) => true);
vi.mock("@/lib/data", () => ({
  useTimeSeriesData: (...args: unknown[]) => useTimeSeriesData(...args),
  metricHasTimeSeries: (id: string) => metricHasTimeSeries(id),
  getMetricConfig: (id: string) => ({ title: id }),
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

  it("defaults to the 5Y timeframe (startDate 5 years back) for the data hook", () => {
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
    const options = lastCall[3] as { startDate: string; enabled: boolean };
    const fiveYearsAgo = String(new Date().getUTCFullYear() - 5);
    expect(options.startDate.slice(0, 4)).toBe(fiveYearsAgo);
    expect(options.enabled).toBe(true);
  });

  it("requests an earlier startDate when the 1Y timeframe pill is clicked", () => {
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
    const options = lastCall[3] as { startDate: string };
    const oneYearAgo = String(new Date().getUTCFullYear() - 1);
    expect(options.startDate.slice(0, 4)).toBe(oneYearAgo);
  });

  it("shows a no-history message instead of a blank chart for a metric with no time series", () => {
    metricHasTimeSeries.mockReturnValueOnce(false);
    render(
      <MarketPrimaryChart
        geoType="metro"
        geoId="12420"
        marketName="Austin, TX"
        metricId="months_of_supply"
      />,
    );
    expect(screen.getByTestId("chart-no-history")).toBeTruthy();
    expect(screen.queryByTestId("ts-chart")).toBeNull();
    // Doesn't fetch a chart it can never render.
    const lastCall = useTimeSeriesData.mock.calls.at(-1)!;
    expect((lastCall[3] as { enabled: boolean }).enabled).toBe(false);
  });

  it("shows an upgrade message instead of a blank chart for a gated metric", () => {
    useTimeSeriesData.mockReturnValueOnce({
      data: [],
      isLoading: false,
      error: null,
      gated: true,
      tierRequired: "pro",
    });
    render(
      <MarketPrimaryChart
        geoType="metro"
        geoId="12420"
        marketName="Austin, TX"
        metricId="cap_rate"
      />,
    );
    expect(screen.getByTestId("chart-gated")).toBeTruthy();
    expect(screen.getByText(/requires the pro plan/i)).toBeTruthy();
    expect(screen.queryByTestId("ts-chart")).toBeNull();
  });
});

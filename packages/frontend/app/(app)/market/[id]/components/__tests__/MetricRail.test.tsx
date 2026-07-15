import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Stub the self-fetching gauge (it calls useScoreData → network).
vi.mock("@/app/components/scoring/ScoreGaugeWidget", () => ({
  ScoreGaugeWidget: () => <div data-testid="score-gauge" />,
}));
// MetricTitle reads metric config; render its id plainly for the test.
vi.mock("@/app/components/MetricTitle", () => ({
  MetricTitle: ({ metricId }: { metricId: string }) => <span>{metricId}</span>,
}));

import { MetricRail } from "../MetricRail";

const card = (formattedValue: string, value: number) => ({
  value,
  formattedValue,
  percentChange: 2.0,
  direction: "up" as const,
  isLoading: false,
  date: "2026-05-31",
  source: "zillow",
  sourceGeoId: "12420",
  sourceGeoLevel: "metro" as const,
  isInherited: false,
  isFallback: false,
});

const cards = {
  home_value: card("$455K", 455000),
  rent_index: card("$1,850", 1850),
};

describe("MetricRail", () => {
  it("renders the score gauge and a row per metric", () => {
    render(
      <MetricRail
        geoType="metro"
        geoId="12420"
        cards={cards}
        metricIds={["home_value", "rent_index"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    expect(screen.getByTestId("score-gauge")).toBeTruthy();
    expect(screen.getByText("$455K")).toBeTruthy();
    expect(screen.getByText("$1,850")).toBeTruthy();
  });

  it("exposes the tour target on the score gauge wrapper", () => {
    const { container } = render(
      <MetricRail
        geoType="metro"
        geoId="12420"
        cards={cards}
        metricIds={["home_value"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    expect(
      container.querySelector('[data-tour="propertyiq-score"]'),
    ).toBeTruthy();
  });

  it("calls onSelectMetric with the clicked metric id", () => {
    const onSelect = vi.fn();
    render(
      <MetricRail
        geoType="metro"
        geoId="12420"
        cards={cards}
        metricIds={["home_value", "rent_index"]}
        selectedMetricId="home_value"
        onSelectMetric={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /rent_index/i }));
    expect(onSelect).toHaveBeenCalledWith("rent_index");
  });

  it("marks the selected row as pressed", () => {
    render(
      <MetricRail
        geoType="metro"
        geoId="12420"
        cards={cards}
        metricIds={["home_value", "rent_index"]}
        selectedMetricId="home_value"
        onSelectMetric={() => {}}
      />,
    );
    const selected = screen.getByRole("button", { name: /home_value/i });
    expect(selected.getAttribute("aria-pressed")).toBe("true");
  });
});

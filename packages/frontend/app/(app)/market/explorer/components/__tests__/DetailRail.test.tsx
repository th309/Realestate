import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DetailRail } from "../DetailRail";

const base = {
  name: "Austin",
  sub: "Metro · CBSA 12420",
  score: 61,
  confidence: {
    level: "b" as const,
    percentage: 75,
    metricsAvailable: 6,
    metricsTotal: 8,
    freshnessInDays: 20,
  },
  inherited: null,
  stats: [
    { label: "Median value", value: "$455K", color: "var(--md-on-surface)" },
  ],
  metricLabel: "PropertyIQ Score",
  metricValueNow: "61",
  railSpark: [50, 55, 61],
  railMarker: 2,
  isPinned: false,
  hasDrill: true,
  drillLabel: "Explore 4 counties in Austin ↓",
};

describe("DetailRail", () => {
  it("renders the selected market, score gauge, and pins on click", () => {
    const onTogglePin = vi.fn();
    render(
      <DetailRail
        {...base}
        onTogglePin={onTogglePin}
        onDrill={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(screen.getByText("Austin")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: /PropertyIQ Score 61/i }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Compare/i }));
    expect(onTogglePin).toHaveBeenCalled();
  });
});

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

  it("renders an unavailable placeholder instead of a fabricated score when score is null", () => {
    render(
      <DetailRail
        {...base}
        score={null}
        onTogglePin={() => {}}
        onDrill={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(
      screen.getByRole("img", { name: /Score unavailable/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("img", { name: /PropertyIQ Score/i })).toBeNull();
  });

  it("renders InheritedBadge with the source geography when inherited is set", () => {
    render(
      <DetailRail
        {...base}
        inherited={{
          sourceType: "metro",
          sourceName: "Austin-Round Rock Metro",
        }}
        onTogglePin={() => {}}
        onDrill={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(
      screen.getByRole("img", {
        name: /Inherited from Metro: Austin-Round Rock Metro/i,
      }),
    ).toBeTruthy();
  });

  it("renders every stat tile in the stats grid", () => {
    const stats = [
      { label: "Median value", value: "$455K", color: "var(--md-on-surface)" },
      { label: "YoY appreciation", value: "+5.2%", color: "var(--md-primary)" },
      { label: "Median rent", value: "$1,850", color: "var(--md-on-surface)" },
      { label: "Days on market", value: "32", color: "var(--md-on-surface)" },
      { label: "Price reduced", value: "18%", color: "var(--md-error)" },
      { label: "Population", value: "2.3M", color: "var(--md-on-surface)" },
    ];
    render(
      <DetailRail
        {...base}
        stats={stats}
        onTogglePin={() => {}}
        onDrill={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    stats.forEach((s) => {
      expect(screen.getByText(s.label)).toBeTruthy();
      expect(screen.getByText(s.value)).toBeTruthy();
    });
  });

  it("shows the drill button and fires onDrill when hasDrill is true", () => {
    const onDrill = vi.fn();
    render(
      <DetailRail
        {...base}
        hasDrill
        onDrill={onDrill}
        onTogglePin={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: base.drillLabel }));
    expect(onDrill).toHaveBeenCalled();
  });

  it("hides the drill button when hasDrill is false", () => {
    render(
      <DetailRail
        {...base}
        hasDrill={false}
        onTogglePin={() => {}}
        onDrill={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: base.drillLabel })).toBeNull();
  });

  it("fires onOpenDashboard when the CTA is clicked", () => {
    const onOpenDashboard = vi.fn();
    render(
      <DetailRail
        {...base}
        onTogglePin={() => {}}
        onDrill={() => {}}
        onOpenDashboard={onOpenDashboard}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Open full market dashboard/i }),
    );
    expect(onOpenDashboard).toHaveBeenCalled();
  });
});

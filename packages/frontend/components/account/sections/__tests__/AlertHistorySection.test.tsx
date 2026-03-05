import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AlertHistorySection } from "../AlertHistorySection";

const MOCK_ENTRIES = [
  {
    id: "alert-1",
    alert_id: "a1",
    triggered_at: "2025-03-01T12:00:00Z",
    metric_value: 450000,
    alert: {
      name: "Austin Price Alert",
      condition: {
        geography_name: "Austin, TX",
        metric: "home_value",
        direction: "up",
      },
    },
  },
  {
    id: "alert-2",
    alert_id: "a2",
    triggered_at: "2025-02-15T08:00:00Z",
    metric_value: 3.2,
    alert: {
      name: "Tampa Unemployment",
      condition: {
        geography_name: "Tampa, FL",
        metric: "unemployment_rate",
        direction: "down",
      },
    },
  },
];

describe("AlertHistorySection", () => {
  it("shows Pro upgrade gate for free tier", () => {
    render(<AlertHistorySection entries={[]} isLoading={false} tier="free" />);
    expect(screen.getByText("Alerts are a Pro feature")).toBeInTheDocument();
    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument();
  });

  it("shows Manage Alerts link for pro tier", () => {
    render(
      <AlertHistorySection
        entries={MOCK_ENTRIES}
        isLoading={false}
        tier="pro"
      />,
    );
    expect(screen.getByText("Manage Alerts")).toBeInTheDocument();
  });

  it("renders alert market names", () => {
    render(
      <AlertHistorySection
        entries={MOCK_ENTRIES}
        isLoading={false}
        tier="pro"
      />,
    );
    expect(screen.getByText("Austin, TX")).toBeInTheDocument();
    expect(screen.getByText("Tampa, FL")).toBeInTheDocument();
  });

  it("renders metric names with underscores replaced by spaces", () => {
    render(
      <AlertHistorySection
        entries={MOCK_ENTRIES}
        isLoading={false}
        tier="pro"
      />,
    );
    expect(screen.getByText(/home value/)).toBeInTheDocument();
    expect(screen.getByText(/unemployment rate/)).toBeInTheDocument();
  });

  it("renders empty state when no entries for paid tier", () => {
    render(<AlertHistorySection entries={[]} isLoading={false} tier="pro" />);
    expect(screen.getByText("No alerts triggered yet")).toBeInTheDocument();
  });

  it("renders loading skeletons when loading", () => {
    const { container } = render(
      <AlertHistorySection entries={[]} isLoading={true} tier="pro" />,
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockGetUsage = vi.fn();
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({
    getUsage: mockGetUsage,
  }),
}));

vi.mock("@/lib/data", () => ({
  usePricingTiers: () => ({ tiers: [], loading: false }),
  buildPriceLookup: () => ({}),
  getBillingPortalUrl: vi.fn(),
}));

vi.mock("../../PlanComparison", () => ({
  PlanComparison: ({ activeTier }: any) => (
    <div data-testid="plan-comparison">PlanComparison: {activeTier}</div>
  ),
}));

vi.mock("../../CancelSubscriptionDialog", () => ({
  CancelSubscriptionDialog: () => (
    <div data-testid="cancel-dialog">CancelDialog</div>
  ),
}));

import { PlanUsageSection } from "../PlanUsageSection";

describe("PlanUsageSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsage.mockReturnValue(null);
  });

  it("renders current plan label for free tier", () => {
    render(
      <PlanUsageSection
        tier="free"
        trial={null}
        watchlistCount={2}
        alertCount={0}
      />,
    );
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("$0")).toBeInTheDocument();
  });

  it("renders trial badge when trial is active", () => {
    render(
      <PlanUsageSection
        tier="pro"
        trial={{ active: true, daysRemaining: 7, tier: "pro" }}
        watchlistCount={0}
        alertCount={0}
      />,
    );
    expect(screen.getByText(/Trial/)).toBeInTheDocument();
    expect(screen.getByText(/7 days left/)).toBeInTheDocument();
  });

  it("renders four usage meters", () => {
    render(
      <PlanUsageSection
        tier="pro"
        trial={null}
        watchlistCount={3}
        alertCount={2}
      />,
    );
    expect(screen.getByText("Reports This Month")).toBeInTheDocument();
    expect(screen.getByText("AI Analyses")).toBeInTheDocument();
    expect(screen.getByText("Saved Markets")).toBeInTheDocument();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
  });

  it("shows watchlist count from props", () => {
    render(
      <PlanUsageSection
        tier="pro"
        trial={null}
        watchlistCount={7}
        alertCount={0}
      />,
    );
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows Compare Plans button that toggles plan comparison", () => {
    render(
      <PlanUsageSection
        tier="free"
        trial={null}
        watchlistCount={0}
        alertCount={0}
      />,
    );

    // Plan comparison should be hidden initially
    expect(screen.queryByTestId("plan-comparison")).not.toBeInTheDocument();

    // Click Compare Plans
    fireEvent.click(screen.getByText("Compare Plans"));

    // Now it should be visible
    expect(screen.getByTestId("plan-comparison")).toBeInTheDocument();
  });

  it("shows Upgrade to Pro button for free tier", () => {
    render(
      <PlanUsageSection
        tier="free"
        trial={null}
        watchlistCount={0}
        alertCount={0}
      />,
    );
    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument();
  });

  it("shows Manage Billing button for pro tier", () => {
    render(
      <PlanUsageSection
        tier="pro"
        trial={null}
        watchlistCount={0}
        alertCount={0}
      />,
    );
    expect(screen.getByText("Manage Billing")).toBeInTheDocument();
  });

  it("shows cancel subscription dialog for pro tier", () => {
    render(
      <PlanUsageSection
        tier="pro"
        trial={null}
        watchlistCount={0}
        alertCount={0}
      />,
    );
    expect(screen.getByTestId("cancel-dialog")).toBeInTheDocument();
  });

  it("does not show cancel dialog for free tier", () => {
    render(
      <PlanUsageSection
        tier="free"
        trial={null}
        watchlistCount={0}
        alertCount={0}
      />,
    );
    expect(screen.queryByTestId("cancel-dialog")).not.toBeInTheDocument();
  });
});

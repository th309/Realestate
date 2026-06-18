import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Configurable mocks (pure-logic test: gating + which features render + dismiss).
let mockEntitlements: { tier: string; trial: unknown };
let mockState: Record<string, unknown> | null;
const mockDismiss = vi.fn();

vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => mockEntitlements,
}));

vi.mock("@/lib/data", () => ({
  fetchOnboardingState: vi.fn(),
  dismissBeaconTask: (...args: unknown[]) => {
    mockDismiss(...args);
    return Promise.resolve();
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mockState }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: Record<string, unknown>) =>
    React.createElement(
      "a",
      { href: typeof href === "string" ? href : "#", ...props },
      children as React.ReactNode,
    ),
}));

import { FeatureDiscoveryNudge } from "../FeatureDiscoveryNudge";

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    onboarding_checklist: [],
    dismissed_beacons: [],
    usage_stats: { markets_viewed: 1, scores_checked: 1, reports_generated: 0 },
    ...overrides,
  };
}

describe("FeatureDiscoveryNudge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements = {
      tier: "free",
      trial: { active: true, daysRemaining: 13, tier: "pro" },
    };
    mockState = makeState();
  });

  it("shows the top 2 un-tried Pro features for an active-trial user", () => {
    render(<FeatureDiscoveryNudge />);
    expect(
      screen.getByText("Make the most of your Pro trial"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Generate an AI market report"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Screen markets by your criteria"),
    ).toBeInTheDocument();
    // Capped at 2 — the third candidate must not render.
    expect(
      screen.queryByText("Analyze a specific property"),
    ).not.toBeInTheDocument();
  });

  it("renders nothing for a free user with no active trial", () => {
    mockEntitlements = { tier: "free", trial: null };
    const { container } = render(<FeatureDiscoveryNudge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when already dismissed (server-persisted)", () => {
    mockState = makeState({ dismissed_beacons: ["map-try-next"] });
    const { container } = render(<FeatureDiscoveryNudge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when every Pro feature has been tried", () => {
    mockState = makeState({
      onboarding_checklist: [
        "read_report",
        "screen_markets",
        "analyze_property",
        "compare_markets",
        "connect_claude",
      ],
      usage_stats: {
        markets_viewed: 5,
        scores_checked: 5,
        reports_generated: 3,
      },
    });
    const { container } = render(<FeatureDiscoveryNudge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("skips a feature once its completion signal is present", () => {
    // A generated report should drop "Generate an AI market report" and surface
    // the next two un-tried candidates instead.
    mockState = makeState({
      usage_stats: {
        markets_viewed: 1,
        scores_checked: 1,
        reports_generated: 2,
      },
    });
    render(<FeatureDiscoveryNudge />);
    expect(
      screen.queryByText("Generate an AI market report"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Screen markets by your criteria"),
    ).toBeInTheDocument();
    expect(screen.getByText("Analyze a specific property")).toBeInTheDocument();
  });

  it("persists dismissal via dismissBeaconTask and hides on dismiss", () => {
    render(<FeatureDiscoveryNudge />);
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(mockDismiss).toHaveBeenCalledWith("map-try-next");
    expect(
      screen.queryByText("Make the most of your Pro trial"),
    ).not.toBeInTheDocument();
  });
});

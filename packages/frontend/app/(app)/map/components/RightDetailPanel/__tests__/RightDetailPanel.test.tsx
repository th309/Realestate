// packages/frontend/app/(app)/map/components/RightDetailPanel/__tests__/RightDetailPanel.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { RightDetailPanel } from "../RightDetailPanel";
import type { SelectedGeography } from "../../../types";

// Stub every child so this test exercises only the desktop-gating wiring
// (RightDetailPanel + useModalHistory), not the full render tree.
vi.mock("@/app/map/hooks/useMarketFactorsData", () => ({
  useMarketFactorsData: () => ({ data: {}, loading: false, error: null }),
}));
vi.mock("@/app/map/components/RightDetailPanel/AmbientInsight", () => ({
  AmbientInsight: () => null,
}));
vi.mock("@/app/map/components/RightDetailPanel/MetricSelectorModal", () => ({
  MetricSelectorModal: () => null,
}));
vi.mock("@/app/map/components/RightDetailPanel/MarketSnapshot", () => ({
  MarketSnapshot: () => null,
}));
vi.mock("@/app/map/components/RightDetailPanel/QuickActions", () => ({
  QuickActions: () => null,
}));
vi.mock("@/app/map/components/sidebar-components", () => ({
  SidebarScoreCard: () => null,
}));

const geography = {
  id: "12345",
  name: "Test County",
  geoLevel: "county",
  value: null,
} as unknown as SelectedGeography;

// tests/setup.ts stubs window.matchMedia globally to always report
// matches:false — override it per test to simulate the real desktop/mobile
// breakpoint result useModalHistory's gating depends on.
function mockMatchMedia(desktopQueryMatches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(min-width: 768px)" ? desktopQueryMatches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("RightDetailPanel — back-to-close is mobile-only", () => {
  it("pushes a history entry when open below the md breakpoint (mobile overlay presentation)", () => {
    mockMatchMedia(false);
    const pushSpy = vi.spyOn(window.history, "pushState");

    render(
      <RightDetailPanel
        isOpen
        onClose={() => {}}
        geography={geography}
        geoLevel="county"
      />,
    );

    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("does not push a history entry when open at/above the md breakpoint (docked-sidebar presentation)", () => {
    mockMatchMedia(true);
    const pushSpy = vi.spyOn(window.history, "pushState");

    render(
      <RightDetailPanel
        isOpen
        onClose={() => {}}
        geography={geography}
        geoLevel="county"
      />,
    );

    expect(pushSpy).not.toHaveBeenCalled();
  });
});

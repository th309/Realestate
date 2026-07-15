import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Force the non-AI path (no entitlement) so no network happens and the
// deterministic summary renders synchronously.
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ canAccess: () => false }),
}));

import { MarketHeadline } from "../MarketHeadline";

const cards = {
  home_value: {
    value: 455000,
    formattedValue: "$455K",
    percentChange: 3.1,
    direction: "up" as const,
    isLoading: false,
    date: "2026-05-31",
    source: "zillow",
    sourceGeoId: "12420",
    sourceGeoLevel: "metro" as const,
    isInherited: false,
    isFallback: false,
  },
};

describe("MarketHeadline (non-AI fallback path)", () => {
  it("renders the deterministic momentum framing when ai_insights is off", () => {
    render(
      <MarketHeadline
        geoType="metro"
        geoId="12420"
        marketName="Austin, TX"
        view="homebuyer"
        cards={cards}
        score={62}
        scoreGrade="B"
      />,
    );
    expect(screen.getByText(/firming momentum/i)).toBeTruthy();
    expect(screen.getByText(/PropertyIQ Score of 62/i)).toBeTruthy();
  });
});

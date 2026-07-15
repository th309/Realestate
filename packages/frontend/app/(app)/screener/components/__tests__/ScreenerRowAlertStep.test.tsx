import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ tier: "pro" }),
}));
vi.mock("@/lib/data", () => ({
  createAlert: vi.fn().mockResolvedValue({ id: "al-1" }),
  formatGeoDisplayName: (s: string) => s,
}));
vi.mock("@/lib/analytics/tracker", () => ({ trackEvent: () => {} }));

import { ScreenerRowAlertStep } from "../ScreenerRowAlertStep";

const row = {
  geo_level: "metro",
  region_id: "12420",
  region_name: "Austin, TX",
  score: 72,
  median_price: 450000,
  cap_rate: 5.1,
  months_of_supply: 2.3,
  overvalued_pct: 8.4,
} as any;

describe("ScreenerRowAlertStep", () => {
  it("shows metric chips and opens the alert form on selection", () => {
    const { getByText, queryByText } = render(
      <ScreenerRowAlertStep row={row} onClose={vi.fn()} />,
    );
    expect(getByText("PropertyIQ Score")).toBeTruthy();
    expect(queryByText("Create Alert")).toBeNull();
    fireEvent.click(getByText("Cap Rate"));
    expect(getByText("Create Alert")).toBeTruthy();
  });
});

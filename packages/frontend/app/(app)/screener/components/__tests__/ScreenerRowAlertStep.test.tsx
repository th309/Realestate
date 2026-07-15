import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/entitlements", () => ({
  useEntitlements: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  createAlert: vi.fn().mockResolvedValue({ id: "al-1" }),
  formatGeoDisplayName: (s: string) => s,
}));
vi.mock("@/lib/analytics/tracker", () => ({ trackEvent: () => {} }));

import { useEntitlements } from "@/lib/entitlements";
import { createAlert } from "@/lib/data";
import { ScreenerRowAlertStep } from "../ScreenerRowAlertStep";

const mockUseEntitlements = vi.mocked(useEntitlements);
const mockCreateAlert = vi.mocked(createAlert);

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
  beforeEach(() => {
    mockUseEntitlements.mockReturnValue({ tier: "pro", loading: false } as any);
    mockCreateAlert.mockClear();
  });

  it("shows metric chips and opens the alert form on selection", () => {
    const { getByText, queryByText } = render(
      <ScreenerRowAlertStep row={row} onClose={vi.fn()} />,
    );
    expect(getByText("PropertyIQ Score")).toBeTruthy();
    expect(queryByText("Create Alert")).toBeNull();
    fireEvent.click(getByText("Cap Rate"));
    expect(getByText("Create Alert")).toBeTruthy();
  });

  it("renders the upgrade CTA instead of metric chips when the tier is not paid", () => {
    mockUseEntitlements.mockReturnValue({
      tier: "free",
      loading: false,
    } as any);
    const { getByText, queryByText } = render(
      <ScreenerRowAlertStep row={row} onClose={vi.fn()} />,
    );
    expect(getByText("Alerts are a Pro feature.")).toBeTruthy();
    expect(getByText("Upgrade to Pro →")).toBeTruthy();
    expect(queryByText("PropertyIQ Score")).toBeNull();
  });

  it("renders nothing while entitlements are still loading", () => {
    mockUseEntitlements.mockReturnValue({ tier: "free", loading: true } as any);
    const { container } = render(
      <ScreenerRowAlertStep row={row} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("submits the correctly-mapped payload to createAlert", async () => {
    const onClose = vi.fn();
    const { getByText } = render(
      <ScreenerRowAlertStep row={row} onClose={onClose} />,
    );
    fireEvent.click(getByText("Cap Rate"));
    fireEvent.click(getByText("Create Alert"));

    await waitFor(() => expect(mockCreateAlert).toHaveBeenCalledTimes(1));
    expect(mockCreateAlert).toHaveBeenCalledWith({
      geography_type: "metro",
      geography_id: "12420",
      geography_name: "Austin, TX",
      metric_id: "cap_rate",
      condition: "above",
      threshold: 5.1,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MetricAlertBell } from "../MetricAlertBell";

let mockTier = "pro";
const mockCreateAlert = vi.fn();

vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ tier: mockTier }),
}));

vi.mock("@/lib/data", () => ({
  createAlert: (...args: unknown[]) => mockCreateAlert(...args),
  getMetricTitle: (id: string) => (id === "home_value" ? "Home Value" : id),
}));

vi.mock("@/lib/analytics/tracker", () => ({
  trackEvent: vi.fn(),
}));

const baseProps = {
  metricId: "home_value",
  currentValue: 450000,
  geographyType: "metro",
  geographyId: "12420",
  geographyName: "Austin, TX",
};

describe("MetricAlertBell", () => {
  beforeEach(() => {
    mockTier = "pro";
    mockCreateAlert.mockReset();
    mockCreateAlert.mockResolvedValue({ id: "new-alert" });
  });

  it("renders nothing for a free-tier user (same gate as the /alerts page)", () => {
    mockTier = "free";
    render(<MetricAlertBell {...baseProps} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing when the card has no numeric current value", () => {
    render(<MetricAlertBell {...baseProps} currentValue={null} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a 44px bell trigger for a paid tier with a numeric value", () => {
    render(<MetricAlertBell {...baseProps} />);
    const button = screen.getByRole("button", {
      name: /set alert for home value/i,
    });
    expect(button).toBeInTheDocument();
    expect(button.className).toMatch(/min-w-\[44px\]/);
    expect(button.className).toMatch(/min-h-\[44px\]/);
  });

  it("opens CreateAlertForm prefilled with the card's metric, value, and geography", () => {
    render(<MetricAlertBell {...baseProps} />);
    fireEvent.click(
      screen.getByRole("button", { name: /set alert for home value/i }),
    );

    expect(screen.getByText("Home Value")).toBeInTheDocument();
    expect(screen.getByText(/Austin, TX/)).toBeInTheDocument();
    expect(screen.getByText(/Current value: 450000/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Threshold")).toHaveValue(450000);
  });

  it("submits the prefilled alert with the card's geography + metric context", async () => {
    render(<MetricAlertBell {...baseProps} />);
    fireEvent.click(
      screen.getByRole("button", { name: /set alert for home value/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /create alert/i }));

    await waitFor(() => expect(mockCreateAlert).toHaveBeenCalledTimes(1));
    expect(mockCreateAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        metric_id: "home_value",
        condition: "above",
        threshold: 450000,
        geography_type: "metro",
        geography_id: "12420",
        geography_name: "Austin, TX",
      }),
    );
  });
});

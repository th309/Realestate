import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

const activeAlert = {
  id: "a1",
  geography_type: "metro",
  geography_id: "12420",
  geography_name: "Austin, TX",
  metric_id: "propertyiq_score",
  condition: "above",
  threshold: 60,
  is_active: true,
};

vi.mock("@/lib/alerts/hooks", () => ({
  useAlerts: () => ({
    alerts: [activeAlert],
    isLoading: false,
    remove: vi.fn(),
    update: vi.fn(),
  }),
  useAlertHistory: () => ({
    entries: [],
    unreadCount: 0,
    isLoading: false,
    markRead: vi.fn(),
  }),
}));
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ tier: "pro", loading: false }),
}));
vi.mock("@/components/navigation", () => ({
  PageHeaderWithBreadcrumbs: () => <header />,
}));
vi.mock("@/components/alerts", () => ({ AlertFeed: () => <div /> }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import AlertsPage from "../page";

describe("Alerts page active-alert rows", () => {
  it("renders a link to the alert's market", () => {
    const { container } = render(<AlertsPage />);

    // Find the link by checking all links
    const allLinks = container.querySelectorAll("a");
    const marketLink = Array.from(allLinks).find(
      (link) => link.getAttribute("href") === "/map?geo=metro&id=12420",
    );

    expect(marketLink).toBeTruthy();
  });
});

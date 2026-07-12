import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileMenu } from "../MobileMenu";

// Focused on the Alerts row this task adds to the account section — gated
// the same way as the /alerts page (pro/enterprise/admin) and showing the
// live unread count instead of a full dropdown.
let mockUnreadCount = 0;

vi.mock("@/lib/alerts/hooks", () => ({
  useAlertHistory: () => ({ unreadCount: mockUnreadCount }),
}));

vi.mock("../GetAppMenuItem", () => ({
  GetAppMenuItem: () => <div data-testid="get-app-stub" />,
}));

const baseProps = {
  user: { email: "investor@example.com", user_metadata: {} },
  loading: false,
  orgSlug: null,
  onClose: vi.fn(),
  onSignOut: vi.fn(),
  onNavigate: vi.fn(),
};

describe("MobileMenu — Alerts row", () => {
  beforeEach(() => {
    mockUnreadCount = 0;
  });

  it("shows an Alerts row linking to /alerts for a paid tier", () => {
    render(<MobileMenu {...baseProps} tier="pro" />);
    const link = screen.getByRole("link", { name: /^alerts$/i });
    expect(link).toHaveAttribute("href", "/alerts");
  });

  it("includes the unread count in the row label when there are unread alerts", () => {
    mockUnreadCount = 4;
    render(<MobileMenu {...baseProps} tier="enterprise" />);
    expect(
      screen.getByRole("link", { name: "Alerts (4 unread)" }),
    ).toBeInTheDocument();
  });

  it("hides the Alerts row for the free tier (same gate as the /alerts page)", () => {
    render(<MobileMenu {...baseProps} tier="free" />);
    expect(
      screen.queryByRole("link", { name: /alerts/i }),
    ).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PaywallProvider } from "../PaywallProvider";

// ---- Mocks ----

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseEntitlements = vi.fn();
vi.mock("@/lib/entitlements/EntitlementsContext", () => ({
  useEntitlements: () => mockUseEntitlements(),
}));

const mockUsePaywallPageTracking = vi.fn();
vi.mock("../usePaywallPageTracking", () => ({
  usePaywallPageTracking: () => mockUsePaywallPageTracking(),
}));

vi.mock("@/components/entitlements/FreeUserUpgradeModal", () => ({
  FreeUserUpgradeModal: ({ onDismiss }: { onDismiss: () => void }) => (
    <div data-testid="free-user-nag" onClick={onDismiss} />
  ),
}));

// ---- Helpers ----

function renderWithProvider() {
  return render(
    <PaywallProvider>
      <div data-testid="child-content">App Content</div>
    </PaywallProvider>,
  );
}

// ---- Tests ----

describe("PaywallProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults: anon user on a product page
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockUseEntitlements.mockReturnValue({ tier: "free", simulatedAuth: null });
    mockUsePaywallPageTracking.mockReturnValue({ isOnProductPage: true });
  });

  it("always renders children", () => {
    renderWithProvider();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("does not show FreeUserUpgradeModal for anonymous users (no nag timer)", () => {
    // Anon users are not on the 5-minute nag cycle — nag is for free authed users
    renderWithProvider();
    expect(screen.queryByTestId("free-user-nag")).not.toBeInTheDocument();
  });

  it("does not show FreeUserUpgradeModal for authenticated users while timer has not fired", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "test@example.com" },
      loading: false,
    });
    mockUseEntitlements.mockReturnValue({ tier: "free", simulatedAuth: null });

    renderWithProvider();

    // Timer hasn't fired yet — nag should not appear
    expect(screen.queryByTestId("free-user-nag")).not.toBeInTheDocument();
  });

  it("does not show FreeUserUpgradeModal when not on a product page", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "test@example.com" },
      loading: false,
    });
    mockUseEntitlements.mockReturnValue({ tier: "free", simulatedAuth: null });
    mockUsePaywallPageTracking.mockReturnValue({ isOnProductPage: false });

    renderWithProvider();

    expect(screen.queryByTestId("free-user-nag")).not.toBeInTheDocument();
  });
});

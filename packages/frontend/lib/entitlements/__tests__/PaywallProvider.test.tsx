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

// Mock the overlay components so we can detect them via test IDs
vi.mock("@/components/entitlements/AnonPaywallOverlay", () => ({
  AnonPaywallOverlay: () => <div data-testid="anon-paywall-overlay" />,
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

describe("PaywallProvider auth race condition fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults: anon user who is past threshold on a product page
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockUseEntitlements.mockReturnValue({ tier: "free", simulatedAuth: null });
    mockUsePaywallPageTracking.mockReturnValue({
      isOverThreshold: true,
      isOnProductPage: true,
      viewCount: 6,
      resetViews: vi.fn(),
    });
  });

  it("does not show AnonPaywallOverlay while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    renderWithProvider();

    // Child content should still be visible
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    // Overlay must NOT appear during auth loading (race condition fix)
    expect(
      screen.queryByTestId("anon-paywall-overlay"),
    ).not.toBeInTheDocument();
  });

  it("shows AnonPaywallOverlay for anonymous users after threshold", () => {
    // Default mocks: authLoading=false, user=null, isOverThreshold=true, isOnProductPage=true
    renderWithProvider();

    expect(screen.getByTestId("anon-paywall-overlay")).toBeInTheDocument();
  });

  it("never shows AnonPaywallOverlay for authenticated users", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "test@example.com" },
      loading: false,
    });

    renderWithProvider();

    expect(
      screen.queryByTestId("anon-paywall-overlay"),
    ).not.toBeInTheDocument();
  });

  it("respects simulatedAuth=false to show overlay for testing", () => {
    // User is authenticated but dev toolbar simulates anon
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "test@example.com" },
      loading: false,
    });
    mockUseEntitlements.mockReturnValue({ tier: "free", simulatedAuth: false });

    renderWithProvider();

    // simulatedAuth === false nullifies the effective user, so overlay should show
    expect(screen.getByTestId("anon-paywall-overlay")).toBeInTheDocument();
  });

  it("does not show overlay on non-product pages", () => {
    mockUsePaywallPageTracking.mockReturnValue({
      isOverThreshold: true,
      isOnProductPage: false,
      viewCount: 6,
      resetViews: vi.fn(),
    });

    renderWithProvider();

    expect(
      screen.queryByTestId("anon-paywall-overlay"),
    ).not.toBeInTheDocument();
  });

  it("does not show overlay when view count is below threshold", () => {
    mockUsePaywallPageTracking.mockReturnValue({
      isOverThreshold: false,
      isOnProductPage: true,
      viewCount: 2,
      resetViews: vi.fn(),
    });

    renderWithProvider();

    expect(
      screen.queryByTestId("anon-paywall-overlay"),
    ).not.toBeInTheDocument();
  });

  it("always renders children regardless of paywall state", () => {
    renderWithProvider();

    // Children are always rendered (overlay is an addition, not a replacement)
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    // Overlay is also present (anon over threshold on product page)
    expect(screen.getByTestId("anon-paywall-overlay")).toBeInTheDocument();
  });

  it("does not show FreeUserUpgradeModal for anon users", () => {
    // Anon user should see hard block, not the nag modal
    renderWithProvider();

    expect(screen.queryByTestId("free-user-nag")).not.toBeInTheDocument();
  });
});

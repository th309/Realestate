import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
const entitlementsState = vi.hoisted(() => ({ loading: false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/watchlist/useWatchlist", () => ({
  useWatchlist: () => ({
    isInWatchlist: () => false,
    addToWatchlist: vi.fn(),
    removeFromWatchlist: vi.fn(),
    items: [],
  }),
}));
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({
    getAccess: () => ({ level: "full" }),
    loading: entitlementsState.loading,
  }),
}));
vi.mock("@/lib/entitlements/useIsAnonymous", () => ({
  useIsAnonymous: () => false,
}));
vi.mock("@/lib/entitlements/buildAnonReturnTo", () => ({
  buildAnonReturnTo: () => "",
}));
vi.mock("@/components/entitlements/AnonCaptureModal", () => ({
  AnonCaptureModal: () => <div />,
}));
vi.mock("@/components/entitlements/PaywallCard", () => ({
  PaywallCard: () => <div />,
}));
vi.mock("@/lib/pwa/use-modal-history", () => ({ useModalHistory: () => {} }));
vi.mock("@/lib/data", () => ({ formatGeoDisplayName: (s: string) => s }));
vi.mock("../ScreenerRowAlertStep", () => ({
  ScreenerRowAlertStep: () => <div data-testid="alert-step" />,
}));

import { ScreenerRowMenu } from "../ScreenerRowMenu";

const row = {
  geo_level: "metro",
  region_id: "12420",
  region_name: "Austin, TX",
  state_code: "TX",
  score: 72,
} as any;

describe("ScreenerRowMenu", () => {
  afterEach(() => {
    entitlementsState.loading = false;
  });

  it("renders nothing while entitlements are still loading", () => {
    entitlementsState.loading = true;
    render(<ScreenerRowMenu row={row} x={0} y={0} onClose={vi.fn()} />);
    expect(screen.queryByText("Favorite")).toBeNull();
    expect(screen.queryByText("View on Map")).toBeNull();
    expect(screen.queryByText("Generate Report")).toBeNull();
  });

  it("navigates to the map with the geo/id/name/state deep-link params", () => {
    render(<ScreenerRowMenu row={row} x={0} y={0} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("View on Map"));
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("/map?");
    expect(url).toContain("geo=metro");
    expect(url).toContain("id=12420");
    expect(url).toContain("state=TX");
  });

  it("reveals the alert sub-step when Set Alert is chosen", () => {
    render(<ScreenerRowMenu row={row} x={0} y={0} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Set Alert"));
    expect(screen.getByTestId("alert-step")).toBeTruthy();
  });
});

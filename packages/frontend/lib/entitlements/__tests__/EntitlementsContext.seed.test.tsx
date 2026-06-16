import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntitlementsProvider, useEntitlements } from "../EntitlementsContext";
import type { EntitlementsState } from "../types";

// authLoading:true so the refresh effect (gated on !authLoading) never runs —
// isolates the initial-state seeding.
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, session: null, loading: true }),
}));

// Mock the API module so no real network call is attempted if a refresh fires.
vi.mock("../api", () => ({
  fetchEntitlements: vi.fn(),
  trackPaywallEvent: vi.fn(),
}));

// Mock Realtime tier sync hook — no real Supabase connection in tests.
vi.mock("../useRealtimeTierSync", () => ({
  useRealtimeTierSync: () => ({ toastMessage: null, dismissToast: vi.fn() }),
}));

// Mock getAllMetricIds to avoid pulling in the entire registry.
vi.mock("@/lib/data", () => ({
  getAllMetricIds: () => ["home_value", "rent_index", "cap_rate"],
}));

function TierProbe() {
  const { tier } = useEntitlements();
  return <span data-testid="tier">{tier}</span>;
}

describe("EntitlementsProvider seeding", () => {
  it("renders the server-seeded tier on first paint (no free flash)", () => {
    const seed: EntitlementsState = {
      tier: "pro",
      access: {},
      trial: { active: true, daysRemaining: 14, tier: "pro" },
      loading: false,
      error: null,
    };
    render(
      <EntitlementsProvider initialState={seed}>
        <TierProbe />
      </EntitlementsProvider>,
    );
    expect(screen.getByTestId("tier").textContent).toBe("pro");
  });

  it("falls back to free when no initialState is provided", () => {
    render(
      <EntitlementsProvider>
        <TierProbe />
      </EntitlementsProvider>,
    );
    expect(screen.getByTestId("tier").textContent).toBe("free");
  });
});

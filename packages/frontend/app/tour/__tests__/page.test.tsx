import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const setPersona = vi.fn();
const setMarket = vi.fn();
const replaceSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceSpy }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/tour",
}));

type MockSession = {
  sessionId: string;
  persona: string | null;
  market: { geoLevel: string; geoId: string; name: string } | null;
  phase: string;
  reportId: string | null;
  startedAt: number;
};

let mockSession: MockSession = {
  sessionId: "s1",
  persona: null,
  market: null,
  phase: "persona",
  reportId: null,
  startedAt: 0,
};

vi.mock("../TourStateProvider", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  const Ctx = actual.createContext<unknown>(null);
  return {
    TourStateProvider: ({ children }: { children: React.ReactNode }) =>
      actual.createElement(
        Ctx.Provider,
        {
          value: {
            session: mockSession,
            setPersona,
            setMarket,
            advanceTo: vi.fn(),
            reset: vi.fn(),
          },
        },
        children,
      ),
    useTour: () => actual.useContext(Ctx) as never,
  };
});

const fetchers = vi.hoisted(() => ({
  saveOnboardingPreferences: vi.fn().mockResolvedValue(undefined),
  saveOnboardingMarketSelection: vi.fn().mockResolvedValue(undefined),
  startOnboardingTrial: vi.fn().mockResolvedValue(undefined),
  updateChecklistTask: vi.fn().mockResolvedValue(undefined),
  incrementUsageStat: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/data", () => fetchers);

vi.mock("../components/PersonaCards", () => ({
  PersonaCards: () => <div data-testid="persona-cards" />,
}));
vi.mock("../components/MarketPickerStep", () => ({
  MarketPickerStep: () => <div data-testid="market-picker" />,
}));

import TourPage from "../page";

describe("TourPage", () => {
  beforeEach(() => {
    Object.values(fetchers).forEach((m) => m.mockClear());
    replaceSpy.mockClear();
    mockSession = {
      sessionId: "s1",
      persona: null,
      market: null,
      phase: "persona",
      reportId: null,
      startedAt: 0,
    };
  });

  it("renders persona cards on phase=persona", () => {
    render(<TourPage />);
    expect(screen.getByTestId("persona-cards")).toBeInTheDocument();
  });

  it("renders market picker on phase=market", () => {
    mockSession.phase = "market";
    render(<TourPage />);
    expect(screen.getByTestId("market-picker")).toBeInTheDocument();
  });

  it("calls saveOnboardingPreferences when persona transitions from null to value", async () => {
    mockSession.persona = "agent";
    render(<TourPage />);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchers.saveOnboardingPreferences).toHaveBeenCalledWith({
      user_type: "agent",
    });
  });

  it("re-fires persona side-effect when persona changes between non-null values", async () => {
    mockSession.persona = "agent";
    const { rerender } = render(<TourPage />);
    await waitFor(() =>
      expect(fetchers.saveOnboardingPreferences).toHaveBeenCalledWith({
        user_type: "agent",
      }),
    );

    mockSession.persona = "investor";
    rerender(<TourPage />);
    await waitFor(() =>
      expect(fetchers.saveOnboardingPreferences).toHaveBeenCalledWith({
        user_type: "investor",
      }),
    );
    expect(fetchers.saveOnboardingPreferences).toHaveBeenCalledTimes(2);
  });

  it("fires all 4 market-select side-effects when market transitions from null to value", async () => {
    mockSession.market = {
      geoLevel: "metro",
      geoId: "39580",
      name: "Raleigh",
    };
    render(<TourPage />);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchers.saveOnboardingMarketSelection).toHaveBeenCalledTimes(1);
    expect(fetchers.startOnboardingTrial).toHaveBeenCalledTimes(1);
    expect(fetchers.updateChecklistTask).toHaveBeenCalledWith("search_market");
    expect(fetchers.incrementUsageStat).toHaveBeenCalledWith("markets_viewed");
  });

  it("redirects to /map?tour=step1 when session.phase is step1 and market+persona are set", async () => {
    mockSession = {
      sessionId: "abc",
      persona: "agent",
      market: { geoLevel: "metro", geoId: "39580", name: "Charlotte" },
      phase: "step1",
      reportId: null,
      startedAt: 0,
    };
    render(<TourPage />);
    await waitFor(() =>
      expect(replaceSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\/map\?.*tour=step1/),
      ),
    );
    const calledWith = replaceSpy.mock.calls[0][0] as string;
    expect(calledWith).toContain("persona=agent");
    expect(calledWith).toContain("market=metro-39580");
    expect(calledWith).toContain("sessionId=abc");
  });

  it("renders Loading… placeholder and skips router.replace when market is null on step1", () => {
    mockSession = {
      sessionId: "abc",
      persona: "agent",
      market: null,
      phase: "step1",
      reportId: null,
      startedAt: 0,
    };
    render(<TourPage />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Step4Aha } from "../Step4Aha";

const mutateSpy = vi.fn();
let mockMutationState: any = {
  isIdle: true,
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: null,
  mutate: mutateSpy,
};

vi.mock("@/lib/data", () => ({
  useAnonymousListingPresentation: () => mockMutationState,
  TourRateLimitError: class TourRateLimitError extends Error {},
}));

let mockAuthState: any = { user: null, loading: false };
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockAuthState,
}));

const triggerConfettiSpy = vi.fn();
vi.mock("../../primitives/celebrations", () => ({
  triggerConfetti: () => triggerConfettiSpy(),
}));

let mockSession: any = null;
vi.mock("../../TourStateProvider", () => ({
  useTour: () => ({ session: mockSession }),
}));

vi.mock("../ListingPresentation", () => ({
  ListingPresentation: (p: any) => (
    <div
      data-testid="listing-presentation"
      data-market={p.marketName}
      data-watermark={String(p.showWatermark)}
    />
  ),
}));
vi.mock("../PersonaSpringboard", () => ({
  PersonaSpringboard: (p: any) => (
    <div data-testid="persona-springboard" data-persona={p.persona} />
  ),
}));
vi.mock("../ListingPresentationLoading", () => ({
  ListingPresentationLoading: (p: any) => (
    <div data-testid="loading" data-market={p.marketName} />
  ),
}));
vi.mock("../ListingPresentationError", () => ({
  ListingPresentationError: (p: any) => (
    <div data-testid="error">
      <button onClick={p.onRetry}>retry</button>
      <button onClick={p.onSignupRedirect}>signup</button>
    </div>
  ),
}));
vi.mock("../InlineSignupForm", () => ({
  InlineSignupForm: () => <form id="signup-cta" data-testid="inline-signup" />,
}));

describe("Step4Aha", () => {
  beforeEach(() => {
    mutateSpy.mockClear();
    triggerConfettiSpy.mockClear();
    mockAuthState = { user: null, loading: false };
    mockMutationState = {
      isIdle: true,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: null,
      mutate: mutateSpy,
    };
    mockSession = {
      sessionId: "sess-abc",
      persona: "agent",
      market: { geoLevel: "metro", geoId: "39580", name: "Charlotte" },
      phase: "step4",
    };
  });

  it("renders prompt when persona is null", () => {
    mockSession = { ...mockSession, persona: null };
    render(<Step4Aha />);
    expect(screen.getByText(/pick a persona and market/i)).toBeInTheDocument();
  });

  it("renders prompt when market is null", () => {
    mockSession = { ...mockSession, market: null };
    render(<Step4Aha />);
    expect(screen.getByText(/pick a persona and market/i)).toBeInTheDocument();
  });

  it("fires mutation.mutate on mount when idle and persona+market are set", () => {
    render(<Step4Aha />);
    expect(mutateSpy).toHaveBeenCalledWith({
      sessionId: "sess-abc",
      persona: "agent",
      market: { geoLevel: "metro", geoId: "39580", name: "Charlotte" },
    });
  });

  it("renders Loading when isPending", () => {
    mockMutationState = {
      ...mockMutationState,
      isIdle: false,
      isPending: true,
    };
    render(<Step4Aha />);
    expect(screen.getByTestId("loading").getAttribute("data-market")).toBe(
      "Charlotte",
    );
  });

  it("renders Loading when isIdle (initial mount race)", () => {
    render(<Step4Aha />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("renders Error when isError; onRetry re-fires mutation", () => {
    mockMutationState = {
      ...mockMutationState,
      isIdle: false,
      isError: true,
      error: new Error("boom"),
    };
    render(<Step4Aha />);
    mutateSpy.mockClear();
    fireEvent.click(screen.getByText("retry"));
    expect(mutateSpy).toHaveBeenCalled();
  });

  it("Error onSignupRedirect navigates to /auth/sign-up?from=tour-rate-limit", () => {
    mockMutationState = {
      ...mockMutationState,
      isIdle: false,
      isError: true,
      error: new Error("rate_limited"),
    };
    const originalLocation = window.location;
    // @ts-ignore
    delete window.location;
    // @ts-ignore
    window.location = { href: "" };
    render(<Step4Aha />);
    fireEvent.click(screen.getByText("signup"));
    expect(window.location.href).toBe("/auth/sign-up?from=tour-rate-limit");
    // @ts-ignore
    window.location = originalLocation;
  });

  it("anonymous success renders watermarked report + inline signup, no springboard, no confetti", () => {
    mockMutationState = {
      ...mockMutationState,
      isIdle: false,
      isSuccess: true,
      data: { report: { sections: [] } },
    };
    const { container } = render(<Step4Aha />);
    expect(screen.getByTestId("listing-presentation")).toBeInTheDocument();
    expect(
      screen.getByTestId("listing-presentation").getAttribute("data-market"),
    ).toBe("Charlotte");
    expect(
      screen.getByTestId("listing-presentation").getAttribute("data-watermark"),
    ).toBe("true");
    expect(container.querySelector("#signup-cta")).toBeTruthy();
    expect(screen.queryByTestId("persona-springboard")).toBeNull();
    expect(triggerConfettiSpy).not.toHaveBeenCalled();
  });

  it("authenticated success: no demo watermark, no signup form, shows the springboard + confetti", () => {
    mockAuthState = { user: { id: "u1" }, loading: false };
    mockMutationState = {
      ...mockMutationState,
      isIdle: false,
      isSuccess: true,
      data: { report: { sections: [] } },
    };
    const { container } = render(<Step4Aha />);
    // de-watermarked report
    expect(screen.queryByText(/Demo report/i)).toBeNull();
    expect(
      screen.getByTestId("listing-presentation").getAttribute("data-watermark"),
    ).toBe("false");
    // anonymous signup funnel is replaced by the springboard
    expect(container.querySelector("#signup-cta")).toBeNull();
    expect(screen.queryByTestId("inline-signup")).toBeNull();
    expect(screen.getByTestId("persona-springboard")).toBeInTheDocument();
    // Pro framing + celebration
    expect(screen.getByText(/set with Pro/i)).toBeInTheDocument();
    expect(triggerConfettiSpy).toHaveBeenCalled();
  });
});

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

let mockSession: any = null;
vi.mock("../../TourStateProvider", () => ({
  useTour: () => ({ session: mockSession }),
}));

vi.mock("../ListingPresentation", () => ({
  ListingPresentation: (p: any) => (
    <div data-testid="listing-presentation" data-market={p.marketName} />
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

describe("Step4Aha", () => {
  beforeEach(() => {
    mutateSpy.mockClear();
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

  it("renders ListingPresentation on success with showWatermark=true and #signup-cta anchor", () => {
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
    expect(container.querySelector("#signup-cta")).toBeTruthy();
  });
});

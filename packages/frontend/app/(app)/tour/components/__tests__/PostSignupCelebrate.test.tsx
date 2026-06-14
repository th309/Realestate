import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostSignupCelebrate } from "../PostSignupCelebrate";

const resetSpy = vi.fn();
let mockSession: any = {
  sessionId: "sess-abc",
  persona: "agent",
  market: { geoLevel: "metro", geoId: "16740", name: "Charlotte, NC" },
};

vi.mock("../../TourStateProvider", () => ({
  useTour: () => ({ session: mockSession, reset: resetSpy }),
}));

describe("PostSignupCelebrate", () => {
  beforeEach(() => {
    resetSpy.mockReset();
    mockSession = {
      sessionId: "sess-abc",
      persona: "agent",
      market: { geoLevel: "metro", geoId: "16740", name: "Charlotte, NC" },
    };
  });

  it("renders the saved-report headline using the short market name", () => {
    render(<PostSignupCelebrate />);
    expect(
      screen.getByText(/Your Charlotte report is saved/i),
    ).toBeInTheDocument();
  });

  it("renders the trial copy", () => {
    render(<PostSignupCelebrate />);
    expect(screen.getByText(/14-day Pro trial/i)).toBeInTheDocument();
  });

  it("renders the saved-report card with full market name", () => {
    render(<PostSignupCelebrate />);
    expect(
      screen.getByText(/Charlotte, NC · Listing Presentation/),
    ).toBeInTheDocument();
  });

  it("renders three CTAs", () => {
    render(<PostSignupCelebrate />);
    expect(
      screen
        .getByRole("link", { name: /Open my report/i })
        .getAttribute("href"),
    ).toBe("/dashboard?openReport=latest");
    expect(
      screen
        .getByRole("link", { name: /Try another market/i })
        .getAttribute("href"),
    ).toBe("/tour?resume=fresh");
    expect(
      screen
        .getByRole("link", { name: /Go to dashboard/i })
        .getAttribute("href"),
    ).toBe("/dashboard");
  });

  it("calls reset() when 'Try another market' is clicked", () => {
    render(<PostSignupCelebrate />);
    fireEvent.click(screen.getByRole("link", { name: /Try another market/i }));
    expect(resetSpy).toHaveBeenCalled();
  });

  it("falls back to 'your market' when market is null", () => {
    mockSession = { ...mockSession, market: null };
    render(<PostSignupCelebrate />);
    expect(
      screen.getByText(/Your your market report is saved/i),
    ).toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<PostSignupCelebrate />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

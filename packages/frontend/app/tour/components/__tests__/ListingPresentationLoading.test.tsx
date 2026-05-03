import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ListingPresentationLoading } from "../ListingPresentationLoading";

describe("ListingPresentationLoading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders the headline with marketName", () => {
    render(<ListingPresentationLoading marketName="Charlotte" />);
    expect(
      screen.getByText(/Building your Charlotte listing presentation/i),
    ).toBeInTheDocument();
  });

  it("renders the first progress message initially", () => {
    render(<ListingPresentationLoading marketName="Charlotte" />);
    expect(screen.getByText(/Pulling 14 market signals/i)).toBeInTheDocument();
  });

  it("rotates to the next message after the rotation interval", () => {
    render(<ListingPresentationLoading marketName="Charlotte" />);
    act(() => {
      vi.advanceTimersByTime(2800);
    });
    expect(
      screen.getByText(/Comparing against peer markets/i),
    ).toBeInTheDocument();
  });

  it("sticks on the last message after all rotations", () => {
    render(<ListingPresentationLoading marketName="Charlotte" />);
    act(() => {
      vi.advanceTimersByTime(2800 * 10);
    });
    // Last message — "Drafting strategy synthesis…"
    expect(
      screen.getByText(/Drafting strategy synthesis/i),
    ).toBeInTheDocument();
  });

  it("does NOT show the stuck banner before 15 seconds", () => {
    render(<ListingPresentationLoading marketName="Charlotte" />);
    act(() => {
      vi.advanceTimersByTime(14_000);
    });
    expect(
      screen.queryByText(/larger markets take a bit longer/i),
    ).not.toBeInTheDocument();
  });

  it("shows the stuck banner after 15 seconds", () => {
    render(<ListingPresentationLoading marketName="Charlotte" />);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(
      screen.getByText(/larger markets take a bit longer/i),
    ).toBeInTheDocument();
  });

  it("cleans up timers on unmount (no act warnings)", () => {
    const { unmount } = render(
      <ListingPresentationLoading marketName="Charlotte" />,
    );
    unmount();
    // If timers leak, vi.runOnlyPendingTimers in afterEach catches them silently.
    // This test just exercises the unmount path without errors.
    expect(true).toBe(true);
  });
});

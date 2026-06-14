import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListingPresentationError } from "../ListingPresentationError";

class FakeRateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super("rate_limited");
    this.retryAfter = retryAfter;
    this.name = "TourRateLimitError";
  }
}

describe("ListingPresentationError", () => {
  it("renders the rate-limit branch when error.message === 'rate_limited'", () => {
    render(
      <ListingPresentationError
        error={new Error("rate_limited")}
        onRetry={vi.fn()}
        onSignupRedirect={vi.fn()}
      />,
    );
    expect(screen.getByText(/used today's free demo/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign up/i }),
    ).toBeInTheDocument();
  });

  it("renders the rate-limit branch when error has retryAfter property", () => {
    render(
      <ListingPresentationError
        error={new FakeRateLimitError(60)}
        onRetry={vi.fn()}
        onSignupRedirect={vi.fn()}
      />,
    );
    expect(screen.getByText(/used today's free demo/i)).toBeInTheDocument();
  });

  it("calls onSignupRedirect when 'Sign up' is clicked", () => {
    const onSignupRedirect = vi.fn();
    render(
      <ListingPresentationError
        error={new Error("rate_limited")}
        onRetry={vi.fn()}
        onSignupRedirect={onSignupRedirect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(onSignupRedirect).toHaveBeenCalledOnce();
  });

  it("renders the generic error branch with error message and retry button", () => {
    render(
      <ListingPresentationError
        error={new Error("network timeout")}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/couldn't build that report/i)).toBeInTheDocument();
    expect(screen.getByText(/network timeout/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("calls onRetry when 'Try again' is clicked", () => {
    const onRetry = vi.fn();
    render(
      <ListingPresentationError error={new Error("boom")} onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(
      <ListingPresentationError
        error={new Error("rate_limited")}
        onRetry={vi.fn()}
        onSignupRedirect={vi.fn()}
      />,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudioGreeting } from "../StudioGreeting";

const zero = { generating: 0, review: 0, published: 0, attention: 0 };

describe("StudioGreeting in-flight ticker branching", () => {
  it("ready + nothing in flight → the 'start something' nudge", () => {
    render(<StudioGreeting counts={zero} reviewStatus="ready" />);
    expect(screen.getByText(/Nothing in flight right now/)).toBeInTheDocument();
  });

  it("loading review queue → 'checking', never a false zero claim", () => {
    render(<StudioGreeting counts={zero} reviewStatus="loading" />);
    expect(screen.getByText(/Checking what's waiting/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing in flight/)).toBeNull();
  });

  it("errored review queue → a distinct error message", () => {
    render(<StudioGreeting counts={zero} reviewStatus="error" />);
    expect(
      screen.getByText(/Couldn't check the review queue/),
    ).toBeInTheDocument();
  });

  it("ready with pending reviews → shows the review chip and count", () => {
    render(
      <StudioGreeting counts={{ ...zero, review: 3 }} reviewStatus="ready" />,
    );
    expect(screen.getByText("Ready to review")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("loading suppresses the review chip even when a count exists", () => {
    render(
      <StudioGreeting
        counts={{ ...zero, generating: 2, review: 5 }}
        reviewStatus="loading"
      />,
    );
    expect(screen.getByText("Generating")).toBeInTheDocument();
    expect(screen.queryByText("Ready to review")).toBeNull();
  });
});

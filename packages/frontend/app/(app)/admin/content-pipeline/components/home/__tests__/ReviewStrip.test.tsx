import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewStrip } from "../ReviewStrip";
import type { QueueItem } from "../../../lib/queue-navigator";

const items: QueueItem[] = [
  {
    id: "1",
    market_query: "Austin, TX",
    format: "grade_reveal",
    status: "ready_for_review",
  },
  { id: "2", market_query: "Dallas, TX", status: "ready_for_review" },
];

describe("ReviewStrip branching", () => {
  it("renders nothing when empty and not errored", () => {
    const { container } = render(<ReviewStrip items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an explicit error affordance (distinct from empty) on error", () => {
    render(<ReviewStrip items={[]} isError />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/Couldn't load the review queue/),
    ).toBeInTheDocument();
  });

  it("calls onRetry when Retry is clicked", () => {
    const onRetry = vi.fn();
    render(<ReviewStrip items={[]} isError onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("lists waiting items with a count and a Review all link", () => {
    render(<ReviewStrip items={items} />);
    expect(screen.getByText(/Ready for review/)).toBeInTheDocument();
    expect(screen.getByText("2 waiting")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Review all" }),
    ).toBeInTheDocument();
  });
});

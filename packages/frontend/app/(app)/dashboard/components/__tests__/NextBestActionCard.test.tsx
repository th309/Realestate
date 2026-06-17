import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextBestActionCard } from "../NextBestActionCard";

describe("NextBestActionCard", () => {
  it("renders the recommended feature's CTA and deep-link", () => {
    render(<NextBestActionCard recommended="analyzer" whatsNew={null} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/analyzer");
    expect(screen.getByText(/Underwrite a real deal/i)).toBeInTheDocument();
  });

  it("renders the what's-new note when provided", () => {
    render(
      <NextBestActionCard recommended="screener" whatsNew="3 new markets" />,
    );
    expect(screen.getByText(/New since you left/i)).toBeInTheDocument();
    expect(screen.getByText(/3 new markets/i)).toBeInTheDocument();
  });

  it("renders nothing when there's no recommendation", () => {
    const { container } = render(
      <NextBestActionCard recommended={null} whatsNew={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

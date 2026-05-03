import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingPresentationCover } from "../ListingPresentationCover";

const baseProps = {
  marketName: "Charlotte",
  geographyDescription: "Mecklenburg County · NC",
  households: 125000,
  generatedAt: "2026-05-03T14:00:00Z",
};

describe("ListingPresentationCover", () => {
  it("renders the brand label", () => {
    render(<ListingPresentationCover {...baseProps} />);
    expect(
      screen.getByText(/PropertyIQ Market Intelligence/i),
    ).toBeInTheDocument();
  });

  it("renders the H1 with marketName + 'Listing Presentation'", () => {
    render(<ListingPresentationCover {...baseProps} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/Charlotte/);
    expect(h1.textContent).toMatch(/Listing Presentation/i);
  });

  it("renders geographyDescription", () => {
    render(<ListingPresentationCover {...baseProps} />);
    expect(screen.getByText(/Mecklenburg County/)).toBeInTheDocument();
  });

  it("formats households with locale + ~ prefix", () => {
    render(<ListingPresentationCover {...baseProps} />);
    expect(screen.getByText(/~125,000/)).toBeInTheDocument();
  });

  it("renders '—' when households is missing", () => {
    render(<ListingPresentationCover {...baseProps} households={undefined} />);
    const all = screen.getAllByText(/—/);
    expect(all.length).toBeGreaterThan(0);
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<ListingPresentationCover {...baseProps} />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

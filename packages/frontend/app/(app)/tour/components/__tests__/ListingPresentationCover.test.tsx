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

  it("uses mobile-first responsive classes for header padding and H1", () => {
    const { container } = render(<ListingPresentationCover {...baseProps} />);
    const header = container.querySelector("header");
    expect(header?.className).toMatch(/px-6/);
    expect(header?.className).toMatch(/md:px-12/);
    expect(header?.className).toMatch(/pt-10/);
    expect(header?.className).toMatch(/md:pt-14/);
    const h1 = container.querySelector("h1");
    expect(h1?.className).toMatch(/text-\[28px\]/);
    expect(h1?.className).toMatch(/md:text-\[38px\]/);
    const dl = container.querySelector("dl");
    expect(dl?.className).toMatch(/flex-wrap/);
    expect(dl?.className).toMatch(/gap-4/);
    expect(dl?.className).toMatch(/md:gap-8/);
  });
});

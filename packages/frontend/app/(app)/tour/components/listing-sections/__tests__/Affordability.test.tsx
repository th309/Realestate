import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Affordability } from "../Affordability";

describe("Affordability", () => {
  const props = {
    affordabilityIndex: 64,
    affordabilityMeta: "Median home ≈ 4.2× median income",
    affordabilityMarker: 64,
    priceToRent: 18.5,
    priceToRentMeta: "Median home ≈ 18.5× annual rent",
    priceToRentMarker: 57,
    hasPriceToRent: true,
    limitedData: false,
  };

  it("renders limited-data branch when limitedData=true", () => {
    render(<Affordability {...props} limitedData={true} />);
    expect(
      screen.getByText(/affordability data unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders both gauges when price-to-rent is available", () => {
    render(<Affordability {...props} />);
    expect(screen.getByText("Affordability index")).toBeInTheDocument();
    expect(screen.getByText("Price-to-rent ratio")).toBeInTheDocument();
    expect(screen.getByText("18.5×")).toBeInTheDocument();
  });

  it("hides the price-to-rent gauge when rent data is missing", () => {
    render(<Affordability {...props} hasPriceToRent={false} />);
    expect(screen.getByText("Affordability index")).toBeInTheDocument();
    expect(screen.queryByText("Price-to-rent ratio")).not.toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<Affordability {...props} />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

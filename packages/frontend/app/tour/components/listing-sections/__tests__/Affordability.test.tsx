import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Affordability } from "../Affordability";

describe("Affordability", () => {
  const props = {
    affordabilityIndex: 82,
    affordabilityMeta: "vs national 100",
    affordabilityMarker: 35,
    rentVsBuyYears: 4.2,
    rentVsBuyMeta: "shorter is better",
    rentVsBuyMarker: 45,
    limitedData: false,
  };

  it("renders limited-data branch when limitedData=true", () => {
    render(<Affordability {...props} limitedData={true} />);
    expect(
      screen.getByText(/affordability data unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders both gauges with their titles", () => {
    render(<Affordability {...props} />);
    expect(screen.getByText("Affordability index")).toBeInTheDocument();
    expect(screen.getByText("Rent-vs-buy break-even")).toBeInTheDocument();
  });

  it("formats rent-vs-buy years to one decimal place", () => {
    render(<Affordability {...props} rentVsBuyYears={3} />);
    expect(screen.getByText("3.0 yrs")).toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<Affordability {...props} />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

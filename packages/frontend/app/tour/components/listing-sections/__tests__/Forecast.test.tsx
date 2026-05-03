import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Forecast } from "../Forecast";

vi.mock("../../charts/ForecastChart", () => ({
  ForecastChart: () => <div data-testid="forecast-chart" />,
}));

const fcProps = {
  historic: [100, 105, 110],
  forecast: [115, 120, 125],
  ciLow: [110, 115, 120],
  ciHigh: [120, 125, 130],
  projectedPrice: "$450K",
  projectedRange: "$435K – $470K",
  projectedRent: "$2.1K",
  projectedRentChange: "+3.5% YoY",
  riskFactor: "Moderate sensitivity",
  limitedData: false,
};

describe("Forecast", () => {
  it("renders limited-data branch", () => {
    render(<Forecast {...fcProps} limitedData={true} />);
    expect(screen.getByText(/forecast unavailable/i)).toBeInTheDocument();
  });

  it("renders ForecastChart and 3 cards", () => {
    render(<Forecast {...fcProps} />);
    expect(screen.getByTestId("forecast-chart")).toBeInTheDocument();
    expect(screen.getByText("$450K")).toBeInTheDocument();
    expect(screen.getByText("$2.1K")).toBeInTheDocument();
    expect(screen.getByText(/Mortgage rates/)).toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<Forecast {...fcProps} />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

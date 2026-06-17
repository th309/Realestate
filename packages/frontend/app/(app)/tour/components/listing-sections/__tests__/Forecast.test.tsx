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
  projectedPrice: "$468K",
  projectedRange: "$450K – $486K · 80% modeled interval",
  projectedChange: "+3.5% vs today",
  limitedData: false,
};

describe("Forecast", () => {
  it("renders limited-data branch", () => {
    render(<Forecast {...fcProps} limitedData={true} />);
    expect(screen.getByText(/forecast unavailable/i)).toBeInTheDocument();
  });

  it("renders chart, projected price and projected change", () => {
    render(<Forecast {...fcProps} />);
    expect(screen.getByTestId("forecast-chart")).toBeInTheDocument();
    expect(screen.getByText("$468K")).toBeInTheDocument();
    expect(screen.getByText("+3.5% vs today")).toBeInTheDocument();
  });

  it("does not render the unsubstantiated rent or mortgage-rate cards", () => {
    render(<Forecast {...fcProps} />);
    expect(screen.queryByText(/Mortgage rates/)).not.toBeInTheDocument();
    expect(screen.queryByText(/projected rent/i)).not.toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<Forecast {...fcProps} />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

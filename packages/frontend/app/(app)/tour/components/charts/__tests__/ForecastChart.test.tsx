import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ForecastChart } from "../ForecastChart";

const histories = [100, 105, 110, 115, 120, 125];
const forecasts = [128, 130, 132, 135, 138, 140];
const lows = forecasts.map((v) => v * 0.95);
const highs = forecasts.map((v) => v * 1.05);

describe("ForecastChart", () => {
  it("renders historic as solid polyline", () => {
    const { container } = render(
      <ForecastChart
        historic={histories}
        forecast={forecasts}
        ciLow={lows}
        ciHigh={highs}
      />,
    );
    const polylines = container.querySelectorAll("polyline");
    expect(polylines.length).toBe(2);
    const solid = Array.from(polylines).find(
      (p) => !p.getAttribute("stroke-dasharray"),
    );
    expect(solid).toBeTruthy();
  });

  it("renders forecast as dashed polyline", () => {
    const { container } = render(
      <ForecastChart
        historic={histories}
        forecast={forecasts}
        ciLow={lows}
        ciHigh={highs}
      />,
    );
    const dashed = container.querySelector("polyline[stroke-dasharray]");
    expect(dashed).toBeTruthy();
  });

  it("renders the CI polygon", () => {
    const { container } = render(
      <ForecastChart
        historic={histories}
        forecast={forecasts}
        ciLow={lows}
        ciHigh={highs}
      />,
    );
    expect(container.querySelector("polygon")).toBeTruthy();
  });

  it("renders the NOW marker text", () => {
    const { getByText } = render(
      <ForecastChart
        historic={histories}
        forecast={forecasts}
        ciLow={lows}
        ciHigh={highs}
      />,
    );
    expect(getByText("NOW")).toBeInTheDocument();
  });

  it("renders the empty state when historic AND forecast are both empty", () => {
    const { getByText } = render(
      <ForecastChart historic={[]} forecast={[]} ciLow={[]} ciHigh={[]} />,
    );
    expect(getByText(/forecast unavailable/i)).toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(
      <ForecastChart
        historic={histories}
        forecast={forecasts}
        ciLow={lows}
        ciHigh={highs}
      />,
    );
    const html = container.innerHTML;
    expect(html).not.toMatch(/#3949AB/i);
    expect(html).not.toMatch(/#FF8F00/i);
  });
});

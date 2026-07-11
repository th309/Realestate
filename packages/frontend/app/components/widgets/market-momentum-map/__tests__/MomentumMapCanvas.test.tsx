import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MomentumMapCanvas } from "../MomentumMapCanvas";
import { scoreToColor, NO_DATA_COLOR } from "../momentum-map-colors";
import type { ProjectedMetro } from "../momentum-map-projection";

const metros: ProjectedMetro[] = [
  {
    id: "19780",
    name: "Des Moines-West Des Moines, IA",
    lat: 41.512,
    lon: -93.729,
    pop: 737164,
    conf: "A",
    x: 500,
    y: 250,
    r: 6,
    matrixIndex: 0,
  },
  {
    id: "12345",
    name: "No Data Metro",
    lat: 40,
    lon: -100,
    pop: 50000,
    conf: null,
    x: 400,
    y: 300,
    r: 2,
    matrixIndex: 1,
  },
];
const scores = [
  [72, 55],
  [0, 0],
];

function renderCanvas(
  overrides: Partial<Parameters<typeof MomentumMapCanvas>[0]> = {},
) {
  const onNavigate = vi.fn();
  const utils = render(
    <MomentumMapCanvas
      metros={metros}
      statePaths={["M0,0L10,10"]}
      scores={scores}
      currentFrame={0}
      latestFrame={1}
      animate={false}
      hrefFor={(m) =>
        m.id === "19780" ? "/markets/des-moines-west-des-moines-ia" : null
      }
      onNavigate={onNavigate}
      {...overrides}
    />,
  );
  return { ...utils, onNavigate };
}

describe("MomentumMapCanvas", () => {
  it("renders one circle per metro with score-driven fill", () => {
    const { container } = renderCanvas();
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
    expect(circles[0].getAttribute("fill")).toBe(scoreToColor(72));
    expect(circles[1].getAttribute("fill")).toBe(NO_DATA_COLOR);
  });

  it("shows a tooltip with momentum label on hover", () => {
    const { container } = renderCanvas();
    fireEvent.mouseEnter(container.querySelectorAll("circle")[0]);
    const tooltip = screen.getByTestId("momentum-tooltip");
    expect(tooltip.textContent).toContain("Des Moines");
    expect(tooltip.textContent).toContain("72");
    expect(tooltip.textContent).toContain("RISING");
  });

  it("omits confidence when not on the latest frame, shows it when on it", () => {
    const { container, rerender, ...rest } = renderCanvas({ currentFrame: 0 });
    fireEvent.mouseEnter(container.querySelectorAll("circle")[0]);
    expect(screen.getByTestId("momentum-tooltip").textContent).not.toContain(
      "Confidence",
    );
  });

  it("navigates on click only when a market page exists", () => {
    const { container, onNavigate } = renderCanvas();
    const circles = container.querySelectorAll("circle");
    fireEvent.click(circles[0]);
    expect(onNavigate).toHaveBeenCalledWith(
      "/markets/des-moines-west-des-moines-ia",
    );
    onNavigate.mockClear();
    fireEvent.click(circles[1]);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

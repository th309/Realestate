import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { KPITile } from "../KPITile";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 200, height: 28 }}>
        <actual.ResponsiveContainer width={200} height={28}>
          {children as React.ReactElement}
        </actual.ResponsiveContainer>
      </div>
    ),
  };
});

describe("KPITile", () => {
  it("renders label and value", () => {
    const { getByText } = render(<KPITile label="Cap Rate" value="8.2%" />);
    expect(getByText("Cap Rate")).toBeTruthy();
    expect(getByText("8.2%")).toBeTruthy();
  });

  it("delta with up direction renders + sign and tertiary color", () => {
    const { container, getByText } = render(
      <KPITile label="X" value="10" delta={{ pct: 2.4, direction: "up" }} />,
    );
    const delta = container.querySelector("[data-kpi-delta]");
    expect(delta?.textContent).toMatch(/\+2.4%/);
    expect(delta?.className).toMatch(/tertiary/);
  });

  it("delta with down direction renders − sign and error color", () => {
    const { container } = render(
      <KPITile label="X" value="10" delta={{ pct: 1.5, direction: "down" }} />,
    );
    const delta = container.querySelector("[data-kpi-delta]");
    expect(delta?.textContent).toMatch(/−1.5%/);
    expect(delta?.className).toMatch(/error/);
  });

  it("renders sparkline SVG when sparkline data provided", () => {
    const { container } = render(
      <KPITile label="X" value="10" sparkline={[1, 2, 3, 4, 5]} />,
    );
    expect(container.querySelector("[data-kpi-sparkline]")).toBeTruthy();
  });
});

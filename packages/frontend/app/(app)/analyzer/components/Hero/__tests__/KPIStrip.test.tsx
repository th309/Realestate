import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { KPIStrip } from "../KPIStrip";

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

describe("KPIStrip", () => {
  it("renders one tile per spec", () => {
    const { container, getByText } = render(
      <KPIStrip
        tiles={[
          { label: "Cap Rate", value: "8.2%" },
          { label: "Cashflow", value: "$642/mo" },
          { label: "IRR", value: "12.4%" },
          { label: "DSCR", value: "1.34" },
        ]}
      />,
    );
    expect(container.querySelectorAll("[data-kpi-tile]").length).toBe(4);
    expect(getByText("Cap Rate")).toBeTruthy();
    expect(getByText("DSCR")).toBeTruthy();
  });
});

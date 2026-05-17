import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Hero } from "../Hero";

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

describe("Hero", () => {
  it("renders VerdictBadge + AIQuoteHeader + KPIStrip", () => {
    const { container, getByText } = render(
      <Hero
        verdict="good"
        aiText="Strong cashflow play"
        kpiTiles={[
          { label: "Cap Rate", value: "8.2%" },
          { label: "Cashflow", value: "$642/mo" },
          { label: "IRR", value: "12.4%" },
          { label: "DSCR", value: "1.34" },
        ]}
      />,
    );
    expect(container.querySelector("[data-verdict-badge]")).toBeTruthy();
    expect(container.querySelector("[data-ai-quote-header]")).toBeTruthy();
    expect(container.querySelector("[data-kpi-strip]")).toBeTruthy();
    expect(getByText("Strong cashflow play")).toBeTruthy();
    expect(container.querySelectorAll("[data-kpi-tile]").length).toBe(4);
  });
});

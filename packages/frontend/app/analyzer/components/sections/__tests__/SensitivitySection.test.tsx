import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { SensitivitySection } from "../SensitivitySection";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 280 }}>
        <actual.ResponsiveContainer width={600} height={280}>
          {children as React.ReactElement}
        </actual.ResponsiveContainer>
      </div>
    ),
  };
});

const sensitivity = {
  baseIRR: 0.1,
  factors: [
    {
      name: "rate" as const,
      irrAtMinus10pct: 0.05,
      irrAtPlus10pct: 0.15,
      impactMagnitude: 0.05,
    },
    {
      name: "rent" as const,
      irrAtMinus10pct: 0.07,
      irrAtPlus10pct: 0.13,
      impactMagnitude: 0.03,
    },
    {
      name: "vacancy" as const,
      irrAtMinus10pct: 0.08,
      irrAtPlus10pct: 0.12,
      impactMagnitude: 0.02,
    },
  ],
};

const band = [
  { year: 1, value: 0.08, bandLow: 0.06, bandHigh: 0.1 },
  { year: 5, value: 0.1, bandLow: 0.07, bandHigh: 0.13 },
  { year: 10, value: 0.12, bandLow: 0.08, bandHigh: 0.16 },
];

describe("SensitivitySection", () => {
  it("renders both charts inside section", () => {
    const { container, getByText } = render(
      <SensitivitySection sensitivity={sensitivity} irrBandByYear={band} />,
    );
    expect(getByText("Sensitivity & Confidence")).toBeTruthy();
    expect(container.querySelectorAll("[data-tornado-row]").length).toBe(3);
    expect(container.querySelector(".recharts-area")).toBeTruthy();
    expect(container.querySelector(".recharts-line")).toBeTruthy();
  });
});

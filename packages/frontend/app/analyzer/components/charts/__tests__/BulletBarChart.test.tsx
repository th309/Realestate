import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BulletBarChart } from "../BulletBarChart";

// jsdom has no real layout, so ResponsiveContainer measures width=0 and
// Recharts skips rendering. Stub it with a fixed-size wrapper so child
// charts receive a real bounding box and emit their SVG nodes.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 400 }}>
        <actual.ResponsiveContainer width={800} height={400}>
          {children as React.ReactElement}
        </actual.ResponsiveContainer>
      </div>
    ),
  };
});

describe("BulletBarChart", () => {
  const data = [
    { label: "Y1", value: 0.08 },
    { label: "Y3", value: 0.1 },
    { label: "Y5", value: 0.12 },
    { label: "Y10", value: 0.14 },
  ];
  const zones = [
    { from: 0, to: 0.07, color: "negative" as const },
    { from: 0.07, to: 0.12, color: "caution" as const },
    { from: 0.12, to: 0.25, color: "positive" as const },
  ];

  it("renders bars per data point", () => {
    const { container } = render(
      <BulletBarChart data={data} benchmarkZones={zones} />,
    );
    expect(
      container.querySelectorAll(".recharts-bar-rectangle").length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("renders ReferenceArea per zone", () => {
    const { container } = render(
      <BulletBarChart data={data} benchmarkZones={zones} />,
    );
    expect(container.querySelectorAll(".recharts-reference-area").length).toBe(
      3,
    );
  });
});

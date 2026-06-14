import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TornadoChart } from "../TornadoChart";

describe("TornadoChart", () => {
  const factors = [
    {
      name: "rate",
      irrAtMinus10pct: 0.04,
      irrAtPlus10pct: 0.12,
      impactMagnitude: 0.04,
    },
    {
      name: "rent",
      irrAtMinus10pct: 0.06,
      irrAtPlus10pct: 0.1,
      impactMagnitude: 0.02,
    },
    {
      name: "vacancy",
      irrAtMinus10pct: 0.075,
      irrAtPlus10pct: 0.085,
      impactMagnitude: 0.005,
    },
  ];

  it("renders one row per factor", () => {
    const { container } = render(
      <TornadoChart factors={factors} baseIRR={0.08} />,
    );
    expect(container.querySelectorAll("[data-tornado-row]").length).toBe(3);
  });

  it("rows are sorted descending by impactMagnitude", () => {
    const { container } = render(
      <TornadoChart factors={factors} baseIRR={0.08} />,
    );
    const order = Array.from(
      container.querySelectorAll("[data-tornado-row]"),
    ).map((el) => el.getAttribute("data-tornado-row"));
    expect(order).toEqual(["rate", "rent", "vacancy"]);
  });
});

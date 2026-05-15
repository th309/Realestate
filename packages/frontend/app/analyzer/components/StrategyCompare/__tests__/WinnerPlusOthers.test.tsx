import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { WinnerPlusOthers } from "../WinnerPlusOthers";

const strategies = [
  {
    key: "buyAndHold" as const,
    title: "Buy & Hold",
    heroLabel: "Cap Rate",
    heroValue: "8.2%",
    full: <div>BAH FULL</div>,
    summary: [{ label: "Cashflow", value: "$642/mo" }],
  },
  {
    key: "flip" as const,
    title: "Flip",
    heroLabel: "ROI",
    heroValue: "22.4%",
    full: <div>FLIP FULL</div>,
    summary: [{ label: "Profit", value: "$48K" }],
  },
  {
    key: "brrrr" as const,
    title: "BRRRR",
    heroLabel: "Score",
    heroValue: "85",
    full: <div>BRRRR FULL</div>,
    summary: [{ label: "Cash left", value: "$8K" }],
  },
];

describe("WinnerPlusOthers", () => {
  it("winner gets full block, others get summaries", () => {
    const { container, getByText } = render(
      <WinnerPlusOthers winnerKey="brrrr" strategies={strategies} />,
    );
    expect(
      container.querySelector("[data-strategy-full='brrrr']"),
    ).toBeTruthy();
    expect(getByText("BRRRR FULL")).toBeTruthy();
    expect(container.querySelectorAll("[data-strategy-summary]").length).toBe(
      2,
    );
  });

  it("clicking a summary swaps expanded state", () => {
    const { container, getByText, queryByText } = render(
      <WinnerPlusOthers winnerKey="brrrr" strategies={strategies} />,
    );
    fireEvent.click(container.querySelector("[data-strategy-summary='flip']")!);
    expect(getByText("FLIP FULL")).toBeTruthy();
    expect(queryByText("BRRRR FULL")).toBeFalsy();
    expect(container.querySelector("[data-strategy-full='flip']")).toBeTruthy();
  });
});

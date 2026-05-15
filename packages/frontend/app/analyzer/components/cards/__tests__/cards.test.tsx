import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ComparisonCard } from "../ComparisonCard";
import { MaoScaleCard } from "../MaoScaleCard";
import { PrePostBarCard } from "../PrePostBarCard";

describe("ComparisonCard", () => {
  it("renders both sides with primary numbers", () => {
    const { getByText, container } = render(
      <ComparisonCard
        left={{
          title: "Buy & Hold",
          primary: "8.2%",
          secondary: "Cap Rate",
          tone: "ok",
        }}
        right={{
          title: "BRRRR",
          primary: "12.4%",
          secondary: "Cap Rate",
          tone: "primary",
        }}
      />,
    );
    expect(getByText("8.2%")).toBeTruthy();
    expect(getByText("12.4%")).toBeTruthy();
    expect(container.querySelector("[data-comparison-card]")).toBeTruthy();
  });
});

describe("MaoScaleCard", () => {
  it("renders ARV / MAO / Ask labels", () => {
    const { getByText, container } = render(
      <MaoScaleCard arv={300_000} mao={210_000} asking={240_000} />,
    );
    expect(container.querySelector("[data-mao-scale-card]")).toBeTruthy();
    expect(getByText(/MAO/)).toBeTruthy();
    expect(getByText(/Ask/)).toBeTruthy();
    expect(getByText(/ARV/)).toBeTruthy();
  });
});

describe("PrePostBarCard", () => {
  it("renders pre + post bars + delta", () => {
    const { container } = render(<PrePostBarCard pre={300} post={850} />);
    expect(container.querySelector("[data-pre-post-bar-card]")).toBeTruthy();
    expect(container.querySelector("[data-pre-bar]")).toBeTruthy();
    expect(container.querySelector("[data-post-bar]")).toBeTruthy();
    expect(container.querySelector("[data-delta]")?.textContent).toMatch(/↑/);
  });
});

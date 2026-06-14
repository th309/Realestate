import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketNow } from "../MarketNow";

describe("MarketNow", () => {
  const stats = [
    {
      lbl: "Median price",
      val: "$425K",
      delta: "+1.5%",
      deltaDir: "up" as const,
    },
    {
      lbl: "Days on market",
      val: "23",
      delta: "-2 days",
      deltaDir: "down" as const,
    },
    {
      lbl: "Months supply",
      val: "1.8",
      delta: "flat",
      deltaDir: "flat" as const,
    },
  ];

  it("renders limited-data branch when limitedData=true", () => {
    render(<MarketNow stats={[]} limitedData={true} />);
    expect(screen.getByText(/limited data/i)).toBeInTheDocument();
  });

  it("renders limited-data branch when stats is empty", () => {
    render(<MarketNow stats={[]} limitedData={false} />);
    expect(screen.getByText(/limited data/i)).toBeInTheDocument();
  });

  it("renders one card per stat", () => {
    render(<MarketNow stats={stats} limitedData={false} />);
    expect(screen.getByText("Median price")).toBeInTheDocument();
    expect(screen.getByText("$425K")).toBeInTheDocument();
    expect(screen.getByText("Days on market")).toBeInTheDocument();
  });

  it("renders deltas with correct semantic class for up direction", () => {
    const { container } = render(
      <MarketNow stats={[stats[0]]} limitedData={false} />,
    );
    const delta = container.querySelector("p.text-tertiary");
    expect(delta).toBeTruthy();
    expect(delta?.textContent).toBe("+1.5%");
  });

  it("renders deltas with correct semantic class for down direction", () => {
    const { container } = render(
      <MarketNow stats={[stats[1]]} limitedData={false} />,
    );
    const delta = container.querySelector("p.text-error");
    expect(delta).toBeTruthy();
  });

  it("does not render delta when not provided", () => {
    render(<MarketNow stats={[{ lbl: "X", val: "Y" }]} limitedData={false} />);
    expect(screen.queryByText("+")).toBeNull();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(
      <MarketNow stats={stats} limitedData={false} />,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

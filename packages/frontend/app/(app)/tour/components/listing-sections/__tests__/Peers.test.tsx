import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Peers } from "../Peers";

describe("Peers", () => {
  const peers = [
    {
      name: "Boise, ID",
      scoreLabel: "PropertyIQ 84 · GREAT",
      medianPrice: "$465K",
      yoyGrowth: "+4.8%",
      dom: "26",
      saleToList: "31%",
      isSource: true,
    },
    {
      name: "Reno, NV",
      scoreLabel: "PropertyIQ 79 · GOOD",
      medianPrice: "$520K",
      yoyGrowth: "+3.2%",
      dom: "29",
      saleToList: "26%",
    },
    {
      name: "Spokane, WA",
      scoreLabel: "PropertyIQ 76 · GOOD",
      medianPrice: "$410K",
      yoyGrowth: "+3.7%",
      dom: "31",
      saleToList: "24%",
    },
  ];

  it("renders limited-data branch when limitedData=true", () => {
    render(<Peers peers={[]} limitedData={true} />);
    expect(
      screen.getByText(/no comparable peer markets available/i),
    ).toBeInTheDocument();
  });

  it("renders limited-data branch when peers is empty", () => {
    render(<Peers peers={[]} limitedData={false} />);
    expect(
      screen.getByText(/no comparable peer markets available/i),
    ).toBeInTheDocument();
  });

  it("renders one card per peer with all stats", () => {
    render(<Peers peers={peers} limitedData={false} />);
    expect(screen.getByText("Boise, ID")).toBeInTheDocument();
    expect(screen.getByText("Reno, NV")).toBeInTheDocument();
    expect(screen.getByText("Spokane, WA")).toBeInTheDocument();
    expect(screen.getByText("$465K")).toBeInTheDocument();
    expect(screen.getByText("+4.8%")).toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(<Peers peers={peers} limitedData={false} />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Migration } from "../Migration";

describe("Migration", () => {
  const inflows = [
    { fromName: "Los Angeles, CA", count: 1240 },
    { fromName: "Seattle, WA", count: 980 },
    { fromName: "Portland, OR", count: 860 },
    { fromName: "San Francisco, CA", count: 720 },
    { fromName: "Phoenix, AZ", count: 510 },
  ];
  const demographics = [
    { lbl: "Median household income", val: "$78,400" },
    { lbl: "Median age", val: "37.2" },
    { lbl: "Population growth (5yr)", val: "+8.1%" },
  ];

  it("renders limited-data branch when limitedData=true", () => {
    render(<Migration inflows={[]} demographics={[]} limitedData={true} />);
    expect(screen.getByText(/migration data is limited/i)).toBeInTheDocument();
  });

  it("renders top inflows with formatted counts", () => {
    render(
      <Migration
        inflows={inflows}
        demographics={demographics}
        limitedData={false}
      />,
    );
    expect(screen.getByText("Los Angeles, CA")).toBeInTheDocument();
    expect(screen.getByText("+1,240")).toBeInTheDocument();
    expect(screen.getByText("+510")).toBeInTheDocument();
  });

  it("renders demographic rows with labels and values", () => {
    render(
      <Migration
        inflows={inflows}
        demographics={demographics}
        limitedData={false}
      />,
    );
    expect(screen.getByText("Median household income")).toBeInTheDocument();
    expect(screen.getByText("$78,400")).toBeInTheDocument();
    expect(screen.getByText("+8.1%")).toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(
      <Migration
        inflows={inflows}
        demographics={demographics}
        limitedData={false}
      />,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Employment } from "../Employment";

describe("Employment", () => {
  const sectors = [
    { label: "Healthcare", value: 18, max: 30 },
    { label: "Tech", value: 14, max: 30 },
    { label: "Manufacturing", value: 11, max: 30 },
  ];
  const signals = [
    { label: "Wage growth", value: 4.2, max: 8, suffix: "%" },
    { label: "Unemployment", value: 3.6, max: 8, suffix: "%" },
  ];

  it("renders limited-data branch when limitedData=true", () => {
    render(<Employment sectors={[]} signals={[]} limitedData={true} />);
    expect(
      screen.getByText(/sector breakdown unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders both sector and signal panels with their titles", () => {
    render(
      <Employment sectors={sectors} signals={signals} limitedData={false} />,
    );
    expect(screen.getByText("Employment by sector")).toBeInTheDocument();
    expect(screen.getByText("Labor market signals")).toBeInTheDocument();
  });

  it("renders sector and signal labels via EmploymentBars", () => {
    render(
      <Employment sectors={sectors} signals={signals} limitedData={false} />,
    );
    expect(screen.getByText("Healthcare")).toBeInTheDocument();
    expect(screen.getByText("Wage growth")).toBeInTheDocument();
  });

  it("does not hardcode hex colors", () => {
    const { container } = render(
      <Employment sectors={sectors} signals={signals} limitedData={false} />,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

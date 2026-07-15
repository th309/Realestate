import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopMoversList } from "../TopMoversList";

describe("TopMoversList", () => {
  const movers = [
    {
      region: { id: "A", name: "Austin", state: "TX", population: null },
      delta: 4.2,
      score: 61,
    },
    {
      region: { id: "B", name: "Miami", state: "FL", population: null },
      delta: -3.1,
      score: 44,
    },
  ];
  it("renders movers and selects on click", () => {
    const onSelect = vi.fn();
    render(<TopMoversList movers={movers as any} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Austin"));
    expect(onSelect).toHaveBeenCalledWith("A");
    expect(screen.getByText("Miami")).toBeTruthy();
  });
});

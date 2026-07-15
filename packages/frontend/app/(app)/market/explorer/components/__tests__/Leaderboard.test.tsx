import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Leaderboard } from "../Leaderboard";

const rows = [
  {
    id: "A",
    rank: "01",
    name: "Austin",
    sub: "TX · $455K",
    valueLabel: "RISING",
    valueColor: "var(--md-primary)",
    score: 61,
    scoreBg: "x",
    scoreColor: "y",
    spark: [1, 2, 3],
    markerIndex: 2,
  },
];

describe("Leaderboard", () => {
  it("renders rows and selects on click", () => {
    const onSelect = vi.fn();
    render(
      <Leaderboard
        title="Rankings — metros in U.S."
        monthLabel="May '26"
        rows={rows}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Austin"));
    expect(onSelect).toHaveBeenCalledWith("A");
    expect(screen.getByText(/Rankings/)).toBeTruthy();
  });
});

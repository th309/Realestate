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
  {
    id: "B",
    rank: "02",
    name: "Boston",
    sub: "MA · $520K",
    valueLabel: "STEADY",
    valueColor: "var(--md-secondary)",
    score: 50,
    scoreBg: "z",
    scoreColor: "w",
    spark: [2, 3, 4],
    markerIndex: 1,
  },
];

describe("Leaderboard", () => {
  it("renders header with title and month label", () => {
    render(
      <Leaderboard
        title="Rankings — metros in U.S."
        monthLabel="May '26"
        rows={[]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/Rankings/)).toBeTruthy();
    expect(screen.getByText("May '26")).toBeTruthy();
  });

  it("renders row content: rank, name, sub, value label, score", () => {
    render(
      <Leaderboard
        title="Rankings"
        monthLabel="May '26"
        rows={rows}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("Austin")).toBeTruthy();
    expect(screen.getByText("TX · $455K")).toBeTruthy();
    expect(screen.getByText("RISING")).toBeTruthy();
    expect(screen.getByText("61")).toBeTruthy();
    expect(screen.getByText("02")).toBeTruthy();
    expect(screen.getByText("Boston")).toBeTruthy();
    expect(screen.getByText("50")).toBeTruthy();
  });

  it("applies selection highlight style to selected row", () => {
    const { container } = render(
      <Leaderboard
        title="Rankings"
        monthLabel="May '26"
        rows={rows}
        selectedId="A"
        onSelect={vi.fn()}
      />,
    );
    const rowButtons = container.querySelectorAll('[role="button"]');
    const selectedRow = rowButtons[0];
    const background = window
      .getComputedStyle(selectedRow)
      .getPropertyValue("background");
    expect(background).toContain("color-mix");
  });

  it("calls onSelect with row id on click", () => {
    const onSelect = vi.fn();
    render(
      <Leaderboard
        title="Rankings"
        monthLabel="May '26"
        rows={rows}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Austin"));
    expect(onSelect).toHaveBeenCalledWith("A");
  });

  it("calls onSelect on keyboard Enter", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <Leaderboard
        title="Rankings"
        monthLabel="May '26"
        rows={rows}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    const rowButton = container.querySelector('[role="button"]');
    fireEvent.keyDown(rowButton!, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("A");
  });

  it("calls onSelect on keyboard Space", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <Leaderboard
        title="Rankings"
        monthLabel="May '26"
        rows={rows}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    const rowButton = container.querySelector('[role="button"]');
    fireEvent.keyDown(rowButton!, { key: " " });
    expect(onSelect).toHaveBeenCalledWith("A");
  });

  it("renders Sparkline for each row with correct props", () => {
    const { container } = render(
      <Leaderboard
        title="Rankings"
        monthLabel="May '26"
        rows={rows}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
    svgs.forEach((svg) => {
      expect(svg.getAttribute("width")).toBe("92");
      expect(svg.getAttribute("height")).toBe("26");
      expect(svg.querySelector("path")).toBeTruthy();
    });
  });

  it("sets rows as keyboard accessible with role button and tabIndex", () => {
    const { container } = render(
      <Leaderboard
        title="Rankings"
        monthLabel="May '26"
        rows={rows}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const rowButtons = container.querySelectorAll('[role="button"]');
    expect(rowButtons.length).toBe(2);
    rowButtons.forEach((button) => {
      expect(button.getAttribute("tabindex")).toBe("0");
    });
  });
});

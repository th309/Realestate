import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiTile } from "../KpiTile";
import { ScorePill } from "../ScorePill";
import { JumpBar } from "../JumpBar";
import { DataTable } from "../DataTable";

describe("KpiTile", () => {
  it("renders label, value, and caption", () => {
    render(<KpiTile label="DSCR" value="0.74" caption="NOI / debt service" />);
    expect(screen.getByText("DSCR")).toBeInTheDocument();
    expect(screen.getByText("0.74")).toBeInTheDocument();
    expect(screen.getByText("NOI / debt service")).toBeInTheDocument();
  });

  it("renders the value in monospace with tabular figures", () => {
    render(<KpiTile label="Cash flow" value="−$386" />);
    const v = screen.getByText("−$386");
    expect(v.className).toContain("font-mono");
    expect(v.className).toContain("tabular-nums");
  });

  it("carries the accent as a left stripe", () => {
    const { container } = render(
      <KpiTile label="L" value="1" accent="error" />,
    );
    expect(container.firstElementChild?.className).toContain("border-l-error");
  });
});

describe("ScorePill", () => {
  it("renders the score in monospace", () => {
    render(<ScorePill score={75} />);
    const v = screen.getByText("75");
    expect(v.className).toContain("font-mono");
  });

  it("renders a momentum label, never a quality word", () => {
    render(<ScorePill score={75} showLabel />);
    const text = screen.getByTestId("score-pill").textContent ?? "";
    expect(text).toMatch(/RISING/i);
    expect(text).not.toMatch(/excellent|poor|good|bad/i);
  });

  it("clamps display to the 1-99 scale", () => {
    render(<ScorePill score={100} />);
    expect(screen.getByText("99")).toBeInTheDocument();
  });
});

describe("JumpBar", () => {
  const items = [
    { id: "verdict", label: "Verdict", icon: <svg />, accent: "bg-error" },
    { id: "cashflow", label: "Cash Flow", icon: <svg />, accent: "bg-primary" },
  ];

  it("renders one anchor per item", () => {
    render(<JumpBar items={items} activeId="verdict" />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("links each item to its section anchor", () => {
    render(<JumpBar items={items} activeId="verdict" />);
    expect(screen.getByRole("link", { name: /Verdict/ })).toHaveAttribute(
      "href",
      "#verdict",
    );
  });

  it("marks the active item", () => {
    render(<JumpBar items={items} activeId="cashflow" />);
    expect(screen.getByRole("link", { name: /Cash Flow/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});

type Row = { market: string; score: number; value: string };

const COLUMNS = [
  { key: "market" as const, header: "Market", align: "left" as const },
  { key: "score" as const, header: "Score", align: "right" as const },
  { key: "value" as const, header: "Median value", align: "right" as const },
];

const ROWS: Row[] = [
  { market: "Buffalo, NY", score: 98, value: "$248,700" },
  { market: "Seattle, WA", score: 16, value: "$775,549" },
];

describe("DataTable", () => {
  it("renders a header cell per column", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });

  it("renders a row per datum", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2
  });

  it("right-aligns numeric columns in monospace", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    const cell = screen.getByText("$248,700");
    expect(cell.className).toContain("text-right");
    expect(cell.className).toContain("font-mono");
    expect(cell.className).toContain("tabular-nums");
  });

  it("leaves the left column in the sans face", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.getByText("Buffalo, NY").className).not.toContain(
      "font-mono",
    );
  });

  it("marks the sorted column for assistive tech", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        sortKey="score"
        sortDir="desc"
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Score/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });
});

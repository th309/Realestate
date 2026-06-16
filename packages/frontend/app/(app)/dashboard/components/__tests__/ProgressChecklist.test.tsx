import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressChecklist } from "../ProgressChecklist";

describe("ProgressChecklist", () => {
  it("shows the value-framed items including the flagged Connect Claude task", () => {
    render(<ProgressChecklist completedTasks={["view_score"]} />);
    expect(
      screen.getByText(/Connect PropertyIQ to Claude/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Analyze a property/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Save a market to your watchlist/i),
    ).toBeInTheDocument();
  });

  it("links the Connect Claude item to the MCP docs", () => {
    render(<ProgressChecklist completedTasks={["view_score"]} />);
    const link = screen.getByText(/Connect PropertyIQ to Claude/i).closest("a");
    expect(link).toHaveAttribute("href", "/docs/mcp");
  });

  it("does not auto-complete a create_account seed (it is no longer a list item)", () => {
    // With nothing completed, progress should reflect 0 of the 7 value-framed
    // items — the legacy create_account auto-seed has been dropped.
    render(<ProgressChecklist completedTasks={[]} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

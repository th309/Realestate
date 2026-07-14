import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockDismiss = vi.fn();

vi.mock("@/lib/data", () => ({
  dismissBeaconTask: (...args: unknown[]) => {
    mockDismiss(...args);
    return Promise.resolve();
  },
}));

import { ProgressChecklist } from "../ProgressChecklist";

describe("ProgressChecklist", () => {
  it("shows the value-framed items including the flagged Connect Claude task", () => {
    render(
      <ProgressChecklist
        completedTasks={["view_score"]}
        dismissedBeacons={[]}
      />,
    );
    expect(
      screen.getByText(/Connect PropertyIQ to Claude/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Analyze a property/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Save a market to your watchlist/i),
    ).toBeInTheDocument();
  });

  it("links the Connect Claude item to the MCP docs", () => {
    render(
      <ProgressChecklist
        completedTasks={["view_score"]}
        dismissedBeacons={[]}
      />,
    );
    const link = screen.getByText(/Connect PropertyIQ to Claude/i).closest("a");
    expect(link).toHaveAttribute("href", "/docs/mcp");
  });

  it("does not auto-complete a create_account seed (it is no longer a list item)", () => {
    // With nothing completed, progress should reflect 0 of the 7 value-framed
    // items — the legacy create_account auto-seed has been dropped.
    render(<ProgressChecklist completedTasks={[]} dismissedBeacons={[]} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("stays hidden on load when the server already recorded the dismiss beacon", () => {
    render(
      <ProgressChecklist
        completedTasks={[]}
        dismissedBeacons={["dashboard-onboarding-checklist"]}
      />,
    );
    expect(screen.queryByText("Getting Started")).not.toBeInTheDocument();
  });

  it("hides immediately and persists the dismissal via dismissBeaconTask on click", () => {
    render(<ProgressChecklist completedTasks={[]} dismissedBeacons={[]} />);
    expect(screen.getByText("Getting Started")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Dismiss checklist"));

    expect(screen.queryByText("Getting Started")).not.toBeInTheDocument();
    expect(mockDismiss).toHaveBeenCalledWith("dashboard-onboarding-checklist");
  });
});

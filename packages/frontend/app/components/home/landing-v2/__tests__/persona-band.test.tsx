import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PersonaBand } from "../persona/PersonaBand";

/**
 * @testing-library/user-event is not a dependency of this package, so pointer
 * and keyboard interaction is driven with fireEvent, matching the sibling
 * tests in this folder.
 */

vi.mock("@/lib/analytics/tracker", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/entitlements/AnonCaptureModal", () => ({
  AnonCaptureModal: () => null,
}));

function activePanel() {
  return screen.getByRole("tabpanel");
}

describe("PersonaBand offers both audiences from the mockup", () => {
  it("opens on the investor panel", () => {
    render(<PersonaBand />);
    expect(screen.getByRole("tab", { name: /For Investors/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      within(activePanel()).getByRole("heading", { level: 3 }),
    ).toHaveTextContent("For Investors");
  });

  it("reproduces the investor proof points verbatim from the mockup", () => {
    render(<PersonaBand />);
    const checks = within(activePanel())
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(checks).toEqual([
      "One 1–99 score per metro, county, and ZIP — updated monthly",
      "Calibrated so 50 equals that market's own state average",
      "Backtested to 2001; markets scoring 45–55 realized ≈0 excess return",
      "Confidence grade on every score, so you know what the data supports",
      "Drill metro → county → ZIP without changing tools",
    ]);
  });

  it("swaps to the agent panel when its toggle is chosen", () => {
    render(<PersonaBand />);
    fireEvent.click(screen.getByRole("tab", { name: /For Agents/ }));

    expect(
      within(activePanel()).getByRole("heading", { level: 3 }),
    ).toHaveTextContent("For Agents & Syndicators");
    expect(screen.getByRole("tab", { name: /For Investors/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    // The investor copy must be gone, not merely hidden behind it.
    expect(screen.queryByText(/Buy the trend, not the story/)).toBeNull();
  });

  it("gives the agent panel its own proof points, not a copy of the investor's", () => {
    render(<PersonaBand />);
    const investorChecks = within(activePanel())
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    fireEvent.click(screen.getByRole("tab", { name: /For Agents/ }));
    const agentChecks = within(activePanel())
      .getAllByRole("listitem")
      .map((li) => li.textContent);

    expect(agentChecks).toHaveLength(5);
    expect(agentChecks).not.toEqual(investorChecks);
    expect(agentChecks.some((c) => /MCP/.test(c ?? ""))).toBe(true);
  });

  it("moves between toggles with the arrow keys", () => {
    render(<PersonaBand />);
    const investors = screen.getByRole("tab", { name: /For Investors/ });
    investors.focus();
    fireEvent.keyDown(investors, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /For Agents/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  /**
   * The score is 1-99 and is calibrated to the market's own STATE average.
   * Copy saying 0-100, or describing the ranking as happening within a state,
   * contradicts CLAUDE.md section 9.
   */
  it("describes the score as 1-99 against a state average, never 0-100", () => {
    const { container } = render(<PersonaBand />);
    let text = container.textContent ?? "";
    fireEvent.click(screen.getByRole("tab", { name: /For Agents/ }));
    text += container.textContent ?? "";

    expect(text).not.toMatch(/0[–-]100/);
    expect(text).not.toMatch(/ranked within (its|the|each) state/i);
  });

  it("points the methodology link at the methodology page", () => {
    render(<PersonaBand />);
    expect(
      screen.getByRole("link", { name: /See the methodology/ }),
    ).toHaveAttribute("href", "/scores/methodology");
  });
});

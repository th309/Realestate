import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { formatMarketsScored } from "@/lib/data";
import { PlatformFeatures } from "../PlatformFeatures";

/**
 * @testing-library/user-event is not a dependency of this package, so keyboard
 * and pointer interaction is driven with fireEvent from @testing-library/react.
 */

describe("PlatformFeatures filters the card grid by category", () => {
  it("shows only the three Scoring & Forecasts cards before any chip is clicked", () => {
    render(<PlatformFeatures />);
    const panel = screen.getByRole("tabpanel");

    expect(
      within(panel).getByRole("heading", { name: "PropertyIQ Score" }),
    ).toBeTruthy();
    expect(
      within(panel).getByRole("heading", { name: "Validated backtest" }),
    ).toBeTruthy();
    expect(
      within(panel).getByRole("heading", { name: "Home value forecasts" }),
    ).toBeTruthy();
    expect(within(panel).getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("hides the Maps & Discovery and AI & Delivery cards on the default tab", () => {
    render(<PlatformFeatures />);

    expect(
      screen.queryByRole("heading", { name: "Interactive map" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Market screener" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "MCP for Claude" }),
    ).toBeNull();
  });

  it("swaps the grid to the two Maps & Discovery cards when that chip is clicked", () => {
    render(<PlatformFeatures />);
    fireEvent.click(screen.getByRole("tab", { name: "Maps & Discovery" }));
    const panel = screen.getByRole("tabpanel");

    expect(
      within(panel).getByRole("heading", { name: "Interactive map" }),
    ).toBeTruthy();
    expect(
      within(panel).getByRole("heading", { name: "Market screener" }),
    ).toBeTruthy();
    expect(within(panel).getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(
      screen.queryByRole("heading", { name: "PropertyIQ Score" }),
    ).toBeNull();
  });

  it("swaps the grid to the single AI & Delivery card when that chip is clicked", () => {
    render(<PlatformFeatures />);
    fireEvent.click(screen.getByRole("tab", { name: "AI & Delivery" }));
    const panel = screen.getByRole("tabpanel");

    expect(
      within(panel).getByRole("heading", { name: "MCP for Claude" }),
    ).toBeTruthy();
    expect(within(panel).getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });
});

describe("PlatformFeatures chips behave as an accessible tablist", () => {
  it("marks only the default chip aria-selected on first render", () => {
    render(<PlatformFeatures />);

    expect(
      screen.getByRole("tab", { name: "Scoring & Forecasts" }).ariaSelected,
    ).toBe("true");
    expect(
      screen.getByRole("tab", { name: "Maps & Discovery" }).ariaSelected,
    ).toBe("false");
    expect(
      screen.getByRole("tab", { name: "AI & Delivery" }).ariaSelected,
    ).toBe("false");
  });

  it("moves aria-selected to the clicked chip", () => {
    render(<PlatformFeatures />);
    fireEvent.click(screen.getByRole("tab", { name: "AI & Delivery" }));

    expect(
      screen.getByRole("tab", { name: "AI & Delivery" }).ariaSelected,
    ).toBe("true");
    expect(
      screen.getByRole("tab", { name: "Scoring & Forecasts" }).ariaSelected,
    ).toBe("false");
  });

  it("selects the next chip on ArrowRight and wraps at the end", () => {
    render(<PlatformFeatures />);
    const firstTab = screen.getByRole("tab", { name: "Scoring & Forecasts" });

    fireEvent.keyDown(firstTab, { key: "ArrowRight" });
    expect(
      screen.getByRole("tab", { name: "Maps & Discovery" }).ariaSelected,
    ).toBe("true");

    fireEvent.keyDown(screen.getByRole("tab", { name: "Maps & Discovery" }), {
      key: "ArrowRight",
    });
    fireEvent.keyDown(screen.getByRole("tab", { name: "AI & Delivery" }), {
      key: "ArrowRight",
    });
    expect(
      screen.getByRole("tab", { name: "Scoring & Forecasts" }).ariaSelected,
    ).toBe("true");
  });

  it("selects the previous chip on ArrowLeft, wrapping to the last chip", () => {
    render(<PlatformFeatures />);
    fireEvent.keyDown(
      screen.getByRole("tab", { name: "Scoring & Forecasts" }),
      {
        key: "ArrowLeft",
      },
    );

    expect(
      screen.getByRole("tab", { name: "AI & Delivery" }).ariaSelected,
    ).toBe("true");
    expect(
      screen.getByRole("heading", { name: "MCP for Claude" }),
    ).toBeTruthy();
  });

  it("labels the tabpanel with the currently selected tab", () => {
    render(<PlatformFeatures />);
    fireEvent.click(screen.getByRole("tab", { name: "Maps & Discovery" }));

    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
      screen.getByRole("tab", { name: "Maps & Discovery" }).id,
    );
  });
});

describe("PlatformFeatures sources coverage copy from the data layer", () => {
  it("renders the markets-scored stat from formatMarketsScored, not a literal", () => {
    render(<PlatformFeatures />);
    const scoreCard = screen
      .getByRole("heading", { name: "PropertyIQ Score" })
      .closest("article");

    const stat = scoreCard?.querySelector(".font-mono")?.textContent ?? "";
    expect(stat).toMatch(/^[\d,]+\+ markets scored$/);
    expect(stat).toBe(`${formatMarketsScored()} markets scored`);
  });

  it("paints every icon tile with semantic tokens rather than hardcoded hex", () => {
    const { container } = render(<PlatformFeatures />);
    expect(container.innerHTML).not.toMatch(/\[#[0-9A-Fa-f]{3,8}\]/);
  });
});

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fmtUsd } from "../lib/format-helpers";
import { MetricBlock } from "../components/primitives/MetricBlock";
import { AnalyzerEmptyState } from "../components/chrome/AnalyzerEmptyState";

const read = (rel: string) =>
  readFileSync(join(__dirname, "..", rel), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

const CLIENT = read("AnalyzerClient.tsx");
const KPI = read("components/Hero/StrategyKPI.tsx");
const PANEL = read("components/InputPanel/InputPanel.tsx");
const NUM_FIELD = read("components/InputPanel/NumField.tsx");
const SIDEBAR = read("components/chrome/AnalyzerSidebar.tsx");
const SECTIONS = read("components/AnalyzerSections.tsx");
const GRADING = read("components/cards/GradingResultPanel.tsx");

describe("analyzer defers to the shared primitives", () => {
  it("renders KPIs through the shared tile, not bespoke markup", () => {
    expect(KPI).toContain("KpiTile");
  });

  it("offers in-page navigation for the long results column", () => {
    expect(CLIENT).toContain("JumpBar");
  });

  it("uses no arbitrary hex", () => {
    expect(CLIENT + KPI + PANEL).not.toMatch(/\[#[0-9A-Fa-f]{3,8}\]/);
  });
});

/**
 * The input panel used to render a vertical scrollbar AND a horizontal one at
 * once: each NumField's <input> is a flex item, and a flex item defaults to
 * min-width:auto, so it refused to shrink below the browser's intrinsic ~20ch
 * input width and pushed the two-up grid 30px past the panel's edge. The fix
 * is CSS-only, so guard it where it lives rather than let it silently return.
 */
describe("analyzer input panel cannot overflow its column", () => {
  it("lets the number input shrink inside its grid cell", () => {
    expect(NUM_FIELD).toMatch(/min-w-0[^"]*flex-1|flex-1[^"]*min-w-0/);
  });

  it("lets every field-grid cell shrink below its intrinsic width", () => {
    expect(PANEL).toContain("[&>*]:min-w-0");
  });

  it("does not nest a scroll container inside the page scroll by default", () => {
    // A max-height guard is allowed so a tall variant stays reachable, but the
    // column must not be a fixed-height scroll box.
    expect(SIDEBAR).toContain("sticky");
    expect(SIDEBAR).not.toContain("h-screen");
  });
});

describe("analyzer pairs its widest blocks two-up on wide viewports", () => {
  it("puts the projection beside the cash-flow waterfall", () => {
    expect(SECTIONS).toContain("min-[1240px]:grid-cols-2");
  });

  it("puts the grading table beside the improvement levers", () => {
    expect(GRADING).toContain("min-[1240px]:grid-cols-2");
  });
});

describe("analyzer empty state explains the page instead of faking it", () => {
  it("renders no dead KPI row or $0 chart before there is input", () => {
    // The KPI row and the sections only mount once a deal is gradable.
    expect(CLIENT).toMatch(/hasGradableInput && \(\s*<div id="cashflow"/);
    expect(CLIENT).toMatch(/hasGradableInput && \(\s*<AnalyzerSections/);
    expect(CLIENT).toContain("AnalyzerEmptyState");
  });

  it("keeps a working entry point into the inputs", () => {
    const onStart = vi.fn();
    render(<AnalyzerEmptyState onStart={onStart} />);
    fireEvent.click(
      screen.getByRole("button", { name: /enter a property address/i }),
    );
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("previews every section the jump bar navigates to", () => {
    render(<AnalyzerEmptyState onStart={() => {}} />);
    for (const section of [
      "Cash flow",
      "Grading",
      "Projection",
      "Expenses",
      "Comps",
      "Market",
    ]) {
      expect(screen.getByText(section)).toBeInTheDocument();
    }
  });
});

/**
 * One number format per quantity type per screen.
 *
 * The same monthly cash flow rendered as "−$386.00" in a KPI card (MetricBlock,
 * true minus, two decimals) and "-$386" in the grading table (fmtUsd, ASCII
 * hyphen, whole dollars). Two glyphs and two precisions for one quantity on one
 * screen is a defect, so both formatters must agree exactly.
 */
describe("analyzer currency formatting is singular", () => {
  it("fmtUsd uses a true minus sign, not a hyphen", () => {
    expect(fmtUsd(-386)).toBe("−$386");
    expect(fmtUsd(-386)).not.toContain("-");
  });

  it("fmtUsd renders whole dollars", () => {
    expect(fmtUsd(1234.56)).toBe("$1,235");
  });

  it("MetricBlock currency matches fmtUsd for the same value", () => {
    render(<MetricBlock label="Cash flow" value={-386} format="currency" />);
    expect(screen.getByText(fmtUsd(-386))).toBeInTheDocument();
  });

  it("MetricBlock currency drops cents under $1,000", () => {
    render(<MetricBlock label="Cash flow" value={-386} format="currency" />);
    expect(screen.queryByText(/−\$386\.00/)).toBeNull();
  });

  it("agrees on positive values too", () => {
    render(<MetricBlock label="NOI" value={4073} format="currency" />);
    expect(screen.getByText(fmtUsd(4073))).toBeInTheDocument();
  });
});

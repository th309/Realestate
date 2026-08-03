import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fmtUsd } from "../lib/format-helpers";
import { MetricBlock } from "../components/primitives/MetricBlock";

const read = (rel: string) =>
  readFileSync(join(__dirname, "..", rel), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

const CLIENT = read("AnalyzerClient.tsx");
const KPI = read("components/Hero/StrategyKPI.tsx");
const PANEL = read("components/InputPanel/InputPanel.tsx");

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

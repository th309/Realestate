import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PresetChips, PRESETS } from "../components/PresetChips";

const read = (rel: string) =>
  readFileSync(join(__dirname, "..", rel), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

const TABLE = read("components/ScreenerTable.tsx");
const PRESET_CHIPS = read("components/PresetChips.tsx");
const FILTERS = read("components/ScreenerFilters.tsx");
const PAGE = read("ScreenerPageInner.tsx");

describe("screener defers to the shared primitives", () => {
  it("renders results through the shared DataTable", () => {
    expect(TABLE).toContain("DataTable");
  });

  it("renders the score column as a ScorePill", () => {
    // Colour and momentum label must come from getScoreColor/getScoreLabel via
    // the pill, so a screener row can never disagree with the same market's
    // score shown on /market or in a report.
    expect(TABLE).toContain("ScorePill");
  });

  it("renders presets through the shared Chip", () => {
    // Not just `toContain("Chip")` — that matches the filename's own
    // "PresetChips" and passes before the work is done.
    expect(PRESET_CHIPS).toMatch(/<Chip[\s/>]/);
    expect(PRESET_CHIPS).toMatch(
      /import\s*\{[^}]*\bChip\b[^}]*\}\s*from\s*["']@\/app\/components\/marketing/,
    );
  });

  it("uses no arbitrary hex", () => {
    expect(TABLE + PRESET_CHIPS + FILTERS + PAGE).not.toMatch(
      /\[#[0-9A-Fa-f]{3,8}\]/,
    );
  });
});

/**
 * The restyle must not quietly drop a control. Every preset, filter, and
 * column the surface had before still has to be here afterwards.
 */
describe("screener keeps every control through the restyle", () => {
  it("keeps all five quick screens", () => {
    render(<PresetChips activePreset={null} onSelect={() => {}} />);
    for (const label of [
      "Hottest Markets",
      "Undervalued + High Score",
      "Cash-Flow",
      "Biggest Gainers",
      "Biggest Losers",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(PRESETS).toHaveLength(5);
  });

  it("marks the active preset for assistive tech", () => {
    render(<PresetChips activePreset="cashflow" onSelect={() => {}} />);
    const active = screen.getByRole("button", { name: /Cash-Flow/ });
    expect(active).toHaveAttribute("aria-pressed", "true");
  });

  it("fires onSelect with the whole preset, not just its id", () => {
    const onSelect = vi.fn();
    render(<PresetChips activePreset={null} onSelect={onSelect} />);
    screen.getByRole("button", { name: /Hottest Markets/ }).click();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "hottest", query: expect.any(Object) }),
    );
  });

  it("keeps the six filter groups the mockup lays out six-up", () => {
    for (const label of [
      "PIQ Score",
      "Median Price",
      "Cap Rate",
      "Months of Supply",
      "Overvalued %",
      "Score Δ",
    ]) {
      expect(FILTERS).toContain(label);
    }
  });

  it("keeps every results column", () => {
    for (const col of [
      "Market",
      "Score",
      "Median Price",
      "Rent",
      "Cap Rate",
      "MoS",
      "Overvalued %",
    ]) {
      expect(TABLE).toContain(col);
    }
  });

  it("keeps the row menu and row navigation", () => {
    expect(TABLE).toContain("ScreenerRowMenu");
    expect(TABLE).toContain("/market/");
  });

  it("keeps the empty state with its active-filter readout", () => {
    expect(TABLE).toContain("ScreenerEmptyState");
    expect(TABLE).toContain("activeFilters");
  });
});

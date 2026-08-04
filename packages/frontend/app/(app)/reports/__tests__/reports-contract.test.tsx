import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  groupReportHistory,
  describeReportType,
  splitReportTitle,
} from "../lib/report-history-grouping";
import type { ReportListItem } from "../types";

const read = (rel: string) =>
  readFileSync(join(__dirname, "..", rel), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

const BUILDER = read("ReportCreationPage.tsx");
const CONTROL_BAR = read("components/ReportBuilderControlBar.tsx");
const HISTORY = read("components/ReportHistoryList.tsx");
const CORE = [
  "MetricsRow",
  "MetricDisplay",
  "ComponentScoreBadge",
  "SectionCard",
  "AIAnalysisBlock",
].map((name) => ({
  name,
  src: read(`[id]/components/sections/core/${name}.tsx`),
}));

function makeReport(over: Partial<ReportListItem> = {}): ReportListItem {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Frederick County, MD",
    template_slug: "propertyiq",
    template_name: "PropertyIQ Report",
    template_icon: "chart",
    primary_geography_name: "Frederick County, MD",
    created_at: "2026-06-30T12:00:00.000Z",
    ...over,
  } as ReportListItem;
}

describe("reports builder defers to the shared chrome", () => {
  it("renders the sticky ControlBar", () => {
    expect(CONTROL_BAR).toContain("ControlBar");
    expect(BUILDER).toContain("ReportBuilderControlBar");
  });

  it("puts the generate CTA in the control bar, not at the foot of the form", () => {
    expect(CONTROL_BAR).toContain("Generate report");
    // The old CTA lived in the left column below ~400px of empty space.
    expect(BUILDER).not.toMatch(/Generate Report</);
  });

  it("gives the disabled state a reason", () => {
    expect(CONTROL_BAR).toContain("Add a market to generate");
  });

  it("uses no arbitrary hex or raw palette colours", () => {
    const all = BUILDER + CONTROL_BAR + HISTORY;
    expect(all).not.toMatch(/\[#[0-9A-Fa-f]{3,8}\]/);
    // bg-indigo-100/text-indigo-700 are Tailwind palette, not brand tokens —
    // they do not flip in dark mode.
    expect(all).not.toMatch(
      /(bg|text|border)-(indigo|slate|gray|zinc)-\d{2,3}/,
    );
  });
});

describe("report core components keep numerics monospace", () => {
  for (const { name, src } of CORE) {
    it(`${name} renders no numeric without a mono face`, () => {
      // Either it uses the mono utility, or it renders no numeric value at all.
      const usesMono = /font-mono|--font-roboto-mono/.test(src);
      const rendersNumber = /value|score|toFixed|toLocaleString/i.test(src);
      expect(usesMono || !rendersNumber).toBe(true);
    });
  }
});

/**
 * Six live rows collapse to four real reports: the same title appears twice on
 * the same date with nothing to tell the duplicates apart.
 */
describe("recent reports rows are distinguishable", () => {
  it("collapses same-title, same-day runs into one row", () => {
    const groups = groupReportHistory([
      makeReport({ id: "a", created_at: "2026-06-30T09:00:00.000Z" }),
      makeReport({ id: "b", created_at: "2026-06-30T15:00:00.000Z" }),
      makeReport({ id: "c", title: "Shermans Dale, PA 17090" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].versions).toHaveLength(2);
  });

  it("opens the newest run in a group", () => {
    const groups = groupReportHistory([
      makeReport({ id: "older", created_at: "2026-06-30T09:00:00.000Z" }),
      makeReport({ id: "newer", created_at: "2026-06-30T15:00:00.000Z" }),
    ]);
    expect(groups[0].latest.id).toBe("newer");
  });

  it("keeps same-title runs on DIFFERENT days as separate rows", () => {
    const groups = groupReportHistory([
      makeReport({ created_at: "2026-06-30T09:00:00.000Z" }),
      makeReport({ created_at: "2026-07-01T09:00:00.000Z" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("names a comparison as such, so it is not mistaken for a single market", () => {
    // Live comparison rows carry template_name "PropertyIQ Report", so the
    // type must come off the title or the badge contradicts the title.
    expect(
      describeReportType(
        makeReport({
          title: "Charleston-North Charleston - Market Comparison",
          template_slug: "propertyiq",
          template_name: "PropertyIQ Report",
        }),
      ),
    ).toBe("Market Comparison");
    expect(
      describeReportType(makeReport({ template_slug: "comparison" })),
    ).toBe("Market Comparison");
  });

  it("strips the type suffix so the row does not say it twice", () => {
    expect(
      splitReportTitle(
        makeReport({
          title: "Austin-Round Rock-San Marcos - PropertyIQ Report",
        }),
      ).title,
    ).toBe("Austin-Round Rock-San Marcos");
  });

  it("never truncates a title mid-word", () => {
    // Live rows clipped to "Frederick County, M…" — the ellipsis landed inside
    // the state code. Titles wrap instead.
    expect(HISTORY).not.toMatch(/\btruncate\b/);
  });

  it("carries a type badge and a date on every row", () => {
    expect(HISTORY).toContain("splitReportTitle");
    expect(HISTORY).toContain("toLocaleDateString");
  });

  it("labels grouped runs with a version count", () => {
    expect(HISTORY).toContain("versions");
  });
});

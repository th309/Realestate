import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { PNG } from "pngjs";
import type { VideoConfig } from "remotion";

const INPUT_PROPS = {
  format: "top_10_ranking",
  resolvedMarket: {
    canonical_name: "California",
    geography: "state",
    id: "CA",
  },
  dataBundle: {},
  ctaUrl: "https://piq.sh/top10ca",
  params: {
    format: "top_10_ranking",
    direction: "top",
    metric: {
      id: "cashflow_yield",
      label: "Cashflow Yield",
      unit: "%",
      format: "percent",
    },
    scope: { type: "state", id: "CA", label: "California" },
    geo_level: "county",
    as_of: "2026-04-01",
    resolved_markets: Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      region_id: `0600${i}`,
      region_name: `County ${i + 1}`,
      state: "CA",
      value: 0.124 - i * 0.005,
      value_formatted: `${((0.124 - i * 0.005) * 100).toFixed(1)}%`,
    })),
  },
} as const;

describe("Top 10 Ranking snapshots", () => {
  let serveUrl: string;
  let composition: VideoConfig;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
    composition = await selectComposition({
      serveUrl,
      id: "top-10-ranking",
      inputProps: INPUT_PROPS,
    });
  }, 180_000);

  it.each([0, 90, 180, 600, 1200, 1500, 1750])(
    "renders frame %s within tolerance",
    async (frame) => {
      const outPath = path.resolve(__dirname, `top-10-ranking-${frame}.png`);
      await renderStill({
        serveUrl,
        composition,
        frame,
        output: outPath,
        inputProps: INPUT_PROPS,
      });
      const baselinePath = path.resolve(
        __dirname,
        "__snapshots__",
        `top-10-ranking-${frame}.png`,
      );
      if (!fs.existsSync(baselinePath)) {
        fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
        fs.copyFileSync(outPath, baselinePath);
        // eslint-disable-next-line no-console
        console.log(`Baseline created for frame ${frame}`);
        return;
      }
      const a = PNG.sync.read(fs.readFileSync(outPath));
      const b = PNG.sync.read(fs.readFileSync(baselinePath));
      const diffPct = diffPngs(a, b);
      expect(diffPct).toBeLessThan(0.02);
    },
    60_000,
  );
});

describe("Top 10 — currency format (home_value)", () => {
  let serveUrl: string;
  let composition: VideoConfig;

  const INPUT_CURRENCY = {
    format: "top_10_ranking",
    resolvedMarket: {
      canonical_name: "California",
      geography: "state",
      id: "CA",
    },
    dataBundle: {},
    ctaUrl: "https://piq.sh/top10ca",
    params: {
      format: "top_10_ranking",
      direction: "top",
      metric: {
        id: "home_value",
        label: "Home Value",
        unit: "$",
        format: "currency",
      },
      scope: { type: "state", id: "CA", label: "California" },
      geo_level: "county",
      as_of: "2026-04-01",
      resolved_markets: Array.from({ length: 10 }, (_, i) => ({
        rank: i + 1,
        region_id: `0600${i}`,
        region_name: `County ${i + 1}`,
        state: "CA",
        value: 1_200_000 - i * 50_000,
        value_formatted: `$${((1_200_000 - i * 50_000) / 1_000_000).toFixed(1)}M`,
      })),
    },
  } as const;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
    composition = await selectComposition({
      serveUrl,
      id: "top-10-ranking",
      inputProps: INPUT_CURRENCY,
    });
  }, 180_000);

  it.each([0, 240, 1200])(
    "renders frame %s",
    async (frame) => {
      const outPath = path.resolve(__dirname, `top-10-currency-${frame}.png`);
      await renderStill({
        serveUrl,
        composition,
        frame,
        output: outPath,
        inputProps: INPUT_CURRENCY,
      });
      const baselinePath = path.resolve(
        __dirname,
        "__snapshots__",
        `top-10-currency-${frame}.png`,
      );
      if (!fs.existsSync(baselinePath)) {
        fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
        fs.copyFileSync(outPath, baselinePath);
        // eslint-disable-next-line no-console
        console.log(`Baseline created for frame ${frame}`);
        return;
      }
      const a = PNG.sync.read(fs.readFileSync(outPath));
      const b = PNG.sync.read(fs.readFileSync(baselinePath));
      const diffPct = diffPngs(a, b);
      expect(diffPct).toBeLessThan(0.02);
    },
    60_000,
  );
});

describe("Top 10 — N=5 edge case (variable duration)", () => {
  let serveUrl: string;
  let composition: VideoConfig;

  const INPUT_N5 = {
    format: "top_10_ranking",
    resolvedMarket: {
      canonical_name: "Tampa",
      geography: "metro",
      id: "45300",
    },
    dataBundle: {},
    ctaUrl: "https://piq.sh/top10tampa",
    params: {
      format: "top_10_ranking",
      direction: "top",
      metric: {
        id: "piq_score",
        label: "PIQ Score",
        unit: "",
        format: "index",
      },
      scope: { type: "metro", id: "45300", label: "Tampa" },
      geo_level: "zip",
      as_of: "2026-04-01",
      resolved_markets: Array.from({ length: 5 }, (_, i) => ({
        rank: i + 1,
        region_id: `3361${i}`,
        region_name: `ZIP ${i + 1}`,
        state: "FL",
        value: 90 - i * 3,
        value_formatted: `${90 - i * 3}`,
      })),
    },
  } as const;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
    composition = await selectComposition({
      serveUrl,
      id: "top-10-ranking",
      inputProps: INPUT_N5,
    });
  }, 180_000);

  it.each([0, 90, 600, 870, 950])(
    "renders frame %s (N=5)",
    async (frame) => {
      const outPath = path.resolve(__dirname, `top-10-n5-${frame}.png`);
      await renderStill({
        serveUrl,
        composition,
        frame,
        output: outPath,
        inputProps: INPUT_N5,
      });
      const baselinePath = path.resolve(
        __dirname,
        "__snapshots__",
        `top-10-n5-${frame}.png`,
      );
      if (!fs.existsSync(baselinePath)) {
        fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
        fs.copyFileSync(outPath, baselinePath);
        // eslint-disable-next-line no-console
        console.log(`Baseline created for frame ${frame}`);
        return;
      }
      const a = PNG.sync.read(fs.readFileSync(outPath));
      const b = PNG.sync.read(fs.readFileSync(baselinePath));
      const diffPct = diffPngs(a, b);
      expect(diffPct).toBeLessThan(0.02);
    },
    60_000,
  );
});

function diffPngs(a: PNG, b: PNG): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let diffCount = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (
      Math.abs(a.data[i] - b.data[i]) > 8 ||
      Math.abs(a.data[i + 1] - b.data[i + 1]) > 8 ||
      Math.abs(a.data[i + 2] - b.data[i + 2]) > 8
    )
      diffCount++;
  }
  return diffCount / (a.width * a.height);
}

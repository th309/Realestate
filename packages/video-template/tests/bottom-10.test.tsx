import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { PNG } from "pngjs";
import type { VideoConfig } from "remotion";

const INPUT_PROPS = {
  format: "bottom_10_ranking",
  resolvedMarket: {
    canonical_name: "United States",
    geography: "state",
    id: "US",
  },
  dataBundle: {},
  ctaUrl: "https://piq.sh/bottom10",
  params: {
    format: "bottom_10_ranking",
    direction: "bottom",
    metric: {
      id: "vacancy_risk_score",
      label: "Vacancy Risk",
      unit: "",
      format: "index",
    },
    scope: { type: "national", id: null, label: "United States" },
    geo_level: "county",
    as_of: "2026-04-01",
    resolved_markets: Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      region_id: `${10000 + i}`,
      region_name: `County ${i + 1}`,
      state: "TX",
      value: 85 - i,
      value_formatted: `${85 - i}`,
    })),
  },
} as const;

describe("Bottom 10 Ranking snapshots", () => {
  let serveUrl: string;
  let composition: VideoConfig;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
    composition = await selectComposition({
      serveUrl,
      id: "bottom-10-ranking",
      inputProps: INPUT_PROPS,
    });
  }, 180_000);

  it.each([0, 90, 180, 600, 1200, 1500, 1750])(
    "renders frame %s within tolerance",
    async (frame) => {
      const outPath = path.resolve(__dirname, `bottom-10-ranking-${frame}.png`);
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
        `bottom-10-ranking-${frame}.png`,
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

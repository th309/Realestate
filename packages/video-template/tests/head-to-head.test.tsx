import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { PNG } from "pngjs";
import type { VideoConfig } from "remotion";

const INPUT_PROPS = {
  format: "head_to_head",
  resolvedMarket: {
    canonical_name: "Cleveland, OH",
    geography: "metro",
    id: "17140",
  },
  dataBundle: {
    markets: [
      {
        canonical_name: "Cleveland, OH",
        score: { propertyiq_score: 78, grade: "GREAT" },
        home_value: { value: 385000, yoy_pct: 4.2, period_date: "2026-03-01" },
        rent: { value: 1450 },
        demographics: {
          population: 372624,
          median_income: 55000,
          homeownership_pct: 47,
        },
      },
      {
        canonical_name: "Austin, TX",
        score: { propertyiq_score: 69, grade: "FAIR" },
        home_value: { value: 545000, yoy_pct: -1.8 },
        rent: { value: 1980 },
        demographics: {
          population: 974447,
          median_income: 86000,
          homeownership_pct: 45,
        },
      },
    ],
  },
  ctaUrl: "https://piq.sh/cle-vs-aus",
};

describe("Head to Head snapshots", () => {
  let serveUrl: string;
  let composition: VideoConfig;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
    composition = await selectComposition({
      serveUrl,
      id: "head-to-head",
      inputProps: INPUT_PROPS,
    });
  }, 180_000);

  it.each([0, 90, 200, 600, 1100, 1500, 1700, 1770])(
    "renders frame %s within tolerance",
    async (frame) => {
      const outPath = path.resolve(__dirname, `head-to-head-${frame}.png`);
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
        `head-to-head-${frame}.png`,
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

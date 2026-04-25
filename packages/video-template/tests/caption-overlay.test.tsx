import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { PNG } from "pngjs";
import type { VideoConfig } from "remotion";

const INPUT_PROPS = {
  format: "score_mover",
  resolvedMarket: {
    canonical_name: "Cleveland, OH",
    geography: "metro",
    id: "17140",
  },
  dataBundle: {
    score: { propertyiq_score: 78, score_delta: 8 },
    home_value: { value: 385000, yoy_pct: 4.2 },
    rent: { value: 1450 },
    demographics: {
      population: 372624,
      median_income: 55000,
      homeownership_pct: 47,
    },
  },
  ctaUrl: "https://piq.sh/cle-mover-captions",
  captionWords: [
    { word: "Cleveland", startMs: 500, endMs: 1200 },
    { word: "jumped", startMs: 1300, endMs: 1900 },
    { word: "eight", startMs: 2000, endMs: 2400 },
    { word: "points", startMs: 2500, endMs: 3100 },
    { word: "this", startMs: 5500, endMs: 5900 },
    { word: "month", startMs: 6000, endMs: 6500 },
    { word: "on", startMs: 11000, endMs: 11200 },
    { word: "PropertyIQ", startMs: 11300, endMs: 12200 },
  ],
};

describe("Caption Overlay snapshots", () => {
  let serveUrl: string;
  let composition: VideoConfig;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
    composition = await selectComposition({
      serveUrl,
      id: "score-mover",
      inputProps: INPUT_PROPS,
    });
  }, 180_000);

  it.each([0, 90, 200, 350, 500, 800])(
    "renders frame %s within tolerance",
    async (frame) => {
      const outPath = path.resolve(__dirname, `caption-overlay-${frame}.png`);
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
        `caption-overlay-${frame}.png`,
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

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { PNG } from "pngjs";
import type { VideoConfig } from "remotion";

const INPUT_PROPS = {
  format: "farm_area_spotlight",
  resolvedMarket: {
    canonical_name: "Cleveland, OH",
    geography: "metro",
    id: "17140",
  },
  dataBundle: {
    farm_areas: [
      { zip: "44102", medianPrice: 165000, turnoverPct: 12, absenteePct: 38 },
      { zip: "44109", medianPrice: 142000, turnoverPct: 14, absenteePct: 41 },
      { zip: "44113", medianPrice: 215000, turnoverPct: 9, absenteePct: 33 },
    ],
  },
  ctaUrl: "https://piq.sh/cle-farm",
};

describe("Farm Area Spotlight snapshots", () => {
  let serveUrl: string;
  let composition: VideoConfig;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
    composition = await selectComposition({
      serveUrl,
      id: "farm-area-spotlight",
      inputProps: INPUT_PROPS,
    });
  }, 180_000);

  it.each([0, 90, 200, 600, 1200, 1450, 1600, 1750])(
    "renders frame %s within tolerance",
    async (frame) => {
      const outPath = path.resolve(__dirname, `farm-area-${frame}.png`);
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
        `farm-area-${frame}.png`,
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

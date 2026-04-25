import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { PNG } from "pngjs";
import type { VideoConfig } from "remotion";

const INPUT_PROPS = {
  format: "top_10_ranking",
  resolvedMarket: {
    canonical_name: "Texas",
    geography: "state",
    id: "TX",
  },
  dataBundle: {
    state: "Texas",
    top_cashflow_markets: [
      { rank: 1, name: "Houston, TX", rent_to_price_ratio: 0.78 },
      { rank: 2, name: "Dallas, TX", rent_to_price_ratio: 0.74 },
      { rank: 3, name: "San Antonio, TX", rent_to_price_ratio: 0.72 },
      { rank: 4, name: "Austin, TX", rent_to_price_ratio: 0.69 },
      { rank: 5, name: "El Paso, TX", rent_to_price_ratio: 0.66 },
      { rank: 6, name: "Fort Worth, TX", rent_to_price_ratio: 0.63 },
      { rank: 7, name: "Lubbock, TX", rent_to_price_ratio: 0.61 },
      { rank: 8, name: "Corpus Christi, TX", rent_to_price_ratio: 0.59 },
      { rank: 9, name: "Amarillo, TX", rent_to_price_ratio: 0.57 },
      { rank: 10, name: "Killeen, TX", rent_to_price_ratio: 0.55 },
    ],
  },
  ctaUrl: "https://piq.sh/top10tx",
};

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

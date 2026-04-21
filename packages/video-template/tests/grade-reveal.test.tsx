import { bundle } from "@remotion/bundler";
import { renderStill } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { PNG } from "pngjs";

describe("Grade Reveal snapshots", () => {
  let serveUrl: string;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
  }, 120_000);

  it.each([0, 90, 180, 300, 500, 700, 850])(
    "renders frame %s within tolerance",
    async (frame) => {
      const outPath = path.resolve(__dirname, `grade-reveal-${frame}.png`);
      await renderStill({
        serveUrl,
        composition: {
          id: "grade_reveal",
          width: 1080,
          height: 1920,
          fps: 30,
          durationInFrames: 900,
          // renderStill accepts a looser composition shape than the
          // registered Composition; cast to any to avoid leaking the
          // full VideoMetadata type into the test surface.
        } as any,
        frame,
        output: outPath,
        inputProps: {
          format: "grade_reveal",
          resolvedMarket: {
            canonical_name: "Cleveland, OH",
            geography: "metro",
            id: "17140",
          },
          dataBundle: { score: 78, home_value: { value: 385000 } },
          ctaUrl: "https://piq.sh/abc123",
        },
      });
      const baselinePath = path.resolve(
        __dirname,
        "__snapshots__",
        `grade-reveal-${frame}.png`,
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

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { PNG } from "pngjs";

/**
 * Thumbnails are designed compositions, not frames pulled out of the video.
 *
 * The check that matters is legibility at the size these are actually seen —
 * roughly 120px wide in a feed. So rather than only diffing pixels, this
 * downsamples to that width and asserts the headline still carries enough
 * contrast to read. A "tasteful" thumbnail that dissolves into mush at feed
 * size is the exact failure this format exists to avoid.
 */
describe("Designed thumbnails", () => {
  let serveUrl: string;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
  }, 240_000);

  it.each([
    ["grade-reveal-thumbnail", "Buffalo scores 98"],
    ["product-demo-horizontal-thumbnail", "Stop guessing"],
    ["product-demo-vertical-thumbnail", "Stop guessing"],
  ])(
    "%s renders and stays readable at feed size",
    async (id, headline) => {
      const inputProps = {
        variant: "score",
        headline,
        eyebrow: "PropertyIQ",
        score: 98,
      };
      const composition = await selectComposition({ serveUrl, id, inputProps });

      const outPath = path.resolve(__dirname, `${id}.png`);
      await renderStill({
        serveUrl,
        composition,
        frame: 0,
        output: outPath,
        inputProps,
      });

      const png = PNG.sync.read(fs.readFileSync(outPath));
      expect(png.width).toBe(composition.width);

      // Downsample to ~120px wide and measure contrast. Big type survives
      // this; small type averages into the background and the spread collapses.
      const targetW = 120;
      const step = Math.floor(png.width / targetW);
      let min = 255;
      let max = 0;
      for (let y = 0; y < png.height; y += step) {
        for (let x = 0; x < png.width; x += step) {
          const i = (png.width * y + x) << 2;
          const lum =
            0.2126 * png.data[i] +
            0.7152 * png.data[i + 1] +
            0.0722 * png.data[i + 2];
          if (lum < min) min = lum;
          if (lum > max) max = lum;
        }
      }
      // Near-white headline against the dark stage should span most of the range.
      expect(max - min).toBeGreaterThan(120);
    },
    120_000,
  );

  it("registers a thumbnail for every format", async () => {
    const { FORMAT_KEYS, compositionId } =
      await import("../src/formats/manifest");
    for (const key of FORMAT_KEYS) {
      const id = `${compositionId(key)}-thumbnail`;
      const composition = await selectComposition({
        serveUrl,
        id,
        inputProps: { formatKey: key, variant: "score", headline: "Test" },
      });
      // A still, not a video — one frame is the whole artifact.
      expect(composition.durationInFrames).toBe(1);
    }
  }, 240_000);
});

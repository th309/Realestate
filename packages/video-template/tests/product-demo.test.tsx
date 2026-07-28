import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { PNG } from "pngjs";
import type { VideoConfig } from "remotion";

/**
 * The product demo, rendered at BOTH ratios from one authored spine.
 *
 * The point of the format is that a single set of copy and screenshots
 * produces a 75s landing-page explainer and a 25s social cut — different
 * edits, not crops. These render both and check the frames that matter:
 * the hook (frame 0 must not be dead), a punched-in feature beat, and the
 * CTA.
 */

const RAW = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "..", "sample-product-demo.json"),
    "utf-8",
  ),
) as Record<string, unknown>;

/**
 * The fixture's slot URLs are package-relative and stay that way — MediaSlot
 * resolves them via staticFile() at render time. Resolving here instead
 * would produce a URL that only looks right: staticFile only knows the
 * serve origin from inside the render.
 */
function propsFor(format: string): Record<string, unknown> {
  const { _comment, ...rest } = RAW;
  void _comment;
  return { ...rest, format };
}

describe("Product demo renders at both aspect ratios", () => {
  let serveUrl: string;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
  }, 240_000);

  describe.each([
    // Frames chosen per ratio: 0 = hook, mid = a punched-in feature beat,
    // late = the CTA card.
    {
      format: "product_demo_horizontal",
      id: "product-demo-horizontal",
      frames: [0, 40, 260, 900, 2100],
    },
    {
      format: "product_demo_vertical",
      id: "product-demo-vertical",
      frames: [0, 40, 130, 300, 680],
    },
  ])("$format", ({ format, id, frames }) => {
    let composition: VideoConfig;

    beforeAll(async () => {
      composition = await selectComposition({
        serveUrl,
        id,
        inputProps: propsFor(format),
      });
    }, 120_000);

    it("derives its duration from the authored feature count", () => {
      // 3 features. Horizontal: 5 + 3*20 + 8 = 73s. Vertical: 3 + 3*6 + 4 = 25s.
      const expected = format.endsWith("horizontal") ? 73 * 30 : 25 * 30;
      expect(composition.durationInFrames).toBe(expected);
    });

    it("opens on content — frame 0 is never dead air", async () => {
      const outPath = path.resolve(__dirname, `${id}-frame0.png`);
      await renderStill({
        serveUrl,
        composition,
        frame: 0,
        output: outPath,
        inputProps: propsFor(format),
      });
      const png = PNG.sync.read(fs.readFileSync(outPath));
      // The hook card animates in over ~5 frames, so frame 0 is the brand
      // stage rather than a logo screen. What must NOT happen is a flat
      // fill, which is what the old bumper produced.
      const seen = new Set<string>();
      for (let i = 0; i < png.data.length; i += 4) {
        seen.add(
          `${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`,
        );
      }
      expect(seen.size).toBeGreaterThan(3);
    }, 90_000);

    it.each(frames)(
      "renders frame %s within tolerance",
      async (frame) => {
        const outPath = path.resolve(__dirname, `${id}-${frame}.png`);
        await renderStill({
          serveUrl,
          composition,
          frame,
          output: outPath,
          inputProps: propsFor(format),
        });
        const baselinePath = path.resolve(
          __dirname,
          "__snapshots__",
          `${id}-${frame}.png`,
        );
        if (!fs.existsSync(baselinePath)) {
          fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
          fs.copyFileSync(outPath, baselinePath);
          return;
        }
        const a = PNG.sync.read(fs.readFileSync(outPath));
        const b = PNG.sync.read(fs.readFileSync(baselinePath));
        expect(diffPngs(a, b)).toBeLessThan(0.02);
      },
      90_000,
    );
  });
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

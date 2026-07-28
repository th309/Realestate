import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { PNG } from "pngjs";
import type { VideoConfig } from "remotion";

/**
 * Proves the media-slot primitives survive a real headless render.
 *
 * The package had never embedded video before this, and OffthreadVideo is
 * the one Remotion primitive that can pass in the Studio and still fail
 * under the CLI (it shells out to decode frames). So this renders through
 * the same bundle+renderStill path the backend's render-cli uses.
 */
describe("Media slot render probe", () => {
  let serveUrl: string;
  let composition: VideoConfig;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, "..", "src", "index.ts"),
    });
    composition = await selectComposition({
      serveUrl,
      id: "media-slot-probe",
    });
  }, 180_000);

  // 10 = wide, pre-punch-in. 80 = punched in on the focus region.
  // 130 = inside the video slot.
  it.each([10, 80, 130])(
    "renders frame %s within tolerance",
    async (frame) => {
      const outPath = path.resolve(__dirname, `media-slot-${frame}.png`);
      await renderStill({ serveUrl, composition, frame, output: outPath });
      const baselinePath = path.resolve(
        __dirname,
        "__snapshots__",
        `media-slot-${frame}.png`,
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
    60_000,
  );

  it("actually decodes video pixels, not a blank frame", async () => {
    const outPath = path.resolve(__dirname, "media-slot-video-probe.png");
    await renderStill({ serveUrl, composition, frame: 130, output: outPath });
    const png = PNG.sync.read(fs.readFileSync(outPath));

    // A failed OffthreadVideo decode composites as a flat fill. The test
    // pattern is vivid and varied, so a healthy decode shows many distinct
    // colours; a blank frame shows a handful.
    const seen = new Set<string>();
    for (let i = 0; i < png.data.length; i += 4) {
      seen.add(
        `${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`,
      );
    }
    expect(seen.size).toBeGreaterThan(20);
  }, 60_000);
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

import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import { injectMapboxTokenWebpack } from "../webpack/inject-mapbox-token";
import { VideoProps, VideoPropsSchema } from "../types";

export interface PreflightReport {
  ok: boolean;
  overflowFrames?: number[];
  assetLoadFailures?: string[];
}

/**
 * Render-preflight: renders a few still frames to catch:
 * - missing assets / fetch failures
 * - bundling errors
 *
 * Overflow detection is reserved for a later iteration (requires explicit
 * signal from compositions). For now we report overflowFrames empty.
 */
export async function preflight(
  props: VideoProps,
): Promise<PreflightReport> {
  const validated = VideoPropsSchema.parse(props);

  await ensureBrowser();

  const bundled = await bundle({
    entryPoint: path.resolve(__dirname, "..", "..", "src", "index.ts"),
    webpackOverride: (config) => injectMapboxTokenWebpack(config),
  });

  const compositionId = validated.format.replace(/_/g, "-");
  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: validated as unknown as Record<string, unknown>,
  });

  const durationInFrames = composition.durationInFrames ?? 0;
  const framesToCheck = [
    Math.floor(durationInFrames * 0.1),
    Math.floor(durationInFrames * 0.5),
    Math.floor(durationInFrames * 0.9),
  ].filter((f) => Number.isFinite(f) && f >= 0 && f < durationInFrames);

  const assetLoadFailures: string[] = [];
  for (const frame of framesToCheck) {
    try {
      await renderStill({
        composition,
        serveUrl: bundled,
        output: null,
        frame,
        inputProps: validated as unknown as Record<string, unknown>,
        imageFormat: "png",
      });
    } catch (err) {
      assetLoadFailures.push(
        `frame=${frame}: ${(err as Error).message ?? "unknown error"}`,
      );
    }
  }

  return {
    ok: assetLoadFailures.length === 0,
    overflowFrames: [],
    ...(assetLoadFailures.length > 0 ? { assetLoadFailures } : {}),
  };
}


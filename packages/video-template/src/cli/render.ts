import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import { VideoProps, VideoPropsSchema } from "../types";

export interface RenderOptions {
  props: VideoProps;
  outputPath: string;
  audioPath?: string;
}

/**
 * Programmatic render entry used by the backend RemotionCLIRenderer
 * driver and the command-line wrapper. Validates props via zod before
 * bundling so bad input fails fast with a readable message.
 */
export async function renderVideo(
  opts: RenderOptions,
): Promise<{ outputPath: string; durationMs: number }> {
  const validated = VideoPropsSchema.parse(opts.props);

  // At runtime this file lives at either:
  //   src/cli/render.ts   (when running via ts-node in dev)
  //   dist/cli/render.js  (when running the compiled CLI)
  // In both cases the Remotion root lives at <package>/src/index.ts.
  // Walk up two levels from __dirname (cli -> pkg root) then into src/.
  const bundled = await bundle({
    entryPoint: path.resolve(__dirname, "..", "..", "src", "index.ts"),
    webpackOverride: (config) => config,
  });

  const compositionId = validated.format.replace(/_/g, "-");
  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: validated as unknown as Record<string, unknown>,
  });

  const start = Date.now();
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: opts.outputPath,
    inputProps: validated as unknown as Record<string, unknown>,
    audioCodec: "aac",
  });
  return { outputPath: opts.outputPath, durationMs: Date.now() - start };
}

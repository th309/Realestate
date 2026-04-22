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

  const bundled = await bundle({
    entryPoint: path.resolve(__dirname, "..", "index.ts"),
    webpackOverride: (config) => config,
  });

  const composition = await selectComposition({
    serveUrl: bundled,
    id: validated.format,
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

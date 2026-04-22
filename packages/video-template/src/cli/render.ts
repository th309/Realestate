import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import path from "path";
import { VideoProps, VideoPropsSchema } from "../types";

export interface RenderOptions {
  props: VideoProps;
  outputPath: string;
}

/**
 * Programmatic render entry used by the backend RemotionCLIRenderer driver
 * and the command-line wrapper. Voiceover is supplied via `props.audioUrl`
 * and mounted inside the composition with Remotion's <Audio> component —
 * the compositor mixes it into the output natively, so no external ffmpeg
 * or post-render mux is needed.
 */
export async function renderVideo(
  opts: RenderOptions,
): Promise<{ outputPath: string; durationMs: number }> {
  const validated = VideoPropsSchema.parse(opts.props);

  // Remotion needs Chrome Headless Shell to composite frames. ensureBrowser
  // downloads it on first run (cached afterwards) so we don't depend on
  // the host having a system browser installed.
  await ensureBrowser();

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

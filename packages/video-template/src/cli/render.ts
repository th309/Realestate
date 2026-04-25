import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import path from "path";
import { VideoProps, VideoPropsSchema, FormatKey } from "../types";

export interface RenderOptions {
  props: VideoProps;
  outputPath: string;
}

export interface RenderThumbnailOptions {
  format: FormatKey;
  props: VideoProps;
  /** Frame index to capture (0..durationInFrames-1). */
  frame: number;
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

/**
 * Capture a single PNG frame from a registered composition. Used by the
 * render-thumbnail-cli wrapper and the backend RenderThumbnailHandler to
 * produce social-share thumbnails for the review UI and YouTube custom-
 * thumbnail uploads.
 *
 * Width/height/fps come from the composition's registered dimensions in
 * Root.tsx — we don't hardcode them here because Reels (1080x1920) and
 * long_form_deep_dive (1920x1080) need different shapes.
 */
export async function renderThumbnail(
  opts: RenderThumbnailOptions,
): Promise<{ outputPath: string; renderWallMs: number }> {
  const validated = VideoPropsSchema.parse(opts.props);
  await ensureBrowser();

  const bundled = await bundle({
    entryPoint: path.resolve(__dirname, "..", "..", "src", "index.ts"),
    webpackOverride: (config) => config,
  });

  const compositionId = opts.format.replace(/_/g, "-");
  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: validated as unknown as Record<string, unknown>,
  });

  const start = Date.now();
  await renderStill({
    composition,
    serveUrl: bundled,
    output: opts.outputPath,
    frame: opts.frame,
    inputProps: validated as unknown as Record<string, unknown>,
    imageFormat: "png",
  });

  return { outputPath: opts.outputPath, renderWallMs: Date.now() - start };
}

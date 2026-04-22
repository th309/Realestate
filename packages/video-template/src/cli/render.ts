import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { spawn } from "child_process";
import { existsSync, renameSync, unlinkSync } from "fs";
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
 *
 * If audioPath is provided, the voiceover is muxed in as a post-render
 * ffmpeg step — Remotion renders a silent AAC stub on its own, which
 * the user can't hear.
 */
export async function renderVideo(
  opts: RenderOptions,
): Promise<{ outputPath: string; durationMs: number }> {
  const validated = VideoPropsSchema.parse(opts.props);

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
  const silentPath = opts.audioPath
    ? opts.outputPath.replace(/\.mp4$/, ".silent.mp4")
    : opts.outputPath;
  console.error(
    `[render] audioPath=${opts.audioPath ?? "<none>"} silentPath=${silentPath} outputPath=${opts.outputPath}`,
  );
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: silentPath,
    inputProps: validated as unknown as Record<string, unknown>,
    audioCodec: "aac",
  });
  console.error(
    `[render] remotion wrote silentExists=${existsSync(silentPath)} outputExists=${existsSync(opts.outputPath)}`,
  );

  if (opts.audioPath) {
    console.error(`[render] starting mux audio=${opts.audioPath}`);
    await muxAudio(silentPath, opts.audioPath, opts.outputPath);
    console.error(
      `[render] after mux outputExists=${existsSync(opts.outputPath)} silentExists=${existsSync(silentPath)}`,
    );
    if (existsSync(silentPath)) unlinkSync(silentPath);
  }

  return { outputPath: opts.outputPath, durationMs: Date.now() - start };
}

async function muxAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  const ffmpegBin = process.env.FFMPEG_PATH ?? "ffmpeg";
  const args = [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    outputPath,
  ];
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegBin, args);
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg mux exited ${code}: ${stderr.slice(-500)}`));
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`ffmpeg spawn failed: ${err.message}`));
    });
  });
  // If outputPath equals videoPath (no silent suffix), rename not needed.
  if (!existsSync(outputPath)) {
    renameSync(videoPath, outputPath);
  }
}

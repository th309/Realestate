import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { PixelDimensions } from './image-dimensions';

/**
 * Read a video's DISPLAY dimensions via ffprobe.
 *
 * ffprobe is on PATH in dev and on Railway (Remotion depends on it), and
 * shelling out to it is the established pattern here — see
 * `orchestrator/job-handlers/audio-duration-probe.ts`.
 *
 * "Display" rather than "coded" matters for operator uploads: a phone filming
 * in portrait writes a 1920x1080 stream plus a rotation flag, and anamorphic
 * sources store non-square pixels. Handing the renderer the coded 1920x1080
 * would land every focus region sideways.
 */

const PROBE_TIMEOUT_MS = 20_000;

interface FfprobeStream {
  width?: number;
  height?: number;
  sample_aspect_ratio?: string;
  side_data_list?: { rotation?: number }[];
  tags?: { rotate?: string };
}

/**
 * Write the buffer to a temp file and probe it. A pipe would avoid the write,
 * but MP4/MOV keep the moov atom wherever the muxer put it — commonly at the
 * end — and ffprobe cannot seek back to it on a non-seekable stream.
 */
export async function probeVideoDimensions(
  buffer: Buffer,
  extension: string,
): Promise<PixelDimensions | null> {
  const dir = mkdtempSync(join(tmpdir(), 'piq-slot-probe-'));
  const path = join(dir, `source.${extension}`);
  try {
    writeFileSync(path, buffer);
    return parseFfprobeStreams(await runFfprobe(path));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runFfprobe(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_streams',
      '-print_format',
      'json',
      path,
    ]);
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`ffprobe timed out after ${PROBE_TIMEOUT_MS}ms`));
    }, PROBE_TIMEOUT_MS);

    proc.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    proc.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`ffprobe exited ${code}: ${stderr.trim()}`));
      }
      resolve(stdout);
    });
  });
}

/**
 * Turn ffprobe's JSON into display dimensions. Exported so the rotation and
 * anamorphic maths are testable without a real video file on disk.
 */
export function parseFfprobeStreams(json: string): PixelDimensions | null {
  let parsed: { streams?: FfprobeStream[] };
  try {
    parsed = JSON.parse(json) as { streams?: FfprobeStream[] };
  } catch {
    return null;
  }
  const stream = parsed.streams?.[0];
  if (!stream) return null;

  const codedWidth = Number(stream.width);
  const codedHeight = Number(stream.height);
  if (
    !Number.isFinite(codedWidth) ||
    !Number.isFinite(codedHeight) ||
    codedWidth <= 0 ||
    codedHeight <= 0
  ) {
    return null;
  }

  const displayWidth =
    codedWidth * sampleAspectRatio(stream.sample_aspect_ratio);
  const quarterTurn = Math.abs(rotationDegrees(stream) % 180) === 90;

  return quarterTurn
    ? { width: codedHeight, height: displayWidth }
    : { width: displayWidth, height: codedHeight };
}

/** Pixel shape as "num:den"; 1 for square, unknown or degenerate values. */
function sampleAspectRatio(raw: string | undefined): number {
  if (!raw) return 1;
  const [num, den] = raw.split(':').map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den)) return 1;
  if (num <= 0 || den <= 0) return 1;
  return num / den;
}

/** Rotation lives in stream side data on modern files, in tags on older ones. */
function rotationDegrees(stream: FfprobeStream): number {
  for (const sideData of stream.side_data_list ?? []) {
    const rotation = Number(sideData.rotation);
    if (Number.isFinite(rotation) && rotation !== 0) return rotation;
  }
  const tagged = Number(stream.tags?.rotate);
  return Number.isFinite(tagged) ? tagged : 0;
}

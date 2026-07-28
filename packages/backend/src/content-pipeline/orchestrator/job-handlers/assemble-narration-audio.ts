import { spawn } from 'child_process';

/**
 * Concatenate per-segment narration clips with generated silence between them
 * and loudness-normalize the result into one MP3.
 *
 * One ffmpeg process does the whole job: every clip is resampled to a common
 * format (drivers in the chain emit slightly different MP3 flavors), silence
 * inputs are synthesized by lavfi at the requested gap lengths, `concat`
 * splices them in order, and `loudnorm` lands the whole narration on a
 * consistent broadcast level so the video side can duck music against a
 * predictable floor.
 *
 * ffmpeg is on PATH in dev and on Railway (Remotion depends on it), but the
 * caller still gates on isFfmpegAvailable() — a missing binary degrades to
 * single-blob synthesis rather than failing the run.
 */

const SAMPLE_RATE = 24000;
const BITRATE = '96k';
const LOUDNORM = 'loudnorm=I=-16:TP=-1.5:LRA=11';
const MONO_FLTP = 'aformat=sample_fmts=fltp:channel_layouts=mono';
const ASSEMBLE_TIMEOUT_MS = 180_000;

export function isFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const proc = spawn('ffmpeg', ['-version']);
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

/**
 * @param segmentPaths ordered narration clips
 * @param gapsMs silence AFTER each clip; the entry for the last clip is ignored
 */
export function assembleNarration(
  segmentPaths: string[],
  gapsMs: number[],
  outputPath: string,
): Promise<void> {
  if (segmentPaths.length === 0) {
    return Promise.reject(new Error('assembleNarration: no segments'));
  }
  const { inputArgs, filterComplex } = buildFilterGraph(segmentPaths, gapsMs);
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...inputArgs,
    '-filter_complex',
    filterComplex,
    '-map',
    '[out]',
    '-c:a',
    'libmp3lame',
    '-b:a',
    BITRATE,
    '-ar',
    String(SAMPLE_RATE),
    '-ac',
    '1',
    outputPath,
  ];

  return new Promise<void>((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffmpeg narration assembly timed out after 180s'));
    }, ASSEMBLE_TIMEOUT_MS);
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve();
      reject(
        new Error(`ffmpeg exited ${code}: ${stderr.trim().slice(0, 500)}`),
      );
    });
  });
}

function buildFilterGraph(
  segmentPaths: string[],
  gapsMs: number[],
): { inputArgs: string[]; filterComplex: string } {
  const inputArgs: string[] = [];
  const normalized: string[] = [];
  const labels: string[] = [];
  let inputIndex = 0;

  const takeLabel = (filter: string) => {
    const label = `a${inputIndex}`;
    normalized.push(`[${inputIndex}:a]${filter}[${label}]`);
    labels.push(`[${label}]`);
    inputIndex++;
  };

  segmentPaths.forEach((path, i) => {
    inputArgs.push('-i', path);
    takeLabel(`aresample=${SAMPLE_RATE},${MONO_FLTP}`);

    const isLast = i === segmentPaths.length - 1;
    const gapMs = isLast ? 0 : Math.max(0, Math.round(gapsMs[i] ?? 0));
    if (gapMs > 0) {
      inputArgs.push(
        '-f',
        'lavfi',
        '-t',
        (gapMs / 1000).toFixed(3),
        '-i',
        `anullsrc=r=${SAMPLE_RATE}:cl=mono`,
      );
      takeLabel(MONO_FLTP);
    }
  });

  const steps = [...normalized];
  if (labels.length === 1) {
    steps.push(`${labels[0]}${LOUDNORM}[out]`);
  } else {
    steps.push(`${labels.join('')}concat=n=${labels.length}:v=0:a=1[cat]`);
    steps.push(`[cat]${LOUDNORM}[out]`);
  }
  return { inputArgs, filterComplex: steps.join(';') };
}

import { spawn } from 'child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  assembleNarration,
  isFfmpegAvailable,
} from './assemble-narration-audio';
import { probeAudioDurationMs } from './audio-duration-probe';

/**
 * Exercises the real ffmpeg binary — the filter graph is the whole point of
 * the module, and a mocked spawn would only assert the arg array back at
 * itself. Skips (with a log) wherever ffmpeg is not installed.
 */
describe('assembleNarration joins narration clips through ffmpeg', () => {
  let ffmpegPresent = false;
  let workDir = '';

  beforeAll(async () => {
    ffmpegPresent = await isFfmpegAvailable();
    if (!ffmpegPresent) {
      console.log('SKIP assemble-narration-audio: ffmpeg is not on PATH');
      return;
    }
    workDir = mkdtempSync(join(tmpdir(), 'narration-assembly-'));
  });

  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  it('concatenates clips with the requested silence between them', async () => {
    if (!ffmpegPresent) return;
    const first = await makeToneClip(workDir, 'first.mp3', 0.6);
    const second = await makeToneClip(workDir, 'second.mp3', 0.4);
    const output = join(workDir, 'joined.mp3');

    await assembleNarration([first, second], [350, 0], output);

    expect(existsSync(output)).toBe(true);
    expect(statSync(output).size).toBeGreaterThan(0);
    // 600ms + 350ms gap + 400ms, allowing for MP3 frame padding.
    expect(await probeAudioDurationMs(output)).toBeGreaterThan(1200);
    expect(await probeAudioDurationMs(output)).toBeLessThan(1500);
  }, 60_000);

  it('encodes mono 24kHz output whatever the clips came in as', async () => {
    if (!ffmpegPresent) return;
    const clip = await makeToneClip(workDir, 'stereo.mp3', 0.5, {
      sampleRate: 44100,
      channels: 2,
    });
    const output = join(workDir, 'downmixed.mp3');

    await assembleNarration([clip], [0], output);

    expect(await probeStreamFormat(output)).toEqual({
      channels: '1',
      sampleRate: '24000',
    });
  }, 60_000);

  it('loudness-normalizes a single clip instead of passing it through', async () => {
    if (!ffmpegPresent) return;
    const quiet = await makeToneClip(workDir, 'quiet.mp3', 0.8, {
      volume: 0.02,
    });
    const output = join(workDir, 'normalized.mp3');

    await assembleNarration([quiet], [0], output);

    const quietPeak = await probeMaxVolumeDb(quiet);
    const normalizedPeak = await probeMaxVolumeDb(output);
    expect(quietPeak).toBeLessThan(-25);
    expect(normalizedPeak).toBeGreaterThan(quietPeak + 15);
  }, 60_000);

  it('rejects an empty segment list rather than writing a zero-length file', async () => {
    await expect(
      assembleNarration([], [], join(tmpdir(), 'nope.mp3')),
    ).rejects.toThrow(/no segments/);
  });
});

function makeToneClip(
  dir: string,
  name: string,
  seconds: number,
  options: { sampleRate?: number; channels?: number; volume?: number } = {},
): Promise<string> {
  const { sampleRate = 24000, channels = 1, volume } = options;
  const path = join(dir, name);
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-t',
    String(seconds),
    '-i',
    `sine=frequency=440:sample_rate=${sampleRate}`,
    ...(volume !== undefined ? ['-af', `volume=${volume}`] : []),
    '-ac',
    String(channels),
    '-c:a',
    'libmp3lame',
    '-b:a',
    '96k',
    path,
  ];
  return runFfmpeg('ffmpeg', args).then(() => path);
}

function probeStreamFormat(
  path: string,
): Promise<{ channels: string; sampleRate: string }> {
  return runFfmpeg('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'a:0',
    '-show_entries',
    'stream=channels,sample_rate',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    path,
  ]).then((out) => {
    const [sampleRate, channels] = out.trim().split(/\r?\n/);
    return { channels, sampleRate };
  });
}

/** Peak level in dBFS, read out of ffmpeg's volumedetect filter. */
function probeMaxVolumeDb(path: string): Promise<number> {
  return runFfmpeg('ffmpeg', [
    '-hide_banner',
    '-i',
    path,
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ]).then((out) => {
    const match = /max_volume:\s*(-?[\d.]+) dB/.exec(out);
    if (!match) throw new Error(`volumedetect produced no reading: ${out}`);
    return parseFloat(match[1]);
  });
}

function runFfmpeg(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let out = '';
    proc.stdout.on('data', (c: Buffer) => (out += c.toString()));
    proc.stderr.on('data', (c: Buffer) => (out += c.toString()));
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0
        ? resolve(out)
        : reject(new Error(`${bin} exited ${code}: ${out.slice(-400)}`)),
    );
  });
}

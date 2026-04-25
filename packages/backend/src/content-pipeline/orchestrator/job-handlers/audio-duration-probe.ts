import { spawn } from 'child_process';

/**
 * Shell out to ffprobe to read an audio file's real duration in ms.
 * ffprobe is on PATH in both dev and the Railway container (Remotion
 * depends on it).
 *
 * Used by synthesize-audio.handler.ts after TTS synthesis completes —
 * TTSSynthesisResult.durationMs is wall-clock synthesis time, not the
 * length of the audio that'll mix into the video, so we probe the file
 * directly to enforce the format's audio_budget_seconds cap.
 */
export function probeAudioDurationMs(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      path,
    ]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => (stdout += c.toString()));
    proc.stderr.on('data', (c) => (stderr += c.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe exited ${code}: ${stderr.trim()}`));
      }
      const seconds = parseFloat(stdout.trim());
      if (!Number.isFinite(seconds)) {
        return reject(new Error(`ffprobe returned non-numeric: ${stdout}`));
      }
      resolve(Math.round(seconds * 1000));
    });
  });
}

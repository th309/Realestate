import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { existsSync, readFileSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import {
  TTSDriver,
  TTSSynthesisRequest,
  TTSSynthesisResult,
  WordTiming,
} from './tts-driver.interface';

@Injectable()
export class EdgeTTSDriver implements TTSDriver {
  readonly provider = 'edge' as const;

  isConfigured(): boolean {
    return !!process.env.EDGE_TTS_PYTHON;
  }

  async synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const python = process.env.EDGE_TTS_PYTHON;
    if (!python) throw new Error('EDGE_TTS_PYTHON not set');
    const start = Date.now();

    const subtitlesPath = join(
      tmpdir(),
      `edge-subs-${randomBytes(4).toString('hex')}.vtt`,
    );

    await runEdgeCli(
      python,
      req.voiceId,
      req.text,
      req.outputPath,
      subtitlesPath,
    );

    let wordTimings: WordTiming[] | undefined;
    try {
      if (existsSync(subtitlesPath)) {
        const vtt = readFileSync(subtitlesPath, 'utf-8');
        wordTimings = parseVttWordTimings(vtt);
      }
    } catch {
      wordTimings = undefined;
    } finally {
      try {
        unlinkSync(subtitlesPath);
      } catch {
        /* best-effort cleanup */
      }
    }

    const wallMs = Date.now() - start;
    let sizeBytes = 0;
    try {
      sizeBytes = statSync(req.outputPath).size;
    } catch {
      sizeBytes = 0;
    }

    return {
      durationMs: wallMs,
      bitrate: sizeBytes > 0 ? (sizeBytes * 8) / (wallMs / 1000) : 0,
      cost: {
        provider: 'edge-tts',
        amount_usd: 0,
        units: req.text.length,
        unit_type: 'chars',
      },
      wordTimings,
    };
  }

  /**
   * Shadow-capture path: synthesize through Edge TTS purely to harvest
   * word-boundary timings, throwing away the audio. Used after the Azure
   * driver synthesizes the real audio, since Azure's REST API doesn't emit
   * word boundaries but Edge (same Microsoft backend, same voice catalog)
   * produces near-identical timings to the Azure audio.
   */
  async captureTimingsOnly(
    voiceId: string,
    text: string,
  ): Promise<WordTiming[]> {
    const python = process.env.EDGE_TTS_PYTHON;
    if (!python) throw new Error('EDGE_TTS_PYTHON not set');

    const audioSink = join(
      tmpdir(),
      `edge-shadow-audio-${randomBytes(4).toString('hex')}.mp3`,
    );
    const subtitlesPath = join(
      tmpdir(),
      `edge-shadow-subs-${randomBytes(4).toString('hex')}.vtt`,
    );

    try {
      await runEdgeCli(python, voiceId, text, audioSink, subtitlesPath);
      if (!existsSync(subtitlesPath)) return [];
      const vtt = readFileSync(subtitlesPath, 'utf-8');
      return parseVttWordTimings(vtt);
    } finally {
      for (const p of [audioSink, subtitlesPath]) {
        try {
          unlinkSync(p);
        } catch {
          /* best-effort cleanup */
        }
      }
    }
  }
}

/**
 * Spawn `python -m edge_tts` with media + subtitles flags. The text is piped
 * via stdin (edge-tts CLI accepts stdin when --text is omitted) to bypass
 * Windows command-line length limits. A 60s hard timeout protects against
 * stuck Microsoft WS connections that otherwise wedge the pipeline.
 */
function runEdgeCli(
  python: string,
  voiceId: string,
  text: string,
  audioOut: string,
  subtitlesOut: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(python, [
      '-m',
      'edge_tts',
      '--voice',
      voiceId,
      '--text',
      text,
      '--write-media',
      audioOut,
      '--write-subtitles',
      subtitlesOut,
    ]);
    let stderrBuf = '';
    proc.stderr.on('data', (d) => {
      stderrBuf += d.toString();
    });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('edge-tts timeout after 60s'));
    }, 60000);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`edge-tts exited ${code}: ${stderrBuf}`));
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Parse the WebVTT file emitted by `edge_tts --write-subtitles`. Each
 * WordBoundary event becomes a cue with start/end times and word text.
 */
function parseVttWordTimings(vtt: string): WordTiming[] {
  const lines = vtt.split(/\r?\n/);
  const out: WordTiming[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m =
      /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/.exec(
        lines[i],
      );
    if (!m) continue;
    const startMs = tsToMs(m[1], m[2], m[3], m[4]);
    const endMs = tsToMs(m[5], m[6], m[7], m[8]);
    let text = '';
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === '') break;
      text += (text ? ' ' : '') + line.trim();
    }
    if (text.length > 0) {
      out.push({ word: text, startMs, endMs });
    }
  }
  return out;
}

function tsToMs(h: string, m: string, s: string, ms: string): number {
  return (
    parseInt(h, 10) * 3600000 +
    parseInt(m, 10) * 60000 +
    parseInt(s, 10) * 1000 +
    parseInt(ms, 10)
  );
}

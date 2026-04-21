import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { statSync } from 'fs';
import {
  TTSDriver,
  TTSSynthesisRequest,
  TTSSynthesisResult,
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

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(python, [
        '-m',
        'edge_tts',
        '--voice',
        req.voiceId,
        '--text',
        req.text,
        '--write-media',
        req.outputPath,
      ]);
      let stderrBuf = '';
      proc.stderr.on('data', (d) => {
        stderrBuf += d.toString();
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`edge-tts exited ${code}: ${stderrBuf}`));
      });
      proc.on('error', reject);
    });

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
    };
  }
}

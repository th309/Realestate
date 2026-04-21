import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import {
  VideoRenderer,
  VideoRenderRequest,
  VideoRenderResult,
} from './video-renderer.interface';

@Injectable()
export class RemotionCLIRenderer implements VideoRenderer {
  private readonly cliPath: string;
  private readonly timeoutMs: number;

  constructor() {
    this.cliPath = join(
      process.cwd(),
      'node_modules/@propertyiq/video-template/dist/cli/render-cli.js',
    );
    this.timeoutMs = parseInt(
      process.env.STEP_TIMEOUT_RENDER_VIDEO_MS ?? '300000',
      10,
    );
  }

  async render(req: VideoRenderRequest): Promise<VideoRenderResult> {
    const start = Date.now();
    const propsFile = join(
      tmpdir(),
      `props-${randomBytes(8).toString('hex')}.json`,
    );
    writeFileSync(propsFile, JSON.stringify(req.props));

    const args = [
      this.cliPath,
      '--format',
      req.format,
      '--props-json',
      propsFile,
      '--output',
      req.outputPath,
    ];
    if (req.audioPath) args.push('--audio', req.audioPath);

    const stdoutPayload = await new Promise<string>((resolve, reject) => {
      const proc = spawn('node', args);
      let stdoutBuf = '';
      let stderrBuf = '';
      proc.stdout.on('data', (d) => {
        stdoutBuf += d.toString();
      });
      proc.stderr.on('data', (d) => {
        stderrBuf += d.toString();
      });
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`render timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdoutBuf);
        else
          reject(
            new Error(`render exited ${code}: ${stderrBuf || 'render failed'}`),
          );
      });
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const parsed = JSON.parse(stdoutPayload.trim().split('\n').pop() ?? '{}');
    const wallMs = Date.now() - start;
    return {
      videoPath: parsed.outputPath ?? req.outputPath,
      durationMs: parsed.durationMs ?? 0,
      renderWallMs: wallMs,
      cost: {
        provider: 'remotion',
        amount_usd: 0,
        units: 1,
        unit_type: 'requests',
      },
    };
  }
}

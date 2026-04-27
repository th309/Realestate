import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import {
  VideoRenderer,
  VideoRenderRequest,
  VideoRenderResult,
  type RenderVideoProgressPayload,
} from './video-renderer.interface';

@Injectable()
export class RemotionCLIRenderer implements VideoRenderer {
  private readonly logger = new Logger(RemotionCLIRenderer.name);
  private readonly cliPath: string;
  private readonly timeoutMs: number;

  constructor() {
    // Resolve the video-template CLI via Node's module resolver so the path
    // works regardless of process.cwd(). In an npm workspace the package is
    // symlinked from the root node_modules; require.resolve walks up until it
    // finds the hoisted package.
    this.cliPath =
      require.resolve('@propertyiq/video-template/dist/cli/render-cli.js');
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
    const propsJson = JSON.stringify(req.props);
    // Log what we're about to write so we can compare it to whatever Zod
    // sees on the subprocess side. If this log shows ranking-shaped props
    // but the subprocess reports resolvedMarket null, the mutation is
    // happening in the spawned CLI, not in the driver.
    this.logger.log(
      `render driver: format=${req.format} propsFile=${propsFile} keys=[${Object.keys(req.props as Record<string, unknown>).join(',')}] preview=${propsJson.slice(0, 500)}`,
    );
    writeFileSync(propsFile, propsJson);

    const args = [
      this.cliPath,
      '--format',
      req.format,
      '--props-json',
      propsFile,
      '--output',
      req.outputPath,
    ];

    // Remotion looks for its Chrome Headless Shell in `<cwd>/node_modules/
    // .remotion`. If we inherit the backend's cwd, the cache is empty and
    // renderMedia throws "No browser found". Spawning from the video-
    // template package dir makes the lookup hit that package's cache,
    // which is populated by `build:cli` / ensureBrowser().
    const cliDir = require('path').dirname(this.cliPath);
    const pkgRoot = require('path').resolve(cliDir, '..', '..');
    this.logger.log(
      `spawning render: cli=${this.cliPath} cwd=${pkgRoot} output=${req.outputPath}`,
    );
    const stdoutPayload = await new Promise<string>((resolve, reject) => {
      const proc = spawn('node', args, { cwd: pkgRoot });
      let stdoutBuf = '';
      let stderrBuf = '';
      let stderrLineBuf = '';
      const progressPrefix = 'REMOTION_PROGRESS ';
      const emitProgress = (jsonStr: string) => {
        try {
          const payload = JSON.parse(jsonStr) as RenderVideoProgressPayload;
          const pct =
            typeof payload.progress === 'number'
              ? `${Math.round(payload.progress * 100)}%`
              : '?';
          this.logger.log(
            `[render-progress] frames=${payload.renderedFrames}/${payload.durationInFrames} encoded=${payload.encodedFrames} progress=${pct} stitch=${payload.stitchStage ?? '—'} wallMs=${payload.wallMs}`,
          );
          void Promise.resolve(req.onRenderProgress?.(payload));
        } catch {
          this.logger.warn(
            `render progress JSON parse failed: ${jsonStr.slice(0, 120)}`,
          );
        }
      };
      proc.stdout.on('data', (d) => {
        stdoutBuf += d.toString();
      });
      proc.stderr.on('data', (d) => {
        const chunk = d.toString();
        stderrBuf += chunk;
        stderrLineBuf += chunk;
        const lines = stderrLineBuf.split(/\r?\n/);
        stderrLineBuf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith(progressPrefix)) continue;
          emitProgress(line.slice(progressPrefix.length).trim());
        }
      });
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`render timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (stderrLineBuf.startsWith(progressPrefix)) {
          emitProgress(stderrLineBuf.slice(progressPrefix.length).trim());
        }
        this.logger.log(
          `render exit=${code} stderr.len=${stderrBuf.length} stdout.len=${stdoutBuf.length}`,
        );
        if (stderrBuf.includes('[render]')) {
          for (const line of stderrBuf.split('\n')) {
            if (line.includes('[render]')) this.logger.log(line.trim());
          }
        }
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

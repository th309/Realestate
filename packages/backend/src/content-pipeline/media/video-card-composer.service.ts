// packages/backend/src/content-pipeline/media/video-card-composer.service.ts
//
// Composites a transparent card overlay over metro b-roll into the feed's
// video-card MP4. Promoted from scripts/sample-video-card.ts — same ffmpeg
// filter chain, now returning bytes for storage instead of writing a sample
// file. Production has ffmpeg (the Remotion lane depends on it).

import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { DriverCost } from '../drivers/driver-cost.types';

const execFileAsync = promisify(execFile);

/** The feed's video-card canvas and runtime. */
export const VIDEO_CARD_WIDTH = 1080;
export const VIDEO_CARD_HEIGHT = 1350;
export const VIDEO_CARD_DURATION_SEC = 8;
/** A composite that has not finished by now is wedged, not slow. */
const FFMPEG_TIMEOUT_MS = 120_000;

export interface ComposedVideoCard {
  bytes: Buffer;
  width: number;
  height: number;
  durationSec: number;
  /** Local ffmpeg work: $0, but billed through the ledger like every driver. */
  cost: DriverCost;
}

@Injectable()
export class VideoCardComposerService {
  private readonly logger = new Logger(VideoCardComposerService.name);

  /**
   * Loop the b-roll under a full-canvas overlay for VIDEO_CARD_DURATION_SEC.
   *
   * The overlay is rendered at 2x and scaled back onto the canvas, which
   * supersamples the text; without that scale step only its top-left quarter
   * would appear. `-stream_loop -1` covers b-roll shorter than the card.
   */
  async compose(input: {
    brollPath: string;
    overlayPng: Buffer;
  }): Promise<ComposedVideoCard> {
    const workId = randomBytes(6).toString('hex');
    const workDir = join(tmpdir(), `piq-video-card-${workId}`);
    const overlayPath = join(workDir, 'overlay.png');
    const outPath = join(workDir, 'card.mp4');

    mkdirSync(workDir, { recursive: true });
    try {
      writeFileSync(overlayPath, input.overlayPng);
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-stream_loop',
          '-1',
          '-t',
          String(VIDEO_CARD_DURATION_SEC),
          '-i',
          input.brollPath,
          '-loop',
          '1',
          '-t',
          String(VIDEO_CARD_DURATION_SEC),
          '-i',
          overlayPath,
          '-filter_complex',
          `[0:v]scale=${VIDEO_CARD_WIDTH}:${VIDEO_CARD_HEIGHT}:force_original_aspect_ratio=increase,` +
            `crop=${VIDEO_CARD_WIDTH}:${VIDEO_CARD_HEIGHT},fps=30,setsar=1[bg];` +
            `[1:v]scale=${VIDEO_CARD_WIDTH}:${VIDEO_CARD_HEIGHT}[ov];[bg][ov]overlay=0:0[v]`,
          '-map',
          '[v]',
          '-t',
          String(VIDEO_CARD_DURATION_SEC),
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          outPath,
        ],
        { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      );

      const bytes = readFileSync(outPath);
      if (bytes.length === 0) throw new Error('ffmpeg produced an empty file');
      this.logger.log(`composed video card (${bytes.length} bytes)`);
      return {
        bytes,
        width: VIDEO_CARD_WIDTH,
        height: VIDEO_CARD_HEIGHT,
        durationSec: VIDEO_CARD_DURATION_SEC,
        cost: {
          provider: 'ffmpeg',
          amount_usd: 0,
          units: VIDEO_CARD_DURATION_SEC,
          unit_type: 'seconds',
        },
      };
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
}

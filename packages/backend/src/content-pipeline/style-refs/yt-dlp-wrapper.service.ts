import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const ALLOWED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'm.youtube.com',
  'tiktok.com',
  'www.tiktok.com',
  'vm.tiktok.com',
  'instagram.com',
  'www.instagram.com',
  'facebook.com',
  'www.facebook.com',
  'fb.watch',
  'twitter.com',
  'x.com',
];

export interface DownloadResult {
  videoPath: string;
  durationSec: number;
  title?: string;
}

@Injectable()
export class YtDlpWrapperService {
  private readonly bin = process.env.YT_DLP_BIN ?? 'yt-dlp';

  async download(url: string): Promise<DownloadResult> {
    const parsed = new URL(url);
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      throw new Error(`URL host ${parsed.hostname} not in allowlist`);
    }

    const outputPath = join(
      tmpdir(),
      `yt-${randomBytes(6).toString('hex')}.mp4`,
    );

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(this.bin, [
        '-f',
        'best[height<=720]/best',
        '--max-filesize',
        '200M',
        '--download-sections',
        '*0-300', // first 5 minutes only
        '-o',
        outputPath,
        url,
      ]);
      let stderr = '';
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      proc.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`yt-dlp ${code}: ${stderr.slice(0, 300)}`)),
      );
      proc.on('error', (err) => reject(err));
    });

    return { videoPath: outputPath, durationSec: 300 };
  }
}


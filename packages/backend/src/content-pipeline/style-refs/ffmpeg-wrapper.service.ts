import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const FRAMES_MAX = 60;

@Injectable()
export class FFmpegWrapperService {
  private readonly bin = process.env.FFMPEG_BIN ?? 'ffmpeg';

  async extractFrames(
    videoPath: string,
    intervalSeconds: number,
  ): Promise<string[]> {
    const outputDir = join(
      tmpdir(),
      `frames-${randomBytes(6).toString('hex')}`,
    );
    mkdirSync(outputDir, { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(this.bin, [
        '-i',
        videoPath,
        '-vf',
        `fps=1/${intervalSeconds}`,
        '-frames:v',
        String(FRAMES_MAX),
        '-y',
        join(outputDir, 'frame-%03d.jpg'),
      ]);
      let stderr = '';
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      proc.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`ffmpeg ${code}: ${stderr.slice(0, 300)}`)),
      );
      proc.on('error', (err) => reject(err));
    });

    return readdirSync(outputDir)
      .filter((f) => f.toLowerCase().endsWith('.jpg'))
      .sort()
      .map((f) => join(outputDir, f));
  }

  cleanupDir(dirPath: string): void {
    try {
      rmSync(dirPath, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}


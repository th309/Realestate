import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SupabaseService } from '../../supabase/supabase.service';

export interface TranscriptResult {
  videoId: string;
  transcript: string | null;
  failureReason?: string;
}

const YT_DLP_BIN = process.env.YT_DLP_BIN ?? 'yt-dlp';
const FETCH_TIMEOUT_MS = 60_000;

/**
 * Wraps yt-dlp to pull auto-generated subtitles for YouTube videos and
 * caches them in `transcript_cache`. Skips videos already cached
 * (transcript_cache.transcript IS NOT NULL).
 *
 * yt-dlp emits subtitles as VTT; we strip the timing tags and webvtt
 * boilerplate to get a flat plaintext block the clusterer can embed.
 */
@Injectable()
export class TranscriptFetcherService {
  private readonly logger = new Logger(TranscriptFetcherService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async fetchAndCache(videoId: string): Promise<TranscriptResult> {
    const cached = await this.readCache(videoId);
    if (cached?.transcript) return { videoId, transcript: cached.transcript };

    const dir = mkdtempSync(join(tmpdir(), `ytdlp-${videoId}-`));
    try {
      await this.runYtDlp(videoId, dir);
      const transcript = this.readTranscriptFromDir(dir);
      await this.upsertCache(videoId, transcript);
      return { videoId, transcript };
    } catch (err) {
      const reason = (err as Error).message.slice(0, 200);
      this.logger.warn(`[TRANSCRIPT] failed videoId=${videoId} ${reason}`);
      await this.upsertCache(videoId, null, reason);
      return { videoId, transcript: null, failureReason: reason };
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore — best-effort cleanup
      }
    }
  }

  private runYtDlp(videoId: string, dir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '--write-auto-subs',
        '--write-subs',
        '--sub-langs',
        'en.*,en',
        '--sub-format',
        'vtt',
        '--skip-download',
        '--no-warnings',
        '--quiet',
        '-o',
        join(dir, '%(id)s.%(ext)s'),
        `https://www.youtube.com/watch?v=${videoId}`,
      ];
      const proc = spawn(YT_DLP_BIN, args);
      let stderr = '';
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`yt-dlp timeout after ${FETCH_TIMEOUT_MS}ms`));
      }, FETCH_TIMEOUT_MS);
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else
          reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 300)}`));
      });
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private readTranscriptFromDir(dir: string): string {
    const files = readdirSync(dir).filter((f) => f.endsWith('.vtt'));
    if (files.length === 0) {
      throw new Error('yt-dlp produced no .vtt files (no captions available)');
    }
    const raw = readFileSync(join(dir, files[0]), 'utf8');
    return cleanVtt(raw);
  }

  private async readCache(videoId: string): Promise<{
    transcript: string | null;
  } | null> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('transcript_cache')
      .select('transcript')
      .eq('video_id', videoId)
      .maybeSingle();
    return data
      ? { transcript: (data.transcript as string | null) ?? null }
      : null;
  }

  private async upsertCache(
    videoId: string,
    transcript: string | null,
    failureReason?: string,
  ): Promise<void> {
    const client = this.supabase.getClient();
    await client.from('transcript_cache').upsert(
      {
        video_id: videoId,
        transcript,
        failure_reason: failureReason ?? null,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'video_id' },
    );
  }
}

function cleanVtt(vtt: string): string {
  return vtt
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith('WEBVTT')) return false;
      if (t.startsWith('NOTE')) return false;
      if (/^\d+$/.test(t)) return false; // cue numbers
      if (/-->/.test(t)) return false; // timestamps
      if (/^Kind:|^Language:/.test(t)) return false;
      return true;
    })
    .map((line) => line.replace(/<[^>]+>/g, '').trim()) // strip <c> styling
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { VisionExtractorService } from './vision-extractor.service';
import { YtDlpWrapperService } from './yt-dlp-wrapper.service';
import { FFmpegWrapperService } from './ffmpeg-wrapper.service';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import type { StyleReference } from './style-reference.service';

/** Pick `count` items spread evenly across the array (always keeps order). */
function sampleEvenly<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr;
  const step = arr.length / count;
  return Array.from({ length: count }, (_, i) => arr[Math.floor(i * step)]);
}

/**
 * Video ingest for style references (Phase 3): download (yt-dlp) or accept an
 * upload, sample frames (ffmpeg), run Vision over the frames, and store a 3x3
 * preview strip in the `content-pipeline` bucket. Split from
 * StyleReferenceService to keep both under the file-size limit.
 */
@Injectable()
export class StyleReferenceVideoIngestService {
  private readonly logger = new Logger(StyleReferenceVideoIngestService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly vision: VisionExtractorService,
    private readonly ytdlp: YtDlpWrapperService,
    private readonly ffmpeg: FFmpegWrapperService,
  ) {}

  async ingestVideoFromUpload(
    userId: string,
    buffer: Buffer,
    label: string,
  ): Promise<StyleReference> {
    const videoPath = join(tmpdir(), `upload-${Date.now()}.mp4`);
    writeFileSync(videoPath, buffer);
    return this.processVideo(userId, videoPath, label, null);
  }

  async ingestVideoFromUrl(
    userId: string,
    url: string,
    label: string,
  ): Promise<StyleReference> {
    const download = await this.ytdlp.download(url);
    return this.processVideo(userId, download.videoPath, label, url);
  }

  private async processVideo(
    userId: string,
    videoPath: string,
    label: string,
    sourceUrl: string | null,
  ): Promise<StyleReference> {
    const client = this.supabase.getClient();
    const frames = await this.ffmpeg.extractFrames(videoPath, 1);
    if (frames.length === 0) {
      throw new Error('ffmpeg produced no frames');
    }

    const extraction = await this.vision.extractFromFrames(frames);

    // Preview strip samples the WHOLE video, not the first 9 seconds — the
    // strip is for humans skimming the library. (Vision keeps consecutive
    // frames because cuts_per_10_sec assumes ~1s spacing.)
    const previewStripBuffer = await this.buildPreviewStrip(
      sampleEvenly(frames, 9),
    );
    const previewPath = `style-references/${userId}/${Date.now()}-preview.jpg`;
    const uploadRes = await client.storage
      .from('content-pipeline')
      .upload(previewPath, previewStripBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    if (uploadRes.error) throw uploadRes.error;

    const { data, error } = await client
      .from('style_references')
      .insert({
        user_id: userId,
        kind: 'video',
        label,
        source_url: sourceUrl,
        preview_strip_url: `supabase://content-pipeline/${previewPath}`,
        extracted_attributes: extraction.attributes,
        vision_cost_usd: extraction.cost_usd,
      })
      .select('*')
      .single();
    if (error || !data)
      throw new BadRequestException(error?.message ?? 'failed to create');

    // Best-effort cleanup: remove extracted frames directory.
    try {
      const dir = join(frames[0], '..');
      this.ffmpeg.cleanupDir(dir);
    } catch {
      // ignore
    }

    return data as StyleReference;
  }

  private async buildPreviewStrip(framePaths: string[]): Promise<Buffer> {
    const paths = framePaths.filter(Boolean).slice(0, 9);
    if (paths.length === 0) throw new Error('no frames for preview strip');

    const outPath = join(tmpdir(), `strip-${Date.now()}.jpg`);
    const bin = process.env.FFMPEG_BIN ?? 'ffmpeg';

    await new Promise<void>((resolve, reject) => {
      // Each -i is a separate single-frame stream; a bare `tile` filter only
      // reads the FIRST input (one frame in the top-left, 8 black cells).
      // Concat all inputs into one stream first, then tile, then downscale
      // so a 720p source doesn't produce a 3840x2160 upload.
      const inputLabels = paths.map((_, i) => `[${i}:v]`).join('');
      const args = [
        ...paths.flatMap((p) => ['-i', p]),
        '-filter_complex',
        `${inputLabels}concat=n=${paths.length}:v=1:a=0,tile=3x3,scale=1280:-2`,
        '-frames:v',
        '1',
        '-y',
        outPath,
      ];
      const proc = spawn(bin, args);
      let stderr = '';
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      proc.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`ffmpeg tile ${code}: ${stderr.slice(0, 300)}`)),
      );
      proc.on('error', (err) => reject(err));
    });

    return readFileSync(outPath);
  }
}

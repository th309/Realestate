import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { CaptionTimer, CaptionTimingResult } from './caption-timer.interface';

@Injectable()
export class OpenAIWhisperTimer implements CaptionTimer {
  private readonly client: OpenAI;
  constructor() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is required');
    this.client = new OpenAI({ apiKey: key });
  }

  async time(audioPath: string): Promise<CaptionTimingResult> {
    const response = await this.client.audio.transcriptions.create({
      model: 'whisper-1',
      file: createReadStream(audioPath),
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });
    const words =
      (response as any).words?.map((w: any) => ({
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        word: w.word,
      })) ?? [];
    const segments =
      (response as any).segments?.map((s: any) => ({
        startMs: Math.round(s.start * 1000),
        endMs: Math.round(s.end * 1000),
        text: s.text,
      })) ?? [];
    const srt = this.toSrt(segments);

    // Whisper pricing is $0.006 per minute of audio (rounded up to the next minute),
    // NOT a flat $0.006 per request. Derive minutes from the last segment's end time.
    const audioDurationMs = segments.length
      ? Math.max(...segments.map((s: { endMs: number }) => s.endMs))
      : 0;
    const billedMinutes = Math.max(1, Math.ceil(audioDurationMs / 60_000));
    const WHISPER_USD_PER_MINUTE = 0.006;

    return {
      segments,
      words,
      srt,
      cost: {
        provider: 'openai-whisper',
        amount_usd: billedMinutes * WHISPER_USD_PER_MINUTE,
        units: billedMinutes,
        unit_type: 'minutes',
      },
    };
  }

  private toSrt(
    segments: Array<{ startMs: number; endMs: number; text: string }>,
  ): string {
    const toTime = (ms: number) => {
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const mms = ms % 1000;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mms).padStart(3, '0')}`;
    };
    return segments
      .map(
        (s, i) =>
          `${i + 1}\n${toTime(s.startMs)} --> ${toTime(s.endMs)}\n${s.text.trim()}\n`,
      )
      .join('\n');
  }
}

import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { readFileSync } from 'fs';

export interface ExtractedStyleAttributes {
  /** Hex palette swatches the Vision model identified, ordered by salience. */
  palette: string[];
  /** Free-text descriptions: "high contrast typography", "bold serif headings". */
  typography: string[];
  /** Free-text descriptions: "centered hero composition", "diagonal accent lines". */
  layout: string[];
  /** Overall vibe summary in 1-2 sentences. */
  summary: string;
  /** Approximate USD cost of the extraction call. */
  cost_usd: number;
}

const PROMPT = `Analyze this image as a visual style reference for short-form video thumbnails.
Return a JSON object with this exact shape:

{
  "palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "typography": ["short description", "..."],
  "layout": ["short description", "..."],
  "summary": "1-2 sentences capturing the overall visual feel"
}

palette: 3-6 dominant colors, ordered by visual prominence, formatted as #RRGGBB.
typography: 1-3 traits about the type (weight, contrast, serif/sans, all-caps, etc).
layout: 1-3 compositional notes (centered, asymmetric, grid, diagonal, negative space).
summary: One paragraph describing the vibe a designer should emulate.

Return ONLY the JSON. No prose, no markdown fences.`;

// gpt-4o-mini Vision pricing (verified 2026-04):
//   ~$0.15 / 1M input tokens, ~$0.60 / 1M output tokens.
// A single 1024×1024 image plus this prompt + response is ~1500 tokens
// total. Rounded conservative estimate for a per-extraction cost.
const APPROX_COST_PER_EXTRACTION_USD = 0.0015;

/**
 * Wraps OpenAI Vision (gpt-4o-mini) to extract palette + style attrs from
 * a reference image URL. Used by StyleReferenceService when an operator
 * uploads or links a thumbnail style reference.
 *
 * Defensive parsing: if the model returns malformed JSON or extra prose,
 * we fall back to {palette:[], typography:[], layout:[], summary: <raw>}
 * rather than throwing — the operator can still see what came back and
 * re-extract.
 */
@Injectable()
export class VisionExtractorService {
  private readonly logger = new Logger(VisionExtractorService.name);
  private client: OpenAI | null = null;

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY required for VisionExtractorService');
      }
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this.client;
  }

  async extract(imageUrl: string): Promise<ExtractedStyleAttributes> {
    const start = Date.now();
    const response = await this.getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ],
      max_tokens: 600,
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? '';
    const parsed = this.parseResponse(raw);
    this.logger.log(
      `[VISION] extract ${imageUrl.slice(0, 60)}… palette=${parsed.palette.length} ms=${Date.now() - start}`,
    );
    return { ...parsed, cost_usd: APPROX_COST_PER_EXTRACTION_USD };
  }

  /**
   * Phase 3: Extract video style attributes from sampled frames.
   * Frames are local JPEG paths (sampled ~1s apart). We pass them as data URLs
   * to Vision and request a strict JSON object suitable for selecting
   * Remotion style variants.
   */
  async extractFromFrames(framePaths: string[]): Promise<{
    attributes: Record<string, unknown>;
    cost_usd: number;
  }> {
    const start = Date.now();
    const frames = framePaths.slice(0, 12);
    if (frames.length === 0) {
      throw new Error('extractFromFrames requires at least 1 frame');
    }

    const prompt = `You are analyzing sampled frames from a short-form video.
Return ONLY valid JSON with this exact shape:
{
  "cuts_per_10_sec": number,
  "hook_archetype": "question" | "statistic" | "bold-claim" | "callout" | "countdown" | "pattern-interrupt",
  "caption_style": "none" | "single-line-burn-in" | "kinetic-multi-line" | "traditional-subtitle",
  "aspect": "9x16" | "16x9" | "1x1" | "other",
  "energy_tag": "calm" | "medium" | "high",
  "dominant_palette": ["#RRGGBB", "..."]
}
Rules:
- Do NOT copy any visible text verbatim from the frames.
- dominant_palette must be 3-6 hex colors (#RRGGBB).
- Estimate cuts_per_10_sec from visual changes across frames.`;

    const content: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' } }
    > = [{ type: 'text', text: prompt }];

    for (const p of frames) {
      const b64 = readFileSync(p).toString('base64');
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'low' },
      });
    }

    const response = await this.getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content }],
      max_tokens: 700,
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? '';
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let attributes: Record<string, unknown> = {};
    try {
      attributes = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      // Keep the raw response for operator debugging.
      attributes = { summary: raw.slice(0, 600) };
    }

    const ms = Date.now() - start;
    this.logger.log(
      `[VISION] extractFromFrames frames=${frames.length} ms=${ms}`,
    );
    return { attributes, cost_usd: APPROX_COST_PER_EXTRACTION_USD };
  }

  private parseResponse(
    raw: string,
  ): Omit<ExtractedStyleAttributes, 'cost_usd'> {
    // Strip optional markdown fences just in case the model adds them.
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      const obj = JSON.parse(cleaned) as {
        palette?: unknown;
        typography?: unknown;
        layout?: unknown;
        summary?: unknown;
      };
      return {
        palette: this.toStringArray(obj.palette)
          .filter((s) => /^#?[0-9A-Fa-f]{6}$/.test(s))
          .map((s) =>
            s.startsWith('#') ? s.toUpperCase() : `#${s.toUpperCase()}`,
          ),
        typography: this.toStringArray(obj.typography),
        layout: this.toStringArray(obj.layout),
        summary:
          typeof obj.summary === 'string' ? obj.summary : raw.slice(0, 280),
      };
    } catch {
      this.logger.warn(
        `[VISION] non-JSON response, treating as summary: ${raw.slice(0, 100)}`,
      );
      return {
        palette: [],
        typography: [],
        layout: [],
        summary: raw.slice(0, 280),
      };
    }
  }

  private toStringArray(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }
}

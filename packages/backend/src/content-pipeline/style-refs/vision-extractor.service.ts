import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

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

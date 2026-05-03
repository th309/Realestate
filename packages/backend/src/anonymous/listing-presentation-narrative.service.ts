import { Injectable, Logger } from '@nestjs/common';
import { AnthropicService } from '../ai/anthropic.service';

export interface NarrativeInput {
  market: { geoLevel: string; geoId: string; name: string };
  persona: 'agent' | 'investor' | 'homebuyer';
  structuredFacts: Record<string, unknown>;
}

export interface NarrativeOutput {
  thesis: string;
  strategy: string;
  actions: Array<{ title: string; desc: string }>;
  fallbackUsed: boolean;
}

const SYSTEM_PROMPT = `You are PropertyIQ's market-strategy synthesizer. Given structured market facts, write a tight, specific listing-presentation narrative for a real estate agent. Output STRICT JSON only with shape:
{ "thesis": "<3 sentences referencing specific data>", "strategy": "<3 paragraphs with pricing/positioning/timing>", "actions": [ { "title": "<6 words>", "desc": "<1 sentence>" } x 3 ] }
Tone: confident, data-grounded, not generic. Cite exact numbers from the facts.`;

@Injectable()
export class ListingPresentationNarrativeService {
  private logger = new Logger(ListingPresentationNarrativeService.name);

  constructor(private anthropic: AnthropicService) {}

  async generate(input: NarrativeInput): Promise<NarrativeOutput> {
    const userMessage = `Market: ${input.market.name}\nPersona: ${input.persona}\nFacts: ${JSON.stringify(input.structuredFacts, null, 2)}\n\nProduce the narrative JSON now.`;
    try {
      const response = await this.anthropic.messages({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
      const text = response.content?.[0]?.text ?? '';
      const parsed = JSON.parse(text);
      return {
        thesis: parsed.thesis ?? '',
        strategy: parsed.strategy ?? '',
        actions: Array.isArray(parsed.actions)
          ? parsed.actions.slice(0, 3)
          : [],
        fallbackUsed: false,
      };
    } catch (err) {
      this.logger.warn(
        `Narrative generation failed for ${input.market.name}: ${String(err)}`,
      );
      return this.fallback(input);
    }
  }

  private fallback(input: NarrativeInput): NarrativeOutput {
    return {
      thesis: `Market analysis for ${input.market.name} is available. Strategic synthesis is temporarily unavailable; the structured data sections below remain accurate.`,
      strategy:
        'A full AI-synthesized strategy is temporarily unavailable. The structured signals (PropertyIQ Score, market metrics, peer comparison, demographics, employment) remain authoritative for this report.',
      actions: [
        {
          title: 'Review the structured signals',
          desc: 'Use the Market Right Now and Forecast sections to inform pricing.',
        },
        {
          title: 'Compare against peer markets',
          desc: 'Section 5 surfaces three comparable markets for positioning.',
        },
        {
          title: 'Validate with local closed sales',
          desc: 'Cross-check the auto-generated forecast against your most recent comparable closes.',
        },
      ],
      fallbackUsed: true,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { AI_PURPOSES } from '../ai-provider/ai-provider.types';
import { extractJsonObject } from '../ai/extract-json';

export interface NarrativeInput {
  market: { geoLevel: string; geoId: string; name: string };
  persona: 'agent' | 'investor' | 'homebuyer';
  structuredFacts: Record<string, unknown>;
}

export interface NarrativeOutput {
  verdict: string;
  executiveSummary: string;
  strategy: string;
  actions: Array<{ title: string; desc: string }>;
  fallbackUsed: boolean;
}

const SYSTEM_PROMPT = `You are PropertyIQ's market-strategy synthesizer. Given structured market facts, write a tight, specific listing-presentation narrative for a real estate agent. Output STRICT JSON only with shape:
{ "verdict": "<ONE punchy headline sentence the agent leads with>", "executiveSummary": "<2 to 3 short paragraphs telling the fuller market story; expand on the verdict with DIFFERENT specifics, never repeat it>", "strategy": "<3 paragraphs covering pricing, positioning, and timing>", "actions": [ { "title": "<6 words>", "desc": "<1 sentence>" } x 3 ] }
verdict, executiveSummary, and strategy must each be DISTINCT: do not reuse the same sentence across them.
The PropertyIQ Score (propertyiqScore) is on a 0-100 scale where higher means stronger demand and ~50 is the market's state average; ALWAYS describe it out of 100 (e.g. "scores 9/100"), never out of 10.
Tone: confident, data-grounded, not generic. Cite exact numbers from the facts. Plain prose only: no markdown, no asterisks, no em-dashes.`;

@Injectable()
export class ListingPresentationNarrativeService {
  private logger = new Logger(ListingPresentationNarrativeService.name);

  constructor(private aiProvider: AiProviderService) {}

  async generate(input: NarrativeInput): Promise<NarrativeOutput> {
    const userPrompt = `Market: ${input.market.name}\nPersona: ${input.persona}\nFacts: ${JSON.stringify(input.structuredFacts, null, 2)}\n\nProduce the narrative JSON now.`;
    try {
      // Route through AiProviderService so this respects the configured default
      // provider (DeepSeek) via ai_model_config / env, with usage logging and
      // shadow A/B — instead of hardcoding Anthropic.
      const response = await this.aiProvider.complete(
        AI_PURPOSES.LISTING_PRESENTATION_NARRATIVE,
        {
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
          // deepseek-v4-pro is verbose and the 3-paragraph strategy is long, so
          // the old 3000 cap still truncated mid-JSON on busier markets
          // (finish_reason=length) → parse failure → fallback. Match the proven
          // reports/market-analysis pattern: do NOT force response_format
          // json_object (extractJsonObject already unwraps fenced/plain JSON);
          // give a generous 6000-token budget so the full payload completes.
          maxTokens: 6000,
        },
      );
      // The model may wrap the JSON in a markdown fence or lead with prose —
      // extractJsonObject locates and unwraps the JSON object before parsing.
      const parsed = extractJsonObject<{
        verdict?: string;
        executiveSummary?: string;
        strategy?: string;
        actions?: Array<{ title: string; desc: string }>;
      }>(response.content);
      return {
        verdict: parsed.verdict ?? '',
        executiveSummary: parsed.executiveSummary ?? '',
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
      verdict: `Strategic synthesis for ${input.market.name} is temporarily unavailable; the structured signals below remain accurate.`,
      executiveSummary:
        'A full AI-synthesized summary is temporarily unavailable. The structured signals (PropertyIQ Score, market metrics, peer comparison, demographics, employment) remain authoritative for this report.',
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

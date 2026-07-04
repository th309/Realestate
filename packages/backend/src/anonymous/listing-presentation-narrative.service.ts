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

// Shared output contract + tone, identical for every persona. Only the AUDIENCE
// framing (PERSONA_INTRO) changes — that is what makes a homebuyer stop getting
// an agent "listing presentation / farming" narrative (bug #2).
const SHARED_RULES = `Output STRICT JSON only with shape:
{ "verdict": "<ONE punchy headline sentence>", "executiveSummary": "<2 to 3 short paragraphs telling the fuller story; expand on the verdict with DIFFERENT specifics, never repeat it>", "strategy": "<3 short paragraphs>", "actions": [ { "title": "<6 words>", "desc": "<1 sentence>" } x 3 ] }
verdict, executiveSummary, and strategy must each be DISTINCT: do not reuse the same sentence across them.
The PropertyIQ Score (propertyiqScore) is on a 0-100 scale where higher means stronger demand and ~50 is the market's state average; ALWAYS describe it out of 100 (e.g. "scores 9/100"), never out of 10.
Tone: confident, data-grounded, not generic. Cite exact numbers from the facts. Plain prose only: no markdown, no asterisks, no em-dashes.`;

const PERSONA_INTRO: Record<'agent' | 'investor' | 'homebuyer', string> = {
  agent: `You are PropertyIQ's market-strategy synthesizer. Given structured market facts, write a tight, specific listing-presentation narrative for a REAL ESTATE AGENT. The verdict is the headline the agent leads a seller with. The strategy covers pricing, positioning, and timing to win and sell the listing. The actions are the agent's next steps.`,
  homebuyer: `You are PropertyIQ's market-strategy synthesizer. Given structured market facts, write a tight, specific market briefing for a HOMEBUYER deciding whether to buy here. Address the buyer as "you". The verdict answers "is this a good place and time to buy?" in one sentence. The executive summary covers affordability, what your money buys, where prices are headed (your future equity), and how competitive the market is. The strategy covers budgeting and the monthly cost reality, timing, and how to compete for the right home. The actions are concrete buyer next steps (get pre-approved, target the right areas, set a timeline). NEVER use agent or seller framing: no "listing", no "farming", no "pricing your listing", no "sell".`,
  investor: `You are PropertyIQ's market-strategy synthesizer. Given structured market facts, write a tight, specific investment briefing for a REAL ESTATE INVESTOR evaluating this market. The verdict answers "is this a good market to invest in?" in one sentence. The executive summary covers rent versus price (cash-flow potential), the appreciation outlook, and the demand drivers (migration, jobs). The strategy covers cash flow versus appreciation, financing posture, and which submarkets or timing to target. The actions are concrete investor next steps (run the numbers on specific properties, line up financing, target submarkets). NEVER use agent or seller listing framing.`,
};

function systemPromptFor(persona: 'agent' | 'investor' | 'homebuyer'): string {
  return `${PERSONA_INTRO[persona]}\n${SHARED_RULES}`;
}

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
      // The tour finale renders the moment this resolves, so a hung AI call
      // would spin "Loading your market…" until the platform's request timeout
      // (~60s) — never sending a response. Cap the call; on timeout the catch
      // below falls through to the deterministic fallback so the finale ALWAYS
      // resolves quickly.
      const response = await this.withAiTimeout(
        this.aiProvider.complete(AI_PURPOSES.LISTING_PRESENTATION_NARRATIVE, {
          systemPrompt: systemPromptFor(input.persona),
          userPrompt,
          // deepseek-v4-pro is verbose and the 3-paragraph strategy is long, so
          // the old 3000 cap still truncated mid-JSON on busier markets
          // (finish_reason=length) → parse failure → fallback. Match the proven
          // reports/market-analysis pattern: do NOT force response_format
          // json_object (extractJsonObject already unwraps fenced/plain JSON);
          // give a generous 6000-token budget so the full payload completes.
          maxTokens: 6000,
        }),
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

  // 52s: comfortably under the frontend's 55s AbortSignal and the ~60s platform
  // request timeout, but generous enough that a ~40s DeepSeek completion is not
  // discarded at the boundary (F7 fix). Paired with an ai_model_config row that
  // routes this purpose to the faster deepseek-v4-flash model.
  private static readonly AI_TIMEOUT_MS = 52_000;

  /** Race an AI call against a timeout so a hang surfaces as an error (→ fallback). */
  private withAiTimeout<T>(p: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `narrative AI timed out after ${ListingPresentationNarrativeService.AI_TIMEOUT_MS}ms`,
            ),
          ),
        ListingPresentationNarrativeService.AI_TIMEOUT_MS,
      );
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
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
          desc: 'The Market Right Now and Forecast sections below carry the key numbers.',
        },
        {
          title: 'Compare against peer markets',
          desc: 'The peers section surfaces three comparable markets for context.',
        },
        {
          title: 'Validate with local data',
          desc: 'Cross-check the auto-generated forecast against recent comparable activity.',
        },
      ],
      fallbackUsed: true,
    };
  }
}

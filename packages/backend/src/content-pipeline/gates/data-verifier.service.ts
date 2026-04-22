// packages/backend/src/content-pipeline/gates/data-verifier.service.ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { NumericClaim, GateResult, GateViolation } from './gate.types';

const TOLERANCES_BALANCED: Record<string, number> = {
  price: 1000,
  percentage: 0.5,
  score: 0,
  ranking: 0,
  count: 0,
  duration: 0.1,
  date: 0,
};

const EXTRACT_TOOL = {
  name: 'extract_claims',
  description: 'Extract all numeric claims from a video script.',
  input_schema: {
    type: 'object',
    required: ['claims'],
    properties: {
      claims: {
        type: 'array',
        items: {
          type: 'object',
          required: ['quote', 'value', 'category', 'subject'],
          properties: {
            quote: { type: 'string' },
            value: { type: 'number' },
            category: {
              type: 'string',
              enum: [
                'price',
                'percentage',
                'score',
                'ranking',
                'count',
                'date',
                'duration',
              ],
            },
            subject: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class DataVerifierService {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async verify(scriptText: string, mcpPayload: unknown): Promise<GateResult> {
    const claims = await this.extractClaims(scriptText);
    const violations: GateViolation[] = [];
    const candidates = this.extractNumericValues(mcpPayload);
    for (const claim of claims) {
      const tolerance = this.toleranceFor(claim.category, claim.value);
      const hit = candidates.find((n) => {
        const diff = Math.abs(n - claim.value);
        if (diff <= tolerance) return true;
        // For count/duration claims, treat sign-flipped deltas as equivalent
        // ("fell 5 points" in script vs -5 delta in payload).
        if (claim.category === 'count' || claim.category === 'duration') {
          if (Math.abs(Math.abs(n) - Math.abs(claim.value)) <= tolerance) {
            return true;
          }
        }
        return false;
      });
      if (hit === undefined) {
        // Ranking claim with an explicit subject must match the subject's rank,
        // not merely any numeric match.
        if (
          claim.category === 'ranking' &&
          this.isHallucinatedRanking(claim, mcpPayload)
        ) {
          violations.push({
            claim,
            actual_in_script: claim.value,
            reason: 'unmatched',
          });
          continue;
        }
        violations.push({
          claim,
          actual_in_script: claim.value,
          reason: 'unmatched',
        });
      } else if (
        claim.category === 'ranking' &&
        this.isHallucinatedRanking(claim, mcpPayload)
      ) {
        // Value coincidentally matched, but the subject's real rank differs.
        violations.push({
          claim,
          actual_in_script: claim.value,
          reason: 'out_of_tolerance',
        });
      }
    }
    return { passed: violations.length === 0, violations };
  }

  private isHallucinatedRanking(
    claim: NumericClaim,
    mcpPayload: unknown,
  ): boolean {
    const subject = (claim.subject ?? '').trim();
    if (!subject || subject === 'unknown') return false;
    const entries = this.extractRankedEntries(mcpPayload);
    if (entries.length === 0) return false;
    const subjectLc = subject.toLowerCase();
    const match = entries.find((e) => e.name.toLowerCase().includes(subjectLc));
    if (!match) return true;
    return match.rank !== claim.value;
  }

  private extractRankedEntries(
    obj: unknown,
  ): Array<{ rank: number; name: string }> {
    const out: Array<{ rank: number; name: string }> = [];
    const visit = (v: unknown) => {
      if (Array.isArray(v)) {
        for (const item of v) {
          if (
            item &&
            typeof item === 'object' &&
            typeof item.rank === 'number' &&
            typeof item.name === 'string'
          ) {
            out.push({
              rank: item.rank,
              name: item.name,
            });
          } else {
            visit(item);
          }
        }
      } else if (v && typeof v === 'object') {
        Object.values(v).forEach(visit);
      }
    };
    visit(obj);
    return out;
  }

  private async extractClaims(scriptText: string): Promise<NumericClaim[]> {
    const response = await this.client.messages.create({
      model: process.env.SCRIPT_LLM_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 1500,
      tools: [EXTRACT_TOOL as unknown as Anthropic.Messages.Tool],
      tool_choice: { type: 'tool', name: 'extract_claims' },
      messages: [
        {
          role: 'user',
          content:
            'Extract every factual numeric claim from this script. ' +
            'Rules for what is NOT a claim and should be OMITTED:\n' +
            '- Scale denominators (e.g., "out of 100", "out of 5", "on a 1 to 10 scale") are not factual claims about the subject. Only extract the score value, not the scale.\n' +
            '- Generic fractions or colloquial phrases like "one in five", "a third of", "half of" without a specific numeric subject.\n' +
            '- Numbers inside URLs, hashtags, or brand names.\n' +
            'Only extract numbers that assert a specific measurable fact (a price, percentage, score, ranking, count, duration, or date). If uncertain, omit.\n\n' +
            'Script:\n' +
            scriptText,
        },
      ],
    });
    const toolBlock = response.content.find((c) => c.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') return [];
    return (toolBlock.input as { claims: NumericClaim[] }).claims;
  }

  private extractNumericValues(obj: unknown): number[] {
    const out: number[] = [];
    const visit = (v: unknown) => {
      if (typeof v === 'number') out.push(v);
      else if (typeof v === 'string') {
        // ISO date-like strings contribute a year value so date claims can match.
        const isoMatch = v.match(/\b(19|20)\d{2}\b/);
        if (isoMatch) out.push(parseInt(isoMatch[0], 10));
      } else if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') Object.values(v).forEach(visit);
    };
    visit(obj);
    return out;
  }

  private toleranceFor(
    cat: NumericClaim['category'],
    claimValue?: number,
  ): number {
    const strictness =
      process.env.CONTENT_PIPELINE_GATE_STRICTNESS ?? 'balanced';
    const multiplier =
      strictness === 'relaxed' ? 2 : strictness === 'strict' ? 0.5 : 1;
    const base = TOLERANCES_BALANCED[cat] ?? 0;
    // Prices use a 1% percentage floor so "about $1 million" matches $1,004,500.
    if (cat === 'price' && claimValue !== undefined) {
      return Math.max(base, Math.abs(claimValue) * 0.01) * multiplier;
    }
    // Count claims (populations, listings, etc.) tolerate 5% drift for
    // natural rounding: "over 2.1 million" against 2,050,000 is within norms
    // for a human-readable script. Scores, rankings, and dates stay strict.
    if (cat === 'count' && claimValue !== undefined) {
      return Math.max(base, Math.abs(claimValue) * 0.05) * multiplier;
    }
    return base * multiplier;
  }
}

// packages/backend/src/content-pipeline/gates/brand-voice-linter.service.ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  FORBIDDEN_PHRASES,
  EM_DASH_CHARS,
  SCORE_REFERENCE_REGEX,
  APPROVED_SCORE_PREFIXES,
} from './voice-rules';
import { GateResult } from './gate.types';

const JUDGE_TOOL = {
  name: 'judge_brand_voice',
  description: 'Rate a script for PropertyIQ brand voice compliance.',
  input_schema: {
    type: 'object',
    required: ['score', 'violations'],
    properties: {
      score: { type: 'integer', minimum: 1, maximum: 5 },
      violations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['severity', 'issue', 'quote'],
          properties: {
            severity: { type: 'string', enum: ['critical', 'warning'] },
            issue: { type: 'string' },
            quote: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class BrandVoiceLinterService {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async lint(scriptText: string): Promise<GateResult> {
    const deterministic = this.deterministicPass(scriptText);
    if (!deterministic.passed) return deterministic;
    return this.llmJudgePass(scriptText);
  }

  private deterministicPass(scriptText: string): GateResult {
    const violations: GateResult['violations'] = [];

    for (const ch of EM_DASH_CHARS) {
      if (scriptText.includes(ch)) {
        violations.push({
          claim: { quote: ch, value: 0, category: 'count', subject: 'em_dash' },
          actual_in_script: 0,
          reason: 'unmatched',
        });
      }
    }
    for (const phrase of FORBIDDEN_PHRASES) {
      const regex = new RegExp(
        `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i',
      );
      const match = scriptText.match(regex);
      if (match) {
        violations.push({
          claim: {
            quote: match[0],
            value: 0,
            category: 'count',
            subject: 'forbidden_phrase',
          },
          actual_in_script: 0,
          reason: 'unmatched',
        });
      }
    }
    // Bare "score" references are OK once the script has established
    // "PropertyIQ Score" or "PIQ Score" at least once. This allows natural
    // back-references like "that score" or "the score" without tripping
    // the linter. Competing products (InvestorEdge, HomeReady, Market
    // Health Index) are caught explicitly in FORBIDDEN_PHRASES above.
    const scriptEstablishesPropertyIQScore =
      APPROVED_SCORE_PREFIXES.test(scriptText);
    const scoreMatches = scriptEstablishesPropertyIQScore
      ? []
      : [...scriptText.matchAll(SCORE_REFERENCE_REGEX)];
    for (const m of scoreMatches) {
      const windowText = scriptText.slice(
        Math.max(0, m.index - 25),
        m.index + m[0].length,
      );
      if (!APPROVED_SCORE_PREFIXES.test(windowText)) {
        violations.push({
          claim: {
            quote: 'score without PropertyIQ prefix',
            value: 0,
            category: 'count',
            subject: 'score_ref',
          },
          actual_in_script: 0,
          reason: 'unmatched',
        });
        break;
      }
    }
    return { passed: violations.length === 0, violations };
  }

  private async llmJudgePass(scriptText: string): Promise<GateResult> {
    const minScore = parseInt(process.env.GATE_B_MIN_SCORE ?? '4', 10);
    const systemPrompt =
      'You are a brand voice auditor for PropertyIQ. Rate this script 1 to 5 on brand voice compliance. Brand voice is confident, conversational, data-first, not hypey. Use the tool to output structured JSON.';

    // Substitute the short-link placeholder with a canonical example URL so
    // the judge evaluates the script as if it were finalized. The actual
    // short link is inserted per-platform during the publishing step; the
    // placeholder is expected at this stage and must not be flagged.
    const scriptForJudge = scriptText.replace(
      /\{\{SHORT_LINK\}\}/g,
      'https://propertyiq.app/go/example',
    );

    const response = await this.client.messages.create({
      model: process.env.GATE_B_JUDGE_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 800,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [JUDGE_TOOL as unknown as Anthropic.Messages.Tool],
      tool_choice: { type: 'tool', name: 'judge_brand_voice' },
      messages: [{ role: 'user', content: scriptForJudge }],
    });

    const toolBlock = response.content.find((c) => c.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return { passed: false, violations: [] };
    }
    const judged = toolBlock.input as {
      score: number;
      violations: Array<{ severity: string; issue: string; quote: string }>;
    };
    const critical = judged.violations.filter((v) => v.severity === 'critical');

    return {
      passed: judged.score >= minScore && critical.length === 0,
      violations: judged.violations.map((v) => ({
        claim: {
          quote: v.quote,
          value: 0,
          category: 'count',
          subject: v.issue,
        },
        actual_in_script: 0,
        reason: 'unmatched',
      })),
      llm_judge_response: judged,
    };
  }
}

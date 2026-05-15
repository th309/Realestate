/**
 * Coverage for AnalyzerAiController — focuses on the new ai-insights/section
 * (JSON) and ai-insights/header (SSE) endpoints. Mocks the underlying
 * AiInsightsService so we don't pull in the real Redis cache or AI provider
 * stack; mocks AnalyzerTierGate to a no-op so the test isn't gated.
 *
 * The legacy ai-verdict endpoint is exercised separately in
 * `__tests__/ai-verdict.spec.ts` (prompt-builder-only assertions); we don't
 * duplicate that here.
 */
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { AnalyzerAiController } from '../analyzer-ai.controller';
import { AnalyzerService } from '../analyzer.service';
import { AiInsightsService } from '../ai-insights.service';
import { AnalyzerTierGate } from '../analyzer-tier-gate.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { InsightPayload } from '../ai-insights.service';
import type { AiInsightsSectionBodyDto } from '../dto/ai-insights.dto';

const samplePayload: InsightPayload = {
  input: { price: 425_000, rentMonthly: 2_950, taxAnnual: 6_400 },
  result: { monthlyCashFlow: 412, capRate: 0.064, coc: 0.082 },
  rentcast: {
    avm: { value: 432_000 },
    rent: { value: 2_900 },
    salesComps: [],
    rentalComps: [],
  },
  piq: { score: 73, label: 'GOOD', marketHeat: 8.2 },
};

/**
 * Minimal Express Response stub — captures setHeader/write/end calls so the
 * SSE assertions can inspect the framing without spinning up a real server.
 */
function mockResponse(): jest.Mocked<Response> & {
  writes: string[];
  ended: boolean;
} {
  const writes: string[] = [];
  let ended = false;
  const res: any = {
    writes,
    get ended() {
      return ended;
    },
    setHeader: jest.fn(),
    write: jest.fn((chunk: string) => {
      writes.push(chunk);
      return true;
    }),
    end: jest.fn(() => {
      ended = true;
    }),
  };
  return res;
}

describe('AnalyzerAiController', () => {
  let controller: AnalyzerAiController;
  let aiInsights: {
    complete: jest.Mock;
    stream: jest.Mock;
  };
  let analyzerService: { streamAiVerdict: jest.Mock };
  let tierGate: { requirePro: jest.Mock };

  beforeEach(async () => {
    aiInsights = {
      complete: jest.fn(),
      stream: jest.fn(),
    };
    analyzerService = { streamAiVerdict: jest.fn() };
    tierGate = { requirePro: jest.fn().mockResolvedValue(undefined) };

    const mod = await Test.createTestingModule({
      controllers: [AnalyzerAiController],
      providers: [
        { provide: AnalyzerService, useValue: analyzerService },
        { provide: AiInsightsService, useValue: aiInsights },
        { provide: AnalyzerTierGate, useValue: tierGate },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = mod.get(AnalyzerAiController);
  });

  describe('POST /ai-insights/section', () => {
    it('returns the AIAnnotationDto produced by AiInsightsService.complete', async () => {
      aiInsights.complete.mockResolvedValue({
        text: 'Cap rate at 6.4% beats the metro median by 80 bps.',
        threadId: 'thread-abc',
        citedFacts: ['cap=6.4%'],
        cacheHit: false,
      });

      const body: AiInsightsSectionBodyDto = {
        payload: samplePayload,
        id: 'projection',
      };
      const result = await controller.sectionInsight('user-1', body);

      expect(tierGate.requirePro).toHaveBeenCalledWith('user-1');
      expect(aiInsights.complete).toHaveBeenCalledWith(
        samplePayload,
        'projection',
      );
      expect(result).toEqual({
        text: 'Cap rate at 6.4% beats the metro median by 80 bps.',
        threadId: 'thread-abc',
        citedFacts: ['cap=6.4%'],
        cacheHit: false,
      });
    });
  });

  describe('POST /ai-insights/header', () => {
    it('writes data: prefixed chunks for each yielded token, then [DONE]', async () => {
      aiInsights.stream.mockImplementation(async function* () {
        yield 'Buy.';
        yield ' Cap rate ';
        yield '6.4%.';
      });

      const res = mockResponse();
      await controller.headerInsight(
        'user-1',
        { payload: samplePayload },
        res as unknown as Response,
      );

      expect(tierGate.requirePro).toHaveBeenCalledWith('user-1');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');

      expect(res.writes).toEqual([
        `data: ${JSON.stringify({ chunk: 'Buy.' })}\n\n`,
        `data: ${JSON.stringify({ chunk: ' Cap rate ' })}\n\n`,
        `data: ${JSON.stringify({ chunk: '6.4%.' })}\n\n`,
        'data: [DONE]\n\n',
      ]);
      expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('emits a data: error frame and still closes the connection on stream failure', async () => {
      aiInsights.stream.mockImplementation(async function* () {
        yield 'Pa';
        throw new Error('upstream timeout');
      });

      const res = mockResponse();
      await controller.headerInsight(
        'user-1',
        { payload: samplePayload },
        res as unknown as Response,
      );

      expect(res.writes).toEqual([
        `data: ${JSON.stringify({ chunk: 'Pa' })}\n\n`,
        `data: ${JSON.stringify({ error: 'upstream timeout' })}\n\n`,
      ]);
      expect(res.end).toHaveBeenCalledTimes(1);
    });
  });
});

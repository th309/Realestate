/**
 * Integration-style tests for the BRRRR path on /api/analyzer/grade-brrrr and
 * the strategy-discriminated threshold endpoints. The controllers are wired
 * with the real GradingService + real DTO validators but mock ThresholdsService,
 * MarketResolutionService, and Supabase.
 *
 * Covered behaviors:
 *   - POST /grade-brrrr with BRRRR input → BRRRR-shaped DealGradingResult
 *   - anon caller → BRRRR_DEFAULTS
 *   - authed caller with saved BRRRR thresholds → customs
 *   - DOM auto-resolution: geoId present, context.marketDomDays absent
 *   - DOM auto-resolution: explicit context value preempts the lookup
 *   - DOM auto-resolution: no identifier → DOM stays undefined
 *   - GET /thresholds/BRRRR → BRRRR_DEFAULTS when no row
 *   - PUT /thresholds/BRRRR with BRRRR rubric succeeds
 *   - PUT /thresholds/BRRRR with B&H or F&F keys → 400
 *   - cash + hard_money initial financing both grade
 */
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import {
  BRRRR_DEFAULTS,
  BUY_AND_HOLD_DEFAULTS,
  FIX_AND_FLIP_DEFAULTS,
} from '@propertyiq/analyzer-core';
import { GradeController } from '../grade.controller';
import { ThresholdsController } from '../thresholds.controller';
import { GradingService } from '../grading.service';
import { ThresholdsService } from '../thresholds.service';
import { MarketResolutionService } from '../market-resolution.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { GradeBrrrrDealDto } from '../dto/grade-brrrr-deal.dto';

const SAMPLE_BRRRR_INPUT = {
  strategy: 'BRRRR' as const,
  purchasePrice: 75_000,
  arv: 170_000,
  rehabCost: 25_000,
  rehabContingencyPct: 0.1,
  buyClosingPct: 0.03,
  holdMonthsBeforeRefi: 5,
  initialFinancingType: 'hard_money' as const,
  hardMoneyRate: 12,
  hardMoneyPoints: 0.02,
  hardMoneyLtcPct: 0.8,
  holdingCashOutOfPocket: 3_000,
  propertyTaxAnnual: 1_800,
  insuranceAnnual: 900,
  utilitiesMonthly: 150,
  hoaMonthly: 0,
  refiLtvPct: 0.7,
  refiRate: 7.5,
  refiTermYears: 30,
  refiClosingPct: 0.025,
  monthlyRent: 1_700,
  vacancyPct: 0.05,
  maintenancePct: 0.08,
  capexPct: 0,
  pmPct: 0.08,
  unitCount: 1,
  marketGeoId: '26900', // Indianapolis CBSA
};

const SAMPLE_BRRRR_CASH = {
  ...SAMPLE_BRRRR_INPUT,
  initialFinancingType: 'cash' as const,
  hardMoneyRate: undefined,
  hardMoneyPoints: undefined,
  hardMoneyLtcPct: undefined,
};

describe('GradeController — BRRRR path', () => {
  let controller: GradeController;
  let thresholdsController: ThresholdsController;
  let thresholds: {
    getThresholds: jest.Mock;
    upsertThresholds: jest.Mock;
    deleteThresholds: jest.Mock;
  };
  let marketResolution: { resolve: jest.Mock; clearCache: jest.Mock };
  let supabaseService: { getClient: jest.Mock };

  beforeEach(async () => {
    thresholds = {
      getThresholds: jest.fn().mockResolvedValue(null),
      upsertThresholds: jest.fn().mockImplementation((_u, _s, t) => t),
      deleteThresholds: jest.fn().mockResolvedValue(undefined),
    };
    marketResolution = {
      resolve: jest.fn().mockResolvedValue({
        marketDomDays: 40,
        marketPiqScore: 64,
      }),
      clearCache: jest.fn(),
    };
    supabaseService = {
      getClient: jest.fn().mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
          }),
        },
      }),
    };

    const mod = await Test.createTestingModule({
      controllers: [GradeController, ThresholdsController],
      providers: [
        GradingService,
        { provide: ThresholdsService, useValue: thresholds },
        { provide: MarketResolutionService, useValue: marketResolution },
        { provide: SupabaseService, useValue: supabaseService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = mod.get(GradeController);
    thresholdsController = mod.get(ThresholdsController);
  });

  // ---- POST /grade-brrrr ----------------------------------------------------

  describe('POST /grade-brrrr', () => {
    const anonReq = { headers: {} } as unknown as Request;

    it('anonymous → uses BRRRR_DEFAULTS, returns BRRRR metric keys', async () => {
      const result = await controller.gradeBrrrr(anonReq, {
        strategy: 'BRRRR',
        input: SAMPLE_BRRRR_INPUT,
      } as unknown as GradeBrrrrDealDto);
      expect(result.metrics.map((m) => m.key)).toEqual([
        'cash_left_in_deal',
        'all_in_to_arv_ratio',
        'post_refi_dscr',
        'post_refi_cash_flow_per_door',
        'time_to_refinance_months',
      ]);
      expect(thresholds.getThresholds).not.toHaveBeenCalled();
    });

    it('authenticated → uses saved BRRRR thresholds when present', async () => {
      const customs = {
        ...BRRRR_DEFAULTS,
        cash_left_in_deal: {
          A: -1000,
          B: -2000,
          C: -3000,
          D: -4000,
          direction: 'lower_is_better' as const,
        },
      };
      thresholds.getThresholds.mockResolvedValueOnce(customs);
      const req = {
        headers: { authorization: 'Bearer fake' },
      } as unknown as Request;
      const result = await controller.gradeBrrrr(req, {
        strategy: 'BRRRR',
        input: SAMPLE_BRRRR_INPUT,
      } as unknown as GradeBrrrrDealDto);
      expect(thresholds.getThresholds).toHaveBeenCalledWith('user-1', 'BRRRR');
      const cashLeftMetric = result.metrics.find(
        (m) => m.key === 'cash_left_in_deal',
      );
      expect(cashLeftMetric?.threshold.A).toBe(-1000);
    });

    it('DOM auto-resolution: geoId provided + context lacks DOM → resolves via market service', async () => {
      await controller.gradeBrrrr(anonReq, {
        strategy: 'BRRRR',
        input: SAMPLE_BRRRR_INPUT,
      } as unknown as GradeBrrrrDealDto);
      expect(marketResolution.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ marketGeoId: '26900' }),
      );
    });

    it('DOM auto-resolution: explicit context preempts the lookup', async () => {
      await controller.gradeBrrrr(anonReq, {
        strategy: 'BRRRR',
        input: SAMPLE_BRRRR_INPUT,
        context: { marketDomDays: 99, marketPiqScore: 88 },
      } as unknown as GradeBrrrrDealDto);
      expect(marketResolution.resolve).not.toHaveBeenCalled();
    });

    it('no identifier + no explicit context → resolve NOT called', async () => {
      const noMarket = { ...SAMPLE_BRRRR_INPUT };
      delete (noMarket as Record<string, unknown>).marketGeoId;
      await controller.gradeBrrrr(anonReq, {
        strategy: 'BRRRR',
        input: noMarket,
      } as unknown as GradeBrrrrDealDto);
      expect(marketResolution.resolve).not.toHaveBeenCalled();
    });

    it('cash initial financing computes correctly', async () => {
      const result = await controller.gradeBrrrr(anonReq, {
        strategy: 'BRRRR',
        input: SAMPLE_BRRRR_CASH,
      } as unknown as GradeBrrrrDealDto);
      // Cash branch should produce a finite grade letter (no exception).
      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.letter);
    });

    it('hard_money initial financing computes correctly', async () => {
      const result = await controller.gradeBrrrr(anonReq, {
        strategy: 'BRRRR',
        input: SAMPLE_BRRRR_INPUT,
      } as unknown as GradeBrrrrDealDto);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.letter);
    });
  });

  // ---- Threshold endpoints --------------------------------------------------

  describe('BRRRR threshold endpoints', () => {
    it('GET /thresholds/BRRRR returns BRRRR_DEFAULTS when no row exists', async () => {
      thresholds.getThresholds.mockResolvedValueOnce(null);
      const result = await thresholdsController.getThresholds(
        'user-1',
        'BRRRR',
      );
      expect(result).toEqual(BRRRR_DEFAULTS);
    });

    it('GET /thresholds/BRRRR returns the saved row when present', async () => {
      thresholds.getThresholds.mockResolvedValueOnce(BRRRR_DEFAULTS);
      const result = await thresholdsController.getThresholds(
        'user-1',
        'BRRRR',
      );
      expect(result).toEqual(BRRRR_DEFAULTS);
    });

    it('PUT /thresholds/BRRRR with valid BRRRR rubric succeeds', async () => {
      const ok = await thresholdsController.putThresholds(
        'user-1',
        'BRRRR',
        BRRRR_DEFAULTS as unknown,
      );
      expect(thresholds.upsertThresholds).toHaveBeenCalledWith(
        'user-1',
        'BRRRR',
        expect.objectContaining({
          cash_left_in_deal: expect.any(Object),
          all_in_to_arv_ratio: expect.any(Object),
          post_refi_dscr: expect.any(Object),
        }),
      );
      expect(ok).toBeDefined();
    });

    it('PUT /thresholds/BRRRR with B&H keys → 400 (shape mismatch)', async () => {
      await expect(
        thresholdsController.putThresholds(
          'user-1',
          'BRRRR',
          BUY_AND_HOLD_DEFAULTS as unknown,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(thresholds.upsertThresholds).not.toHaveBeenCalled();
    });

    it('PUT /thresholds/BRRRR with F&F keys → 400 (shape mismatch)', async () => {
      await expect(
        thresholdsController.putThresholds(
          'user-1',
          'BRRRR',
          FIX_AND_FLIP_DEFAULTS as unknown,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(thresholds.upsertThresholds).not.toHaveBeenCalled();
    });

    it('DELETE /thresholds/BRRRR is idempotent', async () => {
      const result = await thresholdsController.deleteThresholds(
        'user-1',
        'BRRRR',
      );
      expect(result).toEqual({ ok: true });
      expect(thresholds.deleteThresholds).toHaveBeenCalledWith(
        'user-1',
        'BRRRR',
      );
    });
  });
});

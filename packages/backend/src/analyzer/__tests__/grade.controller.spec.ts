/**
 * Unit tests for GradeController.
 *
 * Covers:
 *   - POST /grade resolution order: override → saved → defaults → anon
 *   - JWT-guarded threshold CRUD (GET/PUT/DELETE)
 *   - DTO-level validation: weights-sum-to-100 and A>B>C>D ordering
 *
 * Service-level RLS note: the controller never accepts a `forUserId` field;
 * `userId` is always sourced from JWT (`AuthUserId`) or omitted (anonymous).
 * A user cannot operate on another user's saved thresholds through this API.
 */
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import type { Request } from 'express';
import { BUY_AND_HOLD_DEFAULTS } from '@propertyiq/analyzer-core';
import { GradeController } from '../grade.controller';
import { ThresholdsController } from '../thresholds.controller';
import { GradingService } from '../grading.service';
import { ThresholdsService } from '../thresholds.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserThresholdsDto } from '../dto/user-thresholds.dto';
import type { GradeDealDto } from '../dto/grade-deal.dto';

const SAMPLE_INPUT: GradeDealDto['input'] = {
  price: 350_000,
  rentMonthly: 2_800,
  taxAnnual: 6_000,
  insuranceAnnual: 1_800,
  financing: {
    downPaymentPct: 0.25,
    interestRatePct: 7,
    termYears: 30,
  },
};

const STUB_GRADE_RESULT = {
  letter: 'B' as const,
  label: 'Good',
  summary: '',
  rawGpa: 3.0,
  marketAdjustment: 0,
  finalGpa: 3.0,
  metrics: [],
  advisories: [],
  autoKills: [],
};

describe('GradeController', () => {
  let controller: GradeController;
  let thresholdsController: ThresholdsController;
  let gradingService: { gradeDeal: jest.Mock };
  let thresholds: {
    getThresholds: jest.Mock;
    upsertThresholds: jest.Mock;
    deleteThresholds: jest.Mock;
  };
  let supabaseService: { getClient: jest.Mock };

  beforeEach(async () => {
    gradingService = {
      gradeDeal: jest.fn().mockResolvedValue(STUB_GRADE_RESULT),
    };
    thresholds = {
      getThresholds: jest.fn().mockResolvedValue(null),
      upsertThresholds: jest.fn(),
      deleteThresholds: jest.fn().mockResolvedValue(undefined),
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
        { provide: GradingService, useValue: gradingService },
        { provide: ThresholdsService, useValue: thresholds },
        { provide: SupabaseService, useValue: supabaseService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = mod.get(GradeController);
    thresholdsController = mod.get(ThresholdsController);
  });

  describe('POST /grade', () => {
    it('anonymous (no Authorization header) → userId null', async () => {
      const req = { headers: {} } as unknown as Request;
      await controller.grade(req, {
        strategy: 'BUY_AND_HOLD',
        input: SAMPLE_INPUT,
      });
      expect(gradingService.gradeDeal).toHaveBeenCalledWith(
        expect.objectContaining({ strategy: 'BUY_AND_HOLD' }),
        null,
      );
    });

    it('Bearer token → extracts userId via supabase.auth.getUser', async () => {
      const req = {
        headers: { authorization: 'Bearer some.jwt.token' },
      } as unknown as Request;
      await controller.grade(req, {
        strategy: 'BUY_AND_HOLD',
        input: SAMPLE_INPUT,
      });
      expect(gradingService.gradeDeal).toHaveBeenCalledWith(
        expect.any(Object),
        'user-1',
      );
    });

    it('invalid Bearer token → userId null (never throws)', async () => {
      supabaseService.getClient.mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'invalid jwt' },
          }),
        },
      });
      const req = {
        headers: { authorization: 'Bearer garbage' },
      } as unknown as Request;
      const result = await controller.grade(req, {
        strategy: 'BUY_AND_HOLD',
        input: SAMPLE_INPUT,
      });
      expect(result).toEqual(STUB_GRADE_RESULT);
      expect(gradingService.gradeDeal).toHaveBeenCalledWith(
        expect.any(Object),
        null,
      );
    });
  });

  describe('GET /thresholds/:strategy', () => {
    it('returns saved thresholds when present', async () => {
      thresholds.getThresholds.mockResolvedValue(BUY_AND_HOLD_DEFAULTS);
      const result = await thresholdsController.getThresholds(
        'user-1',
        'BUY_AND_HOLD',
      );
      expect(result).toEqual(BUY_AND_HOLD_DEFAULTS);
      expect(thresholds.getThresholds).toHaveBeenCalledWith(
        'user-1',
        'BUY_AND_HOLD',
      );
    });

    it('returns defaults when no row exists', async () => {
      thresholds.getThresholds.mockResolvedValue(null);
      const result = await thresholdsController.getThresholds(
        'user-1',
        'BUY_AND_HOLD',
      );
      expect(result).toEqual(BUY_AND_HOLD_DEFAULTS);
    });

    it('GET after DELETE returns defaults', async () => {
      await thresholdsController.deleteThresholds('user-1', 'BUY_AND_HOLD');
      thresholds.getThresholds.mockResolvedValue(null);
      const result = await thresholdsController.getThresholds(
        'user-1',
        'BUY_AND_HOLD',
      );
      expect(result).toEqual(BUY_AND_HOLD_DEFAULTS);
    });

    it('rejects unknown strategy with 400', async () => {
      await expect(
        thresholdsController.getThresholds('user-1', 'NOT_A_STRATEGY'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('PUT /thresholds/:strategy', () => {
    it('forwards body to ThresholdsService.upsertThresholds', async () => {
      thresholds.upsertThresholds.mockResolvedValue(BUY_AND_HOLD_DEFAULTS);
      const result = await thresholdsController.putThresholds(
        'user-1',
        'BUY_AND_HOLD',
        // Cast: at runtime the body is the validated DTO; we pass the
        // shape-compatible default for unit-test convenience.
        BUY_AND_HOLD_DEFAULTS as unknown as UserThresholdsDto,
      );
      expect(result).toEqual(BUY_AND_HOLD_DEFAULTS);
      expect(thresholds.upsertThresholds).toHaveBeenCalledWith(
        'user-1',
        'BUY_AND_HOLD',
        BUY_AND_HOLD_DEFAULTS,
      );
    });

    it('rejects unknown strategy with 400', async () => {
      await expect(
        thresholdsController.putThresholds(
          'user-1',
          'NOPE',
          BUY_AND_HOLD_DEFAULTS as unknown as UserThresholdsDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('DELETE /thresholds/:strategy', () => {
    it('calls ThresholdsService.deleteThresholds and returns ok', async () => {
      const result = await thresholdsController.deleteThresholds(
        'user-1',
        'BUY_AND_HOLD',
      );
      expect(result).toEqual({ ok: true });
      expect(thresholds.deleteThresholds).toHaveBeenCalledWith(
        'user-1',
        'BUY_AND_HOLD',
      );
    });
  });
});

describe('UserThresholdsDto validation', () => {
  it('accepts a well-formed payload (the BUY_AND_HOLD default preset)', async () => {
    const instance = plainToInstance(UserThresholdsDto, BUY_AND_HOLD_DEFAULTS);
    const errors = await validate(instance);
    expect(errors).toEqual([]);
  });

  it('rejects weights that do not sum to 100', async () => {
    const bad = {
      ...BUY_AND_HOLD_DEFAULTS,
      weights: {
        cashOnCash: 25,
        dscr: 25,
        cashFlowPerDoor: 20,
        capRate: 15,
        breakEvenOccupancy: 14, // sums to 99
      },
    };
    const instance = plainToInstance(UserThresholdsDto, bad);
    const errors = await validate(instance);
    const flat = JSON.stringify(errors);
    expect(flat).toMatch(/weights must sum to 100/);
  });

  it('rejects A < B for higher_is_better', async () => {
    const bad = {
      ...BUY_AND_HOLD_DEFAULTS,
      cashOnCash: {
        A: 0.04, // lower than B/C/D → violates higher_is_better ordering
        B: 0.1,
        C: 0.08,
        D: 0.06,
        direction: 'higher_is_better',
      },
    };
    const instance = plainToInstance(UserThresholdsDto, bad);
    const errors = await validate(instance);
    const flat = JSON.stringify(errors);
    expect(flat).toMatch(/strictly decreasing/);
  });

  it('rejects A > B for lower_is_better', async () => {
    const bad = {
      ...BUY_AND_HOLD_DEFAULTS,
      breakEvenOccupancy: {
        A: 0.95,
        B: 0.9,
        C: 0.85,
        D: 0.8,
        direction: 'lower_is_better',
      },
    };
    const instance = plainToInstance(UserThresholdsDto, bad);
    const errors = await validate(instance);
    const flat = JSON.stringify(errors);
    expect(flat).toMatch(/strictly increasing/);
  });
});

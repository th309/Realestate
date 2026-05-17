/**
 * Unit tests for GradeController.upgradePath (POST /api/analyzer/upgrade-path).
 *
 * Mirrors the grade.controller.spec.ts approach:
 *   - JwtAuthGuard overridden to canActivate=true so optional auth uses the
 *     internal `extractOptionalUserId` helper based on the Authorization header.
 *   - GradingService mocked: only `resolveThresholds` is exercised by this
 *     endpoint. We assert it's invoked with the correct (strategy, userId,
 *     override) tuple and that the result of `computeUpgradePath` is
 *     returned to the caller.
 *
 * The actual upgrade-path math is covered by analyzer-core's own test suite
 * (upgrade-path.test.ts, 20 cases). This file verifies wiring and validation.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import type { Request } from 'express';
import { BUY_AND_HOLD_DEFAULTS } from '@propertyiq/analyzer-core';
import { GradeController } from '../grade.controller';
import { GradingService } from '../grading.service';
import { ThresholdsService } from '../thresholds.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpgradePathDto } from '../dto/upgrade-path.dto';

const SAMPLE_INPUT: UpgradePathDto['input'] = {
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

describe('GradeController.upgradePath', () => {
  let controller: GradeController;
  let gradingService: {
    gradeDeal: jest.Mock;
    resolveThresholds: jest.Mock;
  };
  let thresholds: {
    getThresholds: jest.Mock;
    upsertThresholds: jest.Mock;
    deleteThresholds: jest.Mock;
  };
  let supabaseService: { getClient: jest.Mock };

  beforeEach(async () => {
    gradingService = {
      gradeDeal: jest.fn(),
      // Always return the default rubric so computeUpgradePath has a valid
      // input regardless of which test case is exercising the wiring.
      resolveThresholds: jest.fn().mockResolvedValue(BUY_AND_HOLD_DEFAULTS),
    };
    thresholds = {
      getThresholds: jest.fn(),
      upsertThresholds: jest.fn(),
      deleteThresholds: jest.fn(),
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
      controllers: [GradeController],
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
  });

  it('anonymous (no Authorization header) → resolveThresholds called with userId null', async () => {
    const req = { headers: {} } as unknown as Request;
    const result = await controller.upgradePath(req, {
      strategy: 'BUY_AND_HOLD',
      input: SAMPLE_INPUT,
      targetGrade: 'A',
    });
    expect(gradingService.resolveThresholds).toHaveBeenCalledWith(
      'BUY_AND_HOLD',
      null,
      undefined,
    );
    // computeUpgradePath always returns an UpgradePathResult-shaped object.
    expect(result).toHaveProperty('currentGrade');
    expect(result).toHaveProperty('targetGrade', 'A');
    expect(result).toHaveProperty('options');
    expect(Array.isArray(result.options)).toBe(true);
  });

  it('Bearer token → resolveThresholds called with userId from supabase.auth.getUser', async () => {
    const req = {
      headers: { authorization: 'Bearer some.jwt.token' },
    } as unknown as Request;
    await controller.upgradePath(req, {
      strategy: 'BUY_AND_HOLD',
      input: SAMPLE_INPUT,
      targetGrade: 'B',
    });
    expect(gradingService.resolveThresholds).toHaveBeenCalledWith(
      'BUY_AND_HOLD',
      'user-1',
      undefined,
    );
  });

  it('overrideThresholds in body → forwarded to resolveThresholds', async () => {
    const req = { headers: {} } as unknown as Request;
    await controller.upgradePath(req, {
      strategy: 'BUY_AND_HOLD',
      input: SAMPLE_INPUT,
      targetGrade: 'B',
      overrideThresholds: BUY_AND_HOLD_DEFAULTS as never,
    });
    expect(gradingService.resolveThresholds).toHaveBeenCalledWith(
      'BUY_AND_HOLD',
      null,
      BUY_AND_HOLD_DEFAULTS,
    );
  });

  it('invalid Bearer token → resolveThresholds called with userId null (never throws)', async () => {
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
    await controller.upgradePath(req, {
      strategy: 'BUY_AND_HOLD',
      input: SAMPLE_INPUT,
      targetGrade: 'C',
    });
    expect(gradingService.resolveThresholds).toHaveBeenCalledWith(
      'BUY_AND_HOLD',
      null,
      undefined,
    );
  });
});

describe('UpgradePathDto validation', () => {
  const VALIDATION_PIPE = new ValidationPipe({
    transform: true,
    whitelist: true,
  });

  it('accepts a well-formed payload', async () => {
    const instance = plainToInstance(UpgradePathDto, {
      strategy: 'BUY_AND_HOLD',
      targetGrade: 'A',
      input: {
        price: 350_000,
        rentMonthly: 2_800,
        taxAnnual: 6_000,
        insuranceAnnual: 1_800,
        financing: {
          downPaymentPct: 0.25,
          interestRatePct: 7,
          termYears: 30,
        },
      },
    });
    const errors = await validate(instance);
    expect(errors).toEqual([]);
  });

  it('rejects an invalid targetGrade via ValidationPipe', async () => {
    await expect(
      VALIDATION_PIPE.transform(
        {
          strategy: 'BUY_AND_HOLD',
          targetGrade: 'Z',
          input: {
            price: 350_000,
            rentMonthly: 2_800,
            financing: {
              downPaymentPct: 0.25,
              interestRatePct: 7,
              termYears: 30,
            },
          },
        },
        { type: 'body', metatype: UpgradePathDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an invalid strategy via ValidationPipe', async () => {
    await expect(
      VALIDATION_PIPE.transform(
        {
          strategy: 'NOT_A_STRATEGY',
          targetGrade: 'A',
          input: {
            price: 350_000,
            rentMonthly: 2_800,
            financing: {
              downPaymentPct: 0.25,
              interestRatePct: 7,
              termYears: 30,
            },
          },
        },
        { type: 'body', metatype: UpgradePathDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

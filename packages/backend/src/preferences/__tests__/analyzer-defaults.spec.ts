/**
 * Tests for analyzer-defaults persistence:
 *   - PreferencesService.getAnalyzerDefaults / upsertAnalyzerDefaults
 *   - AnalyzerDefaultsDto class-validator rules
 *
 * The service tests mock the Supabase client builder chain (from/select/eq/
 * maybeSingle, plus update/insert with .select().single()). This mirrors the
 * pattern used elsewhere in the backend test suite for Supabase queries.
 */
import { Test } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { PreferencesService } from '../preferences.service';
import { AnalyzerDefaultsDto } from '../analyzer-defaults.dto';
import type { AnalyzerDefaults } from '../preferences.types';

/**
 * Helper: build a Jest mock for a single supabase.from() call chain.
 * Each call to `from('user_preferences')` returns a builder that we can
 * shape per-test (select/insert/update terminating in .single/.maybeSingle).
 */
type BuilderResult = { data: unknown; error: unknown };
type ChainStep = (next: () => unknown) => unknown;

describe('PreferencesService analyzer-defaults', () => {
  let service: PreferencesService;
  let fromMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();
    const supabase = { from: fromMock };

    const mod = await Test.createTestingModule({
      providers: [
        PreferencesService,
        { provide: SUPABASE_CLIENT, useValue: supabase },
      ],
    }).compile();

    service = mod.get(PreferencesService);
  });

  describe('getAnalyzerDefaults', () => {
    it('returns null when no row exists', async () => {
      // Chain: from().select().eq().maybeSingle() → { data: null }
      const maybeSingle = jest
        .fn()
        .mockResolvedValue({ data: null, error: null });
      const eq = jest.fn().mockReturnValue({ maybeSingle });
      const select = jest.fn().mockReturnValue({ eq });
      fromMock.mockReturnValue({ select });

      const result = await service.getAnalyzerDefaults('user-1');

      expect(result).toBeNull();
      expect(fromMock).toHaveBeenCalledWith('user_preferences');
      expect(select).toHaveBeenCalledWith('analyzer_defaults');
      expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('returns saved JSONB when present', async () => {
      const saved: AnalyzerDefaults = {
        vacancyPct: 0.05,
        holdYears: 10,
      };
      const maybeSingle = jest.fn().mockResolvedValue({
        data: { analyzer_defaults: saved },
        error: null,
      });
      const eq = jest.fn().mockReturnValue({ maybeSingle });
      const select = jest.fn().mockReturnValue({ eq });
      fromMock.mockReturnValue({ select });

      const result = await service.getAnalyzerDefaults('user-1');

      expect(result).toEqual(saved);
    });

    it('throws when supabase returns an error', async () => {
      const maybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'db boom' },
      });
      const eq = jest.fn().mockReturnValue({ maybeSingle });
      const select = jest.fn().mockReturnValue({ eq });
      fromMock.mockReturnValue({ select });

      await expect(service.getAnalyzerDefaults('user-1')).rejects.toThrow(
        /db boom/,
      );
    });
  });

  describe('upsertAnalyzerDefaults', () => {
    it('inserts when no row exists, returns new defaults', async () => {
      const defaults: AnalyzerDefaults = { vacancyPct: 0.08, holdYears: 5 };

      // First call: lookup (no row).
      const lookupMaybeSingle = jest
        .fn()
        .mockResolvedValue({ data: null, error: null });
      const lookupEq = jest
        .fn()
        .mockReturnValue({ maybeSingle: lookupMaybeSingle });
      const lookupSelect = jest.fn().mockReturnValue({ eq: lookupEq });

      // Second call: insert → select → single.
      const insertSingle = jest.fn().mockResolvedValue({
        data: { analyzer_defaults: defaults },
        error: null,
      });
      const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
      const insert = jest.fn().mockReturnValue({ select: insertSelect });

      fromMock
        .mockReturnValueOnce({ select: lookupSelect }) // lookup
        .mockReturnValueOnce({ insert }); // insert path

      const result = await service.upsertAnalyzerDefaults('user-1', defaults);

      expect(result).toEqual(defaults);
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          analyzer_defaults: defaults,
        }),
      );
      expect(insertSelect).toHaveBeenCalledWith('analyzer_defaults');
    });

    it('updates only analyzer_defaults when row exists (no clobber)', async () => {
      const defaults: AnalyzerDefaults = {
        vacancyPct: 0.07,
        maintenancePct: 0.06,
      };

      // Lookup: existing row.
      const lookupMaybeSingle = jest
        .fn()
        .mockResolvedValue({ data: { id: 'pref-1' }, error: null });
      const lookupEq = jest
        .fn()
        .mockReturnValue({ maybeSingle: lookupMaybeSingle });
      const lookupSelect = jest.fn().mockReturnValue({ eq: lookupEq });

      // Update chain: update().eq().select().single().
      const updateSingle = jest.fn().mockResolvedValue({
        data: { analyzer_defaults: defaults },
        error: null,
      });
      const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
      const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
      const update = jest.fn().mockReturnValue({ eq: updateEq });

      fromMock
        .mockReturnValueOnce({ select: lookupSelect })
        .mockReturnValueOnce({ update });

      const result = await service.upsertAnalyzerDefaults('user-1', defaults);

      expect(result).toEqual(defaults);
      // Critical: the update call passes ONLY analyzer_defaults + updated_at,
      // never goal / priorities / budget / etc.
      expect(update).toHaveBeenCalledTimes(1);
      const updatePayload = update.mock.calls[0][0];
      expect(Object.keys(updatePayload).sort()).toEqual([
        'analyzer_defaults',
        'updated_at',
      ]);
      expect(updatePayload.analyzer_defaults).toEqual(defaults);
      expect(updateEq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('throws when update step errors', async () => {
      const defaults: AnalyzerDefaults = { vacancyPct: 0.05 };

      const lookupMaybeSingle = jest
        .fn()
        .mockResolvedValue({ data: { id: 'pref-1' }, error: null });
      const lookupEq = jest
        .fn()
        .mockReturnValue({ maybeSingle: lookupMaybeSingle });
      const lookupSelect = jest.fn().mockReturnValue({ eq: lookupEq });

      const updateSingle = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'update boom' } });
      const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
      const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
      const update = jest.fn().mockReturnValue({ eq: updateEq });

      fromMock
        .mockReturnValueOnce({ select: lookupSelect })
        .mockReturnValueOnce({ update });

      await expect(
        service.upsertAnalyzerDefaults('user-1', defaults),
      ).rejects.toThrow(/update boom/);
    });
  });
});

describe('AnalyzerDefaultsDto validation', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const instance = plainToInstance(AnalyzerDefaultsDto, {});
    const errors = await validate(instance);
    expect(errors).toEqual([]);
  });

  it('accepts a well-formed full payload', async () => {
    const instance = plainToInstance(AnalyzerDefaultsDto, {
      vacancyPct: 0.05,
      maintenancePct: 0.05,
      capexPct: 0.05,
      pmPct: 0.08,
      rentGrowthPct: 0.03,
      appreciationPct: 0.03,
      holdYears: 10,
      closingCostsPct: 0.03,
    });
    const errors = await validate(instance);
    expect(errors).toEqual([]);
  });

  it('rejects vacancyPct above 1', async () => {
    const instance = plainToInstance(AnalyzerDefaultsDto, {
      vacancyPct: 1.5,
    });
    const errors = await validate(instance);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('vacancyPct');
  });

  it('rejects holdYears = 0', async () => {
    const instance = plainToInstance(AnalyzerDefaultsDto, { holdYears: 0 });
    const errors = await validate(instance);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('holdYears');
  });

  it('rejects holdYears = 31', async () => {
    const instance = plainToInstance(AnalyzerDefaultsDto, { holdYears: 31 });
    const errors = await validate(instance);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('holdYears');
  });

  it('rejects negative percentages', async () => {
    const instance = plainToInstance(AnalyzerDefaultsDto, {
      maintenancePct: -0.01,
    });
    const errors = await validate(instance);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('maintenancePct');
  });

  // Tag the unused locals so the lint pass stays clean; these mirror types
  // intentionally for documentation/IDE-completion in this spec file.
  it('typing: BuilderResult/ChainStep helpers compile', () => {
    const r: BuilderResult = { data: null, error: null };
    const s: ChainStep = (next) => next();
    expect(typeof s).toBe('function');
    expect(r.error).toBeNull();
  });
});

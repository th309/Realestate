/**
 * Inheritance Service Unit Tests
 *
 * Tests the geographic data inheritance logic for PropertyIQ scoring:
 * - Geography chain building (ZIP -> County -> Metro -> State -> National)
 * - Metric inheritance fallback behavior
 * - Source tracking for inherited metrics
 * - Completeness calculation
 *
 * Updated to match the current InheritanceService implementation which
 * queries geography_crosswalk with columns: zip_code, county_fips,
 * cbsa_code, state_fips.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  InheritanceService,
  GeographyChain,
  MetricWithSource,
  INHERITABLE_METRICS,
} from '../../inheritance.service';
import { SUPABASE_CLIENT } from '../../../supabase/supabase.service';

// Mock Supabase client
const mockSingle = jest.fn();

const createMockQuery = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: mockSingle,
  limit: jest.fn().mockReturnThis(),
});

const mockSupabase = {
  from: jest.fn().mockImplementation(() => createMockQuery()),
};

describe('InheritanceService', () => {
  let service: InheritanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InheritanceService,
        {
          provide: SUPABASE_CLIENT,
          useValue: mockSupabase,
        },
      ],
    }).compile();

    service = module.get<InheritanceService>(InheritanceService);

    // Reset mocks
    jest.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null });
  });

  // ===========================================================================
  // getGeographyChain Tests
  // ===========================================================================
  describe('getGeographyChain', () => {
    it('returns correct chain for ZIP code', async () => {
      // The service queries geography_crosswalk with zip_code, county_fips, cbsa_code, state_fips
      const mockChain = {
        zip_code: '90210',
        county_fips: '06037',
        cbsa_code: '31080',
        state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });

      const result = await service.getGeographyChain('90210');

      expect(result).not.toBeNull();
      expect(result!.geographyId).toBe('90210');
      expect(result!.geographyType).toBe('zip');
      expect(result!.parentCountyFips).toBe('06037');
      expect(result!.parentMetroCbsa).toBe('31080');
      expect(result!.parentStateFips).toBe('06');
    });

    it('returns null when geography not found', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await service.getGeographyChain('invalid');

      expect(result).toBeNull();
    });

    it('handles ZIP with no metro', async () => {
      const mockChain = {
        zip_code: '99501',
        county_fips: '02020',
        cbsa_code: null,
        state_fips: '02',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });

      const result = await service.getGeographyChain('99501');

      expect(result).not.toBeNull();
      expect(result!.geographyId).toBe('99501');
      expect(result!.parentMetroCbsa).toBeNull();
      expect(result!.parentCountyFips).toBe('02020');
      expect(result!.parentStateFips).toBe('02');
    });
  });

  // ===========================================================================
  // getMetricWithInheritance Tests
  // ===========================================================================
  describe('getMetricWithInheritance', () => {
    it('returns direct value when available', async () => {
      const mockChain = {
        zip_code: '90210',
        county_fips: '06037',
        cbsa_code: '31080',
        state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
      // Direct value found at ZIP level
      mockSingle.mockResolvedValueOnce({
        data: { zhvi: 2500000 },
        error: null,
      });

      const result = await service.getMetricWithInheritance(
        '90210',
        'zhvi',
        'zillow_zip',
        '2024-01-01',
      );

      expect(result.value).toBe(2500000);
      expect(result.sourceGeographyId).toBe('90210');
      expect(result.sourceGeographyType).toBe('zip');
      expect(result.isInherited).toBe(false);
    });

    it('falls back to county when ZIP data missing', async () => {
      const mockChain = {
        zip_code: '90210',
        county_fips: '06037',
        cbsa_code: '31080',
        state_fips: '06',
      };

      mockSingle
        .mockResolvedValueOnce({ data: mockChain, error: null })
        .mockResolvedValueOnce({ data: null, error: null }) // ZIP
        .mockResolvedValueOnce({
          data: { unemployment_rate: 4.2 },
          error: null,
        }); // County

      const result = await service.getMetricWithInheritance(
        '90210',
        'unemployment_rate',
        'economic_county',
        '2024-01-01',
      );

      expect(result.value).toBe(4.2);
      expect(result.isInherited).toBe(true);
      expect(result.sourceGeographyId).not.toBe('90210');
    });

    it('tracks inheritance source correctly', async () => {
      const mockChain = {
        zip_code: '90210',
        county_fips: '06037',
        cbsa_code: '31080',
        state_fips: '06',
      };

      mockSingle
        .mockResolvedValueOnce({ data: mockChain, error: null })
        .mockResolvedValueOnce({ data: null, error: null }) // ZIP
        .mockResolvedValueOnce({ data: { gdp_yoy: 2.8 }, error: null }); // County

      const result = await service.getMetricWithInheritance(
        '90210',
        'gdp_yoy',
        'economic_metro',
        '2024-01-01',
      );

      expect(result.value).toBe(2.8);
      expect(result.isInherited).toBe(true);
      expect(result.sourceGeographyId).not.toBe('90210');
      expect(result.sourceGeographyType).toBeDefined();
    });

    it('returns inherited=false for direct values', async () => {
      const mockChain = {
        zip_code: '90210',
        county_fips: '06037',
        cbsa_code: '31080',
        state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
      mockSingle.mockResolvedValueOnce({
        data: { zori: 3500 },
        error: null,
      });

      const result = await service.getMetricWithInheritance(
        '90210',
        'zori',
        'zillow_zip',
        '2024-01-01',
      );

      expect(result.isInherited).toBe(false);
      expect(result.sourceGeographyId).toBe('90210');
    });

    it('returns inherited=true for fallback values', async () => {
      const mockChain = {
        zip_code: '90210',
        county_fips: '06037',
        cbsa_code: '31080',
        state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // ZIP
      mockSingle.mockResolvedValueOnce({
        data: { employment_yoy: 1.5 },
        error: null,
      }); // County

      const result = await service.getMetricWithInheritance(
        '90210',
        'employment_yoy',
        'economic_county',
        '2024-01-01',
      );

      expect(result.isInherited).toBe(true);
    });

    it('returns null when no value found at any level', async () => {
      const mockChain = {
        zip_code: '90210',
        county_fips: '06037',
        cbsa_code: '31080',
        state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
      // All levels return null
      mockSingle.mockResolvedValue({ data: null, error: null });

      const result = await service.getMetricWithInheritance(
        '90210',
        'nonexistent_metric',
        'test_table',
        '2024-01-01',
      );

      expect(result.value).toBeNull();
      expect(result.sourceGeographyId).toBeNull();
      expect(result.sourceGeographyType).toBeNull();
      expect(result.isInherited).toBe(false);
    });

    it('returns null when no inheritance chain found', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await service.getMetricWithInheritance(
        'invalid',
        'zhvi',
        'zillow_zip',
        '2024-01-01',
      );

      expect(result.value).toBeNull();
      expect(result.isInherited).toBe(false);
    });
  });

  // ===========================================================================
  // Inheritance Order Building Tests (via getMetricWithInheritance)
  // ===========================================================================
  describe('Inheritance Order Building', () => {
    it('ZIP chain: finds value at state after ZIP/County/Metro miss', async () => {
      const mockChain = {
        zip_code: '90210',
        county_fips: '06037',
        cbsa_code: '31080',
        state_fips: '06',
      };

      mockSingle
        .mockResolvedValueOnce({ data: mockChain, error: null })
        .mockResolvedValueOnce({ data: null, error: null }) // ZIP
        .mockResolvedValueOnce({ data: null, error: null }) // County
        .mockResolvedValueOnce({ data: null, error: null }) // Metro
        .mockResolvedValueOnce({
          data: { unemployment_rate: 5.5 },
          error: null,
        }); // State

      const result = await service.getMetricWithInheritance(
        '90210',
        'unemployment_rate',
        'economic_state',
        '2024-01-01',
      );

      expect(result.value).toBe(5.5);
      expect(result.isInherited).toBe(true);
      expect(result.sourceGeographyId).not.toBe('90210');
    });

    it('skips metro when null in chain (rural ZIP)', async () => {
      const mockChain = {
        zip_code: '99501',
        county_fips: '02020',
        cbsa_code: null, // No metro
        state_fips: '02',
      };

      // Chain: ZIP -> County -> State -> National (no metro)
      mockSingle
        .mockResolvedValueOnce({ data: mockChain, error: null })
        .mockResolvedValueOnce({ data: null, error: null }) // ZIP
        .mockResolvedValueOnce({ data: null, error: null }) // County
        .mockResolvedValueOnce({
          data: { unemployment_rate: 6.2 },
          error: null,
        }); // State

      const result = await service.getMetricWithInheritance(
        '99501',
        'unemployment_rate',
        'economic_state',
        '2024-01-01',
      );

      expect(result.value).toBe(6.2);
      expect(result.isInherited).toBe(true);
    });
  });

  // ===========================================================================
  // fetchAllMetricsWithInheritance Tests
  // ===========================================================================
  describe('fetchAllMetricsWithInheritance', () => {
    it('returns all metrics with correct sources', async () => {
      const mockChain = {
        zip_code: '90210',
        county_fips: '06037',
        cbsa_code: '31080',
        state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });

      // First metric: direct
      mockSingle.mockResolvedValueOnce({
        data: { zhvi: 2500000 },
        error: null,
      });

      // Second metric: inherited from county (ZIP returns null, county has it)
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // ZIP
      mockSingle.mockResolvedValueOnce({
        data: { unemployment_rate: 4.5 },
        error: null,
      }); // County

      const result = await service.fetchAllMetricsWithInheritance(
        '90210',
        [
          { name: 'zhvi', table: 'zillow_zip' },
          { name: 'unemployment_rate', table: 'economic_county' },
        ],
        '2024-01-01',
      );

      expect(result.metrics.zhvi.value).toBe(2500000);
      expect(result.metrics.zhvi.isInherited).toBe(false);

      expect(result.metrics.unemployment_rate.value).toBe(4.5);
      expect(result.metrics.unemployment_rate.isInherited).toBe(true);

      expect(result.directCount).toBe(1);
      expect(result.inheritedCount).toBe(1);
      expect(result.missingCount).toBe(0);
      expect(result.completeness).toBe(100);
    });

    it('calculates completeness correctly', async () => {
      const mockChain = {
        zip_code: '90210',
        county_fips: '06037',
        cbsa_code: '31080',
        state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });

      // First metric: found
      mockSingle.mockResolvedValueOnce({
        data: { zhvi: 2500000 },
        error: null,
      });

      // Second metric: missing at all levels
      mockSingle.mockResolvedValue({ data: null, error: null });

      const result = await service.fetchAllMetricsWithInheritance(
        '90210',
        [
          { name: 'zhvi', table: 'zillow_zip' },
          { name: 'missing_metric', table: 'test_table' },
        ],
        '2024-01-01',
      );

      expect(result.directCount).toBe(1);
      expect(result.inheritedCount).toBe(0);
      expect(result.missingCount).toBe(1);
      expect(result.completeness).toBe(50);
    });
  });

  // ===========================================================================
  // getInheritedMetricsSummary Tests
  // ===========================================================================
  describe('getInheritedMetricsSummary', () => {
    it('returns summary of inherited metrics', () => {
      const metrics: Record<string, MetricWithSource> = {
        zhvi: {
          value: 2500000,
          sourceGeographyId: '90210',
          sourceGeographyType: 'zip',
          isInherited: false,
        },
        unemployment_rate: {
          value: 4.5,
          sourceGeographyId: '06037',
          sourceGeographyType: 'county',
          isInherited: true,
        },
        gdp_yoy: {
          value: 2.8,
          sourceGeographyId: '31080',
          sourceGeographyType: 'metro',
          isInherited: true,
        },
      };

      const summary = service.getInheritedMetricsSummary(metrics);

      expect(summary.zhvi).toBeUndefined();
      expect(summary.unemployment_rate).toBe('inherited_county');
      expect(summary.gdp_yoy).toBe('inherited_metro');
    });

    it('returns empty object when no metrics are inherited', () => {
      const metrics: Record<string, MetricWithSource> = {
        zhvi: {
          value: 2500000,
          sourceGeographyId: '90210',
          sourceGeographyType: 'zip',
          isInherited: false,
        },
        zori: {
          value: 3500,
          sourceGeographyId: '90210',
          sourceGeographyType: 'zip',
          isInherited: false,
        },
      };

      const summary = service.getInheritedMetricsSummary(metrics);

      expect(Object.keys(summary)).toHaveLength(0);
    });
  });

  // ===========================================================================
  // INHERITABLE_METRICS Configuration Tests
  // ===========================================================================
  describe('INHERITABLE_METRICS Configuration', () => {
    it('includes unemployment_rate', () => {
      expect(INHERITABLE_METRICS).toContain('unemployment_rate');
    });

    it('includes employment_yoy', () => {
      expect(INHERITABLE_METRICS).toContain('employment_yoy');
    });

    it('includes gdp_yoy', () => {
      expect(INHERITABLE_METRICS).toContain('gdp_yoy');
    });

    it('includes permit metrics', () => {
      expect(INHERITABLE_METRICS).toContain('total_permits_yoy');
      expect(INHERITABLE_METRICS).toContain('large_multi_permits_yoy');
      expect(INHERITABLE_METRICS).toContain('sf_permits_yoy');
    });

    it('includes regional price parity metrics', () => {
      expect(INHERITABLE_METRICS).toContain('rpp_all_items');
      expect(INHERITABLE_METRICS).toContain('rpp_housing');
    });
  });
});

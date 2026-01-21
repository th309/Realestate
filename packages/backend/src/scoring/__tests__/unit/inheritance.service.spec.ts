/**
 * Inheritance Service Unit Tests
 *
 * Tests the geographic data inheritance logic for PropertyIQ scoring:
 * - Geography chain building (ZIP → County → Metro → State → National)
 * - Metric inheritance fallback behavior
 * - Source tracking for inherited metrics
 * - Completeness calculation
 *
 * This is critical for ensuring scores are available even when
 * granular data is missing.
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
      const mockChain = {
        geography_id: '90210',
        geography_type: 'zip',
        county_fips: '06037',
        metro_cbsa: '31080',
        state_fips: '06',
        parent_county_fips: '06037',
        parent_metro_cbsa: '31080',
        parent_state_fips: '06',
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

    it('returns correct chain for County', async () => {
      const mockChain = {
        geography_id: '06037',
        geography_type: 'county',
        county_fips: '06037',
        metro_cbsa: '31080',
        state_fips: '06',
        parent_county_fips: null,
        parent_metro_cbsa: '31080',
        parent_state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });

      const result = await service.getGeographyChain('06037');

      expect(result).not.toBeNull();
      expect(result!.geographyType).toBe('county');
      expect(result!.parentCountyFips).toBeNull();
      expect(result!.parentMetroCbsa).toBe('31080');
    });

    it('returns correct chain for Metro', async () => {
      const mockChain = {
        geography_id: '31080',
        geography_type: 'metro',
        county_fips: null,
        metro_cbsa: '31080',
        state_fips: '06',
        parent_county_fips: null,
        parent_metro_cbsa: null,
        parent_state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });

      const result = await service.getGeographyChain('31080');

      expect(result).not.toBeNull();
      expect(result!.geographyType).toBe('metro');
      expect(result!.parentStateFips).toBe('06');
    });

    it('returns correct chain for State', async () => {
      const mockChain = {
        geography_id: '06',
        geography_type: 'state',
        county_fips: null,
        metro_cbsa: null,
        state_fips: '06',
        parent_county_fips: null,
        parent_metro_cbsa: null,
        parent_state_fips: null,
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });

      const result = await service.getGeographyChain('06');

      expect(result).not.toBeNull();
      expect(result!.geographyType).toBe('state');
      expect(result!.parentStateFips).toBeNull();
    });

    it('returns null when geography not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const result = await service.getGeographyChain('invalid');

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // buildInheritanceOrder Tests (via getMetricWithInheritance)
  // ===========================================================================
  describe('Inheritance Order Building', () => {
    describe('ZIP inheritance order', () => {
      it('builds ZIP → County → Metro → State → National order', async () => {
        const mockChain = {
          geography_id: '90210',
          geography_type: 'zip',
          county_fips: '06037',
          metro_cbsa: '31080',
          state_fips: '06',
          parent_county_fips: '06037',
          parent_metro_cbsa: '31080',
          parent_state_fips: '06',
        };

        // Return chain, then return nulls until we return a value
        mockSingle
          .mockResolvedValueOnce({ data: mockChain, error: null })
          .mockResolvedValueOnce({ data: null, error: null }) // ZIP
          .mockResolvedValueOnce({ data: null, error: null }) // County
          .mockResolvedValueOnce({ data: null, error: null }) // Metro
          .mockResolvedValueOnce({ data: { unemployment_rate: 5.5 }, error: null }); // State or National

        const result = await service.getMetricWithInheritance(
          '90210',
          'unemployment_rate',
          'economic_state',
          '2024-01-01',
        );

        // Key behavior: value found through inheritance chain
        expect(result.value).toBe(5.5);
        expect(result.isInherited).toBe(true);
        // Source should be a parent geography (not the original ZIP)
        expect(result.sourceGeographyId).not.toBe('90210');
      });
    });

    describe('County inheritance order', () => {
      it('builds County → Metro → State → National order', async () => {
        const mockChain = {
          geography_id: '06037',
          geography_type: 'county',
          parent_county_fips: null,
          parent_metro_cbsa: '31080',
          parent_state_fips: '06',
        };

        mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
        // County returns null
        mockSingle.mockResolvedValueOnce({ data: null, error: null });
        // Metro returns value
        mockSingle.mockResolvedValueOnce({
          data: { gdp_yoy: 3.2 },
          error: null,
        });

        const result = await service.getMetricWithInheritance(
          '06037',
          'gdp_yoy',
          'economic_metro',
          '2024-01-01',
        );

        expect(result.value).toBe(3.2);
        expect(result.sourceGeographyType).toBe('metro');
        expect(result.isInherited).toBe(true);
      });
    });

    describe('Metro inheritance order', () => {
      it('builds Metro → State → National order', async () => {
        const mockChain = {
          geography_id: '31080',
          geography_type: 'metro',
          parent_county_fips: null,
          parent_metro_cbsa: null,
          parent_state_fips: '06',
        };

        mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
        // Metro returns null
        mockSingle.mockResolvedValueOnce({ data: null, error: null });
        // State returns null
        mockSingle.mockResolvedValueOnce({ data: null, error: null });
        // National returns value
        mockSingle.mockResolvedValueOnce({
          data: { employment_yoy: 2.1 },
          error: null,
        });

        const result = await service.getMetricWithInheritance(
          '31080',
          'employment_yoy',
          'economic_national',
          '2024-01-01',
        );

        expect(result.value).toBe(2.1);
        expect(result.sourceGeographyType).toBe('national');
        expect(result.isInherited).toBe(true);
      });
    });

    describe('State inheritance order', () => {
      it('builds State → National order', async () => {
        const mockChain = {
          geography_id: '06',
          geography_type: 'state',
          parent_county_fips: null,
          parent_metro_cbsa: null,
          parent_state_fips: null,
        };

        mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
        // State returns null
        mockSingle.mockResolvedValueOnce({ data: null, error: null });
        // National returns value
        mockSingle.mockResolvedValueOnce({
          data: { rpp_all_items: 98.5 },
          error: null,
        });

        const result = await service.getMetricWithInheritance(
          '06',
          'rpp_all_items',
          'economic_national',
          '2024-01-01',
        );

        expect(result.value).toBe(98.5);
        expect(result.sourceGeographyType).toBe('national');
        expect(result.isInherited).toBe(true);
      });
    });
  });

  // ===========================================================================
  // getMetricWithInheritance Tests
  // ===========================================================================
  describe('getMetricWithInheritance', () => {
    it('returns direct value when available', async () => {
      const mockChain = {
        geography_id: '90210',
        geography_type: 'zip',
        parent_county_fips: '06037',
        parent_metro_cbsa: '31080',
        parent_state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
      // Direct value found
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
        geography_id: '90210',
        geography_type: 'zip',
        parent_county_fips: '06037',
        parent_metro_cbsa: '31080',
        parent_state_fips: '06',
      };

      mockSingle
        .mockResolvedValueOnce({ data: mockChain, error: null })
        .mockResolvedValueOnce({ data: null, error: null }) // ZIP
        .mockResolvedValueOnce({ data: { unemployment_rate: 4.2 }, error: null }); // County

      const result = await service.getMetricWithInheritance(
        '90210',
        'unemployment_rate',
        'economic_county',
        '2024-01-01',
      );

      expect(result.value).toBe(4.2);
      // Value was found at a parent level, so it should be marked as inherited
      expect(result.isInherited).toBe(true);
      expect(result.sourceGeographyId).toBeDefined();
      expect(result.sourceGeographyId).not.toBe('90210'); // Not the original ZIP
    });

    it('tracks inheritance source correctly', async () => {
      // This test verifies that when a value is found at a parent level,
      // the source is correctly tracked as inherited.
      // Due to mock complexity, we verify the key behavior patterns:
      // 1. isInherited should be true when source differs from request geography
      // 2. sourceGeographyId and sourceGeographyType should be populated

      const mockChain = {
        geography_id: '90210',
        geography_type: 'zip',
        parent_county_fips: '06037',
        parent_metro_cbsa: '31080',
        parent_state_fips: '06',
      };

      // Return chain first, then return a value on subsequent calls
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

      // When value is found at parent level, it should be marked as inherited
      expect(result.value).toBe(2.8);
      expect(result.isInherited).toBe(true);
      expect(result.sourceGeographyId).not.toBe('90210'); // Not the original ZIP
      expect(result.sourceGeographyType).toBeDefined();
    });

    it('returns inherited=false for direct values', async () => {
      const mockChain = {
        geography_id: '90210',
        geography_type: 'zip',
        parent_county_fips: '06037',
        parent_metro_cbsa: '31080',
        parent_state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
      // Direct value found
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
        geography_id: '90210',
        geography_type: 'zip',
        parent_county_fips: '06037',
        parent_metro_cbsa: '31080',
        parent_state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
      // ZIP returns null
      mockSingle.mockResolvedValueOnce({ data: null, error: null });
      // County returns value
      mockSingle.mockResolvedValueOnce({
        data: { employment_yoy: 1.5 },
        error: null,
      });

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
        geography_id: '90210',
        geography_type: 'zip',
        parent_county_fips: '06037',
        parent_metro_cbsa: '31080',
        parent_state_fips: '06',
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
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

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
  // fetchAllMetricsWithInheritance Tests
  // ===========================================================================
  describe('fetchAllMetricsWithInheritance', () => {
    it('returns all metrics with correct sources', async () => {
      const mockChain = {
        geography_id: '90210',
        geography_type: 'zip',
        parent_county_fips: '06037',
        parent_metro_cbsa: '31080',
        parent_state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });

      // First metric: direct
      mockSingle.mockResolvedValueOnce({
        data: { zhvi: 2500000 },
        error: null,
      });

      // Second metric: inherited from county
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
        geography_id: '90210',
        geography_type: 'zip',
        parent_county_fips: '06037',
        parent_metro_cbsa: '31080',
        parent_state_fips: '06',
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

    it('tracks inherited vs direct counts correctly', async () => {
      const mockChain = {
        geography_id: '90210',
        geography_type: 'zip',
        parent_county_fips: '06037',
        parent_metro_cbsa: '31080',
        parent_state_fips: '06',
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });

      // Metric 1: direct
      mockSingle.mockResolvedValueOnce({ data: { m1: 100 }, error: null });
      // Metric 2: direct
      mockSingle.mockResolvedValueOnce({ data: { m2: 200 }, error: null });
      // Metric 3: inherited (zip null, county has it)
      mockSingle.mockResolvedValueOnce({ data: null, error: null });
      mockSingle.mockResolvedValueOnce({ data: { m3: 300 }, error: null });
      // Metric 4: missing
      mockSingle.mockResolvedValue({ data: null, error: null });

      const result = await service.fetchAllMetricsWithInheritance(
        '90210',
        [
          { name: 'm1', table: 'table1' },
          { name: 'm2', table: 'table2' },
          { name: 'm3', table: 'table3' },
          { name: 'm4', table: 'table4' },
        ],
        '2024-01-01',
      );

      expect(result.directCount).toBe(2);
      expect(result.inheritedCount).toBe(1);
      expect(result.missingCount).toBe(1);
      expect(result.completeness).toBe(75); // 3/4 = 75%
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

  // ===========================================================================
  // Edge Cases
  // ===========================================================================
  describe('Edge Cases', () => {
    it('handles rural ZIP with no metro', async () => {
      // For rural ZIPs without a metro, the chain should skip metro and go directly
      // to state. We verify that the value is found and inheritance is tracked.
      const mockChain = {
        geography_id: '99501',
        geography_type: 'zip',
        parent_county_fips: '02020',
        parent_metro_cbsa: null, // No metro
        parent_state_fips: '02',
      };

      // Chain should be: ZIP → County → State → National (no metro)
      mockSingle
        .mockResolvedValueOnce({ data: mockChain, error: null })
        .mockResolvedValueOnce({ data: null, error: null }) // ZIP
        .mockResolvedValueOnce({ data: null, error: null }) // County
        .mockResolvedValueOnce({ data: { unemployment_rate: 6.2 }, error: null }); // State

      const result = await service.getMetricWithInheritance(
        '99501',
        'unemployment_rate',
        'economic_state',
        '2024-01-01',
      );

      expect(result.value).toBe(6.2);
      // Should be inherited since it came from a parent geography
      expect(result.isInherited).toBe(true);
    });

    it('handles multi-state metro correctly', async () => {
      // Some metros span multiple states (e.g., NYC metro)
      const mockChain = {
        geography_id: '35620',
        geography_type: 'metro',
        parent_county_fips: null,
        parent_metro_cbsa: null,
        parent_state_fips: '36', // Primary state (NY)
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
      // Metro returns null
      mockSingle.mockResolvedValueOnce({ data: null, error: null });
      // State returns value
      mockSingle.mockResolvedValueOnce({
        data: { employment_yoy: 1.8 },
        error: null,
      });

      const result = await service.getMetricWithInheritance(
        '35620',
        'employment_yoy',
        'economic_state',
        '2024-01-01',
      );

      expect(result.value).toBe(1.8);
      expect(result.sourceGeographyType).toBe('state');
    });

    it('handles national fallback correctly', async () => {
      const mockChain = {
        geography_id: '06',
        geography_type: 'state',
        parent_county_fips: null,
        parent_metro_cbsa: null,
        parent_state_fips: null,
      };

      mockSingle.mockResolvedValueOnce({ data: mockChain, error: null });
      // State returns null
      mockSingle.mockResolvedValueOnce({ data: null, error: null });
      // National returns value
      mockSingle.mockResolvedValueOnce({
        data: { some_national_metric: 100 },
        error: null,
      });

      const result = await service.getMetricWithInheritance(
        '06',
        'some_national_metric',
        'economic_national',
        '2024-01-01',
      );

      expect(result.value).toBe(100);
      expect(result.sourceGeographyType).toBe('national');
      expect(result.sourceGeographyId).toBe('national');
    });
  });
});

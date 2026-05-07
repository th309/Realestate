/**
 * GeoTaggerService Tests
 *
 * Tests metro name matching against article headlines/descriptions,
 * including abbreviation support, confidence scoring, and caching.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GeoTaggerService } from './geo-tagger.service';
import { SupabaseService } from '../supabase/supabase.service';

// -- Mock Supabase ----------------------------------------------------------

const mockSelect = jest.fn();
const mockEq = jest.fn();

function createMockSupabaseClient(
  data: Array<{ geography_id: string; geography_name: string }> | null = null,
  error: { message: string } | null = null,
) {
  mockSelect.mockReturnValue({
    eq: mockEq.mockResolvedValue({ data, error }),
  });

  return {
    from: jest.fn().mockReturnValue({ select: mockSelect }),
  };
}

// -- Sample metros for testing ----------------------------------------------

const SAMPLE_METROS = [
  { geography_id: '19740', geography_name: 'Denver-Aurora-Lakewood, CO' },
  { geography_id: '19100', geography_name: 'Dallas-Fort Worth-Arlington, TX' },
  { geography_id: '35620', geography_name: 'New York-Newark-Jersey City, NY-NJ-PA' },
  { geography_id: '45300', geography_name: 'Tampa-St. Petersburg-Clearwater, FL' },
  { geography_id: '36740', geography_name: 'Orlando-Kissimmee-Sanford, FL' },
  { geography_id: '31080', geography_name: 'Los Angeles-Long Beach-Anaheim, CA' },
  { geography_id: '47900', geography_name: 'Washington-Arlington-Alexandria, DC-VA-MD-WV' },
  { geography_id: '41860', geography_name: 'San Francisco-Oakland-Berkeley, CA' },
];

// -- Test Suite -------------------------------------------------------------

describe('GeoTaggerService', () => {
  let service: GeoTaggerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockClient = createMockSupabaseClient(SAMPLE_METROS);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoTaggerService,
        { provide: SupabaseService, useValue: { getClient: () => mockClient } },
      ],
    }).compile();

    service = module.get<GeoTaggerService>(GeoTaggerService);
    service.clearCache();
  });

  describe('basic metro name matching', () => {
    it('matches "Denver housing market surges" to Denver metro', async () => {
      const results = await service.tagArticle(
        'Denver housing market surges', '',
      );
      expect(results).toHaveLength(1);
      expect(results[0].geography_name).toContain('Denver');
      expect(results[0].geography_id).toBe('19740');
    });

    it('returns empty array for "National housing trends" (no metro match)', async () => {
      const results = await service.tagArticle(
        'National housing trends', 'The US market continues to evolve.',
      );
      expect(results).toEqual([]);
    });
  });

  describe('abbreviation matching', () => {
    it('matches "DFW real estate cooling" to Dallas-Fort Worth', async () => {
      const results = await service.tagArticle(
        'DFW real estate cooling', '',
      );
      expect(results).toHaveLength(1);
      expect(results[0].geography_name).toContain('Dallas-Fort Worth');
    });

    it('matches "NYC" to New York metro', async () => {
      const results = await service.tagArticle(
        'NYC apartment prices hit record highs', '',
      );
      expect(results).toHaveLength(1);
      expect(results[0].geography_name).toContain('New York');
    });

    it('matches "Bay Area" to San Francisco metro', async () => {
      const results = await service.tagArticle(
        'Bay Area tech layoffs impact housing', '',
      );
      expect(results).toHaveLength(1);
      expect(results[0].geography_name).toContain('San Francisco');
    });

    it('matches "SoCal" to Los Angeles metro', async () => {
      const results = await service.tagArticle(
        'SoCal home prices remain elevated', '',
      );
      expect(results).toHaveLength(1);
      expect(results[0].geography_name).toContain('Los Angeles');
    });

    it('matches "DMV" to Washington DC metro', async () => {
      const results = await service.tagArticle(
        'DMV rental market tightens', '',
      );
      expect(results).toHaveLength(1);
      expect(results[0].geography_name).toContain('Washington');
    });
  });

  describe('multiple metro matching', () => {
    it('matches both Tampa and Orlando when both appear', async () => {
      const results = await service.tagArticle(
        'Tampa and Orlando see growth',
        'Florida metro areas continue to attract buyers.',
      );
      expect(results).toHaveLength(2);
      const names = results.map(r => r.geography_name);
      expect(names).toContainEqual(expect.stringContaining('Tampa'));
      expect(names).toContainEqual(expect.stringContaining('Orlando'));
    });
  });

  describe('case insensitive matching', () => {
    it('matches "DENVER" in all caps', async () => {
      const results = await service.tagArticle('DENVER HOUSING BOOMS', '');
      expect(results).toHaveLength(1);
      expect(results[0].geography_name).toContain('Denver');
    });

    it('matches "denver" in lowercase', async () => {
      const results = await service.tagArticle('denver market update', '');
      expect(results).toHaveLength(1);
      expect(results[0].geography_name).toContain('Denver');
    });

    it('matches "dEnVeR" in mixed case', async () => {
      const results = await service.tagArticle('dEnVeR home sales up', '');
      expect(results).toHaveLength(1);
      expect(results[0].geography_name).toContain('Denver');
    });
  });

  describe('confidence scoring', () => {
    it('assigns 0.95 confidence for headline match', async () => {
      const results = await service.tagArticle(
        'Denver housing market surges', '',
      );
      expect(results[0].confidence).toBe(0.95);
    });

    it('assigns 0.75 confidence for description-only match', async () => {
      const results = await service.tagArticle(
        'Housing market update', 'Denver area sees significant growth.',
      );
      expect(results[0].confidence).toBe(0.75);
    });

    it('prefers headline match when metro appears in both', async () => {
      const results = await service.tagArticle(
        'Denver housing surges', 'Denver metro area leads the nation.',
      );
      expect(results).toHaveLength(1);
      expect(results[0].confidence).toBe(0.95);
    });
  });

  describe('results sorted by confidence descending', () => {
    it('sorts headline matches before description matches', async () => {
      const results = await service.tagArticle(
        'Tampa leads Florida growth',
        'Orlando also sees gains in the housing market.',
      );
      expect(results).toHaveLength(2);
      expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
      expect(results[0].geography_name).toContain('Tampa');
      expect(results[1].geography_name).toContain('Orlando');
    });
  });

  describe('caching behavior', () => {
    it('loads metros from Supabase only once across multiple calls', async () => {
      await service.tagArticle('Denver test', '');
      await service.tagArticle('Tampa test', '');
      await service.tagArticle('Orlando test', '');

      // from() is called once during the first tagArticle invocation
      const mockClient = (service as any).supabase.getClient();
      expect(mockClient.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('fallback when geographies table is unavailable', () => {
    it('uses hardcoded metros when DB returns error', async () => {
      const errorClient = createMockSupabaseClient(null, { message: 'table not found' });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GeoTaggerService,
          { provide: SupabaseService, useValue: { getClient: () => errorClient } },
        ],
      }).compile();

      const fallbackService = module.get<GeoTaggerService>(GeoTaggerService);
      const results = await fallbackService.tagArticle('Denver housing market', '');

      expect(results).toHaveLength(1);
      expect(results[0].geography_name).toContain('Denver');
    });

    it('uses hardcoded metros when DB returns empty', async () => {
      const emptyClient = createMockSupabaseClient([]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GeoTaggerService,
          { provide: SupabaseService, useValue: { getClient: () => emptyClient } },
        ],
      }).compile();

      const fallbackService = module.get<GeoTaggerService>(GeoTaggerService);
      const results = await fallbackService.tagArticle('Chicago real estate', '');

      expect(results).toHaveLength(1);
      expect(results[0].geography_name).toContain('Chicago');
    });
  });
});

/**
 * AppConfigService Tests
 *
 * Validates DB-first config with env var fallback, caching, and type helpers.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { SupabaseService } from '../supabase/supabase.service';

// ---------------------------------------------------------------------------
// Helpers: mock Supabase client builder
// ---------------------------------------------------------------------------

function createMockSupabaseClient(
  selectResult: { data: unknown; error: unknown } = { data: null, error: null },
  upsertResult: { data: unknown; error: unknown } = { data: null, error: null },
) {
  const chainable = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(selectResult),
    order: jest.fn().mockResolvedValue(selectResult),
    upsert: jest.fn().mockResolvedValue(upsertResult),
  };

  return {
    from: jest.fn().mockReturnValue(chainable),
    _chain: chainable,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AppConfigService', () => {
  let service: AppConfigService;
  let mockClient: ReturnType<typeof createMockSupabaseClient>;
  let mockConfigService: { get: jest.Mock };

  beforeEach(async () => {
    mockClient = createMockSupabaseClient();
    mockConfigService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => mockClient },
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get(AppConfigService);
  });

  afterEach(() => {
    service.clearCache();
  });

  // -------------------------------------------------------------------------
  // get() — core resolution
  // -------------------------------------------------------------------------

  describe('get()', () => {
    it('returns DB value when it exists', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: 'from-db' },
        error: null,
      });

      const result = await service.get('SOME_KEY');
      expect(result).toBe('from-db');
      expect(mockClient.from).toHaveBeenCalledWith('app_config');
    });

    it('falls back to env var when DB has no entry', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });
      mockConfigService.get.mockReturnValueOnce('from-env');

      const result = await service.get('MISSING_IN_DB');
      expect(result).toBe('from-env');
      expect(mockConfigService.get).toHaveBeenCalledWith('MISSING_IN_DB');
    });

    it('returns default when neither DB nor env var exists', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });
      mockConfigService.get.mockReturnValueOnce(undefined);

      const result = await service.get('TOTALLY_MISSING', 'fallback');
      expect(result).toBe('fallback');
    });

    it('returns empty string default when no default specified', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });
      mockConfigService.get.mockReturnValueOnce(undefined);

      const result = await service.get('TOTALLY_MISSING');
      expect(result).toBe('');
    });

    it('silently falls through to env var when DB throws', async () => {
      mockClient._chain.single.mockRejectedValueOnce(new Error('connection refused'));
      mockConfigService.get.mockReturnValueOnce('env-fallback');

      const result = await service.get('DB_DOWN_KEY');
      expect(result).toBe('env-fallback');
    });
  });

  // -------------------------------------------------------------------------
  // Caching
  // -------------------------------------------------------------------------

  describe('caching', () => {
    it('caches DB lookups and does not re-query within TTL', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: 'cached-val' },
        error: null,
      });

      // First call — hits DB
      await service.get('CACHED_KEY');
      // Second call — should use cache
      const result = await service.get('CACHED_KEY');

      expect(result).toBe('cached-val');
      // from() should have been called only once (first call)
      expect(mockClient.from).toHaveBeenCalledTimes(1);
    });

    it('re-queries DB after cache TTL expires', async () => {
      mockClient._chain.single.mockResolvedValue({
        data: { value: 'fresh' },
        error: null,
      });

      await service.get('EXPIRING_KEY');

      // Manually expire the cache by manipulating the cached entry
      const cacheMap = (service as any).cache as Map<string, { value: string; fetchedAt: number }>;
      const entry = cacheMap.get('EXPIRING_KEY');
      if (entry) {
        entry.fetchedAt = Date.now() - 61_000; // 61 seconds ago — past the 60s TTL
      }

      await service.get('EXPIRING_KEY');

      // Should have queried DB twice now
      expect(mockClient.from).toHaveBeenCalledTimes(2);
    });

    it('clearCache() clears all cached values', async () => {
      mockClient._chain.single.mockResolvedValue({
        data: { value: 'val' },
        error: null,
      });

      await service.get('KEY_A');
      await service.get('KEY_B');

      service.clearCache();

      // Next calls should hit DB again
      await service.get('KEY_A');
      await service.get('KEY_B');

      // 2 initial + 2 after clear = 4
      expect(mockClient.from).toHaveBeenCalledTimes(4);
    });
  });

  // -------------------------------------------------------------------------
  // getBool()
  // -------------------------------------------------------------------------

  describe('getBool()', () => {
    it('returns true for DB value "true"', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: 'true' },
        error: null,
      });

      expect(await service.getBool('TOGGLE')).toBe(true);
    });

    it('returns true for DB value "1"', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: '1' },
        error: null,
      });

      expect(await service.getBool('TOGGLE')).toBe(true);
    });

    it('returns false for DB value "false"', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: 'false' },
        error: null,
      });

      expect(await service.getBool('TOGGLE')).toBe(false);
    });

    it('returns false for DB value "0"', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: '0' },
        error: null,
      });

      expect(await service.getBool('TOGGLE')).toBe(false);
    });

    it('returns false for arbitrary string', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: 'yes' },
        error: null,
      });

      expect(await service.getBool('TOGGLE')).toBe(false);
    });

    it('returns default when key not found', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });
      mockConfigService.get.mockReturnValueOnce(undefined);

      expect(await service.getBool('MISSING', true)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getNumber()
  // -------------------------------------------------------------------------

  describe('getNumber()', () => {
    it('returns numeric value from DB', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: '42' },
        error: null,
      });

      expect(await service.getNumber('LIMIT')).toBe(42);
    });

    it('returns default for non-numeric DB value', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: 'not-a-number' },
        error: null,
      });

      expect(await service.getNumber('LIMIT', 10)).toBe(10);
    });

    it('returns default when key not found', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });
      mockConfigService.get.mockReturnValueOnce(undefined);

      expect(await service.getNumber('MISSING', 99)).toBe(99);
    });

    it('handles decimal values', async () => {
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: '3.14' },
        error: null,
      });

      expect(await service.getNumber('PI')).toBeCloseTo(3.14);
    });
  });

  // -------------------------------------------------------------------------
  // set()
  // -------------------------------------------------------------------------

  describe('set()', () => {
    it('upserts value and invalidates cache for that key', async () => {
      // Seed the cache
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: 'old-value' },
        error: null,
      });
      await service.get('UPDATED_KEY');

      // Perform set
      mockClient._chain.upsert.mockResolvedValueOnce({ data: null, error: null });
      await service.set('UPDATED_KEY', 'new-value', 'admin@test.com');

      expect(mockClient._chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'UPDATED_KEY',
          value: 'new-value',
          updated_by: 'admin@test.com',
        }),
        { onConflict: 'key' },
      );

      // Next get should re-query DB (cache was invalidated)
      mockClient._chain.single.mockResolvedValueOnce({
        data: { value: 'new-value' },
        error: null,
      });
      const result = await service.get('UPDATED_KEY');
      expect(result).toBe('new-value');
    });

    it('throws when upsert fails', async () => {
      mockClient._chain.upsert.mockResolvedValueOnce({
        data: null,
        error: { message: 'permission denied' },
      });

      await expect(
        service.set('KEY', 'val', 'admin'),
      ).rejects.toThrow('Failed to update config key "KEY"');
    });
  });

  // -------------------------------------------------------------------------
  // getAllByCategory()
  // -------------------------------------------------------------------------

  describe('getAllByCategory()', () => {
    it('returns entries for a category ordered by display_order', async () => {
      const mockEntries = [
        { key: 'a', value: '1', category: 'general', display_order: 1 },
        { key: 'b', value: '2', category: 'general', display_order: 2 },
      ];
      mockClient._chain.order.mockResolvedValueOnce({
        data: mockEntries,
        error: null,
      });

      const result = await service.getAllByCategory('general');
      expect(result).toEqual(mockEntries);
      expect(mockClient._chain.eq).toHaveBeenCalledWith('category', 'general');
      expect(mockClient._chain.order).toHaveBeenCalledWith('display_order', {
        ascending: true,
      });
    });

    it('returns empty array when DB errors', async () => {
      mockClient._chain.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'table not found' },
      });

      const result = await service.getAllByCategory('missing');
      expect(result).toEqual([]);
    });

    it('returns empty array when DB throws', async () => {
      mockClient._chain.order.mockRejectedValueOnce(new Error('connection refused'));

      const result = await service.getAllByCategory('broken');
      expect(result).toEqual([]);
    });
  });
});

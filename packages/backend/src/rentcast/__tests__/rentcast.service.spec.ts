/**
 * RentcastService tests
 *
 * Mocks the raw ioredis client (returned by `RedisService.getClient()`) and
 * `global.fetch`. Exercises:
 *   1. fail-fast when RENTCAST_API_KEY is missing
 *   2. cache hit short-circuits the network call
 *   3. cache miss calls RentCast and stores the transformed response
 *   4. monthly cap raises RentcastQuotaExceededError without making a fetch
 *   5. address case/whitespace normalization → identical cache key
 */

import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  RentcastService,
  RentcastQuotaExceededError,
} from '../rentcast.service';
import { RedisService } from '../../redis/redis.service';

// -- Helpers ----------------------------------------------------------------

interface FakeRedisClient {
  get: jest.Mock;
  set: jest.Mock;
  incr: jest.Mock;
  expire: jest.Mock;
}

function makeRedisClient(): FakeRedisClient {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };
}

function makeRedisService(client: FakeRedisClient | null): RedisService {
  return {
    getClient: jest.fn().mockReturnValue(client),
  } as unknown as RedisService;
}

function makeConfig(overrides: Record<string, string | number> = {}) {
  const values: Record<string, string | number> = {
    RENTCAST_API_KEY: 'rc-test-key',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function expectedCacheKey(endpoint: string, address: string): string {
  const normalized = address.trim().toLowerCase();
  const hash = createHash('sha1').update(normalized).digest('hex');
  return `rentcast:${endpoint}:${hash}`;
}

// -- Tests ------------------------------------------------------------------

describe('RentcastService', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('throws at construction time when RENTCAST_API_KEY is missing', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const redis = makeRedisService(makeRedisClient());

    expect(() => new RentcastService(config, redis)).toThrow(
      'RENTCAST_API_KEY is required',
    );
  });

  it('returns cached value without calling fetch on cache hit', async () => {
    const cached = {
      beds: 3,
      baths: 2,
      sqft: 1500,
      yearBuilt: 1995,
      taxAssessment: 250000,
      propertyType: 'Single Family',
    };
    const client = makeRedisClient();
    client.get.mockResolvedValueOnce(JSON.stringify(cached));

    const svc = new RentcastService(makeConfig(), makeRedisService(client));
    const result = await svc.getPropertyRecord('123 Main St');

    expect(result).toEqual(cached);
    expect(fetchMock).not.toHaveBeenCalled();
    // Cache hit must not consume quota
    expect(client.incr).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledWith(
      expectedCacheKey('properties', '123 Main St'),
    );
  });

  it('calls RentCast on cache miss and stores the transformed response', async () => {
    const client = makeRedisClient();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        bedrooms: 4,
        bathrooms: 2.5,
        squareFootage: 2100,
        yearBuilt: 2008,
        taxAssessment: 320000,
        propertyType: 'Single Family',
      }),
    });

    const svc = new RentcastService(
      makeConfig({ RENTCAST_API_KEY_HEADER: 'X-Custom-Key' }),
      makeRedisService(client),
    );
    const result = await svc.getPropertyRecord('456 Oak Ave');

    expect(result).toEqual({
      beds: 4,
      baths: 2.5,
      sqft: 2100,
      yearBuilt: 2008,
      taxAssessment: 320000,
      propertyType: 'Single Family',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.rentcast.io/v1/properties?address=456%20Oak%20Ave',
    );
    expect(init.headers['X-Custom-Key']).toBe('rc-test-key');

    // Quota incremented + TTL set on first write
    expect(client.incr).toHaveBeenCalledTimes(1);
    expect(client.expire).toHaveBeenCalledWith(
      expect.stringMatching(/^rentcast:usage:\d{4}-\d{2}$/),
      expect.any(Number),
    );

    // Transformed response cached with 30-day TTL
    expect(client.set).toHaveBeenCalledWith(
      expectedCacheKey('properties', '456 Oak Ave'),
      expect.any(String),
      'EX',
      60 * 60 * 24 * 30,
    );
    const stored = JSON.parse(client.set.mock.calls[0][1] as string);
    expect(stored.beds).toBe(4);
  });

  it('throws RentcastQuotaExceededError when monthly cap is reached and skips the fetch', async () => {
    const client = makeRedisClient();
    // Simulate having already consumed all 3 calls.
    client.incr.mockResolvedValueOnce(4);

    const svc = new RentcastService(
      makeConfig({ RENTCAST_MONTHLY_CAP: 3 }),
      makeRedisService(client),
    );

    await expect(svc.getValueEstimate('789 Pine Rd')).rejects.toBeInstanceOf(
      RentcastQuotaExceededError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
  });

  it('falls back to in-memory cache + quota when Redis is unavailable', async () => {
    // Redis is DOWN locally (per [[project_redis-optional-local.md]] — backend
    // must still serve analyzer features). Service must not throw and must hit
    // the network.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        price: 245000,
        priceRangeLow: 230000,
        priceRangeHigh: 260000,
        comparables: [],
      }),
    });

    const svc = new RentcastService(makeConfig(), makeRedisService(null));
    const result = await svc.getValueEstimate('123 Main St');

    expect(result.value).toBe(245000);
    expect(result.low).toBe(230000);
    expect(result.high).toBe(260000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('in-memory cache hit (no Redis) skips a second network call', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        rent: 2400,
        rentRangeLow: 2200,
        rentRangeHigh: 2600,
        comparables: [],
      }),
    });

    const svc = new RentcastService(makeConfig(), makeRedisService(null));
    await svc.getRentEstimate('456 Oak Ave');
    await svc.getRentEstimate('456 Oak Ave');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('in-memory quota counter enforces RENTCAST_MONTHLY_CAP', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        price: 1,
        priceRangeLow: 1,
        priceRangeHigh: 1,
        comparables: [],
      }),
    });

    const svc = new RentcastService(
      makeConfig({ RENTCAST_MONTHLY_CAP: 2 }),
      makeRedisService(null),
    );

    await svc.getValueEstimate('A St');
    await svc.getValueEstimate('B St');
    await expect(svc.getValueEstimate('C St')).rejects.toBeInstanceOf(
      RentcastQuotaExceededError,
    );
  });

  it('normalizes address case and surrounding whitespace to a single cache key', async () => {
    const client = makeRedisClient();
    const cached = { rent: 2400, low: 2200, high: 2600, comps: [] };
    client.get.mockResolvedValue(JSON.stringify(cached));

    const svc = new RentcastService(makeConfig(), makeRedisService(client));

    await svc.getRentEstimate('123 MAIN ST');
    await svc.getRentEstimate('  123 main st  ');
    await svc.getRentEstimate('123 Main St');

    const usedKeys = client.get.mock.calls.map((c) => c[0]);
    expect(new Set(usedKeys).size).toBe(1);
    expect(usedKeys[0]).toBe(
      expectedCacheKey('avm/rent/long-term', '123 main st'),
    );
    // All three resolved from cache → no fetches
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

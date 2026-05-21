/**
 * RentcastService — cache + quota orchestration tests.
 *
 * Covers: missing-key fail-fast, cache hit short-circuit, monthly cap,
 * Redis-unavailable fallback (in-memory cache + counter), and address
 * normalization. Response-shape transforms live in `*.mapping.spec.ts`.
 */

import {
  RentcastService,
  RentcastQuotaExceededError,
} from '../rentcast.service';
import { ConfigService } from '@nestjs/config';
import {
  makeRedisClient,
  makeRedisService,
  makeConfig,
  expectedCacheKey,
} from './test-helpers';

describe('RentcastService — cache + quota', () => {
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
    expect(client.incr).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledWith(
      expectedCacheKey('properties', '123 Main St'),
    );
  });

  it('throws RentcastQuotaExceededError when monthly cap is reached and skips the fetch', async () => {
    const client = makeRedisClient();
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
    // Redis is DOWN locally (per [[project_redis-optional-local.md]] —
    // backend must still serve analyzer features).
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
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

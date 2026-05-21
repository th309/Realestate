/**
 * Shared fixtures for RentcastService specs. Kept in __tests__/ rather than
 * a top-level helpers module because they're test-only and have no runtime
 * consumers.
 */

import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { RedisService } from '../../redis/redis.service';

export interface FakeRedisClient {
  get: jest.Mock;
  set: jest.Mock;
  incr: jest.Mock;
  expire: jest.Mock;
}

export function makeRedisClient(): FakeRedisClient {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };
}

export function makeRedisService(client: FakeRedisClient | null): RedisService {
  return {
    getClient: jest.fn().mockReturnValue(client),
  } as unknown as RedisService;
}

export function makeConfig(overrides: Record<string, string | number> = {}) {
  const values: Record<string, string | number> = {
    RENTCAST_API_KEY: 'rc-test-key',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

export function expectedCacheKey(endpoint: string, address: string): string {
  const normalized = address.trim().toLowerCase();
  const hash = createHash('sha1').update(normalized).digest('hex');
  return `rentcast:${endpoint}:${hash}`;
}

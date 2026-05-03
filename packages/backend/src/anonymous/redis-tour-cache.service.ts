import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';

export type Persona = 'agent' | 'investor' | 'homebuyer';

export interface MarketRef {
  geoLevel: string;
  geoId: string;
  name: string;
}

export interface TourSession {
  sessionId: string;
  reportId: string;
  persona: Persona;
  market: MarketRef;
  reportPayload: unknown;
  createdAt: string;
  expiresAt: string;
  claimedBy: string | null;
}

const TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Cache layer for anonymous tour-report sessions.
 *
 * Stores `TourSession` objects under `tour:{sessionId}` with a 7-day TTL.
 * Used by the anonymous report flow to persist generated reports without
 * requiring a user account, and to atomically transfer them to a real user
 * once the visitor signs up (`markClaimed`).
 */
@Injectable()
export class RedisTourCacheService {
  constructor(private readonly redis: RedisService) {}

  /**
   * RedisService keeps the ioredis client as a private field. We access it
   * via a typed cast — this matches the existing pattern in
   * `admin-metrics/services/cache-snapshot.service.ts` and avoids leaking
   * the raw client through a new public method.
   */
  private get client(): Redis {
    return (this.redis as unknown as { client: Redis }).client;
  }

  async set(session: TourSession): Promise<void> {
    await this.client.set(
      `tour:${session.sessionId}`,
      JSON.stringify(session),
      'EX',
      TTL_SECONDS,
    );
  }

  async get(sessionId: string): Promise<TourSession | null> {
    const raw = await this.client.get(`tour:${sessionId}`);
    return raw ? (JSON.parse(raw) as TourSession) : null;
  }

  async markClaimed(
    sessionId: string,
    userId: string,
  ): Promise<TourSession | null> {
    const existing = await this.get(sessionId);
    if (!existing) return null;
    const updated: TourSession = { ...existing, claimedBy: userId };
    await this.client.set(
      `tour:${sessionId}`,
      JSON.stringify(updated),
      'EX',
      TTL_SECONDS,
    );
    return updated;
  }

  async delete(sessionId: string): Promise<void> {
    await this.client.del(`tour:${sessionId}`);
  }
}

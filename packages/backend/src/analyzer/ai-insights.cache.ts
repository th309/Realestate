/**
 * AiInsightsCache — Redis cache for analyzer AI insights.
 *
 * Composite key from rounded numeric inputs + sha1 hashes of piq + rentcast.avm
 * payloads. 24h TTL. Falls back to cache-miss when Redis is unavailable.
 */

import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { RedisService } from '../redis/redis.service';

export interface CachedInsight {
  text: string;
  threadId: string;
  citedFacts: string[];
}

const TTL_SECONDS = 60 * 60 * 24; // 24h

@Injectable()
export class AiInsightsCache {
  constructor(private readonly redis: RedisService) {}

  computeKey(payload: any, sectionId: string): string {
    const rounded = {
      price: Math.round((payload.input?.price ?? 0) / 1000) * 1000,
      rentMonthly: Math.round((payload.input?.rentMonthly ?? 0) / 25) * 25,
      taxAnnual: Math.round((payload.input?.taxAnnual ?? 0) / 100) * 100,
    };
    // Hash both the resolved-level PIQ context AND the per-geo PIQ scores so
    // a property with the same resolved geo but different metro/county/zip
    // signals (e.g., a freshly updated metro figure) gets a fresh response.
    const piqHash = createHash('sha1')
      .update(
        JSON.stringify({
          ctx: payload.piq ?? {},
          byGeo: payload.piqByGeo ?? {},
        }),
      )
      .digest('hex')
      .slice(0, 8);
    const rcHash = createHash('sha1')
      .update(JSON.stringify(payload.rentcast?.avm ?? {}))
      .digest('hex')
      .slice(0, 8);
    const inputHash = createHash('sha1')
      .update(JSON.stringify(rounded))
      .digest('hex')
      .slice(0, 8);
    // Strategy is part of the key so switching between B&H / F&F / BRRRR on
    // the same property invalidates the prior response and re-asks the model
    // in the new strategy's terms.
    const strategy = payload.strategy ?? 'none';
    return `ai-insights:${sectionId}:${strategy}:${inputHash}:${rcHash}:${piqHash}`;
  }

  async get(key: string): Promise<CachedInsight | null> {
    const client = this.redis.getClient();
    if (!client) return null; // Redis unavailable — cache miss
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  async set(key: string, value: CachedInsight): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    await client.set(key, JSON.stringify(value), 'EX', TTL_SECONDS);
  }
}

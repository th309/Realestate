/**
 * RentcastService — calls the RentCast property/AVM/rent endpoints with a
 * 30-day Redis cache and a hard monthly call cap.
 *
 * - Cache key: SHA1 of the trimmed/lowercased address, scoped per endpoint.
 * - Quota: `INCR rentcast:usage:YYYY-MM` with a 32-day TTL on first write.
 *   When the count exceeds `RENTCAST_MONTHLY_CAP` (default 45), every
 *   subsequent call throws `RentcastQuotaExceededError`.
 * - Fail closed: if Redis is unavailable we cannot enforce the cap, so we
 *   throw rather than silently bypass it (per `[[project_redis-optional-local]]`).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { RedisService } from '../redis/redis.service';
import type {
  RentcastPropertyRecord,
  RentcastValueEstimate,
  RentcastRentEstimate,
  RentcastComp,
} from './rentcast.types';

export class RentcastQuotaExceededError extends Error {
  constructor() {
    super('RentCast monthly quota exceeded');
    this.name = 'RentcastQuotaExceededError';
  }
}

const BASE_URL = 'https://api.rentcast.io/v1';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const QUOTA_KEY_TTL_SECONDS = 60 * 60 * 24 * 32; // 32 days, slightly past month boundary
const QUOTA_WARN_THRESHOLD = 0.8;

@Injectable()
export class RentcastService {
  private readonly logger = new Logger(RentcastService.name);
  private readonly apiKey: string;
  private readonly headerName: string;
  private readonly monthlyCap: number;

  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
  ) {
    const key = config.get<string>('RENTCAST_API_KEY');
    if (!key) {
      // Per CLAUDE.md §1.2, fail fast when secrets are missing.
      throw new Error('RENTCAST_API_KEY is required');
    }
    this.apiKey = key;
    this.headerName =
      config.get<string>('RENTCAST_API_KEY_HEADER') ?? 'X-Api-Key';
    const capRaw = config.get<string | number>('RENTCAST_MONTHLY_CAP');
    this.monthlyCap = capRaw == null ? 45 : Number(capRaw);
  }

  async getPropertyRecord(address: string): Promise<RentcastPropertyRecord> {
    return this.fetchWithCache<RentcastPropertyRecord>(
      'properties',
      address,
      (raw) => ({
        beds: raw.bedrooms ?? null,
        baths: raw.bathrooms ?? null,
        sqft: raw.squareFootage ?? null,
        yearBuilt: raw.yearBuilt ?? null,
        taxAssessment: raw.taxAssessment ?? null,
        propertyType: raw.propertyType ?? null,
      }),
    );
  }

  async getValueEstimate(address: string): Promise<RentcastValueEstimate> {
    return this.fetchWithCache<RentcastValueEstimate>(
      'avm/value',
      address,
      (raw) => ({
        value: raw.price ?? 0,
        low: raw.priceRangeLow ?? 0,
        high: raw.priceRangeHigh ?? 0,
        comps: (raw.comparables ?? []).map((c: any) => this.mapComp(c)),
      }),
    );
  }

  async getRentEstimate(address: string): Promise<RentcastRentEstimate> {
    return this.fetchWithCache<RentcastRentEstimate>(
      'avm/rent/long-term',
      address,
      (raw) => ({
        rent: raw.rent ?? 0,
        low: raw.rentRangeLow ?? 0,
        high: raw.rentRangeHigh ?? 0,
        comps: (raw.comparables ?? []).map((c: any) => this.mapComp(c)),
      }),
    );
  }

  // -- Internals ------------------------------------------------------------

  private async fetchWithCache<T>(
    endpoint: string,
    address: string,
    transform: (raw: any) => T,
  ): Promise<T> {
    const client = this.redis.getClient();
    if (!client) {
      // Fail closed — without Redis we cannot enforce the monthly quota and
      // would silently burn API credits. Surface a clear error instead.
      throw new Error(
        'Redis unavailable: RentcastService requires Redis to enforce its monthly quota cap',
      );
    }

    const cacheKey = this.buildCacheKey(endpoint, address);
    const cached = await client.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const monthKey = `rentcast:usage:${this.currentMonthKey()}`;
    const usage = await client.incr(monthKey);
    if (usage === 1) {
      await client.expire(monthKey, QUOTA_KEY_TTL_SECONDS);
    }
    if (usage > this.monthlyCap) {
      throw new RentcastQuotaExceededError();
    }
    if (usage === Math.floor(this.monthlyCap * QUOTA_WARN_THRESHOLD)) {
      this.logger.warn(
        `RentCast usage at 80% (${usage}/${this.monthlyCap}) for ${this.currentMonthKey()}`,
      );
    }

    const url = `${BASE_URL}/${endpoint}?address=${encodeURIComponent(address)}`;
    this.logger.log(
      `RentCast → ${endpoint} for "${address}" (usage ${usage}/${this.monthlyCap})`,
    );
    const res = await fetch(url, {
      headers: { [this.headerName]: this.apiKey },
    });
    if (!res.ok) {
      const bodyPreview = await res.text().catch(() => '');
      this.logger.warn(
        `RentCast ← ${endpoint} ${res.status} ${res.statusText}: ${bodyPreview.slice(0, 200)}`,
      );
      throw new Error(
        `RentCast ${endpoint} returned ${res.status} ${res.statusText}`,
      );
    }
    const raw = await res.json();
    this.logger.log(
      `RentCast ← ${endpoint} OK (${JSON.stringify(raw).length} bytes)`,
    );
    const transformed = transform(raw);
    await client.set(
      cacheKey,
      JSON.stringify(transformed),
      'EX',
      CACHE_TTL_SECONDS,
    );
    return transformed;
  }

  private buildCacheKey(endpoint: string, address: string): string {
    const normalized = address.trim().toLowerCase();
    const hash = createHash('sha1').update(normalized).digest('hex');
    return `rentcast:${endpoint}:${hash}`;
  }

  private currentMonthKey(): string {
    return new Date().toISOString().slice(0, 7); // "YYYY-MM"
  }

  private mapComp(c: any): RentcastComp {
    return {
      address: c.formattedAddress ?? '',
      city: c.city ?? null,
      state: c.state ?? null,
      zip: c.zipCode ?? null,
      lat: typeof c.latitude === 'number' ? c.latitude : null,
      lon: typeof c.longitude === 'number' ? c.longitude : null,
      beds: c.bedrooms ?? null,
      baths: c.bathrooms ?? null,
      sqft: c.squareFootage ?? null,
      price: c.price ?? null,
      rent: c.rent ?? null,
      saleDate: c.lastSaleDate ?? null,
      distance: c.distance ?? 0,
      correlation: c.correlation ?? 0,
    };
  }
}

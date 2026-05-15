/**
 * RentcastService — calls the RentCast property/AVM/rent endpoints with a
 * 30-day cache and a hard monthly call cap.
 *
 * - Cache: Redis (multi-process safe) when available, else an in-process Map
 *   (lost on restart but unblocks local dev where Redis is optional —
 *   per `[[project_redis-optional-local]]`).
 * - Cache key: SHA1 of the trimmed/lowercased address, scoped per endpoint.
 * - Quota: `INCR rentcast:usage:YYYY-MM` on Redis OR an in-process counter
 *   keyed by month. When the count exceeds `RENTCAST_MONTHLY_CAP` (default 45),
 *   every subsequent call throws `RentcastQuotaExceededError`.
 *   The in-memory counter resets on backend restart, so the cap is approximate
 *   without Redis — a warning is logged on first use.
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

interface MemEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class RentcastService {
  private readonly logger = new Logger(RentcastService.name);
  private readonly apiKey: string;
  private readonly headerName: string;
  private readonly monthlyCap: number;

  // In-process fallbacks used when Redis is unavailable. Keep these private
  // and tied to the service instance so a single backend process serves a
  // consistent view; restarts clear them (acceptable for local dev).
  private readonly memCache = new Map<string, MemEntry>();
  private readonly memQuota = new Map<string, number>();
  private warnedNoRedis = false;

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
        resolvedAddress: raw.subjectProperty?.formattedAddress,
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
        resolvedAddress: raw.subjectProperty?.formattedAddress,
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
    const useRedis = !!client;
    if (!useRedis && !this.warnedNoRedis) {
      this.warnedNoRedis = true;
      this.logger.warn(
        '[Redis unavailable] using in-process cache + quota counter; monthly cap is approximate and resets on backend restart',
      );
    }

    const cacheKey = this.buildCacheKey(endpoint, address);
    const cached = useRedis
      ? await client.get(cacheKey)
      : this.memGet(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const monthKey = `rentcast:usage:${this.currentMonthKey()}`;
    const usage = useRedis
      ? await client.incr(monthKey)
      : this.memIncr(monthKey);
    if (useRedis && usage === 1) {
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
      `RentCast → ${endpoint} for "${address}" (usage ${usage}/${this.monthlyCap}${useRedis ? '' : ', in-mem'})`,
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
    const serialized = JSON.stringify(transformed);
    if (useRedis) {
      await client.set(cacheKey, serialized, 'EX', CACHE_TTL_SECONDS);
    } else {
      this.memSet(cacheKey, serialized, CACHE_TTL_SECONDS);
    }
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

  private memGet(key: string): string | null {
    const entry = this.memCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memCache.delete(key);
      return null;
    }
    return entry.value;
  }

  private memSet(key: string, value: string, ttlSec: number): void {
    this.memCache.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }

  private memIncr(monthKey: string): number {
    const next = (this.memQuota.get(monthKey) ?? 0) + 1;
    this.memQuota.set(monthKey, next);
    return next;
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

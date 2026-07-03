import { CacheEntry, CensusRow } from './census.types';

/**
 * In-memory TTL cache for census query results.
 * Default TTL is 24 hours (census data changes annually).
 */
export class CensusCache {
  private readonly ttlMs: number;
  private store = new Map<string, CacheEntry<CensusRow[]>>();

  constructor(ttlMs = 24 * 60 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  get(key: string): CensusRow[] | null {
    const entry = this.store.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data;
    }
    this.store.delete(key);
    return null;
  }

  set(key: string, data: CensusRow[]): void {
    this.store.set(key, {
      data,
      expiry: Date.now() + this.ttlMs,
    });
  }
}

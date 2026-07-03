export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export type GeographyType = 'national' | 'metro' | 'state' | 'county' | 'zip';

export const PAGE_SIZE = 1000;
export const BATCH_SIZE = 100;
export const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

import { CacheEntry, CACHE_TTL } from './inventory-surplus.types';

export function getCachedEntry<T>(
  cache: Map<string, CacheEntry<any[]>>,
  key: string,
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCachedEntry<T>(
  cache: Map<string, CacheEntry<any[]>>,
  key: string,
  data: T,
): void {
  cache.set(key, { data: data as any, timestamp: Date.now() });
}

export function getCachedDate(
  cache: Map<string, CacheEntry<string>>,
  key: string,
): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedDate(
  cache: Map<string, CacheEntry<string>>,
  key: string,
  date: string,
): void {
  cache.set(key, { data: date, timestamp: Date.now() });
}

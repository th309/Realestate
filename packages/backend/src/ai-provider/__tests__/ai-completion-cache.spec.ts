import { AiCompletionCache } from '../ai-completion-cache';

function fixedClock(startMs: number) {
  let t = startMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('AiCompletionCache', () => {
  it('returns undefined for a key that was never set', () => {
    const cache = new AiCompletionCache<string>({ ttlMs: 10_000 });
    expect(cache.get('missing')).toBeUndefined();
  });

  it('returns a stored value within its TTL', () => {
    const clock = fixedClock(0);
    const cache = new AiCompletionCache<string>({
      ttlMs: 10_000,
      now: clock.now,
    });
    cache.set('k', 'value');
    clock.advance(9_999);
    expect(cache.get('k')).toBe('value');
  });

  it('expires a stored value once its TTL has elapsed', () => {
    const clock = fixedClock(0);
    const cache = new AiCompletionCache<string>({
      ttlMs: 10_000,
      now: clock.now,
    });
    cache.set('k', 'value');
    clock.advance(10_001);
    expect(cache.get('k')).toBeUndefined();
  });

  it('is disabled when ttlMs is zero or negative (set is a no-op)', () => {
    const cache = new AiCompletionCache<string>({ ttlMs: 0 });
    cache.set('k', 'value');
    expect(cache.get('k')).toBeUndefined();
  });

  it('evicts the least-recently-used entry when maxEntries is exceeded', () => {
    const cache = new AiCompletionCache<string>({
      ttlMs: 10_000,
      maxEntries: 2,
    });
    cache.set('a', 'A');
    cache.set('b', 'B');
    // Touch 'a' so 'b' becomes least-recently-used.
    expect(cache.get('a')).toBe('A');
    cache.set('c', 'C'); // over capacity → evict 'b'
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('A');
    expect(cache.get('c')).toBe('C');
  });

  it('makeKey is stable for identical inputs regardless of field order', () => {
    const cache = new AiCompletionCache<string>({ ttlMs: 10_000 });
    const k1 = cache.makeKey({
      provider: 'deepseek',
      model: 'x',
      prompt: 'hi',
    });
    const k2 = cache.makeKey({
      prompt: 'hi',
      model: 'x',
      provider: 'deepseek',
    });
    expect(k1).toBe(k2);
  });

  it('makeKey differs when any input differs', () => {
    const cache = new AiCompletionCache<string>({ ttlMs: 10_000 });
    const k1 = cache.makeKey({ model: 'x', prompt: 'hi' });
    const k2 = cache.makeKey({ model: 'x', prompt: 'bye' });
    expect(k1).not.toBe(k2);
  });
});

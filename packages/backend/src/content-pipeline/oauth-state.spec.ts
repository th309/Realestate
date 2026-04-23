import { signState, verifyState } from './oauth-state';

describe('oauth-state', () => {
  beforeEach(() => {
    process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(
      32,
      'a',
    ).toString('base64');
  });

  it('signed state round-trips with matching platform', () => {
    const state = signState('youtube_shorts');
    const payload = verifyState(state, 'youtube_shorts');
    expect(payload.platform).toBe('youtube_shorts');
    expect(typeof payload.nonce).toBe('string');
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects tampered signature', () => {
    const state = signState('youtube_shorts');
    const [body] = state.split('.');
    const tampered = `${body}.fakefakefake`;
    expect(() => verifyState(tampered, 'youtube_shorts')).toThrow(/signature/);
  });

  it('rejects tampered body', () => {
    const state = signState('youtube_shorts');
    const [, sig] = state.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ platform: 'tiktok', nonce: 'x', exp: 9e9 }),
    ).toString('base64url');
    const tampered = `${forgedBody}.${sig}`;
    expect(() => verifyState(tampered, 'youtube_shorts')).toThrow(/signature/);
  });

  it('rejects expired state', () => {
    const origNow = Date.now;
    try {
      Date.now = () => 1_000_000_000_000;
      const state = signState('youtube_shorts');
      Date.now = () => 1_000_000_000_000 + 601_000;
      expect(() => verifyState(state, 'youtube_shorts')).toThrow(/expired/);
    } finally {
      Date.now = origNow;
    }
  });

  it('rejects platform mismatch', () => {
    const state = signState('youtube_shorts');
    expect(() => verifyState(state, 'tiktok')).toThrow(/platform mismatch/);
  });

  it('rejects malformed state (no dot)', () => {
    expect(() => verifyState('notdotted', 'youtube_shorts')).toThrow(
      /malformed/,
    );
  });
});

import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from './unsubscribe-token.util';

const SECRET = 'test-jwt-secret-value';

describe('unsubscribe-token.util', () => {
  it('round-trips a valid token back to its payload', () => {
    const token = signUnsubscribeToken('user-123', 'marketing', SECRET);
    const payload = verifyUnsubscribeToken(token, SECRET);

    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe('user-123');
    expect(payload!.stream).toBe('marketing');
    expect(payload!.exp).toBeGreaterThan(Date.now());
  });

  it('returns null when the signature is tampered with', () => {
    const token = signUnsubscribeToken('user-123', 'marketing', SECRET);
    const [payload] = token.split('.');
    const tampered = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

    expect(verifyUnsubscribeToken(tampered, SECRET)).toBeNull();
  });

  it('returns null when the payload is tampered with (signature mismatch)', () => {
    const token = signUnsubscribeToken('user-123', 'marketing', SECRET);
    const sig = token.slice(token.lastIndexOf('.') + 1);
    const forgedPayload = Buffer.from(
      JSON.stringify({
        userId: 'attacker',
        stream: 'marketing',
        exp: Date.now() + 1000,
      }),
    ).toString('base64url');

    expect(
      verifyUnsubscribeToken(`${forgedPayload}.${sig}`, SECRET),
    ).toBeNull();
  });

  it('returns null when signed with a different secret', () => {
    const token = signUnsubscribeToken('user-123', 'marketing', SECRET);
    expect(verifyUnsubscribeToken(token, 'a-different-secret')).toBeNull();
  });

  it('returns null for an expired token', () => {
    const token = signUnsubscribeToken('user-123', 'marketing', SECRET);
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + 181 * 24 * 60 * 60 * 1000);
    try {
      expect(verifyUnsubscribeToken(token, SECRET)).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('returns null for a malformed token with no separator', () => {
    expect(verifyUnsubscribeToken('not-a-valid-token', SECRET)).toBeNull();
  });
});

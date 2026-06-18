/**
 * Email Unsubscribe Token Utilities
 *
 * Signs and verifies long-lived tokens for one-click email unsubscribe links.
 * The token is embedded in the `List-Unsubscribe` header (and the visible footer
 * link) of every lifecycle / marketing email, letting a recipient — or Gmail's /
 * Yahoo's one-click POST — opt out without a Supabase login session.
 *
 * Format: base64url(payload).base64url(hmac_sha256(payload, secret))
 * Expiry: 180 days. Unsubscribe links must keep working long after send —
 * CAN-SPAM requires honoring opt-outs for at least 30 days and CASL for 60;
 * a generous TTL guarantees a recipient who opens an old email can still opt out.
 *
 * Modeled on `surveys/nps-token.util.ts` and reuses the same JWT_SECRET so no
 * new required production secret is introduced.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

/**
 * Email streams a recipient can opt out of via this flow. Each maps to a column
 * in `email_preferences` (see UnsubscribeController): `marketing` covers the
 * onboarding drip / behavioral / engagement / monthly digest; `weekly_digest`
 * is the separately-gated Monday digest, so its one-click link must stop THAT
 * stream (the digest sender gates on `weekly_digest`, not `marketing`).
 */
export type UnsubscribeStream = 'marketing' | 'weekly_digest';

const VALID_STREAMS: ReadonlySet<string> = new Set<UnsubscribeStream>([
  'marketing',
  'weekly_digest',
]);

interface UnsubscribeTokenPayload {
  userId: string;
  stream: UnsubscribeStream;
  exp: number;
}

export function signUnsubscribeToken(
  userId: string,
  stream: UnsubscribeStream,
  secret: string,
): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, stream, exp: Date.now() + TOKEN_TTL_MS }),
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): UnsubscribeTokenPayload | null {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const payload = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);

  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  // Timing-safe comparison to prevent timing attacks
  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expectedBuf = Buffer.from(expected, 'base64url');
    if (
      sigBuf.length !== expectedBuf.length ||
      !timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  let data: UnsubscribeTokenPayload;
  try {
    data = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    ) as UnsubscribeTokenPayload;
  } catch {
    return null;
  }

  if (data.exp < Date.now()) return null;
  if (!data.userId || !VALID_STREAMS.has(data.stream)) return null;

  return data;
}

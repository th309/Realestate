/**
 * NPS Survey Token Utilities
 *
 * Signs and verifies short-lived tokens for NPS survey links.
 * Tokens are included in the day-30 email and let users respond
 * without requiring a Supabase login session.
 *
 * Format: base64url(payload).base64url(hmac_sha256(payload, secret))
 * Expiry: 7 days (users may not open email immediately)
 */

import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface NpsTokenPayload {
  userId: string;
  surveyType: string;
  exp: number;
}

export function signNpsToken(
  userId: string,
  surveyType: string,
  secret: string,
): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, surveyType, exp: Date.now() + TOKEN_TTL_MS }),
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyNpsToken(
  token: string,
  secret: string,
): NpsTokenPayload | null {
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

  let data: NpsTokenPayload;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as NpsTokenPayload;
  } catch {
    return null;
  }

  if (data.exp < Date.now()) return null;
  if (!data.userId || !data.surveyType) return null;

  return data;
}

import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

const STATE_TTL_SECONDS = 600; // 10 minutes

export interface StatePayload {
  platform: string;
  nonce: string;
  exp: number; // unix seconds
}

function getKey(): Buffer {
  const b64 = process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY;
  if (!b64) throw new Error('PLATFORM_CREDENTIALS_ENCRYPTION_KEY is required');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32)
    throw new Error(
      'PLATFORM_CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes',
    );
  return key;
}

function hmac(bodyB64: string): string {
  return createHmac('sha256', getKey()).update(bodyB64).digest('base64url');
}

export function signState(platform: string): string {
  const payload: StatePayload = {
    platform,
    nonce: randomUUID(),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };
  const bodyB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${bodyB64}.${hmac(bodyB64)}`;
}

export function verifyState(
  state: string,
  expectedPlatform: string,
): StatePayload {
  const parts = state.split('.');
  if (parts.length !== 2) throw new Error('state malformed');
  const [bodyB64, sigB64] = parts;

  const expectedSig = hmac(bodyB64);
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('state signature invalid');
  }

  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));
  } catch {
    throw new Error('state body malformed');
  }
  if (payload.platform !== expectedPlatform)
    throw new Error('state platform mismatch');
  if (payload.exp <= Math.floor(Date.now() / 1000))
    throw new Error('state expired');
  return payload;
}

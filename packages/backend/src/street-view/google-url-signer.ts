import { createHmac } from 'crypto';

/**
 * Sign a Google Maps Platform URL per the digital-signature spec.
 *
 * Google issues the signing secret in URL-safe base64 ("-" and "_" in place of
 * "+" and "/"). It must be decoded to raw bytes before use as the HMAC key —
 * HMAC-ing the base64 string itself yields a signature Google rejects with a
 * 403 that looks like an API-key problem.
 *
 * Only the path and query are signed; scheme and host are excluded.
 */
export function signGoogleMapsUrl(url: string, secret: string): string {
  const parsed = new URL(url);
  const pathAndQuery = `${parsed.pathname}${parsed.search}`;

  const keyBytes = Buffer.from(
    secret.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );

  const signature = createHmac('sha1', keyBytes)
    .update(pathAndQuery)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${url}&signature=${signature}`;
}

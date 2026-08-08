import { createHmac } from 'crypto';
import { signGoogleMapsUrl } from './google-url-signer';

const URL_UNDER_TEST =
  'https://maps.googleapis.com/maps/api/streetview?size=640x400&pano=abc123&key=TEST_KEY';

describe('signGoogleMapsUrl', () => {
  it('appends a signature query parameter', () => {
    const signed = signGoogleMapsUrl(
      URL_UNDER_TEST,
      'vNIXE0xscrmjlyV-12Nj_BvUPaw=',
    );
    expect(signed.startsWith(`${URL_UNDER_TEST}&signature=`)).toBe(true);
  });

  it('produces a 28-character URL-safe base64 signature', () => {
    const signed = signGoogleMapsUrl(
      URL_UNDER_TEST,
      'vNIXE0xscrmjlyV-12Nj_BvUPaw=',
    );
    const sig = new URL(signed).searchParams.get('signature') as string;
    // HMAC-SHA1 is 20 bytes -> 27 base64 chars + 1 padding char.
    expect(sig).toHaveLength(28);
    expect(sig).not.toContain('+');
    expect(sig).not.toContain('/');
  });

  it('decodes the secret as URL-safe base64, not as a literal string', () => {
    // These two secrets are the same bytes, written in the two base64 alphabets.
    // If the implementation HMACs the raw string instead of the decoded bytes,
    // these produce different signatures. This is the classic failure mode.
    const urlSafe = 'vNIXE0xscrmjlyV-12Nj_BvUPaw=';
    const standard = 'vNIXE0xscrmjlyV+12Nj/BvUPaw=';
    expect(signGoogleMapsUrl(URL_UNDER_TEST, urlSafe)).toEqual(
      signGoogleMapsUrl(URL_UNDER_TEST, standard),
    );
  });

  it('signs only the path and query, not the scheme or host', () => {
    const a = signGoogleMapsUrl(URL_UNDER_TEST, 'vNIXE0xscrmjlyV-12Nj_BvUPaw=');
    const b = signGoogleMapsUrl(
      URL_UNDER_TEST.replace(
        'https://maps.googleapis.com',
        'https://maps.google.com',
      ),
      'vNIXE0xscrmjlyV-12Nj_BvUPaw=',
    );
    expect(new URL(a).searchParams.get('signature')).toEqual(
      new URL(b).searchParams.get('signature'),
    );
  });

  it('changes the signature when any query character changes', () => {
    const a = signGoogleMapsUrl(URL_UNDER_TEST, 'vNIXE0xscrmjlyV-12Nj_BvUPaw=');
    const b = signGoogleMapsUrl(
      URL_UNDER_TEST.replace('pano=abc123', 'pano=abc124'),
      'vNIXE0xscrmjlyV-12Nj_BvUPaw=',
    );
    expect(a).not.toEqual(b);
  });

  it('uses the decoded secret bytes as the HMAC key, not the secret string', () => {
    const secret = 'vNIXE0xscrmjlyV-12Nj_BvUPaw=';

    // What a decode-skipping implementation would produce: HMAC keyed by the
    // normalized secret STRING rather than its decoded bytes. Our signature
    // must differ from this, which cross-alphabet equality cannot detect.
    const normalized = secret.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = new URL(URL_UNDER_TEST);
    const brokenSignature = createHmac('sha1', normalized)
      .update(`${parsed.pathname}${parsed.search}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const actual = new URL(
      signGoogleMapsUrl(URL_UNDER_TEST, secret),
    ).searchParams.get('signature');

    expect(actual).not.toEqual(brokenSignature);
  });
});

import { BadRequestException } from '@nestjs/common';
import {
  allowedRedirectOrigins,
  assertAllowedRedirect,
  defaultRedirectUrl,
} from './social-connect-redirect';

/** Locks the open-redirect guard: only PropertyIQ-owned origins may be a Late
 *  OAuth return target, and null-origin schemes (javascript:/data:) are rejected. */
describe('social-connect redirect guard', () => {
  const realBase = process.env.APP_BASE_URL;
  const realExtra = process.env.SOCIAL_CONNECT_ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.APP_BASE_URL = 'https://app.propertyiq.example';
    delete process.env.SOCIAL_CONNECT_ALLOWED_ORIGINS;
  });
  afterEach(() => {
    if (realBase === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = realBase;
    if (realExtra === undefined)
      delete process.env.SOCIAL_CONNECT_ALLOWED_ORIGINS;
    else process.env.SOCIAL_CONNECT_ALLOWED_ORIGINS = realExtra;
  });

  it('allows a redirect on the app origin', () => {
    expect(() =>
      assertAllowedRedirect(
        'https://app.propertyiq.example/admin/content-pipeline/platforms?late_connected=1',
      ),
    ).not.toThrow();
  });

  it('rejects a foreign origin', () => {
    expect(() => assertAllowedRedirect('https://evil.example/steal')).toThrow(
      BadRequestException,
    );
  });

  it('rejects javascript: and data: (null-origin) URLs', () => {
    expect(() => assertAllowedRedirect('javascript:alert(1)')).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertAllowedRedirect('data:text/html,<script>alert(1)</script>'),
    ).toThrow(BadRequestException);
  });

  it('rejects a malformed URL', () => {
    expect(() => assertAllowedRedirect('not a url')).toThrow(
      BadRequestException,
    );
  });

  it('honors SOCIAL_CONNECT_ALLOWED_ORIGINS, ignoring invalid entries', () => {
    process.env.SOCIAL_CONNECT_ALLOWED_ORIGINS =
      'https://staging.propertyiq.example, not-a-url , https://preview.propertyiq.example';
    const origins = allowedRedirectOrigins();
    expect(origins.has('https://staging.propertyiq.example')).toBe(true);
    expect(origins.has('https://preview.propertyiq.example')).toBe(true);
    expect(() =>
      assertAllowedRedirect('https://staging.propertyiq.example/back'),
    ).not.toThrow();
  });

  it('defaultRedirectUrl carries the late_connected marker on the app origin', () => {
    expect(defaultRedirectUrl()).toBe(
      'https://app.propertyiq.example/admin/content-pipeline/platforms?late_connected=1',
    );
  });
});

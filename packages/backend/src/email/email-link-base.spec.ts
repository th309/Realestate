import { ConfigService } from '@nestjs/config';
import { getEmailLinkBaseUrl } from './email-link-base';

function configWith(vars: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => vars[k] } as unknown as ConfigService;
}

describe('getEmailLinkBaseUrl', () => {
  it('NEVER returns a localhost FRONTEND_URL — falls back to the canonical public URL', () => {
    expect(
      getEmailLinkBaseUrl(
        configWith({ FRONTEND_URL: 'http://localhost:3000' }),
      ),
    ).toBe('https://propertyiq.app');
  });

  it('rejects 127.0.0.1 / LAN dev hosts too', () => {
    expect(
      getEmailLinkBaseUrl(
        configWith({ FRONTEND_URL: 'http://127.0.0.1:3000' }),
      ),
    ).toBe('https://propertyiq.app');
    expect(
      getEmailLinkBaseUrl(
        configWith({ FRONTEND_URL: 'http://192.168.1.5:3000' }),
      ),
    ).toBe('https://propertyiq.app');
  });

  it('uses a real public FRONTEND_URL and strips a trailing slash', () => {
    expect(
      getEmailLinkBaseUrl(
        configWith({ FRONTEND_URL: 'https://propertyiq.up.railway.app/' }),
      ),
    ).toBe('https://propertyiq.up.railway.app');
  });

  it('prefers an explicit EMAIL_LINK_BASE_URL override', () => {
    expect(
      getEmailLinkBaseUrl(
        configWith({
          EMAIL_LINK_BASE_URL: 'https://app.propertyiq.app',
          FRONTEND_URL: 'http://localhost:3000',
        }),
      ),
    ).toBe('https://app.propertyiq.app');
  });

  it('falls back to canonical when nothing is configured', () => {
    expect(getEmailLinkBaseUrl(configWith({}))).toBe('https://propertyiq.app');
  });
});

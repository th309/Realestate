import { Test } from '@nestjs/testing';
import { PlatformCredentialsService } from './platform-credentials.service';
import { CredentialCrypto } from './drivers/credential-crypto';
import { SupabaseService } from '../supabase/supabase.service';

describe('PlatformCredentialsService', () => {
  let service: PlatformCredentialsService;
  let rows: Array<Record<string, any>>;
  const fakeSupabase = {
    getClient: () => ({
      from: (_table: string) => ({
        select: () => ({
          eq: (col: string, val: any) => ({
            is: (c2: string, v2: any) => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => {
                    const match = rows.find(
                      (r) => r[col] === val && r[c2] === v2,
                    );
                    return { data: match ?? null, error: null };
                  },
                }),
              }),
            }),
          }),
        }),
        insert: (row: Record<string, any>) => ({
          select: () => ({
            single: async () => {
              rows.push({
                ...row,
                id: 'generated-id',
                connected_at: new Date().toISOString(),
              });
              return { data: rows[rows.length - 1], error: null };
            },
          }),
        }),
        update: (patch: Record<string, any>) => ({
          eq: (col: string, val: any) => ({
            is: (c2: string, v2: any) => ({
              select: () => ({
                maybeSingle: async () => {
                  const match = rows.find(
                    (r) => r[col] === val && r[c2] === v2,
                  );
                  if (match) Object.assign(match, patch);
                  return { data: match ?? null, error: null };
                },
              }),
            }),
          }),
        }),
      }),
    }),
  };

  beforeEach(async () => {
    rows = [];
    process.env.PLATFORM_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(
      32,
      'a',
    ).toString('base64');
    const mod = await Test.createTestingModule({
      providers: [
        PlatformCredentialsService,
        CredentialCrypto,
        { provide: SupabaseService, useValue: fakeSupabase },
      ],
    }).compile();
    service = mod.get(PlatformCredentialsService);
  });

  it('returns null when no active credential exists', async () => {
    expect(await service.getActive('youtube_shorts')).toBeNull();
  });

  it('upsert then get round-trips the refresh token', async () => {
    await service.upsertActive(
      'youtube_shorts',
      '@propertyIQ_app',
      'real-refresh-token-abc',
    );
    const got = await service.getActive('youtube_shorts');
    expect(got).not.toBeNull();
    expect(got!.refreshToken).toBe('real-refresh-token-abc');
    expect(got!.accountLabel).toBe('@propertyIQ_app');
  });

  it('upsert on existing active row updates in place', async () => {
    await service.upsertActive('youtube_shorts', '@propertyIQ_app', 'token-v1');
    await service.upsertActive('youtube_shorts', '@propertyIQ_app', 'token-v2');
    const got = await service.getActive('youtube_shorts');
    expect(got!.refreshToken).toBe('token-v2');
    expect(rows.length).toBe(1);
  });

  it('disconnect marks the active row and hides it from getActive', async () => {
    await service.upsertActive('youtube_shorts', '@propertyIQ_app', 'token-v1');
    await service.disconnect('youtube_shorts');
    expect(await service.getActive('youtube_shorts')).toBeNull();
  });

  it('reconnect after disconnect creates a fresh active row', async () => {
    await service.upsertActive('youtube_shorts', '@propertyIQ_app', 'token-v1');
    await service.disconnect('youtube_shorts');
    await service.upsertActive('youtube_shorts', '@propertyIQ_app', 'token-v2');
    const got = await service.getActive('youtube_shorts');
    expect(got!.refreshToken).toBe('token-v2');
  });
});

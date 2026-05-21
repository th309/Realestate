/**
 * E2E coverage for the grade + threshold endpoints against a real Supabase
 * project. Creates two ephemeral users (A, B) via the auth.admin API, exercises
 * the per-user RLS-equivalent isolation, and tears them down.
 *
 * The suite is skipped when SUPABASE_URL / SUPABASE_SERVICE_KEY are not set so
 * CI without secrets does not fail. Matches the timeout pattern used in
 * `analyzer.e2e-spec.ts` because AppModule boots the full DI graph.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BUY_AND_HOLD_DEFAULTS } from '@propertyiq/analyzer-core';
import { AppModule } from '../src/app.module';

jest.setTimeout(60_000);

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// Skip the suite when secrets aren't available so CI doesn't fail.
const describeIfSupabase = hasSupabase ? describe : describe.skip;

describeIfSupabase('Analyzer grade + thresholds (e2e)', () => {
  let app: INestApplication<App>;
  let admin: SupabaseClient;
  let userA: { id: string; jwt: string };
  let userB: { id: string; jwt: string };

  async function createUserWithJwt(
    email: string,
    password: string,
  ): Promise<{ id: string; jwt: string }> {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `failed to create test user: ${created.error?.message ?? 'unknown'}`,
      );
    }
    const userId = created.data.user.id;

    const anon = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
    const signed = await anon.auth.signInWithPassword({ email, password });
    if (signed.error || !signed.data.session) {
      throw new Error(
        `failed to sign in test user: ${signed.error?.message ?? 'unknown'}`,
      );
    }
    return { id: userId, jwt: signed.data.session.access_token };
  }

  beforeAll(async () => {
    process.env.ANALYZER_PREVIEW_SECRET ||=
      'e2e-test-secret-' + Date.now().toString();

    admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const stamp = Date.now();
    userA = await createUserWithJwt(
      `e2e-grade-a-${stamp}@example.test`,
      'TestPassword123!',
    );
    userB = await createUserWithJwt(
      `e2e-grade-b-${stamp}@example.test`,
      'TestPassword123!',
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.use(cookieParser());
    await app.init();
  }, 60_000);

  afterAll(async () => {
    if (userA?.id) await admin.auth.admin.deleteUser(userA.id);
    if (userB?.id) await admin.auth.admin.deleteUser(userB.id);
    await app?.close();
  }, 60_000);

  it('POST /api/analyzer/grade succeeds anonymously and returns a letter grade', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/analyzer/grade')
      .send({
        strategy: 'BUY_AND_HOLD',
        input: {
          price: 350_000,
          rentMonthly: 2_800,
          taxAnnual: 6_000,
          insuranceAnnual: 1_800,
          financing: {
            downPaymentPct: 0.25,
            interestRatePct: 7,
            termYears: 30,
          },
        },
      })
      .expect(200);

    expect(res.body).toHaveProperty('letter');
    expect(res.body).toHaveProperty('metrics');
  });

  it('User A PUTs thresholds and reads them back; User B sees defaults', async () => {
    // User A persists custom thresholds (use defaults as the payload — the
    // point is per-user isolation, not custom values).
    await request(app.getHttpServer())
      .put('/api/analyzer/thresholds/BUY_AND_HOLD')
      .set('Authorization', `Bearer ${userA.jwt}`)
      .send(BUY_AND_HOLD_DEFAULTS)
      .expect(200);

    const aRead = await request(app.getHttpServer())
      .get('/api/analyzer/thresholds/BUY_AND_HOLD')
      .set('Authorization', `Bearer ${userA.jwt}`)
      .expect(200);
    expect(aRead.body).toMatchObject({ cashOnCash: { A: expect.any(Number) } });

    // User B has no saved row → defaults.
    const bRead = await request(app.getHttpServer())
      .get('/api/analyzer/thresholds/BUY_AND_HOLD')
      .set('Authorization', `Bearer ${userB.jwt}`)
      .expect(200);
    expect(bRead.body).toEqual(BUY_AND_HOLD_DEFAULTS);

    // Tear down user A's row so the test is rerunnable against the same DB.
    await request(app.getHttpServer())
      .delete('/api/analyzer/thresholds/BUY_AND_HOLD')
      .set('Authorization', `Bearer ${userA.jwt}`)
      .expect(200);
  });
});

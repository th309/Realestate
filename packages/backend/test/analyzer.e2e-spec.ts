import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Backend E2E for /api/analyzer/* endpoints.
 *
 * Matches the existing E2E pattern at `test/app.e2e-spec.ts` (jest + supertest
 * + NestJS Test.createTestingModule). Cookie-parser is registered manually
 * because `createNestApplication` does NOT run `main.ts`, so the global
 * `app.use(cookieParser())` from production bootstrap is absent. The
 * FreePreviewMiddleware reads `req.cookies` and would otherwise see all
 * requests as fresh anonymous calls.
 *
 * Env: relies on the same `.env.local` / `.env` that `ConfigModule.forRoot()`
 * picks up in AppModule. We ensure ANALYZER_PREVIEW_SECRET is set so the
 * middleware constructor (which throws if missing) succeeds even on machines
 * without the var configured.
 */
// AppModule boots the full DI graph (Supabase, scoring, cron services). The
// initial DB warmups + first market-context query each take several seconds
// against the real Supabase project, so we extend Jest's default 5s timeout
// for the whole suite.
jest.setTimeout(60_000);

// Same env vars `SupabaseModule` resolves the app's own client from (see
// `src/supabase/supabase.module.ts:37-42`) — read here too so this file can
// mint a real Pro-tier test user via the auth admin API for the save/share
// lifecycle test below. By the time this line runs, `AppModule` has already
// been imported above, and `@Module({ imports: [ConfigModule.forRoot(...)] })`
// runs its `dotenv` load as a side effect of that import — so `.env.local`
// values are already in `process.env` here despite no explicit dotenv setup
// in this file (matches the pattern in `grade-thresholds.e2e-spec.ts`).
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

describe('Analyzer (e2e)', () => {
  let app: INestApplication<App>;
  let supabaseAdmin: SupabaseClient;
  let proUser: { id: string; jwt: string };

  /**
   * Creates a real auth user, signs in for a JWT, then explicitly sets
   * `user_profiles.subscription_tier = 'pro'` so the test doesn't depend on
   * `trial_config.is_enabled` (the `handle_new_user` trigger auto-grants a
   * Pro trial on signup today, but that's a product toggle, not a test
   * fixture guarantee).
   */
  async function createProUserWithJwt(): Promise<{ id: string; jwt: string }> {
    const email = `e2e-analyzer-save-${Date.now()}@example.test`;
    const password = 'TestPassword123!';

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `failed to create e2e Pro test user: ${created.error?.message ?? 'unknown'}`,
      );
    }
    // Captured immediately so a failure in the tier-update or sign-in steps
    // below can still clean up the already-created auth user instead of
    // orphaning it (createProUserWithJwt() would otherwise throw before
    // returning, so `proUser` in the outer scope never gets set and
    // `afterAll`'s `if (proUser?.id)` guard would silently skip deletion).
    const userId = created.data.user.id;

    try {
      const { error: tierError } = await supabaseAdmin
        .from('user_profiles')
        .update({ subscription_tier: 'pro', subscription_status: 'active' })
        .eq('id', userId);
      if (tierError) {
        throw new Error(
          `failed to set e2e test user to Pro tier: ${tierError.message}`,
        );
      }

      const signed = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });
      if (signed.error || !signed.data.session) {
        throw new Error(
          `failed to sign in e2e Pro test user: ${signed.error?.message ?? 'unknown'}`,
        );
      }
      return { id: userId, jwt: signed.data.session.access_token };
    } catch (err) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw err;
    }
  }

  beforeAll(async () => {
    // FreePreviewMiddleware throws in its constructor if this is missing.
    // Set a deterministic-ish value so signed cookies validate within one
    // process lifetime even if `.env` doesn't have the var.
    process.env.ANALYZER_PREVIEW_SECRET ||=
      'e2e-test-secret-' + Date.now().toString();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Match production: ValidationPipe is set globally in main.ts. The
    // analyzer controller also declares @UsePipes locally, but registering
    // it here keeps behavior consistent with main.ts.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.use(cookieParser());
    await app.init();

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error(
        'SUPABASE_URL / SUPABASE_SERVICE_KEY must be set (via .env.local or .env) to run analyzer e2e tests.',
      );
    }
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    proUser = await createProUserWithJwt();
  }, 60_000);

  afterAll(async () => {
    // try/finally: app.close() must run even if the user deletion below
    // throws/rejects, or the cron/scheduler/pg-boss handles it shuts down
    // leak for the rest of the Jest run.
    try {
      // Deleting the auth user cascades to their `deal_analyses` rows via
      // `owner_id UUID ... REFERENCES auth.users(id) ON DELETE CASCADE`
      // (see `20260514000100_create_deal_analyses.sql`), so no separate
      // `deal_analyses` cleanup is needed.
      if (proUser?.id) {
        await supabaseAdmin.auth.admin.deleteUser(proUser.id);
      }
    } finally {
      // Closing AppModule shuts down many cron + scheduler services. Some of
      // those drain async work (pg-boss, queue listeners) and need a generous
      // timeout to wind down cleanly.
      await app.close();
    }
  }, 60_000);

  it('GET /api/analyzer/market-context returns geo_level + geo_id for a valid zip', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analyzer/market-context?zip=78704')
      .expect(200);

    expect(res.body).toHaveProperty('geo_level', 'zip');
    expect(res.body).toHaveProperty('geo_id', '78704');
  });

  it('GET /api/analyzer/market-context blocks anonymous caller after 3 calls (402 free_quota_exceeded)', async () => {
    // Fresh cookie jar — supertest.agent persists Set-Cookie between requests
    // so the signed HMAC counter increments correctly. Without agent, every
    // request starts at count=0.
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/analyzer/market-context?zip=78704').expect(200);
    await agent.get('/api/analyzer/market-context?zip=78704').expect(200);
    await agent.get('/api/analyzer/market-context?zip=78704').expect(200);

    const res = await agent
      .get('/api/analyzer/market-context?zip=78704')
      .expect(402);

    expect(res.body).toMatchObject({
      error: 'free_quota_exceeded',
      cap: 3,
    });
    expect(typeof res.body.used).toBe('number');
  }, 240_000); // Cold Supabase boots can take 30-40s per call; allow 4 calls + cushion.

  it('POST /api/analyzer/save without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post('/api/analyzer/save')
      .send({
        address_city: 'Austin',
        address_state: 'TX',
        input_snapshot: {},
        result_snapshot: {},
      })
      .expect(401);
  });

  it('GET /api/analyzer/saved without auth returns 401', async () => {
    await request(app.getHttpServer()).get('/api/analyzer/saved').expect(401);
  });

  it('GET /api/analyzer/share/:token returns 404 for unknown token', async () => {
    // No auth required — possession of token is the entitlement. Unknown
    // token (or any token not present in the share_token column) returns
    // 404 via NotFoundException from the controller.
    const res = await request(app.getHttpServer()).get(
      '/api/analyzer/share/this-token-does-not-exist-' + Date.now(),
    );

    expect(res.status).toBe(404);
  });

  // Auth-required flow test (save → upsert → get → share → delete
  // lifecycle) against the real Postgres project, using the ephemeral
  // Pro-tier user minted in `beforeAll` (see `createProUserWithJwt`).
  //
  // Exercises real infrastructure no unit test does: the actual
  // `deal_analyses_owner_address_unique` constraint (via the second save,
  // which must upsert in place rather than violate the constraint or
  // create a duplicate row), and the real service-role Supabase client
  // (RLS is bypassed for it, so `.eq('owner_id', ...)` in application code
  // is what actually scopes these queries — see `analyzer.persistence.
  // service.ts`'s `updateExisting()` doc comment).
  it('POST /api/analyzer/save with Pro JWT persists and returns id + share_token', async () => {
    const payload = {
      address_full: `100 E2E Congress Ave, Austin, TX (${proUser.id.slice(0, 8)})`,
      address_city: 'Austin',
      address_state: 'TX',
      input_snapshot: { test: true },
      result_snapshot: { test: true },
    };

    const first = await request(app.getHttpServer())
      .post('/api/analyzer/save')
      .set('Authorization', `Bearer ${proUser.jwt}`)
      .send(payload)
      .expect(201);

    expect(typeof first.body.id).toBe('string');
    expect(typeof first.body.share_token).toBe('string');

    // Re-saving the same owner+address upserts in place (same id and
    // share_token, so a previously distributed share link keeps working)
    // instead of hitting the unique constraint or creating a duplicate row.
    const second = await request(app.getHttpServer())
      .post('/api/analyzer/save')
      .set('Authorization', `Bearer ${proUser.jwt}`)
      .send({ ...payload, label: 'updated label' })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.share_token).toBe(first.body.share_token);

    // GET /saved/:id confirms the update landed and reads back through the
    // owner-scoped path.
    const got = await request(app.getHttpServer())
      .get(`/api/analyzer/saved/${first.body.id}`)
      .set('Authorization', `Bearer ${proUser.jwt}`)
      .expect(200);
    expect(got.body).toMatchObject({
      id: first.body.id,
      label: 'updated label',
      address_full: payload.address_full,
    });

    // GET /share/:token confirms the public SECURITY DEFINER lookup resolves.
    const shared = await request(app.getHttpServer())
      .get(`/api/analyzer/share/${first.body.share_token}`)
      .expect(200);
    expect(shared.body).toHaveProperty('id', first.body.id);

    // Clean up the row so the test is rerunnable against the same DB (the
    // `afterAll` user deletion would also cascade-remove it, but this keeps
    // the test self-contained even if that ever changes).
    await request(app.getHttpServer())
      .delete(`/api/analyzer/saved/${first.body.id}`)
      .set('Authorization', `Bearer ${proUser.jwt}`)
      .expect(200);
  });

  // ------------------------------------------------------------------
  // v2 endpoints: property-lookup + ai-insights/{section,header}
  // ------------------------------------------------------------------
  // All three are Pro-gated via @UseGuards(JwtAuthGuard). Guards execute
  // before pipes in NestJS, so an empty body / missing token rejects at
  // the guard with 401 *before* validation could turn it into a 400.
  describe('v2 endpoints', () => {
    it('GET /api/analyzer/property-lookup without auth returns 401', async () => {
      await request(app.getHttpServer())
        .get('/api/analyzer/property-lookup?address=123+Main+St')
        .expect(401);
    });

    it('POST /api/analyzer/ai-insights/section without auth returns 401', async () => {
      await request(app.getHttpServer())
        .post('/api/analyzer/ai-insights/section')
        .send({ id: 'projection', payload: {} })
        .expect(401);
    });

    it('POST /api/analyzer/ai-insights/header without auth returns 401', async () => {
      await request(app.getHttpServer())
        .post('/api/analyzer/ai-insights/header')
        .send({ payload: {} })
        .expect(401);
    });

    // Pro-authenticated positive cases — same blocker as the .skip above
    // (needs SUPABASE_TEST_PRO_JWT). They also burn live quota: property-lookup
    // hits 3 RentCast endpoints per call, ai-insights/section hits the AI
    // provider unless the cache layer already has a hit. When the JWT fixture
    // lands, limit positive cases to 1-2 calls per suite run to stay under
    // free-tier limits.
    it.skip('GET /api/analyzer/property-lookup with Pro auth returns AVM + rent shape', () => {
      // Requires SUPABASE_TEST_PRO_JWT.
      // Assert: status 200, body has avm/rent/sales_comps/rental_comps,
      // source === 'rentcast'.
    });

    it.skip('POST /api/analyzer/ai-insights/section with Pro auth returns AIAnnotationDto', () => {
      // Requires SUPABASE_TEST_PRO_JWT.
      // Assert: status 200/201, body has text + threadId + cacheHit:boolean.
    });

    it.skip('POST /api/analyzer/ai-insights/section twice with same payload sets cacheHit=true on second call', () => {
      // Requires SUPABASE_TEST_PRO_JWT. First call populates cache; second
      // returns cacheHit:true (Redis or in-memory fallback both fine).
    });

    it.skip('POST /api/analyzer/ai-insights/header with Pro auth streams SSE chunks then [DONE]', () => {
      // Requires SUPABASE_TEST_PRO_JWT. Assert Content-Type text/event-stream,
      // at least one `data: {"chunk":...}\n\n` frame, terminates with
      // `data: [DONE]\n\n`.
    });
  });
});

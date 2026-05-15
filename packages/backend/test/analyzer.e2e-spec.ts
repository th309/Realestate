import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
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

describe('Analyzer (e2e)', () => {
  let app: INestApplication<App>;

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
  }, 60_000);

  afterAll(async () => {
    // Closing AppModule shuts down many cron + scheduler services. Some of
    // those drain async work (pg-boss, queue listeners) and need a generous
    // timeout to wind down cleanly.
    await app.close();
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

  // Auth-required flow tests (save → list → get → delete → share lifecycle)
  // require a real Supabase JWT for a Pro-tier test user. Skipped here until
  // a SUPABASE_TEST_PRO_JWT fixture is wired in CI. To enable locally:
  //   1. Create a Pro user in the Supabase test project.
  //   2. Mint a long-lived JWT (Supabase dashboard → Authentication → SQL).
  //   3. export SUPABASE_TEST_PRO_JWT=<token>
  //   4. Remove the .skip below and add `.set('Authorization', \`Bearer ${jwt}\`)`
  //      to each authenticated request.
  it.skip('POST /api/analyzer/save with Pro JWT persists and returns id + share_token', () => {
    // Requires SUPABASE_TEST_PRO_JWT env var. See comment above.
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

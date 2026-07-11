import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

jest.setTimeout(120_000);

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// Skip the suite when secrets aren't available so CI doesn't fail.
const describeIfSupabase = hasSupabase ? describe : describe.skip;

describeIfSupabase('GET /api/scores/heatmap/metro (real DB)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a dense, aligned score matrix for 900+ metros and 300+ months', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/scores/heatmap/metro')
      .expect(200);

    expect(res.headers['cache-control']).toContain('public');

    const { months, metros, scores } = res.body;
    expect(months.length).toBeGreaterThanOrEqual(300);
    expect(metros.length).toBeGreaterThanOrEqual(900);
    expect(scores.length).toBe(metros.length);
    for (const row of scores) {
      expect(row.length).toBe(months.length);
    }

    // Months ascend and are ISO dates
    expect(months[0] < months[months.length - 1]).toBe(true);
    expect(months[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Scores stay in 0..99 (0 = no data). Loop — spreading 285k values
    // into Math.min/max blows the call stack.
    let min = Infinity;
    let max = -Infinity;
    for (const row of scores) {
      for (const v of row) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(99);
    expect(max).toBeGreaterThan(0); // sanity: matrix is not all empty

    // Spot-check a stable metro: Des Moines (verified centroid 41.512,-93.729)
    const desMoinesIdx = metros.findIndex(
      (m: { id: string }) => m.id === '19780',
    );
    expect(desMoinesIdx).toBeGreaterThanOrEqual(0);
    expect(metros[desMoinesIdx].lat).toBeCloseTo(41.512, 1);
    expect(metros[desMoinesIdx].lon).toBeCloseTo(-93.729, 1);
    // Des Moines is scored in the latest month
    expect(scores[desMoinesIdx][months.length - 1]).toBeGreaterThan(0);
  });

  it('rejects unsupported geographies with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/scores/heatmap/county')
      .expect(400);
  });
});

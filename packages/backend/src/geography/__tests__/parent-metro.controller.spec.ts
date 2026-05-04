import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { GeographyController } from '../geography.controller';
import { GeographyService } from '../geography.service';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';

/**
 * Controller tests for GET /api/geography/parent-metro/:fips
 *
 * Uses an in-memory fake Supabase client (overrideProvider on SUPABASE_CLIENT)
 * so the test does not need live DB credentials. The fake returns deterministic
 * geography_crosswalk rows for two counties:
 *   - 37183 (Wake County, NC) -> CBSA 39580 / "Raleigh-Cary, NC"
 *   - 02013 (Aleutians East Borough, AK) -> NULL CBSA (rural, no metro)
 */

interface CrosswalkRow {
  county_fips: string;
  cbsa_code: string | null;
  cbsa_name: string | null;
}

function createSupabaseFake() {
  const crosswalkRows: CrosswalkRow[] = [
    {
      county_fips: '37183',
      cbsa_code: '39580',
      cbsa_name: 'Raleigh-Cary, NC',
    },
    {
      county_fips: '02013',
      cbsa_code: null,
      cbsa_name: null,
    },
  ];

  function makeQuery(table: string) {
    let rows: CrosswalkRow[] =
      table === 'geography_crosswalk' ? [...crosswalkRows] : [];
    const filters: Array<(r: any) => boolean> = [];
    let limitN: number | null = null;

    const q: any = {
      select: (_cols: string) => q,
      eq: (col: string, val: any) => {
        filters.push((r) => r[col] === val);
        return q;
      },
      limit: (n: number) => {
        limitN = n;
        return q;
      },
      maybeSingle: async () => {
        let out = rows.filter((r) => filters.every((f) => f(r)));
        if (limitN != null) out = out.slice(0, limitN);
        return { data: out[0] ?? null, error: null };
      },
    };
    return q;
  }

  return {
    from: (table: string) => makeQuery(table),
    rpc: async () => ({ data: null, error: null }),
  };
}

describe('GeographyController parent-metro', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const fakeClient = createSupabaseFake();
    const moduleRef = await Test.createTestingModule({
      controllers: [GeographyController],
      providers: [
        GeographyService,
        { provide: SUPABASE_CLIENT, useValue: fakeClient },
      ],
    }).compile();

    // Disable onModuleInit pre-warming (calls RPCs we don't fake)
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with cbsa_code/cbsa_name for a CBSA county (Wake -> Raleigh)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/geography/parent-metro/37183')
      .expect(200);

    expect(res.body).toEqual({
      county_fips: '37183',
      cbsa_code: '39580',
      cbsa_name: 'Raleigh-Cary, NC',
    });
  });

  it('returns 200 with null cbsa fields for a non-CBSA county (Aleutians East Borough)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/geography/parent-metro/02013')
      .expect(200);

    expect(res.body).toEqual({
      county_fips: '02013',
      cbsa_code: null,
      cbsa_name: null,
    });
  });

  it('returns 400 for non-5-digit FIPS', async () => {
    await request(app.getHttpServer())
      .get('/api/geography/parent-metro/abc')
      .expect(400);
  });
});

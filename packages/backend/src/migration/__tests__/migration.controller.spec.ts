import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MigrationModule } from '../migration.module';
import { MigrationController } from '../migration.controller';
import { MigrationService } from '../migration.service';
import { SupabaseService } from '../../supabase/supabase.service';

// Touch the import so the module reference is preserved for symmetry with the
// implementation plan; the test compiles controller+service directly with a
// fake SupabaseService since SupabaseModule is @Global and not part of an
// isolated test-module compile.
void MigrationModule;

/**
 * Controller tests for /api/migration/flows/:source/:fips
 *
 * Uses an in-memory fake SupabaseService (overrideProvider) so the test does
 * not need live DB credentials. The fake returns a deterministic IRS row +
 * geographies row so we can assert response shape.
 */

type SupabaseFake = ReturnType<typeof createSupabaseFake>;

function createSupabaseFake() {
  // Minimal chainable mock that supports:
  //   .from(table).select(...).eq(...).order(...).limit(...) -> { data, error }
  //   .from('geographies').select(...).in(...) -> { data, error }
  const tables: Record<string, any[]> = {
    irs_county_migration_flows: [
      {
        tax_year: 2023,
        num_returns: 1234,
        num_exemptions: 2456,
        agi_thousands: 98765,
        origin_fips: '37119',
        destination_fips: '37183',
      },
      {
        tax_year: 2023,
        num_returns: 800,
        num_exemptions: 1500,
        agi_thousands: 60000,
        origin_fips: '36061',
        destination_fips: '37183',
      },
      {
        tax_year: 2023,
        num_returns: 500,
        num_exemptions: 900,
        agi_thousands: 40000,
        origin_fips: '00000',
        destination_fips: '37183',
      },
    ],
    redfin_migration_flows_metro: [],
    geographies: [
      { geography_id: '37183', name: 'Wake County, NC' },
      { geography_id: '37119', name: 'Mecklenburg County, NC' },
      { geography_id: '36061', name: 'New York County, NY' },
    ],
  };

  function makeQuery(table: string) {
    const rows = [...(tables[table] ?? [])];
    const filters: Array<(r: any) => boolean> = [];
    let orderField: string | null = null;
    let orderDesc = false;
    let limitN: number | null = null;

    const q: any = {
      select: (_cols: string) => q,
      eq: (col: string, val: any) => {
        filters.push((r) => r[col] === val);
        return q;
      },
      in: (col: string, vals: any[]) => {
        const set = new Set(vals);
        filters.push((r) => set.has(r[col]));
        return q;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        orderField = col;
        orderDesc = opts?.ascending === false;
        return q;
      },
      limit: (n: number) => {
        limitN = n;
        return q;
      },
      then: (resolve: (v: any) => any) => {
        let out = rows.filter((r) => filters.every((f) => f(r)));
        if (orderField) {
          const f = orderField;
          out = [...out].sort((a, b) =>
            orderDesc ? b[f] - a[f] : a[f] - b[f],
          );
        }
        if (limitN != null) out = out.slice(0, limitN);
        return resolve({ data: out, error: null });
      },
    };
    return q;
  }

  const client = {
    from: (table: string) => makeQuery(table),
  };

  return {
    getClient: () => client,
  };
}

describe('MigrationController', () => {
  let app: INestApplication;
  let fake: SupabaseFake;

  beforeAll(async () => {
    fake = createSupabaseFake();
    const moduleRef = await Test.createTestingModule({
      controllers: [MigrationController],
      providers: [
        MigrationService,
        { provide: SupabaseService, useValue: fake },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 400 on invalid source', async () => {
    await request(app.getHttpServer())
      .get('/api/migration/flows/foo/37183?direction=in&limit=5')
      .expect(400);
  });

  it('returns 400 on invalid direction', async () => {
    await request(app.getHttpServer())
      .get('/api/migration/flows/irs/37183?direction=sideways&limit=5')
      .expect(400);
  });

  it('returns 200 with flows shape for irs/county', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/migration/flows/irs/37183?direction=in&limit=3')
      .expect(200);
    expect(res.body).toHaveProperty('geography.fips', '37183');
    expect(res.body).toHaveProperty('source', 'irs');
    expect(res.body).toHaveProperty('flows');
    expect(Array.isArray(res.body.flows)).toBe(true);
    expect(res.body.flows.length).toBeLessThanOrEqual(3);
  });
});

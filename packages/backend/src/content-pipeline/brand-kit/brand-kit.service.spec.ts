import { BrandKitService } from './brand-kit.service';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  PROPERTYIQ_BRAND_NAME,
  PROPERTYIQ_COVERAGE_STAT,
} from './propertyiq-brand-seed';

/**
 * In-memory Supabase fake supporting the small chain surface BrandKitService
 * uses: select().eq().order().limit().maybeSingle(), insert(), and
 * update().eq().select().maybeSingle(). Thenable so `await builder` (select-all)
 * resolves to { data, error }.
 */
function makeSupabaseFake(initialRows: Record<string, unknown>[] = []) {
  const store: { brands: Record<string, unknown>[] } = {
    brands: [...initialRows],
  };
  let idCounter = 1;

  function builder(table: 'brands') {
    let op: 'select' | 'insert' | 'upsert' | 'update' = 'select';
    const filters: Array<[string, unknown]> = [];
    let insertRow: Record<string, unknown> | null = null;
    let patch: Record<string, unknown> | null = null;

    const match = (rows: Record<string, unknown>[]) =>
      rows.filter((r) => filters.every(([c, v]) => r[c] === v));

    const b = {
      select() {
        return b;
      },
      insert(obj: Record<string, unknown>) {
        op = 'insert';
        insertRow = {
          id: `brand-${idCounter++}`,
          created_at: new Date(2026, 0, idCounter).toISOString(),
          updated_at: new Date().toISOString(),
          ...obj,
        };
        store[table].push(insertRow);
        return b;
      },
      // Atomic seed: INSERT ON CONFLICT (name) DO NOTHING. Only inserts when no
      // row with the same name exists (ignoreDuplicates).
      upsert(obj: Record<string, unknown>) {
        op = 'upsert';
        if (!store[table].some((r) => r.name === obj.name)) {
          insertRow = {
            id: `brand-${idCounter++}`,
            created_at: new Date(2026, 0, idCounter).toISOString(),
            updated_at: new Date().toISOString(),
            ...obj,
          };
          store[table].push(insertRow);
        }
        return b;
      },
      update(p: Record<string, unknown>) {
        op = 'update';
        patch = p;
        return b;
      },
      eq(c: string, v: unknown) {
        filters.push([c, v]);
        return b;
      },
      order() {
        return b;
      },
      limit() {
        return b;
      },
      maybeSingle() {
        if (op === 'update') {
          const rows = match(store[table]);
          rows.forEach((r) => Object.assign(r, patch));
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        }
        return Promise.resolve({
          data: match(store[table])[0] ?? null,
          error: null,
        });
      },
      single() {
        return b.maybeSingle();
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        if (op === 'insert') {
          return Promise.resolve({ data: [insertRow], error: null }).then(
            resolve,
            reject,
          );
        }
        if (op === 'upsert') {
          return Promise.resolve({ data: null, error: null }).then(
            resolve,
            reject,
          );
        }
        if (op === 'update') {
          const rows = match(store[table]);
          rows.forEach((r) => Object.assign(r, patch));
          return Promise.resolve({ data: rows, error: null }).then(
            resolve,
            reject,
          );
        }
        return Promise.resolve({ data: match(store[table]), error: null }).then(
          resolve,
          reject,
        );
      },
    };
    return b;
  }

  const supabase = {
    getClient: () => ({ from: (t: 'brands') => builder(t) }),
  } as unknown as SupabaseService;

  return { supabase, store };
}

describe('BrandKitService seeding + approved-copy exposure', () => {
  it('seeds the singleton PropertyIQ brand on first getBrandProfile()', async () => {
    const { supabase, store } = makeSupabaseFake();
    const service = new BrandKitService(supabase);

    const profile = await service.getBrandProfile();

    expect(store.brands).toHaveLength(1);
    expect(store.brands[0].name).toBe(PROPERTYIQ_BRAND_NAME);
    expect(profile.name).toBe(PROPERTYIQ_BRAND_NAME);
    expect(profile.approvedCopy.coverageStat).toBe(PROPERTYIQ_COVERAGE_STAT);
    expect(profile.approvedCopy.coverageStat).toBe(
      '900+ metros, 3,000+ counties, 29,000+ ZIPs',
    );
  });

  it('does not double-seed on repeated calls', async () => {
    const { supabase, store } = makeSupabaseFake();
    const service = new BrandKitService(supabase);

    await service.getBrandProfile();
    await service.getBrandProfile();

    expect(store.brands).toHaveLength(1);
  });

  it('exposes approved taglines and sign-offs verbatim', async () => {
    const { supabase } = makeSupabaseFake();
    const service = new BrandKitService(supabase);

    const { approvedCopy } = await service.getBrandProfile();

    expect(approvedCopy.taglines).toContain('The IQ Behind Every Market');
    expect(approvedCopy.signOffs).toContain('PropertyIQ. Now you know.');
    expect(approvedCopy.signOffs).toContain('Now you know.');
  });

  it('enforces momentum-only score language (never quality words)', async () => {
    const { supabase } = makeSupabaseFake();
    const service = new BrandKitService(supabase);

    const { approvedCopy } = await service.getBrandProfile();

    expect(approvedCopy.scoreLanguage.allowedMomentumWords).toEqual(
      expect.arrayContaining(['rising', 'steady', 'easing', 'weak']),
    );
    expect(approvedCopy.scoreLanguage.bannedQualityWords).toEqual(
      expect.arrayContaining(['excellent', 'good', 'poor', 'bad']),
    );
  });

  it('bans hype phrases, dashes, and named competitors', async () => {
    const { supabase } = makeSupabaseFake();
    const service = new BrandKitService(supabase);

    const { approvedCopy } = await service.getBrandProfile();

    expect(approvedCopy.bans.hypePhrases).toContain('game-changer');
    expect(approvedCopy.bans.noEmOrEnDashes).toBe(true);
    expect(approvedCopy.bans.neverNameCompetitors).toBe(true);
    expect(approvedCopy.bans.competitors).toContain('Reventure');
  });

  it('buildPromptPreamble encodes the hard rules and approved coverage stat', async () => {
    const { supabase } = makeSupabaseFake();
    const service = new BrandKitService(supabase);

    const profile = await service.getBrandProfile();
    const preamble = service.buildPromptPreamble(profile);

    expect(preamble).toContain('900+ metros, 3,000+ counties, 29,000+ ZIPs');
    expect(preamble.toLowerCase()).toContain('em dash');
    expect(preamble).toContain('Never name competitors');
    expect(preamble).toContain('PropertyIQ Score');
  });
});

describe('BrandKitService.updateBrand deep-merges JSONB (no sibling loss)', () => {
  it('preserves untouched approvedCopy siblings on a partial patch', async () => {
    const { supabase, store } = makeSupabaseFake([
      {
        id: 'brand-1',
        name: 'PropertyIQ',
        website_url: 'https://www.propertyiq.app',
        voice_summary: 'v',
        tone_settings: { attributes: ['confident'], shorthand: 's' },
        products: [],
        target_platforms: ['linkedin'],
        approved_copy: {
          coverageStat: 'OLD',
          taglines: ['Keep me'],
          signOffs: ['Now you know.'],
          bans: { hypePhrases: ['game-changer'], competitors: ['Reventure'] },
        },
        created_at: '2026-07-25T00:00:00Z',
        updated_at: '2026-07-25T00:00:00Z',
      },
    ]);
    const service = new BrandKitService(supabase);

    const profile = await service.updateBrand('brand-1', {
      approvedCopy: { coverageStat: 'NEW' },
    } as never);

    // Patched field updated...
    expect(profile.approvedCopy.coverageStat).toBe('NEW');
    // ...and siblings preserved (not wiped by a full-column overwrite).
    expect(profile.approvedCopy.taglines).toContain('Keep me');
    // The stored row reflects the merge, not a replace.
    const stored = store.brands[0].approved_copy as {
      coverageStat: string;
      taglines: string[];
    };
    expect(stored.coverageStat).toBe('NEW');
    expect(stored.taglines).toEqual(['Keep me']);
  });
});

describe('BrandKitService filters malformed stored products (read side)', () => {
  it('drops product entries missing name or summary', async () => {
    const { supabase } = makeSupabaseFake([
      {
        id: 'brand-x',
        name: 'PropertyIQ',
        website_url: null,
        voice_summary: null,
        tone_settings: {},
        products: [
          { name: 'PropertyIQ Score', summary: 'A momentum score.' },
          { name: '', summary: 'no name' },
          { name: 'no summary' },
          {},
          'not an object',
        ],
        target_platforms: [],
        approved_copy: {},
        created_at: '2026-07-25T00:00:00Z',
        updated_at: '2026-07-25T00:00:00Z',
      },
    ]);
    const service = new BrandKitService(supabase);

    const profile = await service.getBrandProfile('brand-x');

    expect(profile.products).toHaveLength(1);
    expect(profile.products[0]).toEqual({
      name: 'PropertyIQ Score',
      summary: 'A momentum score.',
    });
    // A preamble built from this profile can never render "undefined: undefined".
    expect(service.buildPromptPreamble(profile)).not.toContain('undefined');
  });
});

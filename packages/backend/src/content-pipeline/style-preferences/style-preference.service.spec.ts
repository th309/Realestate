import { NotFoundException } from '@nestjs/common';
import { StylePreferenceService } from './style-preference.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { BrandKitService } from '../brand-kit/brand-kit.service';

const BRAND_ID = 'brand-1';

type Row = Record<string, unknown>;

/**
 * In-memory Supabase fake covering the chain surface StylePreferenceService
 * uses: select().eq().order().limit().maybeSingle(), select().in(),
 * insert().select().maybeSingle(), and update().eq().select().maybeSingle().
 */
function makeSupabaseFake(seed: {
  preferences?: Row[];
  styleReferences?: Row[];
}) {
  const store: Record<string, Row[]> = {
    collections_preferences: [...(seed.preferences ?? [])],
    style_references: [...(seed.styleReferences ?? [])],
  };
  let idCounter = 1;

  function builder(table: string) {
    let op: 'select' | 'insert' | 'update' = 'select';
    const filters: Array<[string, unknown]> = [];
    let inFilter: [string, unknown[]] | null = null;
    let patch: Row | null = null;
    let inserted: Row | null = null;
    let ascending = true;
    let ordered = false;

    const match = () => {
      let rows = store[table].filter((r) =>
        filters.every(([c, v]) => r[c] === v),
      );
      if (inFilter)
        rows = rows.filter((r) => inFilter![1].includes(r[inFilter![0]]));
      if (ordered)
        rows = [...rows].sort((a, b) =>
          ascending
            ? String(a.created_at).localeCompare(String(b.created_at))
            : String(b.created_at).localeCompare(String(a.created_at)),
        );
      return rows;
    };

    const b = {
      select: () => b,
      insert(obj: Row) {
        op = 'insert';
        inserted = {
          id: `pref-${idCounter++}`,
          created_at: new Date(2026, 6, idCounter).toISOString(),
          updated_at: new Date(2026, 6, idCounter).toISOString(),
          ...obj,
        };
        store[table].push(inserted);
        return b;
      },
      update(p: Row) {
        op = 'update';
        patch = p;
        return b;
      },
      eq(c: string, v: unknown) {
        filters.push([c, v]);
        return b;
      },
      in(c: string, vs: unknown[]) {
        inFilter = [c, vs];
        return b;
      },
      order(_c: string, opts?: { ascending?: boolean }) {
        ordered = true;
        ascending = opts?.ascending ?? true;
        return b;
      },
      limit: () => b,
      maybeSingle() {
        if (op === 'insert')
          return Promise.resolve({ data: inserted, error: null });
        const rows = match();
        if (op === 'update') {
          rows.forEach((r) => Object.assign(r, patch));
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        }
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      then(resolve: (v: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve(resolve({ data: match(), error: null }));
      },
    };
    return b;
  }

  const supabase = {
    getClient: () => ({ from: (t: string) => builder(t) }),
  } as unknown as SupabaseService;
  return { supabase, store };
}

function styleRef(id: string, label: string, attrs: Row = {}) {
  return {
    id,
    label,
    extracted_attributes: attrs,
    created_at: '2026-07-01T00:00:00.000Z',
  };
}

function build(seed: { preferences?: Row[]; styleReferences?: Row[] } = {}) {
  const { supabase, store } = makeSupabaseFake(seed);
  const brandKit = {
    ensurePropertyIqBrand: jest.fn(() => Promise.resolve({ id: BRAND_ID })),
    buildPromptPreamble: jest.fn(() => 'BRAND PREAMBLE'),
  } as unknown as BrandKitService;
  return {
    service: new StylePreferenceService(supabase, brandKit),
    store,
    brandKit,
  };
}

describe('StylePreferenceService seeds one preferences row per brand', () => {
  it('creates the row on first read with the default weight and no likes', async () => {
    const { service, store } = build();
    const prefs = await service.getPreferences();
    expect(prefs.brandId).toBe(BRAND_ID);
    expect(prefs.signalWeight).toBe(1);
    expect(prefs.savedStyleRefs).toEqual([]);
    expect(prefs.stylePreamble).toBe('');
    expect(store.collections_preferences).toHaveLength(1);
  });

  it('reuses the existing row instead of creating a second one', async () => {
    const { service, store } = build();
    await service.getPreferences();
    await service.getPreferences();
    expect(store.collections_preferences).toHaveLength(1);
  });

  it('reads the earliest row when a race ever left duplicates behind', async () => {
    const { service } = build({
      preferences: [
        {
          id: 'pref-late',
          brand_id: BRAND_ID,
          saved_style_refs: [],
          signal_weight: 2,
          created_at: '2026-07-20T00:00:00.000Z',
        },
        {
          id: 'pref-early',
          brand_id: BRAND_ID,
          saved_style_refs: [],
          signal_weight: 0.5,
          created_at: '2026-07-01T00:00:00.000Z',
        },
      ],
    });
    expect((await service.getPreferences()).signalWeight).toBe(0.5);
  });
});

describe('StylePreferenceService save and unsave likes', () => {
  const seeded = () =>
    build({
      styleReferences: [
        styleRef('ref-a', 'Bold poster', {
          palette: ['#0B1E3F'],
          summary: 'High contrast.',
        }),
        styleRef('ref-b', 'Soft editorial'),
      ],
    });

  it('saves a reference and puts it into the generation prompt', async () => {
    const { service } = seeded();
    const prefs = await service.saveStyleRef('ref-a');
    expect(prefs.savedStyleRefs.map((r) => r.style_reference_id)).toEqual([
      'ref-a',
    ]);
    expect(prefs.stylePreamble).toContain('Bold poster');
    expect(prefs.stylePreamble).toContain('Colors: #0B1E3F.');
  });

  it('is idempotent: saving twice does not duplicate the like', async () => {
    const { service } = seeded();
    await service.saveStyleRef('ref-a');
    const prefs = await service.saveStyleRef('ref-a');
    expect(prefs.savedStyleRefs).toHaveLength(1);
  });

  it('orders newest-saved first so the newest likes win the prompt cap', async () => {
    const { service } = seeded();
    await service.saveStyleRef('ref-a');
    const prefs = await service.saveStyleRef('ref-b');
    expect(prefs.savedStyleRefs.map((r) => r.style_reference_id)).toEqual([
      'ref-b',
      'ref-a',
    ]);
  });

  it('rejects an unknown reference id rather than storing a dead like', async () => {
    const { service } = seeded();
    await expect(service.saveStyleRef('ref-missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('unsaves a reference and drops it from the prompt', async () => {
    const { service } = seeded();
    await service.saveStyleRef('ref-a');
    const prefs = await service.unsaveStyleRef('ref-a');
    expect(prefs.savedStyleRefs).toEqual([]);
    expect(prefs.stylePreamble).toBe('');
  });

  it('unsaving something that was never saved is a no-op', async () => {
    const { service } = seeded();
    const prefs = await service.unsaveStyleRef('ref-b');
    expect(prefs.savedStyleRefs).toEqual([]);
  });
});

describe('StylePreferenceService hydrates likes from live style references', () => {
  it('prefers the live label over the denormalized one', async () => {
    const { service, store } = build({
      styleReferences: [styleRef('ref-a', 'Original label')],
    });
    await service.saveStyleRef('ref-a');
    store.style_references[0].label = 'Renamed on the library page';
    const prefs = await service.getPreferences();
    expect(prefs.savedStyleRefs[0].label).toBe('Renamed on the library page');
  });

  it('keeps a deleted reference visible but out of the prompt', async () => {
    const { service, store } = build({
      styleReferences: [
        styleRef('ref-a', 'Bold poster', { summary: 'High contrast.' }),
      ],
    });
    await service.saveStyleRef('ref-a');
    store.style_references.length = 0;
    const prefs = await service.getPreferences();
    expect(prefs.savedStyleRefs[0].exists).toBe(false);
    expect(prefs.stylePreamble).toBe('');
  });
});

describe('StylePreferenceService signal weight controls prompt influence', () => {
  const seeded = () =>
    build({
      styleReferences: [
        styleRef('ref-a', 'Bold poster', { summary: 'High contrast.' }),
      ],
    });

  it('mutes the block at weight 0 without unsaving anything', async () => {
    const { service } = seeded();
    await service.saveStyleRef('ref-a');
    const prefs = await service.setSignalWeight(0);
    expect(prefs.signalWeight).toBe(0);
    expect(prefs.savedStyleRefs).toHaveLength(1);
    expect(prefs.stylePreamble).toBe('');
  });

  it('strengthens the directive at a high weight', async () => {
    const { service } = seeded();
    await service.saveStyleRef('ref-a');
    const prefs = await service.setSignalWeight(1.8);
    expect(prefs.stylePreamble).toContain('hard constraint');
  });

  it('clamps an out-of-range weight before storing it', async () => {
    const { service } = seeded();
    expect((await service.setSignalWeight(99)).signalWeight).toBe(2);
  });
});

describe('StylePreferenceService.buildGenerationPreamble closes the loop', () => {
  it('returns the brand preamble alone when nothing is liked', async () => {
    const { service } = build();
    const out = await service.buildGenerationPreamble({
      id: BRAND_ID,
    } as never);
    expect(out).toBe('BRAND PREAMBLE');
  });

  it('appends the saved-style block once a reference is liked', async () => {
    const { service } = build({
      styleReferences: [
        styleRef('ref-a', 'Bold poster', { summary: 'High contrast.' }),
      ],
    });
    await service.saveStyleRef('ref-a');
    const out = await service.buildGenerationPreamble({
      id: BRAND_ID,
    } as never);
    expect(out.startsWith('BRAND PREAMBLE')).toBe(true);
    expect(out).toContain('SAVED STYLE PREFERENCES');
    expect(out).toContain('Bold poster');
  });

  it('degrades to a brand-only prompt when preferences cannot be read', async () => {
    const { service } = build();
    jest
      .spyOn(service, 'getPreferences')
      .mockRejectedValue(new Error('supabase down'));
    const out = await service.buildGenerationPreamble({
      id: BRAND_ID,
    } as never);
    expect(out).toBe('BRAND PREAMBLE');
  });
});

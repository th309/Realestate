// Shared test doubles for the style-preference loop. Not a spec file (jest
// testRegex only collects *.spec.ts / *.test.ts), so it is safe to live here.

import type { SupabaseService } from '../../../supabase/supabase.service';
import type { BrandKitService } from '../../brand-kit/brand-kit.service';

export type Row = Record<string, unknown>;

/**
 * In-memory Supabase fake covering the chain surface StylePreferenceService
 * uses: select().eq().order().limit().maybeSingle(), select().in(),
 * insert().select().maybeSingle(), and update().eq().select().maybeSingle().
 */
export function makeSupabaseFake(seed: {
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

/** A `style_references` row seeded into the fake. */
export function styleRef(id: string, label: string, attrs: Row = {}): Row {
  return {
    id,
    label,
    extracted_attributes: attrs,
    created_at: '2026-07-01T00:00:00.000Z',
  };
}

/** BrandKit stub returning a fixed brand and a fixed preamble. */
export function makeBrandKitStub(
  brandId: string,
  preamble = 'BRAND PREAMBLE',
): BrandKitService {
  return {
    ensurePropertyIqBrand: jest.fn(() => Promise.resolve({ id: brandId })),
    getBrandProfile: jest.fn(() => Promise.resolve({ id: brandId })),
    buildPromptPreamble: jest.fn(() => preamble),
  } as unknown as BrandKitService;
}

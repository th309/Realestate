import { NotFoundException } from '@nestjs/common';
import {
  MAX_SAVED_STYLE_REFS,
  StylePreferenceService,
} from './style-preference.service';
import { MAX_REFS_IN_PREAMBLE } from './style-preference-preamble';
import { orderNewestFirstAndCap } from './style-preference-normalizers';
import type { SavedStyleRef } from './style-preference.types';
import {
  makeBrandKitStub,
  makeSupabaseFake,
  styleRef,
  type Row,
} from './__tests__/style-preference-test-helpers';

const BRAND_ID = 'brand-1';

function build(seed: { preferences?: Row[]; styleReferences?: Row[] } = {}) {
  const { supabase, store } = makeSupabaseFake(seed);
  const brandKit = makeBrandKitStub(BRAND_ID);
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

describe('orderNewestFirstAndCap makes "newest" well defined', () => {
  const ref = (id: string, savedAt: string): SavedStyleRef => ({
    style_reference_id: id,
    label: id,
    saved_at: savedAt,
  });

  it('sorts newest first regardless of the stored array order', () => {
    const { saved } = orderNewestFirstAndCap(
      [
        ref('old', '2026-01-01T00:00:00.000Z'),
        ref('new', '2026-07-01T00:00:00.000Z'),
        ref('mid', '2026-04-01T00:00:00.000Z'),
      ],
      10,
    );
    expect(saved.map((r) => r.style_reference_id)).toEqual([
      'new',
      'mid',
      'old',
    ]);
  });

  it('sorts an unparseable saved_at last instead of poisoning the order', () => {
    const { saved } = orderNewestFirstAndCap(
      [
        ref('broken', 'not-a-date'),
        ref('real', '2026-04-01T00:00:00.000Z'),
      ],
      10,
    );
    expect(saved.map((r) => r.style_reference_id)).toEqual(['real', 'broken']);
  });

  it('evicts the oldest beyond the cap and reports how many', () => {
    const refs = Array.from({ length: 6 }, (_, i) =>
      ref(`ref-${i}`, `2026-0${i + 1}-01T00:00:00.000Z`),
    );
    const { saved, evicted } = orderNewestFirstAndCap(refs, 4);
    expect(evicted).toBe(2);
    expect(saved).toHaveLength(4);
    expect(saved.map((r) => r.style_reference_id)).toEqual([
      'ref-5',
      'ref-4',
      'ref-3',
      'ref-2',
    ]);
  });

  it('reports no eviction when the list fits', () => {
    expect(orderNewestFirstAndCap([ref('a', '2026-01-01T00:00:00.000Z')], 50))
      .toEqual({ saved: [expect.objectContaining({ style_reference_id: 'a' })], evicted: 0 });
  });
});

describe('the storage cap and the prompt cap are separate limits', () => {
  function withRefs(count: number) {
    return build({
      styleReferences: Array.from({ length: count }, (_, i) =>
        styleRef(`ref-${i}`, `Look ${i}`, { summary: `Summary ${i}.` }),
      ),
    });
  }

  it('keeps every like below the storage cap, even past the prompt cap', async () => {
    const { service } = withRefs(MAX_REFS_IN_PREAMBLE + 3);
    for (let i = 0; i < MAX_REFS_IN_PREAMBLE + 3; i++) {
      await service.saveStyleRef(`ref-${i}`);
    }
    const prefs = await service.getPreferences();
    // A 6th like is NOT discarded on save; it is simply not in the prompt.
    expect(prefs.savedStyleRefs).toHaveLength(MAX_REFS_IN_PREAMBLE + 3);
    const bullets = prefs.stylePreamble
      .split('\n')
      .filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(MAX_REFS_IN_PREAMBLE);
  });

  it('puts the newest likes in the prompt and leaves the older ones stored', async () => {
    const { service } = withRefs(MAX_REFS_IN_PREAMBLE + 2);
    for (let i = 0; i < MAX_REFS_IN_PREAMBLE + 2; i++) {
      await service.saveStyleRef(`ref-${i}`);
    }
    const prefs = await service.getPreferences();
    const newest = `Look ${MAX_REFS_IN_PREAMBLE + 1}`;
    expect(prefs.stylePreamble).toContain(newest);
    expect(prefs.stylePreamble).not.toContain('Look 0');
    expect(
      prefs.savedStyleRefs.some((r) => r.style_reference_id === 'ref-0'),
    ).toBe(true);
  });

  it('bounds the persisted row at the storage cap by evicting the oldest', async () => {
    const total = MAX_SAVED_STYLE_REFS + 5;
    const { service, store } = withRefs(total);
    for (let i = 0; i < total; i++) {
      await service.saveStyleRef(`ref-${i}`);
    }
    const row = store.collections_preferences[0] as {
      saved_style_refs: SavedStyleRef[];
    };
    expect(row.saved_style_refs).toHaveLength(MAX_SAVED_STYLE_REFS);
    // The five oldest were evicted; the newest survived.
    const ids = row.saved_style_refs.map((r) => r.style_reference_id);
    expect(ids).toContain(`ref-${total - 1}`);
    expect(ids).not.toContain('ref-0');
    expect(ids).not.toContain('ref-4');
  });
});

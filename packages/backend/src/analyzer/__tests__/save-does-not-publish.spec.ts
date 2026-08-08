import { AnalyzerPersistenceService } from '../analyzer.persistence.service';
import type { AnalysisSnapshotDto } from '../dto/analysis-snapshot.dto';

/**
 * Regression guard for the whole "a Save republished the share link" class.
 *
 * `result_snapshot` is the frozen artifact the public share page and the PDF
 * render from — a link may already be in a client's hands. Only Share and
 * PDF send it; a plain "Save deal" omits the key. This pins that the backend
 * treats an omitted key as "leave it alone" rather than as a clear, and that
 * the NOT NULL column still gets a value when the row is first created.
 *
 * The frontend half of the same guarantee (the payload types that make a
 * publishing Save a compile error) is pinned in
 * `app/(app)/analyzer/components/chrome/__tests__/AnalyzerHeaderActions.save-does-not-publish.test.tsx`.
 */
/**
 * One flat chain covering all three shapes `save()` drives. `maybeSingle`
 * terminates both `findExisting` and `updateExisting`, so it is separately
 * settable from `single` (the INSERT terminal) — that is what lets a test
 * say "no row exists yet, so take the insert path".
 */
function mockSupabase(
  result: { data: unknown; error: unknown },
  findResult: { data: unknown; error: unknown } = result,
) {
  const calls: Record<string, unknown>[] = [];
  let sawUpdate = false;
  const chain = {
    update: (p: Record<string, unknown>) => {
      calls.push({ update: p });
      sawUpdate = true;
      return chain;
    },
    insert: (p: Record<string, unknown>) => {
      calls.push({ insert: p });
      return chain;
    },
    select: () => chain,
    eq: (c: string, v: string) => {
      calls.push({ eq: [c, v] });
      return chain;
    },
    // Before any `.update()` this terminal belongs to `findExisting`.
    maybeSingle: () => Promise.resolve(sawUpdate ? result : findResult),
    single: () => Promise.resolve(result),
  };
  return { client: { from: () => chain } as never, calls };
}

/** What `buildDealStatePayload()` produces: no result_snapshot, no ai_verdict. */
const SAVE_DTO: Omit<AnalysisSnapshotDto, 'id'> = {
  address_full: '2 New St',
  address_city: 'Austin',
  address_state: 'TX',
  label: 'Duplex on 5th',
  input_snapshot: { v: 2, label: 'Duplex on 5th' },
};

function updateArg(calls: Record<string, unknown>[]) {
  return calls.find((c) => 'update' in c)?.update as Record<string, unknown>;
}

describe('AnalyzerPersistenceService.save — a Save must not publish', () => {
  it('omits result_snapshot from the UPDATE when the caller sent none', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1', share_token: 'tok' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.save('owner-1', { ...SAVE_DTO, id: 'row-1' });

    expect(updateArg(calls)).not.toHaveProperty('result_snapshot');
  });

  it('omits market_context from the UPDATE when the caller sent none', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1', share_token: 'tok' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.save('owner-1', { ...SAVE_DTO, id: 'row-1' });

    expect(updateArg(calls)).not.toHaveProperty('market_context');
  });

  it('still writes the identity columns a Save is responsible for', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1', share_token: 'tok' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.save('owner-1', { ...SAVE_DTO, id: 'row-1' });

    expect(updateArg(calls)).toEqual(
      expect.objectContaining({
        label: 'Duplex on 5th',
        address_full: '2 New St',
        input_snapshot: { v: 2, label: 'Duplex on 5th' },
        updated_at: expect.any(String),
      }),
    );
  });

  it('defaults result_snapshot to {} on INSERT — the column is NOT NULL', async () => {
    const { client, calls } = mockSupabase(
      { data: { id: 'new-1', share_token: 'tok' }, error: null },
      // findExisting: nothing saved for this owner+address yet.
      { data: null, error: null },
    );
    const svc = new AnalyzerPersistenceService(client);

    // No `id`, and no existing row, so this is the first-save INSERT path.
    await svc.save('owner-1', SAVE_DTO as AnalysisSnapshotDto);

    const insert = calls.find((c) => 'insert' in c)?.insert as Record<
      string,
      unknown
    >;
    expect(insert.result_snapshot).toEqual({});
  });

  it('a Share/PDF payload DOES write result_snapshot', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1', share_token: 'tok' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.save('owner-1', {
      ...SAVE_DTO,
      id: 'row-1',
      result_snapshot: { rental: { capRatePct: 6.1 } },
    });

    expect(updateArg(calls).result_snapshot).toEqual({
      rental: { capRatePct: 6.1 },
    });
  });
});

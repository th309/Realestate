import { AnalyzerPersistenceService } from '../analyzer.persistence.service';

function mockSupabase(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown>[] = [];
  const chain = {
    update: (payload: Record<string, unknown>) => {
      calls.push({ update: payload });
      return chain;
    },
    eq: (col: string, val: string) => {
      calls.push({ eq: [col, val] });
      return chain;
    },
    select: () => chain,
    maybeSingle: () => Promise.resolve(result),
  };
  return { client: { from: () => chain } as never, calls };
}

describe('AnalyzerPersistenceService.patchState', () => {
  it('writes only input_snapshot and updated_at when the state carries no name', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.patchState('owner-1', 'row-1', { v: 2, price: 300000 });

    const update = calls.find((c) => 'update' in c)?.update as Record<
      string,
      unknown
    >;
    expect(Object.keys(update).sort()).toEqual([
      'input_snapshot',
      'updated_at',
    ]);
    expect(update.input_snapshot).toEqual({ v: 2, price: 300000 });
  });

  /**
   * The write surface is still exactly "the working state" — `label` is not
   * a new capability, it is the same `input_snapshot` this DTO already
   * accepts, projected onto the column the saved-deals list reads. Without
   * it a rename updated the analyzer header and the stored state while the
   * list showed the old name forever. `PatchDealStateDto` stays narrow: the
   * thing it protects is the PUBLISHED artifact, asserted below.
   */
  it('projects the deal name from the state blob onto the label column', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.patchState('owner-1', 'row-1', {
      v: 2,
      label: 'Duplex on 5th',
      price: 300000,
    });

    const update = calls.find((c) => 'update' in c)?.update as Record<
      string,
      unknown
    >;
    expect(update.label).toBe('Duplex on 5th');
    expect(Object.keys(update).sort()).toEqual([
      'input_snapshot',
      'label',
      'updated_at',
    ]);
  });

  it('clears the label column when the user clears the name', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.patchState('owner-1', 'row-1', { v: 2, label: null });

    const update = calls.find((c) => 'update' in c)?.update as Record<
      string,
      unknown
    >;
    expect(update).toHaveProperty('label', null);
  });

  it('leaves the label column alone for a legacy v1 snapshot, which has no name', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    // A v1 `input_snapshot` IS the bare DealInput — no `label` key at all.
    // Writing null here would erase a name the row already carries.
    await svc.patchState('owner-1', 'row-1', { price: 300000 });

    const update = calls.find((c) => 'update' in c)?.update as Record<
      string,
      unknown
    >;
    expect(update).not.toHaveProperty('label');
  });

  it('never touches result_snapshot, market_context or share_token', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.patchState('owner-1', 'row-1', { v: 2 });

    const update = calls.find((c) => 'update' in c)?.update as Record<
      string,
      unknown
    >;
    expect(update).not.toHaveProperty('result_snapshot');
    expect(update).not.toHaveProperty('market_context');
    expect(update).not.toHaveProperty('share_token');
  });

  it('scopes the write by owner_id AND id — the service-role client bypasses RLS', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.patchState('owner-1', 'row-1', { v: 2 });

    const eqs = calls.filter((c) => 'eq' in c).map((c) => c.eq);
    expect(eqs).toContainEqual(['owner_id', 'owner-1']);
    expect(eqs).toContainEqual(['id', 'row-1']);
  });

  it('resolves null when the row is absent or not owned', async () => {
    const { client } = mockSupabase({ data: null, error: null });
    const svc = new AnalyzerPersistenceService(client);
    await expect(
      svc.patchState('owner-1', 'row-9', { v: 2 }),
    ).resolves.toBeNull();
  });

  it('throws on a real database error', async () => {
    const { client } = mockSupabase({ data: null, error: { message: 'boom' } });
    const svc = new AnalyzerPersistenceService(client);
    await expect(svc.patchState('owner-1', 'row-1', { v: 2 })).rejects.toThrow(
      'boom',
    );
  });
});

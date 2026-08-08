import { ConflictException } from '@nestjs/common';
import { AnalyzerPersistenceService } from '../analyzer.persistence.service';
import type { AnalysisSnapshotDto } from '../dto/analysis-snapshot.dto';

/**
 * Unit tests for `save()`'s id-keyed path (Task 12).
 *
 * `updateExisting` now switches on `.maybeSingle()` and Postgres error code,
 * so this mock's `update()` chain returns whatever `{ data, error }` the
 * test wants directly from `.maybeSingle()`/`.single()` — no separate
 * find-then-update chain is needed here because the id path skips
 * `findExisting()` entirely.
 */
function mockSupabase(updateResult: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown>[] = [];
  const chain = {
    update: (p: Record<string, unknown>) => {
      calls.push({ update: p });
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
    maybeSingle: () => Promise.resolve(updateResult),
    single: () => Promise.resolve(updateResult),
  };
  return { client: { from: () => chain } as never, calls };
}

// Typed as the real DTO (minus `id`, which each test adds) rather than cast
// to `never` — the brief's original fixture used `as never`, but spreading a
// `never`-typed value (`{ ...DTO, id: 'row-1' }`) is a plain `tsc --noEmit`
// error (TS2698), not just a lint nit.
const DTO: Omit<AnalysisSnapshotDto, 'id'> = {
  address_full: '2 New St',
  address_city: 'Austin',
  address_state: 'TX',
  input_snapshot: { v: 2 },
  result_snapshot: {},
};

describe('AnalyzerPersistenceService.save with an id', () => {
  it('updates that row directly instead of looking up by address', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1', share_token: 'tok' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.save('owner-1', { ...DTO, id: 'row-1' });

    const eqs = calls.filter((c) => 'eq' in c).map((c) => c.eq);
    expect(eqs).toContainEqual(['id', 'row-1']);
    expect(eqs).toContainEqual(['owner_id', 'owner-1']);
    expect(calls.some((c) => 'insert' in c)).toBe(false);
  });

  it('never writes the client-supplied id into the row', async () => {
    const { client, calls } = mockSupabase({
      data: { id: 'row-1', share_token: 'tok' },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.save('owner-1', { ...DTO, id: 'row-1' });

    const update = calls.find((c) => 'update' in c)?.update as Record<
      string,
      unknown
    >;
    expect(update).not.toHaveProperty('id');
    expect(update).not.toHaveProperty('owner_id');
  });

  it('raises 409 when renaming onto an address the owner already saved', async () => {
    const { client } = mockSupabase({
      data: null,
      error: { code: '23505', message: 'dup' },
    });
    const svc = new AnalyzerPersistenceService(client);

    await expect(
      svc.save('owner-1', { ...DTO, id: 'row-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

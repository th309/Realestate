import { AnalyzerPersistenceService } from '../analyzer.persistence.service';
import type { AnalysisSnapshotDto } from '../dto/analysis-snapshot.dto';

/**
 * Unit tests for the save/share path of AnalyzerPersistenceService.
 *
 * Each test builds a fresh in-memory supabase mock that returns whatever
 * the test wants from the relevant chain's terminal call
 * (`.maybeSingle()` / `.single()` / `.rpc()`); the service is constructed
 * directly with the mocked supabase client (it's the only dep).
 *
 * `save()` now upserts by `(owner_id, address_full)`, so it drives three
 * distinct supabase call chains depending on the path taken:
 *   - find:   `.from().select().eq().eq().maybeSingle()`
 *   - insert: `.from().insert().select().single()`
 *   - update: `.from().update().eq().eq().select().single()` (owner_id then id
 *     — the service-role client bypasses RLS, so this double-`.eq()` is the
 *     only enforcement that an update can't cross owners; see
 *     `updateExisting()`'s doc comment)
 * The `mockFindExistingChain` / `mockInsertChain` / `mockUpdateChain`
 * helpers below build one of these chains in isolation so each test only
 * has to say what the terminal call returns.
 */

const ADDRESS = '123 Main St, Austin, TX';

const baseDto: AnalysisSnapshotDto = {
  address_full: ADDRESS,
  address_city: 'Austin',
  address_state: 'TX',
  input_snapshot: {},
  result_snapshot: {},
};

/** Builds the `.select().eq().eq().maybeSingle()` chain used by findExisting. */
function mockFindExistingChain(
  ...results: Array<{ data: unknown; error: unknown }>
) {
  const maybeSingle = jest.fn();
  results.forEach((r) => maybeSingle.mockResolvedValueOnce(r));
  const eqAddress = jest.fn().mockReturnValue({ maybeSingle });
  const eqOwner = jest.fn().mockReturnValue({ eq: eqAddress });
  const select = jest.fn().mockReturnValue({ eq: eqOwner });
  return { select, eqOwner, eqAddress, maybeSingle };
}

/** Builds the `.insert().select().single()` chain used by the insert path. */
function mockInsertChain(result: { data: unknown; error: unknown }) {
  const single = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  return { insert, select, single };
}

/**
 * Builds the `.update().eq('owner_id', ...).eq('id', ...).select().single()`
 * chain used by updateExisting. Returns both `eq` calls so tests can assert
 * on the owner_id scoping (`eqOwner`) as well as the id scoping (`eqId`).
 */
function mockUpdateChain(result: { data: unknown; error: unknown }) {
  const single = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ single });
  const eqId = jest.fn().mockReturnValue({ select });
  const eqOwner = jest.fn().mockReturnValue({ eq: eqId });
  const update = jest.fn().mockReturnValue({ eq: eqOwner });
  return { update, eqOwner, eqId, select, single };
}

describe('AnalyzerPersistenceService save & share', () => {
  it('inserts a new row (with a generated share_token) when no existing row matches owner+address', async () => {
    const find = mockFindExistingChain({ data: null, error: null });
    const ins = mockInsertChain({
      data: { id: 'new-1', share_token: 'generated-token' },
      error: null,
    });
    const from = jest
      .fn()
      .mockReturnValue({ select: find.select, insert: ins.insert });
    const supabase: any = { from };
    const svc = new AnalyzerPersistenceService(supabase);

    const result = await svc.save('owner-1', baseDto);

    expect(result).toEqual({ id: 'new-1', share_token: 'generated-token' });
    expect(from).toHaveBeenCalledWith('deal_analyses');
    expect(find.eqOwner).toHaveBeenCalledWith('owner_id', 'owner-1');
    expect(find.eqAddress).toHaveBeenCalledWith('address_full', ADDRESS);
    expect(ins.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: 'owner-1',
        share_token: expect.any(String),
        address_full: ADDRESS,
        address_city: 'Austin',
        address_state: 'TX',
      }),
    );
  });

  it('never lets a dto-supplied owner_id/share_token win over the server-controlled values on insert', async () => {
    // `{ ...dto, owner_id, share_token }` (dto spread FIRST) is what makes
    // this true regardless of ValidationPipe's `whitelist: true` stripping
    // unknown DTO fields in production — this test simulates a caller that
    // bypasses that guarantee (e.g. a future non-whitelisted route, or a
    // raw object built by other backend code) to prove the ordering itself
    // is the defense, not just the pipe config.
    const find = mockFindExistingChain({ data: null, error: null });
    const ins = mockInsertChain({
      data: { id: 'new-1', share_token: 'server-token' },
      error: null,
    });
    const from = jest
      .fn()
      .mockReturnValue({ select: find.select, insert: ins.insert });
    const supabase: any = { from };
    const svc = new AnalyzerPersistenceService(supabase);
    const maliciousDto = {
      ...baseDto,
      owner_id: 'attacker-id',
      share_token: 'attacker-token',
    } as unknown as AnalysisSnapshotDto;

    await svc.save('owner-1', maliciousDto);

    const insertArg = ins.insert.mock.calls[0][0];
    expect(insertArg.owner_id).toBe('owner-1');
    expect(insertArg.share_token).not.toBe('attacker-token');
  });

  it('updates the existing row in place (same id/share_token, share_token not regenerated) when a row already exists', async () => {
    const find = mockFindExistingChain({
      data: { id: 'existing-1', share_token: 'original-token' },
      error: null,
    });
    const upd = mockUpdateChain({
      data: { id: 'existing-1', share_token: 'original-token' },
      error: null,
    });
    const insert = jest.fn();
    const from = jest
      .fn()
      .mockReturnValue({ select: find.select, update: upd.update, insert });
    const supabase: any = { from };
    const svc = new AnalyzerPersistenceService(supabase);

    const result = await svc.save('owner-1', baseDto);

    expect(result).toEqual({ id: 'existing-1', share_token: 'original-token' });
    expect(insert).not.toHaveBeenCalled();
    expect(upd.eqOwner).toHaveBeenCalledWith('owner_id', 'owner-1');
    expect(upd.eqId).toHaveBeenCalledWith('id', 'existing-1');
    const updateArg = upd.update.mock.calls[0][0];
    expect(updateArg).toEqual(
      expect.objectContaining({
        address_full: ADDRESS,
        updated_at: expect.any(String),
      }),
    );
    expect(updateArg).not.toHaveProperty('share_token');
  });

  it('falls back to update-in-place when the INSERT throws a 23505 unique-violation', async () => {
    const find = mockFindExistingChain(
      { data: null, error: null }, // pre-insert check: nothing yet
      { data: { id: 'raced-1', share_token: 'raced-token' }, error: null }, // post-conflict re-fetch
    );
    const ins = mockInsertChain({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
    });
    const upd = mockUpdateChain({
      data: { id: 'raced-1', share_token: 'raced-token' },
      error: null,
    });
    const from = jest.fn().mockReturnValue({
      select: find.select,
      insert: ins.insert,
      update: upd.update,
    });
    const supabase: any = { from };
    const svc = new AnalyzerPersistenceService(supabase);

    const result = await svc.save('owner-1', baseDto);

    expect(result).toEqual({ id: 'raced-1', share_token: 'raced-token' });
    expect(ins.insert).toHaveBeenCalledTimes(1);
    expect(find.maybeSingle).toHaveBeenCalledTimes(2);
    expect(upd.eqOwner).toHaveBeenCalledWith('owner_id', 'owner-1');
    expect(upd.eqId).toHaveBeenCalledWith('id', 'raced-1');
  });

  it('getShared returns first row from the get_shared_analysis RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ id: 'a1', label: 'shared' }],
      error: null,
    });
    const supabase: any = { rpc };
    const svc = new AnalyzerPersistenceService(supabase);

    const r = await svc.getShared('tok');

    expect(r).toEqual({ id: 'a1', label: 'shared' });
    expect(rpc).toHaveBeenCalledWith('get_shared_analysis', { p_token: 'tok' });
  });
});

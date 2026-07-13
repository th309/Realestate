import { PushSubscriptionsDataService } from './push-subscriptions.data';

/**
 * Builds a chainable Supabase mock scoped to what upsert()/evictOldestBeyondCap()
 * actually call: `.from('push_subscriptions').upsert(...)`, then
 * `.select('id').eq('user_id', ...).order('created_at', ...)`, then
 * (only when over cap) `.delete().in('id', ...)`.
 */
function createSupabaseMock(existingRowIds: string[]) {
  const upsertSpy = jest.fn().mockResolvedValue({ error: null });
  const deleteInSpy = jest.fn().mockResolvedValue({ error: null });
  const deleteSpy = jest.fn(() => ({ in: deleteInSpy }));
  const orderSpy = jest.fn().mockResolvedValue({
    data: existingRowIds.map((id) => ({ id })),
    error: null,
  });
  const eqSpy = jest.fn(() => ({ order: orderSpy }));
  const selectSpy = jest.fn(() => ({ eq: eqSpy }));

  const client = {
    from: jest.fn(() => ({
      upsert: upsertSpy,
      select: selectSpy,
      delete: deleteSpy,
    })),
  };

  return {
    client,
    upsertSpy,
    selectSpy,
    eqSpy,
    orderSpy,
    deleteSpy,
    deleteInSpy,
  };
}

describe('PushSubscriptionsDataService — per-user subscription cap', () => {
  it('does not evict when the user is at or under the 10-subscription cap', async () => {
    const existingIds = Array.from({ length: 10 }, (_, i) => `sub-${i}`);
    const mock = createSupabaseMock(existingIds);
    const service = new PushSubscriptionsDataService(mock.client as any);

    await service.upsert('user-1', 'https://push.example.com/new', 'p', 'a');

    expect(mock.upsertSpy).toHaveBeenCalledTimes(1);
    expect(mock.orderSpy).toHaveBeenCalledTimes(1); // cap check ran
    expect(mock.deleteSpy).not.toHaveBeenCalled(); // but nothing evicted
  });

  it('evicts the oldest rows beyond the 10-subscription cap, newest-first ordering', async () => {
    // order('created_at', {ascending:false}) → newest first. 12 rows means
    // rows[10] and rows[11] (the two oldest) must be evicted.
    const existingIds = Array.from({ length: 12 }, (_, i) => `sub-${i}`);
    const mock = createSupabaseMock(existingIds);
    const service = new PushSubscriptionsDataService(mock.client as any);

    await service.upsert('user-1', 'https://push.example.com/new', 'p', 'a');

    expect(mock.eqSpy).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mock.orderSpy).toHaveBeenCalled();
    expect(mock.deleteInSpy).toHaveBeenCalledWith('id', ['sub-10', 'sub-11']);
  });

  it('does not throw and still resolves if the cap-eviction lookup itself errors', async () => {
    const mock = createSupabaseMock([]);
    mock.orderSpy.mockResolvedValue({
      data: null,
      error: { message: 'db down' },
    });
    const service = new PushSubscriptionsDataService(mock.client as any);

    await expect(
      service.upsert('user-1', 'https://push.example.com/new', 'p', 'a'),
    ).resolves.toBeUndefined();
    expect(mock.deleteSpy).not.toHaveBeenCalled();
  });

  it('propagates an error from the upsert itself (does not swallow it)', async () => {
    const mock = createSupabaseMock([]);
    mock.upsertSpy.mockResolvedValue({
      error: { message: 'constraint violation' },
    });
    const service = new PushSubscriptionsDataService(mock.client as any);

    await expect(
      service.upsert('user-1', 'https://push.example.com/new', 'p', 'a'),
    ).rejects.toThrow('constraint violation');
    // Must not even attempt the cap check if the write itself failed.
    expect(mock.selectSpy).not.toHaveBeenCalled();
  });
});

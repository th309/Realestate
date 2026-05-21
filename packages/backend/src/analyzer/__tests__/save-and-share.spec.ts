import { AnalyzerPersistenceService } from '../analyzer.persistence.service';

/**
 * Unit tests for the save/share path of AnalyzerPersistenceService.
 *
 * Each test builds a fresh in-memory supabase mock that returns whatever
 * the test wants from `.single()` / `.rpc()`; the service is constructed
 * directly with the mocked supabase client (it's the only dep).
 */
describe('AnalyzerPersistenceService save & share', () => {
  let svc: AnalyzerPersistenceService;
  let supabase: any;

  beforeEach(() => {
    supabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'a1', share_token: 'tok' },
        error: null,
      }),
      rpc: jest.fn().mockResolvedValue({
        data: [{ id: 'a1', label: 'shared' }],
        error: null,
      }),
    };
    svc = new AnalyzerPersistenceService(supabase);
  });

  it('save returns id + share_token from supabase insert', async () => {
    const r = await svc.save('owner-1', {
      address_city: 'Austin',
      address_state: 'TX',
      input_snapshot: {},
      result_snapshot: {},
    });
    expect(r).toEqual({ id: 'a1', share_token: 'tok' });
    expect(supabase.from).toHaveBeenCalledWith('deal_analyses');
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: 'owner-1',
        share_token: expect.any(String),
        address_city: 'Austin',
        address_state: 'TX',
      }),
    );
  });

  it('getShared returns first row from the get_shared_analysis RPC', async () => {
    const r = await svc.getShared('tok');
    expect(r).toEqual({ id: 'a1', label: 'shared' });
    expect(supabase.rpc).toHaveBeenCalledWith('get_shared_analysis', {
      p_token: 'tok',
    });
  });
});

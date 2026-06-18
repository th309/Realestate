import { extractUsersFromTrials } from './behavioral-trigger.utils';

describe('extractUsersFromTrials', () => {
  it('extracts users from an object-shaped join', () => {
    const rows = [
      {
        user_id: 'u1',
        expires_at: '2026-07-01T00:00:00Z',
        user_profiles: { id: 'u1', email: 'a@test.com' },
      },
    ];
    expect(extractUsersFromTrials(rows)).toEqual([
      { id: 'u1', email: 'a@test.com' },
    ]);
  });

  it('extracts from an array-shaped join and skips rows missing email', () => {
    const rows = [
      {
        user_id: 'u2',
        expires_at: 'x',
        user_profiles: [{ id: 'u2', email: 'b@test.com' }],
      },
      { user_id: 'u3', expires_at: 'x', user_profiles: null },
    ];
    expect(extractUsersFromTrials(rows)).toEqual([
      { id: 'u2', email: 'b@test.com' },
    ]);
  });
});

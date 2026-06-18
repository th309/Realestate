// dev-walkthrough.service.spec.ts
import { DevWalkthroughService } from './dev-walkthrough.service';

describe('DevWalkthroughService.advanceToDay', () => {
  it('sets expires_at to (14 - toDay) days ahead at UTC noon and clears dedup', async () => {
    const updates: Record<string, any> = {};
    const deletes: string[] = [];
    const supabase = {
      from: (t: string) => ({
        update: (vals: any) => ({
          eq: () => {
            updates[t] = vals;
            return Promise.resolve({ error: null });
          },
        }),
        delete: () => ({
          eq: () => {
            deletes.push(t);
            return Promise.resolve({ error: null });
          },
        }),
      }),
    } as any;
    const svc = new DevWalkthroughService(
      supabase,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const res = await svc.advanceToDay('u1', 10);
    const expires = new Date(res.expires_at);
    const days = Math.round((expires.getTime() - Date.now()) / 86_400_000);
    expect(days).toBe(4);
    expect(deletes).toEqual(
      expect.arrayContaining(['email_log', 'email_triggers']),
    );
  });
});

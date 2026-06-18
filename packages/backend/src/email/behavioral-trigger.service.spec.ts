// behavioral-trigger.service.spec.ts
import { BehavioralTriggerService } from './behavioral-trigger.service';

function makeService(trialRows: any[], profileRows: any[]) {
  const sent: any[] = [];
  const fromSpy = jest.fn((table: string) => {
    if (table === 'user_trials') {
      // select('user_id, expires_at').is().is().gte().lt()  (no embed)
      return {
        select: () => ({
          is: () => ({
            is: () => ({
              gte: () => ({
                lt: () => Promise.resolve({ data: trialRows, error: null }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === 'user_profiles') {
      // select('id, email').in('id', userIds) — emails fetched in a 2nd query
      return {
        select: () => ({
          in: () => Promise.resolve({ data: profileRows, error: null }),
        }),
      };
    }
    if (table === 'email_triggers') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
          }),
        }),
        insert: (row: any) => {
          sent.push(row);
          return Promise.resolve({ data: null, error: null });
        },
      };
    }
    if (table === 'email_preferences') {
      return {
        select: () => ({
          in: () => ({ eq: () => Promise.resolve({ data: [] }) }),
        }),
      };
    }
    return {} as any;
  });
  const supabase = { from: fromSpy } as any;
  const emailService = { sendEmail: jest.fn().mockResolvedValue(true) } as any;
  const config = { get: () => 'https://app.test' } as any;
  const lock = {
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn(),
  } as any;
  const engagement = { processAll: jest.fn() } as any;
  const svc = new BehavioralTriggerService(
    supabase,
    emailService,
    config,
    lock,
    engagement,
  );
  return { svc, emailService, fromSpy };
}

describe('BehavioralTriggerService trial emails read user_trials', () => {
  it('queries user_trials, looks up the email, and sends the day-13 email', async () => {
    const { svc, emailService, fromSpy } = makeService(
      [{ user_id: 'u1', expires_at: '2026-07-01T12:00:00Z' }],
      [{ id: 'u1', email: 'a@test.com' }],
    );
    await svc.fireTrialDay13();
    expect(fromSpy).toHaveBeenCalledWith('user_trials');
    expect(fromSpy).toHaveBeenCalledWith('user_profiles');
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@test.com', emailType: 'trial_day_13' }),
    );
  });
});

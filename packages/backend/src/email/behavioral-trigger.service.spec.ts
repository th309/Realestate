// behavioral-trigger.service.spec.ts
import { BehavioralTriggerService } from './behavioral-trigger.service';

function makeService(trialRows: any[]) {
  const sent: any[] = [];
  const fromSpy = jest.fn((table: string) => {
    if (table === 'user_trials') {
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
  it('queries user_trials and sends the day-13 email to an active trial user', async () => {
    const { svc, emailService, fromSpy } = makeService([
      {
        user_id: 'u1',
        expires_at: '2026-07-01T12:00:00Z',
        user_profiles: { id: 'u1', email: 'a@test.com' },
      },
    ]);
    await svc.fireTrialDay13();
    expect(fromSpy).toHaveBeenCalledWith('user_trials');
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@test.com', emailType: 'trial_day_13' }),
    );
  });
});

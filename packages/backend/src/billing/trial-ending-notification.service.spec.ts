import { TrialEndingNotificationService } from './trial-ending-notification.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Covers the money-facing correctness of the trial_will_end notice:
 * the trialing/cancel guards, user resolution, and the insert-first dedupe
 * (which must not double-send under Stripe's at-least-once redelivery).
 */
describe('TrialEndingNotificationService', () => {
  let service: TrialEndingNotificationService;
  let client: {
    from: jest.Mock;
    select: jest.Mock;
    eq: jest.Mock;
    single: jest.Mock;
    insert: jest.Mock;
    delete: jest.Mock;
  };
  let emailService: { sendEmail: jest.Mock };

  const baseSub = (over: Record<string, unknown> = {}): Stripe.Subscription =>
    ({
      id: 'sub_x',
      status: 'trialing',
      cancel_at_period_end: false,
      cancel_at: null,
      customer: 'cus_x',
      metadata: { user_id: 'user-1' },
      trial_end: 1784667972,
      items: { data: [{ price: { unit_amount: 3900 } }] },
      ...over,
    }) as unknown as Stripe.Subscription;

  beforeEach(() => {
    client = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockReturnThis(),
    };
    emailService = { sendEmail: jest.fn().mockResolvedValue(true) };

    const supabase = {
      getClient: () => client,
    } as unknown as SupabaseService;
    const config = {
      get: jest.fn().mockReturnValue('https://propertyiq.app'),
    } as unknown as ConfigService;

    service = new TrialEndingNotificationService(
      supabase,
      emailService as unknown as EmailService,
      config,
    );
  });

  it('sends the notice for a genuinely trialing subscription', async () => {
    client.single.mockResolvedValueOnce({
      data: { email: 'jane@example.com' },
    });

    await service.handleTrialWillEnd(baseSub());

    // Claims the trigger BEFORE sending (idempotency).
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        trigger_name: 'trial_will_end:sub_x',
      }),
    );
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        emailType: 'trial_will_end',
      }),
    );
    expect(client.delete).not.toHaveBeenCalled();
  });

  it('skips when the subscription is no longer trialing', async () => {
    await service.handleTrialWillEnd(baseSub({ status: 'active' }));
    expect(client.insert).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('skips a trial that was cancelled (cancel_at_period_end) — no charge coming', async () => {
    await service.handleTrialWillEnd(baseSub({ cancel_at_period_end: true }));
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('skips a trial scheduled to cancel (cancel_at set)', async () => {
    await service.handleTrialWillEnd(baseSub({ cancel_at: 1784667972 }));
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('does not send when the dedupe claim conflicts (concurrent redelivery)', async () => {
    client.single.mockResolvedValueOnce({
      data: { email: 'jane@example.com' },
    });
    client.insert.mockResolvedValueOnce({ error: { code: '23505' } }); // unique violation

    await service.handleTrialWillEnd(baseSub());

    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  });

  it('resolves the user via stripe_customer_id when metadata has no user_id', async () => {
    client.single
      .mockResolvedValueOnce({ data: { id: 'user-from-cid' } }) // customer → id
      .mockResolvedValueOnce({ data: { email: 'cid@example.com' } }); // id → email

    await service.handleTrialWillEnd(baseSub({ metadata: {} }));

    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-from-cid' }),
    );
    expect(emailService.sendEmail).toHaveBeenCalled();
  });

  it('releases the claim when the email fails to send (so a retry can resend)', async () => {
    client.single.mockResolvedValueOnce({
      data: { email: 'jane@example.com' },
    });
    emailService.sendEmail.mockResolvedValueOnce(false);

    await service.handleTrialWillEnd(baseSub());

    expect(client.delete).toHaveBeenCalled();
  });
});

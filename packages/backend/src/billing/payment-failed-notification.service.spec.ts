import { PaymentFailedNotificationService } from './payment-failed-notification.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Covers the money-facing correctness of the payment_failed notice:
 * user resolution by Stripe customer id, and the insert-first dedupe
 * (which must not double-send under Stripe's at-least-once redelivery).
 */
describe('PaymentFailedNotificationService', () => {
  let service: PaymentFailedNotificationService;
  let client: {
    from: jest.Mock;
    select: jest.Mock;
    eq: jest.Mock;
    single: jest.Mock;
    insert: jest.Mock;
    delete: jest.Mock;
  };
  let emailService: { sendEmail: jest.Mock };

  const baseInvoice = (over: Record<string, unknown> = {}): Stripe.Invoice =>
    ({
      id: 'in_1',
      customer: 'cus_1',
      ...over,
    }) as unknown as Stripe.Invoice;

  beforeEach(() => {
    // Stateful insert: simulates the UNIQUE(user_id, trigger_name) constraint
    // on email_triggers so redelivery of the same invoice conflicts on the
    // second claim attempt, just like the real DB would.
    const claimedTriggers = new Set<string>();

    client = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn(async (row: { trigger_name: string }) => {
        if (claimedTriggers.has(row.trigger_name)) {
          return { error: { code: '23505' } };
        }
        claimedTriggers.add(row.trigger_name);
        return { error: null };
      }),
      delete: jest.fn().mockReturnThis(),
    };
    emailService = { sendEmail: jest.fn().mockResolvedValue(true) };

    const supabase = {
      getClient: () => client,
    } as unknown as SupabaseService;
    const config = {
      get: jest.fn().mockReturnValue('https://propertyiq.app'),
    } as unknown as ConfigService;

    service = new PaymentFailedNotificationService(
      supabase,
      emailService as unknown as EmailService,
      config,
    );
  });

  it('sends exactly one payment-failed email and is idempotent on redelivery', async () => {
    client.single.mockResolvedValue({
      data: { id: 'user-1', email: 'jane@example.com' },
    });

    const invoice = baseInvoice();
    await service.handlePaymentFailed(invoice);
    await service.handlePaymentFailed(invoice); // Stripe redelivery

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('claims the trigger before sending and emails the resolved profile', async () => {
    client.single.mockResolvedValueOnce({
      data: { id: 'user-1', email: 'jane@example.com' },
    });

    await service.handlePaymentFailed(baseInvoice());

    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        trigger_name: 'payment_failed:in_1',
      }),
    );
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        emailType: 'payment_failed',
      }),
    );
    expect(client.delete).not.toHaveBeenCalled();
  });

  it('does nothing when no profile is found for the customer', async () => {
    client.single.mockResolvedValueOnce({ data: null });

    await service.handlePaymentFailed(baseInvoice());

    expect(client.insert).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('does not send when the dedupe claim conflicts (concurrent redelivery)', async () => {
    client.single.mockResolvedValueOnce({
      data: { id: 'user-1', email: 'jane@example.com' },
    });
    client.insert.mockResolvedValueOnce({ error: { code: '23505' } });

    await service.handlePaymentFailed(baseInvoice());

    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  });

  it('releases the claim when the email fails to send (so a retry can resend)', async () => {
    client.single.mockResolvedValueOnce({
      data: { id: 'user-1', email: 'jane@example.com' },
    });
    emailService.sendEmail.mockResolvedValueOnce(false);

    await service.handlePaymentFailed(baseInvoice());

    expect(client.delete).toHaveBeenCalled();
  });
});

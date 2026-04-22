import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';

describe('EmailService attachments', () => {
  function buildService() {
    const insertSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: jest.fn().mockReturnValue({ insert: insertSpy }),
    } as unknown as SupabaseClient;

    const config = {
      get: (key: string) => {
        if (key === 'RESEND_API_KEY') return 'test-key';
        if (key === 'EMAIL_FROM') return 'PropertyIQ <noreply@test.com>';
        return undefined;
      },
    } as unknown as ConfigService;

    const svc = new EmailService(supabase, config);
    const sendSpy = jest
      .fn()
      .mockResolvedValue({ data: { id: 'test' }, error: null });
    (svc as unknown as { resend: { emails: { send: jest.Mock } } }).resend = {
      emails: { send: sendSpy },
    };
    return { svc, sendSpy };
  }

  it('passes attachments to Resend when provided', async () => {
    const { svc, sendSpy } = buildService();

    await svc.sendEmail({
      to: 'user@test.com',
      subject: 'Your Market Snapshot',
      emailType: 'lead_magnet_delivery',
      react: {
        type: 'div',
        props: {},
        children: 'body',
      } as unknown as React.ReactElement,
      attachments: [{ filename: 'snapshot.pdf', path: '/tmp/snapshot.pdf' }],
    });

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ filename: 'snapshot.pdf', path: '/tmp/snapshot.pdf' }],
      }),
    );
  });

  it('omits attachments field when none are provided', async () => {
    const { svc, sendSpy } = buildService();

    await svc.sendEmail({
      to: 'user@test.com',
      subject: 'No attachments',
      emailType: 'generic',
      html: '<p>hi</p>',
    });

    const payload = sendSpy.mock.calls[0][0];
    expect(payload.attachments).toBeUndefined();
  });
});

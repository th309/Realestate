import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  GenerateLeadMagnetHandler,
  GenerateLeadMagnetJob,
} from './generate-lead-magnet.handler';
import { LeadMagnetRenderer } from '../../drivers/lead-magnet-renderer.interface';
import { ContentDataService } from '../../data/content-data.service';
import { EmailService } from '../../../email/email.service';
import { SupabaseService } from '../../../supabase/supabase.service';

describe('GenerateLeadMagnetHandler', () => {
  const geoCleveland = {
    geography: 'metro' as const,
    id: '17460',
    canonical_name: 'Cleveland, OH',
  };

  const baseJob: GenerateLeadMagnetJob = {
    userId: '11111111-1111-1111-1111-111111111111',
    userEmail: 'buyer@example.com',
    userName: 'Buyer Test',
    magnetKind: 'market_snapshot_pdf',
    resolvedGeo: geoCleveland,
  };

  function buildHarness(overrides?: {
    sendEmailReturns?: boolean;
    magnetRow?: Record<string, unknown> | null;
    dataMethodName?: string;
  }) {
    const magnetRow =
      overrides?.magnetRow === undefined
        ? {
            kind: 'market_snapshot_pdf',
            display_name: 'Market Snapshot',
            template_path: 'market_snapshot.html.ejs',
            data_method: overrides?.dataMethodName ?? 'getMarketSnapshot',
          }
        : overrides.magnetRow;

    const magnetSelect = jest.fn().mockResolvedValue({ data: magnetRow });
    const assetInsert = jest
      .fn()
      .mockResolvedValue({ data: { id: 'asset-1' } });
    const deliveryUpdateEq2 = jest.fn().mockResolvedValue({ error: null });
    const deliveryUpdateEq1 = jest
      .fn()
      .mockReturnValue({ eq: deliveryUpdateEq2 });

    const supabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'lead_magnet_definitions') {
          return {
            select: () => ({
              eq: () => ({ single: magnetSelect }),
            }),
          };
        }
        if (table === 'content_assets') {
          return {
            insert: () => ({
              select: () => ({ single: assetInsert }),
            }),
          };
        }
        if (table === 'lead_magnet_deliveries') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
            update: () => ({ eq: deliveryUpdateEq1 }),
          };
        }
        return {};
      }),
      storage: {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({ error: null }),
        }),
      },
    };

    const supabase = {
      getClient: () => supabaseClient,
    } as unknown as SupabaseService;

    const rendererRender = jest
      .fn()
      .mockImplementation(async ({ outputPath }: { outputPath: string }) => {
        writeFileSync(outputPath, 'fake-pdf-content');
      });
    const renderer = {
      render: rendererRender,
    } as unknown as LeadMagnetRenderer;

    const getMarketSnapshot = jest
      .fn()
      .mockResolvedValue({ score: 72, confidence: 'A' });
    const data = {
      getMarketSnapshot,
    } as unknown as ContentDataService;

    const sendEmail = jest
      .fn()
      .mockResolvedValue(overrides?.sendEmailReturns ?? true);
    const email = { sendEmail } as unknown as EmailService;

    const handler = new GenerateLeadMagnetHandler(
      renderer,
      data,
      email,
      supabase,
    );

    return {
      handler,
      sendEmail,
      rendererRender,
      getMarketSnapshot,
      deliveryUpdateEq1,
      deliveryUpdateEq2,
    };
  }

  afterEach(() => {
    const prefix = join(tmpdir(), `magnet-${baseJob.userId}`);
    for (const suffix of ['.pdf']) {
      const candidate = `${prefix}${suffix}`;
      if (existsSync(candidate)) unlinkSync(candidate);
    }
  });

  it('sends the email with the PDF as an attachment using the tmp output path', async () => {
    const { handler, sendEmail } = buildHarness();

    await handler.handle(baseJob);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const payload = sendEmail.mock.calls[0][0];
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].filename).toMatch(
      /^market_snapshot_pdf-Cleveland_OH\.pdf$/,
    );
    expect(payload.attachments[0].content).toBeInstanceOf(Buffer);
    expect((payload.attachments[0].content as Buffer).length).toBeGreaterThan(
      0,
    );
  });

  it('marks emailType as lead_magnet_delivery and addresses the user', async () => {
    const { handler, sendEmail } = buildHarness();

    await handler.handle(baseJob);

    const payload = sendEmail.mock.calls[0][0];
    expect(payload.emailType).toBe('lead_magnet_delivery');
    expect(payload.to).toBe(baseJob.userEmail);
    expect(payload.subject).toContain('Market Snapshot');
    expect(payload.subject).toContain('Cleveland, OH');
    expect(payload.html).toContain(baseJob.userName);
    expect(payload.html).toContain('attached');
  });

  it('does not reference the dashboard-only fallback URL that the stale pre-attachment code used', async () => {
    const { handler, sendEmail } = buildHarness();

    await handler.handle(baseJob);

    const payload = sendEmail.mock.calls[0][0];
    expect(payload.html).not.toMatch(/is ready\. View it in your dashboard/);
  });

  it('sanitizes canonical_name into a safe attachment filename', async () => {
    const { handler, sendEmail } = buildHarness();

    await handler.handle({
      ...baseJob,
      resolvedGeo: {
        ...geoCleveland,
        canonical_name: 'New York-Newark-Jersey City, NY/NJ/PA',
      },
    });

    const payload = sendEmail.mock.calls[0][0];
    expect(payload.attachments[0].filename).toBe(
      'market_snapshot_pdf-New_York-Newark-Jersey_City_NY_NJ_PA.pdf',
    );
  });

  it('throws when the email send fails and does NOT mark the delivery as emailed', async () => {
    const { handler, deliveryUpdateEq2 } = buildHarness({
      sendEmailReturns: false,
    });

    await expect(handler.handle(baseJob)).rejects.toThrow(
      /lead-magnet email delivery failed/,
    );
    expect(deliveryUpdateEq2).not.toHaveBeenCalled();
  });

  it('marks the delivery as emailed after a successful send', async () => {
    const { handler, deliveryUpdateEq2 } = buildHarness();

    await handler.handle(baseJob);

    expect(deliveryUpdateEq2).toHaveBeenCalledTimes(1);
  });

  it('throws when the magnet kind is not in lead_magnet_definitions', async () => {
    const { handler, rendererRender, sendEmail } = buildHarness({
      magnetRow: null,
    });

    await expect(handler.handle(baseJob)).rejects.toThrow(
      /magnet market_snapshot_pdf not found/,
    );
    expect(rendererRender).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('throws when the magnet definition points at a data method the service does not expose', async () => {
    const { handler, sendEmail } = buildHarness({
      dataMethodName: 'getSomeMethodThatDoesNotExist',
    });

    await expect(handler.handle(baseJob)).rejects.toThrow(
      /ContentDataService has no method named getSomeMethodThatDoesNotExist/,
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('passes the resolvedGeo through to the configured data method', async () => {
    const { handler, getMarketSnapshot } = buildHarness();

    await handler.handle(baseJob);

    expect(getMarketSnapshot).toHaveBeenCalledWith(geoCleveland);
  });

  it('renders the PDF before uploading and emailing', async () => {
    const calls: string[] = [];
    const { handler, rendererRender, sendEmail } = buildHarness();
    rendererRender.mockImplementation(
      async ({ outputPath }: { outputPath: string }) => {
        calls.push('render');
        writeFileSync(outputPath, 'pdf');
      },
    );
    sendEmail.mockImplementation(async () => {
      calls.push('email');
      return true;
    });

    await handler.handle(baseJob);

    expect(calls).toEqual(['render', 'email']);
  });
});

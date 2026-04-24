import { ContentRunsService } from './content-runs.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RunOrchestratorService } from './orchestrator/run-orchestrator.service';
import { QueueService } from './orchestrator/queue.service';
import { ContentDataService } from './data/content-data.service';

describe('ContentRunsService.triggerTestMagnet', () => {
  function buildHarness(overrides?: {
    authUser?: {
      id?: string;
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    } | null;
    authError?: { message: string } | null;
    matches?: Array<{
      geography: 'metro' | 'state' | 'county' | 'zip';
      id: string;
      canonical_name: string;
    }>;
    queueJobId?: string;
  }) {
    const adminUserId = '11111111-1111-1111-1111-111111111111';

    const authUser =
      overrides?.authUser === undefined
        ? {
            id: adminUserId,
            email: 'admin@propertyiq.app',
            user_metadata: { full_name: 'Admin Person' },
          }
        : overrides.authUser;

    const getUserById = jest.fn().mockResolvedValue({
      data: authUser ? { user: authUser } : { user: null },
      error: overrides?.authError ?? null,
    });

    const supabaseClient = {
      auth: {
        admin: { getUserById },
      },
    };

    const supabase = {
      getClient: () => supabaseClient,
    } as unknown as SupabaseService;

    const orchestrator = {} as unknown as RunOrchestratorService;

    const queueSend = jest
      .fn()
      .mockResolvedValue(overrides?.queueJobId ?? 'job-abc');
    const queueService = { send: queueSend } as unknown as QueueService;

    const resolveMarket = jest.fn().mockResolvedValue(
      overrides?.matches ?? [
        {
          geography: 'metro' as const,
          id: '17460',
          canonical_name: 'Cleveland, OH',
        },
      ],
    );
    const contentData = { resolveMarket } as unknown as ContentDataService;

    const service = new ContentRunsService(
      supabase,
      orchestrator,
      queueService,
      contentData,
    );

    return {
      service,
      adminUserId,
      queueSend,
      resolveMarket,
      getUserById,
    };
  }

  it('resolves the market, enqueues render-pdf, and returns jobId/match/recipientEmail', async () => {
    const { service, adminUserId, queueSend } = buildHarness();

    const result = await service.triggerTestMagnet(adminUserId, {
      marketQuery: 'Cleveland, OH',
    });

    expect(result.jobId).toBe('job-abc');
    expect(result.match).toEqual({
      geography: 'metro',
      id: '17460',
      canonical_name: 'Cleveland, OH',
    });
    expect(result.recipientEmail).toBe('admin@propertyiq.app');
    expect(queueSend).toHaveBeenCalledTimes(1);
    expect(queueSend.mock.calls[0][0]).toBe('render-pdf');
  });

  it("uses the admin user's own email when no override is provided", async () => {
    const { service, adminUserId, queueSend } = buildHarness({
      authUser: {
        id: 'admin-id',
        email: 'admin@example.com',
        user_metadata: {},
      },
    });

    const result = await service.triggerTestMagnet(adminUserId, {
      marketQuery: 'Austin, TX',
    });

    expect(result.recipientEmail).toBe('admin@example.com');
    const job = queueSend.mock.calls[0][1];
    expect(job.userEmail).toBe('admin@example.com');
  });

  it('uses recipientEmailOverride when provided, even if admin has an email', async () => {
    const { service, adminUserId, queueSend } = buildHarness();

    const result = await service.triggerTestMagnet(adminUserId, {
      marketQuery: 'Cleveland, OH',
      recipientEmailOverride: 'qa@propertyiq.app',
    });

    expect(result.recipientEmail).toBe('qa@propertyiq.app');
    expect(queueSend.mock.calls[0][1].userEmail).toBe('qa@propertyiq.app');
  });

  it('throws when no geography matches the market query', async () => {
    const { service, adminUserId } = buildHarness({ matches: [] });

    await expect(
      service.triggerTestMagnet(adminUserId, {
        marketQuery: 'NoSuchPlace, ZZ',
      }),
    ).rejects.toThrow(/no geography match for "NoSuchPlace, ZZ"/);
  });

  it('throws when the admin user is not found in auth.users', async () => {
    const { service, adminUserId } = buildHarness({
      authUser: null,
      authError: { message: 'user not found' },
    });

    await expect(
      service.triggerTestMagnet(adminUserId, {
        marketQuery: 'Cleveland, OH',
      }),
    ).rejects.toThrow(/admin user .* not found in auth.users/);
  });

  it('throws when the admin user has no email and no override is provided', async () => {
    const { service, adminUserId } = buildHarness({
      authUser: {
        id: 'admin-id',
        email: null,
        user_metadata: {},
      },
    });

    await expect(
      service.triggerTestMagnet(adminUserId, {
        marketQuery: 'Cleveland, OH',
      }),
    ).rejects.toThrow(/no recipient email/);
  });

  it('falls back to email-local-part as the user name when metadata has no name', async () => {
    const { service, adminUserId, queueSend } = buildHarness({
      authUser: {
        id: 'admin-id',
        email: 'jdoe@propertyiq.app',
        user_metadata: {},
      },
    });

    await service.triggerTestMagnet(adminUserId, {
      marketQuery: 'Cleveland, OH',
    });

    expect(queueSend.mock.calls[0][1].userName).toBe('jdoe');
  });

  it('uses user_metadata.full_name when present', async () => {
    const { service, adminUserId, queueSend } = buildHarness({
      authUser: {
        id: 'admin-id',
        email: 'jdoe@propertyiq.app',
        user_metadata: { full_name: 'Jane Doe' },
      },
    });

    await service.triggerTestMagnet(adminUserId, {
      marketQuery: 'Cleveland, OH',
    });

    expect(queueSend.mock.calls[0][1].userName).toBe('Jane Doe');
  });

  it('falls back to user_metadata.name when full_name is absent', async () => {
    const { service, adminUserId, queueSend } = buildHarness({
      authUser: {
        id: 'admin-id',
        email: 'jdoe@propertyiq.app',
        user_metadata: { name: 'Jay Doe' },
      },
    });

    await service.triggerTestMagnet(adminUserId, {
      marketQuery: 'Cleveland, OH',
    });

    expect(queueSend.mock.calls[0][1].userName).toBe('Jay Doe');
  });

  it('defaults magnetKind to market_snapshot_pdf when none is provided', async () => {
    const { service, adminUserId, queueSend } = buildHarness();

    await service.triggerTestMagnet(adminUserId, {
      marketQuery: 'Cleveland, OH',
    });

    expect(queueSend.mock.calls[0][1].magnetKind).toBe('market_snapshot_pdf');
  });

  it('passes adminUserId through as the job userId', async () => {
    const { service, queueSend } = buildHarness();

    await service.triggerTestMagnet('11111111-aaaa-bbbb-cccc-222222222222', {
      marketQuery: 'Cleveland, OH',
    });

    expect(queueSend.mock.calls[0][1].userId).toBe(
      '11111111-aaaa-bbbb-cccc-222222222222',
    );
  });

  it('uses the first geography match when resolveMarket returns multiple', async () => {
    const { service, adminUserId, queueSend } = buildHarness({
      matches: [
        {
          geography: 'metro',
          id: '11111',
          canonical_name: 'First Match, US',
        },
        {
          geography: 'metro',
          id: '22222',
          canonical_name: 'Second Match, US',
        },
      ],
    });

    const result = await service.triggerTestMagnet(adminUserId, {
      marketQuery: 'something',
    });

    expect(result.match.id).toBe('11111');
    expect(queueSend.mock.calls[0][1].resolvedGeo.id).toBe('11111');
  });
});

import { ConflictException } from '@nestjs/common';
import { ContentRunsService } from './content-runs.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RunOrchestratorService } from './orchestrator/run-orchestrator.service';
import { QueueService } from './orchestrator/queue.service';
import { ContentDataService } from './data/content-data.service';
import { RankingResolverService } from './ranking/ranking-resolver.service';
import { CostCapService } from './auto-ideation/cost-cap.service';

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

    const rankingResolver = {
      resolve: jest.fn(),
    } as unknown as RankingResolverService;

    const service = new ContentRunsService(
      supabase,
      orchestrator,
      queueService,
      contentData,
      rankingResolver,
      {
        canEnqueue: jest.fn().mockResolvedValue({
          allowed: true,
          remainingUsd: 100,
          usdSpent: 0,
          usdCap: 100,
        }),
        canEnqueueFormat: jest
          .fn()
          .mockResolvedValue({ allowed: true, count: 0, cap: 100 }),
        incrementFormatCount: jest.fn().mockResolvedValue(undefined),
      } as unknown as CostCapService,
    );

    return {
      service,
      adminUserId,
      queueSend,
      resolveMarket,
      getUserById,
      rankingResolver,
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

describe('ContentRunsService.createRun — ranking drift check', () => {
  const SUBMITTED_MARKET = {
    rank: 1,
    region_id: '12345',
    region_name: 'Austin, TX',
    state: 'TX',
    value: 100,
    value_formatted: '100',
  };

  const RANKING_PARAMS = {
    format: 'top_10_ranking' as const,
    metric: { id: 'piq_score' },
    scope: { type: 'national' as const, id: null },
    geo_level: 'metro' as const,
    resolved_markets: [SUBMITTED_MARKET],
  };

  function buildDriftHarness() {
    const rankingResolver = {
      resolve: jest.fn(),
    } as unknown as RankingResolverService;

    // Supabase client that returns "no existing run" on idempotency check.
    // Remaining calls (format_templates, content_runs insert) are not reached
    // in drift-throw tests, so we only stub what we need.
    const supabaseClient = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };

    const supabase = {
      getClient: () => supabaseClient,
    } as unknown as SupabaseService;

    const orchestrator = {} as unknown as RunOrchestratorService;
    const queueService = { send: jest.fn() } as unknown as QueueService;
    const contentData = {
      resolveMarket: jest.fn(),
    } as unknown as ContentDataService;

    const service = new ContentRunsService(
      supabase,
      orchestrator,
      queueService,
      contentData,
      rankingResolver,
      {
        canEnqueue: jest.fn().mockResolvedValue({
          allowed: true,
          remainingUsd: 100,
          usdSpent: 0,
          usdCap: 100,
        }),
        canEnqueueFormat: jest
          .fn()
          .mockResolvedValue({ allowed: true, count: 0, cap: 100 }),
        incrementFormatCount: jest.fn().mockResolvedValue(undefined),
      } as unknown as CostCapService,
    );

    return { service, rankingResolver };
  }

  it('throws ConflictException when resolved_markets do not match fresh resolve', async () => {
    const { service, rankingResolver } = buildDriftHarness();

    (rankingResolver.resolve as jest.Mock).mockResolvedValue({
      rankings: [
        {
          rank: 1,
          region_id: '99999',
          region_name: 'Different City, NY',
          state: 'NY',
          value: 100,
          value_formatted: '100',
        },
      ],
      insufficient_data: false,
    });

    await expect(
      service.createRun({
        format: 'top_10_ranking',
        marketQuery: 'Top 10 metros by PIQ Score',
        idempotencyKey: '00000000-0000-0000-0000-000000000001',
        rankingParams: RANKING_PARAMS,
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('drift ConflictException carries data_drift error code', async () => {
    const { service, rankingResolver } = buildDriftHarness();

    (rankingResolver.resolve as jest.Mock).mockResolvedValue({
      rankings: [
        {
          rank: 1,
          region_id: '99999',
          region_name: 'Different City, NY',
          state: 'NY',
          value: 100,
          value_formatted: '100',
        },
      ],
      insufficient_data: false,
    });

    let caught: ConflictException | undefined;
    try {
      await service.createRun({
        format: 'top_10_ranking',
        marketQuery: 'Top 10 metros by PIQ Score',
        idempotencyKey: '00000000-0000-0000-0000-000000000002',
        rankingParams: RANKING_PARAMS,
      } as any);
    } catch (e) {
      caught = e as ConflictException;
    }

    expect(caught).toBeInstanceOf(ConflictException);
    expect((caught!.getResponse() as any).error).toBe('data_drift');
  });

  it('skips drift check when rankingParams is absent on a ranking format', async () => {
    const { service, rankingResolver } = buildDriftHarness();

    // rankingParams omitted — resolver must NOT be called
    // createRun will then fail on format_templates lookup (no mock), but that's
    // beyond our test boundary; we only care that resolve was never invoked.
    (rankingResolver.resolve as jest.Mock).mockResolvedValue({ rankings: [] });

    try {
      await service.createRun({
        format: 'top_10_ranking',
        marketQuery: 'Top 10 metros by PIQ Score',
        idempotencyKey: '00000000-0000-0000-0000-000000000003',
        // no rankingParams
      } as any);
    } catch {
      // expected — no format_templates mock
    }

    expect(rankingResolver.resolve).not.toHaveBeenCalled();
  });
});

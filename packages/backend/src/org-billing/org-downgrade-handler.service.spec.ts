import { Test, TestingModule } from '@nestjs/testing';
import { OrgDowngradeHandlerService } from './org-downgrade-handler.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

describe('OrgDowngradeHandlerService — preserves personal tier (P2-Y fix)', () => {
  let service: OrgDowngradeHandlerService;
  const auditService = { log: jest.fn() };

  // Record all user_profiles.update() calls so we can assert what was written.
  const profileUpdateCalls: any[] = [];
  const memberIds = ['member-1', 'member-2'];

  function buildSupabaseMock() {
    return {
      from: jest.fn((table: string) => {
        if (table === 'organizations') {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'org-1', name: 'Acme', owner_id: 'owner-id' },
            }),
          };
        }
        if (table === 'organization_members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockResolvedValue({
              data: memberIds.map((id) => ({ user_id: id })),
            }),
            delete: jest.fn().mockReturnThis(),
          };
        }
        if (table === 'user_profiles') {
          return {
            update: jest.fn((payload: any) => {
              profileUpdateCalls.push(payload);
              return {
                eq: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
              };
            }),
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: memberIds.map((id) => ({
                email: `${id}@test.com`,
                full_name: id,
              })),
            }),
          };
        }
        return {};
      }),
    } as any;
  }

  beforeEach(async () => {
    profileUpdateCalls.length = 0;
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OrgDowngradeHandlerService,
        { provide: SUPABASE_CLIENT, useValue: buildSupabaseMock() },
        { provide: OrgAuditService, useValue: auditService },
      ],
    }).compile();

    service = moduleRef.get(OrgDowngradeHandlerService);
  });

  it('does NOT write subscription_tier on any user_profiles update', async () => {
    await service.handleDowngrade('org-1', 'free');
    for (const payload of profileUpdateCalls) {
      expect(payload).not.toHaveProperty('subscription_tier');
    }
  });

  it('still clears organization_id and organization_role on non-owner members', async () => {
    await service.handleDowngrade('org-1', 'free');
    const memberClear = profileUpdateCalls.find(
      (p) => p.organization_id === null && p.organization_role === null,
    );
    expect(memberClear).toBeDefined();
  });

  it('does NOT touch the owner profile at all (no update scoped to owner-only)', async () => {
    await service.handleDowngrade('org-1', 'free');
    // Prior to fix: a separate update block wrote subscription_tier: newTier
    // for the owner. Assert no payload contains subscription_tier at all.
    expect(profileUpdateCalls.every((p) => !('subscription_tier' in p))).toBe(
      true,
    );
  });
});

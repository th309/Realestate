import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MembersService } from './members.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { MemberInviteService } from './member-invite.service';
import { McpEntitlementsInvalidator } from '../entitlements/mcp-entitlements-invalidator.service';

describe('MembersService.removeMember — MCP cache invalidation', () => {
  let service: MembersService;

  const invalidator = {
    invalidate: jest.fn().mockResolvedValue(undefined),
    invalidateOrgMembers: jest.fn().mockResolvedValue(undefined),
  };

  const auditMock = { log: jest.fn().mockResolvedValue(undefined) };
  const memberInviteMock = {
    inviteMember: jest.fn().mockResolvedValue(undefined),
  };

  // Terminal call mocks
  const memberSingleMock = jest.fn(); // organization_members select → single() (target lookup)
  const adminCountMock = jest.fn(); // organization_members select(count) → (admin check)
  const memberDeleteEqMock = jest.fn(); // organization_members delete → eq(org) → eq(user)
  const profileUpdateEqMock = jest.fn(); // user_profiles update → eq(userId)

  function buildSupabaseMock() {
    return {
      from: jest.fn((table: string) => {
        if (table === 'organization_members') {
          return {
            select: jest.fn((fields: string, opts?: any) => {
              if (opts?.count === 'exact') {
                // Admin count query
                return {
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                      eq: adminCountMock,
                    }),
                  }),
                };
              }
              // Target member lookup: select('role').eq(org).eq(user).eq(status).single()
              return {
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({ single: memberSingleMock }),
                  }),
                }),
              };
            }),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ eq: memberDeleteEqMock }),
            }),
          };
        }

        if (table === 'user_profiles') {
          return {
            update: jest.fn().mockReturnValue({ eq: profileUpdateEqMock }),
          };
        }

        return {};
      }),
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const supabaseClientMock = buildSupabaseMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: McpEntitlementsInvalidator, useValue: invalidator },
        { provide: SUPABASE_CLIENT, useValue: supabaseClientMock },
        { provide: OrgAuditService, useValue: auditMock },
        { provide: MemberInviteService, useValue: memberInviteMock },
      ],
    }).compile();

    service = moduleRef.get(MembersService);
  });

  it('removeMember fires invalidate([userId]) on success', async () => {
    // Target member found with role 'member' (not admin — skip last-admin check)
    memberSingleMock.mockResolvedValueOnce({
      data: { role: 'member' },
      error: null,
    });
    // Delete succeeds
    memberDeleteEqMock.mockResolvedValueOnce({ error: null });
    // Profile update succeeds
    profileUpdateEqMock.mockResolvedValueOnce({ error: null });

    await service.removeMember('org-1', 'user-42', 'actor-id');

    expect(invalidator.invalidate).toHaveBeenCalledTimes(1);
    expect(invalidator.invalidate).toHaveBeenCalledWith(['user-42']);
  });

  it('removeMember does NOT fire invalidate when the delete fails', async () => {
    // Target member found
    memberSingleMock.mockResolvedValueOnce({
      data: { role: 'member' },
      error: null,
    });
    // Delete fails
    memberDeleteEqMock.mockResolvedValueOnce({
      error: { message: 'db error' },
    });

    await expect(
      service.removeMember('org-1', 'user-42', 'actor-id'),
    ).rejects.toThrow('Failed to remove member');
    expect(invalidator.invalidate).not.toHaveBeenCalled();
  });

  it('removeMember does NOT fire invalidate when target member is not found', async () => {
    // Target member not found
    memberSingleMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.removeMember('org-1', 'user-42', 'actor-id'),
    ).rejects.toThrow(/not found/i);
    expect(invalidator.invalidate).not.toHaveBeenCalled();
  });
});

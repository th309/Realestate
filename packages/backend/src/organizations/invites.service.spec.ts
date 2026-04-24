import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { McpEntitlementsInvalidator } from '../entitlements/mcp-entitlements-invalidator.service';

describe('InvitesService — MCP cache invalidation', () => {
  let service: InvitesService;

  const invalidator = {
    invalidate: jest.fn().mockResolvedValue(undefined),
    invalidateOrgMembers: jest.fn().mockResolvedValue(undefined),
  };

  const auditMock = { log: jest.fn().mockResolvedValue(undefined) };

  // Shared invite payload returned by organization_invites select.
  const pendingInviteRow = {
    id: 'invite-1',
    email: 'user@example.com',
    role: 'member',
    status: 'pending',
    expires_at: new Date(Date.now() + 86400_000).toISOString(),
    organization_id: 'org-1',
    organizations: { name: 'Acme', slug: 'acme' },
  };

  // Terminal call mocks — controlled per test via mockResolvedValueOnce
  const inviteSingleMock = jest.fn(); // organization_invites select → single()
  const inviteUpdateEqMock = jest.fn(); // organization_invites update → eq()
  const profileMaybeSingleMock = jest.fn(); // user_profiles select('id').eq(email) → maybeSingle()
  const profileEmailSingleMock = jest.fn(); // user_profiles select('email').eq(userId) → single()
  const profileUpdateEqMock = jest.fn(); // user_profiles update → eq()
  const membersMaybeSingleMock = jest.fn(); // organization_members select → in() → maybeSingle()
  const membersInsertMock = jest.fn();
  const membersDeleteEqUserMock = jest.fn(); // rollback delete → eq(org) → eq(user)

  /**
   * Build a fresh supabase client mock. `user_profiles` is called with three
   * different chain shapes, so we discriminate by the `select()` field argument.
   */
  function buildSupabaseMock() {
    return {
      from: jest.fn((table: string) => {
        if (table === 'organization_invites') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ single: inviteSingleMock }),
            }),
            update: jest.fn().mockReturnValue({ eq: inviteUpdateEqMock }),
          };
        }

        if (table === 'user_profiles') {
          return {
            // getInviteByToken:   select('id').eq(email).maybeSingle()
            // acceptInvite check: select('email').eq(userId).single()
            select: jest.fn((fields: string) => {
              if (fields === 'id') {
                // called from getInviteByToken
                return {
                  eq: jest.fn().mockReturnValue({
                    maybeSingle: profileMaybeSingleMock,
                  }),
                };
              }
              // fields === 'email' — called from acceptInvite email verification
              return {
                eq: jest
                  .fn()
                  .mockReturnValue({ single: profileEmailSingleMock }),
              };
            }),
            update: jest.fn().mockReturnValue({ eq: profileUpdateEqMock }),
          };
        }

        if (table === 'organization_members') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                in: jest
                  .fn()
                  .mockReturnValue({ maybeSingle: membersMaybeSingleMock }),
              }),
            }),
            insert: membersInsertMock,
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ eq: membersDeleteEqUserMock }),
            }),
          };
        }

        return {};
      }),
    };
  }

  /** Configures all mocks for the full happy path. */
  function setupHappyPath() {
    // getInviteByToken: org_invites select → single
    inviteSingleMock.mockResolvedValueOnce({
      data: pendingInviteRow,
      error: null,
    });
    // getInviteByToken: user_profiles select('id') → maybeSingle (userExists check)
    profileMaybeSingleMock.mockResolvedValueOnce({ data: null });

    // acceptInvite: user_profiles select('email') → single (email match)
    profileEmailSingleMock.mockResolvedValueOnce({
      data: { email: 'user@example.com' },
    });

    // acceptInvite: org_members select → maybeSingle (existing membership)
    membersMaybeSingleMock.mockResolvedValueOnce({ data: null });

    // acceptInvite: org_members insert (create membership)
    membersInsertMock.mockResolvedValueOnce({ error: null });

    // try block: invite update → eq
    inviteUpdateEqMock.mockResolvedValueOnce({ error: null });

    // try block: user_profiles update → eq
    profileUpdateEqMock.mockResolvedValueOnce({ error: null });
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const supabaseClientMock = buildSupabaseMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InvitesService,
        { provide: McpEntitlementsInvalidator, useValue: invalidator },
        { provide: SUPABASE_CLIENT, useValue: supabaseClientMock },
        { provide: OrgAuditService, useValue: auditMock },
      ],
    }).compile();

    service = moduleRef.get(InvitesService);
  });

  it('acceptInvite fires invalidate([userId]) on successful join', async () => {
    setupHappyPath();

    const slug = await service.acceptInvite('valid-token', 'user-123');

    expect(slug).toBe('acme');
    expect(invalidator.invalidate).toHaveBeenCalledTimes(1);
    expect(invalidator.invalidate).toHaveBeenCalledWith(['user-123']);
  });

  it('acceptInvite does NOT fire invalidate when the membership insert fails', async () => {
    // getInviteByToken
    inviteSingleMock.mockResolvedValueOnce({
      data: pendingInviteRow,
      error: null,
    });
    profileMaybeSingleMock.mockResolvedValueOnce({ data: null });

    // email check
    profileEmailSingleMock.mockResolvedValueOnce({
      data: { email: 'user@example.com' },
    });

    // no existing membership
    membersMaybeSingleMock.mockResolvedValueOnce({ data: null });

    // membership insert fails
    membersInsertMock.mockResolvedValueOnce({
      error: { message: 'duplicate key value violates unique constraint' },
    });

    await expect(
      service.acceptInvite('valid-token', 'user-123'),
    ).rejects.toThrow(BadRequestException);

    expect(invalidator.invalidate).not.toHaveBeenCalled();
  });

  it('acceptInvite does NOT fire invalidate when the post-insert try block fails (rollback path)', async () => {
    // getInviteByToken
    inviteSingleMock.mockResolvedValueOnce({
      data: pendingInviteRow,
      error: null,
    });
    profileMaybeSingleMock.mockResolvedValueOnce({ data: null });

    // email check
    profileEmailSingleMock.mockResolvedValueOnce({
      data: { email: 'user@example.com' },
    });

    // no existing membership
    membersMaybeSingleMock.mockResolvedValueOnce({ data: null });

    // membership insert succeeds
    membersInsertMock.mockResolvedValueOnce({ error: null });

    // invite update inside try block throws → triggers rollback catch
    inviteUpdateEqMock.mockRejectedValueOnce(new Error('DB write failure'));

    // rollback delete resolves cleanly
    membersDeleteEqUserMock.mockResolvedValueOnce({ error: null });

    await expect(
      service.acceptInvite('valid-token', 'user-123'),
    ).rejects.toThrow(BadRequestException);

    expect(invalidator.invalidate).not.toHaveBeenCalled();
  });
});

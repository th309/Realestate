import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { OrgSlugService } from './org-slug.service';

describe('OrganizationsService.create', () => {
  let service: OrganizationsService;

  // Granular mocks so each call chain can resolve independently
  const orgsInsertMock = jest.fn();
  const orgsSelectAfterInsertMock = jest.fn();
  const orgsSingleMock = jest.fn();

  const orgsMaybeSingleMock = jest.fn();
  const orgsSelectForDupeMock = jest.fn();
  const orgsEqForDupeMock = jest.fn();

  const membersInsertMock = jest.fn();

  const profilesSelectMock = jest.fn();
  const profilesEqMock = jest.fn();
  const profilesSingleMock = jest.fn();

  // The insert chain: insert() → select() → single()
  const insertChain = {
    select: orgsSelectAfterInsertMock.mockReturnThis(),
    single: orgsSingleMock,
  };

  // The dupe-check chain: select() → eq() → maybeSingle()
  const dupeCheckChain = {
    eq: orgsEqForDupeMock.mockReturnThis(),
    maybeSingle: orgsMaybeSingleMock,
  };

  const orgsTable = {
    insert: orgsInsertMock,
    select: orgsSelectForDupeMock,
  };

  const membersTable = {
    insert: membersInsertMock,
  };

  const profilesTable = {
    select: profilesSelectMock,
  };

  const supabaseMock = {
    from: jest.fn((table: string) => {
      if (table === 'organizations') return orgsTable;
      if (table === 'organization_members') return membersTable;
      if (table === 'user_profiles') return profilesTable;
      throw new Error(`unexpected table: ${table}`);
    }),
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: no existing slug
    orgsSelectForDupeMock.mockReturnValue(dupeCheckChain);
    orgsMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    // Default: owner is enterprise
    profilesSelectMock.mockReturnValue({
      eq: profilesEqMock.mockReturnValue({
        single: profilesSingleMock,
      }),
    });
    profilesSingleMock.mockResolvedValue({
      data: { subscription_tier: 'enterprise' },
      error: null,
    });

    // Default: insert succeeds
    orgsInsertMock.mockReturnValue(insertChain);
    orgsSingleMock.mockResolvedValue({
      data: { id: 'org-1', name: 'Acme', slug: 'acme', tier: 'enterprise' },
      error: null,
    });

    // Default: member insert succeeds
    membersInsertMock.mockResolvedValue({ error: null });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: SUPABASE_CLIENT, useValue: supabaseMock },
        {
          provide: OrgAuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: OrgSlugService,
          useValue: {
            validateSlugAvailability: jest.fn(),
            recordSlugChange: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(OrganizationsService);
  });

  it('sets tier="enterprise" on the inserted org row', async () => {
    await service.create({ name: 'Acme', slug: 'acme' } as any, 'user-1');

    expect(orgsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Acme',
        slug: 'acme',
        owner_id: 'user-1',
        tier: 'enterprise',
      }),
    );
  });

  it('also enables api_enabled and embed_enabled for enterprise owners', async () => {
    await service.create({ name: 'Acme', slug: 'acme' } as any, 'user-1');

    expect(orgsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'enterprise',
        api_enabled: true,
        embed_enabled: true,
      }),
    );
  });

  it('still sets tier="enterprise" when owner is not on enterprise subscription', async () => {
    profilesSingleMock.mockResolvedValue({
      data: { subscription_tier: 'free' },
      error: null,
    });

    await service.create({ name: 'Acme', slug: 'acme' } as any, 'user-1');

    expect(orgsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'enterprise',
      }),
    );
    // api_enabled / embed_enabled should NOT be set for non-enterprise profiles
    const payload = orgsInsertMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty('api_enabled');
    expect(payload).not.toHaveProperty('embed_enabled');
  });

  it('throws ConflictException when slug is already taken', async () => {
    orgsMaybeSingleMock.mockResolvedValue({
      data: { id: 'existing-org' },
      error: null,
    });

    await expect(
      service.create({ name: 'Acme', slug: 'acme' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws BadRequestException for a reserved slug', async () => {
    await expect(
      service.create({ name: 'Acme', slug: 'admin' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

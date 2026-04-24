import { Test, TestingModule } from '@nestjs/testing';
import { McpEntitlementsInvalidator } from './mcp-entitlements-invalidator.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

describe('McpEntitlementsInvalidator', () => {
  let service: McpEntitlementsInvalidator;
  let fetchMock: jest.SpyInstance;
  const supabaseMock = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  } as any;

  const buildService = async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        McpEntitlementsInvalidator,
        { provide: SUPABASE_CLIENT, useValue: supabaseMock },
      ],
    }).compile();
    return moduleRef.get(McpEntitlementsInvalidator);
  };

  beforeEach(async () => {
    process.env.MCP_INTERNAL_SECRET = 'test-secret';
    process.env.MCP_SERVER_URL = 'https://mcp.test';
    service = await buildService();
    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('{"invalidated":0}', { status: 200 }) as any,
      );
  });

  afterEach(() => {
    fetchMock.mockRestore();
    delete process.env.MCP_INTERNAL_SECRET;
    delete process.env.MCP_SERVER_URL;
  });

  it('no-ops when userIds is empty', async () => {
    await service.invalidate([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no-ops when MCP_INTERNAL_SECRET is not set', async () => {
    delete process.env.MCP_INTERNAL_SECRET;
    const s = await buildService();
    await s.invalidate(['a']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs with bearer secret and userIds', async () => {
    await service.invalidate(['u1', 'u2']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://mcp.test/internal/entitlements/invalidate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-secret',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ userIds: ['u1', 'u2'] }),
      }),
    );
  });

  it('swallows fetch errors (best-effort)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(service.invalidate(['u1'])).resolves.not.toThrow();
  });

  it('invalidateOrgMembers expands orgId to active member userIds', async () => {
    const getActiveSpy = jest
      .spyOn(service as any, 'getActiveMemberIds')
      .mockResolvedValue(['u1', 'u2']);

    await service.invalidateOrgMembers('org-123');

    expect(getActiveSpy).toHaveBeenCalledWith('org-123');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://mcp.test/internal/entitlements/invalidate',
      expect.objectContaining({
        body: JSON.stringify({ userIds: ['u1', 'u2'] }),
      }),
    );
  });
});

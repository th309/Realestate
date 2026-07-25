import { ServiceUnavailableException } from '@nestjs/common';
import { SocialConnectController } from './social-connect.controller';
import { LateNotConfiguredError } from './late-client.types';
import type { SocialConnectService } from './social-connect.service';

const SETUP = {
  error: 'late_not_configured' as const,
  message: 'not active',
  steps: ['do a thing'],
};

describe('SocialConnectController', () => {
  const realDefaultBrand = process.env.SOCIAL_CONNECT_DEFAULT_BRAND_ID;

  afterEach(() => {
    if (realDefaultBrand === undefined)
      delete process.env.SOCIAL_CONNECT_DEFAULT_BRAND_ID;
    else process.env.SOCIAL_CONNECT_DEFAULT_BRAND_ID = realDefaultBrand;
  });

  it('list returns the { success, data } envelope', async () => {
    const service = {
      listConnections: jest.fn().mockResolvedValue({
        configured: false,
        connections: [],
        setup: SETUP,
      }),
    } as unknown as SocialConnectService;
    const controller = new SocialConnectController(service);

    const res = await controller.list({});

    expect(res.success).toBe(true);
    expect(res.data.configured).toBe(false);
  });

  it('connect-link 503 keeps the { success:false, error } envelope', async () => {
    const service = {
      createConnectLink: jest
        .fn()
        .mockRejectedValue(new LateNotConfiguredError()),
      setup: () => SETUP,
    } as unknown as SocialConnectService;
    const controller = new SocialConnectController(service);

    await expect(
      controller.connectLink({ platform: 'instagram' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    try {
      await controller.connectLink({ platform: 'instagram' });
    } catch (err) {
      expect((err as ServiceUnavailableException).getResponse()).toEqual({
        success: false,
        error: SETUP,
      });
    }
  });

  it('disconnect forwards the tenant-scoped id + brandId to the service', async () => {
    const disconnect = jest.fn().mockResolvedValue({ disconnected: 'conn-1' });
    const service = { disconnect } as unknown as SocialConnectService;
    const controller = new SocialConnectController(service);

    const res = await controller.disconnect('conn-1', 'brand-1');

    expect(disconnect).toHaveBeenCalledWith('conn-1', 'brand-1');
    expect(res.data.disconnected).toBe('conn-1');
  });

  it('sync delegates to the service with no brandId (resolution lives in the service now)', async () => {
    const syncFromLate = jest.fn().mockResolvedValue({ synced: 0, failed: [] });
    const service = { syncFromLate } as unknown as SocialConnectService;
    const controller = new SocialConnectController(service);

    const res = await controller.sync({});

    expect(syncFromLate).toHaveBeenCalledWith(undefined);
    expect(res.success).toBe(true);
  });

  it('sync passes an explicit brandId through', async () => {
    const syncFromLate = jest.fn().mockResolvedValue({ synced: 2, failed: [] });
    const service = { syncFromLate } as unknown as SocialConnectService;
    const controller = new SocialConnectController(service);

    const res = await controller.sync({ brandId: 'brand-9' });

    expect(syncFromLate).toHaveBeenCalledWith('brand-9');
    expect(res.data.synced).toBe(2);
  });
});

import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
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

  it('connect-link surfaces a 503 with the setup payload when Late is not configured', async () => {
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
      expect((err as ServiceUnavailableException).getResponse()).toEqual(SETUP);
    }
  });

  it('sync rejects with 400 when no brandId is provided and no default is set', async () => {
    delete process.env.SOCIAL_CONNECT_DEFAULT_BRAND_ID;
    const service = {
      syncFromLate: jest.fn(),
    } as unknown as SocialConnectService;
    const controller = new SocialConnectController(service);

    await expect(controller.sync({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.syncFromLate).not.toHaveBeenCalled();
  });

  it('sync falls back to SOCIAL_CONNECT_DEFAULT_BRAND_ID when body.brandId is absent', async () => {
    process.env.SOCIAL_CONNECT_DEFAULT_BRAND_ID = 'env-brand';
    const syncFromLate = jest.fn().mockResolvedValue({ synced: 2 });
    const service = { syncFromLate } as unknown as SocialConnectService;
    const controller = new SocialConnectController(service);

    const res = await controller.sync({});

    expect(syncFromLate).toHaveBeenCalledWith('env-brand');
    expect(res.data.synced).toBe(2);
  });
});

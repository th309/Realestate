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

  it('sync falls back to SOCIAL_CONNECT_DEFAULT_BRAND_ID and returns the result', async () => {
    process.env.SOCIAL_CONNECT_DEFAULT_BRAND_ID =
      '11111111-1111-4111-8111-111111111111';
    const syncFromLate = jest.fn().mockResolvedValue({ synced: 2, failed: [] });
    const service = { syncFromLate } as unknown as SocialConnectService;
    const controller = new SocialConnectController(service);

    const res = await controller.sync({});

    expect(syncFromLate).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(res.data.synced).toBe(2);
  });
});

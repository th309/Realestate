import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import webpush, { WebPushError } from 'web-push';
import { PushService } from './push.service';
import { PushSubscriptionsDataService } from './push-subscriptions.data';

// Keep the real WebPushError class (for instanceof checks in PushService)
// but stub the network-calling functions.
jest.mock('web-push', () => {
  const actual = jest.requireActual('web-push');
  return {
    ...actual,
    sendNotification: jest.fn(),
    setVapidDetails: jest.fn(),
  };
});

function buildConfig(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    VAPID_PUBLIC_KEY: 'pub-key',
    VAPID_PRIVATE_KEY: 'priv-key',
    VAPID_SUBJECT: 'mailto:test@example.com',
    ...overrides,
  };
  return { get: jest.fn((key: string) => values[key]) };
}

describe('PushService — fail-fast VAPID validation', () => {
  afterEach(() => jest.clearAllMocks());

  it.each(['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'])(
    'throws at construction if %s is missing',
    async (missingKey) => {
      await expect(
        Test.createTestingModule({
          providers: [
            PushService,
            {
              provide: ConfigService,
              useValue: buildConfig({ [missingKey]: undefined }),
            },
            { provide: PushSubscriptionsDataService, useValue: {} },
          ],
        }).compile(),
      ).rejects.toThrow(`${missingKey} is required`);
    },
  );
});

describe('PushService.sendToUser', () => {
  let service: PushService;
  let dataService: {
    findByUserId: jest.Mock;
    removeById: jest.Mock;
    markSuccess: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    dataService = {
      findByUserId: jest.fn(),
      removeById: jest.fn().mockResolvedValue(undefined),
      markSuccess: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: ConfigService, useValue: buildConfig() },
        { provide: PushSubscriptionsDataService, useValue: dataService },
      ],
    }).compile();

    service = module.get(PushService);
  });

  const payload = { title: 'Alert', body: 'Something changed', url: '/alerts' };

  it('returns zero counts and skips the network call when the user has no subscriptions', async () => {
    dataService.findByUserId.mockResolvedValue([]);

    const result = await service.sendToUser('user-1', payload);

    expect(result).toEqual({ sent: 0, failed: 0, pruned: 0 });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('marks success and counts a sent notification', async () => {
    dataService.findByUserId.mockResolvedValue([
      {
        id: 'sub-1',
        endpoint: 'https://push.example.com/ok',
        p256dh: 'p',
        auth: 'a',
      },
    ]);
    (webpush.sendNotification as jest.Mock).mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {},
    });

    const result = await service.sendToUser('user-1', payload);

    expect(result).toEqual({ sent: 1, failed: 0, pruned: 0 });
    expect(dataService.markSuccess).toHaveBeenCalledWith('sub-1');
  });

  it('prunes the subscription on a 410 Gone response', async () => {
    dataService.findByUserId.mockResolvedValue([
      {
        id: 'sub-410',
        endpoint: 'https://push.example.com/gone',
        p256dh: 'p',
        auth: 'a',
      },
    ]);
    (webpush.sendNotification as jest.Mock).mockRejectedValue(
      new WebPushError('Gone', 410, {}, '', 'https://push.example.com/gone'),
    );

    const result = await service.sendToUser('user-1', payload);

    expect(result).toEqual({ sent: 0, failed: 0, pruned: 1 });
    expect(dataService.removeById).toHaveBeenCalledWith('sub-410');
  });

  it('prunes the subscription on a 404 Not Found response', async () => {
    dataService.findByUserId.mockResolvedValue([
      {
        id: 'sub-404',
        endpoint: 'https://push.example.com/missing',
        p256dh: 'p',
        auth: 'a',
      },
    ]);
    (webpush.sendNotification as jest.Mock).mockRejectedValue(
      new WebPushError(
        'Not Found',
        404,
        {},
        '',
        'https://push.example.com/missing',
      ),
    );

    const result = await service.sendToUser('user-1', payload);

    expect(result).toEqual({ sent: 0, failed: 0, pruned: 1 });
    expect(dataService.removeById).toHaveBeenCalledWith('sub-404');
  });

  it('counts a non-404/410 provider error as failed, without pruning', async () => {
    dataService.findByUserId.mockResolvedValue([
      {
        id: 'sub-500',
        endpoint: 'https://push.example.com/err',
        p256dh: 'p',
        auth: 'a',
      },
    ]);
    (webpush.sendNotification as jest.Mock).mockRejectedValue(
      new WebPushError(
        'Server error',
        500,
        {},
        '',
        'https://push.example.com/err',
      ),
    );

    const result = await service.sendToUser('user-1', payload);

    expect(result).toEqual({ sent: 0, failed: 1, pruned: 0 });
    expect(dataService.removeById).not.toHaveBeenCalled();
  });

  it('handles a mix of subscriptions independently in one call', async () => {
    dataService.findByUserId.mockResolvedValue([
      {
        id: 'sub-ok',
        endpoint: 'https://push.example.com/a',
        p256dh: 'p',
        auth: 'a',
      },
      {
        id: 'sub-dead',
        endpoint: 'https://push.example.com/b',
        p256dh: 'p',
        auth: 'a',
      },
    ]);
    (webpush.sendNotification as jest.Mock)
      .mockResolvedValueOnce({ statusCode: 201, body: '', headers: {} })
      .mockRejectedValueOnce(
        new WebPushError('Gone', 410, {}, '', 'https://push.example.com/b'),
      );

    const result = await service.sendToUser('user-1', payload);

    expect(result).toEqual({ sent: 1, failed: 0, pruned: 1 });
  });

  it('never throws even if the underlying subscription lookup fails', async () => {
    dataService.findByUserId.mockRejectedValue(new Error('db down'));

    await expect(service.sendToUser('user-1', payload)).resolves.toEqual({
      sent: 0,
      failed: 0,
      pruned: 0,
    });
  });
});

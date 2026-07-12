import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SubscribePushDto } from './subscribe-push.dto';
import { UnsubscribePushDto } from './unsubscribe-push.dto';

describe('SubscribePushDto', () => {
  const valid = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
  };

  it('passes for valid input', async () => {
    const errors = await validate(plainToInstance(SubscribePushDto, valid));
    expect(errors).toHaveLength(0);
  });

  it('accepts an optional userAgent string', async () => {
    const errors = await validate(
      plainToInstance(SubscribePushDto, { ...valid, userAgent: 'Mozilla/5.0' }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-https endpoint', async () => {
    const errors = await validate(
      plainToInstance(SubscribePushDto, {
        ...valid,
        endpoint: 'http://fcm.googleapis.com/fcm/send/abc123',
      }),
    );
    expect(errors.some((e) => e.property === 'endpoint')).toBe(true);
  });

  it('rejects a garbage (non-URL) endpoint', async () => {
    const errors = await validate(
      plainToInstance(SubscribePushDto, { ...valid, endpoint: 'not-a-url' }),
    );
    expect(errors.some((e) => e.property === 'endpoint')).toBe(true);
  });

  it('rejects a missing keys object', async () => {
    const errors = await validate(
      plainToInstance(SubscribePushDto, { endpoint: valid.endpoint }),
    );
    expect(errors.some((e) => e.property === 'keys')).toBe(true);
  });

  it('rejects keys with a missing p256dh', async () => {
    const errors = await validate(
      plainToInstance(SubscribePushDto, {
        ...valid,
        keys: { auth: 'auth-value' },
      }),
    );
    const keysError = errors.find((e) => e.property === 'keys');
    expect(keysError).toBeDefined();
    expect(keysError?.children?.[0]?.constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects keys with an empty auth string', async () => {
    const errors = await validate(
      plainToInstance(SubscribePushDto, {
        ...valid,
        keys: { p256dh: 'p256dh-value', auth: '' },
      }),
    );
    const keysError = errors.find((e) => e.property === 'keys');
    expect(keysError?.children?.some((c) => c.property === 'auth')).toBe(true);
  });

  it('rejects an endpoint longer than 2048 characters', async () => {
    const errors = await validate(
      plainToInstance(SubscribePushDto, {
        ...valid,
        endpoint: `https://fcm.googleapis.com/fcm/send/${'a'.repeat(2050)}`,
      }),
    );
    const endpointError = errors.find((e) => e.property === 'endpoint');
    expect(endpointError?.constraints).toHaveProperty('maxLength');
  });

  it('rejects a p256dh longer than 256 characters', async () => {
    const errors = await validate(
      plainToInstance(SubscribePushDto, {
        ...valid,
        keys: { p256dh: 'a'.repeat(260), auth: 'auth-value' },
      }),
    );
    const keysError = errors.find((e) => e.property === 'keys');
    const p256dhError = keysError?.children?.find(
      (c) => c.property === 'p256dh',
    );
    expect(p256dhError?.constraints).toHaveProperty('maxLength');
  });

  it('rejects an auth longer than 256 characters', async () => {
    const errors = await validate(
      plainToInstance(SubscribePushDto, {
        ...valid,
        keys: { p256dh: 'p256dh-value', auth: 'a'.repeat(260) },
      }),
    );
    const keysError = errors.find((e) => e.property === 'keys');
    const authError = keysError?.children?.find((c) => c.property === 'auth');
    expect(authError?.constraints).toHaveProperty('maxLength');
  });

  it('rejects a userAgent longer than 512 characters', async () => {
    const errors = await validate(
      plainToInstance(SubscribePushDto, {
        ...valid,
        userAgent: 'a'.repeat(520),
      }),
    );
    const userAgentError = errors.find((e) => e.property === 'userAgent');
    expect(userAgentError?.constraints).toHaveProperty('maxLength');
  });
});

describe('UnsubscribePushDto', () => {
  it('passes for a valid https endpoint', async () => {
    const errors = await validate(
      plainToInstance(UnsubscribePushDto, {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing endpoint', async () => {
    const errors = await validate(plainToInstance(UnsubscribePushDto, {}));
    expect(errors.some((e) => e.property === 'endpoint')).toBe(true);
  });

  it('rejects an endpoint longer than 2048 characters', async () => {
    const errors = await validate(
      plainToInstance(UnsubscribePushDto, {
        endpoint: `https://fcm.googleapis.com/fcm/send/${'a'.repeat(2050)}`,
      }),
    );
    const endpointError = errors.find((e) => e.property === 'endpoint');
    expect(endpointError?.constraints).toHaveProperty('maxLength');
  });
});

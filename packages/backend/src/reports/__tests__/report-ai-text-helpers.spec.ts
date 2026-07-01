import { Logger } from '@nestjs/common';
import { retryWithBackoff } from '../report-ai-text-helpers';

const SILENT_LOGGER = {
  warn: () => {},
  error: () => {},
} as unknown as Logger;

describe('retryWithBackoff', () => {
  it('rethrows a non-retryable error immediately without extra attempts', async () => {
    let calls = 0;
    const nonRetryable = Object.assign(new Error('cap hit'), {
      retryable: false,
    });
    const fn = async () => {
      calls++;
      throw nonRetryable;
    };

    await expect(retryWithBackoff(fn, 'test', SILENT_LOGGER, 3)).rejects.toBe(
      nonRetryable,
    );
    // maxRetries=3 would normally allow 4 attempts; a non-retryable error must
    // short-circuit after the first.
    expect(calls).toBe(1);
  });

  it('still retries an ordinary transient error and can succeed', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 2) throw new Error('transient');
      return 'ok';
    };

    const result = await retryWithBackoff(fn, 'test', SILENT_LOGGER, 1);
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });
});

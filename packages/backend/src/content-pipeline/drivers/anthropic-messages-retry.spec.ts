import { isTransientAnthropicFailure } from './anthropic-messages-retry';

describe('isTransientAnthropicFailure', () => {
  it('treats Connection error as transient', () => {
    expect(isTransientAnthropicFailure(new Error('Connection error.'))).toBe(
      true,
    );
  });

  it('treats 529 as transient', () => {
    expect(isTransientAnthropicFailure({ status: 529, message: 'overloaded' })).toBe(
      true,
    );
  });

  it('treats auth errors as non-transient', () => {
    expect(
      isTransientAnthropicFailure({ status: 401, message: 'invalid_api_key' }),
    ).toBe(false);
  });
});

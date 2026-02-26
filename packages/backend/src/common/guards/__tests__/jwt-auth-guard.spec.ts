/**
 * JwtAuthGuard Unit Tests
 *
 * Tests the JWT authentication guard in isolation:
 * - Valid Bearer token sets request.userId from Supabase Auth
 * - Invalid/expired Bearer token returns 401
 * - Missing Authorization header returns 401
 * - CRITICAL REGRESSION: x-user-id header is NOT accepted as authentication
 * - CRITICAL REGRESSION: x-api-key header is NOT accepted as authentication
 */

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { SupabaseService } from '../../../supabase/supabase.service';

// =============================================================================
// Mocks
// =============================================================================

function createMockSupabaseService(
  overrides?: Partial<{
    getUserResult: { data: any; error: any };
  }>,
): SupabaseService {
  const defaultResult = overrides?.getUserResult ?? {
    data: { user: { id: 'user-uuid-1234' } },
    error: null,
  };

  return {
    getClient: jest.fn().mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue(defaultResult),
      },
    }),
  } as unknown as SupabaseService;
}

function createMockConfigService(): ConfigService {
  return {
    get: jest.fn().mockReturnValue('test-value'),
  } as unknown as ConfigService;
}

function createMockExecutionContext(headers: Record<string, string> = {}): {
  context: ExecutionContext;
  request: any;
} {
  const request = {
    headers: { ...headers },
    userId: undefined as string | undefined,
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;

  return { context, request };
}

// =============================================================================
// Tests
// =============================================================================

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let supabaseService: SupabaseService;

  beforeEach(() => {
    supabaseService = createMockSupabaseService();
    guard = new JwtAuthGuard(createMockConfigService(), supabaseService);
  });

  // ===========================================================================
  // Successful authentication
  // ===========================================================================

  describe('valid Bearer token', () => {
    it('returns true and sets request.userId from JWT', async () => {
      const { context, request } = createMockExecutionContext({
        authorization: 'Bearer valid-jwt-token-here',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.userId).toBe('user-uuid-1234');
    });

    it('calls Supabase auth.getUser with the token', async () => {
      const { context } = createMockExecutionContext({
        authorization: 'Bearer my-special-token',
      });

      await guard.canActivate(context);

      const client = supabaseService.getClient();
      expect(client.auth.getUser).toHaveBeenCalledWith('my-special-token');
    });
  });

  // ===========================================================================
  // Failed authentication - invalid tokens
  // ===========================================================================

  describe('invalid Bearer token', () => {
    it('throws UnauthorizedException when Supabase returns an error', async () => {
      supabaseService = createMockSupabaseService({
        getUserResult: {
          data: { user: null },
          error: { message: 'invalid claim: missing sub claim' },
        },
      });
      guard = new JwtAuthGuard(createMockConfigService(), supabaseService);

      const { context } = createMockExecutionContext({
        authorization: 'Bearer invalid-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when Supabase returns expired token error', async () => {
      supabaseService = createMockSupabaseService({
        getUserResult: {
          data: { user: null },
          error: { message: 'Token expired' },
        },
      });
      guard = new JwtAuthGuard(createMockConfigService(), supabaseService);

      const { context } = createMockExecutionContext({
        authorization: 'Bearer expired-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when Supabase returns no user', async () => {
      supabaseService = createMockSupabaseService({
        getUserResult: {
          data: { user: null },
          error: null,
        },
      });
      guard = new JwtAuthGuard(createMockConfigService(), supabaseService);

      const { context } = createMockExecutionContext({
        authorization: 'Bearer token-with-no-user',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when Supabase auth throws an exception', async () => {
      const mockClient = {
        auth: {
          getUser: jest.fn().mockRejectedValue(new Error('Network error')),
        },
      };
      supabaseService = {
        getClient: jest.fn().mockReturnValue(mockClient),
      } as unknown as SupabaseService;
      guard = new JwtAuthGuard(createMockConfigService(), supabaseService);

      const { context } = createMockExecutionContext({
        authorization: 'Bearer some-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ===========================================================================
  // Failed authentication - missing header
  // ===========================================================================

  describe('missing Authorization header', () => {
    it('throws UnauthorizedException with "Authentication required"', async () => {
      const { context } = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Authentication required',
      );
    });

    it('throws UnauthorizedException when Authorization header is empty', async () => {
      const { context } = createMockExecutionContext({
        authorization: '',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for non-Bearer authorization scheme', async () => {
      const { context } = createMockExecutionContext({
        authorization: 'Basic dXNlcjpwYXNz',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ===========================================================================
  // CRITICAL REGRESSION: x-user-id bypass must NOT work
  // ===========================================================================

  describe('x-user-id header bypass (REMOVED - regression test)', () => {
    it('rejects requests with only x-user-id header (no Bearer token)', async () => {
      const { context, request } = createMockExecutionContext({
        'x-user-id': 'attacker-injected-user-id',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );

      // userId must NOT be set from the header
      expect(request.userId).toBeUndefined();
    });

    it('does not use x-user-id header even with x-api-key present', async () => {
      const { context, request } = createMockExecutionContext({
        'x-user-id': 'attacker-injected-user-id',
        'x-api-key': 'some-api-key',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(request.userId).toBeUndefined();
    });

    it('does not use x-user-id header even alongside a valid Bearer token', async () => {
      // With a valid Bearer token, the userId should come from Supabase, NOT x-user-id
      const { context, request } = createMockExecutionContext({
        authorization: 'Bearer valid-jwt-token',
        'x-user-id': 'attacker-injected-user-id',
      });

      await guard.canActivate(context);

      // userId must come from Supabase (user-uuid-1234), not from the header
      expect(request.userId).toBe('user-uuid-1234');
      expect(request.userId).not.toBe('attacker-injected-user-id');
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles "Bearer " with no token after it', async () => {
      const { context } = createMockExecutionContext({
        authorization: 'Bearer ',
      });

      // Should attempt validation with empty string, which will fail
      supabaseService = createMockSupabaseService({
        getUserResult: {
          data: { user: null },
          error: { message: 'invalid token' },
        },
      });
      guard = new JwtAuthGuard(createMockConfigService(), supabaseService);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does not set userId on the request when authentication fails', async () => {
      supabaseService = createMockSupabaseService({
        getUserResult: {
          data: { user: null },
          error: { message: 'invalid' },
        },
      });
      guard = new JwtAuthGuard(createMockConfigService(), supabaseService);

      const { context, request } = createMockExecutionContext({
        authorization: 'Bearer bad-token',
      });

      try {
        await guard.canActivate(context);
      } catch {
        // expected
      }

      expect(request.userId).toBeUndefined();
    });
  });
});

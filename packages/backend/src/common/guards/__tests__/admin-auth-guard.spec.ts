/**
 * AdminGuard Unit Tests
 *
 * Tests the AdminGuard in isolation:
 * - Delegates JWT validation to JwtAuthGuard (via composition)
 * - Checks admin_users table for the authenticated user
 * - Grants access only for 'admin' and 'super_admin' roles
 * - Rejects non-admin users with ForbiddenException
 * - Sets request.adminRole on success
 */

import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminGuard } from '../admin-auth.guard';
import { SupabaseService } from '../../../supabase/supabase.service';

// =============================================================================
// Mocks
// =============================================================================

function createMockSupabaseService(overrides?: {
  getUserResult?: { data: any; error: any };
  adminQueryResult?: { data: any; error: any };
}): SupabaseService {
  const getUserResult = overrides?.getUserResult ?? {
    data: { user: { id: 'admin-user-uuid' } },
    error: null,
  };

  const adminQueryResult = overrides?.adminQueryResult ?? {
    data: { role: 'admin' },
    error: null,
  };

  // Create a chainable mock for the admin_users query
  const singleFn = jest.fn().mockResolvedValue(adminQueryResult);
  const eqFn = jest.fn().mockReturnValue({ single: singleFn });
  const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
  const fromFn = jest.fn().mockReturnValue({ select: selectFn });

  return {
    getClient: jest.fn().mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue(getUserResult),
      },
      from: fromFn,
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
    adminRole: undefined as string | undefined,
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

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let supabaseService: SupabaseService;

  // ===========================================================================
  // Successful admin authentication
  // ===========================================================================

  describe('valid admin user', () => {
    it('grants access for user with admin role', async () => {
      supabaseService = createMockSupabaseService({
        adminQueryResult: { data: { role: 'admin' }, error: null },
      });
      guard = new AdminGuard(supabaseService, createMockConfigService());

      const { context } = createMockExecutionContext({
        authorization: 'Bearer valid-admin-token',
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('grants access for user with super_admin role', async () => {
      supabaseService = createMockSupabaseService({
        adminQueryResult: { data: { role: 'super_admin' }, error: null },
      });
      guard = new AdminGuard(supabaseService, createMockConfigService());

      const { context } = createMockExecutionContext({
        authorization: 'Bearer valid-super-admin-token',
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('sets request.adminRole on successful admin auth', async () => {
      supabaseService = createMockSupabaseService({
        adminQueryResult: { data: { role: 'super_admin' }, error: null },
      });
      guard = new AdminGuard(supabaseService, createMockConfigService());

      const { context, request } = createMockExecutionContext({
        authorization: 'Bearer valid-admin-token',
      });

      await guard.canActivate(context);
      expect(request.adminRole).toBe('super_admin');
    });
  });

  // ===========================================================================
  // Failed: JWT validation fails
  // ===========================================================================

  describe('invalid JWT', () => {
    it('throws UnauthorizedException when no Bearer token provided', async () => {
      supabaseService = createMockSupabaseService();
      guard = new AdminGuard(supabaseService, createMockConfigService());

      const { context } = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when Bearer token is invalid', async () => {
      supabaseService = createMockSupabaseService({
        getUserResult: {
          data: { user: null },
          error: { message: 'invalid token' },
        },
      });
      guard = new AdminGuard(supabaseService, createMockConfigService());

      const { context } = createMockExecutionContext({
        authorization: 'Bearer invalid-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ===========================================================================
  // Failed: user is not an admin
  // ===========================================================================

  describe('non-admin user', () => {
    it('throws ForbiddenException when user has no admin_users row', async () => {
      supabaseService = createMockSupabaseService({
        adminQueryResult: { data: null, error: { code: 'PGRST116' } },
      });
      guard = new AdminGuard(supabaseService, createMockConfigService());

      const { context } = createMockExecutionContext({
        authorization: 'Bearer valid-token-but-not-admin',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Admin access denied: user is not an admin',
      );
    });

    it('throws ForbiddenException when user has disallowed role', async () => {
      supabaseService = createMockSupabaseService({
        adminQueryResult: { data: { role: 'viewer' }, error: null },
      });
      guard = new AdminGuard(supabaseService, createMockConfigService());

      const { context } = createMockExecutionContext({
        authorization: 'Bearer valid-token-viewer-role',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'insufficient admin role',
      );
    });

    it('throws ForbiddenException when admin_users query returns error', async () => {
      supabaseService = createMockSupabaseService({
        adminQueryResult: { data: null, error: { message: 'DB error' } },
      });
      guard = new AdminGuard(supabaseService, createMockConfigService());

      const { context } = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ===========================================================================
  // Regression: x-user-id header bypass must NOT work with AdminGuard
  // ===========================================================================

  describe('x-user-id header bypass (REMOVED - regression test)', () => {
    it('rejects requests with only x-user-id header', async () => {
      supabaseService = createMockSupabaseService();
      guard = new AdminGuard(supabaseService, createMockConfigService());

      const { context } = createMockExecutionContext({
        'x-user-id': 'attacker-id',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});

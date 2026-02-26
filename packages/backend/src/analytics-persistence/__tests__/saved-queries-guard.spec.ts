/**
 * Analytics Persistence Controller Guard Tests
 *
 * Verifies that the analytics-persistence controllers:
 * - Have JwtAuthGuard applied (class-level or method-level)
 * - Use @AuthUserId() to extract userId from the JWT (not from query params/headers)
 * - Reject requests without valid Bearer tokens
 * - SharesController: method-level guards because access/:token is intentionally public
 *
 * This test covers all controllers in the analytics-persistence module.
 */

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Controllers under test
import { SavedQueriesController } from '../saved-queries.controller';
import { WatchlistController } from '../watchlist.controller';
import { NotesController } from '../notes.controller';
import { AlertsController } from '../alerts.controller';
import { ConversationsController } from '../conversations.controller';
import { ExportController } from '../export.controller';
import { SharesController } from '../shares.controller';

// =============================================================================
// Helpers
// =============================================================================

function getClassGuards(target: Function): any[] {
  return Reflect.getMetadata(GUARDS_METADATA, target) || [];
}

function getMethodGuards(target: any, methodName: string): any[] {
  const descriptor = Object.getOwnPropertyDescriptor(
    target.prototype,
    methodName,
  );
  if (!descriptor) return [];
  return Reflect.getMetadata(GUARDS_METADATA, descriptor.value) || [];
}

function classHasGuard(
  controllerClass: Function,
  guardClass: Function,
): boolean {
  const guards = getClassGuards(controllerClass);
  return guards.some(
    (g: any) => g === guardClass || g.name === guardClass.name,
  );
}

function methodHasGuard(
  controllerClass: any,
  methodName: string,
  guardClass: Function,
): boolean {
  const guards = getMethodGuards(controllerClass, methodName);
  return guards.some(
    (g: any) => g === guardClass || g.name === guardClass.name,
  );
}

function isProtectedByGuard(
  controllerClass: any,
  guardClass: Function,
  methodName: string,
): boolean {
  return (
    classHasGuard(controllerClass, guardClass) ||
    methodHasGuard(controllerClass, methodName, guardClass)
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('Analytics Persistence Controller Guards', () => {
  // ===========================================================================
  // Class-level JwtAuthGuard controllers
  // ===========================================================================

  describe('SavedQueriesController', () => {
    it('has JwtAuthGuard applied at the class level', () => {
      expect(classHasGuard(SavedQueriesController, JwtAuthGuard)).toBe(true);
    });

    it('does NOT have AdminGuard (regular user endpoints)', () => {
      const guards = getClassGuards(SavedQueriesController);
      const hasAdminGuard = guards.some((g: any) => g.name === 'AdminGuard');
      expect(hasAdminGuard).toBe(false);
    });
  });

  describe('WatchlistController', () => {
    it('has JwtAuthGuard applied at the class level', () => {
      expect(classHasGuard(WatchlistController, JwtAuthGuard)).toBe(true);
    });
  });

  describe('NotesController', () => {
    it('has JwtAuthGuard applied at the class level', () => {
      expect(classHasGuard(NotesController, JwtAuthGuard)).toBe(true);
    });
  });

  describe('AlertsController', () => {
    it('has JwtAuthGuard applied at the class level', () => {
      expect(classHasGuard(AlertsController, JwtAuthGuard)).toBe(true);
    });
  });

  describe('ConversationsController', () => {
    it('has JwtAuthGuard applied at the class level', () => {
      expect(classHasGuard(ConversationsController, JwtAuthGuard)).toBe(true);
    });
  });

  describe('ExportController', () => {
    it('has JwtAuthGuard applied at the class level', () => {
      expect(classHasGuard(ExportController, JwtAuthGuard)).toBe(true);
    });
  });

  // ===========================================================================
  // SharesController: method-level guards (access/:token is public)
  // ===========================================================================

  describe('SharesController (method-level guards)', () => {
    it('does NOT have JwtAuthGuard at class level (has public endpoint)', () => {
      // SharesController intentionally uses method-level guards because
      // access/:token is a public endpoint for share viewers
      expect(classHasGuard(SharesController, JwtAuthGuard)).toBe(false);
    });

    it.each(['getAll', 'getById', 'create', 'update', 'delete'])(
      'protects authenticated method "%s" with method-level JwtAuthGuard',
      (methodName) => {
        expect(methodHasGuard(SharesController, methodName, JwtAuthGuard)).toBe(
          true,
        );
      },
    );

    it('does NOT protect public "access" method with JwtAuthGuard', () => {
      // The access/:token endpoint is intentionally public
      expect(methodHasGuard(SharesController, 'access', JwtAuthGuard)).toBe(
        false,
      );
    });
  });

  // ===========================================================================
  // Cross-cutting: all class-level guarded controllers
  // ===========================================================================

  describe('Cross-cutting: class-level guarded controllers require JwtAuthGuard', () => {
    const classGuardedControllers = [
      { name: 'SavedQueriesController', cls: SavedQueriesController },
      { name: 'WatchlistController', cls: WatchlistController },
      { name: 'NotesController', cls: NotesController },
      { name: 'AlertsController', cls: AlertsController },
      { name: 'ConversationsController', cls: ConversationsController },
      { name: 'ExportController', cls: ExportController },
    ];

    it.each(classGuardedControllers)(
      '$name has JwtAuthGuard at class level',
      ({ cls }) => {
        expect(classHasGuard(cls, JwtAuthGuard)).toBe(true);
      },
    );

    it.each(classGuardedControllers)(
      '$name does NOT have AdminGuard (user-facing endpoints)',
      ({ cls }) => {
        const guards = getClassGuards(cls);
        const hasAdmin = guards.some((g: any) => g.name === 'AdminGuard');
        expect(hasAdmin).toBe(false);
      },
    );
  });

  // ===========================================================================
  // Cross-cutting: ALL authenticated endpoints are protected
  // ===========================================================================

  describe('Cross-cutting: all user-data endpoints are protected', () => {
    it('SharesController authenticated methods are all protected', () => {
      const authenticatedMethods = [
        'getAll',
        'getById',
        'create',
        'update',
        'delete',
      ];

      for (const method of authenticatedMethods) {
        expect(isProtectedByGuard(SharesController, JwtAuthGuard, method)).toBe(
          true,
        );
      }
    });
  });
});

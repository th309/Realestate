/**
 * AdminGuard Controller Metadata Tests
 *
 * Verifies that AdminGuard is properly applied as a class-level or method-level
 * guard on all admin-only controllers. Uses NestJS Reflector to inspect decorator
 * metadata without needing to instantiate services.
 *
 * This is a regression test suite: if someone accidentally removes @UseGuards(AdminGuard)
 * from any of these controllers, these tests will catch it.
 */

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '../admin-auth.guard';

// ---------- Controllers under test ----------
import { DataIngestionController } from '../../../data-ingestion/data-ingestion.controller';
import { PipelinesController } from '../../../health/pipelines.controller';
import { ScoringController } from '../../../scoring/scoring.controller';
import { MLWorkflowController } from '../../../ml-workflow/ml-workflow.controller';
import { MLValidationController } from '../../../scoring/ml-validation/ml-validation.controller';
import { BacktestRunsController } from '../../../scoring/backtest-runs/backtest-runs.controller';
import { ValidationController } from '../../../scoring/validation/validation.controller';

// =============================================================================
// Helper: Read guard metadata from the class or method
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

function hasGuardOnClassOrMethod(
  controllerClass: Function,
  guard: Function,
  methodName?: string,
): boolean {
  const classGuards = getClassGuards(controllerClass);
  const classHasGuard = classGuards.some(
    (g: any) => g === guard || g.name === guard.name,
  );

  if (classHasGuard) return true;

  // If a specific method is provided, also check method-level guards
  if (methodName) {
    const methodGuards = getMethodGuards(controllerClass, methodName);
    return methodGuards.some((g: any) => g === guard || g.name === guard.name);
  }

  return false;
}

// =============================================================================
// Tests
// =============================================================================

describe('AdminGuard Controller Metadata', () => {
  describe('DataIngestionController (class-level guard)', () => {
    it('has AdminGuard applied at the class level', () => {
      const guards = getClassGuards(DataIngestionController);
      expect(guards).toContainEqual(AdminGuard);
    });

    it.each([
      'importCensus',
      'importFred',
      'importZillow',
      'importRedfin',
      'importRealtor',
    ])('protects method "%s" via class-level AdminGuard', (methodName) => {
      expect(
        hasGuardOnClassOrMethod(
          DataIngestionController,
          AdminGuard,
          methodName,
        ),
      ).toBe(true);
    });
  });

  describe('PipelinesController (class-level guard)', () => {
    it('has AdminGuard applied at the class level', () => {
      const guards = getClassGuards(PipelinesController);
      expect(guards).toContainEqual(AdminGuard);
    });

    it('protects triggerPipeline via class-level AdminGuard', () => {
      expect(
        hasGuardOnClassOrMethod(
          PipelinesController,
          AdminGuard,
          'triggerPipeline',
        ),
      ).toBe(true);
    });
  });

  describe('ScoringController (method-level guards on write endpoints)', () => {
    it('protects POST calculate/:geography with AdminGuard', () => {
      expect(
        hasGuardOnClassOrMethod(
          ScoringController,
          AdminGuard,
          'calculateScores',
        ),
      ).toBe(true);
    });

    it('protects POST validate with AdminGuard', () => {
      expect(
        hasGuardOnClassOrMethod(
          ScoringController,
          AdminGuard,
          'validatePredictions',
        ),
      ).toBe(true);
    });

    it('does NOT have AdminGuard on public GET endpoints', () => {
      // GET endpoints should NOT require admin access
      const classGuards = getClassGuards(ScoringController);
      const classHasAdmin = classGuards.some(
        (g: any) => g === AdminGuard || g.name === AdminGuard.name,
      );
      expect(classHasAdmin).toBe(false);

      // Verify specific read methods don't have method-level AdminGuard
      const getScoresGuards = getMethodGuards(ScoringController, 'getScores');
      const hasAdminOnGetScores = getScoresGuards.some(
        (g: any) => g === AdminGuard || g.name === AdminGuard.name,
      );
      expect(hasAdminOnGetScores).toBe(false);
    });
  });

  describe('MLWorkflowController (class-level guard)', () => {
    it('has AdminGuard applied at the class level', () => {
      const guards = getClassGuards(MLWorkflowController);
      expect(guards).toContainEqual(AdminGuard);
    });

    it.each([
      'getWorkflowStatus',
      'checkAnalyticsHealth',
      'runStep',
      'getJobStatus',
      'getExportProgress',
      'getCacheStatus',
    ])('protects method "%s" via class-level AdminGuard', (methodName) => {
      expect(
        hasGuardOnClassOrMethod(MLWorkflowController, AdminGuard, methodName),
      ).toBe(true);
    });
  });

  describe('MLValidationController (class-level guard)', () => {
    it('has AdminGuard applied at the class level', () => {
      const guards = getClassGuards(MLValidationController);
      expect(guards).toContainEqual(AdminGuard);
    });

    it.each([
      'runMLValidation',
      'getJobStatus',
      'listValidations',
      'getValidation',
      'applySuggestions',
    ])('protects method "%s" via class-level AdminGuard', (methodName) => {
      expect(
        hasGuardOnClassOrMethod(MLValidationController, AdminGuard, methodName),
      ).toBe(true);
    });
  });

  describe('BacktestRunsController (class-level guard)', () => {
    it('has AdminGuard applied at the class level', () => {
      const guards = getClassGuards(BacktestRunsController);
      expect(guards).toContainEqual(AdminGuard);
    });

    it.each([
      'listRuns',
      'getStatistics',
      'getConfidenceSummary',
      'getConfidenceTrend',
      'getJobStatus',
      'triggerBacktest',
      'getRun',
      'getRunSamples',
    ])('protects method "%s" via class-level AdminGuard', (methodName) => {
      expect(
        hasGuardOnClassOrMethod(BacktestRunsController, AdminGuard, methodName),
      ).toBe(true);
    });
  });

  describe('ValidationController (class-level guard)', () => {
    it('has AdminGuard applied at the class level', () => {
      const guards = getClassGuards(ValidationController);
      expect(guards).toContainEqual(AdminGuard);
    });

    it.each([
      'getSummary',
      'getQuintileAnalysis',
      'getQuintilePerformance',
      'getScatterData',
      'getTimeSeriesAccuracy',
      'getGeographyBreakdown',
    ])('protects method "%s" via class-level AdminGuard', (methodName) => {
      expect(
        hasGuardOnClassOrMethod(ValidationController, AdminGuard, methodName),
      ).toBe(true);
    });
  });

  // ==========================================================================
  // Cross-cutting: ensure no controller accidentally lost its guard
  // ==========================================================================

  describe('Cross-cutting: all admin controllers have guards', () => {
    const classLevelGuardedControllers = [
      { name: 'DataIngestionController', cls: DataIngestionController },
      { name: 'PipelinesController', cls: PipelinesController },
      { name: 'MLWorkflowController', cls: MLWorkflowController },
      { name: 'MLValidationController', cls: MLValidationController },
      { name: 'BacktestRunsController', cls: BacktestRunsController },
      { name: 'ValidationController', cls: ValidationController },
    ];

    it.each(classLevelGuardedControllers)(
      '$name has AdminGuard at class level',
      ({ cls }) => {
        const guards = getClassGuards(cls);
        const hasAdmin = guards.some(
          (g: any) => g === AdminGuard || g.name === AdminGuard.name,
        );
        expect(hasAdmin).toBe(true);
      },
    );
  });
});

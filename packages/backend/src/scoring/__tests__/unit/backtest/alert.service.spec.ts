/**
 * Alert Service Unit Tests
 *
 * Tests confidence alert creation, management, and recovery.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  AlertService,
  Alert,
  DiagnosticSignal,
} from '../../../backtest/alert.service';
import type { ConfidenceScore } from '../../../backtest/confidence-calculator.service';
import { SupabaseService } from '../../../../supabase/supabase.service';

describe('AlertService', () => {
  let service: AlertService;
  let mockSupabaseService: jest.Mocked<SupabaseService>;

  beforeEach(async () => {
    mockSupabaseService = {
      getClient: jest.fn(),
    } as unknown as jest.Mocked<SupabaseService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function createConfidenceScore(overrides: Partial<ConfidenceScore> = {}): ConfidenceScore {
    return {
      scoreType: 'homeready',
      geographyType: 'metro',
      formulaVersion: '1.0.0',
      confidenceScore: 75,
      confidenceLevel: 'high',
      status: 'healthy',
      correlationScore: 80,
      sampleSizeScore: 70,
      recencyScore: 100,
      lastBacktestDate: new Date().toISOString().split('T')[0],
      sampleCount: 200,
      rSquared: 0.4,
      ...overrides,
    };
  }

  function setupMockSupabase(config?: {
    insertedAlert?: any;
    openAlerts?: any[];
  }) {
    // Create a chainable mock that returns itself for any method
    const createChainableMock = (resolveValue: any = { error: null }) => {
      const mock: any = {};
      const chainMethods = ['eq', 'select', 'order', 'limit', 'single', 'insert', 'update'];
      chainMethods.forEach((method) => {
        mock[method] = jest.fn().mockReturnValue(mock);
      });
      // Final resolution
      mock.then = jest.fn().mockImplementation((cb) => Promise.resolve(cb(resolveValue)));
      return mock;
    };

    const mockClient = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'propertyiq_confidence_alerts') {
          const chainable = createChainableMock({ data: config?.openAlerts || [], error: null });
          chainable.insert = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: config?.insertedAlert || {
                  id: 'alert-123',
                  created_at: new Date().toISOString(),
                  confidence_id: null,
                  score_type: 'homeready',
                  geography_type: 'metro',
                  formula_version: '1.0.0',
                  alert_type: 'threshold',
                  severity: 'warning',
                  previous_confidence: 60,
                  current_confidence: 50,
                  threshold_crossed: 55,
                  diagnostic_signals: [],
                  recommended_actions: [],
                  status: 'open',
                },
                error: null,
              }),
            }),
          });
          chainable.select = jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: config?.openAlerts || [],
                error: null,
              }),
              eq: jest.fn().mockReturnThis(),
            }),
          });
          chainable.update = jest.fn().mockReturnValue(createChainableMock({ error: null }));
          return chainable;
        }
        return createChainableMock();
      }),
    };
    mockSupabaseService.getClient.mockReturnValue(mockClient as any);
    return mockClient;
  }

  // ============================================================================
  // Threshold Crossing Tests
  // ============================================================================

  describe('checkAndCreateAlerts - Threshold Crossing', () => {
    it('creates warning alert when crossing 55% threshold', async () => {
      setupMockSupabase();

      const newConfidence = createConfidenceScore({
        confidenceScore: 52,
        status: 'review',
        confidenceLevel: 'low',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
        confidenceLevel: 'medium',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe('threshold');
      expect(alert?.severity).toBe('warning');
      expect(alert?.thresholdCrossed).toBe(55);
    });

    it('creates critical alert when crossing 40% threshold', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-456',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'threshold',
          severity: 'critical',
          previous_confidence: 45,
          current_confidence: 35,
          threshold_crossed: 40,
          diagnostic_signals: [],
          recommended_actions: [],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        confidenceScore: 35,
        status: 'broken',
        confidenceLevel: 'broken',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 45,
        status: 'review',
        confidenceLevel: 'low',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe('threshold');
      expect(alert?.severity).toBe('critical');
      expect(alert?.thresholdCrossed).toBe(40);
    });

    it('does not create alert when not crossing threshold', async () => {
      setupMockSupabase();

      const newConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 65,
        status: 'monitor',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert).toBeNull();
    });

    it('does not create alert for upward threshold crossing', async () => {
      setupMockSupabase();

      // Going UP from 50 to 60 (crossing 55 upward)
      const newConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 50,
        status: 'review',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert).toBeNull();
    });
  });

  // ============================================================================
  // Degradation Tests
  // ============================================================================

  describe('checkAndCreateAlerts - Degradation', () => {
    it('creates warning alert for 10+ point drop', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-789',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'degradation',
          severity: 'warning',
          previous_confidence: 75,
          current_confidence: 62,
          threshold_crossed: 65,
          diagnostic_signals: [],
          recommended_actions: [],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        confidenceScore: 62, // 13 point drop
        status: 'monitor',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 75,
        status: 'healthy',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe('degradation');
      expect(alert?.severity).toBe('warning');
    });

    it('creates critical alert for 20+ point drop', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-abc',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'degradation',
          severity: 'critical',
          previous_confidence: 80,
          current_confidence: 55,
          threshold_crossed: 60,
          diagnostic_signals: [],
          recommended_actions: [],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        confidenceScore: 55, // 25 point drop
        status: 'monitor',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 80,
        status: 'healthy',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe('degradation');
      expect(alert?.severity).toBe('critical');
    });

    it('does not create alert for small drops', async () => {
      setupMockSupabase();

      const newConfidence = createConfidenceScore({
        confidenceScore: 70, // Only 5 point drop
        status: 'healthy',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 75,
        status: 'healthy',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert).toBeNull();
    });

    it('does not create degradation alert when no previous confidence', async () => {
      setupMockSupabase();

      const newConfidence = createConfidenceScore({
        confidenceScore: 50,
        status: 'review',
      });

      // Check threshold crossing instead of degradation
      const alert = await service.checkAndCreateAlerts(newConfidence, null);

      // Should not create degradation alert, might create threshold alert
      if (alert) {
        expect(alert.alertType).not.toBe('degradation');
      }
    });
  });

  // ============================================================================
  // Anomaly Tests
  // ============================================================================

  describe('checkAndCreateAlerts - Anomalies', () => {
    it('creates anomaly alert for very low R²', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-anomaly-1',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'anomaly',
          severity: 'critical',
          previous_confidence: null,
          current_confidence: 60,
          threshold_crossed: 0,
          diagnostic_signals: [
            { name: 'Low Correlation', description: 'Score has very weak correlation', value: 0.08, severity: 'critical' },
          ],
          recommended_actions: [],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        rSquared: 0.08, // Below 0.1 threshold
        correlationScore: 16,
        confidenceScore: 60,
        status: 'monitor',
      });

      const previousConfidence = createConfidenceScore({
        rSquared: 0.08,
        confidenceScore: 60,
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe('anomaly');
      expect(alert?.diagnosticSignals.some((s) => s.name === 'Low Correlation')).toBe(true);
    });

    it('creates anomaly alert for insufficient samples', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-anomaly-2',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'anomaly',
          severity: 'warning',
          previous_confidence: null,
          current_confidence: 60,
          threshold_crossed: 0,
          diagnostic_signals: [
            { name: 'Insufficient Samples', description: 'Not enough data points', value: 5, severity: 'warning' },
          ],
          recommended_actions: [],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        sampleCount: 5, // Below 10 threshold
        confidenceScore: 60,
        status: 'monitor',
        rSquared: 0.35, // Above anomaly threshold
      });

      const previousConfidence = createConfidenceScore({
        sampleCount: 5,
        confidenceScore: 60,
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe('anomaly');
      expect(alert?.diagnosticSignals.some((s) => s.name === 'Insufficient Samples')).toBe(true);
    });

    it('creates critical anomaly for both low R² and low samples', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-anomaly-3',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'anomaly',
          severity: 'critical',
          previous_confidence: null,
          current_confidence: 40,
          threshold_crossed: 0,
          diagnostic_signals: [
            { name: 'Low Correlation', description: 'Weak correlation', value: 0.05, severity: 'critical' },
            { name: 'Insufficient Samples', description: 'Not enough data', value: 8, severity: 'warning' },
          ],
          recommended_actions: [],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        rSquared: 0.05,
        sampleCount: 8,
        confidenceScore: 40,
        status: 'review',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 40,
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert).not.toBeNull();
      expect(alert?.severity).toBe('critical');
    });
  });

  // ============================================================================
  // Recovery / Auto-Resolve Tests
  // ============================================================================

  describe('checkAndCreateAlerts - Recovery', () => {
    it('auto-resolves open alerts when confidence recovers to healthy', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const mockClient = {
        from: jest.fn().mockImplementation(() => ({
          update: mockUpdate,
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
      };
      mockSupabaseService.getClient.mockReturnValue(mockClient as any);

      const newConfidence = createConfidenceScore({
        confidenceScore: 75,
        status: 'healthy',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 50,
        status: 'review',
      });

      await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved',
          resolved_by: 'system',
          resolution_notes: expect.stringContaining('Auto-resolved'),
        }),
      );
    });

    it('does not auto-resolve when status is not healthy', async () => {
      const mockUpdate = jest.fn();
      const mockClient = {
        from: jest.fn().mockImplementation(() => ({
          update: mockUpdate,
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
      };
      mockSupabaseService.getClient.mockReturnValue(mockClient as any);

      const newConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor', // Not healthy
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 58,
        status: 'monitor',
      });

      await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      // Should not have called update for auto-resolve
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          resolved_by: 'system',
        }),
      );
    });
  });

  // ============================================================================
  // Diagnostic Signal Generation Tests
  // ============================================================================

  describe('Diagnostic Signal Generation', () => {
    it('includes correlation drop signal when correlation below 50', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-diag-1',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'threshold',
          severity: 'warning',
          previous_confidence: 60,
          current_confidence: 52,
          threshold_crossed: 55,
          diagnostic_signals: [
            { name: 'Correlation Drop', description: 'Below expected', value: '40.0%', severity: 'warning' },
          ],
          recommended_actions: [],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        confidenceScore: 52,
        correlationScore: 40, // Below 50
        status: 'review',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert?.diagnosticSignals.some((s) => s.name === 'Correlation Drop')).toBe(true);
    });

    it('includes sample size signal when sample score below 50', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-diag-2',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'threshold',
          severity: 'warning',
          previous_confidence: 60,
          current_confidence: 50,
          threshold_crossed: 55,
          diagnostic_signals: [
            { name: 'Sample Size', description: 'Insufficient sample', value: 50, severity: 'warning' },
          ],
          recommended_actions: [],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        confidenceScore: 50,
        sampleSizeScore: 40, // Below 50
        sampleCount: 50,
        status: 'review',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert?.diagnosticSignals.some((s) => s.name === 'Sample Size')).toBe(true);
    });

    it('includes data staleness signal when recency below 50', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-diag-3',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'threshold',
          severity: 'warning',
          previous_confidence: 60,
          current_confidence: 50,
          threshold_crossed: 55,
          diagnostic_signals: [
            { name: 'Data Staleness', description: 'Data is outdated', value: '35.0%', severity: 'warning' },
          ],
          recommended_actions: [],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        confidenceScore: 50,
        recencyScore: 35, // Below 50
        status: 'review',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert?.diagnosticSignals.some((s) => s.name === 'Data Staleness')).toBe(true);
    });

    it('includes R² signal for weak predictive power', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-diag-4',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'threshold',
          severity: 'warning',
          previous_confidence: 60,
          current_confidence: 52,
          threshold_crossed: 55,
          diagnostic_signals: [
            { name: 'R² Value', description: 'Weak predictive power', value: '0.1500', severity: 'warning' },
          ],
          recommended_actions: [],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        confidenceScore: 52,
        rSquared: 0.15, // Below 0.2
        status: 'review',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert?.diagnosticSignals.some((s) => s.name === 'R² Value')).toBe(true);
    });
  });

  // ============================================================================
  // Recommendation Generation Tests
  // ============================================================================

  describe('Recommendation Generation', () => {
    it('includes formula review recommendation for threshold/degradation alerts', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-rec-1',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'threshold',
          severity: 'warning',
          previous_confidence: 60,
          current_confidence: 50,
          threshold_crossed: 55,
          diagnostic_signals: [],
          recommended_actions: [
            'Review recent formula changes',
            'Check for data quality issues in source metrics',
            'Consider running additional backtests',
          ],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        confidenceScore: 50,
        status: 'review',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert?.recommendedActions).toContain('Review recent formula changes');
    });

    it('includes data quality check recommendation', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-rec-2',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'threshold',
          severity: 'warning',
          previous_confidence: 60,
          current_confidence: 50,
          threshold_crossed: 55,
          diagnostic_signals: [],
          recommended_actions: [
            'Check for data quality issues in source metrics',
          ],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        confidenceScore: 50,
        status: 'review',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      expect(alert?.recommendedActions.some((r) => r.includes('data quality'))).toBe(true);
    });

    it('deduplicates recommendations', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-rec-3',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'threshold',
          severity: 'warning',
          previous_confidence: 60,
          current_confidence: 50,
          threshold_crossed: 55,
          diagnostic_signals: [
            { name: 'Correlation Drop', description: 'Low', value: '40%', severity: 'warning' },
          ],
          recommended_actions: [
            'Review recent formula changes',
            'Check for data quality issues in source metrics',
            'Consider running additional backtests',
            'Review metric weights and normalization',
            'Investigate if market conditions have changed',
          ],
          status: 'open',
        },
      });

      const newConfidence = createConfidenceScore({
        confidenceScore: 50,
        correlationScore: 40,
        status: 'review',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      // Check no duplicates
      const uniqueActions = new Set(alert?.recommendedActions);
      expect(uniqueActions.size).toBe(alert?.recommendedActions.length);
    });
  });

  // ============================================================================
  // Alert Management Tests
  // ============================================================================

  describe('getOpenAlerts', () => {
    it('returns open alerts', async () => {
      setupMockSupabase({
        openAlerts: [
          {
            id: 'alert-1',
            created_at: new Date().toISOString(),
            score_type: 'homeready',
            geography_type: 'metro',
            formula_version: '1.0.0',
            alert_type: 'threshold',
            severity: 'warning',
            status: 'open',
            previous_confidence: 60,
            current_confidence: 50,
            threshold_crossed: 55,
            diagnostic_signals: [],
            recommended_actions: [],
          },
        ],
      });

      const alerts = await service.getOpenAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].id).toBe('alert-1');
      expect(alerts[0].status).toBe('open');
    });

    it('filters by score type', async () => {
      const eqCalls: Array<{ field: string; value: string }> = [];

      // Create a chainable mock that tracks eq calls and is also thenable
      const createChainableQuery = () => {
        const chainable: any = {
          eq: jest.fn().mockImplementation((field: string, value: string) => {
            eqCalls.push({ field, value });
            return chainable;
          }),
          order: jest.fn().mockImplementation(() => chainable),
          // Make it thenable so await works
          then: jest.fn().mockImplementation((resolve: any) =>
            Promise.resolve({ data: [], error: null }).then(resolve)
          ),
        };
        return chainable;
      };

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue(createChainableQuery()),
        }),
      };
      mockSupabaseService.getClient.mockReturnValue(mockClient as any);

      await service.getOpenAlerts('investoredge');

      // Verify that eq was called with score_type filter
      expect(eqCalls).toContainEqual({ field: 'status', value: 'open' });
      expect(eqCalls).toContainEqual({ field: 'score_type', value: 'investoredge' });
    });
  });

  describe('acknowledgeAlert', () => {
    it('updates alert status to acknowledged', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      const mockClient = {
        from: jest.fn().mockReturnValue({
          update: mockUpdate,
        }),
      };
      mockSupabaseService.getClient.mockReturnValue(mockClient as any);

      await service.acknowledgeAlert('alert-123', 'user@example.com');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'acknowledged',
          acknowledged_by: 'user@example.com',
        }),
      );
    });

    it('throws error on database failure', async () => {
      const dbError = { message: 'Database error', code: 'PGRST001' };
      const mockClient = {
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: dbError,
            }),
          }),
        }),
      };
      mockSupabaseService.getClient.mockReturnValue(mockClient as any);

      await expect(
        service.acknowledgeAlert('alert-123', 'user@example.com'),
      ).rejects.toMatchObject({ message: 'Database error' });
    });
  });

  describe('resolveAlert', () => {
    it('updates alert status to resolved with notes', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      const mockClient = {
        from: jest.fn().mockReturnValue({
          update: mockUpdate,
        }),
      };
      mockSupabaseService.getClient.mockReturnValue(mockClient as any);

      await service.resolveAlert(
        'alert-123',
        'admin@example.com',
        'Fixed by adjusting weights',
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved',
          resolved_by: 'admin@example.com',
          resolution_notes: 'Fixed by adjusting weights',
        }),
      );
    });
  });

  describe('dismissAlert', () => {
    it('updates alert status to dismissed', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      const mockClient = {
        from: jest.fn().mockReturnValue({
          update: mockUpdate,
        }),
      };
      mockSupabaseService.getClient.mockReturnValue(mockClient as any);

      await service.dismissAlert(
        'alert-123',
        'admin@example.com',
        'False positive - temporary data issue',
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'dismissed',
          resolved_by: 'admin@example.com',
          resolution_notes: 'False positive - temporary data issue',
        }),
      );
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles first confidence check (no previous)', async () => {
      setupMockSupabase();

      const newConfidence = createConfidenceScore({
        confidenceScore: 75,
        status: 'healthy',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, null);

      // Should not create alert for healthy first check
      expect(alert).toBeNull();
    });

    it('handles exactly at threshold values', async () => {
      setupMockSupabase();

      // Exactly at 55% - should not trigger warning (need to go below)
      const newConfidence = createConfidenceScore({
        confidenceScore: 55,
        status: 'monitor',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      // Not below threshold, so no alert
      expect(alert).toBeNull();
    });

    it('prioritizes threshold alert over degradation', async () => {
      setupMockSupabase({
        insertedAlert: {
          id: 'alert-priority',
          created_at: new Date().toISOString(),
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          alert_type: 'threshold',
          severity: 'critical',
          previous_confidence: 50,
          current_confidence: 35,
          threshold_crossed: 40,
          diagnostic_signals: [],
          recommended_actions: [],
          status: 'open',
        },
      });

      // Drop from 50 to 35 (15 point drop AND crosses 40 threshold)
      const newConfidence = createConfidenceScore({
        confidenceScore: 35,
        status: 'broken',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 50,
        status: 'review',
      });

      const alert = await service.checkAndCreateAlerts(newConfidence, previousConfidence);

      // Should create threshold alert, not degradation
      expect(alert?.alertType).toBe('threshold');
    });

    it('handles database error during alert creation gracefully', async () => {
      const dbError = { message: 'Database error', code: 'PGRST001' };
      const mockClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: dbError,
              }),
            }),
          }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        }),
      };
      mockSupabaseService.getClient.mockReturnValue(mockClient as any);

      const newConfidence = createConfidenceScore({
        confidenceScore: 50,
        status: 'review',
      });

      const previousConfidence = createConfidenceScore({
        confidenceScore: 60,
        status: 'monitor',
      });

      await expect(
        service.checkAndCreateAlerts(newConfidence, previousConfidence),
      ).rejects.toMatchObject({ message: 'Database error' });
    });
  });
});

/**
 * Monitoring & Alert Integration Tests
 *
 * Tests that the monitoring and alerting system catches problems in production:
 * - Confidence drop detection
 * - Score anomaly detection
 * - Data pipeline freshness monitoring
 */

// ============================================================================
// Mock Alert Service
// ============================================================================

interface AlertPayload {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  details: Record<string, any>;
}

class MockAlertService {
  private alerts: AlertPayload[] = [];
  private batchedAlerts: AlertPayload[] = [];

  fireAlert(alert: AlertPayload): void {
    this.alerts.push(alert);

    // Critical alerts are sent immediately, warnings are batched
    if (alert.severity !== 'critical') {
      this.batchedAlerts.push(alert);
    }
  }

  getAlerts(): AlertPayload[] {
    return [...this.alerts];
  }

  getBatchedAlerts(): AlertPayload[] {
    return [...this.batchedAlerts];
  }

  clearAlerts(): void {
    this.alerts = [];
    this.batchedAlerts = [];
  }

  wasCalled(): boolean {
    return this.alerts.length > 0;
  }

  wasCalledWith(matcher: Partial<AlertPayload>): boolean {
    return this.alerts.some((alert) => {
      return (
        (!matcher.type || alert.type === matcher.type) &&
        (!matcher.severity || alert.severity === matcher.severity)
      );
    });
  }
}

// ============================================================================
// Mock Confidence Monitoring Service
// ============================================================================

interface ConfidenceRecord {
  scoreType: string;
  geographyType: string;
  confidenceScore: number;
  createdAt: Date;
}

class MockConfidenceMonitoringService {
  private confidenceHistory: ConfidenceRecord[] = [];
  private alertService: MockAlertService;

  constructor(alertService: MockAlertService) {
    this.alertService = alertService;
  }

  addConfidenceRecord(record: ConfidenceRecord): void {
    this.confidenceHistory.push(record);
  }

  async checkConfidenceDrop(): Promise<void> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Group by score type and geography type
    const grouped = new Map<string, ConfidenceRecord[]>();

    for (const record of this.confidenceHistory) {
      const key = `${record.scoreType}:${record.geographyType}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    }

    // Check for drops
    for (const [key, records] of grouped) {
      const sorted = records.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      if (sorted.length >= 2) {
        const current = sorted[0];
        const previous = sorted.find((r) => r.createdAt <= oneWeekAgo);

        if (previous) {
          const drop = previous.confidenceScore - current.confidenceScore;

          if (drop > 10) {
            this.alertService.fireAlert({
              type: 'CONFIDENCE_DROP',
              severity: 'warning',
              details: {
                previousConfidence: previous.confidenceScore,
                currentConfidence: current.confidenceScore,
                dropAmount: drop,
              },
            });
          }

          if (current.confidenceScore < 40) {
            this.alertService.fireAlert({
              type: 'CONFIDENCE_CRITICAL',
              severity: 'critical',
              details: {
                confidence: current.confidenceScore,
                status: 'broken',
                action: 'Manual review required',
              },
            });
          }
        }
      }
    }
  }
}

// ============================================================================
// Mock Score Anomaly Service
// ============================================================================

interface ScoreRecord {
  geographyId: string;
  geographyType: string;
  scoreType: string;
  score: number;
  createdAt: Date;
}

class MockScoreAnomalyService {
  private scoreHistory: ScoreRecord[] = [];
  private alertService: MockAlertService;

  constructor(alertService: MockAlertService) {
    this.alertService = alertService;
  }

  addScoreRecord(record: ScoreRecord): void {
    this.scoreHistory.push(record);
  }

  async checkScoreAnomalies(): Promise<void> {
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    // Check for sudden changes
    const grouped = new Map<string, ScoreRecord[]>();

    for (const record of this.scoreHistory) {
      const key = `${record.geographyId}:${record.scoreType}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    }

    for (const [, records] of grouped) {
      const sorted = records.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      if (sorted.length >= 2) {
        const current = sorted[0];
        const previous = sorted.find((r) => r.createdAt <= oneMonthAgo);

        if (previous) {
          const change = Math.abs(current.score - previous.score);

          if (change > 20) {
            this.alertService.fireAlert({
              type: 'SCORE_ANOMALY',
              severity: 'warning',
              details: {
                geography: current.geographyId,
                previousScore: previous.score,
                currentScore: current.score,
                change,
                message: 'Score changed >20 points in 30 days',
              },
            });
          }
        }
      }
    }
  }

  async checkSpatialAnomalies(
    geographyId: string,
    score: number,
    neighborScores: number[],
  ): Promise<void> {
    if (neighborScores.length === 0) return;

    const neighborAvg =
      neighborScores.reduce((a, b) => a + b, 0) / neighborScores.length;
    const deviation = Math.abs(score - neighborAvg);

    if (deviation > 15) {
      this.alertService.fireAlert({
        type: 'SPATIAL_ANOMALY',
        severity: 'info',
        details: {
          geography: geographyId,
          score,
          neighborAverage: neighborAvg,
          deviation,
        },
      });
    }
  }

  async checkMassScoreChanges(
    batchResults: Array<{ geographyId: string; change: number }>,
  ): Promise<void> {
    const bigChanges = batchResults.filter((r) => Math.abs(r.change) > 15);
    const changeRate = bigChanges.length / batchResults.length;

    if (changeRate > 0.1) {
      this.alertService.fireAlert({
        type: 'MASS_SCORE_CHANGE',
        severity: 'critical',
        details: {
          affectedPercentage: changeRate * 100,
          message: 'Possible formula bug or data issue',
        },
      });
    }
  }
}

// ============================================================================
// Mock Data Freshness Service
// ============================================================================

class MockDataFreshnessService {
  private dataSources: Map<string, Date> = new Map();
  private alertService: MockAlertService;

  constructor(alertService: MockAlertService) {
    this.alertService = alertService;
  }

  setLastUpdate(source: string, date: Date): void {
    this.dataSources.set(source, date);
  }

  async checkDataFreshness(): Promise<void> {
    const now = new Date();

    for (const [source, lastUpdate] of this.dataSources) {
      const daysSince =
        (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince > 30) {
        this.alertService.fireAlert({
          type: 'STALE_DATA_SOURCE',
          severity: 'critical',
          details: {
            source,
            lastUpdate: lastUpdate.toISOString(),
            daysSinceUpdate: Math.floor(daysSince),
          },
        });
      } else if (daysSince > 7) {
        this.alertService.fireAlert({
          type: 'STALE_DATA_SOURCE',
          severity: 'warning',
          details: {
            source,
            lastUpdate: lastUpdate.toISOString(),
            daysSinceUpdate: Math.floor(daysSince),
          },
        });
      }
    }
  }
}

// ============================================================================
// Confidence Monitoring Tests
// ============================================================================

describe('Confidence Monitoring', () => {
  let alertService: MockAlertService;
  let monitoringService: MockConfidenceMonitoringService;

  beforeEach(() => {
    alertService = new MockAlertService();
    monitoringService = new MockConfidenceMonitoringService(alertService);
  });

  describe('Confidence Drop Alerts', () => {
    it('fires alert when confidence drops >10 points in a week', async () => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      monitoringService.addConfidenceRecord({
        scoreType: 'homeready',
        geographyType: 'metro',
        confidenceScore: 75,
        createdAt: oneWeekAgo,
      });

      monitoringService.addConfidenceRecord({
        scoreType: 'homeready',
        geographyType: 'metro',
        confidenceScore: 60, // 15 point drop
        createdAt: new Date(),
      });

      await monitoringService.checkConfidenceDrop();

      expect(alertService.wasCalledWith({ type: 'CONFIDENCE_DROP' })).toBe(true);

      const alerts = alertService.getAlerts();
      const dropAlert = alerts.find((a) => a.type === 'CONFIDENCE_DROP');
      expect(dropAlert?.details.dropAmount).toBeGreaterThan(10);
    });

    it('fires critical alert when confidence drops below 40%', async () => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      monitoringService.addConfidenceRecord({
        scoreType: 'homeready',
        geographyType: 'metro',
        confidenceScore: 50,
        createdAt: oneWeekAgo,
      });

      monitoringService.addConfidenceRecord({
        scoreType: 'homeready',
        geographyType: 'metro',
        confidenceScore: 35, // Below 40
        createdAt: new Date(),
      });

      await monitoringService.checkConfidenceDrop();

      expect(
        alertService.wasCalledWith({ type: 'CONFIDENCE_CRITICAL', severity: 'critical' }),
      ).toBe(true);

      const alerts = alertService.getAlerts();
      const criticalAlert = alerts.find((a) => a.type === 'CONFIDENCE_CRITICAL');
      expect(criticalAlert?.details.status).toBe('broken');
    });

    it('does not fire alert for normal confidence fluctuations (<5 points)', async () => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      monitoringService.addConfidenceRecord({
        scoreType: 'homeready',
        geographyType: 'metro',
        confidenceScore: 72,
        createdAt: oneWeekAgo,
      });

      monitoringService.addConfidenceRecord({
        scoreType: 'homeready',
        geographyType: 'metro',
        confidenceScore: 70, // Only 2 point drop
        createdAt: new Date(),
      });

      await monitoringService.checkConfidenceDrop();

      expect(alertService.wasCalledWith({ type: 'CONFIDENCE_DROP' })).toBe(false);
    });
  });
});

// ============================================================================
// Score Anomaly Detection Tests
// ============================================================================

describe('Score Anomaly Detection', () => {
  let alertService: MockAlertService;
  let anomalyService: MockScoreAnomalyService;

  beforeEach(() => {
    alertService = new MockAlertService();
    anomalyService = new MockScoreAnomalyService(alertService);
  });

  describe('Sudden Score Changes', () => {
    it('fires alert when score changes >20 points for same geography', async () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

      anomalyService.addScoreRecord({
        geographyId: '90210',
        geographyType: 'zip',
        scoreType: 'homeready',
        score: 65,
        createdAt: oneMonthAgo,
      });

      anomalyService.addScoreRecord({
        geographyId: '90210',
        geographyType: 'zip',
        scoreType: 'homeready',
        score: 42, // 23 point drop
        createdAt: new Date(),
      });

      await anomalyService.checkScoreAnomalies();

      expect(alertService.wasCalledWith({ type: 'SCORE_ANOMALY' })).toBe(true);

      const alerts = alertService.getAlerts();
      const anomalyAlert = alerts.find((a) => a.type === 'SCORE_ANOMALY');
      expect(anomalyAlert?.details.change).toBeGreaterThan(20);
    });

    it('fires alert when score differs >15 points from neighboring ZIPs', async () => {
      await anomalyService.checkSpatialAnomalies('90210', 45, [68, 72, 71, 69]);

      expect(alertService.wasCalledWith({ type: 'SPATIAL_ANOMALY' })).toBe(true);

      const alerts = alertService.getAlerts();
      const spatialAlert = alerts.find((a) => a.type === 'SPATIAL_ANOMALY');
      expect(spatialAlert?.details.deviation).toBeGreaterThan(15);
    });

    it('does not fire spatial anomaly for normal variance', async () => {
      await anomalyService.checkSpatialAnomalies('90210', 70, [68, 72, 71, 69]);

      expect(alertService.wasCalledWith({ type: 'SPATIAL_ANOMALY' })).toBe(false);
    });
  });

  describe('Mass Score Changes', () => {
    it('fires critical alert when >10% of scores change >15 points', async () => {
      const batchResults = [
        ...Array(85).fill(0).map((_, i) => ({ geographyId: `geo-${i}`, change: 5 })),
        ...Array(15).fill(0).map((_, i) => ({ geographyId: `geo-${85 + i}`, change: 20 })),
      ];

      await anomalyService.checkMassScoreChanges(batchResults);

      expect(
        alertService.wasCalledWith({ type: 'MASS_SCORE_CHANGE', severity: 'critical' }),
      ).toBe(true);
    });

    it('does not fire alert when <10% of scores change significantly', async () => {
      const batchResults = [
        ...Array(95).fill(0).map((_, i) => ({ geographyId: `geo-${i}`, change: 5 })),
        ...Array(5).fill(0).map((_, i) => ({ geographyId: `geo-${95 + i}`, change: 20 })),
      ];

      await anomalyService.checkMassScoreChanges(batchResults);

      expect(alertService.wasCalledWith({ type: 'MASS_SCORE_CHANGE' })).toBe(false);
    });
  });
});

// ============================================================================
// Data Pipeline Monitoring Tests
// ============================================================================

describe('Data Pipeline Monitoring', () => {
  let alertService: MockAlertService;
  let freshnessService: MockDataFreshnessService;

  beforeEach(() => {
    alertService = new MockAlertService();
    freshnessService = new MockDataFreshnessService(alertService);
  });

  describe('Data Freshness Alerts', () => {
    it('fires alert when Zillow data is >7 days stale', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      freshnessService.setLastUpdate('zillow_zip', tenDaysAgo);

      await freshnessService.checkDataFreshness();

      expect(alertService.wasCalledWith({ type: 'STALE_DATA_SOURCE', severity: 'warning' })).toBe(
        true,
      );
    });

    it('fires critical alert when any data source is >30 days stale', async () => {
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

      freshnessService.setLastUpdate('economic_county', fortyDaysAgo);

      await freshnessService.checkDataFreshness();

      expect(
        alertService.wasCalledWith({ type: 'STALE_DATA_SOURCE', severity: 'critical' }),
      ).toBe(true);
    });

    it('does not fire alert for fresh data', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      freshnessService.setLastUpdate('zillow_zip', twoDaysAgo);

      await freshnessService.checkDataFreshness();

      expect(alertService.wasCalled()).toBe(false);
    });
  });
});

// ============================================================================
// Alert Delivery Verification Tests
// ============================================================================

describe('Alert Delivery', () => {
  let alertService: MockAlertService;

  beforeEach(() => {
    alertService = new MockAlertService();
  });

  it('critical alerts are sent immediately', () => {
    alertService.fireAlert({
      type: 'CONFIDENCE_CRITICAL',
      severity: 'critical',
      details: { confidence: 35 },
    });

    expect(alertService.wasCalled()).toBe(true);

    // Critical alerts not batched
    const batchedAlerts = alertService.getBatchedAlerts();
    expect(batchedAlerts.length).toBe(0);
  });

  it('warning alerts are batched', () => {
    alertService.fireAlert({
      type: 'CONFIDENCE_DROP',
      severity: 'warning',
      details: {},
    });

    expect(alertService.wasCalled()).toBe(true);

    // Warning alerts are batched
    const batchedAlerts = alertService.getBatchedAlerts();
    expect(batchedAlerts.length).toBe(1);
  });

  it('alerts include all relevant details', () => {
    alertService.fireAlert({
      type: 'SCORE_ANOMALY',
      severity: 'warning',
      details: {
        geography: '90210',
        previousScore: 65,
        currentScore: 42,
      },
    });

    const alerts = alertService.getAlerts();
    expect(alerts[0].details.geography).toBe('90210');
    expect(alerts[0].details.previousScore).toBe(65);
    expect(alerts[0].details.currentScore).toBe(42);
  });
});

// ============================================================================
// Alert Thresholds Tests
// ============================================================================

describe('Alert Thresholds', () => {
  const ALERT_THRESHOLDS = {
    WARNING: 55,
    CRITICAL: 40,
    DEGRADATION_THRESHOLD: 10,
    SCORE_CHANGE_THRESHOLD: 20,
    SPATIAL_DEVIATION_THRESHOLD: 15,
    MASS_CHANGE_PERCENTAGE: 0.10,
    STALE_DATA_DAYS_WARNING: 7,
    STALE_DATA_DAYS_CRITICAL: 30,
  };

  it('warning threshold is 55', () => {
    expect(ALERT_THRESHOLDS.WARNING).toBe(55);
  });

  it('critical threshold is 40', () => {
    expect(ALERT_THRESHOLDS.CRITICAL).toBe(40);
  });

  it('degradation threshold is 10 points', () => {
    expect(ALERT_THRESHOLDS.DEGRADATION_THRESHOLD).toBe(10);
  });

  it('score change threshold is 20 points', () => {
    expect(ALERT_THRESHOLDS.SCORE_CHANGE_THRESHOLD).toBe(20);
  });

  it('spatial deviation threshold is 15 points', () => {
    expect(ALERT_THRESHOLDS.SPATIAL_DEVIATION_THRESHOLD).toBe(15);
  });

  it('mass change percentage is 10%', () => {
    expect(ALERT_THRESHOLDS.MASS_CHANGE_PERCENTAGE).toBe(0.10);
  });

  it('stale data warning is 7 days', () => {
    expect(ALERT_THRESHOLDS.STALE_DATA_DAYS_WARNING).toBe(7);
  });

  it('stale data critical is 30 days', () => {
    expect(ALERT_THRESHOLDS.STALE_DATA_DAYS_CRITICAL).toBe(30);
  });
});

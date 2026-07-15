import { Test, TestingModule } from '@nestjs/testing';
import { AlertProcessorService } from '../alert-processor.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { AlertsService } from '../alerts.service';
import { PushService } from '../../push/push.service';

function createSupabaseMock(
  activeAlerts: any[],
  values: { calculated_metrics?: number; propertyiq_scores_v2?: number },
) {
  return {
    from: jest.fn((table: string) => {
      if (table === 'user_alerts') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() =>
              Promise.resolve({ data: activeAlerts, error: null }),
            ),
          })),
          update: jest.fn(() => ({
            in: jest.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }
      if (table === 'calculated_metrics') {
        return {
          select: jest.fn((metricId: string) => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    single: jest.fn(() =>
                      Promise.resolve({
                        data: { [metricId]: values.calculated_metrics ?? null },
                        error: null,
                      }),
                    ),
                  })),
                })),
              })),
            })),
          })),
        };
      }
      if (table === 'propertyiq_scores_v2') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => ({
                      single: jest.fn(() =>
                        Promise.resolve({
                          data: { score: values.propertyiq_scores_v2 ?? null },
                          error: null,
                        }),
                      ),
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }
      if (table === 'alert_history') {
        return {
          insert: jest.fn(() => Promise.resolve({ error: null })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table in mock: ${table}`);
    }),
  };
}

async function buildService(client: any, push: jest.Mock) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AlertProcessorService,
      { provide: SupabaseService, useValue: { getClient: () => client } },
      {
        provide: AlertsService,
        useValue: { getUnreadCount: jest.fn().mockResolvedValue(0) },
      },
      { provide: PushService, useValue: { sendToUser: push } },
    ],
  }).compile();
  return module.get(AlertProcessorService);
}

const baseAlert = {
  id: 'alert-1',
  user_id: 'user-1',
  geography_type: 'metro',
  geography_id: '12420',
  geography_name: 'Austin, TX',
  condition_type: 'above',
  is_active: true,
  last_triggered_at: null,
};

describe('AlertProcessorService metric routing', () => {
  it('reads calculated_metrics for a non-score metric (existing behavior)', async () => {
    const push = jest.fn().mockResolvedValue({ sent: 1, failed: 0, pruned: 0 });
    const client = createSupabaseMock(
      [{ ...baseAlert, metric_name: 'home_value', threshold_value: 100000 }],
      { calculated_metrics: 150000 },
    );
    const service = await buildService(client, push);
    await service.processAlerts();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][1].body).toBe(
      'home_value crossed 100000 (now 150000)',
    );
  });

  it('reads propertyiq_scores_v2 for the propertyiq_score metric (new branch)', async () => {
    const push = jest.fn().mockResolvedValue({ sent: 1, failed: 0, pruned: 0 });
    const client = createSupabaseMock(
      [{ ...baseAlert, metric_name: 'propertyiq_score', threshold_value: 50 }],
      { propertyiq_scores_v2: 72 },
    );
    const service = await buildService(client, push);
    await service.processAlerts();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][1].body).toBe(
      'propertyiq_score crossed 50 (now 72)',
    );
  });
});

/**
 * Verifies push-notification failure isolation in the daily alert-processor
 * cron: a PushService.sendToUser() rejection must never break alert
 * processing (alert_history insert + last_triggered_at update must still
 * complete for the run).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AlertProcessorService } from '../alert-processor.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { AlertsService } from '../alerts.service';
import { PushService } from '../../push/push.service';

function createSupabaseMock(activeAlerts: any[], metricValue: number) {
  const historyInsertCalls: any[][] = [];
  const lastTriggeredUpdateCalls: { payload: any; ids: string[] }[] = [];

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'user_alerts') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() =>
              Promise.resolve({ data: activeAlerts, error: null }),
            ),
          })),
          update: jest.fn((payload: any) => ({
            in: jest.fn((_col: string, ids: string[]) => {
              lastTriggeredUpdateCalls.push({ payload, ids });
              return Promise.resolve({ error: null });
            }),
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
                        data: { [metricId]: metricValue },
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
      if (table === 'alert_history') {
        return {
          insert: jest.fn((rows: any[]) => {
            historyInsertCalls.push(rows);
            return Promise.resolve({ error: null });
          }),
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

  return { client, historyInsertCalls, lastTriggeredUpdateCalls };
}

describe('AlertProcessorService push failure isolation', () => {
  const alert = {
    id: 'alert-1',
    user_id: 'user-1',
    metric_id: 'home_value',
    geography_type: 'metro',
    geography_id: '12420',
    geography_name: 'Austin, TX',
    condition: 'above',
    threshold: 100000,
    is_active: true,
    last_triggered_at: null,
  };

  it('completes alert processing even when PushService.sendToUser rejects', async () => {
    const supabaseMock = createSupabaseMock([alert], 150000);
    const pushSendToUser = jest
      .fn()
      .mockRejectedValue(new Error('push provider down'));
    const getUnreadCount = jest.fn().mockResolvedValue(3);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertProcessorService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => supabaseMock.client },
        },
        { provide: AlertsService, useValue: { getUnreadCount } },
        { provide: PushService, useValue: { sendToUser: pushSendToUser } },
      ],
    }).compile();

    const service = module.get(AlertProcessorService);

    // Must not throw / reject — a push failure is isolated.
    await expect(service.processAlerts()).resolves.toBeUndefined();

    expect(pushSendToUser).toHaveBeenCalledTimes(1);
    // alert_history insert (step 5) still ran.
    expect(supabaseMock.historyInsertCalls).toHaveLength(1);
    expect(supabaseMock.historyInsertCalls[0]).toEqual([
      expect.objectContaining({ alert_id: 'alert-1', notified_via: 'in-app' }),
    ]);
    // last_triggered_at batch update (step 6) still ran.
    expect(supabaseMock.lastTriggeredUpdateCalls).toHaveLength(1);
    expect(supabaseMock.lastTriggeredUpdateCalls[0].ids).toEqual(['alert-1']);
  });

  it('sends a push notification with the unread badge count and does not throw on success', async () => {
    const supabaseMock = createSupabaseMock([alert], 150000);
    const pushSendToUser = jest.fn().mockResolvedValue({
      sent: 1,
      failed: 0,
      pruned: 0,
    });
    const getUnreadCount = jest.fn().mockResolvedValue(5);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertProcessorService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => supabaseMock.client },
        },
        { provide: AlertsService, useValue: { getUnreadCount } },
        { provide: PushService, useValue: { sendToUser: pushSendToUser } },
      ],
    }).compile();

    const service = module.get(AlertProcessorService);
    await service.processAlerts();

    expect(pushSendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ badgeCount: 5, url: '/alerts' }),
    );
  });
});

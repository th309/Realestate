/**
 * ReportsRetentionCron Unit Tests
 *
 * Verifies:
 * - failStuckReports marks only >30-min-old 'generating' rows as failed with
 *   the user-facing interruption message, and never throws on query errors.
 * - purgeExpiredReports deletes rows older than the 90-day retention cutoff,
 *   and never throws on query errors.
 * - Cutoff timestamps are computed from "now" with the documented constants.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ReportsRetentionCron,
  REPORT_RETENTION_DAYS,
  STUCK_GENERATING_TIMEOUT_MINUTES,
  STUCK_GENERATION_ERROR_MESSAGE,
} from '../reports-retention.cron';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';

interface QueryResult {
  count: number | null;
  error: { message: string } | null;
}

/**
 * Chainable mock covering the two query shapes this cron issues:
 *   .from('reports').update(values, {count}).eq(...).lt(col, iso)  -> result
 *   .from('reports').delete({count}).lt(col, iso)                  -> result
 */
function createSupabaseMock(result: QueryResult) {
  const calls = {
    updateValues: null as unknown,
    eqArgs: null as [string, string] | null,
    updateLtArgs: null as [string, string] | null,
    deleteLtArgs: null as [string, string] | null,
  };

  const client = {
    from: jest.fn(() => ({
      update: jest.fn((values: unknown) => {
        calls.updateValues = values;
        return {
          eq: jest.fn((col: string, val: string) => {
            calls.eqArgs = [col, val];
            return {
              lt: jest.fn((ltCol: string, ltVal: string) => {
                calls.updateLtArgs = [ltCol, ltVal];
                return Promise.resolve(result);
              }),
            };
          }),
        };
      }),
      delete: jest.fn(() => ({
        lt: jest.fn((ltCol: string, ltVal: string) => {
          calls.deleteLtArgs = [ltCol, ltVal];
          return Promise.resolve(result);
        }),
      })),
    })),
  };

  return { client, calls };
}

async function buildCron(result: QueryResult) {
  const { client, calls } = createSupabaseMock(result);
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ReportsRetentionCron,
      { provide: SUPABASE_CLIENT, useValue: client },
    ],
  }).compile();
  return { cron: module.get(ReportsRetentionCron), client, calls };
}

describe('ReportsRetentionCron failStuckReports marks old generating rows failed', () => {
  it('updates status to failed with the interruption message, scoped to generating rows older than the stuck timeout', async () => {
    const { cron, calls } = await buildCron({ count: 6, error: null });
    const before = Date.now();
    await cron.failStuckReports();
    const after = Date.now();

    expect(calls.updateValues).toEqual({
      status: 'failed',
      error_message: STUCK_GENERATION_ERROR_MESSAGE,
    });
    expect(calls.eqArgs).toEqual(['status', 'generating']);

    const [ltCol, ltIso] = calls.updateLtArgs!;
    expect(ltCol).toBe('created_at');
    const cutoffMs = new Date(ltIso).getTime();
    const timeoutMs = STUCK_GENERATING_TIMEOUT_MINUTES * 60_000;
    expect(cutoffMs).toBeGreaterThanOrEqual(before - timeoutMs - 1_000);
    expect(cutoffMs).toBeLessThanOrEqual(after - timeoutMs + 1_000);
  });

  it('does not throw when the update returns an error', async () => {
    const { cron } = await buildCron({
      count: null,
      error: { message: 'permission denied' },
    });
    await expect(cron.failStuckReports()).resolves.toBeUndefined();
  });
});

describe('ReportsRetentionCron purgeExpiredReports deletes rows past retention', () => {
  it('deletes reports created before the 90-day cutoff', async () => {
    const { cron, calls } = await buildCron({ count: 152, error: null });
    await cron.purgeExpiredReports();

    const [ltCol, ltIso] = calls.deleteLtArgs!;
    expect(ltCol).toBe('created_at');

    const expected = new Date();
    expected.setDate(expected.getDate() - REPORT_RETENTION_DAYS);
    const driftMs = Math.abs(new Date(ltIso).getTime() - expected.getTime());
    expect(driftMs).toBeLessThan(60_000);
  });

  it('does not throw when the delete returns an error', async () => {
    const { cron } = await buildCron({
      count: null,
      error: { message: 'network error' },
    });
    await expect(cron.purgeExpiredReports()).resolves.toBeUndefined();
  });
});

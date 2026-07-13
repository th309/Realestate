/**
 * Regression guard for the `user_alerts` live-schema mapping (fix round 2).
 *
 * The live table's columns are metric_name/condition_type/threshold_value —
 * verified via information_schema.columns against the live DB (2026-07-12).
 * createAlert()/updateAlert() used to write metric_id/condition/threshold,
 * which don't exist on the table and made every write 500 (42703). These
 * tests pin the corrected write payloads and the aliased read shape so a
 * reversion to the dead column names fails loudly here instead of silently
 * breaking alert creation again.
 */

import { AlertsService } from './alerts.service';

describe('AlertsService.createAlert — live column mapping', () => {
  const buildEntitlements = () => ({
    checkAccess: jest.fn().mockResolvedValue({
      access: { 'feature:alerts_limit': { level: 'full' } },
    }),
  });

  it('writes metric_name/condition_type/threshold_value, never metric_id/condition/threshold', async () => {
    const singleSpy = jest.fn().mockResolvedValue({
      data: {
        id: 'alert-1',
        user_id: 'user-1',
        geography_type: 'metro',
        geography_id: '12420',
        geography_name: 'Austin, TX',
        metric_id: 'home_value',
        condition: 'above',
        threshold: 500000,
        is_active: true,
        last_triggered_at: null,
        created_at: '2026-07-12T00:00:00.000Z',
        updated_at: '2026-07-12T00:00:00.000Z',
      },
      error: null,
    });
    const insertSelectSpy = jest.fn(() => ({ single: singleSpy }));
    const insertSpy = jest.fn((_payload: Record<string, unknown>) => ({
      select: insertSelectSpy,
    }));

    // checkAlertsLimit() -> getCount(): .select('*', {count,head:true}).eq(...)
    const countEqSpy = jest.fn().mockResolvedValue({ count: 0, error: null });
    const countSelectSpy = jest.fn(() => ({ eq: countEqSpy }));

    const fromSpy = jest.fn((table: string) => {
      if (table !== 'user_alerts')
        throw new Error(`Unexpected table: ${table}`);
      return { insert: insertSpy, select: countSelectSpy };
    });

    const supabase = { getClient: () => ({ from: fromSpy }) };
    const service = new AlertsService(
      supabase as any,
      buildEntitlements() as any,
    );

    const result = await service.createAlert('user-1', {
      geography_type: 'metro',
      geography_id: '12420',
      geography_name: 'Austin, TX',
      metric_id: 'home_value',
      condition: 'above',
      threshold: 500000,
    });

    // The write payload targets the live columns...
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        metric_name: 'home_value',
        condition_type: 'above',
        threshold_value: 500000,
      }),
    );
    // ...and specifically does NOT contain the dead column names. This is
    // the regression guard: reverting to `metric_id: dto.metric_id` etc.
    // in the insert payload fails this assertion.
    const insertPayload = insertSpy.mock.calls[0][0];
    expect(insertPayload).not.toHaveProperty('metric_id');
    expect(insertPayload).not.toHaveProperty('condition');
    expect(insertPayload).not.toHaveProperty('threshold');

    // The post-insert select aliases the live columns back to the public shape.
    expect(insertSelectSpy).toHaveBeenCalledWith(
      expect.stringContaining('metric_id:metric_name'),
    );
    expect(insertSelectSpy).toHaveBeenCalledWith(
      expect.stringContaining('condition:condition_type'),
    );
    expect(insertSelectSpy).toHaveBeenCalledWith(
      expect.stringContaining('threshold:threshold_value'),
    );

    // The returned UserAlert keeps its public field names — the frontend
    // contract is unaffected by the underlying column rename.
    expect(result).toEqual(
      expect.objectContaining({
        metric_id: 'home_value',
        condition: 'above',
        threshold: 500000,
      }),
    );
  });

  it('does not call insert() at all when the entitlements limit blocks the request', async () => {
    const insertSpy = jest.fn();
    const countEqSpy = jest.fn().mockResolvedValue({ count: 3, error: null });
    const countSelectSpy = jest.fn(() => ({ eq: countEqSpy }));
    const fromSpy = jest.fn(() => ({
      insert: insertSpy,
      select: countSelectSpy,
    }));
    const supabase = { getClient: () => ({ from: fromSpy }) };
    const entitlements = {
      checkAccess: jest.fn().mockResolvedValue({
        access: { 'feature:alerts_limit': { level: 'preview', limit: 3 } },
      }),
    };
    const service = new AlertsService(supabase as any, entitlements as any);

    await expect(
      service.createAlert('user-1', {
        geography_type: 'metro',
        geography_id: '12420',
        metric_id: 'home_value',
        condition: 'above',
        threshold: 500000,
      }),
    ).rejects.toThrow('Alerts limit reached');
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe('AlertsService.updateAlert — live column mapping', () => {
  it('writes condition_type/threshold_value, never condition/threshold', async () => {
    const singleSpy = jest.fn().mockResolvedValue({
      data: {
        id: 'alert-1',
        metric_id: 'home_value',
        condition: 'below',
        threshold: 400000,
      },
      error: null,
    });
    const updateSelectSpy = jest.fn(() => ({ single: singleSpy }));
    const eq2Spy = jest.fn(() => ({ select: updateSelectSpy }));
    const eq1Spy = jest.fn(() => ({ eq: eq2Spy }));
    const updateSpy = jest.fn((_payload: Record<string, unknown>) => ({
      eq: eq1Spy,
    }));
    const fromSpy = jest.fn(() => ({ update: updateSpy }));
    const supabase = { getClient: () => ({ from: fromSpy }) };
    const service = new AlertsService(supabase as any, {} as any);

    await service.updateAlert('user-1', 'alert-1', {
      condition: 'below',
      threshold: 400000,
    });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        condition_type: 'below',
        threshold_value: 400000,
      }),
    );
    const updatePayload = updateSpy.mock.calls[0][0];
    expect(updatePayload).not.toHaveProperty('condition');
    expect(updatePayload).not.toHaveProperty('threshold');

    expect(updateSelectSpy).toHaveBeenCalledWith(
      expect.stringContaining('condition:condition_type'),
    );
    expect(updateSelectSpy).toHaveBeenCalledWith(
      expect.stringContaining('threshold:threshold_value'),
    );
  });

  it('omits condition_type/threshold_value from the write when the DTO only changes is_active', async () => {
    const singleSpy = jest.fn().mockResolvedValue({
      data: { id: 'alert-1', is_active: false },
      error: null,
    });
    const updateSelectSpy = jest.fn(() => ({ single: singleSpy }));
    const eq2Spy = jest.fn(() => ({ select: updateSelectSpy }));
    const eq1Spy = jest.fn(() => ({ eq: eq2Spy }));
    const updateSpy = jest.fn((_payload: Record<string, unknown>) => ({
      eq: eq1Spy,
    }));
    const fromSpy = jest.fn(() => ({ update: updateSpy }));
    const supabase = { getClient: () => ({ from: fromSpy }) };
    const service = new AlertsService(supabase as any, {} as any);

    await service.updateAlert('user-1', 'alert-1', { is_active: false });

    const updatePayload = updateSpy.mock.calls[0][0];
    expect(updatePayload).toEqual(
      expect.objectContaining({ is_active: false }),
    );
    expect(updatePayload).not.toHaveProperty('condition_type');
    expect(updatePayload).not.toHaveProperty('threshold_value');
  });
});

describe('AlertsService.listAlerts — live column mapping', () => {
  it('selects with the live columns aliased to the public UserAlert shape', async () => {
    const orderSpy = jest.fn().mockResolvedValue({ data: [], error: null });
    const eqSpy = jest.fn(() => ({ order: orderSpy }));
    const selectSpy = jest.fn(() => ({ eq: eqSpy }));
    const fromSpy = jest.fn(() => ({ select: selectSpy }));
    const supabase = { getClient: () => ({ from: fromSpy }) };
    const service = new AlertsService(supabase as any, {} as any);

    await service.listAlerts('user-1');

    expect(selectSpy).toHaveBeenCalledWith(
      expect.stringContaining('metric_id:metric_name'),
    );
    expect(selectSpy).toHaveBeenCalledWith(
      expect.stringContaining('condition:condition_type'),
    );
    expect(selectSpy).toHaveBeenCalledWith(
      expect.stringContaining('threshold:threshold_value'),
    );
  });
});

describe('AlertsService count queries — unaffected by the drift', () => {
  it('checkAlertsLimit/getCount use a head-count query with no column names, so they were never broken by the drift', async () => {
    // .select('*', {count:'exact', head:true}) never names metric_id/
    // condition/threshold — this test documents that fact rather than
    // guarding a fix, per the review's request to verify (not just assume)
    // these queries are drift-safe.
    const countEqSpy = jest.fn().mockResolvedValue({ count: 2, error: null });
    const countSelectSpy = jest.fn(() => ({ eq: countEqSpy }));
    const fromSpy = jest.fn(() => ({ select: countSelectSpy }));
    const supabase = { getClient: () => ({ from: fromSpy }) };
    const entitlements = {
      checkAccess: jest.fn().mockResolvedValue({
        access: { 'feature:alerts_limit': { level: 'preview', limit: 5 } },
      }),
    };
    const service = new AlertsService(supabase as any, entitlements as any);

    // createAlert() calls checkAlertsLimit() -> getCount() before the insert
    // it would otherwise attempt; give the insert chain a valid resolution
    // too so the call completes (this test only cares about the count query).
    const insertSingleSpy = jest.fn().mockResolvedValue({
      data: { id: 'alert-1' },
      error: null,
    });
    const insertSelectSpy = jest.fn(() => ({ single: insertSingleSpy }));
    const insertSpy = jest.fn(() => ({ select: insertSelectSpy }));
    fromSpy.mockImplementation(() => ({
      select: countSelectSpy,
      insert: insertSpy,
    }));

    await service.createAlert('user-1', {
      geography_type: 'metro',
      geography_id: '12420',
      metric_id: 'home_value',
      condition: 'above',
      threshold: 500000,
    });

    expect(countSelectSpy).toHaveBeenCalledWith('*', {
      count: 'exact',
      head: true,
    });
  });
});

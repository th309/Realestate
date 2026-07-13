/**
 * Regression guard for the `user_alerts` live-schema mapping.
 *
 * The live table's columns are metric_name/condition_type/threshold_value —
 * verified via information_schema.columns against the live DB (2026-07-12).
 * `fetchActiveScoreAlerts()` used to select/filter on metric_id/condition/
 * threshold, which don't exist on the table and made every call error (and
 * therefore every monthly threshold-alert run silently process zero
 * alerts). This locks in the fix: alias the select back to the public
 * `ActiveAlert` field names, and filter on the real column.
 */

import { ThresholdAlertDataService } from './threshold-alert-data.service';

describe('ThresholdAlertDataService.fetchActiveScoreAlerts', () => {
  it('selects the live columns aliased to the ActiveAlert shape and filters on metric_name', async () => {
    const inSpy = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'alert-1',
          user_id: 'user-1',
          geography_type: 'metro',
          geography_id: '12420',
          geography_name: 'Austin, TX',
          metric_id: 'propertyiq_score',
          condition: 'above',
          threshold: 70,
          last_triggered_at: null,
        },
      ],
      error: null,
    });
    const eqSpy = jest.fn(() => ({ in: inSpy }));
    const selectSpy = jest.fn(() => ({ eq: eqSpy }));
    const fromSpy = jest.fn(() => ({ select: selectSpy }));

    const service = new ThresholdAlertDataService({ from: fromSpy } as any);
    const result = await service.fetchActiveScoreAlerts();

    expect(fromSpy).toHaveBeenCalledWith('user_alerts');
    expect(selectSpy).toHaveBeenCalledWith(
      expect.stringContaining('metric_id:metric_name'),
    );
    expect(selectSpy).toHaveBeenCalledWith(
      expect.stringContaining('condition:condition_type'),
    );
    expect(selectSpy).toHaveBeenCalledWith(
      expect.stringContaining('threshold:threshold_value'),
    );
    expect(eqSpy).toHaveBeenCalledWith('is_active', true);
    // The filter must target the REAL column (metric_name), not the alias.
    expect(inSpy).toHaveBeenCalledWith(
      'metric_name',
      expect.arrayContaining(['propertyiq_score']),
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: 'alert-1',
        metric_id: 'propertyiq_score',
        condition: 'above',
        threshold: 70,
      }),
    ]);
  });

  it('returns an empty array and logs without throwing when the query errors', async () => {
    const inSpy = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'boom' } });
    const eqSpy = jest.fn(() => ({ in: inSpy }));
    const selectSpy = jest.fn(() => ({ eq: eqSpy }));
    const fromSpy = jest.fn(() => ({ select: selectSpy }));

    const service = new ThresholdAlertDataService({ from: fromSpy } as any);

    await expect(service.fetchActiveScoreAlerts()).resolves.toEqual([]);
  });
});

import { alignSeriesToAxis } from '../align-series';

describe('alignSeriesToAxis', () => {
  it('builds a shared ascending monthly axis and aligns each region to it', () => {
    const rows = [
      { regionId: 'A', date: '2026-05-31', value: 10 },
      { regionId: 'A', date: '2026-04-30', value: 9 },
      { regionId: 'B', date: '2026-05-15', value: 20 },
    ];
    const { dates, series } = alignSeriesToAxis(rows, 3);
    expect(dates).toEqual(['2026-03-01', '2026-04-01', '2026-05-01']);
    expect(series.A).toEqual([null, 9, 10]);
    expect(series.B).toEqual([null, null, 20]);
  });

  it('clamps the axis to the requested month count (most recent kept)', () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      regionId: 'A',
      date: `2026-0${i + 1}-01`,
      value: i,
    }));
    const { dates } = alignSeriesToAxis(rows, 3);
    expect(dates).toEqual(['2026-04-01', '2026-05-01', '2026-06-01']);
  });

  it('returns empty axis and series for no rows', () => {
    expect(alignSeriesToAxis([], 12)).toEqual({ dates: [], series: {} });
  });
});

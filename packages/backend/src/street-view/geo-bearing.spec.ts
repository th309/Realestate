import { bearingBetween } from './geo-bearing';

describe('bearingBetween', () => {
  it('returns 0 degrees due north', () => {
    expect(bearingBetween(0, 0, 1, 0)).toBeCloseTo(0, 5);
  });

  it('returns 90 degrees due east', () => {
    expect(bearingBetween(0, 0, 0, 1)).toBeCloseTo(90, 5);
  });

  it('returns 180 degrees due south', () => {
    expect(bearingBetween(0, 0, -1, 0)).toBeCloseTo(180, 5);
  });

  it('returns 270 degrees due west', () => {
    expect(bearingBetween(0, 0, 0, -1)).toBeCloseTo(270, 5);
  });

  it('always returns a compass bearing in [0, 360)', () => {
    const samples: Array<[number, number, number, number]> = [
      [40.4574, -88.9931, 40.4576, -88.9929],
      [40.4574, -88.9931, 40.4572, -88.9933],
      [-33.8688, 151.2093, -33.869, 151.2091],
      [51.5074, -0.1278, 51.5076, -0.128],
    ];
    for (const [aLat, aLon, bLat, bLon] of samples) {
      const bearing = bearingBetween(aLat, aLon, bLat, bLon);
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    }
  });

  it('reverses by roughly 180 degrees when the endpoints swap', () => {
    const forward = bearingBetween(40.4574, -88.9931, 40.458, -88.9925);
    const back = bearingBetween(40.458, -88.9925, 40.4574, -88.9931);
    const difference = Math.abs(((forward - back + 360) % 360) - 180);
    expect(difference).toBeLessThan(0.1);
  });
});

import { AnalyzerPrefillService } from './analyzer-prefill.service';
import type { ResolvedMetric } from '../metric-resolution/metric-resolution.types';

const NOW = new Date('2026-06-14T00:00:00Z');

function metric(partial: Partial<ResolvedMetric>): ResolvedMetric {
  return {
    value: null,
    date: null,
    source: 'none',
    sourceGeoId: null,
    sourceGeoLevel: null,
    isInherited: false,
    isFallback: false,
    ...partial,
  };
}

function makeService(opts: {
  metrics: Record<string, ResolvedMetric>;
  chain?: { id: string; level: string }[];
  rentcast?: unknown;
}) {
  const metricResolution = {
    resolveMetricBatch: jest.fn().mockResolvedValue(opts.metrics),
  };
  const geographyChain = {
    getInheritanceChain: jest.fn().mockResolvedValue(opts.chain ?? []),
  };
  const analyzerStub = {
    lookupProperty: jest.fn(),
  };
  if (opts.rentcast !== undefined) {
    analyzerStub.lookupProperty.mockResolvedValue(opts.rentcast);
  }
  const service = new AnalyzerPrefillService(
    metricResolution as never,
    geographyChain as never,
    analyzerStub as never,
  );
  return { service, metricResolution, analyzerStub };
}

describe('AnalyzerPrefillService.getPrefillBundle', () => {
  it('free tier: geo-layer data + estimates, no parcel, tax is an estimate', async () => {
    const { service } = makeService({
      metrics: {
        rent_index: metric({
          value: 1850,
          date: '2026-04-01',
          source: 'zillow',
          sourceGeoLevel: 'zip',
        }),
        home_value: metric({
          value: 410000,
          date: '2026-04-01',
          source: 'zillow',
          sourceGeoLevel: 'zip',
        }),
        home_value_yoy: metric({
          value: 6.2,
          date: '2026-04-01',
          source: 'realtor',
          sourceGeoLevel: 'zip',
        }),
      },
    });

    const bundle = await service.getPrefillBundle(
      { zip: '78702' },
      { isPro: false, now: NOW },
    );

    expect(bundle.hasParcelData).toBe(false);
    expect(bundle.fields.rentMonthly).toMatchObject({
      value: 1850,
      kind: 'data',
      source: 'Zillow ZORI',
    });
    expect(bundle.fields.appreciationPct).toMatchObject({
      value: 6.2,
      kind: 'data',
    });
    // free price from ZHVI is capped at grade C
    expect(bundle.fields.price.value).toBe(410000);
    expect(bundle.fields.price.confidence.grade).toBe('c');
    // estimates
    expect(bundle.fields.insuranceAnnual).toMatchObject({
      kind: 'estimate',
      source: 'Estimate',
    });
    expect(bundle.fields.vacancyPctOfRent).toMatchObject({
      value: 0.05,
      kind: 'estimate',
    });
    expect(bundle.fields.taxAnnual.kind).toBe('estimate');
    expect(bundle.fields.taxAnnual.value).toBe(Math.round(410000 * 0.011));
  });

  it('pro tier: parcel tax/rent/hoa override geo, marked data', async () => {
    const { service } = makeService({
      metrics: {
        rent_index: metric({
          value: 1850,
          date: '2026-04-01',
          source: 'zillow',
          sourceGeoLevel: 'zip',
        }),
        home_value: metric({
          value: 410000,
          date: '2026-04-01',
          source: 'zillow',
          sourceGeoLevel: 'zip',
        }),
        home_value_yoy: metric({
          value: 6.2,
          date: '2026-04-01',
          source: 'realtor',
          sourceGeoLevel: 'zip',
        }),
      },
      rentcast: {
        avm: { value: 425000 },
        rent: { value: 1950 },
        property_record: {
          propertyTaxes: [
            { year: 2025, total: 7200 },
            { year: 2024, total: 6900 },
          ],
          hoaFee: 45,
        },
        resolved_address: '123 Main St, Austin, TX 78702',
      },
    });

    const bundle = await service.getPrefillBundle(
      { zip: '78702', address: '123 Main St, Austin, TX 78702' },
      { isPro: true, now: NOW },
    );

    expect(bundle.hasParcelData).toBe(true);
    expect(bundle.resolvedAddress).toBe('123 Main St, Austin, TX 78702');
    expect(bundle.fields.price).toMatchObject({
      value: 425000,
      kind: 'data',
      geoLevel: 'parcel',
    });
    expect(bundle.fields.rentMonthly).toMatchObject({
      value: 1950,
      kind: 'data',
      geoLevel: 'parcel',
    });
    expect(bundle.fields.taxAnnual).toMatchObject({
      value: 7200,
      kind: 'data',
      source: 'RentCast',
      asOf: '2025',
    });
    expect(bundle.fields.hoaMonthly).toMatchObject({ value: 45, kind: 'data' });
  });

  it('pro tier: RentCast failure degrades to geo layer with a note', async () => {
    const { service, analyzerStub } = makeService({
      metrics: {
        rent_index: metric({
          value: 1850,
          date: '2026-04-01',
          source: 'zillow',
          sourceGeoLevel: 'zip',
        }),
        home_value: metric({
          value: 410000,
          date: '2026-04-01',
          source: 'zillow',
          sourceGeoLevel: 'zip',
        }),
        home_value_yoy: metric({
          value: 6.2,
          date: '2026-04-01',
          source: 'realtor',
          sourceGeoLevel: 'zip',
        }),
      },
    });
    analyzerStub.lookupProperty.mockRejectedValue(new Error('quota exceeded'));

    const bundle = await service.getPrefillBundle(
      { zip: '78702', address: '123 Main St' },
      { isPro: true, now: NOW },
    );

    expect(bundle.hasParcelData).toBe(false);
    expect(bundle.notes.join(' ')).toMatch(/parcel data unavailable/i);
    expect(bundle.fields.rentMonthly.value).toBe(1850); // geo fallback
  });

  it('returns null-valued fields (not a throw) when no geo is identifiable', async () => {
    const { service } = makeService({ metrics: {} });
    const bundle = await service.getPrefillBundle(
      {},
      { isPro: false, now: NOW },
    );
    expect(bundle.geo.zip).toBeNull();
    expect(bundle.fields.rentMonthly.value).toBeNull();
  });
});

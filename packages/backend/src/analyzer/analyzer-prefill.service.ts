import { Injectable, Logger } from '@nestjs/common';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GeographyChainService } from '../metric-resolution/geography-chain.service';
import type {
  ResolvedMetric,
  GeoChainStep,
} from '../metric-resolution/metric-resolution.types';
import { AnalyzerService } from './analyzer.service';
import {
  gradeDataField,
  gradeEstimate,
  type PrefillGeoLevel,
} from './prefill-grade';
import {
  estimateInsuranceAnnual,
  estimateVacancyFraction,
  estimateRentGrowthFraction,
  estimateTaxAnnual,
} from './prefill-estimates';
import type {
  AnalyzerPrefillDto,
  AnalyzerPrefillQueryDto,
  PrefillFieldDto,
} from './dto/analyzer-prefill.dto';

/** Whole months between an as-of date/year and `now` (0 if unparseable). */
function monthsStaleFrom(asOf: string | null, now: Date): number {
  if (!asOf) return 0;
  const asYear = /^\d{4}$/.test(asOf)
    ? new Date(`${asOf}-12-31T00:00:00Z`)
    : new Date(asOf);
  if (Number.isNaN(asYear.getTime())) return 0;
  const months =
    (now.getUTCFullYear() - asYear.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - asYear.getUTCMonth());
  return Math.max(0, months);
}

function asPrefillGeoLevel(level: string | null): PrefillGeoLevel {
  if (
    level === 'zip' ||
    level === 'county' ||
    level === 'metro' ||
    level === 'state'
  )
    return level;
  return null;
}

/** Build a data-backed field from a ResolvedMetric. */
function dataField(
  resolved: ResolvedMetric | undefined,
  now: Date,
  sourceLabel: string,
  opts: { capPct?: number } = {},
): PrefillFieldDto {
  if (!resolved || resolved.value == null) {
    return {
      value: null,
      source: null,
      asOf: null,
      confidence: gradeEstimate('constant'),
      kind: 'estimate',
      geoLevel: null,
      inherited: false,
    };
  }
  const geoLevel = asPrefillGeoLevel(resolved.sourceGeoLevel);
  return {
    value: resolved.value,
    source: sourceLabel,
    asOf: resolved.date,
    confidence: gradeDataField({
      geoLevel,
      monthsStale: monthsStaleFrom(resolved.date, now),
      isFallback: resolved.isFallback,
      capPct: opts.capPct,
    }),
    kind: 'data',
    geoLevel,
    inherited: resolved.isInherited,
  };
}

function estimateField(
  value: number | null,
  kind: 'constant' | 'market',
): PrefillFieldDto {
  return {
    value,
    source: kind === 'market' ? 'Estimate (market-based)' : 'Estimate',
    asOf: null,
    confidence: gradeEstimate(kind),
    kind: 'estimate',
    geoLevel: null,
    inherited: false,
  };
}

function parcelField(
  value: number | null,
  asOf: string | null,
): PrefillFieldDto {
  return {
    value,
    source: 'RentCast',
    asOf,
    confidence: gradeDataField({
      geoLevel: 'parcel',
      monthsStale: 0,
      isFallback: false,
    }),
    kind: 'data',
    geoLevel: 'parcel',
    inherited: false,
  };
}

@Injectable()
export class AnalyzerPrefillService {
  private readonly logger = new Logger(AnalyzerPrefillService.name);

  constructor(
    private readonly metricResolution: MetricResolutionService,
    private readonly geographyChain: GeographyChainService,
    private readonly analyzer: AnalyzerService,
  ) {}

  /**
   * Assemble the address-driven prefill bundle. Geo layer is resolved for all
   * tiers; the RentCast parcel layer is added only for Pro callers and
   * overrides geo values where present. Fields with no data source become
   * honest estimates. Never throws — failures degrade to nulls/estimates.
   */
  async getPrefillBundle(
    query: AnalyzerPrefillQueryDto,
    ctx: { isPro: boolean; now?: Date },
  ): Promise<AnalyzerPrefillDto> {
    const now = ctx.now ?? new Date();
    const zip = query.zip ?? null;

    const [metrics, chainSteps] = await Promise.all([
      zip
        ? this.metricResolution
            .resolveMetricBatch(
              ['rent_index', 'home_value', 'home_value_yoy'],
              'zip',
              zip,
            )
            .catch(() => ({}) as Record<string, ResolvedMetric>)
        : Promise.resolve({} as Record<string, ResolvedMetric>),
      zip
        ? this.geographyChain
            .getInheritanceChain('zip', zip)
            .catch(() => [] as GeoChainStep[])
        : Promise.resolve([] as GeoChainStep[]),
    ]);

    const chain = chainSteps.reduce<Record<string, string>>((acc, s) => {
      acc[s.level] = s.id;
      return acc;
    }, {});

    // Geo-layer fields. Free-tier price proxy (ZHVI) is capped at grade C.
    const appreciation = dataField(metrics.home_value_yoy, now, 'Realtor');
    let price = dataField(metrics.home_value, now, 'Zillow ZHVI', {
      capPct: 60,
    });
    let rentMonthly = dataField(metrics.rent_index, now, 'Zillow ZORI');
    let taxAnnual = estimateField(estimateTaxAnnual(price.value), 'market');
    let hoaMonthly = estimateField(0, 'constant');

    const notes: string[] = [];
    let resolvedAddress: string | null = null;
    let hasParcelData = false;

    // Parcel layer (Pro + address only).
    if (ctx.isPro && query.address) {
      try {
        const parcel = await this.analyzer.lookupProperty(query.address);
        resolvedAddress = parcel.resolved_address ?? null;
        if (parcel.avm?.value != null)
          price = parcelField(parcel.avm.value, null);
        if (parcel.rent?.value != null)
          rentMonthly = parcelField(parcel.rent.value, null);
        const taxes = parcel.property_record?.propertyTaxes ?? [];
        const latestTax = taxes.length > 0 ? taxes[0] : null;
        if (latestTax?.total != null) {
          taxAnnual = parcelField(latestTax.total, String(latestTax.year));
        }
        const hoa = parcel.property_record?.hoaFee;
        if (hoa != null) hoaMonthly = parcelField(hoa, null);
        hasParcelData = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[getPrefillBundle] RentCast parcel layer failed: ${message}`,
        );
        notes.push('Parcel data unavailable — showing market estimates.');
      }
    }

    const insuranceAnnual = estimateField(
      estimateInsuranceAnnual(price.value),
      'constant',
    );
    const vacancyPctOfRent = estimateField(
      estimateVacancyFraction(),
      'constant',
    );
    const rentGrowthPct = estimateField(
      estimateRentGrowthFraction(appreciation.value),
      'market',
    );

    return {
      resolvedAddress,
      geo: {
        zip,
        countyFips: chain.county ?? null,
        cbsaCode: chain.metro ?? null,
        state: chain.state ?? null,
      },
      hasParcelData,
      fields: {
        price,
        rentMonthly,
        taxAnnual,
        insuranceAnnual,
        hoaMonthly,
        vacancyPctOfRent,
        appreciationPct: appreciation,
        rentGrowthPct,
      },
      notes,
    };
  }
}

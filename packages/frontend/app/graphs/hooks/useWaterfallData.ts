/**
 * USE WATERFALL DATA HOOK
 *
 * Builds WaterfallBar[] arrays for each waterfall preset type.
 * All data fetching goes through @/lib/data hooks (useSnapshotData, useScoreData).
 *
 * Presets:
 * - investment:    Cap rate decomposition from rent and home value
 * - affordability: Income vs home price gap analysis
 * - momentum:      YoY change factors that push or drag the market
 * - benchmark:     Location metric values minus national averages
 * - score:         PropertyIQ score component breakdown (Pro-gated)
 */

import { useMemo } from 'react';
import type { GeoLevel, ScoreType } from '@/lib/data';
import {
  useSnapshotData,
  useScoreData,
  formatMetricValue,
  getMetricFormat,
  getMetricTitle,
} from '@/lib/data';
import type { WaterfallBar } from '@/lib/visualizations/d3/WaterfallChart';
import { WATERFALL_PRESETS } from '../constants/waterfallConfigs';
import type { WaterfallPreset } from '../constants/waterfallConfigs';
import { getScoreFormula } from '../constants/scoreFormulas';

// Re-export for consumer convenience
export type { WaterfallPreset } from '../constants/waterfallConfigs';

export interface UseWaterfallDataResult {
  bars: WaterfallBar[];
  title: string;
  totalValue: number;
  totalLabel: string;
  isLoading: boolean;
  error: Error | null;
  proGated: boolean;
}

/**
 * Hook that builds WaterfallBar[] data for a given preset, geography, and region.
 *
 * @param preset - Which waterfall breakdown to compute
 * @param geoLevel - Geography level (metro, county, zip, etc.)
 * @param regionId - Region identifier to fetch data for
 * @param scoreType - Score type for the 'score' preset (default: 'homeready')
 *
 * @example
 * const { bars, totalValue, totalLabel, isLoading } = useWaterfallData(
 *   'investment', 'metro', '12420'
 * );
 */
export function useWaterfallData(
  preset: WaterfallPreset,
  geoLevel: GeoLevel,
  regionId: string | null,
  scoreType: ScoreType = 'homeready',
): UseWaterfallDataResult {
  // ──────────────────────────────────────────────────────────────────────
  // Fetch data for all presets up front so hook call order is stable.
  // Hooks that are not needed for the active preset will be disabled.
  // ──────────────────────────────────────────────────────────────────────

  const isInvestment = preset === 'investment';
  const isAffordability = preset === 'affordability';
  const isMomentum = preset === 'momentum';
  const isBenchmark = preset === 'benchmark';
  const isScore = preset === 'score';

  // ── Investment metrics ──────────────────────────────────────────────
  const rentIndex = useSnapshotData('rent_index', geoLevel, regionId ?? undefined, {
    enabled: (isInvestment || isBenchmark) && !!regionId,
  });
  const homeValue = useSnapshotData('home_value', geoLevel, regionId ?? undefined, {
    enabled: (isInvestment || isAffordability || isBenchmark) && !!regionId,
  });

  // ── Affordability metrics ──────────────────────────────────────────
  const medianIncome = useSnapshotData('median_income', geoLevel, regionId ?? undefined, {
    enabled: (isAffordability || isBenchmark) && !!regionId,
  });
  const yearsToSave = useSnapshotData('years_to_save', geoLevel, regionId ?? undefined, {
    enabled: isAffordability && !!regionId,
  });
  const affordablePrice = useSnapshotData('affordable_home_price', geoLevel, regionId ?? undefined, {
    enabled: isAffordability && !!regionId,
  });

  // ── Momentum metrics ───────────────────────────────────────────────
  const homeValueYoY = useSnapshotData('home_value_yoy', geoLevel, regionId ?? undefined, {
    enabled: isMomentum && !!regionId,
  });
  const inventoryYoY = useSnapshotData('inventory_yoy', geoLevel, regionId ?? undefined, {
    enabled: isMomentum && !!regionId,
  });
  const newListingsYoY = useSnapshotData('new_listings_yoy', geoLevel, regionId ?? undefined, {
    enabled: isMomentum && !!regionId,
  });
  const homeSalesYoY = useSnapshotData('home_sales_yoy', geoLevel, regionId ?? undefined, {
    enabled: isMomentum && !!regionId,
  });
  const popGrowth = useSnapshotData('population_growth', geoLevel, regionId ?? undefined, {
    enabled: (isMomentum || isBenchmark) && !!regionId,
  });
  const jobGrowth = useSnapshotData('job_growth', geoLevel, regionId ?? undefined, {
    enabled: (isMomentum || isBenchmark) && !!regionId,
  });

  // ── Benchmark: national-level data ─────────────────────────────────
  // Use a static national ID; for national geo level the snapshot returns
  // data keyed by state name, but we need a single national value.
  // We pass 'national' as geoLevel and 'United States' as the regionId.
  const NATIONAL_KEY = 'United States';
  const homeValueNat = useSnapshotData('home_value', 'national', NATIONAL_KEY, {
    enabled: isBenchmark && !!regionId,
  });
  const rentIndexNat = useSnapshotData('rent_index', 'national', NATIONAL_KEY, {
    enabled: isBenchmark && !!regionId,
  });
  const medianIncomeNat = useSnapshotData('median_income', 'national', NATIONAL_KEY, {
    enabled: isBenchmark && !!regionId,
  });
  const daysOnMarket = useSnapshotData('days_on_market', geoLevel, regionId ?? undefined, {
    enabled: isBenchmark && !!regionId,
  });
  const daysOnMarketNat = useSnapshotData('days_on_market', 'national', NATIONAL_KEY, {
    enabled: isBenchmark && !!regionId,
  });
  const popGrowthNat = useSnapshotData('population_growth', 'national', NATIONAL_KEY, {
    enabled: isBenchmark && !!regionId,
  });
  const jobGrowthNat = useSnapshotData('job_growth', 'national', NATIONAL_KEY, {
    enabled: isBenchmark && !!regionId,
  });

  // ── Score data ─────────────────────────────────────────────────────
  const scoreData = useScoreData(isScore ? geoLevel : null, isScore ? regionId : null, {
    enabled: isScore && !!regionId,
    expanded: true,
  });

  // ──────────────────────────────────────────────────────────────────────
  // Build bars for the active preset
  // ──────────────────────────────────────────────────────────────────────

  const config = WATERFALL_PRESETS[preset];

  const result = useMemo((): UseWaterfallDataResult => {
    const empty: UseWaterfallDataResult = {
      bars: [],
      title: config.title,
      totalValue: 0,
      totalLabel: config.totalLabel,
      isLoading: false,
      error: null,
      proGated: config.proOnly,
    };

    if (!regionId) return empty;

    // ── INVESTMENT PRESET ──────────────────────────────────────────
    if (preset === 'investment') {
      const loading = rentIndex.isLoading || homeValue.isLoading;
      const error = rentIndex.error || homeValue.error;

      if (loading || error) {
        return { ...empty, isLoading: loading, error };
      }

      const rent = rentIndex.value;
      const hv = homeValue.value;

      if (rent === null || hv === null || hv === 0) {
        return empty;
      }

      const annualRent = rent * 12;
      const expenses = annualRent * 0.4;
      const noi = annualRent - expenses;
      const capRate = (noi / hv) * 100;

      const bars: WaterfallBar[] = [
        {
          label: 'Annual Rent',
          value: annualRent,
          rawValue: rent,
          formattedRaw: formatMetricValue(rent, getMetricFormat('rent_index')),
          category: 'Income',
        },
        {
          label: 'Expenses (40%)',
          value: -expenses,
          rawValue: expenses,
          formattedRaw: formatMetricValue(expenses, 'currency'),
          category: 'Expenses',
        },
        {
          label: 'Net Operating Income',
          value: noi,
          rawValue: noi,
          formattedRaw: formatMetricValue(noi, 'currency'),
          category: 'Subtotal',
        },
      ];

      return {
        bars,
        title: config.title,
        totalValue: capRate,
        totalLabel: config.totalLabel,
        isLoading: false,
        error: null,
        proGated: false,
      };
    }

    // ── AFFORDABILITY PRESET ───────────────────────────────────────
    if (preset === 'affordability') {
      const loading =
        medianIncome.isLoading ||
        homeValue.isLoading ||
        yearsToSave.isLoading ||
        affordablePrice.isLoading;
      const error =
        medianIncome.error || homeValue.error || yearsToSave.error || affordablePrice.error;

      if (loading || error) {
        return { ...empty, isLoading: loading, error };
      }

      const income = medianIncome.value;
      const hv = homeValue.value;
      const yts = yearsToSave.value;
      const ap = affordablePrice.value;

      if (income === null || hv === null) {
        return empty;
      }

      // Affordable home price: use fetched value or calculate as 3.5x income
      const affordableHomePrice = ap ?? income * 3.5;
      const gap = hv - affordableHomePrice;

      const bars: WaterfallBar[] = [
        {
          label: 'Median Income',
          value: income,
          rawValue: income,
          formattedRaw: formatMetricValue(income, getMetricFormat('median_income')),
          category: 'Income',
        },
        {
          label: 'Affordable Price',
          value: affordableHomePrice,
          rawValue: affordableHomePrice,
          formattedRaw: formatMetricValue(affordableHomePrice, 'currency'),
          category: 'Affordability',
        },
        {
          label: 'Actual Home Price',
          value: hv,
          rawValue: hv,
          formattedRaw: formatMetricValue(hv, getMetricFormat('home_value')),
          category: 'Market',
        },
      ];

      // Include years to save as supplementary info if available
      if (yts !== null) {
        bars.push({
          label: 'Years to Save (20% Down)',
          value: yts,
          rawValue: yts,
          formattedRaw: `${yts.toFixed(1)} years`,
          category: 'Timeline',
        });
      }

      return {
        bars,
        title: config.title,
        totalValue: gap,
        totalLabel: config.totalLabel,
        isLoading: false,
        error: null,
        proGated: false,
      };
    }

    // ── MOMENTUM PRESET ────────────────────────────────────────────
    if (preset === 'momentum') {
      const metrics = [
        { result: homeValueYoY, id: 'home_value_yoy' },
        { result: inventoryYoY, id: 'inventory_yoy' },
        { result: newListingsYoY, id: 'new_listings_yoy' },
        { result: homeSalesYoY, id: 'home_sales_yoy' },
        { result: popGrowth, id: 'population_growth' },
        { result: jobGrowth, id: 'job_growth' },
      ];

      const loading = metrics.some((m) => m.result.isLoading);
      const error = metrics.find((m) => m.result.error)?.result.error ?? null;

      if (loading || error) {
        return { ...empty, isLoading: loading, error };
      }

      const bars: WaterfallBar[] = [];
      let netMomentum = 0;

      for (const m of metrics) {
        const val = m.result.value;
        if (val === null) continue;

        const format = getMetricFormat(m.id);
        bars.push({
          label: getMetricTitle(m.id),
          value: val,
          rawValue: val,
          formattedRaw: formatMetricValue(val, format),
          category: 'Momentum',
        });
        netMomentum += val;
      }

      return {
        bars,
        title: config.title,
        totalValue: netMomentum,
        totalLabel: config.totalLabel,
        isLoading: false,
        error: null,
        proGated: false,
      };
    }

    // ── BENCHMARK PRESET ───────────────────────────────────────────
    if (preset === 'benchmark') {
      const benchmarkMetrics = [
        { local: homeValue, national: homeValueNat, id: 'home_value' },
        { local: rentIndex, national: rentIndexNat, id: 'rent_index' },
        { local: medianIncome, national: medianIncomeNat, id: 'median_income' },
        { local: daysOnMarket, national: daysOnMarketNat, id: 'days_on_market' },
        { local: popGrowth, national: popGrowthNat, id: 'population_growth' },
        { local: jobGrowth, national: jobGrowthNat, id: 'job_growth' },
      ];

      const loading = benchmarkMetrics.some(
        (m) => m.local.isLoading || m.national.isLoading
      );
      const error =
        benchmarkMetrics.find((m) => m.local.error)?.local.error ??
        benchmarkMetrics.find((m) => m.national.error)?.national.error ??
        null;

      if (loading || error) {
        return { ...empty, isLoading: loading, error };
      }

      const bars: WaterfallBar[] = [];
      let netDifference = 0;

      for (const m of benchmarkMetrics) {
        const localVal = m.local.value;
        const natVal = m.national.value;
        if (localVal === null || natVal === null) continue;

        const delta = localVal - natVal;
        const format = getMetricFormat(m.id);

        bars.push({
          label: getMetricTitle(m.id),
          value: delta,
          rawValue: localVal,
          formattedRaw: formatMetricValue(localVal, format),
          category: 'Benchmark',
        });
        netDifference += delta;
      }

      return {
        bars,
        title: config.title,
        totalValue: netDifference,
        totalLabel: config.totalLabel,
        isLoading: false,
        error: null,
        proGated: false,
      };
    }

    // ── SCORE PRESET ───────────────────────────────────────────────
    if (preset === 'score') {
      const loading = scoreData.isLoading;
      const error = scoreData.error;

      if (loading || error) {
        return { ...empty, isLoading: loading, error, proGated: scoreData.gating[scoreType].gated };
      }

      if (scoreData.gating[scoreType].gated) {
        return { ...empty, proGated: true };
      }

      const selectedScore = scoreData[scoreType];
      const scoreValue = selectedScore?.score ?? 0;
      const zScores = scoreData.data?.z_scores;
      const formula = getScoreFormula(geoLevel, scoreType);

      // If we have z_scores and formula, build component breakdown bars
      if (zScores && formula) {
        const bars: WaterfallBar[] = [];

        // Sort components by absolute contribution (largest impact first)
        const components = Object.entries(formula)
          .map(([metric, mw]) => {
            const z = zScores[metric];
            if (z === undefined || z === null) return null;
            // Contribution = direction × weight × z_score
            // Positive contribution = helps the score, negative = hurts it
            const contribution = mw.direction * mw.weight * z;
            return { metric, ...mw, z, contribution };
          })
          .filter(Boolean)
          .sort((a, b) => Math.abs(b!.contribution) - Math.abs(a!.contribution)) as {
            metric: string;
            weight: number;
            direction: 1 | -1;
            label: string;
            z: number;
            contribution: number;
          }[];

        for (const comp of components) {
          // Scale contribution to approximate score points (z-scores are
          // normalised to 0-100 via percentile rank; contribution ≈ relative
          // weight of each component in that range).
          const scaledContribution = comp.contribution * 100;

          bars.push({
            label: comp.label,
            value: scaledContribution,
            rawValue: comp.z,
            formattedRaw: `z = ${comp.z >= 0 ? '+' : ''}${comp.z.toFixed(2)} (${(comp.weight * 100).toFixed(0)}%)`,
            category: comp.contribution >= 0 ? 'Positive' : 'Negative',
          });
        }

        const scoreLabel = scoreType === 'homeready' ? 'HomeReady'
          : scoreType === 'investoredge' ? 'InvestorEdge'
          : 'Market Health';

        return {
          bars,
          title: `${scoreLabel} Score Breakdown`,
          totalValue: scoreValue,
          totalLabel: `${scoreLabel}: ${scoreValue.toFixed(0)}`,
          isLoading: false,
          error: null,
          proGated: false,
        };
      }

      // Fallback: no z_scores available (non-expanded response)
      return {
        bars: [],
        title: config.title,
        totalValue: scoreValue,
        totalLabel: config.totalLabel,
        isLoading: false,
        error: null,
        proGated: false,
      };
    }

    // Fallback (should never reach here)
    return empty;
  }, [
    preset,
    regionId,
    config,
    // Investment
    rentIndex.value,
    rentIndex.isLoading,
    rentIndex.error,
    homeValue.value,
    homeValue.isLoading,
    homeValue.error,
    // Affordability
    medianIncome.value,
    medianIncome.isLoading,
    medianIncome.error,
    yearsToSave.value,
    yearsToSave.isLoading,
    yearsToSave.error,
    affordablePrice.value,
    affordablePrice.isLoading,
    affordablePrice.error,
    // Momentum
    homeValueYoY.value,
    homeValueYoY.isLoading,
    homeValueYoY.error,
    inventoryYoY.value,
    inventoryYoY.isLoading,
    inventoryYoY.error,
    newListingsYoY.value,
    newListingsYoY.isLoading,
    newListingsYoY.error,
    homeSalesYoY.value,
    homeSalesYoY.isLoading,
    homeSalesYoY.error,
    popGrowth.value,
    popGrowth.isLoading,
    popGrowth.error,
    jobGrowth.value,
    jobGrowth.isLoading,
    jobGrowth.error,
    // Benchmark national
    homeValueNat.value,
    homeValueNat.isLoading,
    homeValueNat.error,
    rentIndexNat.value,
    rentIndexNat.isLoading,
    rentIndexNat.error,
    medianIncomeNat.value,
    medianIncomeNat.isLoading,
    medianIncomeNat.error,
    daysOnMarket.value,
    daysOnMarket.isLoading,
    daysOnMarket.error,
    daysOnMarketNat.value,
    daysOnMarketNat.isLoading,
    daysOnMarketNat.error,
    popGrowthNat.value,
    popGrowthNat.isLoading,
    popGrowthNat.error,
    jobGrowthNat.value,
    jobGrowthNat.isLoading,
    jobGrowthNat.error,
    // Score
    scoreData.isLoading,
    scoreData.error,
    scoreData.gating,
    scoreData.data,
    scoreData.homeready,
    scoreData.investoredge,
    scoreData.markethealth,
    scoreType,
    geoLevel,
  ]);

  return result;
}

export default useWaterfallData;

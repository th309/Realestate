/**
 * Inheritance Service
 *
 * Handles geographic data inheritance for PropertyIQ scoring.
 * When metrics are unavailable at granular levels (ZIP, City),
 * inherits from parent geographies: County → Metro → State → National.
 *
 * Inheritance Chain:
 * - ZIP → County → Metro → State → National
 * - City → County → Metro → State → National
 * - County → Metro → State → National
 * - Metro → State → National
 * - State → National
 */

import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { buildInheritanceOrder } from './inheritance-order.helper';
import { fetchMetricValue } from './inheritance-metric-fetcher.helper';
import {
  GeographyChain,
  MetricWithSource,
  MetricsBundle,
} from './inheritance.types';

export type {
  GeographyChain,
  MetricWithSource,
  MetricsBundle,
} from './inheritance.types';
export { INHERITABLE_METRICS } from './inheritance.types';

@Injectable()
export class InheritanceService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Get the full inheritance chain for a geography
   */
  async getGeographyChain(geographyId: string): Promise<GeographyChain | null> {
    const { data, error } = await this.supabase
      .from('geography_crosswalk')
      .select('zip_code, county_fips, cbsa_code, state_fips')
      .eq('zip_code', geographyId)
      .single();

    if (error || !data) {
      console.warn(`No inheritance chain found for ${geographyId}`);
      return null;
    }

    return {
      geographyId: data.zip_code,
      geographyType: 'zip',
      countyFips: data.county_fips,
      metroCbsa: data.cbsa_code,
      stateFips: data.state_fips,
      parentCountyFips: data.county_fips,
      parentMetroCbsa: data.cbsa_code,
      parentStateFips: data.state_fips,
    };
  }

  /**
   * Get a single metric with inheritance fallback
   */
  async getMetricWithInheritance(
    geographyId: string,
    metricName: string,
    tableName: string,
    periodDate: string,
  ): Promise<MetricWithSource> {
    const chain = await this.getGeographyChain(geographyId);

    if (!chain) {
      return {
        value: null,
        sourceGeographyId: null,
        sourceGeographyType: null,
        isInherited: false,
      };
    }

    // Build inheritance order based on geography type
    const inheritanceOrder = buildInheritanceOrder(chain);

    // Try each geography in order
    for (const geo of inheritanceOrder) {
      const value = await fetchMetricValue(
        this.supabase,
        geo.id,
        geo.type,
        metricName,
        tableName,
        periodDate,
      );

      if (value !== null) {
        return {
          value,
          sourceGeographyId: geo.id,
          sourceGeographyType: geo.type,
          isInherited: geo.id !== geographyId,
        };
      }
    }

    // No value found at any level
    return {
      value: null,
      sourceGeographyId: null,
      sourceGeographyType: null,
      isInherited: false,
    };
  }

  /**
   * Fetch all metrics with inheritance for a geography
   */
  async fetchAllMetricsWithInheritance(
    geographyId: string,
    metricConfigs: Array<{
      name: string;
      table: string;
      columnName?: string;
    }>,
    periodDate: string,
  ): Promise<MetricsBundle> {
    const chain = await this.getGeographyChain(geographyId);
    const metrics: Record<string, MetricWithSource> = {};
    let inheritedCount = 0;
    let directCount = 0;
    let missingCount = 0;

    if (!chain) {
      // No inheritance chain - try direct fetch only
      for (const config of metricConfigs) {
        const value = await fetchMetricValue(
          this.supabase,
          geographyId,
          'unknown',
          config.columnName || config.name,
          config.table,
          periodDate,
        );

        if (value !== null) {
          directCount++;
          metrics[config.name] = {
            value,
            sourceGeographyId: geographyId,
            sourceGeographyType: 'direct',
            isInherited: false,
          };
        } else {
          missingCount++;
          metrics[config.name] = {
            value: null,
            sourceGeographyId: null,
            sourceGeographyType: null,
            isInherited: false,
          };
        }
      }

      const total = metricConfigs.length;
      return {
        metrics,
        inheritedCount,
        directCount,
        missingCount,
        completeness:
          total > 0 ? ((directCount + inheritedCount) / total) * 100 : 0,
      };
    }

    const inheritanceOrder = buildInheritanceOrder(chain);

    for (const config of metricConfigs) {
      let found = false;

      for (const geo of inheritanceOrder) {
        const value = await fetchMetricValue(
          this.supabase,
          geo.id,
          geo.type,
          config.columnName || config.name,
          config.table,
          periodDate,
        );

        if (value !== null) {
          const isInherited = geo.id !== geographyId;
          if (isInherited) {
            inheritedCount++;
          } else {
            directCount++;
          }

          metrics[config.name] = {
            value,
            sourceGeographyId: geo.id,
            sourceGeographyType: geo.type,
            isInherited,
          };
          found = true;
          break;
        }
      }

      if (!found) {
        missingCount++;
        metrics[config.name] = {
          value: null,
          sourceGeographyId: null,
          sourceGeographyType: null,
          isInherited: false,
        };
      }
    }

    const total = metricConfigs.length;
    return {
      metrics,
      inheritedCount,
      directCount,
      missingCount,
      completeness:
        total > 0 ? ((directCount + inheritedCount) / total) * 100 : 0,
    };
  }

  /**
   * Get inherited metrics summary for display
   */
  getInheritedMetricsSummary(
    metrics: Record<string, MetricWithSource>,
  ): Record<string, string> {
    const summary: Record<string, string> = {};

    for (const [name, metric] of Object.entries(metrics)) {
      if (metric.isInherited && metric.sourceGeographyType) {
        summary[name] = `inherited_${metric.sourceGeographyType}`;
      }
    }

    return summary;
  }
}

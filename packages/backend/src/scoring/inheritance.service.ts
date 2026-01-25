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
import { normalizeZipKey } from '../common/zip';
import {
  normalizeStateToCode,
  normalizeStateToFips,
  normalizeCountyFips,
  normalizeCbsaCode,
} from '../common/geo.js';

export interface GeographyChain {
  geographyId: string;
  geographyType: string;
  countyFips: string | null;
  metroCbsa: string | null;
  stateFips: string | null;
  parentCountyFips: string | null;
  parentMetroCbsa: string | null;
  parentStateFips: string | null;
}

export interface MetricWithSource {
  value: number | null;
  sourceGeographyId: string | null;
  sourceGeographyType: string | null;
  isInherited: boolean;
}

export interface MetricsBundle {
  metrics: Record<string, MetricWithSource>;
  inheritedCount: number;
  directCount: number;
  missingCount: number;
  completeness: number;
}

// Metrics that commonly need inheritance (not available at ZIP/City level)
export const INHERITABLE_METRICS = [
  'unemployment_rate',
  'employment_yoy',
  'gdp_yoy',
  'total_permits_yoy',
  'large_multi_permits_yoy',
  'sf_permits_yoy',
  'rpp_all_items',
  'rpp_housing',
] as const;

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
      .from('geography_inheritance')
      .select('*')
      .eq('geography_id', geographyId)
      .single();

    if (error || !data) {
      console.warn(`No inheritance chain found for ${geographyId}`);
      return null;
    }

    return {
      geographyId: data.geography_id,
      geographyType: data.geography_type,
      countyFips: data.county_fips,
      metroCbsa: data.metro_cbsa,
      stateFips: data.state_fips,
      parentCountyFips: data.parent_county_fips,
      parentMetroCbsa: data.parent_metro_cbsa,
      parentStateFips: data.parent_state_fips,
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
    const inheritanceOrder = this.buildInheritanceOrder(chain);

    // Try each geography in order
    for (const geo of inheritanceOrder) {
      const value = await this.fetchMetricValue(
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
        const value = await this.fetchMetricValue(
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
        completeness: total > 0 ? ((directCount + inheritedCount) / total) * 100 : 0,
      };
    }

    const inheritanceOrder = this.buildInheritanceOrder(chain);

    for (const config of metricConfigs) {
      let found = false;

      for (const geo of inheritanceOrder) {
        const value = await this.fetchMetricValue(
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
      completeness: total > 0 ? ((directCount + inheritedCount) / total) * 100 : 0,
    };
  }

  /**
   * Build the inheritance order for a geography
   */
  private buildInheritanceOrder(
    chain: GeographyChain,
  ): Array<{ id: string; type: string }> {
    const order: Array<{ id: string; type: string }> = [];

    // Always start with the direct geography
    order.push({ id: chain.geographyId, type: chain.geographyType });

    // Add parents based on geography type
    switch (chain.geographyType) {
      case 'zip':
      case 'city':
        // ZIP/City → County → Metro → State → National
        if (chain.parentCountyFips) {
          order.push({ id: chain.parentCountyFips, type: 'county' });
        }
        if (chain.parentMetroCbsa) {
          order.push({ id: chain.parentMetroCbsa, type: 'metro' });
        }
        if (chain.parentStateFips) {
          order.push({ id: chain.parentStateFips, type: 'state' });
        }
        order.push({ id: 'national', type: 'national' });
        break;

      case 'county':
        // County → Metro → State → National
        if (chain.parentMetroCbsa) {
          order.push({ id: chain.parentMetroCbsa, type: 'metro' });
        }
        if (chain.parentStateFips) {
          order.push({ id: chain.parentStateFips, type: 'state' });
        }
        order.push({ id: 'national', type: 'national' });
        break;

      case 'metro':
        // Metro → State → National
        if (chain.parentStateFips) {
          order.push({ id: chain.parentStateFips, type: 'state' });
        }
        order.push({ id: 'national', type: 'national' });
        break;

      case 'state':
        // State → National
        order.push({ id: 'national', type: 'national' });
        break;

      case 'national':
        // National has no parents
        break;
    }

    return order;
  }

  /**
   * Fetch a metric value from a specific table
   */
  private async fetchMetricValue(
    geographyId: string,
    geographyType: string,
    metricName: string,
    tableName: string,
    periodDate: string,
  ): Promise<number | null> {
    try {
      // Handle different table structures
      // Some tables use geography_id, others use specific ID columns

      let query = this.supabase.from(tableName).select(metricName);

      // Add geography filter based on table type
      if (tableName.startsWith('economic_')) {
        switch (geographyType) {
          case 'state':
            query = query.eq('state_fips', normalizeStateToFips(geographyId));
            break;
          case 'metro':
            query = query.eq('cbsa_code', /^\d+$/.test(geographyId.trim()) ? normalizeCbsaCode(geographyId) : geographyId);
            break;
          case 'county':
            query = query.eq('fips_code', /^\d+$/.test(geographyId.trim()) ? normalizeCountyFips(geographyId) : geographyId);
            break;
          case 'national':
            // National table might use 'US' or have a single row
            query = query.limit(1);
            break;
          default:
            return null;
        }
      } else if (tableName.startsWith('calculated_metrics')) {
        let id = geographyId;
        if (geographyType === 'zip') id = normalizeZipKey(geographyId);
        else if (geographyType === 'state') id = normalizeStateToCode(geographyId);
        else if (geographyType === 'county' && /^\d+$/.test(geographyId.trim())) id = normalizeCountyFips(geographyId);
        else if (geographyType === 'metro' && /^\d+$/.test(geographyId.trim())) id = normalizeCbsaCode(geographyId);
        query = query.eq('geography_id', id);
      } else if (tableName.startsWith('permits_')) {
        switch (geographyType) {
          case 'state':
            query = query.eq('state_fips', normalizeStateToFips(geographyId));
            break;
          case 'metro':
            query = query.eq('cbsa_code', /^\d+$/.test(geographyId.trim()) ? normalizeCbsaCode(geographyId) : geographyId);
            break;
          case 'county':
            query = query.eq('fips_code', /^\d+$/.test(geographyId.trim()) ? normalizeCountyFips(geographyId) : geographyId);
            break;
          default:
            return null;
        }
      } else if (tableName.startsWith('census_')) {
        switch (geographyType) {
          case 'state':
            query = query.eq('state_fips', normalizeStateToFips(geographyId));
            break;
          case 'metro':
            query = query.eq('cbsa_code', /^\d+$/.test(geographyId.trim()) ? normalizeCbsaCode(geographyId) : geographyId);
            break;
          case 'county':
            query = query.eq('fips_code', /^\d+$/.test(geographyId.trim()) ? normalizeCountyFips(geographyId) : geographyId);
            break;
          case 'zip':
            query = query.eq('zcta', normalizeZipKey(geographyId));
            break;
          case 'national':
            query = query.limit(1);
            break;
          default:
            return null;
        }
      } else {
        let id = geographyId;
        if (geographyType === 'zip') id = normalizeZipKey(geographyId);
        else if (geographyType === 'state') id = normalizeStateToCode(geographyId);
        else if (geographyType === 'county' && /^\d+$/.test(geographyId.trim())) id = normalizeCountyFips(geographyId);
        else if (geographyType === 'metro' && /^\d+$/.test(geographyId.trim())) id = normalizeCbsaCode(geographyId);
        query = query.eq('geography_id', id);
      }

      // Add period date filter
      query = query.eq('period_date', periodDate);

      const { data, error } = await query.limit(1).single();

      if (error || !data) {
        return null;
      }

      const value = data[metricName];
      return typeof value === 'number' ? value : null;
    } catch (err) {
      console.warn(
        `Error fetching ${metricName} from ${tableName} for ${geographyId}:`,
        err,
      );
      return null;
    }
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

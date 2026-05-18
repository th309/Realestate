/**
 * Employment-by-sector fallbacks. Each NAICS supersector falls back from
 * CES (Current Employment Statistics, metro/state-level) to QCEW (Quarterly
 * Census of Employment and Wages, county/metro). Geographic inheritance is
 * enabled so a ZIP request walks up to county or metro to find data.
 */

import { MetricFallbackChain } from '../metric-resolution.types';

export const employmentMetrics: Record<string, MetricFallbackChain> = {
  employment_natural_resources_mining: {
    metricId: 'employment_natural_resources_mining',
    sources: [
      { source: 'ces', column: 'ces_employment_natural_resources_mining' },
      { source: 'qcew', column: 'employment_natural_resources_mining' },
    ],
    supportsGeoInheritance: true,
  },

  employment_construction: {
    metricId: 'employment_construction',
    sources: [
      { source: 'ces', column: 'ces_employment_construction' },
      { source: 'qcew', column: 'employment_construction' },
    ],
    supportsGeoInheritance: true,
  },

  employment_manufacturing: {
    metricId: 'employment_manufacturing',
    sources: [
      { source: 'ces', column: 'ces_employment_manufacturing' },
      { source: 'qcew', column: 'employment_manufacturing' },
    ],
    supportsGeoInheritance: true,
  },

  employment_trade_transport_utilities: {
    metricId: 'employment_trade_transport_utilities',
    sources: [
      { source: 'ces', column: 'ces_employment_trade_transport_utilities' },
      { source: 'qcew', column: 'employment_trade_transport_utilities' },
    ],
    supportsGeoInheritance: true,
  },

  employment_information: {
    metricId: 'employment_information',
    sources: [
      { source: 'ces', column: 'ces_employment_information' },
      { source: 'qcew', column: 'employment_information' },
    ],
    supportsGeoInheritance: true,
  },

  employment_financial_activities: {
    metricId: 'employment_financial_activities',
    sources: [
      { source: 'ces', column: 'ces_employment_financial_activities' },
      { source: 'qcew', column: 'employment_financial_activities' },
    ],
    supportsGeoInheritance: true,
  },

  employment_professional_business_services: {
    metricId: 'employment_professional_business_services',
    sources: [
      {
        source: 'ces',
        column: 'ces_employment_professional_business_services',
      },
      { source: 'qcew', column: 'employment_professional_business_services' },
    ],
    supportsGeoInheritance: true,
  },

  employment_education_health_services: {
    metricId: 'employment_education_health_services',
    sources: [
      { source: 'ces', column: 'ces_employment_education_health_services' },
      { source: 'qcew', column: 'employment_education_health_services' },
    ],
    supportsGeoInheritance: true,
  },

  employment_leisure_hospitality: {
    metricId: 'employment_leisure_hospitality',
    sources: [
      { source: 'ces', column: 'ces_employment_leisure_hospitality' },
      { source: 'qcew', column: 'employment_leisure_hospitality' },
    ],
    supportsGeoInheritance: true,
  },

  employment_other_services: {
    metricId: 'employment_other_services',
    sources: [
      { source: 'ces', column: 'ces_employment_other_services' },
      { source: 'qcew', column: 'employment_other_services' },
    ],
    supportsGeoInheritance: true,
  },

  employment_public_administration: {
    metricId: 'employment_public_administration',
    sources: [
      { source: 'ces', column: 'ces_employment_public_administration' },
      { source: 'qcew', column: 'employment_public_administration' },
    ],
    supportsGeoInheritance: true,
  },
};

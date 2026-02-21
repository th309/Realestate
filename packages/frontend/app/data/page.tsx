import { Database, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { METRICS, DATA_SOURCE_ANCHORS, METRIC_DEFINITIONS, getDataSourceAnchor } from '@/lib/data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataProvider {
  id: string;
  name: string;
  description: string;
  url: string;
  updateFrequency: string;
}

// ---------------------------------------------------------------------------
// Provider catalogue -- order determines display order on the page
// ---------------------------------------------------------------------------

const DATA_PROVIDERS: DataProvider[] = [
  {
    id: 'realtor-com',
    name: 'Realtor.com',
    description:
      'Realtor.com is operated by Move, Inc. and provides comprehensive real estate listing data. As one of the largest real estate marketplaces in the United States, their research division publishes monthly housing market data covering listing prices, inventory levels, days on market, and market competitiveness indicators across metropolitan and county areas.',
    url: 'https://www.realtor.com/research/data/',
    updateFrequency: 'Monthly',
  },
  {
    id: 'zillow',
    name: 'Zillow',
    description:
      'Zillow Group publishes a suite of housing market indices through their research division. The Zillow Home Value Index (ZHVI) tracks typical home values using a repeat-sales methodology. The Zillow Observed Rent Index (ZORI) measures typical market rents. Zillow also provides home price forecasts (ZHVF), sale-to-list ratios, and affordability metrics covering hundreds of metropolitan areas and thousands of ZIP codes.',
    url: 'https://www.zillow.com/research/data/',
    updateFrequency: 'Monthly',
  },
  {
    id: 'redfin',
    name: 'Redfin',
    description:
      'Redfin is a technology-powered real estate brokerage that publishes weekly housing market data through their Data Center. Their market tracker provides median sale price, homes sold, pending sales, new listings, inventory, days on market, sale-to-list ratio, and price drop metrics across national, state, metro, county, city, ZIP code, and neighborhood levels.',
    url: 'https://www.redfin.com/news/data-center/',
    updateFrequency: 'Weekly',
  },
  {
    id: 'census',
    name: 'U.S. Census Bureau',
    description:
      'The U.S. Census Bureau conducts the American Community Survey (ACS) annually, providing detailed demographic and economic data at the national, state, county, and ZIP code level. We use Census data for population estimates, median household income, median age, homeownership rates, and vacancy rates -- key inputs for affordability and demographic analysis.',
    url: 'https://data.census.gov/',
    updateFrequency: 'Annual',
  },
  {
    id: 'fred',
    name: 'FRED (Federal Reserve Economic Data)',
    description:
      'FRED is maintained by the Federal Reserve Bank of St. Louis and aggregates economic data from dozens of government agencies. We source mortgage interest rates (Freddie Mac Primary Mortgage Market Survey) and unemployment rates at the national, state, and county level. These economic indicators drive our affordability calculations and market health assessments.',
    url: 'https://fred.stlouisfed.org/',
    updateFrequency: 'Monthly',
  },
  {
    id: 'bls',
    name: 'Bureau of Labor Statistics (BLS)',
    description:
      'The Bureau of Labor Statistics publishes the Quarterly Census of Employment and Wages (QCEW), which provides comprehensive employment data at the metro and county level. We use BLS data for job growth calculations and metro-level unemployment rates -- key indicators of local economic health and housing demand.',
    url: 'https://www.bls.gov/data/',
    updateFrequency: 'Quarterly (QCEW) / Monthly (LAUS)',
  },
  {
    id: 'bea',
    name: 'Bureau of Economic Analysis (BEA)',
    description:
      'The Bureau of Economic Analysis provides GDP estimates at the state, metro, and county level, along with Regional Price Parities (RPPs) that measure cost-of-living differences across geographies. We use BEA data for GDP growth metrics and cost-of-living indices that contextualize housing costs relative to local economic output.',
    url: 'https://www.bea.gov/data',
    updateFrequency: 'Annual',
  },
  {
    id: 'propertyiq',
    name: 'PropertyIQ (Calculated)',
    description:
      'PropertyIQ generates proprietary calculated metrics and scores by combining data from multiple sources. Our scoring engine produces HomeReady, InvestorEdge, and MarketHealth scores validated across 1.1M+ observations. We also calculate derived metrics like cap rates, gross yields, affordability indices, inventory surplus/deficit, and months of supply by combining inputs from Zillow, Realtor.com, Census, and FRED data.',
    url: '/scores/methodology',
    updateFrequency: 'Monthly',
  },
];

// ---------------------------------------------------------------------------
// Helper -- collect metric display names for a given provider card.
//
// Two-pass approach:
//   1. Registry pass  -- uses METRICS + DATA_SOURCE_ANCHORS (DataSource enum).
//      Covers providers with a dedicated DataSource value (zillow, realtor,
//      census, fred, propertyiq/calculated).
//   2. Definitions pass -- uses METRIC_DEFINITIONS + getDataSourceAnchor().
//      Catches metrics whose human-readable dataSource string maps to BLS or
//      BEA (which don't have a dedicated DataSource enum value).
//
// De-duplicates by metric id.
// ---------------------------------------------------------------------------

function getMetricsForProvider(providerId: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  // Pass 1: registry metrics (METRICS)
  for (const [id, cfg] of Object.entries(METRICS)) {
    const anchor = DATA_SOURCE_ANCHORS[cfg.dataSource];
    if (anchor === providerId && !seen.has(id)) {
      seen.add(id);
      names.push(cfg.title);
    }
  }

  // Pass 2: definition-only metrics (BLS, BEA, etc.)
  for (const [id, def] of Object.entries(METRIC_DEFINITIONS)) {
    if (seen.has(id)) continue;
    const anchor = getDataSourceAnchor(id);
    if (anchor === providerId) {
      seen.add(id);
      names.push(def.name);
    }
  }

  return names;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DataPage() {
  return (
    <>
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[{ label: 'Data Sources' }]}
        title="Data Sources"
        icon={<Database className="w-5 h-5" />}
      />

      <p className="text-on-surface-variant mt-6 mb-8 max-w-3xl">
        PropertyIQ aggregates data from trusted federal agencies and leading real estate
        data providers. Below are the sources powering our analytics, the metrics we derive
        from each, and links to their original data portals.
      </p>

      <div className="space-y-10">
        {DATA_PROVIDERS.map((provider) => {
          const metrics = getMetricsForProvider(provider.id);
          const isExternal = provider.url.startsWith('http');

          return (
            <section
              key={provider.id}
              id={provider.id}
              className="scroll-mt-24 bg-surface-container-low rounded-2xl p-6 md:p-8 elevation-1"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-container rounded-xl">
                    <Database className="w-5 h-5 text-on-primary-container" />
                  </div>
                  <h2 className="text-xl font-semibold text-on-surface">
                    {provider.name}
                  </h2>
                </div>

                {isExternal ? (
                  <a
                    href={provider.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors shrink-0"
                  >
                    Visit portal
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <Link
                    href={provider.url}
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors shrink-0"
                  >
                    View methodology
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                {provider.description}
              </p>

              {/* Update frequency badge */}
              <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-3">
                <span className="font-medium">Update frequency:</span>
                <span className="bg-surface-container px-2 py-0.5 rounded-full">
                  {provider.updateFrequency}
                </span>
              </div>

              {/* Metric chips */}
              {metrics.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                    Metrics ({metrics.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {metrics.map((name, i) => (
                      <span
                        key={`${name}-${i}`}
                        className="text-xs bg-surface-container px-2.5 py-1 rounded-full text-on-surface-variant"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
